import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios"; // Still needed for ML/LLM calls
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css"; // CSS for drawing controls
import 'leaflet-draw'; // Import the Leaflet Draw JavaScript explicitly
import "./App.css"; // General App styles
import "./VirtualFarmTwin.css"; // Component-specific styles

// Firebase imports for data interaction
import { getUserData, saveUserData } from './firebase';
import { getAuth } from 'firebase/auth';

// --- Constants ---
const LS_KEYS = {
    RESPONSE: 'agriverse_response', // Cache LLM response
    ML_PREDICTION: 'agriverse_ml_prediction' // Cache ML prediction
};

// --- Helper Functions ---

// Stringify GeoJSON for Firestore storage
const stringifyBoundaryForFirebase = (boundaryGeoJson) => {
    if (!boundaryGeoJson) return null;
    try {
        if (boundaryGeoJson.type === 'Feature' && boundaryGeoJson.geometry) {
            return JSON.stringify(boundaryGeoJson);
        } else {
            console.warn("Attempted to stringify invalid GeoJSON Feature:", boundaryGeoJson);
            return null;
        }
    } catch (e) {
        console.error("Error stringifying boundary GeoJSON:", e);
        return null;
    }
};

// Simple Water Need Estimation (Hackathon Feature)
const estimateWaterNeed = (soilType, currentMonth) => {
    soilType = soilType?.toLowerCase() || "unknown";
    let baseNeed = 1.0;
    if (soilType.includes("clay")) baseNeed *= 0.8;
    else if (soilType.includes("sandy") || soilType.includes("gravel")) baseNeed *= 1.25;
    else if (soilType.includes("loam")) baseNeed *= 1.0;
    else if (soilType.includes("silt")) baseNeed *= 0.9;
    else if (soilType.includes("peat")) baseNeed *= 0.7;

    // Approx season in Hyderabad (May 1st 2025 is Summer end/pre-Monsoon)
    let seasonalMultiplier = 1.0;
    if (currentMonth >= 2 && currentMonth <= 4) seasonalMultiplier = 1.3; // Summer
    else if (currentMonth >= 5 && currentMonth <= 9) seasonalMultiplier = 0.7; // Monsoon
    else seasonalMultiplier = 0.9; // Winter

    const finalScore = baseNeed * seasonalMultiplier;
    if (finalScore > 1.15) return "High";
    if (finalScore >= 0.85) return "Medium";
    return "Low";
};

function VirtualFarmTwin() {
  // --- State Variables ---
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userData, setUserData] = useState(null);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [farmBoundaryData, setFarmBoundaryData] = useState(null);
  const [activeMapLayer, setActiveMapLayer] = useState("satellite");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState(() => localStorage.getItem(LS_KEYS.RESPONSE) || "");
  const [mlPrediction, setMlPrediction] = useState(() => localStorage.getItem(LS_KEYS.ML_PREDICTION) || "");
  const [soilTypeOverride, setSoilTypeOverride] = useState("");
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [defaultQuerySent, setDefaultQuerySent] = useState(false);
  const [estimatedWaterNeed, setEstimatedWaterNeed] = useState("Calculating...");

  // --- Refs ---
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapLayers = useRef({});
  const farmBoundaryLayerRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const drawControlRef = useRef(null);

  // --- Authentication and Data Loading ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        console.log("Auth state: User authenticated", user.uid);
        if (!authChecked || !userData) { loadFarmData(); }
      } else {
        console.log("Auth state: User not authenticated.");
        setIsLoading(false); setError("User not signed in. Please sign in."); setUserData(null); setLat(null); setLon(null); setFarmBoundaryData(null);
        if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; console.log("Map instance removed on sign out."); }
      }
      setAuthChecked(true);
    });
    return () => { console.log("Cleaning up auth listener."); unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, userData]); // Added userData dependency

  // Function to load all necessary user and farm data from Firestore
  const loadFarmData = useCallback(async () => {
    console.log("Loading farm data from Firestore...");
    setIsLoading(true); setError(null); setUserData(null); setFarmBoundaryData(null); setDefaultQuerySent(false); setEstimatedWaterNeed("Calculating...");

    try {
      const fetchedData = await getUserData();
      if (!fetchedData) throw new Error("Could not load your farm profile. Please ensure you have completed the onboarding process.");
      console.log("Firestore data fetched successfully:", fetchedData);
      setUserData(fetchedData);

      if (fetchedData.location?.latitude && fetchedData.location?.longitude) {
          setLat(fetchedData.location.latitude);
          setLon(fetchedData.location.longitude);
          initializeOrUpdateMap(fetchedData.location.latitude, fetchedData.location.longitude);
      } else {
          throw new Error("Farm location data is missing or invalid in your profile.");
      }

      setSoilTypeOverride(fetchedData.soilTexture || "");
      setFarmBoundaryData(fetchedData.farmBoundary || null);

      const currentMonth = new Date().getMonth(); // Use current date for water need
      const waterNeed = estimateWaterNeed(fetchedData.soilTexture, currentMonth);
      setEstimatedWaterNeed(waterNeed);
      console.log(`Estimated Water Need: ${waterNeed} (Soil: ${fetchedData.soilTexture || 'N/A'}, Month: ${currentMonth})`);

      fetchMlPrediction(fetchedData.location.latitude, fetchedData.location.longitude);

    } catch (err) {
      console.error("Error during loadFarmData execution:", err);
      setError(err.message || "An unexpected error occurred while loading farm data.");
      setLat(null); setLon(null);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; console.log("Map instance removed due to data loading error."); }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No internal dependencies needed, triggered externally

  // --- Effect to trigger default LLM query after successful data load ---
   useEffect(() => {
       if (!isLoading && userData && !defaultQuerySent && lat && lon) {
           console.log("User data loaded. Triggering initial suggestions/insights...");
           getDefaultSuggestions();
           setDefaultQuerySent(true);
       }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isLoading, userData, defaultQuerySent, lat, lon]); // Runs after data load

   // --- Map Initialization and Updates ---
  const initializeOrUpdateMap = useCallback((latitude, longitude) => {
    if (!L) { console.error("Leaflet library (L) is not loaded."); return; }

    if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], mapRef.current.getZoom() || 15);
        if (locationMarkerRef.current) {
            locationMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
             locationMarkerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current).bindPopup("<b>📍 Farm Location</b>").openPopup();
        }
        requestAnimationFrame(() => mapRef.current?.invalidateSize());
        console.log("Map view updated.");
        return;
    }

    if (!mapContainerRef.current || mapContainerRef.current.clientHeight === 0) {
        console.warn('Map container ref not found or has zero height. Retrying...');
        setTimeout(() => initializeOrUpdateMap(latitude, longitude), 250);
        return;
    }

    try {
      console.log("Initializing new Leaflet map instance...");
      const leafletMap = L.map(mapContainerRef.current, { center: [latitude, longitude], zoom: 15, attributionControl: true });
      mapRef.current = leafletMap;

      const layers = {
         satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 19 }),
         topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: 'Map data: &copy; OSM, SRTM | Map style: &copy; OpenTopoMap' }),
         standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors' })
       };
      mapLayers.current = layers;
      layers[activeMapLayer]?.addTo(leafletMap) || layers.satellite.addTo(leafletMap);

      if (locationMarkerRef.current) leafletMap.removeLayer(locationMarkerRef.current);
      locationMarkerRef.current = L.marker([latitude, longitude]).addTo(leafletMap).bindPopup("<b>📍 Farm Location Center</b>").openPopup();

      farmBoundaryLayerRef.current = new L.FeatureGroup().addTo(leafletMap);

      drawControlRef.current = new L.Control.Draw({
          edit: { featureGroup: farmBoundaryLayerRef.current, poly: { allowIntersection: false }, remove: true },
          draw: { polygon: { allowIntersection: false, shapeOptions: { color: '#ff7800', weight: 3, fillOpacity: 0.1 }, showArea: true, metric: true, feet: false }, rectangle: false, polyline: false, circle: false, marker: false, circlemarker: false }
      });
      leafletMap.addControl(drawControlRef.current);

      leafletMap.on(L.Draw.Event.CREATED, handleBoundaryCreated);
      leafletMap.on(L.Draw.Event.EDITED, handleBoundaryEdited);
      leafletMap.on(L.Draw.Event.DELETED, handleBoundaryDeleted);

      requestAnimationFrame(() => { mapRef.current?.invalidateSize({ pan: false }); console.log("Map initialized & size invalidated."); });

    } catch (err) {
      console.error("Error during map initialization:", err); setError("Could not initialize the map interface.");
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapLayer]); // Keep dependency

  // --- Boundary Handling Callbacks (Immediate Firestore Update) ---
  const handleBoundaryCreated = useCallback(async (e) => {
    const layer = e.layer; const newGeoJSON = layer.toGeoJSON(); console.log("Boundary created:", newGeoJSON);
    if (farmBoundaryLayerRef.current) { farmBoundaryLayerRef.current.clearLayers(); farmBoundaryLayerRef.current.addLayer(layer); }
    setFarmBoundaryData(newGeoJSON); const stringifiedBoundary = stringifyBoundaryForFirebase(newGeoJSON);
    if (stringifiedBoundary) {
        try { await saveUserData({ farmBoundary: stringifiedBoundary }); console.log("New boundary saved successfully to Firestore."); }
        catch (error) { console.error("Failed to save new boundary:", error); alert("Error saving the new boundary."); }
    } else { console.error("Could not stringify new boundary."); alert("Error processing boundary shape."); }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

  const handleBoundaryEdited = useCallback(async (e) => {
       const layers = e.layers; let updatedGeoJSON = null; layers.eachLayer(layer => { updatedGeoJSON = layer.toGeoJSON(); });
       if (updatedGeoJSON) {
           console.log("Boundary edited:", updatedGeoJSON); setFarmBoundaryData(updatedGeoJSON);
           const stringifiedBoundary = stringifyBoundaryForFirebase(updatedGeoJSON);
            if (stringifiedBoundary) {
                try { await saveUserData({ farmBoundary: stringifiedBoundary }); console.log("Edited boundary saved successfully to Firestore."); }
                catch (error) { console.error("Failed to save edited boundary:", error); alert("Error saving edited boundary."); }
            } else { console.error("Could not stringify edited boundary."); alert("Error processing edited boundary shape."); }
       } else { console.warn("Edit event triggered, but no updated GeoJSON found."); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

  const handleBoundaryDeleted = useCallback(async () => {
       console.log("Boundary delete event triggered."); setFarmBoundaryData(null);
       try { await saveUserData({ farmBoundary: null }); console.log("Boundary deleted successfully in Firestore."); }
       catch (error) { console.error("Failed to delete boundary in Firestore:", error); alert("Error removing boundary."); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

  // --- Effect to Draw Initial Boundary & Fit View (Zoom Requirement) ---
   useEffect(() => {
     if (mapRef.current && farmBoundaryData && farmBoundaryLayerRef.current) {
         if (farmBoundaryLayerRef.current.getLayers().length === 0) {
             console.log("Drawing initial/fetched boundary:", farmBoundaryData);
             try {
                 if (farmBoundaryData.type !== 'Feature' || !farmBoundaryData.geometry) throw new Error("Invalid GeoJSON structure.");
                 const boundaryLayer = L.geoJSON(farmBoundaryData, { style: { color:"#ff7800", weight:3, opacity:0.9, fillColor:"#ff7800", fillOpacity:0.1 } }).bindPopup("<b>Your Farm Boundary</b> (Editable)");
                 farmBoundaryLayerRef.current.addLayer(boundaryLayer);
                 requestAnimationFrame(() => { // Ensure DOM update before fitting
                    if (mapRef.current && boundaryLayer.getBounds().isValid()) {
                        mapRef.current.fitBounds(boundaryLayer.getBounds().pad(0.1), { maxZoom: 18 }); // Zooms to boundary
                        console.log("Map fitted to initial boundary.");
                    }
                 });
             } catch (error) { console.error("Error drawing initial farm boundary:", error); setError("Could not display the saved farm boundary."); }
         } else { // Boundary exists, layers are present, re-fit maybe on data change?
              requestAnimationFrame(() => {
                  if(mapRef.current && farmBoundaryLayerRef.current.getBounds().isValid()){
                      mapRef.current.fitBounds(farmBoundaryLayerRef.current.getBounds().pad(0.1), { maxZoom: 18 });
                      console.log("Refitting bounds to existing boundary layer.");
                  }
              });
         }
     } else if (mapRef.current && !farmBoundaryData && farmBoundaryLayerRef.current?.getLayers().length > 0) {
         farmBoundaryLayerRef.current.clearLayers();
         console.log("Boundary data is null. Cleared boundary layers from map.");
     }
     // Check mapRef.current readiness along with boundary data
   }, [farmBoundaryData, mapRef, farmBoundaryLayerRef]);

  // --- API Calls (ML & LLM - Unchanged logic) ---
  const fetchMlPrediction = useCallback(async (latitude, longitude) => {
    if(isNaN(latitude)||isNaN(longitude))return null; const payload={lat:latitude,lon:longitude};
    setMlPrediction("⏳ Predicting..."); localStorage.removeItem(LS_KEYS.ML_PREDICTION);
    try{ const apiUrl=import.meta.env.VITE_ML_API_URL||"http://127.0.0.1:5000/predict"; const mlResponse=await axios.post(apiUrl,payload,{timeout:15000}); if(mlResponse.data?.recommended_crop){const p=mlResponse.data.recommended_crop; setMlPrediction(p); localStorage.setItem(LS_KEYS.ML_PREDICTION,p); return p;}else{throw new Error("Invalid ML response format");}}catch(e){console.error("ML Prediction Error:",e); let m="Prediction failed: "; if(e.code==='ECONNABORTED')m+="Timeout."; else if(e.response)m+=`API Error ${e.response.status}.`; else if(e.request)m+="Server unreachable."; else m+=e.message; setMlPrediction(m); return null;}
  }, []);

  const getLlmResponse = useCallback(async (prompt) => {
    if(!prompt)return; setResponse("⏳ Thinking..."); localStorage.removeItem(LS_KEYS.RESPONSE);
    try{ const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", { model:"mistralai/mixtral-8x7b-instruct", messages:[{role:"user",content:prompt}], max_tokens:800, temperature:0.4}, { headers:{Authorization:`Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,"Content-Type":"application/json"}, timeout:35000}); const reply = res.data?.choices?.[0]?.message?.content; setResponse(reply||"⚠️ No response received."); if(reply) localStorage.setItem(LS_KEYS.RESPONSE,reply); }catch(err){ console.error("LLM API Error:",err); let msg="⚠️ Assistant Error: "; if(err.code==='ECONNABORTED')msg+="Request Timeout."; else if(err.response)msg+=`API error ${err.response.status}${err.response.data?.error?.message ? ' - '+err.response.data.error.message : '.'}`; else msg+=err.message; setResponse(msg); }
  }, []);

  // --- Generate Initial Suggestions / Insights (LLM Prompt Logic - Refined for Impact) ---
  const getDefaultSuggestions = useCallback(() => {
     if (isLoading || !userData || !lat || !lon) { return; }
     console.log("Generating initial suggestions/insights for track:", userData.track);

     const currentSoil = soilTypeOverride || userData.soilTexture || "Not specified";
     const locationCtx = userData.manualLocation ? `${userData.manualLocation} (${lat.toFixed(4)}N, ${lon.toFixed(4)}E)` : `Location (${lat.toFixed(4)}N, ${lon.toFixed(4)}E)`;
     const currentMlPrediction = mlPrediction === "⏳ Predicting..." ? "Calculating..." : (mlPrediction || "Unavailable");
     const isMlPredictionValid = currentMlPrediction && !currentMlPrediction.startsWith('Pred') && currentMlPrediction !== 'Calculating...' && currentMlPrediction !== 'Unavailable'; // Adjusted check

     let prompt = `
Act as AgriVerse GPT, a focused farming assistant for user "${userData.name || 'User'}" regarding their farm "${userData.farmName || 'Farm'}".

Current Farm Context:
- Location: ${locationCtx}
- Soil Type: ${currentSoil}
- Estimated Water Need: ${estimatedWaterNeed} (Approx. for current season in Hyderabad region)
- Water Sources: ${userData.waterSources?.join(', ') || 'N/A'}
- User Track: ${userData.track || 'Unknown'}
- Latest ML Crop Suggestion: ${isMlPredictionValid ? currentMlPrediction : 'N/A'}
`;

    if (userData.track === 'explore') {
        prompt += `- Experience: ${userData.experienceLevel || 'N/A'}\n- Learning Goals: ${userData.learningGoals?.join(', ') || 'N/A'}\n`;
        prompt += `
Task: Provide welcoming, introductory advice tailored for the EXPLORATION track. Focus on impact and quick wins.
1. Friendly greeting.
2. Briefly acknowledge the farm context (location, soil, water need).
3. Suggest 2 suitable crops for exploration (🌾🤔). Briefly state why each is interesting for learning/easy start.
4. Suggest 1-2 simple, actionable learning activities related to their goals (or general topics). **Highlight one as a potential 'quick win' learning tip (🌱💡).**
5. Mention the ML suggestion (if valid) as another exploration idea.
6. End with encouragement. Keep it concise & beginner-friendly. NO CROP HISTORY ANALYSIS.
`;
    } else if (userData.track === 'progress') {
        const currentCropsList = userData.currentCrops?.join(', ') || 'None specified';
        prompt += `- Current Crops: ${currentCropsList}\n- Tracking Goals: ${userData.trackingGoals?.join(', ') || 'N/A'}\n`;
        prompt += `
Task: Provide actionable insights for the PROGRESS track farmer based on their *current* setup. Focus on impact. **DO NOT suggest new crops.**
1. Brief professional greeting.
2. Acknowledge context (location, soil, water need, current crops: "${currentCropsList}").
3. **Evaluate the current crops decision:** Compare "${currentCropsList}" to ML suggestion ("${isMlPredictionValid ? currentMlPrediction : 'N/A'}"). Assess suitability (📈 / ⚠️). Provide 1-2 concise insights from this comparison.
4. Suggest 1-2 *specific*, immediate monitoring or analysis actions related to tracking goals & *current* crops. **Highlight the single most impactful action first (🚀📊).**
5. Keep tone practical, analytical. Encourage questions about managing current crops.
`;
    } else { // Fallback
         prompt += `Task: Provide general initial recommendations. List 2-3 suitable crops (🌾📝). Mention ML suggestion if valid. Keep concise.`;
    }
     getLlmResponse(prompt);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, userData, lat, lon, soilTypeOverride, estimatedWaterNeed, mlPrediction, getLlmResponse]);

  // --- Handle User Query Submission (Refined Prompt) ---
  const sendPrompt = useCallback(() => {
     if (!input.trim()) { getDefaultSuggestions(); return; }
     if (isLoading || !userData || !lat || !lon) { setResponse("⚠️ Data not loaded."); return; }
     console.log("Handling user query submission:", input);

      const currentSoil = soilTypeOverride || userData.soilTexture || "Not specified";
      const locationCtx = userData.manualLocation ? `${userData.manualLocation} (${lat.toFixed(4)}N, ${lon.toFixed(4)}E)` : `Location (${lat.toFixed(4)}N, ${lon.toFixed(4)}E)`;
      const currentMlPrediction = mlPrediction === "⏳ Predicting..." ? "Calculating..." : (mlPrediction || "Unavailable");
      const isMlPredictionValid = currentMlPrediction && !currentMlPrediction.startsWith('Pred') && currentMlPrediction !== 'Calculating...' && currentMlPrediction !== 'Unavailable';

      let prompt = `
Act as AgriVerse GPT, assisting user "${userData.name || 'User'}" with farm "${userData.farmName || 'Farm'}".

Farm Context:
- Location: ${locationCtx}
- Soil Type: ${currentSoil}
- Est. Water Need: ${estimatedWaterNeed}
- User Track: ${userData.track || 'Unknown'}
- Water Src: ${userData.waterSources?.join(', ') || 'N/A'}
- ML Sug.: ${isMlPredictionValid ? currentMlPrediction : 'N/A'}
`;
    if (userData.track === 'explore') {
        prompt += `- Experience: ${userData.experienceLevel || 'N/A'}\n- Goals: ${userData.learningGoals?.join(', ') || 'N/A'}\n`;
    } else if (userData.track === 'progress') {
        prompt += `- Crops: ${userData.currentCrops?.join(', ') || 'N/A'}\n- Goals: ${userData.trackingGoals?.join(', ') || 'N/A'}\n`;
    }

    prompt += `
User Query: "${input}"

Task: Answer the user's query directly & concisely. **Tailor the response impactfully based on the user's track:**
- **Explore Track:** Prioritize explanations, learning resources, 'why' behind advice. Be encouraging. Suggest simple next steps.
- **Progress Track:** Focus on practical, actionable advice for efficiency/problem-solving. Relate to their farm ops/current crops. If asking for *new* crops, gently redirect to analysis/goals first. **Try to offer data-driven insights where possible.**
- **General:** Use Farm Context. Use bullet points (✨🌱💡🚀📊) for clarity. Be practical, avoid filler. **Highlight the most important takeaway or action if appropriate.**
`;
     getLlmResponse(prompt);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, userData, lat, lon, soilTypeOverride, estimatedWaterNeed, mlPrediction, getLlmResponse, getDefaultSuggestions]);

  // --- Basic UI Event Handlers ---
   const handleChangeMapLayer = useCallback((layerName) => {
       if (!mapRef.current || !mapLayers.current?.[layerName]) return;
       if (mapLayers.current[activeMapLayer]) { mapRef.current.removeLayer(mapLayers.current[activeMapLayer]); }
       mapLayers.current[layerName].addTo(mapRef.current); setActiveMapLayer(layerName);
   }, [activeMapLayer]);

   const toggleNavMenu = useCallback(() => setShowNavMenu(prev => !prev), []);

   // --- Fullscreen Handling ---
   const toggleFullscreen = useCallback(() => {
       if (!mapContainerRef.current) return;
       const elem = mapContainerRef.current.closest('.map-container-wrapper');
       if (!elem) { console.error("Fullscreen target wrapper not found"); return; }
       if (!document.fullscreenElement) { elem.requestFullscreen().catch(err => alert(`Fullscreen error: ${err.message}`)); }
       else { if (document.exitFullscreen) { document.exitFullscreen().catch(err => alert(`Exit fullscreen error: ${err.message}`)); } }
   }, []);

   useEffect(() => { // Fullscreen change listener
       const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
            setIsMapFullscreen(isCurrentlyFullscreen);
            setTimeout(() => { mapRef.current?.invalidateSize(); console.log("Map size invalidated after FS change."); }, 150);
       };
       document.addEventListener('fullscreenchange', handleFullscreenChange);
       return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
   }, []);

   useEffect(() => { // Window resize listener
     const handleResize = () => { if (mapRef.current) { requestAnimationFrame(() => mapRef.current?.invalidateSize()); } };
     window.addEventListener('resize', handleResize);
     return () => window.removeEventListener('resize', handleResize);
   }, []);


  // --- Render Logic ---
  if (isLoading && !authChecked) { return <div className="loading-fullpage"><div className="spinner"></div><p>Authenticating User...</p></div>; }
  if (isLoading) { return <div className="loading-fullpage"><div className="spinner"></div><p>Loading Your Virtual Farm Twin...</p></div>; }
  if (error) { return <div className="error-fullpage"><h2>⚠️ Loading Error</h2><p>{error}</p><button onClick={loadFarmData} className="retry-button">Try Reloading</button></div>; }
  if (!userData || !lat || !lon) { return <div className="error-fullpage"><h2>⚠️ Profile Incomplete</h2><p>We couldn't load essential farm data. Please ensure your profile is complete via onboarding.</p></div>; }

  // --- Main Application Render ---
  const displayLocation = userData.manualLocation || `GPS Coordinates`;
  const locationTitle = userData.manualLocation ? `GPS: ${lat.toFixed(5)}N, ${lon.toFixed(5)}E` : `Farm Center: ${lat.toFixed(5)}N, ${lon.toFixed(5)}E`;
  const trackClass = userData.track ? `${userData.track}-track` : 'unknown-track'; // Add track class

  return (
    // Apply track class and fullscreen class conditionally
    <div className={`agri-app ${trackClass} ${isMapFullscreen ? 'map-fullscreen-active' : ''}`}>

      {/* Header (Hidden when map is fullscreen) */}
       {!isMapFullscreen && (
          <header className="app-header minimal">
             <div className="logo-section"><h1>🌍 {userData.farmName || 'AgriVerse Twin'}</h1></div>
             <div className="nav-menu-container">
                 <button className="menu-toggle" onClick={toggleNavMenu} aria-label="Toggle Navigation Menu">☰</button>
                 {showNavMenu && (
                     <nav className="nav-menu">
                         <ul>
                             <li><button onClick={() => { getDefaultSuggestions(); toggleNavMenu(); }}>Get Default Suggestions</button></li>
                             <li><button onClick={() => { setInput(""); setResponse(""); toggleNavMenu(); }}>Clear Query & Response</button></li>
                             <li><button onClick={() => { loadFarmData(); toggleNavMenu(); }}>Reload Farm Data</button></li>
                         </ul>
                     </nav>
                 )}
             </div>
          </header>
       )}

      {/* --- Main Content Area (Flex Layout) --- */}
      <div className="main-content">

        {/* --- Left Panel (Info & Input - Hidden when map is fullscreen) --- */}
         {!isMapFullscreen && (
             <div className="left-panel">

                 {/* Farm Information Card - Add track class */}
                 <div className={`info-card card ${trackClass}-card`}>
                     <h3> farm-info Farm Dashboard</h3>
                     <div className="farm-details">
                          <div className="detail-item"><span className="detail-icon" title="Farmer Name">🧑‍🌾</span><div><h4>Farmer</h4><p>{userData.name || 'N/A'}</p></div></div>
                          <div className="detail-item"><span className="detail-icon" title="Farm Name">🏡</span><div><h4>Farm</h4><p>{userData.farmName || 'N/A'}</p></div></div>
                         <div className="detail-item"><span className="detail-icon" title="Location">📍</span><div><h4>Location</h4><p title={locationTitle}>{displayLocation}</p></div></div>
                         <div className="detail-item"><span className="detail-icon" title="Soil Type from Profile">🌱</span><div><h4>Soil (Profile)</h4><p>{userData.soilTexture || 'Not Set'}</p></div></div>
                         <div className="detail-item water-need"><span className="detail-icon" title="Estimated Water Need">💧</span><div><h4>Est. Water Need</h4><p className={`water-need-${estimatedWaterNeed.toLowerCase()}`}>{estimatedWaterNeed}</p></div></div>
                          <div className="detail-item"><span className="detail-icon" title="Water Sources">⛲</span><div><h4>Water Sources</h4><p>{userData.waterSources?.join(', ') || 'Not Set'}</p></div></div>
                         <div className="detail-item track-indicator"><span className="detail-icon" title="User Track">{userData.track === 'explore' ? '🧭' : '📈'}</span><div><h4>Track</h4><p>{userData.track || 'N/A'}</p></div></div>
                     </div>
                 </div>

                 {/* Track-Specific Information Card - Add track class */}
                 {userData.track === 'explore' && (
                     <div className={`info-card card ${trackClass}-card`}>
                         <h3>🧭 Learning Goals & Experience</h3>
                         {userData.experienceLevel && <p className="detail-item"><strong>Experience:</strong> {userData.experienceLevel}</p> }
                         {userData.learningGoals?.length > 0 && (
                           <>
                             <h4>Goals:</h4>
                             <ul className="goal-list">
                                 {userData.learningGoals.map((goal, index) => <li key={index}>💡 {goal}</li>)}
                             </ul>
                           </>
                         )}
                     </div>
                 )}
                 {userData.track === 'progress' && (
                      <div className={`info-card card ${trackClass}-card`}>
                          <h3>📈 Progress Tracking Info</h3>
                          <div className="farm-details">
                               {userData.currentCrops?.length > 0 && (
                                 <div className="detail-item"> <span className="detail-icon" title="Current Crops">🌾</span> <div><h4>Current Crops</h4><p>{userData.currentCrops.join(', ')}</p></div> </div>
                               )}
                               {userData.trackingGoals?.length > 0 && (
                                   <div className="detail-item">
                                       <span className="detail-icon" title="Tracking Goals">🎯</span>
                                        <div>
                                           <h4>Tracking Goals</h4>
                                           <ul className="goal-list nested">
                                              {userData.trackingGoals.map((goal, index) => <li key={index}>{goal}</li>)}
                                          </ul>
                                       </div>
                                   </div>
                               )}
                               {/* Optionally add farmingStart, harvestFrequency etc. */}
                          </div>
                      </div>
                 )}

                 {/* Consultation Input Card */}
                 <div className="input-card card">
                    <h3>🚜 Ask AgriVerse Assistant</h3>
                     <div className="form-group">
                         <label htmlFor="soilTypeOverrideInput">Consultation Soil Type:</label>
                         <input id="soilTypeOverrideInput" type="text" placeholder={!soilTypeOverride && userData.soilTexture ? `Using '${userData.soilTexture}' from profile` : "e.g., Sandy Loam"} value={soilTypeOverride} onChange={(e) => setSoilTypeOverride(e.target.value)} className="form-input"/>
                         <small>Enter soil type for this query, or leave blank to use profile setting.</small>
                     </div>
                     <div className="form-group">
                         <label htmlFor="queryInput">Your Question:</label>
                         <textarea id="queryInput" rows="4" placeholder={userData.track === 'explore' ? "Ask about farming concepts..." : "Ask about your current crops, tasks..."} value={input} onChange={(e) => setInput(e.target.value)} className="form-input"/>
                     </div>
                     <button className="ask-button" onClick={sendPrompt} disabled={response === "⏳ Thinking..."}>
                         {response === "⏳ Thinking..." ? 'Thinking...' : '🌱 Get Insights'}
                     </button>
                 </div>
             </div> // End Left Panel
         )}

        {/* --- Right Panel (Map & Response - Adapts to Fullscreen) --- */}
        <div className={`right-panel ${isMapFullscreen ? 'fullscreen' : ''}`}>

          {/* Map Card Wrapper */}
          <div className={`map-container-wrapper card ${isMapFullscreen ? 'fullscreen' : ''}`}>
            {!isMapFullscreen && <h3>🗺️ Farm Map (Boundary Editable)</h3>}
            <div className="map-controls">
              <div className="map-layer-selector">
                 {Object.keys(mapLayers.current).map(layerKey => ( <button key={layerKey} className={`layer-button ${activeMapLayer === layerKey ? 'active' : ''}`} onClick={() => handleChangeMapLayer(layerKey)} title={`Switch to ${layerKey} view`}> {layerKey.charAt(0).toUpperCase() + layerKey.slice(1)} </button> ))}
              </div>
              <button onClick={toggleFullscreen} className="fullscreen-button map-button" aria-label={isMapFullscreen ? 'Exit Fullscreen Map' : 'Enter Fullscreen Map'}> {isMapFullscreen ? 'Exit Fullscreen' : 'Expand Map'} </button>
            </div>
            <div id="map" ref={mapContainerRef} className="map-view">
                 {!mapRef.current && !error && <div className="map-loading">Initializing Map View...</div>}
            </div>
            <div className="map-legend">
               {farmBoundaryData && ( <div className="legend-item"><span className="boundary-indicator" title="Your editable farm boundary"></span><p>Farm Boundary</p></div> )}
               <div className="legend-item"><span className="location-marker-icon" title="Farm location center">📍</span><p>Location Center</p></div>
               <div className="legend-item"><span className="edit-indicator" title="Use map controls to edit/delete boundary">✏️</span><p>Edit Controls</p></div>
            </div>
          </div> {/* End Map Card Wrapper */}

           {/* ML Suggestion & Response Cards (Hidden when map is fullscreen) */}
           {!isMapFullscreen && (
              <>
                 {/* ML Suggestion Card */}
                 <div className="detail-item card ml-suggestion">
                    <span className="detail-icon" title="Machine Learning Suggestion">💡</span>
                    <div><h4>ML Suggested Crop</h4><p>{mlPrediction || "N/A"}</p></div>
                 </div>

                 {/* LLM Response Card */}
                 <div className="response-card card">
                    <h3>📋 AgriVerse Assistant Response</h3>
                    <div className="response-content">
                        <pre className="recommendations">{response || "Ask a question or get default suggestions using the buttons above."}</pre>
                    </div>
                 </div>
              </>
           )} {/* End Conditional Rendering for ML/Response */}

        </div> {/* End Right Panel */}
      </div> {/* End Main Content */}

      {/* --- Footer (Hidden when map is fullscreen) --- */}
      {!isMapFullscreen && (
          <footer className="app-footer">
              <p>AgriVerse Virtual Twin | User: {userData.name || 'N/A'} | Track: {userData.track || 'N/A'}</p>
          </footer>
       )}

    </div> // End Agri App Root
  );
}

export default VirtualFarmTwin;
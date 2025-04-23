import { useEffect, useState, useRef } from "react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import "./VirtualFarmTwin.css"

function VirtualFarmTwin() {
  // Local storage keys for state persistence
  const LS_KEYS = {
    LOCATION: 'agriverse_location',
    SOIL_TYPE: 'agriverse_soil',
    RESPONSE: 'agriverse_response',
    ML_PREDICTION: 'agriverse_ml_prediction'
  };

  const [input, setInput] = useState("");
  const [response, setResponse] = useState(() => {
    return localStorage.getItem(LS_KEYS.RESPONSE) || "";
  });
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [soilType, setSoilType] = useState(() => {
    return localStorage.getItem(LS_KEYS.SOIL_TYPE) || "";
  });
  const [regionName, setRegionName] = useState("Detecting location...");
  const [climateDesc, setClimateDesc] = useState("Loading...");
  const [map, setMap] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [soilMoisture, setSoilMoisture] = useState("Unknown");
  const [rainfall, setRainfall] = useState("Unknown");
  const [elevation, setElevation] = useState("Unknown");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [detailedLocation, setDetailedLocation] = useState("Fetching detailed location...");
  const [defaultCropsLoaded, setDefaultCropsLoaded] = useState(false);
  const [activeMapLayer, setActiveMapLayer] = useState("standard");
  const [showNavMenu, setShowNavMenu] = useState(false);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapLayers = useRef({});
  const [mlPrediction, setMlPrediction] = useState(() => {
    return localStorage.getItem(LS_KEYS.ML_PREDICTION) || "";
  });
  // Temperature and humidity storage for ML API
  const [temperature, setTemperature] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [precipMm, setPrecipMm] = useState(null);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (response) localStorage.setItem(LS_KEYS.RESPONSE, response);
    if (soilType) localStorage.setItem(LS_KEYS.SOIL_TYPE, soilType);
    if (mlPrediction) localStorage.setItem(LS_KEYS.ML_PREDICTION, mlPrediction);
    
    // Store location data
    if (lat && lon) {
      localStorage.setItem(LS_KEYS.LOCATION, JSON.stringify({
        lat, lon, regionName, detailedLocation, 
        climateDesc, soilMoisture, rainfall, elevation
      }));
    }
  }, [response, soilType, mlPrediction, lat, lon, regionName, detailedLocation, 
      climateDesc, soilMoisture, rainfall, elevation]);

  // Load previous location data if available
  useEffect(() => {
    const savedLocation = localStorage.getItem(LS_KEYS.LOCATION);
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setLat(parsed.lat);
        setLon(parsed.lon);
        setRegionName(parsed.regionName || "Unknown region");
        setDetailedLocation(parsed.detailedLocation || "Unknown location");
        setClimateDesc(parsed.climateDesc || "Unknown climate");
        setSoilMoisture(parsed.soilMoisture || "Unknown");
        setRainfall(parsed.rainfall || "Unknown");
        setElevation(parsed.elevation || "Unknown");
        setIsLoading(false);
        console.log("Restored previous location:", parsed);
      } catch (e) {
        console.error("Error parsing saved location:", e);
        getCurrentLocation();
      }
    } else {
      getCurrentLocation();
    }
  }, []);

  // Fetch location and weather on load with high accuracy
  const getCurrentLocation = () => {
    console.log("Getting current location with high accuracy...");
    setIsLoading(true);
    setDefaultCropsLoaded(false); // Reset crops flag
    
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Received current position:", position.coords);
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        loadLocationData(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLoading(false);
        alert("Unable to get your current location. Please check your location permissions.");
        // Default coordinates if geolocation fails
        loadLocationData(20.5937, 78.9629); // Default to center of India
      },
      geoOptions
    );
  };

  // Make sure the map is properly initialized after the component mounts
  useEffect(() => {
    // Wait for the DOM to be fully loaded
    if (lat && lon && mapContainerRef.current) {
      // Short delay to ensure DOM is ready
      setTimeout(() => {
        initializeOrUpdateMap(lat, lon);
      }, 500);
    }
  }, [lat, lon]);

  // Get default crop suggestions when location data is loaded
  useEffect(() => {
    if (!isLoading && !defaultCropsLoaded && soilType && regionName !== "Detecting location...") {
      console.log("Loading default crop suggestions based on location");
      getDefaultCropSuggestions();
      setDefaultCropsLoaded(true);
    }
  }, [isLoading, soilType, regionName, defaultCropsLoaded]);

  // API call to get ML prediction from Flask
  const fetchMlPrediction = async (latitude, longitude, temp, hum, rain) => {
    try {
      // Use either direct weather values or lat/lon based on what's available
      const payload = temp && hum && rain 
        ? { temperature: temp, humidity: hum, rainfall: rain } 
        : { lat: latitude, lon: longitude };
      
      console.log("Fetching ML prediction with payload:", payload);
      
      // Call Flask API
      const apiUrl = "http://127.0.0.1:5000/predict"; // Change to your actual API URL in production
      const mlResponse = await axios.post(apiUrl, payload);
      
      if (mlResponse.data && mlResponse.data.recommended_crop) {
        const prediction = mlResponse.data.recommended_crop;
        console.log("ML prediction received:", prediction);
        setMlPrediction(prediction);
        return prediction;
      }
    } catch (error) {
      console.error("Error fetching ML prediction:", error);
      setMlPrediction("Prediction failed - API error");
      return null;
    }
  };

  const loadLocationData = async (latitude, longitude) => {
    console.log("Loading data for coordinates:", latitude, longitude);
    setLat(latitude);
    setLon(longitude);
    setIsLoading(true);

    try {
      // Detailed location info with reverse geocoding - zoom level 18 for highest precision
      const locRes = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`
      );
      console.log("Location data received:", locRes.data);
      const addr = locRes.data.address;
      
      // Create detailed location description
      const locality = addr?.village || addr?.town || addr?.city || addr?.hamlet || addr?.suburb || "Unknown locality";
      const district = addr?.county || addr?.district || "";
      const state = addr?.state || "";
      const country = addr?.country || "";
      
      setRegionName(`${locality}, ${district}${district ? ', ' : ''}${state}`);
      setDetailedLocation(`${locality}, ${district}${district ? ', ' : ''}${state}${state ? ', ' : ''}${country}`);
      
      let temp = 0;
      let humidity = 0;
      let precipitation = 0;
      
      // Weather Info using WeatherAPI
      try {
        const weatherRes = await axios.get(
          `https://api.weatherapi.com/v1/current.json?key=${import.meta.env.VITE_WEATHER_API_KEY}&q=${latitude},${longitude}`
        );
        temp = weatherRes.data.current.temp_c;
        const weather = weatherRes.data.current.condition.text;
        humidity = weatherRes.data.current.humidity;
        precipitation = weatherRes.data.current.precip_mm;
        
        // Store values for ML API
        setTemperature(temp);
        setHumidity(humidity);
        setPrecipMm(precipitation);
        
        setClimateDesc(`${weather}, ${temp}°C, Humidity: ${humidity}%, Precipitation: ${precipitation}mm`);
        
        // Soil moisture calculation - more refined
        const soilMoistureEstimate = calculateSoilMoisture(humidity, precipitation);
        setSoilMoisture(soilMoistureEstimate);
        
        // Get rainfall estimate
        const rainfallEstimate = await estimateRainfall(latitude, longitude);
        setRainfall(rainfallEstimate);
        
        // Fetch ML prediction based on weather data
        fetchMlPrediction(latitude, longitude, temp, humidity, precipitation);
        
      } catch (weatherError) {
        console.error("Weather API error:", weatherError);
        setClimateDesc("Weather data unavailable");
        setSoilMoisture("Unknown");
        
        // Try with just coordinates for ML prediction
        fetchMlPrediction(latitude, longitude);
      }

      // Elevation data - Handle CORS error gracefully
      try {
        // Try with CORS proxy if available
        const corsProxy = "https://cors-anywhere.herokuapp.com/";
        
        // Attempt with proxy first, but have a fallback
        try {
          const elevationRes = await axios.get(
            `${corsProxy}https://api.opentopodata.org/v1/aster30m?locations=${latitude},${longitude}`,
            { timeout: 5000 } // 5 second timeout
          );
          if (elevationRes.data?.results?.[0]?.elevation) {
            setElevation(`${Math.round(elevationRes.data.results[0].elevation)}m`);
          } else {
            throw new Error("No elevation data");
          }
        } catch (proxyError) {
          // Try direct request (might work in some environments)
          try {
            const directElevationRes = await axios.get(
              `https://api.opentopodata.org/v1/aster30m?locations=${latitude},${longitude}`,
              { timeout: 5000 }
            );
            if (directElevationRes.data?.results?.[0]?.elevation) {
              setElevation(`${Math.round(directElevationRes.data.results[0].elevation)}m`);
            } else {
              throw new Error("No elevation data");
            }
          } catch (directError) {
            // If both methods fail, use alternative API or estimation
            throw new Error("All elevation APIs failed");
          }
        }
      } catch (elevationError) {
        console.log("Elevation API error, using fallback:", elevationError);
        // Fallback: Use an estimation based on location
        setElevation("Estimated 300m");
      }

      // Detect soil type based on geography
      const detectedSoilType = await detectSoilType(latitude, longitude, state);
      if (detectedSoilType && !soilType) {
        setSoilType(detectedSoilType);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate soil moisture based on humidity, precipitation and historical data
  const calculateSoilMoisture = (humidity, precipitation) => {
    // Simple algorithm - would be more complex with real soil data
    let baseMoisture = humidity * 0.6;
    
    // Adjust based on recent precipitation
    if (precipitation > 5) {
      baseMoisture += 15;
    } else if (precipitation > 1) {
      baseMoisture += 7;
    }
    
    // Cap at 100%
    return `${Math.min(Math.round(baseMoisture), 100)}%`;
  };

  // Estimate rainfall based on location and historical data
  const estimateRainfall = async (lat, lon) => {
    try {
      // In a real app, this would use historical rainfall data APIs
      // For now, we'll use a simplified approach
      const month = new Date().getMonth();
      try {
        const weatherRes = await axios.get(
          `https://api.weatherapi.com/v1/forecast.json?key=${import.meta.env.VITE_WEATHER_API_KEY}&q=${lat},${lon}&days=3`
        );
        
        const forecast = weatherRes.data.forecast.forecastday;
        const avgRainChance = forecast.reduce((sum, day) => sum + day.day.daily_chance_of_rain, 0) / forecast.length;
        
        // Seasonal adjustments
        let seasonalDesc = "";
        if (month >= 5 && month <= 8) {
          seasonalDesc = avgRainChance > 50 ? "High (Monsoon season)" : "Moderate";
        } else if (month >= 9 && month <= 11) {
          seasonalDesc = "Low to Moderate";
        } else {
          seasonalDesc = "Low (Dry season)";
        }
        
        return `${seasonalDesc}, ${avgRainChance.toFixed(0)}% chance in next 3 days`;
      } catch (weatherError) {
        console.error("Weather forecast error:", weatherError);
        
        // Fallback based only on season
        let seasonalDesc = "";
        if (month >= 5 && month <= 8) {
          seasonalDesc = "Moderate to High (Monsoon season)";
        } else if (month >= 9 && month <= 11) {
          seasonalDesc = "Low to Moderate";
        } else {
          seasonalDesc = "Low (Dry season)";
        }
        
        return seasonalDesc;
      }
    } catch (error) {
      console.error("Error estimating rainfall:", error);
      return "Moderate (estimated)";
    }
  };

  // Detect soil type based on region and coordinates
  const detectSoilType = async (lat, lon, region) => {
    if (!region) return null;
    region = region.toLowerCase();
    
    // In a real app, this would use geospatial soil databases
    // Basic soil map for demonstration
    const soilMap = {
      'california': 'Clay Loam',
      'iowa': 'Black Soil',
      'gujarat': 'Alluvial Soil',
      'punjab': 'Alluvial Soil',
      'maharashtra': 'Black Cotton Soil',
      'karnataka': 'Red Soil',
      'tamil nadu': 'Red Loamy Soil',
      'uttar pradesh': 'Alluvial Soil',
      'rajasthan': 'Sandy Soil',
      'madhya pradesh': 'Black Soil'
    };
    
    // Check region-based mapping first
    for (const [key, value] of Object.entries(soilMap)) {
      if (region.includes(key)) return value;
    }
    
    // If region not found, try to use elevation and climate data for estimation
    try {
      // Since the elevation API has CORS issues, use a simplified approach
      // Based on latitude ranges - very basic soil type estimation
      if (lat > 25) return "Alluvial Soil";
      if (lat > 20) return "Black Soil";
      if (lat > 15) return "Red Soil";
      if (lat > 10) return "Laterite Soil";
      return "Mixed Soil";
    } catch (error) {
      console.error("Error in soil detection:", error);
      return "Mixed Soil"; // Fallback
    }
  };

  // Initialize or update map with multiple layers
  const initializeOrUpdateMap = (latitude, longitude) => {
    // Force destroy any existing map instance first
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    
    // Check if map container exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map container not found!');
      return;
    }
    
    // Ensure the container has size before initializing
    mapElement.style.height = '400px';
    mapElement.style.width = '100%';
    
    // Initialize new map with a slight delay to ensure DOM is ready
    try {
      // Create map instance
      const leafletMap = L.map('map', {
        center: [latitude, longitude],
        zoom: 15, // Higher zoom level for more detailed view
        attributionControl: true
      });
      
      // Define different map tile layers
      const layers = {
        standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }),
        terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
        }),
        topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        })
      };
      
      // Set initial layer
      layers[activeMapLayer].addTo(leafletMap);
      
      // Store layers reference for layer switching
      mapLayers.current = layers;
      
      // Draw radius circle 3km
      L.circle([latitude, longitude], {
        radius: 3000,
        color: "#00a651",
        fillColor: "#a3f7a3",
        fillOpacity: 0.3,
      }).addTo(leafletMap);

      // Add marker for farm location
      L.marker([latitude, longitude])
        .addTo(leafletMap)
        .bindPopup("<b>📍 Your Farm Location</b><br>Agricultural analysis based on this point")
        .openPopup();
      
      // Store the map reference
      mapRef.current = leafletMap;
      setMap(leafletMap);
      
      // Force a resize to ensure map displays correctly
      setTimeout(() => {
        leafletMap.invalidateSize();
      }, 300);
      
    } catch (err) {
      console.error("Error initializing map:", err);
    }
  };

  // Function to change the map layer
  const changeMapLayer = (layerName) => {
    if (!mapRef.current || !mapLayers.current || !mapLayers.current[layerName]) return;
    
    // Remove all layers
    Object.values(mapLayers.current).forEach(layer => {
      if (mapRef.current.hasLayer(layer)) {
        mapRef.current.removeLayer(layer);
      }
    });
    
    // Add the selected layer
    mapLayers.current[layerName].addTo(mapRef.current);
    setActiveMapLayer(layerName);
  };

  // Search for locations - improved to trigger on button click
  const searchLocations = async () => {
    if (locationSearch.trim().length < 3) {
      console.log("Search query too short");
      return;
    }
    
    try {
      console.log("Searching for location:", locationSearch);
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}`
      );
      console.log("Location search results:", res.data);
      
      if (res.data && res.data.length > 0) {
        setLocationResults(res.data.slice(0, 5)); // Limit to top 5 results
        setShowLocationResults(true);
      } else {
        setLocationResults([]);
        setShowLocationResults(true); // Show "no results" state
      }
    } catch (error) {
      console.error("Location search error:", error);
      setLocationResults([]);
      setShowLocationResults(false);
    }
  };

  // Select a location from search results
  const selectLocation = (loc) => {
    console.log("Selected location:", loc);
    setLocationSearch(loc.display_name);
    setShowLocationResults(false);
    
    // Parse coordinates and ensure they're valid numbers
    const newLat = parseFloat(loc.lat);
    const newLon = parseFloat(loc.lon);
    
    if (!isNaN(newLat) && !isNaN(newLon)) {
      console.log("Loading data for new coordinates:", newLat, newLon);
      setDefaultCropsLoaded(false); // Reset default crops flag for new location
      loadLocationData(newLat, newLon);
    } else {
      console.error("Invalid coordinates in location result:", loc);
    }
  };

  // Handle location search on Enter key
  const handleLocationSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if within a form
      searchLocations();
    }
  };

  // Function to get default crop suggestions when location is loaded
  const getDefaultCropSuggestions = async () => {
    console.log("Getting default crop suggestions");
    setResponse("⏳ Analyzing your land and generating recommended crops...");

    // Get ML prediction first (if available)
    let mlResult = mlPrediction;
    if (!mlResult && temperature && humidity && precipMm) {
      mlResult = await fetchMlPrediction(lat, lon, temperature, humidity, precipMm);
    }

    const defaultPrompt = `
Act as AgriVerse GPT, a farming assistant.

Conditions:
- Soil: ${soilType || "Not provided"}
- Climate: ${climateDesc}
- Water: Borewell
- Region: ${regionName}
- Detailed Location: ${detailedLocation}
- Elevation: ${elevation}
- Soil Moisture: ${soilMoisture}
- Typical Rainfall: ${rainfall}
- ML Prediction: The ML algorithm specifically recommends: ${mlResult || "Unknown"}

✅ Reply with:
1. 🌾 3–4 best crops for this exact location details. Include the ML predicted crop among your recommendations if it makes sense for this region.
2. 📝 One-line reason per crop
3. Include ML data analysis in your response with credibility score
4. ✂️ Use ONLY bullet format. Do NOT write long text.
5. 💬 Add emojis to keep tone friendly.

Start with a very brief "Welcome to AgriVerse!" header. Display recommended crops for my detected location. Mention AI and ML fusion technology used for predictions.
`;

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mixtral-8x7b-instruct",
          messages: [
            {
              role: "user",
              content: defaultPrompt,
            },
          ],
          max_tokens: 800,
          temperature: 0.2,
          top_p: 0.9,
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://agriverse-ai.com",
            "X-Title": "AgriVerse GPT Twin",
          },
        }
      );

      const reply = res.data?.choices?.[0]?.message?.content;
      setResponse(reply || "⚠️ No valid response from model.");
    } catch (err) {
      console.error("API Error for default crops:", err);
      setResponse("⚠️ " + (err.response?.data?.message || err.message));
    }
  };

  const sendPrompt = async () => {
    setResponse("⏳ Processing your query...");

    // Analyze the query to determine if it's about crops or general farming
    let promptType = "general";
    const cropRelatedTerms = ["crop", "grow", "plant", "harvest", "sow", "cultivate", "yield"];
    
    // Check if query is about crops or more general
    if (cropRelatedTerms.some(term => input.toLowerCase().includes(term)) || 
        input.toLowerCase().includes("what") || input.trim() === "") {
      promptType = "crops";
    }

    // Ensure we have ML prediction if possible
    let mlResult = mlPrediction;
    if (!mlResult && temperature && humidity && precipMm) {
      mlResult = await fetchMlPrediction(lat, lon, temperature, humidity, precipMm);
    }

    // Structured prompt for crop recommendations
    const cropPrompt = `
Act as AgriVerse GPT, a farming assistant.

Conditions:
- Soil: ${soilType || "Not provided"}
- Climate: ${climateDesc}
- Water: Borewell
- Region: ${regionName}
- Detailed Location: ${detailedLocation}
- Elevation: ${elevation}
- Soil Moisture: ${soilMoisture}
- Typical Rainfall: ${rainfall}
- ML Prediction: The ML algorithm specifically recommends: ${mlResult || "Unknown"}

✅ Reply with:
1. 🌾 3–4 best crops (include ML recommended crop if relevant)
2. 📝 One-line reason per crop
3. Please include a brief ML analysis section at the end with confidence percentage
4. ✂️ Use ONLY bullet format. Do NOT write long text.
5. 💬 Add emojis to keep tone friendly.

if they ask about another location suggestions then predict and say atleast 2 crops for that location and dont show crop suggestions for detected location
if they ask extra questions then answer them and dont show detected location crop suggestions
if they ask tell that your name is AgriVerse GPT built by my boss Akshay
Strict format. Avoid introduction and ending lines.
${input || "What crops should I grow here?"}
`;

    // General farming knowledge prompt
    const generalPrompt = `
Act as AgriVerse GPT, a farming assistant created by Akshay.

Conditions for context:
- Soil: ${soilType || "Not provided"}
- Climate: ${climateDesc}
- Water: Borewell
- Region: ${regionName}
- Soil Moisture: ${soilMoisture}
- Typical Rainfall: ${rainfall}
- ML Prediction: The ML algorithm recommends: ${mlResult || "Unknown"}

✅ Response guidelines:
1. 🚀 Give a direct, concise answer
2. ✂️ Max 5-6 bullet points, keep it brief
3. 🧪 Be specific to the region and conditions
4. 📱 Format with emojis for readability
5. 🎯 Be practical, actionable and to-the-point
6. 🔬 Include a brief ML analysis if relevant to the query

QUERY: ${input}
`;

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mixtral-8x7b-instruct",
          messages: [
            {
              role: "user",
              content: promptType === "crops" ? cropPrompt : generalPrompt,
            },
          ],
          max_tokens: 800,
          temperature: 0.2,
          top_p: 0.9,
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://agriverse-ai.com",
            "X-Title": "AgriVerse GPT Twin",
          },
        }
      );

      const reply = res.data?.choices?.[0]?.message?.content;
      setResponse(reply || "⚠️ No valid response from model.");
    } catch (err) {
      console.error("API Error:", err);
      setResponse("⚠️ " + (err.response?.data?.message || err.message));
    }
  };

  // Toggle navigation menu
  const toggleNavMenu = () => {
    setShowNavMenu(!showNavMenu);
  };

  // Update map size when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="agri-app">
      <header className="app-header minimal">
        <div className="logo-section">
          <h1>🌍 AgriVerse Virtual Twin</h1>
        </div>
        <div className="nav-menu-container">
          <button className="menu-toggle" onClick={toggleNavMenu}>
            <span className="menu-icon">☰</span>
          </button>
          {showNavMenu && (
            <nav className="nav-menu">
              <ul>
                <li><a href="#" onClick={() => getDefaultCropSuggestions()}>Default Recommendations</a></li>
                <li><a href="#" onClick={getCurrentLocation}>Refresh Location</a></li>
                <li><a href="#" onClick={() => setSoilType("")}>Reset Soil Type</a></li>
                <li><a href="#" onClick={() => setInput("")}>Clear Input</a></li>
              </ul>
            </nav>
          )}
        </div>
      </header>
      
      <div className="main-content">
        <div className="left-panel">
          <div className="location-selector enhanced">
            <h3>📍 Select Location</h3>
            <div className="location-search">
              <input
                type="text"
                placeholder="Search for a location..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                onKeyPress={handleLocationSearchKeyPress}
              />
              <button type="button" onClick={searchLocations} className="find-button">
                <span className="button-icon">🔍</span>
              </button>
            </div>
            {showLocationResults && (
              <div className="location-results">
                {locationResults.length > 0 ? (
                  locationResults.map((loc, idx) => (
                    <div 
                      key={idx} 
                      className="location-result-item"
                      onClick={() => selectLocation(loc)}
                    >
                      <span className="location-icon">📍</span>
                      <div className="location-details">
                        <span className="location-name">{loc.display_name}</span>
                        <span className="location-type">{loc.type}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-results">No locations found. Try a different search.</div>
                )}
              </div>
            )}
            <div className="current-location">
              <button type="button" onClick={getCurrentLocation} className="location-button">
                <span className="button-icon">📱</span> Use My Current Location
              </button>
            </div>
          </div>

          <div className="info-card">
            <h3>📊 Land Analysis</h3>
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Analyzing your land...</p>
              </div>
            ) : (
              <div className="land-details">
                <div className="detail-item">
                  <span className="detail-icon">📍</span>
                  <div>
                    <h4>Detailed Location</h4>
                    <p>{detailedLocation}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">🌤️</span>
                  <div>
                    <h4>Climate</h4>
                    <p>{climateDesc}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">⛰️</span>
                  <div>
                    <h4>Elevation</h4>
                    <p>{elevation}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">💧</span>
                  <div>
                    <h4>Soil Moisture</h4>
                    <p>{soilMoisture}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">🌧️</span>
                  <div>
                    <h4>Rainfall</h4>
                    <p>{rainfall}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">🌱</span>
                  <div>
                    <h4>Water Source</h4>
                    <p>Borewell</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="input-card">
            <h3>🚜 AgriVerse Twin Consultation</h3>
            <div className="soil-input">
              <label>Soil Type:</label>
              <input
                type="text"
                placeholder="e.g., red, black, clay, loamy..."
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
              />
            </div>
            <div className="query-input">
              <label>Your Farming Query:</label>
              <textarea
                rows="3"
                placeholder="Ask about crops, diseases, fertilizers, irrigation, etc"
              
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button className="ask-button" onClick={sendPrompt}>
              🌱 Get Recommendations
            </button>
          </div>
        </div>

        <div className="right-panel">
          <div className="map-container">
            <h3>🗺️ Agricultural Land Map</h3>
            <div className="map-controls">
              <div className="map-layer-selector">
                <button 
                  className={`layer-button ${activeMapLayer === 'standard' ? 'active' : ''}`}
                  onClick={() => changeMapLayer('standard')}
                >
                  Standard
                </button>
                <button 
                  className={`layer-button ${activeMapLayer === 'satellite' ? 'active' : ''}`}
                  onClick={() => changeMapLayer('satellite')}
                >
                  Satellite
                </button>
                <button 
                  className={`layer-button ${activeMapLayer === 'terrain' ? 'active' : ''}`}
                  onClick={() => changeMapLayer('terrain')}
                >
                  Terrain
                </button>
                <button 
                  className={`layer-button ${activeMapLayer === 'topo' ? 'active' : ''}`}
                  onClick={() => changeMapLayer('topo')}
                >
                  Topographic
                </button>
              </div>
            </div>
            <div id="map" ref={mapContainerRef} style={{ height: "400px", width: "100%", borderRadius: "8px" }}></div>
            <div className="map-legend">
              <div className="legend-item">
                <span className="farm-radius"></span>
                <p>3km Farm Radius</p>
              </div>
              <div className="legend-item">
                <span className="cropland-indicator"></span>
                <p>Agricultural Land</p>
              </div>
            </div>
          </div>
          <div className="detail-item">
  <span className="detail-icon">🧪</span>
  <div>
    <h4>ML Suggested Crop</h4>
    <p>{mlPrediction || "Loading..."}</p>
  </div>
</div>

          <div className="response-card">
            <h3>📋 AgriVerse Recommendations</h3>
            <div className="response-content">
              {response ? (
                <div className="recommendations">
                  {response}
                </div>
              ) : (
                <div className="empty-response">
                  <p>Ask about crop recommendations or farming techniques based on your land conditions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <footer className="app-footer">
        <p>AgriVerse Virtual Twin v2.0 | Created by Akshay | Powered by Agricultural AI</p>
      </footer>
    </div>
  );
}

export default VirtualFarmTwin;
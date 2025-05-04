import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Pencil, 
  Eraser, 
  Target, 
  Check, 
  X, 
  AlertTriangle,
  Info
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './FarmMapSelector.css'; // We'll create this file separately

// Using dynamic imports for Leaflet to avoid SSR issues
const FarmMapSelector = ({ 
  onLocationChange, 
  onBoundaryChange, 
  initialLocation = null, 
  initialBoundary = null 
}) => {
  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const locationMarkerRef = useRef(null);
  
  // State variables
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [mapLoadError, setMapLoadError] = useState(null);
  const [drawingMode, setDrawingMode] = useState('off'); // 'off', 'draw', 'erase'
  const [boundaryDrawn, setBoundaryDrawn] = useState(false);

  // Initialize the map after component mount
  useEffect(() => {
    let L, map, drawControl, drawnItems;
    
    const initializeMap = async () => {
      try {
        // Dynamically import Leaflet and Leaflet Draw
        const leafletModule = await import('leaflet');
        const drawModule = await import('leaflet-draw');
        L = leafletModule.default;
        
        // Make sure the map container exists
        if (!mapRef.current) return;
        
        console.log("Initializing Leaflet map...");
        
        // Create map instance with default view
        const defaultLocation = initialLocation || { latitude: 20, longitude: 0 };
        map = L.map(mapRef.current).setView(
          [defaultLocation.latitude, defaultLocation.longitude], 
          initialLocation ? 13 : 2 // Zoom level - closer if we have a location
        );
        
        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);
        
        // Create layer for drawn items
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;
        
        // Initialize the draw control
        drawControl = new L.Control.Draw({
          draw: {
            // Only allow polygon for farm boundaries
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polygon: {
              allowIntersection: false,
              drawError: {
                color: '#e1e100',
                message: '<strong>Warning:</strong> Boundary cannot intersect itself.'
              },
              shapeOptions: {
                color: '#3388ff',
                fillOpacity: 0.2
              }
            }
          },
          edit: {
            featureGroup: drawnItems,
            remove: true
          }
        });
        
        // Don't add draw control right away
        // We'll use our custom buttons to enable/disable drawing
        drawControlRef.current = drawControl;
        mapInstanceRef.current = map;
        
        // Add initial location marker if provided
        if (initialLocation) {
          const marker = L.marker([initialLocation.latitude, initialLocation.longitude], {
            title: "Your Location"
          }).addTo(map);
          locationMarkerRef.current = marker;
        }
        
        // Add initial boundary if provided
        if (initialBoundary) {
          try {
            // Parse GeoJSON if it's a string
            const boundary = typeof initialBoundary === 'string' 
              ? JSON.parse(initialBoundary) 
              : initialBoundary;
              
            L.geoJSON(boundary, {
              style: {
                color: '#3388ff',
                fillOpacity: 0.2
              }
            }).eachLayer((layer) => {
              drawnItems.addLayer(layer);
              setBoundaryDrawn(true);
            });
          } catch (err) {
            console.error("Failed to parse and display initial boundary:", err);
          }
        }
        
        // Handle draw events
        map.on(L.Draw.Event.CREATED, (event) => {
          // Clear previous items when a new boundary is drawn
          drawnItems.clearLayers();
          
          const layer = event.layer;
          drawnItems.addLayer(layer);
          setBoundaryDrawn(true);
          
          // Convert to GeoJSON for storage
          const drawnGeoJSON = drawnItems.toGeoJSON();
          // Only pass the first feature if there is one
          const boundaryFeature = drawnGeoJSON.features && drawnGeoJSON.features.length > 0 
            ? drawnGeoJSON.features[0] 
            : null;
          
          // Call parent callback with the boundary
          onBoundaryChange(boundaryFeature);
          
          // Exit drawing mode
          setDrawingMode('off');
          setIsDrawing(false);
        });
        
        // Handle edit events
        map.on(L.Draw.Event.EDITED, (event) => {
          const drawnGeoJSON = drawnItems.toGeoJSON();
          const boundaryFeature = drawnGeoJSON.features && drawnGeoJSON.features.length > 0 
            ? drawnGeoJSON.features[0] 
            : null;
          onBoundaryChange(boundaryFeature);
        });
        
        // Handle delete events
        map.on(L.Draw.Event.DELETED, (event) => {
          if (drawnItems.getLayers().length === 0) {
            setBoundaryDrawn(false);
            onBoundaryChange(null);
          }
        });
        
        // Invalidate map size after initialization
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
        
        setIsMapLoaded(true);
      } catch (error) {
        console.error("Error initializing map:", error);
        setMapLoadError("Failed to load map. Please check your internet connection and try again.");
      }
    };
    
    initializeMap();
    
    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        console.log("Cleaning up map instance...");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Empty dependency array for one-time initialization

  // Handle starting drawing mode
  const handleStartDrawing = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    setDrawingMode('draw');
    setIsDrawing(true);
    
    // Start the polygon drawing tool
    new L.Draw.Polygon(map, drawControlRef.current.options.draw.polygon).enable();
  };
  
  // Handle erasing the current boundary
  const handleClearBoundary = () => {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;
    
    drawnItems.clearLayers();
    setBoundaryDrawn(false);
    onBoundaryChange(null);
  };
  
  // Handle canceling the current drawing
  const handleCancelDrawing = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    // Stop any active drawing
    map.fire('draw:cancel');
    setDrawingMode('off');
    setIsDrawing(false);
  };
  
  // Handle getting the current location
  const handleGetLocation = () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsGettingLocation(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationData = { latitude, longitude };
        
        // Update location marker
        const map = mapInstanceRef.current;
        if (map) {
          // Remove existing marker if any
          if (locationMarkerRef.current) {
            map.removeLayer(locationMarkerRef.current);
          }
          
          // Add new marker
          const L = window.L; // Use global L if available
          const marker = L.marker([latitude, longitude], {
            title: "Your Location"
          }).addTo(map);
          locationMarkerRef.current = marker;
          
          // Center and zoom the map
          map.setView([latitude, longitude], 14);
        }
        
        // Call the callback
        onLocationChange(locationData);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMsg = "Failed to get your location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Location permission denied. Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Location information is unavailable. Please try again later.";
            break;
          case error.TIMEOUT:
            errorMsg = "Location request timed out. Please try again.";
            break;
          default:
            errorMsg = "An unknown error occurred while getting your location.";
        }
        
        setLocationError(errorMsg);
        setIsGettingLocation(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  return (
    <div className="farm-map-selector">
      {/* Map error message */}
      {mapLoadError && (
        <div className="map-error-message">
          <AlertTriangle size={20} />
          <p>{mapLoadError}</p>
        </div>
      )}
      
      {/* Map container */}
      <div ref={mapRef} className="map-container"></div>
      
      {/* Map controls */}
      {isMapLoaded && (
        <div className="map-controls">
          {/* Location controls */}
          <div className="control-section">
            <button 
              className={`control-button location-button ${isGettingLocation ? 'loading' : ''}`}
              onClick={handleGetLocation}
              disabled={isGettingLocation}
              title="Get my current location"
            >
              {isGettingLocation ? 
                <div className="button-spinner"></div> : 
                <><Target size={16} /> <span>My Location</span></>
              }
            </button>
          </div>
          
          {/* Drawing controls - show when not drawing */}
          {!isDrawing && (
            <div className="control-section">
              <button 
                className={`control-button draw-button ${boundaryDrawn ? 'disabled' : ''}`}
                onClick={handleStartDrawing}
                disabled={boundaryDrawn}
                title={boundaryDrawn ? "Clear existing boundary before drawing new one" : "Draw farm boundary"}
              >
                <Pencil size={16} /> <span>Draw Boundary</span>
              </button>
              
              {boundaryDrawn && (
                <button 
                  className="control-button clear-button"
                  onClick={handleClearBoundary}
                  title="Clear farm boundary"
                >
                  <Eraser size={16} /> <span>Clear</span>
                </button>
              )}
            </div>
          )}
          
          {/* Active drawing controls - show when drawing */}
          {isDrawing && (
            <div className="control-section drawing-active">
              <div className="drawing-message">
                <Info size={16} />
                <span>Click on map to create boundary points. Click on first point to complete.</span>
              </div>
              <button 
                className="control-button cancel-button"
                onClick={handleCancelDrawing}
                title="Cancel drawing"
              >
                <X size={16} /> <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Location error message */}
      {locationError && (
        <div className="location-error">
          <AlertTriangle size={16} />
          <p>{locationError}</p>
        </div>
      )}
      
      {/* Helper text */}
      <div className="map-helper-text">
        <p>
          <MapPin size={14} className="helper-icon" />
          {boundaryDrawn ? 
            "Farm boundary saved. You can clear and redraw if needed." : 
            "Use the tools above to mark your farm location and draw its boundary."}
        </p>
      </div>
    </div>
  );
};

export default FarmMapSelector;
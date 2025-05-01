import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Trash2, Check } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css'; // Import draw CSS
import './FarmMapSelector.css'; // Make sure this CSS exists

// Using dynamic import for Leaflet since it requires window object
const FarmMapSelector = ({
  onLocationChange,
  onBoundaryChange,
  initialLocation = null,
  initialBoundary = null
}) => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const locationMarkerRef = useRef(null); // Ref for the location marker
  const activeDrawerRef = useRef(null); // To track active drawer for cancellation

  const [L, setL] = useState(null); // Store Leaflet instance
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false); // Consider renaming if only polygon
  const [boundary, setBoundary] = useState(initialBoundary); // Stores GeoJSON
  const [location, setLocation] = useState(initialLocation); // Stores { latitude, longitude }
  const [mapCenter, setMapCenter] = useState([20, 0]); // Default world center
  const [mapZoom, setMapZoom] = useState(2);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isDrawingComplete, setIsDrawingComplete] = useState(false); // New state to track drawing completion

  // --- Map Event Handlers (using useCallback) ---

  const handleDrawCreated = useCallback((e) => {
    if (!drawnItemsRef.current || !L) return;
    const layer = e.layer;
    // Set flag to prevent event conflicts
    setIsDrawingComplete(true);
    
    // Clear previous drawings first (we only want one boundary)
    drawnItemsRef.current.clearLayers();
    drawnItemsRef.current.addLayer(layer);

    // Extract GeoJSON from the drawn layer
    const drawnGeoJSON = layer.toGeoJSON();
    console.log("Boundary Drawn (GeoJSON):", drawnGeoJSON);
    
    // Make sure we have a valid GeoJSON object with all required properties
    if (drawnGeoJSON && drawnGeoJSON.type === 'Feature') {
      setBoundary(drawnGeoJSON);
      
      // Call the callback to inform parent component
      if (onBoundaryChange) {
        onBoundaryChange(drawnGeoJSON);
      }
    } else {
      console.error("Invalid GeoJSON created:", drawnGeoJSON);
    }
    
    setDrawingMode(false); // Exit drawing mode
    // Reset flag after a short delay
    setTimeout(() => setIsDrawingComplete(false), 100);
  }, [L, onBoundaryChange]);

  const handleDrawEdited = useCallback((e) => {
    if (!drawnItemsRef.current || !L) return;
    const layers = e.layers; // FeatureGroup containing edited layers

    // Should only be one layer in our case
    if (layers.getLayers().length > 0) {
      const editedLayer = layers.getLayers()[0];
      const updatedGeoJSON = editedLayer.toGeoJSON();
      console.log("Boundary Edited (GeoJSON):", updatedGeoJSON);
      setBoundary(updatedGeoJSON);

      // Call the callback to inform parent component
      if (onBoundaryChange) {
        onBoundaryChange(updatedGeoJSON);
      }
    }
  }, [L, onBoundaryChange]);

  const handleDrawDeleted = useCallback(() => {
    if (isDrawingComplete) return; // Prevent deletion during drawing completion
    
    console.log("Boundary Deleted");
    setBoundary(null);
    // Call the callback to inform parent component
    if (onBoundaryChange) {
      onBoundaryChange(null);
    }
  }, [onBoundaryChange, isDrawingComplete]);

  // --- Map Initialization Effect ---
  useEffect(() => {
    let mapInstance; // Temporary variable for cleanup

    const initializeMap = async () => {
      try {
        console.log("Initializing map...");
        // Dynamic import of Leaflet and Leaflet Draw
        const leaflet = await import('leaflet');
        await import('leaflet-draw'); // Import for side effects (attaches L.Draw)
        setL(leaflet.default); // Store Leaflet instance in state
        const LGlobal = leaflet.default; // Use LGlobal within this scope

        // Fix default icon path issue with bundlers like Webpack/Vite
        delete LGlobal.Icon.Default.prototype._getIconUrl;
        LGlobal.Icon.Default.mergeOptions({
          iconRetinaUrl: (await import('leaflet/dist/images/marker-icon-2x.png')).default,
          iconUrl: (await import('leaflet/dist/images/marker-icon.png')).default,
          shadowUrl: (await import('leaflet/dist/images/marker-shadow.png')).default,
        });

        // Determine initial view based on location/boundary
        let initialCenter = mapCenter;
        let initialZoom = mapZoom;
        if (initialLocation) {
            initialCenter = [initialLocation.latitude, initialLocation.longitude];
            initialZoom = 14;
        } else if (initialBoundary && initialBoundary.geometry?.coordinates) {
            // Calculate bounds later if needed, start generic for now
        }

        // Initialize map only if container exists and map isn't already initialized
        if (mapContainerRef.current && !mapRef.current) {
          mapInstance = LGlobal.map(mapContainerRef.current).setView(initialCenter, initialZoom);
          mapRef.current = mapInstance; // Store map instance in ref

          // Add Tile Layer
          LGlobal.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(mapInstance);

          // Initialize FeatureGroup for drawn items
          const items = new LGlobal.FeatureGroup();
          mapInstance.addLayer(items);
          drawnItemsRef.current = items;

          // Initialize Draw Control with singleDrawMode set to true
          const drawControl = new LGlobal.Control.Draw({
            draw: {
              polyline: false,
              circle: false,
              circlemarker: false,
              marker: false, // We handle marker placement separately
              rectangle: { 
                shapeOptions: { color: '#3B82F6', weight: 3 },
                // Force finishing on double click instead of last point click
                finishOn: "dblclick"
              },
              polygon: { 
                shapeOptions: { color: '#3B82F6', weight: 3 }, 
                allowIntersection: false,
                // Always complete shape even if clicking on first point
                completeOn: "dblclick",
                // Customize shape options
                guideLayers: [],
                shapeOptions: {
                  color: '#3B82F6',
                  weight: 3,
                  opacity: 0.8,
                  fill: true,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.3,
                  clickable: true
                }
              }
            },
            edit: { 
              featureGroup: items, 
              remove: true,
              poly: {
                allowIntersection: false
              }
            }
          });
          
          mapInstance.addControl(drawControl);
          drawControlRef.current = drawControl;

          // Add Event Listeners using the useCallback handlers
          mapInstance.on(LGlobal.Draw.Event.CREATED, handleDrawCreated);
          mapInstance.on(LGlobal.Draw.Event.EDITED, handleDrawEdited);
          mapInstance.on(LGlobal.Draw.Event.DELETED, handleDrawDeleted);
          
          // Adding more specific event listeners for drawing actions
          mapInstance.on(LGlobal.Draw.Event.DRAWSTART, (e) => {
            console.log("Drawing started", e);
            activeDrawerRef.current = e.drawer;
          });
          
          mapInstance.on(LGlobal.Draw.Event.DRAWSTOP, (e) => {
            console.log("Drawing stopped", e);
            activeDrawerRef.current = null;
          });

          // Handle Initial Location Marker
          if (initialLocation) {
            const marker = LGlobal.marker([initialLocation.latitude, initialLocation.longitude])
               .addTo(mapInstance)
               .bindPopup('Farm Location');
            locationMarkerRef.current = marker;
            // Don't auto-open popup unless desired: .openPopup();
            console.log("Initial location marker added.");
          }

          // Handle Initial Boundary Drawing
          if (initialBoundary && initialBoundary.type === 'Feature' && initialBoundary.geometry?.coordinates) {
            try {
              const layer = LGlobal.geoJSON(initialBoundary, {
                style: { 
                  color: '#3B82F6', 
                  weight: 3,
                  opacity: 0.8,
                  fill: true,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.3 
                }
              }).addTo(items);
              mapInstance.fitBounds(layer.getBounds());
              console.log("Initial boundary drawn.");
            } catch (err) {
              console.error("Error rendering initial boundary:", err, initialBoundary);
            }
          } else if (initialBoundary) {
            console.warn("Initial boundary provided but is not valid GeoJSON Feature:", initialBoundary);
          }

          setMapLoaded(true);
          console.log("Map fully initialized.");
        }
      } catch (error) {
        console.error("Error initializing map:", error);
        setLocationError("Failed to load map components. Please refresh the page.");
      }
    };

    initializeMap();

    // Cleanup function
    return () => {
      console.log("Cleaning up map...");
      if (mapInstance) { // Use the temporary variable for cleanup
         mapInstance.off(L.Draw.Event.CREATED, handleDrawCreated);
         mapInstance.off(L.Draw.Event.EDITED, handleDrawEdited);
         mapInstance.off(L.Draw.Event.DELETED, handleDrawDeleted);
         mapInstance.remove();
         mapRef.current = null; // Clear ref
         console.log("Map instance removed.");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleDrawCreated, handleDrawEdited, handleDrawDeleted]); // Dependencies: Handlers ensure cleanup uses correct functions

  // --- Location Handling ---
  const updateLocationMarker = (lat, lon) => {
    if (!mapRef.current || !L) return;
    const latLng = [lat, lon];
    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLatLng(latLng);
      console.log("Location marker updated.");
    } else {
      const marker = L.marker(latLng)
        .addTo(mapRef.current)
        .bindPopup('Farm Location');
      locationMarkerRef.current = marker;
      console.log("New location marker created.");
    }
    mapRef.current.setView(latLng, 14); // Zoom in on the new location
    // locationMarkerRef.current.openPopup(); // Optionally open popup
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);
    console.log("Attempting to get current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log("Geolocation success:", newLocation);
        setLocation(newLocation);
        setIsGettingLocation(false);

        // Call the callback to inform parent component
        if (onLocationChange) {
          onLocationChange(newLocation);
        }

        // Update map view and marker
        updateLocationMarker(newLocation.latitude, newLocation.longitude);
      },
      (error) => {
        console.error("Error getting geolocation:", error);
        let message = "Couldn't get your location.";
        switch(error.code) {
            case error.PERMISSION_DENIED: message += " Permission denied."; break;
            case error.POSITION_UNAVAILABLE: message += " Location unavailable."; break;
            case error.TIMEOUT: message += " Request timed out."; break;
            default: message += " An unknown error occurred."; break;
        }
        setLocationError(message);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options: high accuracy, 10s timeout, no cache
    );
  };

  // --- Drawing Control ---
  const toggleDrawingMode = () => {
    if (!mapRef.current || !L || !drawControlRef.current) return;

    if (!drawingMode) {
      // Clear existing layers before starting a new drawing
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
        // Inform parent component that boundary is cleared
        if (onBoundaryChange) {
          onBoundaryChange(null);
        }
        setBoundary(null);
      }
      
      // Find the polygon draw handler and enable it
      const polygonDrawer = new L.Draw.Polygon(mapRef.current, drawControlRef.current.options.draw.polygon);
      polygonDrawer.enable();
      activeDrawerRef.current = polygonDrawer;
      console.log("Polygon drawing enabled.");
      setDrawingMode(true);
    } else {
      // Cancel drawing if active
      if (activeDrawerRef.current && activeDrawerRef.current.disable) {
        activeDrawerRef.current.disable();
        activeDrawerRef.current = null;
      }
      console.log("Drawing canceled.");
      setDrawingMode(false);
    }
  };

  const clearBoundaries = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      console.log("Cleared drawn boundaries from map.");
      // This will trigger the handleDrawDeleted callback via map events if setup correctly,
      // but call it explicitly for robustness in case event doesn't fire.
      setBoundary(null);
      if (onBoundaryChange) {
        onBoundaryChange(null);
      }
    }
  };

  // --- Render ---
  return (
    <div className="farm-map-selector">
      <div className="map-controls">
        <button
          type="button" // Ensure buttons don't submit forms
          className="map-button get-location-button"
          onClick={getCurrentLocation}
          disabled={isGettingLocation || !mapLoaded}
        >
          <MapPin size={18} className="button-icon" />
          {isGettingLocation ? 'Getting Location...' : (location ? 'Update My Location' : 'Use My Location')}
        </button>

        <button
          type="button"
          className={`map-button draw-button ${drawingMode ? 'active' : ''}`}
          onClick={toggleDrawingMode}
          disabled={!mapLoaded} // Disable until map is ready
        >
          {drawingMode ? 'Cancel Drawing' : (boundary ? 'Redraw Boundary' : 'Draw Farm Boundary')}
        </button>

        <button
          type="button"
          className="map-button clear-button"
          onClick={clearBoundaries}
          disabled={!boundary || !mapLoaded} // Disable if no boundary or map not ready
        >
          <Trash2 size={18} className="button-icon" />
          Clear Boundary
        </button>
      </div>

      {locationError && <p className="map-error" role="alert">{locationError}</p>}

      {/* Info Display */}
      <div className="map-info-display">
        {location && (
          <div className="location-info">
            <Check size={16} className="info-check-icon" />
            <span>Location Set: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
          </div>
        )}
        {boundary && (
          <div className="boundary-info">
            <Check size={16} className="info-check-icon" />
            <span>Boundary Drawn</span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="map-container"
        style={{ height: '400px', width: '100%', backgroundColor: '#eee' }} // Added background color
      >
        {!mapLoaded && <div className="map-loading">Loading Map...</div>}
      </div>

      <p className="map-instructions">
        Use 'My Location' or click 'Draw Farm Boundary' then click points on the map. <strong>Double-click</strong> to finish drawing. Use map controls (top-left) to edit or delete.
      </p>
    </div>
  );
};

export default FarmMapSelector;
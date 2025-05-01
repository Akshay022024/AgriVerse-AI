import React, { useState, useEffect } from 'react';
import { MapPin, Check, Droplet, Crop, User, BookOpen, BarChart } from 'lucide-react'; // Removed Calendar as it wasn't used
import './UserOnboarding.css'; // Make sure this CSS file exists and is styled
import {
  signInUserAnonymously,
  saveUserData,
  updateUserProfile,
  onAuthStateChange
} from './firebase'; //
import FarmMapSelector from './FarmMapSelector'; //

const UserOnboarding = () => {
  const [track, setTrack] = useState(null); // 'explore' or 'progress'
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({
    // Basic info
    name: '',
    farmName: '',
    location: null, // Will store { latitude: number, longitude: number }
    manualLocation: '',
    farmBoundary: null, // Will store GeoJSON Feature object or stringified version for saving
    farmArea: '',
    areaUnit: 'hectares',
    soilTexture: '',
    waterSources: [],
    cropTypes: [],

    // Track-specific fields
    experienceLevel: '', // explore track
    learningGoals: [],   // explore track
    farmingStart: '',    // progress track
    trackingGoals: [],   // progress track
    harvestFrequency: '',// progress track
    currentCrops: []     // progress track
  });
  // Removed isGettingLocation and locationError as they are handled within FarmMapSelector

  // Options for various selection fields
  const soilTextureOptions = [
    'Sandy', 'Loamy', 'Clay', 'Silt', 'Peat', 'Chalky', 'Rocky', 'Unknown'
  ];

  const waterSourceOptions = [
    'Well', 'Rainwater', 'River/Stream', 'Dam/Reservoir', 'Municipal', 'Irrigation Canal', 'None'
  ];

  const cropTypeOptions = [
    'Grains', 'Fruits', 'Vegetables', 'Oil Crops', 'Nuts', 'Cotton', 'Others'
  ];

  const experienceLevelOptions = [
    'Complete Beginner', 'Some Knowledge', 'Hobby Gardener', 'Part-time Farmer', 'Experienced Farmer'
  ];

  const learningGoalOptions = [
    'Basic Farming Concepts', 'Sustainable Practices', 'Crop Selection', 'Soil Management',
    'Water Management', 'Pest Control', 'Market Knowledge', 'Equipment Usage'
  ];

  const trackingGoalOptions = [
    'Yield Improvement', 'Cost Reduction', 'Sustainability', 'Soil Health',
    'Water Conservation', 'Pest Management', 'Labor Efficiency', 'Market Timing'
  ];

  const harvestFrequencyOptions = [
    'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Seasonal', 'Annual'
  ];

  // Setup Firebase authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange((authUser) => {
      if (authUser) {
        console.log("Auth state changed: User logged in", authUser.uid);
        setUser(authUser);
        // Optional: Fetch existing user data if they reload mid-onboarding
        // getUserData().then(existingData => {
        //   if (existingData && !existingData.onboardingCompleted) {
        //     // Pre-fill state if needed, handle parsing boundary here too
        //   }
        // });
      } else {
        console.log("Auth state changed: No user. Signing in anonymously.");
        // If no user is signed in, try to sign in anonymously
        handleAnonymousSignIn();
      }
    });

    return () => {
      console.log("Cleaning up auth listener.");
      if (unsubscribe) unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Handle anonymous sign in
  const handleAnonymousSignIn = async () => {
    if (loading) return; // Prevent multiple sign-in attempts
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const newUser = await signInUserAnonymously();
      setUser(newUser);
    } catch (err) {
      console.error("Error during anonymous sign in:", err);
      setError("Failed to initialize user account. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  // Handle the location change from FarmMapSelector
  const handleLocationChange = (newLocation) => {
    console.log("Location updated from map:", newLocation);
    setUserData(prevData => ({
      ...prevData,
      location: newLocation // Should be { latitude, longitude } or null
    }));
  };

  // Handle the boundary change from FarmMapSelector
  const handleBoundaryChange = (newBoundary) => {
     console.log("Boundary updated from map:", newBoundary);
     setUserData(prevData => ({
       ...prevData,
       farmBoundary: newBoundary // Should be GeoJSON Feature object or null
     }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e, category) => {
    const { value, checked } = e.target;
    setUserData(prevData => ({
      ...prevData,
      [category]: checked
        ? [...prevData[category], value]
        : prevData[category].filter(item => item !== value)
    }));
  };

  // Handle textarea for current crops (array to string and back)
  const handleCurrentCropsChange = (e) => {
    const cropsString = e.target.value;
    // Split by comma, trim whitespace, filter out empty strings
    const cropsArray = cropsString.split(',')
                                  .map(crop => crop.trim())
                                  .filter(Boolean);
    setUserData(prevData => ({
      ...prevData,
      currentCrops: cropsArray
    }));
  };

  const selectTrack = (selectedTrack) => {
    setTrack(selectedTrack);
    setStep(1); // Move to the first step after track selection
  };

  const nextStep = () => {
    // Add validation per step if needed
    // Example: Check if name is filled in step 1
    if (step === 1 && !userData.name.trim()) {
       setError("Please enter your name.");
       return;
    }
    setError(null); // Clear error if validation passes
    setStep(prevStep => prevStep + 1);
  };

  const prevStep = () => {
    setError(null); // Clear error when going back
    setStep(prevStep => prevStep - 1);
  };

  // --- Function to prepare data for Firestore ---
const prepareDataForFirebase = (data) => {
  console.log("Preparing data for Firebase. Initial data:", data);
  // Create a deep copy to avoid mutating the original state directly
  const processedData = JSON.parse(JSON.stringify(data));

  // --- Properly handle farmBoundary object conversion ---
  if (processedData.farmBoundary && typeof processedData.farmBoundary === 'object') {
    try {
      // Ensure farmBoundary is a properly formed GeoJSON Feature object
      if (processedData.farmBoundary.type !== 'Feature') {
        // If it's a Geometry object rather than a Feature, wrap it
        if (processedData.farmBoundary.type && 
           (processedData.farmBoundary.type === 'Polygon' || 
            processedData.farmBoundary.type === 'MultiPolygon')) {
          processedData.farmBoundary = {
            type: 'Feature',
            properties: {},
            geometry: processedData.farmBoundary
          };
        }
      }
      
      // Ensure we have valid GeoJSON before stringifying
      if (processedData.farmBoundary.type === 'Feature' && 
          processedData.farmBoundary.geometry && 
          processedData.farmBoundary.geometry.coordinates) {
        // Convert the entire GeoJSON object to a JSON string
        const boundaryString = JSON.stringify(processedData.farmBoundary);
        processedData.farmBoundary = boundaryString;
        console.log("Successfully stringified farmBoundary:", boundaryString.substring(0, 100) + "...");
      } else {
        console.warn("Invalid GeoJSON structure in farmBoundary:", processedData.farmBoundary);
        processedData.farmBoundary = null;
      }
    } catch (e) {
      console.error("Could not stringify farmBoundary:", e);
      // Set boundary to null if stringification fails
      processedData.farmBoundary = null; 
      // Inform user
      throw new Error("There was an issue processing the farm boundary data: " + e.message);
    }
  } else if (processedData.farmBoundary === null) {
    // If boundary is explicitly null, leave it as null (user cleared it)
    console.log("Farm boundary is null - keeping as null");
  } else if (processedData.farmBoundary) {
    // If it exists but isn't the expected object, log it and nullify
    console.warn("farmBoundary exists but is not a valid GeoJSON Feature object:", processedData.farmBoundary);
    processedData.farmBoundary = null;
  }
  // --- End farmBoundary processing ---

  // Convert location to a simple object if it exists
  if (processedData.location && typeof processedData.location === 'object') {
    processedData.location = {
      latitude: parseFloat(processedData.location.latitude) || 0,
      longitude: parseFloat(processedData.location.longitude) || 0
    };
    console.log("Formatted location:", processedData.location);
  }

  // Convert arrays to map objects (Firestore-compatible format)
  const arrayKeysToConvert = ['waterSources', 'cropTypes', 'learningGoals', 'trackingGoals', 'currentCrops'];
  arrayKeysToConvert.forEach(key => {
    if (Array.isArray(processedData[key]) && processedData[key].length > 0) {
      const map = {};
      processedData[key].forEach((item, index) => {
        // Ensure item is serializable (usually strings in these arrays)
        map[`item_${index}`] = String(item);
      });
      processedData[key] = map; // Replace the array with the map
      console.log(`Converted array '${key}' to map.`);
    } else if (Array.isArray(processedData[key]) && processedData[key].length === 0) {
      // Handle empty arrays
      delete processedData[key]; // Option 2: Don't store empty fields (often preferred)
      console.log(`Removed empty array '${key}'.`);
    }
  });

  // Ensure no complex objects remain other than allowed ones
  for (const key in processedData) {
    if (typeof processedData[key] === 'object' && processedData[key] !== null && 
        !['location'].includes(key) && typeof processedData[key] !== 'string' && 
        !Array.isArray(processedData[key]) && 
        !(key.endsWith('Map') || typeof processedData[key] === 'string')) {
        
      // Check if it's a simple map created by array conversion
      const isSimpleMap = Object.keys(processedData[key]).every(k => k.startsWith('item_'));
      if (!isSimpleMap && key !== 'farmBoundary') { // farmBoundary is now stringified
        console.warn(`Unexpected object found at key '${key}'. Removing before save. Value:`, processedData[key]);
        // Remove unexpected objects
        delete processedData[key];
      }
    } else if (Array.isArray(processedData[key])) {
      // This should not happen if arrayKeysToConvert logic is correct
      console.error(`Unexpected array found at key '${key}' after conversion attempt. Removing. Value:`, processedData[key]);
      delete processedData[key]; // Remove unexpected arrays
    }
  }

  // Add timestamps for creation/update if not present
  if (!processedData.createdAt) {
    processedData.createdAt = new Date().toISOString();
  }
  processedData.updatedAt = new Date().toISOString();
  
  console.log("Data prepared for Firebase:", processedData);
  return processedData;
};
// --- End of prepareDataForFirebase ---
  // --- End of prepareDataForFirebase ---

  const handleSubmit = async () => {
    if (!user) {
      setError("No active user session. Please refresh the page and try again.");
      return;
    }
     // Final validation before submission
     if (!userData.name.trim()) {
       setStep(1); // Go back to the step with the name field
       setError("Please enter your name before completing setup.");
       return;
     }

    console.log("Submitting form. Current state:", userData);
    setError(null); // Clear previous errors
    setLoading(true);

    try {
      // 1. Update user profile display name (optional but good practice)
      if (userData.name) {
        await updateUserProfile(userData.name);
      }

      // 2. Prepare the data for Firestore using the dedicated function
      const finalUserData = {
        ...userData,
        track: track, // Add the selected track
        onboardingCompleted: true,
        createdAt: new Date().toISOString(), // Add creation timestamp
        updatedAt: new Date().toISOString() // Add update timestamp
      };
      const preparedData = prepareDataForFirebase(finalUserData); //

      // 3. Save the prepared data to Firestore
      await saveUserData(preparedData); //

      console.log("Form submitted successfully!");
      setSuccess(true); // Trigger success screen

      // Optional: Redirect after a delay
      setTimeout(() => {
        console.log("Redirecting to dashboard...");
        // Replace with your actual navigation logic (e.g., using react-router)
        // window.location.href = '/dashboard';
      }, 2000);

    } catch (err) {
      console.error("Error submitting onboarding form:", err);
      // Check if the error came from prepareDataForFirebase or saveUserData
      if (!error) { // Avoid overwriting specific error from prepareData
        setError(`Failed to save your information. ${err.message || 'Please try again.'}`);
      }
      setSuccess(false); // Ensure success state is false on error
    } finally {
      setLoading(false);
    }
  };

  // --- Render Functions ---

  const renderTrackSelection = () => (
    <div className="step-content-box">
      <h2 className="step-title">Welcome to AgriVerse AI</h2>
      <p className="step-description">Choose how you want to use AgriVerse:</p>
      <div className="track-selection-grid">
        {/* Exploration Track Card */}
        <div
          className={`track-card track-card-explore ${track === 'explore' ? 'track-card-selected-explore' : ''}`}
          onClick={() => selectTrack('explore')}
          role="button" tabIndex={0} // Accessibility
          onKeyPress={(e) => e.key === 'Enter' && selectTrack('explore')} // Accessibility
        >
          <div className="track-card-icon-wrapper"><BookOpen size={36} className="icon-green" /></div>
          <h3 className="track-card-title">Exploration & Learning</h3>
          <p className="track-card-description">Perfect for beginners or those interested in exploring agricultural concepts and practices</p>
          <div className="track-card-button-wrapper">
            <button className="button track-select-button-explore" onClick={(e) => { e.stopPropagation(); selectTrack('explore'); }}>
              Select Exploration
            </button>
          </div>
        </div>
        {/* Progress Tracking Track Card */}
        <div
          className={`track-card track-card-progress ${track === 'progress' ? 'track-card-selected-progress' : ''}`}
          onClick={() => selectTrack('progress')}
           role="button" tabIndex={0} // Accessibility
           onKeyPress={(e) => e.key === 'Enter' && selectTrack('progress')} // Accessibility
        >
          <div className="track-card-icon-wrapper"><BarChart size={36} className="icon-blue" /></div>
          <h3 className="track-card-title">Farm Progress Tracking</h3>
          <p className="track-card-description">For active farmers looking to track, analyze and improve farm operations</p>
          <div className="track-card-button-wrapper">
            <button className="button track-select-button-progress" onClick={(e) => { e.stopPropagation(); selectTrack('progress'); }}>
              Select Progress Tracking
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (step === 0) return renderTrackSelection();

    switch (step) {
      case 1: // Profile Step
        return (
          <div className="step-content-box">
            <h2 className="step-title">Your Profile</h2>
            <p className="step-description">Let's set up your profile to personalize your experience.</p>
            {/* Name Input */}
            <div className="form-group">
              <label htmlFor="name" className="form-label">Your Name *</label>
              <input type="text" id="name" name="name" value={userData.name} onChange={handleInputChange} placeholder="Enter your name" className="form-input" required aria-required="true"/>
            </div>
            {/* Farm Name Input */}
            <div className="form-group">
              <label htmlFor="farmName" className="form-label">Farm Name</label>
              <input type="text" id="farmName" name="farmName" value={userData.farmName} onChange={handleInputChange} placeholder="Enter your farm name (optional)" className="form-input"/>
            </div>
            {/* Track-Specific Inputs */}
            {track === 'explore' && (
              <div className="form-group">
                <label className="form-label">Your Experience Level</label>
                <div className="option-button-group">
                  {experienceLevelOptions.map((level) => (
                    <button key={level} type="button" className={`option-button option-button-explore ${userData.experienceLevel === level ? 'option-button-selected-explore' : ''}`} onClick={() => setUserData(prev => ({ ...prev, experienceLevel: level }))}>
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {track === 'progress' && (
              <div className="form-group">
                <label htmlFor="farmingStart" className="form-label">When did you start farming?</label>
                <input type="date" id="farmingStart" name="farmingStart" value={userData.farmingStart} onChange={handleInputChange} className="form-input" max={new Date().toISOString().split("T")[0]} />
              </div>
            )}
          </div>
        );

      case 2: // Location Step
        return (
          <div className="step-content-box">
            <h2 className="step-title">Farm Location & Boundary</h2>
            <p className="step-description">Mark your farm location and boundary for personalized insights (Optional).</p>
            {/* FarmMapSelector Integration */}
            <div className="farm-map-wrapper">
              <FarmMapSelector //
                onLocationChange={handleLocationChange}
                onBoundaryChange={handleBoundaryChange}
                initialLocation={userData.location} // Pass current state
                initialBoundary={userData.farmBoundary} // Pass current state
              />
            </div>
            {/* Manual Location Input */}
            <div className="form-group">
              <label htmlFor="manualLocation" className="form-label">Additional Location Details</label>
              <input type="text" id="manualLocation" name="manualLocation" value={userData.manualLocation} onChange={handleInputChange} placeholder="e.g., Near Springfield" className="form-input"/>
              <small className="form-help-text">Helps if GPS location is imprecise.</small>
            </div>
            {/* Farm Area Input */}
            <div className="form-group">
              <label htmlFor="farmArea" className="form-label">Farm Area</label>
              <div className="input-group">
                <input type="number" id="farmArea" name="farmArea" value={userData.farmArea} onChange={handleInputChange} placeholder="Size" min="0" step="any" className="form-input" style={{ width: '65%'}}/>
                <select name="areaUnit" value={userData.areaUnit} onChange={handleInputChange} className="form-select" style={{ width: '35%'}}>
                  <option value="hectares">Hectares</option>
                  <option value="acres">Acres</option>
                  <option value="sqm">Sq. Meters</option>
                </select>
              </div>
              <small className="form-help-text">If you drew a boundary, this can be calculated later.</small>
            </div>
          </div>
        );

      case 3: // Resources Step
         return (
           <div className="step-content-box">
             <h2 className="step-title">Soil & Water</h2>
             <p className="step-description">Tell us about your soil and water (Optional).</p>
             {/* Soil Texture Selection */}
             <div className="form-group">
               <label className="form-label">Dominant Soil Texture</label>
               <div className="option-button-group">
                 {soilTextureOptions.map((soil) => (
                   <button key={soil} type="button" className={`option-button option-button-soil ${userData.soilTexture === soil ? 'option-button-selected-soil' : ''}`} onClick={() => setUserData(prev => ({ ...prev, soilTexture: soil }))}>
                     {soil}
                   </button>
                 ))}
               </div>
             </div>
             {/* Water Sources Selection */}
             <div className="form-group">
               <label className="form-label">Water Sources (Select all that apply)</label>
               <div className="checkbox-grid checkbox-grid-3col">
                 {waterSourceOptions.map((source) => (
                   <div className="checkbox-item" key={source}>
                     <input type="checkbox" id={`water-${source}`} value={source} checked={userData.waterSources.includes(source)} onChange={(e) => handleCheckboxChange(e, 'waterSources')} className="form-checkbox"/>
                     <label htmlFor={`water-${source}`} className="checkbox-label">{source}</label>
                   </div>
                 ))}
               </div>
             </div>
           </div>
         );

      case 4: // Crops Step
        return (
          <div className="step-content-box">
            <h2 className="step-title">Crops & Growing</h2>
            <p className="step-description">What do you grow or want to grow? (Optional)</p>
            {/* General Crop Types */}
            <div className="form-group">
              <label className="form-label">General Crop Types (Select all that apply)</label>
              <div className="checkbox-grid checkbox-grid-3col">
                {cropTypeOptions.map((crop) => (
                  <div className="checkbox-item" key={crop}>
                    <input type="checkbox" id={`crop-${crop}`} value={crop} checked={userData.cropTypes.includes(crop)} onChange={(e) => handleCheckboxChange(e, 'cropTypes')} className="form-checkbox"/>
                    <label htmlFor={`crop-${crop}`} className="checkbox-label">{crop}</label>
                  </div>
                ))}
              </div>
            </div>
            {/* Progress Track Specific Inputs */}
            {track === 'progress' && (
              <>
                <div className="form-group">
                  <label htmlFor="currentCrops" className="form-label">Specific Current Active Crops</label>
                  <textarea id="currentCrops" name="currentCrops" value={userData.currentCrops.join(', ')} onChange={handleCurrentCropsChange} placeholder="List crops separated by commas (e.g., Maize, Tomatoes)" className="form-textarea" rows={3}/>
                  <small className="form-help-text">Separate crop names with commas.</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Typical Harvest Frequency</label>
                  <div className="option-button-group">
                    {harvestFrequencyOptions.map((frequency) => (
                      <button key={frequency} type="button" className={`option-button option-button-harvest ${userData.harvestFrequency === frequency ? 'option-button-selected-harvest' : ''}`} onClick={() => setUserData(prev => ({ ...prev, harvestFrequency: frequency }))}>
                        {frequency}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );

       case 5: // Goals Step & Summary
         // Determine goals options based on track
         const goalOptions = track === 'explore' ? learningGoalOptions : trackingGoalOptions;
         const goalCategory = track === 'explore' ? 'learningGoals' : 'trackingGoals';

         return (
           <div className="step-content-box">
             <h2 className="step-title">Your {track === 'explore' ? 'Learning' : 'Tracking'} Goals</h2>
             <p className="step-description">What do you hope to achieve? (Optional)</p>
             {/* Goals Selection */}
             <div className="form-group">
               <label className="form-label">{track === 'explore' ? 'Learning' : 'Tracking'} Goals (Select all that apply)</label>
               <div className="checkbox-grid checkbox-grid-2col">
                 {goalOptions.map((goal) => (
                   <div className="checkbox-item" key={goal}>
                     <input type="checkbox" id={`goal-${goal}`} value={goal} checked={userData[goalCategory].includes(goal)} onChange={(e) => handleCheckboxChange(e, goalCategory)} className="form-checkbox"/>
                     <label htmlFor={`goal-${goal}`} className="checkbox-label">{goal}</label>
                   </div>
                 ))}
               </div>
             </div>
             {/* Summary Section */}
             <div className="summary-box">
               <h3 className="summary-title">Quick Summary</h3>
               <div className="summary-grid">
                 <p className="summary-item"><strong>Name:</strong> {userData.name || <span className="text-muted">(Not set)</span>}</p>
                 <p className="summary-item"><strong>Farm:</strong> {userData.farmName || <span className="text-muted">(Not set)</span>}</p>
                 <p className="summary-item"><strong>Track:</strong> {track === 'explore' ? 'Exploration' : 'Progress'}</p>
                 {userData.location && <p className="summary-item"><strong>GPS:</strong> {userData.location.latitude.toFixed(4)}, {userData.location.longitude.toFixed(4)}</p>}
                 {userData.farmBoundary && <p className="summary-item"><strong>Boundary:</strong> Defined</p>}
                 {userData.farmArea && <p className="summary-item"><strong>Size:</strong> {`${userData.farmArea} ${userData.areaUnit}`}</p>}
                 {userData.soilTexture && <p className="summary-item"><strong>Soil:</strong> {userData.soilTexture}</p>}
                 {/* Add more summary items as needed */}
               </div>
             </div>
           </div>
         );

      default: return null; // Should not happen
    }
  };

  const renderProgressBar = () => {
    if (step === 0) return null; // No progress bar on track selection

    const stepsMeta = [
      { label: "Profile", icon: User, stepIndex: 1 },
      { label: "Location", icon: MapPin, stepIndex: 2 },
      { label: "Resources", icon: Droplet, stepIndex: 3 },
      { label: "Crops", icon: Crop, stepIndex: 4 },
      { label: track === 'explore' ? "Learning" : "Goals", icon: track === 'explore' ? BookOpen : BarChart, stepIndex: 5 },
    ];
    const maxSteps = stepsMeta.length; // Max steps is 5 (indices 1 to 5)

    return (
      <div className="progress-bar-container">
        <div className="progress-bar-steps">
          {stepsMeta.map((item, index) => (
            <React.Fragment key={item.stepIndex}>
              <div className={`progress-step ${step >= item.stepIndex ? 'progress-step-active' : ''}`}>
                <div className={`step-icon-wrapper ${step >= item.stepIndex ? 'step-icon-wrapper-active' : ''}`}>
                  <item.icon size={16} />
                </div>
                <span className="step-label">{item.label}</span>
              </div>
              {index < stepsMeta.length - 1 && (
                <div className="progress-line-container">
                  {/* Line active state depends on the *next* step being reached */}
                  <div className={`progress-line ${step > item.stepIndex ? 'progress-line-active' : ''}`}></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // --- Conditional Rendering for Loading/Success/Form ---

  if (loading && !success) { // Show loading overlay only during final submission
    return (
      <div className="user-onboarding-container">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">Saving your information...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="user-onboarding-container">
        <div className="success-message">
          <div className="success-icon"><Check size={48} /></div>
          <h2>Setup Complete!</h2>
          <p>Your farm profile has been saved. Redirecting soon...</p>
        </div>
      </div>
    );
  }

  // Main form render
  const maxSteps = 5; // Total number of steps after track selection
  return (
    <div className="user-onboarding-container">
      {renderProgressBar()}

      {renderStepContent()}

      {error && (
        <div className="error-message" role="alert"> {/* Accessibility */}
          <p>{error}</p>
        </div>
      )}

      {/* Navigation Buttons */}
      {step > 0 && (
        <div className="navigation-buttons">
          {/* Back Button: Show only if not on the first step (step 1) */}
          {step > 1 ? (
            <button type="button" className="button button-secondary" onClick={prevStep} disabled={loading}>
              Back
            </button>
          ) : (
             <div style={{ width: '80px' }}></div> // Placeholder to keep Next/Complete button right-aligned
          )}

          {/* Next/Complete Button */}
          {step < maxSteps ? (
            <button type="button" className="button button-primary" onClick={nextStep} disabled={loading}>
              Next
            </button>
          ) : (
            <button type="button" className="button button-complete" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UserOnboarding;
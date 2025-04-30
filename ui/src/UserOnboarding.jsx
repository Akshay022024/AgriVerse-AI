// UserOnboarding.js - Onboarding wizard for new users
import React, { useState, useEffect } from 'react';
import { MapPin, Check, Droplet, Crop, User } from 'lucide-react';
import './UserOnboarding.css' ;

const UserOnboarding = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({
    name: '',
    farmName: '',
    location: null,
    manualLocation: '',
    farmArea: '',
    areaUnit: 'hectares',
    soilTexture: '',
    waterSources: [],
    cropTypes: []
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const soilTextureOptions = [
    'Sandy', 'Loamy', 'Clay', 'Silt', 'Peat', 'Chalky', 'Rocky', 'Unknown'
  ];
  
  const waterSourceOptions = [
    'Well', 'Rainwater', 'River/Stream', 'Dam/Reservoir', 'Municipal', 'Irrigation Canal', 'None'
  ];
  
  const cropTypeOptions = [
    'Grains', 'Fruits', 'Vegetables', 'Oil Crops', 'Nuts', 'Cotton', 'Others'
  ];

  // Get geolocation
  const getLocation = () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserData({
            ...userData,
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          });
          setIsGettingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError("Couldn't get your location. Please enter manually.");
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setIsGettingLocation(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData({
      ...userData,
      [name]: value
    });
  };

  const handleCheckboxChange = (e, category) => {
    const { value, checked } = e.target;
    
    if (checked) {
      setUserData({
        ...userData,
        [category]: [...userData[category], value]
      });
    } else {
      setUserData({
        ...userData,
        [category]: userData[category].filter(item => item !== value)
      });
    }
  };

  const nextStep = () => {
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete(userData);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="onboarding-step">
            <h2>Welcome to AgriVerse AI</h2>
            <p>Let's set up your farm profile to personalize your experience</p>
            
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={userData.name}
                onChange={handleInputChange}
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="farmName">Farm Name</label>
              <input
                type="text"
                id="farmName"
                name="farmName"
                value={userData.farmName}
                onChange={handleInputChange}
                placeholder="Enter your farm name"
                required
              />
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="onboarding-step">
            <h2>Farm Location</h2>
            <p>Help us locate your farm for weather and soil data</p>
            
            <div className="form-group">
              <button 
                type="button" 
                className="location-button"
                onClick={getLocation}
                disabled={isGettingLocation}
              >
                <MapPin size={18} />
                {isGettingLocation ? 'Getting Location...' : 'Use My Current Location'}
              </button>
              
              {locationError && <p className="error-text">{locationError}</p>}
              
              {userData.location && (
                <div className="location-success">
                  <Check size={18} color="green" />
                  <span>Location acquired: {userData.location.latitude.toFixed(4)}, {userData.location.longitude.toFixed(4)}</span>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="manualLocation">Or Describe Your Location</label>
              <input
                type="text"
                id="manualLocation"
                name="manualLocation"
                value={userData.manualLocation}
                onChange={handleInputChange}
                placeholder="Town, District, State, Country"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="farmArea">Farm Area</label>
              <div className="area-input-group">
                <input
                  type="number"
                  id="farmArea"
                  name="farmArea"
                  value={userData.farmArea}
                  onChange={handleInputChange}
                  placeholder="Size of your farm"
                  min="0"
                />
                <select
                  name="areaUnit"
                  value={userData.areaUnit}
                  onChange={handleInputChange}
                >
                  <option value="hectares">Hectares</option>
                  <option value="acres">Acres</option>
                  <option value="sqm">Square Meters</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="onboarding-step">
            <h2>Soil & Water</h2>
            <p>Tell us about your soil type and water sources</p>
            
            <div className="form-group">
              <label>Soil Texture</label>
              <div className="option-buttons">
                {soilTextureOptions.map((soil) => (
                  <button
                    key={soil}
                    type="button"
                    className={`option-button ${userData.soilTexture === soil ? 'selected' : ''}`}
                    onClick={() => setUserData({...userData, soilTexture: soil})}
                  >
                    {soil}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="form-group">
              <label>Water Sources (Select all that apply)</label>
              <div className="checkbox-group">
                {waterSourceOptions.map((source) => (
                  <div className="checkbox-item" key={source}>
                    <input
                      type="checkbox"
                      id={`water-${source}`}
                      value={source}
                      checked={userData.waterSources.includes(source)}
                      onChange={(e) => handleCheckboxChange(e, 'waterSources')}
                    />
                    <label htmlFor={`water-${source}`}>{source}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="onboarding-step">
            <h2>Crops & Final Setup</h2>
            <p>What do you primarily grow?</p>
            
            <div className="form-group">
              <label>Crop Types (Select all that apply)</label>
              <div className="checkbox-group">
                {cropTypeOptions.map((crop) => (
                  <div className="checkbox-item" key={crop}>
                    <input
                      type="checkbox"
                      id={`crop-${crop}`}
                      value={crop}
                      checked={userData.cropTypes.includes(crop)}
                      onChange={(e) => handleCheckboxChange(e, 'cropTypes')}
                    />
                    <label htmlFor={`crop-${crop}`}>{crop}</label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="summary-section">
              <h3>Summary</h3>
              <p>Name: {userData.name}</p>
              <p>Farm: {userData.farmName}</p>
              <p>Size: {userData.farmArea} {userData.areaUnit}</p>
              <p>Soil: {userData.soilTexture}</p>
              {userData.location && (
                <p>GPS: {userData.location.latitude.toFixed(4)}, {userData.location.longitude.toFixed(4)}</p>
              )}
              {userData.manualLocation && <p>Location: {userData.manualLocation}</p>}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-progress">
        <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
          <div className="step-icon">
            <User size={18} />
          </div>
          <span>Profile</span>
        </div>
        <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
          <div className="step-icon">
            <MapPin size={18} />
          </div>
          <span>Location</span>
        </div>
        <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-icon">
            <Droplet size={18} />
          </div>
          <span>Resources</span>
        </div>
        <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>
          <div className="step-icon">
            <Crop size={18} />
          </div>
          <span>Crops</span>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        {renderStepContent()}
        
        <div className="onboarding-buttons">
          {step > 1 && (
            <button 
              type="button" 
              className="button secondary" 
              onClick={prevStep}
            >
              Back
            </button>
          )}
          
          {step < 4 ? (
            <button 
              type="button" 
              className="button primary" 
              onClick={nextStep}
            >
              Next
            </button>
          ) : (
            <button 
              type="submit" 
              className="button primary"
            >
              Complete Setup
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UserOnboarding;
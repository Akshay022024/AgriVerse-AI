// App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Cloud, Leaf, BarChart2, Droplet, CreditCard, Calendar, Users, Settings, Home, Search, User, Mic, Bot, MapPin, Clock, CloudRain, Wind, Thermometer, CheckCircle, AlertTriangle, Info, BrainCircuit, Loader2 } from 'lucide-react';
import './App.css';
import VirtualFarmTwin from './VirtualFarmTwin';
import UserOnboarding from './UserOnboarding'; // Assuming this component exists
import CoPilot from './CoPilot'; // <-- Import the CoPilot component (Corrected Casing)
import { signInUserAnonymously, onAuthStateChange, saveUserData, getUserData, updateUserProfile } from './firebase'; // Assuming firebase setup exists
import './UserOnboarding.css'; // Ensure this CSS exists and is styled


// --- Helper functions ---

// Helper function to map API conditions to your icons
const mapApiConditionToIcon = (conditionText) => {
  if (!conditionText) return 'cloud';
  const text = conditionText.toLowerCase();
  if (text.includes('sunny') || text.includes('clear')) return 'sun';
  if (text.includes('rain') || text.includes('drizzle') || text.includes('shower')) return 'cloud-rain';
  if (text.includes('cloudy') || text.includes('overcast')) return 'cloud';
  if (text.includes('mist') || text.includes('fog')) return 'cloud';
  return 'cloud';
};

// Helper function to format date
const formatDate = (dateStr, index) => {
    if (!dateStr) return '';
    try {
        if (index === 0) return 'Today';
        if (index === 1) return 'Tomorrow';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (e) {
        console.error("Error formatting date:", dateStr, e);
        return dateStr;
    }
}

// Get Icon Component
const getIconComponent = (iconName, size = 24) => {
    // Add a default className for potential styling
    const props = { size, className: `lucide-icon icon-${iconName}` };
    switch(iconName) {
      case 'droplet': return <Droplet {...props} />;
      case 'calendar': return <Calendar {...props} />;
      case 'check-circle': return <CheckCircle {...props} />;
      case 'alert-triangle': return <AlertTriangle {...props} />;
      case 'info': return <Info {...props} />;
      case 'cloud': return <Cloud {...props} />;
      case 'sun': return <Sun {...props} />;
      case 'cloud-rain': return <CloudRain {...props} />;
      case 'leaf': return <Leaf {...props} />;
      case 'thermometer': return <Thermometer {...props} />;
      case 'wind': return <Wind {...props} />;
      case 'brain-circuit': return <BrainCircuit {...props} />;
      case 'loader': return <Loader2 {...props} className="animate-spin" />;
      case 'map-pin': return <MapPin {...props} />;
      case 'home': return <Home {...props} />;
      case 'bot': return <Bot {...props} />; // Assuming 'bot' icon for CoPilot
      case 'bar-chart-2': return <BarChart2 {...props} />;
      case 'credit-card': return <CreditCard {...props} />;
      case 'settings': return <Settings {...props} />;
      case 'user': return <User {...props} />;
      case 'clock': return <Clock {...props} />;
      default: return <Cloud {...props} />; // Default icon
    }
};


const App = () => {
  // State variables
  const [showSplash, setShowSplash] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLocationName, setWeatherLocationName] = useState('');
  const [farmAlerts, setFarmAlerts] = useState([]); // Now dynamically generated
  const [tasks, setTasks] = useState([]); // Now dynamically generated
  const [showSettings, setShowSettings] = useState(false);
  const [aiInsights, setAiInsights] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [errorInsights, setErrorInsights] = useState(null);

  // --- Fetch Weather Data ---
  const fetchWeatherData = useCallback(async (locationInput, inputType = 'coords') => {
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
    if (!apiKey) {
      console.error("Weather API Key missing (VITE_WEATHER_API_KEY).");
      setWeatherData(null); setWeatherLocationName(''); return null;
    }

    let queryParam = '';
    // Determine query parameter based on input type
    if (inputType === 'coords' && locationInput && typeof locationInput.latitude === 'number' && typeof locationInput.longitude === 'number') {
        queryParam = `${locationInput.latitude},${locationInput.longitude}`;
        console.log(`Fetching weather using coordinates: ${queryParam}`);
    } else if (inputType === 'string' && typeof locationInput === 'string' && locationInput.trim().length > 0) {
        // Clean up potential extra commas/spaces from manual input like "mahabubnagar, telangana ,"
        const cleanedLocationString = locationInput.split(',')
                                                .map(s => s.trim())
                                                .filter(s => s.length > 0)
                                                .join(',');
        queryParam = encodeURIComponent(cleanedLocationString);
        console.log(`Fetching weather using string: ${cleanedLocationString}`);
    } else {
        console.error("Invalid location input provided for weather fetch:", locationInput, inputType);
        setWeatherData(null); setWeatherLocationName(''); return null;
    }

    const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${queryParam}&days=3`;

    setWeatherData(null); // Clear previous data
    setWeatherLocationName('');

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorBody = await response.text(); // Get error details from API
        throw new Error(`WeatherAPI Error ${response.status}: ${errorBody}`);
      }
      const data = await response.json();

      // --- Store Location Name from API Response ---
      const locationName = data.location ? `${data.location.name}, ${data.location.region}` : (typeof locationInput === 'string' ? locationInput : 'Location');
      setWeatherLocationName(locationName); // Use location name from API

      // Transform data
       const formattedData = {
         current: {
           temp: Math.round(data.current.temp_c),
           humidity: data.current.humidity,
           windSpeed: Math.round(data.current.wind_kph),
           condition: data.current.condition.text,
           precip_mm: data.current.precip_mm,
           icon: mapApiConditionToIcon(data.current.condition.text),
           feelslike_c: Math.round(data.current.feelslike_c),
           uv: data.current.uv,
         },
         forecast: data.forecast.forecastday.map((day, index) => ({
           day: formatDate(day.date, index),
           high: Math.round(day.day.maxtemp_c),
           low: Math.round(day.day.mintemp_c),
           condition: day.day.condition.text,
           icon: mapApiConditionToIcon(day.day.condition.text),
           precip_mm: day.day.totalprecip_mm,
           chance_of_rain: day.day.daily_chance_of_rain
         }))
       };
      setWeatherData(formattedData);
      return formattedData;

    } catch (error) {
      console.error("Failed to fetch or process weather data:", error);
      setWeatherData(null);
      setWeatherLocationName('');
      return null;
    }
  }, []);

  // --- Generate Dynamic Tasks from AI Insights ---
  const generateDynamicTasks = (insights) => {
      const generatedTasks = [];
      let taskIdCounter = 1;

      if (!insights || insights.length === 0) return [];

      insights.forEach(insight => {
          const lowerInsight = insight.toLowerCase();
          let taskTitle = null;
          let priority = 'medium';

          if (lowerInsight.includes('irrigate') || lowerInsight.includes('water need') || lowerInsight.includes('humidity') || lowerInsight.includes('moisture')) {
              taskTitle = 'Check/adjust irrigation system/schedule'; priority = 'high';
          } else if (lowerInsight.includes('pest') || lowerInsight.includes('disease') || lowerInsight.includes('scout')) {
              taskTitle = 'Scout fields for pests or diseases'; priority = 'high';
          } else if (lowerInsight.includes('fertilize') || lowerInsight.includes('nutrient')) {
              taskTitle = 'Review fertilization plan/nutrient levels'; priority = 'medium';
          } else if (lowerInsight.includes('plant') || lowerInsight.includes('sow') || lowerInsight.includes('planting window')) {
              taskTitle = 'Assess planting/sowing conditions'; priority = 'medium';
          } else if (lowerInsight.includes('harvest') || lowerInsight.includes('yield')) {
              taskTitle = 'Prepare for potential harvest activities'; priority = 'low';
          } else if (lowerInsight.includes('monitor') || lowerInsight.includes('check soil') || lowerInsight.includes('temperature stress')) {
              taskTitle = `Monitor conditions based on AI insight: "${insight.substring(0, 35)}..."`; priority = 'low';
          }

          if (taskTitle) {
              if (!generatedTasks.some(t => t.title === taskTitle)) {
                  generatedTasks.push({
                      id: `ai-${taskIdCounter++}`,
                      title: taskTitle,
                      dueDate: 'Soon',
                      priority: priority,
                      completed: false
                  });
              }
          }
      });
      return generatedTasks;
  };

  // --- Fetch AI Insights using OpenRouter ---
  const fetchAIInsights = useCallback(async (currentUserData, currentWeatherData) => {
    const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const siteUrl = 'AgriVerse'; // Replace with your actual site URL or app name

    if (!openRouterApiKey) {
        console.error("OpenRouter API Key not found.");
        setErrorInsights("AI Service Unavailable (Missing Key)");
        setAiInsights([]);
        setTasks(prev => prev.filter(t => !t.id.startsWith('ai-')));
        return;
    }
    if (!currentUserData || !currentWeatherData) return;

    setLoadingInsights(true); setErrorInsights(null); setAiInsights([]);

    const farmLocation = weatherLocationName || currentUserData?.manualLocation?.trim() || 'Specified Location';
    const farmArea = currentUserData.farmArea && currentUserData.areaUnit ? `${currentUserData.farmArea} ${currentUserData.areaUnit}` : 'Not Specified';
    const soil = currentUserData.soilTexture || 'Not Specified';
    const crops = currentUserData.cropTypes?.join(', ') || 'Not Specified';

    const prompt = `
Act as an expert agricultural advisor. Based ONLY on the following farm details and weather, provide 3-4 brief, actionable insights for the next 3 days for the specified crops. Focus on potential issues, recommendations (irrigation, planting, pest scouting), and weather impacts. Start each insight on a new line prefixed with '- '. Be direct.

Farm Details:
- Location: ${farmLocation}
- Size: ${farmArea}
- Soil Type: ${soil}
- Main Crops: ${crops}

Current Weather:
- Temp: ${currentWeatherData.current.temp}°C (Feels like ${currentWeatherData.current.feelslike_c}°C)
- Condition: ${currentWeatherData.current.condition}
- Humidity: ${currentWeatherData.current.humidity}%
- Wind: ${currentWeatherData.current.windSpeed} km/h
- Precip (Recent): ${currentWeatherData.current.precip_mm} mm
- UV: ${currentWeatherData.current.uv}

Forecast (Next 3 Days):
- ${currentWeatherData.forecast[0].day}: High ${currentWeatherData.forecast[0].high}°C, Low ${currentWeatherData.forecast[0].low}°C, ${currentWeatherData.forecast[0].condition}, ${currentWeatherData.forecast[0].chance_of_rain}% rain (${currentWeatherData.forecast[0].precip_mm}mm).
- ${currentWeatherData.forecast[1].day}: High ${currentWeatherData.forecast[1].high}°C, Low ${currentWeatherData.forecast[1].low}°C, ${currentWeatherData.forecast[1].condition}, ${currentWeatherData.forecast[1].chance_of_rain}% rain (${currentWeatherData.forecast[1].precip_mm}mm).
- ${currentWeatherData.forecast[2].day}: High ${currentWeatherData.forecast[2].high}°C, Low ${currentWeatherData.forecast[2].low}°C, ${currentWeatherData.forecast[2].condition}, ${currentWeatherData.forecast[2].chance_of_rain}% rain (${currentWeatherData.forecast[2].precip_mm}mm).

Actionable Insights:
    `;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterApiKey}`,
                "HTTP-Referer": siteUrl,
                "X-Title": "AgriVerse AI",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mistralai/mixtral-8x7b-instruct",
                messages: [{"role": "user", "content": prompt}],
                temperature: 0.7,
                max_tokens: 200,
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`OpenRouter API Error: ${response.status} ${errorBody?.error?.message || 'Unknown'}`);
        }
        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            const insightsText = data.choices[0].message.content;
            const parsedInsights = insightsText.split('\n')
                                               .map(line => line.trim())
                                               .filter(line => line.startsWith('- '))
                                               .map(line => line.substring(2).trim());

            if (parsedInsights.length > 0) {
                 setAiInsights(parsedInsights);
                 const newTasks = generateDynamicTasks(parsedInsights);
                 setTasks(prevTasks => [
                     ...prevTasks.filter(t => !t.id.startsWith('ai-')),
                     ...newTasks
                 ]);
            } else {
                setAiInsights(["No specific insights generated."]);
                 setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
            }
        } else {
            setAiInsights(["AI could not generate insights."]);
            setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
        }
    } catch (error) {
        console.error("Failed to fetch AI insights:", error);
        setErrorInsights(`AI Error: ${error.message}`);
        setAiInsights([]);
        setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
    } finally {
        setLoadingInsights(false);
    }
  }, [weatherLocationName]);

  // --- Generate Dynamic Alerts based on Weather and AI Insights ---
  const generateDynamicAlerts = useCallback((currentWeatherData, currentAiInsights) => {
      const alerts = [];
      let alertIdCounter = 1;

      // Weather-based Alerts
      if (currentWeatherData?.forecast) {
          currentWeatherData.forecast.forEach((dayForecast, index) => {
              if (dayForecast.chance_of_rain > 60) {
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'info', message: `${dayForecast.day}: High chance of rain (${dayForecast.chance_of_rain}%). Check drainage.`, icon: 'cloud-rain' });
              }
              if (dayForecast.high > 35) {
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: High temperature (${dayForecast.high}°C). Monitor for heat stress.`, icon: 'thermometer' });
              }
              if (dayForecast.low < 10) {
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: Low temperature (${dayForecast.low}°C). Consider frost protection.`, icon: 'thermometer' });
              }
          });
      }
       if (currentWeatherData?.current?.windSpeed > 30) {
            alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `High wind speed (${currentWeatherData.current.windSpeed} km/h). Check for damage.`, icon: 'wind' });
       }

      // AI Insight-based Alerts
      if (currentAiInsights) {
          currentAiInsights.forEach(insight => {
              const lowerInsight = insight.toLowerCase();
              if (lowerInsight.includes('pest') || lowerInsight.includes('disease')) {
                  alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'warning', message: `AI Alert: Potential pest/disease risk. Recommend scouting.`, icon: 'alert-triangle' });
              }
               if (lowerInsight.includes('irrigation critical') || lowerInsight.includes('water stress')) {
                   alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'warning', message: `AI Alert: Water stress indicated. Check irrigation.`, icon: 'droplet' });
               }
          });
      }

      // Generic success alert (optional)
      // alerts.push({ id: `a-s-${alertIdCounter++}`, type: 'success', message: 'Data refreshed.', icon: 'check-circle' });

      // Remove duplicates before setting state
      const uniqueAlerts = alerts.filter((alert, index, self) =>
           index === self.findIndex((a) => (a.message === alert.message && a.type === alert.type))
       );
      setFarmAlerts(uniqueAlerts);
  }, []);

  // --- Firebase Authentication and Initial Data Loading ---
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const data = await getUserData();
          setUserData(data);
          if (!data) {
            console.log("No user data found, showing onboarding.");
            setShowOnboarding(true);
            setLoading(false);
          } else {
            console.log("User data found:", data);
            setShowOnboarding(false);

            let locationToFetch = null;
            let locationType = null;
            if (data.location && typeof data.location.latitude === 'number' && typeof data.location.longitude === 'number') {
                locationToFetch = data.location;
                locationType = 'coords';
            } else if (data.manualLocation && typeof data.manualLocation === 'string' && data.manualLocation.trim().length > 0) {
                locationToFetch = data.manualLocation.trim();
                locationType = 'string';
            }

            if (locationToFetch) {
                await fetchWeatherData(locationToFetch, locationType);
            } else {
                console.warn("No valid location found in user data.");
                setWeatherData(null);
                setWeatherLocationName('');
            }
            setLoading(false);
          }
        } catch (error) {
          console.error("Error loading user data/weather:", error);
          setUserData(null); setWeatherData(null); setWeatherLocationName('');
          setLoading(false);
        }
      } else {
        console.log("No user session found.");
        setUserData(null); setWeatherData(null); setWeatherLocationName('');
        setAiInsights([]); setErrorInsights(null); setTasks([]); setFarmAlerts([]);
        setLoading(false);
        // Optionally attempt anonymous sign-in here
        // signInUserAnonymously().catch(err => console.error("Anon sign-in failed:", err));
      }
    });
    return () => unsubscribe();
  }, [fetchWeatherData]);

  // --- Effect to Fetch AI Insights ---
   useEffect(() => {
       if (userData && weatherData) {
           fetchAIInsights(userData, weatherData);
       } else {
           setAiInsights([]); setLoadingInsights(false); setErrorInsights(null);
           setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
       }
   }, [userData, weatherData, fetchAIInsights]);

   // --- Effect to Generate Dynamic Alerts ---
    useEffect(() => {
        if (weatherData || aiInsights.length > 0) {
             generateDynamicAlerts(weatherData, aiInsights);
        } else {
            setFarmAlerts([]);
        }
    }, [weatherData, aiInsights, generateDynamicAlerts]);

  // --- Anonymous Sign-in Attempt ---
  useEffect(() => {
    const timer = setTimeout(() => {
        if (!user && !loading) {
             console.log("Attempting anonymous sign-in...");
             signInUserAnonymously().catch(error => console.error("Error signing in anonymously:", error));
        }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, loading]);

  // --- Splash Screen Logic ---
  useEffect(() => {
     if (!showSplash) return;
     const progressInterval = setInterval(() => setLoadingProgress(prev => Math.min(prev + 10, 100)), 200);
     const splashTimer = setTimeout(() => { if (loadingProgress >= 100) setShowSplash(false); }, 2500);
     const fallbackTimer = setTimeout(() => { if (!loading) setShowSplash(false); }, 5000);
     return () => {
         clearInterval(progressInterval);
         clearTimeout(splashTimer);
         clearTimeout(fallbackTimer);
     };
  }, [showSplash, loadingProgress, loading]);

  // --- Handle Onboarding Completion ---
  const handleOnboardingComplete = useCallback(async (newData) => {
    console.log("Onboarding complete:", newData);
    setLoading(true);
    try {
      if (newData.name) {
          await updateUserProfile(newData.name);
      }
      await saveUserData(newData);
      setUserData(newData);
      setShowOnboarding(false);

      let locationToFetch = null;
      let locationType = null;
      if (newData.location && typeof newData.location.latitude === 'number' && typeof newData.location.longitude === 'number') {
          locationToFetch = newData.location;
          locationType = 'coords';
      } else if (newData.manualLocation && typeof newData.manualLocation === 'string' && newData.manualLocation.trim().length > 0) {
          locationToFetch = newData.manualLocation.trim();
          locationType = 'string';
      }

      if (locationToFetch) {
          await fetchWeatherData(locationToFetch, locationType);
      } else {
          console.warn("No valid location from onboarding.");
          setWeatherData(null);
          setWeatherLocationName('');
      }
    } catch (error) {
      console.error("Error during onboarding completion:", error);
    } finally {
        setLoading(false);
    }
  }, [fetchWeatherData]);

  // --- Toggle Task Completion ---
  const toggleTaskComplete = (taskId) => {
      setTasks(currentTasks => currentTasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
      ));
      // TODO: Persist task completion status
  };

  // --- Reusable Featured Content Item Component ---
  const FeaturedContent = ({ title, iconName }) => (
     <div className="flex flex-col items-center p-3 text-center cursor-pointer hover:bg-green-50 rounded-lg transition-colors">
       <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 border-2 border-green-500">
         {getIconComponent(iconName, 28)}
       </div>
       <span className="text-xs text-green-800 font-medium">{title}</span>
     </div>
   );

  // --- Navigation Click Handler ---
  const handleNavClick = (tabName) => {
      setActiveTab(tabName);
      if (showSettings) {
          setShowSettings(false);
      }
  };

  // --- Toggle Settings Panel Visibility ---
  const toggleSettings = () => {
      setShowSettings(!showSettings);
  };


  // --- RENDER LOGIC ---

  // 1. Splash Screen
  if (showSplash) {
    return (
          <div className="splash-screen">
            <div className="logo-container">
              <div className="logo">
                <Leaf size={80} color="#2E7D32" />
              </div>
              <h1 className="logo-text">AgriVerse AI</h1>
              <p className="tagline">The Future of Smart Farming</p>
              <div className="loading-container">
                <div className="loading-bar">
                  <div className="loading-progress" style={{ width: `${loadingProgress}%` }}></div>
                </div>
                <p className="loading-text">{loadingProgress < 100 ? `${loadingProgress}% Loading...` : 'Initializing...'}</p>
              </div>
            </div>
          </div>
        );
  }

  // 2. Main Loading Indicator
  if (loading) {
     return (
          <div className="loading-screen">
            {getIconComponent('loader', 48)}
            <p>Loading your farm data...</p>
          </div>
        );
  }

  // 3. Onboarding Screen
  if (showOnboarding) {
    return <UserOnboarding onComplete={handleOnboardingComplete} />;
  }

  // 4. Main Application Content Rendering Function
  const renderContent = () => {
    switch(activeTab) {
      case 'virtualFarmTwin': return <div className="full-width-content"><VirtualFarmTwin /></div>;
      // --- MODIFIED LINE BELOW ---
      case 'CoPilot': return <div className="full-width-content"><CoPilot /></div>; // Render the CoPilot component (Corrected Casing)
      // --- END MODIFICATION ---
      case 'dashboard': return <div className="full-width-content"><h2 className="section-title">Analytics Dashboard (Coming Soon)</h2><p>Visualize farm performance.</p></div>;
      case 'finance': return <div className="full-width-content"><h2 className="section-title">Finance Tracker (Coming Soon)</h2><p>Manage farm expenses.</p></div>;

      case 'home':
      default:
        return (
          <div className="home-layout">
            {/* Main Content Area */}
            <div className="main-content-area">
              {/* Welcome Banner */}
              {userData && (
                <div className="welcome-banner">
                  <div className="welcome-info">
                     <h1>Welcome back, {userData.name || 'Farmer'}!</h1>
                     <p className="farm-details-banner">
                       {weatherLocationName && <span><MapPin size={14} className="inline-icon" /> {weatherLocationName} • </span>}
                       {userData.farmName && <span>Farm: <strong>{userData.farmName}</strong> • </span>}
                       {userData.farmArea && <span>Area: <strong>{userData.farmArea} {userData.areaUnit}</strong> • </span>}
                       {userData.soilTexture && <span>Soil: <strong>{userData.soilTexture}</strong> • </span>}
                       {userData.cropTypes?.length > 0 && <span>Crops: <strong>{userData.cropTypes.join(', ')}</strong></span>}
                     </p>
                  </div>
                   {/* Placeholder Farm Metrics */}
                   <div className="farm-metrics farm-metrics-static-reminder">
                        <div className="metric"><div className="metric-value">94%*</div><div className="metric-label">Soil</div></div>
                        <div className="metric"><div className="metric-value">87%*</div><div className="metric-label">Water</div></div>
                        <div className="metric"><div className="metric-value">76%*</div><div className="metric-label">Crops</div></div>
                        <p style={{fontSize: '0.7rem', width: '100%', textAlign: 'center', marginTop: '5px', opacity: 0.7, color:'white'}}>*Placeholder</p>
                   </div>
                </div>
              )}
              {/* Dashboard Row 1: Weather & Alerts */}
              <div className="dashboard-row">
                {/* Weather Widget */}
                <div className="dashboard-widget weather-widget">
                  <div className="widget-header">
                    <h2 className="widget-title">Weather Forecast</h2>
                    {weatherLocationName && <span className="widget-subtitle"><MapPin size={12} className="inline-icon" /> {weatherLocationName}</span>}
                  </div>
                  {weatherData ? (
                     <div className="weather-content">
                        <div className="current-weather">
                           <div className="weather-icon large-icon">{getIconComponent(weatherData.current.icon, 48)}</div>
                           <div className="weather-details">
                               <div className="weather-temp">{weatherData.current.temp}°C</div>
                               <div className="weather-condition">{weatherData.current.condition}</div>
                               <div className="weather-feels-like">Feels like {weatherData.current.feelslike_c}°C</div>
                           </div>
                           <div className="weather-stats">
                               <div className="stat"><Wind size={16} /> {weatherData.current.windSpeed} km/h</div>
                               <div className="stat"><Droplet size={16} /> {weatherData.current.humidity}% Hum.</div>
                               <div className="stat"><CloudRain size={16}/> {weatherData.current.precip_mm} mm Rain</div>
                               <div className="stat"><Sun size={16}/> UV {weatherData.current.uv}</div>
                           </div>
                        </div>
                        <div className="weather-forecast">
                            {weatherData.forecast.map((day, index) => (
                                <div className="forecast-day" key={index}>
                                    <div className="day-name">{day.day}</div>
                                    <div className="day-icon">{getIconComponent(day.icon, 20)}</div>
                                    <div className="day-temp"><span className="high">{day.high}°</span>/<span className="low">{day.low}°</span></div>
                                    <div className="day-precip"><Droplet size={12} /> {day.chance_of_rain}%</div>
                                </div>
                            ))}
                        </div>
                     </div>
                  ) : (
                     <div className="loading-placeholder">{getIconComponent('loader', 24)}<p>Loading weather...</p></div>
                  )}
                </div>
                {/* Farm Alerts Widget */}
                <div className="dashboard-widget alerts-widget">
                    <h2 className="widget-title">Farm Alerts</h2>
                    <div className="alerts-content scrollable">
                        {farmAlerts.length > 0 ? (
                            farmAlerts.map((alert) => (
                                <div className={`alert-item alert-${alert.type}`} key={alert.id}>
                                    <div className="alert-icon">{getIconComponent(alert.icon, 20)}</div>
                                    <p className="alert-message">{alert.message}</p>
                                </div>
                            ))
                        ) : (
                            <p className="no-alerts">No current alerts.</p>
                        )}
                    </div>
                </div>
              </div>
              {/* Dashboard Row 2: Tasks & Featured */}
              <div className="dashboard-row">
                 {/* Tasks Widget */}
                 <div className="dashboard-widget tasks-widget">
                     <div className="widget-header">
                         <h2 className="widget-title">Upcoming Tasks</h2>
                         <button className="add-task-btn" title="Add Custom Task" onClick={() => alert('Add Task TBD')}>+ Add Task</button>
                     </div>
                     <div className="tasks-content scrollable">
                        {tasks.filter(t => !t.completed).length > 0 ? (
                            <div className="task-list">
                                {tasks.filter(t => !t.completed).map((task) => (
                                   <div className="task-item" key={task.id}>
                                      <label className="task-checkbox">
                                         <input type="checkbox" checked={task.completed} onChange={() => toggleTaskComplete(task.id)} />
                                         <span className="checkmark"></span>
                                      </label>
                                      <div className="task-details">
                                         <div className={`task-title ${task.completed ? 'completed' : ''}`}>{task.title}</div>
                                         <div className="task-meta">
                                             <span className="task-due"><Clock size={14} /> {task.dueDate}</span>
                                             <span className={`task-priority priority-${task.priority}`}>{task.priority}</span>
                                         </div>
                                      </div>
                                   </div>
                                ))}
                            </div>
                         ) : (
                            <p className="no-tasks">No pending tasks.</p>
                         )}
                     </div>
                 </div>
                 {/* Featured Content Widget */}
                 <div className="dashboard-widget featured-widget">
                     <h2 className="widget-title">Tools & Resources</h2>
                     <div className="featured-content-grid">
                         <FeaturedContent title="Crop Calendar" iconName="calendar" />
                         <FeaturedContent title="Water Management" iconName="droplet" />
                         <FeaturedContent title="Soil Analysis" iconName="bar-chart-2" />
                         <FeaturedContent title="Pest & Disease" iconName="alert-triangle" />
                     </div>
                 </div>
              </div>
            </div>
            {/* Right Sidebar */}
            <div className="right-sidebar">
                <div className="right-container">
                    <div className="widget-header">
                        <h2 className="container-title">
                            <BrainCircuit size={20} className="inline-icon"/> AI Insights
                        </h2>
                        {loadingInsights && getIconComponent('loader', 18)}
                    </div>
                    <div className="sidebar-content scrollable">
                        {errorInsights && (
                           <div className="ai-insight error">
                               <div className="insight-icon">{getIconComponent('alert-triangle', 20)}</div>
                               <p>Insights Error: {errorInsights}</p>
                           </div>
                        )}
                        {!loadingInsights && !errorInsights && aiInsights.length > 0 && (
                           aiInsights.map((insight, index) => (
                               <div className="ai-insight" key={index}>
                                   <div className="insight-icon">{getIconComponent('leaf', 20)}</div>
                                   <p>{insight}</p>
                               </div>
                           ))
                        )}
                        {!loadingInsights && !errorInsights && aiInsights.length === 0 && (
                           !userData ? <p className="no-insights">Complete onboarding for insights.</p> :
                           !weatherData ? <p className="no-insights">Waiting for weather data...</p> :
                           <p className="no-insights">No insights available.</p>
                        )}
                    </div>
                </div>
            </div>
          </div>
        );
    }
  };

  // --- Main Application Structure ---
  return (
    <div className="app-container">
       {/* Navigation Sidebar */}
       <nav className="app-navigation">
            <div className="nav-brand">
                <Leaf size={24} color="#4CAF50" />
                <span className="brand-name">AgriVerse AI</span>
            </div>
            <div className="nav-items">
                {/* --- MODIFIED ARRAY BELOW --- */}
                {['home', 'virtualFarmTwin', 'CoPilot', 'dashboard', 'finance'].map(tab => {
                    // --- Determine Label and Icon based on corrected tab name ---
                    let label = tab.charAt(0).toUpperCase() + tab.slice(1);
                    let icon = 'credit-card'; // Default icon
                    if (tab === 'home') { icon = 'home'; }
                    else if (tab === 'virtualFarmTwin') { label = 'Farm Twin'; icon = 'map-pin'; }
                    else if (tab === 'CoPilot') { label = 'CoPilot'; icon = 'bot'; } // Corrected Label and Icon check
                    else if (tab === 'dashboard') { icon = 'bar-chart-2'; }
                    else if (tab === 'finance') { icon = 'credit-card'; }

                    return (
                        <div
                            key={tab} // Use corrected tab name as key
                            className={`nav-item ${activeTab === tab ? 'active' : ''}`} // Compare with corrected tab name
                            onClick={() => handleNavClick(tab)} // Pass corrected tab name
                            title={label} // Use generated label for tooltip
                        >
                            {getIconComponent(icon, 24)}
                            <span className="nav-label">{label}</span>
                        </div>
                    );
                })}
                 {/* --- END MODIFICATION --- */}
            </div>
            <div className="nav-bottom">
                <div className="nav-item" onClick={toggleSettings} title="Settings">
                    {getIconComponent('settings', 24)}
                    <span className="nav-label">Settings</span>
                </div>
                {user && (
                    <div className="user-profile" title="User Profile">
                        <div className="profile-pic">{getIconComponent('user', 24)}</div>
                        <div className="profile-info">
                            <span className="profile-name">{userData?.name || 'Farmer'}</span>
                            <span className="profile-role">{userData?.farmName || 'Farm Owner'}</span>
                        </div>
                    </div>
                )}
            </div>
       </nav>

       {/* Settings Panel */}
       {showSettings && (
          <div className="settings-panel">
              <div className="settings-header">
                  <h2>Settings</h2>
                  <button onClick={toggleSettings} className="close-settings-btn" title="Close Settings">&times;</button>
              </div>
              <ul className="settings-list">
                  <li>Profile</li>
                  <li>Farm Details</li>
                  <li>Notifications</li>
                  <li>Account</li>
                  <li>Help & Support</li>
                  <li>Logout</li> {/* TODO: Add logout functionality */}
              </ul>
          </div>
       )}

       {/* Main Content Area */}
       <main className={`main-content ${showSettings ? 'settings-open' : ''}`}>
         {renderContent()}
       </main>
    </div>
  );
};

export default App;

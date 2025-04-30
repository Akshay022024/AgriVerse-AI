// App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Cloud, Leaf, BarChart2, Droplet, CreditCard, Calendar, Users, Settings, Home, Search, User, Mic, Bot, MapPin, Clock, CloudRain, Wind, Thermometer, CheckCircle, AlertTriangle, Info, BrainCircuit, Loader2 } from 'lucide-react';
import './App.css';
import VirtualFarmTwin from './VirtualFarmTwin'; // Assuming this component exists
import UserOnboarding from './UserOnboarding'; // Assuming this component exists
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
      case 'bot': return <Bot {...props} />;
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
      // This is preferred for display as it's confirmed by the API
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
           icon: mapApiConditionToIcon(data.current.condition.text), // Map icon here
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
      return formattedData; // Return data for immediate use

    } catch (error) {
      console.error("Failed to fetch or process weather data:", error);
      setWeatherData(null); // Clear on error
      setWeatherLocationName(''); // Clear name on error
      return null; // Return null on error
    }
  }, []); // No dependencies needed here

  // --- Generate Dynamic Tasks from AI Insights ---
  const generateDynamicTasks = (insights) => {
      const generatedTasks = [];
      let taskIdCounter = 1; // Start counter, ensure unique IDs later if needed

      if (!insights || insights.length === 0) return [];

      insights.forEach(insight => {
          const lowerInsight = insight.toLowerCase();
          let taskTitle = null;
          let priority = 'medium';

          // Simple keyword matching for task generation
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
               // Basic check to avoid adding identical tasks immediately
              if (!generatedTasks.some(t => t.title === taskTitle)) {
                  generatedTasks.push({
                      id: `ai-${taskIdCounter++}`, // Simple unique ID for this generation batch
                      title: taskTitle,
                      dueDate: 'Soon', // Could be refined based on insight urgency
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
    // <<< IMPORTANT: Set your site URL or app name here for OpenRouter referrer policy >>>
    const siteUrl = 'YOUR_SITE_URL_OR_APP_NAME';

    if (!openRouterApiKey) {
        console.error("OpenRouter API Key not found. Set VITE_OPENROUTER_API_KEY in your .env file.");
        setErrorInsights("AI Service Unavailable (Missing Key)");
        setAiInsights([]);
        setTasks(prev => prev.filter(t => !t.id.startsWith('ai-'))); // Clear AI-generated tasks
        return;
    }
    if (!currentUserData || !currentWeatherData) return; // Need data

    setLoadingInsights(true); setErrorInsights(null); setAiInsights([]);

    // Use location name from weather API if available, otherwise fallback
    const farmLocation = weatherLocationName || currentUserData?.manualLocation?.trim() || 'Specified Location';
    const farmArea = currentUserData.farmArea && currentUserData.areaUnit ? `${currentUserData.farmArea} ${currentUserData.areaUnit}` : 'Not Specified';
    const soil = currentUserData.soilTexture || 'Not Specified';
    const crops = currentUserData.cropTypes?.join(', ') || 'Not Specified';

    // Construct the prompt for the AI model
    const prompt = `
Act as an expert agricultural advisor for a farmer. Based ONLY on the following farm details and weather information, provide 3-4 brief, actionable, and concise insights relevant for the next 3 days for the specified crops. Focus on potential issues, recommendations (like irrigation, planting timing, pest scouting needs based on weather), and weather impacts. Start each insight on a new line prefixed with '- '. Be direct and practical.

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
- Precipitation (Recent): ${currentWeatherData.current.precip_mm} mm
- UV Index: ${currentWeatherData.current.uv}

Forecast (Next 3 Days):
- ${currentWeatherData.forecast[0].day}: High ${currentWeatherData.forecast[0].high}°C, Low ${currentWeatherData.forecast[0].low}°C, ${currentWeatherData.forecast[0].condition}, ${currentWeatherData.forecast[0].chance_of_rain}% chance of rain (${currentWeatherData.forecast[0].precip_mm}mm expected).
- ${currentWeatherData.forecast[1].day}: High ${currentWeatherData.forecast[1].high}°C, Low ${currentWeatherData.forecast[1].low}°C, ${currentWeatherData.forecast[1].condition}, ${currentWeatherData.forecast[1].chance_of_rain}% chance of rain (${currentWeatherData.forecast[1].precip_mm}mm expected).
- ${currentWeatherData.forecast[2].day}: High ${currentWeatherData.forecast[2].high}°C, Low ${currentWeatherData.forecast[2].low}°C, ${currentWeatherData.forecast[2].condition}, ${currentWeatherData.forecast[2].chance_of_rain}% chance of rain (${currentWeatherData.forecast[2].precip_mm}mm expected).

Actionable Insights:
    `;

    try {
        // Make the API call to OpenRouter
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterApiKey}`,
                "HTTP-Referer": siteUrl, // Required by OpenRouter
                "X-Title": "AgriVerse AI", // Optional: Identify your app
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mistralai/mixtral-8x7b-instruct", // Specify the Mixtral model on OpenRouter
                messages: [{"role": "user", "content": prompt}],
                temperature: 0.7, // Adjust creativity/randomness
                max_tokens: 200, // Limit response length
            })
        });

        if (!response.ok) {
            // Handle API errors
            const errorBody = await response.json();
            throw new Error(`OpenRouter API Error: ${response.status} ${errorBody?.error?.message || 'Unknown'}`);
        }
        const data = await response.json();

        // Process the successful response
        if (data.choices?.[0]?.message?.content) {
            const insightsText = data.choices[0].message.content;
            // Parse insights (assuming they start with '- ')
            const parsedInsights = insightsText.split('\n')
                                               .map(line => line.trim())
                                               .filter(line => line.startsWith('- '))
                                               .map(line => line.substring(2).trim());

            if (parsedInsights.length > 0) {
                 setAiInsights(parsedInsights);
                 // Generate tasks based on the new insights
                 const newTasks = generateDynamicTasks(parsedInsights);
                 setTasks(prevTasks => [
                     // Keep existing tasks that were NOT generated by AI
                     ...prevTasks.filter(t => !t.id.startsWith('ai-')),
                     // Add the newly generated AI tasks
                     ...newTasks
                 ]);
            } else {
                // Handle cases where the AI response might be valid but doesn't contain insights
                setAiInsights(["No specific insights generated."]);
                 // Clear any previously generated AI tasks
                 setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
            }

        } else {
            // Handle cases where the response structure is unexpected
            setAiInsights(["AI could not generate insights."]);
            // Clear any previously generated AI tasks
            setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
        }
    } catch (error) {
        // Catch fetch errors or errors thrown from response handling
        console.error("Failed to fetch AI insights:", error);
        setErrorInsights(`AI Error: ${error.message}`);
        setAiInsights([]);
        // Clear any previously generated AI tasks
        setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
    } finally {
        // Ensure loading indicator is turned off
        setLoadingInsights(false);
    }
  }, [weatherLocationName]); // Re-run this function if weatherLocationName changes

  // --- Generate Dynamic Alerts based on Weather and AI Insights ---
  const generateDynamicAlerts = useCallback((currentWeatherData, currentAiInsights) => {
      const alerts = [];
      let alertIdCounter = 1; // Simple counter for unique keys within this generation

      // Weather-based Alerts
      if (currentWeatherData?.forecast) {
          currentWeatherData.forecast.forEach((dayForecast, index) => {
              // Alert for high chance of rain
              if (dayForecast.chance_of_rain > 60) {
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'info', message: `${dayForecast.day}: High chance of rain (${dayForecast.chance_of_rain}%). Check drainage & field access.`, icon: 'cloud-rain' });
              }
              // Alert for high temperature
              if (dayForecast.high > 35) { // Example threshold
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: High temperature forecast (${dayForecast.high}°C). Monitor crops for heat stress.`, icon: 'thermometer' });
              }
              // Alert for low temperature
              if (dayForecast.low < 10) { // Example threshold
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: Low temperature forecast (${dayForecast.low}°C). Consider frost protection if applicable.`, icon: 'thermometer' });
              }
          });
      }
       // Alert for current high wind
       if (currentWeatherData?.current?.windSpeed > 30) { // Example threshold
            alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `Current high wind speed (${currentWeatherData.current.windSpeed} km/h). Check for potential crop damage.`, icon: 'wind' });
       }


      // AI Insight-based Alerts
      if (currentAiInsights) {
          currentAiInsights.forEach(insight => {
              const lowerInsight = insight.toLowerCase();
              // Alert for pest/disease mentions
              if (lowerInsight.includes('pest') || lowerInsight.includes('disease')) {
                  alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'warning', message: `AI Alert: Potential pest/disease risk mentioned. Recommend scouting.`, icon: 'alert-triangle' });
              }
               // Alert for critical water stress mentions
               if (lowerInsight.includes('irrigation critical') || lowerInsight.includes('water stress')) {
                   alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'warning', message: `AI Alert: Water stress indicated. Prioritize irrigation checks.`, icon: 'droplet' });
               }
               // Add more keyword checks as needed
          });
      }

      // Add a generic success/status alert for feedback (optional)
      alerts.push({ id: `a-s-${alertIdCounter++}`, type: 'success', message: 'Data refreshed successfully.', icon: 'check-circle' });

      // --- Remove duplicate alerts before setting state ---
      // This prevents the same alert message (e.g., high rain chance) from appearing multiple times if conditions persist
      const uniqueAlerts = alerts.filter((alert, index, self) =>
           index === self.findIndex((a) => (
               a.message === alert.message && a.type === alert.type // Check for identical message and type
           ))
       );

      setFarmAlerts(uniqueAlerts);

  }, []); // Dependencies managed by the calling useEffect

  // --- Firebase Authentication and Initial Data Loading ---
  useEffect(() => {
    setLoading(true); // Show main loading indicator
    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      setUser(currentUser); // Update user state
      if (currentUser) {
        // User is signed in (or signed in anonymously)
        try {
          const data = await getUserData(); // Fetch user's data from Firestore
          setUserData(data); // Update user data state

          if (!data) {
            // No data found for this user, likely first time or onboarding needed
            console.log("No user data found, showing onboarding.");
            setShowOnboarding(true); // Show the onboarding component
            setLoading(false); // Hide main loading indicator
          } else {
            // User data found
            console.log("User data found:", data);
            setShowOnboarding(false); // Hide onboarding component

            // --- Determine Location for Weather Fetch (Prioritize GPS, then Manual) ---
            let locationToFetch = null;
            let locationType = null;

            // Priority 1: Valid GPS Coordinates from user data
            if (data.location && typeof data.location.latitude === 'number' && typeof data.location.longitude === 'number') {
                locationToFetch = data.location;
                locationType = 'coords';
                console.log("Using GPS coordinates from user data for weather.");
            // Priority 2: Valid Manual Location String from user data
            } else if (data.manualLocation && typeof data.manualLocation === 'string' && data.manualLocation.trim().length > 0) {
                locationToFetch = data.manualLocation.trim(); // Use the cleaned string
                locationType = 'string';
                console.log("Using manual location string from user data for weather.");
            }

            // --- Fetch Weather if a valid location was determined ---
            if (locationToFetch) {
                await fetchWeatherData(locationToFetch, locationType); // Fetch weather using determined location
            } else {
                // Handle case where no valid location is stored
                console.warn("No valid location (GPS or manual) found in user data. Weather not fetched initially.");
                setWeatherData(null);
                setWeatherLocationName('');
            }
            // --- End Weather Fetch Logic for Initial Load ---

            // Note: AI insights are triggered by a separate useEffect watching userData & weatherData
            // Note: Alerts are triggered by a separate useEffect watching weatherData & aiInsights
            setLoading(false); // Hide main loading indicator
          }
        } catch (error) {
          // Handle errors during data fetching
          console.error("Error loading user data or initial weather:", error);
          setUserData(null); setWeatherData(null); setWeatherLocationName(''); // Clear states on error
          setLoading(false); // Hide main loading indicator
        }
      } else {
        // No user is signed in
        console.log("No user session found.");
        // Clear all user-specific data
        setUserData(null);
        setWeatherData(null);
        setWeatherLocationName('');
        setAiInsights([]);
        setErrorInsights(null);
        setTasks([]);
        setFarmAlerts([]);
        setLoading(false); // Hide main loading indicator
        // Optionally trigger anonymous sign-in here if you want functionality for logged-out users
        // signInUserAnonymously().catch(err => console.error("Anon sign-in failed:", err));
      }
    });

    // Cleanup function: Unsubscribe from the auth listener when the component unmounts
    return () => unsubscribe();
  }, [fetchWeatherData]); // Include fetchWeatherData because it's used inside and defined with useCallback

  // --- Effect to Fetch AI Insights (runs when user data or weather data updates) ---
   useEffect(() => {
       if (userData && weatherData) {
           // Only fetch insights if we have both user data (for farm context) and weather data
           fetchAIInsights(userData, weatherData);
       } else {
           // Clear insights and related states if data becomes unavailable
           setAiInsights([]);
           setLoadingInsights(false);
           setErrorInsights(null);
           // Clear AI-generated tasks if data is missing
           setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-')));
       }
   }, [userData, weatherData, fetchAIInsights]); // Dependencies: re-run if these change

   // --- Effect to Generate Dynamic Alerts (runs when weather or insights change) ---
    useEffect(() => {
        // Generate alerts if we have weather data OR AI insights
        // This allows weather alerts even if AI insights fail, and vice-versa
        if (weatherData || aiInsights.length > 0) {
             generateDynamicAlerts(weatherData, aiInsights);
        } else {
            // Clear alerts if there's no data to generate them from
            setFarmAlerts([]);
        }
    }, [weatherData, aiInsights, generateDynamicAlerts]); // Dependencies: re-run if these change

  // --- Anonymous Sign-in Logic (attempts sign-in if no user after a delay) ---
  useEffect(() => {
    // Set a timer to check user status after initial loading attempts
    const timer = setTimeout(() => {
        // Check if user state is still null *after* the main loading state is false
        if (!user && !loading) {
             console.log("No user detected after initial load, attempting anonymous sign-in...");
             // Attempt anonymous sign-in (useful for providing basic functionality without login)
             signInUserAnonymously().catch(error => {
                 console.error("Error signing in anonymously:", error);
                 // Handle potential errors (e.g., network issue, Firebase config problem)
             });
        }
    }, 1500); // Delay slightly to allow initial auth state check to complete

    // Cleanup function: Clear the timer if the component unmounts or dependencies change
    return () => clearTimeout(timer);
  }, [user, loading]); // Dependencies: re-run if user or loading state changes

  // --- Splash Screen Logic ---
  useEffect(() => {
     if (!showSplash) return; // Don't run if splash screen is hidden
     // Simulate loading progress
     const progressInterval = setInterval(() => setLoadingProgress(prev => Math.min(prev + 10, 100)), 200);
     // Hide splash screen after progress reaches 100% and a minimum time
     const splashTimer = setTimeout(() => { if (loadingProgress >= 100) setShowSplash(false); }, 2500);
     // Fallback timer: hide splash screen if main loading finishes, even if progress animation isn't done
     const fallbackTimer = setTimeout(() => { if (!loading) setShowSplash(false); }, 5000);

     // Cleanup function: clear intervals and timers on unmount or when splash hides
     return () => {
         clearInterval(progressInterval);
         clearTimeout(splashTimer);
         clearTimeout(fallbackTimer);
     };
  }, [showSplash, loadingProgress, loading]); // Dependencies for splash screen logic

  // --- Handle Onboarding Completion ---
  const handleOnboardingComplete = useCallback(async (newData) => {
    console.log("Onboarding complete data received:", newData);
    setLoading(true); // Show loading indicator during save/fetch
    try {
      // Update Firebase Auth profile (optional, if name is collected)
      if (newData.name) {
          await updateUserProfile(newData.name);
      }
      // Save all collected onboarding data to Firestore
      await saveUserData(newData);
      // Update local state immediately for responsiveness
      setUserData(newData);
      // Hide the onboarding screen
      setShowOnboarding(false);

      // --- Determine Location for immediate Weather Fetch after Onboarding ---
      let locationToFetch = null;
      let locationType = null;
      // Priority 1: GPS Coordinates from onboarding data
      if (newData.location && typeof newData.location.latitude === 'number' && typeof newData.location.longitude === 'number') {
          locationToFetch = newData.location;
          locationType = 'coords';
          console.log("Using GPS coordinates from onboarding for weather.");
      // Priority 2: Manual Location String from onboarding data
      } else if (newData.manualLocation && typeof newData.manualLocation === 'string' && newData.manualLocation.trim().length > 0) {
          locationToFetch = newData.manualLocation.trim();
          locationType = 'string';
          console.log("Using manual location string from onboarding for weather.");
      }

      // Fetch weather immediately with the new location data
      if (locationToFetch) {
          await fetchWeatherData(locationToFetch, locationType);
      } else {
          // Handle case where no valid location was provided during onboarding
          console.warn("No valid location provided during onboarding, weather not fetched.");
          setWeatherData(null);
          setWeatherLocationName('');
      }
      // --- End Location Logic for Onboarding ---

      // Note: AI Insights and Alerts will be triggered by the useEffect hooks watching the updated userData and weatherData states.

    } catch (error) {
      console.error("Error during onboarding completion (saving data or fetching weather):", error);
      // Optionally show an error message to the user
    } finally {
        // Ensure loading indicator is hidden
        setLoading(false);
    }
  }, [fetchWeatherData]); // Include fetchWeatherData because it's used inside

  // --- Toggle Task Completion ---
  const toggleTaskComplete = (taskId) => {
      setTasks(currentTasks => currentTasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
      ));
      // Optional: Add logic here to persist task completion status (e.g., to Firestore)
  };

  // --- Reusable Featured Content Item Component ---
  const FeaturedContent = ({ title, iconName }) => (
     <div className="flex flex-col items-center p-3 text-center cursor-pointer hover:bg-green-50 rounded-lg transition-colors">
       {/* Icon Container */}
       <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 border-2 border-green-500">
         {getIconComponent(iconName, 28)} {/* Use helper to get icon */}
       </div>
       {/* Title */}
       <span className="text-xs text-green-800 font-medium">{title}</span>
     </div>
   );

  // --- Navigation Click Handler ---
  const handleNavClick = (tabName) => {
      setActiveTab(tabName); // Set the active tab
      // Close settings panel if it's open when navigating
      if (showSettings) {
          setShowSettings(false);
      }
  };

  // --- Toggle Settings Panel Visibility ---
  const toggleSettings = () => {
      setShowSettings(!showSettings);
  };


  // --- RENDER LOGIC ---

  // 1. Show Splash Screen
  if (showSplash) {
    return (
          <div className="splash-screen">
            <div className="logo-container">
              <div className="logo">
                <Leaf size={80} color="#2E7D32" /> {/* Main logo icon */}
              </div>
              <h1 className="logo-text">AgriVerse AI</h1>
              <p className="tagline">The Future of Smart Farming</p>
              {/* Loading progress bar */}
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

  // 2. Show Main Loading Indicator (while fetching initial data)
  if (loading) {
     return (
          <div className="loading-screen">
            {getIconComponent('loader', 48)} {/* Spinning loader icon */}
            <p>Loading your farm data...</p>
          </div>
        );
  }

  // 3. Show Onboarding Screen (if required)
  if (showOnboarding) {
    // Render the UserOnboarding component and pass the completion handler
    return <UserOnboarding onComplete={handleOnboardingComplete} />;
  }

  // 4. Main Application Content Rendering Function
  const renderContent = () => {
    switch(activeTab) {
      // Placeholder cases for other sections
      case 'virtualFarmTwin': return <div className="full-width-content"><VirtualFarmTwin /></div>; // Render dedicated component
      case 'copilot': return <div className="full-width-content"><h2 className="section-title">AI Copilot (Coming Soon)</h2><p>Chat with your AI farm assistant.</p></div>;
      case 'dashboard': return <div className="full-width-content"><h2 className="section-title">Analytics Dashboard (Coming Soon)</h2><p>Visualize your farm's performance.</p></div>;
      case 'finance': return <div className="full-width-content"><h2 className="section-title">Finance Tracker (Coming Soon)</h2><p>Manage farm expenses and income.</p></div>;

      // Default case: Render the Home tab content
      case 'home':
      default:
        return (
          <div className="home-layout"> {/* Main layout container for home */}
            {/* Left/Main Content Area */}
            <div className="main-content-area">

              {/* Welcome Banner - Shown if user data exists */}
              {userData && (
                <div className="welcome-banner">
                  {/* Welcome message and basic farm details */}
                  <div className="welcome-info">
                     <h1>Welcome back, {userData.name || 'Farmer'}!</h1>
                     <p className="farm-details-banner">
                       {/* Display location confirmed by WeatherAPI */}
                       {weatherLocationName && <span><MapPin size={14} className="inline-icon" /> {weatherLocationName} • </span>}
                       {/* Display other details from userData */}
                       {userData.farmName && <span>Farm: <strong>{userData.farmName}</strong> • </span>}
                       {userData.farmArea && <span>Area: <strong>{userData.farmArea} {userData.areaUnit}</strong> • </span>}
                       {userData.soilTexture && <span>Soil: <strong>{userData.soilTexture}</strong> • </span>}
                       {userData.cropTypes?.length > 0 && <span>Crops: <strong>{userData.cropTypes.join(', ')}</strong></span>}
                     </p>
                  </div>
                   {/* Reminder: Farm Metrics are currently static placeholders */}
                   {/* TODO: Integrate real sensor data or manual input for these metrics */}
                   <div className="farm-metrics farm-metrics-static-reminder">
                        <div className="metric"><div className="metric-value">94%*</div><div className="metric-label">Soil</div></div>
                        <div className="metric"><div className="metric-value">87%*</div><div className="metric-label">Water</div></div>
                        <div className="metric"><div className="metric-value">76%*</div><div className="metric-label">Crops</div></div>
                        <p style={{fontSize: '0.7rem', width: '100%', textAlign: 'center', marginTop: '5px', opacity: 0.7, color:'white'}}>*Placeholder data</p>
                   </div>
                </div>
              )}

              {/* Row containing Weather and Alerts widgets */}
              <div className="dashboard-row">
                {/* Weather Widget */}
                <div className="dashboard-widget weather-widget">
                  <div className="widget-header">
                    <h2 className="widget-title">Weather Forecast</h2>
                    {/* Display location confirmed by WeatherAPI */}
                    {weatherLocationName && <span className="widget-subtitle"><MapPin size={12} className="inline-icon" /> {weatherLocationName}</span>}
                     {/* Suggestion: Add a small chart showing temp/precip forecast trend here */}
                  </div>
                  {/* Conditional rendering: Show weather data or loading state */}
                  {weatherData ? (
                     <div className="weather-content">
                        {/* Current weather conditions */}
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
                        {/* 3-day forecast */}
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
                     // Loading placeholder for weather
                     <div className="loading-placeholder">{getIconComponent('loader', 24)}<p>Loading weather...</p></div>
                  )}
                </div>

                {/* Farm Alerts Widget - Displays dynamically generated alerts */}
                <div className="dashboard-widget alerts-widget">
                    <h2 className="widget-title">Farm Alerts</h2>
                    <div className="alerts-content scrollable">
                        {/* Check if there are alerts to display */}
                        {farmAlerts.length > 0 ? (
                            // Map through the alerts array
                            farmAlerts.map((alert) => (
                                <div className={`alert-item alert-${alert.type}`} key={alert.id}> {/* Use unique alert ID as key */}
                                    <div className="alert-icon">{getIconComponent(alert.icon, 20)}</div>
                                    <p className="alert-message">{alert.message}</p>
                                </div>
                            ))
                        ) : (
                            // Message shown when there are no alerts
                            <p className="no-alerts">No current alerts.</p>
                        )}
                    </div>
                </div>
              </div>

              {/* Row containing Tasks and Featured Content widgets */}
              <div className="dashboard-row">
                 {/* Tasks Widget - Displays dynamically generated tasks */}
                 <div className="dashboard-widget tasks-widget">
                     <div className="widget-header">
                         <h2 className="widget-title">Upcoming Tasks</h2>
                         {/* Button to add tasks manually (functionality needs implementation) */}
                         <button className="add-task-btn" title="Add Custom Task" onClick={() => alert('Task adding functionality needs implementation.')}>+ Add Task</button>
                     </div>
                     <div className="tasks-content scrollable">
                        {/* Filter out completed tasks before mapping */}
                        {tasks.filter(t => !t.completed).length > 0 ? (
                            <div className="task-list">
                                {tasks.filter(t => !t.completed).map((task) => (
                                   <div className="task-item" key={task.id}> {/* Use unique task ID as key */}
                                      {/* Checkbox for marking task complete */}
                                      <label className="task-checkbox">
                                         <input type="checkbox" checked={task.completed} onChange={() => toggleTaskComplete(task.id)} />
                                         <span className="checkmark"></span>
                                      </label>
                                      {/* Task details */}
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
                            // Message shown when there are no pending tasks
                            <p className="no-tasks">No pending tasks.</p>
                         )}
                     </div>
                     {/* Add Note: Full task adding requires state/form handling */}
                 </div>

                 {/* Featured Content Widget (Tools & Resources) */}
                 <div className="dashboard-widget featured-widget">
                     <h2 className="widget-title">Tools & Resources</h2>
                     {/* Grid container for featured items (CSS fixed previously) */}
                     <div className="featured-content-grid">
                         {/* Render reusable FeaturedContent components */}
                         <FeaturedContent title="Crop Calendar" iconName="calendar" />
                         <FeaturedContent title="Water Management" iconName="droplet" />
                         <FeaturedContent title="Soil Analysis" iconName="bar-chart-2" />
                         <FeaturedContent title="Pest & Disease" iconName="alert-triangle" />
                         {/* Suggestion: Add more relevant tools based on actual features */}
                         {/* Example: <FeaturedContent title="Market Prices" iconName="credit-card" /> */}
                     </div>
                 </div>
                 {/* Suggestion: Consider adding a News Feed widget here using a free RSS/News API */}
              </div>

            </div> {/* End main-content-area */}

            {/* Right Sidebar - AI Insights */}
            <div className="right-sidebar">
                <div className="right-container">
                    {/* Sidebar Header */}
                    <div className="widget-header">
                        <h2 className="container-title">
                            <BrainCircuit size={20} className="inline-icon"/> AI Insights
                        </h2>
                        {/* Show loading spinner while fetching insights */}
                        {loadingInsights && getIconComponent('loader', 18)}
                    </div>
                    {/* Scrollable content area for insights */}
                    <div className="sidebar-content scrollable">
                        {/* Show error message if insights fetching failed */}
                        {errorInsights && (
                           <div className="ai-insight error">
                               <div className="insight-icon">{getIconComponent('alert-triangle', 20)}</div>
                               <p>Insights Error: {errorInsights}</p>
                           </div>
                        )}
                        {/* Display insights if loaded successfully and no error */}
                        {!loadingInsights && !errorInsights && aiInsights.length > 0 && (
                           aiInsights.map((insight, index) => (
                               <div className="ai-insight" key={index}>
                                   <div className="insight-icon">{getIconComponent('leaf', 20)}</div>
                                   <p>{insight}</p>
                               </div>
                           ))
                        )}
                        {/* Show placeholder messages if no insights are available */}
                        {!loadingInsights && !errorInsights && aiInsights.length === 0 && (
                           !userData ? <p className="no-insights">Complete onboarding for insights.</p> :
                           !weatherData ? <p className="no-insights">Waiting for weather data...</p> :
                           <p className="no-insights">No specific insights available currently.</p>
                        )}
                    </div>
                </div>
            </div> {/* End right-sidebar */}

          </div> // End home-layout
        );
    }
  };

  // --- Main Application Structure (Navigation, Settings Panel, Main Content Area) ---
  return (
    <div className="app-container">
       {/* Left Sidebar Navigation */}
       <nav className="app-navigation">
            {/* Brand Logo and Name */}
            <div className="nav-brand">
                <Leaf size={24} color="#4CAF50" />
                <span className="brand-name">AgriVerse AI</span>
            </div>
            {/* Main Navigation Items */}
            <div className="nav-items">
                {/* Map through defined tabs */}
                {['home', 'virtualFarmTwin', 'copilot', 'dashboard', 'finance'].map(tab => (
                    <div
                        key={tab}
                        className={`nav-item ${activeTab === tab ? 'active' : ''}`} // Highlight active tab
                        onClick={() => handleNavClick(tab)} // Handle click event
                        title={tab.charAt(0).toUpperCase() + tab.slice(1).replace('virtualFarmTwin', 'Farm Twin')} // Tooltip text
                    >
                        {/* Get appropriate icon for the tab */}
                        {getIconComponent(
                            tab === 'virtualFarmTwin' ? 'map-pin' :
                            tab === 'home' ? 'home' :
                            tab === 'copilot' ? 'bot' :
                            tab === 'dashboard' ? 'bar-chart-2' :
                            'credit-card', // Default for finance
                            24
                        )}
                        {/* Text label for the tab */}
                        <span className="nav-label">
                            {tab === 'virtualFarmTwin' ? 'Farm Twin' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </span>
                    </div>
                ))}
            </div>
            {/* Bottom section of navigation (Settings, User Profile) */}
            <div className="nav-bottom">
                {/* Settings Button */}
                <div className="nav-item" onClick={toggleSettings} title="Settings">
                    {getIconComponent('settings', 24)}
                    <span className="nav-label">Settings</span>
                </div>
                {/* User Profile Display (shown only if user is logged in) */}
                {user && (
                    <div className="user-profile" title="User Profile">
                        <div className="profile-pic">{getIconComponent('user', 24)}</div>
                        <div className="profile-info">
                            <span className="profile-name">{userData?.name || 'Farmer'}</span> {/* Display user name or default */}
                            <span className="profile-role">{userData?.farmName || 'Farm Owner'}</span> {/* Display farm name or default */}
                        </div>
                    </div>
                )}
            </div>
       </nav>

       {/* Settings Panel (conditionally rendered) */}
       {showSettings && (
          <div className="settings-panel">
              <div className="settings-header">
                  <h2>Settings</h2>
                  <button onClick={toggleSettings} className="close-settings-btn" title="Close Settings">&times;</button>
              </div>
              {/* Placeholder settings list */}
              <ul className="settings-list">
                  <li>Profile</li>
                  <li>Farm Details</li>
                  <li>Notifications</li>
                  <li>Account</li>
                  <li>Help & Support</li>
                  <li>Logout</li> {/* Add logout functionality here */}
              </ul>
          </div>
       )}

       {/* Main Content Area */}
       <main className={`main-content ${showSettings ? 'settings-open' : ''}`}> {/* Adjust class if settings panel is open */}
         {renderContent()} {/* Render the content based on the active tab */}
       </main>
    </div>
  );
};

export default App; // Export the main App component
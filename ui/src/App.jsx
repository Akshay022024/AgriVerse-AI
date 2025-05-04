// App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Sun, Cloud, Leaf, BarChart2, Droplet, CreditCard, Calendar as CalendarIcon, Users, Settings, Home, User, Bot, MapPin, Clock, CloudRain, Wind, Thermometer, CheckCircle, AlertTriangle, Info, BrainCircuit, Loader2, Download, Star, TrendingUp, MessageSquare, Newspaper, Settings2, FlaskConical, X // Removed BookOpen (Learning Hub)
 } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Default styling
import './App.css'; // Ensure this is imported AFTER calendar CSS for overrides

// --- Component Imports ---
// Assuming these components exist in the specified paths
import VirtualFarmTwin from './VirtualFarmTwin';
import UserOnboarding from './UserOnboarding';
import CoPilot from './CoPilot';
import Analytics from './Analytics';
import Community from './Community'; // <-- Import Community component
import Finance from './Finance'; // <-- Import Finance component

// --- Firebase Imports ---
// Assuming firebase setup exists in './firebase'
import { signInUserAnonymously, onAuthStateChange, saveUserData, getUserData, updateUserProfile } from './firebase';

// --- CSS Imports ---
import './UserOnboarding.css'; // Ensure this CSS exists and is styled

// --- Utility Imports ---
// Dynamically import jsPDF only when needed
// import { jsPDF } from "jspdf"; // Keep commented out unless download is actively used

// --- Helper functions ---

/**
 * Maps weather condition text from API to a Lucide icon name.
 * @param {string} conditionText - The weather condition text (e.g., "Sunny", "Partly cloudy").
 * @returns {string} The corresponding Lucide icon name (e.g., 'sun', 'cloud').
 */
const mapApiConditionToIcon = (conditionText) => {
  if (!conditionText) return 'cloud'; // Default icon
  const text = conditionText.toLowerCase();
  if (text.includes('sunny') || text.includes('clear')) return 'sun';
  if (text.includes('rain') || text.includes('drizzle') || text.includes('shower')) return 'cloud-rain';
  if (text.includes('cloudy') || text.includes('overcast')) return 'cloud';
  if (text.includes('mist') || text.includes('fog')) return 'cloud';
  // Add more mappings as needed
  return 'cloud'; // Fallback icon
};

/**
 * Formats a date string for display in the forecast.
 * @param {string} dateStr - The date string (e.g., "2023-10-27").
 * @param {number} index - The index of the forecast day (0 for today, 1 for tomorrow).
 * @returns {string} Formatted date string ("Today", "Tomorrow", or short weekday).
 */
const formatDate = (dateStr, index) => {
    if (!dateStr) return '';
    try {
        if (index === 0) return 'Today';
        if (index === 1) return 'Tomorrow';
        const date = new Date(dateStr);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            console.warn("Invalid date string received:", dateStr);
            return dateStr; // Return original string if invalid
        }
        return date.toLocaleDateString('en-US', { weekday: 'short' }); // e.g., "Sat"
    } catch (e) {
        console.error("Error formatting date:", dateStr, e);
        return dateStr; // Return original string on error
    }
}

/**
 * Formats a Date object or date string into a "YYYY-MM-DD" key for state management.
 * @param {Date|string} date - The date to format.
 * @returns {string|null} The formatted date key or null if input is invalid.
 */
const formatDateKey = (date) => {
    if (!date) return null;
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
             console.warn("Invalid date object/string for formatDateKey:", date);
             return null;
        }
        const year = d.getFullYear();
        const month = (`0${d.getMonth() + 1}`).slice(-2); // "+ 1" because months are 0-indexed
        const day = (`0${d.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date key:", date, e);
        return null;
    }
}

/**
 * Returns the appropriate Lucide icon component based on its name.
 * @param {string} iconName - The name of the icon (e.g., 'sun', 'cloud').
 * @param {number} [size=24] - The size of the icon.
 * @param {string} [color] - The color of the icon.
 * @returns {React.ReactElement} The Lucide icon component.
 */
const getIconComponent = (iconName, size = 24, color) => {
    const props = { size, color, className: `lucide-icon icon-${iconName}` }; // Add base class
    switch(iconName) {
      // Weather & Farm Status Icons
      case 'droplet': return <Droplet {...props} />;
      case 'cloud': return <Cloud {...props} />;
      case 'sun': return <Sun {...props} />;
      case 'cloud-rain': return <CloudRain {...props} />;
      case 'leaf': return <Leaf {...props} />;
      case 'thermometer': return <Thermometer {...props} />;
      case 'wind': return <Wind {...props} />;
      case 'flask-conical': return <FlaskConical {...props} />; // Soil Analysis icon

      // Alert & Task Icons
      case 'check-circle': return <CheckCircle {...props} />;
      case 'alert-triangle': return <AlertTriangle {...props} />;
      case 'info': return <Info {...props} />;
      case 'clock': return <Clock {...props} />;
      case 'star': return <Star {...props} fill={color || 'currentColor'} />; // Allow filling star for completed tasks

      // AI & Data Icons
      case 'brain-circuit': return <BrainCircuit {...props} />;
      case 'bar-chart-2': return <BarChart2 {...props} />;
      case 'trending-up': return <TrendingUp {...props} />; // Market Prices (kept icon for potential future use)

      // UI & Navigation Icons
      case 'loader': return <Loader2 {...props} className="animate-spin" />; // Loading indicator
      case 'map-pin': return <MapPin {...props} />;
      case 'home': return <Home {...props} />;
      case 'bot': return <Bot {...props} />; // CoPilot
      case 'credit-card': return <CreditCard {...props} />; // Finance
      case 'settings': return <Settings {...props} />;
      case 'user': return <User {...props} />;
      case 'users': return <Users {...props} />; // Community icon
      case 'download': return <Download {...props} />;
      // REMOVED: case 'book-open': return <BookOpen {...props} />; // Learning Hub REMOVED
      case 'message-square': return <MessageSquare {...props} />; // Community Tips (kept icon for potential future use)
      case 'newspaper': return <Newspaper {...props} />; // Could be used for news/articles
      case 'settings-2': return <Settings2 {...props} />; // Tools icon
      case 'x': return <X {...props} />; // Close icon

      // Default fallback icon
      default:
        console.warn(`Icon "${iconName}" not found, using default 'cloud'.`);
        return <Cloud {...props} />;
    }
};

// --- Standalone Components (Removed MarketPricesWidget and CommunityTipsWidget) ---

// REMOVED TrackBasedContent Component (as it was primarily for Learning Hub)

/**
 * Reusable component for displaying a featured tool or resource.
 * @param {object} props - Component props.
 * @param {string} props.title - Title of the tool/resource.
 * @param {string} props.iconName - Name of the Lucide icon to display.
 * @param {string} props.description - Brief description of the tool.
 * @param {function} props.onSimulate - Function to call when the simulate button is clicked.
 * @param {boolean} props.loadingToolSimulation - Indicates if a simulation is currently loading.
 */
const FeaturedTool = ({ title, iconName, description, onSimulate, loadingToolSimulation }) => (
   <div className="featured-item tool-item"> {/* Removed card-style class */}
     {/* Icon */}
     <div className="featured-icon-wrapper">
       {getIconComponent(iconName, 28)}
     </div>
     {/* Tool Information */}
     <div className="tool-info">
          <span className="featured-title">{title}</span>
          <p className="tool-description">{description}</p>
          {/* Simulate Button */}
          <button
              className="plain-button simulate-button"
              onClick={() => onSimulate(title)} // Pass title to identify which tool to simulate
              disabled={loadingToolSimulation} // Disable button during simulation
          >
              {/* Show loader or text based on loading state */}
              {loadingToolSimulation ? <>{getIconComponent('loader', 14)} Simulating...</> : <>Simulate</>}
          </button>
     </div>
   </div>
 );


// --- Main App Component ---

const App = () => {
  // --- State Variables ---
  const [showSplash, setShowSplash] = useState(true); // Controls splash screen visibility
  const [loadingProgress, setLoadingProgress] = useState(0); // Splash screen loading progress
  const [activeTab, setActiveTab] = useState('home'); // Currently active navigation tab
  const [user, setUser] = useState(null); // Firebase authenticated user object
  const [userData, setUserData] = useState(null); // User profile data from Firestore
  const [showOnboarding, setShowOnboarding] = useState(false); // Controls onboarding visibility
  const [loading, setLoading] = useState(true); // General loading state for initial data fetch
  const [weatherData, setWeatherData] = useState(null); // Formatted weather data
  const [weatherLocationName, setWeatherLocationName] = useState(''); // Display name for weather location
  const [farmAlerts, setFarmAlerts] = useState([]); // Array of generated farm alerts
  const [tasks, setTasks] = useState([]); // Array of tasks (user-added + AI-generated)
  const [showSettings, setShowSettings] = useState(false); // Controls settings panel visibility
  const [aiInsights, setAiInsights] = useState([]); // Array of AI-generated insights
  const [loadingInsights, setLoadingInsights] = useState(false); // Loading state for AI insights fetch
  const [errorInsights, setErrorInsights] = useState(null); // Error state for AI insights fetch
  const [completedTaskDates, setCompletedTaskDates] = useState({}); // Object mapping "YYYY-MM-DD" to true if all tasks for that day are complete
  const [farmPlan, setFarmPlan] = useState(null); // AI-generated farm plan text
  const [loadingFarmPlan, setLoadingFarmPlan] = useState(false); // Loading state for farm plan generation
  const [errorFarmPlan, setErrorFarmPlan] = useState(null); // Error state for farm plan generation
  const [simulatedToolOutput, setSimulatedToolOutput] = useState(null); // State to hold the output of a simulated tool
  const [loadingToolSimulation, setLoadingToolSimulation] = useState(false); // Loading state for tool simulation
  const [errorToolSimulation, setErrorToolSimulation] = useState(null); // Error state for tool simulation

  const calendarRef = useRef(null); // Ref for the react-calendar component

  // --- Data Fetching and Processing Functions ---

  /**
   * Fetches weather data from WeatherAPI based on coordinates or location string.
   * Uses VITE_WEATHER_API_KEY from environment variables.
   * @param {object|string} locationInput - Either {latitude, longitude} or a location string "City,Region".
   * @param {'coords'|'string'} [inputType='coords'] - Specifies the type of locationInput.
   * @returns {Promise<object|null>} A promise that resolves with formatted weather data or null on error.
   */
  const fetchWeatherData = useCallback(async (locationInput, inputType = 'coords') => {
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY; // Ensure this is set in your .env file
    if (!apiKey) {
      console.error("Weather API Key missing (VITE_WEATHER_API_KEY). Please add it to your .env file.");
      setWeatherData(null);
      setWeatherLocationName('');
      return null;
    }

    let queryParam = '';
    // Construct query parameter based on input type
    if (inputType === 'coords' && locationInput && typeof locationInput.latitude === 'number' && typeof locationInput.longitude === 'number') {
        queryParam = `${locationInput.latitude},${locationInput.longitude}`;
    } else if (inputType === 'string' && typeof locationInput === 'string' && locationInput.trim().length > 0) {
        // Clean up the string input (remove extra spaces, ensure comma separation)
        const cleanedLocationString = locationInput.split(',').map(s => s.trim()).filter(s => s.length > 0).join(',');
        queryParam = encodeURIComponent(cleanedLocationString);
    } else {
        console.error("Invalid location input provided for weather fetch:", locationInput, inputType);
        setWeatherData(null);
        setWeatherLocationName('');
        return null;
    }

    const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${queryParam}&days=3`; // Fetch 3-day forecast

    // Reset weather state before fetching
    setWeatherData(null);
    setWeatherLocationName('');

    try {
      console.log(`Workspaceing weather from: ${apiUrl}`); // Log API call for debugging
      const response = await fetch(apiUrl);
      if (!response.ok) {
        // Attempt to read error message from API response
        const errorBody = await response.text();
        console.error(`WeatherAPI Error Response (${response.status}):`, errorBody);
        throw new Error(`WeatherAPI Error ${response.status}: ${errorBody || response.statusText}`);
      }
      const data = await response.json();

      // Determine display name for the location
      const locationName = data.location ? `${data.location.name}, ${data.location.region}` : (typeof locationInput === 'string' ? locationInput : 'Current Location');
      setWeatherLocationName(locationName);

      // Format the received data into a more usable structure
       const formattedData = {
         current: {
           temp: Math.round(data.current.temp_c),
           humidity: data.current.humidity,
           windSpeed: Math.round(data.current.wind_kph),
           condition: data.current.condition.text,
           precip_mm: data.current.precip_mm,
           icon: mapApiConditionToIcon(data.current.condition.text), // Map condition text to icon name
           feelslike_c: Math.round(data.current.feelslike_c),
           uv: data.current.uv,
         },
         forecast: data.forecast.forecastday.map((day, index) => ({
           day: formatDate(day.date, index), // Format date for display
           date: day.date, // Store the actual date string for keys/logic
           high: Math.round(day.day.maxtemp_c),
           low: Math.round(day.day.mintemp_c),
           condition: day.day.condition.text,
           icon: mapApiConditionToIcon(day.day.condition.text), // Map condition text to icon name
           precip_mm: day.day.totalprecip_mm,
           chance_of_rain: day.day.daily_chance_of_rain // Percentage chance of rain
         }))
       };
      setWeatherData(formattedData); // Update state with formatted data
      console.log("Weather data fetched and formatted successfully:", formattedData);
      return formattedData; // Return the data for potential chaining
    } catch (error) {
      console.error("Failed to fetch or process weather data:", error);
      setWeatherData(null); // Clear weather data on error
      setWeatherLocationName(''); // Clear location name on error
      return null;
    }
  }, []); // Empty dependency array means this function is created once

  /**
   * Generates potential task suggestions based on AI insights.
   * @param {string[]} insights - An array of insight strings from the AI.
   * @returns {object[]} An array of task objects { id, title, dueDate, priority, completed }.
   */
  const generateDynamicTasks = useCallback((insights) => {
     const generatedTasks = [];
      let taskIdCounter = 1; // Simple counter for unique AI task IDs within this generation
      if (!insights || insights.length === 0) return []; // Return empty if no insights

      // Keywords to look for in insights to trigger task creation
      const taskTriggers = {
          irrigation: ['irrigate', 'water need', 'humidity', 'moisture', 'dry', 'precipitation low'],
          scouting: ['pest', 'disease', 'scout', 'monitor crop health', 'infestation'],
          fertilization: ['fertilize', 'nutrient', 'soil test', 'deficiency'],
          planting: ['plant', 'sow', 'planting window', 'soil preparation'],
          harvest: ['harvest', 'yield', 'maturity'],
          monitoring: ['monitor', 'check soil', 'temperature stress', 'wind damage']
      };

      insights.forEach(insight => {
          const lowerInsight = insight.toLowerCase();
          let taskTitle = null;
          let priority = 'medium'; // Default priority
          let taskDate = new Date(); // Default due date (today)

          // Check for time references in the insight
          if (lowerInsight.includes('tomorrow') || lowerInsight.includes('next day')) {
              taskDate.setDate(taskDate.getDate() + 1);
          } else if (lowerInsight.includes('in 2 days') || lowerInsight.includes('day after tomorrow')) {
              taskDate.setDate(taskDate.getDate() + 2);
          }
          // Add more date parsing logic if needed (e.g., specific dates)

          // Determine task type and priority based on keywords
          if (taskTriggers.irrigation.some(keyword => lowerInsight.includes(keyword))) {
              taskTitle = 'Check/adjust irrigation system/schedule';
              priority = 'high'; // Water is often critical
          } else if (taskTriggers.scouting.some(keyword => lowerInsight.includes(keyword))) {
              taskTitle = 'Scout fields for pests or diseases';
              priority = 'high'; // Early detection is key
          } else if (taskTriggers.fertilization.some(keyword => lowerInsight.includes(keyword))) {
              taskTitle = 'Review fertilization plan/nutrient levels';
              priority = 'medium';
          } else if (taskTriggers.planting.some(keyword => lowerInsight.includes(keyword))) {
              taskTitle = 'Assess planting/sowing conditions';
              priority = 'medium';
          } else if (taskTriggers.harvest.some(keyword => lowerInsight.includes(keyword))) {
              taskTitle = 'Prepare for potential harvest activities';
              priority = 'low'; // Usually planned in advance
          } else if (taskTriggers.monitoring.some(keyword => lowerInsight.includes(keyword))) {
              // Create a more specific monitoring task title
              taskTitle = `Monitor: "${insight.substring(0, 30)}..."`; // Use first 30 chars of insight
              priority = 'low';
          }

          // If a task title was determined, create the task object
          if (taskTitle) {
              // Avoid adding duplicate tasks for the same day
              const taskDateKey = formatDateKey(taskDate);
              if (!generatedTasks.some(t => t.title === taskTitle && formatDateKey(t.dueDate) === taskDateKey)) {
                  generatedTasks.push({
                      id: `ai-${taskIdCounter++}`, // Prefix ID to indicate AI origin
                      title: taskTitle,
                      dueDate: taskDate,
                      priority: priority,
                      completed: false // New tasks are not completed
                  });
              }
          }
      });
      console.log("Generated dynamic tasks:", generatedTasks);
      return generatedTasks;
  }, []); // Empty dependency array as it only uses its input

  /**
   * Fetches actionable AI insights from OpenRouter API based on user and weather data.
   * Uses VITE_OPENROUTER_API_KEY from environment variables.
   * Updates aiInsights state and potentially triggers task generation.
   * @param {object} currentUserData - The user's profile data.
   * @param {object} currentWeatherData - The current weather data.
   * @returns {Promise<void>}
   */
  const fetchAIInsights = useCallback(async (currentUserData, currentWeatherData) => {
     const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY; // Ensure this is set
    const siteUrl = 'AgriVerse'; // Replace with your actual site URL if needed for referral
    const modelName = "mistralai/mixtral-8x7b-instruct"; // Or another suitable model

    // Pre-checks for API key and necessary data
    if (!openRouterApiKey) {
        console.error("OpenRouter API Key missing (VITE_OPENROUTER_API_KEY).");
        setErrorInsights("AI Service Unavailable (Missing Key)");
        setAiInsights([]);
        setTasks(prev => prev.filter(t => !t.id.startsWith('ai-'))); // Clear previous AI tasks
        return;
    }
    if (!currentUserData || !currentWeatherData) {
        setErrorInsights("Missing user or weather data for insights.");
        setAiInsights([]);
        setTasks(prev => prev.filter(t => !t.id.startsWith('ai-'))); // Clear previous AI tasks
        return;
    }

    // Set loading state and clear previous errors/insights
    setLoadingInsights(true);
    setErrorInsights(null);
    setAiInsights([]);

    // Prepare data for the prompt, handling potentially missing fields
    const farmLocation = weatherLocationName || currentUserData?.manualLocation?.trim() || 'Specified Location';
    const farmArea = currentUserData.farmArea && currentUserData.areaUnit ? `${currentUserData.farmArea} ${currentUserData.areaUnit}` : 'Not Specified';
    const soil = currentUserData.soilTexture || 'Not Specified';
    // Ensure cropTypes is an array for joining
    const cropTypesArray = currentUserData.cropTypes && typeof currentUserData.cropTypes === 'object' ? Object.values(currentUserData.cropTypes) : (Array.isArray(currentUserData.cropTypes) ? currentUserData.cropTypes : []);
    const crops = cropTypesArray.join(', ') || 'Not Specified';

    // Construct the prompt for the AI model
    const prompt = `
Act as an expert agricultural advisor. Based ONLY on the following farm details and weather forecast, provide 3-4 brief, actionable insights or warnings for the next 3 days relevant to the specified crops. Focus on potential issues arising from the forecast (e.g., heat stress, high rain, frost risk) and suggest specific actions (e.g., adjust irrigation, scout for specific pests/diseases favored by conditions, check drainage, protect sensitive crops). Start each distinct insight on a new line prefixed with '- '. Be direct, concise, and avoid generic advice.

Farm Details:
- Location: ${farmLocation}
- Size: ${farmArea}
- Soil Type: ${soil}
- Main Crops: ${crops}

Current Weather & 3-Day Forecast:
- Current: Temp ${currentWeatherData.current.temp}°C (Feels like ${currentWeatherData.current.feelslike_c}°C), ${currentWeatherData.current.condition}, Humidity ${currentWeatherData.current.humidity}%, Wind ${currentWeatherData.current.windSpeed} km/h, Precip ${currentWeatherData.current.precip_mm} mm, UV ${currentWeatherData.current.uv}.
- ${currentWeatherData.forecast[0].day} (${currentWeatherData.forecast[0].date}): High ${currentWeatherData.forecast[0].high}°C, Low ${currentWeatherData.forecast[0].low}°C, ${currentWeatherData.forecast[0].condition}, ${currentWeatherData.forecast[0].chance_of_rain}% rain (${currentWeatherData.forecast[0].precip_mm}mm).
- ${currentWeatherData.forecast[1].day} (${currentWeatherData.forecast[1].date}): High ${currentWeatherData.forecast[1].high}°C, Low ${currentWeatherData.forecast[1].low}°C, ${currentWeatherData.forecast[1].condition}, ${currentWeatherData.forecast[1].chance_of_rain}% rain (${currentWeatherData.forecast[1].precip_mm}mm).
- ${currentWeatherData.forecast[2].day} (${currentWeatherData.forecast[2].date}): High ${currentWeatherData.forecast[2].high}°C, Low ${currentWeatherData.forecast[2].low}°C, ${currentWeatherData.forecast[2].condition}, ${currentWeatherData.forecast[2].chance_of_rain}% rain (${currentWeatherData.forecast[2].precip_mm}mm).

Actionable Insights (3-4 max, prefix with '- '):
    `.trim(); // Trim whitespace

    console.log("AI Insights Prompt:", prompt); // Log the prompt for debugging

    try {
        // Make the API call to OpenRouter
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterApiKey}`,
                "HTTP-Referer": siteUrl, // Optional: Referer can sometimes help with API usage tracking
                "X-Title": "AgriVerse AI", // Optional: Title for OpenRouter logs
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{"role": "user", "content": prompt}],
                temperature: 0.7, // Adjust for creativity vs. predictability
                max_tokens: 200 // Limit response length
            })
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({})); // Try to parse JSON error, default to empty object
            console.error("OpenRouter API Error Response:", errorBody);
            throw new Error(`OpenRouter API Error: ${response.status} ${errorBody?.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // Process the response
        if (data.choices?.[0]?.message?.content) {
            const insightsText = data.choices[0].message.content;
            console.log("Raw AI Insights:", insightsText);
            // Parse the response, assuming insights are newline-separated and prefixed with '- '
            const parsedInsights = insightsText.split('\n')
                                          .map(line => line.trim())
                                          .filter(line => line.startsWith('- ')) // Keep only lines starting with '- '
                                          .map(line => line.substring(2).trim()); // Remove the prefix

            if (parsedInsights.length > 0) {
                 setAiInsights(parsedInsights);
                 // Generate tasks based on the new insights
                 const newTasks = generateDynamicTasks(parsedInsights);
                 // Update the tasks state, replacing old AI tasks with new ones
                 setTasks(prevTasks => {
                     // Filter out tasks that were previously generated by AI
                     const nonAiTasks = prevTasks.filter(t => !t.id.startsWith('ai-'));
                     // Avoid adding duplicate new tasks (simple check based on title and date)
                     const existingAiTaskTitlesDates = nonAiTasks.filter(t => t.id.startsWith('ai-')).map(t => `${t.title}_${formatDateKey(t.dueDate)}`);
                     const uniqueNewTasks = newTasks.filter(nt => !existingAiTaskTitlesDates.includes(`${nt.title}_${formatDateKey(nt.dueDate)}`));
                     return [...nonAiTasks, ...uniqueNewTasks];
                 });
            } else {
                // Handle cases where the AI response format was unexpected or empty
                console.warn("AI response received, but no valid insights found after parsing.");
                setAiInsights(["No specific insights generated."]);
                setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-'))); // Clear old AI tasks
            }
        } else {
            // Handle cases where the response structure is missing expected fields
            console.warn("AI response structure invalid:", data);
            setAiInsights(["AI could not generate insights."]);
            setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-'))); // Clear old AI tasks
        }
    } catch (error) {
        console.error("Failed to fetch AI insights:", error);
        setErrorInsights(`AI Error: ${error.message}`);
        setAiInsights([]); // Clear insights on error
        setTasks(prevTasks => prevTasks.filter(t => !t.id.startsWith('ai-'))); // Clear old AI tasks
    }
    finally {
        setLoadingInsights(false); // Ensure loading state is turned off
    }
  }, [weatherLocationName, generateDynamicTasks]); // Dependencies: Regenerate if location or task generator changes

  /**
   * Generates farm alerts based on weather data and AI insights.
   * Updates the farmAlerts state.
   * @param {object|null} currentWeatherData - The current weather data.
   * @param {string[]} currentAiInsights - Array of AI-generated insights.
   * @returns {void}
   */
  const generateDynamicAlerts = useCallback((currentWeatherData, currentAiInsights) => {
     const alerts = [];
     let alertIdCounter = 1; // Simple counter for unique alert IDs

      // --- Weather-Based Alerts ---
      if (currentWeatherData?.forecast) {
          currentWeatherData.forecast.forEach((dayForecast) => {
              const dateKey = formatDateKey(dayForecast.date); // Get YYYY-MM-DD key

              // Rain Alerts
              if (dayForecast.chance_of_rain > 70 && dayForecast.precip_mm > 5) { // High chance of significant rain
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: High rain chance (${dayForecast.chance_of_rain}%, ${dayForecast.precip_mm}mm). Check drainage, risk of waterlogging.`, icon: 'cloud-rain', priority: 'high', dateKey }); // Changed to high priority
              } else if (dayForecast.chance_of_rain > 50) {
                   alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'info', message: `${dayForecast.day}: Moderate rain chance (${dayForecast.chance_of_rain}%). Consider irrigation needs.`, icon: 'cloud-rain', priority: 'medium', dateKey }); // Changed to medium
              }

              // Temperature Alerts
              if (dayForecast.high > 38) { // Extreme heat
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'danger', message: `${dayForecast.day}: Extreme heat (${dayForecast.high}°C). High risk of heat stress for crops/livestock. Ensure adequate water.`, icon: 'thermometer', priority: 'high', dateKey });
              } else if (dayForecast.high > 35) { // High heat
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: High temperature (${dayForecast.high}°C). Monitor crops for wilting. Consider shading.`, icon: 'thermometer', priority: 'medium', dateKey });
              }
              if (dayForecast.low < 5) { // Frost risk (adjust threshold based on region/crops)
                  alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'danger', message: `${dayForecast.day}: Low temperature (${dayForecast.low}°C). High risk of frost damage to sensitive crops.`, icon: 'thermometer', priority: 'high', dateKey });
              } else if (dayForecast.low < 10) { // Cool temperatures
                   alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `${dayForecast.day}: Cool temperature (${dayForecast.low}°C). Consider protection for young plants.`, icon: 'thermometer', priority: 'medium', dateKey });
              }
              // Add alerts for strong winds if available in forecast data (WeatherAPI provides maxwind_kph)
              // Example: if (dayForecast.day.maxwind_kph > 40) { alerts.push({... priority: 'medium'}) }
          });
      }
       // Current High Wind Alert (if available)
       if (currentWeatherData?.current?.windSpeed > 40) {
           alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'danger', message: `Current High Wind (${currentWeatherData.current.windSpeed} km/h). Check structures and crops for damage.`, icon: 'wind', priority: 'high', dateKey: formatDateKey(new Date()) });
       } else if (currentWeatherData?.current?.windSpeed > 30) {
           alerts.push({ id: `a-w-${alertIdCounter++}`, type: 'warning', message: `Current Strong Winds (${currentWeatherData.current.windSpeed} km/h). Secure loose items.`, icon: 'wind', priority: 'medium', dateKey: formatDateKey(new Date()) });
       }

      // --- AI Insight-Based Alerts ---
      const todayKey = formatDateKey(new Date());
      if (currentAiInsights && currentAiInsights.length > 0) {
          currentAiInsights.forEach(insight => {
              const lowerInsight = insight.toLowerCase();
              // Prioritize critical warnings from AI
              if (lowerInsight.includes('pest') || lowerInsight.includes('disease') || lowerInsight.includes('infestation')) {
                  alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'danger', message: `AI Alert: Potential pest/disease risk indicated. Scouting critical. (${insight.substring(0, 40)}...)`, icon: 'alert-triangle', priority: 'high', dateKey: todayKey });
              } else if (lowerInsight.includes('irrigation critical') || lowerInsight.includes('water stress') || lowerInsight.includes('severe dry')) {
                  alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'danger', message: `AI Alert: Water stress indicated. Immediate irrigation check needed. (${insight.substring(0, 40)}...)`, icon: 'droplet', priority: 'high', dateKey: todayKey });
              } else if (lowerInsight.includes('irrigation') || lowerInsight.includes('water') || lowerInsight.includes('dry conditions')) {
                  // Add as warning if not already covered by critical alert
                  if (!alerts.some(a => a.priority === 'high' && a.icon === 'droplet')) {
                    alerts.push({ id: `a-ai-${alertIdCounter++}`, type: 'warning', message: `AI Alert: Monitor water levels closely due to conditions. (${insight.substring(0, 40)}...)`, icon: 'droplet', priority: 'medium', dateKey: todayKey });
                  }
              }
              // Add more AI alert triggers as needed
          });
      }

      // --- Success/Stable Alert ---
      // Add a "stable" message only if there are no high or medium priority alerts
      if (alerts.filter(a => a.priority === 'high' || a.priority === 'medium').length === 0) {
          alerts.push({ id: `a-s-${alertIdCounter++}`, type: 'success', message: 'Conditions look stable based on current data. Continue routine monitoring.', icon: 'check-circle', priority: 'low', dateKey: todayKey });
      }

      // --- Filtering and Sorting ---
      // Remove duplicate alerts (same message and date)
      const uniqueAlerts = alerts.filter((alert, index, self) =>
          index === self.findIndex((a) => (a.message === alert.message && a.dateKey === alert.dateKey))
      );

       // Sort alerts: High > Medium > Low priority, then by date (earliest first)
       uniqueAlerts.sort((a, b) => {
           const priorityOrder = { high: 1, medium: 2, low: 3, info: 4, success: 5 }; // Define priority levels
           if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
               return priorityOrder[a.priority] - priorityOrder[b.priority];
           }
           // If priorities are the same, sort by date
           if (a.dateKey && b.dateKey) {
               return new Date(a.dateKey) - new Date(b.dateKey);
           }
           return 0; // Keep original order if dates are missing or equal
       });

      console.log("Generated dynamic alerts:", uniqueAlerts);
      setFarmAlerts(uniqueAlerts); // Update the state
  }, []); // Empty dependency array, relies only on inputs

  /**
   * Fetches an AI-generated farm plan from OpenRouter based on user data.
   * Uses VITE_OPENROUTER_API_KEY. Updates farmPlan state.
   * @param {object} currentUserData - The user's profile data.
   * @returns {Promise<void>}
   */
  const fetchFarmPlan = useCallback(async (currentUserData) => {
      const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      const siteUrl = 'AgriVerse';
      const modelName = "mistralai/mixtral-8x7b-instruct";

      // Pre-checks
      if (!openRouterApiKey) {
          console.error("OpenRouter API Key missing (VITE_OPENROUTER_API_KEY).");
          setErrorFarmPlan("AI Service Unavailable (Missing Key)");
          setFarmPlan(null);
          return;
      }
      if (!currentUserData) {
          setErrorFarmPlan("User data needed to generate a plan.");
          setFarmPlan(null);
          return;
      }

      // Set loading state and clear previous plan/errors
      setLoadingFarmPlan(true);
      setErrorFarmPlan(null);
      setFarmPlan(null);

      // Prepare data for the prompt
      const farmLocation = weatherLocationName || currentUserData?.manualLocation?.trim() || 'Specified Location';
      const farmArea = currentUserData.farmArea && currentUserData.areaUnit ? `${currentUserData.farmArea} ${currentUserData.areaUnit}` : 'Not Specified';
      const soil = currentUserData.soilTexture || 'Not Specified';
      const cropTypesArray = currentUserData.cropTypes && typeof currentUserData.cropTypes === 'object' ? Object.values(currentUserData.cropTypes) : (Array.isArray(currentUserData.cropTypes) ? currentUserData.cropTypes : []);
      const crops = cropTypesArray.join(', ') || 'Not Specified';
      const waterSourcesArray = currentUserData.waterSources && typeof currentUserData.waterSources === 'object' ? Object.values(currentUserData.waterSources) : (Array.isArray(currentUserData.waterSources) ? currentUserData.waterSources : []);
      const water = waterSourcesArray.join(', ') || 'Not Specified';
      const trackingGoalsArray = currentUserData.trackingGoals && typeof currentUserData.trackingGoals === 'object' ? Object.values(currentUserData.trackingGoals) : (Array.isArray(currentUserData.trackingGoals) ? currentUserData.trackingGoals : []);
      const goals = trackingGoalsArray.join(', ') || 'Optimize Yield and Reduce Water Usage'; // Default goal if none specified

      // Construct the prompt
      const currentMonth = new Date().toLocaleString('default', { month: 'long'});
      const prompt = `
Act as an expert agricultural consultant for a farmer in ${farmLocation}, India. Generate a concise, actionable farm plan outline for the next 3 months (starting from ${currentMonth}) based ONLY on the provided details. Structure the plan clearly by month (Month 1: ${currentMonth}, Month 2: ..., Month 3: ...). For each month, list key activities related to:
- Soil Preparation (if applicable)
- Planting/Sowing (timing based on crops and typical season for the region)
- Irrigation Management (general strategy, considering water sources)
- Fertilization (general timing, e.g., basal, top dressing)
- Pest & Disease Management (preventative measures, scouting focus)
- Other Key Activities (e.g., weeding, specific crop needs, harvest prep)

Be practical and specific where possible, considering the location context (general climate/season). Focus on the main crops listed. Keep the output structured and easy to read. Output ONLY the plan.

Farm Details:
- Location: ${farmLocation}
- Size: ${farmArea}
- Soil Type: ${soil}
- Main Crops Planned/Grown: ${crops}
- Water Sources: ${water}
- Primary Goals: ${goals}

3-Month Actionable Farm Plan Outline:
      `.trim();

      console.log("Farm Plan Prompt:", prompt); // Log prompt for debugging

      try {
          // Make API call
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${openRouterApiKey}`,
                  "HTTP-Referer": siteUrl,
                  "X-Title": "AgriVerse Plan Generator",
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  model: modelName,
                  messages: [{"role": "user", "content": prompt}],
                  temperature: 0.6, // Slightly more deterministic for planning
                  max_tokens: 700 // Allow for a reasonably detailed plan
              })
          });

          if (!response.ok) {
              const errorBody = await response.json().catch(() => ({}));
              console.error("OpenRouter Farm Plan Error Response:", errorBody);
              throw new Error(`OpenRouter API Error: ${response.status} ${errorBody?.error?.message || response.statusText}`);
          }

          const data = await response.json();

          // Process response
          if (data.choices?.[0]?.message?.content) {
              const planText = data.choices[0].message.content.trim();
              console.log("Generated Farm Plan:", planText);
              setFarmPlan(planText); // Update state with the generated plan
          } else {
              console.warn("AI response structure invalid for farm plan:", data);
              setErrorFarmPlan("AI could not generate a farm plan.");
              setFarmPlan(null);
          }
      } catch (error) {
          console.error("Failed to fetch farm plan:", error);
          setErrorFarmPlan(`AI Error generating plan: ${error.message}`);
          setFarmPlan(null);
      }
      finally {
          setLoadingFarmPlan(false); // Turn off loading state
      }
  }, [weatherLocationName]); // Dependency: Regenerate if location name changes (as it's used in prompt)

  /**
   * Simulates the output of a specific farm analysis tool using OpenRouter AI.
   * Uses VITE_OPENROUTER_API_KEY. Updates simulatedToolOutput state.
   * @param {string} toolName - The name of the tool to simulate (e.g., 'Soil Analysis').
   * @returns {Promise<void>}
   */
  const fetchToolSimulation = useCallback(async (toolName) => {
    const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const siteUrl = 'AgriVerse';
    const modelName = "mistralai/mixtral-8x7b-instruct";

    // Pre-checks
    if (!openRouterApiKey || !userData) {
        console.error("Cannot simulate tool: Missing API Key or User Data.");
        setErrorToolSimulation("Cannot simulate tool (Missing API Key or User Data).");
        setSimulatedToolOutput(null);
        return;
    }

    // Set loading state and clear previous output/errors
    setLoadingToolSimulation(true);
    setErrorToolSimulation(null);
    setSimulatedToolOutput(null);

    // Prepare base prompt details
    let prompt = `Simulate the output of an agricultural analysis tool for a farm. Be concise and provide a plausible, simplified result based on the details. State clearly that this is a SIMULATION.\n\n`;
    prompt += `Tool to Simulate: "${toolName}"\n`;
    prompt += `Farm Location: ${weatherLocationName || userData.manualLocation || 'Not specified'}\n`;
    prompt += `Soil Type: ${userData.soilTexture || 'Not specified'}\n`;
    const cropTypesArray = userData.cropTypes && typeof userData.cropTypes === 'object' ? Object.values(userData.cropTypes) : (Array.isArray(userData.cropTypes) ? userData.cropTypes : []);
    const primaryCrop = cropTypesArray[0] || 'the primary crop';
    prompt += `Main Crops: ${cropTypesArray.join(', ') || 'Not specified'}\n`;

    // Add tool-specific instructions to the prompt
    switch(toolName) {
        case 'Soil Analysis':
            prompt += `\nInstructions: Provide a brief, simulated soil analysis report. Include simulated values for pH, Organic Matter (%), Nitrogen (N - Low/Medium/High), Phosphorus (P - Low/Medium/High), Potassium (K - Low/Medium/High). Add 1-2 simple, general recommendations based on these simulated values (e.g., "Consider liming if pH is low", "Supplement Nitrogen for leafy growth"). Format clearly.`;
            break;
        case 'Pest & Disease Forecaster':
            prompt += `\nWeather Context (if available): Current: ${weatherData ? JSON.stringify(weatherData.current) : 'not available'}, Forecast: ${weatherData ? JSON.stringify(weatherData.forecast.slice(0,3)) : 'not available'}\n`;
            prompt += `\nInstructions: Based on the farm details and weather context (if available), provide a brief, simulated forecast for the next 5-7 days. Mention 1-2 potential pest or disease risks common for ${primaryCrop} in the region that might be favored by the conditions (e.g., "Increased risk of Aphids due to warm weather", "Downy Mildew risk if humidity stays high"). Include one simple preventative suggestion (e.g., "Monitor undersides of leaves", "Ensure good air circulation").`;
            break;
        case 'Water Management Planner':
             prompt += `\nWeather Context (if available): Forecast: ${weatherData ? JSON.stringify(weatherData.forecast.slice(0,3)) : 'not available'}\n`;
             prompt += `\nInstructions: Provide a brief, simulated water management suggestion for ${primaryCrop} for the next 3 days. Consider the weather forecast (especially rain). Suggest either a specific irrigation action (e.g., "Irrigate lightly tomorrow morning"), a check (e.g., "Check soil moisture before irrigating"), or a conservation method (e.g., "Hold irrigation if significant rain occurs").`;
            break;
        case 'Crop Yield Estimator':
            prompt += `\nInstructions: Provide a very rough, simulated yield estimate for ${primaryCrop}. Give a plausible range (e.g., "10-12 quintals/acre", "2500-3000 kg/hectare") based on general knowledge of the crop and typical yields. Explicitly state this is a highly simplified simulation and actual yield depends on many factors.`;
            break;
        default:
            console.error("Unknown tool requested for simulation:", toolName);
            setErrorToolSimulation("Unknown tool for simulation.");
            setLoadingToolSimulation(false);
            return;
    }

     prompt += "\n\nSimulated Output:"; // Final marker for the AI

      console.log(`Tool Simulation Prompt (${toolName}):`, prompt); // Log prompt

      try {
          // Make API call
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${openRouterApiKey}`,
                  "HTTP-Referer": siteUrl,
                  "X-Title": "AgriVerse Tool Sim",
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  model: modelName,
                  messages: [{"role": "user", "content": prompt}],
                  temperature: 0.5, // More deterministic for tool output
                  max_tokens: 250 // Keep simulation concise
              })
          });

          if (!response.ok) {
              const errorBody = await response.json().catch(() => ({}));
              console.error(`OpenRouter Tool Sim Error Response (${toolName}):`, errorBody);
              throw new Error(`OpenRouter API Error: ${response.status} ${errorBody?.error?.message || response.statusText}`);
          }

          const data = await response.json();

          // Process response
          if (data.choices?.[0]?.message?.content) {
              const resultText = data.choices[0].message.content.trim();
              console.log(`Simulated Output for ${toolName}:`, resultText);
              setSimulatedToolOutput({ tool: toolName, result: resultText }); // Update state
          } else {
               console.warn(`AI response structure invalid for ${toolName} simulation:`, data);
              setErrorToolSimulation(`AI could not simulate ${toolName}.`);
              setSimulatedToolOutput(null);
          }
      } catch (error) {
          console.error(`Failed to fetch tool simulation for ${toolName}:`, error);
          setErrorToolSimulation(`AI Error simulating ${toolName}: ${error.message}`);
          setSimulatedToolOutput(null);
      }
      finally {
          setLoadingToolSimulation(false); // Turn off loading state
      }
  }, [userData, weatherData, weatherLocationName]); // Dependencies


  // --- Effects ---

  /**
   * Effect for Firebase authentication state changes.
   * Handles user sign-in (including anonymous), loads user data,
   * and triggers initial weather fetch upon successful login and data retrieval.
   */
  useEffect(() => {
    console.log("Auth effect running...");
    setLoading(true); // Start loading indicator

    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      console.log("Auth state changed. User:", currentUser ? currentUser.uid : 'None');
      setUser(currentUser); // Update user state

      if (currentUser) {
        // User is signed in
        try {
          console.log("Fetching user data for UID:", currentUser.uid);
          const data = await getUserData(); // Fetch associated user data from Firestore
          console.log("User data fetched:", data);

          if (data) {
               // Normalize array-like fields (convert Firestore objects to arrays if needed)
               // Removed 'learningGoals' and 'mainInterests' which were related to Learning Hub
               const arrayKeys = ['waterSources', 'cropTypes', 'trackingGoals', 'currentCrops'];
               arrayKeys.forEach(key => {
                   if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
                       console.log(`Normalizing ${key} from object to array`);
                       data[key] = Object.values(data[key]);
                   } else if (!data[key]) {
                       // Ensure these fields are at least empty arrays if missing
                       data[key] = [];
                   }
               });

               // Load completed task dates from Firestore
               if (data.completedTaskDates && typeof data.completedTaskDates === 'object') {
                   setCompletedTaskDates(data.completedTaskDates);
                   console.log("Loaded completed task dates:", data.completedTaskDates);
               } else {
                   setCompletedTaskDates({}); // Initialize if missing or invalid
               }
             }

          setUserData(data); // Update user data state

          // Check if onboarding is needed
          // IMPORTANT: Ensure UserOnboarding component does not interfere with map boundary drawing
          // This usually involves checking CSS (z-index, position) in UserOnboarding.css
          // The rendering logic here correctly prevents App content from rendering during onboarding.
          if (!data || !data.onboardingCompleted) {
            console.log("Onboarding required.");
            setShowOnboarding(true);
            setLoading(false); // Stop loading, show onboarding
          }
          else {
            // Onboarding completed, proceed to load weather etc.
            console.log("Onboarding complete. Loading weather...");
            setShowOnboarding(false);

            // Determine location for weather fetch (prioritize coordinates)
            let locationToFetch = null;
            let locationType = null;
            if (data.location?.latitude && data.location?.longitude) {
                locationToFetch = data.location;
                locationType = 'coords';
                console.log("Using coordinates for weather:", locationToFetch);
            } else if (data.manualLocation?.trim()) {
                locationToFetch = data.manualLocation.trim();
                locationType = 'string';
                console.log("Using manual location string for weather:", locationToFetch);
            }

            // Fetch weather data if location is available
            if (locationToFetch) {
                await fetchWeatherData(locationToFetch, locationType);
            } else {
                console.log("No location found in user data for weather fetch.");
                setWeatherData(null); // Ensure weather is null if no location
                setWeatherLocationName('');
            }
            setLoading(false); // Stop loading after data and weather attempt
          }
        } catch (error) {
          // Handle errors during data loading or initial weather fetch
          console.error("Error loading user data or initial weather:", error);
          setUserData(null); // Clear data on error
          setWeatherData(null);
          setWeatherLocationName('');
          setCompletedTaskDates({});
          setLoading(false); // Stop loading on error
          // Optionally show an error message to the user
        }
      } else {
        // User is signed out or not yet signed in
        console.log("No user signed in. Resetting app state.");
        // Reset all user-specific state
        setUserData(null);
        setWeatherData(null);
        setWeatherLocationName('');
        setCompletedTaskDates({});
        setAiInsights([]);
        setErrorInsights(null);
        setTasks([]);
        setFarmAlerts([]);
        setFarmPlan(null);
        setErrorFarmPlan(null);
        setSimulatedToolOutput(null);
        setErrorToolSimulation(null);
        setShowOnboarding(false); // Hide onboarding if user logs out
        setLoading(false); // Stop loading

        // Attempt anonymous sign-in after a short delay if still no user
        // This ensures we don't immediately try to sign in before Firebase initializes
        const anonSignInTimer = setTimeout(() => {
            // Double-check user status before attempting anonymous sign-in
            if (!user) { // Use the state variable 'user' which reflects the latest auth status
                 console.log("Attempting anonymous sign-in...");
                 signInUserAnonymously()
                    .then(() => console.log("Anonymous sign-in successful."))
                    .catch(err => console.error("Anonymous sign-in failed:", err));
            }
        }, 1500); // Delay anonymous sign-in attempt

        // Cleanup function for the timeout
        return () => clearTimeout(anonSignInTimer);
      }
    });

    // Cleanup subscription on component unmount
    return () => {
        console.log("Unsubscribing from auth state changes.");
        unsubscribe();
    };
  }, [fetchWeatherData]); // Dependency: fetchWeatherData (stable due to useCallback)

  /**
   * Effect to fetch AI insights whenever user data or weather data changes,
   * but only if onboarding is completed.
   */
   useEffect(() => {
       // Only fetch insights if we have the necessary data and onboarding is done
       if (userData && weatherData && userData.onboardingCompleted) {
           console.log("Dependencies met: Fetching AI insights...");
           fetchAIInsights(userData, weatherData);
       } else {
           // Log why insights are not being fetched
           if (!userData) console.log("Skipping AI insights fetch: User data not loaded.");
           if (!weatherData) console.log("Skipping AI insights fetch: Weather data not loaded.");
           if (userData && !userData.onboardingCompleted) console.log("Skipping AI insights fetch: Onboarding not complete.");
           // Optionally clear insights if dependencies are missing
           // setAiInsights([]);
           // setErrorInsights(null);
       }
   }, [userData, weatherData, fetchAIInsights]); // Dependencies: Run when these change

   /**
    * Effect to generate dynamic alerts whenever weather data or AI insights change.
    */
    useEffect(() => {
        // Generate alerts if either weather or insights are available
        if (weatherData || (aiInsights && aiInsights.length > 0)) {
            console.log("Dependencies met: Generating dynamic alerts...");
            generateDynamicAlerts(weatherData, aiInsights);
        } else {
            console.log("Skipping alert generation: No weather or AI insights available.");
            setFarmAlerts([]); // Clear alerts if no data
        }
    }, [weatherData, aiInsights, generateDynamicAlerts]); // Dependencies: Run when these change


  /**
   * Effect for managing the splash screen display and loading progress.
   */
  useEffect(() => {
      // Only run if the splash screen is currently shown
      if (!showSplash) return;

     console.log("Splash screen effect running.");
     // Simulate loading progress
     const progressInterval = setInterval(() => {
         setLoadingProgress(prev => {
             const nextProgress = prev + 10;
             // Stop interval if progress reaches 100%
             if (nextProgress >= 100) {
                 clearInterval(progressInterval);
                 return 100;
             }
             return nextProgress;
         });
     }, 200); // Increment progress every 200ms

     // Timer to hide splash screen after progress reaches 100% (with a small delay)
     const splashTimer = setTimeout(() => {
         // Check progress again in case interval was cleared early
         if (loadingProgress >= 100) {
            console.log("Hiding splash screen (progress complete).");
            setShowSplash(false);
         }
     }, 2500); // Hide after 2.5 seconds if progress is 100

     // Fallback timer: Hide splash screen after a max duration,
     // but only if the main loading is finished (to avoid hiding splash too early)
     const fallbackTimer = setTimeout(() => {
         if (!loading) { // Check if main data loading is complete
            console.log("Hiding splash screen (fallback timer).");
            setShowSplash(false);
         } else {
             console.log("Fallback timer expired, but still loading data. Splash remains.");
             // Optionally, set another shorter fallback or handle differently
         }
     }, 5000); // Hide after 5 seconds max, if not loading

     // Cleanup function to clear intervals and timers when the effect re-runs or component unmounts
     return () => {
         console.log("Cleaning up splash screen effect.");
         clearInterval(progressInterval);
         clearTimeout(splashTimer);
         clearTimeout(fallbackTimer);
     };
  }, [showSplash, loadingProgress, loading]); // Dependencies: Run when these change

  // --- Event Handlers ---

  /**
   * Handles the completion of the user onboarding process.
   * Saves the new user data, updates the state, and triggers weather fetch.
   * @param {object} newData - The data collected during onboarding.
   */
  const handleOnboardingComplete = useCallback(async (newData) => {
     console.log("Onboarding complete. Received data:", newData);
     setLoading(true); // Show loading indicator during save/fetch
    try {
      // Mark onboarding as completed and prepare data for saving
      const dataToSave = { ...newData, onboardingCompleted: true };

      // Update Firebase user profile display name if provided
      if (dataToSave.name) {
          console.log("Updating Firebase profile name:", dataToSave.name);
          await updateUserProfile(dataToSave.name);
      }

      // Save the complete user data to Firestore
      console.log("Saving onboarding data to Firestore:", dataToSave);
      await saveUserData(dataToSave);

      // Update local state immediately for responsiveness
      // Normalize array fields again just in case
      const localData = { ...dataToSave };
      // REMOVED 'learningGoals' and 'mainInterests'
      const arrayKeys = ['waterSources', 'cropTypes', 'trackingGoals', 'currentCrops'];
      arrayKeys.forEach(key => { if (localData[key] && typeof localData[key] === 'object' && !Array.isArray(localData[key])) { localData[key] = Object.values(localData[key]); } else if (!localData[key]) { localData[key] = []; } });
      setUserData(localData);
      setShowOnboarding(false); // Hide the onboarding component

      // Fetch weather data based on the newly provided location
      let locationToFetch = null;
      let locationType = null;
      if (localData.location?.latitude && localData.location?.longitude) {
          locationToFetch = localData.location;
          locationType = 'coords';
      } else if (localData.manualLocation?.trim()) {
          locationToFetch = localData.manualLocation.trim();
          locationType = 'string';
      }

      if (locationToFetch) {
          console.log("Fetching weather data after onboarding completion...");
          await fetchWeatherData(locationToFetch, locationType);
      } else {
          console.log("No location provided during onboarding for weather fetch.");
          setWeatherData(null);
          setWeatherLocationName('');
      }
    } catch (error) {
      console.error("Error during onboarding completion process:", error);
      // Optionally show an error message to the user
    }
    finally {
      setLoading(false); // Hide loading indicator
    }
  }, [fetchWeatherData]); // Dependency: fetchWeatherData

  /**
   * Toggles the completion status of a task.
   * Updates the local tasks state and persists the 'completedTaskDates' to Firestore
   * for calendar highlighting.
   * @param {string} taskId - The ID of the task to toggle.
   */
  const toggleTaskComplete = (taskId) => {
      let taskDateKey = null;
      let isCompleting = false; // Track if the task is being marked as complete or incomplete
      let allTasksForDateComplete = true; // Assume all tasks for the date will be complete

      // Update the local tasks state
      setTasks(currentTasks =>
          currentTasks.map(task => {
              if (task.id === taskId) {
                  taskDateKey = formatDateKey(task.dueDate); // Get the date key of the toggled task
                  isCompleting = !task.completed; // Determine the new completion state
                  console.log(`Toggling task "${task.title}" (ID: ${taskId}, Date: ${taskDateKey}) to ${isCompleting ? 'complete' : 'incomplete'}`);
                  return { ...task, completed: !task.completed }; // Return the updated task
              }
              return task; // Return other tasks unchanged
          })
      );

      // After state update, check if all tasks for the specific date are now complete
      // Note: This check runs *after* the state update is queued.
      // We need to check the *intended* state based on the toggle action.
      if (taskDateKey) {
           // Check all *other* tasks for the same date key using the *current* tasks state (before the update fully settles)
           const otherTasksOnDate = tasks.filter(t => t.id !== taskId && formatDateKey(t.dueDate) === taskDateKey);
           allTasksForDateComplete = otherTasksOnDate.every(t => t.completed);

           // If we are marking the current task as complete, and all *other* tasks are already complete,
           // then the day should be marked as complete.
           // If we are marking the current task as incomplete, the day cannot be complete.
           const shouldMarkDayAsComplete = isCompleting && allTasksForDateComplete;

          // Update the completedTaskDates state for calendar highlighting
          setCompletedTaskDates(prevDates => {
              const newDates = { ...prevDates };
              if (shouldMarkDayAsComplete) {
                  console.log(`Marking date ${taskDateKey} as complete.`);
                  newDates[taskDateKey] = true; // Mark date as complete
              } else {
                  // If the task is being marked incomplete, or if other tasks on the date are incomplete
                  if (newDates[taskDateKey]) {
                     console.log(`Marking date ${taskDateKey} as incomplete.`);
                     delete newDates[taskDateKey]; // Mark date as incomplete
                  }
              }

              // Persist the updated completedTaskDates to Firestore (only if user is logged in)
              // Use merge: true to only update this specific field
              if (user && userData) { // Ensure user and userData are loaded
                  console.log("Saving completed dates to Firestore:", newDates);
                  saveUserData({ completedTaskDates: newDates }, true) // true for merge
                      .then(() => console.log("Completed task dates saved successfully."))
                      .catch(err => console.error("Error saving completed task dates:", err));
              } else {
                  console.warn("User not fully loaded, cannot save completed task dates to Firestore yet.");
              }
              return newDates; // Return the updated state
          });
      }
  };

 // --- Calendar Helper Functions ---

 /**
  * Provides CSS class names for calendar tiles based on task completion and alerts.
  * @param {object} params - Parameters provided by react-calendar.
  * @param {Date} params.date - The date of the tile.
  * @param {string} params.view - The current calendar view ('month', 'year', etc.).
  * @returns {string|null} A string of CSS class names or null.
  */
 const tileClassName = ({ date, view }) => {
    // Only apply custom styling to month view days
    if (view !== 'month') return null;

    const dateKey = formatDateKey(date); // Get "YYYY-MM-DD"
    if (!dateKey) return null; // Skip if date is invalid

    const classes = [];

    // Class for days where all tasks are completed
    if (completedTaskDates[dateKey]) {
        classes.push('task-completed-day');
    }

    // Class based on the highest priority alert for the day
    const alertsForDay = farmAlerts.filter(alert => alert.dateKey === dateKey);
    if (alertsForDay.length > 0) {
        let highestPriority = 'low'; // Default lowest priority
        if (alertsForDay.some(a => a.priority === 'high')) highestPriority = 'high';
        else if (alertsForDay.some(a => a.priority === 'medium')) highestPriority = 'medium';
        // Add more priorities if needed (e.g., 'info', 'success')

        // Add class based on highest priority found
        if (highestPriority === 'high') classes.push('alert-day-danger');
        else if (highestPriority === 'medium') classes.push('alert-day-warning');
        else classes.push('alert-day-info'); // Use info for low priority alerts
    }

    return classes.length > 0 ? classes.join(' ') : null; // Join classes or return null
  };

  /**
   * Adds content (like a star icon) to calendar tiles for completed days.
   * @param {object} params - Parameters provided by react-calendar.
   * @param {Date} params.date - The date of the tile.
   * @param {string} params.view - The current calendar view.
   * @returns {React.ReactElement|null} JSX content or null.
   */
  const tileContent = ({ date, view }) => {
      // Only add content to month view days
      if (view !== 'month') return null;

      const dateKey = formatDateKey(date);
      if (!dateKey) return null;

      // If the date is marked as complete, add a star icon
      if (completedTaskDates[dateKey]) {
          // Wrapper div for potential styling/positioning
          return (
            <div className="star-icon-wrapper" title="All tasks completed">
                {/* Changed icon color to white as requested by calendar style */}
                {getIconComponent('star', 12, 'white')}
            </div>
          );
      }
      return null; // No extra content for other days
  };


  // --- Utility Functions ---

  /**
   * Downloads the generated farm plan as a PDF document using jsPDF.
   * Dynamically imports jsPDF to avoid increasing initial load size.
   */
    const downloadFarmPlanPDF = () => {
         if (!farmPlan) {
             console.warn("No farm plan available to download.");
             setErrorFarmPlan("Generate a farm plan first before downloading."); // Provide feedback
             return;
         }
         if (!userData) {
             console.warn("User data not loaded, cannot generate PDF filename properly.");
             // Optionally proceed with a default filename
         }

        // Dynamically import jsPDF
        import('jspdf').then(({ jsPDF }) => {
            console.log("jsPDF loaded successfully.");
            const doc = new jsPDF();

            // --- PDF Content ---
            const title = `Farm Plan for ${userData?.farmName || 'Your Farm'}`;
            const generatedDate = `Generated on: ${new Date().toLocaleDateString()}`;
            const marginLeft = 15; // Left margin
            const marginTop = 20; // Top margin
            const contentWidth = doc.internal.pageSize.getWidth() - marginLeft * 2; // Available width
            let currentY = marginTop; // Track current Y position

            // Title
            doc.setFontSize(18);
            doc.text(title, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
            currentY += 10;

            // Generated Date
            doc.setFontSize(10);
            doc.setTextColor(100); // Grey color for subtitle
            doc.text(generatedDate, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
            currentY += 15;

            // Farm Plan Content
            doc.setFontSize(12);
            doc.setTextColor(0); // Reset text color to black
            // Split the text into lines that fit the page width
            const splitText = doc.splitTextToSize(farmPlan, contentWidth);
            doc.text(splitText, marginLeft, currentY);
            // --- End PDF Content ---


            // --- PDF Saving ---
            // Generate filename
            const filename = `${userData?.farmName || 'Farm'}_Plan_${formatDateKey(new Date()) || 'YYYY-MM-DD'}.pdf`;
            console.log("Saving PDF as:", filename);
            doc.save(filename); // Trigger download

        }).catch(error => {
            // Handle errors during dynamic import or PDF generation
            console.error("Error loading or using jsPDF:", error);
            setErrorFarmPlan("Could not generate PDF. Error loading library.");
        });
    };

  // --- Navigation and UI Toggles ---

  /**
   * Handles clicks on the main navigation items.
   * Sets the active tab and closes the settings panel if open.
   * @param {string} tabName - The key of the tab that was clicked.
   */
  const handleNavClick = (tabName) => {
       console.log("Navigating to tab:", tabName);
       setActiveTab(tabName);
       // Close settings panel when navigating
       if (showSettings) {
           setShowSettings(false);
       }
       // Clear any simulation output when changing main tabs
       setSimulatedToolOutput(null);
       setErrorToolSimulation(null);
  };

  /**
   * Toggles the visibility of the settings panel.
   */
  const toggleSettings = () => {
       console.log("Toggling settings panel.");
       setShowSettings(!showSettings);
  };


  // --- RENDER LOGIC ---

  // 1. Splash Screen
  if (showSplash) {
        console.log("Rendering Splash Screen");
        return (
            <div className="splash-screen">
                <div className="logo-container">
                    <div className="logo">
                        <Leaf size={80} color="#2E7D32" /> {/* Or your actual logo */}
                    </div>
                    <h1 className="logo-text">AgriVerse AI</h1>
                    <p className="tagline">The Future of Smart Farming</p>
                    {/* Loading Bar */}
                    <div className="loading-container">
                        <div className="loading-bar">
                            <div className="loading-progress" style={{ width: `${loadingProgress}%` }}></div>
                        </div>
                        <p className="loading-text">
                            {loadingProgress < 100 ? `${loadingProgress}% Loading...` : 'Initializing...'}
                        </p>
                    </div>
                </div>
            </div>
        );
  }

  // 2. Initial Loading (after splash, before auth check completes or if auth takes time)
  // Show this only if splash is hidden BUT we are still in the initial loading phase without a user object yet.
  if (loading && !user && !showSplash) {
        console.log("Rendering Initial Loading Screen");
        return (
            <div className="loading-screen">
                {getIconComponent('loader', 48)}
                <p>Loading your farm data...</p>
            </div>
        );
  }

  // 3. Onboarding Screen
  // Show if onboarding is explicitly required OR if user is loaded but data indicates onboarding isn't complete.
  // ** Map Boundary Note **: The rendering logic here ensures the main app content (renderContent)
  // is NOT rendered while onboarding is active. Ensure UserOnboarding.css provides sufficient
  // styling (e.g., background, z-index) to visually cover any underlying elements and scope its own styles
  // to prevent interference with map drawing tools within UserOnboarding.
  if (showOnboarding || (user && !loading && (!userData || !userData.onboardingCompleted))) {
       console.log("Rendering User Onboarding");
       // Pass the completion handler to the Onboarding component
       return <UserOnboarding onComplete={handleOnboardingComplete} />;
  }


  /**
   * Renders the main content based on the active tab.
   * Ensures all views are wrapped consistently to maintain layout with the fixed sidebar.
   * @returns {React.ReactElement} The JSX for the currently active view.
   */
  const renderContent = () => {
    console.log("Rendering main content for tab:", activeTab);

    // Define a wrapper for consistent layout handling
    const ContentWrapper = ({ children }) => (
        <div className="content-wrapper"> {/* Use a consistent class for all content areas */}
            {children}
        </div>
    );


    switch(activeTab) {
      // --- Specialized Views ---
      case 'virtualFarmTwin':
        console.log("Rendering VirtualFarmTwin");
        return <ContentWrapper><VirtualFarmTwin /></ContentWrapper>;
      case 'CoPilot':
        console.log("Rendering CoPilot");
        return <ContentWrapper><CoPilot /></ContentWrapper>;
      case 'dashboard': // Analytics Dashboard
        console.log("Rendering Analytics Dashboard");
        return <ContentWrapper><Analytics /></ContentWrapper>;
      case 'community': // Community & Alerts
        console.log("Rendering Community & Alerts");
        return <ContentWrapper><Community /></ContentWrapper>;
      case 'finance': // Finance Tracker
        console.log("Rendering Finance Tracker");
        // Ensure Finance component is wrapped correctly
        return <ContentWrapper><Finance /></ContentWrapper>;

      // --- Default View: Home Dashboard ---
      case 'home':
      default:
        console.log("Rendering Home Dashboard");
        // Show loading indicator if user data hasn't loaded yet (edge case after onboarding check)
        if (!userData) {
             console.log("Rendering Loading User Profile (Home)");
             return (
                 <div className="loading-screen">
                     {getIconComponent('loader', 48)}
                     <p>Loading user profile...</p>
                 </div>
             );
        }

        // Prepare user data for display, ensuring arrays are handled correctly
        const displayUserData = { ...userData };
        // Removed 'learningGoals' and 'mainInterests'
         const arrayKeys = ['waterSources', 'cropTypes', 'trackingGoals', 'currentCrops'];
         arrayKeys.forEach(key => { if (displayUserData[key] && typeof displayUserData[key] === 'object' && !Array.isArray(displayUserData[key])) { displayUserData[key] = Object.values(displayUserData[key]); } else if (!displayUserData[key]) { displayUserData[key] = []; } });

        // Mock data for status indicators - replace with real data if available
        const farmStatus = { soilMoisture: 75, waterLevel: 60, cropHealth: 85 };

        // Use the ContentWrapper here as well for consistency
        return (
          <ContentWrapper>
              <div className="home-layout"> {/* Container for the home dashboard layout */}
                {/* --- Main Content Area for Home --- */}
                <div className="main-content-area"> {/* This class might be redundant if .content-wrapper handles padding */}

                  {/* Welcome Banner */}
                  <div className="welcome-banner">
                     <div className="welcome-info">
                         <h1>Welcome back, {displayUserData.name || 'Farmer'}!</h1>
                         {/* Display key farm details concisely */}
                         <p className="farm-details-banner">
                             {weatherLocationName && <span><MapPin size={14} className="inline-icon" /> {weatherLocationName}</span>}
                             {displayUserData.farmName && <span>Farm: <strong>{displayUserData.farmName}</strong></span>}
                             {displayUserData.farmArea && <span>Area: <strong>{displayUserData.farmArea} {displayUserData.areaUnit}</strong></span>}
                         </p>
                     </div>
                     {/* Simulated Farm Status Indicators */}
                     <div className="farm-status-indicators">
                         {/* Crop Health Indicator */}
                         <div className="status-indicator">
                             <span className="indicator-label"><Leaf size={14} className="inline-icon"/> Crops</span>
                             <div className="indicator-bar-container">
                                 <div className="indicator-bar" style={{ width: `${farmStatus.cropHealth}%`, backgroundColor: `hsl(${farmStatus.cropHealth * 1.2}, 70%, 50%)` }}></div>
                             </div>
                             <span className="indicator-value">{farmStatus.cropHealth}%</span>
                         </div>
                         {/* Soil Moisture Indicator */}
                         <div className="status-indicator">
                             <span className="indicator-label"><FlaskConical size={14} className="inline-icon"/> Soil</span>
                             <div className="indicator-bar-container">
                                 <div className="indicator-bar" style={{ width: `${farmStatus.soilMoisture}%`, backgroundColor: `hsl(195, ${farmStatus.soilMoisture}%, 40%)` }}></div>
                             </div>
                             <span className="indicator-value">{farmStatus.soilMoisture}% M</span>
                         </div>
                         {/* Water Level Indicator */}
                         <div className="status-indicator">
                             <span className="indicator-label"><Droplet size={14} className="inline-icon"/> Water</span>
                             <div className="indicator-bar-container">
                                 <div className="indicator-bar" style={{ width: `${farmStatus.waterLevel}%`, backgroundColor: `hsl(210, 80%, ${100 - farmStatus.waterLevel * 0.4}%)` }}></div>
                             </div>
                             <span className="indicator-value">{farmStatus.waterLevel}% Lvl</span>
                         </div>
                         <p className="status-indicator-note">*Simulated Status</p>
                     </div>
                  </div>

                   {/* Tools & Resources Section - MOVED HERE, BELOW WELCOME BANNER */}
                    <div className="dashboard-widget tools-resources-widget">
                         <h2 className="widget-title"><Settings2 size={18} className="inline-icon"/> Tools & Resources</h2>
                         {/* Thin Yellow Divider */}
                         <hr className="tools-divider" />
                         {/* Grid for featuring tools */}
                         <div className="featured-content-grid tools-grid">
                             <FeaturedTool title="Soil Analysis" iconName="flask-conical" description="Simulate basic soil nutrient and pH levels." onSimulate={fetchToolSimulation} loadingToolSimulation={loadingToolSimulation}/>
                             <FeaturedTool title="Pest & Disease Forecaster" iconName="alert-triangle" description="Simulate potential pest/disease risks based on data." onSimulate={fetchToolSimulation} loadingToolSimulation={loadingToolSimulation}/>
                             <FeaturedTool title="Water Management Planner" iconName="droplet" description="Simulate irrigation advice based on forecast." onSimulate={fetchToolSimulation} loadingToolSimulation={loadingToolSimulation}/>
                             <FeaturedTool title="Crop Yield Estimator" iconName="bar-chart-2" description="Simulate a rough yield estimate for your primary crop." onSimulate={fetchToolSimulation} loadingToolSimulation={loadingToolSimulation}/>
                         </div>
                         {/* Area to display simulation output or errors */}
                         {(loadingToolSimulation || errorToolSimulation || simulatedToolOutput) && (
                            <div className="tool-simulation-output">
                                {loadingToolSimulation && <div className="loading-placeholder">{getIconComponent('loader', 24)}<p>Running simulation...</p></div>}
                                {errorToolSimulation && <div className="error-message">{errorToolSimulation}</div>}
                                {simulatedToolOutput && !loadingToolSimulation && (
                                    <>
                                        <h4>Simulation Result: {simulatedToolOutput.tool}</h4>
                                        <pre>{simulatedToolOutput.result}</pre>
                                        {/* Button to clear the simulation output */}
                                        <button className="plain-button" onClick={() => setSimulatedToolOutput(null)}>Clear</button>
                                    </>
                                )}
                            </div>
                         )}
                     </div> {/* End Tools & Resources Section */}

                  {/* Dashboard Grid Layout (Contains remaining widgets) */}
                  <div className="dashboard-grid">
                    {/* --- Column 1 --- */}
                    <div className="dashboard-column col-1">
                        {/* Weather Widget */}
                        <div className="dashboard-widget weather-widget">
                            <div className="widget-header">
                                <h2 className="widget-title">Weather Forecast</h2>
                                {/* Display location if available */}
                                {weatherLocationName && <span className="widget-subtitle"><MapPin size={12} className="inline-icon" /> {weatherLocationName}</span>}
                            </div>
                            {/* Conditional rendering based on weather data availability */}
                            {weatherData ? (
                                <div className="weather-content">
                                    {/* Current Weather Section */}
                                    <div className="current-weather">
                                        <div className="weather-icon large-icon">{getIconComponent(weatherData.current.icon, 48)}</div>
                                        <div className="weather-details">
                                            <div className="weather-temp">{weatherData.current.temp}°C</div>
                                            <div className="weather-condition">{weatherData.current.condition}</div>
                                            <div className="weather-feels-like">Feels like {weatherData.current.feelslike_c}°C</div>
                                        </div>
                                        {/* Additional current stats */}
                                        <div className="weather-stats">
                                            <div className="stat"><Wind size={16} /> {weatherData.current.windSpeed} km/h</div>
                                            <div className="stat"><Droplet size={16} /> {weatherData.current.humidity}% Hum.</div>
                                            <div className="stat"><CloudRain size={16}/> {weatherData.current.precip_mm} mm Rain</div>
                                            <div className="stat"><Sun size={16}/> UV {weatherData.current.uv}</div>
                                        </div>
                                    </div>
                                    {/* Forecast Section */}
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
                                // Loading/Placeholder state
                                <div className="loading-placeholder">{getIconComponent('loader', 24)}<p>Loading weather...</p></div>
                            )}
                        </div> {/* End Weather Widget */}

                        {/* Farm Plan Widget (Conditional based on user track - if needed) */}
                        {/* You might want to keep this or remove it depending on overall design */}
                        {displayUserData.track === 'progress' && (
                           <div className="dashboard-widget farm-plan-widget">
                               <div className="widget-header">
                                   <h2 className="widget-title">Farm Plan Generator</h2>
                                   {/* Button to trigger farm plan generation */}
                                   <button
                                       className={`plain-button ${loadingFarmPlan ? 'loading' : ''}`}
                                       onClick={() => fetchFarmPlan(displayUserData)}
                                       disabled={loadingFarmPlan || !displayUserData}
                                       title="Generate a 3-month plan using AI"
                                   >
                                       {loadingFarmPlan ? <>{getIconComponent('loader', 16)} Generating...</> : <>Generate Plan</>}
                                   </button>
                               </div>
                               <div className="farm-plan-content scrollable">
                                   {/* Display error if generation failed */}
                                   {errorFarmPlan && <div className="error-message">{errorFarmPlan}</div>}
                                   {/* Display the plan if available */}
                                   {farmPlan ? (
                                       <>
                                           <pre className="farm-plan-text">{farmPlan}</pre>
                                           {/* Button to download the plan */}
                                           <button className="download-pdf-btn plain-button icon-button" onClick={downloadFarmPlanPDF} title="Download Plan as PDF">
                                               {getIconComponent('download', 16)} Download PDF
                                           </button>
                                       </>
                                   ) : (
                                       // Placeholder text if no plan and not loading
                                       !loadingFarmPlan && <p className="placeholder-text">Click "Generate Plan" for a 3-month AI-powered farm plan outline.</p>
                                   )}
                               </div>
                           </div>
                       )} {/* End Farm Plan Widget */}
                    </div> {/* End Column 1 */}

                    {/* --- Column 2 --- */}
                    <div className="dashboard-column col-2">
                         {/* Tasks Widget */}
                         <div className="dashboard-widget tasks-widget">
                             <div className="widget-header">
                                 <h2 className="widget-title">Tasks</h2>
                                 {/* Placeholder button for adding custom tasks */}
                                 <button className="plain-button" title="Add Custom Task" onClick={() => alert('Add Custom Task functionality TBD')}>+ Add Task</button>
                             </div>
                             <div className="tasks-content scrollable">
                                 {/* Display pending tasks */}
                                 {tasks.filter(t => !t.completed).length > 0 ? (
                                     <div className="task-list">
                                         {tasks
                                             .filter(t => !t.completed)
                                             // Sort pending tasks by due date (earliest first)
                                             .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                                             .map((task) => (
                                                 <div className="task-item" key={task.id}>
                                                     {/* Checkbox to toggle completion */}
                                                     <label className="task-checkbox">
                                                         <input type="checkbox" checked={task.completed} onChange={() => toggleTaskComplete(task.id)} />
                                                         <span className="checkmark"></span>
                                                     </label>
                                                     {/* Task details */}
                                                     <div className="task-details">
                                                         <div className={`task-title ${task.completed ? 'completed' : ''}`}>{task.title}</div>
                                                         <div className="task-meta">
                                                             <span className="task-due"><Clock size={14} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                                                             <span className={`task-priority priority-${task.priority}`}>{task.priority}</span>
                                                         </div>
                                                     </div>
                                                 </div>
                                             ))}
                                     </div>
                                 ) : (
                                     // Message when no pending tasks
                                     <p className="no-tasks">No pending tasks.</p>
                                 )}
                             </div>
                             {/* Section for completed tasks (collapsible) */}
                             {tasks.filter(t => t.completed).length > 0 && (
                                 <details className="completed-tasks-section">
                                     <summary>{tasks.filter(t => t.completed).length} Completed Tasks</summary>
                                     {/* List of completed tasks */}
                                     <div className="task-list scrollable" style={{maxHeight: '150px'}}> {/* Limit height */}
                                         {tasks
                                             .filter(t => t.completed)
                                             // Sort completed tasks by due date (latest first)
                                             .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
                                             .map((task) => (
                                                 <div className="task-item completed-item" key={task.id}>
                                                     {/* Icon indicating completion */}
                                                     <CheckCircle size={18} color="var(--calendar-completed-color)" style={{marginRight: '10px', flexShrink: 0}}/> {/* Use CSS Variable */}
                                                     <div className="task-details">
                                                         <div className={`task-title completed`}>{task.title}</div>
                                                         <div className="task-meta">
                                                             <span className="task-due"><Clock size={14} /> Completed: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</span>
                                                         </div>
                                                     </div>
                                                 </div>
                                             ))}
                                     </div>
                                 </details>
                             )}
                         </div> {/* End Tasks Widget */}

                         {/* Calendar Widget */}
                         <div className="dashboard-widget calendar-widget">
                             <h2 className="widget-title">Task Calendar</h2>
                             <div className="calendar-container">
                                 {/* React Calendar Component */}
                                 <Calendar
                                     ref={calendarRef}
                                     onChange={() => {}} // No action needed on date change for now
                                     value={new Date()} // Keep calendar centered around today
                                     tileClassName={tileClassName} // Apply custom classes to tiles
                                     tileContent={tileContent} // Add custom content (star icon)
                                     locale="en-US" // Set locale
                                     className="compact-calendar" // Apply custom styling class
                                 />
                                 {/* Legend for calendar markers */}
                                 <div className="calendar-legend">
                                     <span className="legend-item"><span className="legend-marker task-completed-day">{getIconComponent('star', 10, 'white')}</span> Completed</span>
                                     <span className="legend-item"><span className="legend-marker alert-day-danger"></span> High Alert</span>
                                     <span className="legend-item"><span className="legend-marker alert-day-warning"></span> Med Alert</span>
                                     <span className="legend-item"><span className="legend-marker alert-day-info"></span> Low Alert</span>
                                 </div>
                             </div>
                         </div> {/* End Calendar Widget */}

                    </div> {/* End Column 2 */}

                     {/* --- Column 3 --- */}
                    <div className="dashboard-column col-3">
                         {/* AI Insights Widget */}
                         <div className="dashboard-widget ai-insights-widget">
                            <div className="widget-header">
                                <h2 className="widget-title"> <BrainCircuit size={18} className="inline-icon"/> AI Insights </h2>
                                {/* Show loader while fetching insights */}
                                {loadingInsights && getIconComponent('loader', 18)}
                            </div>
                            <div className="widget-content scrollable">
                                {/* Display error if fetching failed */}
                                {errorInsights && (
                                    <div className="ai-insight error">
                                        <div className="insight-icon">{getIconComponent('alert-triangle', 20)}</div>
                                        <p>Insights Error: {errorInsights}</p>
                                    </div>
                                )}
                                {/* Display insights if loaded successfully */}
                                {!loadingInsights && !errorInsights && aiInsights.length > 0 && (
                                    aiInsights.map((insight, index) => (
                                        <div className="ai-insight" key={index}>
                                            <div className="insight-icon">{getIconComponent('leaf', 20)}</div>
                                            <p>{insight}</p>
                                        </div>
                                    ))
                                )}
                                {/* Placeholder messages if no insights */}
                                {!loadingInsights && !errorInsights && aiInsights.length === 0 && (
                                    !userData ? <p className="no-insights">Complete onboarding for insights.</p> :
                                    !weatherData ? <p className="no-insights">Waiting for weather data...</p> :
                                    <p className="no-insights">No specific insights available right now.</p>
                                )}
                            </div>
                        </div> {/* End AI Insights Widget */}

                         {/* REMOVED Learning Hub / Track Content Widget */}

                         {/* Farm Alerts Widget */}
                         <div className="dashboard-widget alerts-widget">
                             <h2 className="widget-title">Farm Alerts</h2>
                             <div className="alerts-content scrollable">
                                 {/* Display alerts if available */}
                                 {farmAlerts.length > 0 ? (
                                     farmAlerts.map((alert) => (
                                         <div className={`alert-item alert-${alert.type} priority-${alert.priority}`} key={alert.id}>
                                             <div className="alert-icon">{getIconComponent(alert.icon, 20)}</div>
                                             <p className="alert-message">{alert.message}</p>
                                         </div>
                                     ))
                                 ) : (
                                     // Placeholder message if no alerts
                                     weatherData ? <p className="no-alerts">No current alerts.</p> : <p className="no-alerts">Checking for alerts...</p>
                                 )}
                             </div>
                        </div> {/* End Alerts Widget */}
                    </div> {/* End Column 3 */}
                  </div> {/* End Dashboard Grid */}

                </div> {/* End Main Content Area (Home) */}
              </div> {/* End Home Layout */}
          </ContentWrapper> // End ContentWrapper for Home
        );
    }
  };

  // --- Main Application Structure (Sidebar + Content) ---
  return (
    <div className="app-container">
       {/* --- Navigation Sidebar (Fixed Position) --- */}
       {/* Ensure .app-navigation has 'position: fixed;' and appropriate width/height in App.css */}
       <nav className="app-navigation">
            {/* Brand Logo/Name */}
            <div className="nav-brand">
                <Leaf size={24} color="#4CAF50" /> {/* Logo Icon */}
                <span className="brand-name">AgriVerse AI</span>
            </div>
            {/* Navigation Items */}
            <div className="nav-items">
                {/* Define navigation tabs */}
                {['home', 'virtualFarmTwin', 'CoPilot', 'dashboard', 'community', 'finance'].map(tab => { // Ensured community and finance are included
                    let label = ''; // Display label for the tab
                    let icon = 'home'; // Default icon name

                    // Set label and icon based on the tab key
                    switch(tab) {
                        case 'home':
                            label = 'Home';
                            icon = 'home';
                            break;
                        case 'virtualFarmTwin':
                            label = 'Farm Twin';
                            icon = 'map-pin';
                            break;
                        case 'CoPilot':
                            label = 'CoPilot';
                            icon = 'bot';
                            break;
                        case 'dashboard': // Analytics Dashboard
                            label = 'Analytics';
                            icon = 'bar-chart-2';
                            break;
                        case 'community': // Community & Alerts tab
                            label = 'Community'; // Simplified Label
                            icon = 'users'; // Using Users icon
                            break;
                        case 'finance':
                            label = 'Finance';
                            icon = 'credit-card';
                            break;
                        default:
                            label = tab.charAt(0).toUpperCase() + tab.slice(1); // Default label capitalization
                    }

                    // Render the navigation item
                    return (
                        <div
                            key={tab}
                            className={`nav-item ${activeTab === tab ? 'active' : ''}`} // Highlight active tab
                            onClick={() => handleNavClick(tab)} // Set active tab on click
                            title={label} // Tooltip for the icon
                        >
                            {getIconComponent(icon, 24)} {/* Render the icon */}
                            <span className="nav-label">{label}</span> {/* Display label */}
                        </div>
                    );
                })}
            </div>
            {/* Bottom Navigation Items (Settings, User Profile) */}
            <div className="nav-bottom">
                {/* Settings Button */}
                <div className="nav-item" onClick={toggleSettings} title="Settings">
                    {getIconComponent('settings', 24)}
                    <span className="nav-label">Settings</span>
                </div>
                {/* User Profile Display (conditional) */}
                {user && userData && (
                    <div className="user-profile" title="User Profile">
                        <div className="profile-pic">{getIconComponent('user', 24)}</div> {/* Placeholder icon */}
                        <div className="profile-info">
                            <span className="profile-name">{userData.name || 'Farmer'}</span>
                            <span className="profile-role">{userData.farmName || 'Farm Owner'}</span>
                        </div>
                    </div>
                )}
            </div>
       </nav> {/* End Navigation Sidebar */}

       {/* --- Settings Panel (Conditional Rendering) --- */}
       {/* Ensure this has appropriate styling (position, z-index) in App.css */}
       {showSettings && (
          <div className="settings-panel">
                <div className="settings-header">
                    <h2>Settings</h2>
                    {/* Close button */}
                    <button onClick={toggleSettings} className="close-settings-btn icon-button" title="Close Settings">
                        {getIconComponent('x', 20)}
                    </button>
                </div>
                {/* Placeholder list of settings options */}
                <ul className="settings-list">
                    <li>Profile</li>
                    <li>Farm Details</li>
                    <li>Notifications</li>
                    <li>Account</li>
                    <li>Help & Support</li>
                    <li>Logout</li> {/* Add logout functionality here */}
                </ul>
          </div>
       )} {/* End Settings Panel */}

       {/* --- Main Content Area --- */}
       {/* Adjust padding-left in App.css to account for fixed sidebar width */}
       {/* The `main-content` class should handle the padding/margin needed for the fixed sidebar */}
       <main className={`main-content ${showSettings ? 'settings-open' : ''}`}>
         {renderContent()} {/* Render the content based on the active tab, now consistently wrapped */}
       </main> {/* End Main Content Area */}
    </div> // End App Container
  );
};

export default App;
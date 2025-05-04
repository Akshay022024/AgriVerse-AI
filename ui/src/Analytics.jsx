import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Calendar, Clock, Cloud, Sun, Droplets, Wind, Thermometer, AlertCircle } from 'lucide-react';
import './Analytics.css'; // Ensure this CSS file is correctly linked

const Analytics = () => {
  // State variables for user data, weather, loading, errors, etc.
  const [userData, setUserData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  // Removed cropRecommendations state as it wasn't used
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // Default tab
  const [forecastDays, setForecastDays] = useState(5); // Default weather forecast days
  const [aiInsights, setAiInsights] = useState(null);
  const [monthlyProgress, setMonthlyProgress] = useState([]); // Keep for Overview tab

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Effect hook to fetch initial data on component mount
  useEffect(() => {
    const getUserData = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          setError("User not authenticated");
          setLoading(false);
          return;
        }

        const db = getFirestore();
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const fetchedUserData = userDoc.data();
          setUserData(fetchedUserData);

          // Fetch weather data if location is available
          if (fetchedUserData.location &&
             (fetchedUserData.location.latitude && fetchedUserData.location.longitude)) {
            fetchWeatherData(fetchedUserData.location.latitude, fetchedUserData.location.longitude);
          } else {
             console.warn("User location not found, skipping weather fetch.");
             // Optionally set weatherData to null or an empty state
             setWeatherData(null);
          }

          // Generate mock monthly progress data (used in Overview)
          generateMonthlyProgressData();

          // Fetch AI insights based on user data
          fetchAiInsights(fetchedUserData);
        } else {
          setError("User data not found");
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load user data");
        setLoading(false);
      }
    };

    getUserData();
    // Dependency array is empty to run only on mount
    // If auth or other external factors could change, add them here.
  }, []); // Empty dependency array: runs only once on mount

   // Effect hook to refetch weather data when forecastDays or userData changes
   useEffect(() => {
    if (userData?.location?.latitude && userData?.location?.longitude) {
      fetchWeatherData(userData.location.latitude, userData.location.longitude);
    }
    // Dependency array includes forecastDays and relevant userData parts
  }, [forecastDays, userData?.location?.latitude, userData?.location?.longitude]);


  // --- Data Fetching and Processing Functions ---

  // Generate mock monthly progress data for the Overview chart
  const generateMonthlyProgressData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const progress = [];
    // Generate data for the past 6 months
    for (let i = 5; i >= 0; i--) {
      const month = new Date(currentDate);
      month.setMonth(currentDate.getMonth() - i);
      const monthName = months[month.getMonth()];
      // Mock data - replace with real data if available
      const completedTasks = Math.floor(Math.random() * 15) + 5;
      const learningHours = Math.floor(Math.random() * 10) + 2;

      progress.push({
        name: monthName,
        completedTasks,
        learningHours,
      });
    }
    setMonthlyProgress(progress);
  };

  // Fetch weather data from WeatherAPI
  const fetchWeatherData = async (lat, lon) => {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
     if (!apiKey) {
       console.error("Weather API Key (VITE_WEATHER_API_KEY) is missing.");
       setError("Weather service configuration error.");
       // Set weatherData to a specific state indicating missing key?
       setWeatherData({ error: "API Key Missing" });
       return;
     }

    try {
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=${forecastDays}&aqi=yes&alerts=yes`
      );

      if (!response.ok) {
         const errorData = await response.json(); // Try to get error details from API
         console.error("Weather API Error:", errorData);
         throw new Error(`Weather data fetch failed: ${response.statusText} - ${errorData?.error?.message || ''}`);
      }

      const data = await response.json();
      setWeatherData(data);
      // Clear previous weather-related errors if fetch is successful
      if (error === "Failed to load weather data") setError(null);
    } catch (err) {
      console.error("Error fetching weather data:", err);
      // Avoid overwriting other potential errors
      if (!error) setError("Failed to load weather data");
       // Set weatherData to indicate an error state for the UI
       setWeatherData({ error: "Failed to load" });
    }
  };

  // Fetch AI insights from OpenRouter API
  const fetchAiInsights = async (userData) => {
    if (!userData) return;

     // Check if API key is available
     const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
     if (!apiKey) {
       console.error("OpenRouter API Key (VITE_OPENROUTER_API_KEY) is missing.");
       // Provide fallback insights or an error message
       setAiInsights("AI insights service is currently unavailable due to configuration issues.");
       return;
     }

    try {
      // Construct prompt based on user data
      const cropTypes = userData.cropTypes ? Object.values(userData.cropTypes).join(", ") : "various crops";
      const area = userData.farmArea || "your";
      const areaUnit = userData.areaUnit || "acre";
      const soilType = userData.soilTexture || "local";
      const waterSources = userData.waterSources ? Object.values(userData.waterSources).join(", ") : "available";

      const prompt = `As an agricultural AI expert, provide 3-4 concise, actionable insights and recommendations for a ${area} ${areaUnit} farm growing ${cropTypes}. The soil type is ${soilType} and water sources include ${waterSources}. Focus on sustainable practices, potential challenges (like pests or water usage), and opportunities for improvement based *only* on this information. Format as bullet points. Be brief.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "mistralai/mixtral-8x7b-instruct", // Consider other models if needed
          messages: [
            { role: "system", content: "You are an agricultural AI assistant providing brief, actionable farm insights." },
            { role: "user", content: prompt }
          ],
          max_tokens: 250 // Reduced tokens for brevity
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("AI Insights API Error:", errorData);
        throw new Error(`AI insights fetch failed: ${response.statusText} - ${errorData?.error?.message || ''}`);
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
         setAiInsights(data.choices[0].message.content);
      } else {
         throw new Error("Invalid response structure from AI API");
      }

    } catch (err) {
      console.error("Error fetching AI insights:", err);
      // Provide more informative fallback insights
      setAiInsights(`
• AI insights could not be generated at this time.
• General Tip: Regularly monitor your crops for signs of pests or disease.
• General Tip: Ensure efficient water usage based on weather patterns and crop needs.
• General Tip: Consider soil testing to understand nutrient requirements.
      `);
    }
  };

  // Generate mock crop calendar data (replace with real data source)
  const getCropCalendarData = () => {
    if (!userData || !userData.cropTypes) return [];

    const cropTypes = Object.values(userData.cropTypes);
    const cropCalendar = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Simplified mock data - enhance with actual crop schedules
    if (cropTypes.includes('Cotton')) {
      cropCalendar.push({
        crop: 'Cotton',
        schedule: [
          { month: 'Apr', activity: 'Planting' }, { month: 'May', activity: 'Growth' },
          { month: 'Jun', activity: 'Growth' }, { month: 'Jul', activity: 'Growth' },
          { month: 'Aug', activity: 'Growth' }, { month: 'Sep', activity: 'Harvest' },
          { month: 'Oct', activity: 'Harvest' },
        ]
      });
    }
     if (cropTypes.includes('Wheat')) { // Example for another crop
      cropCalendar.push({
        crop: 'Wheat',
        schedule: [
           { month: 'Oct', activity: 'Planting' }, { month: 'Nov', activity: 'Planting' },
           { month: 'Dec', activity: 'Growth' }, { month: 'Jan', activity: 'Growth' },
           { month: 'Feb', activity: 'Growth' }, { month: 'Mar', activity: 'Growth' },
           { month: 'Apr', activity: 'Harvest' },
        ]
      });
    }
    // Add more crop types as needed

    return cropCalendar;
  };

  // Generate mock farm performance metrics (replace with real calculations)
  const getFarmMetrics = () => {
    if (!userData) return null;
    // Replace random values with calculations based on actual farm data if available
    return {
      waterEfficiency: Math.floor(Math.random() * 31) + 50, // 50-80%
      yieldPotential: Math.floor(Math.random() * 31) + 60, // 60-90%
      sustainabilityScore: Math.floor(Math.random() * 41) + 40, // 40-80%
      resourceUtilization: Math.floor(Math.random() * 31) + 55, // 55-85%
    };
  };

  // --- Render Logic ---

  // Loading State
  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Loading your farm analytics...</p>
      </div>
    );
  }

  // Error State (Handles general data loading errors)
  if (error && !userData) { // Show full error only if essential data (userData) failed
    return (
      <div className="analytics-error">
        <AlertCircle size={48} />
        <h2>Oops! Something went wrong</h2>
        <p>{error}</p>
        {/* Provide a way to retry fetching the essential data */}
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  // Data needed for rendering (calculated after loading/error checks)
  const farmMetrics = getFarmMetrics();
  const cropCalendar = getCropCalendarData();
  const currentYear = new Date().getFullYear(); // For crop calendar

  // Main Component Render
  return (
    <div className="analytics-container">
      {/* Header Section */}
      <div className="analytics-header">
        <h1>Farm Analytics Dashboard</h1>
        <p>Insights for {userData?.farmName || 'Your Farm'}</p>
      </div>

      {/* Tab Navigation */}
      <div className="analytics-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'weather' ? 'active' : ''}
          onClick={() => setActiveTab('weather')}
        >
          Weather & Climate
        </button>
        <button
          className={activeTab === 'crops' ? 'active' : ''}
          onClick={() => setActiveTab('crops')}
        >
          Crop Analysis
        </button>
        {/* Learning Progress Tab Removed */}
      </div>

      {/* --- Tab Content --- */}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="analytics-overview">
          {/* Row 1: Farm Summary & Performance */}
          <div className="analytics-row">
            {/* Farm Summary Card */}
            <div className="analytics-card">
              <h3>Farm Summary</h3>
              <div className="card-content">
                <p><strong>Farm Name:</strong> {userData?.farmName || 'N/A'}</p>
                <p><strong>Area:</strong> {userData?.farmArea || 'N/A'} {userData?.areaUnit || ''}</p>
                <p><strong>Main Crops:</strong> {userData?.cropTypes ? Object.values(userData.cropTypes).join(', ') : 'N/A'}</p>
                <p><strong>Soil Type:</strong> {userData?.soilTexture || 'N/A'}</p>
                <p><strong>Experience:</strong> {userData?.experienceLevel || 'N/A'}</p>
              </div>
            </div>

            {/* Farm Performance Card */}
            <div className="analytics-card">
              <h3>Farm Performance</h3>
              {farmMetrics ? (
                <div className="performance-metrics">
                  {/* Water Efficiency Metric */}
                  <div className="metric">
                    <div className="metric-label">Water Efficiency</div>
                    <div className="metric-bar">
                      <div className="metric-progress" style={{ width: `${farmMetrics.waterEfficiency}%` }}></div>
                    </div>
                    <div className="metric-value">{farmMetrics.waterEfficiency}%</div>
                  </div>
                  {/* Yield Potential Metric */}
                  <div className="metric">
                    <div className="metric-label">Yield Potential</div>
                    <div className="metric-bar">
                      <div className="metric-progress" style={{ width: `${farmMetrics.yieldPotential}%` }}></div>
                    </div>
                    <div className="metric-value">{farmMetrics.yieldPotential}%</div>
                  </div>
                  {/* Sustainability Metric */}
                  <div className="metric">
                    <div className="metric-label">Sustainability</div>
                    <div className="metric-bar">
                      <div className="metric-progress" style={{ width: `${farmMetrics.sustainabilityScore}%` }}></div>
                    </div>
                    <div className="metric-value">{farmMetrics.sustainabilityScore}%</div>
                  </div>
                   {/* Resource Utilization Metric */}
                   <div className="metric">
                    <div className="metric-label">Resource Utilization</div>
                    <div className="metric-bar">
                      <div className="metric-progress" style={{ width: `${farmMetrics.resourceUtilization}%` }}></div>
                    </div>
                    <div className="metric-value">{farmMetrics.resourceUtilization}%</div>
                  </div>
                </div>
              ) : (
                <p>Performance data not available.</p>
              )}
            </div>
          </div>

          {/* Row 2: Monthly Progress Chart */}
          <div className="analytics-row">
            <div className="analytics-card full-width">
              <h3>Monthly Activity</h3>
              <div className="chart-container" style={{ height: '300px' }}> {/* Ensure container has height */}
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyProgress} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="#0088FE" />
                    <YAxis yAxisId="right" orientation="right" stroke="#00C49F" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="completedTasks" name="Completed Tasks" fill="#0088FE" />
                    <Bar yAxisId="right" dataKey="learningHours" name="Learning Hours" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Water Sources & Learning Goals */}
          <div className="analytics-row">
            {/* Water Sources Card */}
            <div className="analytics-card">
              <h3>Water Sources</h3>
               <div className="chart-container" style={{ height: '250px' }}>
                {userData?.waterSources && Object.keys(userData.waterSources).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(userData.waterSources).map(([key, value]) => ({ name: value, value: 1 }))} // Equal weight for visualization
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {Object.entries(userData.waterSources).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [name]}/> {/* Show name on hover */}
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p>No water source data available.</p>
                )}
              </div>
            </div>

            {/* Learning Goals Card */}
            <div className="analytics-card">
              <h3>Learning Goals</h3>
              {userData?.learningGoals && Object.keys(userData.learningGoals).length > 0 ? (
                <div className="learning-goals">
                  {Object.values(userData.learningGoals).map((goal, index) => (
                    <div className="learning-goal" key={index}>
                      <div className="goal-icon" style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                        {/* Icon or number */}
                         {index + 1}
                      </div>
                      <div className="goal-text">{goal}</div>
                    </div>
                  ))}
                </div>
              ) : (
                 <p>No learning goals specified.</p>
              )}
            </div>
          </div>

          {/* Row 4: AI Insights */}
          <div className="analytics-row">
            <div className="analytics-card full-width">
              <h3>AI Insights</h3>
              <div className="ai-insights">
                {aiInsights ? (
                  // Render HTML content safely, replacing bullets
                  <div className="insights-content" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/•/g, '<span class="bullet">•</span>').replace(/\n/g, '<br />') }} />
                ) : (
                  <p>Loading AI insights...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weather & Climate Tab */}
      {activeTab === 'weather' && (
        <div className="analytics-weather">
          {/* Weather Forecast Card */}
          <div className="analytics-row">
            <div className="analytics-card full-width">
              <div className="weather-header">
                <h3>Weather Forecast</h3>
                {/* Forecast Day Selection Buttons */}
                <div className="forecast-days">
                  {[3, 5, 7].map(days => (
                     <button
                       key={days}
                       className={forecastDays === days ? 'active' : ''}
                       onClick={() => setForecastDays(days)} // Let useEffect handle refetch
                     >
                       {days} Days
                     </button>
                  ))}
                </div>
              </div>

              {/* Weather Data Display */}
              {weatherData && !weatherData.error ? (
                <div className="weather-forecast">
                  {/* Current Weather Section */}
                  <div className="current-weather">
                    <div className="weather-location">
                      <h4>{weatherData.location.name}, {weatherData.location.region}</h4>
                      <p>{new Date(weatherData.location.localtime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="weather-main">
                      <img
                        src={weatherData.current.condition.icon ? `https:${weatherData.current.condition.icon}` : ''} // Add https:
                        alt={weatherData.current.condition.text}
                        className="weather-icon"
                        onError={(e) => { e.target.style.display = 'none'; /* Hide if icon fails */ }}
                      />
                      <div className="weather-temp">
                        <h2>{weatherData.current.temp_c}°C</h2>
                        <p>{weatherData.current.condition.text}</p>
                      </div>
                    </div>
                    <div className="weather-details">
                      {/* Weather Detail Items */}
                      <div className="weather-detail"><Droplets size={18} /> <span>Humidity: {weatherData.current.humidity}%</span></div>
                      <div className="weather-detail"><Wind size={18} /> <span>Wind: {weatherData.current.wind_kph} km/h {weatherData.current.wind_dir}</span></div>
                      <div className="weather-detail"><Cloud size={18} /> <span>Cloud: {weatherData.current.cloud}%</span></div>
                      <div className="weather-detail"><Thermometer size={18} /> <span>Feels like: {weatherData.current.feelslike_c}°C</span></div>
                      <div className="weather-detail"><Sun size={18} /> <span>UV Index: {weatherData.current.uv}</span></div>
                      <div className="weather-detail"><Droplets size={18} /> <span>Precip: {weatherData.current.precip_mm} mm</span></div>
                    </div>
                  </div>

                  {/* Daily Forecast Section */}
                  <h4>{forecastDays}-Day Forecast</h4>
                  <div className="forecast-days-container">
                    {weatherData.forecast.forecastday.map((day, index) => (
                      <div className="forecast-day" key={index}>
                        <h5>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h5>
                        <img
                          src={day.day.condition.icon ? `https:${day.day.condition.icon}`: ''} // Add https:
                          alt={day.day.condition.text}
                          className="forecast-icon"
                           onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="forecast-temps">
                          <span className="max-temp">{day.day.maxtemp_c}°</span> / <span className="min-temp">{day.day.mintemp_c}°</span>
                        </div>
                        <p className="forecast-condition">{day.day.condition.text}</p>
                        <div className="forecast-details">
                          <div className="forecast-detail"><Droplets size={14} /><span>{day.day.avghumidity}%</span></div>
                          <div className="forecast-detail"><Wind size={14} /><span>{day.day.maxwind_kph} kph</span></div>
                          <div className="forecast-detail"><Sun size={14} /><span>UV: {day.day.uv}</span></div>
                        </div>
                         <p className="forecast-precip">Rain Chance: {day.day.daily_chance_of_rain}%</p>
                      </div>
                    ))}
                  </div>

                  {/* Agricultural Impact (Mock Data) */}
                  <div className="weather-agriculture-impact">
                    <h4>Potential Agricultural Impact (Illustrative)</h4>
                    <div className="impact-cards">
                      {/* Irrigation Need Card */}
                      <div className="impact-card">
                        <h5>Irrigation Need</h5>
                        <div className="impact-meter high"> {/* Adjust class based on logic */}
                          <div className="impact-level" style={{ width: '70%' }}></div> {/* Adjust width */}
                        </div>
                        <p>Consider supplemental irrigation if rain is insufficient.</p>
                      </div>
                      {/* Pest Risk Card */}
                      <div className="impact-card">
                        <h5>Pest Risk</h5>
                        <div className="impact-meter medium">
                          <div className="impact-level" style={{ width: '50%' }}></div>
                        </div>
                        <p>Monitor crops closely, conditions may favor certain pests.</p>
                      </div>
                       {/* Harvest Conditions Card */}
                      <div className="impact-card">
                        <h5>Field Work Conditions</h5>
                        <div className="impact-meter good">
                          <div className="impact-level" style={{ width: '85%' }}></div>
                        </div>
                        <p>Generally favorable conditions expected for field activities.</p>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                 // Display specific error or loading message for weather
                 <div className="weather-loading">
                   {weatherData?.error ? (
                      <p className="error-message">Could not load weather data. {weatherData.error === "API Key Missing" ? "Please check configuration." : "Please try again later."}</p>
                   ) : (
                      <>
                         <div className="spinner"></div>
                         <p>Loading weather forecast...</p>
                      </>
                   )}
                 </div>
              )}
            </div>
          </div>

          {/* Seasonal Climate Outlook Card (Mock Data) */}
          <div className="analytics-row">
            <div className="analytics-card full-width">
              <h3>Seasonal Climate Outlook (Illustrative)</h3>
              <div className="climate-outlook">
                {/* 30-Day Outlook */}
                <div className="outlook-period">
                  <h4>Next 30 Days (Example)</h4>
                  <div className="outlook-metrics">
                    {/* Temperature Outlook */}
                    <div className="outlook-metric">
                      <p>Temperature Likelihood</p>
                      <div className="outlook-bar">
                        <div className="outlook-indicator" style={{ left: '65%' }}></div> {/* Example: 65% towards Above Normal */}
                      </div>
                      <div className="outlook-range">
                        <span>Below Normal</span><span>Normal</span><span>Above Normal</span>
                      </div>
                    </div>
                    {/* Precipitation Outlook */}
                    <div className="outlook-metric">
                      <p>Precipitation Likelihood</p>
                      <div className="outlook-bar">
                        <div className="outlook-indicator" style={{ left: '35%' }}></div> {/* Example: 35% towards Below Normal */}
                      </div>
                       <div className="outlook-range">
                        <span>Below Normal</span><span>Normal</span><span>Above Normal</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 3-Month Outlook */}
                <div className="outlook-period">
                   <h4>Next 3 Months (Example)</h4>
                   <div className="outlook-metrics">
                      {/* Temperature Outlook */}
                      <div className="outlook-metric">
                         <p>Temperature Likelihood</p>
                         <div className="outlook-bar">
                            <div className="outlook-indicator" style={{ left: '75%' }}></div>
                         </div>
                          <div className="outlook-range">
                            <span>Below Normal</span><span>Normal</span><span>Above Normal</span>
                          </div>
                      </div>
                      {/* Precipitation Outlook */}
                      <div className="outlook-metric">
                         <p>Precipitation Likelihood</p>
                         <div className="outlook-bar">
                            <div className="outlook-indicator" style={{ left: '50%' }}></div>
                         </div>
                          <div className="outlook-range">
                            <span>Below Normal</span><span>Normal</span><span>Above Normal</span>
                          </div>
                      </div>
                   </div>
                </div>
              </div>
              {/* Climate Recommendations (Mock) */}
              <div className="climate-recommendations">
                <h4>Example Recommendations Based on Outlook</h4>
                <ul>
                  <li>Plan for potentially warmer and drier conditions in the near term.</li>
                  <li>Review water storage and conservation strategies.</li>
                  <li>Select crop varieties suited to anticipated longer-term trends if applicable.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Analysis Tab */}
      {activeTab === 'crops' && (
        <div className="analytics-crops">
          {/* Row 1: Crop Distribution & Health Index */}
          <div className="analytics-row">
            {/* Crop Distribution Card */}
            <div className="analytics-card">
              <h3>Crop Distribution</h3>
              <div className="chart-container" style={{ height: '250px' }}>
                {userData?.cropTypes && Object.keys(userData.cropTypes).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(userData.cropTypes).map(([key, value]) => ({ name: value, value: 1 }))} // Assuming equal area for now
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {Object.entries(userData.cropTypes).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [name]}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p>No crop data available.</p>
                )}
              </div>
            </div>

            {/* Crop Health Index Card (Mock Data) */}
            <div className="analytics-card">
              <h3>Crop Health Index (Example)</h3>
              <div className="crop-health">
                {/* Health Meter (SVG Circle) */}
                <div className="crop-health-meter">
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r="60" fill="none" stroke="#e6e6e6" strokeWidth="15" />
                    <circle
                      cx="75" cy="75" r="60" fill="none"
                      stroke="#4CAF50" // Green for good health
                      strokeWidth="15"
                      strokeDasharray="377" // Circumference (2 * pi * 60)
                      strokeDashoffset={377 * (1 - 0.75)} // Offset for 75% health (Example)
                      transform="rotate(-90 75 75)"
                      strokeLinecap="round"
                    />
                    <text x="75" y="85" textAnchor="middle" className="health-text">75%</text> {/* Example value */}
                  </svg>
                </div>
                {/* Health Factors (Mock Bars) */}
                <div className="crop-health-factors">
                  <div className="health-factor"><span className="factor-name">Nutrition</span><div className="factor-bar"><div className="factor-progress" style={{ width: '70%' }}></div></div></div>
                  <div className="health-factor"><span className="factor-name">Water</span><div className="factor-bar"><div className="factor-progress" style={{ width: '80%' }}></div></div></div>
                  <div className="health-factor"><span className="factor-name">Pest/Disease</span><div className="factor-bar"><div className="factor-progress" style={{ width: '65%' }}></div></div></div>
                  <div className="health-factor"><span className="factor-name">Environment</span><div className="factor-bar"><div className="factor-progress" style={{ width: '85%' }}></div></div></div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Crop Calendar */}
          <div className="analytics-row">
            <div className="analytics-card full-width">
              <h3>Crop Calendar ({currentYear})</h3>
              {cropCalendar.length > 0 ? (
                <div className="crop-calendar">
                  {cropCalendar.map((crop, cropIndex) => (
                    <div className="crop-timeline" key={cropIndex}>
                      <h4>{crop.crop}</h4>
                      <div className="timeline">
                        {/* Map through months */}
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, monthIndex) => {
                          const activity = crop.schedule.find(s => s.month === month);
                          // Determine background color based on activity
                          let activityColor = 'transparent';
                          if (activity) {
                             switch (activity.activity) {
                                case 'Planting': activityColor = '#a5d6a7'; break; // Light Green
                                case 'Growth': activityColor = '#66bb6a'; break; // Medium Green
                                case 'Harvest': activityColor = '#ffee58'; break; // Yellow
                                default: activityColor = '#e0e0e0'; // Grey
                             }
                          }
                          return (
                            <div
                              className={`timeline-month ${activity ? 'active' : ''}`}
                              key={monthIndex}
                              title={activity ? `${month}: ${activity.activity}` : month} // Tooltip on hover
                            >
                              <div className="month-label">{month}</div>
                              <div className="activity-indicator" style={{ backgroundColor: activityColor }}></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Legend for Calendar */}
                  <div className="timeline-legend">
                    <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#a5d6a7' }}></span>Planting</div>
                    <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#66bb6a' }}></span>Growth</div>
                    <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ffee58' }}></span>Harvest</div>
                    <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#e0e0e0' }}></span>Other</div>
                  </div>
                </div>
              ) : (
                <p className="no-data">No crop calendar data available. Add crops to your profile.</p>
              )}
            </div>
          </div>

          {/* Row 3: Soil Analysis & Yield Forecast (Mock Data) */}
          <div className="analytics-row">
            {/* Soil Analysis Card */}
            <div className="analytics-card">
              <h3>Soil Analysis (Example)</h3>
              {/* Mock soil data display */}
              <div className="soil-analysis">
                 <div className="soil-nutrient"><h4>Nitrogen (N)</h4><div className="nutrient-meter"><div className="nutrient-level" style={{ height: '65%', backgroundColor: '#4CAF50' }}></div></div><div className="nutrient-value">Optimal</div></div>
                 <div className="soil-nutrient"><h4>Phosphorus (P)</h4><div className="nutrient-meter"><div className="nutrient-level" style={{ height: '40%', backgroundColor: '#FF9800' }}></div></div><div className="nutrient-value">Low</div></div>
                 <div className="soil-nutrient"><h4>Potassium (K)</h4><div className="nutrient-meter"><div className="nutrient-level" style={{ height: '75%', backgroundColor: '#4CAF50' }}></div></div><div className="nutrient-value">Optimal</div></div>
                 <div className="soil-nutrient"><h4>pH</h4><div className="nutrient-meter"><div className="nutrient-level" style={{ height: '60%', backgroundColor: '#4CAF50' }}></div></div><div className="nutrient-value">6.5</div></div>
                 <div className="soil-nutrient"><h4>Org. Matter</h4><div className="nutrient-meter"><div className="nutrient-level" style={{ height: '50%', backgroundColor: '#FF9800' }}></div></div><div className="nutrient-value">Moderate</div></div>
              </div>
              <div className="soil-recommendations">
                <h4>Recommendations</h4>
                <ul>
                  <li>Address low Phosphorus levels based on soil test results.</li>
                  <li>Continue practices to maintain organic matter.</li>
                  <li>Monitor pH periodically.</li>
                </ul>
              </div>
            </div>

            {/* Expected Yield Forecast Card (Mock Data) */}
            <div className="analytics-card">
              <h3>Yield Forecast (Example)</h3>
              <div className="yield-forecast">
                {/* Mock yield chart */}
                <div className="yield-chart" style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[ { name: 'Estimate', yield: 2.8 }, { name: 'Potential', yield: 3.2 } ]} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis unit=" t/ha" domain={['auto', 'auto']} />
                      <Tooltip formatter={(value) => [`${value} t/ha`]} />
                      <Line type="monotone" dataKey="yield" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Mock yield stats */}
                <div className="yield-comparison">
                  <div className="yield-stat"><span>Current Est:</span><strong>2.8 t/ha</strong></div>
                  <div className="yield-stat"><span>Potential:</span><strong>3.2 t/ha</strong></div>
                  <div className="yield-stat"><span>Regional Avg:</span><strong>2.5 t/ha</strong></div>
                </div>
                <div className="yield-factors">
                  <h4>Key Factors</h4>
                  <ul>
                    <li>Timely water & nutrient application</li>
                    <li>Effective pest/disease management</li>
                    <li>Favorable weather during key stages</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning Progress Tab Content Removed */}

    </div> // End analytics-container
  );
};

export default Analytics;

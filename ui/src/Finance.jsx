import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
// Import 'Line' from recharts
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, BarChart, Cell, PieChart, Pie, ResponsiveContainer } from 'recharts';
import { Loader, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import './Finance.css'; // Ensure this CSS file exists and is styled

// Helper function to normalize potential Firestore objects to arrays
const normalizeArrayField = (field) => {
    if (Array.isArray(field)) {
        return field; // Already an array
    }
    if (field && typeof field === 'object') {
        return Object.values(field); // Convert object values to array
    }
    return []; // Default to empty array if null, undefined, or other type
};


const Finance = () => {
  // --- State Variables ---
  const [userData, setUserData] = useState(null); // Stores user profile data from Firestore
  const [loading, setLoading] = useState(true); // Loading state for initial data fetch
  const [error, setError] = useState(null); // Error state for data fetching
  const [llmInsights, setLlmInsights] = useState(null); // Stores insights from the LLM
  const [llmLoading, setLlmLoading] = useState(false); // Loading state for LLM insights fetch
  // Add state for calculated financial data
  const [financialData, setFinancialData] = useState(null);

  // --- Constants for Financial Calculations (Simulated Data) ---
  // These are estimates and should ideally be configurable or fetched from a reliable source
  const COST_ESTIMATES = { // Estimated cost per hectare in INR (₹) based on crop and soil type
    rice: { clay: 45000, loam: 42000, sandy: 48000 },
    wheat: { clay: 38000, loam: 35000, sandy: 40000 },
    cotton: { clay: 55000, loam: 50000, sandy: 58000 },
    sugarcane: { clay: 65000, loam: 60000, sandy: 70000 },
    vegetables: { clay: 75000, loam: 70000, sandy: 80000 },
    fruits: { clay: 80000, loam: 75000, sandy: 85000 }, // Added Fruits estimate
    default: { clay: 50000, loam: 48000, sandy: 52000 } // Default if crop not listed
  };

  const YIELD_ESTIMATES = { // Estimated yield in tons per hectare based on crop and soil type
    rice: { clay: 5.5, loam: 6.0, sandy: 5.0 },
    wheat: { clay: 4.0, loam: 4.5, sandy: 3.5 },
    cotton: { clay: 2.5, loam: 2.8, sandy: 2.0 },
    sugarcane: { clay: 70, loam: 75, sandy: 65 },
    vegetables: { clay: 20, loam: 22, sandy: 18 },
    fruits: { clay: 15, loam: 18, sandy: 12 }, // Added Fruits estimate
    default: { clay: 5.0, loam: 5.5, sandy: 4.5 } // Default yield
  };

  const MARKET_PRICES = { // Estimated market price in INR (₹) per ton
    rice: 20000,
    wheat: 22000,
    cotton: 60000,
    sugarcane: 3500,
    vegetables: 25000,
    fruits: 30000, // Added Fruits price
    default: 20000 // Default price
  };

  // --- Cost Breakdown Percentages (Simulated) ---
  // Represents the typical distribution of total costs
  const COST_BREAKDOWN = {
    seeds: 15,
    fertilizer: 25,
    pesticides: 12,
    labor: 30,
    irrigation: 10,
    others: 8 // Miscellaneous costs
  };

  // --- Yearly Trend Data (Simulated) ---
  // Placeholder for historical profit data
  const YEARLY_TREND = [
    { year: '2022', profit: 0 },
    { year: '2023', profit: 0 },
    { year: '2024', profit: 0 },
    { year: '2025', profit: 0 }, // Current year profit will be calculated
  ];

  // --- Effects ---

  /**
   * Effect to handle user authentication state changes.
   * Fetches user data from Firestore upon successful authentication.
   * Triggers LLM insight fetching after user data is loaded.
   */
  useEffect(() => {
    const auth = getAuth(); // Get Firebase auth instance
    const db = getFirestore(); // Get Firestore instance

    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) { // If user is authenticated
        setLoading(true); // Start loading
        setError(null); // Clear previous errors
        setUserData(null); // Clear previous user data
        setFinancialData(null); // Clear previous financial data
        setLlmInsights(null); // Clear previous insights
        try {
          // Fetch user data document from Firestore using the user's UID
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            let data = userDoc.data();
            console.log("Raw user data fetched for Finance:", data);

            // *** Normalize array fields immediately after fetching ***
            const fieldsToNormalize = ['waterSources', 'cropTypes', 'learningGoals', 'trackingGoals', 'currentCrops', 'mainInterests'];
            fieldsToNormalize.forEach(key => {
                data[key] = normalizeArrayField(data[key]);
            });
            console.log("Normalized user data:", data);

            setUserData(data); // Store normalized user data in state

            // Calculate financial metrics immediately after setting user data
            const calculatedMetrics = calculateFinancialMetrics(data); // Pass data directly
            setFinancialData(calculatedMetrics); // Store calculated metrics

            // Fetch LLM insights using the normalized user data
            // No need to await here unless subsequent logic depends *immediately* on insights
            fetchLlmInsights(data);

          } else {
            console.error("User data not found in Firestore for UID:", user.uid);
            setError("User data not found. Please complete onboarding.");
          }
        } catch (err) {
          console.error("Error fetching or processing user data:", err);
          setError("Failed to load your financial data. Please try again later.");
        } finally {
          setLoading(false); // Stop loading regardless of success or error
        }
      } else { // If user is not authenticated
        setLoading(false); // Stop loading
        setError("Please sign in to view your financial insights.");
        setUserData(null); // Clear user data
        setFinancialData(null); // Clear financial data
        setLlmInsights(null); // Clear LLM insights
      }
    });

    // Cleanup function: Unsubscribe from auth state changes when component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this effect runs only once on mount


  // --- Data Fetching Functions ---

  /**
   * Fetches personalized financial insights from an LLM (OpenRouter).
   * @param {object} data - The user's profile data (should be normalized).
   */
  const fetchLlmInsights = async (data) => {
    // Ensure data is available before proceeding
    if (!data) {
        console.warn("fetchLlmInsights called without user data.");
        return;
    }

    setLlmLoading(true); // Start loading LLM insights
    setLlmInsights(null); // Clear previous insights
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY; // Get API key from environment variables

    // Fallback insights (used if API key missing or fetch fails)
    const fallbackInsights = {
        costSavingTips: ["Optimize water usage.", "Explore bulk purchasing for inputs."],
        riskAlerts: ["Monitor market price fluctuations.", "Prepare for potential weather changes."],
        subsidySuggestions: ["Check government agricultural portals for schemes.", "Inquire about local cooperative benefits."],
        explanations: ["Profit Margin = (Revenue - Cost) / Revenue.", "ROI = (Profit / Cost) * 100%."]
    };

    if (!apiKey) {
        console.error("OpenRouter API Key (VITE_OPENROUTER_API_KEY) is missing.");
        setLlmInsights(fallbackInsights); // Provide generic fallback insights
        setLlmLoading(false);
        return; // Exit if no API key
    }

    try {
      // Generate a prompt based on user data
      const prompt = generateLlmPrompt(data); // Pass normalized data
      console.log("Generated LLM Prompt:", prompt);

      // Make the API call to OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`, // Use the API key
           // Optional headers for tracking/debugging on OpenRouter
          "HTTP-Referer": "AgriVerseApp",
          "X-Title": "AgriVerse Finance Insights",
        },
        body: JSON.stringify({
          model: "mistralai/mixtral-8x7b-instruct", // Specify the LLM model
          messages: [ { role: "user", content: prompt } ] // Send the prompt
        })
      });

      if (!response.ok) {
          // Handle API errors gracefully
          const errorBody = await response.text();
          console.error(`OpenRouter API Error (${response.status}):`, errorBody);
          throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log("LLM Raw Response:", result);

      // Process the LLM response
      if (result.choices && result.choices[0]?.message?.content) {
        const insights = parseLlmResponse(result.choices[0].message.content);
        console.log("Parsed LLM Insights:", insights);
        setLlmInsights(insights); // Store the parsed insights
      } else {
        console.error("Invalid LLM response format:", result);
        throw new Error("Received invalid data format from AI."); // Throw error for fallback
      }
    } catch (err) {
      console.error("Error fetching or parsing LLM insights:", err);
      setLlmInsights(fallbackInsights); // Provide generic fallback insights on error
    } finally {
      setLlmLoading(false); // Stop loading LLM insights
    }
  };

  /**
   * Generates the prompt string for the LLM based on user data.
   * Assumes data fields like waterSources and cropTypes are already normalized arrays.
   * @param {object} data - User profile data (normalized).
   * @returns {string} The generated prompt.
   */
  const generateLlmPrompt = (data) => {
    // Destructure user data with fallback defaults
    const {
        farmArea = 1,
        cropTypes = ['default'], // Use 'default' if missing
        soilTexture = 'loam',
        location = {},
        waterSources = ['unknown'] // Expecting an array now
    } = data;

    // Ensure cropTypes is an array and has at least one element
    const validCropTypes = Array.isArray(cropTypes) && cropTypes.length > 0 ? cropTypes : ['default'];
    const primaryCrop = validCropTypes[0].toLowerCase(); // Use lowercase for consistency in lookups

    const soil = soilTexture || 'loam';
    // Attempt to get a specific region name, fallback to state or 'your region'
    const region = location?.region || location?.state || "your region";
    const area = farmArea;

    // *** FIX: Ensure waterSources is an array before joining ***
    const water = Array.isArray(waterSources) ? waterSources.join('/') : 'unknown';

    // Construct the detailed prompt requesting JSON output
    return `
Context: You are an agricultural finance advisor for a farmer in India.
Task: Analyze the following farm details and provide concise, actionable financial insights.
Output Format: Respond ONLY with a valid JSON object containing the following keys: "costSavingTips", "riskAlerts", "subsidySuggestions", "explanations". Each key should have an array of exactly 2 distinct string values as its value.

Farm Details:
- Area: ${area} hectares
- Primary Crop: ${primaryCrop}
- Soil Type: ${soil}
- Location: ${region}
- Irrigation: ${water}

Required JSON Output Structure:
{
  "costSavingTips": ["Tip 1 specific to ${primaryCrop}, ${soil} soil, and ${region}", "Tip 2 specific to ${primaryCrop}, ${soil} soil, and ${region}"],
  "riskAlerts": ["Risk 1 specific to ${primaryCrop} farming in ${region}", "Risk 2 specific to ${primaryCrop} farming in ${region}"],
  "subsidySuggestions": ["Subsidy/Loan 1 potentially relevant for ${region}", "Subsidy/Loan 2 potentially relevant for ${region}"],
  "explanations": ["Simple explanation of a relevant financial term", "Simple explanation of another relevant financial term"]
}

Ensure tips, risks, and subsidies are specific and relevant to the provided farm details. Keep explanations simple.
`.trim(); // Trim whitespace
  };

  /**
   * Parses the LLM's response string, attempting to extract a JSON object.
   * Provides fallback parsing if JSON extraction fails.
   * @param {string} response - The raw response string from the LLM.
   * @returns {object} The parsed insights object.
   */
  const parseLlmResponse = (response) => {
    try {
      // Attempt to find and parse a JSON object within the response string
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        const parsedJson = JSON.parse(jsonMatch[0]);
        // Basic validation to ensure required keys exist and are arrays
        if (Array.isArray(parsedJson.costSavingTips) &&
            Array.isArray(parsedJson.riskAlerts) &&
            Array.isArray(parsedJson.subsidySuggestions) &&
            Array.isArray(parsedJson.explanations)) {
            // Ensure arrays have at least 2 items (add placeholders if needed)
            const ensureTwoItems = (arr, placeholder) => {
                while (arr.length < 2) arr.push(`[${placeholder} ${arr.length + 1}]`);
                return arr.slice(0, 2); // Return only first 2
            };
            return {
                costSavingTips: ensureTwoItems(parsedJson.costSavingTips, "Default Cost Tip"),
                riskAlerts: ensureTwoItems(parsedJson.riskAlerts, "Default Risk Alert"),
                subsidySuggestions: ensureTwoItems(parsedJson.subsidySuggestions, "Default Subsidy Suggestion"),
                explanations: ensureTwoItems(parsedJson.explanations, "Default Explanation")
            };
        } else {
            console.warn("Parsed JSON missing required keys or keys are not arrays, attempting fallback parsing.");
        }
      } else {
          console.warn("No JSON object found in LLM response, attempting fallback parsing.");
      }

      // Fallback parsing logic (less reliable)
      console.log("Executing fallback LLM response parsing.");
      return {
        costSavingTips: extractListItems(response, "costSavingTips", "cost saving", "reduce cost", "tip"),
        riskAlerts: extractListItems(response, "riskAlerts", "risk", "alert"),
        subsidySuggestions: extractListItems(response, "subsidySuggestions", "subsidy", "loan", "scheme"),
        explanations: extractListItems(response, "explanations", "explanation", "term", "financial")
      };
    } catch (err) {
      console.error("Error parsing LLM response:", err, "Raw response:", response);
      // Return default fallback data if all parsing fails
      return {
        costSavingTips: ["Optimize fertilizer application.", "Explore group farming initiatives."],
        riskAlerts: ["Input cost inflation.", "Pest outbreaks affecting yield."],
        subsidySuggestions: ["State-specific agricultural schemes.", "NABARD financial assistance programs."],
        explanations: ["Break-even point: Revenue needed to cover all costs.", "Working Capital: Funds for day-to-day operations."]
      };
    }
  };

  /**
   * Helper function for fallback parsing: Extracts list items based on keywords.
   * @param {string} text - The text to parse.
   * @param {string} keyName - The key name for logging purposes.
   * @param {...string} keywords - Keywords to identify relevant lines.
   * @returns {string[]} An array of extracted strings (max 2).
   */
  const extractListItems = (text, keyName, ...keywords) => {
    const lines = text.split('\n');
    const relevantLines = [];
    // Iterate through lines and find those starting with list markers or containing keywords
    for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip empty lines
        if (!trimmedLine) continue;
        const lowerLine = trimmedLine.toLowerCase();
        // Check if line starts like a list item or contains keywords
        if (trimmedLine.match(/^[\*\-\d]+\.?\s+/) || keywords.some(kw => lowerLine.includes(kw))) {
             // Clean up the line (remove list markers, etc.) and add if not empty
            const cleanedLine = trimmedLine.replace(/^[\*\-\d]+\.?\s*/, '').trim();
            if(cleanedLine) {
                relevantLines.push(cleanedLine);
            }
        }
        if (relevantLines.length >= 2) break; // Limit to 2 items
    }

    // If fewer than 2 items found, add placeholders
    while (relevantLines.length < 2) {
        relevantLines.push(`[Default ${keyName.replace(/([A-Z])/g, ' $1')} ${relevantLines.length + 1}]`);
    }

    return relevantLines;
  };


  // --- Calculation Functions ---

  /**
   * Calculates key financial metrics based on user data and predefined constants.
   * @param {object} currentData - The user's profile data (normalized).
   * @returns {object|null} An object containing calculated metrics or null if data is invalid.
   */
  const calculateFinancialMetrics = (currentData) => {
    // Use the passed data directly, assuming it's normalized
    if (!currentData) {
        console.warn("calculateFinancialMetrics called without data.");
        return null;
    }

    // Destructure user data with defaults
    const {
        farmArea = 1,
        cropTypes = ['default'], // Use 'default' if missing
        soilTexture = 'loam'
    } = currentData;

    // Ensure cropTypes is an array and get the primary crop (lowercase)
    const validCropTypes = Array.isArray(cropTypes) && cropTypes.length > 0 ? cropTypes : ['default'];
    const primaryCrop = validCropTypes[0].toLowerCase(); // Use lowercase for consistency

    const soil = (soilTexture || 'loam').toLowerCase(); // Ensure lowercase and provide default
    const area = parseFloat(farmArea) || 1; // Ensure area is a number, default to 1

    console.log(`Calculating metrics for: Crop=${primaryCrop}, Soil=${soil}, Area=${area}`);

    // --- Cost Calculation ---
    const cropCosts = COST_ESTIMATES[primaryCrop] || COST_ESTIMATES['default'];
    const costPerHectare = cropCosts[soil] || cropCosts['loam']; // Fallback to loam within crop/default
    const totalCost = costPerHectare * area;

    // --- Yield Calculation ---
    const cropYields = YIELD_ESTIMATES[primaryCrop] || YIELD_ESTIMATES['default'];
    const yieldPerHectare = cropYields[soil] || cropYields['loam'];
    const totalYield = yieldPerHectare * area;

    // --- Revenue & Profit Calculation ---
    const marketPrice = MARKET_PRICES[primaryCrop] || MARKET_PRICES['default'];
    const revenue = totalYield * marketPrice;
    const profit = revenue - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    // --- Cost Breakdown ---
    const costBreakdown = Object.entries(COST_BREAKDOWN).map(([name, percentage]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round((totalCost * percentage) / 100) || 0 // Ensure value is at least 0
    }));

    // --- Yearly Trend Simulation ---
    const updatedTrend = JSON.parse(JSON.stringify(YEARLY_TREND));
    if (updatedTrend.length > 0) {
        updatedTrend[updatedTrend.length - 1].profit = Math.round(profit);
    }
    const baseProfit = profit * 0.8;
    for (let i = 0; i < updatedTrend.length - 1; i++) {
        updatedTrend[i].profit = Math.round(baseProfit * (0.85 + Math.random() * 0.3));
    }

    const calculatedData = {
      farmArea: area,
      // *** FIX: Ensure crop and soil are always strings, provide defaults ***
      crop: primaryCrop || 'N/A', // Default if somehow still undefined
      soil: soil || 'N/A',       // Default if somehow still undefined
      costPerHectare,
      totalCost,
      yieldPerHectare,
      totalYield,
      marketPrice,
      revenue,
      profit,
      roi,
      costBreakdown,
      yearlyTrend: updatedTrend
    };
    console.log("Calculated Financial Data:", calculatedData);
    return calculatedData;
  };

  // --- Helper Functions ---

  /**
   * Formats a number as Indian Rupees (INR).
   * @param {number} value - The number to format.
   * @returns {string} Formatted currency string.
   */
  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return '₹ --'; // Handle non-numeric values robustly
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0 // No decimal places
    }).format(value);
  };

  // --- Chart Configuration ---
  // Colors for the Pie Chart segments
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // --- Render Logic ---

  // Display loading indicator while fetching initial data
  if (loading) {
    return (
      <div className="finance-loading">
        <Loader className="spinner" />
        <p>Loading your financial insights...</p>
      </div>
    );
  }

  // Display error message if data fetching failed
  if (error) {
    return (
      <div className="finance-error">
        <AlertCircle className="error-icon" />
        <p>{error}</p>
      </div>
    );
  }

  // Display main finance dashboard
  // *** Add check for financialData before rendering metrics/charts ***
  return (
    <div className="finance-container">
      <h1>Farm Financial Analysis</h1>

      {/* Render financial metrics and charts only if financialData is available */}
      {financialData ? (
        <>
          {/* Section for displaying key financial metrics */}
          <div className="finance-metrics">
            {/* Card for Farm Overview */}
            <div className="metric-card">
              <h3>Farm Overview</h3>
              <div className="metric-row">
                <div className="metric-label">Farm Area:</div>
                {/* Use optional chaining or default value for safety */}
                <div className="metric-value">{financialData.farmArea ?? '--'} hectares</div>
              </div>
              <div className="metric-row">
                <div className="metric-label">Primary Crop:</div>
                {/* *** FIX: Add check or default for crop before using charAt *** */}
                <div className="metric-value">{(financialData.crop && financialData.crop.length > 0) ? financialData.crop.charAt(0).toUpperCase() + financialData.crop.slice(1) : 'N/A'}</div>
              </div>
              <div className="metric-row">
                <div className="metric-label">Soil Type:</div>
                 {/* *** FIX: Add check or default for soil before using charAt *** */}
                <div className="metric-value">{(financialData.soil && financialData.soil.length > 0) ? financialData.soil.charAt(0).toUpperCase() + financialData.soil.slice(1) : 'N/A'}</div>
              </div>
            </div>

            {/* Card for Cost Analysis */}
            <div className="metric-card">
              <h3>Cost Analysis</h3>
              <div className="metric-row">
                <div className="metric-label">Cost per Hectare:</div>
                <div className="metric-value">{formatCurrency(financialData.costPerHectare)}</div>
              </div>
              <div className="metric-row">
                <div className="metric-label">Total Input Costs:</div>
                <div className="metric-value">{formatCurrency(financialData.totalCost)}</div>
              </div>
            </div>

            {/* Card for Yield & Revenue */}
            <div className="metric-card">
              <h3>Yield & Revenue</h3>
              <div className="metric-row">
                <div className="metric-label">Expected Yield:</div>
                <div className="metric-value">{(financialData.totalYield ?? 0).toFixed(1)} tons</div>
              </div>
              <div className="metric-row">
                <div className="metric-label">Market Price:</div>
                <div className="metric-value">{formatCurrency(financialData.marketPrice)}/ton</div>
              </div>
              <div className="metric-row">
                <div className="metric-label">Expected Revenue:</div>
                <div className="metric-value">{formatCurrency(financialData.revenue)}</div>
              </div>
            </div>

            {/* Highlighted Card for Profitability */}
            <div className="metric-card highlight">
              <h3>Profitability</h3>
              <div className="metric-row">
                <div className="metric-label">Projected Profit:</div>
                {/* Apply positive/negative class based on profit value */}
                <div className={`metric-value ${financialData.profit >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(financialData.profit)}
                  {/* Show trend icon based on profit */}
                  {financialData.profit >= 0 ? <ArrowUpRight className="trend-icon" /> : <ArrowDownRight className="trend-icon" />}
                </div>
              </div>
              <div className="metric-row">
                <div className="metric-label">ROI:</div>
                 {/* Apply positive/negative class based on ROI value */}
                <div className={`metric-value ${financialData.roi >= 0 ? 'positive' : 'negative'}`}>
                  {(financialData.roi ?? 0).toFixed(1)}%
                  {/* Show trend icon based on ROI */}
                  {financialData.roi >= 0 ? <ArrowUpRight className="trend-icon" /> : <ArrowDownRight className="trend-icon" />}
                </div>
              </div>
            </div>
          </div>

          {/* Section for displaying charts */}
          <div className="finance-charts">
            {/* Container for Revenue vs Costs vs Profit Bar Chart */}
            <div className="chart-container">
              <h3>Revenue vs Costs vs Profit</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[ // Data for the bar chart
                    { name: 'Revenue', value: financialData.revenue ?? 0 },
                    { name: 'Costs', value: financialData.totalCost ?? 0 },
                    { name: 'Profit', value: financialData.profit ?? 0 }
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" /> {/* Grid lines */}
                  <XAxis dataKey="name" /> {/* X-axis labels */}
                  {/* Y-axis labels formatted as thousands (K) */}
                  <YAxis tickFormatter={(value) => `₹${value / 1000}K`} />
                  {/* Tooltip displays formatted currency on hover */}
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend /> {/* Chart legend */}
                  {/* Bar definition with custom cell colors */}
                  <Bar dataKey="value" name="Amount" fill="#4CAF50">
                    {/* Assign specific colors to each bar */}
                    <Cell key="revenue" fill="#4CAF50" /> {/* Green for revenue */}
                    <Cell key="costs" fill="#FF9800" /> {/* Orange for costs */}
                    {/* Blue for positive profit, Red for negative profit */}
                    <Cell key="profit" fill={(financialData.profit ?? 0) >= 0 ? "#2196F3" : "#F44336"} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Container for Cost Breakdown Pie Chart */}
            <div className="chart-container">
              <h3>Cost Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={financialData.costBreakdown ?? []} // Use empty array as default
                    cx="50%" // Center X
                    cy="50%" // Center Y
                    labelLine={false} // Hide connector lines for labels
                    // Custom label displays category name and percentage
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80} // Size of the pie
                    fill="#8884d8" // Default fill (overridden by cells)
                    dataKey="value" // Data key for segment values
                  >
                    {/* Assign colors to each pie segment */}
                    {(financialData.costBreakdown ?? []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  {/* Tooltip displays formatted currency on hover */}
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Container for Profit Trend Line Chart */}
            <div className="chart-container">
              <h3>Profit Trend (Simulated)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={financialData.yearlyTrend ?? []} // Use empty array as default
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" /> {/* Grid lines */}
                  <XAxis dataKey="year" /> {/* X-axis labels (years) */}
                  {/* Y-axis labels formatted as thousands (K) */}
                  <YAxis tickFormatter={(value) => `₹${value / 1000}K`} />
                  {/* Tooltip displays formatted currency on hover */}
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend /> {/* Chart legend */}
                  {/* Line definition */}
                  <Line type="monotone" dataKey="profit" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section for displaying AI-powered insights */}
          <div className="insights-section">
            <h2>AI-Powered Insights</h2>

            {/* Show loading indicator while fetching LLM insights */}
            {llmLoading ? (
              <div className="insights-loading">
                <Loader className="spinner" />
                <p>Generating personalized insights...</p>
              </div>
            // Render insights if available and not loading
            ) : llmInsights ? (
              <div className="insights-grid">
                {/* Card for Cost-Saving Tips */}
                <div className="insight-card">
                  <h3>Cost-Saving Tips</h3>
                  <ul>
                    {/* Use optional chaining for safety */}
                    {(llmInsights.costSavingTips ?? []).map((tip, index) => (
                      <li key={`tip-${index}`}>{tip}</li>
                    ))}
                  </ul>
                </div>

                {/* Card for Risk Alerts */}
                <div className="insight-card">
                  <h3>Risk Alerts</h3>
                  <ul>
                    {(llmInsights.riskAlerts ?? []).map((alert, index) => (
                      <li key={`alert-${index}`}>{alert}</li>
                    ))}
                  </ul>
                </div>

                {/* Card for Subsidy & Loan Opportunities */}
                <div className="insight-card">
                  <h3>Subsidy & Loan Opportunities</h3>
                  <ul>
                    {(llmInsights.subsidySuggestions ?? []).map((suggestion, index) => (
                      <li key={`subsidy-${index}`}>{suggestion}</li>
                    ))}
                  </ul>
                </div>

                {/* Card for Financial Explanations */}
                <div className="insight-card">
                  <h3>Financial Explanations</h3>
                  <ul>
                    {(llmInsights.explanations ?? []).map((explanation, index) => (
                      <li key={`explanation-${index}`}>{explanation}</li>
                    ))}
                  </ul>
                </div>
              </div>
            // Show error/info message if insights couldn't be generated
            ) : (
              <div className="insights-error">
                <Info className="info-icon" />
                <p>Could not generate personalized insights at this time.</p>
              </div>
            )}
          </div>

          {/* Footer section with disclaimer */}
          <div className="finance-footer">
            <p>
              <strong>Note:</strong> All financial figures and insights are estimates based on simulated data and current market assumptions.
              Actual results may vary significantly based on weather conditions, market price fluctuations, pest/disease incidence, and specific farm management practices. Consult with a financial advisor for personalized guidance.
            </p>
          </div>
        </>
      ) : (
          // Render message if financialData could not be calculated (e.g., userData missing or calculation failed)
          !loading && <p>Financial data could not be calculated. Ensure your profile is complete and try refreshing.</p>
      )}
    </div>
  );
};

export default Finance;

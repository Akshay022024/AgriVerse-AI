// llmService.js - Handles interaction with LLM services
import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

// Default system prompt for agricultural assistant
const DEFAULT_SYSTEM_PROMPT = `
You are AgriverseAI CoPilot, an advanced agricultural assistant.
Your purpose is to help farmers, agricultural scientists, and gardeners with expert advice.
You have knowledge about crops, soil management, weather patterns, pest control, sustainable farming practices,
agricultural equipment, and the latest research in agriculture.
Keep your responses focused on agriculture and farming-related topics.
`;

// Using Ollama exclusively as it doesn't need API keys
const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama2'; // You can change this to any model you have downloaded in Ollama

// Get agricultural data from Firestore
const getAgriDataForQuery = async (query) => {
  try {
    // This is a simplified version - in production, you would have more
    // sophisticated query analysis and data retrieval logic

    // Example: Check if the query is about crops
    if (query.toLowerCase().includes('crop') || 
        query.toLowerCase().includes('plant') ||
        query.toLowerCase().includes('పంట') || // Telugu for crop
        query.toLowerCase().includes('फसल')) { // Hindi for crop
      const cropsRef = collection(db, 'agriverse_data', 'crops', 'varieties');
      const cropsSnapshot = await getDocs(cropsRef);
      const cropsData = [];
      
      cropsSnapshot.forEach((doc) => {
        cropsData.push({ id: doc.id, ...doc.data() });
      });
      
      return cropsData;
    }
    
    // Example: Check if query is about soil
    if (query.toLowerCase().includes('soil') || 
        query.toLowerCase().includes('మట్టి') || // Telugu for soil
        query.toLowerCase().includes('मिट्टी')) { // Hindi for soil
      const soilDocRef = doc(db, 'agriverse_data', 'soil', 'types', 'general');
      const soilDoc = await getDoc(soilDocRef);
      
      if (soilDoc.exists()) {
        return [soilDoc.data()];
      }
    }
    
    // Example: Check if query is about weather
    if (query.toLowerCase().includes('weather') ||
        query.toLowerCase().includes('climate') ||
        query.toLowerCase().includes('వాతావరణం') || // Telugu for weather
        query.toLowerCase().includes('मौसम')) { // Hindi for weather
      const weatherDocRef = doc(db, 'agriverse_data', 'weather', 'general');
      const weatherDoc = await getDoc(weatherDocRef);
      
      if (weatherDoc.exists()) {
        return [weatherDoc.data()];
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching agricultural data:', error);
    return [];
  }
};

// Process prompt with relevant agricultural data from Firestore
const preparePromptWithContext = async (userQuery, language) => {
  try {
    // Get relevant data from Firestore
    const agriData = await getAgriDataForQuery(userQuery);
    
    // Create context with the retrieved data
    let contextText = '';
    if (agriData.length > 0) {
      contextText = 'Here is some relevant agricultural information that might help answer the question:\n\n';
      agriData.forEach((data, index) => {
        contextText += `[Data ${index + 1}]:\n${JSON.stringify(data)}\n\n`;
      });
    }
    
    // Add language-specific instructions
    let languageInstructions = '';
    if (language === 'te-IN') {
      languageInstructions = 'Please respond in Telugu language. తెలుగులో సమాధానం ఇవ్వండి.';
    } else if (language === 'hi-IN') {
      languageInstructions = 'Please respond in Hindi language. कृपया हिंदी में जवाब दें.';
    } else {
      languageInstructions = 'Please respond in English language.';
    }
    
    // Create final prompt with context
    const fullPrompt = `
${DEFAULT_SYSTEM_PROMPT}

${languageInstructions}

${contextText}

User message: ${userQuery}
`;
    
    return fullPrompt;
  } catch (error) {
    console.error('Error preparing prompt:', error);
    return `${DEFAULT_SYSTEM_PROMPT}\n\nUser message: ${userQuery}`;
  }
};

// Ollama API call - Self-hosted option (free)
const callOllama = async (prompt) => {
  try {
    // Using fetch to call the Ollama API
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama API error:', error);
    throw error;
  }
};

// Fallback response generator when API calls fail
const generateFallbackResponse = (query, language) => {
  // Simple multilingual ruleset for agricultural queries when API fails
  const lowerQuery = query.toLowerCase();
  
  // English responses
  if (language === 'en-US') {
    if (lowerQuery.includes('weather') || lowerQuery.includes('climate')) {
      return "Based on general agricultural knowledge, weather conditions are critical for crop planning. I recommend checking a local weather service for the most current forecast for your region.";
    } else if (lowerQuery.includes('plant') || lowerQuery.includes('crop')) {
      return "From agricultural best practices, crop selection should be based on your local climate, soil conditions, and market demand. Consider consulting your local agricultural extension for specific recommendations.";
    } else if (lowerQuery.includes('soil') || lowerQuery.includes('fertilizer')) {
      return "Good soil health is fundamental to successful farming. I recommend soil testing to determine its composition and nutrient levels before applying any fertilizers.";
    } else if (lowerQuery.includes('pest') || lowerQuery.includes('disease')) {
      return "Integrated pest management (IPM) is often the most sustainable approach to addressing crop pests and diseases. This combines biological controls, crop rotation, and targeted interventions.";
    } else {
      return "I'm your AgriverseAI farming assistant. I can help with questions about crops, soil, weather, and agricultural practices. How can I assist with your farming needs today?";
    }
  }
  // Telugu responses
  else if (language === 'te-IN') {
    if (lowerQuery.includes('వాతావరణం') || lowerQuery.includes('climate')) {
      return "వ్యవసాయ సాధారణ జ్ఞానం ప్రకారం, పంట ప్రణాళిక కోసం వాతావరణ పరిస్థితులు చాలా కీలకం. మీ ప్రాంతానికి తాజా వాతావరణ సమాచారం కోసం స్థానిక వాతావరణ సేవను సంప్రదించమని సిఫార్సు చేస్తున్నాను.";
    } else if (lowerQuery.includes('పంట') || lowerQuery.includes('మొక్క')) {
      return "వ్యవసాయ ఉత్తమ పద్ధతుల ప్రకారం, పంట ఎంపిక మీ స్థానిక వాతావరణం, నేల పరిస్థితులు మరియు మార్కెట్ డిమాండ్ ఆధారంగా ఉండాలి. నిర్దిష్ట సిఫార్సుల కోసం మీ స్థానిక వ్యవసాయ విస్తరణను సంప్రదించండి.";
    } else {
      return "నేను మీ AgriverseAI వ్యవసాయ సహాయకుడిని. నేను పంటలు, నేల, వాతావరణం మరియు వ్యవసాయ పద్ధతుల గురించి ప్రశ్నలకు సహాయం చేయగలను. నేడు మీ వ్యవసాయ అవసరాలకు నేను ఎలా సహాయం చేయగలను?";
    }
  }
  // Hindi responses
  else if (language === 'hi-IN') {
    if (lowerQuery.includes('मौसम') || lowerQuery.includes('जलवायु')) {
      return "सामान्य कृषि ज्ञान के अनुसार, फसल योजना के लिए मौसम की स्थिति महत्वपूर्ण है। मैं आपके क्षेत्र के लिए सबसे वर्तमान पूर्वानुमान के लिए स्थानीय मौसम सेवा की जांच करने की सलाह देता हूं।";
    } else if (lowerQuery.includes('फसल') || lowerQuery.includes('पौधा')) {
      return "कृषि सर्वोत्तम प्रथाओं से, फसल चयन आपके स्थानीय जलवायु, मिट्टी की स्थिति और बाजार की मांग के आधार पर होना चाहिए। विशिष्ट सिफारिशों के लिए अपने स्थानीय कृषि विस्तार से परामर्श करें।";
    } else {
      return "मैं आपका AgriverseAI कृषि सहायक हूं। मैं फसलों, मिट्टी, मौसम और कृषि प्रथाओं के बारे में प्रश्नों में मदद कर सकता हूं। आज मैं आपकी कृषि जरूरतों में कैसे सहायता कर सकता हूं?";
    }
  }
  // Default response in English
  else {
    return "I'm your AgriverseAI farming assistant. I can help with questions about crops, soil, weather, and agricultural practices. How can I assist with your farming needs today?";
  }
};

// Main function to call the LLM service
export const callLLM = async (userQuery, language) => {
  try {
    console.log(`Processing query in language: ${language}`);
    
    // Prepare prompt with context from Firestore
    const fullPrompt = await preparePromptWithContext(userQuery, language);
    
    // Call Ollama
    const response = await callOllama(fullPrompt);
    return response;
  } catch (error) {
    console.error('LLM service error:', error);
    // Provide a fallback response based on simple rules
    return generateFallbackResponse(userQuery, language);
  }
};

export default { callLLM };
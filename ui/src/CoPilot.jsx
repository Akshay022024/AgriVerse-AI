import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signInUserAnonymously, getUserData } from './firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Camera, Mic, MicOff, Send, Volume2, VolumeX, Globe, Menu, X, Moon, Sun, RefreshCw } from 'lucide-react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import './CoPilot.css';

// Languages supported by the CoPilot - reduced to English, Telugu, and Hindi
const languages = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu' },
  { code: 'hi', name: 'Hindi' }
];

// Free TTS API using browser's built-in speech synthesis
const synthesizeSpeech = async (text, language) => {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      reject("Browser doesn't support speech synthesis");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language; // e.g. 'en-US', 'hi-IN', 'te-IN'
    utterance.onend = () => resolve();
    utterance.onerror = (err) => reject(err);
    synth.speak(utterance);
  });
};

// Free STT API - Using browser's Web Speech API
const setupSpeechRecognition = (language, onResult, onEnd) => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error("Speech recognition not supported in this browser");
    return { start: () => {}, stop: () => {} };
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = language; // e.g. 'en-US', 'hi-IN', 'te-IN'

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');
    
    onResult(transcript);
  };

  recognition.onend = onEnd;

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop()
  };
};

// Ollama Integration for LLM
const callOllama = async (message, language) => {
  try {
    // Default system prompt to guide the model
    const systemPrompt = `You are AgriverseAI CoPilot, an advanced agricultural assistant designed to help farmers, agricultural scientists, and gardeners. 
Focus on providing expert advice about crops, soil management, weather patterns, pest control, sustainable farming practices, 
agricultural equipment, and the latest research in agriculture. The user communicates in ${getLanguageName(language)}. 
Please respond in ${getLanguageName(language)} language.`;
    
    // Format prompt for Ollama
    const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;
    
    // Call the Ollama API (running locally or on your server)
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama2',  // or any other model you've downloaded
        prompt: fullPrompt,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    
    // Fallback responses based on language
    const fallbacks = {
      'en-US': "I'm sorry, I couldn't connect to my knowledge base. Please check your Ollama server or try again later. For basic agricultural assistance, consider checking your local extension office resources.",
      'hi-IN': "मुझे खेद है, मैं अपने ज्ञान आधार से कनेक्ट नहीं कर सका। कृपया अपने Ollama सर्वर की जांच करें या बाद में पुन: प्रयास करें। बुनियादी कृषि सहायता के लिए, अपने स्थानीय कृषि विस्तार कार्यालय के संसाधनों की जांच करें।",
      'te-IN': "క్షమించండి, నేను నా నాలెడ్జ్ బేస్‌కి కనెక్ట్ చేయలేకపోయాను. దయచేసి మీ Ollama సర్వర్‌ని తనిఖీ చేయండి లేదా తర్వాత మళ్లీ ప్రయత్నించండి. ప్రాథమిక వ్యవసాయ సహాయం కోసం, మీ స్థానిక వ్యవసాయ విస్తరణ కార్యాలయ వనరులను తనిఖీ చేయడం పరిగణించండి."
    };
    
    return fallbacks[language] || fallbacks['en-US'];
  }
};

// Helper function to get full language name from code
const getLanguageName = (code) => {
  const lang = languages.find(l => l.code === code.split('-')[0]);
  return lang ? lang.name : 'English';
};

// Map language codes to voice recognition language codes
const getVoiceLanguageCode = (code) => {
  const mapping = {
    'en': 'en-US',
    'hi': 'hi-IN',
    'te': 'te-IN'
  };
  return mapping[code] || 'en-US';
};

const CoPilot = () => {
  // State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingQuery, setProcessingQuery] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('unknown'); // 'unknown', 'connected', 'disconnected'
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const speechRecognition = useRef(null);
  
  // Check Ollama server status
  const checkOllamaStatus = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/version', {
        method: 'GET'
      });
      
      if (response.ok) {
        setOllamaStatus('connected');
        return true;
      } else {
        setOllamaStatus('disconnected');
        return false;
      }
    } catch (error) {
      console.error("Ollama server check failed:", error);
      setOllamaStatus('disconnected');
      return false;
    }
  };
  
  // Authenticate user on component mount
  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // Try to get the current user
        const auth = getAuth();
        onAuthStateChanged(auth, async (currentUser) => {
          if (!currentUser) {
            // If no user is logged in, sign in anonymously
            const newUser = await signInUserAnonymously();
            setUser(newUser);
          } else {
            setUser(currentUser);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error("Authentication error:", error);
        setLoading(false);
      }
    };

    authenticateUser();
    checkOllamaStatus(); // Check Ollama status on load
  }, []);

  // Load message history from Firestore
  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(db, "users", user.uid, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const loadedMessages = [];
      querySnapshot.forEach((doc) => {
        loadedMessages.push({ id: doc.id, ...doc.data() });
      });
      setMessages(loadedMessages);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup speech recognition when language changes
  useEffect(() => {
    const voiceLanguage = getVoiceLanguageCode(language);
    
    speechRecognition.current = setupSpeechRecognition(
      voiceLanguage,
      (transcript) => {
        setInterimTranscript(transcript);
        setInput(transcript);
      },
      () => {
        setIsListening(false);
        if (interimTranscript.trim()) {
          handleSend(interimTranscript);
          setInterimTranscript('');
        }
      }
    );

    return () => {
      if (isListening && speechRecognition.current) {
        speechRecognition.current.stop();
      }
    };
  }, [language]);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      
      try {
        const userData = await getUserData();
        if (userData && userData.preferences) {
          setLanguage(userData.preferences.language || 'en');
          setDarkMode(userData.preferences.darkMode || false);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      }
    };

    loadPreferences();
  }, [user]);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Toggle speech recognition
  const toggleListening = () => {
    if (isListening) {
      speechRecognition.current.stop();
      setIsListening(false);
    } else {
      speechRecognition.current.start();
      setIsListening(true);
    }
  };

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Save message to Firestore
  const saveMessage = async (message) => {
    if (!user) return;

    try {
      const messagesRef = collection(db, "users", user.uid, "messages");
      await addDoc(messagesRef, {
        ...message,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Handle send message
  const handleSend = async (text = null) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    // Add user message
    const userMessage = {
      content: messageText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    saveMessage(userMessage);
    setInput('');
    setInterimTranscript('');
    setProcessingQuery(true);

    // Check Ollama status before making the request
    const isOllamaAvailable = await checkOllamaStatus();

    // Get response from LLM
    try {
      const voiceLanguage = getVoiceLanguageCode(language);
      let response;
      
      if (isOllamaAvailable) {
        response = await callOllama(messageText, voiceLanguage);
      } else {
        // Fallback response if Ollama is not available
        const fallbacks = {
          'en-US': "I can't connect to the Ollama server. Please make sure it's running and try again.",
          'hi-IN': "मैं Ollama सर्वर से कनेक्ट नहीं कर सकता। कृपया सुनिश्चित करें कि यह चल रहा है और फिर से प्रयास करें।",
          'te-IN': "నేను Ollama సర్వర్‌కి కనెక్ట్ చేయలేను. దయచేసి అది నడుస్తున్నట్లు నిర్ధారించుకొని మళ్లీ ప్రయత్నించండి."
        };
        response = fallbacks[voiceLanguage] || fallbacks['en-US'];
      }
      
      // Add AI response
      const aiMessage = {
        content: response,
        sender: 'ai',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      saveMessage(aiMessage);
      
      // Speak response if needed
      if (isSpeaking) {
        synthesizeSpeech(response, voiceLanguage);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      
      // Add error message
      const errorMessage = {
        content: "I'm sorry, there was an error processing your request.",
        sender: 'ai',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      saveMessage(errorMessage);
    } finally {
      setProcessingQuery(false);
    }
  };

  // Toggle speech
  const toggleSpeech = () => {
    setIsSpeaking(!isSpeaking);
  };

  // Toggle language menu
  const toggleLangMenu = () => {
    setLangMenuOpen(!langMenuOpen);
  };

  // Change language
  const changeLanguage = (code) => {
    setLanguage(code);
    setLangMenuOpen(false);
    
    // Save preference to user profile
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, {
          "preferences.language": code
        });
      } catch (error) {
        console.error("Error saving language preference:", error);
      }
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    
    // Save preference to user profile
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, {
          "preferences.darkMode": newMode
        });
      } catch (error) {
        console.error("Error saving dark mode preference:", error);
      }
    }
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Manually check Ollama status
  const handleCheckOllamaStatus = async () => {
    await checkOllamaStatus();
  };

  if (loading) {
    return (
      <div className="copilot-loading">
        <RefreshCw className="loading-icon spin" />
        <p>Loading AgriverseAI CoPilot...</p>
      </div>
    );
  }

  return (
    <div className={`copilot-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* Header */}
      <header className="copilot-header">
        <div className="header-left">
          <button className="icon-button" onClick={toggleSidebar}>
            <Menu />
          </button>
          <h1>AgriverseAI CoPilot</h1>
          <div className={`ollama-status ${ollamaStatus}`}>
            {ollamaStatus === 'connected' ? 'Ollama: Connected' : 
             ollamaStatus === 'disconnected' ? 'Ollama: Disconnected' : 'Ollama: Checking...'}
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`icon-button ${isSpeaking ? 'active' : ''}`} 
            onClick={toggleSpeech} 
            title={isSpeaking ? "Mute voice" : "Enable voice"}
          >
            {isSpeaking ? <Volume2 /> : <VolumeX />}
          </button>
          <button 
            className="icon-button" 
            onClick={toggleLangMenu} 
            title="Change language"
          >
            <Globe />
          </button>
          <button 
            className="icon-button" 
            onClick={toggleDarkMode} 
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>

      {/* Language Menu */}
      {langMenuOpen && (
        <div className="language-menu">
          {languages.map((lang) => (
            <button 
              key={lang.code} 
              className={language === lang.code ? 'active' : ''}
              onClick={() => changeLanguage(lang.code)}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}

      {/* Sidebar */}
      <div className={`copilot-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Settings</h2>
          <button className="icon-button" onClick={toggleSidebar}>
            <X />
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-section">
            <h3>Ollama Status</h3>
            <div className="setting-row">
              <span>Status</span>
              <span className={`status-indicator ${ollamaStatus}`}>
                {ollamaStatus === 'connected' ? 'Connected' : 
                 ollamaStatus === 'disconnected' ? 'Disconnected' : 'Unknown'}
              </span>
            </div>
            <button 
              className="check-ollama-button"
              onClick={handleCheckOllamaStatus}
            >
              Check Status
            </button>
          </div>
          <div className="sidebar-section">
            <h3>Voice Settings</h3>
            <div className="setting-row">
              <span>Voice Output</span>
              <button 
                className={`toggle-button ${isSpeaking ? 'active' : ''}`}
                onClick={toggleSpeech}
              >
                {isSpeaking ? 'On' : 'Off'}
              </button>
            </div>
          </div>
          <div className="sidebar-section">
            <h3>Appearance</h3>
            <div className="setting-row">
              <span>Dark Mode</span>
              <button 
                className={`toggle-button ${darkMode ? 'active' : ''}`}
                onClick={toggleDarkMode}
              >
                {darkMode ? 'On' : 'Off'}
              </button>
            </div>
          </div>
          <div className="sidebar-section">
            <h3>Language</h3>
            <div className="setting-languages">
              {languages.map((lang) => (
                <button 
                  key={lang.code} 
                  className={language === lang.code ? 'lang-button active' : 'lang-button'}
                  onClick={() => changeLanguage(lang.code)}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="copilot-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="welcome-message">
              <h2>Welcome to AgriverseAI CoPilot</h2>
              <p>Your agricultural assistant is ready to help. Ask me anything about farming, crops, soil, weather, or agricultural practices.</p>
              {ollamaStatus === 'disconnected' && (
                <div className="ollama-warning">
                  <p>⚠️ Ollama server is not connected. Please start the Ollama server to enable full functionality.</p>
                  <button onClick={handleCheckOllamaStatus}>Check Connection</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={message.id || index} 
              className={`message ${message.sender}`}
            >
              <div className="message-bubble">
                <p>{message.content}</p>
              </div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
        {processingQuery && (
          <div className="message ai typing">
            <div className="message-bubble">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="copilot-input">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message here..."
          disabled={isListening}
        />
        <button 
          className={`icon-button mic-button ${isListening ? 'active' : ''}`} 
          onClick={toggleListening}
          disabled={processingQuery}
        >
          {isListening ? <MicOff /> : <Mic />}
        </button>
        <button 
          className="icon-button send-button" 
          onClick={() => handleSend()}
          disabled={!input.trim() || processingQuery}
        >
          <Send />
        </button>
      </div>

      {/* Voice feedback */}
      {isListening && (
        <div className="voice-feedback">
          <div className="voice-waves">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p className="transcript">{interimTranscript || "Listening..."}</p>
        </div>
      )}
    </div>
  );
};

export default CoPilot;
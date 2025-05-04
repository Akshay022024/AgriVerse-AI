import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signInUserAnonymously, getUserData } from './firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Mic, MicOff, Send, Volume2, VolumeX, Globe, Menu, X, Moon, Sun, RefreshCw } from 'lucide-react'; // Removed Camera
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import './CoPilot.css';

// Languages supported by the CoPilot
const languages = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu' },
  { code: 'hi', name: 'Hindi' }
];

// --- Text-to-Speech (TTS) - Using browser's built-in API ---
const synthesizeSpeech = async (text, language) => {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      reject("Browser doesn't support speech synthesis");
      return;
    }
    // Optional: Cancel any ongoing speech before starting new one
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language; // e.g., 'en-US', 'hi-IN', 'te-IN'
    utterance.onend = () => resolve();
    utterance.onerror = (err) => {
        console.error("Speech Synthesis Error:", err);
        reject(err);
    };
    synth.speak(utterance);
  });
};

// --- Speech-to-Text (STT) - Using browser's Web Speech API ---
const setupSpeechRecognition = (language, onResult, onEnd, onError) => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error("Speech recognition not supported in this browser");
    onError("Speech recognition not supported in this browser");
    return null; // Return null if not supported
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false; // Process after pause
  recognition.interimResults = true;
  recognition.lang = language; // e.g., 'en-US', 'hi-IN', 'te-IN'

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    onResult(finalTranscript || interimTranscript); // Send final or interim
  };

  recognition.onend = () => {
      onEnd(finalTranscript); // Send final transcript on end
      finalTranscript = ''; // Reset for next time
  };

  recognition.onerror = (event) => {
    console.error('Speech Recognition Error:', event.error);
    onError(`Speech recognition error: ${event.error}`);
  };

  return recognition; // Return the recognition object
};


// --- OpenRouter API Integration ---
// --- OpenRouter API Integration ---
const callOpenRouter = async (message, language, messageHistory) => {
  // Use import.meta.env for Vite environment variables
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
  const modelIdentifier = "mistralai/mistral-7b-instruct:free"; // Or your preferred Mixtral model

  // Check if the API key is loaded correctly
  if (!apiKey) {
    console.error("OpenRouter API key (VITE_OPENROUTER_API_KEY) is missing or not loaded. Check your .env file and ensure the Vite server was restarted.");
    // Provide a user-friendly message even if the key is missing configuration-wise
     const voiceLanguage = getVoiceLanguageCode(language);
     const missingKeyFallbacks = {
        'en-US': "API key is not configured. Please contact the administrator.",
        'hi-IN': "API कुंजी कॉन्फ़िगर नहीं है। कृपया व्यवस्थापक से संपर्क करें।",
        'te-IN': "API కీ కాన్ఫిగర్ చేయబడలేదు. దయచేసి నిర్వాహకుడిని సంప్రదించండి."
    };
    return missingKeyFallbacks[voiceLanguage] || missingKeyFallbacks['en-US'];
  }

  // Default system prompt
  const systemPrompt = `You are AgriverseAI CoPilot, an advanced agricultural assistant designed to help farmers, agricultural scientists, and gardeners.
Focus on providing expert advice about crops, soil management, weather patterns, pest control, sustainable farming practices,
agricultural equipment, and the latest research in agriculture. The user communicates in ${getLanguageName(language)}.
Please respond concisely and accurately in the ${getLanguageName(language)} language.`;

  // Prepare message history for the API call
  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messageHistory.slice(-6).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
    })),
    { role: "user", content: message }
  ];

  try {
    const response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Set Referer based on your actual deployment URL or development environment
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AgriverseAI CoPilot', // Your app's name
      },
      body: JSON.stringify({
        model: modelIdentifier,
        messages: apiMessages,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API Error:', response.status, errorData);
      throw new Error(`API error ${response.status}: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
       return data.choices[0].message.content.trim();
    } else {
        console.error('Invalid response structure from OpenRouter:', data);
        throw new Error("Received an invalid response from the AI.");
    }

  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    const voiceLanguage = getVoiceLanguageCode(language);
    const fallbacks = {
      'en-US': `I'm sorry, I encountered an issue connecting to the AI service (${error.message}). Please try again later.`,
      'hi-IN': `मुझे खेद है, मुझे AI सेवा (${error.message}) से कनेक्ट करने में समस्या आई। कृपया बाद में पुन: प्रयास करें।`,
      'te-IN': `క్షమించండి, నేను AI సేవకు (${error.message}) కనెక్ట్ చేయడంలో సమస్యను ఎదుర్కొన్నాను. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి.`
    };
    return fallbacks[voiceLanguage] || fallbacks['en-US'];
  }
};
// Helper function to get full language name from code
const getLanguageName = (code) => {
  const lang = languages.find(l => l.code === code); // Match directly with 'en', 'te', 'hi'
  return lang ? lang.name : 'English';
};

// Map language codes to voice recognition/synthesis language codes
const getVoiceLanguageCode = (code) => {
  const mapping = {
    'en': 'en-US',
    'hi': 'hi-IN',
    'te': 'te-IN'
  };
  return mapping[code] || 'en-US'; // Default to US English
};


// --- CoPilot Component ---
const CoPilot = () => {
  // State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState('en'); // Use 'en', 'te', 'hi'
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingQuery, setProcessingQuery] = useState(false);
  const [sttError, setSttError] = useState(null); // State for STT errors

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null); // Ref to store the recognition object
  const synthRef = useRef(window.speechSynthesis); // Ref for speech synthesis

  // Authenticate user on component mount
  useEffect(() => {
    const authInstance = getAuth(); // Use getAuth()
    const unsubscribeAuth = onAuthStateChanged(authInstance, async (currentUser) => {
      if (!currentUser) {
        console.log("No user found, signing in anonymously...");
        try {
            const newUser = await signInUserAnonymously();
            setUser(newUser);
        } catch (error) {
            console.error("Anonymous sign-in error:", error);
            // Handle sign-in error (e.g., show message to user)
            setLoading(false);
        }
      } else {
        console.log("User found:", currentUser.uid);
        setUser(currentUser);
      }
    });

    return () => unsubscribeAuth(); // Cleanup auth listener
  }, []);


  // Load user data (preferences and messages) once user is authenticated
  useEffect(() => {
      if (!user) {
          setLoading(false); // If user becomes null after initial load, stop loading
          return;
      }

      setLoading(true); // Start loading when user object is available
      let unsubscribeMessages = null;

      const loadData = async () => {
          try {
              // Load preferences
              const userData = await getUserData(); // Assuming getUserData fetches for the current user
              if (userData && userData.preferences) {
                  setLanguage(userData.preferences.language || 'en');
                  setDarkMode(userData.preferences.darkMode || false);
              }

              // Load messages
              const messagesRef = collection(db, "users", user.uid, "messages");
              const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));

              unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
                  const loadedMessages = [];
                  querySnapshot.forEach((doc) => {
                      // Ensure timestamp exists and convert if necessary
                      const data = doc.data();
                      let timestamp = data.timestamp;
                      if (timestamp && typeof timestamp.toDate === 'function') {
                          timestamp = timestamp.toDate().toISOString(); // Convert Firestore Timestamp to ISO string
                      } else if (timestamp && typeof timestamp === 'string') {
                          // Assume it's already an ISO string (or handle other formats)
                      } else {
                          timestamp = new Date().toISOString(); // Fallback timestamp
                      }

                      loadedMessages.push({ id: doc.id, ...data, timestamp });
                  });
                  setMessages(loadedMessages);
                  setLoading(false); // Stop loading after messages are loaded
              }, (error) => {
                  console.error("Error loading messages:", error);
                  setLoading(false); // Stop loading on error
              });

          } catch (error) {
              console.error("Error loading user data:", error);
              setLoading(false); // Stop loading on error
          }
      };

      loadData();

      // Cleanup Firestore listener
      return () => {
          if (unsubscribeMessages) {
              unsubscribeMessages();
          }
      };
  }, [user]); // Rerun when user changes


  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // Setup speech recognition instance when component mounts or language changes
  useEffect(() => {
    const voiceLanguage = getVoiceLanguageCode(language);

    // Cleanup previous instance if exists
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }

    recognitionRef.current = setupSpeechRecognition(
      voiceLanguage,
      (transcript) => { // onResult
        setInterimTranscript(transcript); // Show interim results in UI
      },
      (finalTranscript) => { // onEnd (provides final transcript)
        setIsListening(false);
        setInterimTranscript(''); // Clear interim
        if (finalTranscript.trim()) {
          setInput(finalTranscript); // Put final transcript in input box
          handleSend(finalTranscript); // Send the final transcript
        }
      },
      (error) => { // onError
          setSttError(error);
          setIsListening(false); // Stop listening state on error
          setInterimTranscript('');
      }
    );

    // Cleanup function to stop recognition if component unmounts while listening
    return () => {
      if (recognitionRef.current) {
          recognitionRef.current.stop();
      }
      // Cancel any ongoing speech synthesis
      if(synthRef.current) {
          synthRef.current.cancel();
      }
    };
  }, [language]); // Re-setup when language changes


  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    // Optional: Cleanup class on component unmount
    // return () => document.body.classList.remove('dark-mode');
  }, [darkMode]);


  // Toggle speech recognition
  const toggleListening = () => {
    if (!recognitionRef.current) {
        setSttError("Speech recognition is not available.");
        return;
    }

    if (isListening) {
      recognitionRef.current.stop(); // Stop will trigger onEnd
      setIsListening(false);
    } else {
      setSttError(null); // Clear previous errors
      setInput(''); // Clear input field when starting voice
      setInterimTranscript('Listening...');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
          // Catch potential errors on start (e.g., mic not available)
          console.error("Error starting speech recognition:", error);
          setSttError(`Could not start listening: ${error.message}`);
          setIsListening(false);
          setInterimTranscript('');
      }
    }
  };


  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Save message to Firestore
  const saveMessage = async (message) => {
    if (!user) {
        console.error("Cannot save message, user not authenticated.");
        return; // Don't save if user is not available
    }

    try {
      const messagesRef = collection(db, "users", user.uid, "messages");
      await addDoc(messagesRef, {
        ...message,
        // Use Firestore server timestamp for reliable ordering
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving message to Firestore:", error);
    }
  };


  // Handle send message (triggered by button click, Enter key, or voice input end)
  const handleSend = async (text = null) => {
    const messageText = (text || input).trim(); // Use provided text (from voice) or current input value
    if (!messageText || processingQuery) return; // Don't send empty or while processing

    // Optimistically add user message to UI
    const userMessage = {
      content: messageText,
      sender: 'user',
      // Use client-side timestamp for immediate display, Firestore timestamp for storage
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    saveMessage(userMessage); // Save to Firestore (includes server timestamp)
    setInput(''); // Clear input field
    setInterimTranscript('');
    setProcessingQuery(true); // Set processing state


    // Get AI response from OpenRouter
    try {
      // Pass the current language and message history
      const response = await callOpenRouter(messageText, language, messages);

      // Add AI response to UI
      const aiMessage = {
        content: response,
        sender: 'ai',
        timestamp: new Date().toISOString() // Client-side timestamp for UI
      };
      setMessages(prev => [...prev, aiMessage]);
      saveMessage(aiMessage); // Save AI message to Firestore

      // Speak response if enabled
      if (isSpeaking) {
          const voiceLanguage = getVoiceLanguageCode(language);
          await synthesizeSpeech(response, voiceLanguage);
      }

    } catch (error) {
      // Error handling is mostly done within callOpenRouter, but catch any unexpected errors here
      console.error("Error in handleSend after API call:", error);
       // Add error message to UI
      const errorMessage = {
        content: "An unexpected error occurred while processing your request.",
        sender: 'ai',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      saveMessage(errorMessage); // Optionally save error message

    } finally {
      setProcessingQuery(false); // Reset processing state
    }
  };


  // Toggle speech synthesis output
  const toggleSpeech = () => {
      const newSpeakingState = !isSpeaking;
      setIsSpeaking(newSpeakingState);
      if (!newSpeakingState && synthRef.current) {
          // If turning speech off, stop any current speech
          synthRef.current.cancel();
      }
  };

  // Toggle language menu visibility
  const toggleLangMenu = () => {
    setLangMenuOpen(!langMenuOpen);
  };

  // Change UI language and save preference
  const changeLanguage = (code) => {
    setLanguage(code);
    setLangMenuOpen(false);

    // Save preference to user profile in Firestore
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        // Use updateDoc for merging, setDoc would overwrite
        updateDoc(userRef, {
          "preferences.language": code
        }).catch(err => console.error("Error saving language preference:", err));
      } catch (error) {
        console.error("Error accessing userRef for language preference:", error);
      }
    }
  };


  // Toggle dark mode and save preference
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    // Save preference to user profile
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, {
          "preferences.darkMode": newMode
        }).catch(err => console.error("Error saving dark mode preference:", err));
      } catch (error) {
        console.error("Error accessing userRef for dark mode preference:", error);
      }
    }
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // --- Render Logic ---

  // Loading state
  if (loading) {
    return (
      <div className="copilot-loading">
        <RefreshCw className="loading-icon spin" size={48} />
        <p>Loading AgriverseAI CoPilot...</p>
      </div>
    );
  }

  // Main component structure
  return (
    <div className={`copilot-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* Header */}
      <header className="copilot-header">
        <div className="header-left">
          <button className="icon-button" onClick={toggleSidebar} aria-label="Open settings menu">
            <Menu />
          </button>
          <h1>AgriverseAI CoPilot</h1>
          {/* Removed Ollama Status */}
        </div>
        <div className="header-actions">
          <button
            className={`icon-button ${isSpeaking ? 'active' : ''}`}
            onClick={toggleSpeech}
            title={isSpeaking ? "Mute voice output" : "Enable voice output"}
            aria-pressed={isSpeaking}
          >
            {isSpeaking ? <Volume2 /> : <VolumeX />}
          </button>
          <div className="language-selector-container"> {/* Wrapper for positioning */}
            <button
              className="icon-button"
              onClick={toggleLangMenu}
              title="Change language"
              aria-haspopup="true"
              aria-expanded={langMenuOpen}
            >
              <Globe />
            </button>
            {/* Language Menu */}
            {langMenuOpen && (
                <div className="language-menu" role="menu">
                {languages.map((lang) => (
                    <button
                    key={lang.code}
                    role="menuitem"
                    className={language === lang.code ? 'active' : ''}
                    onClick={() => changeLanguage(lang.code)}
                    >
                    {lang.name}
                    </button>
                ))}
                </div>
            )}
          </div>
          <button
            className="icon-button"
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to Light mode" : "Switch to Dark mode"}
            aria-pressed={darkMode}
          >
            {darkMode ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`copilot-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Settings</h2>
          <button className="icon-button" onClick={toggleSidebar} aria-label="Close settings menu">
            <X />
          </button>
        </div>
        <div className="sidebar-content">
          {/* Removed Ollama Status Section */}
          <div className="sidebar-section">
            <h3>Voice Settings</h3>
            <div className="setting-row">
              <span>Voice Output</span>
              <button
                className={`toggle-button ${isSpeaking ? 'active' : ''}`}
                onClick={toggleSpeech}
                aria-pressed={isSpeaking}
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
                 aria-pressed={darkMode}
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
                  aria-pressed={language === lang.code}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Messages Area */}
      <main className="copilot-messages">
        {messages.length === 0 && !processingQuery ? (
          <div className="empty-state">
            <div className="welcome-message">
              <h2>Welcome to AgriverseAI CoPilot</h2>
              <p>Ask me anything about farming, crops, soil, weather, or agricultural practices.</p>
              {/* Removed Ollama warning */}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id || `msg-${index}`} // Use Firestore ID if available, otherwise fallback
              className={`message ${message.sender}`} // 'user' or 'ai'
            >
              <div className="message-bubble">
                {/* Basic Markdown rendering (bold/italics) could be added here if needed */}
                <p>{message.content}</p>
              </div>
              <div className="message-time">
                 {/* Format timestamp nicely */}
                 {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
              </div>
            </div>
          ))
        )}
        {/* Typing indicator shown when processingQuery is true */}
        {processingQuery && (
          <div className="message ai typing">
            <div className="message-bubble">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        {/* Invisible div to target for scrolling */}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="copilot-input-area">
          {/* STT Error Display */}
          {sttError && <div className="stt-error-message" role="alert">{sttError}</div>}

          <div className="copilot-input">
              <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} // Send on Enter, allow Shift+Enter for newline
              placeholder={isListening ? "Listening..." : "Type your message or use the mic..."}
              disabled={processingQuery} // Disable input while AI is responding
              aria-label="Message input"
              />
              <button
              className={`icon-button mic-button ${isListening ? 'active' : ''}`}
              onClick={toggleListening}
              disabled={processingQuery} // Disable mic while AI is responding
              title={isListening ? "Stop listening" : "Start listening"}
              aria-pressed={isListening}
              >
              {isListening ? <MicOff /> : <Mic />}
              </button>
              <button
              className="icon-button send-button"
              onClick={() => handleSend()}
              disabled={!input.trim() || processingQuery || isListening} // Disable send if input empty, processing, or listening
              title="Send message"
              aria-label="Send message"
              >
              <Send />
              </button>
          </div>

          {/* Voice listening feedback */}
          {isListening && (
              <div className="voice-feedback">
              <div className="voice-waves"> {/* Simple animation */}
                  <span></span><span></span><span></span><span></span><span></span>
              </div>
              {/* Show interim transcript while listening */}
              <p className="transcript" aria-live="polite">{interimTranscript || " "}</p>
              </div>
          )}
      </footer>
    </div>
  );
};

export default CoPilot;
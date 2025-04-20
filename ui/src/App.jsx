// App.js
import React, { useState, useEffect } from 'react';
import { Sun, Cloud, Leaf, BarChart2, Droplet, CreditCard, Calendar, MessageSquare, Users, Settings, Home, Search, User, Mic, Bot } from 'lucide-react';
import './App.css';
import VirtualFarmTwin from './VirtualFarmTwin'; 

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('home'); // Track active navigation tab
  
  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 250);
    
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 5000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  
  const FeaturedContent = ({ title, icon }) => (
    <div className="flex flex-col items-center p-3">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 border-2 border-green-500">
        {icon}
      </div>
      <span className="text-xs text-green-800 font-medium">{title}</span>
    </div>
  );
  
  // Handle navigation click
  const handleNavClick = (tabName) => {
    setActiveTab(tabName);
  };
  
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
              <div 
                className="loading-progress" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="loading-text">{loadingProgress}% Loading...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Render the appropriate content based on active tab
  const renderContent = () => {
    switch(activeTab) {
      case 'virtualFarmTwin':
        return <VirtualFarmTwin />;
      case 'home':
      default:
        return (
          <>
            {/* Main Content Area */}
            <div className="main-content-area">
              {/* Featured Content Slider */}
              <div className="featured-section">
                <h2 className="section-title">Featured Content</h2>
                <div className="featured-content">
                  <FeaturedContent title="Weather Updates" icon={<Cloud size={24} color="#4CAF50" />} />
                  <FeaturedContent title="Crop Calendar" icon={<Calendar size={24} color="#4CAF50" />} />
                  <FeaturedContent title="Water Management" icon={<Droplet size={24} color="#4CAF50" />} />
                  <FeaturedContent title="Soil Analysis" icon={<BarChart2 size={24} color="#4CAF50" />} />
                  <FeaturedContent title="Market Prices" icon={<CreditCard size={24} color="#4CAF50" />} />
                  <FeaturedContent title="Smart Irrigation" icon={<Droplet size={24} color="#4CAF50" />} />
                </div>
              </div>
              
              {/* Content Cards */}
              <div className="content-cards">
                <div className="content-card">
                  <h3>Crop Insights</h3>
                  <p>Recent analysis of your fields shows optimal growth patterns. Review the detailed report for more information.</p>
                </div>
                <div className="content-card">
                  <h3>Resource Optimization</h3>
                  <p>Your irrigation system is operating at 94% efficiency. AI suggestions have helped reduce water usage by 17%.</p>
                </div>
                <div className="content-card">
                  <h3>Weather Forecast</h3>
                  <p>Expected rainfall in the next 7 days: 22mm. Plan your field operations accordingly.</p>
                </div>
              </div>
            </div>
          </>
        );
    }
  };
  
  return (
    <div className="app-container">
      {/* Left Sidebar Navigation */}
      <div className="sidebar">
        <div className="logo-small">
          <Leaf size={32} color="#2E7D32" />
          <h2>AgriVerse</h2>
        </div>
        
        <nav className="sidebar-menu">
          <a 
            href="#" 
            className={`menu-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            <Home size={24} />
            <span>Home</span>
          </a>
          <a 
            href="#" 
            className={`menu-item ${activeTab === 'virtualFarmTwin' ? 'active' : ''}`}
            onClick={() => handleNavClick('virtualFarmTwin')}
          >
            <Sun size={24} />
            <span>Virtual Farm Twin</span>
          </a>
          <a 
            href="#" 
            className={`menu-item ${activeTab === 'copilot' ? 'active' : ''}`}
            onClick={() => handleNavClick('copilot')}
          >
            <Users size={24} />
            <span>Copilot</span>
          </a>
          <a 
            href="#" 
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard')}
          >
            <BarChart2 size={24} />
            <span>Dashboard</span>
          </a>
          <a 
            href="#" 
            className={`menu-item ${activeTab === 'finance' ? 'active' : ''}`}
            onClick={() => handleNavClick('finance')}
          >
            <CreditCard size={24} />
            <span>Finance</span>
          </a>
        </nav>
        
        <div className="sidebar-footer">
          <a href="#" className="menu-item">
            <Settings size={24} />
            <span>Settings</span>
          </a>
          <div className="user-profile">
            <div className="avatar">
              <User size={24} />
            </div>
            <span>John Farmer</span>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Medium-sized Search Bar (Gemini style) */}
        <div className="gemini-search-container">
          <div className="search-input-wrapper">
            <div className="search-icon">
              <Search size={16} color="#2E7D32" />
            </div>
            <input type="text" placeholder="Ask AgriVerse AI..." />
            <div className="search-actions">
              <button className="search-action-button">
                <Mic size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Render content based on active tab */}
        {renderContent()}
      </div>
      
      {/* Right Sidebar Container - Same size as nav bar */}
      <div className="right-sidebar">
        <div className="right-container">
          <h2 className="container-title">Additional Tools</h2>
          <div className="sidebar-content">
            <p>This container has the same width as the navigation bar. Add your custom content here.</p>
            <div className="placeholder-box"></div>
            <div className="placeholder-box"></div>
            <div className="placeholder-item">
              <div className="placeholder-icon"></div>
              <div className="placeholder-text">
                <div className="text-line"></div>
                <div className="text-line short"></div>
              </div>
            </div>
            <div className="placeholder-item">
              <div className="placeholder-icon"></div>
              <div className="placeholder-text">
                <div className="text-line"></div>
                <div className="text-line short"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chatbot and Voice Assistant Button */}
      <div className="assistant-buttons">
        <button className="assistant-button chat-button">
          <Bot size={28} />
        </button>
        <button className="assistant-button voice-button">
          <Mic size={28} />
        </button>
      </div>
    </div>
  );
};

export default App;
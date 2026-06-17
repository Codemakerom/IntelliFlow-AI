import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Heatmap from './components/Heatmap';
import Planner from './components/Planner';
import LearningEngine from './components/LearningEngine';
import CommandCenter from './components/CommandCenter';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_api_key') || '');
  const [predictionContext, setPredictionContext] = useState(null);

  const handleEventEnd = (predData) => {
    setPredictionContext(predData);
    setActiveTab('learning');
  };

  const handleKeyChange = (val) => {
    setGroqKey(val);
    localStorage.setItem('groq_api_key', val);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'heatmap':
        return <Heatmap />;
      case 'planner':
        return <Planner onEventEnd={handleEventEnd} />;
      case 'learning':
        return <LearningEngine predictionContext={predictionContext} />;
      case 'command':
        return <CommandCenter />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Operational Analytics Dashboard', desc: 'Real-time overview of historical Bangalore traffic incidents.' };
      case 'heatmap':
        return { title: 'Spatial Congestion Heatmap', desc: 'Visualize hourly risk distributions across municipal zones.' };
      case 'planner':
        return { title: 'Event Planner & Predictor', desc: 'Forecast incident impact and auto-calculate police deployment configurations.' };
      case 'learning':
        return { title: 'Continuous Learning Engine', desc: 'Log real-world outcomes and auto-calibrate ML model accuracy.' };
      case 'command':
        return { title: 'Smart City Command Center', desc: 'Futuristic AI-powered anomaly detection and predictive grid overlays.' };
      default:
        return { title: 'GridLock Control Center', desc: '' };
    }
  };

  const page = getPageTitle();

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="2" width="8" height="20" rx="2" />
              <circle cx="12" cy="7" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="17" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="logo-text">
            <h1>GridLock</h1>
            <p>Control Center</p>
          </div>
        </div>

        <ul className="nav-links">
          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
              <span>Dashboard</span>
            </button>
          </li>
          
          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'heatmap' ? 'active' : ''}`}
              onClick={() => setActiveTab('heatmap')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span>Traffic Heatmap</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Event Planner</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'learning' ? 'active' : ''}`}
              onClick={() => setActiveTab('learning')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 2a9.96 9.96 0 0 0-7.07 2.93A10 10 0 1 0 22 12c0-5.52-4.48-10-10-10z"/>
                <path d="M12 8v4l3 3"/>
              </svg>
              <span>Learning Engine</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'command' ? 'active' : ''}`}
              onClick={() => setActiveTab('command')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
              </svg>
              <span>Command Center</span>
            </button>
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>{page.title}</h2>
            <p>{page.desc}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="system-status">
              <span className="status-dot"></span>
              <span>API: Active</span>
            </div>
          </div>
        </header>

        {/* Dynamic Panel */}
        <section className="tab-content-container">
          {renderContent()}
        </section>
      </main>
    </div>
  );
}

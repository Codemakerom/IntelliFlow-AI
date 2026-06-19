import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Heatmap from './components/Heatmap';
import Planner from './components/Planner';
import LearningEngine from './components/LearningEngine';
import CommandCenter from './components/CommandCenter';
import Settings from './components/Settings';
import Analytics from './components/Analytics';
import CollisionDetector from './components/CollisionDetector';
import { translations } from './translations';
import heroImage from './assets/hero.png';
import heatmapHeroImage from './assets/heatmap_hero.png';
import plannerHeroImage from './assets/planner_hero.png';
import learningHeroImage from './assets/learning_hero.png';

const getTabIcon = (tab) => {
  switch (tab) {
    case 'dashboard':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#ea750e">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'heatmap':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      );
    case 'planner':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'learning':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a9.96 9.96 0 0 0-7.07 2.93A10 10 0 1 0 22 12c0-5.52-4.48-10-10-10z"/>
          <path d="M12 8v4l3 3"/>
        </svg>
      );
    case 'command':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        </svg>
      );
    case 'exports':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'collision':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="12" r="4" />
          <circle cx="17" cy="12" r="4" />
          <line x1="11" y1="9" x2="13" y2="15" />
          <line x1="13" y1="9" x2="11" y2="15" />
        </svg>
      );
    case 'settings':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea750e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [predictionContext, setPredictionContext] = useState(null);
  const [language, setLanguage] = useState('en');

  // Field Commanders / Personnel state
  const [personnel, setPersonnel] = useState(() => {
    const saved = localStorage.getItem('gridlock_personnel');
    return saved ? JSON.parse(saved) : [
      { name: 'Inspector Shivanna (Mysore Road)', phone: '+919876543210' },
      { name: 'ACP Gowda (Central Division)', phone: '+918765432109' },
      { name: 'Inspector Ramachandra (West Division)', phone: '+919988776655' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('gridlock_personnel', JSON.stringify(personnel));
  }, [personnel]);

  const handleEventEnd = (predData) => {
    setPredictionContext(predData);
    setActiveTab('learning');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard language={language} setLanguage={setLanguage} />;
      case 'heatmap':
        return <Heatmap language={language} />;
      case 'planner':
        return <Planner onEventEnd={handleEventEnd} personnel={personnel} language={language} />;
      case 'learning':
        return <LearningEngine predictionContext={predictionContext} language={language} />;
      case 'command':
        return <CommandCenter language={language} />;
      case 'collision':
        return <CollisionDetector language={language} />;
      case 'settings':
        return (
          <Settings 
            personnel={personnel} 
            setPersonnel={setPersonnel} 
            language={language}
          />
        );
      case 'exports':
        return <Analytics language={language} />;
      default:
        return <Dashboard language={language} setLanguage={setLanguage} />;
    }
  };

  const getPageTitle = () => {
    const t = translations[language];
    switch (activeTab) {
      case 'dashboard':
        return { title: t.dashboard, desc: t.dashboard_desc };
      case 'heatmap':
        return { title: t.heatmap, desc: t.heatmap_desc };
      case 'planner':
        return { title: t.planner, desc: t.planner_desc };
      case 'learning':
        return { title: t.learning, desc: t.learning_desc };
      case 'command':
        return { title: t.command, desc: t.command_desc };
      case 'collision':
        return { title: 'Collision Detector', desc: 'Detect where simultaneous events collide and compute compound traffic impact scores' };
      case 'settings':
        return { title: t.settings, desc: t.settings_desc };
      case 'exports':
        return { title: t.exports, desc: t.exports_desc };
      default:
        return { title: t.control_center, desc: '' };
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
            <p>{translations[language].control_center}</p>
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
              <span>{translations[language].dashboard}</span>
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
              <span>{translations[language].heatmap}</span>
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
              <span>{translations[language].planner}</span>
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
              <span>{translations[language].learning}</span>
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
              <span>{translations[language].command}</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'collision' ? 'active' : ''}`}
              onClick={() => setActiveTab('collision')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="12" r="4" />
                <circle cx="17" cy="12" r="4" />
                <line x1="11" y1="9" x2="13" y2="15" />
                <line x1="13" y1="9" x2="11" y2="15" />
              </svg>
              <span>Collision Detector</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'exports' ? 'active' : ''}`}
              onClick={() => setActiveTab('exports')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{translations[language].exports}</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>{translations[language].settings}</span>
            </button>
          </li>
        </ul>

        {/* Sidebar Footer with API Status */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* API Status Pill */}
          <div className="system-status" style={{
            justifyContent: 'center',
            background: '#e8f5e9',
            border: '1px solid rgba(52, 199, 89, 0.2)'
          }}>
            <span className="status-dot"></span>
            <span>{translations[language].api_active}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Premium Banner Header Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(234, 117, 14, 0.04) 0%, rgba(255, 255, 255, 0.9) 60%, #ffffff 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border-color)',
          padding: '32px 40px',
          marginBottom: '36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.03)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '145px'
        }}>
          {/* Left Side: Icon, Title & Switch Button, Line & Desc */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 2, position: 'relative', maxWidth: '65%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {getTabIcon(activeTab)}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <h2 style={{ 
                    fontSize: '2.4rem', 
                    fontWeight: 800, 
                    color: 'var(--text-dark)', 
                    margin: 0, 
                    letterSpacing: '-0.8px', 
                    lineHeight: 1,
                    fontFamily: 'var(--font-display)'
                  }}>
                    {page.title}
                  </h2>
                  {activeTab === 'dashboard' && (
                    <button 
                      className="lang-toggle-btn"
                      onClick={() => setLanguage(language === 'en' ? 'kn' : 'en')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 18px',
                        borderRadius: '24px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                        color: 'white',
                        fontWeight: '800',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                        transition: 'all 0.2s ease',
                        fontFamily: 'var(--font-body)',
                        marginTop: '2px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(124, 58, 237, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 58, 237, 0.35)';
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>🌐</span>
                      <span>{language === 'en' ? 'Switch to ಕನ್ನಡ' : 'Switch to English'}</span>
                    </button>
                  )}
                </div>
                <div style={{ width: '44px', height: '4px', background: 'var(--primary)', borderRadius: '2px', marginTop: '8px' }} />
              </div>
            </div>
            
            <p style={{ 
              fontSize: '0.96rem', 
              color: 'var(--text-muted)', 
              fontWeight: 500, 
              margin: 0,
              lineHeight: 1.4,
              fontFamily: 'var(--font-body)',
              paddingLeft: '2px'
            }}>
              {page.desc}
            </p>
          </div>

          {/* Transparent City Skyline Vector Image */}
          <img 
            src={activeTab === 'heatmap' ? heatmapHeroImage : activeTab === 'planner' ? plannerHeroImage : activeTab === 'learning' ? learningHeroImage : heroImage} 
            alt="" 
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              height: '100%',
              width: 'auto',
              zIndex: 1,
              opacity: 0.95,
              pointerEvents: 'none',
              mixBlendMode: 'multiply',
              WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 15%)',
              maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 15%)'
            }}
          />
        </div>

        {/* Dynamic Panel */}
        <section className="tab-content-container">
          {renderContent()}
        </section>
      </main>
    </div>
  );
}

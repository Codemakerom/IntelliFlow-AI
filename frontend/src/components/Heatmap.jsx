import React, { useEffect, useState, useRef } from 'react';
import { translations } from '../translations';

const zoneCoordinates = {
  'Central Zone 1': [12.9720, 77.6194],
  'Central Zone 2': [12.9779, 77.5719],
  'East Zone 1': [12.9658, 77.6580],
  'East Zone 2': [12.9235, 77.6550],
  'North Zone 1': [12.9999, 77.6634],
  'North Zone 2': [12.9986, 77.5841],
  'South Zone 1': [12.9161, 77.5934],
  'South Zone 2': [12.9428, 77.6028],
  'West Zone 1': [12.9556, 77.5857],
  'West Zone 2': [12.9757, 77.5595],
};

const corridorTranslationsKn = {
  'Mysore Road': 'ಮೈಸೂರು ರಸ್ತೆ',
  'Bellary Road 1': 'ಬಳ್ಳಾರಿ ರಸ್ತೆ 1',
  'Tumkur Road': 'ತುಮಕೂರು ರಸ್ತೆ',
  'Bellary Road 2': 'ಬಳ್ಳಾರಿ ರಸ್ತೆ 2',
  'Hosur Road': 'ಹೊಸೂರು ರಸ್ತೆ',
  'ORR North 1': 'ಹೊರ ವರ್ತುಲ ರಸ್ತೆ ಉತ್ತರ 1',
  'Old Madras Road': 'ಹಳೇ ಮದ್ರಾಸ್ ರಸ್ತೆ',
  'Magadi Road': 'ಮಾಗಡಿ ರಸ್ತೆ',
  'ORR East 1': 'ಹೊರ ವರ್ತುಲ ರಸ್ತೆ ಪೂರ್ವ 1',
  'Non-corridor': 'ಕಾರಿಡಾರ್ ಅಲ್ಲದ ರಸ್ತೆ'
};

const zoneTranslationsKn = {
  'Central Zone 1': 'ಮಧ್ಯ ವಲಯ 1',
  'Central Zone 2': 'ಮಧ್ಯ ವಲಯ 2',
  'East Zone 1': 'ಪೂರ್ವ ವಲಯ 1',
  'East Zone 2': 'ಪೂರ್ವ ವಲಯ 2',
  'North Zone 1': 'ಉತ್ತರ ವಲಯ 1',
  'North Zone 2': 'ಉತ್ತರ ವಲಯ 2',
  'South Zone 1': 'ದಕ್ಷಿಣ ವಲಯ 1',
  'South Zone 2': 'ದಕ್ಷಿಣ ವಲಯ 2',
  'West Zone 1': 'ಪಶ್ಚಿಮ ವಲಯ 1',
  'West Zone 2': 'ಪಶ್ಚಿಮ ವಲಯ 2'
};

export default function Heatmap({ language }) {
  const [data, setData] = useState([]);
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHour, setSelectedHour] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showJunctions, setShowJunctions] = useState(true);
  
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const junctionLayerGroupRef = useRef(null);

  const t = translations[language] || translations.en;
  const translateZone = (zone) => language === 'kn' ? (zoneTranslationsKn[zone] || zone) : zone;

  useEffect(() => {
    // Fetch heatmap zones & top junctions in parallel
    Promise.all([
      fetch('http://localhost:8000/api/heatmap').then((res) => {
        if (!res.ok) throw new Error('Failed to fetch heatmap data');
        return res.json();
      }),
      fetch('http://localhost:8000/api/top-junctions').then((res) => {
        if (!res.ok) throw new Error('Failed to fetch top junctions');
        return res.json();
      })
    ])
      .then(([heatmapJson, junctionsJson]) => {
        setData(heatmapJson);
        setJunctions(junctionsJson);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Cycle hour automatically when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedHour((prev) => (prev + 1) % 24);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Map Initialization
  useEffect(() => {
    if (loading || error) return;
    const L = window.L;
    if (!L) {
      console.error("Leaflet is not loaded.");
      return;
    }

    const container = document.getElementById('spatial-hotspot-map');
    if (!container) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        console.error(e);
      }
      mapRef.current = null;
    }

    // Initialize map centered on Bangalore
    const map = L.map('spatial-hotspot-map').setView([12.9716, 77.5946], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    junctionLayerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
          mapRef.current = null;
      }
    };
  }, [loading, error]);

  // Update Map overlays when selectedHour, showJunctions, or data changes
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !layerGroupRef.current || !junctionLayerGroupRef.current) return;

    // 1. Draw Zone heat circles (using fixed screen pixel size circleMarker to prevent overlapping!)
    layerGroupRef.current.clearLayers();
    const hourData = data.filter((item) => item.hour === selectedHour);

    hourData.forEach((cell) => {
      const zoneName = cell.zone;
      let coords = zoneCoordinates[zoneName];
      if (!coords) {
        const hash = zoneName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        coords = [
          12.9716 + ((hash % 100) - 50) * 0.0015,
          77.5946 + (((hash / 100) % 100) - 50) * 0.0015
        ];
      }

      const risk = cell.congestion_risk || 0;
      
      let color = '#34c759'; // Low: Green
      let fillOpacity = 0.55;
      
      if (risk >= 75) {
        color = '#d32f2f'; // Critical: Crimson/Dark Red
        fillOpacity = 0.75;
      } else if (risk >= 50) {
        color = '#f57c00'; // High: Orange-Red
        fillOpacity = 0.65;
      } else if (risk >= 25) {
        color = '#fbc02d'; // Medium: Yellow-Orange
        fillOpacity = 0.6;
      }

      // Compact fixed radius in pixels (prevents overlapping issues entirely!)
      const radius = 12 + Math.sqrt(risk) * 1.0;

      const circle = L.circleMarker(coords, {
        color: color,
        fillColor: color,
        fillOpacity: fillOpacity,
        radius: radius,
        weight: 1.5,
        opacity: 0.8
      });

      const popupContent = `
        <div style="font-family: inherit; font-size: 0.85rem; padding: 4px; line-height: 1.5;">
          <strong style="font-size: 0.95rem; color: var(--primary);">${translateZone(zoneName)}</strong><br/>
          <strong>${language === 'kn' ? 'ಸಮಯ' : 'Time'}:</strong> ${selectedHour.toString().padStart(2, '0')}:00h<br/>
          <strong>${language === 'kn' ? 'ದಟ್ಟಣೆ ಅಪಾಯ' : 'Congestion Risk'}:</strong> <span style="color: ${color}; font-weight: 700;">${risk.toFixed(1)}%</span><br/>
          <strong>${language === 'kn' ? 'ಸಂಚಾರ ಮಟ್ಟ' : 'Traffic Level'}:</strong> <span style="color: ${color}; font-weight: 700;">${language === 'kn' ? (cell.risk_label === 'Low' ? 'ಕಡಿಮೆ' : cell.risk_label === 'Medium' ? 'ಮಧ್ಯಮ' : 'ಹೆಚ್ಚು') : cell.risk_label || 'Low'}</span><br/>
          <strong>${language === 'kn' ? 'ಒಟ್ಟು ಘಟನೆಗಳು' : 'Past Events Count'}:</strong> ${cell.event_count || 0}<br/>
          <strong>${language === 'kn' ? 'ರಸ್ತೆ ಮುಚ್ಚುವಿಕೆಗಳು' : 'Road Closures'}:</strong> ${cell.road_closures || 0}<br/>
          <strong>${language === 'kn' ? 'ಸರಾಸರಿ ಪ್ರಯಾಣ ವಿಳಂಬ' : 'Avg Travel Delay'}:</strong> ${cell.avg_delay ? cell.avg_delay.toFixed(1) : 0} ${language === 'kn' ? 'ನಿಮಿಷ' : 'mins'}
        </div>
      `;

      circle.bindPopup(popupContent);
      layerGroupRef.current.addLayer(circle);
    });

    // 2. Draw Barricade Junction Pins (markers analyzed by model)
    junctionLayerGroupRef.current.clearLayers();
    if (showJunctions && junctions.length > 0) {
      const pinIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [16, 26],
        iconAnchor: [8, 26],
        popupAnchor: [1, -22],
        shadowSize: [26, 26]
      });

      junctions.forEach((junc) => {
        const lat = parseFloat(junc.avg_lat);
        const lon = parseFloat(junc.avg_lon);
        if (!lat || !lon) return;

        const marker = L.marker([lat, lon], { icon: pinIcon });
        
        const popupContent = `
          <div style="font-family: inherit; font-size: 0.85rem; padding: 4px; line-height: 1.5;">
            <strong style="font-size: 0.92rem; color: #f57c00;">📍 ${language === 'kn' ? 'ವಿಶ್ಲೇಷಿಸಿದ ಜಂಕ್ಷನ್' : 'Barricade Junction Analyzed'}</strong><br/>
            <span style="font-weight: 700; color: var(--text-dark);">${junc.junction}</span><br/>
            <strong>${language === 'kn' ? 'ಕಾರಿಡಾರ್' : 'Corridor'}:</strong> ${language === 'kn' ? (corridorTranslationsKn[junc.corridor] || junc.corridor) : junc.corridor}<br/>
            <strong>${language === 'kn' ? 'ಬ್ಯಾರಿಕೇಡ್ ಆದ್ಯತೆಯ ಸ್ಕೋರ್' : 'Barricade Priority Score'}:</strong> ${junc.barricade_priority.toFixed(1)}/100<br/>
            <strong>${language === 'kn' ? 'ಘಟನೆಗಳ ಸಂಖ್ಯೆ' : 'Incident count'}:</strong> ${junc.incident_count}<br/>
            <strong>${language === 'kn' ? 'ಸಾಮಾನ್ಯ ಕಾರಣ' : 'Most Common Cause'}:</strong> ${language === 'kn' ? (t['cause_' + junc.common_cause.toLowerCase()] || junc.common_cause) : junc.common_cause.replace('_', ' ').toUpperCase()}<br/>
            <strong>${language === 'kn' ? 'ರಸ್ತೆ ಮುಚ್ಚುವಿಕೆಗಳು' : 'Road Closures'}:</strong> ${junc.road_closures}
          </div>
        `;
        
        marker.bindPopup(popupContent);
        junctionLayerGroupRef.current.addLayer(marker);
      });
    }
  }, [selectedHour, showJunctions, data, junctions]);

  if (loading) {
    return (
      <div className="empty-results">
        <div className="status-dot"></div>
        <p>{language === 'kn' ? 'ಸ್ಥಳೀಯ-ಸಮಯ ಸಂಚಾರ ಅಪಾಯದ ಮ್ಯಾಟ್ರಿಕ್ಸ್ ರಚಿಸಲಾಗುತ್ತಿದೆ...' : 'Generating spatial-temporal congestion risk matrix...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-results" style={{ color: 'var(--danger)' }}>
        <span className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <p>{language === 'kn' ? 'ಹೀಟ್‌ಮ್ಯಾಪ್ ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ' : 'Error loading heatmap'}: {error}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'kn' ? 'ಬ್ಯಾಕೆಂಡ್ ರನ್ ಆಗುತ್ತಿದೆಯೇ ಪರಿಶೀಲಿಸಿ.' : 'Check if backend is running.'}</p>
      </div>
    );
  }

  const zones = Array.from(new Set(data.map((item) => item.zone))).sort();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const grid = {};
  data.forEach((item) => {
    if (!grid[item.zone]) grid[item.zone] = {};
    grid[item.zone][item.hour] = item;
  });

  const getCellColor = (risk) => {
    if (!risk) return '#f5f2f0';
    if (risk < 15) return '#f5f2f0';
    if (risk < 30) return '#ffebd9';
    if (risk < 50) return '#ffbe84';
    if (risk < 75) return '#ff9638';
    return '#ea750e';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Dynamic Hotspot Map Card */}
      <div className="card" style={{ width: '100%', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              {language === 'kn' ? 'ಸ್ಥಳೀಯ ಅಸಂಗತತೆ ಮತ್ತು ಸಂಚಾರ ಹಾಟ್‌ಸ್ಪಾಟ್ ನಕ್ಷೆ' : 'Spatial Anomaly & Traffic Hotspot Map'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
              {language === 'kn' ? 'ಮಾದರಿಯಿಂದ ಲೆಕ್ಕಹಾಕಲ್ಪಟ್ಟ ಐತಿಹಾಸಿಕ ತೀವ್ರ (ಕೆಂಪು), ಮಧ್ಯಮ (ಅಂಬರ್) ಮತ್ತು ಕಡಿಮೆ (ಹಸಿರು) ದಟ್ಟಣೆ ಮಾದರಿಗಳು.' : 'Historical heavy (red), medium (amber), and low (green) congestion patterns computed by the model.'}
            </p>
          </div>
          
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              type="button"
              className="cc-action-btn"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.82rem',
                border: '1px solid rgba(0,0,0,0.1)',
                backgroundColor: showJunctions ? 'rgba(0,122,255,0.08)' : 'white',
                color: showJunctions ? 'var(--primary)' : 'var(--text-dark)',
                cursor: 'pointer'
              }}
              onClick={() => setShowJunctions(!showJunctions)}
            >
              📍 {showJunctions ? (language === 'kn' ? 'ಜಂಕ್ಷನ್ ಪಿನ್‌ಗಳನ್ನು ಮರೆಮಾಡಿ' : 'Hide Junction Pins') : (language === 'kn' ? 'ಜಂಕ್ಷನ್ ಪಿನ್‌ಗಳನ್ನು ತೋರಿಸಿ' : 'Show Junction Pins')}
            </button>
            <button 
              type="button"
              className="cc-action-btn"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.82rem',
                border: '1px solid rgba(0,0,0,0.1)',
                backgroundColor: isPlaying ? 'rgba(255,149,0,0.1)' : 'white',
                color: isPlaying ? '#ff9500' : 'var(--text-dark)',
                cursor: 'pointer'
              }}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  {language === 'kn' ? 'ಲೂಪ್ ವಿರಾಮಗೊಳಿಸಿ' : 'Pause Loop'}
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21" />
                  </svg>
                  {language === 'kn' ? 'ಗಂಟೆಯ ಲೂಪ್ ಪ್ಲೇ ಮಾಡಿ' : 'Play Hourly Loop'}
                </>
              )}
            </button>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', minWidth: '70px', textAlign: 'right' }}>
              {selectedHour.toString().padStart(2, '0')}:00h
            </span>
          </div>
        </div>

        {/* Map Container */}
        <div style={{ position: 'relative', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#e5e3de' }}>
          <div id="spatial-hotspot-map" style={{ height: '420px', width: '100%' }}></div>
          
          {/* Legend */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'white',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            <span style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '2px' }}>
              {language === 'kn' ? 'ನಕ್ಷೆಯ ಮೇಲ್ಪದರಗಳು' : 'Map Overlays'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d32f2f' }}></span>
              <span>{language === 'kn' ? 'ಭಾರೀ / ನಿರ್ಣಾಯಕ ಪ್ರದೇಶ' : 'Heavy / Critical Area'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f57c00' }}></span>
              <span>{language === 'kn' ? 'ಮಧ್ಯಮ / ಹೆಚ್ಚಿನ ಪ್ರದೇಶ' : 'Medium / High Area'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fbc02d' }}></span>
              <span>{language === 'kn' ? 'ಸಾಧಾರಣ ಪ್ರದೇಶ' : 'Moderate Area'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#34c759' }}></span>
              <span>{language === 'kn' ? 'ಕಡಿಮೆ ಅಪಾಯದ ಪ್ರದೇಶ' : 'Low Risk Area'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '6px', marginTop: '2px' }}>
              <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png" alt="pin" style={{ height: '14px' }} />
              <span>{language === 'kn' ? 'ವಿಶ್ಲೇಷಿಸಿದ ಜಂಕ್ಷನ್‌ಗಳು' : 'Model Analyzed Junctions'}</span>
            </div>
          </div>
        </div>

        {/* Slider Timeline */}
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input 
            type="range" 
            min="0" 
            max="23" 
            value={selectedHour} 
            onChange={(e) => {
              setSelectedHour(parseInt(e.target.value));
              setIsPlaying(false);
            }}
            style={{ 
              width: '100%', 
              cursor: 'pointer',
              accentColor: 'var(--primary)'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>{language === 'kn' ? 'ಮಧ್ಯರಾತ್ರಿ (00h)' : 'Midnight (00h)'}</span>
            <span>{language === 'kn' ? 'ಬೆಳಗಿನ ದಟ್ಟಣೆ (08h)' : 'Morning Peak (08h)'}</span>
            <span>{language === 'kn' ? 'ಮಧ್ಯಾಹ್ನ (12h)' : 'Midday (12h)'}</span>
            <span>{language === 'kn' ? 'ಸಂಜೆಯ ದಟ್ಟಣೆ (18h)' : 'Evening Peak (18h)'}</span>
            <span>{language === 'kn' ? 'ರಾತ್ರಿ (23h)' : 'Night (23h)'}</span>
          </div>
        </div>
      </div>

      {/* Grid Risk Matrix Card */}
      <div className="card" style={{ width: '100%', padding: '24px' }}>
        <h3 className="card-title">
          {language === 'kn' ? 'ವಲಯ × ಗಂಟೆ ಸಂಚಾರ ಅಪಾಯದ ಮ್ಯಾಟ್ರಿಕ್ಸ್' : 'Zone × Hour Congestion Risk Matrix'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
          {language === 'kn' ? 'ನಿರ್ದಿಷ್ಟ ಸಂಚಾರ ಅಪಾಯದ ಮಟ್ಟಗಳು ಮತ್ತು ಘಟನೆಗಳ ಇತಿಹಾಸವನ್ನು ಪರೀಕ್ಷಿಸಲು ಸೆಲ್ ಮೇಲೆ ಮೌಸ್ ಇರಿಸಿ.' : 'Hover over grid cells to inspect specific congestion risk levels and event histories.'}
        </p>

        <div className="heatmap-container">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>{language === 'kn' ? 'ವಲಯ' : 'Zone'}</th>
                {hours.map((hour) => (
                  <th 
                    key={hour} 
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: selectedHour === hour ? 'rgba(0,122,255,0.08)' : 'transparent',
                      color: selectedHour === hour ? 'var(--primary)' : 'inherit',
                      fontWeight: selectedHour === hour ? 800 : 'inherit'
                    }}
                    onClick={() => {
                      setSelectedHour(hour);
                      setIsPlaying(false);
                    }}
                  >
                    {hour.toString().padStart(2, '0')}h
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone}>
                  <td className="heatmap-zone-label">{translateZone(zone)}</td>
                  {hours.map((hour) => {
                    const cell = grid[zone]?.[hour] || { congestion_risk: 0, event_count: 0, road_closures: 0 };
                    const risk = cell.congestion_risk;
                    const isSelected = selectedHour === hour;
                    return (
                      <td 
                        key={hour} 
                        style={{ 
                          backgroundColor: getCellColor(risk),
                          border: isSelected ? '2px solid var(--primary)' : '1px solid white',
                          transform: isSelected ? 'scale(1.08)' : 'none',
                          zIndex: isSelected ? 2 : 1,
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedHour(hour);
                          setIsPlaying(false);
                        }}
                      >
                        <div className="cell-tooltip">
                          <strong>{translateZone(zone)} @ {hour}:00</strong><br />
                          {language === 'kn' ? 'ಅಪಾಯ' : 'Risk'}: {risk.toFixed(1)}/100 ({language === 'kn' ? (cell.risk_label === 'Low' ? 'ಕಡಿಮೆ' : cell.risk_label === 'Medium' ? 'ಮಧ್ಯಮ' : 'ಹೆಚ್ಚು') : cell.risk_label || 'Low'})<br />
                          {language === 'kn' ? 'ದಾಖಲಾದ ಘಟನೆಗಳು' : 'Logged Events'}: {cell.event_count || 0}<br />
                          {language === 'kn' ? 'ಮುಚ್ಚುವಿಕೆಗಳು' : 'Road Closures'}: {cell.road_closures || 0}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="heatmap-legend" style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {language === 'kn' ? 'ಕಡಿಮೆ ಅಪಾಯ' : 'Low Risk'}
          </span>
          <div className="legend-scale"></div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {language === 'kn' ? 'ಗಂಭೀರ ಹಾಟ್‌ಸ್ಪಾಟ್' : 'Critical Hotspot'}
          </span>
        </div>
      </div>
    </div>
  );
}

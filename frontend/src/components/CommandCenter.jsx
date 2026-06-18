import React, { useState, useEffect, useRef } from 'react';
import Loader from './Loader';
import { translations } from '../translations';

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

export default function CommandCenter({ language }) {
  const t = translations[language] || translations.en;
  
  const translateRecommendation = (act) => {
    if (language !== 'kn') return act;
    let translated = act;
    Object.keys(corridorTranslationsKn).forEach(engName => {
      translated = translated.replace(new RegExp(engName, 'g'), corridorTranslationsKn[engName]);
    });
    translated = translated
      .replace(/Deploy (\d+) officers/gi, '$1 ಅಧಿಕಾರಿಗಳನ್ನು ನಿಯೋಜಿಸಿ')
      .replace(/Deploy (\d+) barricades/gi, '$1 ಬ್ಯಾರಿಕೇಡ್‌ಗಳನ್ನು ನಿಯೋಜಿಸಿ')
      .replace(/Divert traffic via/gi, 'ಸಂಚಾರವನ್ನು ಬದಲಾಯಿಸಿ:')
      .replace(/Broadcast warning/gi, 'ಎಚ್ಚರಿಕೆಯನ್ನು ಪ್ರಸಾರ ಮಾಡಿ')
      .replace(/Notify police station/gi, 'ಪೊಲೀಸ್ ಠಾಣೆಗೆ ಸೂಚಿಸಿ')
      .replace(/Emergency clearing crew/gi, 'ತುರ್ತು ತೆರವು ದಳ');
    return translated;
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState('+0');
  const [autoPlay, setAutoPlay] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [liveNow, setLiveNow] = useState(new Date());
  const [appliedActions, setAppliedActions] = useState([0, 1, 2, 3, 4]);
  const [fluctuations, setFluctuations] = useState({
    speedOffset: 0,
    densityOffset: 0,
    buzzOffset: 0
  });

  // Live clock ticker — updates every 30 seconds so detected time stays fresh
  useEffect(() => {
    const ticker = setInterval(() => setLiveNow(new Date()), 30000);
    return () => clearInterval(ticker);
  }, []);

  const handleForceRefresh = () => {
    setRefreshing(true);
    fetch('http://localhost:8000/api/command-center?force=true')
      .then((res) => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setFlashKey(k => k + 1);  // trigger flash animation
        setRefreshing(false);
      })
      .catch((err) => {
        console.error("Failed to force refresh:", err);
        setRefreshing(false);
      });
  };

  const mapObjRef = useRef(null);
  const layersRef = useRef([]);

  // Fetch status from API
  const fetchStatus = () => {
    fetch('http://localhost:8000/api/command-center')
      .then((res) => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load command center data:", err);
        setLoading(false);
      });
  };

  // Initial fetch on mount to populate the view (only if autoplay starts active, else deferred)
  useEffect(() => {
    if (autoPlay) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, []);

  // Poll API for live updates only when autoPlay is active
  useEffect(() => {
    if (!autoPlay) return;
    
    // Fetch immediately when playing/resuming to avoid waiting for interval
    fetchStatus();
    
    const interval = setInterval(() => {
      fetchStatus();
      setFlashKey(k => k + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoPlay]);

  // Micro-fluctuations timer to make feeds feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setFluctuations({
        speedOffset: +(Math.random() * 1.6 - 0.8).toFixed(1),
        densityOffset: Math.floor(Math.random() * 24 - 12),
        buzzOffset: Math.floor(Math.random() * 4 - 2)
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Auto-play forecast cycle loop
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setHorizon((h) => {
        if (h === '+0') return '+15';
        if (h === '+15') return '+30';
        if (h === '+30') return '+60';
        return '+0';
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPlay]);

  // Leaflet Map rendering
  useEffect(() => {
    if (loading || !data) return;

    const L = window.L;
    if (!L) return;

    const center = data.map_center || [12.9779, 77.5719];

    if (!mapObjRef.current) {
      const map = L.map('cc-map-view', {
        zoomControl: false,
        attributionControl: false
      }).setView(center, 14);

      // Light voyager tile layer for clean light theme look
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(map);

      mapObjRef.current = map;
    }

    const map = mapObjRef.current;

    // Clear old layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    // Collect all marker coordinates to dynamically calculate map bounds
    const markerCoords = [];
    markerCoords.push(center);

    // Congestion colors - tweaked for light theme visibility
    const criticalColor = '#1d1d1f'; // Deep charcoal
    const highColor = '#ff3b30';     // Red
    const modColor = '#ff9500';      // Orange/Yellow
    const normalColor = '#34c759';   // Green

    let layersToDraw = [];

    // Outward congestion spreads dynamically over forecast timeline
    if (horizon === '+0') {
      layersToDraw = [
        { radius: 1400, color: normalColor, opacity: 0.15, fillOpacity: 0.08 },
        { radius: 600, color: modColor, opacity: 0.3, fillOpacity: 0.15 },
        { radius: 300, color: highColor, opacity: 0.5, fillOpacity: 0.25 },
        { radius: 120, color: criticalColor, opacity: 0.7, fillOpacity: 0.45 }
      ];
    } else if (horizon === '+15') {
      layersToDraw = [
        { radius: 1700, color: normalColor, opacity: 0.12, fillOpacity: 0.05 },
        { radius: 900, color: modColor, opacity: 0.35, fillOpacity: 0.18 },
        { radius: 500, color: highColor, opacity: 0.55, fillOpacity: 0.28 },
        { radius: 240, color: criticalColor, opacity: 0.75, fillOpacity: 0.5 }
      ];
    } else if (horizon === '+30') {
      layersToDraw = [
        { radius: 2100, color: normalColor, opacity: 0.1, fillOpacity: 0.03 },
        { radius: 1250, color: modColor, opacity: 0.4, fillOpacity: 0.2 },
        { radius: 800, color: highColor, opacity: 0.6, fillOpacity: 0.32 },
        { radius: 420, color: criticalColor, opacity: 0.8, fillOpacity: 0.55 }
      ];
    } else if (horizon === '+60') {
      layersToDraw = [
        { radius: 2700, color: normalColor, opacity: 0.08, fillOpacity: 0.02 },
        { radius: 1700, color: modColor, opacity: 0.45, fillOpacity: 0.22 },
        { radius: 1200, color: highColor, opacity: 0.65, fillOpacity: 0.38 },
        { radius: 750, color: criticalColor, opacity: 0.85, fillOpacity: 0.6 }
      ];
    }

    // Draw circles representing the outward spread
    layersToDraw.forEach(cfg => {
      const circle = L.circle(center, {
        color: cfg.color,
        fillColor: cfg.color,
        fillOpacity: cfg.fillOpacity,
        opacity: cfg.opacity,
        weight: 1.5,
        radius: cfg.radius
      }).addTo(map);
      layersRef.current.push(circle);
    });

    // 📍 1. Pin the High Traffic Area Hotspots dynamically based on forecasted intersections & roads
    const dynamicIntersections = data.forecast?.affected_intersections || [];
    const dynamicRoads = data.forecast?.affected_roads || [];

    const addPinToMap = (item, idx, defaultIconEmoji, fallbackDesc) => {
      const isObj = (typeof item === 'object' && item !== null);
      const name = isObj ? item.name : item;
      const desc = isObj && item.desc ? item.desc : fallbackDesc;
      
      let hsLat, hsLon;
      if (isObj && item.lat && item.lon) {
        hsLat = parseFloat(item.lat);
        hsLon = parseFloat(item.lon);
      } else {
        // Fallback to offset
        const offsets = [
          { latOffset: 0.0057, lonOffset: 0.0016 },
          { latOffset: -0.0077, lonOffset: -0.0008 },
          { latOffset: -0.0023, lonOffset: 0.0009 }
        ];
        const offset = offsets[idx % offsets.length];
        hsLat = center[0] + offset.latOffset;
        hsLon = center[1] + offset.lonOffset;
      }
      
      // Store for dynamic bounding box
      markerCoords.push([hsLat, hsLon]);

      const pinHtml = `
        <div class="cc-hotspot-pin">
          <span class="cc-hotspot-pin-icon">${defaultIconEmoji}</span>
          <div class="cc-hotspot-tooltip">
            <strong>${language === 'kn' ? (corridorTranslationsKn[name] || name) : name}</strong><br/>
            ${desc}
          </div>
        </div>
      `;
      const hsIcon = L.divIcon({
        html: pinHtml,
        className: 'cc-hotspot-marker-class',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const marker = L.marker([hsLat, hsLon], { icon: hsIcon }).addTo(map);
      layersRef.current.push(marker);
    };

    // Draw intersections
    dynamicIntersections.forEach((item, idx) => {
      addPinToMap(item, idx, "📍", language === 'kn' ? t.cc_high_congestion_stacking : "High congestion stacking near intersection");
    });

    // Draw roads
    dynamicRoads.forEach((item, idx) => {
      addPinToMap(item, idx, "🛣️", language === 'kn' ? t.cc_severe_delay_segment : "Severe delay along this corridor segment");
    });

    // 🚨 2. Pulse anomaly dot at center (Core Hotspot)
    const pulseHtml = `
      <div class="cc-pulsing-hotspot-wrapper">
        <div class="cc-pulsing-hotspot"></div>
        <div class="cc-pulsing-tooltip">
          <strong>${t.cc_emerging_core}</strong><br/>
          ${data.event?.title || (language === 'kn' ? "ಮಹೋನ್ನತ ಸಂಚಾರ ನಿಯಂತ್ರಣ ಕೇಂದ್ರ" : "Majestic Traffic Segment Control Node")}
        </div>
      </div>
    `;
    const divIcon = L.divIcon({
      html: pulseHtml,
      className: 'cc-hotspot-marker-class',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    const hotspotMarker = L.marker(center, { icon: divIcon }).addTo(map);
    layersRef.current.push(hotspotMarker);

    // Fit map bounds to show all markers with padding so no pins are offscreen
    if (markerCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(markerCoords);
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (err) {
        console.error("Leaflet fitBounds error:", err);
        map.setView(center, 11);
      }
    } else {
      map.setView(center, 12);
    }

  }, [loading, data, horizon]);

  // Clean up Leaflet map when component unmounts to prevent re-initialization errors
  useEffect(() => {
    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
  }, []);

  if (!autoPlay && !data) {
    return (
      <div className="cc-container" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          backgroundColor: 'rgba(234, 117, 14, 0.1)', 
          color: 'var(--primary)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: '24px',
          boxShadow: '0 0 20px rgba(234, 117, 14, 0.2)'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
          </svg>
        </div>
        <h3 style={{ color: 'var(--text-dark)', fontWeight: 800, margin: '0 0 10px 0', fontSize: '1.4rem' }}>
          {t.cc_paused_title}
        </h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem', fontWeight: 600, marginBottom: '24px', lineHeight: '1.5' }}>
          {t.cc_paused_desc}
        </p>
        <button 
          onClick={() => {
            setLoading(true);
            setAutoPlay(true);
          }}
          style={{
            padding: '12px 28px', 
            background: 'var(--primary)',
            border: 'none',
            color: 'white', 
            borderRadius: '8px',
            fontSize: '0.9rem', 
            fontWeight: 800, 
            cursor: 'pointer', 
            boxShadow: '0 4px 14px rgba(234, 117, 14, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span>▶️</span> {t.cc_initialize_feeds}
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="cc-container" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Loader />
        <h3 style={{ marginTop: '20px', color: 'var(--text-dark)', fontWeight: 800 }}>{t.cc_initializing}</h3>
      </div>
    );
  }

  const evt = data.event;
  const feeds = data.live_feeds;
  const fc = data.forecast;
  const pipe = data.pipeline;
  const rawFeeds = data.raw_feeds || [];

  // Toggle recommendation
  const toggleAction = (idx) => {
    setAppliedActions(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const recActions = data.recommendations || [];
  const baseDelay = fc.estimated_delay || 42;
  const targetMinDelay = fc.estimated_delay_with_intervention || 17;
  const totalPossibleSavings = baseDelay - targetMinDelay;
  const savingsWeights = [0.35, 0.25, 0.25, 0.08, 0.07];
  const actionValues = savingsWeights.map(w => Math.round(totalPossibleSavings * w));
  const totalReduction = appliedActions.reduce((sum, idx) => sum + (actionValues[idx] || 0), 0);
  const currentDelayWithIntervention = Math.max(targetMinDelay, baseDelay - totalReduction);

  // Fluctuated feed speeds/scores
  const liveSpeed = +(feeds.traffic.avg_speed + fluctuations.speedOffset).toFixed(1);
  const liveBuzz = Math.min(100, Math.max(0, feeds.social.buzz_score + fluctuations.buzzOffset));
  const liveDensityNum = 720 + Math.round(feeds.traffic.avg_speed * 5) + fluctuations.densityOffset;

  // Compute live detected time client-side (always 20 min ago from now)
  const liveDetectedTime = new Date(liveNow.getTime() - 20 * 60 * 1000)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Cache age display
  const cacheAgeMin = data ? Math.floor((data.cache_age_seconds || 0) / 60) : 0;
  const cacheAgeDisplay = cacheAgeMin === 0 ? (language === 'kn' ? 'ಇದೀಗ' : 'just now') : `${cacheAgeMin}${language === 'kn' ? 'ನಿಮಿಷಗಳ ಹಿಂದೆ' : 'm ago'}`;

  return (
    <div className="cc-container">
      {/* Flash animation style */}
      <style>{`
        @keyframes cc-flash-in {
          0% { box-shadow: 0 0 0 3px rgba(255,100,0,0.6); }
          100% { box-shadow: none; }
        }
        .cc-flash { animation: cc-flash-in 1.2s ease-out; }
      `}</style>
      {/* HEADER SECTION */}
      <div className="cc-header">
        <div className="cc-title-area">
          <h2>{t.cc_console_title}</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            🛰️ {t.cc_sector_desc}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Freshness badge */}
          {data && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '3px 8px' }}>
              🔄 {t.cc_refreshed} {data.last_refreshed || cacheAgeDisplay}
            </span>
          )}
          <button 
            onClick={handleForceRefresh}
            disabled={refreshing}
            style={{
              padding: '6px 12px', 
              background: refreshing ? 'var(--border-color)' : 'var(--primary)',
              border: `1px solid ${refreshing ? 'var(--border-color)' : 'var(--primary)'}`,
              color: refreshing ? 'var(--text-muted)' : 'white', 
              borderRadius: '4px',
              fontSize: '0.7rem', 
              fontWeight: 800, 
              cursor: refreshing ? 'not-allowed' : 'pointer', 
              transition: 'all 0.2s'
            }}
          >
            {refreshing ? (language === 'kn' ? '⚡ APIs ಚಾಲನೆಯಲ್ಲಿದೆ...' : '⚡ RUNNING APIS...') : `⚡ ${t.cc_retrigger}`}
          </button>
          <button 
            onClick={() => {
              if (!autoPlay && !data) {
                setLoading(true);
              }
              setAutoPlay(!autoPlay);
            }}
            style={{
              padding: '6px 12px', 
              background: autoPlay ? 'var(--primary-glow)' : 'var(--bg-primary)',
              border: `1px solid ${autoPlay ? 'var(--primary)' : 'var(--border-color)'}`,
              color: autoPlay ? 'var(--primary)' : 'var(--text-muted)', 
              borderRadius: '4px',
              fontSize: '0.7rem', 
              fontWeight: 800, 
              cursor: 'pointer', 
              transition: 'all 0.2s'
            }}
          >
            {autoPlay ? `⏸️ ${t.cc_pause_forecast}` : `▶️ ${t.cc_play_forecast}`}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            {t.cc_live}: {liveNow.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="cc-grid">
        {/* LEFT COLUMN: Map, Feeds & Pipeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. MAP PANEL */}
          <div className="cc-card" style={{ padding: 0 }}>
            <div className="cc-map-container">
              {/* Map Target Div */}
              <div id="cc-map-view" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
              
              <div className="cc-map-grid-layer" />
              <div className="cc-radar-scan" />

              {/* Map Legend Overlay */}
              <div className="cc-map-overlay-layer">
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px', textTransform: 'uppercase' }}>{t.cc_legend}</div>
                <div className="cc-map-legend-item">
                  <span className="cc-map-legend-dot" style={{ backgroundColor: '#34c759' }} />
                  🟢 {t.cc_normal_traffic}
                </div>
                <div className="cc-map-legend-item">
                  <span className="cc-map-legend-dot" style={{ backgroundColor: '#ff9500' }} />
                  🟡 {t.cc_mod_congestion}
                </div>
                <div className="cc-map-legend-item">
                  <span className="cc-map-legend-dot" style={{ backgroundColor: '#ff3b30' }} />
                  🔴 {t.cc_high_congestion}
                </div>
                <div className="cc-map-legend-item">
                  <span className="cc-map-legend-dot" style={{ backgroundColor: '#1d1d1f', border: '1px solid rgba(0,0,0,0.1)' }} />
                  ⚫ {t.cc_crit_congestion}
                </div>
              </div>

              {/* Forecast Horizon Sliders */}
              <div className="cc-time-horizon-selector">
                <button className={`cc-horizon-btn ${horizon === '+0' ? 'active' : ''}`} onClick={() => { setHorizon('+0'); setAutoPlay(false); }}>
                  {t.cc_current_layer}
                </button>
                <button className={`cc-horizon-btn ${horizon === '+15' ? 'active' : ''}`} onClick={() => { setHorizon('+15'); setAutoPlay(false); }}>
                  {t.cc_15m_forecast}
                </button>
                <button className={`cc-horizon-btn ${horizon === '+30' ? 'active' : ''}`} onClick={() => { setHorizon('+30'); setAutoPlay(false); }}>
                  {t.cc_30m_forecast}
                </button>
                <button className={`cc-horizon-btn ${horizon === '+60' ? 'active' : ''}`} onClick={() => { setHorizon('+60'); setAutoPlay(false); }}>
                  {t.cc_60m_forecast}
                </button>
              </div>
            </div>
          </div>

          {/* 2. AI DECISION PIPELINE */}
          <div className="cc-card">
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🧠 {t.cc_pipeline_title}
            </h3>
            <div className="cc-pipeline-container">
              <div className="cc-pipeline-nodes">
                <div className="cc-pipeline-node">
                  <span>🚗 {t.cc_traffic_anomaly}</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--danger)' }}>{pipe.traffic_anomaly}</span>
                </div>
                <div className="cc-pipeline-node">
                  <span>📍 {t.cc_gps_spike}</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--danger)' }}>{pipe.gps_spike}</span>
                </div>
                <div className="cc-pipeline-node">
                  <span>💬 {t.cc_social_spike}</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--danger)' }}>{pipe.social_buzz}</span>
                </div>
                <div className="cc-pipeline-node">
                  <span>🌧️ {t.cc_weather}</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--danger)' }}>{pipe.weather}</span>
                </div>
              </div>

              <div className="cc-pipeline-flow-connector">
                <div className="cc-pipeline-flow-dot" />
              </div>

              <div className="cc-pipeline-engine">
                <span>🧠 {t.cc_detection_engine}</span>
              </div>

              <div className="cc-pipeline-flow-connector">
                <div className="cc-pipeline-flow-dot" />
              </div>

              <div style={{ color: 'var(--danger)', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase', textShadow: '0 0 8px rgba(255,59,48,0.2)' }}>
                {t.cc_event_identified}
              </div>
            </div>
          </div>

          {/* 3. AI LIVE FEEDS PANEL */}
          <div className="cc-card">
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📡 {t.cc_signals_title}
            </h3>
            <div className="cc-feeds-panel">
              
              {/* Traffic Feed */}
              <div className="cc-feed-card">
                <div className="cc-feed-header">
                  <span className="cc-feed-title">🚗 {t.cc_traffic_feed}</span>
                  <span className="cc-feed-indicator" />
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_avg_speed}:</span>
                  <span className="cc-feed-val">{liveSpeed} {language === 'kn' ? 'ಕಿಮೀ/ಗಂ' : 'km/h'}</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_growth_rate}:</span>
                  <span className="cc-feed-val" style={{ color: 'var(--danger)' }}>{feeds.traffic.growth_rate}</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_incident_count}:</span>
                  <span className="cc-feed-val">{feeds.traffic.incident_count} {t.cc_detected}</span>
                </div>
              </div>

              {/* GPS Feed */}
              <div className="cc-feed-card">
                <div className="cc-feed-header">
                  <span className="cc-feed-title">📍 {t.cc_gps_feed}</span>
                  <span className="cc-feed-indicator" />
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_vehicle_density}:</span>
                  <span className="cc-feed-val">{language === 'kn' ? 'ಹೆಚ್ಚು' : 'High'} ({liveDensityNum} {t.cc_vehicles_per_km})</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_crowd_density}:</span>
                  <span className="cc-feed-val">{language === 'kn' ? (feeds.gps.crowd_density === 'Normal' ? 'ಸಾಮಾನ್ಯ' : feeds.gps.crowd_density === 'High' ? 'ಹೆಚ್ಚು' : feeds.gps.crowd_density) : feeds.gps.crowd_density}</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_movement_patterns}:</span>
                  <span className="cc-feed-val" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={feeds.gps.patterns}>
                    {feeds.gps.patterns}
                  </span>
                </div>
              </div>

              {/* Social Buzz Feed */}
              <div className="cc-feed-card">
                <div className="cc-feed-header">
                  <span className="cc-feed-title">💬 {t.cc_social_feed}</span>
                  <span className="cc-feed-indicator" />
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_mention_growth}:</span>
                  <span className="cc-feed-val" style={{ color: 'var(--danger)' }}>{feeds.social.growth_rate}</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_buzz_score}:</span>
                  <span className="cc-feed-val">{liveBuzz}/100</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_trending_keywords}:</span>
                  <span className="cc-feed-val">{feeds.social.keywords.join(', ')}</span>
                </div>
              </div>

              {/* Weather Feed */}
              <div className="cc-feed-card">
                <div className="cc-feed-header">
                  <span className="cc-feed-title">🌧️ {t.cc_weather_feed}</span>
                  <span className="cc-feed-indicator" />
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_rainfall}:</span>
                  <span className="cc-feed-val">{language === 'kn' ? (feeds.weather.rainfall === 'HEAVY RAIN' ? 'ಭಾರೀ ಮಳೆ' : feeds.weather.rainfall === 'LIGHT RAIN' ? 'ಹಗುರ ಮಳೆ' : feeds.weather.rainfall === 'NONE' ? 'ಯಾವುದೂ ಇಲ್ಲ' : feeds.weather.rainfall) : feeds.weather.rainfall}</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_visibility}:</span>
                  <span className="cc-feed-val">{language === 'kn' ? (feeds.weather.visibility === 'POOR' ? 'ಕಡಿಮೆ' : feeds.weather.visibility === 'GOOD' ? 'ಉತ್ತಮ' : feeds.weather.visibility) : feeds.weather.visibility}</span>
                </div>
                <div className="cc-feed-row">
                  <span className="cc-feed-label">{t.cc_weather_severity}:</span>
                  <span className="cc-feed-val" style={{ color: feeds.weather.severity === 'SEVERE' ? 'var(--danger)' : 'inherit' }}>
                    {language === 'kn' ? (feeds.weather.severity === 'SEVERE' ? 'ತೀವ್ರ' : feeds.weather.severity === 'NORMAL' ? 'ಸಾಮಾನ್ಯ' : feeds.weather.severity) : feeds.weather.severity}
                  </span>
                </div>
              </div>

            </div>

            {/* Real Search Buzz Items from SerpAPI */}
            {rawFeeds.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.cc_google_news_feeds}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {rawFeeds.map((feed, i) => (
                    <div key={i} style={{ background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-dark)', flex: 1 }}>{feed.title}</div>
                        {feed.date && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap', background: 'var(--primary-glow)', padding: '2px 6px', borderRadius: '3px' }}>
                            {feed.date}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px', lineHeight: '1.3' }}>{feed.snippet}</div>
                      <a href={feed.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.62rem', color: 'var(--primary)', textDecoration: 'underline', display: 'inline-block', marginTop: '4px' }}>
                        {t.cc_view_source} &rarr;
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Alert Panel, Predictions & Recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. ALERT CARD */}
          <div className={`cc-card alert-active ${flashKey > 0 ? 'cc-flash' : ''}`} key={flashKey}>
            <div className="cc-alert-headline">
              <span>🚨</span>
              <span>{t.cc_event_detected_title}</span>
            </div>
            <p style={{ margin: '8px 0 16px', fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.4 }}>
              <strong>{language === 'kn' ? 'AI ಪತ್ತೆ ಕೋರ್:' : 'AI Detection Core:'}</strong> {evt.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.cc_confidence_score}:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 800 }}>{evt.confidence}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.cc_detected_time}:</span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 800 }}>{liveDetectedTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.cc_predicted_radius}:</span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 800 }}>{evt.predicted_impact_radius} {t.cc_km}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.cc_time_until_severe}:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 800 }}>{evt.estimated_time_to_severe} {t.cc_mins}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.cc_status}:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 900 }}>{language === 'kn' ? (evt.status === 'CRITICAL' ? 'ಅತ್ಯಂತ ಗಂಭೀರ' : evt.status === 'HIGH' ? 'ಹೆಚ್ಚು' : evt.status) : evt.status}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,59,48,0.15)', marginTop: '14px', paddingTop: '12px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 800 }}>
                {t.cc_detection_sources}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <div className="cc-source-pill">✓ {language === 'kn' ? 'ಸಂಚಾರ ವೇಗದ ಅಸಂಗತತೆ' : 'Traffic Speed Anomaly'}</div>
                <div className="cc-source-pill">✓ {language === 'kn' ? 'GPS ದಟ್ಟಣೆ ಹೆಚ್ಚಳ' : 'GPS Density Surge'}</div>
                <div className="cc-source-pill">✓ {language === 'kn' ? 'ಸಾಮಾಜಿಕ ಮಾಧ್ಯಮ ಚಟುವಟಿಕೆ ಹೆಚ್ಚಳ' : 'Social Media Activity Spike'}</div>
                <div className="cc-source-pill">✓ {language === 'kn' ? 'ಹವಾಮಾನ ಪ್ರಭಾವ' : 'Weather Impact'}</div>
              </div>
            </div>
          </div>

          {/* 2. AFFECTED CORRIDORS & KEY JUNCTIONS */}
          <div className="cc-card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🚧 {t.cc_affected_corridors_title}
            </h3>
            <p style={{ margin: '4px 0 12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t.cc_affected_desc}
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              {/* Roads Column */}
              <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                  🛣️ {t.cc_impacted_roads}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {fc.affected_roads && fc.affected_roads.map((road, i) => {
                    const name = (typeof road === 'object' && road !== null) ? road.name : road;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dark)', padding: '4px 6px', background: 'rgba(255, 149, 0, 0.05)', borderRadius: '4px', borderLeft: '3px solid #ff9500' }}>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>{language === 'kn' ? (corridorTranslationsKn[name] || name) : name}</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, background: 'rgba(255, 149, 0, 0.15)', color: '#ea750e', padding: '1px 5px', borderRadius: '3px' }}>{language === 'kn' ? 'ವಿಳಂಬ' : 'DELAY'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Intersections Column */}
              <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                  📍 {t.cc_key_intersections}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {fc.affected_intersections && fc.affected_intersections.map((node, i) => {
                    const name = (typeof node === 'object' && node !== null) ? node.name : node;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dark)', padding: '4px 6px', background: 'rgba(255, 59, 48, 0.05)', borderRadius: '4px', borderLeft: '3px solid #ff3b30' }}>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>{language === 'kn' ? (corridorTranslationsKn[name] || name) : name}</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, background: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', padding: '1px 5px', borderRadius: '3px' }}>{language === 'kn' ? 'ನಿರ್ಬಂಧಿತ' : 'BLOCKED'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 3. FUTURE TRAFFIC FORECAST */}
          <div className="cc-card">
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🔮 {t.cc_future_forecast_title}
            </h3>
            
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Next 15m */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t.cc_next_15m}</span>
                  <span className="cc-forecast-badge cc-badge-mod">{language === 'kn' ? (fc.next_15 === 'MODERATE' ? 'ಮಧ್ಯಮ' : fc.next_15) : fc.next_15}</span>
                </div>
                <div className="cc-chart-bar-wrap">
                  <div className="cc-chart-bar-fill" style={{ width: '45%', backgroundColor: '#ff9500' }} />
                </div>
              </div>

              {/* Next 30m */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t.cc_next_30m}</span>
                  <span className="cc-forecast-badge cc-badge-high">{language === 'kn' ? (fc.next_30 === 'HEAVY' ? 'ಹೆಚ್ಚು' : fc.next_30) : fc.next_30}</span>
                </div>
                <div className="cc-chart-bar-wrap">
                  <div className="cc-chart-bar-fill" style={{ width: '75%', backgroundColor: '#ff3b30' }} />
                </div>
              </div>

              {/* Next 60m */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t.cc_next_60m}</span>
                  <span className="cc-forecast-badge cc-badge-crit">{language === 'kn' ? (fc.next_60 === 'CRITICAL' ? 'ಅತ್ಯಂತ ಗಂಭೀರ' : fc.next_60) : fc.next_60}</span>
                </div>
                <div className="cc-chart-bar-wrap">
                  <div className="cc-chart-bar-fill" style={{ width: '95%', backgroundColor: '#ff2d55' }} />
                </div>
              </div>

            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t.cc_expected_speed}:</span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{fc.avg_speed_forecast[2]} {language === 'kn' ? 'ಕಿಮೀ/ಗಂ' : 'km/h'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t.cc_expected_queue}:</span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{fc.queue_length_forecast[2]} {t.cc_km}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t.cc_estimated_delay}:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fc.estimated_delay} {t.cc_mins}</span>
              </div>
            </div>
          </div>

          {/* 4. AI ACTION RECOMMENDATIONS */}
          <div className="cc-card">
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🛡️ {t.cc_recommended_actions_title}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t.cc_select_rec_desc}
            </p>
            
            <div className="cc-rec-list">
              {recActions.map((act, i) => {
                let emoji = "🚨";
                if (act.toLowerCase().includes("officer")) emoji = "👮";
                else if (act.toLowerCase().includes("barricade")) emoji = "🚧";
                else if (act.toLowerCase().includes("diversion")) emoji = "↔";
                else if (act.toLowerCase().includes("emergency")) emoji = "🚑";
                
                const isApplied = appliedActions.includes(i);
                return (
                  <div 
                    key={i} 
                    onClick={() => toggleAction(i)}
                    style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      padding: '12px 14px', 
                      background: isApplied ? 'var(--primary-glow)' : 'var(--bg-primary)',
                      borderRadius: '6px', 
                      borderLeft: `3px solid ${isApplied ? 'var(--primary)' : 'var(--danger)'}`,
                      border: isApplied ? '1px solid rgba(234, 117, 14, 0.3)' : '1px solid var(--border-color)',
                      fontSize: '0.8rem', 
                      fontWeight: 700, 
                      color: 'var(--text-dark)', 
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isApplied} 
                      readOnly 
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span>{emoji} {translateRecommendation(act)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                {t.cc_estimated_reduction}
              </div>
              <div className="cc-comparison-container">
                <div className="cc-comparison-box cc-comp-without">
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' }}>{t.cc_without_intervention}</div>
                  <div className="cc-comp-val">{baseDelay} {t.cc_min}</div>
                  <div style={{ fontSize: '0.55rem', opacity: 0.8, marginTop: '2px' }}>{t.cc_average_delay}</div>
                </div>
                <div className="cc-comparison-box cc-comp-with">
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' }}>{t.cc_with_intervention}</div>
                  <div className="cc-comp-val" style={{ color: appliedActions.length === 5 ? 'var(--success)' : 'var(--warning)' }}>
                    {currentDelayWithIntervention} {t.cc_min}
                  </div>
                  <div style={{ fontSize: '0.55rem', opacity: 0.8, marginTop: '2px' }}>{t.cc_estimated_delay_lbl}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

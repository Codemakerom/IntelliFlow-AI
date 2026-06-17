import React, { useEffect, useState } from 'react';

export default function Planner({ onEventEnd }) {
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Format current datetime for datetime-local input
  const formatDateTime = (date) => {
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Default datetimes
  const initialStart = formatDateTime(new Date());
  const initialEnd = formatDateTime(new Date(Date.now() + 3 * 60 * 60 * 1000)); // +3 hours

  // Form state
  const [form, setForm] = useState({
    event_type: 'unplanned', // 'planned' or 'unplanned'
    event_cause: 'vehicle_breakdown',
    corridor: 'Mysore Road',
    zone: '',
    police_station: '',
    start_datetime: initialStart,
    end_datetime: initialEnd,
    priority: 'High',
    veh_type: 'others',
    requires_road_closure: false,
    description: '',
    rolling_events_24h: 5,
    rolling_closures_24h: 1,
    rolling_events_7d: 20,
    rolling_closures_7d: 3,
  });

  // Predictions state
  const [results, setResults] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Load options from FastAPI
  useEffect(() => {
    fetch('http://localhost:8000/api/options')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load form metadata.');
        return res.json();
      })
      .then((data) => {
        setOptions(data);
        setLoading(false);
        // Apply defaults for initial corridor
        if (data.corridor_defaults?.[form.corridor]) {
          const defaults = data.corridor_defaults[form.corridor];
          setForm((prev) => ({
            ...prev,
            zone: defaults.zone,
            police_station: defaults.police_station,
            rolling_events_24h: defaults.rolling_events_24h,
            rolling_closures_24h: defaults.rolling_closures_24h,
            rolling_events_7d: defaults.rolling_events_7d,
            rolling_closures_7d: defaults.rolling_closures_7d,
          }));
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Sync corridor changes
  const handleCorridorChange = (corr) => {
    const nextForm = { ...form, corridor: corr };
    if (options?.corridor_defaults?.[corr]) {
      const defaults = options.corridor_defaults[corr];
      nextForm.zone = defaults.zone;
      nextForm.police_station = defaults.police_station;
      nextForm.rolling_events_24h = defaults.rolling_events_24h;
      nextForm.rolling_closures_24h = defaults.rolling_closures_24h;
      nextForm.rolling_events_7d = defaults.rolling_events_7d;
      nextForm.rolling_closures_7d = defaults.rolling_closures_7d;
    }
    setForm(nextForm);
  };

  const handleInputChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  // Sync causes dropdown options based on planned/unplanned toggle
  const handleTypeChange = (type) => {
    const defaultCause = type === 'planned' ? 'construction' : 'vehicle_breakdown';
    setForm((prev) => ({
      ...prev,
      event_type: type,
      event_cause: defaultCause,
      requires_road_closure: type === 'planned' ? true : false // planned usually requires block
    }));
  };

  // Submit prediction request
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResults(null);

    // Extract time components from start_datetime
    const startDate = new Date(form.start_datetime);
    const hour = startDate.getHours();
    
    // JS: 0=Sunday, 1=Monday... Python: 0=Monday, 6=Sunday
    const jsDay = startDate.getDay();
    const day_of_week = jsDay === 0 ? 6 : jsDay - 1;
    
    const month = startDate.getMonth() + 1; // 1-12

    // Prepare payload
    const payload = {
      event_type: form.event_type,
      event_cause: form.event_cause,
      corridor: form.corridor,
      zone: form.zone,
      police_station: form.police_station,
      priority: form.priority,
      veh_type: (form.event_type === 'unplanned' && ['vehicle_breakdown', 'accident'].includes(form.event_cause)) ? form.veh_type : 'others',
      requires_road_closure: form.requires_road_closure,
      hour,
      day_of_week,
      month,
      rolling_events_24h: form.rolling_events_24h,
      rolling_closures_24h: form.rolling_closures_24h,
      rolling_events_7d: form.rolling_events_7d,
      rolling_closures_7d: form.rolling_closures_7d,
      groq_api_key: localStorage.getItem('groq_api_key') || '',
    };

    fetch('http://localhost:8000/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('API prediction failed.');
        return res.json();
      })
      .then((data) => {
        setResults(data);
        setSubmitting(false);
      })
      .catch((err) => {
        console.error(err);
        alert(`Prediction failed: ${err.message}`);
        setSubmitting(false);
      });
  };

  // Leaflet Map modal initialization and cleanup
  useEffect(() => {
    if (!showMapModal || !results) return;

    const timer = setTimeout(() => {
      const mapContainer = document.getElementById('map-view');
      if (!mapContainer) return;

      const L = window.L;
      if (!L) {
        console.error("Leaflet not loaded globally.");
        return;
      }

      const centerLat = results.incident_coords?.lat || 12.9716;
      const centerLon = results.incident_coords?.lon || 77.5946;

      // Initialize map
      const map = L.map('map-view').setView([centerLat, centerLon], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Define icons using leaflet color markers
      const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const blueIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const orangeIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // 1. Incident Marker
      L.marker([centerLat, centerLon], { icon: redIcon })
        .addTo(map)
        .bindPopup(`<strong>📍 Incident Corridor: ${results.primary_corridor}</strong><br/>Cause: ${form.event_cause.replace('_', ' ').toUpperCase()}`)
        .openPopup();

      // 2. Barricade Junctions Markers
      if (results.junctions_coords) {
        results.junctions_coords.forEach((junc) => {
          if (junc.lat && junc.lon) {
            L.marker([junc.lat, junc.lon], { icon: orangeIcon })
              .addTo(map)
              .bindPopup(`<strong>🚧 Barricade Junction: ${junc.name}</strong>`);
          }
        });
      }

      // 3. Alternative Routes Markers & Dotted Connectors
      if (results.alternatives_coords) {
        results.alternatives_coords.forEach((alt) => {
          if (alt.lat && alt.lon) {
            L.marker([alt.lat, alt.lon], { icon: blueIcon })
              .addTo(map)
              .bindPopup(`<strong>↩️ Alternative Route: ${alt.name}</strong>`);

            L.polyline([[centerLat, centerLon], [alt.lat, alt.lon]], {
              color: '#007aff',
              weight: 3,
              dashArray: '5, 10',
              opacity: 0.7
            }).addTo(map);
          }
        });
      }

      // Fit map bounds to show all markers
      const bounds = [[centerLat, centerLon]];
      if (results.junctions_coords) {
        results.junctions_coords.forEach(j => bounds.push([j.lat, j.lon]));
      }
      if (results.alternatives_coords) {
        results.alternatives_coords.forEach(a => bounds.push([a.lat, a.lon]));
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }

      // Cleanup on unmount/close
      return () => {
        map.remove();
      };
    }, 150);

    return () => clearTimeout(timer);
  }, [showMapModal, results]);

  if (loading) {
    return (
      <div className="empty-results">
        <div className="status-dot"></div>
        <p>Loading metadata and default settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-results" style={{ color: 'var(--danger)' }}>
        <span className="empty-icon">⚠️</span>
        <p>Error starting planner: {error}</p>
        <p style={{ fontSize: '0.85rem' }}>Make sure the FastAPI backend is running on port 8000.</p>
      </div>
    );
  }

  // Pre-filtered Causes
  const unplannedCauses = [
    { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
    { value: 'pot_holes', label: 'Potholes' },
    { value: 'water_logging', label: 'Water Logging' },
    { value: 'accident', label: 'Accident' },
    { value: 'tree_fall', label: 'Tree Fall' },
    { value: 'road_conditions', label: 'Road Conditions' },
    { value: 'congestion', label: 'Congestion' }
  ];

  const plannedCauses = [
    { value: 'construction', label: 'Construction' },
    { value: 'public_event', label: 'Public Event (e.g. Cricket)' },
    { value: 'procession', label: 'Procession' },
    { value: 'vip_movement', label: 'VIP Movement' },
    { value: 'protest', label: 'Protest' }
  ];

  const vehicleTypes = [
    "BMTC Bus", "Heavy Vehicle", "LCV", "Private Bus", "Private Car", "Truck", "KSRTC Bus", "Taxi / Auto"
  ];

  // Calculate planned duration if in planned mode
  let plannedDurationStr = '';
  if (form.event_type === 'planned' && form.start_datetime && form.end_datetime) {
    const diffMs = new Date(form.end_datetime) - new Date(form.start_datetime);
    if (diffMs > 0) {
      const diffHrs = diffMs / (1000 * 60 * 60);
      if (diffHrs >= 24) {
        plannedDurationStr = `${(diffHrs / 24).toFixed(1)} days`;
      } else {
        plannedDurationStr = `${diffHrs.toFixed(1)} hrs`;
      }
    }
  }

  return (
    <div>
      {/* Event Type Switch Toggle (Planned vs Unplanned) */}
      <div className="card" style={{ padding: '20px 32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div className="flex-header-container">
            <div className="header-square-icon header-square-purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Operational Context
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Toggle between Unplanned Incident Logging and Planned Event Parameters
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ 
              fontWeight: 700, 
              fontSize: '0.9rem', 
              color: form.event_type === 'unplanned' ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'color 0.3s ease'
            }}>
              Unplanned Incident
            </span>
            
            <div className="checkbox-wrapper-41">
              <input 
                id="event-type-toggle"
                type="checkbox" 
                checked={form.event_type === 'planned'}
                onChange={(e) => handleTypeChange(e.target.checked ? 'planned' : 'unplanned')}
              />
            </div>
            
            <span style={{ 
              fontWeight: 700, 
              fontSize: '0.9rem', 
              color: form.event_type === 'planned' ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'color 0.3s ease'
            }}>
              Planned Event
            </span>
          </div>
        </div>
      </div>

      <div className="planner-layout">
        {/* Left Column: Form */}
        <div className="card">
          <div className="flex-header-container" style={{ borderBottom: '1.5px solid var(--bg-primary)', paddingBottom: '16px', marginBottom: '24px' }}>
            <div className={`header-square-icon ${form.event_type === 'planned' ? 'header-square-blue' : 'header-square-orange'}`}>
              {form.event_type === 'planned' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', textTransform: 'uppercase', margin: 0, fontWeight: 800 }}>
              {form.event_type === 'planned' ? 'Planned Event Parameters' : 'Unplanned Incident Logger'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit}>
            
            {/* 1. Base Shared Fields */}
            <div className="form-group-grid">
              <div className="form-group">
                <div className="form-label-with-icon">
                  <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <label>Primary Corridor</label>
                </div>
                <select 
                  value={form.corridor} 
                  onChange={(e) => handleCorridorChange(e.target.value)}
                >
                  {options?.corridors.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <div className="form-label-with-icon">
                  <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </span>
                  <label>Priority Level</label>
                </div>
                <select 
                  value={form.priority} 
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                >
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="form-group-grid">
              <div className="form-group">
                <div className="form-label-with-icon">
                  <span style={{ color: '#007aff', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <label>Zone (Auto-filled)</label>
                </div>
                <input type="text" value={form.zone} readOnly style={{ backgroundColor: '#f0f4f8', cursor: 'not-allowed', fontWeight: 700 }} />
              </div>

              <div className="form-group">
                <div className="form-label-with-icon">
                  <span style={{ color: '#007aff', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <label>Police Station (Auto-filled)</label>
                </div>
                <input type="text" value={form.police_station} readOnly style={{ backgroundColor: '#f0f4f8', cursor: 'not-allowed', fontWeight: 700 }} />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-with-icon">
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <label>Start Date & Time</label>
              </div>
              <input 
                type="datetime-local" 
                value={form.start_datetime}
                onChange={(e) => handleInputChange('start_datetime', e.target.value)}
              />
            </div>

            {/* 2. DYNAMIC INPUTS: UNPLANNED */}
            {form.event_type === 'unplanned' && (
              <div>
                <div className="form-group">
                  <div className="form-label-with-icon">
                    <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </span>
                    <label>Event Cause</label>
                  </div>
                  <select
                    value={form.event_cause}
                    onChange={(e) => handleInputChange('event_cause', e.target.value)}
                  >
                    {unplannedCauses.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Conditional Vehicle Type */}
                {['vehicle_breakdown', 'accident'].includes(form.event_cause) && (
                  <div className="form-group">
                    <div className="form-label-with-icon">
                      <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                          <circle cx="7" cy="17" r="2" />
                          <circle cx="17" cy="17" r="2" />
                        </svg>
                      </span>
                      <label>Involved Vehicle Type</label>
                    </div>
                    <select
                      value={form.veh_type}
                      onChange={(e) => handleInputChange('veh_type', e.target.value)}
                    >
                      {vehicleTypes.map((vt) => (
                        <option key={vt} value={vt}>{vt}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="checkbox-group" style={{ marginTop: '20px' }}>
                  <input 
                    id="closure-checkbox"
                    type="checkbox" 
                    checked={form.requires_road_closure} 
                    onChange={(e) => handleInputChange('requires_road_closure', e.target.checked)}
                  />
                  <label htmlFor="closure-checkbox">Requires Road Closure</label>
                </div>
              </div>
            )}

            {/* 3. DYNAMIC INPUTS: PLANNED */}
            {form.event_type === 'planned' && (
              <div>
                <div className="form-group">
                  <div className="form-label-with-icon">
                    <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </span>
                    <label>Event Cause</label>
                  </div>
                  <select
                    value={form.event_cause}
                    onChange={(e) => handleInputChange('event_cause', e.target.value)}
                  >
                    {plannedCauses.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div className="form-label-with-icon">
                    <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <label>Expected End Date & Time</label>
                  </div>
                  <input 
                    type="datetime-local" 
                    value={form.end_datetime}
                    onChange={(e) => handleInputChange('end_datetime', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div className="form-label-with-icon">
                    <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </span>
                    <label>Event Description / Details</label>
                  </div>
                  <textarea 
                    rows="4"
                    value={form.description}
                    placeholder="Describe specific work details (e.g. Metro pillar work, flyover construction, cricket match at Chinnaswamy Stadium)..."
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.95rem',
                      width: '100%',
                      resize: 'vertical',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
            )}

            {/* Historical rolling metrics section */}
            <div className="form-group-grid" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '24px' }}>
              <div className="form-group">
                <div className="form-label-with-icon">
                  <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </span>
                  <label>Corridor Incidents (24h)</label>
                </div>
                <input 
                  type="number" 
                  min="0" 
                  value={form.rolling_events_24h} 
                  onChange={(e) => handleInputChange('rolling_events_24h', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <div className="form-label-with-icon">
                  <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M5 18v2M19 18v2M2 10h20M2 14h20" />
                    </svg>
                  </span>
                  <label>Corridor Closures (24h)</label>
                </div>
                <input 
                  type="number" 
                  min="0" 
                  value={form.rolling_closures_24h} 
                  onChange={(e) => handleInputChange('rolling_closures_24h', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {submitting ? (
                'Running Calculations...'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Predict Event Impact
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Results */}
        <div className="card">
          <div className="flex-header-container" style={{ borderBottom: '1.5px solid var(--bg-primary)', paddingBottom: '16px', marginBottom: '24px' }}>
            <div className="header-square-icon header-square-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
                <path d="M3 20h18" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', textTransform: 'uppercase', margin: 0, fontWeight: 800 }}>
              Prediction & Resource Deployment Plan
            </h3>
          </div>
          
          {results ? (
            <div>
              {(() => {
                const getBucketColor = (bucket) => {
                  switch (bucket?.toLowerCase()) {
                    case 'critical': return { bg: 'rgba(255, 59, 48, 0.12)', fg: '#ff3b30', dot: '#ff3b30' };
                    case 'high': return { bg: 'rgba(255, 149, 0, 0.12)', fg: '#ff9500', dot: '#ff9500' };
                    case 'moderate': case 'medium': return { bg: 'rgba(234, 117, 14, 0.12)', fg: 'var(--primary)', dot: 'var(--primary)' };
                    default: return { bg: 'rgba(52, 199, 89, 0.12)', fg: '#34c759', dot: '#34c759' };
                  }
                };
                const bColor = getBucketColor(results.impact_bucket);
                return (
                  <div className="results-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Alert Level
                      </span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)', marginTop: '4px' }}>
                        {results.alert_level.split(' ')[1]}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: bColor.bg,
                      color: bColor.fg,
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <span style={{ width: '8px', height: '8px', backgroundColor: bColor.dot, borderRadius: '50%' }}></span>
                      {results.impact_bucket}
                    </div>
                  </div>
                );
              })()}

              <div className="results-grid">
                
                {/* Score card */}
                <div 
                  className="result-card card-pink"
                  onClick={() => setModalData({
                    title: "Impact Score Reasoning",
                    value: `${results.event_impact_score}/100`,
                    text: results.reasoning?.event_impact_score || "Calculating reasoning..."
                  })}
                >
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-pink">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                    </div>
                    <div>
                      <h4>Impact Score</h4>
                      <div className="value">{results.event_impact_score} / 100</div>
                      <div className="detail">Weighted delay & radius severity</div>
                    </div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Click to see reasoning
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* Zone Congestion Risk */}
                <div 
                  className="result-card card-blue"
                  onClick={() => setModalData({
                    title: "Zone Congestion Risk Reasoning",
                    value: `${results.zone_congestion_risk}/100`,
                    text: results.reasoning?.zone_congestion_risk || "Calculating reasoning..."
                  })}
                >
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-blue">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                        <circle cx="7" cy="17" r="2" />
                        <circle cx="17" cy="17" r="2" />
                      </svg>
                    </div>
                    <div>
                      <h4>Zone Congestion Risk</h4>
                      <div className="value">{results.zone_congestion_risk} / 100</div>
                      <div className="detail">Zone {results.zone} @ {results.hour}</div>
                    </div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Click to see reasoning
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* ML Road Closure Prob */}
                <div 
                  className="result-card card-purple"
                  onClick={() => setModalData({
                    title: "ML Road Closure Probability Reasoning",
                    value: results.closure_probability,
                    text: results.reasoning?.road_closure_predicted || "Calculating reasoning..."
                  })}
                >
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-purple">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                        <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3 3" />
                      </svg>
                    </div>
                    <div>
                      <h4>ML Road Closure Prob</h4>
                      <div className="value">{results.closure_probability}</div>
                      <div className="detail">Estimated closure probability</div>
                    </div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Click to see reasoning
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* ML Estimated Duration */}
                <div 
                  className="result-card card-green"
                  onClick={() => setModalData({
                    title: "ML Estimated Duration Reasoning",
                    value: results.estimated_resolution_time_min >= 60 
                      ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} hrs` 
                      : `${results.estimated_resolution_time_min.toFixed(0)} min`,
                    text: results.reasoning?.estimated_resolution_time_min || "Calculating reasoning..."
                  })}
                >
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-green">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <h4>ML Estimated Duration</h4>
                      <div className="value">
                        {results.estimated_resolution_time_min >= 60 
                          ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} hrs` 
                          : `${results.estimated_resolution_time_min.toFixed(0)} min`}
                      </div>
                      <div className="detail">Estimated clearance duration</div>
                    </div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Click to see reasoning
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* Dynamic Recommendation Banner */}
                <div className="recommendation-banner">
                  <div className="recommendation-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 11 11 13 15 9" />
                    </svg>
                  </div>
                  <div className="recommendation-text">
                    <strong style={{ color: 'rgb(46, 125, 50)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.5px' }}>
                      RECOMMENDATION
                    </strong>
                    Deploy additional personnel near {results.zone}. Monitor congestion trends closer to the event time.
                  </div>
                </div>

                {/* Conditional Planned Duration vs ML Duration */}
                {form.event_type === 'planned' && plannedDurationStr && (
                  <div className="result-card full-width-result" style={{ borderLeft: '4px solid #007aff', backgroundColor: '#eef7ff' }}>
                    <h4 style={{ color: '#007aff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Planned vs Forecasted Duration
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your Scheduled Time</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1d1d1f' }}>{plannedDurationStr}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Forecast Clearance</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {results.estimated_resolution_time_min >= 60 
                            ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} hrs` 
                            : `${results.estimated_resolution_time_min.toFixed(0)} min`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manpower calculator card */}
                <div 
                  className="result-card full-width-result" 
                  style={{ borderLeft: '4px solid var(--primary)' }}
                  onClick={() => setModalData({
                    title: "Personnel Deployment Reasoning",
                    value: `Total Deployable: ${results.total_personnel_estimated}`,
                    text: results.reasoning?.officers_recommended || "Calculating reasoning..."
                  })}
                >
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-orange">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 11 2 2 4-4" />
                      </svg>
                    </div>
                    <div style={{ width: '100%' }}>
                      <h4 style={{ color: 'var(--primary)', fontWeight: 800 }}>Personnel Deployment Recommendation</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Officers</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{results.officers_recommended}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barricades</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{results.barricades_recommended}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vehicles</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{results.vehicles_recommended}</div>
                        </div>
                      </div>
                      <div className="detail" style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px', fontWeight: 600 }}>
                        Total Personnel Deployable: {results.total_personnel_estimated} (includes driver crews)
                      </div>
                    </div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Click to see reasoning
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* PRECISION BARRICADING card */}
                <div className="result-card full-width-result precision-barricading-card">
                  {/* Card Header */}
                  <div className="precision-header">
                    <div className="precision-header-left">
                      <div className="precision-icon-wrap">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ color: '#1d1d1f', fontWeight: 900, fontSize: '1rem', margin: 0, whiteSpace: 'nowrap' }}>Precision Barricading™</h4>
                          <span className="precision-tag">ML-POWERED</span>
                        </div>
                        <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600, lineHeight: 1.4 }}>
                          ML-driven upstream choke-point sealing · Minimum barricades, maximum impact
                        </p>
                      </div>
                    </div>
                    <div className="precision-totals">
                      <div className="precision-total-item">
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{results.total_barricades_min}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Barricades</span>
                      </div>
                      <div className="precision-total-divider" />
                      <div className="precision-total-item">
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#007aff' }}>{results.total_officers_choke}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Officers</span>
                      </div>
                    </div>
                  </div>

                  {/* Choke-Point Cards */}
                  <div className="choke-points-grid">
                    {(results.precision_barricades || []).map((junc, i) => (
                      <div key={i} className={`choke-point-card ${i === 0 ? 'choke-green' : i === 1 ? 'choke-purple' : ''}`}>
                        <div className="choke-point-top">
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                            <div className="choke-number">{i + 1}</div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1d1d1f', lineHeight: 1.3 }}>
                                {junc.name}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                                Optimal Choke-Point to Seal
                              </div>
                            </div>
                          </div>
                          <div className="choke-efficiency-badge">
                            <span style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 }}>{junc.efficiency_pct}%</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.3 }}>Inflow<br/>Prevented</span>
                          </div>
                        </div>

                        {/* Mini stats row */}
                        <div className="choke-stats-row">
                          <div className="choke-stat">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M5 18v2M19 18v2M2 10h20M2 14h20"/>
                            </svg>
                            <span>{junc.barricades_needed} barricade{junc.barricades_needed > 1 ? 's' : ''}</span>
                          </div>
                          <div className="choke-stat">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11 2 2 4-4"/>
                            </svg>
                            <span>{junc.officers_needed} officer{junc.officers_needed > 1 ? 's' : ''}</span>
                          </div>
                          <div className="choke-stat">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                            </svg>
                            <span>{junc.closure_rate_pct}% hist. closure rate</span>
                          </div>
                        </div>

                        {/* Efficiency bar */}
                        <div className="choke-efficiency-bar-wrap">
                          <div className="choke-efficiency-bar" style={{ width: `${junc.efficiency_pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Alternative Routes section */}
                  <div className="precision-divider" />
                  <div 
                    className="precision-diversion-section"
                    onClick={() => setModalData({
                      title: "Diversion Schemes & Precision Barricading Reasoning",
                      value: (results.precision_barricades || []).map(b => `${b.name} (${b.efficiency_pct}% inflow prevented)`).join('\n'),
                      text: results.reasoning?.precision_barricading || results.reasoning?.alternate_routes || "Calculating reasoning..."
                    })}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>
                        Alternate Diversion Routes
                      </strong>
                      <div className="click-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Click for ML reasoning
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                      </div>
                    </div>
                    <div className="alternatives-container">
                      {results.alternate_routes.map((route, i) => (
                        <div className="alt-route" key={i}>{route}</div>
                      ))}
                    </div>
                  </div>

                  {/* Map button */}
                  <button 
                    className="btn-secondary" 
                    style={{ marginTop: '16px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMapModal(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                      <line x1="9" y1="3" x2="9" y2="18" />
                      <line x1="15" y1="6" x2="15" y2="21" />
                    </svg>
                    View Choke-Points on Map
                  </button>
                </div>

              </div>

              {/* ── CLOSE EVENT BUTTON ── */}
              <div style={{ marginTop: '24px', padding: '20px 24px', background: 'linear-gradient(135deg, #fff4ec, #fff9f5)', border: '1.5px solid rgba(234,117,14,0.2)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1d1d1f' }}>Event Resolved?</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '3px' }}>
                      Log actual outcomes to auto-calibrate the ML model for future predictions
                    </div>
                  </div>
                  <button
                    onClick={() => onEventEnd && onEventEnd({
                      corridor: form?.corridor,
                      event_cause: form?.event_cause,
                      event_type: form?.event_type || 'unplanned',
                      start_datetime: form?.start_datetime,
                      predicted_time_min: parseFloat(results.estimated_resolution_time_min) || 0,
                      predicted_closure_prob: results.road_closure_probability_pct != null
                        ? results.road_closure_probability_pct / 100 : 0,
                      barricades: results.precision_barricades || [],
                      officers: results.officers_recommended,
                      impact_score: results.event_impact_score,
                      alternatives: results.alternate_routes || [],
                      eventLabel: `${(form?.event_cause || '').replace(/_/g,' ')} — ${form?.corridor || ''}`,
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '14px 28px',
                      background: 'linear-gradient(135deg, #ff3b30, #ff6b35)',
                      color: 'white', border: 'none', borderRadius: '12px',
                      fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(255,59,48,0.3)',
                      transition: 'all 0.25s ease', fontFamily: 'var(--font-body)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,59,48,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,59,48,0.3)'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Close Event & Log to ML
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-results">
              <span className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
              </span>
              <p>Configure parameters on the left and trigger prediction to calculate operational plans.</p>
            </div>
          )}

        </div>
      </div>

      {/* Reasoning Modal Popup */}
      {modalData && (
        <div className="modal-backdrop" onClick={() => setModalData(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalData.title}</h3>
              <button className="modal-close-btn" onClick={() => setModalData(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', display: 'block', marginBottom: '10px' }}>Metric Value</span>
                <span className="modal-metric-badge">{modalData.value}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', display: 'block', marginBottom: '14px' }}>
                  AI Reasoning & Analysis
                </span>
                <p style={{ fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.8, whiteSpace: 'pre-line', fontSize: '0.95rem' }}>{modalData.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal Popup */}
      {showMapModal && (
        <div className="modal-backdrop" onClick={() => setShowMapModal(false)}>
          <div className="map-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
                Diversion Map Visualization
              </h3>
              <button className="modal-close-btn" onClick={() => setShowMapModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                Showing primary incident site (red), recommended detours (blue), and barricade zones (orange).
              </p>
              <div id="map-view" className="map-view-container"></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';

function ConfidenceRing({ pct, size = 120, strokeWidth = 10, color = '#ea750e' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0ede9" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.25,0.46,0.45,0.94)' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fontSize: size * 0.2, fontWeight: 800, fill: '#1d1d1f', fontFamily: 'Outfit, sans-serif' }}>
        {pct}%
      </text>
    </svg>
  );
}

function AccuracyBadge({ pct }) {
  const color = pct >= 80 ? '#34c759' : pct >= 60 ? '#ff9500' : '#ff3b30';
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'20px',
      background:`${color}18`, color, fontWeight:800, fontSize:'0.75rem', border:`1px solid ${color}40` }}>
      {pct}%
    </span>
  );
}

function TimeSince(isoStr) {
  if (!isoStr) return 'Never';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--bg-primary)' }}>
      <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-dark)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
      <span style={{ fontSize:'0.9rem', fontWeight:800, color: highlight || '#1d1d1f' }}>{value}</span>
    </div>
  );
}

export default function LearningEngine({ predictionContext }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainLog, setRetrainLog] = useState([]);

  const triggerFullRetrain = async () => {
    setRetraining(true);
    setRetrainStatus(null);
    try {
      const res = await fetch('http://localhost:8000/api/trigger-retrain', { method: 'POST' });
      const data = await res.json();
      setRetrainStatus(data);
      if (data.success) {
        // Refresh stats and log after successful retrain
        loadStats();
        fetch('http://localhost:8000/api/retrain-log')
          .then(r => r.json()).then(d => setRetrainLog(d.runs || []));
      }
    } catch (err) {
      setRetrainStatus({ success: false, error: err.message });
    }
    setRetraining(false);
  };

  // Load retrain log on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/retrain-log')
      .then(r => r.json()).then(d => setRetrainLog(d.runs || []))
      .catch(() => {});
  }, []);

  // ── Officer form state ──
  const [actualTime, setActualTime] = useState('');
  const [resolutionLocation, setResolutionLocation] = useState('');
  const [diversionEffect, setDiversionEffect] = useState('');  // Perfect / Adequate / Failed
  const [manpowerSufficiency, setManpowerSufficiency] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [officerId, setOfficerId] = useState('OFF-' + Math.floor(1000 + Math.random() * 9000));
  const [notes, setNotes] = useState('');

  // ── Standalone form state (used when no predictionContext) ──
  const corridors = ['Mysore Road','Bellary Road 1','Tumkur Road','Bellary Road 2','Hosur Road','ORR North 1','Old Madras Road','Magadi Road','ORR East 1','Non-corridor'];
  const causes = ['vehicle_breakdown','accident','construction','pot_holes','water_logging','public_event','procession','protest','vip_movement','tree_fall','congestion'];
  const [standaloneForm, setStandaloneForm] = useState({
    corridor: 'Mysore Road', event_cause: 'vehicle_breakdown', event_type: 'unplanned',
    predicted_time_min: '', officers: '', barricades: '', actual_closed: false,
  });

  const isPrePopulated = !!predictionContext;
  const ctx = predictionContext || {};

  // Derived values
  const predicted = isPrePopulated ? (ctx.predicted_time_min || 0) : (parseFloat(standaloneForm.predicted_time_min) || 0);
  const actual = parseFloat(actualTime) || 0;
  const hasBoth = predicted > 0 && actual > 0;
  const delta = hasBoth ? +(actual - predicted).toFixed(1) : null;
  const liveAccuracy = hasBoth ? Math.max(0, Math.min(100, +(100 - Math.abs(delta / predicted) * 100).toFixed(1))) : null;
  const isDelayed = hasBoth && delta > 45;

  const loadStats = () => {
    setStatsLoading(true);
    fetch('http://localhost:8000/api/model-stats')
      .then(r => r.json()).then(d => { setStats(d); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasBoth) return alert('Please enter the Actual Clearance Time.');
    setSubmitting(true);
    try {
      const payload = {
        corridor: isPrePopulated ? ctx.corridor : standaloneForm.corridor,
        event_cause: isPrePopulated ? ctx.event_cause : standaloneForm.event_cause,
        event_type: isPrePopulated ? ctx.event_type : standaloneForm.event_type,
        predicted_time_min: predicted,
        actual_time_min: actual,
        predicted_closure_prob: ctx.predicted_closure_prob || 0,
        actual_closed: standaloneForm.actual_closed,
        notes: [
          officerId ? `Officer: ${officerId}` : '',
          resolutionLocation ? `Location: ${resolutionLocation}` : '',
          diversionEffect ? `Diversion: ${diversionEffect}` : '',
          manpowerSufficiency ? `Manpower: ${manpowerSufficiency}` : '',
          isDelayed && delayReason ? `Delay reason: ${delayReason}` : '',
          notes,
        ].filter(Boolean).join(' | '),
      };
      const res = await fetch('http://localhost:8000/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data);
      setActualTime(''); setResolutionLocation(''); setDiversionEffect('');
      setManpowerSufficiency(''); setDelayReason(''); setNotes('');
      loadStats();
    } catch (err) { alert('Failed: ' + err.message); }
    setSubmitting(false);
  };

  const confPct = stats?.avg_accuracy_pct ?? 0;
  const ringColor = confPct >= 80 ? '#34c759' : confPct >= 60 ? '#ff9500' : '#ff3b30';

  return (
    <div className="learning-engine-page">

      {/* Banner */}
      <div className="le-banner card">
        <div className="le-banner-left">
          <div className="le-banner-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a9.96 9.96 0 0 0-7.07 2.93A10 10 0 1 0 22 12c0-5.52-4.48-10-10-10z"/>
              <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:900, color:'#1d1d1f' }}>
                Auto-Calibrating ML Feedback Loop
              </h2>
              <span className="le-tag pulse-tag">LIVE LEARNING</span>
              {isPrePopulated && (
                <span style={{ background:'rgba(255,59,48,0.1)', color:'#ff3b30', fontSize:'0.65rem', fontWeight:800, padding:'3px 9px', borderRadius:'20px', border:'1px solid rgba(255,59,48,0.25)', letterSpacing:'0.5px' }}>
                  EVENT ACTIVE
                </span>
              )}
            </div>
            <p style={{ margin:'4px 0 0', fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:600 }}>
              {isPrePopulated
                ? `Logging closure for: ${ctx.eventLabel}`
                : 'Every closed event recalibrates the model · Predictions improve with every data point logged'}
            </p>
          </div>
        </div>
        {stats?.last_updated && (
          <div className="le-last-updated">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Last retrain: {TimeSince(stats.last_updated)}
          </div>
        )}
      </div>

      <div className="le-layout">

        {/* ══ LEFT: Event Closure Form ══ */}
        <div className="card le-form-card">

          {/* ── Section 1: Auto-Populated Info ── */}
          <div style={{ marginBottom:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
              <div style={{ width:'6px', height:'20px', background:'var(--primary)', borderRadius:'3px' }} />
              <span style={{ fontSize:'0.7rem', fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px' }}>
                Auto-Populated — AI Prediction Record
              </span>
            </div>

            {isPrePopulated ? (
              <div style={{ background:'var(--bg-primary)', borderRadius:'12px', padding:'16px 18px' }}>
                <InfoRow label="Event ID / Type" value={ctx.eventLabel || '—'} highlight="var(--primary)" />
                <InfoRow label="Officer ID" value={officerId} />
                <InfoRow label="Predicted Clearance" value={`${predicted} min`} highlight="#007aff" />
                <InfoRow label="Barricades Deployed"
                  value={ctx.barricades?.length > 0
                    ? ctx.barricades.map(b => `${b.barricades_needed} at ${b.name}`).join(', ')
                    : 'None predicted'}
                />
                <InfoRow label="Officers Assigned" value={ctx.officers ? `${ctx.officers} officers` : '—'} />
                {ctx.alternatives?.length > 0 && (
                  <InfoRow label="Diverted Via" value={ctx.alternatives.join(', ')} />
                )}
              </div>
            ) : (
              /* Standalone mode — let officer pick corridor/cause */
              <div style={{ background:'var(--bg-primary)', borderRadius:'12px', padding:'14px 16px' }}>
                <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:600, margin:'0 0 12px' }}>
                  No active event linked. Enter prediction details manually:
                </p>
                <div className="form-group-grid">
                  <div className="form-group">
                    <div className="form-label-with-icon">
                      <label>Corridor</label>
                    </div>
                    <select value={standaloneForm.corridor}
                      onChange={e => setStandaloneForm(f => ({ ...f, corridor: e.target.value }))}>
                      {corridors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <div className="form-label-with-icon">
                      <label>Event Cause</label>
                    </div>
                    <select value={standaloneForm.event_cause}
                      onChange={e => setStandaloneForm(f => ({ ...f, event_cause: e.target.value }))}>
                      {causes.map(c => <option key={c} value={c}>{c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <div className="form-label-with-icon"><label>ML Predicted Clearance (min)</label></div>
                  <input type="number" min="0" step="0.1" placeholder="e.g. 35"
                    value={standaloneForm.predicted_time_min}
                    onChange={e => setStandaloneForm(f => ({ ...f, predicted_time_min: e.target.value }))} />
                </div>
                <div className="form-group-grid" style={{ marginTop: '10px' }}>
                  <div className="form-group">
                    <div className="form-label-with-icon">
                      <span style={{ color: '#ff9500', display: 'flex' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </span>
                      <label>Officers Assigned</label>
                    </div>
                    <input type="number" min="0" step="1" placeholder="e.g. 6"
                      value={standaloneForm.officers}
                      onChange={e => setStandaloneForm(f => ({ ...f, officers: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <div className="form-label-with-icon">
                      <span style={{ color: '#7c3aed', display: 'flex' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M5 18v2M19 18v2M2 10h20M2 14h20"/>
                        </svg>
                      </span>
                      <label>Barricades Deployed</label>
                    </div>
                    <input type="number" min="0" step="1" placeholder="e.g. 2"
                      value={standaloneForm.barricades}
                      onChange={e => setStandaloneForm(f => ({ ...f, barricades: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop:'2px dashed var(--border-color)', margin:'0 0 24px' }} />

          {/* ── Section 2: Officer Inputs ── */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'18px' }}>
              <div style={{ width:'6px', height:'20px', background:'#34c759', borderRadius:'3px' }} />
              <span style={{ fontSize:'0.7rem', fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px' }}>
                Officer Inputs — Post-Event Ground Truth
              </span>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Field 1: Actual Clearance Time */}
              <div className="form-group" style={{ marginBottom:'16px' }}>
                <div className="form-label-with-icon">
                  <span style={{ color:'#34c759', display:'flex' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </span>
                  <label>1. Actual Clearance Time (min)</label>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input type="number" min="0" step="0.5" placeholder="e.g. 50"
                    value={actualTime} onChange={e => setActualTime(e.target.value)}
                    style={{ flex:1, borderColor: actual > 0 ? '#34c75940' : undefined }} />
                  <button type="button"
                    style={{ padding:'10px 14px', background:'var(--bg-primary)', border:'1.5px solid var(--border-color)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', whiteSpace:'nowrap', fontFamily:'var(--font-body)' }}
                    onClick={() => {
                      if (isPrePopulated && ctx.start_datetime) {
                        const start = new Date(ctx.start_datetime);
                        const now = new Date();
                        const diffMs = now - start;
                        const diffMins = Math.max(1, Math.round(diffMs / 60000));
                        setActualTime(String(diffMins));
                      } else {
                        setActualTime("45"); // Sensible fallback duration for standalone mode
                      }
                    }}>
                    Set to Now
                  </button>
                </div>
              </div>

              {/* Live Delta */}
              {hasBoth && (
                <div className="le-delta-card" style={{ marginBottom:'16px' }}>
                  <div className="le-delta-item">
                    <span className="le-delta-label">Predicted</span>
                    <span className="le-delta-value" style={{ color:'#007aff' }}>{predicted} min</span>
                  </div>
                  <div className="le-delta-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                  <div className="le-delta-item">
                    <span className="le-delta-label">Actual</span>
                    <span className="le-delta-value" style={{ color:'#34c759' }}>{actual} min</span>
                  </div>
                  <div className="le-delta-divider" />
                  <div className="le-delta-item">
                    <span className="le-delta-label">Delta</span>
                    <span className="le-delta-value" style={{ color: delta > 0 ? '#ff3b30' : '#34c759' }}>
                      {delta > 0 ? '+' : ''}{delta} min
                    </span>
                  </div>
                  <div className="le-delta-item le-delta-accuracy">
                    <span className="le-delta-label">Accuracy</span>
                    <span className="le-delta-value" style={{ fontSize:'1.4rem', color: liveAccuracy >= 80 ? '#34c759' : liveAccuracy >= 60 ? '#ff9500' : '#ff3b30' }}>
                      {liveAccuracy}%
                    </span>
                  </div>
                </div>
              )}

              {/* Field 2: Resolution Location */}
              <div className="form-group" style={{ marginBottom:'16px' }}>
                <div className="form-label-with-icon">
                  <span style={{ color:'#007aff', display:'flex' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </span>
                  <label>2. Final Resolution Location</label>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input type="text" placeholder="e.g. Near Mysore Road underpass, km 4.2"
                    value={resolutionLocation} onChange={e => setResolutionLocation(e.target.value)} style={{ flex:1 }} />
                  <button type="button"
                    style={{ padding:'10px 14px', background:'var(--bg-primary)', border:'1.5px solid var(--border-color)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:'0.75rem', fontWeight:700, color:'#007aff', whiteSpace:'nowrap', fontFamily:'var(--font-body)' }}
                    onClick={() => navigator.geolocation?.getCurrentPosition(
                      pos => setResolutionLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
                      () => alert('GPS unavailable')
                    )}>
                    📍 Use GPS
                  </button>
                </div>
              </div>

              {/* Field 3: Diversion Effectiveness */}
              <div style={{ marginBottom:'16px' }}>
                <div className="form-label-with-icon" style={{ marginBottom:'10px' }}>
                  <span style={{ color:'#7c3aed', display:'flex' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                      <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                    </svg>
                  </span>
                  <label>3. Was the recommended diversion effective?</label>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {['Perfect', 'Adequate', 'Failed'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setDiversionEffect(opt)}
                      style={{
                        flex:1, padding:'10px', borderRadius:'10px', cursor:'pointer',
                        fontWeight:800, fontSize:'0.82rem', fontFamily:'var(--font-body)',
                        border: diversionEffect === opt ? '2px solid' : '1.5px solid var(--border-color)',
                        background: diversionEffect === opt
                          ? opt === 'Perfect' ? 'rgba(52,199,89,0.12)' : opt === 'Adequate' ? 'rgba(255,149,0,0.12)' : 'rgba(255,59,48,0.12)'
                          : 'var(--bg-primary)',
                        borderColor: diversionEffect === opt
                          ? opt === 'Perfect' ? '#34c759' : opt === 'Adequate' ? '#ff9500' : '#ff3b30'
                          : 'var(--border-color)',
                        color: diversionEffect === opt
                          ? opt === 'Perfect' ? '#34c759' : opt === 'Adequate' ? '#ff9500' : '#ff3b30'
                          : 'var(--text-muted)',
                        transition:'all 0.2s ease',
                      }}>
                      {opt === 'Perfect' ? '✓ ' : opt === 'Adequate' ? '~ ' : '✗ '}{opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 4: Manpower Sufficiency */}
              <div className="form-group" style={{ marginBottom:'16px' }}>
                <div className="form-label-with-icon">
                  <span style={{ color:'#ff9500', display:'flex' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </span>
                  <label>4. Was the recommended manpower sufficient?</label>
                </div>
                <select value={manpowerSufficiency} onChange={e => setManpowerSufficiency(e.target.value)}>
                  <option value="">Select assessment...</option>
                  <option value="Understaffed">Understaffed — needed more officers</option>
                  <option value="Just Right">Just Right — exactly enough</option>
                  <option value="Overstaffed">Overstaffed — too many deployed</option>
                </select>
              </div>

              {/* Field 5: Delay Reason (conditional) */}
              {isDelayed && (
                <div className="form-group" style={{ marginBottom:'16px', padding:'14px 16px', background:'rgba(255,59,48,0.05)', borderRadius:'10px', border:'1px solid rgba(255,59,48,0.2)' }}>
                  <div className="form-label-with-icon">
                    <span style={{ color:'#ff3b30', display:'flex' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </span>
                    <label style={{ color:'#ff3b30' }}>5. Primary Reason for Delay (+{delta} min over prediction)</label>
                  </div>
                  <select value={delayReason} onChange={e => setDelayReason(e.target.value)}>
                    <option value="">Select delay reason...</option>
                    <option value="Tow Truck Delayed">Tow Truck Delayed</option>
                    <option value="Secondary Accident">Secondary Accident</option>
                    <option value="Heavy Rain">Heavy Rain / Weather</option>
                    <option value="Public Interference">Public Interference</option>
                    <option value="Equipment Failure">Equipment Failure</option>
                    <option value="VIP Movement">VIP Movement Conflict</option>
                  </select>
                </div>
              )}

              {/* Optional notes */}
              <div className="form-group" style={{ marginBottom:'16px' }}>
                <div className="form-label-with-icon">
                  <label>Additional Officer Notes (optional)</label>
                </div>
                <input type="text" placeholder="Any other observations..."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {result && (
                <div className="le-success-banner" style={{ marginBottom:'16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <div>
                    <div><strong>Logged &amp; Recalibrated!</strong> {result.message}</div>
                    {result.retrain_message && (
                      <div style={{ fontSize:'0.78rem', marginTop:'4px', opacity:0.85 }}>
                        🔄 {result.retrain_message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary le-submit-btn" disabled={submitting || !hasBoth}>
                {submitting ? 'Logging...' : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Log Event &amp; Retrain Model
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ══ RIGHT: Model Stats ══ */}
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          <div className="card le-ring-card">
            <div className="le-ring-header">
              <div>
                <h3 style={{ margin:0, fontSize:'0.95rem', fontWeight:800, color:'var(--primary)', textTransform:'uppercase' }}>ML Model Confidence</h3>
                <p style={{ margin:'4px 0 0', fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600 }}>
                  Based on {stats?.total_events_logged || 0} closed events
                </p>
              </div>
              <div className="le-tag" style={{ fontSize:'0.6rem' }}>LIVE</div>
            </div>

            {statsLoading ? (
              <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>Loading...</div>
            ) : stats?.avg_accuracy_pct != null ? (
              <div className="le-ring-body">
                <ConfidenceRing pct={confPct} size={140} color={ringColor} />
                <div className="le-ring-stats">
                  <div className="le-stat-pill">
                    <span className="le-stat-pill-label">MAE</span>
                    <span className="le-stat-pill-value" style={{ color:'#7c3aed' }}>±{stats.mae_min} min</span>
                  </div>
                  <div className="le-stat-pill">
                    <span className="le-stat-pill-label">Events Logged</span>
                    <span className="le-stat-pill-value" style={{ color:'#007aff' }}>{stats.total_events_logged}</span>
                  </div>
                  <div className="le-stat-pill">
                    <span className="le-stat-pill-label">Last Retrain</span>
                    <span className="le-stat-pill-value" style={{ color:'var(--primary)' }}>{TimeSince(stats.last_updated)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:'0.85rem' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'8px' }}>📊</div>
                No feedback logged yet. Close your first event to activate the learning loop.
              </div>
            )}

            {stats?.accuracy_by_corridor?.length > 0 && (
              <div style={{ marginTop:'20px', borderTop:'1px solid var(--border-color)', paddingTop:'16px' }}>
                <p style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>
                  Accuracy by Corridor
                </p>
                {stats.accuracy_by_corridor.map((c, i) => (
                  <div key={i} style={{ marginBottom:'8px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-dark)' }}>{c.corridor}</span>
                      <span style={{ fontSize:'0.75rem', fontWeight:800, color: c.avg_accuracy >= 80 ? '#34c759' : c.avg_accuracy >= 60 ? '#ff9500' : '#ff3b30' }}>{c.avg_accuracy}%</span>
                    </div>
                    <div style={{ height:'4px', background:'var(--bg-primary)', borderRadius:'99px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${c.avg_accuracy}%`, background: c.avg_accuracy >= 80 ? '#34c759' : c.avg_accuracy >= 60 ? '#ff9500' : '#ff3b30', borderRadius:'99px', transition:'width 0.8s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {stats?.recent_feedback?.length > 0 && (
            <div className="card" style={{ padding:'20px 24px' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'14px' }}>
                Recent Closures Logged
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {stats.recent_feedback.map((fb, i) => (
                  <div key={i} className="le-history-row">
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.82rem', color:'#1d1d1f', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{fb.corridor}</div>
                      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:600 }}>
                        {fb.event_cause?.replace(/_/g,' ')} · {fb.predicted_time_min}→{fb.actual_time_min} min
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px', flexShrink:0 }}>
                      <AccuracyBadge pct={fb.accuracy_pct} />
                      <span style={{ fontSize:'0.65rem', color:'var(--text-muted)', fontWeight:600 }}>
                        {fb.delta_min > 0 ? '+' : ''}{fb.delta_min} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CRON Retrain Panel ── */}
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    Nightly CRON Retraining
                  </span>
                  <span style={{ background:'rgba(124,58,237,0.1)', color:'#7c3aed', fontSize:'0.6rem', fontWeight:800, padding:'2px 7px', borderRadius:'20px', border:'1px solid rgba(124,58,237,0.25)' }}>
                    02:00 DAILY
                  </span>
                </div>
                <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, margin:'4px 0 0' }}>
                  Calls .fit() on new feedback · applies outlier weights · hot-swaps model.pkl
                </p>
              </div>
              <button
                onClick={triggerFullRetrain}
                disabled={retraining}
                style={{
                  display:'flex', alignItems:'center', gap:'8px',
                  padding:'10px 18px', borderRadius:'10px', cursor: retraining ? 'not-allowed' : 'pointer',
                  background: retraining ? 'var(--bg-primary)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: retraining ? 'var(--text-muted)' : 'white',
                  border: retraining ? '1.5px solid var(--border-color)' : 'none',
                  fontWeight:800, fontSize:'0.8rem', fontFamily:'var(--font-body)',
                  boxShadow: retraining ? 'none' : '0 4px 12px rgba(124,58,237,0.3)',
                  transition:'all 0.2s ease',
                }}
              >
                {retraining ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation:'spin 1s linear infinite' }}>
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Retraining...
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Run Full Retrain Now
                  </>
                )}
              </button>
            </div>

            {retrainStatus && (
              <div style={{
                padding:'10px 14px', borderRadius:'8px', marginBottom:'12px',
                background: retrainStatus.success ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)',
                border: `1px solid ${retrainStatus.success ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}`,
                fontSize:'0.78rem', fontWeight:700,
                color: retrainStatus.success ? '#34c759' : '#ff3b30',
              }}>
                {retrainStatus.success ? '✓ ' : '✗ '}
                {retrainStatus.message || retrainStatus.error}
                {retrainStatus.post_retrain_mae_min && (
                  <span style={{ marginLeft:'8px', opacity:0.8 }}>
                    · New MAE: ±{retrainStatus.post_retrain_mae_min} min
                    · {retrainStatus.elapsed_seconds}s
                  </span>
                )}
              </div>
            )}

            {retrainLog.length > 0 && (
              <div>
                <p style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 8px' }}>
                  Retrain History
                </p>
                {retrainLog.slice(0, 3).map((run, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--bg-primary)', fontSize:'0.73rem' }}>
                    <span style={{ fontWeight:700, color:'var(--text-muted)' }}>
                      {new Date(run.timestamp).toLocaleDateString()} {new Date(run.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                    </span>
                    <span style={{ fontWeight:700, color:'#7c3aed' }}>{run.rows_incorporated} rows</span>
                    <span style={{ fontWeight:800, color: run.post_retrain_mae_min < 15 ? '#34c759' : '#ff9500' }}>
                      ±{run.post_retrain_mae_min} min MAE
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

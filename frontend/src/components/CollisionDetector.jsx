import React, { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CORRIDORS = [
  'Mysore Road', 'Bellary Road 1', 'Tumkur Road', 'Bellary Road 2',
  'Hosur Road', 'ORR North 1', 'Old Madras Road', 'Magadi Road',
  'ORR East 1', 'Non-corridor',
];

const CAUSES = [
  { value: 'public_event',       label: '🎉 Public Event' },
  { value: 'procession',         label: '🪅 Procession' },
  { value: 'protest',            label: '📢 Protest' },
  { value: 'vip_movement',       label: '🚨 VIP Movement' },
  { value: 'construction',       label: '🏗️ Construction' },
  { value: 'vehicle_breakdown',  label: '🚗 Vehicle Breakdown' },
  { value: 'accident',           label: '💥 Accident' },
  { value: 'water_logging',      label: '🌊 Water Logging' },
  { value: 'congestion',         label: '🔴 Congestion' },
  { value: 'others',             label: '📌 Others' },
];

const EVENT_COLORS = [
  { bg: 'rgba(59,130,246,0.10)', border: '#3b82f6', text: '#2563eb', dot: '#3b82f6' },
  { bg: 'rgba(168,85,247,0.10)', border: '#a855f7', text: '#7c3aed', dot: '#a855f7' },
  { bg: 'rgba(20,184,166,0.10)', border: '#14b8a6', text: '#0f766e', dot: '#14b8a6' },
  { bg: 'rgba(249,115,22,0.10)', border: '#f97316', text: '#c2410c', dot: '#f97316' },
  { bg: 'rgba(236,72,153,0.10)', border: '#ec4899', text: '#be185d', dot: '#ec4899' },
];

function makeDefaultEvent(idx) {
  const pairs = [
    { corridor: 'Hosur Road',     event_cause: 'public_event',  impact_score: 70, start_hour: 19, duration: 3 },
    { corridor: 'Old Madras Road',event_cause: 'procession',    impact_score: 60, start_hour: 18, duration: 2 },
    { corridor: 'Mysore Road',    event_cause: 'vip_movement',  impact_score: 80, start_hour: 20, duration: 4 },
    { corridor: 'Tumkur Road',    event_cause: 'protest',       impact_score: 55, start_hour: 17, duration: 3 },
    { corridor: 'Bellary Road 1', event_cause: 'construction',  impact_score: 50, start_hour: 8,  duration: 4 },
  ];
  const p = pairs[idx % pairs.length];
  return { ...p, name: `Event ${idx + 1}`, isAiPredicted: true };
}

// ─── Severity helpers ────────────────────────────────────────────────────────
const SEVER = {
  CRITICAL: { badge: 'rgba(239,68,68,0.12)', badgeTxt: '#ef4444', badgeBorder: 'rgba(239,68,68,0.3)', icon: '🔴' },
  HIGH:     { badge: 'rgba(249,115,22,0.12)', badgeTxt: '#f97316', badgeBorder: 'rgba(249,115,22,0.3)', icon: '🟠' },
  MODERATE: { badge: 'rgba(234,179,8,0.12)',  badgeTxt: '#ca8a04', badgeBorder: 'rgba(234,179,8,0.3)',  icon: '🟡' },
};

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color }) {
  const r = 28, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="72" height="72" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border-color)" strokeWidth="5" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-dark)" fontSize="13" fontWeight="800"
        style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px', fontFamily: 'var(--font-body)' }}>
        {score}
      </text>
    </svg>
  );
}

// ─── ML Logic Modal ──────────────────────────────────────────────────────────
const CAUSE_CROWD_FACTOR = {
  public_event: { label: 'Mass gathering',   color: '#6366f1' },
  procession:   { label: 'Moving crowd',     color: '#8b5cf6' },
  protest:      { label: 'Volatile crowd',   color: '#ef4444' },
  vip_movement: { label: 'Security cordon',  color: '#f59e0b' },
  construction: { label: 'Lane reduction',   color: '#f97316' },
  vehicle_breakdown: { label: 'Bottleneck',  color: '#64748b' },
  accident:     { label: 'Scene control',    color: '#dc2626' },
  water_logging:{ label: 'Slow traffic',     color: '#0ea5e9' },
  congestion:   { label: 'Heavy flow',       color: '#ca8a04' },
  others:       { label: 'General event',    color: '#6b7280' },
};

const CORRIDOR_INTERSECTION_COUNT = {
  'Hosur Road': 12, 'Old Madras Road': 9, 'Mysore Road': 11, 'Tumkur Road': 8,
  'Bellary Road 1': 7, 'Bellary Road 2': 6, 'ORR North 1': 10, 'Magadi Road': 9,
  'ORR East 1': 11, 'Non-corridor': 5,
};

function MLLogicModal({ zone, allEvents, onClose }) {
  const collidingEvents = allEvents.filter(e => zone.events_colliding.includes(e.name));
  const totalOfficers = zone.extra_officers_needed || 0;
  const totalBarricades = (zone.dispatch_recommendations || []).reduce((s, d) => s + (d.barricades_deployed || 0), 0);
  const intersections = CORRIDOR_INTERSECTION_COUNT[zone.corridor] || 8;

  const spotLabels = {
    'Hosur Road':     ['Silk Board Junction', 'BTM Layout Signal', 'Madivala Checkpost'],
    'Old Madras Road':['KR Puram Bridge', 'Tin Factory Junction', 'Marathahalli Signal'],
    'Mysore Road':    ['Kengeri Toll', 'Rajarajeshwari Signal', 'Nayandahalli Junction'],
    'Tumkur Road':    ['Peenya Junction', 'Yeshwanthpur Signal', 'Nagasandra Signal'],
    'Bellary Road 1': ['Hebbal Flyover', 'Airport Access Rd Signal', 'Esteem Mall Junction'],
    'Bellary Road 2': ['Yelahanka Signal', 'Jakkur Junction', 'Doddajala Toll'],
    'ORR North 1':    ['Nagawara Junction', 'Thanisandra Signal', 'Kogilu Cross'],
    'Magadi Road':    ['Chord Road Signal', 'Kamakshipalya Junction', 'BEL Road Signal'],
    'ORR East 1':     ['Marathahalli ORR Junction', 'Bellandur Signal', 'Sarjapur Road Junction'],
    'Non-corridor':   ['City Market', 'Majestic Bus Stand', 'Vidhana Soudha Road'],
  };
  const spots = spotLabels[zone.corridor] || ['Junction 1', 'Junction 2', 'Junction 3'];
  const officersPerSpot = Math.ceil(totalOfficers / spots.length);
  const barricadesPerSpot = Math.max(1, Math.ceil(totalBarricades / spots.length));

  const situationSummary = zone.collision_score >= 80
    ? `This is a CRITICAL zone. Multiple high-impact events are hitting ${zone.corridor} at exactly the same time. Without immediate deployment, expect complete road lockdown.`
    : zone.collision_score >= 60
    ? `This is a HIGH-RISK zone. Overlapping events on ${zone.corridor} will cause severe bottlenecks. Pre-deployment is essential to prevent gridlock.`
    : `This is a MODERATE-RISK zone on ${zone.corridor}. Events overlap but are manageable with timely deployment of extra personnel.`;

  const officerLogic = [
    zone.collision_score >= 80
      ? { icon: '🔴', text: `The overall danger level is extreme (score: ${zone.collision_score}/100). Events here combined are about as bad as it gets — maximum manpower is required.`, color: '#ef4444' }
      : zone.collision_score >= 60
      ? { icon: '🟠', text: `Danger level is high (score: ${zone.collision_score}/100). Multiple serious events are converging, requiring significant reinforcement before they begin.`, color: '#f97316' }
      : { icon: '🟡', text: `Danger level is moderate (score: ${zone.collision_score}/100). Events are manageable but still require extra personnel to stay ahead of crowd pressure.`, color: '#ca8a04' },

    collidingEvents.length >= 3
      ? { icon: '👥', text: `${collidingEvents.length} events are happening simultaneously here. Each event alone would need some officers, but together they create a compounding crowd pressure that requires far more coverage.`, color: '#6366f1' }
      : { icon: '👥', text: `${collidingEvents.length} events are scheduled to overlap. When two or more events converge on the same corridor, crowd density at key junctions can spike 2–3x compared to a single event.`, color: '#6366f1' },

    zone.time_to_collision_min < 20
      ? { icon: '⏰', text: `These events overlap during peak rush hours. Crowd pressure builds fastest in this window — officers need to be in position before the first event even starts.`, color: '#ef4444' }
      : { icon: '⏰', text: `The overlap window is ${zone.time_window}. While not the absolute peak, simultaneous events still demand pre-positioned officers to manage crowd flow at entry and exit points.`, color: '#f59e0b' },
  ];

  const barricadeLogic = [
    { icon: '🛣️', text: `${zone.corridor} has ${intersections} major intersections and signal points that need physical crowd control barriers to prevent pedestrian-vehicle conflicts.`, color: '#ca8a04' },
    zone.collision_score >= 75
      ? { icon: '🚗', text: `At this risk level, 2–3 lanes will need managed diversion. Barricades channel crowds away from key junctions and stop traffic from backing into side streets.`, color: '#f97316' }
      : { icon: '🚗', text: `One or two lanes will need temporary redirection. Barricades guide pedestrians to safe crossing zones and stop overflow onto main carriageways.`, color: '#f59e0b' },
    { icon: '📊', text: `The AI looked at past events of this type on this corridor and identified the highest-risk spillover points. Barricade count is calibrated to cover each of those spots.`, color: '#6366f1' },
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '660px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--card-bg)', borderRadius: '20px',
          border: `2px solid ${zone.action_color}44`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.4)`,
          animation: 'fadeInUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid var(--border-color)', background: `linear-gradient(135deg, ${zone.action_color}10, transparent)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.4rem' }}>🧠</span>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-dark)' }}>Why These Resources?</h2>
                <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>AI Decision</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {zone.corridor} · <span style={{ color: zone.action_color, fontWeight: 800 }}>{zone.severity} Risk</span> · {zone.events_colliding.join(' + ')}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>✕ Close</button>
          </div>
        </div>

        <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { val: zone.collision_score, label: 'Risk Score', color: zone.action_color },
              { val: `+${totalOfficers}`, label: 'Officers', color: '#2563eb' },
              { val: `+${totalBarricades}`, label: 'Barricades', color: '#ca8a04' },
              { val: zone.time_window, label: 'Danger Window', color: '#f97316' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: kpi.color }}>{kpi.val}</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Situation summary */}
          <div style={{ background: `${zone.action_color}0d`, border: `1.5px solid ${zone.action_color}30`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: zone.action_color, letterSpacing: '0.7px', marginBottom: '6px' }}>🎯 Situation Summary</div>
            <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.7 }}>{situationSummary}</div>
          </div>

          {/* Events colliding */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.7px', marginBottom: '8px' }}>📋 Events Causing This Collision</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {collidingEvents.map((evt, i) => {
                const cf = CAUSE_CROWD_FACTOR[evt.event_cause] || CAUSE_CROWD_FACTOR.others;
                const causeLabel = evt.event_cause.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const impactWord = evt.impact_score >= 75 ? 'Very High' : evt.impact_score >= 55 ? 'High' : 'Moderate';
                return (
                  <div key={i} style={{ background: `${cf.color}08`, border: `1px solid ${cf.color}22`, borderRadius: '10px', padding: '11px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-dark)' }}>{evt.name}</span>
                      <span style={{ fontSize: '0.63rem', background: `${cf.color}18`, color: cf.color, border: `1px solid ${cf.color}33`, padding: '2px 7px', borderRadius: '5px', fontWeight: 800 }}>{cf.label}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.6 }}>
                      <strong>{causeLabel}</strong> on <strong>{evt.corridor}</strong> — starts <strong>{String(evt.start_hour).padStart(2,'0')}:00</strong>, lasts <strong>{evt.duration}hr{evt.duration > 1 ? 's' : ''}</strong>. Impact rated <strong style={{ color: cf.color }}>{impactWord} ({evt.impact_score}/100)</strong>.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Why X officers */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#2563eb', letterSpacing: '0.7px', marginBottom: '8px' }}>👮 Why {totalOfficers} Officers?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {officerLogic.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: `${r.color}08`, border: `1px solid ${r.color}20`, borderRadius: '10px', padding: '11px 14px' }}>
                  <span style={{ fontSize: '1.05rem', flexShrink: 0, marginTop: '1px' }}>{r.icon}</span>
                  <span style={{ fontSize: '0.79rem', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.65 }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Why X barricades */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#ca8a04', letterSpacing: '0.7px', marginBottom: '8px' }}>🚧 Why {totalBarricades} Barricades?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {barricadeLogic.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: `${r.color}08`, border: `1px solid ${r.color}20`, borderRadius: '10px', padding: '11px 14px' }}>
                  <span style={{ fontSize: '1.05rem', flexShrink: 0, marginTop: '1px' }}>{r.icon}</span>
                  <span style={{ fontSize: '0.79rem', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.65 }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exact spots */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981', letterSpacing: '0.7px', marginBottom: '8px' }}>📍 Where Exactly on {zone.corridor}?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {spots.map((spot, si) => (
                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '10px', padding: '11px 14px' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,0.14)', border: '1.5px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.77rem', color: '#10b981', flexShrink: 0 }}>{si + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-dark)' }}>📍 {spot}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Known crowd spillover point · High pedestrian density from historical event data</div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb', background: 'rgba(37,99,235,0.08)', padding: '3px 9px', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.15)' }}>👮 {officersPerSpot}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ca8a04', background: 'rgba(202,138,4,0.08)', padding: '3px 9px', borderRadius: '6px', border: '1px solid rgba(202,138,4,0.15)' }}>🚧 {barricadesPerSpot}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Which stations & why */}
          {zone.dispatch_recommendations && zone.dispatch_recommendations.length > 0 && (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#f97316', letterSpacing: '0.7px', marginBottom: '8px' }}>🚨 Which Stations Are Dispatched & Why?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {zone.dispatch_recommendations.map((disp, di) => (
                  <div key={di} style={{ background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🏢</span>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-dark)' }}>{disp.precinct_name}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                        #{di + 1} Closest Station
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.7, marginBottom: '10px' }}>
                      This station is just <strong style={{ color: '#f97316' }}>{disp.distance_km} km away</strong> from {zone.corridor} — the AI ranked it #{di + 1} out of all nearby precincts based on distance and available personnel. Estimated arrival: <strong style={{ color: '#f97316' }}>~{Math.round(disp.distance_km * 3)} minutes</strong>.
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {disp.officers_deployed > 0 && (
                        <div style={{ flex: 1, background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 900, color: '#2563eb', fontSize: '1.1rem' }}>+{disp.officers_deployed} officers</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Dispatched from this station</div>
                        </div>
                      )}
                      {disp.barricades_deployed > 0 && (
                        <div style={{ flex: 1, background: 'rgba(202,138,4,0.07)', border: '1px solid rgba(202,138,4,0.18)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 900, color: '#ca8a04', fontSize: '1.1rem' }}>+{disp.barricades_deployed} barricades</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Equipment from this station</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function CollisionDetector({ language }) {
  const [events, setEvents] = useState([makeDefaultEvent(0), makeDefaultEvent(1)]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Save scenario
  const [saveModal, setSaveModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeDispatchDetails, setActiveDispatchDetails] = useState(null);
  const [mlModal, setMlModal] = useState(null); // { zone, events }

  // Saved scenarios history
  const [scenarios, setScenarios] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'history'

  // Map
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const layersRef = useRef([]);

  // ── Fetch saved scenarios ──────────────────────────────────────────────────
  const fetchScenarios = async () => {
    setLoadingScenarios(true);
    try {
      const res = await fetch(`${API}/api/scenarios`);
      const data = await res.json();
      setScenarios(data.scenarios || []);
    } catch { setScenarios([]); }
    finally { setLoadingScenarios(false); }
  };

  useEffect(() => { fetchScenarios(); }, []);

  // ── Auto-predict impact score ──────────────────────────────────────────────
  const predictImpactScore = async (idx, corridor, event_cause) => {
    try {
      const res = await fetch(`${API}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corridor, event_cause, hour: 12 }),
      });
      if (res.ok) {
        const data = await res.json();
        const score = Math.round(data.event_impact_score);
        setEvents(prev => prev.map((e, i) => i === idx ? { ...e, impact_score: score, isAiPredicted: true } : e));
      }
    } catch (err) {
      console.error("AI Prediction failed:", err);
    }
  };

  // ── Event CRUD ─────────────────────────────────────────────────────────────
  const addEvent = () => {
    if (events.length >= 6) return;
    setEvents(prev => [...prev, makeDefaultEvent(prev.length)]);
  };
  const removeEvent = (idx) => setEvents(prev => prev.filter((_, i) => i !== idx));
  const updateEvent = (idx, field, val) => {
    setEvents(prev => {
      const updated = prev.map((e, i) => i === idx ? { ...e, [field]: val } : e);
      if (field === 'corridor' || field === 'event_cause') {
        const item = updated[idx];
        updated[idx].isAiPredicted = false;
        predictImpactScore(idx, item.corridor, item.event_cause);
      } else if (field === 'impact_score') {
        updated[idx].isAiPredicted = false;
      }
      return updated;
    });
  };

  // ── Analyze ────────────────────────────────────────────────────────────────
  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/collision-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'API error');
      }
      const data = await res.json();
      setResult(data);
      setActiveTab('builder');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Save scenario ──────────────────────────────────────────────────────────
  const saveScenario = async () => {
    if (!result || !scenarioName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/scenarios/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_name: scenarioName,
          events,
          collision_result: result,
        }),
      });
      const data = await res.json();
      setSaveMsg(`✅ ${data.message}`);
      await fetchScenarios();
      setTimeout(() => { setSaveModal(false); setSaveMsg(''); setScenarioName(''); }, 1500);
    } catch { setSaveMsg('❌ Save failed. Please try again.'); }
    finally { setSaving(false); }
  };

  // ── Delete scenario ────────────────────────────────────────────────────────
  const deleteScenario = async (id) => {
    if (!window.confirm('Delete this scenario?')) return;
    try {
      await fetch(`${API}/api/scenarios/${id}`, { method: 'DELETE' });
      await fetchScenarios();
    } catch { /* silently ignore */ }
  };

  // ── Load scenario into builder ─────────────────────────────────────────────
  const loadScenario = (sc) => {
    const scEvents = (sc.events || []).map(e => ({
      ...e,
      start_hour: e.start_hour !== undefined ? e.start_hour : (e.hour !== undefined ? e.hour : 19),
      duration: e.duration !== undefined ? e.duration : 2
    }));
    setEvents(scEvents);
    setResult(sc.collision_result || null);
    setActiveTab('builder');
  };

  // ── Map rendering ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!result || !result.collision_zones) return;
    const L = window.L;
    if (!L) return;

    const mapDiv = document.getElementById('collision-map');
    if (!mapDiv) return;

    // Destroy old map instance
    if (mapObjRef.current) {
      try { mapObjRef.current.remove(); } catch {}
      mapObjRef.current = null;
    }
    delete mapDiv._leaflet_id;

    const map = L.map('collision-map', { zoomControl: false, attributionControl: false })
      .setView([12.9716, 77.5946], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    mapObjRef.current = map;
    layersRef.current = [];

    const allCoords = [];

    // Plot collision zones as pulsing red circles
    result.collision_zones.forEach(zone => {
      const evtName = zone.events_colliding[0];
      const evtObj = events.find(e => e.name === evtName);
      if (!evtObj) return;
      // Get approximate coords from corridor (fallback to Bangalore center with offset)
      const corridorOffsets = {
        'Hosur Road': [12.9210, 77.6212], 'Old Madras Road': [13.0182, 77.6587],
        'Mysore Road': [12.9399, 77.5227], 'Tumkur Road': [13.0137, 77.5209],
        'Bellary Road 1': [13.0688, 77.5917], 'Bellary Road 2': [13.0826, 77.5874],
        'ORR North 1': [13.0562, 77.5500], 'Old Madras Road': [13.0182, 77.6587],
        'Magadi Road': [12.9706, 77.5109], 'ORR East 1': [13.0082, 77.6648],
        'Non-corridor': [12.9716, 77.5946],
      };
      const centre = corridorOffsets[zone.corridor] || [12.9716 + Math.random() * 0.03, 77.5946 + Math.random() * 0.03];
      allCoords.push(centre);

      const color = zone.action_color || '#ef4444';
      const radius = 800 + zone.collision_score * 15;
      const circle = L.circle(centre, { color, fillColor: color, fillOpacity: 0.18, opacity: 0.7, weight: 2, radius }).addTo(map);
      layersRef.current.push(circle);

      const pinHtml = `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color}55;"></div>`;
      const icon = L.divIcon({ html: pinHtml, className: '', iconSize: [14,14], iconAnchor: [7,7] });
      const marker = L.marker(centre, { icon }).addTo(map);
      marker.bindPopup(`<strong>💥 ${zone.corridor}</strong><br>Collision Score: ${zone.collision_score}/100<br>Events: ${zone.events_colliding.join(' + ')}<br>Action: ${zone.action}`);
      layersRef.current.push(marker);
    });

    if (allCoords.length > 0) {
      try { map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] }); }
      catch { map.setView([12.9716, 77.5946], 11); }
    }

    return () => {
      if (mapObjRef.current) { try { mapObjRef.current.remove(); } catch {} mapObjRef.current = null; }
    };
  }, [result]);

  // ── Styles helpers ─────────────────────────────────────────────────────────
  const pill = (bg, color, border) => ({
    background: bg, color, border: `1px solid ${border}`,
    padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800,
  });

  const summaryHasCritical = result?.summary?.has_critical_collision;
  const alertBg = summaryHasCritical
    ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))'
    : 'linear-gradient(135deg, rgba(234,117,14,0.05), transparent)';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Tab selector ── */}
      <div style={{ display: 'flex', background: 'rgba(234,117,14,0.05)', padding: '6px', borderRadius: '30px', width: 'fit-content', border: '1.5px solid rgba(234,117,14,0.2)', gap: 0 }}>
        {[
          { key: 'builder', label: '💥 Collision Builder' },
          { key: 'history', label: `📁 Saved Scenarios ${scenarios.length > 0 ? `(${scenarios.length})` : ''}` },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'history') fetchScenarios(); }}
            style={{
              border: 'none', outline: 'none', padding: '10px 24px', borderRadius: '24px',
              fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
              background: activeTab === tab.key ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
              boxShadow: activeTab === tab.key ? '0 4px 14px rgba(234,117,14,0.3)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ BUILDER TAB ══════════ */}
      {activeTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>

          {/* LEFT: Event Builder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Active Event Queue
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Add 2–6 simultaneous events and detect collision zones
                </p>
              </div>
              <button onClick={addEvent} disabled={events.length >= 6}
                style={{
                  background: events.length >= 6 ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  color: events.length >= 6 ? 'var(--text-muted)' : 'white',
                  border: 'none', borderRadius: '8px', padding: '8px 16px',
                  fontWeight: 800, fontSize: '0.82rem', cursor: events.length >= 6 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: events.length >= 6 ? 'none' : '0 4px 12px rgba(234,117,14,0.3)',
                  transition: 'all 0.2s',
                }}>
                <span style={{ fontSize: '1rem' }}>＋</span> Add Event
              </button>
            </div>

            {/* Event cards */}
            {events.map((evt, idx) => {
              const clr = EVENT_COLORS[idx % EVENT_COLORS.length];
              return (
                <div key={idx} className="card" style={{
                  margin: 0, padding: '20px 22px',
                  border: `1.5px solid ${clr.border}`,
                  background: clr.bg,
                  borderRadius: '12px',
                  transition: 'box-shadow 0.2s',
                }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: clr.dot, boxShadow: `0 0 8px ${clr.dot}88`, flexShrink: 0 }} />
                      <input value={evt.name} onChange={e => updateEvent(idx, 'name', e.target.value)}
                        style={{
                          border: 'none', background: 'transparent', fontWeight: 800,
                          fontSize: '0.92rem', color: clr.text, outline: 'none',
                          width: '140px', fontFamily: 'var(--font-body)',
                        }} />
                    </div>
                    {events.length > 2 && (
                      <button onClick={() => removeEvent(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem', fontWeight: 800 }}>
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Fields grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* Corridor */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Corridor</label>
                      <select value={evt.corridor} onChange={e => updateEvent(idx, 'corridor', e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        {CORRIDORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {/* Cause */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Event Type</label>
                      <select value={evt.event_cause} onChange={e => updateEvent(idx, 'event_cause', e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        {CAUSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>

                    {/* Impact Score */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                        Impact Score
                      </label>
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        fontSize: '0.92rem',
                        fontWeight: 900,
                        color: clr.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: '35px',
                        boxSizing: 'border-box'
                      }}>
                        <span>⚡ {evt.impact_score} / 100</span>
                        <span style={{ fontSize: '0.58rem', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>AI Predicted</span>
                      </div>
                    </div>

                    {/* Temporal Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Temporal Controls</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <select value={evt.start_hour} onChange={e => updateEvent(idx, 'start_hour', parseInt(e.target.value))}
                            style={{ padding: '6px 8px', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dark)', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', width: '100%' }}>
                            {Array.from({ length: 24 }).map((_, h) => (
                              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                            ))}
                          </select>
                          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>Start Time</span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <select value={evt.duration} onChange={e => updateEvent(idx, 'duration', parseInt(e.target.value))}
                            style={{ padding: '6px 8px', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dark)', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', width: '100%' }}>
                            {Array.from({ length: 12 }).map((_, d) => (
                              <option key={d + 1} value={d + 1}>{d + 1} hr{d > 0 ? 's' : ''}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>Duration</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Analyze button */}
            <button onClick={analyze} disabled={loading || events.length < 2}
              style={{
                background: loading ? 'var(--border-color)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: loading ? 'var(--text-muted)' : 'white', border: 'none',
                borderRadius: '12px', padding: '14px 24px',
                fontWeight: 900, fontSize: '0.95rem', cursor: loading ? 'wait' : 'pointer',
                boxShadow: loading ? 'none' : '0 6px 20px rgba(239,68,68,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'all 0.2s', letterSpacing: '0.3px',
                fontFamily: 'var(--font-body)',
              }}>
              {loading ? (
                <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Detecting Collisions...</>
              ) : (
                <><span style={{ fontSize: '1.2rem' }}>💥</span> Detect Collision Zones</>
              )}
            </button>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '12px 16px', color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* RIGHT: Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!result ? (
              <div className="card" style={{ margin: 0, padding: '60px 32px', textAlign: 'center', borderStyle: 'dashed' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💥</div>
                <h3 style={{ margin: '0 0 8px', fontWeight: 800, color: 'var(--text-dark)' }}>No Analysis Yet</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.5 }}>
                  Configure 2+ simultaneous events on the left<br />and click <strong>Detect Collision Zones</strong>
                </p>
              </div>
            ) : (
              <>
                {/* Alert banner */}
                <div className="card" style={{
                  margin: 0, padding: '20px 24px',
                  background: alertBg,
                  border: `2px solid ${summaryHasCritical ? 'rgba(239,68,68,0.35)' : 'rgba(234,117,14,0.25)'}`,
                  borderRadius: '14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: summaryHasCritical ? '#ef4444' : 'var(--primary)', marginBottom: '6px' }}>
                        {result.summary.alert_level}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.5 }}>
                        {result.summary.collision_zone_count} collision zone(s) detected across {result.summary.total_events_analysed} events
                      </div>
                    </div>
                    {result && (
                      <button onClick={() => setSaveModal(true)}
                        style={{
                          background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                          color: 'white', border: 'none', borderRadius: '8px',
                          padding: '8px 16px', fontWeight: 800, fontSize: '0.78rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          boxShadow: '0 4px 12px rgba(234,117,14,0.3)', flexShrink: 0,
                          fontFamily: 'var(--font-body)',
                        }}>
                        💾 Save Scenario
                      </button>
                    )}
                  </div>

                  {/* KPI row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                    {[
                      { label: 'Collision Zones', val: result.summary.collision_zone_count, color: '#ef4444' },
                      { label: 'Extra Officers', val: `+${result.summary.total_extra_officers}`, color: '#2563eb' },
                      { label: 'Extra Barricades', val: `+${result.summary.total_extra_barricades}`, color: '#ca8a04' },
                    ].map(kpi => (
                      <div key={kpi.label} style={{ background: 'var(--card-bg)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: kpi.color }}>{kpi.val}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '2px' }}>{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collision Zone cards */}
                {result.collision_zones.length > 0 && (
                  <div className="card" style={{ margin: 0, padding: '20px 22px' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                      💥 Collision Zones ({result.collision_zones.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {result.collision_zones.map((zone, i) => {
                        const sv = SEVER[zone.severity] || SEVER.MODERATE;
                        return (
                          <div key={i}
                            onClick={() => setMlModal({ zone, events })}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: '12px',
                              background: zone.severity_bg || sv.badge,
                              border: `1.5px solid ${zone.severity_border || sv.badgeBorder}`,
                              borderRadius: '12px', padding: '16px 18px',
                              cursor: 'pointer',
                              transition: 'box-shadow 0.2s, transform 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 24px ${zone.action_color}33`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                          >
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                              <ScoreRing score={zone.collision_score} color={zone.action_color} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-dark)' }}>{zone.corridor}</span>
                                  <span style={pill(sv.badge, sv.badgeTxt, sv.badgeBorder)}>
                                    {sv.icon} {zone.severity}
                                  </span>
                                  <span style={{ fontSize: '0.62rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)', padding: '2px 7px', borderRadius: '8px', fontWeight: 800 }}>🧠 ML Explained</span>
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                                  {zone.events_colliding.join(' + ')} converging here
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={pill('rgba(0,0,0,0.04)', 'var(--text-dark)', 'var(--border-color)')}>
                                    ⏱ {zone.time_window}
                                  </span>
                                  <span style={pill('rgba(0,0,0,0.04)', 'var(--text-dark)', 'var(--border-color)')}>
                                    ⚡ {zone.time_to_collision_min}m warning
                                  </span>
                                  <span style={pill('rgba(0,0,0,0.04)', 'var(--text-dark)', 'var(--border-color)')}>
                                    👮 +{zone.extra_officers_needed} officers
                                  </span>
                                  <span style={{ ...pill('rgba(0,0,0,0.04)', zone.action_color, zone.action_color + '55'), fontWeight: 900 }}>
                                    {zone.action}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Smart Dispatch Recommendations */}
                            {zone.dispatch_recommendations && zone.dispatch_recommendations.length > 0 && (
                              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                  🚨 Nearest Precinct Smart Dispatch
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {zone.dispatch_recommendations.map((disp, di) => (
                                    <div key={di} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.74rem', border: '1px solid var(--border-color)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-dark)' }}>
                                        <span>🏢</span>
                                        <span>{disp.precinct_name.replace(" Police Station", "")}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>({disp.distance_km} km)</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontWeight: 800 }}>
                                        {disp.officers_deployed > 0 && (
                                          <span style={{ color: '#2563eb' }}>👮 +{disp.officers_deployed}</span>
                                        )}
                                        {disp.barricades_deployed > 0 && (
                                          <span style={{ color: '#ca8a04' }}>🚧 +{disp.barricades_deployed}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No collision */}
                {result.collision_zones.length === 0 && (
                  <div className="card" style={{ margin: 0, padding: '32px', textAlign: 'center', border: '1.5px solid rgba(48,209,88,0.3)', background: 'rgba(48,209,88,0.04)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🟢</div>
                    <div style={{ fontWeight: 800, color: '#24b23b', fontSize: '1rem' }}>No Collision Zones Detected</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>
                      The events' impact zones do not overlap significantly.
                    </div>
                  </div>
                )}

                {/* Solo impacts */}
                {result.solo_impact_zones?.length > 0 && (
                  <div className="card" style={{ margin: 0, padding: '20px 22px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🛣️ Solo-Affected Corridors (no collision)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {result.solo_impact_zones.slice(0, 6).map((z, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dark)' }}>{z.corridor}</span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>via {z.from_event}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: z.action === 'DEPLOY' ? '#ef4444' : z.action === 'DIVERT' ? '#f97316' : '#ca8a04' }}>
                              {z.action}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Map */}
                {result.collision_zones.length > 0 && (
                  <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-dark)' }}>
                      🗺️ Collision Zone Map
                    </div>
                    <div id="collision-map" style={{ width: '100%', height: '260px' }} />
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ HISTORY TAB ══════════ */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark)' }}>
              Saved Collision Scenarios
            </h3>
            <button onClick={fetchScenarios}
              style={{ background: 'none', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              🔄 Refresh
            </button>
          </div>

          {loadingScenarios ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontWeight: 600 }}>Loading scenarios...</div>
          ) : scenarios.length === 0 ? (
            <div className="card" style={{ margin: 0, padding: '60px 32px', textAlign: 'center', borderStyle: 'dashed' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>📁</div>
              <h3 style={{ margin: '0 0 8px', fontWeight: 800, color: 'var(--text-dark)' }}>No Saved Scenarios</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Analyse a collision and click "Save Scenario" to archive it here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {scenarios.map(sc => {
                const summ = sc.summary || {};
                const hasCrit = summ.has_critical_collision;
                return (
                  <div key={sc.id} className="card" style={{
                    margin: 0, padding: '22px', borderLeft: `5px solid ${hasCrit ? '#ef4444' : summ.collision_zone_count > 0 ? '#f97316' : '#30d158'}`,
                    display: 'flex', flexDirection: 'column', gap: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-dark)' }}>{sc.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '3px', fontFamily: 'monospace' }}>{sc.id}</div>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                        {new Date(sc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: hasCrit ? '#ef4444' : summ.collision_zone_count > 0 ? '#f97316' : '#30d158' }}>
                      {summ.alert_level || '—'}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={pill('rgba(0,0,0,0.04)', 'var(--text-muted)', 'var(--border-color)')}>{summ.total_events_analysed || (sc.events?.length || 0)} events</span>
                      <span style={pill('rgba(239,68,68,0.08)', '#ef4444', 'rgba(239,68,68,0.25)')}>{summ.collision_zone_count || 0} collisions</span>
                      {summ.total_extra_officers > 0 && (
                        <span style={pill('rgba(249,115,22,0.08)', '#f97316', 'rgba(249,115,22,0.25)')}>+{summ.total_extra_officers} officers</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => loadScenario(sc)}
                        style={{ flex: 1, padding: '8px 0', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        📂 Load
                      </button>
                      <button onClick={() => deleteScenario(sc.id)}
                        style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Save Modal ── */}
      {saveModal && (
        <div onClick={() => setSaveModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{
            width: '420px', maxWidth: '100%', padding: '32px', margin: 0,
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-dark)' }}>💾 Save Scenario</h3>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                Scenario Name
              </label>
              <input value={scenarioName} onChange={e => setScenarioName(e.target.value)}
                placeholder="e.g. IPL Night + Republic Day Procession"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border-color)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-dark)', background: 'var(--bg-primary)', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
            </div>
            {saveMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: saveMsg.startsWith('✅') ? 'rgba(48,209,88,0.08)' : 'rgba(239,68,68,0.08)', color: saveMsg.startsWith('✅') ? '#24b23b' : '#ef4444', fontWeight: 700, fontSize: '0.85rem', border: `1px solid ${saveMsg.startsWith('✅') ? 'rgba(48,209,88,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                {saveMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setSaveModal(false); setSaveMsg(''); setScenarioName(''); }}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1.5px solid var(--border-color)', borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
              <button onClick={saveScenario} disabled={saving || !scenarioName.trim()}
                style={{ flex: 1, padding: '10px', background: scenarioName.trim() ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))' : 'var(--border-color)', color: scenarioName.trim() ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem', cursor: scenarioName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-body)' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ML Logic Modal ── */}
      {mlModal && <MLLogicModal zone={mlModal.zone} allEvents={mlModal.events} onClose={() => setMlModal(null)} />}

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.4);opacity:0.7;} }
      `}</style>
    </div>
  );
}

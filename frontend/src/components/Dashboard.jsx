import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [mlStats, setMlStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });

    fetch('http://localhost:8000/api/model-stats')
      .then(r => r.json())
      .then(d => setMlStats(d))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="empty-results">
        <div className="status-dot"></div>
        <p>Loading analytical dashboard...</p>
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
        <p>Error loading dashboard: {error}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Is the FastAPI server running on port 8000?</p>
      </div>
    );
  }

  // Calculate percentages for causes list
  const maxCauseCount = stats?.top_causes?.[0]?.count || 1;

  return (
    <div>
      <div className="kpi-row">
        <div className="kpi-card">
          <h3>Total Incidents Analysed</h3>
          <div className="kpi-value">{stats?.total_events.toLocaleString()}</div>
          <div className="kpi-trend positive" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Fully Cleaned Dataset</span>
          </div>
        </div>
        
        <div className="kpi-card">
          <h3>Road Closure Rate</h3>
          <div className="kpi-value">{stats?.closure_rate}%</div>
          <div className="kpi-trend highlight">Imbalance: {stats?.closure_rate > 0 ? (100 / stats.closure_rate).toFixed(1) : 0}x Normal rate</div>
        </div>

        <div className="kpi-card">
          <h3>Avg Clear-Out Time</h3>
          <div className="kpi-value">
            {stats?.avg_resolution_min >= 60 
              ? `${(stats.avg_resolution_min / 60).toFixed(1)} hrs` 
              : `${stats?.avg_resolution_min} min`}
          </div>
          <div className="kpi-trend">Historical Resolution Average</div>
        </div>

        {/* ML Model Confidence KPI */}
        <div className="kpi-card kpi-ml-card">
          <h3>ML Model Confidence</h3>
          <div className="kpi-value" style={{
            color: mlStats?.avg_accuracy_pct != null
              ? mlStats.avg_accuracy_pct >= 80 ? '#34c759' : mlStats.avg_accuracy_pct >= 60 ? '#ff9500' : '#ff3b30'
              : 'var(--text-muted)'
          }}>
            {mlStats?.avg_accuracy_pct != null ? `${mlStats.avg_accuracy_pct}%` : '—'}
          </div>
          {mlStats?.avg_accuracy_pct != null ? (
            <div className="kpi-trend" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="status-dot" style={{ background: '#34c759' }}></span>
              <span>MAE ±{mlStats.mae_min} min · {mlStats.total_events_logged} events</span>
            </div>
          ) : (
            <div className="kpi-trend" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
              <span>Log events to activate</span>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Side: Top causes */}
        <div className="card">
          <h3 className="card-title">Top Event Causes</h3>
          <div className="bar-list">
            {stats?.top_causes?.slice(0, 7).map((item, index) => {
              const percentage = (item.count / maxCauseCount) * 100;
              return (
                <div className="bar-row" key={index}>
                  <div className="bar-info">
                    <span style={{ textTransform: 'capitalize' }}>
                      {item.cause.replace('_', ' ')}
                    </span>
                    <span>{item.count.toLocaleString()}</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: High risk corridors */}
        <div className="card">
          <h3 className="card-title">Critical Corridors</h3>
          <div className="simple-list">
            {stats?.high_risk_corridors?.map((item, index) => (
              <div className="list-item" key={index}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.95rem' }}>{item.corridor}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.total_events} events logged
                  </span>
                </div>
                <span className="badge">
                  {item.closure_rate}% closure
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

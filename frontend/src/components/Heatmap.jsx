import React, { useEffect, useState } from 'react';

export default function Heatmap() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/heatmap')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch heatmap data');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="empty-results">
        <div className="status-dot"></div>
        <p>Generating spatial-temporal congestion risk matrix...</p>
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
        <p>Error loading heatmap: {error}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Check if backend is running.</p>
      </div>
    );
  }

  // Extract unique zones and hours
  const zones = Array.from(new Set(data.map((item) => item.zone))).sort();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Group data by zone and hour for fast lookup
  const grid = {};
  data.forEach((item) => {
    if (!grid[item.zone]) grid[item.zone] = {};
    grid[item.zone][item.hour] = item;
  });

  // Function to calculate cell background color based on risk
  const getCellColor = (risk) => {
    if (!risk) return '#f5f2f0'; // fallback base
    // Interpolate from light orange to safety orange (#ea750e)
    // We map risk (0 to 100) to colors.
    if (risk < 15) return '#f5f2f0';
    if (risk < 30) return '#ffebd9';
    if (risk < 50) return '#ffbe84';
    if (risk < 75) return '#ff9638';
    return '#ea750e'; // critical
  };

  return (
    <div className="card" style={{ width: '100%' }}>
      <h3 className="card-title">Zone × Hour Congestion Risk Matrix</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Hover over grid cells to inspect specific congestion risk levels and event histories.
      </p>

      <div className="heatmap-container">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th style={{ width: '150px' }}>Zone</th>
              {hours.map((hour) => (
                <th key={hour}>{hour.toString().padStart(2, '0')}h</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone}>
                <td className="heatmap-zone-label">{zone}</td>
                {hours.map((hour) => {
                  const cell = grid[zone]?.[hour] || { congestion_risk: 0, event_count: 0, road_closures: 0 };
                  const risk = cell.congestion_risk;
                  return (
                    <td 
                      key={hour} 
                      style={{ 
                        backgroundColor: getCellColor(risk),
                        border: '1px solid white'
                      }}
                    >
                      <div className="cell-tooltip">
                        <strong>{zone} @ {hour}:00</strong><br />
                        Risk: {risk.toFixed(1)}/100 ({cell.risk_label || 'Low'})<br />
                        Logged Events: {cell.event_count || 0}<br />
                        closures: {cell.road_closures || 0}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="heatmap-legend">
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Low Risk</span>
        <div className="legend-scale"></div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Critical Hotspot</span>
      </div>
    </div>
  );
}

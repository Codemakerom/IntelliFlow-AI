import React, { useState, useEffect } from 'react';
import { translations } from '../translations';

export default function Analytics({ language }) {
  const t = translations[language] || translations.en;
  
  const [activeSection, setActiveSection] = useState('data'); // 'data' or 'health'
  const [hoveredCard, setHoveredCard] = useState(null);
  
  // Data Packages state
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null); // The file selected for modal preview
  const [previewData, setPreviewData] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // ML Health state
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  // Distinct premium color themes for each dataset package
  const categoryThemes = {
    heatmap_data: {
      color: '#ff453a', // Vibrant Red
      bgGlow: 'rgba(255, 69, 58, 0.05)',
      borderGlow: 'rgba(255, 69, 58, 0.4)',
      iconBg: 'rgba(255, 69, 58, 0.12)',
      tagColor: '#ff453a'
    },
    barricade_junctions: {
      color: '#ff9f0a', // Bright Amber/Orange
      bgGlow: 'rgba(255, 159, 10, 0.05)',
      borderGlow: 'rgba(255, 159, 10, 0.4)',
      iconBg: 'rgba(255, 159, 10, 0.12)',
      tagColor: '#ff9f0a'
    },
    corridor_feedback: {
      color: '#bf5af2', // Glowing Purple
      bgGlow: 'rgba(191, 90, 242, 0.05)',
      borderGlow: 'rgba(191, 90, 242, 0.4)',
      iconBg: 'rgba(191, 90, 242, 0.12)',
      tagColor: '#bf5af2'
    },
    impact_by_cause: {
      color: '#0a84ff', // Cyan/Blue
      bgGlow: 'rgba(10, 132, 255, 0.05)',
      borderGlow: 'rgba(10, 132, 255, 0.4)',
      iconBg: 'rgba(10, 132, 255, 0.12)',
      tagColor: '#0a84ff'
    },
    manpower_table: {
      color: '#30d158', // Neon Emerald Green
      bgGlow: 'rgba(48, 209, 88, 0.05)',
      borderGlow: 'rgba(48, 209, 88, 0.4)',
      iconBg: 'rgba(48, 209, 88, 0.12)',
      tagColor: '#30d158'
    }
  };

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      const res = await fetch('http://localhost:8000/api/analytics-files');
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFileList(data);
    } catch (err) {
      console.error("Error fetching files metadata:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchHealth = async () => {
    try {
      setLoadingHealth(true);
      setHealthError(null);
      const res = await fetch('http://localhost:8000/api/analytics-health');
      if (!res.ok) throw new Error("Failed to fetch pipeline health metrics");
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error("Error fetching health data:", err);
      setHealthError(err.message);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    if (activeSection === 'health') {
      fetchHealth();
    }
  }, [activeSection]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewData(null);
      return;
    }
    
    const fetchPreview = async () => {
      if (!selectedFile.exists) {
        setPreviewData(null);
        return;
      }
      
      try {
        setLoadingPreview(true);
        setPreviewError(null);
        const res = await fetch(`http://localhost:8000/api/analytics-preview/${selectedFile.filename}`);
        if (!res.ok) throw new Error("Failed to fetch preview data");
        const data = await res.json();
        setPreviewData(data);
      } catch (err) {
        setPreviewError(err.message);
        setPreviewData(null);
      } finally {
        setLoadingPreview(false);
      }
    };
    
    fetchPreview();
  }, [selectedFile]);

  if (loadingFiles && fileList.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div className="status-dot" style={{ width: '12px', height: '12px' }}></div>
        <span style={{ marginLeft: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          {t.an_preview_loading}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── Sub-tabs Selection ── */}
      <div style={{
        display: 'flex',
        background: 'rgba(234, 117, 14, 0.05)',
        padding: '6px',
        borderRadius: '30px',
        width: 'fit-content',
        border: '1.5px solid rgba(234, 117, 14, 0.2)',
        alignSelf: 'flex-start',
        boxShadow: '0 4px 12px rgba(234, 117, 14, 0.06)'
      }}>
        <button
          onClick={() => setActiveSection('data')}
          style={{
            border: 'none',
            outline: 'none',
            padding: '10px 28px',
            borderRadius: '24px',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            background: activeSection === 'data' ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))' : 'transparent',
            color: activeSection === 'data' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: 'var(--font-body)',
            boxShadow: activeSection === 'data' ? '0 4px 14px rgba(234, 117, 14, 0.3)' : 'none'
          }}
        >
          {t.an_tab_data}
        </button>
        <button
          onClick={() => setActiveSection('health')}
          style={{
            border: 'none',
            outline: 'none',
            padding: '10px 28px',
            borderRadius: '24px',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            background: activeSection === 'health' ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))' : 'transparent',
            color: activeSection === 'health' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: 'var(--font-body)',
            boxShadow: activeSection === 'health' ? '0 4px 14px rgba(234, 117, 14, 0.3)' : 'none'
          }}
        >
          {t.an_tab_health}
        </button>
      </div>

      {/* ── SECTION: DATA PACKAGES (CSV EXPORTS & PREVIEWS) ── */}
      {activeSection === 'data' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {fileList.map((file) => {
            const theme = categoryThemes[file.id] || {
              color: 'var(--primary)',
              bgGlow: 'var(--primary-glow)',
              borderGlow: 'var(--primary)',
              iconBg: 'var(--primary-glow)',
              tagColor: 'var(--primary)'
            };
            const isHovered = hoveredCard === file.id;
            const titleKey = `fn_${file.id}_title`;
            const descKey = `fn_${file.id}_desc`;
            
            return (
              <div 
                key={file.id}
                className="card"
                onMouseEnter={() => setHoveredCard(file.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '28px',
                  margin: 0,
                  border: '1.5px solid var(--border-color)',
                  borderLeft: `6px solid ${theme.color}`,
                  background: isHovered ? theme.bgGlow : 'var(--card-bg)',
                  boxShadow: isHovered ? `0 12px 30px ${theme.bgGlow}` : 'var(--shadow-sm)',
                  minHeight: '270px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isHovered ? 'translateY(-4px)' : 'none',
                  borderColor: isHovered ? theme.borderGlow : 'var(--border-color)',
                }}
              >
                {/* Card Header & Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: theme.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.color,
                      flexShrink: 0,
                      boxShadow: `inset 0 0 10px ${theme.bgGlow}`
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-dark)', margin: 0, letterSpacing: '-0.3px' }}>
                        {t[titleKey] || file.filename}
                      </h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {file.filename}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, minHeight: '44px', margin: 0, lineHeight: 1.5 }}>
                    {t[descKey]}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span className="badge" style={{
                      background: file.exists ? 'rgba(48, 209, 88, 0.12)' : 'rgba(110, 110, 115, 0.12)',
                      color: file.exists ? '#24b23b' : 'var(--text-muted)',
                      border: file.exists ? '1px solid rgba(48, 209, 88, 0.25)' : '1px solid rgba(110, 110, 115, 0.2)',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      borderRadius: '12px'
                    }}>
                      {file.exists ? t.an_ready : t.an_not_generated}
                    </span>
                    
                    {file.exists && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: '800' }}>
                        {file.row_count} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.le_rows}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
                  {file.exists ? (
                    <>
                      <button 
                        className="btn-secondary"
                        onClick={() => setSelectedFile(file)}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 'bold',
                          margin: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          borderColor: theme.color,
                          color: theme.color,
                          background: 'transparent',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = theme.bgGlow;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>{t.an_preview_tab}</span>
                      </button>
                      <a 
                        href={`http://localhost:8000/api/analytics-download/${file.filename}`}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          textDecoration: 'none',
                          padding: '10px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 'bold',
                          margin: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          borderRadius: '8px',
                          background: `linear-gradient(135deg, ${theme.color}, ${theme.color}dd)`,
                          color: 'white',
                          boxShadow: `0 4px 12px ${theme.bgGlow}`,
                          border: 'none'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>{t.an_download_btn}</span>
                      </a>
                    </>
                  ) : (
                    <button 
                      disabled 
                      className="btn-secondary" 
                      style={{ flex: 1, opacity: 0.5, cursor: 'not-allowed', margin: 0, fontSize: '0.82rem' }}
                    >
                      {t.an_not_generated}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SECTION: ML PIPELINE HEALTH (KPIs & TELEMETRY) ── */}
      {activeSection === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {loadingHealth && !healthData ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <div className="status-dot" style={{ width: '8px', height: '8px' }}></div>
              <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {t.an_preview_loading}
              </span>
            </div>
          ) : healthError ? (
            <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,59,48,0.05)', color: 'var(--danger)', borderRadius: '8px', border: '1.5px dashed rgba(255,59,48,0.2)' }}>
              <span style={{ fontWeight: 700 }}>Error loading telemetry: {healthError}</span>
            </div>
          ) : healthData ? (
            <>
              {/* Telemetry introduction card */}
              <div className="card" style={{ padding: '28px', margin: 0, borderLeft: '6px solid var(--primary)' }}>
                <h3 style={{ fontSize: '1.35rem', color: 'var(--primary)', fontWeight: 800, marginBottom: '8px' }}>
                  {t.an_health_title}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.55, margin: 0 }}>
                  {t.an_health_intro}
                </p>
              </div>

              {/* KPI Cards Row */}
              <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                
                {/* 1. Overall completeness */}
                <div className="kpi-card" style={{ margin: 0, border: '1.5px solid #30d158', background: 'rgba(48, 209, 88, 0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>{t.an_health_score}</h3>
                    <div className="kpi-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 6px 0', marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#30d158',
                        boxShadow: '0 0 10px #30d158',
                        animation: 'pulse 1.5s infinite',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.45rem', lineHeight: 1.2 }}>
                        {healthData.overall_completeness}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {language === 'kn' ? 'ಶೂನ್ಯವಲ್ಲದ ಡೇಟಾ ಕೋಶಗಳು' : 'Non-null cells verified'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {language === 'kn' ? 'ಡೇಟಾ ಆರೋಗ್ಯ ಸ್ಕೋರ್: ಅತ್ಯುತ್ತಮ' : 'Data Integrity: Excellent'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', lineHeight: 1.35 }}>
                    {t.an_health_score_desc}
                  </div>
                </div>

                {/* 2. Pipeline Status / Staleness */}
                <div className="kpi-card" style={{ margin: 0, border: '1.5px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>{t.an_pipeline_status}</h3>
                    <div className="kpi-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 6px 0', marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#30d158',
                        boxShadow: '0 0 10px #30d158',
                        animation: 'pulse 1.5s infinite',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.1rem', lineHeight: 1.2 }}>{language === 'kn' ? 'ಸಕ್ರಿಯವಾಗಿದೆ' : 'ACTIVE & IN SYNC'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {language === 'kn' ? 'ಕೊನೆಯ ಚೆಕ್: ಯಶಸ್ವಿ' : 'Last sync check: Success'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {language === 'kn' ? 'ಮುಂದಿನ ಚೆಕ್: ರಾತ್ರಿ 02:00' : 'Next cron run: 02:00 Daily'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', lineHeight: 1.35 }}>
                    {t.an_status_active}
                  </div>
                </div>

                {/* 3. Feedback counts */}
                <div className="kpi-card" style={{ margin: 0, border: '1.5px solid #bf5af2', background: 'rgba(191, 90, 242, 0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>{t.an_feedback_count}</h3>
                    <div className="kpi-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 6px 0', marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#bf5af2',
                        boxShadow: '0 0 10px #bf5af2',
                        animation: 'pulse 1.5s infinite',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.45rem', lineHeight: 1.2 }}>
                        {healthData.calibration.feedback_count}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {language === 'kn' ? 'ಪರಿಷ್ಕರಿಸಿದ ಕಾರಿಡಾರ್‌ಗಳು' : 'Calibrated corridors verified'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {language === 'kn' ? 'ಲೈವ್ ಫೀಡ್‌ಬ್ಯಾಕ್ ಸಕ್ರಿಯವಾಗಿದೆ' : 'Live feedback logs: Active'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', lineHeight: 1.35 }}>
                    {language === 'kn' ? 'ಲರ್ನಿಂಗ್ ಇಂಜಿನ್‌ನಲ್ಲಿ ದಾಖಲಾದ ಒಟ್ಟು ಮುಚ್ಚುವಿಕೆಗಳು' : 'Total closed events logged to calibration loop.'}
                  </div>
                </div>

                {/* 4. MAE Calibrations */}
                <div className="kpi-card" style={{ margin: 0, border: '1.5px solid #ff9f0a', background: 'rgba(255, 159, 10, 0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>{t.an_improvement}</h3>
                    <div className="kpi-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 6px 0', marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#ff9f0a',
                        boxShadow: '0 0 10px #ff9f0a',
                        animation: 'pulse 1.5s infinite',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.45rem', lineHeight: 1.2 }}>
                        +{healthData.calibration.improvement_pct}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {t.an_mae_baseline}: {healthData.calibration.uncalibrated_mae} {t.mins}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {t.an_mae_calibrated}: {healthData.calibration.calibrated_mae} {t.mins}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', lineHeight: 1.35 }}>
                    {t.an_mae_calibrated_desc}
                  </div>
                </div>

              </div>

              {/* Datasets detailed status table */}
              <div className="card" style={{ padding: '28px', margin: 0 }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  {language === 'kn' ? 'ಡೇಟಾಸೆಟ್ ಆರೋಗ್ಯ ತಪಾಸಣೆ ವರದಿ' : 'Dataset Health Audit Details'}
                </h4>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                        <th style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)' }}>{t.an_file}</th>
                        <th style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)' }}>{t.an_rows}</th>
                        <th style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)' }}>{t.an_columns}</th>
                        <th style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)' }}>{t.an_completeness_rate}</th>
                        <th style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)' }}>{t.an_last_sync}</th>
                        <th style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)' }}>{t.an_status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthData.file_stats.map((file, idx) => {
                        const theme = categoryThemes[file.id] || { color: 'var(--text-dark)' };
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '14px 18px', fontWeight: 800, fontFamily: 'monospace', color: theme.color }}>
                              {file.filename}
                            </td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-dark)', fontWeight: 700 }}>
                              {file.exists ? file.rows : '-'}
                            </td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {file.exists ? file.columns : '-'}
                            </td>
                            <td style={{ padding: '14px 18px', fontWeight: 800 }}>
                              {file.exists ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: file.completeness > 98 ? '#30d158' : '#ff9f0a' }}>{file.completeness}%</span>
                                  {/* Small inline completeness track */}
                                  <div style={{ width: '50px', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${file.completeness}%`, height: '100%', background: file.completeness > 98 ? '#30d158' : '#ff9f0a' }} />
                                  </div>
                                </div>
                              ) : '-'}
                            </td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {file.exists ? file.time_ago : '-'}
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              {file.exists ? (
                                <span style={{
                                  background: file.status === 'fresh' ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 159, 10, 0.12)',
                                  color: file.status === 'fresh' ? '#30d158' : '#ff9f0a',
                                  border: file.status === 'fresh' ? '1px solid rgba(48, 209, 88, 0.25)' : '1px solid rgba(255, 159, 10, 0.25)',
                                  padding: '4px 12px',
                                  borderRadius: '16px',
                                  fontSize: '0.74rem',
                                  fontWeight: 800
                                }}>
                                  {file.status === 'fresh' ? t.an_staleness_fresh : t.an_staleness_warning}
                                </span>
                              ) : (
                                <span style={{
                                  background: 'rgba(255, 69, 58, 0.12)',
                                  color: '#ff453a',
                                  border: '1px solid rgba(255, 69, 58, 0.25)',
                                  padding: '4px 12px',
                                  borderRadius: '16px',
                                  fontSize: '0.74rem',
                                  fontWeight: 800
                                }}>
                                  {language === 'kn' ? 'ಲಭ್ಯವಿಲ್ಲ' : 'MISSING'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recalibration Telemetry Visual Loop */}
              <div className="card" style={{ padding: '28px', margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                  {language === 'kn' ? 'ಸ್ವಯಂ-ಕಲಿಕೆ ಟೆಲಿಮೆಟ್ರಿ ಲೂಪ್' : 'Self-Learning Recalibration Telemetry Loop'}
                </h4>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-primary)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  gap: '16px'
                }}>
                  {/* Step 1: Log ground truth */}
                  <div style={{
                    flex: '1 1 220px',
                    textAlign: 'center',
                    background: 'var(--card-bg)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1.5px solid #bf5af2',
                    boxShadow: '0 4px 12px rgba(191, 90, 242, 0.05)'
                  }}>
                    <div style={{ 
                      fontSize: '1.5rem', 
                      background: 'rgba(191, 90, 242, 0.12)', 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      margin: '0 auto 12px auto',
                      color: '#bf5af2',
                      boxShadow: 'inset 0 0 8px rgba(191, 90, 242, 0.2)'
                    }}>
                      📝
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', color: 'var(--text-dark)' }}>
                      {language === 'kn' ? '1. ನೈಜ ಗ್ರೌಂಡ್ ಟ್ರುತ್' : '1. Log Ground Truth'}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: 1.4 }}>
                      {language === 'kn' ? 'ಅಧಿಕಾರಿಗಳು ಲರ್ನಿಂಗ್ ಇಂಜಿನ್‌ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯೆ ನೀಡುತ್ತಾರೆ' : 'Commanders log actual clearances'}
                    </span>
                  </div>

                  {/* Arrow 1 */}
                  <div style={{ color: '#bf5af2', fontWeight: 'bold', fontSize: '1.8rem', textShadow: '0 0 8px rgba(191, 90, 242, 0.3)' }}>➔</div>

                  {/* Step 2: Active calibration */}
                  <div style={{
                    flex: '1 1 220px',
                    textAlign: 'center',
                    background: 'var(--card-bg)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--primary)',
                    boxShadow: '0 4px 12px rgba(234, 117, 14, 0.05)'
                  }}>
                    <div style={{ 
                      fontSize: '1.5rem', 
                      background: 'var(--primary-glow)', 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      margin: '0 auto 12px auto',
                      color: 'var(--primary)',
                      boxShadow: 'inset 0 0 8px rgba(234, 117, 14, 0.2)'
                    }}>
                      ⚙️
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', color: 'var(--text-dark)' }}>
                      {language === 'kn' ? '2. ಆಕ್ಟಿವ್ ಕ್ಯಾಲಿಬ್ರೇಶನ್' : '2. Active Calibration'}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: 1.4 }}>
                      {language === 'kn' ? 'ದೋಷಗಳ ತೂಕವನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ' : 'EWM delta error is re-calibrated'}
                    </span>
                  </div>

                  {/* Arrow 2 */}
                  <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.8rem', textShadow: '0 0 8px var(--primary-glow)' }}>➔</div>

                  {/* Step 3: Refined predictions */}
                  <div style={{
                    flex: '1 1 220px',
                    textAlign: 'center',
                    background: 'var(--card-bg)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1.5px solid #30d158',
                    boxShadow: '0 4px 12px rgba(48, 209, 88, 0.05)'
                  }}>
                    <div style={{ 
                      fontSize: '1.5rem', 
                      background: 'rgba(48, 209, 88, 0.12)', 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      margin: '0 auto 12px auto',
                      color: '#30d158',
                      boxShadow: 'inset 0 0 8px rgba(48, 209, 88, 0.2)'
                    }}>
                      ⚡
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', color: 'var(--text-dark)' }}>
                      {language === 'kn' ? '3. ಊಹೆ ಪರಿಷ್ಕರಣೆ' : '3. Refined Predictions'}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: 1.4 }}>
                      {language === 'kn' ? 'ಲೈವ್ API predictions ತಕ್ಷಣವೇ ಹೊಂದಾಣಿಕೆಯಾಗುತ್ತವೆ' : 'FastAPI auto-applies bias offsets'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Modal Popup Overlay (CSV Preview Table) ── */}
      {selectedFile && (
        <div 
          className="modal-backdrop"
          onClick={() => setSelectedFile(null)}
          style={{ display: 'flex' }}
        >
          <div 
            className="modal-card"
            onClick={(e) => e.stopPropagation()} // Prevent close on clicking inside modal card
            style={{
              width: '1100px',
              maxWidth: '94%',
              border: `2.5px solid ${(categoryThemes[selectedFile.id] || { color: 'var(--primary)' }).color}`,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '36px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '2.5px solid var(--bg-primary)', paddingBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.5rem', color: (categoryThemes[selectedFile.id] || { color: 'var(--primary)' }).color, fontWeight: 800, margin: 0 }}>
                  {t[`fn_${selectedFile.id}_title`] || selectedFile.filename}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px', margin: 0 }}>
                  <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>{selectedFile.filename}</code> · {t[`fn_${selectedFile.id}_desc`]}
                </p>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                  lineHeight: 1
                }}
                onMouseEnter={e => e.currentTarget.style.color = (categoryThemes[selectedFile.id] || { color: 'var(--primary)' }).color}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                &times;
              </button>
            </div>

            {/* Modal Stats & Download */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    {t.an_rows}
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                    {selectedFile.row_count}
                  </span>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    {t.an_status}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#30d158' }}>
                    {t.an_ready}
                  </span>
                </div>
              </div>

              <a 
                href={`http://localhost:8000/api/analytics-download/${selectedFile.filename}`}
                className="btn-primary"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: 'auto',
                  padding: '12px 24px',
                  fontSize: '0.88rem',
                  borderRadius: '8px',
                  margin: 0,
                  background: `linear-gradient(135deg, ${(categoryThemes[selectedFile.id] || { color: 'var(--primary)' }).color}, ${(categoryThemes[selectedFile.id] || { color: 'var(--primary)' }).color}dd)`,
                  boxShadow: `0 4px 14px ${(categoryThemes[selectedFile.id] || { bgGlow: 'var(--primary-glow)' }).bgGlow}`
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{t.an_download_btn}</span>
              </a>
            </div>

            {/* Columns List */}
            {selectedFile.columns && selectedFile.columns.length > 0 && (
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
                  {t.an_columns}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedFile.columns.map((col, idx) => (
                    <span 
                      key={idx} 
                      style={{ 
                        fontSize: '0.74rem', 
                        background: (categoryThemes[selectedFile.id] || { bgGlow: 'rgba(234, 117, 14, 0.06)' }).bgGlow, 
                        color: (categoryThemes[selectedFile.id] || { color: 'var(--primary)' }).color, 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        border: `1.5px solid ${(categoryThemes[selectedFile.id] || { bgGlow: 'rgba(234, 117, 14, 0.12)' }).bgGlow}`,
                        fontWeight: 800,
                        fontFamily: 'monospace'
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Table Preview Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, minHeight: '300px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                {t.an_preview_title}
              </h4>
              
              {loadingPreview ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', height: '220px' }}>
                  <div className="status-dot" style={{ width: '8px', height: '8px' }}></div>
                  <span style={{ marginLeft: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t.an_preview_loading}
                  </span>
                </div>
              ) : previewError ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,59,48,0.05)', color: 'var(--danger)', borderRadius: '8px', border: '1.5px dashed rgba(255,59,48,0.2)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {t.an_preview_error}
                </div>
              ) : previewData && previewData.data.length > 0 ? (
                <div style={{ 
                  overflowX: 'auto', 
                  border: '1.5px solid var(--border-color)', 
                  borderRadius: '12px', 
                  boxShadow: 'var(--shadow-sm)',
                  background: 'var(--card-bg)',
                  maxHeight: '420px',
                  overflowY: 'auto'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-primary)' }}>
                      <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                        {previewData.columns.map((col, idx) => (
                          <th key={idx} style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-dark)', whiteSpace: 'nowrap', background: 'var(--bg-primary)' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.data.map((row, rIdx) => (
                        <tr 
                          key={rIdx} 
                          style={{ 
                            borderBottom: '1px solid var(--border-color)', 
                            background: rIdx % 2 === 0 ? 'var(--card-bg)' : (categoryThemes[selectedFile.id] || { bgGlow: 'rgba(234, 117, 14, 0.01)' }).bgGlow 
                          }}
                        >
                          {previewData.columns.map((col, cIdx) => (
                            <td key={cIdx} style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {row[col]?.toString() || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.88rem', fontWeight: 600 }}>
                  {t.an_no_data}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '10px' }}>
              <button 
                onClick={() => setSelectedFile(null)}
                className="btn-secondary"
                style={{ width: 'auto', padding: '12px 28px', margin: 0, fontSize: '0.88rem', fontWeight: 800 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

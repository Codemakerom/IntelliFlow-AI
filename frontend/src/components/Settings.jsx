import React from 'react';
import { translations } from '../translations';

export default function Settings({ 
  personnel, 
  setPersonnel,
  language
}) {
  const t = translations[language] || translations.en;
  const handleAddCommander = () => {
    const nameInput = document.getElementById('settings-personnel-name');
    const phoneInput = document.getElementById('settings-personnel-phone');
    if (nameInput && phoneInput) {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      if (!name || !phone) {
        alert(t.set_alert_fill);
        return;
      }
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        alert(t.set_alert_valid);
        return;
      }
      setPersonnel(prev => [...prev, { name, phone }]);
      nameInput.value = '';
      phoneInput.value = '';
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm(t.set_confirm_reset)) {
      setPersonnel([
        { name: language === 'kn' ? 'ಇನ್ಸ್‌ಪೆಕ್ಟರ್ ಶಿವಣ್ಣ (ಮೈಸೂರು ರಸ್ತೆ)' : 'Inspector Shivanna (Mysore Road)', phone: '+919876543210' },
        { name: language === 'kn' ? 'ಎಸಿಪಿ ಗೌಡ (ಕೇಂದ್ರ ವಿಭಾಗ)' : 'ACP Gowda (Central Division)', phone: '+918765432109' },
        { name: language === 'kn' ? 'ಇನ್ಸ್‌ಪೆಕ್ಟರ್ ರಾಮಚಂದ್ರ (ಪಶ್ಚಿಮ ವಿಭಾಗ)' : 'Inspector Ramachandra (West Division)', phone: '+919988776655' }
      ]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* ── CARD: FIELD PERSONNEL REGISTRY ── */}
      <div className="card">
        <div className="flex-header-container" style={{ borderBottom: '1.5px solid var(--bg-primary)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="header-square-icon header-square-purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', textTransform: 'uppercase', margin: 0, fontWeight: 800 }}>
              {t.set_title}
            </h3>
          </div>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto', margin: 0 }}
            onClick={handleResetDefaults}
          >
            {t.set_reset_defaults}
          </button>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>
          {t.set_desc}
        </p>

        {/* List of Personnel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {personnel.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-primary)', border: '1.5px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              {t.set_no_commanders}
            </div>
          ) : (
            personnel.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-dark)' }}>{p.name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>{p.phone}</span>
                </div>
                <button 
                  type="button" 
                  style={{ color: '#ff3b30', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, transition: 'opacity 0.2s' }}
                  onClick={() => setPersonnel(prev => prev.filter((_, i) => i !== idx))}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {t.set_remove}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.set_add_commander}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder={language === 'kn' ? 'ಹೆಸರು (ಉದಾ. ಎಸಿಪಿ ಗೌಡ)' : 'Name (e.g. ACP Gowda)'}
              id="settings-personnel-name"
              style={{ 
                flex: 1, 
                padding: '10px 14px', 
                fontSize: '0.88rem', 
                borderRadius: '8px', 
                border: '1.5px solid var(--border-color)', 
                fontWeight: 600,
                background: 'var(--bg-primary)',
                color: 'var(--text-dark)'
              }} 
            />
            <input 
              type="text" 
              placeholder="+91..." 
              id="settings-personnel-phone"
              style={{ 
                width: '180px', 
                padding: '10px 14px', 
                fontSize: '0.88rem', 
                borderRadius: '8px', 
                border: '1.5px solid var(--border-color)', 
                fontWeight: 600,
                background: 'var(--bg-primary)',
                color: 'var(--text-dark)'
              }} 
            />
            <button 
              type="button" 
              className="btn-primary" 
              style={{ padding: '10px 20px', fontSize: '0.88rem', width: 'auto', margin: 0 }}
              onClick={handleAddCommander}
            >
              {t.set_add_btn}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

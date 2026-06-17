import React from 'react';

export default function Settings({ 
  personnel, 
  setPersonnel
}) {
  const handleAddCommander = () => {
    const nameInput = document.getElementById('settings-personnel-name');
    const phoneInput = document.getElementById('settings-personnel-phone');
    if (nameInput && phoneInput) {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      if (!name || !phone) {
        alert('Please fill in both name and phone number.');
        return;
      }
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        alert('Please enter a valid phone number with at least 10 digits.');
        return;
      }
      setPersonnel(prev => [...prev, { name, phone }]);
      nameInput.value = '';
      phoneInput.value = '';
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset personnel to default commanders?')) {
      setPersonnel([
        { name: 'Inspector Shivanna (Mysore Road)', phone: '+919876543210' },
        { name: 'ACP Gowda (Central Division)', phone: '+918765432109' },
        { name: 'Inspector Ramachandra (West Division)', phone: '+919988776655' }
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
              Field Personnel Settings
            </h3>
          </div>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto', margin: 0 }}
            onClick={handleResetDefaults}
          >
            Reset Defaults
          </button>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>
          Configure WhatsApp numbers for field commanders to enable instant one-click dispatch briefings directly from model predictions.
        </p>

        {/* List of Personnel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {personnel.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-primary)', border: '1.5px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              No commanders registered in the system. Use the form below to register new personnel.
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
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Add Commander</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Name (e.g. ACP Gowda)" 
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
              Add
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

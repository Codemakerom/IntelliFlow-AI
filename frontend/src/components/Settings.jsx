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

      let finalPhone = phone;
      if (cleanPhone.length === 10) {
        finalPhone = `+91${cleanPhone}`;
      } else if (cleanPhone.length > 10 && !phone.startsWith('+')) {
        finalPhone = `+${cleanPhone}`;
      }

      setPersonnel(prev => [...prev, { name, phone: finalPhone }]);
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

      {/* ── CARD: WHATSAPP ALERT SETUP (first) ── */}
      <div className="card" style={{ border: '2px solid rgba(37,211,102,0.3)', background: 'linear-gradient(135deg, rgba(37,211,102,0.04), transparent)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1.5px solid rgba(37,211,102,0.15)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #25d366, #128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(37,211,102,0.35)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#128c7e' }}>WhatsApp Alert Setup</h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Required for first-time use · Takes 30 seconds</p>
          </div>
          <div style={{ marginLeft: 'auto', background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.68rem', fontWeight: 800, color: '#128c7e' }}>
            ⚡ FIRST-TIME SETUP
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: 600, lineHeight: 1.7, marginBottom: '20px' }}>
          GridLock sends real-time incident alerts via WhatsApp through the <strong>Twilio sandbox</strong>. Before you can receive any alerts,
          every user must <strong>join the sandbox once</strong> by sending a simple code to the Twilio WhatsApp number.
          This is a one-time step — you won't need to do it again.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          {[
            { step: 1, text: 'Click the button below — it opens WhatsApp with the message already typed for you.' },
            { step: 2, text: "Just hit Send in WhatsApp. You'll get a confirmation reply within a few seconds." },
            { step: 3, text: "That's it! You're now connected and will receive all GridLock WhatsApp alerts." },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0, marginTop: '1px' }}>{s.step}</div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.6 }}>{s.text}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px dashed rgba(37,211,102,0.4)', borderRadius: '10px', padding: '14px 18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '5px' }}>Message to send</div>
            <code style={{ fontSize: '1.1rem', fontWeight: 900, color: '#128c7e', letterSpacing: '0.5px' }}>join leave-dear</code>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText('join leave-dear').then(() => {
                const btn = document.getElementById('copy-twilio-code');
                if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy Code'; }, 2000); }
              });
            }}
            id="copy-twilio-code"
            style={{ background: 'none', border: '1.5px solid rgba(37,211,102,0.4)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', color: '#128c7e', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            📋 Copy Code
          </button>
        </div>

        <a
          href="https://wa.me/14155238886?text=join%20leave-dear"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            background: 'linear-gradient(135deg, #25d366, #128c7e)',
            color: 'white', textDecoration: 'none',
            borderRadius: '12px', padding: '16px 24px',
            fontWeight: 900, fontSize: '1rem',
            boxShadow: '0 6px 24px rgba(37,211,102,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(37,211,102,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,211,102,0.4)'; }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Open WhatsApp — Message Pre-filled, Just Hit Send!
        </a>

        <p style={{ margin: '14px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', lineHeight: 1.6 }}>
          Sends to Twilio sandbox number <strong>+1 (415) 523-8886</strong> · This only links your number to the sandbox, no personal data is shared.
        </p>

      </div>

      {/* ── CARD: FIELD PERSONNEL REGISTRY (below) ── */}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.set_add_commander}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder={language === 'kn' ? 'ಹೆಸರು (ಉದಾ. ಎಸಿಪಿ ಗೌಡ)' : 'Name (e.g. ACP Gowda)'}
              id="settings-personnel-name"
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.88rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', fontWeight: 600, background: 'var(--bg-primary)', color: 'var(--text-dark)' }}
            />
            <input
              type="text"
              placeholder={language === 'kn' ? '10-ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ' : '10-digit number'}
              id="settings-personnel-phone"
              style={{ width: '180px', padding: '10px 14px', fontSize: '0.88rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', fontWeight: 600, background: 'var(--bg-primary)', color: 'var(--text-dark)' }}
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

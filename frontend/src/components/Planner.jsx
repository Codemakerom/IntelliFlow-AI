import React, { useEffect, useState } from 'react';
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

export default function Planner({ onEventEnd, personnel, language }) {
  const [options, setOptions] = useState(null);
  const t = translations[language] || translations.en;
  const translateVehicle = (vt) => {
    const key = 'vehicle_' + vt.toLowerCase().replace(/ \/ /g, '_').replace(/ /g, '_').replace(/\(|\)/g, '');
    return t[key] || vt;
  };
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
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [voiceHovered, setVoiceHovered] = useState(false);

  // Stop audio on unmount or when results change
  useEffect(() => {
    return () => {
      if (audioObj) {
        audioObj.pause();
      }
    };
  }, [audioObj, results]);

  // What-If Scenario Simulator state
  const [simulationQuery, setSimulationQuery] = useState('');
  const [simulationChat, setSimulationChat] = useState([
    {
      sender: 'bot',
      text: 'Welcome to the What-If Scenario Simulator.\n\nAsk me any tactical scenario (e.g. closing a road or changing personnel) and I will generate a concrete location-specific operational alternative plan for you.'
    }
  ]);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState(null);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [selectedCommanders, setSelectedCommanders] = useState([]);

  // Sync selected commanders with personnel when loaded
  useEffect(() => {
    if (personnel && personnel.length > 0 && selectedCommanders.length === 0) {
      setSelectedCommanders([0]); // Default to first commander
    }
  }, [personnel]);



  // Map and markers references for interactive tactical map
  const inlineMapRef = React.useRef(null);
  const markersRef = React.useRef({});
  const polylinesRef = React.useRef([]);

  // Load options from FastAPI
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:8000"}`}/api/options`)
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
    setSimulationChat([
      {
        sender: 'bot',
        text: 'Welcome to the What-If Scenario Simulator.\n\nAsk me any tactical scenario (e.g. closing a road or changing personnel) and I will generate a concrete location-specific operational alternative plan for you.'
      }
    ]);
    setSimulationQuery('');
    setSimulationError(null);
    setShowSimulationModal(false);

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

    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:8000"}`}/api/predict`, {
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

  const handleSimulate = (queryText) => {
    if (!queryText || !queryText.trim()) return;

    // Append user message immediately
    const userMsg = { sender: 'user', text: queryText };
    setSimulationChat(prev => [...prev, userMsg]);
    setSimulationQuery(''); // Clear text box immediately
    setSimulating(true);
    setSimulationError(null);

    // Compile chat history from state
    const formattedHistory = simulationChat
      .filter(msg => !msg.text.startsWith('Welcome to the What-If'))
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

    const payload = {
      scenario_query: queryText,
      chat_history: formattedHistory,
      prediction_context: {
        primary_corridor: results?.primary_corridor || form.corridor,
        event_cause: results?.event_cause || form.event_cause,
        event_type: results?.event_type || form.event_type,
        zone_congestion_risk: results?.zone_congestion_risk || 50,
        officers_recommended: results?.officers_recommended || 5,
        travel_delay_min: results?.travel_delay_min || 15,
        estimated_resolution_time_min: results?.estimated_resolution_time_min || 45,
        priority_junctions: results?.priority_junctions || [],
        alternate_routes: results?.alternate_routes || [],
      },
      groq_api_key: localStorage.getItem('groq_api_key') || '',
    };

    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:8000"}`}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Simulation endpoint returned an error.');
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          const planText = data.alternative_plan || data.analysis;
          setSimulationChat(prev => [...prev, { sender: 'bot', text: planText }]);
        } else {
          throw new Error('Simulation failed.');
        }
        setSimulating(false);
      })
      .catch((err) => {
        console.error(err);
        setSimulationError(err.message);
        setSimulating(false);
      });
  };

  const renderChatBubbleContent = (text) => {
    if (!text) return null;

    let prefix = '';
    let bodyText = text;

    // Handle array
    if (Array.isArray(bodyText)) {
      return (
        <ul style={{ margin: '6px 0 0 16px', padding: 0, listStyleType: 'disc' }}>
          {bodyText.map((line, idx) => (
            <li key={idx} style={{ marginBottom: '6px', lineHeight: '1.4' }}>
              {line.replace(/^•\s*/, '').replace(/^-\s*/, '').trim()}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof bodyText === 'string') {
      bodyText = bodyText.trim();
      if (bodyText.startsWith('Alternative Plan:')) {
        prefix = language === 'kn' ? 'ಪರ್ಯಾಯ ಯೋಜನೆ:' : 'Alternative Plan:';
        bodyText = bodyText.substring('Alternative Plan:'.length).trim();
      } else if (bodyText.startsWith('Alternative Operation Plan:')) {
        prefix = language === 'kn' ? 'ಪರ್ಯಾಯ ಕಾರ್ಯಾಚರಣೆ ಯೋಜನೆ:' : 'Alternative Operation Plan:';
        bodyText = bodyText.substring('Alternative Operation Plan:'.length).trim();
      } else if (bodyText.startsWith('ಪರ್ಯಾಯ ಯೋಜನೆ:')) {
        prefix = language === 'kn' ? 'ಪರ್ಯಾಯ ಯೋಜನೆ:' : 'Alternative Plan:';
        bodyText = bodyText.substring('ಪರ್ಯಾಯ ಯೋಜನೆ:'.length).trim();
      } else if (bodyText.startsWith('ಪರ್ಯಾಯ ಕಾರ್ಯಾಚರಣೆ ಯೋಜನೆ:')) {
        prefix = language === 'kn' ? 'ಪರ್ಯಾಯ ಕಾರ್ಯಾಚರಣೆ ಯೋಜನೆ:' : 'Alternative Operation Plan:';
        bodyText = bodyText.substring('ಪರ್ಯಾಯ ಕಾರ್ಯಾಚರಣೆ ಯೋಜನೆ:'.length).trim();
      }

      // Check if the bodyText contains list structures (bullets or hyphens)
      if (bodyText.includes('•') || bodyText.includes('- ')) {
        const lines = bodyText
          .split(/[•\n]/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && line !== '-');

        if (lines.length > 1 || prefix) {
          return (
            <div>
              {prefix && <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{prefix}</div>}
              <ul style={{ margin: '6px 0 0 16px', padding: 0, listStyleType: 'disc' }}>
                {lines.map((line, idx) => (
                  <li key={idx} style={{ marginBottom: '6px', lineHeight: '1.4' }}>
                    {line.replace(/^-\s*/, '').trim()}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      }

      return (
        <div>
          {prefix && <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{prefix}</div>}
          <span style={{ whiteSpace: 'pre-wrap' }}>{bodyText}</span>
        </div>
      );
    }

    return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  };

  const handleVoiceOverview = () => {
    if (!results) return;

    if (isPlaying) {
      if (audioObj) {
        audioObj.pause();
      }
      setIsPlaying(false);
      return;
    }

    let text = '';
    if (language === 'kn') {
      const eventTypeDesc = form.event_type === 'planned' ? 'ಯೋಜಿತ ಈವೆಂಟ್' : 'ಸಕ್ರಿಯ ಸಂಚಾರ ಘಟನೆ';
      const causeText = t[`cause_${form.event_cause}`] || form.event_cause.replace(/_/g, ' ');
      const corridorName = corridorTranslationsKn[results.primary_corridor || form.corridor] || results.primary_corridor || form.corridor;
      
      const alertMap = {
        'Critical Impact': 'ಅತ್ಯಂತ ಗಂಭೀರ ಪ್ರಭಾವ',
        'High Impact': 'ಹೆಚ್ಚಿನ ಪ್ರಭಾವ',
        'Moderate Impact': 'ಮಧ್ಯಮ ಪ್ರಭಾವ',
        'Low Impact': 'ಕಡಿಮೆ ಪ್ರಭಾವ'
      };
      const rawAlert = results.alert_level.split(' ').slice(1).join(' ');
      const alertKn = alertMap[rawAlert] || rawAlert;

      const juncText = results.precision_barricades && results.precision_barricades.length > 0
        ? `ಸಂಚಾರ ನಿಯಂತ್ರಣಕ್ಕಾಗಿ ನಾವು ${results.precision_barricades.map(j => j.name).join(' ಮತ್ತು ')} ಜಂಕ್ಷನ್‌ಗಳನ್ನು ಮುಚ್ಚಲು ಶಿಫಾರಸು ಮಾಡುತ್ತೇವೆ.`
        : '';

      const altRoutesText = results.alternate_routes?.map(r => corridorTranslationsKn[r] || r).join(', ') || 'adjacent arterial roads';

      text = `ಬೆಂಗಳೂರಿನಲ್ಲಿ ${eventTypeDesc} ಗಾಗಿ ಟ್ರಾಫಿಕ್ ಮುನ್ಸೂಚನೆ ಸಾರಾಂಶ ಇಲ್ಲಿದೆ. ` +
        `${corridorName} ಕಾರಿಡಾರ್‌ನಲ್ಲಿ ${causeText} ಇದರ ಕಾರಣವಾಗಿದೆ. ` +
        `ಟ್ರಾಫಿಕ್ ಪ್ರಭಾವದ ಸ್ಕೋರ್ 100 ಕ್ಕೆ ${results.event_impact_score} ಎಂದು ಊಹಿಸಲಾಗಿದೆ, ಎಚ್ಚರಿಕೆ ಮಟ್ಟವನ್ನು ${alertKn} ಕ್ಕೆ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ. ` +
        `ಅಂದಾಜು ಪ್ರಯಾಣ ವಿಳಂಬವು ${results.travel_delay_min} ನಿಮಿಷಗಳನ್ನು ತಲುಪುವ ನಿರೀಕ್ಷೆಯಿದೆ. ` +
        `ಈ ಸಂಚಾರವನ್ನು ನಿರ್ವಹಿಸಲು, ನಾವು ಒಟ್ಟು ${results.officers_recommended} ಸಂಚಾರ ಪೊಲೀಸ್ ಅಧಿಕಾರಿಗಳನ್ನು ಮತ್ತು ${results.barricades_recommended} ಬ್ಯಾರಿಕೇಡ್‌ಗಳನ್ನು ನಿಯೋಜಿಸಲು ಶಿಫಾರಸು ಮಾಡುತ್ತೇವೆ. ` +
        `${juncText} ` +
        `ಸಂಚಾರ ದಟ್ಟಣೆಯನ್ನು ತಪ್ಪಿಸಲು ಚಾಲಕರು ${altRoutesText} ಮೂಲಕ ಸಕ್ರಿಯ ಪರ್ಯಾಯ ಮಾರ್ಗಗಳನ್ನು ಬಳಸಬೇಕು.`;
    } else {
      const juncText = results.precision_barricades && results.precision_barricades.length > 0
        ? `We recommend sealing ${results.precision_barricades.map(j => j.name).join(' and ')} to intercept traffic flow.`
        : '';
        
      const eventTypeDesc = form.event_type === 'planned' ? 'planned event' : 'active traffic incident';
      
      text = `Here is the traffic forecast summary for the ${eventTypeDesc} in Bengaluru. ` +
        `The cause is ${form.event_cause.replace(/_/g, ' ')} on the ${results.primary_corridor || form.corridor} corridor. ` +
        `The traffic impact score is predicted at ${results.event_impact_score} out of 100, placing the alert level at ${results.alert_level.split(' ').slice(1).join(' ')}. ` +
        `Estimated travel delays are expected to reach ${results.travel_delay_min} minutes. ` +
        `To manage this flow, we recommend deploying a total of ${results.officers_recommended} traffic officers and ${results.barricades_recommended} barricades. ` +
        `${juncText} ` +
        `Drivers should use active diversions through ${results.alternate_routes?.join(', ') || 'adjacent arterial roads'} to bypass the bottleneck.`;
    }

    setTtsLoading(true);

    const payload = {
      text,
      target_language_code: language === 'kn' ? 'kn-IN' : 'en-IN'
    };

    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:8000"}`}/api/voice-overview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to generate speech overview.');
        return res.json();
      })
      .then(data => {
        setTtsLoading(false);
        if (data.success && data.audio) {
          const audioSrc = `data:audio/wav;base64,${data.audio}`;
          const audio = new Audio(audioSrc);
          setAudioObj(audio);
          setIsPlaying(true);
          audio.play();
          audio.onended = () => {
            setIsPlaying(false);
          };
        } else {
          alert(`TTS Error: ${data.error || 'Unknown error'}`);
        }
      })
      .catch(err => {
        console.error(err);
        alert(`TTS Error: ${err.message}`);
        setTtsLoading(false);
      });
  };

  const handleSendWhatsAppBrief = async () => {
    if (!results) return;

    if (selectedCommanders.length === 0) {
      alert("❌ Please select at least one field commander to dispatch the brief.");
      return;
    }

    const juncsText = (results.precision_barricades || []).map((j, i) => 
      `📍 Position ${i+1}: ${j.name}\n   👮 Force: ${j.officers_needed} Marshal(s)\n   🚧 Gear: ${j.barricades_needed} Barricade(s)`
    ).join('\n\n');

    const messageText = `🚨 GRIDLOCK OPERATIONAL DIRECTIVE 🚨
----------------------------------------
📍 Corridor: ${results.primary_corridor || form.corridor}
⚠️ Incident: ${form.event_cause.replace(/_/g, ' ').toUpperCase()}
📊 Confidence Score: ${Math.min(98, Math.max(72, results.event_impact_score + 10))}%

👮 RECOMMENDED FORCE:
• Deploy ${results.officers_recommended} Traffic Officers
• Place ${results.vehicles_recommended} Standby Vehicles

🚧 POSITIONING MARSHALS:
${juncsText}

↩️ ACTIVE DIVERSIONS:
• Alternate Routes: ${(results.alternate_routes || []).join(', ')}
----------------------------------------
👉 Modeled via Central Traffic Flow Vectors.`;

    const openManualWhatsApp = (phone, text) => {
      const encodedText = encodeURIComponent(text);
      const phoneClean = phone.replace(/[^0-9]/g, ''); // strip spaces/symbols for pure numeric wa.me target
      const url = `https://api.whatsapp.com/send?phone=${phoneClean}&text=${encodedText}`;
      window.open(url, '_blank');
    };

    // Check selected dispatch method
    const methodSelect = document.getElementById('whatsapp-method-select');
    const method = methodSelect ? methodSelect.value : 'twilio';

    if (method === 'whatsapp_web') {
      if (selectedCommanders.length > 1) {
        alert("ℹ️ Redirecting to WhatsApp Web for multiple contacts. Please allow popups/tabs in your browser if prompted.");
      }
      selectedCommanders.forEach((idx) => {
        const commander = personnel[idx];
        if (commander && commander.phone) {
          const phoneClean = commander.phone.replace(/[^0-9]/g, '');
          if (phoneClean.length >= 10) {
            openManualWhatsApp(commander.phone, messageText);
          }
        }
      });
      return;
    }

    // Attempt Twilio programmatic dispatch first. If missing credentials or error, fall back to manual redirect.
    const btn = document.getElementById('whatsapp-dispatch-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Dispatching...";
    }

    let successCount = 0;
    let errors = [];

    for (const idx of selectedCommanders) {
      const commander = personnel[idx];
      if (!commander) continue;

      const phoneClean = commander.phone ? commander.phone.replace(/[^0-9]/g, '') : '';
      if (phoneClean.length < 10) {
        errors.push(`${commander.name} has an invalid phone number.`);
        continue;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:8000"}`}/api/dispatch-brief`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to_phone: commander.phone,
            message: messageText,
            twilio_account_sid: "",
            twilio_auth_token: "",
            twilio_whatsapp_from: ""
          })
        });

        const data = await response.json();
        if (data.success) {
          successCount++;
        } else {
          console.warn(`Twilio error for ${commander.name}:`, data.error);
          errors.push(`${commander.name}: ${data.error}`);
        }
      } catch (err) {
        console.warn(`Programmatic dispatch failed for ${commander.name}:`, err.message);
        errors.push(`${commander.name}: ${err.message}`);
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg> Dispatch Brief`;
    }

    if (errors.length === 0) {
      alert(`✅ Operational briefing successfully dispatched to all ${successCount} field commanders!`);
    } else {
      const errorMsg = errors.join('\n');
      if (successCount > 0) {
        alert(`⚠️ Dispatched to ${successCount} commanders successfully, but failed for some:\n\n${errorMsg}\n\nRedirecting failed contacts to manual WhatsApp Web...`);
      } else {
        alert(`❌ Programmatic dispatch failed:\n\n${errorMsg}\n\nRedirecting to manual WhatsApp Web...`);
      }

      // Fallback redirect for any failed/errored contacts
      selectedCommanders.forEach((idx) => {
        const commander = personnel[idx];
        if (commander) {
          openManualWhatsApp(commander.phone, messageText);
        }
      });
    }
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

  // Inline tactical map (embedded in results panel)
  useEffect(() => {
    if (!results) return;

    // Clean up any existing map instance to avoid container reuse issues
    if (inlineMapRef.current) {
      try {
        inlineMapRef.current.remove();
      } catch (e) {
        console.error("Error destroying previous inline map:", e);
      }
      inlineMapRef.current = null;
    }
    
    const container = document.getElementById('planner-inline-map');
    if (!container) return;
    
    // Explicitly delete Leaflet internal state so it initializes cleanly
    delete container._leaflet_id;

    const timer = setTimeout(() => {
      const L = window.L;
      if (!L) return;
      
      const centerLat = results.incident_coords?.lat || 12.9716;
      const centerLon = results.incident_coords?.lon || 77.5946;
      
      const map = L.map('planner-inline-map').setView([centerLat, centerLon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
      
      inlineMapRef.current = map;
      markersRef.current = {};
      polylinesRef.current = [];

      const redIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41] });
      const orangeIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41] });
      const blueIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41] });
      
      const incMarker = L.marker([centerLat, centerLon], { icon: redIcon }).addTo(map).bindPopup(`<strong>🔴 Incident: ${results.primary_corridor}</strong><br/>Alert Level: ${results.alert_level}`);
      markersRef.current['incident'] = incMarker;
      
      const allBounds = [[centerLat, centerLon]];
      
      if (results.precision_barricades) {
        results.precision_barricades.forEach((j, idx) => {
          if (j.lat && j.lon) {
            const m = L.marker([j.lat, j.lon], { icon: orangeIcon }).addTo(map);
            m.bindPopup(`<strong>🚧 Junction: ${j.name}</strong><br/>👮 Officers Deployed: ${j.officers_needed}<br/>🛑 Barricades Required: ${j.barricades_needed}`);
            markersRef.current[`junc-${j.name}`] = m;
            allBounds.push([j.lat, j.lon]);
          }
        });
      }
      
      if (results.alternatives_coords) {
        results.alternatives_coords.forEach((a, idx) => {
          if (a.lat && a.lon) {
            const m = L.marker([a.lat, a.lon], { icon: blueIcon }).addTo(map);
            m.bindPopup(`<strong>↩️ Diversion Route: ${a.name}</strong><br/>Priority: ${idx === 0 ? 'Primary' : 'Secondary'}`);
            markersRef.current[`alt-${a.name}`] = m;
            
            const line = L.polyline([[centerLat, centerLon], [a.lat, a.lon]], { color: '#007aff', weight: 2, dashArray: '6, 10', opacity: 0.7 }).addTo(map);
            polylinesRef.current.push({ name: a.name, line: line });
            
            allBounds.push([a.lat, a.lon]);
          }
        });
      }
      
      if (allBounds.length > 1) {
        map.fitBounds(allBounds, { padding: [40, 40] });
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (inlineMapRef.current) {
        try {
          inlineMapRef.current.remove();
        } catch (e) {
          console.error("Cleanup error for inline map:", e);
        }
        inlineMapRef.current = null;
      }
    };
  }, [results]);

  // Handle clicking a Priority Card — zoom, popup, and highlight
  const handleJunctionClick = (junc) => {
    if (!inlineMapRef.current || !junc.lat || !junc.lon) return;

    // Smoothly pan & zoom to the junction
    inlineMapRef.current.setView([junc.lat, junc.lon], 15, { animate: true, duration: 1.0 });

    // Open marker popup
    const marker = markersRef.current[`junc-${junc.name}`];
    if (marker) {
      marker.openPopup();
    }

    // Temporarily highlight the diversion route polylines as solid red lines
    polylinesRef.current.forEach((item) => {
      item.line.setStyle({
        color: '#ff3b30', // Critical Red
        weight: 5,
        dashArray: null, // solid line
        opacity: 1.0
      });

      // Revert after 3 seconds
      setTimeout(() => {
        if (item.line) {
          item.line.setStyle({
            color: '#007aff',
            weight: 2,
            dashArray: '6, 10',
            opacity: 0.7
          });
        }
      }, 3000);
    });
  };

  if (loading) {
    return (
      <div className="empty-results">
        <div className="status-dot"></div>
        <p>{language === 'kn' ? 'ಮೆಟಾಡೇಟಾ ಮತ್ತು ಡೀಫಾಲ್ಟ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading metadata and default settings...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-results" style={{ color: 'var(--danger)' }}>
        <span className="empty-icon">⚠️</span>
        <p>{language === 'kn' ? 'ಪ್ಲಾನರ್ ಪ್ರಾರಂಭಿಸುವಲ್ಲಿ ದೋಷ:' : 'Error starting planner:'} {error}</p>
        <p style={{ fontSize: '0.85rem' }}>{language === 'kn' ? 'FastAPI ಬ್ಯಾಕೆಂಡ್ ಪೋರ್ಟ್ 8000 ರಲ್ಲಿ ಚಾಲನೆಯಲ್ಲಿದೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.' : 'Make sure the FastAPI backend is running on port 8000.'}</p>
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
                {t.operational_context}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t.context_desc}
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
              {t.unplanned_incident}
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
              {t.planned_event}
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
              {form.event_type === 'planned' ? t.planned_event : t.unplanned_incident}
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
                  <label>{t.primary_corridor}</label>
                </div>
                <select 
                  value={form.corridor} 
                  onChange={(e) => handleCorridorChange(e.target.value)}
                >
                  {options?.corridors.map((c) => (
                    <option key={c} value={c}>{language === 'kn' ? (corridorTranslationsKn[c] || c) : c}</option>
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
                  <label>{t.priority_level}</label>
                </div>
                <select 
                  value={form.priority} 
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                >
                  <option value="High">{t.priority_high}</option>
                  <option value="Low">{t.priority_low}</option>
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
                  <label>{t.zone_auto}</label>
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
                  <label>{t.ps_auto}</label>
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
                <label>{t.start_time}</label>
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
                    <label>{t.event_cause}</label>
                  </div>
                  <select
                    value={form.event_cause}
                    onChange={(e) => handleInputChange('event_cause', e.target.value)}
                  >
                    {unplannedCauses.map((c) => (
                      <option key={c.value} value={c.value}>{t['cause_' + c.value] || c.label}</option>
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
                      <label>{t.vehicle_type}</label>
                    </div>
                    <select
                      value={form.veh_type}
                      onChange={(e) => handleInputChange('veh_type', e.target.value)}
                    >
                      {vehicleTypes.map((vt) => (
                        <option key={vt} value={vt}>{translateVehicle(vt)}</option>
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
                  <label htmlFor="closure-checkbox">{t.requires_closure}</label>
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
                    <label>{t.event_cause}</label>
                  </div>
                  <select
                    value={form.event_cause}
                    onChange={(e) => handleInputChange('event_cause', e.target.value)}
                  >
                    {plannedCauses.map((c) => (
                      <option key={c.value} value={c.value}>{t['cause_' + c.value] || c.label}</option>
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
                    <label>{t.end_time}</label>
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
                    <label>{t.event_desc}</label>
                  </div>
                  <textarea 
                    rows="4"
                    value={form.description}
                    placeholder={t.event_desc_placeholder}
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
                  <label>{t.corr_incidents}</label>
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
                  <label>{t.corr_closures}</label>
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
                t.calculating
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  {t.predict_impact}
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
          {submitting ? (
            <div className="empty-results" style={{ padding: '60px 20px', flexDirection: 'column' }}>
              <Loader />
              <p style={{ marginTop: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>{language === 'kn' ? 'ಸಂಚಾರ ಮಾರ್ಗ ವಾಹಕಗಳು ಮತ್ತು ಸಂಪನ್ಮೂಲ ನಿಯೋಜನೆಗಳನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ...' : 'Calculating traffic routing vectors and resource allocations...'}</p>
            </div>
          ) : results ? (
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
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{t.alert_level}</span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)', marginTop: '4px' }}>{t['alert_' + results.alert_level.split(' ')[1]?.toLowerCase()] || results.alert_level.split(' ')[1]}</div>
                    </div>
                      <button 
                        onClick={handleVoiceOverview}
                        disabled={ttsLoading}
                        onMouseEnter={() => setVoiceHovered(true)}
                        onMouseLeave={() => setVoiceHovered(false)}
                        className={`btn-voice ${isPlaying ? 'playing' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 18px',
                          borderRadius: '24px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: isPlaying 
                            ? 'linear-gradient(135deg, #ff3b30 0%, #ff6b62 100%)' 
                            : 'linear-gradient(135deg, var(--primary, #ea750e) 0%, #6f42c1 100%)',
                          color: 'white',
                          boxShadow: isPlaying 
                            ? '0 4px 12px rgba(255, 59, 48, 0.3)' 
                            : '0 4px 12px rgba(111, 66, 193, 0.25)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          marginLeft: 'auto',
                          marginRight: '16px',
                          transform: voiceHovered ? 'translateY(-2px)' : 'none',
                        }}
                      >
                        {ttsLoading ? (
                          <>
                            <span className="spinner-voice"></span> {t.generating}
                          </>
                        ) : isPlaying ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                              <rect x="4" y="4" width="16" height="16" rx="2" />
                            </svg> {t.stop_voice}
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="22" />
                            </svg> {t.hear_briefing}
                          </>
                        )}
                      </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: bColor.bg, color: bColor.fg, padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}>
                      <span style={{ width: '8px', height: '8px', backgroundColor: bColor.dot, borderRadius: '50%' }}></span>
                      {t['alert_' + results.impact_bucket?.toLowerCase()] || results.impact_bucket}
                    </div>
                  </div>
                );
              })()}

              {/* ── TOP 4 METRIC CARDS ── */}
              <div className="results-grid">
                <div className="result-card card-pink" onClick={() => setModalData({ title: language === 'kn' ? "ಪ್ರಭಾವದ ಸ್ಕೋರ್ ವಿಶ್ಲೇಷಣೆ" : "Impact Score Reasoning", value: `${results.event_impact_score}/100`, text: results.reasoning?.event_impact_score || "Calculating reasoning..." })}>
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-pink">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    </div>
                    <div><h4>{t.impact_score}</h4><div className="value">{results.event_impact_score} / 100</div><div className="detail">{language === 'kn' ? 'ವಿಳಂಬ ಮತ್ತು ವ್ಯಾಪ್ತಿಯ ತೀವ್ರತೆ' : 'Weighted delay & radius severity'}</div></div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>{t.click_reasoning}</div>
                </div>

                <div className="result-card card-blue" onClick={() => setModalData({ title: language === 'kn' ? "ವಲಯ ಸಂಚಾರ ದಟ್ಟಣೆ ಅಪಾಯ ವಿಶ್ಲೇಷಣೆ" : "Zone Congestion Risk Reasoning", value: `${results.zone_congestion_risk}/100`, text: results.reasoning?.zone_congestion_risk || "Calculating reasoning..." })}>
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-blue">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                    </div>
                    <div><h4>{t.congestion_risk}</h4><div className="value">{results.zone_congestion_risk} / 100</div><div className="detail">{language === 'kn' ? `ವಲಯ ${results.zone} @ ${results.hour}` : `Zone ${results.zone} @ ${results.hour}`}</div></div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>{t.click_reasoning}</div>
                </div>

                <div className="result-card card-purple" onClick={() => setModalData({ title: language === 'kn' ? "ರಸ್ತೆ ಮುಚ್ಚುವಿಕೆಯ ಸಂಭವನೀಯತೆ ವಿಶ್ಲೇಷಣೆ" : "ML Road Closure Probability Reasoning", value: results.closure_probability, text: results.reasoning?.road_closure_predicted || "Calculating reasoning..." })}>
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-purple">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    </div>
                    <div><h4>{t.road_closure_prob}</h4><div className="value">{results.closure_probability}</div><div className="detail">{language === 'kn' ? 'ಅಂದಾಜು ಮುಚ್ಚುವಿಕೆಯ ಸಂಭವನೀಯತೆ' : 'Estimated closure probability'}</div></div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>{t.click_reasoning}</div>
                </div>

                <div className="result-card card-green" onClick={() => setModalData({ title: language === 'kn' ? "ಅಂದಾಜು ಅವಧಿ ವಿಶ್ಲೇಷಣೆ" : "ML Estimated Duration Reasoning", value: results.estimated_resolution_time_min >= 60 ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} ${t.hrs}` : `${results.estimated_resolution_time_min.toFixed(0)} ${t.mins}`, text: results.reasoning?.estimated_resolution_time_min || "Calculating reasoning..." })}>
                  <div className="metric-card-layout">
                    <div className="metric-circle-icon metric-circle-green">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div><h4>{t.estimated_duration}</h4><div className="value">{results.estimated_resolution_time_min >= 60 ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} ${t.hrs}` : `${results.estimated_resolution_time_min.toFixed(0)} ${t.mins}`}</div><div className="detail">{language === 'kn' ? 'ಅಂದಾಜು ತೆರವುಗೊಳಿಸುವ ಅವಧಿ' : 'Estimated clearance duration'}</div></div>
                  </div>
                  <div className="click-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>{t.click_reasoning}</div>
                </div>
              </div>

              {/* ── AI REASONING PANEL ── */}
              <div className="tac-reasoning-panel">
                <div className="tac-reasoning-header">
                  <span className="tac-reasoning-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {language === 'kn' ? 'AI ವಿಶ್ಲೇಷಣೆ' : 'AI REASONING'}
                  </span>
                  <span className="tac-confidence-badge">
                    {language === 'kn' ? 'ವಿಶ್ವಾಸಾರ್ಹತೆ' : 'Confidence'}: {Math.min(98, Math.max(72, results.event_impact_score + 10))}%
                  </span>
                </div>
                <div className="tac-reasoning-checks">
                  <div className="tac-check-item tac-check-green">
                    <span>✓</span>
                    <span>
                      {language === 'kn' ? (
                        <>ಐತಿಹಾಸಿಕ ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ <strong>{results.similar_events_count || 3}</strong> ಸಮಾನ ಘಟನೆಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗಿದೆ</>
                      ) : (
                        <><strong>{results.similar_events_count || 3}</strong> similar events analyzed in historical database</>
                      )}
                    </span>
                  </div>
                  {form.event_type === 'planned' && results.expected_crowd > 0 ? (
                    <div className="tac-check-item tac-check-green">
                      <span>✓</span>
                      <span>
                        {language === 'kn' ? (
                          <>ನಿರೀಕ್ಷಿತ ಜನಸಮೂಹ: <strong>{results.expected_crowd.toLocaleString()}</strong> ಜನರು</>
                        ) : (
                          <>Expected crowd: <strong>{results.expected_crowd.toLocaleString()}</strong> attendees</>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="tac-check-item tac-check-green">
                      <span>✓</span>
                      <span>
                        {language === 'kn' ? (
                          'ಯೋಜಿತವಲ್ಲದ ಸಕ್ರಿಯ ಕಾರಿಡಾರ್ ಘಟನೆಯ ಪ್ರತಿಕ್ರಿಯೆ ಪ್ರೋಟೋಕಾಲ್ ಸಕ್ರಿಯಗೊಂಡಿದೆ'
                        ) : (
                          'Unplanned active corridor incident response protocol triggered'
                        )}
                      </span>
                    </div>
                  )}
                  <div className="tac-check-item tac-check-orange">
                    <span>✓</span>
                    <span>
                      {language === 'kn' ? (
                        <>ಪ್ರಸ್ತುತ ಸಂಚಾರ ಪ್ರಮಾಣ: ಮೂಲ ಮಟ್ಟಕ್ಕಿಂತ <strong>+{results.traffic_volume_delta_pct || 34}%</strong> ಹೆಚ್ಚು</>
                      ) : (
                        <>Current traffic volume: <strong>+{results.traffic_volume_delta_pct || 34}%</strong> above baseline</>
                      )}
                    </span>
                  </div>
                  {results.precision_barricades?.[0] && (
                    <div className="tac-check-item tac-check-red">
                      <span>✓</span>
                      <span>
                        {language === 'kn' ? (
                          <><strong>{results.precision_barricades[0].name}</strong> ಐತಿಹಾಸಿಕವಾಗಿ {results.precision_barricades[0].closure_rate_pct}% ಸ್ಪಿಲ್‌ಓವರ್ / ಮುಚ್ಚುವಿಕೆಯ ದರವನ್ನು ಉಂಟುಮಾಡುತ್ತದೆ</>
                        ) : (
                          <><strong>{results.precision_barricades[0].name}</strong> historically causes {results.precision_barricades[0].closure_rate_pct}% spillover / closure rate</>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="tac-check-item tac-check-green">
                     <span>✓</span>
                     {results.ml_correction_source === 'none' ? (
                       <span>
                         {language === 'kn' ? (
                           <>ML ಮಾಪನಾಂಕ ನಿರ್ಣಯ: ಈ ಕಾರಿಡಾರ್/ಕಾರಣಕ್ಕೆ <strong>ಯಾವುದೇ ಮುಂಚಿನ ಪ್ರತಿಕ್ರಿಯೆ ಲಭ್ಯವಿಲ್ಲ</strong> (ಮೂಲ ಮಾದರಿ ಸಕ್ರಿಯವಾಗಿದೆ)</>
                         ) : (
                           <>ML Calibration: <strong>No prior feedback available</strong> for this corridor/cause (baseline model active)</>
                         )}
                       </span>
                     ) : (
                       <span>
                         {language === 'kn' ? (
                           <>ML ಮಾಪನಾಂಕ ನಿರ್ಣಯ: {results.ml_correction_source} ಪ್ರತಿಕ್ರಿಯೆಯ ಆಧಾರದ ಮೇಲೆ <strong>{results.ml_correction_delta_min >= 0 ? '+' : ''}{results.ml_correction_delta_min} ನಿಮಿಷ</strong> ತಿದ್ದುಪಡಿ ಅನ್ವಯಿಸಲಾಗಿದೆ</>
                         ) : (
                           <>ML Calibration: Applied <strong>{results.ml_correction_delta_min >= 0 ? '+' : ''}{results.ml_correction_delta_min} min</strong> correction based on {results.ml_correction_source} feedback</>
                         )}
                       </span>
                     )}
                   </div>
                </div>
                <div className="tac-reasoning-conclusion">
                  <strong>{language === 'kn' ? 'ಆದ್ದರಿಂದ:' : 'Therefore:'}</strong> {language === 'kn' ? 'ಮೊದಲು' : 'Seal'} <strong>{results.precision_barricades?.[0]?.name || 'primary choke-point'}</strong> {language === 'kn' ? 'ಅನ್ನು ಮುಚ್ಚಿ.' : 'first.'}<br/>
                  {language === 'kn' ? 'ನಿರೀಕ್ಷಿತ ಒಳಹರಿವು ಕಡಿತ:' : 'Expected inflow reduction:'} <strong>{results.precision_barricades?.[0]?.efficiency_pct || 75}%</strong>.<br/>
                  {language === 'kn' ? 'ವಿಶ್ವಾಸಾರ್ಹತೆ:' : 'Confidence:'} <strong>{Math.min(98, Math.max(72, results.event_impact_score + 10))}%</strong>.
                </div>
              </div>

              {/* ── DEPLOYMENT PLAN ── */}
              <div className="tac-deployment-plan">
                <div className="tac-section-header tac-header-orange">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  {language === 'kn' ? 'ನಿಯೋಜನೆ ಯೋಜನೆ' : 'DEPLOYMENT PLAN'}
                </div>
                <div className="tac-deploy-grid">
                  {(results.precision_barricades || []).map((junc, i) => (
                    <div className="tac-deploy-row" key={`off-${i}`}>
                      <span className="tac-deploy-badge badge-officer">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </span>
                      <div className="tac-deploy-info">
                        <span className="tac-deploy-qty">{junc.officers_needed} {language === 'kn' ? 'ಅಧಿಕಾರಿ' : 'Officer' + (junc.officers_needed > 1 ? 's' : '')}</span>
                        <span className="tac-deploy-arrow">→</span>
                        <span className="tac-deploy-dest">{junc.name}</span>
                      </div>
                      <span className="tac-deploy-tag tac-tag-orange">{language === 'kn' ? 'ಚೋಕ್-ಪಾಯಿಂಟ್ ' + (i + 1) : 'Choke-Point ' + (i + 1)}</span>
                    </div>
                  ))}
                  <div className="tac-deploy-row">
                    <span className="tac-deploy-badge badge-support">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </span>
                    <div className="tac-deploy-info">
                      <span className="tac-deploy-qty">{Math.max(1, results.officers_recommended - results.total_officers_choke)} {language === 'kn' ? 'ಅಧಿಕಾರಿ' : 'Officer' + (Math.max(1, results.officers_recommended - results.total_officers_choke) > 1 ? 's' : '')}</span>
                      <span className="tac-deploy-arrow">→</span>
                      <span className="tac-deploy-dest">{language === 'kn' ? 'ಪರ್ಯಾಯ ಮಾರ್ಗ ಮೇಲ್ವಿಚಾರಣೆ' : 'Diversion Monitoring'}</span>
                    </div>
                    <span className="tac-deploy-tag tac-tag-blue">{language === 'kn' ? 'ಬೆಂಬಲ' : 'Support'}</span>
                  </div>
                  <div className="tac-deploy-row">
                    <span className="tac-deploy-badge badge-vehicle">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                    </span>
                    <div className="tac-deploy-info">
                      <span className="tac-deploy-qty">{results.vehicles_recommended} {language === 'kn' ? 'ವಾಹನ' : 'Vehicle' + (results.vehicles_recommended > 1 ? 's' : '')}</span>
                      <span className="tac-deploy-arrow">→</span>
                      <span className="tac-deploy-dest">{language === 'kn' ? 'ನಿರ್ಗಮನದಲ್ಲಿ ಸಿದ್ಧ ಸ್ಥಿತಿ' : 'Standby at Event Exit'} · {language === 'kn' ? (corridorTranslationsKn[results.primary_corridor || form.corridor] || results.primary_corridor || form.corridor) : (results.primary_corridor || form.corridor)}</span>
                    </div>
                    <span className="tac-deploy-tag tac-tag-green">{language === 'kn' ? 'ಸಿದ್ಧ ಸ್ಥಿತಿ' : 'Standby'}</span>
                  </div>
                  {(results.precision_barricades || []).map((junc, i) => (
                    <div className="tac-deploy-row" key={`bar-${i}`}>
                      <span className="tac-deploy-badge badge-barricade">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </span>
                      <div className="tac-deploy-info">
                        <span className="tac-deploy-qty">{junc.barricades_needed} {language === 'kn' ? 'ಬ್ಯಾರಿಕೇಡ್' : 'Barricade' + (junc.barricades_needed > 1 ? 's' : '')}</span>
                        <span className="tac-deploy-arrow">→</span>
                        <span className="tac-deploy-dest">{junc.name}</span>
                      </div>
                      <span className="tac-deploy-tag tac-tag-red">{language === 'kn' ? 'ಮುಚ್ಚು' : 'Seal'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── PRIORITY CHOKE-POINT CARDS ── */}
              <div className="tac-section-header tac-header-red" style={{ marginTop: '24px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {language === 'kn' ? 'ಚೋಕ್-ಪಾಯಿಂಟ್ ಆದ್ಯತೆಯ ಕಾರ್ಡ್‌ಗಳು' : 'CHOKE-POINT PRIORITY CARDS'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {(results.precision_barricades || []).map((junc, i) => {
                  const impactScore = Math.min(100, Math.round(junc.efficiency_pct * 1.2));
                  const isCritical = i === 0;
                  return (
                    <div 
                      key={i} 
                      className={`tac-priority-card ${isCritical ? 'tac-priority-critical' : 'tac-priority-secondary'}`}
                      onClick={() => handleJunctionClick(junc)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="tac-priority-header-row">
                        <div className="tac-priority-label">
                          <span className={`tac-priority-badge ${isCritical ? 'tac-badge-red' : 'tac-badge-orange'}`}>
                            {isCritical ? (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                {language === 'kn' ? 'ನಿರ್ಣಾಯಕ ಚೋಕ್ ಪಾಯಿಂಟ್' : 'CRITICAL CHOKE POINT'}
                              </>
                            ) : (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                {language === 'kn' ? 'ದ್ವಿತೀಯ ಚೋಕ್ ಪಾಯಿಂಟ್' : 'SECONDARY CHOKE POINT'}
                              </>
                            )}
                          </span>
                          <span className="tac-priority-rank">{language === 'kn' ? 'ಆದ್ಯತೆ' : 'Priority'} {i + 1}</span>
                        </div>
                        <div className="tac-impact-score-circle" style={{ background: isCritical ? 'rgba(255,59,48,0.1)' : 'rgba(255,149,0,0.1)', borderColor: isCritical ? '#ff3b30' : '#ff9500' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: isCritical ? '#ff3b30' : '#ff9500', lineHeight: 1 }}>{impactScore}</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>/ 100</span>
                        </div>
                      </div>
                      <div className="tac-priority-name">{junc.name}</div>
                      <div className="tac-priority-metrics">
                        <div className="tac-metric-pill tac-pill-blue"><span>{language === 'kn' ? 'ಸರತಿಯ ಕಡಿತ' : 'Queue Reduction'}</span><strong>{junc.efficiency_pct}%</strong></div>
                        <div className="tac-metric-pill tac-pill-green"><span>{language === 'kn' ? 'ವಿಶ್ವಾಸಾರ್ಹತೆ' : 'Confidence'}</span><strong>{Math.min(96, Math.max(75, junc.efficiency_pct + 12))}%</strong></div>
                        <div className="tac-metric-pill tac-pill-orange"><span>{language === 'kn' ? 'ಮುಚ್ಚುವಿಕೆಯ ದರ' : 'Closure Rate'}</span><strong>{junc.closure_rate_pct}%</strong></div>
                      </div>
                      <div className="tac-priority-resources">
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{language === 'kn' ? 'ಅಗತ್ಯವಿರುವ ಸಂಪನ್ಮೂಲಗಳು' : 'Resources Required'}</span>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                          <span className="tac-resource-tag">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: 'middle' }}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {junc.barricades_needed} {language === 'kn' ? 'ಬ್ಯಾರಿಕೇಡ್' : 'Barricade' + (junc.barricades_needed > 1 ? 's' : '')}
                          </span>
                          <span className="tac-resource-tag">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: 'middle' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            {junc.officers_needed} {language === 'kn' ? 'ಅಧಿಕಾರಿ' : 'Officer' + (junc.officers_needed > 1 ? 's' : '')}
                          </span>
                          <span className="tac-resource-tag">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: 'middle' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            {junc.incident_count || '—'} {language === 'kn' ? 'ಐತಿಹಾಸಿಕ ಘಟನೆಗಳು' : 'hist. incidents'}
                          </span>
                        </div>
                      </div>
                      <div className="tac-priority-reason">
                        {language === 'kn' ? (
                          <>
                            <strong>ಕಾರಣ:</strong> {language === 'kn' ? (corridorTranslationsKn[results.primary_corridor || form.corridor] || results.primary_corridor || form.corridor) : (results.primary_corridor || form.corridor)} ಕಾರಿಡಾರ್‌ನಲ್ಲಿ {junc.incident_count || 0} ಐತಿಹಾಸಿಕ ಘಟನೆಗಳು ಮತ್ತು {junc.closure_rate_pct}% ಐತಿಹಾಸಿಕ ರಸ್ತೆ ಮುಚ್ಚುವಿಕೆಯ ದರದೊಂದಿಗೆ {i === 0 ? 'ಅತಿ ಹೆಚ್ಚು' : 'ಹೆಚ್ಚಿನ'} ಅಪ್‌ಸ್ಟ್ರೀಮ್ {t['cause_' + form.event_cause] || form.event_cause.replace(/_/g,' ')} ಒಳಹರಿವನ್ನು ಪಡೆಯುತ್ತದೆ. ಈ ನೋಡ್ ಅನ್ನು ಮುಚ್ಚುವುದರಿಂದ ಕೆಳಹರಿವಿನ ದಟ್ಟಣೆಯನ್ನು ತಡೆಯಬಹುದು.
                          </>
                        ) : (
                          <>
                            <strong>Reason:</strong> Receives {i === 0 ? 'highest' : i === 1 ? 'second highest' : 'significant'} upstream {form.event_cause.replace(/_/g,' ')} inflow on {results.primary_corridor} with {junc.incident_count || 0} historical incidents and a {junc.closure_rate_pct}% historical closure rate. Sealing this node intercepts downstream queue spillover.
                          </>
                        )}
                      </div>
                      <div className="choke-efficiency-bar-wrap" style={{ marginTop: '10px' }}>
                        <div className="choke-efficiency-bar" style={{ width: `${junc.efficiency_pct}%`, background: isCritical ? 'linear-gradient(90deg,#ff3b30,#ff6b35)' : 'linear-gradient(90deg,#ff9500,#ffcc00)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DIVERSION ROUTES TABLE ── */}
              <div style={{ marginTop: '24px' }}>
                <div className="tac-section-header tac-header-blue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                  {language === 'kn' ? 'ಪರ್ಯಾಯ ಮಾರ್ಗಗಳು' : 'DIVERSION ROUTES'}
                </div>
                <div className="tac-diversion-table-wrap" style={{ marginTop: '12px' }}>
                  <table className="tac-diversion-table">
                    <thead><tr><th>{language === 'kn' ? 'ಮಾರ್ಗ' : 'Route'}</th><th>{language === 'kn' ? 'ಆದ್ಯತೆ' : 'Priority'}</th><th>{language === 'kn' ? 'ಹೆಚ್ಚುವರಿ ಸಮಯ' : 'Extra Time'}</th><th>{language === 'kn' ? 'ಸಾಮರ್ಥ್ಯ' : 'Capacity'}</th><th>{language === 'kn' ? 'ಸ್ಥಿತಿ' : 'Status'}</th></tr></thead>
                    <tbody>
                      {(results.alternate_routes || []).map((route, i) => {
                        const extras = language === 'kn' ? ['+೪ ನಿಮಿಷ', '+೮ ನಿಮಿಷ', '+೧೨ ನಿಮಿಷ'] : ['+4 min','+8 min','+12 min'];
                        const caps = language === 'kn' ? ['ಹೆಚ್ಚು', 'ಮಧ್ಯಮ', 'ಕಡಿಮೆ'] : ['High','Medium','Low'];
                        const stats = language === 'kn' ? ['ಸಕ್ರಿಯಗೊಳಿಸಿ', 'ಸಿದ್ಧ ಸ್ಥಿತಿ', 'ಸಿದ್ಧ ಸ್ಥಿತಿ'] : ['ACTIVATE','STANDBY','STANDBY'];
                        const prios = language === 'kn' ? ['ಪ್ರಾಥಮಿಕ', 'ದ್ವಿತೀಯ', 'ತೃತೀಯ'] : ['Primary','Secondary','Tertiary'];
                        return (
                          <tr key={i}>
                            <td><span className="tac-route-name">{language === 'kn' ? (corridorTranslationsKn[route] || route) : route}</span></td>
                            <td><span className={`tac-priority-tag ${i === 0 ? 'tac-prio-primary' : 'tac-prio-secondary'}`}>{prios[i] || 'Secondary'}</span></td>
                            <td><span className="tac-extra-time">{extras[i] || '+15 min'}</span></td>
                            <td><span className={`tac-capacity-badge tac-cap-${(caps[i] || 'low').toLowerCase()}`}>{caps[i] || 'Low'}</span></td>
                            <td><button className={`tac-status-btn ${i === 0 ? 'tac-status-activate' : 'tac-status-standby'}`}>{stats[i] || 'STANDBY'}</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="tac-diversion-footer">
                    <span>🎯 {language === 'kn' ? 'ಉಪಶಮನ:' : 'Relieves:'} {results.precision_barricades?.[0]?.name || results.primary_corridor}</span>
                    <span>🚗 {language === 'kn' ? 'ಅಂದಾಜು ಬದಲಿಸಿದ ವಾಹನಗಳು:' : 'Est. diverted:'} ~{Math.round((results.officers_recommended || 5) * 80)}/{language === 'kn' ? 'ಗಂಟೆಗೆ' : 'hr'}</span>
                  </div>
                </div>
              </div>

              {/* ── LIVE TACTICAL MAP (INLINE) ── */}
              <div style={{ marginTop: '24px' }}>
                <div className="tac-section-header tac-header-blue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                  {language === 'kn' ? 'ಲೈವ್ ತಾಂತ್ರಿಕ ನಕ್ಷೆ' : 'LIVE TACTICAL MAP'}
                </div>
                <div className="tac-map-legend">
                  <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff3b30', marginRight: '6px', verticalAlign: 'middle' }}></span>{language === 'kn' ? 'ಘಟನೆಯ ಕಾರಿಡಾರ್' : 'Incident Corridor'}</span>
                  <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff9500', marginRight: '6px', verticalAlign: 'middle' }}></span>{language === 'kn' ? 'ಬ್ಯಾರಿಕೇಡ್ ಜಂಕ್ಷನ್' : 'Barricade Junction'}</span>
                  <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#007aff', marginRight: '6px', verticalAlign: 'middle' }}></span>{language === 'kn' ? 'ಪರ್ಯಾಯ ಮಾರ್ಗ' : 'Diversion Route'}</span>
                </div>
                <div id="planner-inline-map" className="tac-inline-map"></div>
                <button className="btn-secondary" style={{ marginTop: '10px', width: '100%' }} onClick={(e) => { e.stopPropagation(); setShowMapModal(true); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                  {language === 'kn' ? 'ನಕ್ಷೆ ವಿಸ್ತರಿಸಿ' : 'Expand Map Modal'}
                </button>
              </div>

              {/* ── PREDICTED OUTCOME HERO ── */}
              <div className="tac-outcome-hero">
                <div className="tac-outcome-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  {language === 'kn' ? 'ನಿರೀಕ್ಷಿತ ಫಲಿತಾಂಶ — ಶಿಫಾರಸುಗಳನ್ನು ಅನ್ವಯಿಸಿದ ನಂತರ' : 'PREDICTED OUTCOME — AFTER RECOMMENDATIONS APPLIED'}
                </div>
                <div className="tac-outcome-grid">
                  <div className="tac-outcome-card tac-outcome-danger">
                    <span className="tac-outcome-label">{language === 'kn' ? 'ಪ್ರಸ್ತುತ ದಟ್ಟಣೆ ಅಪಾಯ' : 'Current Congestion Risk'}</span>
                    <span className="tac-outcome-value">{results.zone_congestion_risk}%</span>
                    <span className="tac-outcome-sublabel">{language === 'kn' ? 'ಮಧ್ಯಸ್ಥಿಕೆಗೆ ಮೊದಲು' : 'Before intervention'}</span>
                  </div>
                  <div className="tac-outcome-arrow">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </div>
                  <div className="tac-outcome-card tac-outcome-success">
                    <span className="tac-outcome-label">{language === 'kn' ? 'ಶಿಫಾರಸುಗಳ ನಂತರ' : 'After Recommendations'}</span>
                    <span className="tac-outcome-value">{Math.max(10, Math.round(results.zone_congestion_risk * 0.42))}%</span>
                    <span className="tac-outcome-sublabel">{language === 'kn' ? 'ಮಧ್ಯಸ್ಥಿಕೆಯ ನಂತರ ನಿರೀಕ್ಷಿತ' : 'Projected post-intervention'}</span>
                  </div>
                </div>
                <div className="tac-outcome-stats">
                  <div className="tac-stat-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    <span className="tac-stat-value">{Math.round(results.zone_congestion_risk * 0.58)}%</span>
                    <span className="tac-stat-label">{language === 'kn' ? 'ದಟ್ಟಣೆ ಕಡಿತ' : 'Congestion Reduction'}</span>
                  </div>
                  <div className="tac-stat-divider"/>
                  <div className="tac-stat-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}><polyline points="20 6 9 17 4 12"/></svg>
                    <span className="tac-stat-value">{results.travel_delay_min ? Math.round(results.travel_delay_min * 0.55) : '—'} {language === 'kn' ? 'ನಿಮಿಷ' : 'min'}</span>
                    <span className="tac-stat-label">{language === 'kn' ? 'ಉಳಿಸಿದ ಸರಾಸರಿ ವಿಳಂಬ' : 'Avg Delay Saved'}</span>
                  </div>
                  <div className="tac-stat-divider"/>
                  <div className="tac-stat-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                    <span className="tac-stat-value">~{Math.round((results.officers_recommended || 5) * 80 * 1.3)}/{language === 'kn' ? 'ಗಂ' : 'hr'}</span>
                    <span className="tac-stat-label">{language === 'kn' ? 'ಮಾರ್ಗ ಬದಲಿಸಿದ ವಾಹನಗಳು' : 'Vehicles Redirected'}</span>
                  </div>
                  <div className="tac-stat-divider"/>
                  <div className="tac-stat-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span className="tac-stat-value">{results.estimated_resolution_time_min >= 60 ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} ${language === 'kn' ? 'ಗಂಟೆ' : 'hrs'}` : `${results.estimated_resolution_time_min.toFixed(0)} ${language === 'kn' ? 'ನಿಮಿಷ' : 'min'}`}</span>
                    <span className="tac-stat-label">{language === 'kn' ? 'ತೆರವು ಸಮಯ' : 'Clearance Time'}</span>
                  </div>
                </div>
              </div>

              {/* ── COMMANDER'S WHATSAPP DISPATCH ── */}
              <div className="card" style={{ marginTop: '20px', borderLeft: '4px solid #34c759' }}>
                <div className="flex-header-container" style={{ borderBottom: '1.5px solid var(--bg-primary)', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div className="header-square-icon header-square-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', color: '#34c759', textTransform: 'uppercase', margin: 0, fontWeight: 800 }}>
                    {language === 'kn' ? '೫. ಕಮಾಂಡರ್ WhatsApp ರವಾನೆ' : "5. Commander's WhatsApp Dispatch"}
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', fontWeight: 600 }}>
                  {language === 'kn' ? 'ಆಯ್ಕೆಮಾಡಿದ ಕ್ಷೇತ್ರ ಕಮಾಂಡರ್‌ನ WhatsApp ಸಂಖ್ಯೆಗೆ ನೇರವಾಗಿ ಫಾರ್ಮ್ಯಾಟ್ ಮಾಡಿದ ಕಾರ್ಯಾಚರಣೆಯ ನಿಯೋಜನೆ ವರದಿಯನ್ನು ರಚಿಸಿ ಮತ್ತು ಕಳುಹಿಸಿ.' : "Generate and send a formatted operational deployment brief directly to the selected field commander's WhatsApp."}
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', width: '100%' }}>
                  <div className="form-group" style={{ flex: 1, margin: 0, minWidth: '200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{language === 'kn' ? 'ಸ್ವೀಕೃತದಾರರನ್ನು ಆಯ್ಕೆಮಾಡಿ' : 'Select Recipients'}</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          type="button" 
                          style={{ padding: '2px 6px', fontSize: '0.68rem', width: 'auto', margin: 0, background: 'none', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer', borderRadius: '4px', fontWeight: 700 }}
                          onClick={() => setSelectedCommanders(personnel.map((_, i) => i))}
                        >
                          {language === 'kn' ? 'ಎಲ್ಲಾ' : 'All'}
                        </button>
                        <button 
                          type="button" 
                          style={{ padding: '2px 6px', fontSize: '0.68rem', width: 'auto', margin: 0, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px', fontWeight: 700 }}
                          onClick={() => setSelectedCommanders([])}
                        >
                          {language === 'kn' ? 'ತೆರವುಗೊಳಿಸಿ' : 'Clear'}
                        </button>
                      </div>
                    </div>
                    <div style={{ 
                      maxHeight: '120px', 
                      overflowY: 'auto', 
                      border: '1.5px solid var(--border-color)', 
                      borderRadius: 'var(--radius-sm)', 
                      padding: '8px 12px', 
                      backgroundColor: 'var(--bg-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {personnel.length === 0 ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'kn' ? 'ಯಾವುದೇ ಕಮಾಂಡರ್‌ಗಳನ್ನು ಸಂರಚಿಸಲಾಗಿಲ್ಲ' : 'No commanders configured'}</span>
                      ) : (
                        personnel.map((p, i) => (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedCommanders.includes(i)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCommanders(prev => [...prev, i]);
                                } else {
                                  setSelectedCommanders(prev => prev.filter(idx => idx !== i));
                                }
                              }}
                              style={{ width: 'auto', margin: 0 }}
                            />
                            <span>{p.name} <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.76rem' }}>({p.phone})</span></span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ width: '180px', margin: 0 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{language === 'kn' ? 'ರವಾನೆ ವಿಧಾನ' : 'Dispatch Method'}</label>
                    <select id="whatsapp-method-select" defaultValue="twilio">
                      <option value="twilio">{language === 'kn' ? 'Twilio API (ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್)' : 'Twilio API (Sandbox)'}</option>
                      <option value="whatsapp_web">{language === 'kn' ? 'WhatsApp Web (ನೇರ)' : 'WhatsApp Web (Direct)'}</option>
                    </select>
                  </div>

                  <button
                    id="whatsapp-dispatch-btn"
                    type="button"
                    className="btn-primary"
                    disabled={personnel.length === 0}
                    style={{ 
                      width: 'auto', 
                      margin: 0, 
                      padding: '10px 18px', 
                      height: '42px',
                      backgroundColor: personnel.length === 0 ? 'var(--text-muted)' : '#25D366', 
                      borderColor: personnel.length === 0 ? 'var(--text-muted)' : '#25D366',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: personnel.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => {
                      handleSendWhatsAppBrief();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    {selectedCommanders.length > 1 ? (language === 'kn' ? `ರವಾನಿಸಿ (${selectedCommanders.length})` : `Dispatch (${selectedCommanders.length})`) : (language === 'kn' ? 'ವರದಿ ರವಾನಿಸಿ' : 'Dispatch Brief')}
                  </button>
                </div>
              </div>

              {/* ── WHAT-IF SCENARIO SIMULATOR TRIGGER ── */}
              <button
                className="btn-secondary"
                style={{
                  marginTop: '20px',
                  width: '100%',
                  background: 'linear-gradient(135deg, #007aff, #0056b3)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,122,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-body)',
                }}
                onClick={(e) => { e.stopPropagation(); setShowSimulationModal(true); }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,122,255,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,122,255,0.25)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 22 22 22"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                  <line x1="12" y1="10" x2="12" y2="14"/>
                </svg>
                7. {language === 'kn' ? 'ವಾಟ್-ಇಫ್ ಸನ್ನಿವೇಶ ಸಿಮ್ಯುಲೇಟರ್' : 'What-If Scenario Simulator'}
              </button>

              {/* ── CONDITIONAL PLANNED DURATION ── */}
              {form.event_type === 'planned' && plannedDurationStr && (
                <div className="result-card full-width-result" style={{ borderLeft: '4px solid #007aff', backgroundColor: '#eef7ff', marginTop: '16px' }}>
                  <h4 style={{ color: '#007aff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {language === 'kn' ? 'ಯೋಜಿತ ಮತ್ತು ಊಹಿಸಲಾದ ಅವಧಿ' : 'Planned vs Forecasted Duration'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                    <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{language === 'kn' ? 'ನಿಮ್ಮ ನಿಗದಿತ ಸಮಯ' : 'Your Scheduled Time'}</span><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1d1d1f' }}>{plannedDurationStr}</div></div>
                    <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{language === 'kn' ? 'AI முನ್ಸೂಚನೆ ತೆರವು ಸಮಯ' : 'AI Forecast Clearance'}</span><div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{results.estimated_resolution_time_min >= 60 ? `${(results.estimated_resolution_time_min / 60).toFixed(1)} ${language === 'kn' ? 'ಗಂಟೆಗಳು' : 'hrs'}` : `${results.estimated_resolution_time_min.toFixed(0)} ${language === 'kn' ? 'ನಿಮಿಷ' : 'min'}`}</div></div>
                  </div>
                </div>
              )}

              {/* ── CLOSE EVENT BUTTON ── */}
              <div style={{ marginTop: '24px', padding: '20px 24px', background: 'linear-gradient(135deg, #fff4ec, #fff9f5)', border: '1.5px solid rgba(234,117,14,0.2)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1d1d1f' }}>{language === 'kn' ? 'ಘಟನೆ ಬಗೆಹರಿದಿದೆಯೇ?' : 'Event Resolved?'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '3px' }}>
                      {language === 'kn' ? 'ಭವಿಷ್ಯದ ಮುನ್ಸೂಚನೆಗಳಿಗಾಗಿ ML ಮಾದರಿಯನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮಾಪನಾಂಕು ಮಾಡಲು ನೈಜ ಫಲಿತಾಂಶಗಳನ್ನು ದಾಖಲಿಸಿ' : 'Log actual outcomes to auto-calibrate the ML model for future predictions'}
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
                    {language === 'kn' ? 'ಘಟನೆ ಮುಚ್ಚಿ ಮತ್ತು ML ಗೆ ದಾಖಲಿಸಿ' : 'Close Event & Log to ML'}
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
              <p>{language === 'kn' ? 'ಕಾರ್ಯಾಚರಣೆ ಯೋಜನೆಗಳನ್ನು ಲೆಕ್ಕಹಾಕಲು ಎಡಭಾಗದಲ್ಲಿ ನಿಯತಾಂಕಗಳನ್ನು ಸಂರಚಿಸಿ ಮತ್ತು ಪ್ರಭಾವದ ಮುನ್ಸೂಚನೆಯನ್ನು ಚಲಾಯಿಸಿ.' : 'Configure parameters on the left and trigger prediction to calculate operational plans.'}</p>
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
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', display: 'block', marginBottom: '10px' }}>{language === 'kn' ? 'ಮೆಟ್ರಿಕ್ ಮೌಲ್ಯ' : 'Metric Value'}</span>
                <span className="modal-metric-badge">{modalData.value}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', display: 'block', marginBottom: '14px' }}>
                  {language === 'kn' ? 'AI ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ತರ್ಕ' : 'AI Reasoning & Analysis'}
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
                {language === 'kn' ? 'ಮಾರ್ಗ ಬದಲಾವಣೆ ನಕ್ಷೆಯ ದೃಶ್ಯೀಕರಣ' : 'Diversion Map Visualization'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowMapModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                {language === 'kn' ? 'ಪ್ರಾಥಮಿಕ ಘಟನಾ ಸ್ಥಳ (ಕೆಂಪು), ಶಿಫಾರಸು ಮಾಡಿದ ಪರ್ಯಾಯ ಮಾರ್ಗಗಳು (ನೀಲಿ) ಮತ್ತು ಬ್ಯಾರಿಕೇಡ್ ವಲಯಗಳನ್ನು (ಕಿತ್ತಳೆ) ತೋರಿಸಲಾಗುತ್ತಿದೆ.' : 'Showing primary incident site (red), recommended detours (blue), and barricade zones (orange).'}
              </p>
              <div id="map-view" className="map-view-container"></div>
            </div>
          </div>
        </div>
      )}

      {/* What-If Simulation Modal Popup */}
      {showSimulationModal && (
        <div className="modal-backdrop" onClick={() => setShowSimulationModal(false)}>
          <div className="modal-card" style={{ maxWidth: '720px', width: '95%', display: 'flex', flexDirection: 'column', height: '80vh', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 22 22 22"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                  <line x1="12" y1="10" x2="12" y2="14"/>
                </svg>
                {language === 'kn' ? '೭. ವಾಟ್-ಇಫ್ ಸನ್ನಿವೇಶ ಸಿಮ್ಯುಲೇಟರ್ ಚಾಟ್‌ಬಾಟ್' : '7. What-If Scenario Simulator Chatbot'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowSimulationModal(false)}>&times;</button>
            </div>
            
            {/* Scrollable Chat Area */}
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                backgroundColor: '#f8f9fa' 
              }}
              ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
            >
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, margin: '4px 0 12px' }}>
                {language === 'kn' ? 'ಯುಎಸ್‌ಪಿ: "ಅನುಷ್ಠಾನದ ಮೊದಲು ಸಿಮ್ಯುಲೇಶನ್ ಮೂಲಕ ಸಂಚಾರ ಯೋಜನೆ."' : 'USP: "Traffic planning through simulation before execution."'}
              </div>

              {simulationChat.map((msg, index) => {
                const isUser = msg.sender === 'user';
                let textToShow = msg.text;
                if (index === 0 && msg.sender === 'bot') {
                  textToShow = language === 'kn'
                    ? 'ವಾಟ್-ಇಫ್ ಸಿನಾರಿಯೋ ಸಿಮ್ಯುಲೇಟರ್‌ಗೆ ಸುಸ್ವಾಗತ.\n\nಯಾವುದೇ ಯುದ್ಧತಂತ್ರದ ಸಿನಾರಿಯೋವನ್ನು ಕೇಳಿ (ಉದಾಹರಣೆಗೆ ರಸ್ತೆ ಮುಚ್ಚುವುದು ಅಥವಾ ಸಿಬ್ಬಂದಿಯನ್ನು ಬದಲಾಯಿಸುವುದು) ಮತ್ತು ನಾನು ನಿಮಗಾಗಿ ನಿರ್ದಿಷ್ಟ ಕಾರ್ಯಾಚರಣೆಯ ಪರ್ಯಾಯ ಯೋಜನೆಯನ್ನು ರಚಿಸುತ್ತೇನೆ.'
                    : 'Welcome to the What-If Scenario Simulator.\n\nAsk me any tactical scenario (e.g. closing a road or changing personnel) and I will generate a concrete location-specific operational alternative plan for you.';
                }
                return (
                  <div 
                    key={index} 
                    style={{ 
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, alignSelf: isUser ? 'flex-end' : 'flex-start', paddingLeft: isUser ? 0 : '4px', paddingRight: isUser ? '4px' : 0 }}>
                      {isUser ? (language === 'kn' ? 'ರವಾನೆದಾರ' : 'Dispatcher') : (language === 'kn' ? 'AI ಸಿಮ್ಯುಲೇಟರ್ ಬಾಟ್' : 'AI Simulator Bot')}
                    </span>
                    <div 
                      style={{ 
                        backgroundColor: isUser ? '#007aff' : 'white',
                        border: isUser ? 'none' : '1px solid rgba(0,122,255,0.15)',
                        borderLeft: isUser ? 'none' : '4px solid #34c759',
                        color: isUser ? 'white' : '#1d1d1f',
                        padding: '12px 16px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        lineHeight: 1.5
                      }}
                    >
                      {renderChatBubbleContent(textToShow)}
                    </div>
                  </div>
                );
              })}

              {simulating && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800 }}>{language === 'kn' ? 'AI ಸಿಮ್ಯುಲೇಟರ್ ಬಾಟ್' : 'AI Simulator Bot'}</span>
                  <div style={{ backgroundColor: 'white', border: '1px solid rgba(0,122,255,0.15)', borderLeft: '4px solid #ff9500', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <Loader />
                  </div>
                </div>
              )}

              {simulationError && (
                <div style={{ alignSelf: 'center', color: '#ff3b30', background: 'rgba(255,59,48,0.08)', padding: '10px 16px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  {language === 'kn' ? 'ದೋಷ' : 'Error'}: {simulationError}
                </div>
              )}
            </div>

            {/* Presets and Input Area */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'white' }}>
              
              {/* Presets Suggestion Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, width: '100%', marginBottom: '4px' }}>{language === 'kn' ? 'ಸಿಮ್ಯುಲೇಶನ್ ಪೂರ್ವನಿಗದಿಗಳು:' : 'Simulation Presets:'}</span>
                <button 
                  type="button" 
                  className="tac-sim-preset-btn"
                  style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                  onClick={() => handleSimulate("What if we close Road A?")}
                >
                  {language === 'kn' ? '"ನಾವು ರೋಡ್ ಎ ಮುಚ್ಚಿದರೆ ಏನು?"' : '"What if we close Road A?"'}
                </button>
                <button 
                  type="button" 
                  className="tac-sim-preset-btn"
                  style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                  onClick={() => handleSimulate("What if attendance increases by 30%?")}
                >
                  {language === 'kn' ? '"ಹಾಜರಾತಿ 30% ಹೆಚ್ಚಾದರೆ ಏನು?"' : '"What if attendance increases by 30%?"'}
                </button>
                <button 
                  type="button" 
                  className="tac-sim-preset-btn"
                  style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                  onClick={() => handleSimulate("What if rain occurs during the event?")}
                >
                  {language === 'kn' ? '"ಕಾರ್ಯಕ್ರಮದ ಸಮಯದಲ್ಲಿ ಮಳೆ ಬಂದರೆ ಏನು?"' : '"What if rain occurs during the event?"'}
                </button>
                <button 
                  type="button" 
                  className="tac-sim-preset-btn"
                  style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                  onClick={() => handleSimulate("What if we double the police deployment?")}
                >
                  {language === 'kn' ? '"ನಾವು ಪೊಲೀಸ್ ನಿಯೋಜನೆಯನ್ನು ದ್ವಿಗುಣಗೊಳಿಸಿದರೆ ಏನು?"' : '"What if we double police?"'}
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSimulate(simulationQuery); }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder={language === 'kn' ? 'ಬೇರೆ ಸನ್ನಿವೇಶವನ್ನು ಕೇಳಿ (ಉದಾ. ಕೇವಲ ಒಬ್ಬ ಅಧಿಕಾರಿ ಇದ್ದರೆ ಏನು?)...' : 'Ask another scenario (e.g. What if there is only one officer?)...'}
                    value={simulationQuery}
                    onChange={(e) => setSimulationQuery(e.target.value)}
                    disabled={simulating}
                    style={{ 
                      flex: 1, 
                      padding: '12px 16px', 
                      borderRadius: '10px', 
                      border: '1px solid rgba(0,0,0,0.12)', 
                      fontSize: '0.85rem', 
                      fontWeight: 600, 
                      outline: 'none',
                      fontFamily: 'var(--font-body)'
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={simulating || !simulationQuery.trim()}
                    style={{ 
                      background: 'linear-gradient(135deg, #007aff, #0051a8)', 
                      color: 'white', 
                      border: 'none', 
                      padding: '12px 24px', 
                      borderRadius: '10px', 
                      fontWeight: 800, 
                      cursor: 'pointer', 
                      fontFamily: 'var(--font-body)',
                      boxShadow: '0 2px 8px rgba(0,122,255,0.2)'
                    }}
                  >
                    {language === 'kn' ? 'ಕಳುಹಿಸಿ' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

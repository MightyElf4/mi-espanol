// ── Costa Rican Phonology & Ear-Training Module (TTS Shell) ────────────────

const PHONOLOGY_DRILLS = [
  {
    id: 1,
    category: 'Asimilación Fonética',
    question: '¿Qué palabra o frase escuchas?',
    audio_url: null,
    text_to_speak: 'Costa',
    options: [
      { text: 'Costa', phonetic: '[ˈko.ta] (S aspirada)', isCorrect: true },
      { text: 'Cota', phonetic: '[ˈko.ta] (Sin S)', isCorrect: false }
    ],
    hint: 'Escucha la ligera aspiración implosiva de la S al final de sílaba.'
  },
  {
    id: 2,
    category: 'La R Asibilada Tica',
    question: 'Escucha la pronunciación de la R doble / inicial:',
    audio_url: null,
    text_to_speak: 'Río',
    options: [
      { text: 'Río (Asibilada)', phonetic: '[ˈʒi.o] (Fricativa tica)', isCorrect: true },
      { text: 'Río (Vibrante)', phonetic: '[ˈri.o] (Vibrante múltiple estándar)', isCorrect: false }
    ],
    hint: 'La R tica tradicional tiene una resonancia fricativa asibilada suave.'
  },
  {
    id: 3,
    category: 'Voseo e Imperativos',
    question: 'Distingue el mandato tico en voseo:',
    audio_url: null,
    text_to_speak: 'Mire',
    options: [
      { text: 'Mirá (Voseo)', phonetic: '[mi.ˈra] (Coloquial Tico)', isCorrect: false },
      { text: 'Mire (Usted)', phonetic: '[ˈmi.re] (Respetuoso Tico)', isCorrect: true }
    ],
    hint: 'En Costa Rica se alterna naturalmente entre el Usted formal y el Vos tico.'
  }
];

function playPhonologyAudio(item) {
  if (item.audio_url) {
    const audio = new Audio(item.audio_url);
    audio.play().catch(e => console.warn('Audio play error:', e));
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.text_to_speak || 'Costa');
    utterance.lang = 'es-MX';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } else {
    alert('Audio TTS no soportado en este navegador.');
  }
}

async function renderPhonologyModule(container) {
  let activeDrillIndex = 0;

  function renderDrill() {
    const drill = PHONOLOGY_DRILLS[activeDrillIndex];

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:12px">
        <div>
          <h2 style="font-size:20px;font-weight:800">Entrenamiento Auditivo Tico</h2>
          <div style="font-size:12px;color:var(--text-muted)">Fonología y Pronunciación de Costa Rica</div>
        </div>
        <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:var(--warning);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700">
          🇨🇷 Shell TTS
        </div>
      </div>

      <!-- Disclaimer Banner -->
      <div style="background:rgba(13,148,136,0.1);border:1px solid rgba(13,148,136,0.3);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--accent)">
        ℹ️ <strong>Sintetizador TTS de prueba:</strong> Este prototipo usa la voz sintetizada del navegador. En versiones futuras se integrarán audios nativos grabados en Guanacaste.
      </div>

      <!-- Player Drill Card -->
      <div class="card" style="text-align:center;padding:24px 16px;margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--accent);letter-spacing:0.08em;margin-bottom:6px">
          Ejercicio ${activeDrillIndex + 1} de ${PHONOLOGY_DRILLS.length} · ${drill.category}
        </div>
        <div style="font-size:18px;font-weight:800;margin-bottom:16px">${drill.question}</div>

        <button id="play-audio-btn" class="btn btn-primary" style="width:72px;height:72px;border-radius:50%;margin:0 auto 16px;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(13,148,136,0.4)">
          ▶
        </button>

        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${drill.hint}</div>
      </div>

      <!-- Minimal Pair Selection -->
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:10px">
        Selecciona la opción correspondiente
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px" id="options-grid">
        ${drill.options.map((opt, idx) => `
          <div class="card option-card" data-idx="${idx}" style="cursor:pointer;text-align:center;padding:16px 10px;margin-bottom:0">
            <div style="font-size:18px;font-weight:800;margin-bottom:4px">${opt.text}</div>
            <div style="font-size:11px;color:var(--text-muted)">${opt.phonetic}</div>
          </div>
        `).join('')}
      </div>

      <!-- Feature Explainer Cards -->
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:10px">
        Rasgos Fonéticos de Costa Rica
      </div>

      <div class="card" style="margin-bottom:10px">
        <div style="font-weight:700;font-size:14px;color:var(--warning);margin-bottom:4px">1. Aspiración de 'S' Implosiva</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.4">
          En el habla cotidiana de Costa Rica, la 'S' al final de sílaba a menudo se aspira suavemente como 'H': <em>"¿Cómo e'tá?"</em> [ˈko.mo eh.ˈta].
        </div>
      </div>

      <div class="card">
        <div style="font-weight:700;font-size:14px;color:var(--warning);margin-bottom:4px">2. La 'R' Asibilada Tica</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.4">
          La 'R' doble o inicial costarricense frecuentemente no se vibra con la punta de la lengua, sino que se asibila con una fricción suave única del dialecto tico.
        </div>
      </div>
    `;

    document.getElementById('play-audio-btn').addEventListener('click', () => {
      playPhonologyAudio(drill);
    });

    document.getElementById('options-grid').addEventListener('click', e => {
      const card = e.target.closest('[data-idx]');
      if (!card) return;
      const idx = parseInt(card.dataset.idx);
      const chosen = drill.options[idx];

      if (chosen.isCorrect) {
        card.style.borderColor = '#10b981';
        card.style.background = 'rgba(16,185,129,0.15)';
      } else {
        card.style.borderColor = '#ef4444';
        card.style.background = 'rgba(239,68,68,0.15)';
      }

      setTimeout(() => {
        activeDrillIndex = (activeDrillIndex + 1) % PHONOLOGY_DRILLS.length;
        renderDrill();
      }, 1200);
    });
  }

  renderDrill();
}

router.register('/fonologia', renderPhonologyModule);

// ── DB & State Helpers ────────────────────────────────────────────────────────

function grammarMdBold(s) {
  return (s || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

let activeTreeCustomSentence = null;

function setCustomSentenceForTree(text) {
  if (!text) return;
  activeTreeCustomSentence = text.trim();
}

async function getGrammarUserId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada — vuelve a entrar');
  return session.user.id;
}

async function fetchGrammarExercises() {
  try {
    const userId = await getGrammarUserId();
    const { data, error } = await sb
      .from('grammar_exercises')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data && data.length > 0) ? data : BUILTIN_GRAMMAR_EXERCISES;
  } catch (e) {
    return BUILTIN_GRAMMAR_EXERCISES;
  }
}

async function logGrammarAttempt(exerciseId, yourAnswer, correct) {
  try {
    const userId = await getGrammarUserId();
    if (exerciseId && !exerciseId.startsWith('builtin-')) {
      await sb.from('grammar_attempts').insert({
        user_id: userId,
        exercise_id: exerciseId,
        your_answer: yourAnswer,
        correct,
      });
    }
  } catch (e) {
    console.warn('Could not log attempt:', e);
  }
}

async function fetchGrammarAttempts() {
  try {
    const userId = await getGrammarUserId();
    const { data, error } = await sb
      .from('grammar_attempts')
      .select('correct, exercise_id')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  } catch (e) {
    return [];
  }
}

async function fetchGrammarLessons() {
  try {
    const userId = await getGrammarUserId();
    const { data, error } = await sb
      .from('grammar_lessons')
      .select('*')
      .eq('user_id', userId)
      .order('topic', { ascending: true });
    if (error) throw error;
    return (data && data.length > 0) ? mergeBuiltinLessons(data) : BUILTIN_GRAMMAR_LESSONS;
  } catch (e) {
    return BUILTIN_GRAMMAR_LESSONS;
  }
}

function mergeBuiltinLessons(dbLessons) {
  const map = new Map();
  BUILTIN_GRAMMAR_LESSONS.forEach(l => map.set(l.topic, l));
  dbLessons.forEach(l => map.set(l.topic, { ...map.get(l.topic), ...l }));
  return Array.from(map.values());
}

// ── Simple Rule-Based Parser for Custom Chomsky Tree Sandbox ─────────────────

function parseSentenceToChomskyTree(sentenceStr) {
  const words = sentenceStr.trim().split(/\s+/);
  const taggedWords = words.map((w, idx) => {
    const clean = w.replace(/[.,!?]/g, '');
    const lower = clean.toLowerCase();
    let pos = 'N';

    if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'mi', 'tu', 'su', 'este', 'esta'].includes(lower)) {
      pos = 'DET';
    } else if (['yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'ellos', 'ellas', 'ustedes', 'me', 'te', 'se', 'lo', 'la', 'nos', 'los', 'las'].includes(lower)) {
      pos = 'PRON';
    } else if (['que', 'si', 'cuando', 'como', 'aunque', 'porque'].includes(lower)) {
      pos = 'COMP';
    } else if (['a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'según', 'sin', 'sobre', 'tras'].includes(lower)) {
      pos = 'PREP';
    } else if (['muy', 'bien', 'mal', 'siempre', 'nunca', 'mañana', 'hoy', 'ayer', 'pronto', 'tarde', 'mucho', 'poco'].includes(lower)) {
      pos = 'ADV';
    } else if (['bueno', 'malo', 'gran', 'grande', 'caliente', 'frío', 'nuevo', 'viejo', 'bonito', 'típico', 'excelente'].includes(lower)) {
      pos = 'ADJ';
    } else if (clean.length > 2 && (lower.endsWith('ar') || lower.endsWith('er') || lower.endsWith('ir') || lower.endsWith('o') || lower.endsWith('as') || lower.endsWith('es') || lower.endsWith('á') || lower.endsWith('ió') || lower.endsWith('ía') || lower.endsWith('ó') || lower.endsWith('an') || lower.endsWith('en') || lower.endsWith('amos') || lower.endsWith('emos') || lower.endsWith('imos') || lower.endsWith('as') || lower.endsWith('is') || lower.endsWith('vengas') || lower.endsWith('sepan') || lower.endsWith('compré') || lower.endsWith('está') || lower.endsWith('es'))) {
      pos = 'V';
    }

    return {
      id: `custom-w-${idx}`,
      word: clean,
      pos,
      slotId: `custom-slot-${idx}`
    };
  });

  const slots = taggedWords.map(tw => ({
    label: tw.pos,
    cat: tw.pos === 'V' ? 'cat-VP' : (tw.pos === 'COMP' ? 'cat-CP' : (tw.pos === 'PREP' ? 'cat-PP' : 'cat-NP')),
    slotId: tw.slotId,
    expected: tw.word
  }));

  const tree = {
    label: 'S',
    cat: 'cat-S',
    children: [
      {
        label: 'VP',
        cat: 'cat-VP',
        children: slots
      }
    ]
  };

  return {
    id: `custom-tree-${Date.now()}`,
    title: `Árbol Personalizado: "${sentenceStr}"`,
    topic: 'Parser Personalizado',
    explanation: `Árbol generado dinámicamente para la oración: "${sentenceStr}". Organiza los costituyentes sintácticos según sus etiquetas categoriales.`,
    words: taggedWords,
    tree
  };
}

// ── Built-in Enriched Lessons ─────────────────────────────────────────────────

const BUILTIN_GRAMMAR_LESSONS = [
  {
    id: 'builtin-subjunctive-triggers',
    topic: 'Subjuntivo — Deseos y Dudas',
    title: 'El Subjuntivo: Matriz W.E.I.R.D.O.S. y Cláusulas Subordinadas',
    difficulty: 'intermediate',
    formula: {
      title: 'Fórmula de la Cláusula Subordinada',
      chips: [
        { text: 'Sujeto 1 + Verbo Matriz (Indicativo)', type: 'trigger' },
        { text: '+ que +', type: 'prep' },
        { text: 'Sujeto 2 (Diferente)', type: 'subject' },
        { text: '+ Verbo Subjuntivo', type: 'verb' }
      ],
      rule: 'Si Sujeto 1 = Sujeto 2, usa infinitivo ("Quiero ir"). Si Sujeto 1 ≠ Sujeto 2, usa que + subjuntivo ("Quiero que vayas").'
    },
    contrast: {
      leftTitle: 'Indicativo (Certeza / Realidad)',
      leftItems: [
        'Sé que tú **vienes** a la reunión.',
        'Es cierto que **llueve** mucho en Hojancha.',
        'Pienso que él **tiene** la razón.'
      ],
      rightTitle: 'Subjuntivo (Deseo / Duda / Valoración)',
      rightItems: [
        'Espero que tú **vengas** a la reunión.',
        'Dudo que **llueva** hoy.',
        'No creo que él **tenga** la razón.'
      ]
    },
    explanation_es: `El modo subjuntivo expresa la **actitud subjetiva del hablante** hacia la acción: incertidumbre, deseo, emoción o valoración.`,
    explanation_en: `Use the Subjunctive when expressing WEIRDOS triggers: Wish, Emotion, Impersonal, Request, Doubt, Ojalá, Speculation, coupled with a subject change across "que".`,
    examples: [
      { spanish: 'Espero que **vengas** a la fiesta.', english: 'I hope you come to the party.', note: 'Cambio de sujeto: Yo espero / Tú vengas' }
    ],
    common_errors: [
      { wrong: 'Quiero que yo voy al mercado', right: 'Quiero ir al mercado', why: 'Mismo sujeto se usa infinitivo.' }
    ]
  },
  {
    id: 'builtin-ser-estar',
    topic: 'Ser vs. Estar',
    title: 'Ser vs. Estar: Esencia vs. Estado / Ubicación',
    difficulty: 'beginner',
    formula: {
      title: 'Regla: D.O.C.T.O.R. vs. P.L.A.C.E.',
      chips: [
        { text: 'SER = Descripción, Ocupación, Característica, Tiempo, Origen', type: 'subject' },
        { text: 'ESTAR = Posición, Lugar, Acción -ndo, Condición, Emoción', type: 'verb' }
      ],
      rule: 'Ser clasifica la naturaleza. Estar describe el estado o ubicación.'
    },
    contrast: {
      leftTitle: 'SER (Identidad)',
      leftItems: ['El café **es** una bebida típica.', 'Carlos **es** aburrido (personalidad).'],
      rightTitle: 'ESTAR (Estado)',
      rightItems: ['El café **está** caliente.', 'Carlos **está** aburrido (sentimiento).']
    },
    explanation_es: `Ser define la clase o atributo inherente; Estar describe estados transitorios o localización física.`,
    explanation_en: `Use SER for defining traits and origin. Use ESTAR for location and temporary states.`,
    examples: [{ spanish: 'Hojancha **está** en Guanacaste.', english: 'Hojancha is in Guanacaste.' }],
    common_errors: [{ wrong: 'La comida es muy rica hoy', right: 'La comida está muy rica hoy', why: 'Para el sabor actual de este plato se usa estar.' }]
  },
  {
    id: 'builtin-por-para',
    topic: 'Por vs. Para',
    title: 'Por vs. Para: Causa vs. Objetivo',
    difficulty: 'intermediate',
    formula: {
      title: 'Dirección Temporal',
      chips: [
        { text: 'POR ← Causa, Motivo, Intercambio, Duración', type: 'prep' },
        { text: 'PARA → Objetivo, Destinatario, Límite, Dirección', type: 'trigger' }
      ],
      rule: 'POR mira hacia atrás (por qué). PARA mira hacia adelante (para qué).'
    },
    contrast: {
      leftTitle: 'POR (Causa / Medio)',
      leftItems: ['Gracias **por** tu ayuda.', 'Caminamos **por** la playa.'],
      rightTitle: 'PARA (Objetivo / Meta)',
      rightItems: ['Este regalo es **para** ti.', 'Estudio **para** aprender.']
    },
    explanation_es: `Por expresa la causa o el trayecto. Para expresa la meta o el destinatario.`,
    explanation_en: `Use POR for causes, exchanges, and durations. Use PARA for goals, deadlines, and recipients.`,
    examples: [{ spanish: 'Compré frutas **para** la semana.', english: 'I bought fruits for the week.' }],
    common_errors: [{ wrong: 'Estudio por hablar español', right: 'Estudio para hablar español', why: 'Indica meta futura.' }]
  }
];

const BUILTIN_GRAMMAR_EXERCISES = [
  { id: 'ex-1', topic: 'Subjuntivo — Deseos y Dudas', prompt: 'Espero que tú _____ (venir) a la reunión.', correct_answer: 'vengas', difficulty: 'intermediate' },
  { id: 'ex-2', topic: 'Ser vs. Estar', prompt: 'El café _____ (estar) muy caliente.', correct_answer: 'está', difficulty: 'beginner' },
  { id: 'ex-3', topic: 'Por vs. Para', prompt: 'Este regalo es _____ (por/para) mi amigo.', correct_answer: 'para', difficulty: 'intermediate' }
];

const CHOMSKY_TREE_DATASETS = [
  {
    id: 'tree-subjunctive-1',
    title: 'Cláusula Subordinada Sustantiva (Subjuntivo)',
    topic: 'Subjuntivo — Deseos y Dudas',
    explanation: 'Estructura jerárquica: la oración principal (S) contiene un VP con verbo matriz de deseo ("Espero") que toma una cláusula subordinada (CP) encabezada por "que" y un verbo en subjuntivo ("vengas").',
    words: [
      { id: 'w1', word: 'Espero', pos: 'V (Matriz)', slotId: 'slot-v1' },
      { id: 'w2', word: 'que', pos: 'COMP', slotId: 'slot-comp' },
      { id: 'w3', word: 'tú', pos: 'PRON', slotId: 'slot-pron' },
      { id: 'w4', word: 'vengas', pos: 'V (Subj)', slotId: 'slot-v2' },
      { id: 'w5', word: 'pronto', pos: 'ADV', slotId: 'slot-adv' }
    ],
    tree: {
      label: 'S',
      cat: 'cat-S',
      children: [
        {
          label: 'VP',
          cat: 'cat-VP',
          children: [
            { label: 'V', cat: 'cat-VP', slotId: 'slot-v1', expected: 'Espero' },
            {
              label: 'CP',
              cat: 'cat-CP',
              children: [
                { label: 'C', cat: 'cat-CP', slotId: 'slot-comp', expected: 'que' },
                {
                  label: 'S\'',
                  cat: 'cat-S',
                  children: [
                    { label: 'NP', cat: 'cat-NP', children: [{ label: 'PRON', cat: 'cat-NP', slotId: 'slot-pron', expected: 'tú' }] },
                    { label: 'VP', cat: 'cat-VP', children: [
                      { label: 'V', cat: 'cat-VP', slotId: 'slot-v2', expected: 'vengas' },
                      { label: 'ADV', cat: 'cat-VP', slotId: 'slot-adv', expected: 'pronto' }
                    ]}
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'tree-ser-estar-1',
    title: 'Estructura Copulativa de Estado (Estar + Adj)',
    topic: 'Ser vs. Estar',
    explanation: 'El Sintagma Verbal (VP) copulativo contiene el verbo auxiliar de estado "está" seguido del Sintagma Adjetival "muy caliente".',
    words: [
      { id: 'w1', word: 'El', pos: 'DET', slotId: 'slot-det' },
      { id: 'w2', word: 'café', pos: 'N', slotId: 'slot-n' },
      { id: 'w3', word: 'está', pos: 'V (Cop)', slotId: 'slot-v' },
      { id: 'w4', word: 'muy', pos: 'ADV', slotId: 'slot-adv' },
      { id: 'w5', word: 'caliente', pos: 'ADJ', slotId: 'slot-adj' }
    ],
    tree: {
      label: 'S',
      cat: 'cat-S',
      children: [
        {
          label: 'NP',
          cat: 'cat-NP',
          children: [
            { label: 'DET', cat: 'cat-NP', slotId: 'slot-det', expected: 'El' },
            { label: 'N', cat: 'cat-NP', slotId: 'slot-n', expected: 'café' }
          ]
        },
        {
          label: 'VP',
          cat: 'cat-VP',
          children: [
            { label: 'V', cat: 'cat-VP', slotId: 'slot-v', expected: 'está' },
            { label: 'AP', cat: 'cat-CP', children: [
              { label: 'ADV', cat: 'cat-CP', slotId: 'slot-adv', expected: 'muy' },
              { label: 'ADJ', cat: 'cat-CP', slotId: 'slot-adj', expected: 'caliente' }
            ]}
          ]
        }
      ]
    }
  }
];

let activeTreeDatasetId = null;

// ── 1. Chomsky Tree Activity & Sandbox Component ─────────────────────────────

function renderChomskyTreeActivity(container) {
  let datasetsPool = [...CHOMSKY_TREE_DATASETS];
  
  if (activeTreeCustomSentence) {
    const customDs = parseSentenceToChomskyTree(activeTreeCustomSentence);
    datasetsPool.unshift(customDs);
  }

  let datasetIndex = 0;
  let currentDataset = datasetsPool[datasetIndex];
  let wordPlacements = {};
  let selectedWordId = null;

  function initActivity() {
    wordPlacements = {};
    selectedWordId = null;
    renderUI();
  }

  function renderUI() {
    const isComplete = checkIsComplete();

    container.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="grammar-header-badge">${currentDataset.topic}</span>
          <select id="tree-select" style="padding:4px 8px;font-size:12px;border-radius:6px;border:1px solid var(--border);max-width:180px">
            ${datasetsPool.map((ds, idx) => `
              <option value="${idx}" ${idx === datasetIndex ? 'selected' : ''}>${ds.title}</option>
            `).join('')}
          </select>
        </div>
        <h3 style="font-size:16px;margin-bottom:4px">${currentDataset.title}</h3>
        <p style="font-size:13px;color:var(--text-muted)">
          Arrastra o toca cada palabra del banco inferior para colocarla en la posición sintáctica correcta del árbol Chomsky.
        </p>

        <!-- Custom Sandbox Sentence Drawer -->
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px">✍️ Probar tu propia oración en el Árbol</div>
          <div style="display:flex;gap:8px">
            <input type="text" id="custom-sentence-input" placeholder="Ej. Dijo que vendría mañana" style="flex:1;padding:6px 10px;font-size:13px;border-radius:6px;border:1px solid var(--border)">
            <button class="btn btn-secondary" id="btn-parse-custom" style="padding:6px 12px;font-size:12px">Generar árbol</button>
          </div>
        </div>
      </div>

      <!-- Word Bank -->
      <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">
        Banco de palabras disponibles
      </div>
      <div class="word-bank" id="word-bank-container">
        ${currentDataset.words.map(w => {
          const isPlaced = Object.values(wordPlacements).includes(w.word);
          const isSelected = selectedWordId === w.id;
          return `
            <div class="word-chip ${isPlaced ? 'placed' : ''} ${isSelected ? 'selected-chip' : ''}" 
                 data-word-id="${w.id}" 
                 data-word="${w.word}"
                 draggable="${!isPlaced}">
              <span>${w.word}</span>
              <span class="pos-tag">${w.pos}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Tree Container -->
      <div class="tree-container" id="tree-canvas">
        ${renderTreeNodeHTML(currentDataset.tree)}
      </div>

      <!-- Live Syntactic Feedback -->
      <div class="syntax-analysis-bar">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span>🔍 Análisis Sintáctico de la Oración</span>
        </div>
        <p style="font-size:13px;color:var(--text-muted);line-height:1.5;margin-bottom:10px">
          ${currentDataset.explanation}
        </p>
        <div id="tree-validation-msg">
          ${isComplete ? `
            <div class="syntax-step" style="color:var(--success);font-weight:600">
              <div class="syntax-step-icon ok">✓</div>
              <span>¡Excelente! Estructura sintáctica construida correctamente.</span>
            </div>
          ` : `
            <div class="syntax-step">
              <div class="syntax-step-icon info">i</div>
              <span>Coloca todas las palabras en los nodos terminales para verificar el árbol.</span>
            </div>
          `}
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:10px">
        <button class="btn btn-secondary" id="btn-reset-tree" style="flex:1">Reiniciar árbol</button>
        <button class="btn btn-primary" id="btn-next-tree" style="flex:1">Siguiente oración →</button>
      </div>
    `;

    bindEvents();
  }

  function renderTreeNodeHTML(node) {
    if (node.slotId) {
      const placedWord = wordPlacements[node.slotId];
      const isCorrect = placedWord === node.expected;
      return `
        <div class="tree-node">
          <div class="tree-label ${node.cat || ''}">${node.label}</div>
          <div class="tree-slot ${placedWord ? 'slot-filled' : ''}" 
               data-slot-id="${node.slotId}"
               data-expected="${node.expected}">
            ${placedWord ? `
              <div class="word-chip" style="margin:0;font-size:13px;background:none;box-shadow:none;border:none">
                <strong style="color:${isCorrect ? 'var(--success)' : 'var(--danger)'}">${placedWord}</strong>
              </div>
            ` : `<span style="font-size:11px;color:var(--text-muted)">${node.label}</span>`}
          </div>
        </div>
      `;
    }

    return `
      <div class="tree-node">
        <div class="tree-label ${node.cat || ''}">${node.label}</div>
        <div class="tree-children">
          ${(node.children || []).map(child => renderTreeNodeHTML(child)).join('')}
        </div>
      </div>
    `;
  }

  function checkIsComplete() {
    const slots = [];
    function collectSlots(n) {
      if (n.slotId) slots.push(n);
      if (n.children) n.children.forEach(collectSlots);
    }
    collectSlots(currentDataset.tree);
    return slots.every(s => wordPlacements[s.slotId] === s.expected);
  }

  function bindEvents() {
    const treeSelect = document.getElementById('tree-select');
    if (treeSelect) {
      treeSelect.addEventListener('change', e => {
        datasetIndex = parseInt(e.target.value, 10);
        currentDataset = datasetsPool[datasetIndex];
        initActivity();
      });
    }

    document.getElementById('btn-parse-custom').addEventListener('click', () => {
      const inp = document.getElementById('custom-sentence-input').value.trim();
      if (!inp) return;
      const customDs = parseSentenceToChomskyTree(inp);
      datasetsPool.unshift(customDs);
      datasetIndex = 0;
      currentDataset = customDs;
      initActivity();
    });

    const wordBank = document.getElementById('word-bank-container');
    if (wordBank) {
      wordBank.addEventListener('click', e => {
        const chip = e.target.closest('.word-chip');
        if (!chip || chip.classList.contains('placed')) return;
        const wId = chip.dataset.wordId;
        selectedWordId = (selectedWordId === wId) ? null : wId;
        renderUI();
      });
    }

    const treeCanvas = document.getElementById('tree-canvas');
    if (treeCanvas) {
      treeCanvas.addEventListener('click', e => {
        const slot = e.target.closest('.tree-slot');
        if (!slot) return;
        const slotId = slot.dataset.slotId;

        if (selectedWordId) {
          const wObj = currentDataset.words.find(w => w.id === selectedWordId);
          if (wObj) {
            wordPlacements[slotId] = wObj.word;
            selectedWordId = null;
            renderUI();
          }
        } else if (wordPlacements[slotId]) {
          delete wordPlacements[slotId];
          renderUI();
        }
      });
    }

    document.getElementById('btn-reset-tree').addEventListener('click', initActivity);
    document.getElementById('btn-next-tree').addEventListener('click', () => {
      datasetIndex = (datasetIndex + 1) % datasetsPool.length;
      currentDataset = datasetsPool[datasetIndex];
      initActivity();
    });
  }

  initActivity();
}

// ── 2. Pronoun Stacking & Transformation Lab ──────────────────────────────────

function renderPronounLab(container) {
  const examples = [
    { base: 'Le di el informe a Carlos', io: 'le', do: 'el informe', target: 'Se lo di', explanation: 'Regla del "Se lo": Cuando el pronombre indirecto (le/les) precede al directo (lo/la/los/las), "le" se convierte automáticamente en "SE".' },
    { base: 'Quiero enviar la carta a ustedes', io: 'les', do: 'la carta', target: 'Se la quiero enviar / Quiero enviársela', explanation: 'Posición variable: El bloque pronombral "se la" puede ir antes del verbo conjugado o adjunto al final del infinitivo ("enviársela").' },
    { base: 'Está diciendo las noticias a María', io: 'le', do: 'las noticias', target: 'Se las está diciendo / Está diciéndoselas', explanation: 'Gerundio: Al adjuntar pronombres al gerundio, se añade tilde en la sílaba tónica ("diciéndoselas").' }
  ];

  let currentIdx = 0;

  function render() {
    const ex = examples[currentIdx];
    container.innerHTML = `
      <div class="card formula-card pronoun-rule">
        <div class="formula-title">⚡ Laboratorio de Pronombres de Objeto Directo e Indirecto</div>
        <p style="font-size:13px;color:var(--text-muted)">
          Aprende la apócope y transformación de pronombres dobles (<em>me lo, te la, se los</em>) y sus reglas de posición verbal.
        </p>
        <div class="formula-pipeline">
          <div class="formula-chip chip-object">Indirecto: le / les</div>
          <span>+</span>
          <div class="formula-chip chip-subject">Directo: lo / la / los / las</div>
          <span>→</span>
          <div class="formula-chip chip-trigger" style="background:#ec4899;color:#fff">SE LO / SE LA</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${ex.base}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Transformación requerida en pronombres dobles:</div>

        <div class="pronoun-slot-box">
          <div class="pronoun-chip">${ex.target}</div>
        </div>

        <div class="syntax-analysis-bar" style="margin-top:12px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">📌 Explicación de la Transformación</div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.5">${ex.explanation}</div>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" id="pr-prev" style="flex:1">← Anterior</button>
        <button class="btn btn-primary" id="pr-next" style="flex:1">Siguiente ejemplo →</button>
      </div>
    `;

    document.getElementById('pr-prev').addEventListener('click', () => {
      currentIdx = (currentIdx - 1 + examples.length) % examples.length;
      render();
    });
    document.getElementById('pr-next').addEventListener('click', () => {
      currentIdx = (currentIdx + 1) % examples.length;
      render();
    });
  }

  render();
}

// ── 3. Costa Rican Register & Pragmatics Transformer ──────────────────────────

function renderTicoRegisterTransformer(container) {
  const registers = [
    {
      standard: '¿De verdad vas a ir a la fiesta?',
      usted: '¿De verdad va a ir a la fiesta usted?',
      vos: '¿De verdad vas a ir a la fiesta vos?',
      tico: '¿Al chile va a ir a la fiesta?',
      notes: 'En Costa Rica el trato formal "Usted" se usa cotidianamente entre amigos y vecinos. "¡Al chile!" es la expresión autóctona tica para "¿De verdad?".'
    },
    {
      standard: 'Muchas gracias por tu ayuda.',
      usted: 'Muchas gracias por su ayuda.',
      vos: 'Muchas gracias por tu ayuda.',
      tico: '¡Con mucho gusto! / ¡Con gusto!',
      notes: 'La respuesta de cortesía por excelencia en Costa Rica es "¡Con gusto!" en lugar de "De nada".'
    },
    {
      standard: 'Ven aquí y mira esto.',
      usted: 'Venga aquí y mire esto. (Imperativo Usted)',
      vos: 'Vení aquí y mirá esto. (Imperativo Vos)',
      tico: 'Pase adelante y mire (Trato respetuoso cotidiano)',
      notes: 'El imperativo con Vos acentúa la última sílaba: vení, mirá, decí, hacé.'
    }
  ];

  let idx = 0;

  function render() {
    const item = registers[idx];
    container.innerHTML = `
      <div class="card formula-card tico-rule">
        <div class="formula-title">🇨🇷 Transformador de Registro y Pragmática Costarricense</div>
        <p style="font-size:13px;color:var(--text-muted)">
          Compara el español estándar B1 con el registro de inmersión real en Hojancha (Usted cotidiano, Vos y Tiquismos).
        </p>
      </div>

      <div class="tico-register-card">
        <div style="margin-bottom:10px">
          <span class="register-tag tag-standard">Estándar (B1)</span>
          <div style="font-size:15px;font-weight:600;margin-top:4px">${item.standard}</div>
        </div>

        <div style="margin-bottom:10px;padding-top:8px;border-top:1px dashed var(--border)">
          <span class="register-tag tag-usted">Costa Rica — Usted Respetuoso</span>
          <div style="font-size:15px;font-weight:600;margin-top:4px">${item.usted}</div>
        </div>

        <div style="margin-bottom:10px;padding-top:8px;border-top:1px dashed var(--border)">
          <span class="register-tag tag-vos">Costa Rica — Vos (Voseo)</span>
          <div style="font-size:15px;font-weight:600;margin-top:4px">${item.vos}</div>
        </div>

        <div style="padding-top:8px;border-top:1px dashed var(--border)">
          <span class="register-tag tag-tico">Variante Tica / Modismo</span>
          <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:4px">${item.tico}</div>
        </div>
      </div>

      <div class="syntax-analysis-bar" style="margin-bottom:14px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">💡 Nota Cultural / Pragmática</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5">${item.notes}</div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" id="tc-prev" style="flex:1">← Anterior</button>
        <button class="btn btn-primary" id="tc-next" style="flex:1">Siguiente registro →</button>
      </div>
    `;

    document.getElementById('tc-prev').addEventListener('click', () => {
      idx = (idx - 1 + registers.length) % registers.length;
      render();
    });
    document.getElementById('tc-next').addEventListener('click', () => {
      idx = (idx + 1) % registers.length;
      render();
    });
  }

  render();
}

// ── 4. Conectores y Cláusulas Visualizer ──────────────────────────────────────

function renderConectoresVisualizer(container) {
  const connectors = [
    { word: 'a no ser que / a menos que', mode: 'Subjuntivo', type: 'subjunctive', example: 'Iremos a la playa **a no ser que llueva**.' },
    { word: 'con tal de que', mode: 'Subjuntivo', type: 'subjunctive', example: 'Te presto el libro **con tal de que me lo devuelvas** pronto.' },
    { word: 'puesto que / ya que / dado que', mode: 'Indicativo', type: 'indicative', example: 'No salimos **ya que estaba** lloviendo fuerte.' },
    { word: 'por lo tanto', mode: 'Indicativo', type: 'indicative', example: 'Estudió mucho; **por lo tanto, aprobó** el examen.' },
    { word: 'cuando / en cuanto / hasta que', mode: 'Variable (Tiempo)', type: 'variable', example: 'Llámame **en cuanto llegues** (futuro = subjuntivo) vs. Siempre me llama **en cuanto llega** (rutina = indicativo).' }
  ];

  container.innerHTML = `
    <div class="card formula-card" style="border-left-color:#8b5cf6">
      <div class="formula-title">🔗 Visualizador de Conectores y Cláusulas Complejas (B2/C1)</div>
      <p style="font-size:13px;color:var(--text-muted)">
        Navega por los marcadores del discurso e identifica cuáles exigen Subjuntivo o Indicativo para construir oraciones complejas.
      </p>
    </div>

    <div>
      ${connectors.map(c => `
        <div class="card" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span class="connector-badge connector-${c.type}">${c.word}</span>
            <span style="font-size:11px;font-weight:700;color:var(--text-muted)">Modo: ${c.mode}</span>
          </div>
          <div style="font-size:14px;line-height:1.5;margin-top:4px">${grammarMdBold(c.example)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Lessons & Practice Existing Callbacks ──────────────────────────────────────

async function renderGrammarLessons(container, openLesson) {
  container.innerHTML = `<div class="spinner"></div>`;
  const lessons = await fetchGrammarLessons();

  container.innerHTML = `
    ${lessons.map(l => `
      <div class="card lesson-row" data-id="${l.id}" style="cursor:pointer;margin-bottom:8px">
        <div style="font-weight:600;font-size:15px">${l.title}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:2px;font-weight:600">${l.topic}</div>
      </div>
    `).join('')}
  `;

  container.addEventListener('click', e => {
    const row = e.target.closest('.lesson-row');
    if (!row) return;
    const lesson = lessons.find(l => l.id === row.dataset.id);
    if (lesson) openLesson(lesson);
  });
}

function renderGrammarLessonDetail(container, lesson, { onBack, onPractice, onOpenTree }) {
  const paragraphs = html => html.split(/\n\n+/).map(p => `<p style="line-height:1.7;margin:0 0 12px">${grammarMdBold(p)}</p>`).join('');

  container.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <h2 style="font-size:20px">${lesson.title}</h2>
      <button class="btn btn-secondary" id="l-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <div class="grammar-header-badge">${lesson.topic}</div>

    <div class="card" style="margin-bottom:12px">
      ${paragraphs(lesson.explanation_es)}
    </div>

    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-secondary" id="l-tree-btn" style="flex:1">🌳 Ver Árbol Sintáctico</button>
      <button class="btn btn-primary" id="l-practice" style="flex:1">Practicar tema →</button>
    </div>
  `;

  document.getElementById('l-back').addEventListener('click', onBack);
  document.getElementById('l-practice').addEventListener('click', () => onPractice(lesson.topic));
  document.getElementById('l-tree-btn').addEventListener('click', () => onOpenTree(lesson.topic));
}

// ── Main Module Entrypoint & Tabs ─────────────────────────────────────────────

async function renderGrammarModule(container, defaultTab = 'tree') {
  const tabs = [
    { id: 'tree', label: '🌳 Árboles Chomsky' },
    { id: 'pronouns', label: '⚡ Pronombres' },
    { id: 'tico', label: '🇨🇷 Registro Tico' },
    { id: 'connectors', label: '🔗 Conectores' },
    { id: 'lessons', label: 'Lecciones' },
  ];

  async function renderTab(tabId) {
    document.querySelectorAll('.module-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId)
    );
    const tc = document.getElementById('tab-content');

    function openLesson(lesson) {
      renderGrammarLessonDetail(tc, lesson, {
        onBack: () => renderTab('lessons'),
        onPractice: topic => { renderTab('tree'); },
        onOpenTree: topic => { renderTab('tree'); }
      });
    }

    try {
      if (tabId === 'tree') {
        renderChomskyTreeActivity(tc);
      } else if (tabId === 'pronouns') {
        renderPronounLab(tc);
      } else if (tabId === 'tico') {
        renderTicoRegisterTransformer(tc);
      } else if (tabId === 'connectors') {
        renderConectoresVisualizer(tc);
      } else if (tabId === 'lessons') {
        await renderGrammarLessons(tc, openLesson);
      }
    } catch (err) {
      showLoadError(tc, err, () => renderTab(tabId));
    }
  }

  container.innerHTML = `
    <div class="hero-banner">
      <img src="images/grammar_hero_v2.jpg?v=2" alt="Estructura Sintáctica">
      <div class="hero-overlay">
        <div class="hero-title">Gramática y Estructura</div>
        <div class="hero-subtitle">Árboles Sintácticos, Pronombres y Pragmática Tica</div>
      </div>
    </div>
    <div class="module-tabs">
      ${tabs.map(t => `<button class="module-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelector('.module-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) renderTab(btn.dataset.tab);
  });

  await renderTab(defaultTab);
}

router.register('/grammar', renderGrammarModule);

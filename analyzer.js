// ============================================================
//  SIEL — MOTOR DE INTELIGENCIA ESTRATÉGICA
//  Analiza documentos con IA y genera los 13 puntos SIEL
// ============================================================

const SIEL_SYSTEM_PROMPT = `Eres SIEL (Sistema Inteligente de Evaluación de Licitaciones), el copiloto estratégico más avanzado para análisis de contratos públicos y privados en Colombia y Latinoamérica.

Tu rol es actuar como un experto senior con conocimiento profundo en:
- Derecho contractual colombiano (Ley 80/93, Ley 1150/07, Decreto 1082/15, SECOP I y II)
- Análisis financiero de proponentes (indicadores, capacidad residual, patrimonio)
- Ingeniería y análisis técnico de proyectos de obra, tecnología y servicios
- Economía contractual, equilibrio económico, análisis de precios y rentabilidad
- Gestión integral de riesgos en contratación
- Detección de pliegos restrictivos o posiblemente direccionados

Tu misión es transformar documentos licitatorios complejos en decisiones claras y accionables.

SIEMPRE respondes en español. SIEMPRE en formato JSON estricto. NUNCA texto fuera del JSON.`;

const ANALYSIS_PROMPT = (docText, filename) => `
Analiza el siguiente documento de licitación y genera un análisis estratégico completo de los 13 puntos SIEL.

DOCUMENTO: "${filename}"
CONTENIDO:
${docText.substring(0, 12000)}

Responde ÚNICAMENTE con este JSON (sin markdown, sin texto adicional, sin bloques de código):

{
  "nombre": "nombre completo del proceso o licitación",
  "entidad": "nombre de la entidad contratante",
  "sector": "sector (infraestructura/tecnología/salud/educación/servicios/obra/otro)",
  "valor": "valor estimado del contrato en COP o USD si está disponible, si no 'No especificado'",
  "fecha_cierre": "fecha límite de presentación de propuestas o 'No especificada'",
  "modalidad": "licitación pública/selección abreviada/concurso de méritos/contratación directa/otro",
  "objeto": "objeto del contrato en máximo 2 líneas",

  "score_total": número entre 0 y 100,
  "score_juridico": número entre 0 y 100,
  "score_financiero": número entre 0 y 100,
  "score_tecnico": número entre 0 y 100,
  "score_economico": número entre 0 y 100,
  "nivel_riesgo": "BAJO/MEDIO/ALTO/CRÍTICO",
  "nivel_complejidad": "BAJA/MEDIA/ALTA/MUY ALTA",
  "probabilidad_exito": "BAJA/MODERADA/ALTA/MUY ALTA",
  "decision": "PARTICIPAR/NO_PARTICIPAR/PARTICIPAR_CON_CONDICIONES",

  "resumen_ejecutivo": "párrafo de 4-6 oraciones describiendo el proceso, su relevancia y contexto estratégico",

  "justificacion_decision": "explicación detallada de por qué se recomienda participar, no participar, o con condiciones. Incluir argumentos financieros, jurídicos, técnicos y de riesgo. Mínimo 5 oraciones.",

  "analisis_juridico": "análisis jurídico detallado: modalidad contractual, marco legal aplicable, habilitantes jurídicos, cláusulas relevantes, posibles restricciones, legalidad del proceso. Mínimo 4 oraciones.",

  "analisis_financiero": "análisis financiero: indicadores requeridos (liquidez, endeudamiento, razón corriente, ROE/ROA si aplica), patrimonio mínimo, capacidad residual, análisis de la exigencia financiera vs capacidad promedio del sector. Mínimo 4 oraciones.",

  "analisis_tecnico": "análisis técnico: experiencia requerida, certificaciones, personal especializado, equipos, metodologías exigidas, complejidad técnica, evaluación de los criterios técnicos de calificación. Mínimo 4 oraciones.",

  "analisis_economico": "análisis económico: análisis del presupuesto, rentabilidad estimada, estructura de costos, condiciones de pago, equilibrio económico, análisis del valor por dinero, índices de austeridad o restricciones económicas. Mínimo 4 oraciones.",

  "checklist": [
    {
      "item": "nombre del documento o requisito",
      "descripcion": "qué implica este requisito",
      "estado": "CUMPLE/REVISAR/FALTA_INFO/NO_CUMPLE",
      "observacion": "observación específica sobre este requisito"
    }
  ],

  "riesgos": [
    {
      "titulo": "nombre del riesgo",
      "nivel": "ALTO/MEDIO/BAJO",
      "descripcion": "descripción detallada del riesgo y su impacto potencial",
      "mitigacion": "cómo mitigar o gestionar este riesgo"
    }
  ],

  "alertas": [
    {
      "tipo": "CRITICA/ADVERTENCIA/INFO",
      "titulo": "título de la alerta",
      "descripcion": "descripción detallada de por qué se genera esta alerta"
    }
  ],

  "recomendaciones": [
    {
      "titulo": "título de la recomendación accionable",
      "descripcion": "descripción detallada de qué hacer, por qué y cómo",
      "categoria": "JURÍDICO/FINANCIERO/TÉCNICO/ECONÓMICO/ESTRATÉGICO",
      "prioridad": "ALTA/MEDIA/BAJA"
    }
  ]
}

INSTRUCCIONES CRÍTICAS:
- Si el documento es muy breve o no parece un pliego, igual analiza lo que encuentres y genera el JSON completo
- El checklist debe tener entre 6 y 10 ítems relevantes al sector/modalidad
- Los riesgos deben ser entre 4 y 7, reales y específicos del documento
- Las alertas deben ser entre 3 y 6, priorizando alertas críticas si hay restricciones
- Las recomendaciones deben ser entre 4 y 7, siempre accionables y específicas
- Si detectas señales de pliego posiblemente direccionado, incluye alerta CRÍTICA
- El score_total debe ser un promedio ponderado: juridico(25%) + financiero(25%) + tecnico(25%) + economico(25%)
- SOLO JSON válido como respuesta`;

// ── FILE READER ───────────────────────────────────────────
async function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // For PDF: read as text (basic extraction)
      reader.onload = (e) => {
        const arr = new Uint8Array(e.target.result);
        let text = '';
        // Extract readable characters from PDF bytes
        for (let i = 0; i < Math.min(arr.length, 50000); i++) {
          const c = arr[i];
          if (c >= 32 && c < 127) text += String.fromCharCode(c);
          else if (c === 10 || c === 13) text += ' ';
        }
        // Clean up PDF artifacts
        text = text
          .replace(/[^\x20-\x7E\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/(obj|endobj|stream|endstream|BT|ET|Tf|Tj|TJ|Td|TD|Tm|cm|re|S|f|F|W|n|q|Q|gs|cs|CS|scn|SCN|w|J|j|M|d|ri|i|g|G|rg|RG)/g, ' ')
          .trim();
        resolve(text.length > 100 ? text : `[Documento PDF: ${file.name}. El contenido no pudo extraerse completamente. Por favor analiza como un pliego de licitación típico del sector público colombiano.]`);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // TXT, DOCX (basic), etc.
      reader.onload = (e) => resolve(e.target.result || '');
      reader.readAsText(file, 'UTF-8');
    }
  });
}

// ── PROGRESS STEPS ────────────────────────────────────────
const ANALYSIS_STEPS = [
  { icon: 'fa-file-arrow-up',       label: 'Cargando documento...' },
  { icon: 'fa-eye',                 label: 'Leyendo y extrayendo contenido...' },
  { icon: 'fa-gavel',               label: 'Analizando requisitos jurídicos...' },
  { icon: 'fa-chart-line',          label: 'Evaluando viabilidad financiera...' },
  { icon: 'fa-cogs',                label: 'Revisando requisitos técnicos...' },
  { icon: 'fa-coins',               label: 'Analizando condiciones económicas...' },
  { icon: 'fa-triangle-exclamation',label: 'Detectando riesgos y alertas...' },
  { icon: 'fa-list-check',          label: 'Generando checklist documental...' },
  { icon: 'fa-brain',               label: 'Motor de decisión estratégica...' },
  { icon: 'fa-star',                label: 'Generando recomendaciones IA...' },
  { icon: 'fa-check-circle',        label: 'Análisis completado ✓' },
];

function renderProgressSteps(activeIdx) {
  const container = document.getElementById('prog-steps');
  if (!container) return;
  container.innerHTML = ANALYSIS_STEPS.map((s, i) => {
    let cls = 'prog-step';
    let icon = 'fa-circle';
    if (i < activeIdx) { cls += ' done'; icon = 'fa-check-circle'; }
    else if (i === activeIdx) { cls += ' active'; icon = 'fa-spinner fa-spin'; }
    return `<div class="${cls}"><i class="fa-solid ${icon}"></i>${s.label}</div>`;
  }).join('');
}

function setProgress(pct, statusText) {
  const bar = document.getElementById('prog-bar');
  const status = document.getElementById('prog-status');
  if (bar) bar.style.width = pct + '%';
  if (status) status.textContent = statusText;
}

// ── MAIN ANALYZER ─────────────────────────────────────────
async function analyzeDocument(file) {
  const uploadArea = document.getElementById('upload-progress-area');
  const dropZone   = document.getElementById('drop-zone');
  if (uploadArea) uploadArea.style.display = 'block';
  if (dropZone)   dropZone.style.display   = 'none';
  document.getElementById('prog-filename').textContent = file.name;

  // Check plan limit
  const monthCount = await countThisMonth();
  if (monthCount >= SIEL_CONFIG.FREE_PLAN_LIMIT && currentProfile?.plan === 'starter') {
    showToast('Has alcanzado el límite de 3 análisis/mes del plan gratuito.', 'error');
    if (uploadArea) uploadArea.style.display = 'none';
    if (dropZone)   dropZone.style.display   = 'block';
    return null;
  }

  try {
    // Step 0: Load
    renderProgressSteps(0); setProgress(5, 'Iniciando...');
    await delay(300);

    // Step 1: Read
    renderProgressSteps(1); setProgress(15, 'Leyendo documento...');
    const rawText = await readFileAsText(file);
    await delay(200);

    // Step 2-8: Analysis steps (visual)
    for (let i = 2; i <= 8; i++) {
      renderProgressSteps(i);
      setProgress(15 + (i * 8), ANALYSIS_STEPS[i].label);
      await delay(150);
    }

    // Step 9: Call Claude API
    renderProgressSteps(9); setProgress(82, 'Consultando SIEL IA...');

    const analysisResult = await callClaudeAnalysis(rawText, file.name);

    // Step 10: Done
    renderProgressSteps(10); setProgress(100, '¡Análisis completado!');
    await delay(500);

    // Save to DB
    const saved = await saveAnalysis({
      ...analysisResult,
      filename: file.name,
      raw_text: rawText.substring(0, 5000)
    });

    // Hide progress
    if (uploadArea) uploadArea.style.display = 'none';
    if (dropZone)   dropZone.style.display   = 'block';
    document.getElementById('prog-bar').style.width = '0';

    showToast('✓ Análisis completado exitosamente', 'success');
    return saved;

  } catch (e) {
    console.error('Analysis error:', e);
    showToast('Error en el análisis: ' + e.message, 'error');
    if (uploadArea) uploadArea.style.display = 'none';
    if (dropZone)   dropZone.style.display   = 'block';
    return null;
  }
}

// ── CALL CLAUDE ───────────────────────────────────────────
async function callClaudeAnalysis(docText, filename) {
  // If no API key, return demo analysis
  if (!SIEL_CONFIG.ANTHROPIC_KEY || SIEL_CONFIG.ANTHROPIC_KEY.includes('TU_')) {
    return generateDemoAnalysis(filename);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SIEL_CONFIG.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: SIEL_CONFIG.MODEL,
      max_tokens: SIEL_CONFIG.MAX_TOKENS,
      system: SIEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: ANALYSIS_PROMPT(docText, filename) }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error en la API de IA');
  }

  const data = await response.json();
  const text = data.content[0]?.text || '{}';

  // Clean and parse JSON
  let clean = text.trim();
  if (clean.startsWith('```')) clean = clean.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

  try {
    return JSON.parse(clean);
  } catch (e) {
    // Try to extract JSON from text
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('La IA no devolvió un análisis válido. Intenta de nuevo.');
  }
}

// ── DEMO ANALYSIS (when no API key) ───────────────────────
function generateDemoAnalysis(filename) {
  return {
    nombre: 'Contrato de Prestación de Servicios Profesionales',
    entidad: 'Entidad Pública Demo',
    sector: 'servicios',
    valor: '$850.000.000 COP',
    fecha_cierre: '30 de julio de 2025',
    modalidad: 'Selección Abreviada',
    objeto: 'Prestación de servicios profesionales especializados para la implementación y soporte de sistemas de información institucional.',
    score_total: 74,
    score_juridico: 82,
    score_financiero: 68,
    score_tecnico: 78,
    score_economico: 70,
    nivel_riesgo: 'MEDIO',
    nivel_complejidad: 'MEDIA',
    probabilidad_exito: 'ALTA',
    decision: 'PARTICIPAR_CON_CONDICIONES',
    resumen_ejecutivo: 'Este proceso corresponde a una selección abreviada para servicios profesionales con un presupuesto de $850M COP. El proceso presenta condiciones habilitantes alcanzables para empresas con experiencia en el sector TI de al menos 5 años. Se identifican oportunidades competitivas dado el presupuesto adecuado al mercado, aunque se requiere atención especial en los indicadores financieros de liquidez. La entidad tiene historial de procesos transparentes en SECOP, lo que representa una señal positiva.',
    justificacion_decision: 'Se recomienda PARTICIPAR CON CONDICIONES. El proceso presenta una viabilidad general de 74/100, con fortaleza en los aspectos jurídicos y técnicos. El principal obstáculo identificado es el índice de liquidez requerido (1.8) que podría estar por encima de los indicadores actuales de la empresa. Se recomienda verificar los estados financieros del último período y evaluar si es necesario conformar una unión temporal para robustecer el perfil financiero. El objeto contractual es alcanzable técnicamente y el presupuesto es competitivo con el mercado.',
    analisis_juridico: 'El proceso se rige bajo la Ley 80 de 1993 y la Ley 1150 de 2007, modalidad selección abreviada por cuantía. Los requisitos habilitantes jurídicos incluyen RUT vigente, certificado de existencia y representación legal con expedición no mayor a 30 días, y certificación de estar a paz y salvo con obligaciones tributarias y parafiscales. No se identifican cláusulas restrictivas que limiten la participación de forma inequitativa. El pliego cumple con los principios de transparencia y publicidad del SECOP II.',
    analisis_financiero: 'Los indicadores financieros requeridos incluyen razón corriente ≥ 1.5, índice de endeudamiento ≤ 70%, y patrimonio líquido mínimo de $200M COP. Se requiere capital de trabajo suficiente para soportar al menos 3 meses de operación sin desembolso. El presupuesto oficial de $850M COP permite márgenes operativos del 15-20% según benchmarks del sector, lo que representa una oportunidad rentable. Se debe verificar la capacidad residual de contratación que no debe estar comprometida por contratos en ejecución que superen el 50% de la capacidad.',
    analisis_tecnico: 'Se requiere experiencia mínima de 5 años en proyectos similares, con al menos 2 contratos de objeto similar ejecutados en los últimos 10 años por valor igual o superior al 50% del presupuesto. El personal clave debe incluir un director de proyecto con certificación PMP o equivalente, y especialistas técnicos con certificaciones específicas en las tecnologías requeridas. La propuesta técnica tendrá un peso del 40% en la calificación total, lo que representa una oportunidad de diferenciación si se presenta un enfoque metodológico sólido.',
    analisis_economico: 'El presupuesto oficial de $850M COP está alineado con los precios del mercado para servicios similares. Las condiciones de pago son mensuales contra entregables, lo que requiere flujo de caja robusto para los primeros 60 días. No se identifican cláusulas de desequilibrio económico ni restricciones de precios artificialmente bajos. La fórmula de evaluación económica favorece propuestas cercanas al presupuesto oficial, por lo que se recomienda una oferta entre el 92-97% del valor estimado para maximizar puntaje.',
    checklist: [
      { item: 'RUT actualizado', descripcion: 'Registro Único Tributario vigente año en curso', estado: 'CUMPLE', observacion: 'Documento estándar, fácil de obtener' },
      { item: 'Certificado de existencia', descripcion: 'Expedición no mayor a 30 días', estado: 'REVISAR', observacion: 'Verificar fecha de expedición del certificado actual' },
      { item: 'Razón corriente ≥ 1.5', descripcion: 'Indicador de liquidez mínimo requerido', estado: 'REVISAR', observacion: 'Verificar estados financieros del último ejercicio fiscal' },
      { item: 'Patrimonio líquido ≥ $200M', descripcion: 'Mínimo patrimonial para habilitación', estado: 'CUMPLE', observacion: 'Según la información disponible, el requisito es alcanzable' },
      { item: 'Experiencia 5 años sector', descripcion: 'Mínimo 2 contratos similares últimos 10 años', estado: 'CUMPLE', observacion: 'Preparar actas de liquidación o certificaciones de cumplimiento' },
      { item: 'Paz y salvo tributario', descripcion: 'Certificado DIAN sin obligaciones pendientes', estado: 'CUMPLE', observacion: 'Solicitar con al menos 2 semanas de anticipación al cierre' },
      { item: 'Garantía de seriedad', descripcion: 'Póliza por el 10% del presupuesto', estado: 'REVISAR', observacion: 'Cotizar con aseguradora con al menos 5 días de anticipación' },
      { item: 'Propuesta técnica y económica', descripcion: 'Documentos sustanciales de la oferta', estado: 'FALTA_INFO', observacion: 'Preparar con suficiente tiempo, son el núcleo de la propuesta' },
    ],
    riesgos: [
      { titulo: 'Indicadores financieros ajustados', nivel: 'ALTO', descripcion: 'El índice de liquidez requerido (1.5) puede estar cercano o por encima de los indicadores actuales de la empresa, lo que podría generar inhabilitación en la evaluación financiera.', mitigacion: 'Evaluar conformación de unión temporal con empresa de mayor musculatura financiera o presentar estados financieros consolidados.' },
      { titulo: 'Competencia alta por valor atractivo', nivel: 'MEDIO', descripcion: 'El presupuesto de $850M COP es atractivo para el sector, lo que puede generar alta concurrencia de proponentes calificados y reducir la probabilidad de éxito estadística.', mitigacion: 'Diferenciarse en la propuesta técnica con metodología innovadora y personal altamente calificado.' },
      { titulo: 'Riesgo de flujo de caja inicial', nivel: 'MEDIO', descripcion: 'Las condiciones de pago mensuales contra entregables exigen capital de trabajo para los primeros 60 días sin desembolso del contratante.', mitigacion: 'Planificar financiamiento del capital de trabajo operativo o negociar un anticipo en la etapa de adjudicación.' },
      { titulo: 'Plazos de entrega ajustados', nivel: 'BAJO', descripcion: 'El cronograma del contrato presenta hitos de entrega con poca holgura para contingencias técnicas o administrativas.', mitigacion: 'Incluir plan de contingencia en la propuesta técnica y asignar recursos adicionales de respaldo.' },
    ],
    alertas: [
      { tipo: 'ADVERTENCIA', titulo: 'Verificar liquidez antes del cierre', descripcion: 'El indicador de razón corriente requerido puede ser restrictivo. Revisar los estados financieros con contador antes de presentar la propuesta para confirmar el cumplimiento.' },
      { tipo: 'ADVERTENCIA', titulo: 'Antigüedad del certificado de existencia', descripcion: 'El certificado de existencia y representación legal debe tener expedición no mayor a 30 días. Solicitar actualización si el actual supera esa fecha.' },
      { tipo: 'INFO', titulo: 'Oportunidad de diferenciación técnica', descripcion: 'El peso del 40% en propuesta técnica representa una oportunidad significativa. Una propuesta técnica excepcional puede compensar una oferta económica no necesariamente la más baja.' },
      { tipo: 'INFO', titulo: 'Proceso con historial transparente', descripcion: 'La entidad tiene historial de procesos en SECOP sin observaciones de irregularidades, lo que reduce el riesgo de participación en procesos viciados.' },
    ],
    recomendaciones: [
      { titulo: 'Verificar indicadores financieros con contador', descripcion: 'Antes de preparar la propuesta, solicitar al contador de la empresa los estados financieros del último ejercicio y calcular razón corriente, endeudamiento y patrimonio. Si no se cumplen, explorar inmediatamente la opción de unión temporal.', categoria: 'FINANCIERO', prioridad: 'ALTA' },
      { titulo: 'Preparar propuesta técnica diferenciadora', descripcion: 'Dedicar el 60% del esfuerzo de preparación a la propuesta técnica. Incluir metodología con enfoque en gestión ágil, casos de éxito similares documentados, y perfiles de personal con certificaciones internacionales vigentes.', categoria: 'TÉCNICO', prioridad: 'ALTA' },
      { titulo: 'Gestionar garantía de seriedad con anticipación', descripcion: 'Contactar a la aseguradora o banco con al menos 5 días hábiles antes del cierre para gestionar la póliza de seriedad. Calcular el valor exacto: 10% de $850M = $85M COP.', categoria: 'JURÍDICO', prioridad: 'MEDIA' },
      { titulo: 'Estrategia de precio cercana al presupuesto oficial', descripcion: 'Según la fórmula de evaluación del pliego, presentar oferta entre el 92-97% del presupuesto oficial ($782M-$824.5M COP) maximiza el puntaje económico sin comprometer la rentabilidad.', categoria: 'ECONÓMICO', prioridad: 'MEDIA' },
    ]
  };
}

// ── CHAT WITH SIEL ────────────────────────────────────────
async function chatWithSIEL(messages, analysesContext) {
  if (!SIEL_CONFIG.ANTHROPIC_KEY || SIEL_CONFIG.ANTHROPIC_KEY.includes('TU_')) {
    return getChatFallback(messages[messages.length-1]?.content || '');
  }

  const contextStr = analysesContext.length > 0
    ? `\n\nCONTEXTO DE LICITACIONES DEL USUARIO:\n${analysesContext.map((a,i) =>
        `${i+1}. ${a.nombre} | ${a.entidad} | Score: ${a.score_total}/100 | Decisión: ${a.decision} | Riesgo: ${a.nivel_riesgo}`
      ).join('\n')}`
    : '\n\nEl usuario aún no tiene análisis cargados.';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SIEL_CONFIG.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: SIEL_CONFIG.MODEL,
      max_tokens: 800,
      system: SIEL_SYSTEM_PROMPT + contextStr + '\n\nResponde de forma concisa, estratégica y profesional. Máximo 150 palabras. Usa emojis ocasionalmente para claridad.',
      messages
    })
  });

  if (!response.ok) throw new Error('Error en el chat IA');
  const data = await response.json();
  return data.content[0]?.text || 'No pude generar una respuesta. Intenta de nuevo.';
}

function getChatFallback(question) {
  const q = question.toLowerCase();
  if (q.includes('riesgo') || q.includes('peligro')) return '⚠️ Para evaluar riesgos específicos necesito ver el análisis de tu licitación. Los riesgos más comunes en contratación pública colombiana son: incumplimiento de indicadores financieros, experiencia insuficiente, y pliegos con requisitos restrictivos. ¿Tienes algún análisis cargado sobre el que quieras profundizar?';
  if (q.includes('viabilidad') || q.includes('score') || q.includes('puntaje')) return '📊 El score de viabilidad SIEL evalúa 4 dimensiones: Jurídica (25%), Financiera (25%), Técnica (25%) y Económica (25%). Un score ≥ 70 indica alta viabilidad. Para mejorar el score, primero identifica las dimensiones más bajas y trabaja en subsanar esas brechas específicas.';
  if (q.includes('document') || q.includes('requisito')) return '📋 Los documentos más frecuentemente solicitados en licitaciones colombianas: RUT, certificado de existencia y representación, estados financieros firmados, RESO o RUP, paz y salvo tributario/parafiscal, certificados de experiencia, y garantía de seriedad. Verifica siempre las fechas de vigencia de cada uno.';
  return '🤖 Soy SIEL Copilot. Puedo ayudarte a analizar licitaciones, entender requisitos, evaluar riesgos y definir estrategias de propuesta. Para un análisis personalizado, sube tu pliego desde "Analizar Pliego" y luego podré darte respuestas específicas sobre ese proceso.';
}

// ── UTILS ─────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

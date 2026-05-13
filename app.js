// ============================================================
//  SIEL — CONTROLADOR PRINCIPAL DE LA APLICACIÓN
// ============================================================

let allAnalyses = [];
let currentAnalysis = null;
let chatHistory = [];
let compareSelected = [];

// ── BOOT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initSupabase();

  // Check existing session
  const hasSession = await checkSession();
  if (hasSession) launchApp();

  // File input
  const fileInp = document.getElementById('file-inp');
  if (fileInp) fileInp.addEventListener('change', e => {
    if (e.target.files[0]) handleFileUpload(e.target.files[0]);
  });

  // Drag & drop
  const dz = document.getElementById('drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) handleFileUpload(f);
    });
  }
});

// ── LAUNCH APP ────────────────────────────────────────────
async function launchApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('app').style.flexDirection = 'row';
  document.getElementById('app').style.minHeight = '100vh';

  // Fill user info
  const name    = currentProfile?.nombre || currentUser?.email?.split('@')[0] || 'Usuario';
  const company = currentProfile?.empresa || '';
  const plan    = currentProfile?.plan || 'starter';
  const initials = name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();

  document.getElementById('sb-name').textContent    = name;
  document.getElementById('sb-company').textContent = company;
  document.getElementById('sb-plan').textContent    = plan.charAt(0).toUpperCase() + plan.slice(1);
  document.getElementById('sb-av').textContent      = initials;

  // Nav listeners
  document.querySelectorAll('.sb-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  // Load data
  await refreshAnalyses();
  showPage('dashboard');
  initChat();
}

// ── REFRESH DATA ──────────────────────────────────────────
async function refreshAnalyses() {
  allAnalyses = await getAnalyses();
  updateSidebarCount();
  updateDashboard();
  renderRecentList();
  renderAllList();
  renderCompareSelect();
  renderAlerts();
}

// ── SIDEBAR COUNT ─────────────────────────────────────────
function updateSidebarCount() {
  document.getElementById('sb-count').textContent = allAnalyses.length;
  const alertCount = allAnalyses.reduce((acc, a) => {
    return acc + (a.alertas?.filter(al => al.tipo === 'CRITICA').length || 0);
  }, 0);
  const alertEl = document.getElementById('sb-alerts');
  alertEl.textContent = alertCount;
  alertEl.style.display = alertCount > 0 ? 'inline' : 'none';

  const dot = document.getElementById('tb-notif-dot');
  if (dot) dot.style.display = alertCount > 0 ? 'block' : 'none';
}

// ── NAVIGATION ────────────────────────────────────────────
const PAGE_META = {
  dashboard:   ['Dashboard', 'Resumen ejecutivo de tus licitaciones'],
  upload:      ['Analizar Pliego', 'Sube un documento para análisis IA completo'],
  licitaciones:['Mis Análisis', 'Historial de licitaciones evaluadas'],
  analisis:    ['Análisis Detallado', 'Los 13 puntos estratégicos SIEL'],
  comparar:    ['Comparar', 'Análisis comparativo lado a lado'],
  alertas:     ['Alertas', 'Alertas críticas y notificaciones'],
  asistente:   ['SIEL Copilot IA', 'Tu asistente estratégico de contratación'],
  suscripcion: ['Suscripción', 'Planes y funcionalidades'],
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));

  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');

  const btn = document.querySelector(`.sb-item[data-page="${id}"]`);
  if (btn) btn.classList.add('active');

  const meta = PAGE_META[id] || [id, ''];
  document.getElementById('page-title').textContent = meta[0];
  document.getElementById('page-sub').textContent   = meta[1];
}

// ── DASHBOARD ─────────────────────────────────────────────
function updateDashboard() {
  const total  = allAnalyses.length;
  const scores = allAnalyses.map(a => a.score_total).filter(s => s != null);
  const avg    = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
  const high   = allAnalyses.filter(a => a.score_total >= 70).length;
  const risk   = allAnalyses.filter(a => ['ALTO','CRÍTICO'].includes(a.nivel_riesgo)).length;

  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-score').textContent = avg != null ? avg + '/100' : '—';
  document.getElementById('kpi-high').textContent  = high;
  document.getElementById('kpi-risk').textContent  = risk;

  // Distribution bars
  const low   = allAnalyses.filter(a => a.score_total < 40).length;
  const med   = allAnalyses.filter(a => a.score_total >= 40 && a.score_total < 70).length;
  const maxN  = Math.max(high, med, low, 1);

  document.getElementById('dist-high').style.width = (high/maxN*100) + '%';
  document.getElementById('dist-med').style.width  = (med/maxN*100)  + '%';
  document.getElementById('dist-low').style.width  = (low/maxN*100)  + '%';
  document.getElementById('dist-high-n').textContent = high;
  document.getElementById('dist-med-n').textContent  = med;
  document.getElementById('dist-low-n').textContent  = low;
}

// ── RECENT LIST ───────────────────────────────────────────
function renderRecentList() {
  const el = document.getElementById('recent-list');
  if (!el) return;

  if (allAnalyses.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-folder-open"></i>
      <h4>Sin análisis aún</h4>
      <p>Sube tu primer pliego de licitación para comenzar</p>
      <button class="btn-primary-sm" onclick="showPage('upload')">Analizar primer pliego</button>
    </div>`;
    return;
  }

  el.innerHTML = allAnalyses.slice(0, 6).map(a => `
    <div class="lic-item" onclick="openAnalysis('${a.id}')">
      <div class="lic-icon ${getScoreClass(a.score_total)}" style="background:${getScoreBg(a.score_total)}">
        ${getDecisionEmoji(a.decision)}
      </div>
      <div class="lic-info">
        <div class="lic-name">${a.nombre || a.filename || 'Sin nombre'}</div>
        <div class="lic-meta">${a.entidad || '—'} · ${formatDate(a.created_at)}</div>
      </div>
      <span class="score-pill ${getScoreClass(a.score_total)}">${a.score_total ?? '—'}</span>
    </div>
  `).join('');
}

// ── ALL LIST ──────────────────────────────────────────────
function renderAllList() {
  const el = document.getElementById('all-list');
  if (!el) return;

  if (allAnalyses.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-folder-open"></i>
      <h4>Sin análisis aún</h4>
      <p>Tus análisis aparecerán aquí</p>
    </div>`;
    return;
  }

  el.innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead>
      <tr>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border);background:var(--navy)">Proceso</th>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--navy)">Entidad</th>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--navy)">Score</th>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--navy)">Decisión</th>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--navy)">Riesgo</th>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--navy)">Fecha</th>
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--navy)">Acción</th>
      </tr>
    </thead>
    <tbody>
      ${allAnalyses.map(a => `
        <tr style="cursor:pointer" onclick="openAnalysis('${a.id}')">
          <td style="padding:12px 16px;border-bottom:1px solid var(--border)">
            <div style="font-weight:600;font-size:13px">${truncate(a.nombre || a.filename, 35)}</div>
            <div style="font-size:11px;color:var(--text3)">${a.sector || '—'}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)">${a.entidad || '—'}</td>
          <td style="padding:12px 16px;border-bottom:1px solid var(--border)"><span class="score-pill ${getScoreClass(a.score_total)}">${a.score_total ?? '—'}</span></td>
          <td style="padding:12px 16px;border-bottom:1px solid var(--border)">${getDecisionBadge(a.decision)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid var(--border)">${getRiskBadge(a.nivel_riesgo)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">${formatDate(a.created_at)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid var(--border)">
            <button class="btn-sm" onclick="event.stopPropagation();openAnalysis('${a.id}')">Ver</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

// ── OPEN ANALYSIS DETAIL ──────────────────────────────────
async function openAnalysis(id) {
  currentAnalysis = allAnalyses.find(a => a.id === id);
  if (!currentAnalysis) return;
  renderAnalysisDetail(currentAnalysis);
  showPage('analisis');
}

function renderAnalysisDetail(a) {
  const scoreClass = getScoreClass(a.score_total);
  const decisionInfo = getDecisionInfo(a.decision);

  document.getElementById('analisis-content').innerHTML = `
    <!-- HEADER -->
    <div class="analysis-header">
      <div class="ah-top">
        <div>
          <div class="ah-title">${a.nombre || a.filename || 'Análisis de Licitación'}</div>
          <div class="ah-meta">${a.entidad || 'Entidad no identificada'} · ${a.sector || ''} · ${a.modalidad || ''} · Analizado el ${formatDate(a.created_at)}</div>
          ${a.objeto ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;line-height:1.5">${a.objeto}</div>` : ''}
        </div>
        <div class="ah-score-block">
          <div class="ah-score-num">${a.score_total ?? '—'}</div>
          <div class="ah-score-label">Score de Viabilidad</div>
          <div class="ah-score-sub" style="color:${scoreClass==='score-high'?'var(--green)':scoreClass==='score-med'?'var(--gold)':'var(--red)'}">
            ${a.probabilidad_exito || '—'}
          </div>
        </div>
      </div>

      <!-- DECISION BLOCK -->
      <div class="decision-block ${decisionInfo.cls}">
        <div class="decision-title">
          <i class="fa-solid ${decisionInfo.icon}" style="color:${decisionInfo.color}"></i>
          ${decisionInfo.label}
        </div>
        <div class="decision-body">${a.justificacion_decision || 'Análisis en proceso.'}</div>
      </div>

      <!-- MINI SCORES -->
      <div class="scores-row">
        ${[['Jurídico',a.score_juridico],['Financiero',a.score_financiero],['Técnico',a.score_tecnico],['Económico',a.score_economico]].map(([l,v])=>`
          <div class="mini-score">
            <div class="ms-label">${l}</div>
            <div class="ms-val ${getScoreClass(v).replace('score-','')}">${v ?? '—'}</div>
          </div>
        `).join('')}
      </div>

      <!-- BADGES ROW -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(26,111,255,.15);color:var(--blue3);border:1px solid rgba(26,111,255,.25)">
          Complejidad: ${a.nivel_complejidad || '—'}
        </span>
        ${getRiskBadgeInline(a.nivel_riesgo)}
        ${a.valor ? `<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(240,180,41,.12);color:var(--gold);border:1px solid rgba(240,180,41,.2)">💰 ${a.valor}</span>` : ''}
        ${a.fecha_cierre ? `<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(255,64,96,.1);color:var(--red);border:1px solid rgba(255,64,96,.2)">📅 Cierre: ${a.fecha_cierre}</span>` : ''}
      </div>
    </div>

    <!-- TABS -->
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('resumen',this)">📋 Resumen</button>
      <button class="tab-btn" onclick="switchTab('juridico',this)">⚖️ Jurídico</button>
      <button class="tab-btn" onclick="switchTab('financiero',this)">💰 Financiero</button>
      <button class="tab-btn" onclick="switchTab('tecnico',this)">⚙️ Técnico</button>
      <button class="tab-btn" onclick="switchTab('economico',this)">📊 Económico</button>
      <button class="tab-btn" onclick="switchTab('checklist',this)">✅ Checklist</button>
      <button class="tab-btn" onclick="switchTab('riesgos',this)">⚠️ Riesgos</button>
      <button class="tab-btn" onclick="switchTab('alertas_d',this)">🔔 Alertas</button>
      <button class="tab-btn" onclick="switchTab('recomendaciones',this)">🚀 Recomendaciones</button>
    </div>

    <!-- TAB: RESUMEN -->
    <div class="tab-pane active" id="tab-resumen">
      <div class="section-block">
        <h4><i class="fa-solid fa-file-lines"></i> Resumen Ejecutivo</h4>
        <div class="prose">${a.resumen_ejecutivo || 'No disponible.'}</div>
      </div>
      <div class="section-block">
        <h4><i class="fa-solid fa-circle-info"></i> Información del Proceso</h4>
        <table class="info-table">
          <tr><td>Entidad</td><td>${a.entidad||'—'}</td></tr>
          <tr><td>Modalidad</td><td>${a.modalidad||'—'}</td></tr>
          <tr><td>Sector</td><td>${a.sector||'—'}</td></tr>
          <tr><td>Valor estimado</td><td style="color:var(--gold)">${a.valor||'—'}</td></tr>
          <tr><td>Cierre de propuestas</td><td>${a.fecha_cierre||'—'}</td></tr>
          <tr><td>Nivel de riesgo</td><td>${getRiskBadge(a.nivel_riesgo)}</td></tr>
          <tr><td>Complejidad</td><td>${a.nivel_complejidad||'—'}</td></tr>
          <tr><td>Prob. de éxito</td><td>${a.probabilidad_exito||'—'}</td></tr>
        </table>
      </div>
    </div>

    <!-- TAB: JURÍDICO -->
    <div class="tab-pane" id="tab-juridico">
      <div class="section-block">
        <h4><i class="fa-solid fa-gavel"></i> Análisis Jurídico</h4>
        <div class="prose">${a.analisis_juridico || 'No disponible.'}</div>
      </div>
    </div>

    <!-- TAB: FINANCIERO -->
    <div class="tab-pane" id="tab-financiero">
      <div class="section-block">
        <h4><i class="fa-solid fa-chart-line"></i> Análisis Financiero</h4>
        <div class="prose">${a.analisis_financiero || 'No disponible.'}</div>
      </div>
    </div>

    <!-- TAB: TÉCNICO -->
    <div class="tab-pane" id="tab-tecnico">
      <div class="section-block">
        <h4><i class="fa-solid fa-cogs"></i> Análisis Técnico</h4>
        <div class="prose">${a.analisis_tecnico || 'No disponible.'}</div>
      </div>
    </div>

    <!-- TAB: ECONÓMICO -->
    <div class="tab-pane" id="tab-economico">
      <div class="section-block">
        <h4><i class="fa-solid fa-coins"></i> Análisis Económico</h4>
        <div class="prose">${a.analisis_economico || 'No disponible.'}</div>
      </div>
    </div>

    <!-- TAB: CHECKLIST -->
    <div class="tab-pane" id="tab-checklist">
      <div class="section-block">
        <h4><i class="fa-solid fa-list-check"></i> Checklist Documental</h4>
        ${renderChecklist(a.checklist)}
      </div>
    </div>

    <!-- TAB: RIESGOS -->
    <div class="tab-pane" id="tab-riesgos">
      <div class="section-block">
        <h4><i class="fa-solid fa-triangle-exclamation"></i> Matriz de Riesgos</h4>
        ${renderRisks(a.riesgos)}
      </div>
    </div>

    <!-- TAB: ALERTAS -->
    <div class="tab-pane" id="tab-alertas_d">
      <div class="section-block">
        <h4><i class="fa-solid fa-bell"></i> Alertas Automáticas</h4>
        ${renderAlertsInline(a.alertas)}
      </div>
    </div>

    <!-- TAB: RECOMENDACIONES -->
    <div class="tab-pane" id="tab-recomendaciones">
      <div class="section-block">
        <h4><i class="fa-solid fa-lightbulb"></i> Recomendaciones Estratégicas</h4>
        ${renderRecommendations(a.recomendaciones)}
      </div>
    </div>
  `;
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const pane = document.getElementById('tab-' + id);
  if (pane) pane.classList.add('active');
}

// ── RENDER CHECKLIST ──────────────────────────────────────
function renderChecklist(items) {
  if (!items || !items.length) return '<p style="color:var(--text2);font-size:13px">Checklist no disponible.</p>';
  const map = { CUMPLE: ['ok','check','Cumple'], REVISAR: ['warn','exclamation','Revisar'], 'NO_CUMPLE': ['fail','times','No cumple'], 'FALTA_INFO': ['warn','question','Sin info'] };
  return `<div class="checklist">${items.map(it => {
    const [cls, ico, tag] = map[it.estado] || map['FALTA_INFO'];
    return `<div class="chk-item ${cls}">
      <div class="chk-icon"><i class="fa-solid fa-${ico}"></i></div>
      <div class="chk-body">
        <strong>${it.item}</strong>
        <p>${it.descripcion || ''}</p>
        ${it.observacion ? `<span class="chk-tag">${it.observacion}</span>` : ''}
      </div>
      <span class="chk-tag">${tag}</span>
    </div>`;
  }).join('')}</div>`;
}

// ── RENDER RISKS ──────────────────────────────────────────
function renderRisks(risks) {
  if (!risks || !risks.length) return '<p style="color:var(--text2);font-size:13px">Sin riesgos identificados.</p>';
  const order = { ALTO:0, MEDIO:1, BAJO:2 };
  return `<div class="risk-list">${[...risks].sort((a,b)=>(order[a.nivel]||1)-(order[b.nivel]||1)).map(r => `
    <div class="risk-item ${r.nivel?.toLowerCase() || 'medio'}">
      <div class="risk-head">
        <span class="risk-title">${r.titulo}</span>
        <span class="risk-badge">${r.nivel}</span>
      </div>
      <p class="risk-desc">${r.descripcion}</p>
      ${r.mitigacion ? `<p style="font-size:11px;color:var(--blue3);margin-top:5px">💡 ${r.mitigacion}</p>` : ''}
    </div>
  `).join('')}</div>`;
}

// ── RENDER ALERTS INLINE ──────────────────────────────────
function renderAlertsInline(alerts) {
  if (!alerts || !alerts.length) return '<p style="color:var(--text2);font-size:13px">Sin alertas generadas.</p>';
  const map = { CRITICA: ['critical','circle-xmark'], ADVERTENCIA: ['warning','triangle-exclamation'], INFO: ['info','circle-info'] };
  return alerts.map(al => {
    const [cls, ico] = map[al.tipo] || map['INFO'];
    return `<div class="alert-item ${cls}">
      <i class="fa-solid fa-${ico}"></i>
      <div class="alert-text"><h4>${al.titulo}</h4><p>${al.descripcion}</p></div>
    </div>`;
  }).join('');
}

// ── RENDER RECOMMENDATIONS ────────────────────────────────
function renderRecommendations(recs) {
  if (!recs || !recs.length) return '<p style="color:var(--text2);font-size:13px">Sin recomendaciones disponibles.</p>';
  const sorted = [...recs].sort((a,b) => {
    const p = {ALTA:0, MEDIA:1, BAJA:2};
    return (p[a.prioridad]||1)-(p[b.prioridad]||1);
  });
  return `<div class="rec-list">${sorted.map((r,i) => `
    <div class="rec-item">
      <div class="rec-num">${i+1}</div>
      <div class="rec-body">
        <h4>${r.titulo}</h4>
        <p>${r.descripcion}</p>
        <div style="display:flex;gap:6px;margin-top:5px">
          <span class="rec-tag">${r.categoria || ''}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600;background:${r.prioridad==='ALTA'?'rgba(255,64,96,.12)':r.prioridad==='MEDIA'?'rgba(240,180,41,.12)':'rgba(0,196,140,.12)'};color:${r.prioridad==='ALTA'?'var(--red)':r.prioridad==='MEDIA'?'var(--gold)':'var(--green)'}">
            ${r.prioridad || ''}
          </span>
        </div>
      </div>
    </div>
  `).join('')}</div>`;
}

// ── GLOBAL ALERTS PAGE ────────────────────────────────────
function renderAlerts() {
  const el = document.getElementById('alertas-list');
  if (!el) return;

  const all = [];
  allAnalyses.forEach(a => {
    (a.alertas || []).forEach(al => {
      all.push({ ...al, source: a.nombre || a.filename || 'Sin nombre' });
    });
  });

  if (all.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell"></i><h4>Sin alertas activas</h4><p>Las alertas se generan automáticamente al analizar pliegos</p></div>`;
    return;
  }

  const sorted = all.sort((a,b) => {
    const o = {CRITICA:0, ADVERTENCIA:1, INFO:2};
    return (o[a.tipo]||1)-(o[b.tipo]||1);
  });

  const map = { CRITICA: ['critical','circle-xmark'], ADVERTENCIA: ['warning','triangle-exclamation'], INFO: ['info','circle-info'] };
  el.innerHTML = `<div style="padding:16px">` + sorted.map(al => {
    const [cls, ico] = map[al.tipo] || map['INFO'];
    return `<div class="alert-item ${cls}">
      <i class="fa-solid fa-${ico}"></i>
      <div class="alert-text">
        <h4>${al.titulo} <span style="font-size:10px;font-weight:400;color:var(--text3)">— ${al.source}</span></h4>
        <p>${al.descripcion}</p>
      </div>
    </div>`;
  }).join('') + `</div>`;
}

// ── COMPARE ───────────────────────────────────────────────
function renderCompareSelect() {
  const el = document.getElementById('compare-select-grid');
  if (!el) return;

  if (allAnalyses.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-scale-balanced"></i><h4>Sin análisis para comparar</h4><p>Sube al menos 2 pliegos para usar la comparación</p></div>`;
    return;
  }

  el.innerHTML = allAnalyses.map(a => `
    <div class="cmp-card" data-id="${a.id}" onclick="toggleCompare(this,'${a.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="cmp-name">${truncate(a.nombre || a.filename, 30)}</div>
        <span class="score-pill ${getScoreClass(a.score_total)}">${a.score_total ?? '—'}</span>
      </div>
      <div class="cmp-meta">${a.entidad || '—'} · ${formatDate(a.created_at)}</div>
      <div style="margin-top:6px">${getDecisionBadge(a.decision)}</div>
    </div>
  `).join('');
}

function toggleCompare(el, id) {
  el.classList.toggle('selected');
  compareSelected = [...document.querySelectorAll('.cmp-card.selected')].map(c => c.dataset.id);
  const res = document.getElementById('compare-result');

  if (compareSelected.length >= 2) {
    const a1 = allAnalyses.find(a => a.id === compareSelected[0]);
    const a2 = allAnalyses.find(a => a.id === compareSelected[1]);
    if (a1 && a2) renderCompareTable(a1, a2);
    res.style.display = 'block';
  } else {
    res.style.display = 'none';
  }
}

function renderCompareTable(a, b) {
  const el = document.getElementById('compare-result');
  const row = (label, av, bv, higherBetter=true) => {
    const an = parseFloat(av); const bn = parseFloat(bv);
    let aw='', bw='';
    if (!isNaN(an) && !isNaN(bn)) {
      if (an > bn) { aw = higherBetter ? '✅':'❌'; bw = higherBetter?'':'✅'; }
      else if (bn > an) { bw = higherBetter?'✅':'❌'; aw = higherBetter?'':'✅'; }
    }
    return `<tr>
      <td style="padding:8px 12px;font-size:12px;color:var(--text2);border-bottom:1px solid var(--border)">${label}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid var(--border)">${av || '—'} ${aw}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid var(--border)">${bv || '—'} ${bw}</td>
    </tr>`;
  };

  el.innerHTML = `
    <div class="section-block">
      <h4 style="font-size:14px;font-weight:600;margin-bottom:16px">Comparativa: ${truncate(a.nombre||a.filename,25)} vs ${truncate(b.nombre||b.filename,25)}</h4>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border)">Dimensión</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--blue3);text-transform:uppercase;border-bottom:1px solid var(--border)">${truncate(a.nombre||a.filename,20)}</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;border-bottom:1px solid var(--border)">${truncate(b.nombre||b.filename,20)}</th>
          </tr>
        </thead>
        <tbody>
          ${row('Score Total', a.score_total, b.score_total)}
          ${row('Score Jurídico', a.score_juridico, b.score_juridico)}
          ${row('Score Financiero', a.score_financiero, b.score_financiero)}
          ${row('Score Técnico', a.score_tecnico, b.score_tecnico)}
          ${row('Score Económico', a.score_economico, b.score_economico)}
          ${row('Nivel Riesgo', a.nivel_riesgo, b.nivel_riesgo, false)}
          ${row('Complejidad', a.nivel_complejidad, b.nivel_complejidad, false)}
          ${row('Valor', a.valor, b.valor, false)}
          <tr>
            <td style="padding:8px 12px;font-size:12px;color:var(--text2)">Decisión IA</td>
            <td style="padding:8px 12px">${getDecisionBadge(a.decision)}</td>
            <td style="padding:8px 12px">${getDecisionBadge(b.decision)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

// ── UPLOAD HANDLER ────────────────────────────────────────
async function handleFileUpload(file) {
  const result = await analyzeDocument(file);
  if (result) {
    await refreshAnalyses();
    setTimeout(() => openAnalysis(result.id), 300);
  }
}

// ── CHAT ──────────────────────────────────────────────────
function initChat() {
  chatHistory = [];
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  msgs.innerHTML = '';
  addChatMsg('ai', '👋 Hola, soy <strong>SIEL Copilot</strong>. Soy tu asistente estratégico de contratación pública y privada. Puedo ayudarte a entender requisitos, evaluar riesgos, diseñar estrategias de propuesta y tomar decisiones sobre licitaciones. ¿En qué puedo ayudarte hoy?');
}

function addChatMsg(role, html) {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  const now = new Date();
  const t = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
  d.innerHTML = `<div class="msg-bubble">${html}</div><div class="msg-time">${t}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTypingIndicator() {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg ai'; d.id = 'typing-bubble';
  d.innerHTML = '<div class="typing"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendChat() {
  const inp = document.getElementById('chat-inp');
  const txt = inp.value.trim();
  if (!txt) return;

  addChatMsg('user', txt);
  chatHistory.push({ role: 'user', content: txt });
  inp.value = '';
  showTypingIndicator();

  try {
    const ctx = allAnalyses.slice(0, 8);
    const reply = await chatWithSIEL(chatHistory, ctx);
    document.getElementById('typing-bubble')?.remove();
    chatHistory.push({ role: 'assistant', content: reply });
    addChatMsg('ai', reply);
  } catch (e) {
    document.getElementById('typing-bubble')?.remove();
    const fb = getChatFallback(txt);
    chatHistory.push({ role: 'assistant', content: fb });
    addChatMsg('ai', fb);
  }
}

function quickAsk(q) {
  document.getElementById('chat-inp').value = q;
  sendChat();
}

function chatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = { success:'fa-check-circle', error:'fa-circle-xmark', info:'fa-circle-info' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── HELPERS ───────────────────────────────────────────────
function getScoreClass(s) {
  if (s == null) return 'score-med';
  if (s >= 70) return 'score-high';
  if (s >= 40) return 'score-med';
  return 'score-low';
}

function getScoreBg(s) {
  if (s >= 70) return 'rgba(0,196,140,.15)';
  if (s >= 40) return 'rgba(240,180,41,.15)';
  return 'rgba(255,64,96,.15)';
}

function getDecisionEmoji(d) {
  if (d === 'PARTICIPAR') return '✅';
  if (d === 'NO_PARTICIPAR') return '❌';
  return '⚡';
}

function getDecisionInfo(d) {
  if (d === 'PARTICIPAR') return { cls:'participate', icon:'fa-check-circle', color:'var(--green)', label:'✅ RECOMENDACIÓN: PARTICIPAR' };
  if (d === 'NO_PARTICIPAR') return { cls:'skip', icon:'fa-times-circle', color:'var(--red)', label:'❌ RECOMENDACIÓN: NO PARTICIPAR' };
  return { cls:'conditional', icon:'fa-exclamation-circle', color:'var(--gold)', label:'⚡ RECOMENDACIÓN: PARTICIPAR CON CONDICIONES' };
}

function getDecisionBadge(d) {
  if (d === 'PARTICIPAR') return `<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:rgba(0,196,140,.15);color:var(--green);border:1px solid rgba(0,196,140,.2)">✅ Participar</span>`;
  if (d === 'NO_PARTICIPAR') return `<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:rgba(255,64,96,.15);color:var(--red);border:1px solid rgba(255,64,96,.2)">❌ No participar</span>`;
  return `<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:rgba(240,180,41,.15);color:var(--gold);border:1px solid rgba(240,180,41,.2)">⚡ Con condiciones</span>`;
}

function getRiskBadge(r) {
  const map = { BAJO:'rgba(0,196,140,.15)/var(--green)/rgba(0,196,140,.2)', MEDIO:'rgba(240,180,41,.15)/var(--gold)/rgba(240,180,41,.2)', ALTO:'rgba(255,64,96,.15)/var(--red)/rgba(255,64,96,.2)', 'CRÍTICO':'rgba(255,64,96,.2)/var(--red)/rgba(255,64,96,.3)' };
  const parts = (map[r] || map['MEDIO']).split('/');
  return `<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:${parts[0]};color:${parts[1]};border:1px solid ${parts[2]}">${r||'—'}</span>`;
}

function getRiskBadgeInline(r) {
  const colors = { BAJO:'var(--green)', MEDIO:'var(--gold)', ALTO:'var(--red)', 'CRÍTICO':'var(--red)' };
  const bgs = { BAJO:'rgba(0,196,140,.12)', MEDIO:'rgba(240,180,41,.12)', ALTO:'rgba(255,64,96,.12)', 'CRÍTICO':'rgba(255,64,96,.18)' };
  const c = colors[r] || 'var(--gold)'; const bg = bgs[r] || bgs['MEDIO'];
  return `<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${bg};color:${c};border:1px solid ${c}30">🎯 Riesgo: ${r||'—'}</span>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' });
}

function truncate(str, n) {
  if (!str) return '—';
  return str.length > n ? str.substring(0, n) + '…' : str;
}

// ============================================================
//  SIEL — BASE DE DATOS (Supabase PostgreSQL)
// ============================================================

// In-memory store for demo mode (when Supabase is not configured)
let demoStore = {
  analyses: []
};

const isDemo = () => !supabase || SIEL_CONFIG.SUPABASE_URL.includes('TU_PROYECTO');

// ── SAVE ANALYSIS ─────────────────────────────────────────
async function saveAnalysis(analysisData) {
  const record = {
    ...analysisData,
    user_id: currentUser?.id || 'demo',
    created_at: new Date().toISOString()
  };

  if (isDemo()) {
    record.id = 'demo-' + Date.now();
    demoStore.analyses.unshift(record);
    return record;
  }

  try {
    const { data, error } = await supabase
      .from('analyses')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Save analysis error:', e);
    // Fallback to demo store
    record.id = 'local-' + Date.now();
    demoStore.analyses.unshift(record);
    return record;
  }
}

// ── GET ALL ANALYSES ──────────────────────────────────────
async function getAnalyses() {
  if (isDemo()) return demoStore.analyses;

  try {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Get analyses error:', e);
    return demoStore.analyses;
  }
}

// ── GET SINGLE ANALYSIS ───────────────────────────────────
async function getAnalysis(id) {
  if (isDemo()) {
    return demoStore.analyses.find(a => a.id === id) || null;
  }

  try {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    return demoStore.analyses.find(a => a.id === id) || null;
  }
}

// ── DELETE ANALYSIS ───────────────────────────────────────
async function deleteAnalysis(id) {
  if (isDemo()) {
    demoStore.analyses = demoStore.analyses.filter(a => a.id !== id);
    return true;
  }

  try {
    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);
    if (error) throw error;
    return true;
  } catch (e) {
    demoStore.analyses = demoStore.analyses.filter(a => a.id !== id);
    return true;
  }
}

// ── COUNT THIS MONTH (for free plan limit) ────────────────
async function countThisMonth() {
  const start = new Date();
  start.setDate(1); start.setHours(0,0,0,0);

  if (isDemo()) {
    return demoStore.analyses.filter(a =>
      new Date(a.created_at) >= start
    ).length;
  }

  try {
    const { count } = await supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .gte('created_at', start.toISOString());
    return count || 0;
  } catch (e) {
    return 0;
  }
}

// ── SUPABASE SQL SCHEMA (run this in Supabase SQL Editor) ──
/*
-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT,
  empresa TEXT,
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own profile"
  ON profiles FOR ALL USING (auth.uid() = id);

-- Analyses table
CREATE TABLE analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  filename TEXT,
  nombre TEXT,
  entidad TEXT,
  sector TEXT,
  valor TEXT,
  fecha_cierre TEXT,
  score_total INTEGER,
  score_juridico INTEGER,
  score_financiero INTEGER,
  score_tecnico INTEGER,
  score_economico INTEGER,
  nivel_riesgo TEXT,
  nivel_complejidad TEXT,
  probabilidad_exito TEXT,
  decision TEXT,
  resumen_ejecutivo TEXT,
  analisis_juridico TEXT,
  analisis_financiero TEXT,
  analisis_tecnico TEXT,
  analisis_economico TEXT,
  checklist JSONB,
  riesgos JSONB,
  alertas JSONB,
  recomendaciones JSONB,
  justificacion_decision TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own analyses"
  ON analyses FOR ALL USING (auth.uid() = user_id);
*/

// ============================================================
//  SIEL — CONFIGURACIÓN
//  Reemplaza estos valores con los tuyos de Supabase
//  Los consigues en: https://supabase.com → tu proyecto → Settings → API
// ============================================================

const SIEL_CONFIG = {

  // ─── SUPABASE ───────────────────────────────────────────
  // 1. Ve a supabase.com → New project
  // 2. Settings → API → copia "Project URL" y "anon public"
  SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_ANON_KEY_AQUI',

  // ─── ANTHROPIC (Claude IA) ──────────────────────────────
  // Tu API key de Anthropic: https://console.anthropic.com
  // IMPORTANTE: Para producción real, esta key debe estar en un backend.
  // Para esta versión de demostración/prototipo va aquí directamente.
  ANTHROPIC_KEY: 'TU_ANTHROPIC_API_KEY_AQUI',

  // ─── APP ────────────────────────────────────────────────
  APP_NAME: 'SIEL',
  APP_VERSION: '2.5.0',
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 4000,

  // Límite de análisis para plan gratuito
  FREE_PLAN_LIMIT: 3,
};

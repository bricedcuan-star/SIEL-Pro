// ============================================================
//  SIEL — AUTENTICACIÓN (Supabase Auth)
// ============================================================

let supabase = null;
let currentUser = null;
let currentProfile = null;

function initSupabase() {
  try {
    supabase = window.supabase.createClient(
      SIEL_CONFIG.SUPABASE_URL,
      SIEL_CONFIG.SUPABASE_ANON_KEY
    );
    return true;
  } catch (e) {
    console.error('Supabase init error:', e);
    return false;
  }
}

// ── SHOW/HIDE AUTH FORMS ──────────────────────────────────
function showLogin() {
  document.getElementById('login-card').style.display = 'block';
  document.getElementById('register-card').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('register-card').style.display = 'block';
}

// ── LOGIN ─────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !pass) {
    errEl.textContent = 'Por favor completa todos los campos.';
    errEl.style.display = 'block';
    return;
  }

  setLoginLoading(true);

  // Si Supabase no está configurado, usar modo demo
  if (!supabase || SIEL_CONFIG.SUPABASE_URL.includes('TU_PROYECTO')) {
    setTimeout(() => {
      setLoginLoading(false);
      currentUser = { id: 'demo-user', email };
      currentProfile = { nombre: 'Usuario Demo', empresa: 'Mi Empresa', plan: 'starter' };
      launchApp();
    }, 800);
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    currentUser = data.user;
    await loadProfile();
    launchApp();
  } catch (e) {
    errEl.textContent = e.message === 'Invalid login credentials'
      ? 'Correo o contraseña incorrectos.'
      : e.message;
    errEl.style.display = 'block';
  } finally {
    setLoginLoading(false);
  }
}

// ── REGISTER ──────────────────────────────────────────────
async function handleRegister() {
  const nombre  = document.getElementById('reg-name').value.trim();
  const empresa = document.getElementById('reg-company').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const pass    = document.getElementById('reg-pass').value;
  const errEl   = document.getElementById('reg-error');
  const okEl    = document.getElementById('reg-success');
  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!nombre || !email || !pass) {
    errEl.textContent = 'Por favor completa todos los campos obligatorios.';
    errEl.style.display = 'block';
    return;
  }
  if (pass.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errEl.style.display = 'block';
    return;
  }

  setRegLoading(true);

  // Modo demo
  if (!supabase || SIEL_CONFIG.SUPABASE_URL.includes('TU_PROYECTO')) {
    setTimeout(() => {
      setRegLoading(false);
      currentUser = { id: 'demo-user', email };
      currentProfile = { nombre, empresa, plan: 'starter' };
      launchApp();
    }, 900);
    return;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email, password: pass,
      options: { data: { nombre, empresa } }
    });
    if (error) throw error;

    // Create profile record
    await supabase.from('profiles').insert({
      id: data.user.id,
      nombre, empresa,
      plan: 'starter',
      created_at: new Date().toISOString()
    });

    okEl.textContent = '✅ Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.';
    okEl.style.display = 'block';
  } catch (e) {
    errEl.textContent = e.message.includes('already registered')
      ? 'Este correo ya tiene una cuenta. Inicia sesión.'
      : e.message;
    errEl.style.display = 'block';
  } finally {
    setRegLoading(false);
  }
}

// ── LOGOUT ────────────────────────────────────────────────
async function handleLogout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  showLogin();
}

// ── LOAD PROFILE ──────────────────────────────────────────
async function loadProfile() {
  if (!supabase || !currentUser) return;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    if (data) currentProfile = data;
    else currentProfile = {
      nombre: currentUser.email.split('@')[0],
      empresa: '',
      plan: 'starter'
    };
  } catch (e) {
    currentProfile = { nombre: currentUser.email.split('@')[0], empresa: '', plan: 'starter' };
  }
}

// ── CHECK EXISTING SESSION ────────────────────────────────
async function checkSession() {
  if (!supabase || SIEL_CONFIG.SUPABASE_URL.includes('TU_PROYECTO')) return false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      currentUser = data.session.user;
      await loadProfile();
      return true;
    }
  } catch (e) {}
  return false;
}

// ── HELPERS ───────────────────────────────────────────────
function setLoginLoading(on) {
  document.getElementById('login-txt').style.display     = on ? 'none' : 'inline';
  document.getElementById('login-loading').style.display = on ? 'inline' : 'none';
  document.getElementById('login-btn').disabled = on;
}

function setRegLoading(on) {
  document.getElementById('reg-txt').style.display     = on ? 'none' : 'inline';
  document.getElementById('reg-loading').style.display = on ? 'inline' : 'none';
  document.getElementById('reg-btn').disabled = on;
}

// ── ENTER KEY ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const loginCard = document.getElementById('login-card');
    const regCard   = document.getElementById('register-card');
    if (loginCard && loginCard.style.display !== 'none') handleLogin();
    else if (regCard && regCard.style.display !== 'none') handleRegister();
  }
});

# SIEL — Sistema Inteligente de Evaluación de Licitaciones
### Tu copiloto estratégico de contratación pública y privada

---

## 🚀 Cómo publicar SIEL gratis (paso a paso)

### PASO 1 — Obtener tu API Key de Anthropic (IA)
1. Ve a **https://console.anthropic.com**
2. Crea una cuenta gratuita
3. Ve a "API Keys" → "Create Key"
4. Copia la key (empieza con `sk-ant-...`)

---

### PASO 2 — Crear proyecto en Supabase (base de datos)
1. Ve a **https://supabase.com** → "New project"
2. Dale un nombre (ej: `siel-app`) y una contraseña segura
3. Espera ~2 minutos a que el proyecto se cree
4. Ve a **Settings → API**
5. Copia:
   - **Project URL** (ej: `https://abcdef.supabase.co`)
   - **anon public** key

6. Ve a **SQL Editor** en Supabase y ejecuta este código:

```sql
-- Tabla de perfiles de usuario
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT,
  empresa TEXT,
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- Tabla de análisis
CREATE TABLE analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  filename TEXT,
  nombre TEXT,
  entidad TEXT,
  sector TEXT,
  valor TEXT,
  fecha_cierre TEXT,
  modalidad TEXT,
  objeto TEXT,
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
  justificacion_decision TEXT,
  analisis_juridico TEXT,
  analisis_financiero TEXT,
  analisis_tecnico TEXT,
  analisis_economico TEXT,
  checklist JSONB,
  riesgos JSONB,
  alertas JSONB,
  recomendaciones JSONB,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own analyses" ON analyses FOR ALL USING (auth.uid() = user_id);
```

---

### PASO 3 — Configurar SIEL con tus keys
Abre el archivo `js/config.js` y reemplaza:

```javascript
SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',     // ← tu URL de Supabase
SUPABASE_ANON_KEY: 'TU_ANON_KEY_AQUI',               // ← tu anon key
ANTHROPIC_KEY: 'sk-ant-TU_KEY_AQUI',                 // ← tu API key de Anthropic
```

---

### PASO 4 — Subir a GitHub
1. Ve a **https://github.com** → "New repository"
2. Nómbralo `siel-app` (público o privado)
3. Sube todos los archivos de esta carpeta:
   - `index.html`
   - `css/main.css`
   - `js/config.js`
   - `js/auth.js`
   - `js/db.js`
   - `js/analyzer.js`
   - `js/app.js`

   **Opción A — Desde la web de GitHub:**
   - Arrastra todos los archivos al repositorio

   **Opción B — Con Git (si lo tienes instalado):**
   ```bash
   git init
   git add .
   git commit -m "SIEL v2.5 - Lanzamiento inicial"
   git remote add origin https://github.com/TU_USUARIO/siel-app.git
   git push -u origin main
   ```

---

### PASO 5 — Publicar en Vercel (gratis, URL pública)
1. Ve a **https://vercel.com** → "Sign up with GitHub"
2. Click en "New Project"
3. Selecciona tu repositorio `siel-app`
4. Click "Deploy" — ¡listo en 30 segundos!
5. Tu SIEL estará en: `https://siel-app.vercel.app`

Cada vez que cambies algo en GitHub, Vercel lo actualiza automáticamente.

---

## 📁 Estructura de archivos

```
siel/
├── index.html          ← Aplicación principal
├── css/
│   └── main.css        ← Estilos
├── js/
│   ├── config.js       ← 🔑 TUS KEYS VAN AQUÍ
│   ├── auth.js         ← Login, registro, sesiones
│   ├── db.js           ← Base de datos Supabase
│   ├── analyzer.js     ← Motor de IA (los 13 puntos SIEL)
│   └── app.js          ← Controlador de la aplicación
└── README.md           ← Esta guía
```

---

## ✅ Funciona sin configurar (modo demo)
Si no tienes las keys aún, la app funciona en **modo demo**:
- Login con cualquier correo y contraseña
- Análisis con datos de ejemplo
- Todos los módulos funcionales
- Sin guardar en base de datos real

---

## 💡 Los 13 Puntos SIEL que analiza la IA

| # | Módulo | Descripción |
|---|--------|-------------|
| 01 | Resumen Ejecutivo | Síntesis estratégica del proceso |
| 02 | Score de Viabilidad | 0-100 ponderado en 4 dimensiones |
| 03 | Análisis Jurídico | Marco legal, habilitantes, cláusulas |
| 04 | Análisis Financiero | Indicadores, patrimonio, liquidez |
| 05 | Análisis Técnico | Experiencia, personal, metodología |
| 06 | Análisis Económico | Presupuesto, rentabilidad, pagos |
| 07 | Checklist Documental | Semáforo por documento requerido |
| 08 | Matriz de Riesgos | Riesgos detectados con mitigación |
| 09 | Alertas Automáticas | Restricciones, inconsistencias, riesgos |
| 10 | Recomendaciones IA | Acciones priorizadas y accionables |
| 11 | Motor de Decisión | ¿Vale la pena participar? + justificación |
| 12 | Dashboard Gerencial | KPIs, distribución, historial |
| 13 | SIEL Copilot | Asistente conversacional IA |

---

## 🔮 Hoja de ruta (cuando quieras escalar)

- [ ] Exportar análisis a PDF
- [ ] Dominio personalizado (ej: `siel.com.co`)
- [ ] Pagos con Stripe/PayU (monetización)
- [ ] OCR avanzado con AWS Textract
- [ ] Notificaciones por correo
- [ ] API REST para integraciones
- [ ] App móvil (React Native)

---

*SIEL — Transformando documentos complejos en decisiones claras* 🧠

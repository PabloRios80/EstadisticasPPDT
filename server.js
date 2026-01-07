// --- ESPÍA DE DIAGNÓSTICO ---
console.log("-----------------------------------------");
console.log("--- INICIANDO SERVIDOR OPTIMIZADO (512MB RAM SAFE) ---");
console.log("-----------------------------------------");

require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- VARIABLES GLOBALES ---
let datosEnMemoria = []; 
let indicadoresCache = null; 
let camposCache = null;
let contextoDelPrograma = '';

// --- LISTA DE COLUMNAS A CONSERVAR (Crucial para ahorrar RAM) ---
// Solo guardamos lo que la app realmente usa.
const CAMPOS_PERMITIDOS = [
    'DNI', 'Sexo', 'Edad', 'Poblacion', 'Apellido', 'Nombre', 'Apellido y Nombre', 'Tipo',
    'Diabetes', 'Presión Arterial', 'Dislipemias', 'IMC', 'Tabaco',
    'Cáncer mama - Mamografía', 'Cáncer mama - Eco mamaria',
    'Cáncer cérvico uterino - HPV', 'Cáncer cérvico uterino - PAP',
    'SOMF', 'Cáncer colon - Colonoscopía', 'Próstata - PSA',
    'VIH', 'Hepatitis B', 'Hepatitis C', 'VDRL', 'Chagas',
    'Control Odontológico - Adultos', 'ERC', 'Agudeza visual',
    'EPOC', 'Aneurisma aorta', 'Osteoporosis', 'Aspirina', 'Depresión',
    'Actividad física', 'Seguridad vial', 'Caídas en adultos mayores',
    'Abuso alcohol', 'Violencia', 'Inmunizaciones', 'Ácido fólico',
    'Síndrome Metabólico', 'Consumo de sustancias', 'Marca temporal' // Dejamos marca temp por si acaso
];

// --- CONFIGURACIÓN GOOGLE ---
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

const mountPath = '/opt/render/project/src/data';
const dataPath = fs.existsSync(mountPath) ? mountPath : __dirname;
const TOKEN_PATH = path.join(dataPath, 'token.json');

if (process.env.RENDER_DISK_MOUNT_PATH && !fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });

// --- CARGA DE LOGO ---
let logoBase64 = '';
try {
    const logoData = fs.readFileSync(path.join(__dirname, 'public', 'logo_iapos.png'));
    logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
} catch (error) { console.error('Nota: logo_iapos.png no encontrado (opcional).'); }

// --- MIDDLEWARES ---
app.use(express.static(path.join(__dirname, 'public'), { index: 'estadisticas.html' }));
app.use(express.json({ limit: '50mb' }));

// --- FUNCIONES AUXILIARES ---
function normalizeString(str) { 
    if (!str) return '';
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function cargarContexto() {
    try {
        contextoDelPrograma = fs.readFileSync(path.join(__dirname, 'contexto_informes.txt'), 'utf-8');
    } catch (e) { contextoDelPrograma = 'No se pudo cargar contexto.'; }
}

async function loadTokens() {
    if (process.env.GOOGLE_TOKEN) {
        try {
            oauth2Client.setCredentials(JSON.parse(process.env.GOOGLE_TOKEN));
            return true;
        } catch (e) { console.error('❌ Error token entorno', e); return false; }
    }
    try {
        oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8')));
        return true;
    } catch (e) { console.log('⚠️ Sin token local.'); return false; }
}

async function getAuthenticatedClient() {
    const loaded = await loadTokens();
    if (!loaded) throw new Error('Falta autenticación.');
    return oauth2Client;
}

// --- FUNCIÓN MAESTRA DE CARGA (OPTIMIZADA) ---
async function cargarDatosDeGoogle() {
    console.log("📥 [1/3] Conectando a Google Sheets...");
    try {
        const authClient = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const sources = [{ sheetName: 'Integrado', label: 'General' }, { sheetName: 'Seguridad', label: 'Seguridad' }];

        const promises = sources.map(async (source) => {
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID, range: `${source.sheetName}!A:DM`,
                    valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING'
                });
                const values = response.data.values;
                if (!values || !values.length) return [];
                
                const headers = values[0];
                // Mapeamos solo lo necesario
                return values.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        // --- FILTRO DE MEMORIA ---
                        if (h && CAMPOS_PERMITIDOS.includes(h)) {
                            obj[h] = row[i];
                        }
                    });
                    // Corrección de nombre
                    if (!obj['Apellido y Nombre'] && (obj['Apellido'] || obj['Nombre'])) {
                        obj['Apellido y Nombre'] = `${obj['Apellido']||''} ${obj['Nombre']||''}`.trim();
                    }
                    obj['Poblacion'] = source.label;
                    return obj;
                });
            } catch (e) { console.error(`Error en ${source.sheetName}:`, e.message); return []; }
        });

        const results = await Promise.all(promises);
        datosEnMemoria = results.flat();
        console.log(`✅ [2/3] Datos filtrados en RAM: ${datosEnMemoria.length} filas.`);

        // Pre-Calcular para evitar picos de CPU luego
        preCalcularTodo();
        
        return true;
    } catch (e) {
        console.error('❌ Error fatal cargando datos:', e);
        return false;
    }
}

function preCalcularTodo() {
    if (!datosEnMemoria || datosEnMemoria.length === 0) return;
    
    // 1. Guardar Campos
    const primerRegistro = datosEnMemoria[0];
    camposCache = Object.keys(primerRegistro).filter(c => c !== 'Poblacion' && c !== 'Apellido y Nombre');

    // 2. Calcular Indicadores (Para que la respuesta sea instantánea)
    // Usamos la misma lógica que tu función original pero aplicada aquí
    indicadoresCache = calcularIndicadoresInterno(datosEnMemoria);
    console.log("🚀 [3/3] Cachés generadas. Sistema listo.");
}

function calcularIndicadoresInterno(data) {
    const dniMap = new Map();
    // Lógica de deduplicación para indicadores (último registro válido)
    data.forEach(row => { if (row['DNI']) dniMap.set(row['DNI'], row); });
    
    const sexos = { masculino: 0, femenino: 0 };
    const edadGrupos = { 'Menores de 18': 0, '18 a 30': 0, '30 a 50': 0, 'Mayores de 50': 0 };
    const enfermedades = { diabetes: 0, hipertension: 0, dislipemias: 0, obesos: 0, fumadores: 0 };
    let altoRiesgoCount = 0;

    dniMap.forEach(row => {
        const s = normalizeString(row['Sexo']);
        if (s.includes('masc') || s === 'm') sexos.masculino++; 
        else if (s.includes('fem') || s === 'f') sexos.femenino++;

        const e = parseInt(row['Edad'], 10);
        if (!isNaN(e)) {
            if (e < 18) edadGrupos['Menores de 18']++;
            else if (e <= 30) edadGrupos['18 a 30']++;
            else if (e <= 50) edadGrupos['30 a 50']++;
            else edadGrupos['Mayores de 50']++;
        }

        if (normalizeString(row['Diabetes']) === 'presenta') enfermedades.diabetes++;
        if (normalizeString(row['Presión Arterial']).includes('hipertens')) enfermedades.hipertension++;
        if (normalizeString(row['Dislipemias']) === 'presenta') enfermedades.dislipemias++;
        if (normalizeString(row['Tabaco']) === 'fuma') enfermedades.fumadores++;
        if (normalizeString(row['IMC']).includes('obesidad')) enfermedades.obesos++;

        if (e > 50 && (
            normalizeString(row['Diabetes']) === 'presenta' || 
            normalizeString(row['Presión Arterial']).includes('hipertens') || 
            normalizeString(row['IMC']).includes('obesidad') || 
            normalizeString(row['IMC']).includes('sobrepeso') || 
            normalizeString(row['Tabaco']) === 'fuma'
        )) altoRiesgoCount++;
    });

    const totalSexo = sexos.masculino + sexos.femenino;
    return {
        diasPreventivos: dniMap.size,
        sexo: { 
            ...sexos, 
            porcentajeMasculino: totalSexo ? ((sexos.masculino/totalSexo)*100).toFixed(2) : 0, 
            porcentajeFemenino: totalSexo ? ((sexos.femenino/totalSexo)*100).toFixed(2) : 0 
        },
        edad: edadGrupos,
        enfermedades: enfermedades,
        altoRiesgo: altoRiesgoCount
    };
}

// --- RUTAS API ---

app.get('/obtener-campos', (req, res) => {
    if (camposCache) return res.json(camposCache);
    if (datosEnMemoria.length > 0) { // Fallback por si la caché falló
        return res.json(Object.keys(datosEnMemoria[0]).filter(c => c!=='Poblacion'));
    }
    res.status(503).json({ error: 'Iniciando...' });
});

app.get('/obtener-datos-completos', async (req, res) => {
    // Si hay datos en memoria, filtramos y enviamos.
    if (datosEnMemoria && datosEnMemoria.length > 0) {
        const tipo = req.query.tipo;
        const data = tipo ? datosEnMemoria.filter(r => normalizeString(r['Tipo']) === normalizeString(tipo)) : datosEnMemoria;
        return res.json(data);
    }
    // Si no hay datos, intentamos recargar
    await cargarDatosDeGoogle();
    res.json(datosEnMemoria || []);
});

app.get('/obtener-indicadores-fijos', (req, res) => {
    // Si piden el total general, devolvemos la caché instantánea
    if (!req.query.tipo && indicadoresCache) return res.json(indicadoresCache);
    
    // Si piden un filtro específico, calculamos sobre la marcha (es rápido porque está en RAM)
    if (datosEnMemoria) {
        const data = req.query.tipo ? datosEnMemoria.filter(r => normalizeString(r['Tipo']) === normalizeString(req.query.tipo)) : datosEnMemoria;
        return res.json(calcularIndicadoresInterno(data));
    }
    res.status(503).json({ error: 'Cargando...' });
});

// --- RUTA IA (RESTAURADA COMPLETA) ---
function calcularEstadisticasCompletas(data) {
    const total = data.length;
    if (total === 0) return { totalCasos: 0 };
    let c = { mujeres: 0, hombres: 0, adultos: 0, pediatrico: 0, diabetes: 0, hipertension: 0, dislipemias: 0, tabaquismo: 0, obesidad: 0, sobrepeso: 0, cancerMama: 0, cancerProstata: 0, vih: 0, hepatitisB: 0, hepatitisC: 0, vdrl: 0, chagas: 0, saludBucal: 0, saludRenal: 0, depresion: 0, epoc: 0, agudezaVisual: 0, edades: [] };
    
    for (const r of data) {
        const e = parseInt(r.Edad);
        if(!isNaN(e)) { c.edades.push(e); if(e>=18) c.adultos++; else c.pediatrico++; }
        const s = normalizeString(r.Sexo);
        if(s.includes('fem')) c.mujeres++; else if(s.includes('masc')) c.hombres++;
        
        if(normalizeString(r.Diabetes)==='presenta') c.diabetes++;
        if(normalizeString(r['Presión Arterial']).includes('hipertens')) c.hipertension++;
        if(normalizeString(r.Dislipemias)==='presenta') c.dislipemias++;
        if(normalizeString(r.Tabaco)==='fuma') c.tabaquismo++;
        if(normalizeString(r.IMC).includes('obesidad')) c.obesidad++;
        if(normalizeString(r.IMC).includes('sobrepeso')) c.sobrepeso++;
        
        // Patologias especificas
        if(normalizeString(r['Cáncer mama - Mamografía'])==='patologico' || normalizeString(r['Cáncer mama - Eco mamaria'])==='patologico') c.cancerMama++;
        if(normalizeString(r['Próstata - PSA'])==='patologico') c.cancerProstata++;
        if(normalizeString(r['VIH'])==='positivo') c.vih++;
        if(normalizeString(r['Hepatitis B'])==='positivo') c.hepatitisB++;
        if(normalizeString(r['Hepatitis C'])==='positivo') c.hepatitisC++;
        if(normalizeString(r['VDRL'])==='positivo') c.vdrl++;
        if(normalizeString(r['Chagas'])==='positivo') c.chagas++;
        if(normalizeString(r['Control Odontológico - Adultos'])==='riesgo alto') c.saludBucal++;
        if(normalizeString(r['ERC'])==='patológico') c.saludRenal++;
        if(normalizeString(r['Depresión'])==='se verifica') c.depresion++;
        if(normalizeString(r['EPOC'])==='se verifica') c.epoc++;
        if(normalizeString(r['Agudeza visual'])==='alterada') c.agudezaVisual++;
    }
    return {
        totalCasos: total, totalMujeres: c.mujeres, totalHombres: c.hombres, adultos: c.adultos, pediatrico: c.pediatrico,
        prevalenciaDiabetes: ((c.diabetes/total)*100).toFixed(1),
        prevalenciaHipertension: ((c.hipertension/total)*100).toFixed(1),
        prevalenciaDislipemias: ((c.dislipemias/total)*100).toFixed(1),
        prevalenciaTabaquismo: ((c.tabaquismo/total)*100).toFixed(1),
        prevalenciaObesidad: ((c.obesidad/total)*100).toFixed(1),
        prevalenciaSobrepeso: ((c.sobrepeso/total)*100).toFixed(1),
        totalCancerMama: c.cancerMama, totalCancerProstata: c.cancerProstata,
        totalVIH: c.vih, totalHepatitisB: c.hepatitisB, totalHepatitisC: c.hepatitisC, totalVDRL: c.vdrl, totalChagas: c.chagas,
        totalSaludBucalRiesgo: c.saludBucal, totalSaludRenalPatologico: c.saludRenal, totalDepresion: c.depresion, totalEPOC: c.epoc, totalAgudezaVisual: c.agudezaVisual
    };
}

app.post('/generar-informe', async (req, res) => {
    try {
        const { data, userPrompt } = req.body;
        if (!data || data.length === 0) return res.status(400).json({ error: 'Sin datos' });

        const stats = calcularEstadisticasCompletas(data);
        console.log(`🌐 IA Prompt: ${userPrompt}`);

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        // Prompt simplificado para asegurar que entre en el request
        const promptText = `
        Actúa como experto en salud pública (IAPOS). Analiza: "${userPrompt || 'Informe general'}".
        Datos clave: Total ${stats.totalCasos}, Diabetes ${stats.prevalenciaDiabetes}%, HTA ${stats.prevalenciaHipertension}%, Obesidad ${stats.prevalenciaObesidad}%.
        Mujeres: ${stats.totalMujeres}, Hombres: ${stats.totalHombres}.
        Casos patológicos detectados: Mama ${stats.totalCancerMama}, Próstata ${stats.totalCancerProstata}, VIH ${stats.totalVIH}, Chagas ${stats.totalChagas}.
        Contexto: ${contextoDelPrograma}
        Responde con formato HTML limpio (divs, h3, ul).`;

        const response = await axios.post(url, { contents: [{ parts: [{ text: promptText }] }] }, { headers: { 'Content-Type': 'application/json' } });
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        const html = formatearInformeIAPOS(text || "Sin respuesta IA", stats, 'general', userPrompt);
        res.json({ informe: html });

    } catch (error) {
        console.error('❌ Error IA:', error.message);
        res.json({ informe: formatearInformeIAPOS("Error de conexión con IA. Mostrando datos básicos.", calcularEstadisticasCompletas(data), 'error', userPrompt) });
    }
});

function formatearInformeIAPOS(contenidoIA, stats, tipo, prompt) {
    const fecha = new Date().toLocaleDateString('es-AR');
    const logoHtml = logoBase64 ? `<div style="background:#2563EB;border-radius:50%;padding:10px;display:inline-block"><img src="${logoBase64}" height="50"></div>` : '<h3>IAPOS</h3>';
    return `<div style="font-family:sans-serif;max-width:800px;margin:0 auto">
        <div style="border-bottom:3px solid #0066CC;padding-bottom:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
            <div>${logoHtml}<br><strong style="color:#0066CC">Informe Día Preventivo</strong></div>
            <div style="text-align:right;font-size:12px;color:#666">${fecha}<br>Consulta: "${prompt}"</div>
        </div>
        <div>${contenidoIA.replace(/\n/g, '<br>')}</div>
    </div>`;
}

// --- RUTAS AUTH ---
app.get('/auth', (req, res) => {
    res.redirect(oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' }));
});
app.get('/oauth2callback', async (req, res) => {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    if(!process.env.GOOGLE_TOKEN) fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send('Autenticado.');
});

// --- ARRANQUE ---
async function startServer() {
    await loadTokens();
    await cargarContexto();
    app.listen(PORT, async () => {
        console.log(`🚀 Servidor listo en puerto ${PORT}`);
        await cargarDatosDeGoogle();
    });
}

startServer();
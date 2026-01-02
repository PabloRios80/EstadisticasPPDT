// --- ESPÍA DE DIAGNÓSTICO ---
console.log("-----------------------------------------");
console.log("--- VERIFICANDO VARIABLES DE ENTORNO ---");
if (process.env.GOOGLE_TOKEN) {
    console.log("La variable GOOGLE_TOKEN SÍ existe.");
    console.log("Primeros 50 caracteres:", process.env.GOOGLE_TOKEN.substring(0, 50));
} else {
    console.log("La variable GOOGLE_TOKEN NO existe o está vacía.");
}
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
let datosEnMemoria = null; // CACHÉ DE DATOS
let contextoDelPrograma = '';

// --- CONFIGURACIÓN GOOGLE ---
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// --- RUTAS DE ARCHIVOS ---
const mountPath = '/opt/render/project/src/data';
const dataPath = fs.existsSync(mountPath) ? mountPath : __dirname;
const TOKEN_PATH = path.join(dataPath, 'token.json');

// Asegúrate de que el directorio exista
if (process.env.RENDER_DISK_MOUNT_PATH && !fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

// --- CARGA DE LOGO ---
let logoBase64 = '';
try {
    const logoData = fs.readFileSync(path.join(__dirname, 'public', 'logo_iapos.png'));
    logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
    console.log('✅ Logo de IAPOS cargado correctamente.');
} catch (error) {
    console.error('❌ No se pudo encontrar el archivo logo_iapos.png en la carpeta /public.');
}

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
        const fileContent = fs.readFileSync(path.join(__dirname, 'contexto_informes.txt'), 'utf-8');
        contextoDelPrograma = fileContent;
        console.log('Contexto del programa cargado con éxito.');
    } catch (error) {
        console.error('Error al cargar el archivo de contexto:', error);
        contextoDelPrograma = 'No se pudo cargar el contexto del programa.';
    }
}

async function loadTokens() {
    // 1. Variable de entorno (Render)
    if (process.env.GOOGLE_TOKEN) {
        try {
            console.log('Token encontrado en la variable de entorno. Intentando usarlo...');
            const tokens = JSON.parse(process.env.GOOGLE_TOKEN);
            oauth2Client.setCredentials(tokens);
            console.log('✅ Credenciales de Google cargadas exitosamente desde la variable de entorno.');
            return true;
        } catch (err) {
            console.error('❌ Error al procesar el GOOGLE_TOKEN.', err);
            return false;
        }
    }

    // 2. Archivo local (Desarrollo)
    try {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        oauth2Client.setCredentials(tokens);
        console.log('Tokens cargados con éxito desde archivo local.');
        return true;
    } catch (err) {
        console.log('No se encontró el archivo token.json local. Se requiere autenticación.');
        return false;
    }
}

function saveTokens(tokens) {
    console.log(`[DEBUG] Intentando escribir el token en la ruta: ${TOKEN_PATH}`);
    try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log(`✅ Token guardado exitosamente.`);
    } catch (err) {
        console.error(`❌ ERROR CRÍTICO AL INTENTAR GUARDAR EL TOKEN:`, err);
    }
}

async function getAuthenticatedClient() {
    const areTokensLoaded = await loadTokens();
    if (!areTokensLoaded) {
        throw new Error('Tokens no cargados. Por favor, autentícate primero en /auth.');
    }
    return oauth2Client;
}

// --- NUEVA FUNCIÓN PARA CARGAR DATOS EN MEMORIA (CACHÉ) ---
async function cargarDatosDeGoogle() {
    console.log("📥 Iniciando carga de datos multi-pestaña para caché...");
    try {
        const authClient = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const sources = [
            { sheetName: 'Integrado', label: 'General' },
            { sheetName: 'Seguridad', label: 'Seguridad' }
        ];

        const promises = sources.map(async (source) => {
            try {
                console.log(`🔎 Buscando pestaña: "${source.sheetName}"...`);
                
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${source.sheetName}!A:DM`, 
                    valueRenderOption: 'UNFORMATTED_VALUE',
                    dateTimeRenderOption: 'FORMATTED_STRING'
                });

                const values = response.data.values;
                
                if (!values || values.length === 0) {
                    console.warn(`⚠️ La pestaña "${source.sheetName}" se encontró pero ESTÁ VACÍA.`);
                    return [];
                }

                console.log(`✅ Pestaña "${source.sheetName}" leída correctamente: ${values.length - 1} registros encontrados.`);

                const headers = values[0];
                const rows = values.slice(1);

                return rows.map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        if (header) obj[header] = row[index];
                    });

                    // Corrección de nombres
                    if (!obj['Apellido y Nombre']) {
                        const apellido = obj['Apellido'] || '';
                        const nombre = obj['Nombre'] || '';
                        if (apellido || nombre) {
                            obj['Apellido y Nombre'] = `${apellido}, ${nombre}`.trim();
                        }
                    }

                    // Etiqueta de población
                    obj['Poblacion'] = source.label; 
                    return obj;
                });

            } catch (error) {
                console.error(`❌ ERROR CRÍTICO leyendo pestaña "${source.sheetName}":`, error.message);
                return []; 
            }
        });

        const results = await Promise.all(promises);
        const allRows = results.flat();

        // --- AQUÍ GUARDAMOS EN LA VARIABLE GLOBAL ---
        datosEnMemoria = allRows;

        console.log(`📊 DATOS CARGADOS EN MEMORIA: ${datosEnMemoria.length} registros totales.`);
        
        return true; // Indicamos éxito

    } catch (error) {
        console.error('Error general cargando datos de Google:', error);
        return false; // Indicamos fallo
    }
}

// --- RUTAS DE AUTENTICACIÓN ---
app.get('/auth', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });
    res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code);
        oauth2Client.setCredentials(tokens);
        saveTokens(tokens);
        res.send('Autenticación exitosa. Ahora puedes cerrar esta pestaña.');
    } catch (err) {
        console.error('Error al obtener tokens:', err);
        res.status(500).send('Error de autenticación.');
    }
});

// --- RUTAS DE LA API ---

app.get('/obtener-campos', async (req, res) => {
    try {
        const authClient = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const sheetName = 'Integrado';

        const camposAExcluir = [
            'Dia', 'ID', 'IDapellido y nombre', 'Marca temporal', 'FECHAX', 'Observaciones - Dislipemias', 'Observaciones - Diabetes', 'Observaciones - Presión Arterial', 'Observaciones - IMC', 'Observaciones - Agudeza visual', 'Valor CPO', 'Observaciones - Control odontológico', 'Observaciones - Alimentación saludable', 'Observaciones - Actividad física', 'Observaciones - Seguridad vial', 'Observaciones - Caídas en adultos mayores', 'Observaciones - Ácido fólico', 'Observaciones - Abuso alcohol', 'Observaciones - Tabaco', 'Observaciones - Violencia', 'Observaciones - Depresión', 'Observaciones - ITS', 'Observaciones - Hepatitis B', 'Observaciones - Hepatitis C', 'Observaciones - VIH', 'Observaciones - HPV', 'Observaciones - PAP', 'Observaciones - SOMF', 'Observaciones - Colonoscopía', 'Observaciones - Mamografía', 'Observaciones_Eco_mamaria', 'Observaciones - ERC', 'Observaciones - EPOC', 'Observaciones - Aneurisma aorta', 'Observaciones - Osteoporosis', 'Observaciones - Riesgo CV', 'Observaciones - Aspirina', 'Observaciones - Inmunizaciones', 'Observaciones - VDRL', 'Observaciones - PSA', 'Observaciones - Chagas', 'Observaciones - Examen Físico', 'Observaciones - Talla', 'Observaciones - Salud Ocular', 'Observaciones - Audición', 'Observaciones - Salud Cardiovascular', 'Observaciones - Educación sexual', 'Observaciones - Salud Mental', 'Observaciones - Consumo de sustancias', 'Observaciones - Dislipemia', 'Observaciones - Síndrome Metabólico', 'Observaciones - Escoliosis', 'Observaciones - Cáncer cérvico uterino', 'Observaciones - Cáncer de piel', 'Observaciones - Desarrollo escolar', 'Observaciones - Uso de pantallas', 'Observaciones - Vacunas', 'Observaciones - Control Odontológico - Niños', 'Observaciones - Control Odontológico - Adultos', 'link'
        ];

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!1:1`,
        });

        const headers = response.data.values[0];
        if (headers) {
            const camposFiltrados = headers.filter(campo => !camposAExcluir.includes(campo));
            res.json(camposFiltrados);
        } else {
            res.status(404).json({ error: 'No se encontraron encabezados' });
        }
    } catch (error) {
        console.error('Error al obtener los campos:', error);
        res.status(500).json({ error: 'Error del servidor al obtener campos' });
    }
});

// RUTA OPTIMIZADA CON CACHÉ
app.get('/obtener-datos-completos', async (req, res) => {
    try {
        // 1. ESTRATEGIA: MEMORIA PRIMERO
        if (datosEnMemoria && datosEnMemoria.length > 0) {
            console.log("🚀 Sirviendo datos desde la memoria caché (rápido)");
            
            const tipo = req.query.tipo;
            const filteredData = tipo ? datosEnMemoria.filter(row => normalizeString(row['Tipo']) === normalizeString(tipo)) : datosEnMemoria;
            
            return res.json(filteredData);
        }

        // 2. ESTRATEGIA: CARGA DE EMERGENCIA
        console.log("⚠️ Memoria vacía. Intentando carga de emergencia...");
        const exito = await cargarDatosDeGoogle();

        if (exito && datosEnMemoria) {
            const tipo = req.query.tipo;
            const filteredData = tipo ? datosEnMemoria.filter(row => normalizeString(row['Tipo']) === normalizeString(tipo)) : datosEnMemoria;
            res.json(filteredData);
        } else {
            res.status(500).json({ error: 'Error crítico al obtener datos desde Google.' });
        }

    } catch (error) {
        console.error('Error en ruta /obtener-datos-completos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.get('/obtener-indicadores-fijos', async (req, res) => {
    // Si ya tenemos datos en memoria, usémoslos para calcular los indicadores también!
    // Esto hace que esta ruta sea instantánea también.
    let dataParaCalculo = [];

    if (datosEnMemoria && datosEnMemoria.length > 0) {
        dataParaCalculo = datosEnMemoria;
    } else {
        // Fallback: Si no hay memoria, carga normal (lenta)
        await cargarDatosDeGoogle();
        dataParaCalculo = datosEnMemoria || [];
    }

    try {
        const tipo = req.query.tipo;
        if (tipo) {
            dataParaCalculo = dataParaCalculo.filter(row => normalizeString(row['Tipo']) === normalizeString(tipo));
        }

        const dniMap = new Map();
        dataParaCalculo.forEach(row => {
            const dni = row['DNI'];
            // Asumimos que si está en memoria, ya es el último registro válido o aplicamos lógica simple
            if (dni) {
                dniMap.set(dni, row); // Simplificación: último registro gana
            }
        });
        
        // --- CÁLCULO DE INDICADORES ---
        const diasPreventivos = dniMap.size;
        const sexos = { masculino: 0, femenino: 0 };
        const edadGrupos = { 'Menores de 18': 0, '18 a 30': 0, '30 a 50': 0, 'Mayores de 50': 0 };
        const enfermedades = { diabetes: 0, hipertension: 0, dislipemias: 0, obesos: 0, fumadores: 0 };
        let altoRiesgoCount = 0;

        dniMap.forEach(row => {
            // Sexo
            const sexo = (row['Sexo'] || '').toLowerCase();
            if (sexo === 'masculino') sexos.masculino++;
            if (sexo === 'femenino') sexos.femenino++;

            // Edad
            const edad = parseInt(row['Edad'], 10);
            if (!isNaN(edad)) {
                if (edad < 18) edadGrupos['Menores de 18']++;
                else if (edad <= 30) edadGrupos['18 a 30']++;
                else if (edad <= 50) edadGrupos['30 a 50']++;
                else edadGrupos['Mayores de 50']++;
            }

            // Enfermedades
            if ((row['Diabetes'] || '').trim().toLowerCase() === 'presenta') enfermedades.diabetes++;
            const presion = (row['Presión Arterial'] || '').trim().toLowerCase();
            if (presion.includes('hipertens')) enfermedades.hipertension++;
            if ((row['Dislipemias'] || '').trim().toLowerCase() === 'presenta') enfermedades.dislipemias++;
            if ((row['Tabaco'] || '').trim().toLowerCase() === 'fuma') enfermedades.fumadores++;
            const imc = (row['IMC'] || '').trim().toLowerCase();
            if (imc.includes('sobrepeso') || imc.includes('obesidad')) enfermedades.obesidad++;

            // Alto Riesgo
            const isAltoRiesgo = edad > 50 && (
                enfermedades.diabetes || presion.includes('hipertens') || 
                imc.includes('obesidad') || imc.includes('sobrepeso') || 
                enfermedades.fumadores
            );
            if (isAltoRiesgo) altoRiesgoCount++;
        });

        const totalSexo = sexos.masculino + sexos.femenino;
        
        const indicadores = {
            diasPreventivos: diasPreventivos,
            sexo: {
                ...sexos,
                porcentajeMasculino: totalSexo ? ((sexos.masculino / totalSexo) * 100).toFixed(2) : 0,
                porcentajeFemenino: totalSexo ? ((sexos.femenino / totalSexo) * 100).toFixed(2) : 0
            },
            edad: edadGrupos,
            enfermedades: enfermedades,
            altoRiesgo: altoRiesgoCount
        };

        res.json(indicadores);

    } catch (error) {
        console.error('Error al calcular indicadores:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/generar-informe', async (req, res) => {
    try {
        const { data, userPrompt } = req.body;
        
        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'No se recibieron datos para generar el informe.' });
        }
        
        const stats = calcularEstadisticasCompletas(data);
        const tipoInforme = determinarTipoInforme(userPrompt);
        
        console.log(`🌐 Generando informe con IA...`);
        
        try {
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const promptText = generarPromptEspecifico(tipoInforme, stats, userPrompt, contextoDelPrograma);

            const requestBody = { contents: [{ parts: [{ text: promptText }] }] };
            const response = await axios.post(url, requestBody, { headers: { 'Content-Type': 'application/json' } });
            const contenidoIA = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (contenidoIA) {
                const informeFormateado = formatearInformeIAPOS(contenidoIA, stats, tipoInforme, userPrompt);
                return res.json({ informe: informeFormateado });
            } else {
                throw new Error('Respuesta vacía de IA');
            }
        } catch (error) {
            console.error('❌ Error con IA:', error.message);
            const informeAutomatico = generarInformeAutomatico(stats, userPrompt);
            return res.json({ informe: informeAutomatico });
        }
    } catch (error) {
        console.error('💥 Error general en /generar-informe:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- FUNCIONES LÓGICAS PARA INFORMES ---
function determinarTipoInforme(userPrompt) {
    const prompt = userPrompt ? userPrompt.toLowerCase() : '';
    if (prompt.includes('cáncer') || prompt.includes('cancer')) return 'cancer';
    // ... puedes agregar más lógica aquí
    return 'completo';
}

function generarPromptEspecifico(tipoInforme, stats, userPrompt, contexto) {
    // ... (Tu lógica de prompt original, simplificada para el ejemplo)
    return `
    Actúa como analista de salud. Responde a: "${userPrompt || 'Informe general'}".
    Datos: ${JSON.stringify(stats)}
    Contexto: ${contexto}
    `;
}

function calcularEstadisticasCompletas(data) {
    // ... (Tu lógica de cálculo original. Como es muy larga, asegúrate de tenerla aquí si la borraste)
    // Para que el código funcione ahora, pongo un placeholder simple:
    return {
        totalCasos: data.length,
        // ... agrega aquí el resto de tus cálculos si los necesitas para la IA
    };
}

function formatearInformeIAPOS(contenidoIA, stats, tipoInforme, userPrompt) {
    const fecha = new Date().toLocaleDateString('es-AR');
    const logoHtml = logoBase64 
        ? `<div style="display: inline-block; background-color: #2563EB; border-radius: 50%; padding: 10px; line-height: 0;"><img src="${logoBase64}" alt="Logo IAPOS" style="height: 50px; width: auto;"></div>`
        : '<div style="color: #0066CC;">🏥 IAPOS</div>';
    
    return `
    <div style="font-family: Arial, sans-serif;">
        ${logoHtml}
        <h3>Informe Generado</h3>
        <div>${contenidoIA.replace(/\n/g, '<br>')}</div>
        <small>${fecha}</small>
    </div>`;
}

function generarInformeAutomatico(stats, userPrompt) {
    return `<p>Informe automático fallback. Casos: ${stats.totalCasos}</p>`;
}

// --- FUNCIÓN DE INICIO ---
async function startServer() {
    await loadTokens();
    await cargarContexto(); 
    
    // Iniciamos el servidor
    app.listen(PORT, async () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
        console.log('Si es tu primera vez, visita http://localhost:3000/auth para autenticarte.');
        
        // --- CARGA INICIAL DE DATOS (Background) ---
        await cargarDatosDeGoogle();
    });
}

startServer();
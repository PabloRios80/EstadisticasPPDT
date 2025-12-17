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
// El resto de tu código sigue abajo...

require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const app = express();
// --- CÓDIGO PARA CARGAR EL LOGO (CORREGIDO) ---
let logoBase64 = '';
try {
    // Le indicamos que entre a la carpeta 'public' a buscar el logo
    const logoData = fs.readFileSync(path.join(__dirname, 'public', 'logo_iapos.png'));
    logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
    console.log('✅ Logo de IAPOS cargado correctamente.');
} catch (error) {
    console.error('❌ No se pudo encontrar el archivo logo_iapos.png en la carpeta /public.');
}
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/oauth2callback';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// CON ESTE BLOQUE:
const mountPath = '/opt/render/project/src/data';
const dataPath = fs.existsSync(mountPath) ? mountPath : __dirname;
const TOKEN_PATH = path.join(dataPath, 'token.json');

// Asegúrate de que el directorio exista
if (process.env.RENDER_DISK_MOUNT_PATH && !fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let contextoDelPrograma = '';

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

// En tu server.js, reemplaza la función loadTokens por esta:
async function loadTokens() {
    // PRIMERO: Intenta leer el token desde la variable de entorno en Render.
    if (process.env.GOOGLE_TOKEN) {
        try {
            console.log('Token encontrado en la variable de entorno. Intentando usarlo...');
            const tokens = JSON.parse(process.env.GOOGLE_TOKEN);
            oauth2Client.setCredentials(tokens);
            console.log('✅ Credenciales de Google cargadas exitosamente desde la variable de entorno.');
            return true;
        } catch (err) {
            console.error('❌ Error al procesar el GOOGLE_TOKEN. Asegúrate de que el contenido copiado sea un JSON válido.', err);
            return false;
        }
    }

    // SEGUNDO: Si no está en Render (está en tu PC), buscará el archivo token.json.
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
    // Log para saber dónde está intentando guardar el archivo
    console.log(`[DEBUG] Intentando escribir el token en la ruta: ${TOKEN_PATH}`);

    try {
        // Intentamos escribir el archivo
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

        // Si tiene éxito, lo decimos
        console.log(`✅ Token guardado exitosamente.`);

    } catch (err) {
        // Si falla, MOSTRAMOS EL ERROR DETALLADO
        console.error(`❌ ERROR CRÍTICO AL INTENTAR GUARDAR EL TOKEN:`, err);
    }
}

app.use(express.static(path.join(__dirname, 'public'), { index: 'estadisticas.html' }));
app.use(express.json({ limit: '50mb' }));

function normalizeString(str) { 
    if (!str) return '';
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}


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

async function getAuthenticatedClient() {
    const areTokensLoaded = await loadTokens();
    if (!areTokensLoaded) {
        throw new Error('Tokens no cargados. Por favor, autentícate primero en /auth.');
    }
    return oauth2Client;
}

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

app.get('/obtener-opciones-campo/:campo', async (req, res) => {
    try {
        const authClient = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const sheetName = 'Integrado';
        const field = req.params.campo;

        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!1:1`,
        });
        const headers = headersResponse.data.values[0];
        const columnIndex = headers.indexOf(field);

        if (columnIndex === -1) {
            return res.status(404).json({ error: 'Campo no encontrado' });
        }

        const columnRange = `${sheetName}!${String.fromCharCode(65 + columnIndex)}:${String.fromCharCode(65 + columnIndex)}`;
        const valuesResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: columnRange,
        });

        const columnValues = valuesResponse.data.values ? valuesResponse.data.values.slice(1).flat() : [];
        const uniqueValues = [...new Set(columnValues.filter(val => val && val.trim() !== ''))];

        res.json(uniqueValues);
    } catch (error) {
        console.error('Error al obtener opciones para el campo:', error);
        res.status(500).json({ error: 'Error del servidor al obtener opciones' });
    }
});
app.get('/obtener-datos-completos', async (req, res) => {
    try {
        const authClient = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        // --- CAMBIO IMPORTANTE: Probamos con Mayúscula en 'Seguridad' ---
        // Verifica en tu Google Sheet si la pestaña se llama "Seguridad" o "seguridad"
        const sources = [
            { sheetName: 'Integrado', label: 'General' },
            { sheetName: 'Seguridad', label: 'Seguridad' } 
        ];

        console.log("📥 Iniciando carga de datos multi-pestaña...");

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
                // AQUÍ VEREMOS SI EL NOMBRE ESTÁ MAL
                console.error(`❌ ERROR CRÍTICO leyendo pestaña "${source.sheetName}":`, error.message);
                return []; 
            }
        });

        const results = await Promise.all(promises);
        const allRows = results.flat();

        console.log(`📊 TOTAL FINAL: ${allRows.length} registros cargados en memoria.`);
        console.log(`   - General: ${allRows.filter(r => r.Poblacion === 'General').length}`);
        console.log(`   - Seguridad: ${allRows.filter(r => r.Poblacion === 'Seguridad').length}`);

        const tipo = req.query.tipo;
        const filteredData = tipo ? allRows.filter(row => normalizeString(row['Tipo']) === normalizeString(tipo)) : allRows;

        res.json(filteredData);

    } catch (error) {
        console.error('Error general en obtener-datos-completos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.get('/obtener-indicadores-fijos', async (req, res) => {
    try {
        const authClient = await getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const sheetName = 'Integrado';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:DM`,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
        });

        const [headers, ...rows] = response.data.values;
        const data = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });

        const tipo = req.query.tipo;
        const dataParaCalculo = tipo ? data.filter(row => normalizeString(row['Tipo']) === normalizeString(tipo)) : data;

        const dniMap = new Map();
        dataParaCalculo.forEach(row => {
            const dni = row['DNI'];
            const timestamp = row['Marca temporal'];
            if (dni && timestamp) {
                if (!dniMap.has(dni) || dniMap.get(dni)['Marca temporal'] < timestamp) {
                    dniMap.set(dni, row);
                }
            }
        });
        const diasPreventivos = dniMap.size;

        const sexos = { masculino: 0, femenino: 0 };
        dniMap.forEach(row => {
            const sexo = (row['Sexo'] || '').toLowerCase();
            if (sexo === 'masculino') sexos.masculino++;
            if (sexo === 'femenino') sexos.femenino++;
        });
        const totalSexo = sexos.masculino + sexos.femenino;
        const porcentajeMasculino = totalSexo ? ((sexos.masculino / totalSexo) * 100).toFixed(2) : 0;
        const porcentajeFemenino = totalSexo ? ((sexos.femenino / totalSexo) * 100).toFixed(2) : 0;

        const edadGrupos = {
            'Menores de 18': 0, '18 a 30': 0, '30 a 50': 0, 'Mayores de 50': 0
        };
        dniMap.forEach(row => {
            const edad = parseInt(row['Edad'], 10);
            if (!isNaN(edad)) {
                if (edad < 18) edadGrupos['Menores de 18']++;
                else if (edad >= 18 && edad <= 30) edadGrupos['18 a 30']++;
                else if (edad > 30 && edad <= 50) edadGrupos['30 a 50']++;
                else if (edad > 50) edadGrupos['Mayores de 50']++;
            }
        });

        const enfermedades = {
            diabetes: 0, hipertension: 0, dislipemias: 0, obesos: 0, fumadores: 0
        };
        dniMap.forEach(row => {
            if ((row['Diabetes'] || '').trim().toLowerCase() === 'presenta') enfermedades.diabetes++;
            const presion = (row['Presión Arterial'] || '').trim().toLowerCase();
            if (presion.includes('hipertens')) enfermedades.hipertension++;
            if ((row['Dislipemias'] || '').trim().toLowerCase() === 'presenta') enfermedades.dislipemias++;
            if ((row['Tabaco'] || '').trim().toLowerCase() === 'fuma') enfermedades.fumadores++;
            const imc = (row['IMC'] || '').trim().toLowerCase();
            if (imc.includes('sobrepeso') || imc.includes('obesidad')) enfermedades.obesidad++;
        });

        let altoRiesgoCount = 0;
        dniMap.forEach(row => {
            const edad = parseInt(row['Edad'], 10);
            const diabetes = (row['Diabetes'] || '').trim().toLowerCase();
            const presion = (row['Presión Arterial'] || '').trim().toLowerCase();
            const imc = (row['IMC'] || '').trim().toLowerCase();
            const tabaco = (row['Tabaco'] || '').trim().toLowerCase();
            
            const isAltoRiesgo = 
                edad > 50 &&
                (diabetes === 'presenta' ||
                presion.includes('hipertens') ||
                imc.includes('sobrepeso') || imc.includes('obesidad') ||
                tabaco === 'fuma');
            
            if (isAltoRiesgo) {
                altoRiesgoCount++;
            }
        });
        
        const indicadores = {
            diasPreventivos: diasPreventivos,
            sexo: {
                ...sexos,
                porcentajeMasculino,
                porcentajeFemenino
            },
            edad: edadGrupos,
            enfermedades: enfermedades,
            altoRiesgo: altoRiesgoCount
        };
        res.json(indicadores);

    } catch (error) {
        console.error('Error al obtener los indicadores fijos:', error);
        res.status(500).json({ error: 'Error del servidor al obtener los indicadores.' });
    }
});


// --- FUNCIONES AUXILIARES ---

function determinarTipoInforme(userPrompt) {
    const prompt = userPrompt.toLowerCase();
    if (prompt.includes('cáncer') || prompt.includes('cancer')) return 'cancer';
    if (prompt.includes('cardio') || prompt.includes('corazón') || prompt.includes('corazon')) return 'cardiovascular';
    if (prompt.includes('diabetes')) return 'diabetes';
    if (prompt.includes('hipertensión') || prompt.includes('hipertension')) return 'hipertension';
    if (prompt.includes('nutrición') || prompt.includes('nutricion') || prompt.includes('obesidad')) return 'nutricion';
    if (prompt.includes('tabaco') || prompt.includes('fumar')) return 'tabaquismo';
    return 'completo';
}
function generarPromptEspecifico(tipoInforme, stats, userPrompt, contexto) {
    const resumenEdad = `Edad promedio: ${stats.edadPromedio || 'N/D'}, Rango de edad: ${stats.edadMinima || 'N/D'} - ${stats.edadMaxima || 'N/D'}.`;

    // --- SECCIÓN PRE-ESCRITA PARA EL ANÁLISIS DE CÁNCER (LA SOLUCIÓN QUE FUNCIONA) ---
    const textoAnalisisCancer = `Para Cáncer Cervicouterino, el programa identificó a **${stats.deteccionCancerCervico_PAP}** casos de **detección temprana** (a través de PAP) y **${stats.riesgoCancerCervico_HPV}** personas con **alto riesgo** (por HPV+), quienes requieren seguimiento prioritario. En cuanto al Cáncer de Colon, se lograron **${stats.deteccionCancerColon_Colono}** **detecciones tempranas** mediante colonoscopía y se identificaron **${stats.riesgoCancerColon_SOMF}** personas con **alto riesgo** (por SOMF+). Para Cáncer de Mama, se registraron **${stats.totalCancerMama}** detecciones, y en hombres, se encontraron **${stats.totalCancerProstata}** casos con PSA alterado.`;
    // --- FIN DE LA SECCIÓN ---

    let instruccionesParaIA;

    if (userPrompt && userPrompt.trim() !== '') {
        // Opción A: Si el usuario escribió un prompt personalizado.
        instruccionesParaIA = `
        **TAREA PRINCIPAL:** Eres un analista de datos de salud. Tu única misión es responder de manera detallada y analítica a la siguiente solicitud específica del usuario, utilizando los datos estadísticos proporcionados como evidencia.
        **SOLICITUD ESPECÍFICA DEL USUARIO:** "${userPrompt}"
        **REGLAS PARA ESTA TAREA:**
        - Enfócate exclusivamente en responder la pregunta del usuario. No generes un informe general por capítulos.
        - Basa cada afirmación en los números de la sección de DATOS.
        - Utiliza **negritas** para resaltar los datos y hallazgos más importantes en tu respuesta.`;
    } else {
        // Opción B: Si el cuadro de texto está vacío, se usa el prompt completo para el informe general.
        instruccionesParaIA = `
        **TAREA PRINCIPAL:** Actúa como un analista experto en salud pública para la provincia de Santa Fe, Argentina. Tu misión es redactar un informe ejecutivo claro y perspicaz sobre los resultados del programa "Día Preventivo IAPOS", comparando los hallazgos con estadísticas provinciales.

        **INSTRUCCIONES Y ESTRUCTURA DEL INFORME:**

        1.  **Introducción:** Usando el CONTEXTO, redacta un párrafo de 4-5 líneas sobre la misión del programa.

        2.  **Resumen Ejecutivo:** Identifica los 3 o 4 hallazgos más impactantes de los DATOS, especialmente donde la prevalencia del programa difiera de la media poblacional.

        3.  **Análisis Detallado por Capítulos:**
            -   **Tarea Central:** Para cada patología, presenta el dato del programa y **compáralo con la estadística de prevalencia más actualizada que encuentres para Santa Fe o Argentina**. Ofrece una breve reflexión sobre la comparación.
            -   **Capítulos a incluir:**
                -   "Análisis Global de la Población"
                -   "❤️ Riesgo Cardiovascular y Enfermedades Crónicas"
                -   "🎗️ Prevención de Cáncer"
                    -   **Sub-Tarea Obligatoria para Cáncer:** Para esta sección, **INSERTA EL SIGUIENTE BLOQUE DE TEXTO DE FORMA LITERAL:**
                        ---
                        ${textoAnalisisCancer}
                        ---
                -   "🦠 Prevalencia de Enfermedades Infecciosas"
                -   "⚕️ Otros Indicadores de Salud Relevantes"
        
        4.  **Conclusiones:** Enfócate en el impacto positivo del programa.

        5.  **Fuentes de Datos Externos:** Al final del informe, crea una sección titulada "Fuentes" y lista las fuentes que usaste para las estadísticas provinciales/nacionales.

        **REGLAS DE FORMATO Y ESTILO:**
        -   El informe debe comenzar directamente con la "Introducción". **NO incluyas encabezados formales como 'Para:', 'De:', 'Asunto:' o 'Fecha:'.**
        -   Basa **TODAS** tus afirmaciones en los datos proporcionados.`;
    }
    
    // --- ARMADO FINAL DEL PROMPT ---
    return `
    ${instruccionesParaIA}

    --------------------------------
    CONTEXTO Y DATOS DE REFERENCIA
    --------------------------------
    
    **Contexto del Programa:**
    ${contexto}

    **Datos Estadísticos del Grupo Analizado:**
    - Total de personas: ${stats.totalCasos}
    - Distribución por sexo: ${stats.totalMujeres} mujeres y ${stats.totalHombres} hombres.
    - Distribución por edad: ${stats.adultos} adultos y ${stats.pediatrico} pediátricos. ${resumenEdad}
    - Riesgo Cardiovascular: Diabetes (${stats.prevalenciaDiabetes}%), Hipertensión (${stats.prevalenciaHipertension}%), Dislipemias (${stats.prevalenciaDislipemias}%), Tabaquismo (${stats.prevalenciaTabaquismo}%), Obesidad (${stats.prevalenciaObesidad}%), Sobrepeso (${stats.prevalenciaSobrepeso}%).
    - C. de Mama (Detección): ${stats.totalCancerMama}
    - C. de Próstata (PSA alterado): ${stats.totalCancerProstata}
    - C. Cervicouterino: ${stats.riesgoCancerCervico_HPV} riesgo (HPV+), ${stats.deteccionCancerCervico_PAP} detección (PAP).
    - C. de Colon: ${stats.riesgoCancerColon_SOMF} riesgo (SOMF+), ${stats.deteccionCancerColon_Colono} detección (Colonoscopía).
    - Infecciosas (Screening): ${stats.totalVIH} VIH+, ${stats.totalHepatitisB} Hep B+, ${stats.totalHepatitisC} Hep C+, ${stats.totalVDRL} VDRL+, ${stats.totalChagas} Chagas+.
    - Otros Indicadores: ${stats.totalSaludBucalRiesgo} con riesgo bucal, ${stats.totalSaludRenalPatologico} con ERC, ${stats.totalDepresion} con depresión, ${stats.totalEPOC} con EPOC, ${stats.totalAgudezaVisual} con agudeza visual alterada.
    `;
}
// Funciones de cálculo para los indicadores
function calcularCancerMama(data) {
    return data.filter(r => 
        normalizeString(r['Cáncer mama - Mamografía']) === 'patologico' || 
        normalizeString(r['Cáncer mama - Eco mamaria']) === 'patologico'
    ).length;
}

function calcularCancerCervicoUterino(data) {
    return data.filter(r => 
        normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico' || 
        normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico'
    ).length;
}

function calcularCancerColon(data) {
    return data.filter(r => 
        normalizeString(r['SOMF']) === 'patologico' || 
        normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico'
    ).length;
}

function calcularCancerProstata(data) {
    return data.filter(r => 
        normalizeString(r['Próstata - PSA']) === 'patologico'
    ).length;
}
function calcularIndicadoresCompletos(data) {
    // Usar los indicadores fijos que ya calculas
    const fixedIndicators = {
        diasPreventivos: data.length,
        sexo: {
            femenino: data.filter(r => normalizeString(r.Sexo) === 'femenino').length,
            masculino: data.filter(r => normalizeString(r.Sexo) === 'masculino').length
        },
        edad: {
            'Menores de 18': data.filter(r => parseInt(r.Edad) < 18).length,
            '18 a 30': data.filter(r => parseInt(r.Edad) >= 18 && parseInt(r.Edad) <= 30).length,
            '30 a 50': data.filter(r => parseInt(r.Edad) > 30 && parseInt(r.Edad) <= 50).length,
            'Mayores de 50': data.filter(r => parseInt(r.Edad) > 50).length
        },
        enfermedades: {
            diabetes: data.filter(r => normalizeString(r.Diabetes) === 'presenta').length,
            hipertension: data.filter(r => normalizeString(r['Presión Arterial']).includes('hipertens')).length,
            dislipemias: data.filter(r => normalizeString(r.Dislipemias) === 'presenta').length,
            fumadores: data.filter(r => normalizeString(r.Tabaco) === 'fuma').length,
            obesos: data.filter(r => normalizeString(r.IMC).includes('obesidad')).length
        },
        altoRiesgo: data.filter(r => {
            const edad = parseInt(r.Edad);
            return edad > 50 && (
                normalizeString(r.Diabetes) === 'presenta' ||
                normalizeString(r['Presión Arterial']).includes('hipertens') ||
                normalizeString(r.IMC).includes('obesidad') || 
                normalizeString(r.IMC).includes('sobrepeso') ||
                normalizeString(r.Tabaco) === 'fuma'
            );
        }).length,
        
        // Indicadores de cáncer
        cancerMama: data.filter(r => 
            normalizeString(r['Cáncer mama - Mamografía']) === 'patologico' || 
            normalizeString(r['Cáncer mama - Eco mamaria']) === 'patologico'
        ).length,
        
        cancerCervico: data.filter(r => 
            normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico' || 
            normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico'
        ).length,
        
        cancerColon: data.filter(r => 
            normalizeString(r['SOMF']) === 'patologico' || 
            normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico'
        ).length,
        
        cancerProstata: data.filter(r => 
            normalizeString(r['Próstata - PSA']) === 'patologico'
        ).length,
        
        // Enfermedades infecciosas
        vih: data.filter(r => normalizeString(r['VIH']) === 'positivo').length,
        hepatitisB: data.filter(r => normalizeString(r['Hepatitis B']) === 'positivo').length,
        hepatitisC: data.filter(r => normalizeString(r['Hepatitis C']) === 'positivo').length,
        vdrl: data.filter(r => normalizeString(r['VDRL']) === 'positivo').length,
        chagas: data.filter(r => normalizeString(r['Chagas']) === 'positivo').length,
        
        // Otros indicadores
        saludBucal: data.filter(r => normalizeString(r['Control Odontológico - Adultos']) === 'riesgo alto').length,
        saludRenal: data.filter(r => normalizeString(r['ERC']) === 'patológico').length,
        agudezaVisual: data.filter(r => normalizeString(r['Agudeza visual']) === 'alterada').length,
        depresion: data.filter(r => normalizeString(r['Depresión']) === 'se verifica').length,
        epoc: data.filter(r => normalizeString(r['EPOC']) === 'se verifica').length
    };
    
    return fixedIndicators;
}
app.post('/generar-informe', async (req, res) => {
    try {
        const { data, userPrompt } = req.body;
        
        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'No se recibieron datos para generar el informe.' });
        }
        
        const stats = calcularEstadisticasCompletas(data);
        const tipoInforme = determinarTipoInforme(userPrompt);
        
        console.log(`🌐 Generando informe con el modelo gemini-2.5-pro...`);
        
        try {
            // URL corregida con un modelo que SÍ está en tu lista
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const promptText = generarPromptEspecifico(tipoInforme, stats, userPrompt, contextoDelPrograma);

            const requestBody = {
                contents: [{
                    parts: [{
                        text: promptText
                    }]
                }]
            };

            const response = await axios.post(url, requestBody, {
                headers: { 'Content-Type': 'application/json' }
            });

            const contenidoIA = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (contenidoIA) {
                const informeFormateado = formatearInformeIAPOS(contenidoIA, stats, tipoInforme, userPrompt);
                console.log('✅ Informe IAPOS formateado exitosamente');
                return res.json({ informe: informeFormateado });
            } else {
                throw new Error('La respuesta de la IA vino vacía o con un formato inesperado.');
            }

        } catch (error) {
            console.error('❌ Error con IA:', error.response ? error.response.data.error : error.message);
            const informeAutomatico = generarInformeAutomatico(stats, userPrompt);
            return res.json({ informe: informeAutomatico });
        }

    } catch (error) {
        console.error('💥 Error general en /generar-informe:', error);
        return res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
});


function formatearInformeIAPOS(contenidoIA, stats, tipoInforme, userPrompt) {
    const fecha = new Date().toLocaleDateString('es-AR');

    // --- LÍNEA MODIFICADA PARA AÑADIR EL FONDO AZUL ---
    const logoHtml = logoBase64 
        // Si el logo existe, lo envuelve en un DIV circular con fondo azul
        ? `<div style="display: inline-block; background-color: #2563EB; border-radius: 50%; padding: 10px; line-height: 0;">
                <img src="${logoBase64}" alt="Logo IAPOS" style="height: 50px; width: auto;">
            </div>`
        // Si no, muestra el texto de respaldo
        : '<div style="color: #0066CC; font-size: 28px; font-weight: bold;">🏥 IAPOS</div>';
    
    return `
<div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
    <table width="100%" style="border-bottom: 3px solid #0066CC; margin-bottom: 20px;">
        <tr>
            <td width="50%">
                
                ${logoHtml}

                <div style="color: #0088CC; font-size: 18px; margin-top: 5px;">Informe de Evaluación - Día Preventivo</div>
            </td>
            <td width="50%" style="text-align: right;">
                <div style="color: #666; font-size: 14px;">${fecha}</div>
                <div style="color: #0066CC; font-size: 12px; margin-top: 5px;">Solicitud: "${userPrompt}"</div>
            </td>
        </tr>
    </table>

    <div style="line-height: 1.6;">
        ${contenidoIA.replace(/\n/g, '<br>')}
    </div>

    <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #0066CC; color: #666; font-size: 12px;">
        <strong>Programa Día Preventivo IAPOS</strong> | Informe generado automáticamente | ${fecha}
    </div>
</div>
`;
}

function calcularEstadisticasCompletas(data) {
    const total = data.length;
    if (total === 0) return { totalCasos: 0 }; // Devuelve un objeto con ceros si no hay datos

    // Objeto inicial para acumular los conteos
    let contadores = {
        mujeres: 0, hombres: 0, adultos: 0, pediatrico: 0,
        edades: [], diabetes: 0, hipertension: 0, dislipemias: 0,
        tabaquismo: 0, obesidad: 0, sobrepeso: 0, tieneEnfermedadCronica: 0,
        cancerMama: 0, cancerCervico: 0, cancerColon: 0, cancerProstata: 0,
        riesgoHPV: 0, deteccionPAP: 0, riesgoSOMF: 0, deteccionColono: 0,
        vih: 0, hepatitisB: 0, hepatitisC: 0, vdrl: 0, chagas: 0,
        saludBucal: 0, saludRenal: 0, depresion: 0, epoc: 0,
        agudezaVisual: 0, violencia: 0, consumoSustancias: 0,
        sindromeMetabolico: 0, aneurismaAorta: 0, osteoporosis: 0, riesgoCaidas: 0,
        sedentarismo: 0, seguridadVial: 0, alcoholismo: 0, vacunacionIncompleta: 0, acidoFolico: 0
    };

    // Recorremos los datos UNA SOLA VEZ para contar todo
    for (const r of data) {
        const edad = parseInt(r.Edad, 10);
        if (!isNaN(edad)) {
            contadores.edades.push(edad);
            if (edad >= 18) contadores.adultos++;
            else contadores.pediatrico++;
        }
        if (normalizeString(r.Sexo) === 'femenino') contadores.mujeres++;
        if (normalizeString(r.Sexo) === 'masculino') contadores.hombres++;
        const esDiabetico = normalizeString(r.Diabetes) === 'presenta';
        const esHipertenso = normalizeString(r['Presión Arterial']).includes('hipertens');
        const tieneDislipemia = normalizeString(r.Dislipemias) === 'presenta';
        if (esDiabetico) contadores.diabetes++;
        if (esHipertenso) contadores.hipertension++;
        if (tieneDislipemia) contadores.dislipemias++;
        if (esDiabetico || esHipertenso || tieneDislipemia) contadores.tieneEnfermedadCronica++;
        if (normalizeString(r.Tabaco) === 'fuma') contadores.tabaquismo++;
        const imc = normalizeString(r.IMC);
        if (imc.includes('obesidad')) contadores.obesidad++;
        if (imc.includes('sobrepeso')) contadores.sobrepeso++;
        if (normalizeString(r['Cáncer mama - Mamografía']) === 'patologico' || normalizeString(r['Cáncer mama - Eco mamaria']) === 'patologico') contadores.cancerMama++;
        if (normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico' || normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico') contadores.cancerCervico++;
        if (normalizeString(r['SOMF']) === 'patologico' || normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico') contadores.cancerColon++;
        if (normalizeString(r['Próstata - PSA']) === 'patologico') contadores.cancerProstata++;
         // --- LÓGICA DE CONTEO SEPARADA (LA CLAVE DEL ARREGLO) ---
        if (normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico') contadores.riesgoHPV++;
        if (normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico') contadores.deteccionPAP++;
        if (normalizeString(r['SOMF']) === 'patologico') contadores.riesgoSOMF++;
        if (normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico') contadores.deteccionColono++;
        // --- FIN DE LA CLAVE ---
        if (normalizeString(r['VIH']) === 'positivo') contadores.vih++;
        if (normalizeString(r['Hepatitis B']) === 'positivo') contadores.hepatitisB++;
        if (normalizeString(r['Hepatitis C']) === 'positivo') contadores.hepatitisC++;
        if (normalizeString(r['VDRL']) === 'positivo') contadores.vdrl++;
        if (normalizeString(r['Chagas']) === 'positivo') contadores.chagas++;
        if (normalizeString(r['Control Odontológico - Adultos']) === 'riesgo alto') contadores.saludBucal++;
        if (normalizeString(r['ERC']) === 'patológico') contadores.saludRenal++;
        if (normalizeString(r['Depresión']) === 'se verifica') contadores.depresion++;
        if (normalizeString(r['EPOC']) === 'se verifica') contadores.epoc++;
        if (normalizeString(r['Agudeza visual']) === 'alterada') contadores.agudezaVisual++;
        if (normalizeString(r['Violencia']) === 'se verifica') contadores.violencia++;
        if (normalizeString(r['Consumo de sustancias']) === 'problematico') contadores.consumoSustancias++;
        if (normalizeString(r['Síndrome Metabólico']) === 'presenta') contadores.sindromeMetabolico++;
        if (normalizeString(r['Aneurisma aorta']) === 'se verifica') contadores.aneurismaAorta++;
        if (normalizeString(r['Osteoporosis']) === 'se verifica') contadores.osteoporosis++;
        if (normalizeString(r['Caídas en adultos mayores']) === 'presenta') contadores.riesgoCaidas++;
        if (normalizeString(r['Actividad física']) === 'no realiza') contadores.sedentarismo++;
        if (normalizeString(r['Seguridad vial']) === 'no cumple') contadores.seguridadVial++;
        if (normalizeString(r['Abuso alcohol']) === 'abusa') contadores.alcoholismo++;
        if (normalizeString(r['Inmunizaciones']) === 'incompleto') contadores.vacunacionIncompleta++;
        if (normalizeString(r['Ácido fólico']) === 'indicado') contadores.acidoFolico++;
    }

    const edadPromedio = contadores.edades.length > 0 ? (contadores.edades.reduce((a, b) => a + b, 0) / contadores.edades.length).toFixed(1) : 'N/D';
    const edadMin = contadores.edades.length > 0 ? Math.min(...contadores.edades) : 'N/D';
    const edadMax = contadores.edades.length > 0 ? Math.max(...contadores.edades) : 'N/D';

    return {
        totalCasos: total,
        totalMujeres: contadores.mujeres,
        totalHombres: contadores.hombres,
        adultos: contadores.adultos,
        pediatrico: contadores.pediatrico,
        edadPromedio: edadPromedio,
        edadMinima: edadMin,
        edadMaxima: edadMax,
        prevalenciaDiabetes: ((contadores.diabetes / total) * 100).toFixed(1),
        prevalenciaHipertension: ((contadores.hipertension / total) * 100).toFixed(1),
        prevalenciaDislipemias: ((contadores.dislipemias / total) * 100).toFixed(1),
        prevalenciaTabaquismo: ((contadores.tabaquismo / total) * 100).toFixed(1),
        prevalenciaObesidad: ((contadores.obesidad / total) * 100).toFixed(1),
        prevalenciaSobrepeso: ((contadores.sobrepeso / total) * 100).toFixed(1),
        enfermedadesCronicas: contadores.tieneEnfermedadCronica,
        totalCancerMama: contadores.cancerMama,
        totalCancerCervico: contadores.cancerCervico,
        totalCancerColon: contadores.cancerColon,
        totalCancerProstata: contadores.cancerProstata,
        // --- PROPIEDADES SEPARADAS PARA EL PROMPT (LA CLAVE DEL ARREGLO) ---
        riesgoCancerCervico_HPV: contadores.riesgoHPV,
        deteccionCancerCervico_PAP: contadores.deteccionPAP,
        riesgoCancerColon_SOMF: contadores.riesgoSOMF,
        deteccionCancerColon_Colono: contadores.deteccionColono,
        // --- FIN DE LA CLAVE ---
        totalVIH: contadores.vih,
        totalHepatitisB: contadores.hepatitisB,
        totalHepatitisC: contadores.hepatitisC,
        totalVDRL: contadores.vdrl,
        totalChagas: contadores.chagas,
        totalSaludBucalRiesgo: contadores.saludBucal,
        totalSaludRenalPatologico: contadores.saludRenal,
        totalDepresion: contadores.depresion,
        totalEPOC: contadores.epoc,
        totalAgudezaVisual: contadores.agudezaVisual,
        totalViolencia: contadores.violencia,
        totalConsumoSustancias: contadores.consumoSustancias,
        totalSindromeMetabolico: contadores.sindromeMetabolico,
        totalAneurismaAorta: contadores.aneurismaAorta,
        totalOsteoporosis: contadores.osteoporosis,
        totalRiesgoCaidas: contadores.riesgoCaidas,
        totalSedentarismo: contadores.sedentarismo,
        totalSeguridadVial: contadores.seguridadVial,
        totalAlcoholismo: contadores.alcoholismo,
        totalVacunacionIncompleta: contadores.vacunacionIncompleta,
        totalAcidoFolico: contadores.acidoFolico, // <--- La última línea no necesita coma.
        distribucionSexo: {
            mujeres: contadores.mujeres,
            hombres: contadores.hombres,
            porcentajeMujeres: ((contadores.mujeres / total) * 100).toFixed(1),
            porcentajeHombres: ((contadores.hombres / total) * 100).toFixed(1)
        },
        distribucionEdad: {
            adultos: contadores.adultos,
            pediatrico: contadores.pediatrico,
            porcentajeAdultos: ((contadores.adultos / total) * 100).toFixed(1),
            porcentajePediatrico: ((contadores.pediatrico / total) * 100).toFixed(1)
        }
    };
}
function generarInformeAutomatico(stats, userPrompt) {
    return formatearInformeIAPOS(`
<h3 style="color: #0066CC;">📋 INFORME AUTOMÁTICO IAPOS</h3>
<p>El sistema ha procesado <strong>${stats.totalCasos} casos</strong> del Programa Día Preventivo.</p>

<h4 style="color: #0088CC;">🔍 Hallazgos Principales:</h4>
<ul>
    <li>Prevalencia de diabetes: <strong style="color: #CC0000;">${stats.prevalenciaDiabetes}%</strong></li>
    <li>Prevalencia de hipertensión: <strong style="color: #CC0000;">${stats.prevalenciaHipertension}%</strong></li>
</ul>

<h4 style="color: #0088CC;">💡 Recomendaciones Generales:</h4>
<ol>
    <li>Fortalecer screening cardiovascular</li>
    <li>Implementar seguimiento de casos críticos</li>
    <li>Desarrollar programas educativos continuos</li>
</ol>

<p style="color: #666;"><em>Para análisis detallados con IA, contactar al administrador.</em></p>
`, stats, 'completo', userPrompt);
}
async function startServer() {
    await loadTokens();
    await cargarContexto(); // Carga el contexto del programa antes de iniciar
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
        console.log('Si es tu primera vez, visita http://localhost:3000/auth para autenticarte.');
    });
}
startServer();
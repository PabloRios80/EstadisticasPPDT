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

if (!fs.existsSync(dataPath)) {
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

async function loadTokens() {
    try {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        oauth2Client.setCredentials(tokens);
        console.log('Tokens cargados con éxito.');
        return true;
    } catch (err) {
        console.log('No se encontraron tokens. Se requiere autenticación.');
        return false;
    }
}

function saveTokens(tokens) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Tokens guardados en token.json.');
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
        const filteredData = tipo ? data.filter(row => normalizeString(row['Tipo']) === normalizeString(tipo)) : data;

        res.json(filteredData);
    } catch (error) {
        console.error('Error al obtener todos los datos:', error);
        res.status(500).json({ error: 'Error del servidor al obtener todos los datos' });
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
    // Usamos los datos de edad que ya calculamos. Si no existen, ponemos 'N/D'.
    const resumenEdad = `Edad promedio: ${stats.edadPromedio || 'N/D'}, Rango de edad: ${stats.edadMinima || 'N/D'} - ${stats.edadMaxima || 'N/D'}.`;

    // --- LÓGICA INTELIGENTE: AQUÍ DECIDIMOS LAS INSTRUCCIONES A USAR ---
    let instruccionesParaIA;

    if (userPrompt && userPrompt.trim() !== '') {
        // Opción A: Si el usuario escribió un prompt personalizado, usamos estas instrucciones concisas.
        instruccionesParaIA = `
        **TAREA PRINCIPAL:** Eres un analista de datos de salud. Tu única misión es responder de manera detallada y analítica a la siguiente solicitud específica del usuario, utilizando los datos estadísticos proporcionados como evidencia.

        **SOLICITUD ESPECÍFICA DEL USUARIO:** "${userPrompt}"

        **REGLAS PARA ESTA TAREA:**
        - Enfócate exclusivamente en responder la pregunta del usuario. No generes un informe general por capítulos.
        - Basa cada afirmación en los números de la sección de DATOS.
        - Utiliza **negritas** para resaltar los datos y hallazgos más importantes en tu respuesta.
        - Sé directo, claro y ofrece reflexiones sobre los datos que presentas.
        `;
    } else {
        // Opción B: Si el cuadro de texto está vacío, usamos TU PROMPT COMPLETO Y ORIGINAL, sin quitar nada.
        instruccionesParaIA = `
        --------------------------------
        TAREA PRINCIPAL
        --------------------------------
        Actúa como un experto en salud pública y epidemiología. Tu misión es redactar un informe ejecutivo claro, perspicaz y accionable sobre los resultados del programa "Día Preventivo IAPOS", basado ESTRICTAMENTE en el contexto y los datos estadísticos que te proporciono.

        --------------------------------
        INSTRUCCIONES Y ESTRUCTURA DEL INFORME (Tu guion)
        --------------------------------

        1. Introducción al Programa Día Preventivo:**
           - **Tarea:** Usando la información del CONTEXTO, redacta un párrafo introductorio de 4-5 líneas que explique qué es el programa, su marco normativo y su importancia estratégica para la salud pública. Este debe ser el primer capítulo del informe.

        2. Resumen Ejecutivo (Hallazgos Clave):**
           - **Tarea:** Identifica los 3 o 4 hallazgos más impactantes o preocupantes de los DATOS ESTADÍSTICOS. Preséntalos en un párrafo conciso. No te limites a repetir los números; interpreta lo que significan.

        3. Análisis Detallado por Capítulos:**
           - **Tarea:** Para cada capítulo, no solo presentes el dato. **Explica sus implicaciones, reflexiona sobre por qué podría estar ocurriendo y, si es apropiado, sugiere una o dos líneas de acción o preguntas para futuras investigaciones.** Adopta un tono más analítico y menos robótico.
             - "Análisis Global de la Población"
             - "❤️ Riesgo Cardiovascular y Enfermedades Crónicas"
             - "🎗️ Prevención de Cáncer"
             - "🦠 Prevalencia de Enfermedades Infecciosas"
             - "🚭 Hábitos y Estilo de Vida"

        REGLAS DE INTERPRETACIÓN CLÍNICA (MUY IMPORTANTE):
        - Un resultado de **SOMF+** o **HPV+** NO es un diagnóstico de cáncer. Debes describirlo como un **INDICADOR DE RIESGO ELEVADO** que requiere estudios adicionales.
        - En cambio, un hallazgo patológico en **PAP** o **Colonoscopía** sí debe ser mencionado como un caso de **DETECCIÓN TEMPRANA DE CANCER**.
        - Basa **TODAS** tus afirmaciones exclusivamente en los datos estadísticos proporcionados.

        4. Conclusiones:** Finaliza con una sección titulada "Conclusiones". Más que hacer recomendaciones, enfócate en lo positivo del programa, los casos que se detectaron que pueden mejorar la calidad de vida y cómo es importante continuar en este camino.
        
        5. Estilo de Escritura:**
           - Utiliza **negritas** para resaltar cifras, porcentajes y frases clave de alto impacto.
           - Mantén un lenguaje técnico pero claro y accesible.
           - Sé directo y conciso. No agregues texto de relleno.
           - Basa **TODAS** tus afirmaciones exclusivamente en los datos estadísticos proporcionados arriba. Si un dato es 0, menciónalo como "no se detectaron casos" o "baja prevalencia". NO digas que "no hay datos".

        REGLAS ESTRICTAS:
        - Lenguaje técnico pero accesible
        - Máximo 20 renglones por capítulo
        - Enfoque en prevención y salud pública
        - Basado exclusivamente en los datos proporcionados
        - Formato profesional para informes médicos
        - Sin preámbulos ni introducciones redundantes

        RESPONDER ÚNICAMENTE CON EL CONTENIDO DEL INFORME.
        
        REGLA DE ORO:** Tienes permiso para "volar un poco más" en tu análisis y redacción, conectando los puntos y ofreciendo reflexiones, pero **NUNCA para inventar datos o conclusiones que no se sustenten en los números proporcionados.** Sé estricto con la evidencia.
        `;
    }
    
    // --- ARMADO FINAL DEL PROMPT ---
    return `
    CONTEXTO DEL PROGRAMA IAPOS:
    ${contexto}

    DATOS ESTADÍSTICOS DEL GRUPO ANALIZADO:
    - Total de personas: ${stats.totalCasos}
    - Distribución por sexo: ${stats.totalMujeres} mujeres y ${stats.totalHombres} hombres.
    - Distribución por edad: ${stats.adultos} adultos y ${stats.pediatrico} pediátricos. ${resumenEdad}
    - Prevalencias de riesgo cardiovascular: Diabetes (${stats.prevalenciaDiabetes}%), Hipertensión (${stats.prevalenciaHipertension}%), Dislipemias (${stats.prevalenciaDislipemias}%), Tabaquismo (${stats.prevalenciaTabaquismo}%), Obesidad (${stats.prevalenciaObesidad}%), Sobrepeso (${stats.prevalenciaSobrepeso}%).
    - Casos de Cáncer (screening patológico): Mama (${stats.totalCancerMama}), Cervicouterino (${stats.totalCancerCervico}), Colon (${stats.totalCancerColon}), Próstata (${stats.totalCancerProstata}).
    - Casos de Infecciosas (screening positivo): VIH (${stats.totalVIH}), Hepatitis B (${stats.totalHepatitisB}), Hepatitis C (${stats.totalHepatitisC}), Sífilis/VDRL (${stats.totalVDRL}), Chagas (${stats.totalChagas}).
    - Otros Indicadores: ${stats.totalSaludBucalRiesgo} con riesgo bucal, ${stats.totalSaludRenalPatologico} con ERC, ${stats.totalDepresion} con depresión, ${stats.totalEPOC} con EPOC, ${stats.totalAgudezaVisual} con agudeza visual alterada, ${stats.totalViolencia} casos de violencia, ${stats.totalSindromeMetabolico} con S. Metabólico, ${stats.totalSedentarismo} con sedentarismo, ${stats.totalAlcoholismo} casos de abuso de alcohol, ${stats.totalVacunacionIncompleta} con vacunas incompletas, ${stats.totalAcidoFolico} con indicación de ácido fólico.

    --------------------------------
    INSTRUCCIONES PARA ESTE INFORME
    --------------------------------
    ${instruccionesParaIA}
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
        
        // Calcular TODAS las estadísticas necesarias
        const totalCasos = data.length;
        const stats = calcularEstadisticasCompletas(data);

        // Determinar el tipo de informe solicitado
        const tipoInforme = determinarTipoInforme(userPrompt);
        
        console.log(`🌐 Generando informe tipo: ${tipoInforme}...`);
        
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: generarPromptEspecifico(tipoInforme, stats, userPrompt, contextoDelPrograma)
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096,
                        topP: 0.8
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                }
            );

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const contenidoIA = response.data.candidates[0].content.parts[0].text;
                const informeFormateado = formatearInformeIAPOS(contenidoIA, stats, tipoInforme, userPrompt);
                
                console.log('✅ Informe IAPOS formateado exitosamente');
                return res.json({ informe: informeFormateado });
            }

        } catch (error) {
            console.error('❌ Error con IA:', error.message);
            const informeAutomatico = generarInformeAutomatico(stats, userPrompt);
            return res.json({ informe: informeAutomatico });
        }

    } catch (error) {
        console.error('💥 Error general:', error);
        return res.status(500).json({ error: 'Error interno', message: error.message });
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
require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');

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
    return `
CONTEXTO DEL PROGRAMA IAPOS:
${contexto}

DATOS ESTADÍSTICOS ACTUALES:
- Total de personas atendidas: ${stats.totalCasos}
- Mujeres: ${stats.totalMujeres} | Hombres: ${stats.totalHombres}
- Adultos: ${stats.adultos} | Pediátrico: ${stats.pediatrico}
- Diabetes: ${stats.prevalenciaDiabetes}% | Hipertensión: ${stats.prevalenciaHipertension}%
- Dislipemias: ${stats.prevalenciaDislipemias}% | Tabaquismo: ${stats.prevalenciaTabaquismo}%
- Obesidad: ${stats.prevalenciaObesidad}% | Sobrepeso: ${stats.prevalenciaSobrepeso}%
- Enfermedades crónicas: ${stats.enfermedadesCronicas} casos

SOLICITUD: "${userPrompt}"

INSTRUCCIONES ESPECÍFICAS PARA EL INFORME:

1. ENCABEZADO (5-6 renglones):
    - Historia y marco legal del Programa Día Preventivo IAPOS
    - Contexto institucional y normativo
    - Importancia en salud pública

2. ANÁLISIS GLOBAL (5-6 renglones):
    - Cantidad total de personas atendidas
    - Distribución por sexo y grupos etarios
    - Promedio y ranges de edad
    - Datos principales del dashboard

3. ANÁLISIS POR CAPÍTULOS (10-12 renglones cada uno):
    a) RIESGO CARDIOVASCULAR Y ENFERMEDADES CRÓNICAS:
      * Como especialista en cardiología, epidemiología y medicina clínica
      * Análisis de diabetes, hipertensión, dislipemias
      * Factores de riesgo integrados
      * Estrategias de prevención

    b) PREVENCIÓN DE CÁNCER:
      * Como oncólogo especialista
      * Análisis de screening y detección temprana
      * Factores de riesgo oncológicos
      * Programas de prevención específicos

    c) ENFERMEDADES INFECCIOSAS:
      * Como infectólogo especialista
      * Análisis de prevalencia e impacto
      * Estrategias de prevención y control
      * Programas de vacunación y screening

    d) HÁBITOS Y ESTILO DE VIDA:
      * Como especialista en medicina preventiva
      * Análisis de tabaquismo, nutrición, actividad física
      * Estrategias de modificación conductual

4. CONCLUSIONES Y RECOMENDACIONES (5-6 renglones):
    - Conclusiones generales del programa
    - Propuestas de mejora específicas
    - Recomendaciones estratégicas para IAPOS

REGLAS ESTRICTAS:
- Lenguaje técnico pero accesible
- Máximo 20 renglones por capítulo
- Enfoque en prevención y salud pública
- Basado exclusivamente en los datos proporcionados
- Formato profesional para informes médicos
- Sin preámbulos ni introducciones redundantes

RESPONDER ÚNICAMENTE CON EL CONTENIDO DEL INFORME.
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
    
    return `
<!-- ENCABEZADO IAPOS -->
<div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
    <table width="100%" style="border-bottom: 3px solid #0066CC; margin-bottom: 20px;">
        <tr>
            <td width="50%">
                <div style="color: #0066CC; font-size: 28px; font-weight: bold;">🏥 IAPOS</div>
                <div style="color: #0088CC; font-size: 18px; margin-top: 5px;">Informe de Evaluación - Día Preventivo</div>
            </td>
            <td width="50%" style="text-align: right;">
                <div style="color: #666; font-size: 14px;">${fecha}</div>
                <div style="color: #0066CC; font-size: 12px; margin-top: 5px;">Solicitud: "${userPrompt}"</div>
            </td>
        </tr>
    </table>

    <!-- PRINCIPALES INDICADORES -->
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #0066CC; margin-top: 0;">📊 PRINCIPALES INDICADORES</h3>
        <table width="100%" style="font-size: 14px;">
            <tr>
                <td width="33%" style="text-align: center; border-right: 1px solid #ddd;">
                    <div style="color: #CC0000; font-size: 24px; font-weight: bold;">${stats.totalCasos}</div>
                    <div style="color: #666;">Personas atendidas</div>
                </td>
                <td width="33%" style="text-align: center; border-right: 1px solid #ddd;">
                    <div style="color: #CC0000; font-size: 24px; font-weight: bold;">${stats.prevalenciaDiabetes}%</div>
                    <div style="color: #666;">Prevalencia diabetes</div>
                </td>
                <td width="33%" style="text-align: center;">
                    <div style="color: #CC0000; font-size: 24px; font-weight: bold;">${stats.prevalenciaHipertension}%</div>
                    <div style="color: #666;">Prevalencia HTA</div>
                </td>
            </tr>
        </table>
    </div>

    <!-- CONTENIDO GENERADO POR IA -->
    <div style="line-height: 1.6;">
        ${contenidoIA.replace(/\n/g, '<br>')}
    </div>

    <!-- PIE DE PÁGINA -->
    <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #0066CC; color: #666; font-size: 12px;">
        <strong>Programa Día Preventivo IAPOS</strong> | Informe generado automáticamente | ${fecha}
    </div>
</div>
`;
}
function calcularEstadisticasCompletas(data) {
    const total = data.length;
    if (total === 0) return { totalCasos: 0 };
    
    // Calcular estadísticas COMPLETAS
    const mujeres = data.filter(r => normalizeString(r.Sexo) === 'femenino').length;
    const hombres = data.filter(r => normalizeString(r.Sexo) === 'masculino').length;
    const adultos = data.filter(r => parseInt(r.Edad) >= 18).length;
    const pediatrico = data.filter(r => parseInt(r.Edad) < 18).length;
    
    // Calcular edades
    const edades = data.map(r => parseInt(r.Edad)).filter(edad => !isNaN(edad) && edad > 0);
    const edadPromedio = edades.length > 0 ? (edades.reduce((a, b) => a + b, 0) / edades.length).toFixed(1) : 'N/D';
    const edadMin = edades.length > 0 ? Math.min(...edades) : 'N/D';
    const edadMax = edades.length > 0 ? Math.max(...edades) : 'N/D';

    return {
        totalCasos: total,
        totalMujeres: mujeres,
        totalHombres: hombres,
        adultos: adultos,
        pediatrico: pediatrico,
        edadPromedio: edadPromedio,
        edadMinima: edadMin,
        edadMaxima: edadMax,
        
        // Prevalencias
        prevalenciaDiabetes: ((data.filter(r => normalizeString(r.Diabetes) === 'presenta').length / total) * 100).toFixed(1),
        prevalenciaHipertension: ((data.filter(r => normalizeString(r['Presión Arterial']).includes('hipertens')).length / total) * 100).toFixed(1),
        prevalenciaDislipemias: ((data.filter(r => normalizeString(r.Dislipemias) === 'presenta').length / total) * 100).toFixed(1),
        prevalenciaTabaquismo: ((data.filter(r => normalizeString(r.Tabaco) === 'fuma').length / total) * 100).toFixed(1),
        prevalenciaObesidad: ((data.filter(r => normalizeString(r.IMC).includes('obesidad')).length / total) * 100).toFixed(1),
        prevalenciaSobrepeso: ((data.filter(r => normalizeString(r.IMC).includes('sobrepeso')).length / total) * 100).toFixed(1),
        
        // Enfermedades crónicas
        enfermedadesCronicas: data.filter(r => 
            normalizeString(r.Diabetes) === 'presenta' ||
            normalizeString(r['Presión Arterial']).includes('hipertens') ||
            normalizeString(r.Dislipemias) === 'presenta'
        ).length,
        
        // Datos adicionales para IA
        distribucionSexo: {
            mujeres: mujeres,
            hombres: hombres,
            porcentajeMujeres: ((mujeres / total) * 100).toFixed(1),
            porcentajeHombres: ((hombres / total) * 100).toFixed(1)
        },
        
        distribucionEdad: {
            adultos: adultos,
            pediatrico: pediatrico,
            porcentajeAdultos: ((adultos / total) * 100).toFixed(1),
            porcentajePediatrico: ((pediatrico / total) * 100).toFixed(1)
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
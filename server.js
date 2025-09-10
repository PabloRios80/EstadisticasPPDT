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

app.post('/generar-informe', async (req, res) => {
    try {
        const { data, userPrompt } = req.body;
        
        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'No se recibieron datos para generar el informe.' });
        }
        
        // Calcular estadísticas básicas
        const totalCasos = data.length;
        const diabetes = data.filter(row => normalizeString(row.Diabetes) === 'presenta').length;
        const hipertension = data.filter(row => normalizeString(row['Presión Arterial']).includes('hipertens')).length;
        const dislipemias = data.filter(row => normalizeString(row.Dislipemias) === 'presenta').length;
        const tabaquismo = data.filter(row => normalizeString(row.Tabaco) === 'fuma').length;
        const obesidad = data.filter(row => normalizeString(row.IMC).includes('obesidad')).length;
        const sobrepeso = data.filter(row => normalizeString(row.IMC).includes('sobrepeso')).length;

        // Crear el prompt con formato IAPOS específico
        const promptCompleto = `
${contextoDelPrograma}

DATOS ESTADÍSTICOS ACTUALES (${totalCasos} personas):
- Diabetes: ${diabetes} casos (${((diabetes/totalCasos)*100).toFixed(1)}%)
- Hipertensión: ${hipertension} casos (${((hipertension/totalCasos)*100).toFixed(1)}%)
- Dislipemias: ${dislipemias} casos (${((dislipemias/totalCasos)*100).toFixed(1)}%)
- Tabaquismo: ${tabaquismo} casos (${((tabaquismo/totalCasos)*100).toFixed(1)}%)
- Obesidad: ${obesidad} casos (${((obesidad/totalCasos)*100).toFixed(1)}%)
- Sobrepeso: ${sobrepeso} casos (${((sobrepeso/totalCasos)*100).toFixed(1)}%)

SOLICITUD: "${userPrompt || 'Generar informe estadístico completo'}"

INSTRUCCIONES ESPECÍFICAS DE FORMATO IAPOS:

1. ENCABEZADO:
   - Logo IAPOS arriba a la izquierda (usar emoji 🏥 o ⚕️ para representar)
   - Fecha actual arriba a la derecha (formato: DD/MM/AAAA)
   - Título principal: "IAPOS" en color azul (#0066CC) y negrita
   - Subtítulo: "Informe de Evaluación y Seguimiento del Día Preventivo" en azul más claro (#0088CC)

2. ESTRUCTURA POR CAPÍTULOS DE SALUD:
   - CAPÍTULO 1: Salud Cardiovascular (Diabetes, Hipertensión, Dislipemias)
   - CAPÍTULO 2: Hábitos y Estilo de Vida (Tabaquismo, Alimentación)
   - CAPÍTULO 3: Estado Nutricional (Obesidad, Sobrepeso, IMC)
   - CAPÍTULO 4: Factores de Riesgo Integrados
   - CAPÍTULO 5: Conclusiones y Recomendaciones

3. ESTILO Y TONO:
   - Técnico pero amable y comunicativo
   - Usar colores de la gama azul (#0066CC, #0088CC, #00AAFF) y rojo (#CC0000, #FF3333) para destacados
   - Lenguaje profesional pero accesible para el equipo de salud
   - Incluir emojis médicos relevantes (🫀❤️⚕️🏥💊)
   - Destacar porcentajes y datos importantes en negrita

4. CONTENIDO OBLIGATORIO:
   - Introducción con contexto del Programa Día Preventivo
   - Análisis por capítulos como el dashboard
   - Gráficos descriptivos con texto (usar █ para barras)
   - Conclusiones basadas en evidencia
   - Recomendaciones específicas y accionables

5. FORMATEO:
   - Usar encabezados con ## para títulos
   - Usar tablas para datos comparativos
   - Emplear viñetas con • para listas
   - Separar secciones con líneas divisorias (---)

Genera el informe completo en español con este formato específico.
`;

        console.log('🌐 Enviando solicitud a Gemini con formato IAPOS...');
        
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: promptCompleto
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 3096, // Más tokens para formato detallado
                        topP: 0.8,
                        topK: 40
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000 // 60 segundos para informe detallado
                }
            );

            console.log('✅ Respuesta recibida de Gemini');
            
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                const informe = response.data.candidates[0].content.parts[0].text;
                console.log('📝 Informe IAPOS generado exitosamente');
                
                // Opcional: agregar CSS inline básico para colores
                const informeConEstilo = informe
                    .replace(/IAPOS/g, '<span style="color: #0066CC; font-weight: bold;">IAPOS</span>')
                    .replace(/Día Preventivo/g, '<span style="color: #0088CC;">Día Preventivo</span>')
                    .replace(/(\d+\.\d+%|\d+%)/g, '<span style="color: #CC0000; font-weight: bold;">$1</span>');
                
                return res.json({ 
                    informe: informeConEstilo,
                    modelo: 'gemini-1.5-flash',
                    formato: 'estilo-IAPOS'
                });
            }

        } catch (error) {
            console.error('❌ Error con Gemini:', error.message);
            
            // Informe automático con estilo IAPOS
            const fechaActual = new Date().toLocaleDateString('es-AR');
            const informeAutomatico = `
🏥 **IAPOS** <div style="text-align: right; float: right;">${fechaActual}</div>
<div style="clear: both;"></div>

## <span style="color: #0066CC;">Informe de Evaluación y Seguimiento del Día Preventivo</span>

---

### 📊 **CAPÍTULO 1: RESUMEN EJECUTIVO**
**Total de personas atendidas:** ${totalCasos}

### ❤️ **CAPÍTULO 2: SALUD CARDIOVASCULAR**
• **Diabetes:** ${diabetes} casos <span style="color: #CC0000;">(${((diabetes/totalCasos)*100).toFixed(1)}%)</span>
• **Hipertensión arterial:** ${hipertension} casos <span style="color: #CC0000;">(${((hipertension/totalCasos)*100).toFixed(1)}%)</span>
• **Dislipemias:** ${dislipemias} casos <span style="color: #CC0000;">(${((dislipemias/totalCasos)*100).toFixed(1)}%)</span>

### 🍎 **CAPÍTULO 3: ESTADO NUTRICIONAL**
• **Obesidad:** ${obesidad} casos <span style="color: #CC0000;">(${((obesidad/totalCasos)*100).toFixed(1)}%)</span>
• **Sobrepeso:** ${sobrepeso} casos <span style="color: #CC0000;">(${((sobrepeso/totalCasos)*100).toFixed(1)}%)</span>

### 🚭 **CAPÍTULO 4: HÁBITOS DE VIDA**
• **Tabaquismo:** ${tabaquismo} casos <span style="color: #CC0000;">(${((tabaquismo/totalCasos)*100).toFixed(1)}%)</span>

### 💡 **CAPÍTULO 5: RECOMENDACIONES**
1. Fortalecer programas de prevención cardiovascular
2. Implementar seguimiento personalizado
3. Desarrollar estrategias nutricionales
4. Promover cesación tabáquica

---

<span style="color: #0088CC;">*Informe generado automáticamente - Programa Día Preventivo IAPOS*</span>
`;

            return res.json({ 
                informe: informeAutomatico,
                aviso: "Informe automático con estilo IAPOS"
            });
        }

    } catch (error) {
        console.error('💥 Error general:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});
async function startServer() {
    await loadTokens();
    await cargarContexto(); // Carga el contexto del programa antes de iniciar
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
        console.log('Si es tu primera vez, visita http://localhost:3000/auth para autenticarte.');
    });
}
startServer();
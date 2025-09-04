require('dotenv').config();
// Importar las librerías necesarias
const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de OAuth 2.0 ---
// Con estas líneas
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback'; 

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// --- Gestión de Tokens (Almacenamiento y Carga) ---
const TOKEN_PATH = path.join(__dirname, 'token.json');

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

// --- Rutas del Servidor ---
app.use(express.static(path.join(__dirname, 'public'), { index: 'estadisticas.html' }));
app.use(express.json());

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
            'Dia', 
            'ID', 
            'Marca temporal',
            'FECHAX',
            'Observaciones - Dislipemias',
            'Observaciones - Diabetes',
            'Observaciones - Presión Arterial',
            'Observaciones - IMC',
            'Observaciones - Agudeza visual',
            'Valor CPO',
            'Observaciones - Control odontológico',
            'Observaciones - Alimentación saludable',
            'Observaciones - Actividad física',
            'Observaciones - Seguridad vial',
            'Observaciones - Caídas en adultos mayores',
            'Observaciones - Ácido fólico',
            'Observaciones - Abuso alcohol',
            'Observaciones - Tabaco',
            'Observaciones - Violencia',
            'Observaciones - Depresión',
            'Observaciones - ITS',
            'Observaciones - Hepatitis B',
            'Observaciones - Hepatitis C',
            'Observaciones - VIH',
            'Observaciones - HPV',
            'Observaciones - PAP',
            'Observaciones - SOMF',
            'Observaciones - Colonoscopía',
            'Observaciones - Mamografía',
            'Observaciones - ERC',
            'Observaciones - EPOC',
            'Observaciones - Aneurisma aorta',
            'Observaciones - Osteoporosis',
            'Observaciones - Riesgo CV',
            'Observaciones - Aspirina',
            'Observaciones - Inmunizaciones',
            'Observaciones - VDRL',
            'Observaciones - PSA',
            'Observaciones - Chagas',
            'Observaciones - Examen Físico',
            'Observaciones - Talla',
            'Observaciones - Salud Ocular',
            'Observaciones - Audición',
            'Observaciones - Salud Cardiovascular',
            'Observaciones - Educación sexual',
            'Observaciones - Salud Mental',
            'Observaciones - Consumo de sustancias',
            'Observaciones - Dislipemia',
            'Observaciones - Síndrome Metabólico',
            'Observaciones - Escoliosis',
            'Observaciones - Cáncer cérvico uterino',
            'Observaciones - Cáncer de piel',
            'Observaciones - Desarrollo escolar',
            'Observaciones - Uso de pantallas',
            'Observaciones - Vacunas',
            'Observaciones - Control Odontológico',
            'link'
    // ... añade todos los campos de 'Observaciones' que desees excluir
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

        // Obtiene todos los valores de la columna, excluyendo el primer elemento (el encabezado)
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
            range: `${sheetName}!A:AZ`, // Lee desde la columna A hasta la AZ
        });

        const [headers, ...rows] = response.data.values;
        const data = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });

        res.json(data);
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
            range: `${sheetName}!A:AZ`,
        });

        const [headers, ...rows] = response.data.values;
        const data = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });

        // --- Lógica de cálculo de indicadores ---
        
        // 1. Día Preventivo (único por DNI)
        const dniMap = new Map();
        data.forEach(row => {
            const dni = row['DNI'];
            const timestamp = row['Marca temporal'];
            if (dni && timestamp) {
                if (!dniMap.has(dni) || dniMap.get(dni)['Marca temporal'] < timestamp) {
                    dniMap.set(dni, row);
                }
            }
        });
        const diasPreventivos = dniMap.size;

        // 2. Sexo (Masculino/Femenino)
        const sexos = {
            masculino: 0,
            femenino: 0
        };
        dniMap.forEach(row => {
            const sexo = (row['Sexo'] || '').toLowerCase();
            if (sexo === 'masculino') sexos.masculino++;
            if (sexo === 'femenino') sexos.femenino++;
        });
        const totalSexo = sexos.masculino + sexos.femenino;
        const porcentajeMasculino = totalSexo ? ((sexos.masculino / totalSexo) * 100).toFixed(2) : 0;
        const porcentajeFemenino = totalSexo ? ((sexos.femenino / totalSexo) * 100).toFixed(2) : 0;

        // 3. Edad
        const edadGrupos = {
            'Menores de 18': 0,
            '18 a 30': 0,
            '30 a 50': 0,
            'Mayores de 50': 0
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

        // 4. Enfermedades Crónicas (Diabetes, Hipertensión, Dislipemias, Obesidad, Fumadores)
        const enfermedades = {
            diabetes: 0,
            hipertension: 0,
            dislipemias: 0,
            obesos: 0,
            fumadores: 0
        };
        dniMap.forEach(row => {
            // Diabetes
            if ((row['Diabetes'] || '').trim().toLowerCase() === 'presenta') enfermedades.diabetes++;
            
            // Hipertensión
            const presion = (row['Presión Arterial'] || '').trim().toLowerCase();
            if (presion === 'hipertension' || presion === 'hipertensión') enfermedades.hipertension++;
            
            // Dislipemias
            if ((row['Dislipemias'] || '').trim().toLowerCase() === 'presenta') enfermedades.dislipemias++;

            // Fumadores
            if ((row['Tabaco'] || '').trim().toLowerCase() === 'fuma') enfermedades.fumadores++;

            // Obesidad
            const imc = (row['IMC'] || '').trim().toLowerCase();
            if (imc.includes('sobrepeso') || imc.includes('obesidad')) enfermedades.obesos++;
        });

        // Construye el objeto de resultados
        const indicadores = {
            diasPreventivos: diasPreventivos,
            sexo: {
                ...sexos,
                porcentajeMasculino,
                porcentajeFemenino
            },
            edad: edadGrupos,
            enfermedades: enfermedades
        };

        res.json(indicadores);

    } catch (error) {
        console.error('Error al obtener los indicadores fijos:', error);
        res.status(500).json({ error: 'Error del servidor al obtener los indicadores.' });
    }
});

async function startServer() {
    await loadTokens();
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
        console.log('Si es tu primera vez, visita http://localhost:3000/auth para autenticarte.');
    });
}
startServer();
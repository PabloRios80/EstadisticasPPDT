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
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
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

// Configuración para servir la página de inicio
app.use(express.static(path.join(__dirname, 'public'), { index: 'estadisticas.html' }));
app.use(express.json());

// Función para normalizar cadenas (eliminar acentos y convertir a minúsculas)
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
            'ID', 'Marca temporal', 'FECHAX',
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
            range: `${sheetName}!A:DM`
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
        const filteredData = tipo ? data.filter(row => normalizeString(row['Dia']) === normalizeString(tipo)) : data;

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
            range: `${sheetName}!A:DM`
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
        const dataParaCalculo = tipo ? data.filter(row => normalizeString(row['Dia']) === normalizeString(tipo)) : data;

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
            if (imc.includes('sobrepeso') || imc.includes('obesidad')) enfermedades.obesos++;
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

async function startServer() {
    await loadTokens();
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
        console.log('Si es tu primera vez, visita http://localhost:3000/auth para autenticarte.');
    });
}
startServer();
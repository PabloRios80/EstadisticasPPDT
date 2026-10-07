// --- ESPÍA DE DIAGNÓSTICO ---
console.log("-----------------------------------------");
console.log("--- INICIANDO SERVIDOR HÍBRIDO (CALIDAD + RENDIMIENTO) ---");
console.log("-----------------------------------------");

require("dotenv").config();
const express = require("express");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

// --- VARIABLES GLOBALES (CACHÉ) ---
let datosEnMemoria = [];
let indicadoresCache = null;
let camposCache = null;
let contextoDelPrograma = "";

// --- LISTA DE COLUMNAS A CONSERVAR (DIETA DE DATOS) ---
const CAMPOS_PERMITIDOS = [
  "Efector",
  "DNI",
  "Sexo",
  "Edad",
  "Poblacion",
  "Apellido",
  "Nombre",
  "Apellido y Nombre",
  "Tipo",
  "Diabetes",
  "Presión Arterial",
  "Dislipemias",
  "IMC",
  "Tabaco",
  "Cáncer mama - Mamografía",
  "Cancer_mama_Eco_mamaria",
  "Cáncer cérvico uterino - HPV",
  "Cáncer cérvico uterino - PAP",
  "SOMF",
  "Cáncer colon - Colonoscopía",
  "Próstata - PSA",
  "VIH",
  "Hepatitis B",
  "Hepatitis C",
  "VDRL",
  "Chagas",
  "Control Odontológico - Adultos",
  "ERC",
  "Agudeza visual",
  "EPOC",
  "Aneurisma aorta",
  "Osteoporosis",
  "Aspirina",
  "Depresión",
  "Actividad física",
  "Seguridad vial",
  "Caídas en adultos mayores",
  "Abuso alcohol",
  "Violencia",
  "Inmunizaciones",
  "Ácido fólico",
  "Síndrome Metabólico",
  "Consumo de sustancias",
  "Marca temporal",
  "Prestador",
  "Resultado",
  "Link PDF",
  "Glucemia",
  "Creatinina",
  "Indice de Filtracion Glomerular",
  "Colesterol Total",
  "Colesterol HDL",
  "Colesterol LDL",
  "Trigliceridos",
  "HIV",
  "Hepatitis B antigeno de superficie",
  "Hepatitis C Ac. Totales",
  "Hepatitis B AC anti core total",
  "HPV OTROS GENOTIPOS DE ALTO RIESGO",
  "HPV GENOTIPO 18",
  "HPV GENOTIPO 16",
  "PSA",
  "Chagas (HAI)",
  "Chagas (ECLIA)",
  "Hemoglobina Glicosilada",
  "Microalbuminuria",
  "Proteinuria",
  "clearence de depuracion Creatinina",
];

// --- MAPEO: columnas Supabase (snake_case) -> headers originales del frontend ---
const MAPEO_HISTORIAL_DP = {
  efector: "Efector",
  dni: "DNI",
  sexo: "Sexo",
  edad: "Edad",
  fechax: "Fecha",
  apellido_y_nombre: "Apellido y Nombre",
  tipo: "Tipo",
  diabetes: "Diabetes",
  presion_arterial: "Presión Arterial",
  dislipemias: "Dislipemias",
  imc: "IMC",
  tabaco: "Tabaco",
  cancer_mama_mamografia: "Cáncer mama - Mamografía",
  cancer_mama_eco_mamaria: "Cancer_mama_Eco_mamaria",
  cancer_cervico_hpv: "Cáncer cérvico uterino - HPV",
  cancer_cervico_pap: "Cáncer cérvico uterino - PAP",
  somf: "SOMF",
  cancer_colon_colonoscopia: "Cáncer colon - Colonoscopía",
  prostata_psa: "Próstata - PSA",
  vih: "VIH",
  hepatitis_b: "Hepatitis B",
  hepatitis_c: "Hepatitis C",
  vdrl: "VDRL",
  chagas: "Chagas",
  control_odontologico_adultos: "Control Odontológico - Adultos",
  erc: "ERC",
  agudeza_visual: "Agudeza visual",
  epoc: "EPOC",
  aneurisma_aorta: "Aneurisma aorta",
  osteoporosis: "Osteoporosis",
  aspirina: "Aspirina",
  depresion: "Depresión",
  actividad_fisica: "Actividad física",
  seguridad_vial: "Seguridad vial",
  caidas_adultos_mayores: "Caídas en adultos mayores",
  abuso_alcohol: "Abuso alcohol",
  violencia: "Violencia",
  inmunizaciones: "Inmunizaciones",
  acido_folico: "Ácido fólico",
  sindrome_metabolico: "Síndrome Metabólico",
  consumo_sustancias: "Consumo de sustancias",
  marca_temporal: "Marca temporal",
  link: "Link PDF",
};

// --- CONFIGURACIÓN GOOGLE ---
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REDIRECT_URI =
  process.env.REDIRECT_URI || "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
);

// --- CONFIGURACIÓN SUPABASE ---
const JWT_SECRET = process.env.JWT_SECRET; // el mismo que usan acceso/tablero/etc
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role, no anon
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

const mountPath = "/opt/render/project/src/data";
const dataPath = fs.existsSync(mountPath) ? mountPath : __dirname;
const TOKEN_PATH = path.join(dataPath, "token.json");

if (process.env.RENDER_DISK_MOUNT_PATH && !fs.existsSync(dataPath))
  fs.mkdirSync(dataPath, { recursive: true });

// --- CARGA DE LOGO ---
let logoBase64 = "";
try {
  const logoData = fs.readFileSync(
    path.join(__dirname, "public", "logo_iapos.png"),
  );
  logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;
} catch (error) {
  console.error("Nota: logo_iapos.png no encontrado (opcional).");
}

// --- MIDDLEWARES ---
app.use(
  express.static(path.join(__dirname, "public"), {
    index: "estadisticas.html",
  }),
);
app.use(express.json({ limit: "50mb" }));

// --- LOGIN (interno sin restricción + prestadores por efector) ---
app.post("/login", async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.json({ success: false, message: "Usuario y contraseña requeridos." });
    }

    // 1) ¿Es cuenta interna (superuser en profesionales)?
    const { data: interno } = await supabase
      .from("profesionales")
      .select("*")
      .eq("usuario", usuario)
      .eq("activo", true)
      .eq("es_superuser", true)
      .maybeSingle();

    if (interno) {
      const ok = await bcrypt.compare(password, interno.password_hash);
      if (!ok) return res.json({ success: false, message: "Usuario o contraseña incorrectos." });

      const token = jwt.sign(
        { tipo: "interno", nombre: interno.nombre, efector_estadisticas: null },
        JWT_SECRET,
        { expiresIn: "8h" },
      );
      return res.json({
        success: true,
        token,
        nombre: interno.nombre,
        tipo: "interno",
        requiereTerminos: false,
      });
    }

    // 2) ¿Es cuenta de prestador institucional con acceso a Estadísticas?
    const { data: prestador } = await supabase
      .from("prestadores_institucionales")
      .select("*")
      .eq("usuario", usuario)
      .eq("activo", true)
      .eq("ve_estadisticas", true)
      .maybeSingle();

    if (prestador) {
      const ok = await bcrypt.compare(password, prestador.password_hash);
      if (!ok) return res.json({ success: false, message: "Usuario o contraseña incorrectos." });

      const token = jwt.sign(
        {
          tipo: "prestador",
          nombre: prestador.nombre_institucion,
          efector_estadisticas: prestador.efector_estadisticas,
        },
        JWT_SECRET,
        { expiresIn: "8h" },
      );
      return res.json({
        success: true,
        token,
        nombre: prestador.nombre_institucion,
        tipo: "prestador",
        requiereTerminos: !prestador.acepto_terminos_estadisticas,
      });
    }

    return res.json({ success: false, message: "Usuario o contraseña incorrectos." });
  } catch (error) {
    console.error("❌ Error en /login:", error.message);
    res.status(500).json({ success: false, message: "Error de conexión." });
  }
});

// --- ACEPTAR DISCLAIMER (solo prestadores) ---
app.post("/aceptar-terminos", verificarToken, async (req, res) => {
  if (req.tipoUsuario !== "prestador") return res.json({ success: true });
  try {
    await supabase
      .from("prestadores_institucionales")
      .update({
        acepto_terminos_estadisticas: true,
        fecha_aceptacion_terminos: new Date().toISOString(),
      })
      .eq("efector_estadisticas", req.efectorFiltro);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error en /aceptar-terminos:", error.message);
    res.status(500).json({ success: false });
  }
});

async function cargarDatosDeSupabase() {
  console.log("📥 [Supabase] Descargando historial_dia_preventivo...");
  const PAGE_SIZE = 1000;
  // Traemos SOLO las columnas que realmente usamos (evita cargar los ~80 campos "obs_*" innecesarios)
  const COLUMNAS_NECESARIAS = Object.keys(MAPEO_HISTORIAL_DP).join(",");
  let from = 0;
  let procesadas = [];
  let sigue = true;

  while (sigue) {
    const { data, error } = await supabase
      .from("historial_dia_preventivo")
      .select(COLUMNAS_NECESARIAS)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("❌ Error Supabase historial_dia_preventivo:", error.message);
      break;
    }
    if (!data || data.length === 0) {
      sigue = false;
      break;
    }

       for (const row of data) {
      const obj = {};
      for (const [col, header] of Object.entries(MAPEO_HISTORIAL_DP)) {
        if (row[col] !== null && row[col] !== undefined) obj[header] = row[col];
      }
      
      normalizarObjetoClinico(obj);
      obj["Poblacion"] = "General";
      procesadas.push(obj);
    }

    if (data.length < PAGE_SIZE) sigue = false;
    from += PAGE_SIZE;
  }

  console.log(`✅ [Supabase] historial_dia_preventivo lista (${procesadas.length} filas).`);
  return procesadas;
}
// --- FUNCIONES AUXILIARES ---
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autorizado. Iniciá sesión." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.tipoUsuario = payload.tipo;
    req.efectorFiltro = payload.efector_estadisticas || null; // null = sin restricción
    next();
  } catch (e) {
    return res.status(401).json({ error: "Sesión inválida o vencida. Iniciá sesión de nuevo." });
  }
}

function filtrarPorEfector(data, efector) {
  if (!efector) return data; // cuenta interna: sin filtro
  const efectorNorm = normalizeString(efector);
  return data.filter((row) => normalizeString(row["Efector"]) === efectorNorm);
}

function normalizeString(str) {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
// --- NORMALIZACIÓN DE TEXTO CLÍNICO (mayúsculas/acentos/género mezclados) ---
const CANONICAL_TEXTO = {
  patologico: "Patológico",
  "no se realiza": "No se realiza",
  "no aplica": "No aplica",
  "no presenta": "No presenta",
  presenta: "Presenta",
  normal: "Normal",
  "control normal": "Normal",
  hipertension: "Hipertensión",
  pendiente: "Pendiente",
  positivo: "Positivo",
  negativo: "Negativo",
  fuma: "Fuma",
  "no fuma": "No fuma",
  indicada: "Indicada",
  indicado: "Indicada",
  "no indicada": "No indicada",
  "no indicado": "No indicada",
  alterada: "Alterada",
  "se verifica": "Se verifica",
  "no se verifica": "No se verifica",
  riesgo: "Riesgo",
  "riesgo alto": "Riesgo alto",
  "riesgo bajo": "Riesgo bajo",
  "riesgo medio": "Riesgo Moderado",
  "riesgo moderado": "Riesgo Moderado",
  "obesidad morbida": "Obesidad Mórbida",
  sobrepeso: "Sobrepeso",
  "si realiza": "Sí realiza",
};

function normalizeSexo(valor) {
  if (!valor) return valor;
  const v = valor.toString().trim().toUpperCase();
  if (v === "F" || v.startsWith("FEM")) return "Femenino";
  if (v === "M" || v.startsWith("MASC")) return "Masculino";
  return valor;
}

function normalizeTextoClinico(valor) {
  if (typeof valor !== "string") return valor; // números u otros tipos: no se tocan
  const limpio = valor.trim();
  if (limpio === "" || limpio === "-") return ""; // "-" = sin dato
  return CANONICAL_TEXTO[limpio.toLowerCase()] || limpio;
}

// En estos campos: Normal = No se verifica, Patológico = Se verifica,
// No aplica = No se realiza (confirmado por Pablo)
const CAMPOS_EQUIVALENCIA_VERIFICA = [
  "EPOC", "ERC", "Osteoporosis", "Aspirina", "Aneurisma aorta", "Depresión",
];

function aplicarEquivalenciaVerifica(header, valor) {
  if (!CAMPOS_EQUIVALENCIA_VERIFICA.includes(header)) return valor;
  if (valor === "Normal") return "No se verifica";
  if (valor === "Patológico") return "Se verifica";
  if (valor === "No aplica") return "No se realiza";
  return valor;
}

// Equivalencias específicas por campo (confirmadas por Pablo)
const EQUIVALENCIAS_POR_CAMPO = {
  "Cáncer cérvico uterino - HPV": { Negativo: "Normal", Positivo: "Patológico" },
  "Cáncer cérvico uterino - PAP": { "No se verifica": "Normal" },
  "Próstata - PSA": { Negativo: "Normal", Positivo: "Patológico" },
  "Abuso alcohol": { Abusa: "Abuso" },
  "Seguridad vial": { "No se realiza": "No realiza" },
};

function aplicarEquivalenciasPorCampo(header, valor) {
  const mapa = EQUIVALENCIAS_POR_CAMPO[header];
  return mapa && mapa[valor] ? mapa[valor] : valor;
}

const CAMPOS_NO_NORMALIZAR = [
  "DNI", "Edad", "Fecha", "Apellido y Nombre", "Apellido", "Nombre",
  "Efector", "Tipo", "Marca temporal", "Link PDF", "Sexo", "Poblacion",
];

function normalizarObjetoClinico(obj) {
  for (const key of Object.keys(obj)) {
    if (CAMPOS_NO_NORMALIZAR.includes(key)) continue;
        obj[key] = aplicarEquivalenciasPorCampo(
      key,
      aplicarEquivalenciaVerifica(key, normalizeTextoClinico(obj[key])),
    );
  }
  if (obj["Sexo"]) obj["Sexo"] = normalizeSexo(obj["Sexo"]);
  return obj;
}

async function cargarTodosLosDatos() {
  try {
    const [datosSupabase, datosSheets] = await Promise.all([
      cargarDatosDeSupabase(),
      cargarDatosDeGoogle(), // ahora solo trae Seguridad + Laboratorio
    ]);
    datosEnMemoria = [...datosSupabase, ...datosSheets];
    console.log(`✅ Total combinado: ${datosEnMemoria.length} filas.`);
    preCalcularTodo();
    return true;
  } catch (e) {
    console.error("❌ Error fatal cargando datos combinados:", e);
    return false;
  }
}
async function cargarContexto() {
  try {
    contextoDelPrograma = fs.readFileSync(
      path.join(__dirname, "contexto_informes.txt"),
      "utf-8",
    );
  } catch (e) {
    contextoDelPrograma = "No se pudo cargar contexto.";
  }
}

async function loadTokens() {
  if (process.env.GOOGLE_TOKEN) {
    try {
      oauth2Client.setCredentials(JSON.parse(process.env.GOOGLE_TOKEN));
      return true;
    } catch (e) {
      console.error("❌ Error token entorno", e);
      return false;
    }
  }
  try {
    oauth2Client.setCredentials(
      JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")),
    );
    return true;
  } catch (e) {
    console.log("⚠️ Sin token local.");
    return false;
  }
}

async function getAuthenticatedClient() {
  const loaded = await loadTokens();
  if (!loaded) throw new Error("Falta autenticación.");
  return oauth2Client;
}
async function cargarDatosDeGoogle() {
  console.log("📥 [1/3] Conectando a Google Sheets...");
  try {
    const authClient = await getAuthenticatedClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    // RANGOS EXACTOS PARA NO DESCARGAR COLUMNAS VACÍAS
    // "Integrado" ya NO se lee de acá, viene de Supabase (historial_dia_preventivo)
    const sources = [
      { sheetName: "Seguridad!A:CD", label: "Seguridad" },
  
    ];

    let datosDeSheets = [];

    // DESCARGA SECUENCIAL PARA NO SATURAR LA MEMORIA
    for (const source of sources) {
      console.log(`⏳ Descargando: ${source.label}...`);
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: source.sheetName,
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING",
        });

        const values = response.data.values;
        if (values && values.length > 0) {
          const headers = values[0];
                    const processedRows = values.slice(1).map((row) => {
            const obj = {};
            headers.forEach((h, i) => {
              if (h && CAMPOS_PERMITIDOS.includes(h)) {
                obj[h] = row[i];
              }
            });
            if (
              !obj["Apellido y Nombre"] &&
              (obj["Apellido"] || obj["Nombre"])
            ) {
              obj["Apellido y Nombre"] =
                `${obj["Apellido"] || ""} ${obj["Nombre"] || ""}`.trim();
            }
            normalizarObjetoClinico(obj);
            obj["Poblacion"] = source.label;
            return obj;
          });

          datosDeSheets.push(...processedRows);
          console.log(
            `✅ ${source.label} lista (${processedRows.length} filas).`,
          );
        }

        // Liberamos memoria forzosamente antes de pasar a la siguiente hoja
        response.data = null;
      } catch (e) {
        console.error(`❌ Error en ${source.sheetName}:`, e.message);
      }
    }
    console.log(
      `✅ [2/3] Datos de Sheets filtrados: ${datosDeSheets.length} filas.`,
    );
    return datosDeSheets;
  } catch (e) {
    console.error("❌ Error fatal cargando datos de Sheets:", e);
    return [];
  }
}

function preCalcularTodo() {
  if (!datosEnMemoria || datosEnMemoria.length === 0) return;

  const primerRegistro = datosEnMemoria[0];
  camposCache = Object.keys(primerRegistro).filter(
    (c) => c !== "Poblacion" && c !== "Apellido y Nombre",
  );

  indicadoresCache = calcularIndicadoresInterno(datosEnMemoria);
  console.log("🚀 [3/3] Cachés generadas. Sistema listo.");
}

// --- LÓGICA RÁPIDA PARA EL DASHBOARD ---
function calcularIndicadoresInterno(data) {
  const dniMap = new Map();
  data.forEach((row) => {
    if (row["DNI"]) dniMap.set(row["DNI"], row);
  });

  const sexos = { masculino: 0, femenino: 0 };
  const edadGrupos = {
    "Menores de 18": 0,
    "18 a 30": 0,
    "30 a 50": 0,
    "Mayores de 50": 0,
  };
  const enfermedades = {
    diabetes: 0,
    hipertension: 0,
    dislipemias: 0,
    obesos: 0,
    fumadores: 0,
  };
  let altoRiesgoCount = 0;

  dniMap.forEach((row) => {
    const s = normalizeString(row["Sexo"]);
    if (s.includes("masc") || s === "m") sexos.masculino++;
    else if (s.includes("fem") || s === "f") sexos.femenino++;

    const e = parseInt(row["Edad"], 10);
    if (!isNaN(e)) {
      if (e < 18) edadGrupos["Menores de 18"]++;
      else if (e <= 30) edadGrupos["18 a 30"]++;
      else if (e <= 50) edadGrupos["30 a 50"]++;
      else edadGrupos["Mayores de 50"]++;
    }

    if (normalizeString(row["Diabetes"]) === "presenta")
      enfermedades.diabetes++;
    if (normalizeString(row["Presión Arterial"]).includes("hipertens"))
      enfermedades.hipertension++;
    if (normalizeString(row["Dislipemias"]) === "presenta")
      enfermedades.dislipemias++;
    if (normalizeString(row["Tabaco"]) === "fuma") enfermedades.fumadores++;
    if (normalizeString(row["IMC"]).includes("obesidad")) enfermedades.obesos++;

    if (
      e > 50 &&
      (normalizeString(row["Diabetes"]) === "presenta" ||
        normalizeString(row["Presión Arterial"]).includes("hipertens") ||
        normalizeString(row["IMC"]).includes("obesidad") ||
        normalizeString(row["IMC"]).includes("sobrepeso") ||
        normalizeString(row["Tabaco"]) === "fuma")
    )
      altoRiesgoCount++;
  });

  const totalSexo = sexos.masculino + sexos.femenino;
  return {
    diasPreventivos: dniMap.size,
    sexo: {
      ...sexos,
      porcentajeMasculino: totalSexo
        ? ((sexos.masculino / totalSexo) * 100).toFixed(2)
        : 0,
      porcentajeFemenino: totalSexo
        ? ((sexos.femenino / totalSexo) * 100).toFixed(2)
        : 0,
    },
    edad: edadGrupos,
    enfermedades: enfermedades,
    altoRiesgo: altoRiesgoCount,
  };
}

// --- RUTAS API ---
app.get("/obtener-campos", verificarToken, async (req, res) => {
  if (!datosEnMemoria || datosEnMemoria.length === 0) {
    await cargarTodosLosDatos();
  }
  if (camposCache) return res.json(camposCache);
  if (datosEnMemoria.length > 0) {
    return res.json(
      Object.keys(datosEnMemoria[0]).filter((c) => c !== "Poblacion"),
    );
  }
  res.status(503).json({ error: "No se pudieron cargar los datos." });
});

app.get("/obtener-datos-completos", verificarToken, async (req, res) => {
  if (!datosEnMemoria || datosEnMemoria.length === 0) {
    await cargarTodosLosDatos();
  }

  const tipo = req.query.tipo;
  let data = tipo
    ? datosEnMemoria.filter(
        (r) => normalizeString(r["Tipo"]) === normalizeString(tipo),
      )
    : datosEnMemoria;

  data = filtrarPorEfector(data, req.efectorFiltro);

  // NUEVO SISTEMA DE ENVÍO POR "GOTEO" (STREAMING)
  // En lugar de enviar un bloque gigante que ahoga la RAM, lo enviamos fila por fila.
  res.setHeader("Content-Type", "application/json");
  res.write("[");

  for (let i = 0; i < data.length; i++) {
    res.write(JSON.stringify(data[i]));
    if (i < data.length - 1) {
      res.write(",");
    }
  }

  res.write("]");
  res.end(); // Terminamos de enviar
});

app.get("/obtener-indicadores-fijos", verificarToken, (req, res) => {
  // Cache global solo sirve para cuentas sin restricción y sin filtro de tipo
  if (!req.query.tipo && !req.efectorFiltro && indicadoresCache) {
    return res.json(indicadoresCache);
  }
  if (datosEnMemoria) {
    let data = req.query.tipo
      ? datosEnMemoria.filter(
          (r) => normalizeString(r["Tipo"]) === normalizeString(req.query.tipo),
        )
      : datosEnMemoria;
    data = filtrarPorEfector(data, req.efectorFiltro);
    return res.json(calcularIndicadoresInterno(data));
  }
  res.status(503).json({ error: "Cargando..." });
});

app.get("/obtener-datos-laboratorio", verificarToken, async (req, res) => {
  if (req.tipoUsuario === "prestador") {
    return res.status(403).json({ error: "No autorizado para este módulo." });
  }
  try {
    const authClient = await getAuthenticatedClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Laboratorio_Master!A:AD",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const values = response.data.values;
    if (!values || values.length === 0) {
      res.setHeader("Content-Type", "application/json");
      return res.end("[]");
    }

    const headers = values[0];
    res.setHeader("Content-Type", "application/json");
    res.write("[");
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const obj = {};
      headers.forEach((h, idx) => {
        if (h && CAMPOS_PERMITIDOS.includes(h)) obj[h] = row[idx];
      });
      res.write(JSON.stringify(obj));
      if (i < values.length - 1) res.write(",");
    }
    res.write("]");
    res.end();
  } catch (e) {
    console.error("❌ Error /obtener-datos-laboratorio:", e.message);
    res.status(500).json({ error: "Error cargando datos de laboratorio." });
  }
});
// ============================================================================
// LOGICA DE IA DETALLADA
// ============================================================================
app.post("/generar-informe", async (req, res) => {
  try {
    const { data, userPrompt } = req.body;
    if (!data || data.length === 0) {
      return res
        .status(400)
        .json({ error: "No se recibieron datos para generar el informe." });
    }

    const stats = calcularEstadisticasCompletasIA(data);
    const tipoInforme = determinarTipoInforme(userPrompt);

    console.log(`🌐 Generando informe con IA (Modelo Prompt Completo)...`);

    try {
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const promptText = generarPromptEspecifico(
        tipoInforme,
        stats,
        userPrompt,
        contextoDelPrograma,
      );
      const requestBody = { contents: [{ parts: [{ text: promptText }] }] };

      const response = await axios.post(url, requestBody, {
        headers: { "Content-Type": "application/json" },
      });

      const contenidoIA =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (contenidoIA) {
        const informeFormateado = formatearInformeIAPOS(
          contenidoIA,
          stats,
          tipoInforme,
          userPrompt,
        );
        return res.json({ informe: informeFormateado });
      } else {
        throw new Error("La respuesta de la IA vino vacía.");
      }
    } catch (error) {
      console.error(
        "❌ Error con IA:",
        error.response ? error.response.data.error : error.message,
      );
      const informeAutomatico = generarInformeAutomatico(stats, userPrompt);
      return res.json({ informe: informeAutomatico });
    }
  } catch (error) {
    console.error("💥 Error general en /generar-informe:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// --- FUNCIONES DE APOYO PARA LA IA ---
function determinarTipoInforme(userPrompt) {
  const prompt = userPrompt ? userPrompt.toLowerCase() : "";
  if (prompt.includes("cáncer") || prompt.includes("cancer")) return "cancer";
  if (prompt.includes("cardio") || prompt.includes("corazón"))
    return "cardiovascular";
  return "completo";
}

function generarPromptEspecifico(tipoInforme, stats, userPrompt, contexto) {
  const resumenEdad = `Edad promedio: ${stats.edadPromedio || "N/D"}, Rango de edad: ${stats.edadMinima || "N/D"} - ${stats.edadMaxima || "N/D"}.`;
  const textoAnalisisCancer = `Para Cáncer Cervicouterino, el programa identificó a **${stats.deteccionCancerCervico_PAP}** casos de **detección temprana** (a través de PAP) y **${stats.riesgoCancerCervico_HPV}** personas con **alto riesgo** (por HPV+), quienes requieren seguimiento prioritario. En cuanto al Cáncer de Colon, se lograron **${stats.deteccionCancerColon_Colono}** **detecciones tempranas** mediante colonoscopía y se identificaron **${stats.riesgoCancerColon_SOMF}** personas con **alto riesgo** (por SOMF+). Para Cáncer de Mama, se registraron **${stats.totalCancerMama}** detecciones, y en hombres, se encontraron **${stats.totalCancerProstata}** casos con PSA alterado.`;

  let instruccionesParaIA;
  if (userPrompt && userPrompt.trim() !== "") {
    instruccionesParaIA = `
        **TAREA PRINCIPAL:** Eres un analista de datos de salud. Tu única misión es responder de manera detallada y analítica a la siguiente solicitud específica del usuario: "${userPrompt}"
        **REGLAS:** Enfócate exclusivamente en responder la pregunta usando los datos proporcionados.`;
  } else {
    instruccionesParaIA = `
        **TAREA PRINCIPAL:** Actúa como un analista experto en salud pública para la provincia de Santa Fe, Argentina. Redacta un informe ejecutivo sobre los resultados del programa "Día Preventivo IAPOS".
        **ESTRUCTURA DEL INFORME:**
        1. **Introducción:** Misión del programa (usar CONTEXTO).
        2. **Resumen Ejecutivo:** 3 hallazgos impactantes.
        3. **Análisis Detallado:**
            - "Análisis Global de la Población"
            - "❤️ Riesgo Cardiovascular y Enfermedades Crónicas": Compara con estadísticas provinciales/nacionales.
            - "🎗️ Prevención de Cáncer": **INSERTA ESTE TEXTO LITERAL:** ${textoAnalisisCancer}
            - "🦠 Prevalencia de Enfermedades Infecciosas"
            - "⚕️ Otros Indicadores"
        4. **Conclusiones:** Impacto del programa.
        5. **Fuentes:** Cita fuentes externas reales (Ministerio de Salud, OMS) usadas para comparar.
        **ESTILO:** Profesional, sin encabezados de carta. Basa todo en los DATOS.`;
  }

  return `
    ${instruccionesParaIA}
    --------------------------------
    CONTEXTO Y DATOS
    --------------------------------
    **Contexto:** ${contexto}
    **Estadísticas del Grupo:**
    - Total: ${stats.totalCasos} (${stats.totalMujeres} mujeres, ${stats.totalHombres} hombres).
    - Edad: ${stats.adultos} adultos, ${stats.pediatrico} pediátricos. ${resumenEdad}
    - Riesgo CV: Diabetes ${stats.prevalenciaDiabetes}%, HTA ${stats.prevalenciaHipertension}%, Obesidad ${stats.prevalenciaObesidad}%, Tabaco ${stats.prevalenciaTabaquismo}%.
    - Cáncer: Mama ${stats.totalCancerMama}, Próstata ${stats.totalCancerProstata}.
    - Infecciosas: VIH ${stats.totalVIH}, Chagas ${stats.totalChagas}, Sífilis ${stats.totalVDRL}.
    - Otros: Salud Bucal (Riesgo) ${stats.totalSaludBucalRiesgo}, Depresión ${stats.totalDepresion}, EPOC ${stats.totalEPOC}.
    `;
}

function calcularEstadisticasCompletasIA(data) {
  const total = data.length;
  if (total === 0) return { totalCasos: 0 };

  let c = {
    mujeres: 0,
    hombres: 0,
    adultos: 0,
    pediatrico: 0,
    edades: [],
    diabetes: 0,
    hipertension: 0,
    dislipemias: 0,
    tabaquismo: 0,
    obesidad: 0,
    sobrepeso: 0,
    cancerMama: 0,
    cancerProstata: 0,
    cancerCervico: 0,
    cancerColon: 0,
    riesgoHPV: 0,
    deteccionPAP: 0,
    riesgoSOMF: 0,
    deteccionColono: 0,
    vih: 0,
    hepatitisB: 0,
    hepatitisC: 0,
    vdrl: 0,
    chagas: 0,
    saludBucal: 0,
    saludRenal: 0,
    depresion: 0,
    epoc: 0,
    agudezaVisual: 0,
  };

  for (const r of data) {
    const e = parseInt(r.Edad);
    if (!isNaN(e)) {
      c.edades.push(e);
      if (e >= 18) c.adultos++;
      else c.pediatrico++;
    }

    const s = normalizeString(r.Sexo);
    if (s.includes("fem")) c.mujeres++;
    else if (s.includes("masc")) c.hombres++;

    if (normalizeString(r.Diabetes) === "presenta") c.diabetes++;
    if (normalizeString(r["Presión Arterial"]).includes("hipertens"))
      c.hipertension++;
    if (normalizeString(r.Dislipemias) === "presenta") c.dislipemias++;
    if (normalizeString(r.Tabaco) === "fuma") c.tabaquismo++;
    if (normalizeString(r.IMC).includes("obesidad")) c.obesidad++;
    if (normalizeString(r.IMC).includes("sobrepeso")) c.sobrepeso++;

    if (
      normalizeString(r["Cáncer mama - Mamografía"]) === "patologico" ||
      normalizeString(r["Cáncer mama - Eco mamaria"]) === "patologico"
    )
      c.cancerMama++;
    if (normalizeString(r["Próstata - PSA"]) === "patologico")
      c.cancerProstata++;
    if (normalizeString(r["Cáncer cérvico uterino - HPV"]) === "patologico")
      c.riesgoHPV++;
    if (normalizeString(r["Cáncer cérvico uterino - PAP"]) === "patologico")
      c.deteccionPAP++;
    if (normalizeString(r["SOMF"]) === "patologico") c.riesgoSOMF++;
    if (normalizeString(r["Cáncer colon - Colonoscopía"]) === "patologico")
      c.deteccionColono++;

    if (normalizeString(r["VIH"]) === "positivo") c.vih++;
    if (normalizeString(r["Hepatitis B"]) === "positivo") c.hepatitisB++;
    if (normalizeString(r["Hepatitis C"]) === "positivo") c.hepatitisC++;
    if (normalizeString(r["VDRL"]) === "positivo") c.vdrl++;
    if (normalizeString(r["Chagas"]) === "positivo") c.chagas++;

    if (normalizeString(r["Control Odontológico - Adultos"]) === "riesgo alto")
      c.saludBucal++;
    if (normalizeString(r["ERC"]) === "patológico") c.saludRenal++;
    if (normalizeString(r["Depresión"]) === "se verifica") c.depresion++;
    if (normalizeString(r["EPOC"]) === "se verifica") c.epoc++;
  }

  const edadPromedio =
    c.edades.length > 0
      ? (c.edades.reduce((a, b) => a + b, 0) / c.edades.length).toFixed(1)
      : "N/D";
  const edadMin = c.edades.length > 0 ? Math.min(...c.edades) : "N/D";
  const edadMax = c.edades.length > 0 ? Math.max(...c.edades) : "N/D";

  return {
    totalCasos: total,
    totalMujeres: c.mujeres,
    totalHombres: c.hombres,
    adultos: c.adultos,
    pediatrico: c.pediatrico,
    edadPromedio,
    edadMinima: edadMin,
    edadMaxima: edadMax,
    prevalenciaDiabetes: ((c.diabetes / total) * 100).toFixed(1),
    prevalenciaHipertension: ((c.hipertension / total) * 100).toFixed(1),
    prevalenciaDislipemias: ((c.dislipemias / total) * 100).toFixed(1),
    prevalenciaTabaquismo: ((c.tabaquismo / total) * 100).toFixed(1),
    prevalenciaObesidad: ((c.obesidad / total) * 100).toFixed(1),
    prevalenciaSobrepeso: ((c.sobrepeso / total) * 100).toFixed(1),
    totalCancerMama: c.cancerMama,
    totalCancerProstata: c.cancerProstata,
    riesgoCancerCervico_HPV: c.riesgoHPV,
    deteccionCancerCervico_PAP: c.deteccionPAP,
    riesgoCancerColon_SOMF: c.riesgoSOMF,
    deteccionCancerColon_Colono: c.deteccionColono,
    totalVIH: c.vih,
    totalVDRL: c.vdrl,
    totalChagas: c.chagas,
    totalSaludBucalRiesgo: c.saludBucal,
    totalDepresion: c.depresion,
    totalEPOC: c.epoc,
  };
}

function formatearInformeIAPOS(contenidoIA, stats, tipoInforme, userPrompt) {
  const fecha = new Date().toLocaleDateString("es-AR");
  const logoHtml = logoBase64
    ? `<div style="display: inline-block; background-color: #2563EB; border-radius: 50%; padding: 10px; line-height: 0;"><img src="${logoBase64}" alt="Logo IAPOS" style="height: 50px; width: auto;"></div>`
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
                <div style="color: #0066CC; font-size: 12px; margin-top: 5px;">Solicitud: "${userPrompt || "General"}"</div>
            </td>
        </tr>
    </table>
    <div style="line-height: 1.6;">
        ${contenidoIA.replace(/\n/g, "<br>")}
    </div>
    <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #0066CC; color: #666; font-size: 12px;">
        <strong>Programa Día Preventivo IAPOS</strong> | Informe generado automáticamente | ${fecha}
    </div>
</div>
`;
}

function generarInformeAutomatico(stats, userPrompt) {
  return formatearInformeIAPOS(
    `
        <h3>Informe Automático (IA no disponible)</h3>
        <p>Se procesaron ${stats.totalCasos} casos.</p>
        <ul>
            <li>Diabetes: ${stats.prevalenciaDiabetes}%</li>
            <li>Hipertensión: ${stats.prevalenciaHipertension}%</li>
        </ul>
    `,
    stats,
    "error",
    userPrompt,
  );
}

// --- RUTAS AUTH ---
app.get("/auth", (req, res) => {
  res.redirect(
    oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    }),
  );
});
app.get("/oauth2callback", async (req, res) => {
  const { tokens } = await oauth2Client.getToken(req.query.code);
  oauth2Client.setCredentials(tokens);
  if (!process.env.GOOGLE_TOKEN)
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  res.send("Autenticado.");
});

// --- ARRANQUE ---
async function startServer() {
  await loadTokens();
  await cargarContexto();
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
    await cargarTodosLosDatos();
  });
}

startServer();

// --- ARCHIVO: laboratorio.js (Versión Final con Desglose e Interruptor) ---

// Variable global para controlar si el panel está abierto o cerrado
let moduloLaboratorioAbierto = false;

async function iniciarModuloLaboratorio() {
  let contenedorPrincipal = document.getElementById("contenedor-laboratorio");

  // 1. EFECTO INTERRUPTOR: Si ya está abierto, lo ocultamos y terminamos
  if (moduloLaboratorioAbierto && contenedorPrincipal) {
    contenedorPrincipal.style.display = "none";
    moduloLaboratorioAbierto = false;
    return;
  }

  const btn = document.getElementById("btn-laboratorio");
  if (btn) btn.innerText = "⏳ Analizando...";

  console.log("📥 Conectando al servidor para obtener datos médicos...");

  try {
    const token = sessionStorage.getItem("dpToken");
    const respuesta = await fetch("/obtener-datos-laboratorio", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    const datosCrudos = await respuesta.json();

    if (!datosCrudos || datosCrudos.length === 0) {
      alert("El servidor no devolvió datos médicos.");
      if (btn) btn.innerText = "🔬 Laboratorio";
      return;
    }

    // =========================================================
    // --- LÓGICA DE CÁLCULO CON DESGLOSE ---
    // =========================================================
    let totalesHPV = 0;
    let positivosHPV = 0;
    let negativosHPV = 0;

    // Contadores específicos
    let positivos16 = 0;
    let positivos18 = 0;
    let positivosOtros = 0;

    let edadesPositivos = {
      "Menor de 30": 0,
      "30 a 39": 0,
      "40 a 49": 0,
      "50 a 59": 0,
      "60 o más": 0,
    };

    datosCrudos.forEach((row) => {
      const hpvOtros = (row["HPV OTROS GENOTIPOS DE ALTO RIESGO"] || "")
        .toString()
        .trim()
        .toUpperCase();
      const hpv18 = (row["HPV GENOTIPO 18"] || "")
        .toString()
        .trim()
        .toUpperCase();
      const hpv16 = (row["HPV GENOTIPO 16"] || "")
        .toString()
        .trim()
        .toUpperCase();

      // Si hay texto en cualquier columna, es un test realizado
      if (hpvOtros !== "" || hpv18 !== "" || hpv16 !== "") {
        totalesHPV++;

        const esPosOtros = hpvOtros === "DETECTABLE";
        const esPos18 = hpv18 === "DETECTABLE";
        const esPos16 = hpv16 === "DETECTABLE";

        // Si AL MENOS UNO es detectable, el paciente es positivo
        if (esPosOtros || esPos18 || esPos16) {
          positivosHPV++;

          // Sumamos a los subtotales específicos
          if (esPos16) positivos16++;
          if (esPos18) positivos18++;
          if (esPosOtros) positivosOtros++;

          // Calculamos la edad
          let edadStr = row.Edad;
          if (!edadStr && row.DNI) {
            const pacienteConEdad = datosCrudos.find(
              (p) => p.DNI === row.DNI && p.Edad,
            );
            if (pacienteConEdad) edadStr = pacienteConEdad.Edad;
          }

          if (edadStr) {
            const edad = parseInt(edadStr, 10);
            if (!isNaN(edad)) {
              if (edad < 30) edadesPositivos["Menor de 30"]++;
              else if (edad >= 30 && edad <= 39) edadesPositivos["30 a 39"]++;
              else if (edad >= 40 && edad <= 49) edadesPositivos["40 a 49"]++;
              else if (edad >= 50 && edad <= 59) edadesPositivos["50 a 59"]++;
              else edadesPositivos["60 o más"]++;
            }
          }
        } else {
          negativosHPV++;
        }
      }
    });

    // Restauramos el botón
    if (btn) btn.innerText = "🔬 Laboratorio";

    if (totalesHPV === 0) {
      alert("No se detectaron tests de HPV en la base de datos.");
      return;
    }

    // =========================================================
    // --- INYECTAR RESULTADOS EN PANTALLA ---
    // =========================================================

    // Si no existe el contenedor, lo creamos
    if (!contenedorPrincipal) {
      contenedorPrincipal = document.createElement("div");
      contenedorPrincipal.id = "contenedor-laboratorio";
      contenedorPrincipal.style.marginTop = "20px";
      contenedorPrincipal.style.marginBottom = "20px";
      contenedorPrincipal.style.padding = "20px";
      contenedorPrincipal.style.backgroundColor = "#f8f9fa";
      contenedorPrincipal.style.borderRadius = "8px";
      contenedorPrincipal.style.maxWidth = "900px";
      contenedorPrincipal.style.marginLeft = "auto";
      contenedorPrincipal.style.marginRight = "auto";

      // Lo pegamos justo antes del panel de botones de abajo
      const areaDeBotones = document.querySelector(
        ".flex.flex-wrap.justify-center.gap-4.mt-6",
      );
      if (areaDeBotones) {
        areaDeBotones.parentNode.insertBefore(
          contenedorPrincipal,
          areaDeBotones,
        );
      } else {
        document.body.appendChild(contenedorPrincipal);
      }
    }

    const tarjetaHPV = `
            <h2 style="color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; text-align: center;">🔬 Módulo de Laboratorio</h2>
            <div id="lab-tarjetas" style="display: flex; justify-content: center; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 350px;">
                    <h3 style="margin-top: 0; color: #333; text-align: center;">Detección HPV (Alto Riesgo)</h3>
                    <p style="font-size: 28px; font-weight: bold; margin: 10px 0; color: #2563eb; text-align: center;">
                        ${totalesHPV} <span style="font-size: 14px; font-weight: normal; color: #666;">Test procesados</span>
                    </p>
                    
                    <div style="display: flex; justify-content: space-around; margin-top: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <div style="text-align: center;">
                            <span style="display: block; font-size: 22px; font-weight: bold; color: #dc2626;">${positivosHPV}</span>
                            <span style="font-size: 13px; color: #666;">Total Positivos</span>
                        </div>
                        <div style="text-align: center;">
                            <span style="display: block; font-size: 22px; font-weight: bold; color: #16a34a;">${negativosHPV}</span>
                            <span style="font-size: 13px; color: #666;">Negativos</span>
                        </div>
                    </div>

                    <!-- DESGLOSE DE GENOTIPOS -->
                    <div style="margin-top: 15px;">
                        <h4 style="font-size: 13px; color: #0066cc; margin-bottom: 10px;">Desglose de Genotipos Detectados:</h4>
                        <ul style="font-size: 13px; color: #333; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li>Genotipo 16: <strong style="color: #dc2626;">${positivos16}</strong></li>
                            <li>Genotipo 18: <strong style="color: #dc2626;">${positivos18}</strong></li>
                            <li>Otros Alto Riesgo: <strong style="color: #dc2626;">${positivosOtros}</strong></li>
                        </ul>
                    </div>

                    <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                        <h4 style="font-size: 13px; color: #666; margin-bottom: 10px;">Edades de Casos Positivos:</h4>
                        <ul style="font-size: 13px; color: #333; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li>Menor de 30: <strong>${edadesPositivos["Menor de 30"]}</strong></li>
                            <li>30 a 39: <strong>${edadesPositivos["30 a 39"]}</strong></li>
                            <li>40 a 49: <strong>${edadesPositivos["40 a 49"]}</strong></li>
                            <li>50 a 59: <strong>${edadesPositivos["50 a 59"]}</strong></li>
                            <li>60 o más: <strong>${edadesPositivos["60 o más"]}</strong></li>
                        </ul>
                    </div>
                </div>

            </div>
        `;

    contenedorPrincipal.innerHTML = tarjetaHPV;
    contenedorPrincipal.style.display = "block";
    moduloLaboratorioAbierto = true; // Marcamos como abierto

    contenedorPrincipal.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error("Error cargando laboratorio:", error);
    alert("Hubo un error de conexión al pedirle los datos al servidor.");
    if (btn) btn.innerText = "🔬 Laboratorio";
  }
}

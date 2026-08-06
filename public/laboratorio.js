// --- ARCHIVO: laboratorio.js ---

function iniciarModuloLaboratorio() {
  // Verificamos que los datos existan
  if (!window.datosGlobales || !window.datosGlobales.Laboratorio) {
    console.warn("Aún no hay datos de laboratorio.");
    return;
  }

  const datosLab = window.datosGlobales.Laboratorio;
  const datosGeneral = window.datosGlobales.General; 

  let totalesHPV = 0;
  let positivosHPV = 0;
  let negativosHPV = 0;
  let edadesPositivos = {
    "Menor de 30": 0, "30 a 39": 0, "40 a 49": 0, "50 a 59": 0, "60 o más": 0
  };

  datosLab.forEach(lab => {
    const hpvOtros = (lab["HPV OTROS GENOTIPOS DE ALTO RIESGO"] || "").trim().toUpperCase();
    const hpv18 = (lab["HPV GENOTIPO 18"] || "").trim().toUpperCase();
    const hpv16 = (lab["HPV GENOTIPO 16"] || "").trim().toUpperCase();

    if (hpvOtros !== "" || hpv18 !== "" || hpv16 !== "") {
      totalesHPV++;
      const esPositivo = hpvOtros === "DETECTABLE" || hpv18 === "DETECTABLE" || hpv16 === "DETECTABLE";

      if (esPositivo) {
        positivosHPV++;
        const pacienteBase = datosGeneral.find(p => p.DNI === lab.DNI);
        
        if (pacienteBase && pacienteBase.Edad) {
          const edad = parseInt(pacienteBase.Edad);
          if (edad < 30) edadesPositivos["Menor de 30"]++;
          else if (edad >= 30 && edad <= 39) edadesPositivos["30 a 39"]++;
          else if (edad >= 40 && edad <= 49) edadesPositivos["40 a 49"]++;
          else if (edad >= 50 && edad <= 59) edadesPositivos["50 a 59"]++;
          else edadesPositivos["60 o más"]++;
        }
      } else {
        negativosHPV++;
      }
    }
  });

  console.log("✅ Laboratorio Procesado");
  console.log(`Test Totales: ${totalesHPV} | Positivos: ${positivosHPV}`);
  console.log("Edades de Positivos:", edadesPositivos);
}
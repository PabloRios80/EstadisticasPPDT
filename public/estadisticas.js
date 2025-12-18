document.addEventListener('DOMContentLoaded', () => {

    // =================================================================================
    // 1. VARIABLES GLOBALES
    // =================================================================================
    
    let allData = [];
    let currentFilteredData = [];
    let fixedIndicators = {};
    const chartInstances = {};
    let currentFilterType = 'Total';

    // Configuración del Menú de Capítulos
    const IAPOS_PREVENTIVE_PROGRAM_MENU = [
        {
            category: "Evaluación de Riesgo Cardiovascular y Enfermedades Crónicas",
            icon: "heart-pulse", 
            color: "red-600",
            subtopics: [
                { name: "Diabetes", column: "Diabetes", value: "Presenta" },
                { name: "Presión Arterial", column: "Presión Arterial", value: "Hipertension", normalized: true },
                { name: "Dislipemias", column: "Dislipemias", value: "Presenta" },
                { 
                    name: "IMC", 
                    subtopics: [
                        { name: "Sobrepeso", column: "IMC", value: "Sobrepeso" },
                        { name: "Obesidad", column: "IMC", value: ["Obesidad", "Obesidad Morbida"] }
                    ]
                },
                { name: "Tabaquismo", column: "Tabaco", value: "Fuma" }
            ]
        },
        {
            category: "Prevención de Cáncer",
            icon: "ribbon",
            color: "purple-600",
            subtopics: [
                { 
                    name: "Cáncer de Mama", 
                    subtopics: [
                        { name: "mamografía", column: "Cáncer mama - Mamografía", value: "Patologico", parentesis: "detectados por mamografía" },
                        { name: "ecografía", column: "Cáncer mama - Eco mamaria", value: "Patologico", parentesis: "detectados por ecografía", fixedCount: 0 }
                    ]
                },
                { 
                    name: "Cáncer cervicouterino", 
                    subtopics: [
                        { name: "HPV", column: "Cáncer cérvico uterino - HPV", value: "Patologico", parentesis: "riesgo elevado por HPV (+) " },
                        { name: "PAP", column: "Cáncer cérvico uterino - PAP", value: "Patologico", parentesis: "detectados por PAP" }
                    ]
                },
                { 
                    name: "Cáncer de Colon", 
                    subtopics: [
                        { name: "SOMF", column: "SOMF", value: "Patologico", parentesis: "riesgo elevado por SOMF (+) " },
                        { name: "Colonoscopia", column: "Cáncer colon - Colonoscopía", value: "Patologico", parentesis: "detectados por Colonoscopia" }
                    ]
                },
                { name: "Cáncer de Próstata", column: "Próstata - PSA", value: "Patologico" }
            ]
        },
        {
            category: "Prevención de Enfermedades Infecciosas",
            icon: "viruses",
            color: "green-600",
            subtopics: [
                { name: "HIV", column: "VIH", value: "Positivo" },
                { name: "Hepatitis B", column: "Hepatitis B", value: "Positivo" },
                { name: "Hepatitis C", column: "Hepatitis C", value: "Positivo" },
                { name: "Sífilis", column: "VDRL", value: "Positivo" },
                { name: "Chagas", column: "Chagas", value: "Positivo" }
            ]
        },
        {
            category: "Otros Temas de Salud",
            icon: "plus",
            color: "teal-600",
            subtopics: [
                { name: "Salud Bucal", column: "Control Odontológico - Adultos", value: "Riesgo Alto" },
                { name: "Salud Renal", column: "ERC", value: "Patológico" },
                { name: "Agudeza Visual", column: "Agudeza visual", value: "Alterada" },
                { name: "EPOC", column: "EPOC", value: "Se verifica" },
                { name: "Aneurisma de Aorta", column: "Aneurisma aorta", value: "Se verifica" },
                { name: "Osteoporosis", column: "Osteoporosis", value: "Se verifica" },
                { name: "Uso de Aspirina", column: "Aspirina", value: "Indicada" },
                { name: "Depresion", column: "Depresión", value: "Se verifica" },
                { name: "Sedentarismo", column: "Actividad física", value: "No realiza" },
                { name: "Seguridad vial", column: "Seguridad vial", value: "No cumple" },
                { name: "Prevencion Caidas en Ancianos", column: "Caídas en adultos mayores", value: "Se verifica" },
                { name: "Alcoholismo", column: "Abuso alcohol", value: "Abusa" },
                { name: "Violencia Familiar", column: "Violencia", value: "Se verifica" },
                { name: "Vacunacion Incompleta", column: "Inmunizaciones", value: "Incompleto" },
                { name: "Acido folico en embarazo", column: "Ácido fólico", value: "Indicado" }
            ]
        }
    ];

    const MODAL_CONTENT = {
        'indicador-casos': { titulo: 'Total de Casos (Días Preventivos)', descripcion: 'Este número representa el total de personas que han participado en el programa. Se calcula contando la cantidad de DNI únicos en el registro. Si una persona participó más de una vez, solo se considera su último registro para evitar duplicados.' },
        'indicador-mujeres': { titulo: 'Total de Mujeres', descripcion: 'Este es el número de mujeres registradas en el programa, calculado a partir de la columna "Sexo".' },
        'indicador-varones': { titulo: 'Total de Varones', descripcion: 'Este es el número de varones registrados en el programa, calculado a partir de la columna "Sexo".' },
        'indicador-enfermedades-cronicas': { titulo: 'Total de Enfermedades Crónicas', descripcion: 'Este número representa el total de casos en el programa que han sido registrados con un diagnóstico de diabetes, hipertensión o dislipemias. Se calcula sumando los registros "Presenta" en las columnas de "Diabetes" y "Dislipemias", y los registros de "Hipertensión" en la columna de "Presión Arterial".' },
        'indicador-alto-riesgo': { titulo: 'Casos de Alto Riesgo', descripcion: 'Este número muestra a las personas que presentan al menos uno de los siguientes factores de riesgo: <br>• Edad mayor a 50 años <br>• Diagnóstico de Diabetes <br>• Diagnóstico de Hipertensión <br>• Diagnóstico de Obesidad o Sobrepeso <br>• Hábito de Fumar' }
    };

    // =================================================================================
    // 2. REFERENCIAS AL DOM (ELEMENTOS HTML)
    // =================================================================================
    
    // Contenedores
    const controlesFiltros = document.getElementById('controles-filtros');
    const capitulosSalud = document.getElementById('capitulos-salud');
    const dashboardGraficos = document.getElementById('dashboard-graficos');
    const informeIaSection = document.getElementById('informe-ia');
    const contenedorInforme = document.getElementById('contenedor-informe');
    const filtrosAplicadosDiv = document.getElementById('filtros-aplicados');
    const menuContainer = document.getElementById('menu-container');
    const selectorCampos = document.getElementById('selector-campos');

    // Modales y Textos
    const infoModal = document.getElementById('info-modal');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalContenido = document.getElementById('modal-contenido');
    const cerrarModalBtn = document.getElementById('cerrar-modal');
    const fechaActualizacionSpan = document.getElementById('fecha-actualizacion');
    const promptUsuario = document.getElementById('prompt-usuario');

    // Botones
    // ... otras variables ...
    const panelCruces = document.getElementById('panel-cruces'); // <--- AÑADIR ESTA LÍNEA
    const cerrarCrucesBtn = document.getElementById('cerrar-cruces'); // <--- Y ESTA
    const limpiarFiltrosPanelBtn = document.getElementById('limpiar-filtros-panel'); 
    const mostrarControlesBtn = document.getElementById('mostrar-controles');
    const mostrarCapitulosBtn = document.getElementById('mostrar-capitulos');
    const filtroTotalBtn = document.getElementById('filtro-total');
    const filtroAdultosBtn = document.getElementById('filtro-adultos');
    const filtroPediatricoBtn = document.getElementById('filtro-pediatrico');
    const filtroSeguridadBtn = document.getElementById('filtro-seguridad'); // NUEVO BOTÓN
    const limpiarFiltrosBtn = document.getElementById('limpiar-filtros');
    const agregarFiltroBtn = document.getElementById('agregar-filtro');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const generarInformeBtn = document.getElementById('generar-informe-btn');
    const exportarInformeIaPdfBtn = document.getElementById('exportar-informe-ia-pdf-btn');
    const exportarVistaPdfBtn = document.getElementById('exportar-vista-pdf-btn');
    const imprimirBtn = document.getElementById('imprimir-btn');
    const iaBtn = document.getElementById('mostrar-ia-btn');
    // --- NUEVA LÓGICA DE EXCEL ---

    const btnExportarCruce = document.getElementById('btn-exportar-cruce-excel');
    if (btnExportarCruce) {
        btnExportarCruce.addEventListener('click', exportarCruceAExcel);
    }

    function exportarCruceAExcel() {
        // 1. Verificar si hay datos filtrados
        if (!currentFilteredData || currentFilteredData.length === 0) {
            Swal.fire('Atención', 'No hay datos filtrados para exportar. Aplica un cruce primero.', 'warning');
            return;
        }

        // 2. Obtener qué filtros se usaron para saber qué columnas agregar
        const filtrosActivos = getFiltersFromUI();
        
        // Si no hay filtros, preguntar si seguro quiere exportar todo
        if (filtrosActivos.length === 0) {
            const confirmar = confirm("No has seleccionado ningún cruce específico. ¿Quieres exportar la lista completa de la población seleccionada?");
            if (!confirmar) return;
        }

        Swal.fire({
            title: 'Generando Excel',
            text: 'Preparando la lista nominal...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // 3. Definir Columnas FIJAS
        // Nota: Asegúrate que estas claves existan en tu objeto de datos (revisa mayúsculas/minúsculas)
        const columnasFijas = ['Efector', 'DNI', 'Apellido', 'Nombre', 'Sexo', 'Edad'];
        
        // 4. Definir Columnas DINÁMICAS (Las que usó en el filtro)
        const columnasDinamicas = filtrosActivos.map(f => f.field);
        
        // Unimos sin repetir (Set) por si filtró por Edad (que ya está en fijas)
        const columnasFinales = [...new Set([...columnasFijas, ...columnasDinamicas])];

        // 5. Mapear los datos para el Excel
        const datosParaExcel = currentFilteredData.map(row => {
            const filaExcel = {};
            columnasFinales.forEach(col => {
                // Intentamos buscar la columna tal cual, o normalizada si hace falta
                // Si la columna es "Apellido" y en el dato es "apellido", esto ayuda:
                let valor = row[col];
                
                // Parche por si Apellido y Nombre vienen juntos en "Apellido y Nombre"
                if ((col === 'Apellido' || col === 'Nombre') && !valor && row['Apellido y Nombre']) {
                    const partes = row['Apellido y Nombre'].split(',');
                    if (col === 'Apellido') valor = partes[0] ? partes[0].trim() : '';
                    if (col === 'Nombre') valor = partes[1] ? partes[1].trim() : '';
                }

                filaExcel[col] = valor || '-'; // Guión si está vacío
            });
            return filaExcel;
        });

        // 6. Crear el título descriptivo
        const descripcionFiltros = filtrosActivos.length > 0 
            ? filtrosActivos.map(f => `${f.field} (${f.operator === 'range' ? f.value.desde + '-' + f.value.hasta : f.value})`).join(', ')
            : 'Población Completa sin Filtros';

        // 7. Generar el archivo con SheetJS
        const worksheet = XLSX.utils.json_to_sheet(datosParaExcel);
        
        // (Opcional) Agregar el título en la celda A1 empujando todo hacia abajo
        XLSX.utils.sheet_add_aoa(worksheet, [[`Reporte de Cruce: ${descripcionFiltros}`]], { origin: "A1" });
        XLSX.utils.sheet_add_json(worksheet, datosParaExcel, { origin: "A2", skipHeader: false });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados Cruce");

        // 8. Descargar
        XLSX.writeFile(workbook, `Reporte_IAPOS_${new Date().getTime()}.xlsx`);
        
        Swal.close();
    }

    // =================================================================================
    // 3. INICIALIZACIÓN Y EVENTOS
    // =================================================================================

    initializeDashboard();

    async function initializeDashboard() {
        updateDate();
        
        // Carga inicial de datos (Simula click en Total al terminar)
        await fetchData('Total');
        
        // --- EVENTOS DE BOTONES DE POBLACIÓN ---

        // 1. Total (Población General)
        if (filtroTotalBtn) {
            filtroTotalBtn.addEventListener('click', () => {
                resetButtonStyles();
                currentFilteredData = allData.filter(r => r.Poblacion === 'General');
                currentFilterType = 'Total General';
                updateDashboardMetrics(currentFilteredData);
                
                filtroTotalBtn.classList.remove('bg-gray-300', 'text-gray-800');
                filtroTotalBtn.classList.add('bg-blue-600', 'text-white');
            });
        }

        // 2. Adultos
        if (filtroAdultosBtn) {
            filtroAdultosBtn.addEventListener('click', () => {
                resetButtonStyles();
                currentFilteredData = allData.filter(r => r.Poblacion === 'General' && r.Edad >= 18);
                currentFilterType = 'Población: Adultos';
                updateDashboardMetrics(currentFilteredData);
                
                filtroAdultosBtn.classList.remove('bg-gray-300', 'text-gray-800');
                filtroAdultosBtn.classList.add('bg-blue-600', 'text-white');
            });
        }

        // 3. Pediátrico
        if (filtroPediatricoBtn) {
            filtroPediatricoBtn.addEventListener('click', () => {
                resetButtonStyles();
                currentFilteredData = allData.filter(r => r.Poblacion === 'General' && r.Edad < 18);
                currentFilterType = 'Población: Pediátrico';
                updateDashboardMetrics(currentFilteredData);
                
                filtroPediatricoBtn.classList.remove('bg-gray-300', 'text-gray-800');
                filtroPediatricoBtn.classList.add('bg-blue-600', 'text-white');
            });
        }
        // 4. SEGURIDAD (POBLACIÓN ESPECIAL)
        if (filtroSeguridadBtn) {
            filtroSeguridadBtn.addEventListener('click', () => {
                resetButtonStyles(); // Pone todos en gris
                
                // Filtramos SOLO los datos de seguridad
                currentFilteredData = allData.filter(r => r.Poblacion === 'Seguridad');
                currentFilterType = 'Población: Seguridad';
                updateDashboardMetrics(currentFilteredData);
                
                // Pintamos el botón de Seguridad de su color (Teal)
                filtroSeguridadBtn.classList.remove('bg-gray-300', 'text-gray-800');
                filtroSeguridadBtn.classList.add('bg-teal-600', 'text-white');
                
                // Feedback visual
                Swal.fire({
                    icon: 'success', // Cambié a success para que sea verde y bonito
                    title: 'Área: Seguridad',
                    text: `Datos cargados: ${currentFilteredData.length} registros.`,
                    timer: 1500,
                    showConfirmButton: false
                });
            });
        }

        // --- EVENTOS DE NAVEGACIÓN ---
            // Dentro de initializeDashboard()...

if (mostrarControlesBtn) {
    mostrarControlesBtn.addEventListener('click', () => {
        // Alternar visibilidad del panel de cruces
        if (panelCruces.classList.contains('hidden')) {
            panelCruces.classList.remove('hidden');
            // Opcional: Ocultar capítulos o IA si quieres enfocar la atención
            capitulosSalud.classList.add('hidden');
            informeIaSection.classList.add('hidden');
            dashboardGraficos.classList.remove('hidden'); // Mostrar gráficos para ver el efecto
        } else {
            panelCruces.classList.add('hidden');
        }
    });
}

// Botón de cerrar dentro del panel (la X)
if (cerrarCrucesBtn) {
    cerrarCrucesBtn.addEventListener('click', () => {
        panelCruces.classList.add('hidden');
    });
}

// Botón de limpiar dentro del panel
if (limpiarFiltrosPanelBtn) {
    limpiarFiltrosPanelBtn.addEventListener('click', clearFilters);
}

        if (mostrarCapitulosBtn) {
            mostrarCapitulosBtn.addEventListener('click', () => {
                mostrarSeccion('capitulos');
                toggleNavStyles(mostrarCapitulosBtn, mostrarControlesBtn);
            });
        }

        if (iaBtn) {
            iaBtn.addEventListener('click', () => {
                mostrarSeccion('ia');
            });
        }

        // --- OTROS EVENTOS ---
        if (limpiarFiltrosBtn) limpiarFiltrosBtn.addEventListener('click', clearFilters);
        if (agregarFiltroBtn) agregarFiltroBtn.addEventListener('click', createFilterUI);
        if (aplicarFiltrosBtn) aplicarFiltrosBtn.addEventListener('click', applyFiltersAndRenderDashboard);
        if (generarInformeBtn) generarInformeBtn.addEventListener('click', generateAIReport);
        if (exportarInformeIaPdfBtn) exportarInformeIaPdfBtn.addEventListener('click', exportReportToPdf);
        if (exportarVistaPdfBtn) exportarVistaPdfBtn.addEventListener('click', exportarVistaAPDF);
        if (imprimirBtn) imprimirBtn.addEventListener('click', () => window.print());
        if (cerrarModalBtn) cerrarModalBtn.addEventListener('click', () => infoModal.classList.add('hidden'));

        // Modales de indicadores
        document.querySelectorAll('.indicador').forEach(indicador => {
            indicador.addEventListener('click', () => {
                const content = MODAL_CONTENT[indicador.id];
                if (content) {
                    modalTitulo.textContent = content.titulo;
                    modalContenido.innerHTML = content.descripcion;
                    infoModal.classList.remove('hidden');
                }
            });
        });
        
        // Simular click en total al inicio para ver datos
        if (filtroTotalBtn) filtroTotalBtn.click();
    }

    // =================================================================================
    // 4. FUNCIONES PRINCIPALES
    // =================================================================================

    async function fetchData(tipoInicial) {
        try {
            // Pedimos TODO al servidor (General + Seguridad)
            const [dataResponse, indicadoresResponse, camposResponse] = await Promise.all([
                fetch('/obtener-datos-completos'), // Esta ruta ya devuelve todo unido
                fetch('/obtener-indicadores-fijos'), // Indicadores base (opcional si calculamos en front)
                fetch('/obtener-campos')
            ]);

            const rawData = await dataResponse.json();
            
            // Procesamos edades una sola vez
            allData = rawData.map(row => {
                row.Edad = parseEdad(row.Edad);
                return row;
            });

            fixedIndicators = await indicadoresResponse.json();
            const campos = await camposResponse.json();

            // Llenar selector de campos
            if (selectorCampos) {
                selectorCampos.innerHTML = '';
                campos.forEach(campo => {
                    const option = document.createElement('option');
                    option.value = campo;
                    option.textContent = campo;
                    selectorCampos.appendChild(option);
                });
            }

            renderFixedIndicators(fixedIndicators);
            
        } catch (error) {
            console.error('Error al cargar datos:', error);
            Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
        }
    }

    function updateDashboardMetrics(filteredData) {
        // Si no hay datos, ponemos todo en cero
        if (!filteredData || filteredData.length === 0) {
            document.getElementById('total-casos').textContent = 0;
            document.getElementById('total-mujeres').textContent = '0 (0.0%)';
            document.getElementById('total-varones').textContent = '0 (0.0%)';
            document.getElementById('total-cronicas').textContent = 0;
            document.getElementById('total-alto-riesgo').textContent = 0;
            
            // Limpiamos gráficos
            Object.values(chartInstances).forEach(chart => chart.destroy());
            menuContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay datos para mostrar en esta selección.</p>';
            return;
        }

        const totalCasos = filteredData.length;
        const totalMujeres = filteredData.filter(d => {
        const sexo = normalizeString(d['Sexo']);
        return sexo === 'femenino' || sexo === 'f';
    }).length;

    const totalVarones = filteredData.filter(d => {
        const sexo = normalizeString(d['Sexo']);
        return sexo === 'masculino' || sexo === 'm';
    }).length;

        const totalEnfCronicas = filteredData.filter(d =>
            normalizeString(d['Diabetes']) === 'presenta' ||
            normalizeString(d['Presión Arterial']).includes('hipertens') ||
            normalizeString(d['Dislipemias']) === 'presenta'
        ).length;

        const totalAltoRiesgo = filteredData.filter(d => {
            const edad = parseInt(d['Edad'], 10);
            return edad > 50 && (
                normalizeString(d['Diabetes']) === 'presenta' ||
                normalizeString(d['Presión Arterial']).includes('hipertens') ||
                normalizeString(d['IMC']).includes('obesidad') ||
                normalizeString(d['IMC']).includes('sobrepeso') ||
                normalizeString(d['Tabaco']) === 'fuma'
            );
        }).length;

        // Actualizar UI
        document.getElementById('total-casos').textContent = totalCasos;
        document.getElementById('total-mujeres').textContent = `${totalMujeres} (${((totalMujeres / totalCasos) * 100).toFixed(1)}%)`;
        document.getElementById('total-varones').textContent = `${totalVarones} (${((totalVarones / totalCasos) * 100).toFixed(1)}%)`;
        document.getElementById('total-cronicas').textContent = totalEnfCronicas;
        document.getElementById('total-alto-riesgo').textContent = totalAltoRiesgo;

        // Renderizar gráficos y menú
        buildDashboard(filteredData);
        buildHealthChaptersMenu(filteredData);
    }

    // =================================================================================
    // 5. FUNCIONES DE AYUDA (Helpers)
    // =================================================================================

    function mostrarSeccion(seccion) {
        // Ocultar todo primero
        controlesFiltros.classList.add('hidden');
        capitulosSalud.classList.add('hidden');
        dashboardGraficos.classList.add('hidden');
        informeIaSection.classList.add('hidden');
        if(limpiarFiltrosBtn) limpiarFiltrosBtn.classList.add('hidden');

        // Mostrar lo deseado
        if (seccion === 'controles') {
            controlesFiltros.classList.remove('hidden');
            dashboardGraficos.classList.remove('hidden');
            if(limpiarFiltrosBtn) limpiarFiltrosBtn.classList.remove('hidden');
        } else if (seccion === 'capitulos') {
            capitulosSalud.classList.remove('hidden');
            if(limpiarFiltrosBtn) limpiarFiltrosBtn.classList.remove('hidden');
        } else if (seccion === 'ia') {
            informeIaSection.classList.remove('hidden');
        }
    }
    function resetButtonStyles() {
        // Ahora incluimos filtroSeguridadBtn en la lista para limpiarlo también
        const buttons = [filtroTotalBtn, filtroAdultosBtn, filtroPediatricoBtn, filtroSeguridadBtn];
        
        buttons.forEach(btn => {
            if (btn) {
                // Quitamos estilos de "activo" (azules o teal)
                btn.classList.remove('bg-blue-600', 'bg-teal-600', 'text-white', 'shadow-inner');
                // Ponemos estilos de "inactivo" (gris)
                btn.classList.add('bg-gray-300', 'text-gray-800');
                
                // Caso especial: El botón de seguridad tiene un color distinto al activarse, 
                // así que nos aseguramos de restaurar su clase base hover si es necesario,
                // pero por simplicidad, lo dejaremos gris como los demás cuando no esté activo.
            }
        });
    }

    function toggleNavStyles(activeBtn, inactiveBtn) {
        if(activeBtn) {
            activeBtn.classList.remove('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            activeBtn.classList.add('bg-blue-600', 'text-white');
        }
        if(inactiveBtn) {
            inactiveBtn.classList.remove('bg-blue-600', 'text-white');
            inactiveBtn.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
        }
    }

    function normalizeString(str) {
        if (!str) return '';
        return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    function parseEdad(edadStr) {
        if (!edadStr) return NaN;
        const str = edadStr.toString().toLowerCase().trim();
        let match = str.match(/(\d+)\s*a/);
        if (match) return parseInt(match[1], 10);
        match = str.match(/(\d+)\s*m/);
        if (match) return Math.round((parseInt(match[1], 10) / 12) * 10) / 10;
        const num = parseInt(str, 10);
        if (!isNaN(num)) return num;
        return NaN;
    }

    function updateDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        if(fechaActualizacionSpan) fechaActualizacionSpan.textContent = today.toLocaleDateString('es-AR', options);
    }

    function renderFixedIndicators(data) {
        // Opcional: Si quieres usar los datos pre-calculados del servidor
    }

    function clearFilters() {
        if(filtrosAplicadosDiv) filtrosAplicadosDiv.innerHTML = '';
        if(filtroTotalBtn) filtroTotalBtn.click();
    }

    // =================================================================================
    // 6. GRÁFICOS Y MENÚS
    // =================================================================================

    function buildDashboard(data) {
        Object.values(chartInstances).forEach(chart => { if(chart) chart.destroy(); });
        createAgeChart(data);
        createCancerChart(data);
        createInfectiousChart(data);
        createSexAndDiseaseChart(data);
    }

    function createAgeChart(data) {
        if (!data || data.length === 0) return;
        const counts = {
            'Menores de 18': data.filter(r => r.Edad < 18).length,
            '18 a 30': data.filter(r => r.Edad >= 18 && r.Edad <= 30).length,
            '30 a 50': data.filter(r => r.Edad > 30 && r.Edad <= 50).length,
            'Mayores de 50': data.filter(r => r.Edad > 50).length,
        };
        const ctx = document.getElementById('edad-chart');
        if (ctx) {
            chartInstances['edad-chart'] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{
                        label: 'Casos por Grupo de Edad',
                        data: Object.values(counts),
                        backgroundColor: ['#42A5F5', '#FF6384', '#FFCE56', '#8e5ea2'],
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }
    }

    function createCancerChart(data) {
        if (!data || data.length === 0) return;
        const cases = {
            'Colon': new Set(data.filter(r => normalizeString(r['SOMF']) === 'patologico' || normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico').map(r => r.DNI)).size,
            'Mama': new Set(data.filter(r => normalizeString(r['Cáncer mama - Mamografía']) === 'patologico').map(r => r.DNI)).size,
            'Cérvico Uterino': new Set(data.filter(r => normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico' || normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico').map(r => r.DNI)).size,
        };
        const ctx = document.getElementById('cancer-chart');
        if (ctx) {
            chartInstances['cancer-chart'] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(cases),
                    datasets: [{
                        label: 'Casos de Cáncer',
                        data: Object.values(cases),
                        backgroundColor: ['#FFCD56', '#FF9F40', '#FF6384'],
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'top' } } }
            });
        }
    }

    function createInfectiousChart(data) {
        if (!data || data.length === 0) return;
        const cases = {
            'VIH': data.filter(r => normalizeString(r['VIH']) === 'positivo').length,
            'Hepatitis B': data.filter(r => normalizeString(r['Hepatitis B']) === 'positivo').length,
            'Hepatitis C': data.filter(r => normalizeString(r['Hepatitis C']) === 'positivo').length,
            'Chagas': data.filter(r => normalizeString(r['Chagas']) === 'positivo').length,
        };
        const ctx = document.getElementById('infecciosas-chart');
        if (ctx) {
            chartInstances['infecciosas-chart'] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(cases),
                    datasets: [{
                        label: 'Casos Infecciosas',
                        data: Object.values(cases),
                        backgroundColor: ['#FF5722', '#F44336', '#E91E63', '#9C27B0'],
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }
    }

    function createSexAndDiseaseChart(data) {
        if (!data || data.length === 0) return;
        const cases = {
            'Diabetes': data.filter(r => normalizeString(r.Diabetes) === 'presenta').length,
            'Hipertensión': data.filter(r => normalizeString(r['Presión Arterial']).includes('hipertens')).length,
            'Dislipemias': data.filter(r => normalizeString(r.Dislipemias) === 'presenta').length,
            'Fumadores': data.filter(r => normalizeString(r.Tabaco) === 'fuma').length,
            'Obesos': data.filter(r => normalizeString(r.IMC).includes('obesidad')).length,
        };
        const ctx = document.getElementById('sexo-enfermedad-chart');
        if (ctx) {
            chartInstances['sexo-enfermedad-chart'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(cases),
                    datasets: [{
                        label: 'Casos',
                        data: Object.values(cases),
                        backgroundColor: ['#42A5F5', '#FF6384', '#FFCE56', '#FF9F40', '#8e5ea2'],
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'top' } } }
            });
        }
    }

    function buildHealthChaptersMenu(dataParaCalcular) {
        if(!menuContainer) return;
        menuContainer.innerHTML = '';
        
        IAPOS_PREVENTIVE_PROGRAM_MENU.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.classList.add('bg-gray-100', 'p-6', 'rounded-lg', 'mb-6', `category-container-shadow-${category.color.split('-')[0]}`);
            
            let subtopicsHtml = '';

            category.subtopics.forEach(subtopic => {
                if (subtopic.subtopics) { 
                    let totalCount = 0;
                    const nestedSubtopicsHtml = subtopic.subtopics.map(nestedSubtopic => {
                        let nestedCount = 0;
                        if (nestedSubtopic.value) {
                            nestedCount = dataParaCalcular.filter(row => normalizeString(row[nestedSubtopic.column]) === normalizeString(nestedSubtopic.value)).length;
                        }
                        totalCount += nestedCount;
                        const parentesisHtml = nestedSubtopic.parentesis ? `<span class="text-xs text-gray-400">(${nestedSubtopic.parentesis})</span>` : '';
                        return `<p class="text-sm text-gray-500 mt-1">${nestedSubtopic.name} ${parentesisHtml}: <span class="font-bold text-gray-800">${nestedCount}</span></p>`;
                    }).join('');
                    
                    subtopicsHtml += `
                        <div class="subtopic bg-white p-4 rounded-lg border border-gray-300">
                            <p class="font-medium text-gray-700">${subtopic.name}</p>
                            ${nestedSubtopicsHtml}
                            <p class="text-sm text-gray-500 mt-1 font-bold">Total: <span class="font-bold text-gray-800">${totalCount}</span></p>
                        </div>
                    `;
                } else { 
                    let count = 0;
                    if (subtopic.normalized) {
                        count = dataParaCalcular.filter(row => normalizeString(row[subtopic.column]).includes(normalizeString(subtopic.value))).length;
                    } else {
                        count = dataParaCalcular.filter(row => normalizeString(row[subtopic.column]) === normalizeString(subtopic.value)).length;
                    }
                    const parentesisHtml = subtopic.parentesis ? `<span class="text-xs text-gray-400">(${subtopic.parentesis})</span>` : '';
                    subtopicsHtml += `
                        <div class="subtopic bg-white p-4 rounded-lg border border-gray-300">
                            <p class="font-medium text-gray-700">${subtopic.name} ${parentesisHtml}</p>
                            <p class="text-sm text-gray-500 mt-1">Casos: <span class="font-bold text-gray-800">${count}</span></p>
                        </div>
                    `;
                }
            });
            
            categoryDiv.innerHTML = `
                <div class="flex items-center space-x-4 mb-4">
                    <i class="fas fa-${category.icon} text-${category.color} text-2xl"></i>
                    <h3 class="text-xl font-semibold text-gray-800">${category.category}</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    ${subtopicsHtml}
                </div>
            `;
            menuContainer.appendChild(categoryDiv);
        });
    }

    // =================================================================================
    // 7. FILTROS AVANZADOS (UI)
    // =================================================================================

    function createFilterUI() {
        if(!selectorCampos) return;
        const camposSeleccionados = Array.from(selectorCampos.selectedOptions).map(option => option.value);
        camposSeleccionados.forEach(campo => {
            if (document.getElementById(`filtro-${campo}`)) return;
            
            const filtroDiv = document.createElement('div');
            filtroDiv.id = `filtro-${campo}`;
            filtroDiv.classList.add('filtro', 'mb-4', 'p-3', 'bg-gray-200', 'rounded-md');
            
            const labelCampo = document.createElement('label');
            labelCampo.textContent = `${campo}:`;
            labelCampo.classList.add('block', 'text-gray-700', 'text-sm', 'font-bold', 'mb-2');
            filtroDiv.appendChild(labelCampo);
            
            if (campo === 'Edad') {
                const divRango = document.createElement('div');
                divRango.classList.add('flex', 'space-x-2', 'mb-2');
                const inputDesde = document.createElement('input');
                inputDesde.type = 'number'; inputDesde.id = `edad-desde`; inputDesde.placeholder = 'Desde';
                inputDesde.classList.add('shadow', 'appearance-none', 'border', 'rounded', 'w-full', 'py-2', 'px-3', 'text-gray-700');
                const inputHasta = document.createElement('input');
                inputHasta.type = 'number'; inputHasta.id = `edad-hasta`; inputHasta.placeholder = 'Hasta';
                inputHasta.classList.add('shadow', 'appearance-none', 'border', 'rounded', 'w-full', 'py-2', 'px-3', 'text-gray-700');
                divRango.appendChild(inputDesde);
                divRango.appendChild(inputHasta);
                filtroDiv.appendChild(divRango);
            } else {
                const uniqueOptions = [...new Set(allData.map(row => row[campo]).filter(val => val && val.trim() !== ''))];
                uniqueOptions.forEach(opcion => {
                    const checkboxDiv = document.createElement('div');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `opcion-${campo}-${opcion.replace(/\s+/g, '-')}`;
                    checkbox.value = opcion;
                    const labelOpcion = document.createElement('label');
                    labelOpcion.textContent = opcion;
                    labelOpcion.setAttribute('for', checkbox.id);
                    labelOpcion.classList.add('ml-2', 'text-gray-700', 'text-sm');
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(labelOpcion);
                    filtroDiv.appendChild(checkboxDiv);
                });
            }
            filtrosAplicadosDiv.appendChild(filtroDiv);
        });
    }
    function applyFiltersAndRenderDashboard() {
        const filters = getFiltersFromUI();
        
        // 1. Calculamos el cruce (Esto ya lo hacía)
        const filteredData = allData.filter(row => {
            return filters.every(filter => {
                if (filter.field === 'Edad') {
                    // Aseguramos que sea número para comparar
                    const edadDato = parseFloat(row.Edad);
                    return !isNaN(edadDato) && edadDato >= filter.value.desde && edadDato <= filter.value.hasta;
                }
                if (filter.operator === 'in') {
                    // Normalizamos un poco para evitar errores de mayúsculas/minúsculas si hace falta
                    // pero mantenemos la lógica estricta del checkbox seleccionado
                    return filter.value.includes(row[filter.field]);
                }
                return false;
            });
        });

        // 2. ¡ESTA ES LA LÍNEA QUE FALTABA! 
        // Actualizamos la variable global para que el botón de Excel sepa qué exportar
        currentFilteredData = filteredData; 

        // 3. Actualizamos la pantalla (Gráficos y Números)
        updateDashboardMetrics(filteredData);

        // 4. Feedback visual para confirmar que se aplicó
        Swal.fire({
            position: 'top-end',
            icon: 'success',
            title: `Cruce aplicado`,
            text: `Se encontraron ${filteredData.length} casos coincidentes`,
            showConfirmButton: false,
            timer: 1500
        });
    }
    
    function getFiltersFromUI() {
        const filters = [];
        const filterDivs = document.querySelectorAll('#filtros-aplicados > .filtro');
        filterDivs.forEach(filterDiv => {
            const field = filterDiv.id.replace('filtro-', '');
            if (field === 'Edad') {
                const desde = parseFloat(document.getElementById('edad-desde').value);
                const hasta = parseFloat(document.getElementById('edad-hasta').value);
                if (!isNaN(desde) && !isNaN(hasta)) {
                    filters.push({ field, operator: 'range', value: { desde, hasta } });
                }
            } else {
                const checkboxes = filterDiv.querySelectorAll('input[type="checkbox"]:checked');
                if (checkboxes.length > 0) {
                    const values = Array.from(checkboxes).map(cb => cb.value);
                    filters.push({ field, operator: 'in', value: values });
                }
            }
        });
        return filters;
    }

    // =================================================================================
    // 8. IA Y EXPORTACIÓN PDF
    // =================================================================================

    async function generateAIReport() {
        if(!generarInformeBtn) return;
        const userPrompt = promptUsuario.value;
        generarInformeBtn.textContent = 'Generando...';
        generarInformeBtn.disabled = true;
        contenedorInforme.innerHTML = `<p class="text-gray-500">Generando informe, por favor espere...</p>`;
        
        try {
            // Usamos los datos actualmente filtrados para el informe
            const response = await fetch('/generar-informe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: currentFilteredData, userPrompt: userPrompt })
            });
            const result = await response.json();
            
            if (result.informe) {
                contenedorInforme.innerHTML = result.informe;
                if(exportarInformeIaPdfBtn) exportarInformeIaPdfBtn.classList.remove('hidden');
                if(imprimirBtn) imprimirBtn.classList.remove('hidden');
            } else {
                contenedorInforme.innerHTML = `<p class="text-red-500">Error: No se pudo generar el informe.</p>`;
            }
            
        } catch (error) {
            console.error('Error al llamar a la API de informe:', error);
            contenedorInforme.innerHTML = `<p class="text-red-500">Error de conexión con el servidor.</p>`;
        } finally {
            generarInformeBtn.textContent = 'Generar Informe';
            generarInformeBtn.disabled = false;
        }
    }

    function exportReportToPdf() {
        const { jsPDF } = window.jspdf;
        const reportContainer = document.getElementById('contenedor-informe');

        if (!reportContainer) return;

        Swal.fire({
            title: 'Exportando a PDF',
            html: 'Por favor, espera...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        html2canvas(reportContainer, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save("informe-ia-iapos.pdf");
            Swal.close();
        });
    }

    function exportarVistaAPDF() {
        const controles = document.getElementById('barra-de-controles');
        const elementoParaConvertir = document.body;

        Swal.fire({
            title: 'Generando PDF',
            html: 'Por favor, espera...',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        const swalContainer = document.querySelector('.swal2-container');

        if (controles) controles.style.visibility = 'hidden';
        if (swalContainer) swalContainer.style.visibility = 'hidden';

        html2canvas(elementoParaConvertir, {
            scale: 2,
            backgroundColor: '#ffffff',
            windowHeight: window.innerHeight,
            windowWidth: window.innerWidth,
            y: window.scrollY
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdfWidth = 210; 
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save('informe-completo-iapos.pdf');

        }).finally(() => {
            if (controles) controles.style.visibility = 'visible';
            if (swalContainer) swalContainer.style.visibility = 'visible';
            Swal.close();
        });
    }

});
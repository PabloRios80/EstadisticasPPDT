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
    // 2. REFERENCIAS AL DOM
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
    const panelCruces = document.getElementById('panel-cruces');

    // Modales y Textos
    const infoModal = document.getElementById('info-modal');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalContenido = document.getElementById('modal-contenido');
    const cerrarModalBtn = document.getElementById('cerrar-modal');
    const fechaActualizacionSpan = document.getElementById('fecha-actualizacion');
    const promptUsuario = document.getElementById('prompt-usuario');

    // Botones
    const mostrarControlesBtn = document.getElementById('mostrar-controles');
    const mostrarCapitulosBtn = document.getElementById('mostrar-capitulos');
    const filtroTotalBtn = document.getElementById('filtro-total');
    const filtroAdultosBtn = document.getElementById('filtro-adultos');
    const filtroPediatricoBtn = document.getElementById('filtro-pediatrico');
    const filtroSeguridadBtn = document.getElementById('filtro-seguridad');
    
    const limpiarFiltrosBtn = document.getElementById('limpiar-filtros');
    const cerrarCrucesBtn = document.getElementById('cerrar-cruces');
    const limpiarFiltrosPanelBtn = document.getElementById('limpiar-filtros-panel');
    const agregarFiltroBtn = document.getElementById('agregar-filtro');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    
    const generarInformeBtn = document.getElementById('generar-informe-btn');
    const exportarInformeIaPdfBtn = document.getElementById('exportar-informe-ia-pdf-btn');
    const exportarVistaPdfBtn = document.getElementById('exportar-vista-pdf-btn');
    const imprimirBtn = document.getElementById('imprimir-btn');
    const iaBtn = document.getElementById('mostrar-ia-btn');
    const btnExportarCruce = document.getElementById('btn-exportar-cruce-excel');
    // LÓGICA DE PESTAÑAS (TABS) PARA GRÁFICOS
    const tabBtns = document.querySelectorAll('.tab-btn');
    const chartPanels = document.querySelectorAll('.chart-panel');

    // =================================================================================
    // 3. INICIALIZACIÓN Y EVENTOS
    // =================================================================================

    initializeDashboard();

    async function initializeDashboard() {
        updateDate();
        await fetchData('Total');
        
        // --- EVENTOS DE BOTONES DE POBLACIÓN ---

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

        if (filtroSeguridadBtn) {
            filtroSeguridadBtn.addEventListener('click', () => {
                resetButtonStyles();
                currentFilteredData = allData.filter(r => r.Poblacion === 'Seguridad');
                currentFilterType = 'Población: Seguridad';
                updateDashboardMetrics(currentFilteredData);
                
                filtroSeguridadBtn.classList.remove('bg-gray-300', 'text-gray-800');
                filtroSeguridadBtn.classList.add('bg-teal-600', 'text-white');
                
                Swal.fire({
                    icon: 'success',
                    title: 'Población: Seguridad',
                    text: `Visualizando ${currentFilteredData.length} registros del área de Seguridad.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            });
        }
        // Solo si existen los botones (para evitar errores si cambias el HTML)
        if (tabBtns.length > 0) {
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // 1. Resetear estilos de todos los botones (gris)
                    tabBtns.forEach(b => {
                        b.classList.remove('bg-blue-600', 'text-white');
                        b.classList.add('bg-gray-200', 'text-gray-600');
                    });

                    // 2. Activar el botón clickeado (azul)
                    btn.classList.remove('bg-gray-200', 'text-gray-600');
                    btn.classList.add('bg-blue-600', 'text-white');

                    // 3. Ocultar TODOS los paneles de gráficos
                    chartPanels.forEach(p => p.classList.add('hidden'));

                    // 4. Mostrar SOLO el panel correspondiente
                    // El ID del botón es "tab-edad" -> buscamos "panel-grafico-edad"
                    const feature = btn.id.replace('tab-', ''); 
                    const targetPanel = document.getElementById(`panel-grafico-${feature}`);
                    
                    if (targetPanel) {
                        targetPanel.classList.remove('hidden');
                    }
                });
            });
        }

        // --- EVENTOS DE NAVEGACIÓN ---
        
        if (mostrarControlesBtn) {
            mostrarControlesBtn.addEventListener('click', () => {
                // El botón ahora alterna el PANEL DE CRUCES
                if (panelCruces.classList.contains('hidden')) {
                    panelCruces.classList.remove('hidden');
                    capitulosSalud.classList.add('hidden');
                    informeIaSection.classList.add('hidden');
                    dashboardGraficos.classList.remove('hidden'); 
                } else {
                    panelCruces.classList.add('hidden');
                }
                toggleNavStyles(mostrarControlesBtn, mostrarCapitulosBtn);
            });
        }

        if (mostrarCapitulosBtn) {
            mostrarCapitulosBtn.addEventListener('click', () => {
                controlesFiltros.classList.remove('hidden'); // Barra botones
                capitulosSalud.classList.remove('hidden'); // Capítulos
                panelCruces.classList.add('hidden'); // Ocultar cruces
                dashboardGraficos.classList.add('hidden'); // Ocultar gráficos
                informeIaSection.classList.add('hidden'); // Ocultar IA
                
                toggleNavStyles(mostrarCapitulosBtn, mostrarControlesBtn);
            });
        }

        if (iaBtn) {
            iaBtn.addEventListener('click', () => {
                capitulosSalud.classList.add('hidden');
                panelCruces.classList.add('hidden');
                dashboardGraficos.classList.add('hidden');
                informeIaSection.classList.remove('hidden');
            });
        }

        // --- OTROS EVENTOS ---
        if (cerrarCrucesBtn) cerrarCrucesBtn.addEventListener('click', () => panelCruces.classList.add('hidden'));
        if (limpiarFiltrosPanelBtn) limpiarFiltrosPanelBtn.addEventListener('click', clearFilters);
        if (agregarFiltroBtn) agregarFiltroBtn.addEventListener('click', createFilterUI);
        if (aplicarFiltrosBtn) aplicarFiltrosBtn.addEventListener('click', applyFiltersAndRenderDashboard);
        if (generarInformeBtn) generarInformeBtn.addEventListener('click', generateAIReport);
        if (exportarInformeIaPdfBtn) exportarInformeIaPdfBtn.addEventListener('click', exportReportToPdf);
        if (exportarVistaPdfBtn) exportarVistaPdfBtn.addEventListener('click', exportarVistaAPDF);
        if (imprimirBtn) imprimirBtn.addEventListener('click', () => window.print());
        if (cerrarModalBtn) cerrarModalBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
        if (btnExportarCruce) btnExportarCruce.addEventListener('click', exportarCruceAExcel);

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
        
        // Simular click en total al inicio
        if (filtroTotalBtn) filtroTotalBtn.click();
    }
    async function fetchData(tipoInicial) {
        try {
            const [dataResponse, indicadoresResponse, camposResponse] = await Promise.all([
                fetch('/obtener-datos-completos'),
                fetch('/obtener-indicadores-fijos'), 
                fetch('/obtener-campos')
            ]);

            const rawData = await dataResponse.json();
            
            // --- BLOQUE MEJORADO: LIMPIEZA Y DIAGNÓSTICO ---
            const uniqueMap = new Map();
            let contadores = { General: 0, Seguridad: 0 };
            
            rawData.forEach(item => {
                let dni = item['DNI'] ? String(item['DNI']).trim() : null;
                const poblacion = item['Poblacion'] || 'General';
                
                // 1. Si no tiene DNI, le inventamos uno para NO PERDER el dato
                if (!dni) {
                    // Verificamos si al menos tiene Apellido o Edad para considerarlo dato válido
                    if (item['Apellido'] || item['Edad']) {
                        dni = `SIN-DNI-${Math.random()}`; 
                    } else {
                        return; // Si no tiene DNI, ni Apellido, ni Edad, es una fila vacía basura.
                    }
                }

                // 2. Clave única por población
                const uniqueKey = `${dni}-${poblacion}`;
                
                if (!uniqueMap.has(uniqueKey)) {
                    uniqueMap.set(uniqueKey, item);
                    if (contadores[poblacion] !== undefined) contadores[poblacion]++;
                } else {
                    // Si entra acá, es un DUPLICADO REAL (Mismo DNI en la misma hoja)
                    // Solo lo mostramos en consola para que tú lo sepas, pero NO lo sumamos.
                    console.warn(`⚠️ DNI Duplicado detectado en ${poblacion}: ${dni} (Se contó solo una vez)`);
                }
            });

            // Convertimos el mapa de vuelta a un array limpio
            const uniqueData = Array.from(uniqueMap.values());
            console.log(`📊 Reporte de Carga:`);
            console.log(`   - Filas Totales leídas: ${rawData.length}`);
            console.log(`   - Pacientes Únicos General: ${contadores.General}`);
            console.log(`   - Pacientes Únicos Seguridad: ${contadores.Seguridad} (Debería coincidir con tu Excel si no hay duplicados)`);

            // ----------------------------------------------------

            allData = uniqueData.map(row => {
                row.Edad = parseEdad(row.Edad);
                return row;
            });

            fixedIndicators = await indicadoresResponse.json();
            const campos = await camposResponse.json();

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
        dashboardData = filteredData; 

        if (!filteredData || filteredData.length === 0) {
            document.getElementById('total-casos').textContent = 0;
            document.getElementById('total-mujeres').textContent = '0 (0.0%)';
            document.getElementById('total-varones').textContent = '0 (0.0%)';
            document.getElementById('total-cronicas').textContent = 0;
            document.getElementById('total-alto-riesgo').textContent = 0;
            Object.values(chartInstances).forEach(chart => chart.destroy());
            if(menuContainer) menuContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay datos para mostrar en esta selección.</p>';
            return;
        }

        const totalCasos = filteredData.length;
        
        // --- CORRECCIÓN: Aceptar F/M y Femenino/Masculino ---
        const totalMujeres = filteredData.filter(d => {
            const s = normalizeString(d['Sexo']);
            return s === 'femenino' || s === 'f';
        }).length;
        
        const totalVarones = filteredData.filter(d => {
            const s = normalizeString(d['Sexo']);
            return s === 'masculino' || s === 'm';
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

        document.getElementById('total-casos').textContent = totalCasos;
        document.getElementById('total-mujeres').textContent = `${totalMujeres} (${((totalMujeres / totalCasos) * 100).toFixed(1)}%)`;
        document.getElementById('total-varones').textContent = `${totalVarones} (${((totalVarones / totalCasos) * 100).toFixed(1)}%)`;
        document.getElementById('total-cronicas').textContent = totalEnfCronicas;
        document.getElementById('total-alto-riesgo').textContent = totalAltoRiesgo;

        buildDashboard(filteredData);
        buildHealthChaptersMenu(filteredData);
    }

    // =================================================================================
    // 5. FUNCIONES DE AYUDA
    // =================================================================================

    function resetButtonStyles() {
        const buttons = [filtroTotalBtn, filtroAdultosBtn, filtroPediatricoBtn, filtroSeguridadBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.classList.remove('bg-blue-600', 'bg-teal-600', 'text-white');
                btn.classList.add('bg-gray-300', 'text-gray-800');
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
        // Opcional
    }

    function clearFilters() {
        if(filtrosAplicadosDiv) filtrosAplicadosDiv.innerHTML = '';
        if(filtroTotalBtn) filtroTotalBtn.click();
    }

    // =================================================================================
    // 6. FILTROS AVANZADOS Y EXPORTACIÓN EXCEL
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
                // ... (El código de edad se mantiene igual) ...
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
                // --- AQUÍ ESTÁ LA CORRECCIÓN DE LIMPIEZA ---
                
                const uniqueOptionsMap = new Map(); // Usamos un Map para guardar versiones únicas

                allData.forEach(row => {
                    const val = row[campo];
                    if (!val) return; // Ignorar nulos

                    const strVal = String(val).trim();
                    
                    // 1. IGNORAR VALORES BASURA (Guiones, puntos solos, vacíos)
                    if (strVal === '' || strVal === '-' || strVal === '--' || strVal === '.') return;

                    // 2. UNIFICAR MAYÚSCULAS/MINÚSCULAS
                    // Usamos la versión minúscula como "clave" para evitar duplicados
                    const lowerKey = strVal.toLowerCase();
                    
                    // Solo guardamos si no hemos visto esta palabra antes
                    if (!uniqueOptionsMap.has(lowerKey)) {
                        // Guardamos la versión original (strVal) o la convertimos a "Tipo Título" si prefieres
                        uniqueOptionsMap.set(lowerKey, strVal);
                    }
                });

                // Convertimos el Map a array y ordenamos alfabéticamente
                const uniqueOptions = Array.from(uniqueOptionsMap.values()).sort();

                uniqueOptions.forEach(opcion => {
                    const checkboxDiv = document.createElement('div');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    // Usamos replace para quitar espacios en el ID y evitar errores
                    checkbox.id = `opcion-${campo}-${opcion.replace(/[^a-zA-Z0-9]/g, '-')}`;
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
function applyFiltersAndRenderDashboard() {
        const filters = getFiltersFromUI();
        
        const filteredData = allData.filter(row => {
            return filters.every(filter => {
                // Lógica para Edad (se mantiene igual)
                if (filter.field === 'Edad') {
                    // Aseguramos que sea número
                    const edadDato = parseFloat(row.Edad);
                    return !isNaN(edadDato) && edadDato >= filter.value.desde && edadDato <= filter.value.hasta;
                }
                
                // Lógica para Texto (Checkboxes)
                if (filter.operator === 'in') {
                    const datoFila = row[filter.field];
                    
                    // Si el dato está vacío en la fila, no coincide
                    if (!datoFila) return false;

                    // --- CORRECCIÓN AQUÍ: COMPARACIÓN FLEXIBLE ---
                    // Convertimos ambos lados a minúsculas y normalizamos para comparar
                    const datoNormalizado = normalizeString(datoFila);
                    
                    // Verificamos si ALGUN valor seleccionado (normalizado) coincide con el dato (normalizado)
                    return filter.value.some(valorSeleccionado => 
                        normalizeString(valorSeleccionado) === datoNormalizado
                    );
                }
                return false;
            });
        });
        
        // Actualizamos variable global y dashboard
        currentFilteredData = filteredData; 
        updateDashboardMetrics(filteredData);
        
        Swal.fire({
            position: 'top-end',
            icon: 'success',
            title: 'Cruce aplicado',
            text: `${filteredData.length} registros encontrados.`,
            showConfirmButton: false,
            timer: 1500
        });
    }

    function exportarCruceAExcel() {
        if (!currentFilteredData || currentFilteredData.length === 0) {
            Swal.fire('Atención', 'No hay datos filtrados para exportar.', 'warning');
            return;
        }

        const filtrosActivos = getFiltersFromUI();
        if (filtrosActivos.length === 0) {
            if(!confirm("No hay filtros seleccionados. ¿Exportar lista completa?")) return;
        }

        Swal.fire({
            title: 'Generando Excel',
            text: 'Preparando lista nominal...',
            didOpen: () => Swal.showLoading()
        });

        // Columnas Fijas
        const columnasFijas = ['Efector', 'DNI', 'Apellido', 'Nombre', 'Sexo', 'Edad'];
        const columnasDinamicas = filtrosActivos.map(f => f.field);
        const columnasFinales = [...new Set([...columnasFijas, ...columnasDinamicas])];

        const datosParaExcel = currentFilteredData.map(row => {
            const filaExcel = {};
            
            // BUSCADOR INTELIGENTE DE NOMBRE
            const combinadaKey = Object.keys(row).find(k => k.toLowerCase() === 'apellido y nombre');
            const valorCombinado = combinadaKey ? row[combinadaKey] : '';

            columnasFinales.forEach(col => {
                let valor = row[col];

                if ((col === 'Apellido' || col === 'Nombre') && !valor && valorCombinado) {
                    if (valorCombinado.includes(',')) {
                        const partes = valorCombinado.split(',');
                        if (col === 'Apellido') valor = partes[0].trim();
                        if (col === 'Nombre') valor = partes[1] ? partes[1].trim() : '';
                    } else {
                        if (col === 'Apellido') valor = valorCombinado;
                        if (col === 'Nombre') valor = ''; 
                    }
                }
                filaExcel[col] = valor || '-';
            });
            return filaExcel;
        });

        // GENERACIÓN LIMPIA (Sin doble encabezado)
        const descripcionFiltros = filtrosActivos.length > 0 
            ? filtrosActivos.map(f => `${f.field}`).join(', ')
            : 'Completo';

        const worksheet = XLSX.utils.aoa_to_sheet([
            [`Reporte: ${descripcionFiltros}`] 
        ]);

        XLSX.utils.sheet_add_json(worksheet, datosParaExcel, { origin: "A2" });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
        XLSX.writeFile(workbook, `Reporte_PPDT_${new Date().getTime()}.xlsx`);
        
        Swal.close();
    }

    // =================================================================================
    // 7. GRÁFICOS (Chart.js) - VERSIÓN MEJORADA
    // =================================================================================

    function buildDashboard(data) {
        // Destruir instancias previas para evitar "fantasmas" visuales
        Object.values(chartInstances).forEach(chart => { if(chart) chart.destroy(); });
        
        // Configuración global de fuentes y colores
        Chart.defaults.font.family = "'Segoe UI', 'Helvetica Neue', 'Arial', sans-serif";
        Chart.defaults.color = '#4B5563';
        
        createAgeChart(data);
        createCancerChart(data);
        createInfectiousChart(data);
        createRiskFactorsChart(data);
        createOtherHealthChart(data); // Antes se llamaba createSexAndDiseaseChart
    }

    function createAgeChart(data) {
        const ctx = document.getElementById('edad-chart');
        if (!ctx || !data.length) return;

        const counts = {
            'Menores de 18': data.filter(r => r.Edad < 18).length,
            'Jóvenes (18-30)': data.filter(r => r.Edad >= 18 && r.Edad <= 30).length,
            'Adultos (31-50)': data.filter(r => r.Edad > 30 && r.Edad <= 50).length,
            'Mayores (+50)': data.filter(r => r.Edad > 50).length,
        };

        chartInstances['edad-chart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    label: 'Cantidad de Pacientes',
                    data: Object.values(counts),
                    backgroundColor: ['#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8'], // Degradado azul
                    borderRadius: 5,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                const total = data.length;
                                const percentage = ((val / total) * 100).toFixed(1) + '%';
                                return `${val} casos (${percentage})`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { display: true, drawBorder: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function createCancerChart(data) {
        const ctx = document.getElementById('cancer-chart');
        if (!ctx || !data.length) return;

        // Calculamos casos POSITIVOS/PATOLÓGICOS solamente
        const cases = {
            'Mama': new Set(data.filter(r => normalizeString(r['Cáncer mama - Mamografía']) === 'patologico' || normalizeString(r['Cáncer mama - Eco mamaria']) === 'patologico').map(r => r.DNI || Math.random())).size,
            'Cérvix (HPV/PAP)': new Set(data.filter(r => normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico' || normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico').map(r => r.DNI || Math.random())).size,
            'Colon': new Set(data.filter(r => normalizeString(r['SOMF']) === 'patologico' || normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico').map(r => r.DNI || Math.random())).size,
            'Próstata': new Set(data.filter(r => normalizeString(r['Próstata - PSA']) === 'patologico').map(r => r.DNI || Math.random())).size
        };

        // Si no hay casos, mostramos un gráfico vacío elegante o nada
        const totalAlertas = Object.values(cases).reduce((a,b)=>a+b, 0);

        chartInstances['cancer-chart'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(cases),
                datasets: [{
                    data: Object.values(cases),
                    backgroundColor: ['#EC4899', '#F472B6', '#F59E0B', '#10B981'], // Rosas y naranjas
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%', // Hace el agujero de la dona más grande
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                    title: {
                        display: true,
                        text: totalAlertas === 0 ? 'Sin hallazgos patológicos' : `${totalAlertas} Hallazgos`,
                        position: 'top',
                        font: { size: 14 }
                    }
                }
            }
        });
    }

    function createInfectiousChart(data) {
        const ctx = document.getElementById('infecciosas-chart');
        if (!ctx || !data.length) return;

        const cases = {
            'VIH': data.filter(r => normalizeString(r['VIH']) === 'positivo').length,
            'Hepatitis B': data.filter(r => normalizeString(r['Hepatitis B']) === 'positivo').length,
            'Hepatitis C': data.filter(r => normalizeString(r['Hepatitis C']) === 'positivo').length,
            'Chagas': data.filter(r => normalizeString(r['Chagas']) === 'positivo').length,
            'Sífilis (VDRL)': data.filter(r => normalizeString(r['VDRL']) === 'positivo').length,
        };

        chartInstances['infecciosas-chart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(cases),
                datasets: [{
                    label: 'Casos Positivos',
                    data: Object.values(cases),
                    backgroundColor: ['#EF4444', '#F87171', '#DC2626', '#B91C1C', '#991B1B'], // Gama de Rojos (Alerta)
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // Hacemos las barras HORIZONTALES para leer mejor los nombres
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } } // Solo números enteros
                }
            }
        });
    }

    

    // RENOMBRADO: De 'createSexAndDiseaseChart' a 'createRiskFactorsChart'
    // CAMBIO CLAVE: Usamos barras horizontales porque las enfermedades se superponen
    function createRiskFactorsChart(data) {
        // Asegúrate de que en el HTML el canvas tenga id="sexo-enfermedad-chart" (o cámbialo aquí y allá)
        const ctx = document.getElementById('sexo-enfermedad-chart'); 
        if (!ctx || !data.length) return;

        const factors = {
            'Sobrepeso/Obesidad': data.filter(r => normalizeString(r.IMC).includes('obesidad') || normalizeString(r.IMC).includes('sobrepeso')).length,
            'Hipertensión': data.filter(r => normalizeString(r['Presión Arterial']).includes('hipertens')).length,
            'Tabaquismo': data.filter(r => normalizeString(r.Tabaco) === 'fuma').length,
            'Dislipemias': data.filter(r => normalizeString(r.Dislipemias) === 'presenta').length,
            'Diabetes': data.filter(r => normalizeString(r.Diabetes) === 'presenta').length,
        };

        // Ordenamos de mayor a menor para que se vea mejor
        const sortedEntries = Object.entries(factors).sort((a, b) => b[1] - a[1]);
        const labels = sortedEntries.map(e => e[0]);
        const values = sortedEntries.map(e => e[1]);

        chartInstances['sexo-enfermedad-chart'] = new Chart(ctx, {
            type: 'bar', // Barra normal
            data: {
                labels: labels,
                datasets: [{
                    label: 'Prevalencia',
                    data: values,
                    backgroundColor: '#14B8A6', // Color Teal (IAPOS)
                    borderRadius: 4,
                    barPercentage: 0.7
                }]
            },
            options: {
                indexAxis: 'y', // Barras HORIZONTALES
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Factores de Riesgo Más Frecuentes' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                const total = data.length;
                                const percentage = ((val / total) * 100).toFixed(1) + '%';
                                return `${val} casos (${percentage} del total)`;
                            }
                        }
                    }
                }
            }
        });
    }
    function createOtherHealthChart(data) {
        // 1. Buscamos el elemento
        const ctx = document.getElementById('otros-temas-chart');
        
        // 2. PROTECCIÓN CRÍTICA: Si no existe el canvas en el HTML, salimos sin romper nada.
        if (!ctx) {
            console.warn("No se encontró el canvas 'otros-temas-chart'. El gráfico no se dibujará, pero el resto sigue.");
            return;
        }

        // 3. Calculamos los datos
        const topics = {
            'Salud Bucal (Riesgo)': data.filter(r => normalizeString(r['Control Odontológico - Adultos']) === 'riesgo alto').length,
            'Salud Renal (Patológico)': data.filter(r => normalizeString(r['ERC']) === 'patológico').length,
            'Visión Alterada': data.filter(r => normalizeString(r['Agudeza visual']) === 'alterada').length,
            'EPOC': data.filter(r => normalizeString(r['EPOC']) === 'se verifica').length,
            'Depresión': data.filter(r => normalizeString(r['Depresión']) === 'se verifica').length,
            'Violencia': data.filter(r => normalizeString(r['Violencia']) === 'se verifica').length
        };

        // 4. Ordenamos para que quede bonito (Barra más larga arriba)
        const sortedEntries = Object.entries(topics).sort((a, b) => b[1] - a[1]);

        // 5. Dibujamos
        chartInstances['otros-temas-chart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedEntries.map(e => e[0]),
                datasets: [{
                    label: 'Casos',
                    data: sortedEntries.map(e => e[1]),
                    backgroundColor: [
                        '#7C3AED', // Violeta intenso
                        '#8B5CF6', 
                        '#A78BFA', 
                        '#C4B5FD', 
                        '#DDD6FE',
                        '#EDE9FE'  // Violeta muy suave
                    ],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // <--- ESTO HACE LAS BARRAS LATERALES
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw} casos`;
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
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
    // 8. IA Y EXPORTACIÓN PDF
    // =================================================================================

    async function generateAIReport() {
        if(!generarInformeBtn) return;
        const userPrompt = promptUsuario.value;
        generarInformeBtn.textContent = 'Generando...';
        generarInformeBtn.disabled = true;
        contenedorInforme.innerHTML = `<p class="text-gray-500">Generando informe, por favor espere...</p>`;
        
        try {
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
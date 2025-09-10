document.addEventListener('DOMContentLoaded', () => {
    // Función para normalizar cadenas (eliminar acentos y convertir a minúsculas)
    function normalizeString(str) {
        if (!str) return '';
        return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }
    
    // Función para limpiar los datos de edad
    function parseEdad(edadStr) {
        if (!edadStr) return NaN;
        const str = edadStr.toString().toLowerCase().trim();
        let match = str.match(/(\d+)\s*a/);
        if (match) return parseInt(match[1], 10);
        match = str.match(/(\d+)\s*m/);
        if (match) return -parseInt(match[1], 10);
        const num = parseInt(str, 10);
        if (!isNaN(num)) return num;
        return NaN;
    }

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
                { name: "Cáncer Cervicouterino", type: "multi-or", value: "Patologico", columns: ["Cáncer cérvico uterino - HPV", "Cáncer cérvico uterino - PAP"] },
                { name: "Cáncer de Colon", type: "multi-or", value: "Patologico", columns: ["SOMF", "Cáncer colon - Colonoscopía"] },
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
                { name: "Salud Mental", column: "Depresión", value: "Se verifica" }
            ]
        }
    ];

    let allData = [];
    let fixedIndicators = {};
    const chartInstances = {};
    const infoModal = document.getElementById('info-modal');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalContenido = document.getElementById('modal-contenido');
    const cerrarModalBtn = document.getElementById('cerrar-modal');
    const fechaActualizacionSpan = document.getElementById('fecha-actualizacion');

    const controlesFiltros = document.getElementById('controles-filtros');
    const capitulosSalud = document.getElementById('capitulos-salud');
    const dashboardGraficos = document.getElementById('dashboard-graficos');
    const mostrarControlesBtn = document.getElementById('mostrar-controles');
    const mostrarCapitulosBtn = document.getElementById('mostrar-capitulos');
    const limpiarFiltrosBtn = document.getElementById('limpiar-filtros');
    const selectorCampos = document.getElementById('selector-campos');
    const agregarFiltroBtn = document.getElementById('agregar-filtro');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const filtrosAplicadosDiv = document.getElementById('filtros-aplicados');
    const menuContainer = document.getElementById('menu-container');
    const informeIaSection = document.getElementById('informe-ia');
    const generarInformeBtn = document.getElementById('generar-informe-btn');
    const promptUsuario = document.getElementById('prompt-usuario');
    const contenedorInforme = document.getElementById('contenedor-informe');
    const exportarPdfBtn = document.getElementById('exportar-pdf-btn');
    const imprimirBtn = document.getElementById('imprimir-btn');

    const filtroAdultosBtn = document.getElementById('filtro-adultos');
    const filtroPediatricoBtn = document.getElementById('filtro-pediatrico');
    
    let currentFilterType = 'Adultos';
    let currentFilteredData = [];
    
    const MODAL_CONTENT = {
        'indicador-casos': { titulo: 'Total de Casos (Días Preventivos)', descripcion: 'Este número representa el total de personas que han participado en el programa. Se calcula contando la cantidad de DNI únicos en el registro. Si una persona participó más de una vez, solo se considera su último registro para evitar duplicados.' },
        'indicador-mujeres': { titulo: 'Total de Mujeres', descripcion: 'Este es el número de mujeres registradas en el programa, calculado a partir de la columna "Sexo".' },
        'indicador-varones': { titulo: 'Total de Varones', descripcion: 'Este es el número de varones registrados en el programa, calculado a partir de la columna "Sexo".' },
        'indicador-enfermedades-cronicas': { titulo: 'Total de Enfermedades Crónicas', descripcion: 'Este número representa el total de casos en el programa que han sido registrados con un diagnóstico de diabetes, hipertensión o dislipemias. Se calcula sumando los registros "Presenta" en las columnas de "Diabetes" y "Dislipemias", y los registros de "Hipertensión" en la columna de "Presión Arterial".' },
        'indicador-alto-riesgo': { titulo: 'Casos de Alto Riesgo', descripcion: 'Este número muestra a las personas que presentan al menos uno de los siguientes factores de riesgo: <br>• Edad mayor a 50 años <br>• Diagnóstico de Diabetes <br>• Diagnóstico de Hipertensión <br>• Diagnóstico de Obesidad o Sobrepeso <br>• Hábito de Fumar' }
    };
    
    initializeDashboard();

    async function initializeDashboard() {
        updateDate();
        await fetchDataAndSetButtonState('Adultos');

        filtroAdultosBtn.addEventListener('click', () => {
            currentFilterType = 'Adultos';
            fetchDataAndSetButtonState('Adultos');
        });
        
        filtroPediatricoBtn.addEventListener('click', () => {
            currentFilterType = 'Pediátrico';
            fetchDataAndSetButtonState('Pediátrico');
        });

        mostrarControlesBtn.addEventListener('click', () => {
            controlesFiltros.classList.remove('hidden');
            capitulosSalud.classList.add('hidden');
            dashboardGraficos.classList.remove('hidden');
            limpiarFiltrosBtn.classList.remove('hidden');
            informeIaSection.classList.add('hidden'); // Ocultar sección de informe
            mostrarControlesBtn.classList.remove('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            mostrarControlesBtn.classList.add('bg-blue-600', 'text-white');
            mostrarCapitulosBtn.classList.remove('bg-blue-600', 'text-white');
            mostrarCapitulosBtn.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
        });

        mostrarCapitulosBtn.addEventListener('click', () => {
            controlesFiltros.classList.add('hidden');
            capitulosSalud.classList.remove('hidden');
            dashboardGraficos.classList.add('hidden');
            limpiarFiltrosBtn.classList.remove('hidden');
            informeIaSection.classList.add('hidden'); // Ocultar sección de informe
            mostrarCapitulosBtn.classList.remove('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            mostrarCapitulosBtn.classList.add('bg-blue-600', 'text-white');
            mostrarControlesBtn.classList.remove('bg-blue-600', 'text-white');
            mostrarControlesBtn.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
        });
        
        limpiarFiltrosBtn.addEventListener('click', clearFilters);
        agregarFiltroBtn.addEventListener('click', createFilterUI);
        aplicarFiltrosBtn.addEventListener('click', applyFiltersAndRenderDashboard);
        generarInformeBtn.addEventListener('click', generateAIReport);
        exportarPdfBtn.addEventListener('click', exportReportToPdf);
        imprimirBtn.addEventListener('click', () => window.print());

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

        cerrarModalBtn.addEventListener('click', () => {
            infoModal.classList.add('hidden');
        });
        
        // Botón para mostrar/ocultar la sección del informe de la IA
        const iaBtn = document.createElement('button');
        iaBtn.id = 'mostrar-ia-btn';
        iaBtn.textContent = 'Informe con IA';
        iaBtn.className = 'bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full focus:outline-none focus:shadow-outline';
        document.querySelector('.flex.space-x-4').appendChild(iaBtn);

        iaBtn.addEventListener('click', () => {
            controlesFiltros.classList.add('hidden');
            capitulosSalud.classList.add('hidden');
            dashboardGraficos.classList.add('hidden');
            limpiarFiltrosBtn.classList.add('hidden');
            informeIaSection.classList.remove('hidden');
        });
    }

    async function fetchData(tipo) {
        try {
            const [dataResponse, indicadoresResponse, camposResponse] = await Promise.all([
                fetch(`/obtener-datos-completos?tipo=${tipo}`),
                fetch(`/obtener-indicadores-fijos?tipo=${tipo}`),
                fetch('/obtener-campos')
            ]);
            
            allData = (await dataResponse.json()).map(row => {
                row.Edad = parseEdad(row.Edad);
                return row;
            });
            fixedIndicators = await indicadoresResponse.json();
            const campos = await camposResponse.json();

            selectorCampos.innerHTML = '';
            campos.forEach(campo => {
                const option = document.createElement('option');
                option.value = campo;
                option.textContent = campo;
                selectorCampos.appendChild(option);
            });

            renderFixedIndicators(fixedIndicators);
            currentFilteredData = [...allData];
            buildDashboard(allData);
            buildHealthChaptersMenu();

        } catch (error) {
            console.error('Error al cargar la aplicación:', error);
            document.body.innerHTML = '<p class="text-red-600 text-center text-xl mt-10">Error al cargar la aplicación. Por favor, reinicia el servidor.</p>';
        }
    }

    async function fetchDataAndSetButtonState(tipo) {
        await fetchData(tipo);
        if (tipo.toLowerCase() === 'adultos') {
            filtroAdultosBtn.classList.remove('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            filtroAdultosBtn.classList.add('bg-blue-600', 'text-white');
            filtroPediatricoBtn.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            filtroPediatricoBtn.classList.remove('bg-blue-600', 'text-white');
        } else {
            filtroPediatricoBtn.classList.remove('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            filtroPediatricoBtn.classList.add('bg-blue-600', 'text-white');
            filtroAdultosBtn.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            filtroAdultosBtn.classList.remove('bg-blue-600', 'text-white');
        }
    }

    function renderFixedIndicators(data) {
        document.getElementById('total-casos').textContent = data.diasPreventivos;
        document.getElementById('total-mujeres').textContent = `${data.sexo.femenino} (${data.sexo.porcentajeFemenino}%)`;
        document.getElementById('total-varones').textContent = `${data.sexo.masculino} (${data.sexo.porcentajeMasculino}%)`;
        const totalEnfCronicas = data.enfermedades.diabetes + data.enfermedades.hipertension + data.enfermedades.dislipemias;
        document.getElementById('total-cronicas').textContent = totalEnfCronicas;
        document.getElementById('total-alto-riesgo').textContent = data.altoRiesgo;
    }

    function buildDashboard(data) {
        Object.values(chartInstances).forEach(chart => chart.destroy());
        createAgeChart(data);
        createCancerChart(data);
        createInfectiousChart(data);
        createSexAndDiseaseChart(data);
        currentFilteredData = data;
    }
    
    function createFilterUI() {
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
                inputDesde.type = 'number';
                inputDesde.id = `edad-desde`;
                inputDesde.placeholder = 'Desde';
                inputDesde.classList.add('shadow', 'appearance-none', 'border', 'rounded', 'w-full', 'py-2', 'px-3', 'text-gray-700');
                const inputHasta = document.createElement('input');
                inputHasta.type = 'number';
                inputHasta.id = `edad-hasta`;
                inputHasta.placeholder = 'Hasta';
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
        const filteredData = allData.filter(row => {
            if (filters.length === 0) return true;
            return filters.every(filter => {
                if (filter.field === 'Edad') {
                    const edad = row.Edad;
                    return edad >= filter.value.desde && edad <= filter.value.hasta;
                } else if (filter.operator === 'in') {
                    const valueInRow = row[filter.field];
                    if (!valueInRow) return false;
                    return filter.value.includes(valueInRow);
                }
                return false;
            });
        });
        document.getElementById('total-casos').textContent = filteredData.length;
        buildDashboard(filteredData);
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
    
    function clearFilters() {
        filtrosAplicadosDiv.innerHTML = '';
        buildDashboard(allData);
        document.getElementById('total-casos').textContent = fixedIndicators.diasPreventivos;
    }
    
    function buildHealthChaptersMenu() {
        menuContainer.innerHTML = '';
        const normalizeString = (str) => str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        
        IAPOS_PREVENTIVE_PROGRAM_MENU.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.classList.add('bg-gray-100', 'p-6', 'rounded-lg', 'mb-6', `category-container-shadow-${category.color.split('-')[0]}`);
            
            const categoryHeader = `
                <div class="flex items-center space-x-4 mb-4">
                    <i class="fas fa-${category.icon} text-${category.color} text-2xl"></i>
                    <h3 class="text-xl font-semibold text-gray-800">${category.category}</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            `;
            let subtopicsHtml = '';

            category.subtopics.forEach(subtopic => {
                if (subtopic.subtopics) {
                    let totalCount = 0;
                    const nestedSubtopicsHtml = subtopic.subtopics.map(nestedSubtopic => {
                        let nestedCount = 0;
                        if (nestedSubtopic.fixedCount !== undefined) {
                            nestedCount = nestedSubtopic.fixedCount;
                        } else if (Array.isArray(nestedSubtopic.value)) {
                            nestedCount = allData.filter(row => nestedSubtopic.value.some(val => normalizeString(row[nestedSubtopic.column]) === normalizeString(val))).length;
                        } else if (nestedSubtopic.type === 'multi-or') {
                            const uniqueDNI = new Set();
                            nestedSubtopic.columns.forEach(col => {
                                allData.filter(row => normalizeString(row[col]) === normalizeString(nestedSubtopic.value)).forEach(row => {
                                    if(row.DNI) uniqueDNI.add(row.DNI);
                                });
                            });
                            nestedCount = uniqueDNI.size;
                        } else {
                            nestedCount = allData.filter(row => normalizeString(row[nestedSubtopic.column]) === normalizeString(nestedSubtopic.value)).length;
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
                    if (subtopic.type === 'multi-or') {
                        const uniqueDNI = new Set();
                        subtopic.columns.forEach(col => {
                            allData.filter(row => normalizeString(row[col]) === normalizeString(subtopic.value)).forEach(row => {
                                if(row.DNI) uniqueDNI.add(row.DNI);
                            });
                        });
                        count = uniqueDNI.size;
                    } else if (subtopic.normalized) {
                        count = allData.filter(row => normalizeString(row[subtopic.column]).includes(normalizeString(subtopic.value))).length;
                    } else if (Array.isArray(subtopic.value)) {
                        count = allData.filter(row => subtopic.value.some(val => normalizeString(row[subtopic.column]) === normalizeString(val))).length;
                    } else {
                        count = allData.filter(row => normalizeString(row[subtopic.column]) === normalizeString(subtopic.value)).length;
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
                ${categoryHeader}
                ${subtopicsHtml}
                </div>
            `;
            menuContainer.appendChild(categoryDiv);
        });
    }

    function createAgeChart(data) {
        if (!data || data.length === 0) return;
        const counts = {
            'Menores de 18': data.filter(r => r.Edad < 18 && r.Edad > 0).length,
            '18 a 30': data.filter(r => r.Edad >= 18 && r.Edad <= 30).length,
            '30 a 50': data.filter(r => r.Edad > 30 && r.Edad <= 50).length,
            'Mayores de 50': data.filter(r => r.Edad > 50).length,
        };
        const ctx = document.getElementById('edad-chart');
        if (chartInstances['edad-chart']) chartInstances['edad-chart'].destroy();
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
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    function createCancerChart(data) {
        if (!data || data.length === 0) return;
        const cases = {
            'Colon': new Set(data.filter(r => normalizeString(r['SOMF']) === 'patologico' || normalizeString(r['Cáncer colon - Colonoscopía']) === 'patologico').map(r => r.DNI)).size,
            'Mama': new Set(data.filter(r => normalizeString(r['Cáncer mama - Mamografía']) === 'patologico').map(r => r.DNI)).size,
            'Cérvico Uterino': new Set(data.filter(r => normalizeString(r['Cáncer cérvico uterino - HPV']) === 'patologico' || normalizeString(r['Cáncer cérvico uterino - PAP']) === 'patologico').map(r => r.DNI)).size,
        };
        const ctx = document.getElementById('cancer-chart');
        if (chartInstances['cancer-chart']) chartInstances['cancer-chart'].destroy();
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
    
    function createInfectiousChart(data) {
        if (!data || data.length === 0) return;
        const cases = {
            'VIH': data.filter(r => normalizeString(r['VIH']) === 'positivo').length,
            'Hepatitis B': data.filter(r => normalizeString(r['Hepatitis B']) === 'positivo').length,
            'Hepatitis C': data.filter(r => normalizeString(r['Hepatitis C']) === 'positivo').length,
            'Chagas': data.filter(r => normalizeString(r['Chagas']) === 'positivo').length,
        };
        const ctx = document.getElementById('infecciosas-chart');
        if (chartInstances['infecciosas-chart']) chartInstances['infecciosas-chart'].destroy();
        chartInstances['infecciosas-chart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(cases),
                datasets: [{
                    label: 'Casos de Enfermedades Infecciosas',
                    data: Object.values(cases),
                    backgroundColor: ['#FF5722', '#F44336', '#E91E63', '#9C27B0'],
                }]
            },
            options: {
                responsive: true, plugins: { legend: { display: false } }
            }
        });
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
        if (chartInstances['sexo-enfermedad-chart']) chartInstances['sexo-enfermedad-chart'].destroy();
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

    // --- Lógica de la IA y PDF ---
    async function generateAIReport() {
        const userPrompt = promptUsuario.value;
        generarInformeBtn.textContent = 'Generando...';
        generarInformeBtn.disabled = true;
        contenedorInforme.innerHTML = `<p class="text-gray-500">Generando informe, por favor espere...</p>`;
        
        try {
            const response = await fetch('/generar-informe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: currentFilteredData, userPrompt: userPrompt })
            });
            const result = await response.json();
            
            if (result.informe) {
                // Reemplazar saltos de línea con <br> para HTML
                const formattedText = result.informe.replace(/\n/g, '<br>');
                contenedorInforme.innerHTML = `<div>${formattedText}</div>`;
                exportarPdfBtn.classList.remove('hidden');
                imprimirBtn.classList.remove('hidden');
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
        const doc = new jsPDF();
        
        const element = contenedorInforme;
        const originalMargin = element.style.margin;
        const originalPadding = element.style.padding;
        element.style.margin = '0';
        element.style.padding = '0';

        html2canvas(element, {
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = doc.internal.pageSize.getWidth() - 20;
            const pageHeight = doc.internal.pageSize.getHeight();
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 10;

            doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight + 10;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            doc.save('informe-dia-preventivo.pdf');
            
            element.style.margin = originalMargin;
            element.style.padding = originalPadding;
        });
    }

    function updateDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        fechaActualizacionSpan.textContent = today.toLocaleDateString('es-AR', options);
    }
});
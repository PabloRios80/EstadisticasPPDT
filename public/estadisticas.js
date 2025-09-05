document.addEventListener('DOMContentLoaded', () => {
    const IAPOS_PREVENTIVE_PROGRAM_MENU = [
        {
            category: "Evaluación de Riesgo Cardiovascular y Enfermedades Crónicas",
            icon: "heart-pulse", 
            color: "red-600",
            subtopics: [
                { name: "Diabetes", column: "Diabetes", value: "Presenta" },
                { name: "Presión Arterial", column: "Presión Arterial", value: "Hipertensión" },
                { name: "Dislipemias", column: "Dislipemias", value: "Presenta" },
                { name: "IMC", column: "IMC", value: ["Sobrepeso", "Obesidad", "Obesidad Morbida"] },
                { name: "Tabaquismo", column: "Tabaco", value: "Fuma" }
            ]
        },
        {
            category: "Prevención de Cáncer",
            icon: "ribbon",
            color: "purple-600",
            subtopics: [
                { name: "Cáncer de Mama", column: "Cáncer mama - Mamografía", value: "Positivo" },
                { name: "Cáncer Cervicouterino", column: "Cáncer cérvico uterino - PAP", value: "Positivo" },
                { name: "Cáncer de Colon", column: "Cáncer colon - Colonoscopía", value: "Positivo" },
                { name: "Cáncer de Próstata", column: "Próstata - PSA", value: "Positivo" }
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
                { name: "Salud Bucal", column: "Control Odontológico", value: "Control Odontológico" },
                { name: "Salud Renal", column: "ERC", value: "Presenta" },
                { name: "Agudeza Visual", column: "Agudeza visual", value: "Presenta" },
                { name: "EPOC", column: "EPOC", value: "Presenta" },
                { name: "Aneurisma de Aorta", column: "Aneurisma aorta", value: "Presenta" },
                { name: "Osteoporosis", column: "Osteoporosis", value: "Presenta" },
                { name: "Uso de Aspirina", column: "Aspirina", value: "Presenta" },
                { name: "Salud Mental", column: "Depresión", value: "Presenta" }
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

    const filtroAdultosBtn = document.getElementById('filtro-adultos');
    const filtroPediatricoBtn = document.getElementById('filtro-pediatrico');
    
    let currentFilterType = 'Adultos';

    const MODAL_CONTENT = {
        'indicador-casos': { titulo: 'Total de Casos (Días Preventivos)', descripcion: 'Este número representa el total de personas que han participado en el programa. Se calcula contando la cantidad de DNI únicos en el registro. Si una persona participó más de una vez, solo se considera su último registro para evitar duplicados.' },
        'indicador-mujeres': { titulo: 'Total de Mujeres', descripcion: 'Este es el número de mujeres registradas en el programa, calculado a partir de la columna "Sexo".' },
        'indicador-varones': { titulo: 'Total de Varones', descripcion: 'Este es el número de varones registrados en el programa, calculado a partir de la columna "Sexo".' },
        'indicador-enfermedades-cronicas': { titulo: 'Total de Enfermedades Crónicas', descripcion: 'Este número representa el total de casos en el programa que han sido registrados con un diagnóstico de diabetes, hipertensión o dislipemias. Se calcula sumando los registros "Presenta" en las columnas de "Diabetes" y "Dislipemias", y los registros de "Hipertensión" en la columna de "Presión Arterial".' },
        'indicador-alto-riesgo': { titulo: 'Casos de Alto Riesgo', descripcion: 'Este número muestra a las personas que presentan al menos uno de los siguientes factores de riesgo: <br>• Edad mayor a 50 años <br>• Diagnóstico de Diabetes <br>• Diagnóstico de Hipertensión <br>• Diagnóstico de Obesidad o Sobrepeso <br>• Hábito de Fumar' }
    };
    
    initializeDashboard();

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

    async function initializeDashboard() {
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
        });

        mostrarCapitulosBtn.addEventListener('click', () => {
            controlesFiltros.classList.add('hidden');
            capitulosSalud.classList.remove('hidden');
            dashboardGraficos.classList.add('hidden');
            limpiarFiltrosBtn.classList.remove('hidden');
        });
        
        limpiarFiltrosBtn.addEventListener('click', clearFilters);
        agregarFiltroBtn.addEventListener('click', createFilterUI);
        aplicarFiltrosBtn.addEventListener('click', applyFiltersAndRenderDashboard);

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

        buildHealthChaptersMenu();
    }

    async function fetchData(tipo) {
        try {
            const [dataResponse, indicadoresResponse, camposResponse] = await Promise.all([
                fetch(`/obtener-datos-completos?tipo=${tipo}`),
                fetch(`/obtener-indicadores-fijos?tipo=${tipo}`),
                fetch('/obtener-campos')
            ]);
            
            // Limpia y normaliza los datos de edad una sola vez
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
            buildDashboard(allData);

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
                    const edad = row.Edad; // Usamos el valor numérico limpio
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
        IAPOS_PREVENTIVE_PROGRAM_MENU.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.classList.add('bg-white', 'p-6', 'rounded-lg', 'shadow-md', 'mb-6');
            categoryDiv.innerHTML = `
                <div class="flex items-center space-x-4 mb-4">
                    <i class="fas fa-${category.icon} text-${category.color} text-2xl"></i>
                    <h3 class="text-xl font-semibold text-gray-800">${category.category}</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    ${category.subtopics.map(subtopic => `
                        <div class="subtopic bg-gray-100 p-4 rounded-lg cursor-pointer hover:bg-gray-200 transition" data-column="${subtopic.column}">
                            <p class="font-medium text-gray-700">${subtopic.name}</p>
                            <p class="text-sm text-gray-500 mt-1">Casos: <span id="casos-${subtopic.column.replace(/\s+/g, '-')}" class="font-bold text-gray-800">0</span></p>
                        </div>
                    `).join('')}
                </div>
            `;
            menuContainer.appendChild(categoryDiv);
        });

        document.querySelectorAll('.subtopic').forEach(subtopicEl => {
            subtopicEl.addEventListener('click', () => {
                const column = subtopicEl.dataset.column;
                const subtopic = IAPOS_PREVENTIVE_PROGRAM_MENU.flatMap(cat => cat.subtopics).find(sub => sub.column === column);
                if (!subtopic) return;

                const count = allData.filter(row => {
                    const valueInRow = (row[column] || '').trim().toLowerCase();
                    if (Array.isArray(subtopic.value)) {
                        return subtopic.value.some(val => valueInRow.includes(val.toLowerCase()));
                    }
                    return valueInRow === subtopic.value.toLowerCase();
                }).length;
                
                document.getElementById(`casos-${column.replace(/\s+/g, '-')}`).textContent = count;
            });
        });
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
            'Colon': data.filter(r => (r['SOMF'] || '').toLowerCase() === 'positivo' || (r['Cáncer colon - Colonoscopía'] || '').toLowerCase() === 'positivo').length,
            'Mama': data.filter(r => (r['Cáncer mama - Mamografía'] || '').toLowerCase() === 'positivo').length,
            'Cérvico Uterino': data.filter(r => (r['Cáncer cérvico uterino - HPV'] || '').toLowerCase() === 'positivo' || (r['Cáncer cérvico uterino - PAP'] || '').toLowerCase() === 'positivo').length,
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
            'VIH': data.filter(r => (r['VIH'] || '').toLowerCase() === 'positivo').length,
            'Hepatitis B': data.filter(r => (r['Hepatitis B'] || '').toLowerCase() === 'positivo').length,
            'Hepatitis C': data.filter(r => (r['Hepatitis C'] || '').toLowerCase() === 'positivo').length,
            'Chagas': data.filter(r => (r['Chagas'] || '').toLowerCase() === 'positivo').length,
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
            'Diabetes': data.filter(r => (r.Diabetes || '').toLowerCase() === 'presenta').length,
            'Hipertensión': data.filter(r => (r['Presión Arterial'] || '').toLowerCase().includes('hipertens')).length,
            'Dislipemias': data.filter(r => (r.Dislipemias || '').toLowerCase() === 'presenta').length,
            'Fumadores': data.filter(r => (r.Tabaco || '').toLowerCase() === 'fuma').length,
            'Obesos': data.filter(r => (r.IMC || '').toLowerCase().includes('obesidad')).length,
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
});
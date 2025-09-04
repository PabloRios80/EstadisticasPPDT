document.addEventListener('DOMContentLoaded', () => {
    let allData = [];
    let fixedIndicators = {};
    const chartInstances = {};
    const indicadoresFijosContainer = document.getElementById('indicadores-fijos-container');
    const controlesFiltros = document.getElementById('controles-filtros');
    const mostrarControlesBtn = document.getElementById('mostrar-controles');
    const limpiarFiltrosBtn = document.getElementById('limpiar-filtros');
    const selectorCampos = document.getElementById('selector-campos');
    const agregarFiltroBtn = document.getElementById('agregar-filtro');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const filtrosAplicadosDiv = document.getElementById('filtros-aplicados');

    initializeDashboard();

    async function initializeDashboard() {
        try {
            const [dataResponse, indicadoresResponse, camposResponse] = await Promise.all([
                fetch('/obtener-datos-completos'),
                fetch('/obtener-indicadores-fijos'),
                fetch('/obtener-campos')
            ]);
            
            allData = await dataResponse.json();
            fixedIndicators = await indicadoresResponse.json();
            const campos = await camposResponse.json();

            // Llenar el selector de campos
            campos.forEach(campo => {
                const option = document.createElement('option');
                option.value = campo;
                option.textContent = campo;
                selectorCampos.appendChild(option);
            });

            renderFixedIndicators(fixedIndicators);
            buildDashboard(allData);

            // Event Listeners
            mostrarControlesBtn.addEventListener('click', () => {
                controlesFiltros.classList.toggle('hidden');
                limpiarFiltrosBtn.classList.toggle('hidden');
            });

            agregarFiltroBtn.addEventListener('click', createFilterUI);
            aplicarFiltrosBtn.addEventListener('click', applyFiltersAndRenderDashboard);
            limpiarFiltrosBtn.addEventListener('click', clearFilters);

        } catch (error) {
            console.error('Error al iniciar el dashboard:', error);
            document.body.innerHTML = '<p class="text-red-600 text-center text-xl mt-10">Error al cargar la aplicación. Por favor, reinicia el servidor.</p>';
        }
    }

    function renderFixedIndicators(data) {
        document.getElementById('total-casos').textContent = data.diasPreventivos;
        document.getElementById('total-mujeres').textContent = `${data.sexo.femenino} (${data.sexo.porcentajeFemenino}%)`;
        document.getElementById('total-varones').textContent = `${data.sexo.masculino} (${data.sexo.porcentajeMasculino}%)`;
        const totalEnfCronicas = data.enfermedades.diabetes + data.enfermedades.hipertension + data.enfermedades.dislipemias;
        document.getElementById('total-cronicas').textContent = totalEnfCronicas;
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
                filtroDiv.appendChild(inputDesde);
                filtroDiv.appendChild(inputHasta);
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
                const valueInRow = row[filter.field];
                if (filter.field === 'Edad') {
                    const edad = parseInt(valueInRow, 10);
                    return (!isNaN(edad) && edad >= filter.value.desde && edad <= filter.value.hasta);
                } else if (filter.operator === 'in') {
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
                const desde = document.getElementById('edad-desde').value;
                const hasta = document.getElementById('edad-hasta').value;
                if (desde && hasta) {
                    filters.push({ field, operator: 'range', value: { desde: parseFloat(desde), hasta: parseFloat(hasta) } });
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
        document.getElementById('total-casos').textContent = allData.length;
    }

    function createAgeChart(data) {
        const counts = {
            'Menores de 18': data.filter(r => parseInt(r.Edad, 10) < 18).length,
            '18 a 30': data.filter(r => parseInt(r.Edad, 10) >= 18 && parseInt(r.Edad, 10) <= 30).length,
            '30 a 50': data.filter(r => parseInt(r.Edad, 10) > 30 && parseInt(r.Edad, 10) <= 50).length,
            'Mayores de 50': data.filter(r => parseInt(r.Edad, 10) > 50).length,
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
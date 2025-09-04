document.addEventListener('DOMContentLoaded', () => {
    const selectorCampos = document.getElementById('selector-campos');
    const agregarFiltroBtn = document.getElementById('agregar-filtro');
    const filtrosAplicadosDiv = document.getElementById('filtros-aplicados');
    const consultarGrupoBtn = document.getElementById('consultar-grupo-btn');
    const resultadosResumenDiv = document.getElementById('resultados-resumen');
    const exportarExcelBtn = document.getElementById('exportar-excel-btn');
    const combinacionFiltrosSelect = document.getElementById('combinacion-filtros');

    if (selectorCampos && agregarFiltroBtn && filtrosAplicadosDiv && consultarGrupoBtn && resultadosResumenDiv && exportarExcelBtn && combinacionFiltrosSelect) {
        cargarCampos();

        agregarFiltroBtn.addEventListener('click', agregarNuevoFiltro);
        consultarGrupoBtn.addEventListener('click', realizarConsultaGrupal);
        exportarExcelBtn.addEventListener('click', exportarResultados);
    }

    async function cargarCampos() {
        try {
            const response = await fetch('/obtener-campos');
            const campos = await response.json();
            campos.forEach(campo => {
                const option = document.createElement('option');
                option.value = campo;
                option.textContent = campo;
                selectorCampos.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar los campos:', error);
        }
    }

    function agregarNuevoFiltro() {
        const camposSeleccionados = Array.from(selectorCampos.selectedOptions).map(option => option.value);
        console.log('Campos seleccionados para filtrar:', camposSeleccionados);
        camposSeleccionados.forEach(campo => {
            // Verificamos SI NO existe ya un filtro para este campo
            if (!document.getElementById(`filtro-${campo}`)) {
                crearInterfazFiltro(campo);
            }
        });
    }

    async function crearInterfazFiltro(campo) {
        const filtroExistente = document.getElementById(`filtro-${campo}`);
        if (filtroExistente) {
            console.log(`Ya existe un filtro para el campo: ${campo}`);
            return; // Si ya existe, no creamos uno nuevo
        }

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

            const labelDesde = document.createElement('label');
            labelDesde.textContent = 'Desde:';
            labelDesde.classList.add('text-gray-700', 'text-sm', 'font-bold');
            const inputDesde = document.createElement('input');
            inputDesde.type = 'number';
            inputDesde.classList.add('shadow', 'appearance-none', 'border', 'rounded', 'w-full', 'py-2', 'px-3', 'text-gray-700', 'leading-tight', 'focus:outline-none', 'focus:shadow-outline');
            inputDesde.id = `edad-desde`;

            const labelHasta = document.createElement('label');
            labelHasta.textContent = 'Hasta:';
            labelHasta.classList.add('text-gray-700', 'text-sm', 'font-bold');
            const inputHasta = document.createElement('input');
            inputHasta.type = 'number';
            inputHasta.classList.add('shadow', 'appearance-none', 'border', 'rounded', 'w-full', 'py-2', 'px-3', 'text-gray-700', 'leading-tight', 'focus:outline-none', 'focus:shadow-outline');
            inputHasta.id = `edad-hasta`;

            const aplicarBtn = document.createElement('button');
            aplicarBtn.textContent = 'Aplicar Rango';
            aplicarBtn.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-2', 'px-4', 'rounded', 'focus:outline-none', 'focus:shadow-outline');
            aplicarBtn.addEventListener('click', () => {
                const desde = document.getElementById('edad-desde').value;
                const hasta = document.getElementById('edad-hasta').value;
                filtroDiv.dataset.edadDesde = desde;
                filtroDiv.dataset.edadHasta = hasta;
                console.log(`Rango de edad aplicado: Desde ${desde} hasta ${hasta}`);
            });

            divRango.appendChild(labelDesde);
            divRango.appendChild(inputDesde);
            divRango.appendChild(labelHasta);
            divRango.appendChild(inputHasta);

            filtroDiv.appendChild(divRango);
            filtroDiv.appendChild(aplicarBtn);

            filtrosAplicadosDiv.appendChild(filtroDiv);

        } else {
            try {
                const response = await fetch(`/obtener-opciones-campo/${campo}`);
                const opciones = await response.json();

                if (opciones && opciones.length > 0) {
                    opciones.forEach(opcion => {
                        const checkboxDiv = document.createElement('div');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `opcion-${campo}-${opcion.replace(/\s+/g, '-')}`;
                        checkbox.value = opcion;
                        const labelOpcion = document.createElement('label');
                        labelOpcion.textContent = opcion;
                        labelOpcion.setAttribute('for', `opcion-${campo}-${opcion.replace(/\s+/g, '-')}`);
                        labelOpcion.classList.add('ml-2', 'text-gray-700', 'text-sm');

                        checkboxDiv.appendChild(checkbox);
                        checkboxDiv.appendChild(labelOpcion);
                        filtroDiv.appendChild(checkboxDiv);
                    });
                } else {
                    const inputTexto = document.createElement('input');
                    inputTexto.type = 'text';
                    inputTexto.classList.add('shadow', 'appearance-none', 'border', 'rounded', 'w-full', 'py-2', 'px-3', 'text-gray-700', 'leading-tight', 'focus:outline-none', 'focus:shadow-outline');
                    filtroDiv.appendChild(inputTexto);
                }
                filtrosAplicadosDiv.appendChild(filtroDiv);

            } catch (error) {
                console.error(`Error al obtener opciones para ${campo}:`, error);
                const mensajeError = document.createElement('p');
                mensajeError.textContent = `Error al cargar opciones para ${campo}`;
                filtroDiv.appendChild(mensajeError);
                filtrosAplicadosDiv.appendChild(filtroDiv);
            }
        }
    }

    async function realizarConsultaGrupal() {
        const filtros = obtenerCriteriosDeFiltro();
        const combinacion = combinacionFiltrosSelect.value;
        const dataToSend = { conditions: filtros, combinator: combinacion };

        try {
            const response = await fetch('/consultar-grupo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });
            const resultados = await response.json();
            console.log('Resultados de la consulta grupal:', resultados);

            if (resultados && Array.isArray(resultados.data)) {
                exportarExcelBtn.data = resultados.data;
                mostrarResultadosResumen({
                    total_registros: resultados.total_registros,
                    conteo_cruce: resultados.conteo_cruce,
                    criterios_cruce: resultados.criterios_cruce
                });
            } else {
                resultadosResumenDiv.textContent = 'Error: No se recibieron datos detallados para la exportación.';
                console.error('Error: No se recibieron datos detallados para la exportación:', resultados);
            }

        } catch (error) {
            console.error('Error al realizar la consulta grupal:', error);
        }
    }

    function obtenerCriteriosDeFiltro() {
        const filtros = [];
        const filtrosDivs = document.querySelectorAll('#filtros-aplicados > .filtro');
        filtrosDivs.forEach(filtroDiv => {
            const campo = filtroDiv.id.replace('filtro-', '');
            if (campo === 'Edad') {
                const desde = filtroDiv.dataset.edadDesde;
                const hasta = filtroDiv.dataset.edadHasta;
                if (desde && hasta) {
                    if (desde === hasta) {
                        filtros.push({ field: campo, operator: 'equals', value: desde });
                    } else {
                        filtros.push({ field: campo, operator: 'greaterThanOrEqual', value: desde });
                        filtros.push({ field: campo, operator: 'lessThanOrEqual', value: hasta });
                    }
                }
            } else {
                const checkboxes = filtroDiv.querySelectorAll('input[type="checkbox"]:checked');
                const textoInput = filtroDiv.querySelector('input[type="text"]');

                if (checkboxes.length > 0) {
                    const valores = Array.from(checkboxes).map(cb => cb.value);
                    filtros.push({ field: campo, operator: 'in', value: valores });
                } else if (textoInput && textoInput.value.trim() !== '') {
                    filtros.push({ field: campo, operator: 'includes', value: textoInput.value.trim() });
                }
            }
        });
        return filtros;
    }

    function mostrarResultadosResumen(resultados) {
        resultadosResumenDiv.innerHTML = '';

        if (!resultados || typeof resultados.total_registros === 'undefined' || typeof resultados.conteo_cruce === 'undefined') {
            resultadosResumenDiv.textContent = 'Error al recibir los resultados del cruce.';
            console.error('Estructura de resultados inesperada:', resultados);
            return;
        }

        const totalRegistros = resultados.total_registros;
        const conteoCruce = resultados.conteo_cruce;
        const porcentajeCruce = ((conteoCruce / totalRegistros) * 100).toFixed(2);
        const criteriosCruce = resultados.criterios_cruce || {};

        const tabla = document.createElement('table');
        tabla.classList.add('resultados-table');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Total Registros</th>
            <th>Criterios del Cruce</th>
            <th>Resultado del Cruce (Cantidad)</th>
            <th>Resultado del Cruce (%)</th>
        `;
        thead.appendChild(headerRow);
        tabla.appendChild(thead);

        const tbody = document.createElement('tbody');
        const dataRow = document.createElement('tr');
        dataRow.innerHTML = `
            <td>${totalRegistros}</td>
            <td>${Object.entries(criteriosCruce).map(([variable, valor]) => `${variable} = ${valor}`).join('<br>')}</td>
            <td>${conteoCruce}</td>
            <td>${porcentajeCruce}%</td>
        `;
        tbody.appendChild(dataRow);
        tabla.appendChild(tbody);

        resultadosResumenDiv.appendChild(tabla);
    }

    function exportarResultados() {
        const dataParaExportar = exportarExcelBtn.data;

        if (!dataParaExportar || dataParaExportar.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws_data = [Object.keys(dataParaExportar[0])];
        dataParaExportar.forEach(obj => ws_data.push(Object.values(obj)));
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        XLSX.utils.book_append_sheet(wb, ws, "Datos Filtrados");
        XLSX.writeFile(wb, "datos_filtrados.xlsx");
    }
});
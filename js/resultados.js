// js/resultados.js
let allSurveys = [];
let filteredSurveys = [];
let charts = {};

document.addEventListener('DOMContentLoaded', async () => {
    window.firebaseApp.init();

    // Esperar a que se verifique la autenticación
    const checkAuth = new Promise((resolve) => {
        window.authManager.onAuthStateChanged((user, role) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            
            document.getElementById('userEmail').textContent = user.email;
            
            // Aplicar permisos
            window.permissionsManager.checkRouteAccess();
            window.permissionsManager.applyUIPermissions();
            
            // Ocultar enlaces según permisos
            if (!window.permissionsManager.can('create', 'surveys')) {
                document.querySelectorAll('[data-permission="create-survey"]').forEach(el => {
                    el.style.display = 'none';
                });
            }
            
            resolve();
        });
    });

    await checkAuth;
    await loadData();
});

async function loadData() {
    const result = await window.surveyManager.getSurveys();
    
    if (result.success) {
        allSurveys = result.surveys;
        filteredSurveys = allSurveys;
        
        updateStats();
        populateFilters();
        renderCharts();
        renderDetailedTable();
    }
}

function updateStats() {
    const surveys = filteredSurveys;
    
    // Total encuestas
    document.getElementById('totalSurveys').textContent = surveys.length;
    
    // Total establecimientos únicos
    const establishments = new Set(surveys.map(s => s.establishmentName));
    document.getElementById('totalEstablishments').textContent = establishments.size;
    
    // Total productos
    const totalProducts = surveys.reduce((sum, s) => sum + (s.products?.length || 0), 0);
    document.getElementById('totalProducts').textContent = totalProducts;
    
    // Total encuestadores
    const encuestadores = new Set(surveys.map(s => s.metadata?.createdByEmail).filter(Boolean));
    document.getElementById('totalEncuestadores').textContent = encuestadores.size;
}

function populateFilters() {
    // Municipios
    const municipalities = [...new Set(allSurveys.map(s => s.municipality).filter(Boolean))].sort();
    const municipalitySelect = document.getElementById('filterMunicipality');
    municipalities.forEach(m => {
        const option = document.createElement('option');
        option.value = m;
        option.textContent = m;
        municipalitySelect.appendChild(option);
    });
    
    // Zonas
    const zones = [...new Set(allSurveys.map(s => s.zone).filter(Boolean))].sort();
    const zoneSelect = document.getElementById('filterZone');
    zones.forEach(z => {
        const option = document.createElement('option');
        option.value = z;
        option.textContent = z;
        zoneSelect.appendChild(option);
    });
}

function applyFilters() {
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;
    const municipality = document.getElementById('filterMunicipality').value;
    const zone = document.getElementById('filterZone').value;
    
    filteredSurveys = allSurveys.filter(survey => {
        const surveyDate = new Date(survey.metadata?.createdAt || survey.timestamp);
        
        if (dateStart && surveyDate < new Date(dateStart)) return false;
        if (dateEnd && surveyDate > new Date(dateEnd + 'T23:59:59')) return false;
        if (municipality && survey.municipality !== municipality) return false;
        if (zone && survey.zone !== zone) return false;
        
        return true;
    });
    
    updateStats();
    renderCharts();
    renderDetailedTable();
}

function clearFilters() {
    document.getElementById('filterDateStart').value = '';
    document.getElementById('filterDateEnd').value = '';
    document.getElementById('filterMunicipality').value = '';
    document.getElementById('filterZone').value = '';
    
    filteredSurveys = allSurveys;
    updateStats();
    renderCharts();
    renderDetailedTable();
}

function renderCharts() {
    renderMunicipalityChart();
    renderZoneChart();
    renderEstablishmentChart();
    renderProductsChart();
    renderTimelineChart();
    renderEncuestadorChart();
}

function renderMunicipalityChart() {
    const ctx = document.getElementById('municipalityChart');
    
    // Contar encuestas por municipio
    const counts = {};
    filteredSurveys.forEach(s => {
        const mun = s.municipality || 'Sin especificar';
        counts[mun] = (counts[mun] || 0) + 1;
    });
    
    const data = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    if (charts.municipality) charts.municipality.destroy();
    
    charts.municipality = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Encuestas',
                data: data.map(d => d[1]),
                backgroundColor: '#4CAF50',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderZoneChart() {
    const ctx = document.getElementById('zoneChart');
    
    const counts = {};
    filteredSurveys.forEach(s => {
        const zone = s.zone || 'Sin especificar';
        counts[zone] = (counts[zone] || 0) + 1;
    });
    
    const data = Object.entries(counts);
    
    if (charts.zone) charts.zone.destroy();
    
    charts.zone = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                data: data.map(d => d[1]),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function renderEstablishmentChart() {
    const ctx = document.getElementById('establishmentChart');
    
    const counts = {};
    filteredSurveys.forEach(s => {
        const type = s.establishmentType || 'Sin especificar';
        counts[type] = (counts[type] || 0) + 1;
    });
    
    const data = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    if (charts.establishment) charts.establishment.destroy();
    
    charts.establishment = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                data: data.map(d => d[1]),
                backgroundColor: ['#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#F44336', '#00BCD4']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function renderProductsChart() {
    const ctx = document.getElementById('productsChart');
    
    const counts = {};
    filteredSurveys.forEach(s => {
        s.products?.forEach(p => {
            const name = p.name || 'Sin nombre';
            counts[name] = (counts[name] || 0) + 1;
        });
    });
    
    const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    if (charts.products) charts.products.destroy();
    
    charts.products = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Registros',
                data: data.map(d => d[1]),
                backgroundColor: '#FF9800',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderTimelineChart() {
    const ctx = document.getElementById('timelineChart');
    
    const counts = {};
    filteredSurveys.forEach(s => {
        const date = new Date(s.metadata?.createdAt || s.timestamp);
        const dateStr = date.toLocaleDateString('es-MX');
        counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    
    const data = Object.entries(counts).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    if (charts.timeline) charts.timeline.destroy();
    
    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Encuestas',
                data: data.map(d => d[1]),
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function renderEncuestadorChart() {
    const ctx = document.getElementById('encuestadorChart');
    
    const counts = {};
    filteredSurveys.forEach(s => {
        const email = s.metadata?.createdByEmail || 'Desconocido';
        counts[email] = (counts[email] || 0) + 1;
    });
    
    const data = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    if (charts.encuestador) charts.encuestador.destroy();
    
    charts.encuestador = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Encuestas',
                data: data.map(d => d[1]),
                backgroundColor: '#9C27B0',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderDetailedTable() {
    const tbody = document.getElementById('detailedTableBody');
    tbody.innerHTML = '';
    
    if (filteredSurveys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos para mostrar</td></tr>';
        return;
    }
    
    filteredSurveys.forEach(survey => {
        const date = new Date(survey.metadata?.createdAt || survey.timestamp);
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${date.toLocaleDateString('es-MX')} ${date.toLocaleTimeString('es-MX')}</td>
            <td>${survey.establishmentName || 'N/A'}</td>
            <td>${survey.establishmentType || 'N/A'}</td>
            <td>${survey.municipality || 'N/A'}</td>
            <td>${survey.zone || 'N/A'}</td>
            <td>${survey.products?.length || 0}</td>
            <td><small>${survey.metadata?.createdByEmail || 'N/A'}</small></td>
        `;
        
        tbody.appendChild(row);
    });
}

function exportChart(chartId) {
    const canvas = document.getElementById(chartId);
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `grafica-${chartId}-${Date.now()}.png`;
    link.href = url;
    link.click();
}

function exportDetailedData() {
    const data = filteredSurveys.map(survey => {
        const date = new Date(survey.metadata?.createdAt || survey.timestamp);
        return {
            'Fecha': date.toLocaleDateString('es-MX'),
            'Hora': date.toLocaleTimeString('es-MX'),
            'Establecimiento': survey.establishmentName || 'N/A',
            'Tipo': survey.establishmentType || 'N/A',
            'Municipio': survey.municipality || 'N/A',
            'Zona': survey.zone || 'N/A',
            'Productos': survey.products?.length || 0,
            'Encuestador': survey.metadata?.createdByEmail || 'N/A'
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Encuestas');
    XLSX.writeFile(wb, `encuestas-detalladas-${Date.now()}.xlsx`);
}

function logout() {
    window.authManager.logout();
    window.location.href = 'index.html';
}
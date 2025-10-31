// js/listae.js
let allSurveys = [];
let filteredSurveys = [];
let currentSurvey = null;

document.addEventListener('DOMContentLoaded', async () => {
    window.firebaseApp.init();

    // Verificar autenticación
    window.authManager.onAuthStateChanged((user, role) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        document.getElementById('userEmail').textContent = user.email;
        
        // Aplicar permisos de UI
        window.permissionsManager.checkRouteAccess();
        window.permissionsManager.applyUIPermissions();
        
        // Ocultar/mostrar enlaces de navegación según permisos
        if (!window.permissionsManager.can('create', 'surveys')) {
            document.querySelectorAll('[data-permission="create-survey"]').forEach(el => {
                el.style.display = 'none';
            });
        }
        
        if (!window.permissionsManager.can('view', 'analytics')) {
            document.querySelectorAll('[data-permission="view-analytics"]').forEach(el => {
                el.style.display = 'none';
            });
        }
    });

    await loadSurveys();
});

async function loadSurveys() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('tableContainer').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');

    const result = await window.surveyManager.getSurveys();
    
    if (result.success) {
        allSurveys = result.surveys;
        filteredSurveys = allSurveys;
        renderSurveys();
    } else {
        alert('Error cargando encuestas: ' + result.error);
    }

    document.getElementById('loading').classList.add('hidden');
}

function renderSurveys() {
    const tbody = document.getElementById('surveysTableBody');
    tbody.innerHTML = '';

    if (filteredSurveys.length === 0) {
        document.getElementById('tableContainer').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }

    document.getElementById('tableContainer').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');

    filteredSurveys.forEach(survey => {
        const date = survey.metadata?.createdAt?.toDate?.() || new Date();
        const location = survey.metadata?.location;
        const gpsText = location ? 
            `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 
            'No disponible';
        
        const row = document.createElement('tr');
        row.className = 'survey-row';
        row.onclick = () => showSurveyDetail(survey);
        
        row.innerHTML = `
            <td>
                <div class="thumbnail" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
                    📋
                </div>
            </td>
            <td>
                <strong>${date.toLocaleDateString('es-MX')}</strong><br>
                <small>${date.toLocaleTimeString('es-MX')}</small>
            </td>
            <td><strong>${survey.establishmentName || 'N/A'}</strong></td>
            <td>${survey.establishmentType || 'N/A'}</td>
            <td>${survey.municipality || 'N/A'}</td>
            <td><span class="status-badge status-active">${survey.zone || 'N/A'}</span></td>
            <td>
                <small>${gpsText}</small>
                ${location ? `<br><a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" target="_blank" style="font-size: 12px;">🗺️ Ver mapa</a>` : ''}
            </td>
            <td><small>${survey.metadata?.createdByEmail || 'N/A'}</small></td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); showSurveyDetail(allSurveys.find(s => s.id === '${survey.id}'))">Ver</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function applyFilters() {
    const zone = document.getElementById('filterZone').value;
    const municipality = document.getElementById('filterMunicipality').value;
    const type = document.getElementById('filterType').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    filteredSurveys = allSurveys.filter(survey => {
        if (zone && survey.zone !== zone) return false;
        if (municipality && survey.municipality !== municipality) return false;
        if (type && survey.establishmentType !== type) return false;
        if (search && !survey.establishmentName?.toLowerCase().includes(search)) return false;
        return true;
    });

    renderSurveys();
}

function showSurveyDetail(survey) {
    currentSurvey = survey;
    const modal = document.getElementById('surveyModal');
    const detail = document.getElementById('surveyDetail');
    
    const date = survey.metadata?.createdAt?.toDate?.() || new Date();
    const location = survey.metadata?.location;
    
    let html = `
        <div class="metadata-box">
            <strong>📅 Fecha:</strong> ${date.toLocaleDateString('es-MX')} ${date.toLocaleTimeString('es-MX')}<br>
            <strong>👤 Encuestador:</strong> ${survey.metadata?.createdByEmail || 'N/A'}<br>
            <strong>📍 GPS:</strong> ${location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (±${location.accuracy}m)` : 'No disponible'}<br>
            <strong>📱 Dispositivo:</strong> ${survey.metadata?.deviceInfo?.platform || 'N/A'}
        </div>

        <h3>Información del Establecimiento</h3>
        <div class="product-item">
            <strong>Nombre:</strong> ${survey.establishmentName}<br>
            <strong>Tipo:</strong> ${survey.establishmentType}<br>
            <strong>Municipio:</strong> ${survey.municipality}<br>
            <strong>Zona:</strong> ${survey.zone}
        </div>

        <h3 class="mt-20">Productos Relevados</h3>
    `;

    // Productos
    if (survey.products) {
        Object.entries(survey.products).forEach(([key, product]) => {
            if (product.available === 'si') {
                html += `
                    <div class="product-item">
                        <strong>${product.name}</strong><br>
                        💰 Precio: $${product.price || 'N/A'}<br>
                        🏷️ Marca: ${product.brand || 'No especificada'}
                    </div>
                `;
            }
        });
    }

    // Observaciones
    if (survey.observations) {
        html += `
            <h3 class="mt-20">Observaciones</h3>
            <div class="product-item">${survey.observations}</div>
        `;
    }

    // Fotos (si las hay)
    if (survey.photos && survey.photos.length > 0) {
        html += `<h3 class="mt-20">Evidencia Fotográfica</h3><div class="photo-gallery">`;
        survey.photos.forEach(photo => {
            html += `<img src="${photo}" alt="Foto" onclick="window.open('${photo}', '_blank')">`;
        });
        html += `</div>`;
    }

    detail.innerHTML = html;
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('surveyModal').classList.remove('active');
}

function downloadPDF() {
    if (!currentSurvey) return;

    const element = document.getElementById('surveyDetail');
    const opt = {
        margin: 10,
        filename: `encuesta_${currentSurvey.establishmentName}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

function exportAllToCSV() {
    window.analyticsManager.exportToCSV(filteredSurveys);
}

function logout() {
    window.authManager.logout();
    window.location.href = 'index.html';
}

// Cerrar modal al hacer click fuera
window.onclick = (event) => {
    const modal = document.getElementById('surveyModal');
    if (event.target === modal) {
        closeModal();
    }
};

// Agrega esto al final de js/listae.js, reemplazando la sección de productos:

// En la función showSurveyDetail, reemplaza la parte de productos con esto:
// Productos
if (survey.products) {
    Object.entries(survey.products).forEach(([key, product]) => {
        if (product.available === 'si') {
            let trendText = '';
            if (product.trend) {
                const trendLabels = {
                    'estable': '📊 Precio estable',
                    'aumento_1mes': '📈 Aumentó hace 1 mes',
                    'aumento_3meses': '📈 Aumentó hace 3 meses',
                    'aumento_6meses': '📈 Aumentó hace 6 meses',
                    'aumento_12meses': '📈 Aumentó hace 12 meses',
                    'disminucion_1mes': '📉 Disminuyó hace 1 mes',
                    'disminucion_3meses': '📉 Disminuyó hace 3 meses',
                    'disminucion_6meses': '📉 Disminuyó hace 6 meses',
                    'disminucion_12meses': '📉 Disminuyó hace 12 meses'
                };
                trendText = `<br>${trendLabels[product.trend] || product.trend}`;
                if (product.previousPrice) {
                    trendText += ` (Precio anterior: $${product.previousPrice})`;
                }
            }
            
            html += `
                <div class="product-item">
                    <strong>${product.name}</strong><br>
                    💰 Precio: $${product.price || 'N/A'}<br>
                    🏷️ Marca: ${product.brand || 'No especificada'}${trendText}
                </div>
            `;
        }
    });
}
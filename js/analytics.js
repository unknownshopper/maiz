// js/analytics.js
// Análisis y generación de gráficas
class AnalyticsManager {
    constructor() {
        this.charts = {};
    }

    // Obtener estadísticas generales
    async getGeneralStats() {
        try {
            const result = await window.surveyManager.getSurveys();
            if (!result.success) {
                throw new Error(result.error);
            }

            const surveys = result.surveys;

            return {
                totalSurveys: surveys.length,
                byZone: this.groupBy(surveys, 'zone'),
                byMunicipality: this.groupBy(surveys, 'municipality'),
                byEstablishmentType: this.groupBy(surveys, 'establishmentType'),
                recentSurveys: surveys.slice(0, 10)
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return null;
        }
    }

    // Agrupar datos
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const value = item[key] || 'Sin especificar';
            result[value] = (result[value] || 0) + 1;
            return result;
        }, {});
    }

    // Calcular estadísticas de precios
    calculatePriceStats(surveys, product) {
        const prices = surveys
            .filter(s => s.products && s.products[product])
            .map(s => parseFloat(s.products[product].price))
            .filter(p => !isNaN(p));

        if (prices.length === 0) {
            return null;
        }

        prices.sort((a, b) => a - b);

        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg: prices.reduce((a, b) => a + b, 0) / prices.length,
            median: prices[Math.floor(prices.length / 2)],
            count: prices.length
        };
    }

    // Crear gráfica de barras
    createBarChart(canvasId, labels, data, title) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: 'rgba(44, 95, 45, 0.7)',
                    borderColor: 'rgba(44, 95, 45, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: title
                    }
                }
            }
        });
    }

    // Crear gráfica de líneas
    createLineChart(canvasId, labels, data, title) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    borderColor: 'rgba(44, 95, 45, 1)',
                    backgroundColor: 'rgba(44, 95, 45, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: title
                    }
                }
            }
        });
    }

    // Crear gráfica de pastel
    createPieChart(canvasId, labels, data, title) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        'rgba(44, 95, 45, 0.8)',
                        'rgba(74, 124, 78, 0.8)',
                        'rgba(104, 154, 108, 0.8)',
                        'rgba(134, 184, 138, 0.8)',
                        'rgba(164, 214, 168, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: title
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Exportar datos a CSV
    exportToCSV(surveys) {
        const headers = ['ID', 'Fecha', 'Municipio', 'Zona', 'Establecimiento', 'Tipo', 'Encuestador'];
        const rows = surveys.map(s => [
            s.id,
            s.metadata?.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A',
            s.municipality || '',
            s.zone || '',
            s.establishmentName || '',
            s.establishmentType || '',
            s.metadata?.createdByEmail || ''
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `encuestas_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
}

// Instancia global
window.analyticsManager = new AnalyticsManager();
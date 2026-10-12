/* Charts module — Hydra — Gráficos con Chart.js */
const ChartModule = {
    precipChart: null,
    riverChart: null,
    historicalChart: null,
    _lastPrecipKey: null,
    _lastRiverKey: null,
    _lastHistKey: null,

    resetCache() {
        this._lastPrecipKey = null;
        this._lastRiverKey = null;
        this._lastHistKey = null;
    },

    chartDefaults() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20,28,46,0.95)',
                    titleColor: '#e2e8f0',
                    bodyColor: '#8b9dc3',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 10
                }
            },
            scales: {
                x: {
                    ticks: { color: '#5a6f8f', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.03)' }
                },
                y: {
                    ticks: { color: '#5a6f8f', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.03)' }
                }
            }
        };
    },

    createPrecipChart(dailyData) {
        const ctx = document.getElementById('precipChart');
        if (!ctx || !dailyData || !dailyData.length) return;

        // Comprobación de cambios para evitar re-renderizados innecesarios o parpadeos
        const dataKey = JSON.stringify(dailyData);
        if (this._lastPrecipKey === dataKey && this.precipChart) {
            return;
        }
        this._lastPrecipKey = dataKey;

        const labels = dailyData.map(d => {
            const dt = new Date(d.date);
            return dt.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
        });
        const precip = dailyData.map(d => d.precipitation_sum || 0);
        const prob = dailyData.map(d => d.precipitation_probability_max || 0);
        const bgColors = precip.map(v =>
            v > 50 ? 'rgba(239,68,68,0.65)' :
            v > 20 ? 'rgba(249,115,22,0.6)' :
            v > 5 ? 'rgba(14,165,233,0.55)' : 'rgba(14,165,233,0.2)'
        );

        // Si el gráfico ya existe, actualizar los datos suavemente sin destruirlo
        if (this.precipChart && this.precipChart.data.datasets.length === 2) {
            this.precipChart.data.labels = labels;
            this.precipChart.data.datasets[0].data = precip;
            this.precipChart.data.datasets[0].backgroundColor = bgColors;
            this.precipChart.data.datasets[1].data = prob;
            this.precipChart.update();
            return;
        }

        if (this.precipChart) this.precipChart.destroy();

        this.precipChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Precipitación (mm)',
                    data: precip,
                    backgroundColor: bgColors,
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.6
                }, {
                    label: 'Probabilidad (%)',
                    data: prob,
                    type: 'line',
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6,182,212,0.08)',
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#06b6d4',
                    yAxisID: 'y1',
                    fill: true
                }]
            },
            options: {
                ...this.chartDefaults(),
                plugins: {
                    ...this.chartDefaults().plugins,
                    legend: {
                        display: true,
                        labels: { color: '#8b9dc3', usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11 } }
                    }
                },
                scales: {
                    ...this.chartDefaults().scales,
                    y: { ...this.chartDefaults().scales.y, title: { display: true, text: 'mm', color: '#5a6f8f' } },
                    y1: { position: 'right', min: 0, max: 100, ticks: { color: '#5a6f8f', font: { size: 11 } }, grid: { display: false }, title: { display: true, text: '%', color: '#5a6f8f' } }
                }
            }
        });
    },

    createRiverChart(floodData) {
        const ctx = document.getElementById('riverChart');
        if (!ctx) return;

        // Comprobación de cambios para evitar re-renderizados innecesarios
        const dataKey = JSON.stringify(floodData || []);
        if (this._lastRiverKey === dataKey && this.riverChart) {
            return;
        }
        this._lastRiverKey = dataKey;

        if (!floodData || !floodData.length) {
            if (this.riverChart) this.riverChart.destroy();
            this.riverChart = new Chart(ctx, {
                type: 'line', data: { labels: ['Sin datos'], datasets: [{ data: [0] }] },
                options: { ...this.chartDefaults(), plugins: { ...this.chartDefaults().plugins, title: { display: true, text: 'Sin datos de descarga disponibles', color: '#5a6f8f' } } }
            });
            return;
        }

        const labels = floodData.map(d => {
            const dt = new Date(d.date);
            return dt.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        });
        const riverData = floodData.map(d => d.river_discharge);
        const meanData = floodData.map(d => d.river_discharge_mean);
        const maxData = floodData.map(d => d.river_discharge_max);

        // Si el gráfico ya existe con la estructura correcta, actualizar datos suavemente
        if (this.riverChart && this.riverChart.data.datasets.length === 3) {
            this.riverChart.data.labels = labels;
            this.riverChart.data.datasets[0].data = riverData;
            this.riverChart.data.datasets[1].data = meanData;
            this.riverChart.data.datasets[2].data = maxData;
            this.riverChart.update();
            return;
        }

        if (this.riverChart) this.riverChart.destroy();

        this.riverChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Descarga (m³/s)',
                    data: riverData,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14,165,233,0.08)',
                    tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#0ea5e9'
                }, {
                    label: 'Media',
                    data: meanData,
                    borderColor: '#eab308',
                    borderDash: [5, 5],
                    tension: 0.4, pointRadius: 0, borderWidth: 1.5
                }, {
                    label: 'Máximo',
                    data: maxData,
                    borderColor: 'rgba(239,68,68,0.4)',
                    borderDash: [3, 3],
                    tension: 0.4, pointRadius: 0, borderWidth: 1
                }]
            },
            options: {
                ...this.chartDefaults(),
                plugins: {
                    ...this.chartDefaults().plugins,
                    legend: {
                        display: true,
                        labels: { color: '#8b9dc3', usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11 } }
                    }
                },
                scales: {
                    ...this.chartDefaults().scales,
                    y: { ...this.chartDefaults().scales.y, title: { display: true, text: 'm³/s', color: '#5a6f8f' } }
                }
            }
        });
    },

    createHistoricalChart(data) {
        const ctx = document.getElementById('historicalChart');
        if (!ctx) return;
        if (!data || !data.length) return;

        const dataKey = JSON.stringify(data);
        if (this._lastHistKey === dataKey && this.historicalChart) {
            return;
        }
        this._lastHistKey = dataKey;

        const labels = data.map(d => {
            const dt = new Date(d.date);
            return dt.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        });
        const precip = data.map(d => d.precipitation_sum || 0);
        const bgColors = data.map(d => {
            const v = d.precipitation_sum || 0;
            return v > 50 ? 'rgba(239,68,68,0.6)' : v > 20 ? 'rgba(249,115,22,0.55)' : v > 5 ? 'rgba(14,165,233,0.45)' : 'rgba(14,165,233,0.15)';
        });

        if (this.historicalChart && this.historicalChart.data.datasets.length === 1) {
            this.historicalChart.data.labels = labels;
            this.historicalChart.data.datasets[0].data = precip;
            this.historicalChart.data.datasets[0].backgroundColor = bgColors;
            this.historicalChart.update();
            return;
        }

        if (this.historicalChart) this.historicalChart.destroy();

        this.historicalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Precipitación (mm)',
                    data: precip,
                    backgroundColor: bgColors,
                    borderRadius: 3, borderSkipped: false
                }]
            },
            options: {
                ...this.chartDefaults(),
                plugins: {
                    ...this.chartDefaults().plugins,
                    legend: {
                        display: true,
                        labels: { color: '#8b9dc3', usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11 } }
                    }
                }
            }
        });
    }
};

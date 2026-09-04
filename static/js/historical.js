/* Historical module - Datos históricos y descargas */
const HistoricalModule = {
    data: [],
    currentPage: 1,
    pageSize: 20,

    init() {
        // Set default dates (last 30 days)
        const end = new Date(); end.setDate(end.getDate() - 1);
        const start = new Date(); start.setDate(start.getDate() - 31);
        const startEl = document.getElementById('histStart');
        const endEl = document.getElementById('histEnd');
        if (startEl) startEl.value = start.toISOString().split('T')[0];
        if (endEl) endEl.value = end.toISOString().split('T')[0];

        document.getElementById('btnLoadHistorical')?.addEventListener('click', () => this.loadData());
        document.getElementById('btnDownloadCSV')?.addEventListener('click', () => this.download('csv'));
        document.getElementById('btnDownloadJSON')?.addEventListener('click', () => this.download('json'));
    },

    async loadData() {
        const deptId = document.getElementById('histDept')?.value || 'capital';
        const start = document.getElementById('histStart')?.value;
        const end = document.getElementById('histEnd')?.value;
        if (!start || !end) { App.showToast('Seleccione fechas', 'warning'); return; }
        if (new Date(start) > new Date(end)) { App.showToast('Fecha inicio debe ser anterior a fin', 'warning'); return; }

        App.showLoading(true);
        try {
            const resp = await fetch(`/api/historical/${deptId}?start=${start}&end=${end}`);
            const result = await resp.json();
            if (result.success) {
                this.data = result.data;
                this.renderStats(result.statistics);
                ChartModule.createHistoricalChart(result.data);
                this.currentPage = 1;
                this.renderTable();
                document.getElementById('histChartPeriod').textContent = `${start} a ${end}`;
                document.getElementById('historicalStats').style.display = 'grid';
                document.getElementById('dataTableCard').style.display = 'block';
                App.showToast(`${result.data.length} registros cargados`, 'success');
            } else {
                App.showToast('Error: ' + result.error, 'error');
            }
        } catch (e) { App.showToast('Error al cargar datos', 'error'); }
        App.showLoading(false);
    },

    renderStats(stats) {
        const p = stats?.precipitation || {};
        document.getElementById('histTotalPrecip').textContent = (p.total || 0) + ' mm';
        document.getElementById('histMaxPrecip').textContent = (p.max_daily || 0) + ' mm';
        document.getElementById('histMeanPrecip').textContent = (p.mean_daily || 0) + ' mm';
        document.getElementById('histRainyDays').textContent = p.rainy_days || 0;
        document.getElementById('histHeavyDays').textContent = p.heavy_rain_days || 0;
    },

    renderTable() {
        const tbody = document.getElementById('historicalTableBody');
        if (!tbody) return;
        const start = (this.currentPage - 1) * this.pageSize;
        const page = this.data.slice(start, start + this.pageSize);

        tbody.innerHTML = page.map(d => `
            <tr>
                <td>${d.date}</td>
                <td>${d.precipitation_sum ?? '-'}</td>
                <td>${d.rain_sum ?? '-'}</td>
                <td>${d.temperature_2m_max ?? '-'}</td>
                <td>${d.temperature_2m_min ?? '-'}</td>
                <td>${d.wind_speed_10m_max ?? '-'}</td>
            </tr>
        `).join('');

        document.getElementById('tableRecordCount').textContent = `${this.data.length} registros`;
        this.renderPagination();
    },

    renderPagination() {
        const container = document.getElementById('tablePagination');
        if (!container) return;
        const totalPages = Math.ceil(this.data.length / this.pageSize);
        if (totalPages <= 1) { container.innerHTML = ''; return; }

        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="HistoricalModule.goToPage(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    },

    goToPage(page) {
        this.currentPage = page;
        this.renderTable();
    },

    download(format) {
        const deptId = document.getElementById('histDept')?.value || 'capital';
        const start = document.getElementById('histStart')?.value;
        const end = document.getElementById('histEnd')?.value;
        if (!start || !end) { App.showToast('Primero consulte datos', 'warning'); return; }
        const url = `/api/historical/download/${deptId}?format=${format}&start=${start}&end=${end}`;
        window.open(url, '_blank');
        App.showToast(`Descargando ${format.toUpperCase()}...`, 'success');
    }
};

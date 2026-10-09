/* App — Hydra — Controlador principal */
const App = {
    currentSection: 'dashboard',
    currentDept: 'capital',
    departments: [],
    refreshInterval: null,

    async init() {
        await this.loadDepartments();
        this.setupNavigation();
        this.setupSidebar();
        this.setupLocation();
        AlertsModule.setupModal();
        HistoricalModule.init();
        MapModule.init();
        await this.loadDashboard();
        // Auto-refresh every 5 minutes
        this.refreshInterval = setInterval(() => this.refreshData(), 300000);
    },

    async loadDepartments() {
        try {
            const resp = await fetch('/api/departments');
            const data = await resp.json();
            if (data.success) {
                this.departments = data.departments;
                this.populateSelectors();
                MapModule.setDeptCoords(data.departments);
            }
        } catch (e) { console.error('Error loading departments:', e); }
    },

    populateSelectors() {
        const selects = ['deptSelect', 'alertDept', 'histDept'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = this.departments.map(d =>
                `<option value="${d.id}" ${d.id === 'capital' ? 'selected' : ''}>${d.name}</option>`
            ).join('');
        });
        document.getElementById('deptSelect')?.addEventListener('change', (e) => {
            this.selectDepartment(e.target.value);
        });
    },

    selectDepartment(deptId) {
        this.currentDept = deptId;
        document.getElementById('deptSelect').value = deptId;
        const dept = this.departments.find(d => d.id === deptId);
        document.getElementById('dashboardSubtitle').textContent =
            `Resumen general — ${dept ? dept.name : deptId}`;
        this.loadDashboard();
        MapModule.focusDepartment(deptId);
    },

    async loadDashboard() {
        const dept = this.currentDept;
        // Load weather, flood, and alert data in parallel
        const [weatherResp, floodResp, alertResp] = await Promise.allSettled([
            fetch(`/api/weather/${dept}`).then(r => r.json()),
            fetch(`/api/flood/${dept}`).then(r => r.json()),
            fetch(`/api/alert/${dept}`).then(r => r.json())
        ]);

        const weather = weatherResp.status === 'fulfilled' ? weatherResp.value : null;
        const flood = floodResp.status === 'fulfilled' ? floodResp.value : null;
        const alert = alertResp.status === 'fulfilled' ? alertResp.value : null;

        // Current conditions
        const currentResp = await fetch(`/api/weather/current/${dept}`).then(r => r.json()).catch(() => null);
        if (currentResp?.success) {
            document.getElementById('statTemp').textContent = `${currentResp.temperature ?? '--'}°C`;
            document.getElementById('statHumidity').textContent = `${currentResp.humidity ?? '--'}%`;
            document.getElementById('statWind').textContent = `${currentResp.wind_speed ?? '--'} km/h`;
        }

        // Weather charts
        if (weather?.success && weather.daily) {
            ChartModule.createPrecipChart(weather.daily);
            const precip24 = weather.current_summary?.precipitation_next_24h ?? 0;
            document.getElementById('statPrecip').textContent = `${precip24} mm`;
        }

        // Flood chart
        if (flood?.success && flood.daily) {
            ChartModule.createRiverChart(flood.daily);
            const discharge = flood.analysis?.current_discharge ?? '--';
            document.getElementById('statRiver').textContent = `${discharge} m³/s`;
        }

        // Alert banner
        if (alert?.success) {
            const banner = document.getElementById('alertBanner');
            banner.setAttribute('data-level', alert.alert_level);
            document.getElementById('alertBannerIcon').textContent = alert.alert_icon;
            document.getElementById('alertBannerTitle').textContent = `${alert.alert_name} — ${alert.department_name}`;
            document.getElementById('alertBannerDesc').textContent = alert.alert_description;
            document.getElementById('alertBannerLevel').textContent = `Nivel ${alert.alert_level}`;
            document.getElementById('statElevation').textContent = `${alert.elevation} m`;

            // Recommendations
            const recList = document.getElementById('recommendationsList');
            if (recList && alert.recommendations) {
                recList.innerHTML = alert.recommendations.map(r => `<li>${r}</li>`).join('');
            }

            banner.onclick = () => {
                if (AlertsModule && AlertsModule.showDepartmentMapInfo) {
                    AlertsModule.showDepartmentMapInfo(dept);
                }
            };
        }

        // Update time
        document.getElementById('lastUpdate').textContent =
            `Última actualización: ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;

        // Load alerts for map — enrich with department data
        const allAlerts = await AlertsModule.loadAutoAlerts();
        await AlertsModule.loadManualAlerts();

        if (allAlerts.length) {
            // Enrich alerts with full department data for the map
            const enriched = allAlerts.map(a => {
                const deptInfo = this.departments.find(d => d.id === a.department_id);
                if (deptInfo) {
                    a.population = deptInfo.population;
                    a.area_km2 = deptInfo.area_km2;
                    a.basin = deptInfo.basin;
                    a.description = deptInfo.description;
                }
                return a;
            });
            MapModule.plotDepartments(enriched);
        }

        // Load capital risk zones
        try {
            const zones = await fetch('/api/capital/risk-zones').then(r => r.json());
            if (zones.success) MapModule.plotCapitalZones(zones.zones);
        } catch (e) {}
    },

    async refreshData() {
        await this.loadDashboard();
        this.showToast('Datos actualizados', 'success');
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.navigateTo(section);
            });
        });
        document.getElementById('btnRefresh')?.addEventListener('click', () => this.refreshData());
    },

    navigateTo(section) {
        this.currentSection = section;
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(`section-${section}`)?.classList.add('active');
        document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
        // Close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');

        if (section === 'map') {
            setTimeout(() => { if (MapModule.view) MapModule.view.resize(); }, 300);
        }
    },

    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => sidebar.classList.toggle('open'));
        document.getElementById('sidebarToggle')?.addEventListener('click', () => sidebar.classList.toggle('open'));
    },

    setupLocation() {
        const handler = () => this.getUserLocation();
        document.getElementById('btnLocation')?.addEventListener('click', handler);
        document.getElementById('mobileLocationBtn')?.addEventListener('click', handler);
    },

    async getUserLocation() {
        if (!navigator.geolocation) {
            this.showToast('Geolocalización no disponible', 'error');
            return;
        }
        this.showToast('Obteniendo ubicación...', 'warning');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                try {
                    const resp = await fetch(`/api/location/info?lat=${lat}&lon=${lon}`);
                    const data = await resp.json();
                    if (data.success) {
                        this.showToast(`Ubicación: ${data.department_name} — ${data.alert_name}`, 'success');
                        MapModule.showUserLocation(lat, lon);
                        this.navigateTo('map');
                        // Update dashboard with user's department
                        if (data.department_id) this.selectDepartment(data.department_id);
                    }
                } catch (e) { this.showToast('Error al obtener info de ubicación', 'error'); }
            },
            () => { this.showToast('Permiso de ubicación denegado', 'error'); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    showLoading(show) {
        const el = document.getElementById('loadingOverlay');
        if (el) el.style.display = show ? 'flex' : 'none';
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(30px)';
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

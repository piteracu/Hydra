/* Alerts module — Hydra — Gestión de alertas */
const AlertsModule = {
    autoAlerts: [],
    manualAlerts: [],

    async loadAutoAlerts() {
        try {
            const resp = await fetch('/api/alerts/all');
            const data = await resp.json();
            if (data.success) {
                this.autoAlerts = data.alerts;
                this.renderAutoAlerts();
                this.updateBadge();
                return data.alerts;
            }
        } catch (e) { console.error('Error loading alerts:', e); }
        return [];
    },

    async loadManualAlerts() {
        try {
            const resp = await fetch('/api/alerts/manual');
            const data = await resp.json();
            if (data.success) {
                this.manualAlerts = data.alerts;
                this.renderManualAlerts();
            }
        } catch (e) { console.error('Error loading manual alerts:', e); }
    },

    async createAlert(deptId, level, message, author) {
        try {
            const resp = await fetch('/api/alert/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department_id: deptId, level: parseInt(level), message, created_by: author })
            });
            const data = await resp.json();
            if (data.success) {
                App.showToast('Alerta creada exitosamente', 'success');
                await this.loadManualAlerts();
                return true;
            } else {
                App.showToast('Error: ' + data.error, 'error');
            }
        } catch (e) {
            App.showToast('Error al crear alerta', 'error');
        }
        return false;
    },

    async deactivateAlert(alertId) {
        try {
            const resp = await fetch(`/api/alert/deactivate/${alertId}`, { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                App.showToast('Alerta desactivada', 'success');
                await this.loadManualAlerts();
            }
        } catch (e) { App.showToast('Error al desactivar', 'error'); }
    },

    _formatPrecip(val) {
        if (val == null || val === 0) return '0 mm';
        return val + ' mm';
    },

    _formatTime(isoStr) {
        try {
            return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        } catch { return '--:--'; }
    },

    renderAutoAlerts() {
        const grid = document.getElementById('autoAlertsGrid');
        if (!grid) return;
        if (!this.autoAlerts.length) {
            grid.innerHTML = '<p class="empty-state">No hay datos de alertas</p>';
            return;
        }

        const sorted = [...this.autoAlerts].sort((a, b) => b.alert_level - a.alert_level);
        grid.innerHTML = sorted.map(a => {
            const rivers = (a.rivers || []).slice(0, 2).join(', ');
            const precip = this._formatPrecip(a.precipitation_24h);
            const time = this._formatTime(a.generated_at);
            const dept = App.departments?.find(d => d.id === a.department_id);
            const pop = dept?.population ? (dept.population / 1000).toFixed(0) + 'k hab.' : '';

            return `
            <div class="alert-card" data-level="${a.alert_level}" data-dept="${a.department_id}"
                 onclick="App.selectDepartment('${a.department_id}')">
                <div class="alert-card-header">
                    <h4>${a.alert_icon} ${a.department_name}</h4>
                    <span class="alert-card-badge" style="background:${a.alert_color}15;color:${a.alert_color}">${a.alert_name}</span>
                </div>
                <div class="alert-card-body">
                    <p>Precipitación 24h: <strong>${precip}</strong></p>
                    <p>Elevación: ${a.elevation}m · Riesgo: ${a.topographic_risk}/4${pop ? ' · ' + pop : ''}</p>
                </div>
                <div class="alert-card-footer">
                    <span>${rivers || 'Sin ríos registrados'}</span>
                    <span>${time}</span>
                </div>
            </div>
        `;
        }).join('');
    },

    renderManualAlerts() {
        const grid = document.getElementById('manualAlertsGrid');
        if (!grid) return;
        if (!this.manualAlerts.length) {
            grid.innerHTML = '<p class="empty-state">No hay alertas manuales activas</p>';
            return;
        }

        grid.innerHTML = this.manualAlerts.map(a => `
            <div class="alert-card" data-level="${a.alert_level}">
                <div class="alert-card-header">
                    <h4>${a.alert_icon} ${a.department_name}</h4>
                    <span class="alert-card-badge" style="background:${a.alert_color}15;color:${a.alert_color}">${a.alert_name}</span>
                </div>
                <div class="alert-card-body"><p>${a.message}</p></div>
                <div class="alert-card-footer">
                    <span>Por: ${a.created_by} — ${new Date(a.created_at).toLocaleString('es-AR')}</span>
                    <button class="btn btn-sm btn-danger" onclick="AlertsModule.deactivateAlert(${a.id})">Desactivar</button>
                </div>
            </div>
        `).join('');
    },

    updateBadge() {
        const badge = document.getElementById('alertBadge');
        const high = this.autoAlerts.filter(a => a.alert_level >= 3).length;
        if (badge) {
            if (high > 0) { badge.textContent = high; badge.style.display = 'inline'; }
            else { badge.style.display = 'none'; }
        }
    },

    setupModal() {
        const modal = document.getElementById('newAlertModal');
        const btnNew = document.getElementById('btnNewAlert');
        const btnClose = document.getElementById('closeAlertModal');
        const btnCancel = document.getElementById('cancelAlert');
        const form = document.getElementById('newAlertForm');

        btnNew?.addEventListener('click', () => { modal.style.display = 'flex'; });
        btnClose?.addEventListener('click', () => { modal.style.display = 'none'; });
        btnCancel?.addEventListener('click', () => { modal.style.display = 'none'; });
        modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const deptId = document.getElementById('alertDept').value;
            const level = document.getElementById('alertLevel').value;
            const message = document.getElementById('alertMessage').value;
            const author = document.getElementById('alertAuthor').value;
            const ok = await this.createAlert(deptId, level, message, author);
            if (ok) { modal.style.display = 'none'; form.reset(); }
        });
    }
};

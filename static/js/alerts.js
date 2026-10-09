/* ═══════════════════════════════════════════════════════════════════════════
   Hydra — Módulo de Alertas & Sirena de Emergencia Sonora (15s)
   Integración con Notificaciones, Web Audio API y Mapas ArcGIS (2D/3D)
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Sintetizador Web Audio API de Sirena de Emergencia (15s) ───────────────
const AudioSirenModule = {
    audioCtx: null,
    oscillator1: null,
    oscillator2: null,
    gainNode: null,
    isPlaying: false,
    timer: null,
    progressInterval: null,
    vibrateInterval: null,

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
            }
        }
    },

    unlockAudio() {
        this.init();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    playSiren(durationSeconds = 15, onCountdown, onComplete) {
        this.init();
        if (this.isPlaying) this.stopSiren();

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.isPlaying = true;
        let remainingSeconds = durationSeconds;

        if (onCountdown) onCountdown(remainingSeconds);

        // Disparar Vibración de Emergencia (Física en celulares, ignora modo silencio)
        if ("vibrate" in navigator) {
            try {
                navigator.vibrate([800, 200, 800, 200, 800, 200]);
                this.vibrateInterval = setInterval(() => {
                    if (this.isPlaying) {
                        navigator.vibrate([800, 200, 800, 200, 800, 200]);
                    }
                }, 3000);
            } catch (e) {}
        }

        // Crear osciladores sintéticos para tono de sirena dual penetrante (700Hz y 1100Hz)
        try {
            if (this.audioCtx) {
                const now = this.audioCtx.currentTime;

                this.gainNode = this.audioCtx.createGain();
                // Volumen máximo posible para penetrar entornos ruidosos o altavoz bajo
                this.gainNode.gain.setValueAtTime(0.85, now);
                this.gainNode.connect(this.audioCtx.destination);

                // Oscilador 1: Onda Diente de Sierra (Aguda / Penetrante)
                this.oscillator1 = this.audioCtx.createOscillator();
                this.oscillator1.type = 'sawtooth';
                this.oscillator1.frequency.setValueAtTime(700, now);

                // Oscilador 2: Onda Cuadrada (Armónico de alta frecuencia)
                this.oscillator2 = this.audioCtx.createOscillator();
                this.oscillator2.type = 'square';
                this.oscillator2.frequency.setValueAtTime(850, now);

                // Modulación de frecuencia de sirena (sweep de 700Hz a 1100Hz cada 0.4s)
                for (let i = 0; i < durationSeconds * 2.5; i++) {
                    const time = now + (i * 0.4);
                    const freq1 = i % 2 === 0 ? 1100 : 700;
                    const freq2 = i % 2 === 0 ? 1300 : 850;
                    this.oscillator1.frequency.exponentialRampToValueAtTime(freq1, time + 0.38);
                    this.oscillator2.frequency.exponentialRampToValueAtTime(freq2, time + 0.38);
                }

                this.oscillator1.connect(this.gainNode);
                this.oscillator2.connect(this.gainNode);

                this.oscillator1.start(now);
                this.oscillator2.start(now);
                this.oscillator1.stop(now + durationSeconds);
                this.oscillator2.stop(now + durationSeconds);
            }
        } catch (e) {
            console.warn("Web Audio API falló o no soportado:", e);
        }

        // Intervalo de progreso visual de 15 segundos
        const startTime = Date.now();
        const totalMs = durationSeconds * 1000;

        this.progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
            const pct = Math.max(0, 100 - (elapsed / totalMs * 100));

            const progressBar = document.getElementById('sirenProgressBar');
            const countdownText = document.getElementById('sirenCountdownText');

            if (progressBar) progressBar.style.width = `${pct}%`;
            if (countdownText) countdownText.textContent = `${remaining}s`;

            if (elapsed >= totalMs) {
                this.stopSiren();
                if (onComplete) onComplete();
            }
        }, 100);
    },

    stopSiren() {
        this.isPlaying = false;
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        if (this.vibrateInterval) {
            clearInterval(this.vibrateInterval);
            this.vibrateInterval = null;
        }
        if ("vibrate" in navigator) {
            try { navigator.vibrate(0); } catch(e) {}
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        try {
            if (this.oscillator1) {
                this.oscillator1.stop();
                this.oscillator1.disconnect();
                this.oscillator1 = null;
            }
            if (this.oscillator2) {
                this.oscillator2.stop();
                this.oscillator2.disconnect();
                this.oscillator2 = null;
            }
            if (this.gainNode) {
                this.gainNode.disconnect();
                this.gainNode = null;
            }
        } catch (e) {}

        const progressBar = document.getElementById('sirenProgressBar');
        const countdownText = document.getElementById('sirenCountdownText');
        if (progressBar) progressBar.style.width = '0%';
        if (countdownText) countdownText.textContent = '0s';
    }
};

// ─── Módulo de Alertas Hydra ────────────────────────────────────────────────
const AlertsModule = {
    autoAlerts: [],
    manualAlerts: [],
    lastSeenAlertId: 0,
    broadcasterInterval: null,
    isBroadcasterInitialized: false,

    async initRealtimeBroadcaster() {
        if (this.isBroadcasterInitialized) return;
        this.isBroadcasterInitialized = true;

        // Sync inicial: obtener el max_id actual para no disparar sirena por alertas pasadas al recargar
        try {
            const resp = await fetch('/api/alerts/latest?after_id=0');
            const data = await resp.json();
            if (data.success && data.max_id != null) {
                this.lastSeenAlertId = data.max_id;
            }
        } catch (e) {
            console.error('Error inicializando difusor en tiempo real:', e);
        }

        this.loadManualAlerts();

        // Polling ultrarrápido a 1.5s para recibir nuevas alertas broadcasted en TODOS los dispositivos (<3s)
        this.broadcasterInterval = setInterval(async () => {
            try {
                const resp = await fetch(`/api/alerts/latest?after_id=${this.lastSeenAlertId}`);
                const data = await resp.json();
                if (data.success && data.alerts && data.alerts.length > 0) {
                    this.lastSeenAlertId = data.max_id;

                    // 1. DISPARAR INMEDIATAMENTE ALERTA Y SIRENA EN TODOS LOS RECEPTORES (0 DELAY)
                    data.alerts.forEach(alert => {
                        this.triggerEmergencyAlert(alert);
                    });

                    // 2. Actualizar UI en segundo plano sin bloquear el disparo de la alarma
                    this.loadManualAlerts();
                    if (window.App && App.loadDashboard) App.loadDashboard();
                }
            } catch (e) {
                // Silencioso ante pérdidas temporales de conexión
            }
        }, 1500);
    },

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
                this.plotManualAlertsOnMaps(data.alerts);
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
                App.showToast('🚨 Alerta transmitida exitosamente a todos los dispositivos', 'success');
                if (data.alert && data.alert.id) {
                    this.lastSeenAlertId = data.alert.id;
                }

                // 1. Disparar Sirena Sonora y Alerta de Emergencia INMEDIATAMENTE en el dispositivo emisor
                this.triggerEmergencyAlert(data.alert);

                // 2. Actualizar UI en segundo plano
                this.loadManualAlerts();
                App.loadDashboard();
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
                await App.loadDashboard();
            }
        } catch (e) { App.showToast('Error al desactivar', 'error'); }
    },

    triggerEmergencyAlert(alert) {
        const levelColors = { 1: "#22c55e", 2: "#eab308", 3: "#f97316", 4: "#ef4444" };
        const color = levelColors[alert.alert_level] || "#ef4444";

        const modal = document.getElementById('emergencyAlertModal');
        if (modal) {
            modal.dataset.deptId = alert.department_id;
            modal.style.display = 'flex';
            document.getElementById('emergencyDeptName').textContent = alert.department_name;
            document.getElementById('emergencyIcon').textContent = alert.alert_icon || '🔴';

            const badge = document.getElementById('emergencyLevelBadge');
            if (badge) {
                badge.textContent = `Nivel ${alert.alert_level} — ${alert.alert_name}`;
                badge.style.background = `${color}25`;
                badge.style.color = color;
            }

            document.getElementById('emergencyMessage').textContent = alert.message;
            document.getElementById('emergencyAuthor').textContent = `Por: ${alert.created_by}`;
            document.getElementById('emergencyTime').textContent = new Date(alert.created_at || Date.now()).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

            // Disparar Sirena de Audio y Vibración por 15 segundos
            AudioSirenModule.playSiren(15);
        }

        // Solicitar/Lanzar Notificación del Sistema de Navegador
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                new Notification("🚨 ALERTA INUNDACIÓN — SALTA", {
                    body: `${alert.department_name} (Nivel ${alert.alert_level} ${alert.alert_name}): ${alert.message}`,
                    requireInteraction: true
                });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification("🚨 ALERTA INUNDACIÓN — SALTA", {
                            body: `${alert.department_name} (Nivel ${alert.alert_level} ${alert.alert_name}): ${alert.message}`
                        });
                    }
                });
            }
        }

        // Enfocar el departamento en los mapas 2D y 3D de ArcGIS
        if (MapModule && alert.department_id) {
            MapModule.focusDepartment(alert.department_id);
        }
    },

    async showDepartmentMapInfo(deptId) {
        if (!deptId) return;

        const modal = document.getElementById('deptMapInfoModal');
        if (!modal) return;

        const deptInfo = App.departments?.find(d => d.id === deptId) || { name: deptId, id: deptId };
        document.getElementById('deptModalName').textContent = deptInfo.name || deptId;
        document.getElementById('deptModalPop').textContent = deptInfo.population ? deptInfo.population.toLocaleString('es-AR') : 'N/A';
        document.getElementById('deptModalArea').textContent = deptInfo.area_km2 ? `${deptInfo.area_km2.toLocaleString('es-AR')} km²` : 'N/A';
        document.getElementById('deptModalElev').textContent = deptInfo.elevation ? `${deptInfo.elevation} m` : 'N/A';
        document.getElementById('deptModalBasin').textContent = deptInfo.basin || 'Cuenca Provincial';

        modal.dataset.deptId = deptId;
        modal.style.display = 'flex';

        // Enfocar departamento en el mapa en segundo plano
        if (MapModule && MapModule.focusDepartment) {
            MapModule.focusDepartment(deptId);
        }

        try {
            const [cartoResp, alertResp] = await Promise.all([
                fetch(`/api/cartography/${deptId}`).then(r => r.json()).catch(() => null),
                fetch(`/api/alert/${deptId}`).then(r => r.json()).catch(() => null)
            ]);

            if (cartoResp && cartoResp.success) {
                const carto = cartoResp.cartography || {};
                const telemetry = cartoResp.realtime_telemetry || {};

                document.getElementById('deptModalIcon').textContent = telemetry.alert_icon || '🟢';
                const badge = document.getElementById('deptModalAlertLevelBadge');
                if (badge) {
                    badge.textContent = `Nivel ${telemetry.alert_level || 1} — ${telemetry.alert_name || 'Normal'}`;
                    badge.style.background = `${telemetry.alert_color || '#22c55e'}25`;
                    badge.style.color = telemetry.alert_color || '#22c55e';
                }
                const riskScoreEl = document.getElementById('deptModalRiskScore');
                if (riskScoreEl) {
                    riskScoreEl.textContent = `Riesgo: ${telemetry.risk_score || 15}/100`;
                    riskScoreEl.style.color = telemetry.alert_color || '#22c55e';
                }

                const descEl = document.getElementById('deptModalAlertDesc');
                if (descEl) descEl.textContent = carto.description || deptInfo.description || 'Monitoreo provincial en tiempo real.';

                const precip24 = telemetry.precipitation_24h || 0;
                const precip48 = telemetry.precipitation_48h || 0;
                document.getElementById('deptModalPrecip').textContent = `${precip24} mm (24h) / ${precip48} mm (48h)`;

                const riversList = (deptInfo.rivers || cartoResp.rivers || []).join(', ');
                const ratio = telemetry.river_discharge_ratio || 1.0;
                document.getElementById('deptModalRivers').textContent = `${riversList || 'Cauce local'} (${ratio}x media)`;

                document.getElementById('deptModalSoil').textContent = `${telemetry.soil_saturation_pct || 20}%`;
                document.getElementById('deptModalSlope').textContent = carto.slope_type || 'Moderada';

                document.getElementById('deptModalSlopeDesc').textContent = carto.slope_description || '';
                document.getElementById('deptModalRiverProx').textContent = `${carto.river_proximity_km || 0} km (${carto.closest_river_system || 'Río cercano'})`;
                document.getElementById('deptModalVulnPct').textContent = `${carto.vulnerability_area_pct || 20}%`;

                const recsList = document.getElementById('deptModalRecsList');
                if (recsList && cartoResp.recommendations) {
                    recsList.innerHTML = cartoResp.recommendations.map(r => `<li>${r}</li>`).join('');
                }
            }
        } catch (e) {
            console.error("Error al cargar información cartográfica del departamento:", e);
        }
    },

    plotManualAlertsOnMaps(manualAlerts) {
        if (!MapModule || !MapModule.deptLayer) return;
        if (App.departments) {
            App.loadDashboard();
        }
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
                 onclick="AlertsModule.showDepartmentMapInfo('${a.department_id}')">
                <div class="alert-card-header">
                    <h4>${a.alert_icon} ${a.department_name}</h4>
                    <span class="alert-card-badge" style="background:${a.alert_color}15;color:${a.alert_color}">${a.alert_name}</span>
                </div>
                <div class="alert-card-body">
                    <p>Precipitación 24h: <strong>${precip}</strong></p>
                    <p>Elevación: ${a.elevation}m · Riesgo: ${a.topographic_risk}/4${pop ? ' · ' + pop : ''}</p>
                    <div style="margin-top:8px;">
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); AlertsModule.showDepartmentMapInfo('${a.department_id}')" style="padding:3px 8px; font-size:11px;">
                            🗺️ Ver Info y Mapa
                        </button>
                    </div>
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
            <div class="alert-card" data-level="${a.alert_level}" onclick="AlertsModule.showDepartmentMapInfo('${a.department_id}')">
                <div class="alert-card-header">
                    <h4>${a.alert_icon} ${a.department_name}</h4>
                    <span class="alert-card-badge" style="background:${a.alert_color}15;color:${a.alert_color}">${a.alert_name}</span>
                </div>
                <div class="alert-card-body">
                    <p style="margin-bottom:6px; font-weight:600; color:#fff;">${a.message}</p>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); AlertsModule.triggerEmergencyAlert(${JSON.stringify(a).replace(/"/g, '&quot;')})" style="padding:3px 8px; font-size:11px;">
                            🔊 Sirena (15s)
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); AlertsModule.showDepartmentMapInfo('${a.department_id}')" style="padding:3px 8px; font-size:11px;">
                            🗺️ Ver Info y Mapa
                        </button>
                    </div>
                </div>
                <div class="alert-card-footer">
                    <span>Por: ${a.created_by} — ${new Date(a.created_at).toLocaleString('es-AR')}</span>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); AlertsModule.deactivateAlert(${a.id})">Desactivar</button>
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

        // Modal de Nueva Alerta
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

        // Handlers del Modal de Emergencia y Sirena Sonora
        const emergencyModal = document.getElementById('emergencyAlertModal');
        const btnCloseEmergency = document.getElementById('closeEmergencyModal');
        const btnSilence = document.getElementById('btnSilenceSiren');
        const btnViewMap = document.getElementById('btnViewEmergencyMap');

        btnCloseEmergency?.addEventListener('click', () => {
            AudioSirenModule.stopSiren();
            if (emergencyModal) emergencyModal.style.display = 'none';
        });

        btnSilence?.addEventListener('click', () => {
            AudioSirenModule.stopSiren();
            btnSilence.textContent = "🔇 Sirena Silenciada";
        });

        btnViewEmergencyMap?.addEventListener('click', () => {
            AudioSirenModule.stopSiren();
            if (emergencyModal) emergencyModal.style.display = 'none';
            const deptId = emergencyModal.dataset.deptId;
            if (deptId) {
                this.showDepartmentMapInfo(deptId);
            } else {
                App.navigateTo('map');
            }
        });

        document.getElementById('emergencyCard')?.addEventListener('click', () => {
            AudioSirenModule.stopSiren();
            if (emergencyModal) emergencyModal.style.display = 'none';
            const deptId = emergencyModal.dataset.deptId;
            if (deptId) this.showDepartmentMapInfo(deptId);
        });

        // Modal de Información del Departamento y Mapas
        const deptModal = document.getElementById('deptMapInfoModal');
        const closeDeptModal = document.getElementById('closeDeptMapModal');
        const btnDeptViewProvincialMap = document.getElementById('btnDeptViewProvincialMap');
        const btnDeptViewUrbanMap = document.getElementById('btnDeptViewUrbanMap');

        closeDeptModal?.addEventListener('click', () => { if (deptModal) deptModal.style.display = 'none'; });
        deptModal?.addEventListener('click', (e) => { if (e.target === deptModal) deptModal.style.display = 'none'; });

        btnDeptViewProvincialMap?.addEventListener('click', () => {
            const deptId = deptModal?.dataset.deptId;
            if (deptModal) deptModal.style.display = 'none';
            App.navigateTo('map');
            if (MapModule.isUrbanMode) {
                MapModule.toggleUrbanMode(false);
            }
            if (deptId) {
                App.selectDepartment(deptId);
                MapModule.focusDepartment(deptId);
            }
        });

        btnDeptViewUrbanMap?.addEventListener('click', () => {
            const deptId = deptModal?.dataset.deptId;
            if (deptModal) deptModal.style.display = 'none';
            App.navigateTo('map');
            if (deptId) App.selectDepartment(deptId);
            MapModule.toggleUrbanMode(true);
            if (deptId) MapModule.switchUrbanDepartment(deptId);
        });

        // Pre-desbloqueo de AudioContext con interacción del usuario
        const unlockAudioEvents = ['click', 'touchstart', 'pointerdown', 'keydown'];
        const handleUnlock = () => {
            AudioSirenModule.unlockAudio();
            unlockAudioEvents.forEach(evt => document.removeEventListener(evt, handleUnlock));
        };
        unlockAudioEvents.forEach(evt => document.addEventListener(evt, handleUnlock));

        // Solicitar permisos de notificación de escritorio al interactuar
        document.addEventListener('click', () => {
            if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission();
            }
        }, { once: true });

        // Inicializar transmisión broadcast en tiempo real a todos los dispositivos (<3s)
        this.initRealtimeBroadcaster();
    }
};



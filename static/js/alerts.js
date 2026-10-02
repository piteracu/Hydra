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

        await this.loadManualAlerts();

        // Polling cada 2 segundos para recibir nuevas alertas broadcasted en TODOS los dispositivos
        this.broadcasterInterval = setInterval(async () => {
            try {
                const resp = await fetch(`/api/alerts/latest?after_id=${this.lastSeenAlertId}`);
                const data = await resp.json();
                if (data.success && data.alerts && data.alerts.length > 0) {
                    this.lastSeenAlertId = data.max_id;
                    await this.loadManualAlerts();
                    if (window.App && App.loadDashboard) App.loadDashboard();

                    // Disparar Alerta y Sirena sonora de 15s en TODOS los dispositivos receptores
                    data.alerts.forEach(alert => {
                        this.triggerEmergencyAlert(alert);
                    });
                }
            } catch (e) {
                // Silencioso ante pérdidas temporales de conexión
            }
        }, 2000);
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
                // Actualizar el ID para no volver a reproducir en la siguiente verificación del polling
                if (data.alert && data.alert.id) {
                    this.lastSeenAlertId = data.alert.id;
                }
                await this.loadManualAlerts();
                await App.loadDashboard();

                // Disparar Sirena Sonora de 15 segundos en el dispositivo emisor
                this.triggerEmergencyAlert(data.alert);
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
                <div class="alert-card-body">
                    <p style="margin-bottom:6px; font-weight:600; color:#fff;">${a.message}</p>
                    <button class="btn btn-sm btn-outline" onclick="AlertsModule.triggerEmergencyAlert(${JSON.stringify(a).replace(/"/g, '&quot;')})" style="padding:2px 6px; font-size:11px;">
                        🔊 Reproducir Sirena (15s)
                    </button>
                </div>
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
            App.navigateTo('map');
        });

        // Pre-desbloqueo de AudioContext con interacción del usuario (para sobrepasar bloqueo de modo silencio/autoplays)
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

        // Inicializar transmisión broadcast en tiempo real a todos los dispositivos
        this.initRealtimeBroadcaster();
    }
};


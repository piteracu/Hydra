/* ═══════════════════════════════════════════════════════════════════════════
   Hydra — Módulo de Mapa Interactivo ArcGIS JS SDK 4.29
   Monitoreo Multifactores de Inundabilidad
   ═══════════════════════════════════════════════════════════════════════════ */

const MapModule = {
    map: null,
    view: null,
    view2D: null,

    // Capas ArcGIS de Factores de Inundación
    deptLayer: null,
    precipLayer: null,
    riversLayer: null,
    soilLayer: null,
    basinsLayer: null,
    zonesLayer: null,
    inspectorLayer: null,

    // Capas ArcGIS de Factores de Inundación
    deptLayer: null,
    precipLayer: null,
    riversLayer: null,
    soilLayer: null,
    basinsLayer: null,
    zonesLayer: null,
    inspectorLayer: null,

    // Capas de Clima Urbano y Callejero (Escala Manzana/Calle)
    urbanHeatLayer: null,
    urbanRainLayer: null,
    urbanWindLayer: null,
    isUrbanMode: false,

    deptGraphics: {},
    _Graphic: null,
    _Polyline: null,
    _Polygon: null,
    _Circle: null,
    _Point: null,
    _deptCoords: {},
    _deptData: {},
    _ready: false,

    init() {
        require({
            has: { "esri-featurelayer-webgl": 1 }
        }, [
            "esri/Map",
            "esri/views/MapView",
            "esri/Graphic",
            "esri/layers/GraphicsLayer",
            "esri/widgets/Search",
            "esri/widgets/Locate",
            "esri/widgets/ScaleBar",
            "esri/widgets/Compass",
            "esri/geometry/Polyline",
            "esri/geometry/Polygon",
            "esri/geometry/Circle",
            "esri/geometry/Point"
        ], (
            Map, MapView, Graphic, GraphicsLayer,
            Search, Locate, ScaleBar, Compass,
            Polyline, Polygon, Circle, Point
        ) => {
            this._Graphic = Graphic;
            this._Polyline = Polyline;
            this._Polygon = Polygon;
            this._Circle = Circle;
            this._Point = Point;

            // Inicialización de Capas por Factor
            this.basinsLayer = new GraphicsLayer({ title: "Cuencas Hidrográficas", visible: true });
            this.soilLayer = new GraphicsLayer({ title: "Saturación del Suelo", visible: true });
            this.precipLayer = new GraphicsLayer({ title: "Precipitación 24h", visible: true });
            this.riversLayer = new GraphicsLayer({ title: "Caudales de Ríos", visible: true });
            this.zonesLayer = new GraphicsLayer({ title: "Zonas de Riesgo Capital", visible: true });
            this.deptLayer = new GraphicsLayer({ title: "Departamentos", visible: true });
            this.inspectorLayer = new GraphicsLayer({ title: "Punto Seleccionado", visible: true });

            // Capas de Clima Urbano sobre Callejero
            this.urbanHeatLayer = new GraphicsLayer({ title: "🔥 Malla de Calor Urbano", visible: false });
            this.urbanRainLayer = new GraphicsLayer({ title: "🌧️ Escurrimiento en Calles", visible: false });
            this.urbanWindLayer = new GraphicsLayer({ title: "💨 Corrientes de Viento en Calles", visible: false });

            // Creación del Mapa
            this.map = new Map({
                basemap: "dark-gray-vector",
                layers: [
                    this.basinsLayer,
                    this.soilLayer,
                    this.precipLayer,
                    this.riversLayer,
                    this.zonesLayer,
                    this.deptLayer,
                    this.urbanHeatLayer,
                    this.urbanRainLayer,
                    this.urbanWindLayer,
                    this.inspectorLayer
                ]
            });

            const initialCenter = [-65.0, -24.2];
            const initialZoom = 7;

            // Vista 2D (MapView en #mapView2D)
            this.view2D = new MapView({
                container: "mapView2D",
                map: this.map,
                center: initialCenter,
                zoom: initialZoom,
                ui: { components: ["zoom", "compass"] },
                popup: {
                    dockEnabled: true,
                    dockOptions: { buttonEnabled: false, breakpoint: false, position: "bottom-right" }
                }
            });

            this.view = this.view2D;

            // Widgets 2D
            const search2D = new Search({ view: this.view2D });
            this.view2D.ui.add(search2D, "top-right");

            const locate2D = new Locate({ view: this.view2D });
            this.view2D.ui.add(locate2D, "top-left");

            const scaleBar2D = new ScaleBar({ view: this.view2D, unit: "metric" });
            this.view2D.ui.add(scaleBar2D, "bottom-right");

            // Eventos de inspección por clic
            this._setupClickInspector(this.view2D);

            this.view2D.when(() => {
                console.log("ArcGIS 2D Map ready");
                this._ready = true;
                if (this._pendingAlerts) {
                    this.plotDepartments(this._pendingAlerts);
                    this._pendingAlerts = null;
                }
                if (this._pendingZones) {
                    this.plotCapitalZones(this._pendingZones);
                    this._pendingZones = null;
                }
                this.loadProvinceFactors();
                this.loadUrbanStreetClimateData();
            });

            // Handlers de los botones de Mapa Base
            document.getElementById('btnMapDark')?.addEventListener('click', () => this.setBasemap('dark-gray-vector', 'btnMapDark'));
            document.getElementById('btnMapTopo')?.addEventListener('click', () => this.setBasemap('topo-vector', 'btnMapTopo'));
            document.getElementById('btnMapSatellite')?.addEventListener('click', () => this.setBasemap('satellite', 'btnMapSatellite'));

            // Handlers de Selector de Modo de Mapa (Provincial / Clima Urbano Callejero)
            document.getElementById('btnMode2D')?.addEventListener('click', () => this.toggleUrbanMode(false));
            document.getElementById('btnModeUrban')?.addEventListener('click', () => this.toggleUrbanMode(true));

            // Handler para selector de departamento urbano
            document.getElementById('urbanDeptSelect')?.addEventListener('change', (e) => {
                if (e.target.value) this.switchUrbanDepartment(e.target.value);
            });

            // Handlers de chips de capas de factores
            this._setupFactorChips();

            // Handler para cerrar drawer de inspección
            document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
                document.getElementById('pointInspectorDrawer')?.classList.remove('open');
                this.inspectorLayer.removeAll();
            });
        });
    },

    toggleUrbanMode(enableUrban) {
        this.isUrbanMode = enableUrban;
        const btn2D = document.getElementById('btnMode2D');
        const btnUrban = document.getElementById('btnModeUrban');
        const selectorGroup = document.getElementById('urbanDeptSelectorGroup');

        if (enableUrban) {
            btn2D?.classList.remove('active');
            btnUrban?.classList.add('active');
            if (selectorGroup) selectorGroup.style.display = 'flex';

            // Cambiar a Mapa Base Vectorial de Calles de Alta Definición (Streets Navigation Vector)
            if (this.map) this.map.basemap = "streets-navigation-vector";

            // Obtener departamento urbano seleccionado o capital por defecto
            const selectEl = document.getElementById('urbanDeptSelect');
            const targetDept = selectEl?.value || App.currentDept || 'capital';
            this.switchUrbanDepartment(targetDept);

            // Activar capas de Clima Urbano
            if (this.urbanHeatLayer) this.urbanHeatLayer.visible = true;
            if (this.urbanRainLayer) this.urbanRainLayer.visible = true;
            if (this.urbanWindLayer) this.urbanWindLayer.visible = true;

            // Desactivar capas provinciales para limpiar el mapa urbano
            if (this.deptLayer) this.deptLayer.visible = false;
            if (this.basinsLayer) this.basinsLayer.visible = false;

            // Activar chips Urbanos en la barra
            document.getElementById('chipUrbanHeat')?.classList.add('active');
            document.getElementById('chipUrbanRain')?.classList.add('active');
            document.getElementById('chipUrbanWind')?.classList.add('active');
            document.getElementById('chipDepts')?.classList.remove('active');
        } else {
            btnUrban?.classList.remove('active');
            btn2D?.classList.add('active');
            if (selectorGroup) selectorGroup.style.display = 'none';

            // Restaurar Mapa Base Oscuro y Zoom Provincial
            if (this.map) this.map.basemap = "dark-gray-vector";
            if (this.view2D) {
                this.view2D.goTo({
                    center: [-65.0, -24.2],
                    zoom: 7
                }, { duration: 1000 });
            }

            // Ocultar capas urbanas y restaurar provinciales
            if (this.urbanHeatLayer) this.urbanHeatLayer.visible = false;
            if (this.urbanRainLayer) this.urbanRainLayer.visible = false;
            if (this.urbanWindLayer) this.urbanWindLayer.visible = false;

            if (this.deptLayer) this.deptLayer.visible = true;
            if (this.basinsLayer) this.basinsLayer.visible = true;

            document.getElementById('chipUrbanHeat')?.classList.remove('active');
            document.getElementById('chipUrbanRain')?.classList.remove('active');
            document.getElementById('chipUrbanWind')?.classList.remove('active');
            document.getElementById('chipDepts')?.classList.add('active');
        }
    },

    switchUrbanDepartment(deptId) {
        const dept = this._deptData[deptId] || { lat: -24.7821, lon: -65.4232, name: "Capital" };
        const lon = dept.lon;
        const lat = dept.lat;

        // Re-centrar mapa en el casco urbano del departamento a escala de calle (Zoom 15)
        if (this.view2D) {
            this.view2D.goTo({
                center: [lon, lat],
                zoom: 15
            }, { duration: 1000 });
        }

        // Cargar trazado microclimático urbano para ese departamento
        this.loadUrbanStreetClimateData(deptId);
    },

    setBasemap(basemap, activeBtnId) {
        if (this.map) this.map.basemap = basemap;
        document.querySelectorAll('.map-controls .btn').forEach(b => b.classList.remove('active'));
        document.getElementById(activeBtnId)?.classList.add('active');
    },

    _setupFactorChips() {
        const chips = document.querySelectorAll('.factor-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const layerKey = chip.getAttribute('data-layer');
                chip.classList.toggle('active');
                const isVisible = chip.classList.contains('active');

                switch (layerKey) {
                    case 'depts': if (this.deptLayer) this.deptLayer.visible = isVisible; break;
                    case 'precip': if (this.precipLayer) this.precipLayer.visible = isVisible; break;
                    case 'rivers': if (this.riversLayer) this.riversLayer.visible = isVisible; break;
                    case 'soil': if (this.soilLayer) this.soilLayer.visible = isVisible; break;
                    case 'basins': if (this.basinsLayer) this.basinsLayer.visible = isVisible; break;
                    case 'capital': if (this.zonesLayer) this.zonesLayer.visible = isVisible; break;
                    case 'urban-heat': if (this.urbanHeatLayer) this.urbanHeatLayer.visible = isVisible; break;
                    case 'urban-rain': if (this.urbanRainLayer) this.urbanRainLayer.visible = isVisible; break;
                    case 'urban-wind': if (this.urbanWindLayer) this.urbanWindLayer.visible = isVisible; break;
                }
            });
        });
    },

    _setupClickInspector(viewInstance) {
        viewInstance.on("click", (evt) => {
            const lat = evt.mapPoint.latitude;
            const lon = evt.mapPoint.longitude;
            this.inspectPoint(lat, lon);
        });
    },

    inspectPoint(lat, lon) {
        if (!this._Graphic || !this.inspectorLayer) return;

        this.inspectorLayer.removeAll();

        const pinMarker = new this._Graphic({
            geometry: { type: "point", longitude: lon, latitude: lat },
            symbol: {
                type: "simple-marker",
                style: "path",
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                color: [14, 165, 233, 0.95],
                size: 26,
                yoffset: 13,
                outline: { color: [255, 255, 255, 0.9], width: 1.5 }
            }
        });
        this.inspectorLayer.add(pinMarker);

        const drawer = document.getElementById('pointInspectorDrawer');
        if (drawer) {
            drawer.classList.add('open');
            document.getElementById('drawerLocationTitle').textContent = "Consultando datos...";
            document.getElementById('drawerLocationSub').textContent = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
            document.getElementById('drawerRiskScore').textContent = "...";
            document.getElementById('drawerRiskStatus').textContent = "Evaluando factores en tiempo real...";
        }

        fetch(`/api/location/factors?lat=${lat}&lon=${lon}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) return;
                this.updateInspectorDrawer(data);
            })
            .catch(err => {
                console.error("Error inspecting point factors:", err);
            });
    },

    updateInspectorDrawer(data) {
        const levelIcons = { 1: "🟢", 2: "🟡", 3: "🟠", 4: "🔴" };
        const levelColors = { 1: "#22c55e", 2: "#eab308", 3: "#f97316", 4: "#ef4444" };
        const color = levelColors[data.alert_level] || "#22c55e";

        document.getElementById('drawerLevelIcon').textContent = levelIcons[data.alert_level] || "🟢";
        document.getElementById('drawerLocationTitle').textContent = `${data.closest_department}`;
        document.getElementById('drawerLocationSub').textContent = `Lat: ${data.location.latitude.toFixed(4)}, Lon: ${data.location.longitude.toFixed(4)}`;

        const riskBox = document.getElementById('drawerRiskBox');
        if (riskBox) riskBox.style.borderLeftColor = color;

        document.getElementById('drawerRiskScore').textContent = data.risk_score;
        document.getElementById('drawerRiskScore').style.color = color;
        document.getElementById('drawerRiskStatus').textContent = `Nivel de Alerta ${data.alert_level} — ${data.alert_name}`;

        const f = data.factors;
        document.getElementById('drawerPrecip24').textContent = `${f.precipitation.forecast_24h_mm} mm`;
        document.getElementById('drawerPrecipCond').textContent = f.precipitation.condition;

        document.getElementById('drawerRiverRatio').textContent = `${f.river_discharge.ratio_to_mean || 1.0}x media`;
        document.getElementById('drawerRiverName').textContent = `${f.river_discharge.closest_river} (${f.river_discharge.distance_km} km)`;

        document.getElementById('drawerSoilSat').textContent = `${f.soil_moisture.saturation_pct}%`;
        document.getElementById('drawerSoilStatus').textContent = f.soil_moisture.status;

        document.getElementById('drawerElevation').textContent = `${data.elevation} m`;
        document.getElementById('drawerBasinName').textContent = f.topography.basin;

        const recsList = document.getElementById('drawerRecsList');
        if (recsList) {
            recsList.innerHTML = (data.recommendations || []).map(r => `<li>${r}</li>`).join('');
        }
    },

    loadProvinceFactors() {
        fetch('/api/factors/province')
            .then(res => res.json())
            .then(data => {
                if (!data.success) return;
                this.plotRiversLayer(data.rivers);
                this.plotBasinsLayer(data.basins);
                this.plotPrecipitationHeatmap(data.departments);
                this.plotSoilMoistureLayer(data.departments);
            })
            .catch(err => console.error("Error loading province factors:", err));
    },

    plotRiversLayer(rivers) {
        if (!this.riversLayer || !this._Graphic || !this._Polyline) return;
        this.riversLayer.removeAll();

        const dangerColors = {
            1: [6, 182, 212, 0.8],
            2: [234, 179, 8, 0.85],
            3: [249, 115, 22, 0.9],
            4: [239, 68, 68, 0.95]
        };

        rivers.forEach(r => {
            const path = r.path;
            const polyline = new this._Polyline({
                paths: [path],
                spatialReference: { wkid: 4326 }
            });

            const ratio = r.discharge_ratio || 1.0;
            const level = ratio >= 4 ? 4 : (ratio >= 2.5 ? 3 : (ratio >= 1.5 ? 2 : 1));
            const color = dangerColors[level] || dangerColors[1];
            const width = level >= 3 ? 4.5 : 3.0;

            const riverGraphic = new this._Graphic({
                geometry: polyline,
                symbol: {
                    type: "simple-line",
                    color: color,
                    width: width,
                    style: "solid"
                },
                attributes: { name: r.name, basin: r.basin, ratio: ratio },
                popupTemplate: {
                    title: `🌊 ${r.name}`,
                    content: `
                        <div style="font-family:Inter,sans-serif; font-size:12px; color:#e2e8f0;">
                            <div><strong>Cuenca:</strong> ${r.basin}</div>
                            <div><strong>Caudal Actual:</strong> ${r.discharge_current || 'N/A'} m³/s</div>
                            <div><strong>Ratio a la Media:</strong> ${ratio}x</div>
                            <div><strong>Tendencia:</strong> ${r.trend || 'Estable →'}</div>
                        </div>
                    `
                }
            });
            this.riversLayer.add(riverGraphic);
        });
    },

    plotBasinsLayer(basins) {
        if (!this.basinsLayer || !this._Graphic) return;
        this.basinsLayer.removeAll();

        basins.forEach(b => {
            const marker = new this._Graphic({
                geometry: { type: "point", longitude: b.center[0], latitude: b.center[1] },
                symbol: {
                    type: "text",
                    text: `⛰️ ${b.name}`,
                    color: b.color || "#0ea5e9",
                    font: { size: 10, weight: "bold", family: "Inter, sans-serif" },
                    haloColor: [12, 18, 32, 0.95],
                    haloSize: 2
                },
                attributes: { name: b.name },
                popupTemplate: {
                    title: `⛰️ ${b.name}`,
                    content: `<div style="font-family:Inter,sans-serif; font-size:12px; color:#8b9dc3;">${b.risk_summary}</div>`
                }
            });
            this.basinsLayer.add(marker);
        });
    },

    plotPrecipitationHeatmap(departments) {
        if (!this.precipLayer || !this._Graphic) return;
        this.precipLayer.removeAll();

        departments.forEach(d => {
            const precip = d.precipitation_24h || 0;
            if (precip <= 0) return;

            const size = Math.min(45, Math.max(14, precip * 0.45));
            const color = precip >= 100 ? [239, 68, 68, 0.35] : (precip >= 50 ? [249, 115, 22, 0.35] : [56, 189, 248, 0.3]);

            const bubble = new this._Graphic({
                geometry: { type: "point", longitude: this._deptCoords[d.department_id]?.lon || -65.42, latitude: this._deptCoords[d.department_id]?.lat || -24.78 },
                symbol: {
                    type: "simple-marker",
                    style: "circle",
                    color: color,
                    size: size,
                    outline: { color: [color[0], color[1], color[2], 0.6], width: 1 }
                },
                attributes: { name: d.department_name, precip: precip },
                popupTemplate: {
                    title: `🌧️ Precipitación 24h: ${d.department_name}`,
                    content: `<div style="font-family:Inter,sans-serif; font-size:12px;">Precipitación acumulada estimada: <strong>${precip} mm</strong></div>`
                }
            });
            this.precipLayer.add(bubble);
        });
    },

    plotSoilMoistureLayer(departments) {
        if (!this.soilLayer || !this._Graphic) return;
        this.soilLayer.removeAll();

        departments.forEach(d => {
            const sat = d.soil_saturation_pct || 20;
            if (sat < 40) return;

            const coords = this._deptCoords[d.department_id];
            if (!coords) return;

            const size = Math.min(30, Math.max(12, sat * 0.3));

            const soilBubble = new this._Graphic({
                geometry: { type: "point", longitude: coords.lon + 0.05, latitude: coords.lat - 0.05 },
                symbol: {
                    type: "simple-marker",
                    style: "diamond",
                    color: [168, 85, 247, 0.4],
                    size: size,
                    outline: { color: [168, 85, 247, 0.8], width: 1 }
                },
                attributes: { name: d.department_name, saturation: sat },
                popupTemplate: {
                    title: `💧 Saturación de Suelo: ${d.department_name}`,
                    content: `<div style="font-family:Inter,sans-serif; font-size:12px;">Saturación hídrica: <strong>${sat}%</strong></div>`
                }
            });
            this.soilLayer.add(soilBubble);
        });
    },

    _createMarker(lon, lat, color, size, style, attrs, popupContent) {
        if (!this._Graphic) return null;
        return new this._Graphic({
            geometry: { type: "point", longitude: lon, latitude: lat },
            symbol: {
                type: "simple-marker",
                style: style || "circle",
                color: color,
                size: size,
                outline: { color: [255, 255, 255, 0.8], width: 1.2 }
            },
            attributes: attrs || {},
            popupTemplate: popupContent ? { title: popupContent.title, content: popupContent.content } : undefined
        });
    },

    _buildDeptPopup(a) {
        const dept = this._deptData[a.department_id] || {};
        const levelColors = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444' };
        const levelColor = levelColors[a.alert_level] || '#22c55e';
        const rivers = (a.rivers || []).join(', ') || 'N/A';
        const population = dept.population ? dept.population.toLocaleString('es-AR') : 'N/A';
        const area = dept.area_km2 ? dept.area_km2.toLocaleString('es-AR') + ' km²' : 'N/A';
        const basin = dept.basin || a.basin || 'N/A';
        const description = dept.description || a.description || '';
        const precip24 = a.precipitation_24h || 0;
        const precip48 = a.precipitation_48h || 0;
        const soilSat = a.soil_saturation_pct || 20;

        const manualAlertHtml = (a.manual_alerts && a.manual_alerts.length) ? `
            <div style="margin-bottom:10px; padding:8px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:6px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:700; color:#ef4444; font-size:12px;">🚨 ALERTA MANUAL OPERADOR</span>
                    <span style="font-size:10px; color:#8b9dc3;">${new Date(a.manual_alerts[0].created_at).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                <p style="font-size:11px; color:#fff; margin-bottom:6px;">${a.manual_alerts[0].message}</p>
                <button onclick="AlertsModule.triggerEmergencyAlert(${JSON.stringify(a.manual_alerts[0]).replace(/"/g, '&quot;')})" style="width:100%; padding:5px; background:#ef4444; color:#fff; border:none; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">
                    🔊 Reproducir Sirena (15s)
                </button>
            </div>
        ` : '';

        return {
            title: a.department_name,
            content: `
                <div style="font-family:Inter,system-ui,sans-serif; color:#e2e8f0; max-width:320px;">
                    ${manualAlertHtml}
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:6px; border-left:3px solid ${levelColor};">
                        <span style="font-size:1.1em;">${a.alert_icon || '🟢'}</span>
                        <div>
                            <div style="font-weight:600; font-size:13px;">${a.alert_name || 'Normal'}</div>
                            <div style="font-size:11px; color:#8b9dc3;">Nivel ${a.alert_level} (Índice Riesgo: ${a.risk_score || 15})</div>
                        </div>
                    </div>
                    <table style="width:100%; font-size:12px; border-collapse:collapse;">
                        <tr><td style="color:#8b9dc3; padding:3px 0;">🌧️ Lluvia 24h</td><td style="text-align:right; font-weight:600;">${precip24} mm</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">🌧️ Lluvia 48h</td><td style="text-align:right; font-weight:600;">${precip48} mm</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">💧 Saturación Suelo</td><td style="text-align:right; font-weight:600;">${soilSat}%</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">⛰️ Elevación</td><td style="text-align:right; font-weight:600;">${a.elevation || 'N/A'} m</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">👥 Población</td><td style="text-align:right; font-weight:600;">${population}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">📐 Superficie</td><td style="text-align:right; font-weight:600;">${area}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">🏞️ Cuenca</td><td style="text-align:right; font-weight:600;">${basin}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">🌊 Ríos</td><td style="text-align:right; font-weight:600;">${rivers}</td></tr>
                    </table>
                    ${description ? `<p style="margin-top:8px; font-size:11px; color:#8b9dc3; line-height:1.4; border-top:1px solid rgba(255,255,255,0.07); padding-top:8px;">${description}</p>` : ''}
                    <div style="margin-top:10px; display:flex; flex-direction:column; gap:5px;">
                        <button onclick="AlertsModule.showDepartmentMapInfo('${a.department_id}')" style="width:100%; padding:7px; background:#0ea5e9; color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit;">🗺️ Ver Análisis y Contexto de Mapas</button>
                        <button onclick="App.selectDepartment('${a.department_id}'); App.navigateTo('dashboard');" style="width:100%; padding:6px; background:rgba(255,255,255,0.08); color:#e2e8f0; border:1px solid rgba(255,255,255,0.15); border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit;">📊 Ver Dashboard Completo</button>
                    </div>
                </div>
            `
        };
    },

    plotDepartments(alerts) {
        if (!this._ready || !this.deptLayer || !this._Graphic) {
            this._pendingAlerts = alerts;
            return;
        }
        this.deptLayer.removeAll();
        this.deptGraphics = {};

        const colors = {
            1: [34, 197, 94, 0.85],
            2: [234, 179, 8, 0.85],
            3: [249, 115, 22, 0.85],
            4: [239, 68, 68, 0.85]
        };

        alerts.forEach(a => {
            const coords = this._deptCoords[a.department_id] || { lat: -24.78, lon: -65.42 };
            const color = colors[a.alert_level] || colors[1];
            const isHighRisk = a.alert_level >= 3;
            const sz = isHighRisk ? 16 : 12;

            if (isHighRisk) {
                const glow = new this._Graphic({
                    geometry: { type: "point", longitude: coords.lon, latitude: coords.lat },
                    symbol: {
                        type: "simple-marker",
                        style: "circle",
                        color: [color[0], color[1], color[2], 0.12],
                        size: sz + 18,
                        outline: { color: [color[0], color[1], color[2], 0.25], width: 1 }
                    }
                });
                this.deptLayer.add(glow);
            }

            const popup = this._buildDeptPopup(a);
            const g = this._createMarker(coords.lon, coords.lat, color, sz, "circle",
                { name: a.department_name, level: a.alert_level },
                popup
            );
            if (g) {
                this.deptLayer.add(g);
                this.deptGraphics[a.department_id] = g;
            }

            const label = new this._Graphic({
                geometry: { type: "point", longitude: coords.lon, latitude: coords.lat },
                symbol: {
                    type: "text",
                    text: a.department_name.length > 16 ? a.department_name.substring(0, 14) + '…' : a.department_name,
                    color: [226, 232, 240, 0.85],
                    font: { size: 9, weight: "normal", family: "Inter, sans-serif" },
                    yoffset: -(sz / 2 + 10),
                    haloColor: [12, 18, 32, 0.9],
                    haloSize: 1.5
                }
            });
            this.deptLayer.add(label);
        });
    },

    plotCapitalZones(zones) {
        if (!this._ready || !this._Graphic) {
            this._pendingZones = zones;
            return;
        }
        this.zonesLayer.removeAll();

        const riskColors = {
            1: { fill: [34, 197, 94, 0.08], outline: [34, 197, 94, 0.35] },
            2: { fill: [234, 179, 8, 0.1], outline: [234, 179, 8, 0.4] },
            3: { fill: [249, 115, 22, 0.12], outline: [249, 115, 22, 0.45] },
            4: { fill: [239, 68, 68, 0.15], outline: [239, 68, 68, 0.5] }
        };

        zones.forEach(z => {
            const rc = riskColors[z.risk] || riskColors[1];
            const radiusMeters = z.risk >= 3 ? 600 : 400;

            if (this._Circle) {
                const circle = new this._Circle({
                    center: { type: "point", longitude: z.lon, latitude: z.lat },
                    radius: radiusMeters,
                    radiusUnit: "meters"
                });
                const areaGraphic = new this._Graphic({
                    geometry: circle,
                    symbol: {
                        type: "simple-fill",
                        color: rc.fill,
                        outline: { color: rc.outline, width: 1.2, style: "solid" }
                    },
                    attributes: { name: z.name, risk: z.risk },
                    popupTemplate: {
                        title: z.name,
                        content: `
                            <div style="font-family:Inter,system-ui,sans-serif; font-size:12px;">
                                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${z.risk >= 3 ? '#f97316' : z.risk >= 2 ? '#eab308' : '#22c55e'};"></span>
                                    <strong>Riesgo Nivel ${z.risk}/4</strong>
                                </div>
                                <p style="color:#8b9dc3; line-height:1.4;">${z.description}</p>
                            </div>
                        `
                    }
                });
                this.zonesLayer.add(areaGraphic);
            }

            const marker = this._createMarker(z.lon, z.lat, rc.outline, 7, "square",
                { name: z.name, risk: z.risk },
                {
                    title: z.name,
                    content: `
                        <div style="font-family:Inter,system-ui,sans-serif; font-size:12px;">
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${z.risk >= 3 ? '#f97316' : z.risk >= 2 ? '#eab308' : '#22c55e'};"></span>
                                <strong>Riesgo Nivel ${z.risk}/4</strong>
                            </div>
                            <p style="color:#8b9dc3; line-height:1.4;">${z.description}</p>
                        </div>
                    `
                }
            );
            if (marker) this.zonesLayer.add(marker);

            const label = new this._Graphic({
                geometry: { type: "point", longitude: z.lon, latitude: z.lat },
                symbol: {
                    type: "text",
                    text: z.name,
                    color: [226, 232, 240, 0.75],
                    font: { size: 8, weight: "normal", family: "Inter, sans-serif" },
                    yoffset: -14,
                    haloColor: [12, 18, 32, 0.85],
                    haloSize: 1
                }
            });
            this.zonesLayer.add(label);
        });
    },

    focusDepartment(deptId) {
        const coords = this._deptCoords[deptId];
        if (coords) {
            const zoomLevel = deptId === 'capital' ? 12 : 10;
            if (this.view2D) {
                this.view2D.goTo({ center: [coords.lon, coords.lat], zoom: zoomLevel }, { duration: 800 });
            }
        }
    },

    showUserLocation(lat, lon) {
        if (!this._Graphic || !this.deptLayer) return;
        const g = this._createMarker(lon, lat, [14, 165, 233, 0.9], 14, "circle",
            { name: "Tu ubicación" },
            { title: "📍 Tu ubicación", content: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}` }
        );
        if (g) this.deptLayer.add(g);
        if (this.view2D) this.view2D.goTo({ center: [lon, lat], zoom: 14 }, { duration: 800 });
        this.inspectPoint(lat, lon);
    },

    loadUrbanStreetClimateData(deptId = 'capital') {
        if (!this._ready || !this._Graphic) return;

        if (this.urbanHeatLayer) this.urbanHeatLayer.removeAll();
        if (this.urbanRainLayer) this.urbanRainLayer.removeAll();
        if (this.urbanWindLayer) this.urbanWindLayer.removeAll();

        const dept = this._deptData[deptId] || { lat: -24.7821, lon: -65.4232, name: "Capital", rivers: ["Río Arenales"] };
        const cLon = dept.lon;
        const cLat = dept.lat;
        const deptName = dept.name;

        // 1. CALOR: Malla de Calor Urbano sobre Manzanas y Callejero del Departamento
        const urbanHeatZones = [
            {
                name: `Microcentro & Callejero Comercial — ${deptName}`,
                coords: [
                    [cLon - 0.005, cLat + 0.003],
                    [cLon + 0.004, cLat + 0.003],
                    [cLon + 0.004, cLat - 0.004],
                    [cLon - 0.005, cLat - 0.004]
                ],
                temp: 31.4,
                desc: `Isla de calor sobre asfalto denso y calzada céntrica de ${deptName}.`
            },
            {
                name: `Barrios Periféricos & Avenidas — ${deptName}`,
                coords: [
                    [cLon + 0.004, cLat + 0.008],
                    [cLon + 0.012, cLat + 0.008],
                    [cLon + 0.012, cLat - 0.002],
                    [cLon + 0.004, cLat - 0.002]
                ],
                temp: 28.2,
                desc: `Corredor térmico residencial con retención de calor en asfalto.`
            },
            {
                name: `Zona Verde & Quebradas — ${deptName}`,
                coords: [
                    [cLon - 0.014, cLat - 0.002],
                    [cLon - 0.005, cLat - 0.002],
                    [cLon - 0.005, cLat - 0.010],
                    [cLon - 0.014, cLat - 0.010]
                ],
                temp: 22.8,
                desc: `Área microclimática fresca por arbolado y vegetación nativa.`
            }
        ];

        urbanHeatZones.forEach(z => {
            let fillColor = [254, 204, 92, 0.45];
            if (z.temp > 30) fillColor = [227, 26, 28, 0.55];
            else if (z.temp > 27) fillColor = [253, 141, 60, 0.5];

            const polygon = new this._Graphic({
                geometry: { type: "polygon", rings: z.coords },
                symbol: {
                    type: "simple-fill",
                    color: fillColor,
                    outline: { color: [255, 255, 255, 0.6], width: 1 }
                },
                attributes: { name: z.name, temp: z.temp, desc: z.desc },
                popupTemplate: {
                    title: `🔥 Isla de Calor Urbano: ${z.name}`,
                    content: `
                        <div style="font-family:Inter,sans-serif; font-size:12px;">
                            <div style="font-size:16px; font-weight:700; color:#ef4444; margin-bottom:4px;">${z.temp} °C</div>
                            <p style="color:#8b9dc3; line-height:1.4;">${z.desc}</p>
                        </div>
                    `
                }
            });
            if (this.urbanHeatLayer) this.urbanHeatLayer.add(polygon);
        });

        // 2. AGUA: Lluvia y Escurrimiento Proyectado sobre Trazado de Calles
        const mainRiver = (dept.rivers && dept.rivers[0]) ? dept.rivers[0] : "Cauce Urbano";
        const streetRunoffs = [
            {
                name: `Av. Principal San Martín / Belgrano (${deptName})`,
                path: [[cLon - 0.008, cLat + 0.006], [cLon - 0.002, cLat + 0.001], [cLon + 0.005, cLat - 0.005]],
                flow_mmh: 48,
                status: "Escurrimiento Rápido por Calzada"
            },
            {
                name: `Corredor Comercial & Baden Urbano (${deptName})`,
                path: [[cLon - 0.006, cLat - 0.006], [cLon + 0.002, cLat - 0.002], [cLon + 0.008, cLat + 0.004]],
                flow_mmh: 72,
                status: "Acumulación en Calzada"
            },
            {
                name: `Trazado Urbano de ${mainRiver}`,
                path: [[cLon - 0.012, cLat + 0.008], [cLon, cLat], [cLon + 0.012, cLat - 0.008]],
                flow_mmh: 105,
                status: `Cauce Urbano Crítico — ${mainRiver}`
            }
        ];

        streetRunoffs.forEach(s => {
            let lineColor = [56, 189, 248, 0.85];
            let width = 4;
            if (s.flow_mmh > 80) { lineColor = [8, 81, 156, 0.95]; width = 7; }
            else if (s.flow_mmh > 50) { lineColor = [66, 146, 198, 0.9]; width = 5.5; }

            const line = new this._Graphic({
                geometry: { type: "polyline", paths: s.path },
                symbol: {
                    type: "simple-line",
                    color: lineColor,
                    width: width,
                    style: "solid"
                },
                attributes: { name: s.name, flow: s.flow_mmh, status: s.status },
                popupTemplate: {
                    title: `🌧️ Escurrimiento en Trazado: ${s.name}`,
                    content: `
                        <div style="font-family:Inter,sans-serif; font-size:12px;">
                            <div style="font-size:15px; font-weight:700; color:#38bdf8; margin-bottom:4px;">${s.flow_mmh} mm/h</div>
                            <div style="color:#e2e8f0; font-weight:600;">Estado: ${s.status}</div>
                        </div>
                    `
                }
            });
            if (this.urbanRainLayer) this.urbanRainLayer.add(line);
        });

        // 3. AIRE: Vectores y Líneas de Corriente de Viento en Trazados Urbanos
        const urbanWindCorridors = [
            { name: `Cañón Urbano Centro (${deptName})`, lon: cLon + 0.002, lat: cLat + 0.002, speed: 26, dir: 45 },
            { name: `Corredor Eólico Avenidas (${deptName})`, lon: cLon - 0.004, lat: cLat - 0.003, speed: 35, dir: 120 },
            { name: `Brisa de Ladera / Valles (${deptName})`, lon: cLon + 0.006, lat: cLat - 0.005, speed: 18, dir: 290 }
        ];

        urbanWindCorridors.forEach(w => {
            const windArrow = new this._Graphic({
                geometry: { type: "point", longitude: w.lon, latitude: w.lat },
                symbol: {
                    type: "simple-marker",
                    style: "triangle",
                    angle: w.dir,
                    color: [168, 85, 247, 0.95],
                    size: Math.max(14, Math.min(28, w.speed * 0.7)),
                    outline: { color: [255, 255, 255, 0.9], width: 1.5 }
                },
                attributes: { name: w.name, speed: w.speed, dir: w.dir },
                popupTemplate: {
                    title: `💨 Corriente de Viento Urbano: ${w.name}`,
                    content: `<b>Velocidad: ${w.speed} km/h</b><br>Dirección del Flujo: ${w.dir}° Azimut`
                }
            });
            if (this.urbanWindLayer) this.urbanWindLayer.add(windArrow);
        });
    },

    setDeptCoords(departments) {
        this._deptCoords = {};
        this._deptData = {};
        departments.forEach(d => {
            this._deptCoords[d.id] = { lat: d.lat, lon: d.lon };
            this._deptData[d.id] = d;
        });

        // Poblar desplegable de municipios/departamentos para el clima urbano en calles
        const urbanSelect = document.getElementById('urbanDeptSelect');
        if (urbanSelect) {
            urbanSelect.innerHTML = departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        }
    }
};

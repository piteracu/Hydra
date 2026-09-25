/* ═══════════════════════════════════════════════════════════════════════════
   Hydra — Módulo de Mapa Interactivo ArcGIS JS SDK 4.29
   Monitoreo Multifactores & Análisis Cartográfico de Inundabilidad
   ═══════════════════════════════════════════════════════════════════════════ */

const MapModule = {
    map: null,
    view: null,
    view2D: null,
    view3D: null,
    is3D: false,

    // Capas ArcGIS de Factores de Inundación
    deptLayer: null,
    precipLayer: null,
    riversLayer: null,
    soilLayer: null,
    basinsLayer: null,
    zonesLayer: null,
    inspectorLayer: null,

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
            "esri/views/SceneView",
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
            Map, MapView, SceneView, Graphic, GraphicsLayer,
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

            // Creación del Mapa con Terreno Mundial (World Elevation) para 3D
            this.map = new Map({
                basemap: "dark-gray-vector",
                ground: "world-elevation",
                layers: [
                    this.basinsLayer,
                    this.soilLayer,
                    this.precipLayer,
                    this.riversLayer,
                    this.zonesLayer,
                    this.deptLayer,
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

            // Vista 3D (SceneView en #mapView3D)
            this.view3D = new SceneView({
                container: "mapView3D",
                map: this.map,
                camera: {
                    position: {
                        longitude: initialCenter[0],
                        latitude: initialCenter[1] - 0.7,
                        z: 120000
                    },
                    tilt: 45,
                    heading: 0
                },
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

            // Widgets 3D
            const search3D = new Search({ view: this.view3D });
            this.view3D.ui.add(search3D, "top-right");

            const locate3D = new Locate({ view: this.view3D });
            this.view3D.ui.add(locate3D, "top-left");

            // Eventos de inspección por clic
            this._setupClickInspector(this.view2D);
            this._setupClickInspector(this.view3D);

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
            });

            // Handlers de los botones de Mapa Base
            document.getElementById('btnMapDark')?.addEventListener('click', () => this.setBasemap('dark-gray-vector', 'btnMapDark'));
            document.getElementById('btnMapTopo')?.addEventListener('click', () => this.setBasemap('topo-vector', 'btnMapTopo'));
            document.getElementById('btnMapSatellite')?.addEventListener('click', () => this.setBasemap('satellite', 'btnMapSatellite'));

            // Handlers de modo 2D / 3D con instancias de DOM completamente aisladas
            document.getElementById('btnMode2D')?.addEventListener('click', () => this.switchMode(false));
            document.getElementById('btnMode3D')?.addEventListener('click', () => this.switchMode(true));

            // Handlers de chips de capas de factores
            this._setupFactorChips();

            // Handlers de Análisis Cartográfico
            this._setupCartographicHandlers();

            // Handler para cerrar drawers
            document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
                document.getElementById('pointInspectorDrawer')?.classList.remove('open');
                this.inspectorLayer.removeAll();
            });

            document.getElementById('closeCartoDrawerBtn')?.addEventListener('click', () => {
                document.getElementById('cartoAnalysisDrawer')?.classList.remove('open');
            });
        });
    },

    switchMode(enable3D) {
        if (this.is3D === enable3D) return;
        this.is3D = enable3D;

        const btn2D = document.getElementById('btnMode2D');
        const btn3D = document.getElementById('btnMode3D');
        const container2D = document.getElementById('mapView2D');
        const container3D = document.getElementById('mapView3D');

        const currentLon = this.view ? this.view.center.longitude : -65.0;
        const currentLat = this.view ? this.view.center.latitude : -24.2;
        const currentZoom = this.view ? (this.view.zoom || 7) : 7;

        if (enable3D) {
            btn2D?.classList.remove('active');
            btn3D?.classList.add('active');

            if (container2D) { container2D.classList.remove('active'); container2D.classList.add('inactive'); }
            if (container3D) { container3D.classList.remove('inactive'); container3D.classList.add('active'); }

            this.view = this.view3D;
            if (this.view3D) {
                this.view3D.goTo({
                    target: [currentLon, currentLat],
                    zoom: currentZoom,
                    tilt: 45
                }, { animate: false });
                setTimeout(() => this.view3D.resize(), 50);
            }
        } else {
            btn3D?.classList.remove('active');
            btn2D?.classList.add('active');

            if (container3D) { container3D.classList.remove('active'); container3D.classList.add('inactive'); }
            if (container2D) { container2D.classList.remove('inactive'); container2D.classList.add('active'); }

            this.view = this.view2D;
            if (this.view2D) {
                this.view2D.goTo({
                    center: [currentLon, currentLat],
                    zoom: Math.round(currentZoom)
                }, { animate: false });
                setTimeout(() => this.view2D.resize(), 50);
            }
        }
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
                }
            });
        });
    },

    _setupCartographicHandlers() {
        const cartoSelect = document.getElementById('cartoDeptSelect');
        const btnCarto = document.getElementById('btnCartoAnalysis');
        const btnFocus = document.getElementById('btnFocusCartoDept');

        cartoSelect?.addEventListener('change', (e) => {
            const deptId = e.target.value;
            if (deptId) this.openCartographicAnalysis(deptId);
        });

        btnCarto?.addEventListener('click', () => {
            const currentDept = cartoSelect?.value || App.currentDept || 'capital';
            this.openCartographicAnalysis(currentDept);
        });

        btnFocus?.addEventListener('click', () => {
            const deptId = cartoSelect?.value || App.currentDept || 'capital';
            this.focusDepartment(deptId);
        });
    },

    openCartographicAnalysis(deptId) {
        const drawer = document.getElementById('cartoAnalysisDrawer');
        if (!drawer) return;

        drawer.classList.add('open');
        document.getElementById('cartoDeptName').textContent = "Cargando Análisis Cartográfico...";

        fetch(`/api/cartography/${deptId}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) return;
                this.updateCartographicDrawer(data);
                this.focusDepartment(deptId);
            })
            .catch(err => console.error("Error loading cartography:", err));
    },

    updateCartographicDrawer(data) {
        const carto = data.cartography || {};
        const rt = data.realtime_telemetry || {};

        document.getElementById('cartoDeptName').textContent = data.name;
        document.getElementById('cartoDeptSub').textContent = `Análisis Cartográfico — ${data.basin}`;

        const riskBox = document.getElementById('cartoRiskBox');
        if (riskBox) riskBox.style.borderLeftColor = rt.alert_color || '#22c55e';

        document.getElementById('cartoRiskScore').textContent = rt.risk_score || '--';
        document.getElementById('cartoRiskScore').style.color = rt.alert_color || '#22c55e';
        document.getElementById('cartoAlertBadge').textContent = `${rt.alert_icon} Nivel ${rt.alert_level} — ${rt.alert_name}`;

        document.getElementById('cartoElevation').textContent = `${data.elevation_m} m`;
        document.getElementById('cartoBasin').textContent = data.basin;
        document.getElementById('cartoArea').textContent = `${data.area_km2.toLocaleString('es-AR')} km²`;
        document.getElementById('cartoPop').textContent = `${data.population.toLocaleString('es-AR')} hab.`;

        document.getElementById('cartoSlopeType').textContent = carto.slope_type || '--';
        document.getElementById('cartoSlopeDesc').textContent = carto.slope_description || '--';

        document.getElementById('cartoDrainage').textContent = carto.drainage_capacity || '--';
        document.getElementById('cartoSoilSat').textContent = `${rt.soil_saturation_pct || 20}%`;
        document.getElementById('cartoVulnAreaPct').textContent = `${carto.vulnerability_area_pct || 30}%`;

        document.getElementById('cartoRiverSystem').textContent = carto.closest_river_system || '--';
        document.getElementById('cartoRiverProximity').textContent = `${carto.river_proximity_km} km`;
        document.getElementById('cartoRiversList').textContent = (data.rivers || []).join(', ') || 'N/A';

        document.getElementById('cartoDescription').textContent = carto.description || 'Sin descripción adicional.';

        const select = document.getElementById('cartoDeptSelect');
        if (select) select.value = data.department_id;
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
                    <div style="display:flex; gap:6px; margin-top:10px;">
                        <button onclick="MapModule.openCartographicAnalysis('${a.department_id}');" style="flex:1; padding:7px; background:#0284c7; color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit;">🗺️ Cartografía</button>
                        <button onclick="App.selectDepartment('${a.department_id}'); App.navigateTo('dashboard');" style="flex:1; padding:7px; background:#0ea5e9; color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit;">📊 Dashboard</button>
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
            if (this.view3D) {
                this.view3D.goTo({
                    target: [coords.lon, coords.lat],
                    zoom: zoomLevel,
                    tilt: 45
                }, { duration: 800 });
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
        if (this.view3D) this.view3D.goTo({ target: [lon, lat], zoom: 14, tilt: 45 }, { duration: 800 });
        this.inspectPoint(lat, lon);
    },

    setDeptCoords(departments) {
        this._deptCoords = {};
        this._deptData = {};
        departments.forEach(d => {
            this._deptCoords[d.id] = { lat: d.lat, lon: d.lon };
            this._deptData[d.id] = d;
        });

        const cartoSelect = document.getElementById('cartoDeptSelect');
        if (cartoSelect) {
            cartoSelect.innerHTML = `<option value="">🗺️ Análisis Cartográfico por Depto...</option>` +
                departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        }
    }
};

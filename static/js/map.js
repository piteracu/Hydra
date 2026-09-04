/* Map module — Hydra — ArcGIS Maps SDK for JavaScript */
const MapModule = {
    view: null,
    map: null,
    deptLayer: null,
    zonesLayer: null,
    deptGraphics: {},
    _Graphic: null,
    _Point: null,
    _Circle: null,
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
            "esri/geometry/Circle"
        ], (Map, MapView, Graphic, GraphicsLayer, Search, Locate, ScaleBar, Circle) => {
            this._Graphic = Graphic;
            this._Circle = Circle;

            this.deptLayer = new GraphicsLayer({ title: "Departamentos" });
            this.zonesLayer = new GraphicsLayer({ title: "Zonas de Riesgo Capital" });

            this.map = new Map({
                basemap: "dark-gray-vector",
                layers: [this.zonesLayer, this.deptLayer]
            });

            this.view = new MapView({
                container: "mapView",
                map: this.map,
                center: [-65.0, -24.2],
                zoom: 7,
                ui: { components: ["zoom", "compass"] },
                popup: {
                    dockEnabled: true,
                    dockOptions: { buttonEnabled: false, breakpoint: false, position: "bottom-right" }
                }
            });

            const search = new Search({ view: this.view });
            this.view.ui.add(search, "top-right");

            const locate = new Locate({ view: this.view });
            this.view.ui.add(locate, "top-left");

            const scaleBar = new ScaleBar({ view: this.view, unit: "metric" });
            this.view.ui.add(scaleBar, "bottom-right");

            this.view.when(() => {
                console.log("Hydra Map loaded");
                this._ready = true;
                if (this._pendingAlerts) {
                    this.plotDepartments(this._pendingAlerts);
                    this._pendingAlerts = null;
                }
                if (this._pendingZones) {
                    this.plotCapitalZones(this._pendingZones);
                    this._pendingZones = null;
                }
            });

            // Basemap buttons
            document.getElementById('btnMapTopo')?.addEventListener('click', () => this.setBasemap('topo-vector', 'btnMapTopo'));
            document.getElementById('btnMapDark')?.addEventListener('click', () => this.setBasemap('dark-gray-vector', 'btnMapDark'));
            document.getElementById('btnMapSatellite')?.addEventListener('click', () => this.setBasemap('satellite', 'btnMapSatellite'));
        });
    },

    setBasemap(basemap, activeBtn) {
        if (this.map) this.map.basemap = basemap;
        document.querySelectorAll('.map-controls .btn').forEach(b => b.classList.remove('active'));
        document.getElementById(activeBtn)?.classList.add('active');
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
                outline: { color: [255, 255, 255, 0.7], width: 1.2 }
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

        return {
            title: a.department_name,
            content: `
                <div style="font-family:Inter,system-ui,sans-serif; color:#e2e8f0; max-width:320px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:6px; border-left:3px solid ${levelColor};">
                        <span style="font-size:1.1em;">${a.alert_icon || '🟢'}</span>
                        <div>
                            <div style="font-weight:600; font-size:13px;">${a.alert_name || 'Normal'}</div>
                            <div style="font-size:11px; color:#8b9dc3;">Nivel ${a.alert_level}</div>
                        </div>
                    </div>
                    <table style="width:100%; font-size:12px; border-collapse:collapse;">
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Precipitación 24h</td><td style="text-align:right; font-weight:600;">${precip24} mm</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Precipitación 48h</td><td style="text-align:right; font-weight:600;">${precip48} mm</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Elevación</td><td style="text-align:right; font-weight:600;">${a.elevation || 'N/A'} m</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Población</td><td style="text-align:right; font-weight:600;">${population}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Superficie</td><td style="text-align:right; font-weight:600;">${area}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Cuenca</td><td style="text-align:right; font-weight:600;">${basin}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Ríos</td><td style="text-align:right; font-weight:600;">${rivers}</td></tr>
                        <tr><td style="color:#8b9dc3; padding:3px 0;">Riesgo base</td><td style="text-align:right; font-weight:600;">${a.topographic_risk || dept.risk_base || 'N/A'}/4</td></tr>
                    </table>
                    ${description ? `<p style="margin-top:8px; font-size:11px; color:#8b9dc3; line-height:1.4; border-top:1px solid rgba(255,255,255,0.07); padding-top:8px;">${description}</p>` : ''}
                    <button onclick="App.selectDepartment('${a.department_id}'); App.navigateTo('dashboard');" style="margin-top:10px; width:100%; padding:7px; background:#0ea5e9; color:#fff; border:none; border-radius:5px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit;">Ver Dashboard</button>
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

            // Outer glow for high risk
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

            // Main marker with enriched popup
            const popup = this._buildDeptPopup(a);
            const g = this._createMarker(coords.lon, coords.lat, color, sz, "circle",
                { name: a.department_name, level: a.alert_level },
                popup
            );
            if (g) {
                this.deptLayer.add(g);
                this.deptGraphics[a.department_id] = g;
            }

            // Label
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

            // Semi-transparent area circle
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

            // Center marker
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

            // Zone label
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
        if (this.view && coords) {
            this.view.goTo(
                { center: [coords.lon, coords.lat], zoom: deptId === 'capital' ? 12 : 10 },
                { duration: 800, easing: "ease-in-out" }
            );
        }
    },

    showUserLocation(lat, lon) {
        if (!this._Graphic || !this.deptLayer) return;
        const g = this._createMarker(lon, lat, [14, 165, 233, 0.9], 14, "circle",
            { name: "Tu ubicación" },
            { title: "📍 Tu ubicación", content: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}` }
        );
        if (g) this.deptLayer.add(g);
        if (this.view) this.view.goTo({ center: [lon, lat], zoom: 14 }, { duration: 800 });
    },

    setDeptCoords(departments) {
        this._deptCoords = {};
        this._deptData = {};
        departments.forEach(d => {
            this._deptCoords[d.id] = { lat: d.lat, lon: d.lon };
            this._deptData[d.id] = d;
        });
    }
};

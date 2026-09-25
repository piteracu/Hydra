"""
Configuración de la aplicación de Alertas de Inundaciones - Provincia de Salta
"""

# ─── API Endpoints ───────────────────────────────────────────────
OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# ─── Coordenadas de Salta Capital (default) ──────────────────────
DEFAULT_LAT = -24.7821
DEFAULT_LON = -65.4232

# ─── Umbrales de Alerta ─────────────────────────────────────────
# Precipitación acumulada en 24h (mm)
PRECIP_THRESHOLD_NORMAL = 0       # 🟢 Normal: 0-20mm
PRECIP_THRESHOLD_CAUTION = 20     # 🟡 Precaución: 20-50mm
PRECIP_THRESHOLD_ALERT = 50       # 🟠 Alerta: 50-100mm
PRECIP_THRESHOLD_EMERGENCY = 100  # 🔴 Emergencia: >100mm

# Descarga de ríos - multiplicador sobre la media histórica
RIVER_DISCHARGE_NORMAL = 1.0      # 🟢 Normal: <= 1x media
RIVER_DISCHARGE_CAUTION = 1.5     # 🟡 Precaución: 1.5x media
RIVER_DISCHARGE_ALERT = 2.5       # 🟠 Alerta: 2.5x media
RIVER_DISCHARGE_EMERGENCY = 4.0   # 🔴 Emergencia: >4x media

# ─── Variables meteorológicas solicitadas ────────────────────────
WEATHER_HOURLY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "rain",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "pressure_msl",
    "soil_moisture_0_to_1cm",
    "soil_moisture_1_to_3cm",
    "soil_moisture_3_to_9cm"
]

WEATHER_DAILY_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "rain_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "weather_code"
]

FLOOD_DAILY_VARS = [
    "river_discharge",
    "river_discharge_mean",
    "river_discharge_max",
    "river_discharge_min"
]

# ─── Datos topográficos y de riesgo por departamento ─────────────
# Niveles de riesgo base: 1=Bajo, 2=Moderado, 3=Alto, 4=Muy Alto
DEPARTMENTS = {
    "capital": {
        "name": "Capital (Salta)",
        "lat": -24.7821,
        "lon": -65.4232,
        "elevation": 1187,
        "risk_base": 3,
        "rivers": ["Río Arenales", "Río Vaqueros"],
        "description": "Zona urbana principal, riesgo de inundación urbana por lluvias intensas y desborde del Río Arenales.",
        "population": 618000,
        "area_km2": 1722,
        "basin": "Cuenca del Río Juramento"
    },
    "cerrillos": {
        "name": "Cerrillos",
        "lat": -24.9000,
        "lon": -65.4833,
        "elevation": 1170,
        "risk_base": 2,
        "rivers": ["Río Rosario", "Arroyo Cerrillos"],
        "description": "Zona periurbana con riesgo moderado por cercanía a cauces menores.",
        "population": 40000,
        "area_km2": 640,
        "basin": "Cuenca del Río Juramento"
    },
    "rosario_lerma": {
        "name": "Rosario de Lerma",
        "lat": -24.9833,
        "lon": -65.5833,
        "elevation": 1330,
        "risk_base": 2,
        "rivers": ["Río Rosario", "Río Toro"],
        "description": "Valle de Lerma, riesgo moderado por crecidas del Río Rosario y Toro.",
        "population": 45000,
        "area_km2": 4525,
        "basin": "Cuenca del Río Juramento"
    },
    "chicoana": {
        "name": "Chicoana",
        "lat": -25.1000,
        "lon": -65.5333,
        "elevation": 1400,
        "risk_base": 2,
        "rivers": ["Río Chicoana", "Río Escoipe"],
        "description": "Zona montañosa con riesgo de crecidas repentinas en quebradas.",
        "population": 22000,
        "area_km2": 917,
        "basin": "Cuenca del Río Juramento"
    },
    "la_caldera": {
        "name": "La Caldera",
        "lat": -24.5833,
        "lon": -65.3667,
        "elevation": 1500,
        "risk_base": 2,
        "rivers": ["Río Caldera", "Río Wierna"],
        "description": "Zona de yungas con alta pluviometría, riesgo de aluviones.",
        "population": 8500,
        "area_km2": 867,
        "basin": "Cuenca del Río Bermejo"
    },
    "gral_guemes": {
        "name": "General Güemes",
        "lat": -24.6667,
        "lon": -65.0500,
        "elevation": 750,
        "risk_base": 3,
        "rivers": ["Río Mojotoro", "Río Lavayén"],
        "description": "Zona de llanura chaqueña, alto riesgo por desborde de ríos en época de lluvias.",
        "population": 55000,
        "area_km2": 2365,
        "basin": "Cuenca del Río Bermejo"
    },
    "oran": {
        "name": "Orán",
        "lat": -23.1333,
        "lon": -64.3333,
        "elevation": 340,
        "risk_base": 4,
        "rivers": ["Río Bermejo", "Río San Francisco", "Río Pescado"],
        "description": "Alto riesgo de inundaciones por crecidas del Bermejo y San Francisco. Zona subtropical húmeda.",
        "population": 140000,
        "area_km2": 11892,
        "basin": "Cuenca del Río Bermejo"
    },
    "san_martin": {
        "name": "General José de San Martín",
        "lat": -22.2833,
        "lon": -63.6667,
        "elevation": 280,
        "risk_base": 4,
        "rivers": ["Río Bermejo", "Río Itiyuro"],
        "description": "Zona chaqueña con alto riesgo por crecidas del Bermejo y Pilcomayo.",
        "population": 170000,
        "area_km2": 16257,
        "basin": "Cuenca del Río Bermejo"
    },
    "rivadavia": {
        "name": "Rivadavia",
        "lat": -23.2000,
        "lon": -62.8833,
        "elevation": 220,
        "risk_base": 4,
        "rivers": ["Río Bermejo", "Río Pilcomayo"],
        "description": "Extremo este provincial, máximo riesgo por desborde del Pilcomayo y Bermejo.",
        "population": 35000,
        "area_km2": 25951,
        "basin": "Cuenca del Río Bermejo/Pilcomayo"
    },
    "anta": {
        "name": "Anta",
        "lat": -25.1333,
        "lon": -64.0667,
        "elevation": 480,
        "risk_base": 3,
        "rivers": ["Río Juramento", "Río del Valle"],
        "description": "Gran extensión chaqueña con riesgo alto por desborde del Juramento.",
        "population": 60000,
        "area_km2": 21925,
        "basin": "Cuenca del Río Juramento"
    },
    "metan": {
        "name": "Metán",
        "lat": -25.5000,
        "lon": -64.9667,
        "elevation": 850,
        "risk_base": 2,
        "rivers": ["Río Metán", "Río Juramento"],
        "description": "Riesgo moderado, zona de transición entre llanura y sierra.",
        "population": 50000,
        "area_km2": 5235,
        "basin": "Cuenca del Río Juramento"
    },
    "rosario_frontera": {
        "name": "Rosario de la Frontera",
        "lat": -25.8000,
        "lon": -64.9667,
        "elevation": 780,
        "risk_base": 2,
        "rivers": ["Río Rosario", "Río Horcones"],
        "description": "Zona de sierras subandinas con riesgo moderado.",
        "population": 35000,
        "area_km2": 5402,
        "basin": "Cuenca del Río Juramento"
    },
    "la_candelaria": {
        "name": "La Candelaria",
        "lat": -26.1000,
        "lon": -65.1000,
        "elevation": 900,
        "risk_base": 1,
        "rivers": ["Arroyo La Candelaria"],
        "description": "Zona serrana con bajo riesgo de inundación.",
        "population": 6500,
        "area_km2": 1525,
        "basin": "Cuenca del Río Juramento"
    },
    "guachipas": {
        "name": "Guachipas",
        "lat": -25.5333,
        "lon": -65.5000,
        "elevation": 1350,
        "risk_base": 1,
        "rivers": ["Río Guachipas", "Río Alemanía"],
        "description": "Zona montañosa con bajo riesgo general.",
        "population": 4000,
        "area_km2": 2785,
        "basin": "Cuenca del Río Juramento"
    },
    "la_vina": {
        "name": "La Viña",
        "lat": -25.4667,
        "lon": -65.5667,
        "elevation": 1200,
        "risk_base": 1,
        "rivers": ["Río Ampascachi"],
        "description": "Valle de Lerma sur, riesgo bajo.",
        "population": 8000,
        "area_km2": 2152,
        "basin": "Cuenca del Río Juramento"
    },
    "cafayate": {
        "name": "Cafayate",
        "lat": -26.0667,
        "lon": -65.9833,
        "elevation": 1660,
        "risk_base": 1,
        "rivers": ["Río Santa María", "Río Calchaquí"],
        "description": "Valles Calchaquíes, clima árido, bajo riesgo de inundación.",
        "population": 16000,
        "area_km2": 1570,
        "basin": "Cuenca del Río Juramento"
    },
    "san_carlos": {
        "name": "San Carlos",
        "lat": -25.8833,
        "lon": -65.9333,
        "elevation": 1620,
        "risk_base": 1,
        "rivers": ["Río Calchaquí"],
        "description": "Valles Calchaquíes, clima seco con riesgo bajo.",
        "population": 8000,
        "area_km2": 5125,
        "basin": "Cuenca del Río Juramento"
    },
    "molinos": {
        "name": "Molinos",
        "lat": -25.4333,
        "lon": -66.3000,
        "elevation": 2020,
        "risk_base": 1,
        "rivers": ["Río Calchaquí", "Río Molinos"],
        "description": "Zona árida de los Valles Calchaquíes.",
        "population": 6000,
        "area_km2": 3500,
        "basin": "Cuenca del Río Juramento"
    },
    "cachi": {
        "name": "Cachi",
        "lat": -25.1167,
        "lon": -66.1667,
        "elevation": 2280,
        "risk_base": 1,
        "rivers": ["Río Cachi", "Río Calchaquí"],
        "description": "Alta montaña, clima árido, riesgo muy bajo de inundación.",
        "population": 8000,
        "area_km2": 2925,
        "basin": "Cuenca del Río Juramento"
    },
    "la_poma": {
        "name": "La Poma",
        "lat": -24.7167,
        "lon": -66.2000,
        "elevation": 3015,
        "risk_base": 1,
        "rivers": ["Río Calchaquí"],
        "description": "Zona de puna, extremadamente árida.",
        "population": 2000,
        "area_km2": 4447,
        "basin": "Cuenca del Río Juramento"
    },
    "los_andes": {
        "name": "Los Andes",
        "lat": -24.2167,
        "lon": -66.7667,
        "elevation": 3775,
        "risk_base": 1,
        "rivers": ["Salar de Pocitos"],
        "description": "Puna andina, clima desértico de altura, riesgo mínimo.",
        "population": 7000,
        "area_km2": 25636,
        "basin": "Cuenca de la Puna"
    },
    "iruya": {
        "name": "Iruya",
        "lat": -22.7833,
        "lon": -65.2167,
        "elevation": 2780,
        "risk_base": 3,
        "rivers": ["Río Iruya", "Río Colanzulí"],
        "description": "Zona de quebradas profundas con alto riesgo de aluviones y crecidas repentinas.",
        "population": 6500,
        "area_km2": 3515,
        "basin": "Cuenca del Río Bermejo"
    },
    "santa_victoria": {
        "name": "Santa Victoria",
        "lat": -22.2500,
        "lon": -64.9667,
        "elevation": 2400,
        "risk_base": 3,
        "rivers": ["Río Bermejo", "Río Santa Victoria"],
        "description": "Zona fronteriza con Bolivia, riesgo alto por crecidas en épocas de lluvias.",
        "population": 12000,
        "area_km2": 3913,
        "basin": "Cuenca del Río Bermejo"
    }
}

# ─── Zonas de riesgo específicas de Salta Capital ────────────────
CAPITAL_RISK_ZONES = [
    {
        "name": "Barrio Limache",
        "lat": -24.7750,
        "lon": -65.4100,
        "risk": 4,
        "description": "Zona baja cercana al Río Arenales, históricamente afectada por inundaciones."
    },
    {
        "name": "Villa Chartas",
        "lat": -24.7900,
        "lon": -65.4350,
        "risk": 3,
        "description": "Zona de riesgo por escurrimiento pluvial y cercanía a arroyos."
    },
    {
        "name": "Barrio Santa Ana",
        "lat": -24.7650,
        "lon": -65.4180,
        "risk": 3,
        "description": "Riesgo por cercanía al Río Vaqueros y topografía baja."
    },
    {
        "name": "Zona Sur - San Luis",
        "lat": -24.8100,
        "lon": -65.4280,
        "risk": 3,
        "description": "Acumulación de agua por déficit de infraestructura pluvial."
    },
    {
        "name": "Parque Industrial",
        "lat": -24.8200,
        "lon": -65.4500,
        "risk": 2,
        "description": "Zona baja con riesgo moderado por escurrimiento."
    },
    {
        "name": "Centro Histórico",
        "lat": -24.7880,
        "lon": -65.4107,
        "risk": 2,
        "description": "Riesgo moderado por concentración urbana y antigüedad del drenaje."
    },
    {
        "name": "Tres Cerritos",
        "lat": -24.7700,
        "lon": -65.3900,
        "risk": 1,
        "description": "Zona alta con buen drenaje natural."
    },
    {
        "name": "Grand Bourg",
        "lat": -24.7600,
        "lon": -65.4050,
        "risk": 1,
        "description": "Zona elevada con bajo riesgo."
    }
]

# ─── Nombres de niveles de alerta ────────────────────────────────
ALERT_LEVELS = {
    1: {"name": "Normal", "color": "#22c55e", "icon": "🟢", "description": "Sin riesgo significativo"},
    2: {"name": "Precaución", "color": "#eab308", "icon": "🟡", "description": "Monitorear condiciones"},
    3: {"name": "Alerta", "color": "#f97316", "icon": "🟠", "description": "Riesgo elevado de inundación"},
    4: {"name": "Emergencia", "color": "#ef4444", "icon": "🔴", "description": "Peligro inminente de inundación"}
}

# ─── Red Hidrográfica de Salta (Líneas y estaciones de monitoreo) ─
SALTA_RIVERS = [
    {
        "id": "rio_bermejo",
        "name": "Río Bermejo",
        "basin": "Cuenca del Río Bermejo",
        "danger_level": 4,
        "path": [
            [-64.9667, -22.2500],
            [-64.5000, -22.7000],
            [-64.3333, -23.1333],
            [-63.8000, -23.1800],
            [-62.8833, -23.2000]
        ],
        "station": {"lat": -23.1333, "lon": -64.3333, "name": "Estación Orán / Bermejo"}
    },
    {
        "id": "rio_pilcomayo",
        "name": "Río Pilcomayo",
        "basin": "Cuenca del Río Pilcomayo",
        "danger_level": 4,
        "path": [
            [-63.6667, -22.1000],
            [-63.0000, -22.4000],
            [-62.4000, -22.7500],
            [-62.0000, -23.1000]
        ],
        "station": {"lat": -22.2833, "lon": -63.6667, "name": "Estación Misión La Paz"}
    },
    {
        "id": "rio_arenales",
        "name": "Río Arenales",
        "basin": "Cuenca del Río Juramento",
        "danger_level": 3,
        "path": [
            [-65.5000, -24.7200],
            [-65.4500, -24.7600],
            [-65.4100, -24.7800],
            [-65.3800, -24.8500],
            [-65.4200, -25.2000]
        ],
        "station": {"lat": -24.7821, "lon": -65.4232, "name": "Estación Salta Capital"}
    },
    {
        "id": "rio_vaqueros",
        "name": "Río Vaqueros",
        "basin": "Cuenca del Río Juramento",
        "danger_level": 3,
        "path": [
            [-65.4000, -24.6200],
            [-65.4100, -24.7000],
            [-65.4180, -24.7650]
        ],
        "station": {"lat": -24.7650, "lon": -65.4180, "name": "Estación Vaqueros"}
    },
    {
        "id": "rio_juramento",
        "name": "Río Juramento (Pasaje)",
        "basin": "Cuenca del Río Juramento",
        "danger_level": 3,
        "path": [
            [-65.4200, -25.2000],
            [-64.9667, -25.5000],
            [-64.4000, -25.3000],
            [-64.0667, -25.1333],
            [-63.5000, -25.4000]
        ],
        "station": {"lat": -25.1333, "lon": -64.0667, "name": "Estación El Tunal / Anta"}
    },
    {
        "id": "rio_rosario",
        "name": "Río Rosario / Toro",
        "basin": "Cuenca del Río Juramento",
        "danger_level": 2,
        "path": [
            [-65.7000, -24.9000],
            [-65.5833, -24.9833],
            [-65.4833, -24.9000],
            [-65.4200, -25.1000]
        ],
        "station": {"lat": -24.9833, "lon": -65.5833, "name": "Estación Campo Quijano"}
    },
    {
        "id": "rio_calchaqui",
        "name": "Río Calchaquí",
        "basin": "Cuenca del Río Juramento",
        "danger_level": 1,
        "path": [
            [-66.2000, -24.7167],
            [-66.1667, -25.1167],
            [-66.3000, -25.4333],
            [-65.9333, -25.8833],
            [-65.9833, -26.0667]
        ],
        "station": {"lat": -26.0667, "lon": -65.9833, "name": "Estación Cafayate"}
    },
    {
        "id": "rio_mojotoro",
        "name": "Río Mojotoro / Lavayén",
        "basin": "Cuenca del Río Bermejo",
        "danger_level": 3,
        "path": [
            [-65.3667, -24.5833],
            [-65.0500, -24.6667],
            [-64.7000, -24.4000],
            [-64.3333, -24.1000]
        ],
        "station": {"lat": -24.6667, "lon": -65.0500, "name": "Estación Güemes"}
    }
]

# ─── Cuencas Hidrográficas Principales de la Provincia ─────────────
SALTA_BASINS = [
    {
        "name": "Cuenca del Río Bermejo",
        "color": "#f97316",
        "center": [-64.2, -23.0],
        "risk_summary": "Alta precipitación subtropical en Yungas. Crecidas violentas en época estival.",
        "departments": ["oran", "san_martin", "rivadavia", "la_caldera", "gral_guemes", "iruya", "santa_victoria"]
    },
    {
        "name": "Cuenca del Río Juramento / Pasaje",
        "color": "#0ea5e9",
        "center": [-65.1, -25.0],
        "risk_summary": "Drena el Valle de Lerma y la Cuenca del Arenales hacia el Embalse Cabra Corral y Chaco Salteño.",
        "departments": ["capital", "cerrillos", "rosario_lerma", "chicoana", "anta", "metan", "rosario_frontera", "la_candelaria", "guachipas", "la_vina"]
    },
    {
        "name": "Cuenca de los Valles Calchaquíes",
        "color": "#eab308",
        "center": [-66.1, -25.5],
        "risk_summary": "Régimen árido a semiárido. Riesgo concentrado en aluviones de quebradas de alta pendiente.",
        "departments": ["cafayate", "san_carlos", "molinos", "cachi", "la_poma"]
    },
    {
        "name": "Cuenca Endorreica de la Puna",
        "color": "#a855f7",
        "center": [-66.8, -24.3],
        "risk_summary": "Cuencas cerradas y salares de alta montaña (>3500m). Riesgo de inundación muy bajo.",
        "departments": ["los_andes"]
    }
]


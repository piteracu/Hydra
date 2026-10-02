"""
═══════════════════════════════════════════════════════════════════════════════
SALTA WEATHER SMART MAPPING — OPEN-METEO & ARCGIS API FOR PYTHON
═══════════════════════════════════════════════════════════════════════════════
Script modular para la obtención de datos meteorológicos en tiempo real desde
Open-Meteo para los departamentos de la Provincia de Salta, Argentina, y su
representación temática mediante la ArcGIS API for Python.
"""

import json
import logging
import requests
import pandas as pd
from typing import Dict, List, Any

# Configuración de Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SaltaWeatherArcGIS")

# ─────────────────────────────────────────────────────────────────────────────
# 1. GEOMETRÍA / CENTROIDES DE LOS DEPARTAMENTOS DE SALTA
# ─────────────────────────────────────────────────────────────────────────────
SALTA_DEPARTMENTS = [
    {"id": "capital", "name": "Capital", "lat": -24.7821, "lon": -65.4232, "elevation": 1187, "basin": "Cuenca del Río Juramento"},
    {"id": "cerrillos", "name": "Cerrillos", "lat": -24.9000, "lon": -65.4833, "elevation": 1170, "basin": "Cuenca del Río Juramento"},
    {"id": "rosario_lerma", "name": "Rosario de Lerma", "lat": -24.9833, "lon": -65.5833, "elevation": 1330, "basin": "Cuenca del Río Juramento"},
    {"id": "chicoana", "name": "Chicoana", "lat": -25.1000, "lon": -65.5333, "elevation": 1270, "basin": "Cuenca del Río Juramento"},
    {"id": "la_vina", "name": "La Viña", "lat": -25.4667, "lon": -65.5667, "elevation": 1220, "basin": "Cuenca del Río Juramento"},
    {"id": "guachipas", "name": "Guachipas", "lat": -25.5167, "lon": -65.5167, "elevation": 1150, "basin": "Cuenca del Río Juramento"},
    {"id": "cafayate", "name": "Cafayate", "lat": -26.0731, "lon": -65.9772, "elevation": 1683, "basin": "Cuenca Calchaquí"},
    {"id": "san_carlos", "name": "San Carlos", "lat": -25.8833, "lon": -65.9333, "elevation": 1620, "basin": "Cuenca Calchaquí"},
    {"id": "molinos", "name": "Molinos", "lat": -25.4333, "lon": -66.3000, "elevation": 2020, "basin": "Cuenca Calchaquí"},
    {"id": "cachi", "name": "Cachi", "lat": -25.1167, "lon": -66.1667, "elevation": 2280, "basin": "Cuenca Calchaquí"},
    {"id": "la_poma", "name": "La Poma", "lat": -24.7167, "lon": -66.2000, "elevation": 3015, "basin": "Cuenca Calchaquí"},
    {"id": "rosario_frontera", "name": "Rosario de la Frontera", "lat": -25.7974, "lon": -64.9701, "elevation": 790, "basin": "Cuenca del Río Pasaje/Juramento"},
    {"id": "metan", "name": "Metán", "lat": -25.4967, "lon": -64.9727, "elevation": 850, "basin": "Cuenca del Río Pasaje/Juramento"},
    {"id": "candelaria", "name": "La Candelaria", "lat": -26.1333, "lon": -65.0500, "elevation": 890, "basin": "Cuenca Sur Salteña"},
    {"id": "general_guemes", "name": "General Güemes", "lat": -24.6667, "lon": -65.0500, "elevation": 740, "basin": "Cuenca del Río Mojotoro"},
    {"id": "la_caldera", "name": "La Caldera", "lat": -24.6000, "lon": -65.3833, "elevation": 1420, "basin": "Cuenca del Río Mojotoro"},
    {"id": "oran", "name": "San Ramón de la Nueva Orán", "lat": -23.1322, "lon": -64.3262, "elevation": 337, "basin": "Cuenca del Río Bermejo"},
    {"id": "san_martin", "name": "General José de San Martín (Tartagal)", "lat": -22.5164, "lon": -63.8013, "elevation": 450, "basin": "Cuenca del Río Bermejo"},
    {"id": "rivadavia", "name": "Rivadavia", "lat": -24.1833, "lon": -62.8833, "elevation": 205, "basin": "Cuenca del Río Bermejo / Pilcomayo"},
    {"id": "santa_victoria", "name": "Santa Victoria", "lat": -22.2667, "lon": -64.9667, "elevation": 2380, "basin": "Cuenca Alta del Bermejo"},
    {"id": "iruya", "name": "Iruya", "lat": -22.7914, "lon": -65.2161, "elevation": 2780, "basin": "Cuenca Alta del Bermejo"},
    {"id": "anta", "name": "Anta (Joaquín V. González)", "lat": -25.0833, "lon": -64.1833, "elevation": 360, "basin": "Cuenca del Juramento / Chaco"},
    {"id": "los_andes", "name": "Los Andes (San Antonio de los Cobres)", "lat": -24.2167, "lon": -66.3167, "elevation": 3775, "basin": "Cuenca Puna / Salares"}
]

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


# ─────────────────────────────────────────────────────────────────────────────
# 2. CONSUMO DE OPEN-METEO EN TIEMPO REAL
# ─────────────────────────────────────────────────────────────────────────────
def fetch_salta_weather_data(departments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Consulta la API de Open-Meteo en tiempo real para las coordenadas
    de cada departamento de Salta.
    """
    logger.info("Solicitando datos meteorológicos a Open-Meteo...")
    weather_records = []

    for dept in departments:
        params = {
            "latitude": dept["lat"],
            "longitude": dept["lon"],
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "wind_speed_10m",
                "wind_direction_10m",
                "weather_code",
                "surface_pressure"
            ],
            "timezone": "America/Argentina/Salta"
        }

        try:
            resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            current = data.get("current", {})
            record = {
                "dept_id": dept["id"],
                "department_name": dept["name"],
                "lat": dept["lat"],
                "lon": dept["lon"],
                "elevation_m": dept["elevation"],
                "basin": dept["basin"],
                "temperature_c": current.get("temperature_2m", 0.0),
                "humidity_pct": current.get("relative_humidity_2m", 0.0),
                "precipitation_mm": current.get("precipitation", 0.0),
                "wind_speed_kmh": current.get("wind_speed_10m", 0.0),
                "wind_direction_deg": current.get("wind_direction_10m", 0),
                "weather_code": current.get("weather_code", 0),
                "timestamp": current.get("time", "")
            }
            weather_records.append(record)
            logger.info(f"  ✓ {dept['name']}: {record['temperature_c']}°C | Lluvia: {record['precipitation_mm']}mm | Viento: {record['wind_speed_kmh']}km/h ({record['wind_direction_deg']}°)")

        except Exception as e:
            logger.error(f"  ✗ Error consultando datos para {dept['name']}: {e}")

    return weather_records


# ─────────────────────────────────────────────────────────────────────────────
# 3. ESTRUCTURACIÓN ESPACIAL CON ARCGIS SPATIALLY ENABLED DATAFRAME (SeDF)
# ─────────────────────────────────────────────────────────────────────────────
def build_spatially_enabled_dataframe(records: List[Dict[str, Any]]):
    """
    Convierte la lista de registros en un Pandas DataFrame y lo extiende a un
    Spatially Enabled DataFrame (SeDF) apto para la ArcGIS API for Python.
    """
    df = pd.DataFrame(records)
    logger.info(f"DataFrame creado con {len(df)} departamentos salteños.")

    try:
        from arcgis.features import GeoAccessor, GeoSeriesAccessor
        # Convierte coordenadas lat/lon en geometría espacial Point (WGS84 EPSG:4326)
        sedf = pd.DataFrame.spatial.from_xy(df, x_col='lon', y_col='lat', sr=4326)
        logger.info("Spatially Enabled DataFrame (SeDF) generado con éxito.")
        return sedf
    except Exception as e:
        logger.warning(f"No se pudo instanciar SeDF nativo de ArcGIS ({e}). Retornando DataFrame estándar.")
        return df


# ─────────────────────────────────────────────────────────────────────────────
# 4. CONFIGURACIÓN DE SIMBOLOGÍA TEMÁTICA POR CAPAS (SMART MAPPING)
# ─────────────────────────────────────────────────────────────────────────────
def get_calor_temperature_renderer() -> Dict[str, Any]:
    """
    Simbología Smart Mapping para CALOR / TEMPERATURA:
    Rampa de colores cálidos (Amarillo -> Naranja -> Rojo) basada en 'temperature_c'.
    """
    return {
        "renderer": "ClassedColorRenderer",
        "field_name": "temperature_c",
        "visual_variables": [
            {
                "type": "colorInfo",
                "field": "temperature_c",
                "stops": [
                    {"value": 5, "color": [255, 255, 178, 255], "label": "< 5°C (Frío)"},
                    {"value": 15, "color": [254, 204, 92, 255], "label": "15°C (Templado)"},
                    {"value": 25, "color": [253, 141, 60, 255], "label": "25°C (Cálido)"},
                    {"value": 35, "color": [227, 26, 28, 255], "label": "> 35°C (Calor Intenso)"}
                ]
            },
            {
                "type": "sizeInfo",
                "field": "temperature_c",
                "minSize": 12,
                "maxSize": 28,
                "minDataValue": 0,
                "maxDataValue": 40
            }
        ]
    }


def get_agua_precipitation_renderer() -> Dict[str, Any]:
    """
    Simbología Smart Mapping para AGUA / PRECIPITACIÓN:
    Gradiente de tonos azules basado en 'precipitation_mm' y 'humidity_pct'.
    """
    return {
        "renderer": "ClassedColorRenderer",
        "field_name": "precipitation_mm",
        "visual_variables": [
            {
                "type": "colorInfo",
                "field": "precipitation_mm",
                "stops": [
                    {"value": 0, "color": [222, 235, 247, 200], "label": "Sin lluvia (0 mm)"},
                    {"value": 5, "color": [158, 202, 225, 230], "label": "Lluvia Leve (5 mm)"},
                    {"value": 20, "color": [66, 146, 198, 240], "label": "Lluvia Moderada (20 mm)"},
                    {"value": 50, "color": [8, 81, 156, 255], "label": "Lluvia Intensa (> 50 mm)"}
                ]
            },
            {
                "type": "sizeInfo",
                "field": "humidity_pct",
                "minSize": 10,
                "maxSize": 30,
                "minDataValue": 20,
                "maxDataValue": 100
            }
        ]
    }


def get_aire_wind_vector_renderer() -> Dict[str, Any]:
    """
    Simbología Smart Mapping para AIRE / VIENTO:
    Vectores con rotación espacial según 'wind_direction_deg' y tamaño/color por 'wind_speed_kmh'.
    """
    return {
        "renderer": "SimpleRenderer",
        "field_name": "wind_speed_kmh",
        "symbol": {
            "type": "esriSMS",
            "style": "esriSMSSquare",
            "color": [56, 189, 248, 220],
            "size": 16,
            "outline": {"color": [255, 255, 255, 255], "width": 1.5}
        },
        "visual_variables": [
            {
                "type": "rotationInfo",
                "field": "wind_direction_deg",
                "rotationType": "geographic"  # 0° = Norte, 90° = Este
            },
            {
                "type": "colorInfo",
                "field": "wind_speed_kmh",
                "stops": [
                    {"value": 0, "color": [203, 213, 225, 255], "label": "Calma (< 5 km/h)"},
                    {"value": 15, "color": [56, 189, 248, 255], "label": "Brisa (15 km/h)"},
                    {"value": 35, "color": [168, 85, 247, 255], "label": "Viento Fuerte (35 km/h)"},
                    {"value": 60, "color": [236, 72, 153, 255], "label": "Temporal (> 60 km/h)"}
                ]
            },
            {
                "type": "sizeInfo",
                "field": "wind_speed_kmh",
                "minSize": 10,
                "maxSize": 32,
                "minDataValue": 0,
                "maxDataValue": 70
            }
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. VISUALIZACIÓN INTERACTIVA CON ARCGIS MAP WIDGET / WEBMAP
# ─────────────────────────────────────────────────────────────────────────────
def generate_salta_weather_webmap(sedf):
    """
    Crea la instancia GIS y el mapa interactivo centrado en Salta, cargando
    las capas con Smart Mapping.
    """
    logger.info("Inicializando mapa interactivo ArcGIS...")
    try:
        from arcgis.gis import GIS
        gis = GIS()  # Conexión anónima a ArcGIS Online
        
        # Mapa centrado en la Provincia de Salta (-24.78, -65.42)
        salta_map = gis.map("Salta, Argentina", zoom=7)
        salta_map.basemap = "dark-gray-vector"

        logger.info("Añadiendo Capas Temáticas de Open-Meteo al Mapa:")
        
        # Capa 1: Calor / Temperatura
        salta_map.add_layer(
            sedf,
            options={
                "title": "🔥 Calor / Temperatura (°C)",
                "renderer": get_calor_temperature_renderer()["renderer"],
                "visual_variables": get_calor_temperature_renderer()["visual_variables"]
            }
        )
        logger.info("  ✓ Capa añadida: Calor / Temperatura (°C)")

        # Capa 2: Agua / Precipitación
        salta_map.add_layer(
            sedf,
            options={
                "title": "🌧️ Agua / Lluvia (mm) & Humedad (%)",
                "renderer": get_agua_precipitation_renderer()["renderer"],
                "visual_variables": get_agua_precipitation_renderer()["visual_variables"]
            }
        )
        logger.info("  ✓ Capa añadida: Agua / Precipitación (mm)")

        # Capa 3: Aire / Viento
        salta_map.add_layer(
            sedf,
            options={
                "title": "💨 Aire / Vectores de Viento (km/h & Dirección)",
                "renderer": get_aire_wind_vector_renderer()["renderer"],
                "visual_variables": get_aire_wind_vector_renderer()["visual_variables"]
            }
        )
        logger.info("  ✓ Capa añadida: Aire / Vectores de Viento")

        return salta_map

    except Exception as e:
        logger.error(f"Error generando el mapa con ArcGIS API for Python: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 80)
    print("   MONITOREO METEOROLÓGICO SALTA — OPEN-METEO & ARCGIS API FOR PYTHON")
    print("=" * 80)

    # Paso 1: Consultar Open-Meteo
    weather_data = fetch_salta_weather_data(SALTA_DEPARTMENTS)

    # Paso 2: Crear Spatially Enabled DataFrame
    sedf = build_spatially_enabled_dataframe(weather_data)

    # Imprimir muestra tabular de datos meteorológicos
    print("\n📊 Muestra de datos procesados:")
    display_cols = ["department_name", "temperature_c", "humidity_pct", "precipitation_mm", "wind_speed_kmh", "wind_direction_deg"]
    print(sedf[display_cols].head(10).to_string(index=False))

    # Paso 3: Generar Mapa Interactivo ArcGIS
    salta_map = generate_salta_weather_webmap(sedf)

    if salta_map:
        print("\n✅ Mapa Web interactivo ArcGIS listo.")
        print("💡 Para visualizar el mapa en un entorno Jupyter Notebook, ejecute simplemente:")
        print("   >>> salta_map")

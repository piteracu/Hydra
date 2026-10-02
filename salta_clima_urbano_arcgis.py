"""
═══════════════════════════════════════════════════════════════════════════════
SALTA URBAN STREET CLIMATE — ARCGIS API FOR PYTHON
═══════════════════════════════════════════════════════════════════════════════
Script modular para obtener y representar condiciones climáticas a escala urbana
y de manzana en la Ciudad de Salta, superponiendo capas vectoriales y ráster
translúcidas (Calor, Agua, Aire) directamente sobre el callejero vectorial de alta
definición de ArcGIS.
"""

import logging
import requests
import pandas as pd
from typing import Dict, List, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SaltaUrbanClimateGIS")

# ─────────────────────────────────────────────────────────────────────────────
# 1. GENERADOR ESPACIAL URBANO PARA TODOS LOS DEPARTAMENTOS DE SALTA
# ─────────────────────────────────────────────────────────────────────────────
SALTA_DEPARTMENTS_URBAN = [
    {"id": "capital", "name": "Capital (Salta)", "lat": -24.7821, "lon": -65.4232},
    {"id": "oran", "name": "San Ramón de la Nueva Orán", "lat": -23.1333, "lon": -64.3333},
    {"id": "san_martin", "name": "General José de San Martín (Tartagal)", "lat": -22.2833, "lon": -63.6667},
    {"id": "cafayate", "name": "Cafayate", "lat": -26.0667, "lon": -65.9833},
    {"id": "metan", "name": "Metán", "lat": -25.5000, "lon": -64.9667},
    {"id": "rosario_frontera", "name": "Rosario de la Frontera", "lat": -25.8000, "lon": -64.9667},
    {"id": "cachi", "name": "Cachi", "lat": -25.1167, "lon": -66.1667},
    {"id": "general_guemes", "name": "General Güemes", "lat": -24.6667, "lon": -65.0500},
    {"id": "rosario_lerma", "name": "Rosario de Lerma", "lat": -24.9833, "lon": -65.5833},
    {"id": "cerrillos", "name": "Cerrillos", "lat": -24.9000, "lon": -65.4833},
    {"id": "chicoana", "name": "Chicoana", "lat": -25.1000, "lon": -65.5333},
    {"id": "anta", "name": "Anta (Joaquín V. González)", "lat": -25.1333, "lon": -64.0667},
    {"id": "iruya", "name": "Iruya", "lat": -22.7914, "lon": -65.2161},
    {"id": "santa_victoria", "name": "Santa Victoria", "lat": -22.2667, "lon": -64.9667},
    {"id": "rivadavia", "name": "Rivadavia", "lat": -23.2000, "lon": -62.8833},
    {"id": "molinos", "name": "Molinos", "lat": -25.4333, "lon": -66.3000},
    {"id": "san_carlos", "name": "San Carlos", "lat": -25.8833, "lon": -65.9333},
    {"id": "la_poma", "name": "La Poma", "lat": -24.7167, "lon": -66.2000},
    {"id": "la_vina", "name": "La Viña", "lat": -25.4667, "lon": -65.5667},
    {"id": "guachipas", "name": "Guachipas", "lat": -25.5333, "lon": -65.5000},
    {"id": "candelaria", "name": "La Candelaria", "lat": -26.1000, "lon": -65.1000},
    {"id": "la_caldera", "name": "La Caldera", "lat": -24.5833, "lon": -65.3667},
    {"id": "los_andes", "name": "Los Andes (San Antonio de los Cobres)", "lat": -24.2167, "lon": -66.3167}
]


def generate_urban_street_climate_data(dept_info: Dict[str, Any]):
    """
    Genera capas de clima urbano a escala de manzana y calle para
    cualquier departamento de la Provincia de Salta.
    """
    lat, lon, name = dept_info["lat"], dept_info["lon"], dept_info["name"]

    heat_blocks = [
        {"block_id": "microcentro", "name": f"Centro Comercial & Asfalto — {name}", "lat": lat, "lon": lon, "temp_c": 31.5, "type": "Isla de Calor Alta"},
        {"block_id": "periferia", "name": f"Barrios & Avenidas — {name}", "lat": lat + 0.005, "lon": lon + 0.005, "temp_c": 28.0, "type": "Retención Térmica Media"},
        {"block_id": "verde", "name": f"Pie de Monte & Parque — {name}", "lat": lat - 0.005, "lon": lon - 0.005, "temp_c": 23.2, "type": "Microclima Fresco"}
    ]

    street_runoffs = [
        {"street_id": "av_principal", "name": f"Av. Principal San Martín / Belgrano ({name})", "lat": lat, "lon": lon, "flow_mmh": 45.0, "status": "Escurrimiento Rápido"},
        {"street_id": "badenes", "name": f"Corredor Comercial / Badenes ({name})", "lat": lat + 0.002, "lon": lon - 0.003, "flow_mmh": 78.0, "status": "Riesgo de Acumulación"},
        {"street_id": "cauce", "name": f"Cauce / Canal Urbano ({name})", "lat": lat - 0.004, "lon": lon + 0.004, "flow_mmh": 105.0, "status": "Cauce Crítico"}
    ]

    wind_corridors = [
        {"corridor_id": "wind_1", "name": f"Cañón Urbano Avenidas ({name})", "lat": lat + 0.002, "lon": lon + 0.002, "speed_kmh": 26.0, "dir_deg": 45},
        {"corridor_id": "wind_2", "name": f"Corredor Eólico Periférico ({name})", "lat": lat - 0.003, "lon": lon - 0.002, "speed_kmh": 36.0, "dir_deg": 120}
    ]

    return heat_blocks, street_runoffs, wind_corridors

# ─────────────────────────────────────────────────────────────────────────────
# 2. TRANSFORMACIÓN A SPATIALLY ENABLED DATAFRAME (SeDF) URBANO
# ─────────────────────────────────────────────────────────────────────────────
def build_urban_spatially_enabled_df(records: List[Dict[str, Any]]):
    """Convierte los datos microclimáticos urbanos en un Spatially Enabled DataFrame (SeDF)."""
    df = pd.DataFrame(records)
    try:
        from arcgis.features import GeoAccessor, GeoSeriesAccessor
        sedf = pd.DataFrame.spatial.from_xy(df, x_col='lon', y_col='lat', sr=4326)
        logger.info("Spatially Enabled DataFrame Urbano (SeDF) generado correctamente.")
        return sedf
    except Exception as e:
        logger.warning(f"Generando DataFrame convencional de Pandas ({e}).")
        return df

# ─────────────────────────────────────────────────────────────────────────────
# 3. RENDERIZADO CLIMÁTICO SOBRE EL CALLEJERO (SMART MAPPING URBANO)
# ─────────────────────────────────────────────────────────────────────────────
def get_urban_heat_renderer() -> Dict[str, Any]:
    """Malla de Calor Urbano (Heatmap / Gradiente sobre la retícula de calles)."""
    return {
        "renderer": "ClassedColorRenderer",
        "field_name": "temp_c",
        "visual_variables": [
            {
                "type": "colorInfo",
                "field": "temp_c",
                "stops": [
                    {"value": 22, "color": [255, 255, 178, 200], "label": "22°C (Vegetación / Quebrada)"},
                    {"value": 27, "color": [253, 141, 60, 220], "label": "27°C (Residencial)"},
                    {"value": 33, "color": [227, 26, 28, 240], "label": "> 33°C (Isla de Calor Asfalto)"}
                ]
            },
            {"type": "sizeInfo", "field": "temp_c", "minSize": 18, "maxSize": 38, "minDataValue": 20, "maxDataValue": 40}
        ]
    }

def get_urban_rain_runoff_renderer() -> Dict[str, Any]:
    """Escurrimiento de Agua proyectado sobre el trazado de avenidas."""
    return {
        "renderer": "ClassedColorRenderer",
        "field_name": "flow_mmh",
        "visual_variables": [
            {
                "type": "colorInfo",
                "field": "flow_mmh",
                "stops": [
                    {"value": 30, "color": [158, 202, 225, 220], "label": "Escurrimiento Leve"},
                    {"value": 60, "color": [66, 146, 198, 235], "label": "Escurrimiento Moderado"},
                    {"value": 100, "color": [8, 81, 156, 250], "label": "Canal / Cauce Crítico"}
                ]
            },
            {"type": "sizeInfo", "field": "flow_mmh", "minSize": 14, "maxSize": 32, "minDataValue": 20, "maxDataValue": 120}
        ]
    }

def get_urban_wind_stream_renderer() -> Dict[str, Any]:
    """Vectores de Corriente de Viento en cañones urbanos."""
    return {
        "renderer": "SimpleRenderer",
        "field_name": "speed_kmh",
        "visual_variables": [
            {"type": "rotationInfo", "field": "dir_deg", "rotationType": "geographic"},
            {
                "type": "colorInfo",
                "field": "speed_kmh",
                "stops": [
                    {"value": 10, "color": [203, 213, 225, 220], "label": "Brisa de Calle (< 15 km/h)"},
                    {"value": 30, "color": [168, 85, 247, 240], "label": "Corriente de Cañón Urbano (30 km/h)"},
                    {"value": 50, "color": [236, 72, 153, 255], "label": "Ráfaga Eólica (> 50 km/h)"}
                ]
            }
        ]
    }

# ─────────────────────────────────────────────────────────────────────────────
# 4. WEBMAP URBANO EN ALTA DEFINICIÓN (STREETS NAVIGATION VECTOR)
# ─────────────────────────────────────────────────────────────────────────────
def generate_salta_urban_street_webmap(heat_sedf, rain_sedf, wind_sedf):
    """Genera el mapa interactivo ArcGIS a escala urbana en la Ciudad de Salta."""
    logger.info("Inicializando Mapa Urbano de Calles ArcGIS...")
    try:
        from arcgis.gis import GIS
        gis = GIS()

        # Mapa centrado a nivel de calle/manzana en Salta (Zoom 15)
        urban_map = gis.map("Salta, Capital, Argentina", zoom=15)
        urban_map.basemap = "streets-navigation-vector"  # Callejero de alta definición

        # Capa 1: Malla de Calor Urbano
        urban_map.add_layer(heat_sedf, options={"title": "🔥 Malla de Calor Urbano (°C)", **get_urban_heat_renderer()})

        # Capa 2: Escurrimiento en Trazado de Calles
        urban_map.add_layer(rain_sedf, options={"title": "🌧️ Escurrimiento en Avenidas (mm/h)", **get_urban_rain_runoff_renderer()})

        # Capa 3: Corrientes de Viento en Cañones Urbanos
        urban_map.add_layer(wind_sedf, options={"title": "💨 Vectores de Viento Urbano (km/h & Azimut)", **get_urban_wind_stream_renderer()})

        logger.info("✅ Mapa Urbano de Calles configurado exitosamente.")
        return urban_map

    except Exception as e:
        logger.error(f"Error generando el mapa urbano con ArcGIS API for Python: {e}")
        return None

if __name__ == "__main__":
    print("=" * 80)
    print("   CLIMA URBANO PROVINCIAL SALTA SOBRE CALLEJERO — ARCGIS API FOR PYTHON")
    print("=" * 80)

    # Procesar clima urbano para el departamento elegido (ej. Capital, Orán, Tartagal, Cafayate, Cachi, etc.)
    target_dept = SALTA_DEPARTMENTS_URBAN[0]  # Capital (Salta) por defecto
    heat_blocks, street_runoffs, wind_corridors = generate_urban_street_climate_data(target_dept)

    heat_sedf = build_urban_spatially_enabled_df(heat_blocks)
    rain_sedf = build_urban_spatially_enabled_df(street_runoffs)
    wind_sedf = build_urban_spatially_enabled_df(wind_corridors)

    urban_map = generate_salta_urban_street_webmap(heat_sedf, rain_sedf, wind_sedf)
    if urban_map:
        print(f"\n✅ Mapa Web Urbano interactivo ArcGIS listo a nivel de calle para {target_dept['name']} (Zoom 15).")
        print("💡 Para desplegar en un Jupyter Notebook ejecute:")
        print("   >>> urban_map")

"""
Servicio de datos de inundaciones - Integración con Open-Meteo Flood API (GloFAS)
"""
import requests
from datetime import datetime, timedelta
import config

_flood_cache = {}
CACHE_TTL_SECONDS = 300


def get_flood_forecast(lat, lon, days=10):
    """
    Obtiene el pronóstico de descarga de ríos usando datos GloFAS.
    """
    cache_key = (round(lat, 3), round(lon, 3), days)
    now = datetime.now()
    if cache_key in _flood_cache:
        cached_data, cached_time = _flood_cache[cache_key]
        if now - cached_time < timedelta(seconds=CACHE_TTL_SECONDS):
            return cached_data

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ",".join(config.FLOOD_DAILY_VARS),
        "forecast_days": min(days, 16)
    }
    
    try:
        response = requests.get(config.OPEN_METEO_FLOOD_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        daily = data.get("daily", {})
        processed = _process_flood_data(daily)
        analysis = _analyze_flood_risk(processed)
        
        result = {
            "success": True,
            "location": {"latitude": lat, "longitude": lon},
            "daily": processed,
            "analysis": analysis,
            "updated_at": datetime.now().isoformat()
        }
        _flood_cache[cache_key] = (result, now)
        return result
    except requests.RequestException as e:
        if cache_key in _flood_cache:
            return _flood_cache[cache_key][0]
        return {"success": False, "error": str(e)}


def get_flood_data_with_context(lat, lon, dept_info=None):
    """
    Obtiene datos de inundación con contexto topográfico del departamento.
    """
    flood_data = get_flood_forecast(lat, lon)
    
    if not flood_data["success"]:
        return flood_data
    
    # Agregar contexto topográfico
    if dept_info:
        flood_data["topographic_context"] = {
            "elevation": dept_info.get("elevation", "N/A"),
            "rivers": dept_info.get("rivers", []),
            "basin": dept_info.get("basin", "N/A"),
            "base_risk": dept_info.get("risk_base", 1),
            "description": dept_info.get("description", "")
        }
    
    return flood_data


def _process_flood_data(daily):
    """Procesa los datos diarios de descarga de ríos."""
    if not daily or "time" not in daily:
        return []
    
    result = []
    times = daily.get("time", [])
    
    for i, t in enumerate(times):
        entry = {
            "date": t,
            "river_discharge": _safe_get(daily, "river_discharge", i),
            "river_discharge_mean": _safe_get(daily, "river_discharge_mean", i),
            "river_discharge_max": _safe_get(daily, "river_discharge_max", i),
            "river_discharge_min": _safe_get(daily, "river_discharge_min", i)
        }
        result.append(entry)
    
    return result


def _safe_get(data, key, index):
    """Obtiene un valor de forma segura de un array."""
    values = data.get(key, [])
    if values and index < len(values):
        val = values[index]
        return round(val, 2) if val is not None else None
    return None


def _analyze_flood_risk(daily_data):
    """
    Analiza el riesgo de inundación basado en datos de descarga.
    
    Compara la descarga actual contra la media para determinar el nivel de riesgo.
    """
    if not daily_data:
        return {
            "risk_level": 1,
            "risk_name": "Normal",
            "max_discharge": None,
            "mean_discharge": None,
            "ratio": None,
            "trend": "stable",
            "description": "Sin datos suficientes para análisis."
        }
    
    # Obtener valores actuales y medias
    discharges = [d["river_discharge"] for d in daily_data if d["river_discharge"] is not None]
    means = [d["river_discharge_mean"] for d in daily_data if d["river_discharge_mean"] is not None]
    
    if not discharges:
        return {
            "risk_level": 1,
            "risk_name": "Normal",
            "max_discharge": None,
            "mean_discharge": None,
            "ratio": None,
            "trend": "stable",
            "description": "No hay datos de descarga de ríos para esta ubicación."
        }
    
    current_discharge = discharges[0] if discharges else 0
    max_discharge = max(discharges)
    mean_discharge = means[0] if means else (sum(discharges) / len(discharges))
    
    # Calcular ratio actual/media
    ratio = current_discharge / mean_discharge if mean_discharge and mean_discharge > 0 else 0
    
    # Determinar nivel de riesgo
    if ratio >= config.RIVER_DISCHARGE_EMERGENCY:
        risk_level = 4
    elif ratio >= config.RIVER_DISCHARGE_ALERT:
        risk_level = 3
    elif ratio >= config.RIVER_DISCHARGE_CAUTION:
        risk_level = 2
    else:
        risk_level = 1
    
    # Determinar tendencia
    if len(discharges) >= 3:
        if discharges[-1] > discharges[0] * 1.2:
            trend = "rising"
        elif discharges[-1] < discharges[0] * 0.8:
            trend = "falling"
        else:
            trend = "stable"
    else:
        trend = "stable"
    
    risk_info = config.ALERT_LEVELS[risk_level]
    
    return {
        "risk_level": risk_level,
        "risk_name": risk_info["name"],
        "max_discharge": round(max_discharge, 2),
        "current_discharge": round(current_discharge, 2),
        "mean_discharge": round(mean_discharge, 2),
        "ratio": round(ratio, 2),
        "trend": trend,
        "trend_text": {"rising": "En aumento ↑", "falling": "En descenso ↓", "stable": "Estable →"}[trend],
        "description": _get_risk_description(risk_level, ratio, trend)
    }


def _get_risk_description(level, ratio, trend):
    """Genera descripción textual del riesgo."""
    descriptions = {
        1: "Los niveles de descarga de ríos se encuentran dentro de los parámetros normales. No se prevén riesgos de inundación.",
        2: "Los niveles de descarga están por encima de la media histórica. Se recomienda monitorear las condiciones y estar atento a actualizaciones.",
        3: "Los niveles de descarga son significativamente superiores a la media. Existe riesgo elevado de inundación en zonas bajas y cercanas a cauces.",
        4: "PELIGRO: Los niveles de descarga son extremadamente altos. Se recomienda evacuación preventiva de zonas de riesgo y seguir instrucciones de Defensa Civil."
    }
    
    desc = descriptions.get(level, "")
    if trend == "rising" and level >= 2:
        desc += " La tendencia es ASCENDENTE, lo que podría empeorar la situación."
    elif trend == "falling" and level >= 2:
        desc += " La tendencia es descendente, lo cual es una señal positiva."
    
    return desc

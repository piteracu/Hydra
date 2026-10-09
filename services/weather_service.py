"""
Servicio de datos meteorológicos - Integración con Open-Meteo Weather API
"""
import requests
from datetime import datetime, timedelta
import config

_weather_cache = {}
CACHE_TTL_SECONDS = 300


def get_weather_forecast(lat, lon, days=7):
    """
    Obtiene el pronóstico meteorológico para una ubicación.
    """
    cache_key = (round(lat, 3), round(lon, 3), days)
    now = datetime.now()
    if cache_key in _weather_cache:
        cached_data, cached_time = _weather_cache[cache_key]
        if now - cached_time < timedelta(seconds=CACHE_TTL_SECONDS):
            return cached_data

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(config.WEATHER_HOURLY_VARS),
        "daily": ",".join(config.WEATHER_DAILY_VARS),
        "timezone": "America/Argentina/Salta",
        "forecast_days": min(days, 16)
    }
    
    try:
        response = requests.get(config.OPEN_METEO_WEATHER_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        result = {
            "success": True,
            "location": {"latitude": lat, "longitude": lon},
            "elevation": data.get("elevation"),
            "timezone": data.get("timezone"),
            "hourly": _process_hourly(data.get("hourly", {})),
            "daily": _process_daily(data.get("daily", {})),
            "current_summary": _get_current_summary(data),
            "updated_at": datetime.now().isoformat()
        }
        _weather_cache[cache_key] = (result, now)
        return result
    except requests.RequestException as e:
        if cache_key in _weather_cache:
            return _weather_cache[cache_key][0]
        return {"success": False, "error": str(e)}


def get_current_conditions(lat, lon):
    """
    Obtiene las condiciones meteorológicas actuales.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl",
        "timezone": "America/Argentina/Salta"
    }
    
    try:
        response = requests.get(config.OPEN_METEO_WEATHER_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        current = data.get("current", {})
        
        return {
            "success": True,
            "temperature": current.get("temperature_2m"),
            "humidity": current.get("relative_humidity_2m"),
            "precipitation": current.get("precipitation"),
            "rain": current.get("rain"),
            "weather_code": current.get("weather_code"),
            "weather_description": _weather_code_to_text(current.get("weather_code", 0)),
            "wind_speed": current.get("wind_speed_10m"),
            "wind_direction": current.get("wind_direction_10m"),
            "pressure": current.get("pressure_msl"),
            "updated_at": datetime.now().isoformat()
        }
    except requests.RequestException as e:
        return {"success": False, "error": str(e)}


def _process_hourly(hourly):
    """Procesa datos horarios en formato estructurado."""
    if not hourly or "time" not in hourly:
        return []
    
    result = []
    times = hourly.get("time", [])
    for i, t in enumerate(times):
        entry = {"time": t}
        for var in config.WEATHER_HOURLY_VARS:
            values = hourly.get(var, [])
            entry[var] = values[i] if i < len(values) else None
        result.append(entry)
    return result


def _process_daily(daily):
    """Procesa datos diarios en formato estructurado."""
    if not daily or "time" not in daily:
        return []
    
    result = []
    times = daily.get("time", [])
    for i, t in enumerate(times):
        entry = {"date": t}
        for var in config.WEATHER_DAILY_VARS:
            values = daily.get(var, [])
            entry[var] = values[i] if i < len(values) else None
        result.append(entry)
    return result


def _get_current_summary(data):
    """Genera un resumen de condiciones actuales desde el pronóstico."""
    hourly = data.get("hourly", {})
    if not hourly or "time" not in hourly:
        return {}
    
    # Obtener la hora actual más cercana
    now = datetime.now().strftime("%Y-%m-%dT%H:00")
    times = hourly.get("time", [])
    idx = 0
    for i, t in enumerate(times):
        if t >= now:
            idx = i
            break
    
    precip_values = hourly.get("precipitation", [])
    precip_24h = sum(precip_values[idx:idx+24]) if len(precip_values) > idx else 0
    precip_48h = sum(precip_values[idx:idx+48]) if len(precip_values) > idx else 0
    
    sm_0_1 = hourly.get("soil_moisture_0_to_1cm", [])
    sm_1_3 = hourly.get("soil_moisture_1_to_3cm", [])
    sm_3_9 = hourly.get("soil_moisture_3_to_9cm", [])
    
    current_sm = sm_0_1[idx] if idx < len(sm_0_1) and sm_0_1[idx] is not None else 0.25
    deep_sm = sm_3_9[idx] if idx < len(sm_3_9) and sm_3_9[idx] is not None else 0.25
    
    # Estimación de saturación del suelo (0.45 m³/m³ es capacidad de campo / saturación relativa alta)
    soil_saturation_pct = min(100, max(0, round((current_sm / 0.45) * 100, 1)))
    
    return {
        "precipitation_next_24h": round(precip_24h, 1),
        "precipitation_next_48h": round(precip_48h, 1),
        "max_hourly_precip": round(max(precip_values[idx:idx+24]) if precip_values[idx:idx+24] else 0, 1),
        "soil_moisture_surface": round(current_sm, 3),
        "soil_moisture_deep": round(deep_sm, 3),
        "soil_saturation_pct": soil_saturation_pct
    }


def _weather_code_to_text(code):
    """Convierte código WMO a texto en español."""
    weather_codes = {
        0: "Cielo despejado",
        1: "Mayormente despejado",
        2: "Parcialmente nublado",
        3: "Nublado",
        45: "Niebla",
        48: "Niebla con escarcha",
        51: "Llovizna leve",
        53: "Llovizna moderada",
        55: "Llovizna intensa",
        56: "Llovizna helada leve",
        57: "Llovizna helada intensa",
        61: "Lluvia leve",
        63: "Lluvia moderada",
        65: "Lluvia intensa",
        66: "Lluvia helada leve",
        67: "Lluvia helada intensa",
        71: "Nevada leve",
        73: "Nevada moderada",
        75: "Nevada intensa",
        77: "Granizo",
        80: "Chubascos leves",
        81: "Chubascos moderados",
        82: "Chubascos violentos",
        85: "Nevada en chubascos leve",
        86: "Nevada en chubascos intensa",
        95: "Tormenta eléctrica",
        96: "Tormenta con granizo leve",
        99: "Tormenta con granizo intenso"
    }
    return weather_codes.get(code, "Desconocido")

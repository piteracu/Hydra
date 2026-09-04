"""
Servicio de datos históricos - Integración con Open-Meteo Archive API
"""
import requests
import csv
import json
import io
from datetime import datetime, timedelta
import config


def get_historical_data(lat, lon, start_date, end_date):
    """Obtiene datos históricos de precipitación."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "precipitation_sum,rain_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max",
        "timezone": "America/Argentina/Salta"
    }
    try:
        resp = requests.get(config.OPEN_METEO_ARCHIVE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})
        return {
            "success": True,
            "location": {"latitude": lat, "longitude": lon},
            "elevation": data.get("elevation"),
            "data": _process_historical(daily),
            "statistics": _calculate_stats(daily),
            "period": {"start": start_date, "end": end_date}
        }
    except requests.RequestException as e:
        return {"success": False, "error": str(e)}


def get_historical_flood_data(lat, lon, start_date=None, end_date=None):
    """Obtiene datos históricos de descarga de ríos."""
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "river_discharge",
        "start_date": start_date,
        "end_date": end_date
    }
    try:
        resp = requests.get(config.OPEN_METEO_FLOOD_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})
        times = daily.get("time", [])
        discharges = daily.get("river_discharge", [])
        records = []
        for i, t in enumerate(times):
            records.append({
                "date": t,
                "river_discharge": round(discharges[i], 2) if i < len(discharges) and discharges[i] is not None else None
            })
        valid = [r["river_discharge"] for r in records if r["river_discharge"] is not None]
        stats = {}
        if valid:
            stats = {
                "max": round(max(valid), 2),
                "min": round(min(valid), 2),
                "mean": round(sum(valid)/len(valid), 2),
                "count": len(valid)
            }
        return {"success": True, "data": records, "statistics": stats, "period": {"start": start_date, "end": end_date}}
    except requests.RequestException as e:
        return {"success": False, "error": str(e)}


def generate_csv(data_records, filename="historical_data"):
    """Genera CSV desde registros de datos."""
    if not data_records:
        return None
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data_records[0].keys())
    writer.writeheader()
    writer.writerows(data_records)
    return output.getvalue()


def generate_json(data_records):
    """Genera JSON desde registros de datos."""
    return json.dumps(data_records, indent=2, ensure_ascii=False)


def _process_historical(daily):
    if not daily or "time" not in daily:
        return []
    result = []
    times = daily.get("time", [])
    for i, t in enumerate(times):
        entry = {"date": t}
        for key in ["precipitation_sum", "rain_sum", "temperature_2m_max", "temperature_2m_min", "wind_speed_10m_max"]:
            vals = daily.get(key, [])
            entry[key] = round(vals[i], 1) if i < len(vals) and vals[i] is not None else None
        result.append(entry)
    return result


def _calculate_stats(daily):
    if not daily or "time" not in daily:
        return {}
    precip = [v for v in daily.get("precipitation_sum", []) if v is not None]
    rain = [v for v in daily.get("rain_sum", []) if v is not None]
    stats = {}
    if precip:
        stats["precipitation"] = {
            "total": round(sum(precip), 1),
            "max_daily": round(max(precip), 1),
            "mean_daily": round(sum(precip)/len(precip), 1),
            "rainy_days": sum(1 for p in precip if p > 1.0),
            "heavy_rain_days": sum(1 for p in precip if p > 20.0)
        }
    if rain:
        stats["rain"] = {
            "total": round(sum(rain), 1),
            "max_daily": round(max(rain), 1),
            "mean_daily": round(sum(rain)/len(rain), 1)
        }
    return stats

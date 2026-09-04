"""
Hydra - Servicio de alertas
Generación y gestión de alertas hidrológicas
"""
from datetime import datetime
import config
from services import weather_service, flood_service

_alerts = []
_alert_counter = 0


def generate_alert_for_department(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return {"success": False, "error": f"Departamento '{dept_id}' no encontrado"}
    
    lat, lon = dept["lat"], dept["lon"]
    weather = weather_service.get_weather_forecast(lat, lon, days=3)
    flood = flood_service.get_flood_data_with_context(lat, lon, dept)
    alert_level = _calculate_combined_alert(weather, flood, dept)
    alert_info = config.ALERT_LEVELS[alert_level]
    
    return {
        "success": True,
        "department_id": dept_id,
        "department_name": dept["name"],
        "alert_level": alert_level,
        "alert_name": alert_info["name"],
        "alert_color": alert_info["color"],
        "alert_icon": alert_info["icon"],
        "alert_description": alert_info["description"],
        "precipitation_24h": weather.get("current_summary", {}).get("precipitation_next_24h", 0) if weather.get("success") else 0,
        "precipitation_48h": weather.get("current_summary", {}).get("precipitation_next_48h", 0) if weather.get("success") else 0,
        "flood_risk": flood.get("analysis", {}) if flood.get("success") else {},
        "topographic_risk": dept["risk_base"],
        "elevation": dept["elevation"],
        "rivers": dept["rivers"],
        "population": dept.get("population"),
        "area_km2": dept.get("area_km2"),
        "basin": dept.get("basin"),
        "description": dept.get("description"),
        "recommendations": _get_recommendations(alert_level),
        "generated_at": datetime.now().isoformat(),
        "type": "automatic"
    }


def create_manual_alert(dept_id, level, message, created_by="usuario"):
    global _alert_counter
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return {"success": False, "error": f"Departamento '{dept_id}' no encontrado"}
    if level not in [1, 2, 3, 4]:
        return {"success": False, "error": "Nivel de alerta debe ser 1, 2, 3 o 4"}
    
    _alert_counter += 1
    alert_info = config.ALERT_LEVELS[level]
    alert = {
        "id": _alert_counter,
        "department_id": dept_id,
        "department_name": dept["name"],
        "alert_level": level,
        "alert_name": alert_info["name"],
        "alert_color": alert_info["color"],
        "alert_icon": alert_info["icon"],
        "message": message,
        "created_by": created_by,
        "created_at": datetime.now().isoformat(),
        "active": True,
        "type": "manual"
    }
    _alerts.append(alert)
    return {"success": True, "alert": alert}


def get_all_active_alerts():
    return [a for a in _alerts if a.get("active")]


def get_alerts_for_department(dept_id):
    return [a for a in _alerts if a.get("active") and a["department_id"] == dept_id]


def deactivate_alert(alert_id):
    for alert in _alerts:
        if alert["id"] == alert_id:
            alert["active"] = False
            alert["deactivated_at"] = datetime.now().isoformat()
            return {"success": True, "alert": alert}
    return {"success": False, "error": "Alerta no encontrada"}


def get_all_departments_status():
    results = []
    for dept_id, dept in config.DEPARTMENTS.items():
        alert = generate_alert_for_department(dept_id)
        if alert["success"]:
            manual_alerts = get_alerts_for_department(dept_id)
            if manual_alerts:
                max_manual = max(a["alert_level"] for a in manual_alerts)
                if max_manual > alert["alert_level"]:
                    alert["alert_level"] = max_manual
                    ai = config.ALERT_LEVELS[max_manual]
                    alert["alert_name"] = ai["name"]
                    alert["alert_color"] = ai["color"]
                    alert["alert_icon"] = ai["icon"]
                alert["manual_alerts"] = manual_alerts
            results.append(alert)
    return results


def get_alert_for_location(lat, lon):
    closest_dept = None
    min_distance = float('inf')
    for dept_id, dept in config.DEPARTMENTS.items():
        dist = ((lat - dept["lat"])**2 + (lon - dept["lon"])**2)**0.5
        if dist < min_distance:
            min_distance = dist
            closest_dept = dept_id
    if not closest_dept:
        return {"success": False, "error": "No se pudo determinar el departamento"}
    
    alert = generate_alert_for_department(closest_dept)
    alert["user_location"] = {"latitude": lat, "longitude": lon}
    alert["distance_to_center_km"] = round(min_distance * 111, 1)
    
    if closest_dept == "capital":
        for zone in config.CAPITAL_RISK_ZONES:
            zone_dist = ((lat - zone["lat"])**2 + (lon - zone["lon"])**2)**0.5
            if zone_dist < 0.02:
                alert["risk_zone"] = zone
                if zone["risk"] > alert["alert_level"]:
                    alert["alert_level"] = zone["risk"]
                    ai = config.ALERT_LEVELS[zone["risk"]]
                    alert["alert_name"] = ai["name"]
                    alert["alert_color"] = ai["color"]
                break
    return alert


def _calculate_combined_alert(weather, flood, dept):
    levels = []
    if weather.get("success"):
        p = weather.get("current_summary", {}).get("precipitation_next_24h", 0)
        if p >= config.PRECIP_THRESHOLD_EMERGENCY: levels.append(4)
        elif p >= config.PRECIP_THRESHOLD_ALERT: levels.append(3)
        elif p >= config.PRECIP_THRESHOLD_CAUTION: levels.append(2)
        else: levels.append(1)
    if flood.get("success"):
        levels.append(flood.get("analysis", {}).get("risk_level", 1))
    base_risk = dept.get("risk_base", 1)
    if not levels:
        return base_risk
    max_level = max(levels)
    if base_risk >= 3 and max_level >= 2 and max_level < 4:
        max_level = min(max_level + 1, 4)
    return max_level


def _get_recommendations(level):
    recs = {
        1: ["No se requieren acciones especiales.", "Mantenga informado sobre el pronóstico.", "Verifique que sus desagües estén limpios."],
        2: ["Monitoree condiciones climáticas.", "Evite cruzar cauces de agua.", "Prepare un kit de emergencia.", "Identifique rutas de evacuación."],
        3: ["⚠️ Evite zonas bajas y cercanas a ríos.", "Prepare documentación importante.", "Esté atento a Defensa Civil.", "No circule por calles inundadas."],
        4: ["🚨 EVACUAR zonas de riesgo.", "Diríjase a zonas altas.", "NO cruce corrientes de agua.", "Defensa Civil: 103 / Bomberos: 100", "Corte gas y electricidad si hay riesgo."]
    }
    return recs.get(level, [])

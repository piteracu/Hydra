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
    
    summary = weather.get("current_summary", {}) if weather.get("success") else {}
    soil_saturation = summary.get("soil_saturation_pct", 20.0)
    precip_24h = summary.get("precipitation_next_24h", 0)
    precip_48h = summary.get("precipitation_next_48h", 0)
    river_analysis = flood.get("analysis", {}) if flood.get("success") else {}
    
    risk_score = _calculate_risk_score(precip_24h, river_analysis.get("ratio", 1.0), soil_saturation, dept.get("risk_base", 1))
    
    return {
        "success": True,
        "department_id": dept_id,
        "department_name": dept["name"],
        "alert_level": alert_level,
        "alert_name": alert_info["name"],
        "alert_color": alert_info["color"],
        "alert_icon": alert_info["icon"],
        "alert_description": alert_info["description"],
        "risk_score": risk_score,
        "precipitation_24h": precip_24h,
        "precipitation_48h": precip_48h,
        "soil_saturation_pct": soil_saturation,
        "soil_moisture_surface": summary.get("soil_moisture_surface", 0.25),
        "flood_risk": river_analysis,
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


def get_alerts_after(after_id=0):
    return [a for a in _alerts if a.get("active") and a.get("id", 0) > after_id]


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


def _calculate_risk_score(precip_24h, river_ratio, soil_sat_pct, base_risk):
    """
    Calcula un índice numérico continuo de riesgo de 0 a 100 ponderando 4 factores:
    - Precipitación 24h (35%)
    - Descarga de Ríos vs Media (30%)
    - Saturación del suelo % (20%)
    - Vulnerabilidad topográfica base (15%)
    """
    precip_score = min(100, (precip_24h / config.PRECIP_THRESHOLD_EMERGENCY) * 100)
    river_score = min(100, (river_ratio / config.RIVER_DISCHARGE_EMERGENCY) * 100) if river_ratio else 15
    soil_score = min(100, soil_sat_pct)
    topo_score = (base_risk / 4.0) * 100
    
    score = (precip_score * 0.35) + (river_score * 0.30) + (soil_score * 0.20) + (topo_score * 0.15)
    return round(score, 1)


def get_factors_for_point(lat, lon):
    """
    Obtiene evaluación en tiempo real de todos los factores de inundación para CUALQUIER punto de Salta.
    """
    weather = weather_service.get_current_conditions(lat, lon)
    forecast = weather_service.get_weather_forecast(lat, lon, days=3)
    flood = flood_service.get_flood_forecast(lat, lon, days=3)
    
    # Encontrar departamento más cercano y cuenca
    closest_dept_id = "capital"
    min_dist = float('inf')
    for d_id, d_data in config.DEPARTMENTS.items():
        dist = ((lat - d_data["lat"])**2 + (lon - d_data["lon"])**2)**0.5
        if dist < min_dist:
            min_dist = dist
            closest_dept_id = d_id
            
    dept_info = config.DEPARTMENTS[closest_dept_id]
    
    # Encontrar río más cercano
    closest_river = None
    min_r_dist = float('inf')
    for r in config.SALTA_RIVERS:
        for p in r["path"]:
            r_dist = ((lat - p[1])**2 + (lon - p[0])**2)**0.5
            if r_dist < min_r_dist:
                min_r_dist = r_dist
                closest_river = r
                
    summary = forecast.get("current_summary", {}) if forecast.get("success") else {}
    precip_24h = summary.get("precipitation_next_24h", 0)
    precip_48h = summary.get("precipitation_next_48h", 0)
    soil_sat = summary.get("soil_saturation_pct", 25.0)
    river_analysis = flood.get("analysis", {}) if flood.get("success") else {}
    river_ratio = river_analysis.get("ratio", 1.0)
    
    risk_score = _calculate_risk_score(precip_24h, river_ratio, soil_sat, dept_info["risk_base"])
    
    if risk_score >= 75 or precip_24h >= config.PRECIP_THRESHOLD_EMERGENCY:
        alert_level = 4
    elif risk_score >= 50 or precip_24h >= config.PRECIP_THRESHOLD_ALERT:
        alert_level = 3
    elif risk_score >= 25 or precip_24h >= config.PRECIP_THRESHOLD_CAUTION:
        alert_level = 2
    else:
        alert_level = 1
        
    alert_info = config.ALERT_LEVELS[alert_level]
    
    return {
        "success": True,
        "location": {"latitude": lat, "longitude": lon},
        "closest_department": dept_info["name"],
        "closest_department_id": closest_dept_id,
        "elevation": forecast.get("elevation", dept_info["elevation"]),
        "alert_level": alert_level,
        "alert_name": alert_info["name"],
        "alert_color": alert_info["color"],
        "alert_icon": alert_info["icon"],
        "risk_score": risk_score,
        "factors": {
            "precipitation": {
                "current_mm": weather.get("precipitation", 0) if weather.get("success") else 0,
                "forecast_24h_mm": precip_24h,
                "forecast_48h_mm": precip_48h,
                "max_hourly_mm": summary.get("max_hourly_precip", 0),
                "condition": weather.get("weather_description", "Desconocido") if weather.get("success") else "Normal"
            },
            "river_discharge": {
                "closest_river": closest_river["name"] if closest_river else "Cauce local",
                "distance_km": round(min_r_dist * 111, 1),
                "current_m3s": river_analysis.get("current_discharge"),
                "mean_m3s": river_analysis.get("mean_discharge"),
                "ratio_to_mean": river_ratio,
                "trend": river_analysis.get("trend_text", "Estable →")
            },
            "soil_moisture": {
                "saturation_pct": soil_sat,
                "surface_vol": summary.get("soil_moisture_surface", 0.25),
                "deep_vol": summary.get("soil_moisture_deep", 0.25),
                "status": "Saturado (Riesgo alto)" if soil_sat > 80 else ("Húmedo" if soil_sat > 50 else "Moderado")
            },
            "topography": {
                "base_risk": dept_info["risk_base"],
                "basin": dept_info.get("basin", "Cuenca Provincial"),
                "vulnerability": "Alta acumulación por cota baja" if dept_info["elevation"] < 500 else ("Crecidas repentinas en ladera" if dept_info["elevation"] > 1500 else "Riesgo estándar")
            }
        },
        "recommendations": _get_recommendations(alert_level)
    }


def get_province_factors():
    """
    Retorna el estado de factores hidrológicos de toda la provincia (ríos, departamentos, cuencas).
    """
    dept_statuses = get_all_departments_status()
    dept_map = {d["department_id"]: d for d in dept_statuses}
    
    rivers_data = []
    for r in config.SALTA_RIVERS:
        station = r["station"]
        # Buscar el departamento correspondiente para reutilizar datos de descarga si está disponible
        ratio = 1.0
        current_m3s = 45.0
        trend = "Estable →"
        
        # Encontrar departamento más cercano a la estación
        min_d = float('inf')
        closest_d = None
        for d in dept_statuses:
            coords = config.DEPARTMENTS.get(d["department_id"], {})
            if coords:
                dist = ((station["lat"] - coords["lat"])**2 + (station["lon"] - coords["lon"])**2)**0.5
                if dist < min_d:
                    min_d = dist
                    closest_d = d
                    
        if closest_d and closest_d.get("flood_risk"):
            fr = closest_d["flood_risk"]
            ratio = fr.get("ratio", 1.0)
            current_m3s = fr.get("current_discharge", 45.0)
            trend = fr.get("trend_text", "Estable →")
            
        rivers_data.append({
            "id": r["id"],
            "name": r["name"],
            "basin": r["basin"],
            "danger_level": r["danger_level"],
            "path": r["path"],
            "station": r["station"],
            "discharge_current": current_m3s,
            "discharge_ratio": ratio,
            "trend": trend
        })
    return {
        "success": True,
        "departments": dept_statuses,
        "rivers": rivers_data,
        "basins": config.SALTA_BASINS,
        "updated_at": datetime.now().isoformat()
    }


def get_cartographic_analysis(dept_id):
    """
    Genera el Análisis Cartográfico de Inundabilidad de un departamento específico.
    """
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return {"success": False, "error": f"Departamento '{dept_id}' no encontrado"}
        
    alert = generate_alert_for_department(dept_id)
    elev = dept.get("elevation", 1000)
    risk_base = dept.get("risk_base", 1)
    
    # Análisis geomorfológico y perfil de pendiente
    if elev >= 2000:
        slope_type = "Alta Pendiente Escarpada (Sierras y Quebradas)"
        slope_desc = "Escurrimiento hiper-rápido. Riesgo concentrado en aluviones, desprendimientos y crecidas repentinas en torrentes."
        drainage = "Alta escorrentía superficial / Baja retención local"
        vuln_pct = 15 + (risk_base * 5)
    elif elev >= 800:
        slope_type = "Pendiente Moderada a Intermedia (Valle Subandino)"
        slope_desc = "Zona de transición de cuenca. Riesgo por desborde en lechos fluviales urbanos y convergencia de arroyos."
        drainage = "Moderada capacidad de drenaje por pendiente"
        vuln_pct = 25 + (risk_base * 10)
    else:
        slope_type = "Llanura Chaco-Salteña (Baja Pendiente / Depresión)"
        slope_desc = "Zona de acumulación y remanso. Riesgo elevado por desborde extraordinario de ríos de llanura y anegamiento prolongado."
        drainage = "Bajo gradiente hidráulico / Escurrimiento lento"
        vuln_pct = 40 + (risk_base * 12)
        
    # Encontrar río principal más cercano en la red cartográfica
    closest_river = None
    min_dist = float('inf')
    for r in config.SALTA_RIVERS:
        for p in r["path"]:
            d = ((dept["lat"] - p[1])**2 + (dept["lon"] - p[0])**2)**0.5
            if d < min_dist:
                min_dist = d
                closest_river = r
                
    return {
        "success": True,
        "department_id": dept_id,
        "name": dept["name"],
        "coordinates": {"lat": dept["lat"], "lon": dept["lon"]},
        "elevation_m": elev,
        "population": dept.get("population", 0),
        "area_km2": dept.get("area_km2", 0),
        "basin": dept.get("basin", "Cuenca Provincial"),
        "rivers": dept.get("rivers", []),
        "cartography": {
            "slope_type": slope_type,
            "slope_description": slope_desc,
            "drainage_capacity": drainage,
            "vulnerability_area_pct": vuln_pct,
            "base_risk_level": risk_base,
            "closest_river_system": closest_river["name"] if closest_river else "Red Fluvial Local",
            "river_proximity_km": round(min_dist * 111, 1),
            "description": dept.get("description", "")
        },
        "realtime_telemetry": {
            "alert_level": alert.get("alert_level", 1),
            "alert_name": alert.get("alert_name", "Normal"),
            "alert_icon": alert.get("alert_icon", "🟢"),
            "alert_color": alert.get("alert_color", "#22c55e"),
            "risk_score": alert.get("risk_score", 20),
            "precipitation_24h": alert.get("precipitation_24h", 0),
            "precipitation_48h": alert.get("precipitation_48h", 0),
            "soil_saturation_pct": alert.get("soil_saturation_pct", 20),
            "river_discharge_ratio": alert.get("flood_risk", {}).get("ratio", 1.0)
        },
        "recommendations": alert.get("recommendations", []),
        "generated_at": datetime.now().isoformat()
    }


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


"""
Hydra - Aplicación principal Flask
Sistema Provincial de Monitoreo Hídrico - Provincia de Salta
"""
from flask import Flask, render_template, jsonify, request, Response
from flask_cors import CORS
from datetime import datetime, timedelta
import config
from services import weather_service, flood_service, alert_service, historical_service

app = Flask(__name__)
CORS(app)


# ─── Página principal ────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ─── API: Departamentos ─────────────────────────────────────────
@app.route("/api/departments")
def get_departments():
    depts = []
    for dept_id, dept in config.DEPARTMENTS.items():
        depts.append({
            "id": dept_id,
            "name": dept["name"],
            "lat": dept["lat"],
            "lon": dept["lon"],
            "elevation": dept["elevation"],
            "risk_base": dept["risk_base"],
            "rivers": dept["rivers"],
            "description": dept["description"],
            "population": dept.get("population"),
            "area_km2": dept.get("area_km2"),
            "basin": dept.get("basin")
        })
    return jsonify({"success": True, "departments": depts})


# ─── API: Datos meteorológicos ───────────────────────────────────
@app.route("/api/weather/<dept_id>")
def get_weather(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return jsonify({"success": False, "error": "Departamento no encontrado"}), 404
    data = weather_service.get_weather_forecast(dept["lat"], dept["lon"])
    return jsonify(data)


@app.route("/api/weather/current/<dept_id>")
def get_current_weather(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return jsonify({"success": False, "error": "Departamento no encontrado"}), 404
    data = weather_service.get_current_conditions(dept["lat"], dept["lon"])
    return jsonify(data)


# ─── API: Datos de inundación ────────────────────────────────────
@app.route("/api/flood/<dept_id>")
def get_flood(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return jsonify({"success": False, "error": "Departamento no encontrado"}), 404
    data = flood_service.get_flood_data_with_context(dept["lat"], dept["lon"], dept)
    return jsonify(data)


# ─── API: Alertas ────────────────────────────────────────────────
@app.route("/api/alert/<dept_id>")
def get_alert(dept_id):
    data = alert_service.generate_alert_for_department(dept_id)
    if not data["success"]:
        return jsonify(data), 404
    return jsonify(data)


@app.route("/api/alerts/all")
def get_all_alerts():
    data = alert_service.get_all_departments_status()
    return jsonify({"success": True, "alerts": data, "count": len(data)})


@app.route("/api/alert/generate", methods=["POST"])
def create_alert():
    body = request.get_json()
    if not body:
        return jsonify({"success": False, "error": "Body JSON requerido"}), 400
    dept_id = body.get("department_id")
    level = body.get("level", 2)
    message = body.get("message", "Alerta generada manualmente")
    created_by = body.get("created_by", "usuario")
    result = alert_service.create_manual_alert(dept_id, level, message, created_by)
    if not result["success"]:
        return jsonify(result), 400
    return jsonify(result), 201


@app.route("/api/alert/deactivate/<int:alert_id>", methods=["POST"])
def deactivate_alert(alert_id):
    result = alert_service.deactivate_alert(alert_id)
    if not result["success"]:
        return jsonify(result), 404
    return jsonify(result)


@app.route("/api/alerts/manual")
def get_manual_alerts():
    alerts = alert_service.get_all_active_alerts()
    return jsonify({"success": True, "alerts": alerts, "count": len(alerts)})


# ─── API: Geolocalización y Factores de Inundación ───────────────
@app.route("/api/location/info")
def get_location_info():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    if lat is None or lon is None:
        return jsonify({"success": False, "error": "Parámetros lat y lon requeridos"}), 400
    data = alert_service.get_alert_for_location(lat, lon)
    return jsonify(data)


@app.route("/api/location/factors")
def get_location_factors():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    if lat is None or lon is None:
        return jsonify({"success": False, "error": "Parámetros lat y lon requeridos"}), 400
    data = alert_service.get_factors_for_point(lat, lon)
    return jsonify(data)


@app.route("/api/factors/province")
def get_province_factors():
    data = alert_service.get_province_factors()
    return jsonify(data)


@app.route("/api/cartography/<dept_id>")
def get_cartography_analysis(dept_id):
    data = alert_service.get_cartographic_analysis(dept_id)
    if not data["success"]:
        return jsonify(data), 404
    return jsonify(data)


# ─── API: Datos históricos ──────────────────────────────────────
@app.route("/api/historical/<dept_id>")
def get_historical(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return jsonify({"success": False, "error": "Departamento no encontrado"}), 404
    start = request.args.get("start", (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"))
    end = request.args.get("end", (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"))
    data = historical_service.get_historical_data(dept["lat"], dept["lon"], start, end)
    return jsonify(data)


@app.route("/api/historical/flood/<dept_id>")
def get_historical_flood(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return jsonify({"success": False, "error": "Departamento no encontrado"}), 404
    start = request.args.get("start")
    end = request.args.get("end")
    data = historical_service.get_historical_flood_data(dept["lat"], dept["lon"], start, end)
    return jsonify(data)


@app.route("/api/historical/download/<dept_id>")
def download_historical(dept_id):
    dept = config.DEPARTMENTS.get(dept_id)
    if not dept:
        return jsonify({"success": False, "error": "Departamento no encontrado"}), 404
    fmt = request.args.get("format", "csv")
    start = request.args.get("start", (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d"))
    end = request.args.get("end", (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"))
    data = historical_service.get_historical_data(dept["lat"], dept["lon"], start, end)
    if not data["success"]:
        return jsonify(data), 500
    records = data["data"]
    fname = f"salta_flood_{dept_id}_{start}_{end}"
    if fmt == "json":
        content = historical_service.generate_json(records)
        return Response(content, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment;filename={fname}.json"})
    else:
        content = historical_service.generate_csv(records)
        return Response(content, mimetype="text/csv",
                        headers={"Content-Disposition": f"attachment;filename={fname}.csv"})


# ─── API: Zonas de riesgo de Capital ─────────────────────────────
@app.route("/api/capital/risk-zones")
def get_capital_risk_zones():
    return jsonify({"success": True, "zones": config.CAPITAL_RISK_ZONES})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)

# agriverse_api.py
from flask import Flask, request, jsonify
import requests, joblib, os
from flask_cors import CORS

model = joblib.load('agriverse_crop_model.pkl')
app   = Flask(__name__)
CORS(app)

# ---------- helpers ----------------------------------------------------------
def fetch_weather(lat: float, lon: float):
    """Return temp(°C), humidity(%), rainfall(mm) for given coords via Open‑Meteo."""
    url = ("https://api.open-meteo.com/v1/forecast"
           f"?latitude={lat}&longitude={lon}"
           "&hourly=temperature_2m,relative_humidity_2m,precipitation"
           "&forecast_days=1")
    r = requests.get(url, timeout=5)
    r.raise_for_status()
    data = r.json()["hourly"]
    # take the latest hour
    temperature = data["temperature_2m"][-1]
    humidity    = data["relative_humidity_2m"][-1]
    rainfall    = data["precipitation"][-1]
    return temperature, humidity, rainfall

def predict_crop(temp, hum, rain):
    pred = model.predict([[temp, hum, rain]])[0]
    return {"recommended_crop": pred,
            "inputs": {"temperature": temp, "humidity": hum, "rainfall": rain}}

# ---------- routes -----------------------------------------------------------
@app.route("/")
def home():
    return "🌱 AgriVerse Crop‑Prediction API (v2) running"

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    try:
        # path A: caller sent raw weather
        if all(k in data for k in ("temperature","humidity","rainfall")):
            t = float(data["temperature"]); h = float(data["humidity"]); r = float(data["rainfall"])
        # path B: caller sent lat/lon -> we fetch weather
        elif all(k in data for k in ("lat","lon")):
            t,h,r = fetch_weather(float(data["lat"]), float(data["lon"]))
        else:
            return jsonify(error="Provide either temperature+humidity+rainfall OR lat+lon"), 400

        # basic range checks
        # basic range checks
        if not (-50 <= t <= 60 and 0 <= h <= 100 and 0 <= r <= 500):
            return jsonify(error="Input values out of valid range"), 422


        return jsonify(predict_crop(t,h,r))

    except (ValueError, KeyError) as e:
        return jsonify(error=f"Bad input: {e}"), 400
    except requests.RequestException as e:
        return jsonify(error=f"Weather service error: {e}"), 502

# ---------- entry point ------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)

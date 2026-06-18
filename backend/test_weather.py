import os
import json
import urllib.request
import urllib.error

# Load .env
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
weather_key = ""
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() in ("WEATHER_UNION_KEY", "WEATHER_UNION_API_KEY", "WEATHERUNION_KEY"):
                    weather_key = v.strip().strip("'").strip('"')

if not weather_key:
    weather_key = os.environ.get("WEATHER_UNION_KEY", "")

# MG Road coordinates (known to be supported)
lat, lon = 12.975, 77.605
url = f"https://www.weatherunion.com/gw/weather/external/v0/get_weather_data?latitude={lat}&longitude={lon}"
headers = {
    "x-zomato-api-key": weather_key,
    "User-Agent": "Mozilla/5.0"
}

try:
    print(f"Sending request to Weather Union API for lat={lat}, lon={lon}...")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("Response received successfully!")
        
        status = res_data.get("status")
        if str(status) != "200" and status != 200:
            print(f"[Weather Union] Non-200 status: {status} - {res_data.get('message')}")
        else:
            weather_info = res_data.get("localityWeather") or res_data.get("locality_weather_data")
            if not weather_info:
                print("No weather info key found in response!")
            else:
                rain_acc = weather_info.get("rainAccumulation") or weather_info.get("rain_accumulation") or 0.0
                rain_intensity = weather_info.get("rainIntensity") or weather_info.get("rain_intensity") or 0.0
                print(f"Parsed Weather Union data successfully!")
                print(f"Rain Accumulation: {rain_acc} mm/hr")
                print(f"Rain Intensity: {rain_intensity} mm/hr")
                print(f"Temperature: {weather_info.get('temperature')} C")
                print(f"Humidity: {weather_info.get('humidity')} %")
except Exception as e:
    print(f"Error calling Weather Union: {e}")

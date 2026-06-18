import os
import json
import urllib.request

# Load key from .env
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
weather_key = ""
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "WEATHER_UNION_KEY":
                    weather_key = v.strip().strip("'").strip('"')

# Let's request coordinates for MG Road (which was returned by Gemini: lat=12.975, lon=77.605)
lat, lon = 12.975, 77.605
url = f"https://www.weatherunion.com/gw/weather/external/v0/get_weather_data?latitude={lat}&longitude={lon}"
headers = {
    "x-zomato-api-key": weather_key,
    "User-Agent": "Mozilla/5.0"
}

try:
    print(f"Calling Weather Union with key={weather_key[:8]}... for lat={lat}, lon={lon}")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        body = response.read().decode('utf-8')
        print("Raw Response body:")
        print(body)
except Exception as e:
    print(f"Error calling Weather Union: {e}")
    if hasattr(e, 'read'):
        try:
            print("Response error body:", e.read().decode('utf-8'))
        except Exception:
            pass

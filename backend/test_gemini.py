import os
import json
import re
import urllib.request
import urllib.error

# Load .env
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
gemini_key = ""
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "GEMINI_API_KEY":
                    gemini_key = v.strip().strip("'").strip('"')

if not gemini_key:
    gemini_key = os.environ.get("GEMINI_API_KEY", "")

print(f"Using Gemini API key: {gemini_key[:10]}...")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0"
}

prompt = (
    "Find current traffic incidents, waterlogging, or road blocks in Bangalore right now. "
    "Return a JSON object with EXACTLY these 2 fields:\n"
    "1. 'affected_roads': list of 3 objects, each containing:\n"
    "   - 'name': Bangalore road name.\n"
    "   - 'lat': latitude (float).\n"
    "   - 'lon': longitude (float).\n"
    "   - 'desc': urgent description.\n"
    "2. 'affected_intersections': list of 3 objects, each containing:\n"
    "   - 'name': Bangalore junction/circle name.\n"
    "   - 'lat': latitude (float).\n"
    "   - 'lon': longitude (float).\n"
    "   - 'desc': urgent description.\n"
    "Output strictly valid JSON. No commentary outside the JSON object."
)

data = {
    "contents": [
        {
            "parts": [
                {
                    "text": prompt
                }
            ]
        }
    ],
    "tools": [
        {
            "googleSearch": {}
        }
    ],
    "generationConfig": {
        "temperature": 0.7
    }
}

try:
    print("Sending request to Gemini API with Search Grounding (timeout=45)...")
    req_obj = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'), 
        headers=headers,
        method='POST'
    )
    with urllib.request.urlopen(req_obj, timeout=45) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("Response received successfully!")
        
        candidates = res_data.get("candidates", [])
        if candidates:
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if parts:
                text = parts[0].get("text", "")
                print("Raw Text content:")
                print(text)
                
                # Clean up markdown code blocks if present
                clean_text = text.strip()
                if clean_text.startswith("```"):
                    clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text)
                    clean_text = re.sub(r"\s*```$", "", clean_text)
                
                try:
                    result = json.loads(clean_text)
                    print("\nSuccessfully parsed JSON!")
                    print(json.dumps(result, indent=2))
                except Exception as pe:
                    print(f"\nFailed to parse JSON: {pe}")
                
                # Verify grounding metadata
                metadata = candidates[0].get("groundingMetadata", {})
                if metadata:
                    print("\nGrounding Metadata Keys:", list(metadata.keys()))
                    queries = metadata.get("webSearchQueries", [])
                    print("Web Search Queries used:", queries)
            else:
                print("No parts in content")
        else:
            print("No candidates in response:", res_data)
except Exception as e:
    print(f"Error calling Gemini: {e}")
    if hasattr(e, 'read'):
        try:
            print("Response error body:", e.read().decode('utf-8'))
        except Exception:
            pass

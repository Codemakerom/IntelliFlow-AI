import os
import urllib.request
import urllib.error
import json

# Try to load key from .env file manually
dotenv_path = ".env"
api_key = None
if os.path.exists(dotenv_path):
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "GROQ_API_KEY":
                    api_key = v.strip().strip("'").strip('"')
                    break

if not api_key:
    api_key = os.environ.get("GROQ_API_KEY")

print("Resolved API Key prefix:", api_key[:10] + "..." if api_key else "None")

if not api_key:
    print("Error: No GROQ_API_KEY found.")
    exit(1)

url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
data = {
    "model": "llama-3.3-70b-versatile",
    "response_format": {"type": "json_object"},
    "messages": [{"role": "user", "content": 'Respond with a JSON object containing {"hello": "world"}'}]
}

req_obj = urllib.request.Request(
    url, 
    data=json.dumps(data).encode('utf-8'), 
    headers=headers,
    method='POST'
)

try:
    print("Sending request to Groq API...")
    with urllib.request.urlopen(req_obj, timeout=10) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("Success! Response:")
        print(json.dumps(res_data, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    try:
        error_body = e.read().decode('utf-8')
        print("Error Response Body:")
        print(error_body)
    except Exception as read_err:
        print("Could not read error body:", read_err)
except Exception as e:
    print("General Error:", e)

import os
import glob

backend_dir = os.path.dirname(os.path.abspath(__file__))
for f in glob.glob(os.path.join(backend_dir, "*.py")):
    with open(f, "r", encoding="utf-8") as file:
        try:
            for idx, line in enumerate(file, 1):
                if any(term in line.lower() for term in ["retry", "fallback coordinates", "mg road"]):
                    print(f"File {os.path.basename(f)} Line {idx}: {line.strip()}")
        except Exception:
            pass

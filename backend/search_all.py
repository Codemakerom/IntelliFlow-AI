import os

search_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print(f"Searching directory including .venv: {search_dir}")

for root, dirs, files in os.walk(search_dir):
    if ".git" in dirs:
        dirs.remove(".git")
    if "node_modules" in dirs:
        dirs.remove("node_modules")
        
    for file in files:
        if file.endswith((".py", ".js", ".jsx", ".ts", ".tsx", ".json")):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    for idx, line in enumerate(f, 1):
                        if "covered fallback" in line.lower():
                            print(f"Match found in {file_path} (Line {idx}): {line.strip()}")
            except Exception:
                pass

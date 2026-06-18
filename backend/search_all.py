import os

main_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
if os.path.exists(main_path):
    with open(main_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            if '@app.get("/")' in line or "@app.get('/')" in line:
                print(f"Line {idx}: {line.strip()}")
else:
    print("main.py not found")

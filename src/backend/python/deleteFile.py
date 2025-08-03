import sys
import json
from send2trash import send2trash

def delete_file(filepath):
    try:
        send2trash(filepath)
        return {"status": "success", "path": filepath}
    except Exception as e:
        return {"status": "error", "path": filepath, "error": str(e)}

def delete_batch():
    try:
        input_data = sys.stdin.read()
        file_list = json.loads(input_data)

        results = []
        for file in file_list:
            if isinstance(file, dict) and 'path' in file:
                results.append(delete_file(file['path']))
            elif isinstance(file, str):  # fallback
                results.append(delete_file(file))
            else:
                results.append({"status": "error", "error": "Invalid file format"})

        print(json.dumps(results))
    except Exception as e:
        print(json.dumps([{"status": "error", "error": str(e)}]))

def main():
    if '--batch' in sys.argv:
        delete_batch()
    elif len(sys.argv) > 1:
        filepath = sys.argv[1]
        result = delete_file(filepath)
        print(result["status"])
    else:
        print("error: No file path provided")

if __name__ == "__main__":
    main()

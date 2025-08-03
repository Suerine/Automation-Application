import os
import json
import sys

def find_large_files(directory, size_limit):
    large_files = []
    for foldername, subfolders, filenames in os.walk(directory):
        for filename in filenames:
            file_path = os.path.join(foldername, filename)
            try:
                file_size = os.path.getsize(file_path)
                if file_size > size_limit:
                    large_files.append({
                        'path': file_path,
                        'size_mb': round(file_size / (1024 * 1024), 2)
                    })
            except OSError:
                continue
    return large_files

def main():
    try:
        directory = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
        size_limit = 100 * 1024 * 1024  # 100MB
        files = find_large_files(directory, size_limit)
        print(json.dumps(files))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()


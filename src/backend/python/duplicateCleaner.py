import os
import sys
import json
import hashlib
from pathlib import Path

def get_file_hash(file_path, chunk_size=8192):
    """Generate MD5 hash of file content."""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(chunk_size), b""):
                hash_md5.update(chunk)
    except (PermissionError, FileNotFoundError, IsADirectoryError) as e:
        print(f"Error processing {file_path}: {str(e)}", file=sys.stderr)
        return None
    return hash_md5.hexdigest()

def find_duplicates(folder):
    """Find duplicate files in a folder by content hash.
    Returns only files that have duplicates.
    Returns: {
        "groups": [
            {
                "hash": "md5hash",
                "original": "/path/to/original",
                "duplicates": ["/path/to/duplicate1", ...]
            },
            ...
        ],
        "error": "message" (if any)
    }
    """
    result = {"groups": []}
    hashes = {}

    try:
        # First pass: identify all files and their hashes
        for root, _, files in os.walk(folder):
            for file in files:
                file_path = Path(root) / file
                file_hash = get_file_hash(file_path)
                if file_hash:
                    if file_hash in hashes:
                        hashes[file_hash].append(str(file_path))
                    else:
                        hashes[file_hash] = [str(file_path)]
        
        # Second pass: only keep groups with duplicates
        for file_hash, file_paths in hashes.items():
            if len(file_paths) > 1:  # Only include groups with duplicates
                result["groups"].append({
                    "hash": file_hash,
                    "original": file_paths[0],  # First file is considered original
                    "duplicates": file_paths[1:]  # All others are duplicates
                })

    except Exception as e:
        result["error"] = str(e)
        print(f"Error walking directory: {str(e)}", file=sys.stderr)

    return result

def delete_duplicates(duplicates):
    """Delete duplicates, keeping only the original file in each group.
    Returns: {
        "deleted": ["/path/to/deleted1", ...],
        "errors": [{"file": "/path", "error": "message"}, ...],
        "kept": ["/path/to/original1", ...]
    }
    """
    result = {
        "deleted": [],
        "errors": [],
        "kept": []
    }

    for group in duplicates.get("groups", []):
        result["kept"].append(group["original"])
        for duplicate in group["duplicates"]:
            try:
                os.remove(duplicate)
                result["deleted"].append(duplicate)
            except Exception as e:
                result["errors"].append({
                    "file": duplicate,
                    "error": str(e)
                })

    return result

if __name__ == "__main__":
    # Initialize default response
    response = {"error": "Unknown error"}

    try:
        if len(sys.argv) < 2:
            response = {"error": "No folder path provided"}
            print(json.dumps(response))
            sys.exit(1)

        folder = sys.argv[1]
        mode = sys.argv[2] if len(sys.argv) > 2 else "scan"  # "scan" or "delete"

        if not os.path.exists(folder):
            response = {"error": "Invalid folder path"}
            print(json.dumps(response))
            sys.exit(1)

        duplicates = find_duplicates(folder)

        if "error" in duplicates:
            response = duplicates
        elif mode == "delete":
            response = delete_duplicates(duplicates)
        else:
            response = duplicates

    except Exception as e:
        response = {"error": f"Unexpected error: {str(e)}"}

    # Ensure we always return valid JSON
    print(json.dumps(response))
#!/usr/bin/env python3
import os
import shutil
import datetime
import sys
import json
from pathlib import Path

# ---------- Utilities ----------
def move_file(src, dest_folder):
    """Moves file safely without overwriting existing files. Returns new path as string."""
    src = Path(src)
    os.makedirs(dest_folder, exist_ok=True)
    dest_path = Path(dest_folder) / src.name
    counter = 1
    while dest_path.exists():
        dest_path = dest_path.with_name(f"{dest_path.stem}_{counter}{dest_path.suffix}")
        counter += 1
    shutil.move(str(src), str(dest_path))
    return str(dest_path)

def parse_date(date_input):
    """
    Returns (datetime_obj, date_type) where date_type is 'full_date', 'month_year', or 'year'
    or (None, None) if parse fails.
    """
    date_patterns = [
        ("%Y-%m-%d", "full_date"), ("%d-%m-%Y", "full_date"), ("%m-%d-%Y", "full_date"),
        ("%B %d %Y", "full_date"), ("%b %d %Y", "full_date"),
        ("%d %B %Y", "full_date"), ("%d %b %Y", "full_date"),
        ("%Y-%m", "month_year"), ("%B %Y", "month_year"), ("%b %Y", "month_year"),
        ("%Y", "year")
    ]
    for fmt, dtype in date_patterns:
        try:
            return datetime.datetime.strptime(date_input, fmt), dtype
        except ValueError:
            continue
    return None, None

def get_file_date(path):
    """Return datetime of file's mtime."""
    return datetime.datetime.fromtimestamp(path.stat().st_mtime)

def filter_files_by_date(files, date_obj, date_type):
    matched = []
    for f in files:
        fd = get_file_date(f)
        if date_type == "full_date":
            if fd.date() == date_obj.date():
                matched.append(f)
        elif date_type == "month_year":
            if fd.year == date_obj.year and fd.month == date_obj.month:
                matched.append(f)
        elif date_type == "year":
            if fd.year == date_obj.year:
                matched.append(f)
    return matched

def collect_files_keyword(keyword, root=Path(".")):
    return [p for p in root.iterdir() if p.is_file() and keyword.lower() in p.name.lower()]

def collect_files_extension(ext, root=Path(".")):
    if not ext.startswith("."):
        ext = "." + ext
    return [p for p in root.iterdir() if p.is_file() and p.suffix.lower() == ext.lower()]

# ---------- Core organizer behavior ----------
def run_organizer(mode, params, base_path=".", auto_confirm=True):
    """
    mode: "1","2","3","4"
    params: dict with keys depending on mode:
      mode1: {"keyword": "...", "dest": "optional_dest_folder"}
      mode2: {"date": "...", "dest": "optional_dest_folder"}
      mode3: {"ext": "...", "dest": "optional_dest_folder"}
      mode4: {"ext":"...", "date":"...", "dest": "optional_dest_folder"}
    base_path: directory to scan (default current working dir)
    auto_confirm: if True, no interactive confirmation (used by Electron)
    Returns dict: {status: "success"/"error", moved: [...], skipped: [...], message: "..."}
    """
    root = Path(base_path)
    files_to_move = []
    try:
        if mode == "1":
            keyword = params.get("keyword","").strip()
            if not keyword:
                return {"status":"error","message":"Missing keyword for mode 1"}
            files_to_move = collect_files_keyword(keyword, root)
            dest_folder = params.get("dest") or f"{keyword}_Folder"

        elif mode == "2":
            date_input = params.get("date","").strip()
            date_obj, date_type = parse_date(date_input)
            if not date_obj:
                return {"status":"error","message":"Invalid date format for mode 2"}
            candidates = [p for p in root.iterdir() if p.is_file()]
            files_to_move = filter_files_by_date(candidates, date_obj, date_type)
            dest_folder = params.get("dest") or date_input.replace(" ", "_")

        elif mode == "3":
            ext = params.get("ext","").strip()
            if not ext:
                return {"status":"error","message":"Missing extension for mode 3"}
            files_to_move = collect_files_extension(ext, root)
            dest_folder = params.get("dest") or f"{ext.lstrip('.').upper()}_Files"

        elif mode == "4":
            ext = params.get("ext","").strip()
            date_input = params.get("date","").strip()
            if not ext or not date_input:
                return {"status":"error","message":"Missing ext or date for mode 4"}
            date_obj, date_type = parse_date(date_input)
            if not date_obj:
                return {"status":"error","message":"Invalid date format for mode 4"}
            candidates = [p for p in root.iterdir() if p.is_file() and p.suffix.lower() == (ext if ext.startswith('.') else '.'+ext).lower()]
            files_to_move = filter_files_by_date(candidates, date_obj, date_type)
            dest_folder = params.get("dest") or f"{date_input.replace(' ','_')}_{ext.lstrip('.')}_Files"

        else:
            return {"status":"error","message":"Invalid mode"}

        if not files_to_move:
            return {"status":"success","moved":[], "skipped":[], "message":"No matching files"}

        moved = []
        skipped = []
        if not auto_confirm:
            # interactive preview
            print("Files to move:")
            for f in files_to_move:
                print(" -", f.name)
            ans = input("Proceed? (y/n): ").strip().lower()
            if ans != "y":
                return {"status":"success","moved":[], "skipped":[str(p) for p in files_to_move], "message":"User cancelled"}

        # perform moves
        for p in files_to_move:
            try:
                newp = move_file(str(p), dest_folder)
                moved.append(newp)
            except Exception as e:
                skipped.append({"file": str(p), "error": str(e)})

        return {"status":"success", "moved": moved, "skipped": skipped, "dest_folder": str(dest_folder)}
    except Exception as e:
        return {"status":"error", "message": str(e)}

# ---------- CLI / Electron input handling ----------
def read_stdin_json():
    if sys.stdin and not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None
    return None

def main():
    # If CLI args: allow quick CLI usage: mode and simple params
    # CLI examples:
    # python file_organizer.py 1 keyword=invoice dest=Invoices
    # python file_organizer.py 2 date="July 2025"
    argv = sys.argv[1:]
    stdin_payload = read_stdin_json()
    if stdin_payload:
        # Expected structure:
        # { "mode": "1", "params": {...}, "base_path": ".", "auto_confirm": true }
        mode = str(stdin_payload.get("mode","")).strip()
        params = stdin_payload.get("params", {})
        base = stdin_payload.get("base_path", ".")
        auto_confirm = bool(stdin_payload.get("auto_confirm", True))
        result = run_organizer(mode, params, base, auto_confirm=auto_confirm)
        print(json.dumps(result))
        return

    # Fallback to CLI parsing:
    if argv:
        mode = argv[0]
        params = {}
        for token in argv[1:]:
            if "=" in token:
                k,v = token.split("=",1)
                params[k] = v
        # CLI should be interactive (auto_confirm=False) for preview
        result = run_organizer(mode, params, ".", auto_confirm=False)
        print(json.dumps(result))
        return

    # If nothing provided, show usage
    usage = {
        "usage": "Electron mode: send JSON via stdin. CLI mode: python file_organizer.py <mode> key=value ...",
        "modes": {
            "1": "keyword mode. params: keyword, dest (optional)",
            "2": "date mode. params: date, dest (optional)",
            "3": "extension mode. params: ext, dest (optional)",
            "4": "ext + date. params: ext, date, dest (optional)"
        }
    }
    print(json.dumps({"status":"info","help": usage}))

if __name__ == "__main__":
    main()

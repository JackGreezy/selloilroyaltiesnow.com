#!/usr/bin/env bash
set -euo pipefail

ROOT=/Users/jackgreenberg/Desktop/rank-and-rent
S=$ROOT/David/clones/scripts
PROJ=$ROOT/mineral-rights/selloilroyaltiesnow.com
REFHOST=gomspace-com
VOICE=$PROJ/site-voice.json
CFG=$PROJ/home.config.json
MAP=$PROJ/relabel-map.json
CAP=$ROOT/David/clones/_captures/$REFHOST
PAGES="home=https://gomspace.com/,about=https://gomspace.com/about-gomspace/,contact=https://gomspace.com/contact/,index=https://gomspace.com/products/,slug=https://gomspace.com/product/nanopower-p80/"

[ -f "$CFG" ] || { echo "MISSING $CFG"; exit 1; }
[ -f "$MAP" ] || { echo "MISSING $MAP"; exit 1; }
[ -f "$VOICE" ] || { echo "MISSING $VOICE"; exit 1; }
[ -f "$PROJ/AGENTS.md" ] || { echo "MISSING site-specific editorial rules"; exit 1; }

if [ ! -f "$CAP/public/home.html.ref" ]; then
  node "$S/faithful-home.mjs" \
    --src "https://gomspace.com/" \
    --pages "$PAGES" \
    --dir "$CAP"
fi

node "$S/capture_gate.mjs" "$CAP"

mkdir -p "$PROJ/public" "$PROJ/qa-out"
cp "$CAP"/public/*.html.ref "$PROJ/public/"
rm -rf "$PROJ/public/assets-f"
cp -R "$CAP/public/assets-f" "$PROJ/public/"
cp "$CAP"/qa-out/ref-*.png "$PROJ/qa-out/" 2>/dev/null || true
perl -pi -e 's/[ \t]+$//' "$PROJ/public/assets-f/css"/*.css

python3 "$S/normalize_content.py" "$PROJ" --voice "$VOICE"

rm -rf "$PROJ/public/ours"
cp -R "$PROJ/images" "$PROJ/public/ours"

python3 "$S/relabel_engine.py" \
  --config "$CFG" \
  --map "$MAP" \
  --voice "$VOICE"
python3 "$S/verify_site.py" \
  "$PROJ" \
  --map "$MAP" \
  --json "$PROJ/qa-out/verify.json"
python3 "$PROJ/scripts/compliance_scan.py"

rm -f "$PROJ/public/"*.html.ref

python3 - "$PROJ" <<'PY'
import pathlib
import shutil
import sys

project = pathlib.Path(sys.argv[1])
assets = project / "public" / "assets-f"
removed = []

for dirname in ("img", "js", "media"):
    directory = assets / dirname
    if directory.is_dir():
        removed.extend(path for path in directory.rglob("*") if path.is_file())
        shutil.rmtree(directory)

for path in assets.rglob("*"):
    if not path.is_file():
        continue
    head = path.read_bytes()[:4096].lstrip().lower()
    if head.startswith(b"<!doctype html") or head.startswith(b"<html") or b"<html" in head[:512]:
        removed.append(path)
        path.unlink()

print(
    f"ASSET CLEANUP: removed {len(set(removed))} unused donor media/runtime files; "
    "captured CSS, webfonts, and the navigation SVG sprite remain"
)
PY

python3 "$PROJ/scripts/compliance_scan.py"

QA_PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
node "$S/qa_shots.mjs" "$PROJ" --port "$QA_PORT"

echo "BUILD COMPLETE — all faithful-home, structural, content, media, and browser gates are green."

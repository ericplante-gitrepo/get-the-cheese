#!/usr/bin/env bash
# Inlines vendor/three.min.js (r159) and src/render3d.js into src/game.html at the <!--THREE--> marker -> index.html (single file, offline).
set -euo pipefail; cd "$(dirname "$0")"
python3 - <<'P'
s=open('src/game.html').read(); t=open('vendor/three.min.js').read()
assert '<!--THREE-->' in s
r=open('src/render3d.js').read()
assert '<!--RENDER-->' in s
s=s.replace('<!--THREE-->','<script id="three-lib">'+t+'</script>',1).replace('<!--RENDER-->','<script id="render">'+r+'</script>',1)
open('index.html','w').write(s)
P

# Task: write src/render3d.js, the swappable 3D board renderer for Get the Cheese
Follow the read-only STYLE_GUIDE_v2_3D.md (camera, lighting, materials, proportions, motion, iPad section). THREE (three.js r159, classic global build) is already loaded as a global before this script. No network loads, no other libraries, no imports/modules: plain script defining `window.Renderer`.

## Interface (the game UI already calls exactly this; nothing else)
`Renderer.init(containerEl, getState)`: create a <canvas> inside containerEl (a div sized by CSS), start a requestAnimationFrame loop that each frame calls `getState()` and draws. Handle window resize/orientationchange and ResizeObserver if available (size renderer to container clientWidth/Height; pixel ratio = Math.min(devicePixelRatio||1, 2)).
getState() returns `{ level, view, celebrate }`:
- level: `{ start:[r,c], dir, cheese:[r,c], walls:['r,c,N|E|S|W', ...] }`, board is 4x4, r=0 is far/top row, c=0 left. dir/angle: 0=N(toward row-1), 1=E(col+1), 2=S, 3=W. A wall 'r,c,E' lies on the east edge of cell (r,c); 'r,c,N' on its north edge, etc. (same edge can appear from either side; dedupe).
- view: `{ row, col, angle, ox, oy }` floats (animated by the UI). angle is radians, angle = dir*PI/2 means facing that dir (0 = toward row-1, increasing clockwise when seen from above). Mouse world position = cell (row+oy, col+ox). The mouse's nose must point along its facing so "forward" visibly follows the nose.
- celebrate: null or `{ t0 }` (performance.now() at win). While set, the mouse does the win hop (0.15 tile) and two nibbles (cheese scales to 0.9 each bite), and 12 sparkles #fff3c4 pop around the cheese, over ~1.6 s.
- The level object changes identity when the level changes: rebuild walls/cheese then (cache by reference).

## Scene
- World: tile = 1 unit, board centred at origin on XZ plane, col -> +x, row -> +z (row 0 far from camera). Floor plane #e9e5d8 under the board.
- Tiles: 16 separate rounded slabs (use a beveled box: e.g. ExtrudeGeometry of a rounded rect, or BoxGeometry if simpler) 0.97 wide, 0.12 thick, gap 0.03, colour #a3d13c roughness 0.45; alternate a very slightly darker #9bc936 for readability.
- Walls: 1.0 long, 0.10 thick, 0.30 tall, #8e44c9 roughness 0.35, on the tile seam, with a rounded top (a capsule-ish top: box + half-cylinder on top is fine).
- Mouse (our own design, ~10 meshes max): egg body (scaled sphere) 0.62 long, 0.46 wide, 0.30 tall, #7ec4f2 roughness 0.3; belly lighter #d6efff; two round ears 0.16 across with inner #ff8fa8; pink nose #ff8fa8; two eyes #202b50 with tiny white specular dots; thin curled tail 0.35 long (TubeGeometry on a curve). Add a navy #202b50 outline via an inverted-hull (BackSide, slightly scaled) on the body only. Idle breathing scale 1.00-1.03 every 1.6 s; small 0.02 bob and tail wiggle while moving (detect movement from view changes between frames).
- Cheese: triangular wedge 0.38 long, 0.22 tall, #ffd23f roughness 0.5, 3 dark round holes #e0901c (small flattened cylinders/circles on faces), navy inverted-hull outline, rotated a little toward the camera.
- Camera: PerspectiveCamera fov 32, looking at the board centre, pitched 50 degrees down from horizontal and yawed 30 degrees around the board. Distance chosen so the whole board (plus wall height) fits the container in both landscape (board ~70% of height) and portrait (~90% of width): compute from the board's bounding sphere and the aspect each resize.
- Lights: DirectionalLight #fff4e0 intensity 1.0 from upper-left-front; HemisphereLight #e8f4ff / #c9c2ae 0.6; rim DirectionalLight #ffffff 0.3 from behind. renderer.toneMapping = ACESFilmicToneMapping, exposure 1.0, outputColorSpace SRGB.
- Shadows: one directional shadow map 1024, PCFSoftShadowMap; only the mouse, cheese and walls castShadow; tiles/floor receiveShadow. Keep the shadow camera tight around the board.
- Bump: keep it simple; the UI's ox/oy shake is enough. Do NOT add a squash or boing animation.

## Fallback
If WebGL is unavailable (try/catch around `new THREE.WebGLRenderer`, or context lost), draw a simple flat top-down 2D canvas instead in the same container each frame: green 4x4 tiles, purple wall bars, a blue circle with a nose dot for the mouse, a yellow triangle cheese, with dark blob ellipse shadows. Never leave a blank screen, never throw.

## Testing hook
Expose `Renderer.info()` returning `{ mode: 'webgl'|'2d', meshes: <count> }` so headless tests can confirm WebGL rendered.
Keep the file compact (aim for under ~450 lines) and readable.

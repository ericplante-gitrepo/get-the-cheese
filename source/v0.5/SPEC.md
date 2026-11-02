# Get the Cheese v0.1 spec
Single-file kids' web game `index.html` (inline CSS + JS, no external assets/libs, works offline). Must work on Fire tablet browser (touch, landscape and portrait) and desktop (mouse). Use pointer events, big buttons (min 64px), no hover-only UI, `touch-action: manipulation`, viewport meta, scales to fit the screen.

## Look (placeholders, simple shapes on canvas or SVG)
- 4x4 board of square green tiles, alternate between #97B43E and #9FBE3D, thin dark seams (#3d4a1a) between tiles. Page background warm floor #CECCBF.
- Walls: thin saturated violet (#7B2FBE) bars lying on tile edges, with soft drop shadow (soft top-down lighting).
- Mouse: our own unbranded robot mouse: rounded teardrop body #7FACCB about half a tile long, two small round ears, a nose dot, pointing in its facing direction, with soft shadow. No names/logos/brands anywhere.
- Cheese: small yellow wedge #DDDB55 (triangle with a couple of holes), about a quarter of mouse size.
- Move buttons coloured like the toy: forward blue, back yellow, turn left orange, turn right purple, GO green (big), clear red. Use arrow icons, not words, plus small labels.

## Rules (pure logic, separate from rendering)
- Grid 4x4, cells (r,c), r=0 top. Directions 0=N,1=E,2=S,3=W. DR=[-1,0,1,0], DC=[0,1,0,-1].
- Level: `{ name, start:[r,c], dir, cheese:[r,c], walls:[...] }`. A wall is a string like "r,c,E" meaning a wall on the east edge of cell (r,c); allowed sides N,E,S,W (same wall can be written from either side; treat "0,0,E" same as "0,1,W").
- Moves: 'F' forward one tile, 'B' back one tile (moves opposite to facing, keeps facing), 'L' turn left 90 in place, 'R' turn right 90 in place.
- `step(level, state, move)` -> `{type:'move'|'turn'|'wall'|'off', state}`. Crossing a wall edge => 'wall' (mouse stays). Leaving the 4x4 => 'off'.
- `runProgram(level, moves)` -> `{result:'win'|'wall'|'off'|'short'|'empty', at, trace}`. Win only if all moves ran without bump and the final cell is the cheese. Passing over the cheese mid-program does not win (like the toy, it ends on the cheese). Empty list => 'empty'.
- `solve(level, maxLen=12)` BFS over (cell,dir) returning the shortest move list or null.
- Max program length 20.

## Flow
- Planning: tapping move buttons appends to a visible program strip of arrow cards (one card per step, coloured like the button). Tap a card to remove that step. Clear wipes the list. Nothing moves while planning.
- GO: disables buttons, animates the mouse step by step (~0.5 s per step, smooth slide for moves, smooth rotation for turns), highlights the current card.
- Win: happy overlay "You got the cheese!" with cheese bounce/confetti, "Next level" button. Lose (wall bump: mouse shakes against the wall; off board: mouse wobbles at the edge; short: ends elsewhere): friendly overlay "Oops! Try again" with "Try again" button that resets mouse to start and KEEPS the program so they can fix it. Also a "Reset mouse" button.
- At least 8 hand-made levels, gently increasing difficulty (first level no walls, straight line). Level picker row of numbered dots; remember progress in localStorage (wrapped in try/catch).
- Simple WebAudio beeps for step, bump, win (created on first user gesture; must not throw if unavailable).

## Node testability
Put all pure logic in `<script id="logic">` that defines LEVELS, DR, DC, step, runProgram, solve, normWalls/hasWall, and ends with `if (typeof module !== 'undefined') module.exports = { LEVELS, step, runProgram, solve, hasWall };`. The rendering/UI goes in a separate later `<script>`. That logic script must not touch `document`/`window`.

## Tests: `test.js` (node, no deps, `node test.js`, exits nonzero on failure)
Extract the `<script id="logic">` text from index.html and run it with `vm` / `new Function` to get the exports. Cover: forward/back/turn moves, turns don't move, wall blocks from both sides, off-board, win, short, passing over cheese is not a win, empty program, every level valid (start/cheese inside board, start != cheese, walls well-formed) and solvable via solve(), and that runProgram(solve(level)) wins for each level.

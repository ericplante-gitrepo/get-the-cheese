Write a replacement for the pure-logic section of a kids' grid puzzle game (the reference file game.html contains the current `<script id="logic">`). Return the COMPLETE new content of that script (without the <script> tags), keeping LEVELS exactly as given in the reference (copy the 10 entries verbatim, byte-for-byte; I will append more levels myself after the array — end the array with the comment line `  // @@V05_LEVELS@@` before `];`).

Changes required:
1. Board size per level: `level.size` (default 4). Remove the global SIZE use in movement; `inBoard(level, r, c)`. Keep `const SIZE = 4;` defined for compatibility. `MAX_PROGRAM = 24`.
2. Terrain: optional `level.cells`, an object keyed "r,c" -> { h: 0|1, kind?: 'ramp'|'crate'|'water'|'bridge', rampDir?: 'N'|'E'|'S'|'W', axis?: 'NS'|'EW', water?: true }. Missing cell = { h: 0 }. Provide `cellAt(level, r, c)`.
3. Movement `step(level, state, move)`: state is {r,c,d} plus `layer` ('top' or 'under') ONLY while on a bridge cell (omit the property otherwise, so old tests with deepStrictEqual {r,c,d} still pass). L/R turn in place keeping layer. F/B: dir = d or opposite. Order of checks: wall edge in level.walls -> {type:'wall'}; off board -> {type:'off'}; then height logic:
   - exitHeight(cell, layer, dir): normal cell -> h. crate/water never occupied. ramp with rampDir R (index via SIDE): dir===R -> 1, dir===opposite(R) -> 0, sideways -> null. bridge: if layer 'top': dir along axis -> 1, else null; if layer 'under': dir across axis -> 0, else null.
   - entry into target cell moving in dir with height e (e from exitHeight; null -> wall): crate/water -> wall. normal cell: requires e === h. ramp R: moving in R requires e===0; moving opposite R requires e===1; sideways -> wall. bridge: moving along axis requires e===1 -> layer 'top'; moving across axis requires e===0 and !cell.water -> layer 'under'; otherwise wall.
   - Return {type:'move', state:{r,c,d[,layer]}} or {type:'wall', state} (unchanged state).
4. runProgram same as now; win requires final cell = level.cheese and, if the cheese cell is a bridge, state.layer === (level.cheeseLayer || 'top').
5. solve(level, maxLen=16): same BFS, same tie-break (fewest B, then FLRB order), but state key includes layer, and the goal test uses the same win condition as runProgram (helper `isWin(level, state)`).
6. Export helper `surfaceY(level, r, c, layer)` returning height in steps for rendering: normal h; ramp 0.5; bridge top 1, under 0; crate/water 0. Also `rampPitch(level, r, c)` not needed.
7. module.exports adds cellAt, isWin, surfaceY, inBoard, MAX_PROGRAM, SIDE.
No document/window references anywhere (a test greps the words "document" and "window" — avoid them even in comments).

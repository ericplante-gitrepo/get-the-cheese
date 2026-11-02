# Get the Cheese v0.5 gameplay spec (App Builder, Nov 1 2026)

The look of each piece comes from the Art Director's addition to STYLE_GUIDE_v2_3D.md. This file covers rules, levels and tests only.

## Keep
- Levels 1-10 stay exactly as they are, with the same answers. The buttons stay F, B, L, R, Clear, GO, Hint, Reset. No new controls.
- One index.html, offline, three.js inline. All existing 73 tests must still pass.

## New world "Up High", levels 11-20
- Board: 4x4 for L11-L14, 5x5 for L15-L20. Generalise the hard-coded 4x4 everywhere: the logic, the solver, the camera fit, and the picker, which goes to 20 dots in two rows of 10.
- Look: `crate` cells are drawn as the Art Director's rocks or flower pots (both block). Water, ramps, platforms and bridges follow STYLE_GUIDE_v2_3D.md v2.1.
- Each cell has `h` (height 0 or 1) and an optional `kind`: `ramp` (with `rampDir` N/E/S/W, the direction you travel to go UP), `crate`, `water`, or `bridge` (with `axis` NS or EW).

## Movement rules (F and B both use them, B moves opposite to facing)
1. Off the board gives `off`, and walls give `wall`, as now.
2. Entering a `crate` or `water` cell gives `wall` (bump), and the mouse stays put.
3. Height: moving between cells with the same height is fine. A height-0 cell next to a height-1 cell only connects through a ramp. A ramp cell sits between the levels. You enter it from its low end, moving in rampDir, from h0, or from its high end, moving opposite to rampDir, from h1. You leave it the same way, to h1 at the top or h0 at the bottom. Any other step between different heights gives `wall` (a cliff edge reads as a wall).
4. Bridge: a cell with `kind: bridge` is a plank at h1 over water at h0. Moving along its axis from h1 cells or ramp tops crosses on top. Moving across its axis at h0 goes under the bridge, which is only allowed when the cell beneath is not water. Either form is allowed in a level. State tracks the layer (top or under) while the mouse is on a bridge cell.
5. Turning is allowed anywhere, including on a ramp or a bridge.
6. Win: the program ends on the cheese cell, and on the cheese's layer if that cell is a bridge.

## Solver and tests
- BFS over (r, c, dir, layer). maxLen goes up to 16 for these levels. Max program length goes from 20 to 24.
- New unit tests: ramp up and down; side entry to a ramp is a wall; a cliff is a wall in both directions; crate and water bump; bridge over and under; a full win on the 5x5 board.
- The level-design test extends to L11-L20. Every level must be solvable. Answers must be all distinct and not repeat L1-L10. Shortest length should rise roughly from 9 to 16, at no more than +2 per level. At least 3 levels need B, and R must be used.

## The 10 levels (Dispatch designs the exact grids, and the solver checks them)
- L11 First Ramp: one ramp up to a 2-tile platform with the cheese on top.
- L12 Down Again: up a ramp, across, and down the far ramp.
- L13 Crate Push-Around: crates force a detour with an R turn.
- L14 The Stream: water splits the board, and one bridge crosses it.
- L15 (5x5) Two Ramps: only one of the ramps leads to the cheese.
- L16 Under the Bridge: the cheese is under the bridge, so you have to go under it.
- L17 Over and Under: the path goes over the bridge, round, and back under it.
- L18 Back Up: needs B on a ramp.
- L19 Island: the cheese is on a platform reached only by a bridge.
- L20 Big Climb: everything combined, answer about 16.

## Animation
Going up or down a ramp tilts the mouse along the slope in the same 0.45 s per tile. A bump against a crate, water or a cliff uses the existing shake. Crossing under a bridge keeps the mouse visible, so make the plank semi-transparent or lift the camera a little.

## Process
- Work on a branch `v0.5` with a PR. Do NOT push to main, because main deploys the live link. The live link stays on v0.4 until Eric says yes.
- Post shots of L11, L16, L17 and L20 at 1024x768 and 768x1024, plus the level table.

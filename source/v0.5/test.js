'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const match = html.match(/<script id="logic">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('FAIL: <script id="logic"> not found in index.html');
  process.exit(1);
}
const logicCode = match[1];
const mod = { exports: {} };
new Function('module', logicCode)(mod);
const { LEVELS: ALL_LEVELS, step, runProgram, solve, hasWall, nextHint, isWin, cellAt, MAX_PROGRAM } = mod.exports;
// v0.2-v0.4 level-design rules apply to world 1 (L1-L10); world 2 (L11-L20) has its own rules below.
const LEVELS = ALL_LEVELS.slice(0, 10);

let passes = 0, failures = 0;
function test(name, fn) {
  try {
    fn();
    passes++;
    console.log('ok   - ' + name);
  } catch (e) {
    failures++;
    console.log('FAIL - ' + name + '\n       ' + e.message);
  }
}

// Level used for unit tests: open 4x4 board, mouse at (1,1) facing E.
function openLevel(extra = {}) {
  return Object.assign({ name: 'test', start: [1, 1], dir: 1, cheese: [3, 3], walls: [] }, extra);
}

// ---------------------------------------------------------------- moves
test('forward moves one tile in facing direction', () => {
  const r = step(openLevel(), { r: 1, c: 1, d: 1 }, 'F');
  assert.strictEqual(r.type, 'move');
  assert.deepStrictEqual(r.state, { r: 1, c: 2, d: 1 });
});

test('back moves one tile opposite to facing and keeps facing', () => {
  const r = step(openLevel(), { r: 1, c: 1, d: 1 }, 'B');
  assert.strictEqual(r.type, 'move');
  assert.deepStrictEqual(r.state, { r: 1, c: 0, d: 1 });
});

test('turn left rotates 90 degrees counter-clockwise without moving', () => {
  const r = step(openLevel(), { r: 1, c: 1, d: 1 }, 'L');
  assert.strictEqual(r.type, 'turn');
  assert.deepStrictEqual(r.state, { r: 1, c: 1, d: 0 });
  const r2 = step(openLevel(), { r: 1, c: 1, d: 0 }, 'L');
  assert.strictEqual(r2.state.d, 3);
});

test('turn right rotates 90 degrees clockwise without moving', () => {
  const r = step(openLevel(), { r: 1, c: 1, d: 1 }, 'R');
  assert.strictEqual(r.type, 'turn');
  assert.deepStrictEqual(r.state, { r: 1, c: 1, d: 2 });
  const r2 = step(openLevel(), { r: 1, c: 1, d: 3 }, 'R');
  assert.strictEqual(r2.state.d, 0);
});

test('forward and back moves work for N and S facing', () => {
  assert.deepStrictEqual(step(openLevel(), { r: 2, c: 2, d: 0 }, 'F').state, { r: 1, c: 2, d: 0 });
  assert.deepStrictEqual(step(openLevel(), { r: 2, c: 2, d: 2 }, 'F').state, { r: 3, c: 2, d: 2 });
  assert.deepStrictEqual(step(openLevel(), { r: 2, c: 2, d: 0 }, 'B').state, { r: 3, c: 2, d: 0 });
});

// ---------------------------------------------------------------- walls
test('wall blocks movement from the west side', () => {
  const L = openLevel({ walls: ['1,1,E'] });
  const r = step(L, { r: 1, c: 1, d: 1 }, 'F');
  assert.strictEqual(r.type, 'wall');
  assert.deepStrictEqual(r.state, { r: 1, c: 1, d: 1 });
});

test('same wall blocks movement from the east side (written as W)', () => {
  const L = openLevel({ walls: ['1,1,E'] });
  const r = step(L, { r: 1, c: 2, d: 3 }, 'F');
  assert.strictEqual(r.type, 'wall');
  assert.deepStrictEqual(r.state, { r: 1, c: 2, d: 3 });
});

test('"0,0,E" is the same wall as "0,1,W"', () => {
  assert.strictEqual(hasWall(['0,0,E'], 0, 1, 3), true);
  assert.strictEqual(hasWall(['0,1,W'], 0, 0, 1), true);
  assert.strictEqual(hasWall(['0,0,E'], 0, 0, 2), false);
});

test('wall blocks back movement too', () => {
  const L = openLevel({ walls: ['1,0,E'] });
  const r = step(L, { r: 1, c: 1, d: 1 }, 'B');
  assert.strictEqual(r.type, 'wall');
});

test('south wall blocks movement from both sides', () => {
  const L = openLevel({ walls: ['1,0,S'] });
  assert.strictEqual(step(L, { r: 1, c: 0, d: 2 }, 'F').type, 'wall');
  assert.strictEqual(step(L, { r: 2, c: 0, d: 0 }, 'F').type, 'wall');
});

test('wall with a bump gives wall result from runProgram', () => {
  const L = openLevel({ walls: ['1,2,E'] });
  const res = runProgram(L, ['F', 'F']);
  assert.strictEqual(res.result, 'wall');
  assert.strictEqual(res.at, 1);
});

// ---------------------------------------------------------------- off board
test('moving off the board is reported as off', () => {
  const L = openLevel({ start: [0, 0], dir: 0 });
  assert.strictEqual(step(L, { r: 0, c: 0, d: 0 }, 'F').type, 'off');
  assert.strictEqual(step(L, { r: 0, c: 0, d: 1 }, 'B').type, 'off');
});

test('runProgram reports off board', () => {
  const L = { name: 'x', start: [0, 0], dir: 1, cheese: [0, 3], walls: [] };
  assert.strictEqual(runProgram(L, ['F', 'F', 'F', 'F']).result, 'off');
});

// ---------------------------------------------------------------- runProgram outcomes
test('win when all moves run and the final cell is the cheese', () => {
  const L = { name: 'x', start: [0, 0], dir: 1, cheese: [0, 3], walls: [] };
  assert.strictEqual(runProgram(L, ['F', 'F', 'F']).result, 'win');
});

test('short when moves run but the mouse is not on the cheese', () => {
  const L = { name: 'x', start: [0, 0], dir: 1, cheese: [0, 3], walls: [] };
  assert.strictEqual(runProgram(L, ['F', 'F']).result, 'short');
});

test('passing over the cheese mid-program is not a win', () => {
  const L = { name: 'x', start: [0, 0], dir: 1, cheese: [0, 1], walls: [] };
  const res = runProgram(L, ['F', 'F']);
  assert.strictEqual(res.result, 'short');
  assert.deepStrictEqual(res.trace[1], { r: 0, c: 1, d: 1 });
});

test('empty program gives empty result', () => {
  const L = { name: 'x', start: [0, 0], dir: 1, cheese: [0, 3], walls: [] };
  assert.strictEqual(runProgram(L, []).result, 'empty');
});

test('turns alone can end on the cheese only if the cell matches', () => {
  const L = { name: 'x', start: [0, 0], dir: 1, cheese: [0, 0], walls: [] };
  assert.strictEqual(runProgram(L, ['R', 'L']).result, 'win');
});

// ---------------------------------------------------------------- levels
test('there are at least 8 levels', () => {
  assert.ok(LEVELS.length >= 8, 'only ' + LEVELS.length + ' levels');
});

test('first level is a straight line with no walls', () => {
  const L = LEVELS[0];
  assert.strictEqual(L.walls.length, 0);
  assert.ok(solve(L).every(m => m === 'F'), 'forward only');
});

// ---- level design rules (v0.2) ----
const SOLS = LEVELS.map(L => solve(L, 16));
const bare = (L, allowed) => {          // shortest length using only the allowed moves (BFS)
  const k = s => s.r + ',' + s.c + ',' + s.d; let f = [{ r: L.start[0], c: L.start[1], d: L.dir }]; const seen = new Set(f.map(k));
  for (let n = 1; n <= 20; n++) { const nx = [];
    for (const s of f) for (const m of allowed) { const r = step(L, s, m); if (r.type === 'wall' || r.type === 'off') continue;
      if (r.state.r === L.cheese[0] && r.state.c === L.cheese[1]) return n; if (!seen.has(k(r.state))) { seen.add(k(r.state)); nx.push(r.state); } }
    f = nx; } return Infinity; };
test('turn right is required: at least 4 levels need R (no F/L-only route as short)', () => {
  const need = LEVELS.filter((L, i) => SOLS[i].includes('R') && bare(L, 'FL') > SOLS[i].length);
  assert.ok(need.length >= 4, 'only ' + need.length);
});
test('every level has a distinct shortest solution', () => {
  const keys = SOLS.map(s => s.join(''));
  assert.strictEqual(new Set(keys).size, keys.length, keys.join(' '));
});
test('shortest-solution length never decreases and rises overall', () => {
  for (let i = 1; i < SOLS.length; i++) assert.ok(SOLS[i].length >= SOLS[i - 1].length, 'level ' + (i + 1));
  assert.ok(SOLS[SOLS.length - 1].length >= SOLS[0].length + 6);
});
test('wall count never decreases, and walls start by level 2 or 3', () => {
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].walls.length >= LEVELS[i - 1].walls.length, 'level ' + (i + 1));
  assert.ok(LEVELS[2].walls.length >= 1);
});
test('back moves: at most 2 levels use B, max 1 each, never in levels 1-5', () => {
  const withB = SOLS.map((s, i) => [i, s.filter(m => m === 'B').length]).filter(x => x[1] > 0);
  assert.ok(withB.length <= 2); withB.forEach(([i, n]) => { assert.ok(n <= 1); assert.ok(i >= 5); });
});
test('walls shape the route from level 3 on (removing all walls makes it shorter)', () => {
  LEVELS.forEach((L, i) => { if (i >= 2) assert.ok(solve({ ...L, walls: [] }, 16).length < SOLS[i].length, 'level ' + (i + 1)); });
});
test('levels without B in the plan can be solved forward-and-turns only at the same length', () => {
  LEVELS.forEach((L, i) => { if (!SOLS[i].includes('B')) assert.strictEqual(bare(L, 'FLR'), SOLS[i].length, 'level ' + (i + 1)); });
});

LEVELS.forEach((L, i) => {
  const label = 'level ' + (i + 1) + ' (' + L.name + ')';
  const inBoard = p => p[0] >= 0 && p[0] < 4 && p[1] >= 0 && p[1] < 4;

  test(label + ' is valid: start and cheese on board and different', () => {
    assert.ok(inBoard(L.start), 'start off board');
    assert.ok(inBoard(L.cheese), 'cheese off board');
    assert.notDeepStrictEqual(L.start, L.cheese);
    assert.ok([0, 1, 2, 3].includes(L.dir), 'bad dir');
  });

  test(label + ' has well-formed walls', () => {
    for (const w of L.walls) {
      assert.match(w, /^\d,\d,[NESW]$/, 'malformed wall ' + w);
      const [r, c] = w.split(',').map(Number);
      assert.ok(inBoard([r, c]), 'wall cell off board: ' + w);
    }
  });

  test(label + ' is solvable within 12 moves', () => {
    const sol = solve(L, 12);
    assert.ok(sol && sol.length > 0, 'no solution found');
    assert.ok(sol.length <= 12, 'solution too long: ' + sol.length);
  });

  test(label + ' solution actually wins', () => {
    const sol = solve(L, 12);
    assert.strictEqual(runProgram(L, sol).result, 'win');
  });
});

// ---------------------------------------------------------------- purity
test('logic script does not touch document or window', () => {
  assert.ok(!/\bdocument\b/.test(logicCode), 'logic references document');
  assert.ok(!/\bwindow\b/.test(logicCode), 'logic references window');
});

// ---------------------------------------------------------------- nextHint
function hintLevel() {
  return { name: 'h', start: [1, 1], dir: 1, cheese: [1, 3], walls: [] };
}

test('nextHint empty program returns first move', () => {
  const res = nextHint(hintLevel(), []);
  assert.strictEqual(res.kind, 'move');
  assert.strictEqual(res.move, 'F');
});

test('nextHint matching prefix returns next move', () => {
  const res = nextHint(hintLevel(), ['F']);
  assert.strictEqual(res.kind, 'move');
  assert.strictEqual(res.move, 'F');
});

test('nextHint full match returns done', () => {
  const res = nextHint(hintLevel(), ['F', 'F']);
  assert.strictEqual(res.kind, 'done');
});

test('nextHint diverged returns clear', () => {
  const res = nextHint(hintLevel(), ['B']);
  assert.strictEqual(res.kind, 'clear');
});

test('nextHint longer than solution returns clear', () => {
  const res = nextHint(hintLevel(), ['F', 'F', 'F']);
  assert.strictEqual(res.kind, 'clear');
});

require('./test-v05.js')({ test, assert, LEVELS: ALL_LEVELS, step, runProgram, solve, isWin, cellAt, MAX_PROGRAM, logicCode, html });

console.log('\n' + passes + ' passed, ' + failures + ' failed');
process.exitCode = failures ? 1 : 0;

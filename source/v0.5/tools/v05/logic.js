// Pure game logic. No DOM access here.
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];   // 0=N 1=E 2=S 3=W
const SIZE = 4;
const MAX_PROGRAM = 24;
const SIDE = { N: 0, E: 1, S: 2, W: 3 };

// Each level: start [r,c], dir (0=N..3=W), cheese [r,c], walls ["r,c,SIDE", ...], size?, cells?
const LEVELS = [
  { name: "Straight Shot", start: [0, 0], dir: 2, cheese: [3, 0], walls: [] },
  { name: "First Corner", start: [3, 3], dir: 1, cheese: [2, 2], walls: ['3,2,E'] },
  { name: "Right Turn", start: [1, 2], dir: 1, cheese: [2, 0], walls: ['0,1,E', '1,0,S'] },
  { name: "Fence Hop", start: [1, 0], dir: 2, cheese: [2, 2], walls: ['0,1,S', '1,0,S', '1,2,S'] },
  { name: "Around the Post", start: [1, 1], dir: 3, cheese: [2, 0], walls: ['1,0,E', '2,0,E', '2,2,S'] },
  { name: "Twisty Lane", start: [2, 0], dir: 2, cheese: [2, 2], walls: ['0,3,S', '1,0,S', '2,1,E', '3,1,E'] },
  { name: "Long Way Round", start: [1, 2], dir: 3, cheese: [3, 0], walls: ['0,3,S', '1,1,E', '2,0,E', '2,1,S', '3,1,E'] },
  { name: "Purple Maze", start: [3, 0], dir: 3, cheese: [2, 3], walls: ['1,1,E', '1,2,S', '2,0,E', '3,0,E', '3,1,E'] },
  { name: "Back Out", start: [2, 3], dir: 0, cheese: [0, 3], walls: ['0,3,S', '1,1,E', '1,2,S', '1,3,S', '2,1,E', '2,2,S'] },
  { name: "Big Maze", start: [0, 2], dir: 3, cheese: [3, 0], walls: ['0,0,E', '0,0,S', '0,2,S', '1,0,S', '1,1,S', '1,3,S', '3,0,E'] },
  // @@V05_LEVELS@@
];

function inBoard(level, r, c) {
  const sz = level.size || SIZE;
  return r >= 0 && r < sz && c >= 0 && c < sz;
}

function cellAt(level, r, c) {
  if (!inBoard(level, r, c)) return { h: 0 };
  const key = r + ',' + c;
  return (level.cells && level.cells[key]) || { h: 0 };
}

// Canonical key for the edge between a cell and its neighbour in direction d.
// Only E and S edges are stored, so "0,1,W" and "0,0,E" give the same key.
function edgeKey(r, c, d) {
  if (d === 0) return (r - 1) + ',' + c + ',S';
  if (d === 1) return r + ',' + c + ',E';
  if (d === 2) return r + ',' + c + ',S';
  return r + ',' + (c - 1) + ',E';
}

function normWalls(walls) {
  return new Set((walls || []).map(w => {
    const parts = String(w).split(',');
    const d = SIDE[parts[2].trim().toUpperCase()];
    if (d === undefined) throw new Error('bad wall ' + w);
    return edgeKey(+parts[0], +parts[1], d);
  }));
}

function hasWall(walls, r, c, d) {
  return normWalls(walls).has(edgeKey(r, c, d));
}

function exitHeight(level, r, c, layer, d) {
  const cell = cellAt(level, r, c);
  if (!cell.kind) return cell.h;
  if (cell.kind === 'crate' || cell.kind === 'water') return cell.h;

  if (cell.kind === 'ramp') {
    const rd = SIDE[cell.rampDir];
    if (d === rd) return 1;
    if (d === (rd + 2) % 4) return 0;
    return null; // sideways
  }

  if (cell.kind === 'bridge') {
    if (layer === 'top') {
      if (cell.axis === 'NS' && (d === 0 || d === 2)) return 1;
      if (cell.axis === 'EW' && (d === 1 || d === 3)) return 1;
      return null;
    } else if (layer === 'under') {
      if (cell.axis === 'NS' && (d === 1 || d === 3)) return 0;
      if (cell.axis === 'EW' && (d === 0 || d === 2)) return 0;
      return null;
    }
  }

  return cell.h;
}

function entryHeightOk(level, tr, tc, e, dir) {
  const cell = cellAt(level, tr, tc);
  if (e === null || e === undefined) return false;
  if (cell.kind === 'crate' || cell.kind === 'water') return false;
  if (cell.kind === 'ramp') {
    const rd = SIDE[cell.rampDir];
    if (dir === rd) return e === 0;
    if (dir === (rd + 2) % 4) return e === 1;
    return false;
  }
  if (cell.kind === 'bridge') {
    const along = cell.axis === 'NS' ? (dir === 0 || dir === 2) : (dir === 1 || dir === 3);
    return along ? e === 1 : (e === 0 && !cell.water);
  }
  return e === cell.h;
}

// state = { r, c, d [, layer] }. Moves: 'F' forward, 'B' back, 'L' turn left, 'R' turn right.
function step(level, state, move) {
  const { r, c, d, layer } = state;
  const turned = nd => (layer ? { r, c, d: nd, layer } : { r, c, d: nd });
  if (move === 'L') return { type: 'turn', state: turned((d + 3) % 4) };
  if (move === 'R') return { type: 'turn', state: turned((d + 1) % 4) };
  if (move !== 'F' && move !== 'B') throw new Error('bad move ' + move);
  const dir = move === 'F' ? d : (d + 2) % 4;
  if (hasWall(level.walls, r, c, dir)) return { type: 'wall', state };
  const nr = r + DR[dir], nc = c + DC[dir];
  if (!inBoard(level, nr, nc)) return { type: 'off', state };
  const eh = exitHeight(level, r, c, layer, dir);
  if (eh === null) return { type: 'wall', state };
  const targetCell = cellAt(level, nr, nc);
  const entryOk = entryHeightOk(level, nr, nc, eh, dir);
  if (!entryOk) return { type: 'wall', state };
  const newState = { r: nr, c: nc, d };
  if (targetCell.kind === 'bridge') newState.layer = eh === 1 ? 'top' : 'under';
  return { type: 'move', state: newState };
}

function runProgram(level, moves) {
  if (!moves || moves.length === 0) return { result: 'empty', at: 0, trace: [] };
  let state = { r: level.start[0], c: level.start[1], d: level.dir };
  const trace = [state];
  for (let i = 0; i < moves.length; i++) {
    const res = step(level, state, moves[i]);
    if (res.type === 'wall') return { result: 'wall', at: i, trace };
    if (res.type === 'off') return { result: 'off', at: i, trace };
    state = res.state;
    trace.push(state);
  }
  const won = isWin(level, state);
  return { result: won ? 'win' : 'short', at: moves.length - 1, trace };
}

function isWin(level, state) {
  if (state.r !== level.cheese[0] || state.c !== level.cheese[1]) return false;
  const cheeseCell = cellAt(level, level.cheese[0], level.cheese[1]);
  if (cheeseCell.kind === 'bridge') {
    const reqLayer = level.cheeseLayer || 'top';
    return state.layer === reqLayer;
  }
  return true;
}

// Breadth-first search over (cell, dir, layer). Returns the shortest winning move list or null.
function solve(level, maxLen = 16) {
  // Shortest program; ties broken by fewest Back moves, then by F < L < R < B order.
  const ORDER = 'FLRB';
  const start = { r: level.start[0], c: level.start[1], d: level.dir };
  const key = s => s.r + ',' + s.c + ',' + s.d + (s.layer ? ',' + s.layer : '');
  const better = (a, b) => {
    const ba = a.filter(m => m === 'B').length, bb = b.filter(m => m === 'B').length;
    if (ba !== bb) return ba < bb;
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return ORDER.indexOf(a[k]) < ORDER.indexOf(b[k]);
    return false;
  };
  const seen = new Set([key(start)]);
  let frontier = new Map([[key(start), { state: start, moves: [] }]]);
  for (let depth = 0; depth < maxLen; depth++) {
    const next = new Map();
    let best = null;
    for (const node of frontier.values()) for (const m of ORDER) {
      const res = step(level, node.state, m);
      if (res.type === 'wall' || res.type === 'off') continue;
      const moves = node.moves.concat(m);
      if (isWin(level, res.state)) {
        if (!best || better(moves, best)) best = moves;
        continue;
      }
      const k = key(res.state);
      if (seen.has(k)) continue;
      const cur = next.get(k);
      if (!cur || better(moves, cur.moves)) next.set(k, { state: res.state, moves });
    }
    if (best) return best;
    for (const k of next.keys()) seen.add(k);
    frontier = next;
    if (!next.size) break;
  }
  return null;
}

function nextHint(level, moves) {
  const sol = solve(level);
  if (!sol) return { kind: 'clear' };
  for (let i = 0; i < Math.min(moves.length, sol.length); i++) {
    if (moves[i] !== sol[i]) return { kind: 'clear' };
  }
  if (moves.length === sol.length) return { kind: 'done' };
  if (moves.length > sol.length) return { kind: 'clear' };
  return { kind: 'move', move: sol[moves.length] };
}

function surfaceY(level, r, c, layer) {
  const cell = cellAt(level, r, c);
  if (cell.kind === 'ramp') return 0.5;
  if (cell.kind === 'bridge') return layer === 'under' ? 0 : 1;
  if (cell.kind === 'crate' || cell.kind === 'water') return 0;
  return cell.h;
}

if (typeof module !== 'undefined') module.exports = {
  LEVELS, DR, DC, step, runProgram, solve, normWalls, hasWall, nextHint,
  cellAt, isWin, surfaceY, inBoard, MAX_PROGRAM, SIDE
};

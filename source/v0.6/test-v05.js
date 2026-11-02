// v0.5 tests: height rules, solver, world 2 ("Up High", L11-L20) level design, renderer markers.
module.exports = function ({ test, assert, LEVELS, step, runProgram, solve, isWin, cellAt, MAX_PROGRAM, logicCode, html }) {
  const R = (h = 0, extra = {}) => Object.assign({ h, kind: 'ramp' }, extra);
  const lv = (cells, extra = {}) => Object.assign({ name: 't', size: 5, start: [2, 0], dir: 1, cheese: [4, 4], walls: [], cells }, extra);
  const go = (L, s, moves) => { const out = []; for (const m of moves) { const r = step(L, s, m); out.push(r); s = r.state; } return out; };
  const at = (r) => r.state.r + ',' + r.state.c + (r.state.layer ? ':' + r.state.layer : '');
  // row 2: (2,0) h0, (2,1) ramp up E, (2,2) h1, (2,3) ramp up W (down going E), (2,4) h0
  const ramps = lv({ '2,1': R(0, { rampDir: 'E' }), '2,2': { h: 1 }, '2,3': R(0, { rampDir: 'W' }) });

  test('v0.5 MAX_PROGRAM is 24', () => assert.strictEqual(MAX_PROGRAM, 24));
  test('ramp up: F from the low end climbs onto the platform', () => {
    const r = go(ramps, { r: 2, c: 0, d: 1 }, 'FF');
    assert.deepStrictEqual(r.map(x => x.type), ['move', 'move']); assert.strictEqual(at(r[1]), '2,2');
  });
  test('ramp down: F from the high end goes down to h0', () => {
    const r = go(ramps, { r: 2, c: 2, d: 1 }, 'FF');
    assert.deepStrictEqual(r.map(x => x.type), ['move', 'move']); assert.strictEqual(at(r[1]), '2,4');
  });
  test('B goes up a ramp backwards and keeps facing', () => {
    const r = go(ramps, { r: 2, c: 0, d: 3 }, 'BB');
    assert.strictEqual(r[1].type, 'move'); assert.deepStrictEqual(r[1].state, { r: 2, c: 2, d: 3 });
  });
  test('side entry to a ramp is a wall', () => {
    assert.strictEqual(step(ramps, { r: 1, c: 1, d: 2 }, 'F').type, 'wall');
    assert.strictEqual(step(ramps, { r: 3, c: 1, d: 0 }, 'F').type, 'wall');
  });
  test('leaving a ramp sideways is a wall', () => {
    assert.strictEqual(step(ramps, { r: 2, c: 1, d: 0 }, 'F').type, 'wall');
    assert.strictEqual(step(ramps, { r: 2, c: 1, d: 2 }, 'F').type, 'wall');
  });
  test('cliff is a wall stepping up and stepping down, state unchanged', () => {
    const r1 = step(ramps, { r: 1, c: 2, d: 2 }, 'F'); assert.strictEqual(r1.type, 'wall'); assert.deepStrictEqual(r1.state, { r: 1, c: 2, d: 2 });
    assert.strictEqual(step(ramps, { r: 2, c: 2, d: 0 }, 'F').type, 'wall');
    assert.strictEqual(step(ramps, { r: 2, c: 2, d: 2 }, 'B').type, 'wall');
  });
  test('entering a ramp from the wrong height is a wall', () => {
    const L = lv({ '2,1': R(0, { rampDir: 'W' }) });   // high end faces W; from h0 at (2,0) moving E is the high side
    assert.strictEqual(step(L, { r: 2, c: 0, d: 1 }, 'F').type, 'wall');
  });
  test('crate and water bump as walls and the mouse stays put', () => {
    const L = lv({ '2,1': { h: 0, kind: 'crate' }, '3,0': { h: 0, kind: 'water' } });
    const a = step(L, { r: 2, c: 0, d: 1 }, 'F'); assert.strictEqual(a.type, 'wall'); assert.deepStrictEqual(a.state, { r: 2, c: 0, d: 1 });
    assert.strictEqual(step(L, { r: 2, c: 0, d: 1 }, 'R').type, 'turn');
    assert.strictEqual(step(L, { r: 2, c: 0, d: 2 }, 'F').type, 'wall');
    assert.strictEqual(runProgram(Object.assign({}, L, { start: [2, 0], dir: 1 }), ['F']).result, 'wall');
  });
  // bridge (2,2) EW over ground; platforms (2,1),(2,3); ground path (1,2)-(3,2) underneath
  const br = lv({ '2,1': { h: 1 }, '2,2': { h: 1, kind: 'bridge', axis: 'EW' }, '2,3': { h: 1 } });
  test('bridge over: along the axis from h1 crosses on top', () => {
    const r = go(br, { r: 2, c: 1, d: 1 }, 'FF');
    assert.strictEqual(at(r[0]), '2,2:top'); assert.strictEqual(at(r[1]), '2,3'); assert.ok(!('layer' in r[1].state));
  });
  test('bridge under: across the axis at h0 passes beneath', () => {
    const r = go(br, { r: 1, c: 2, d: 2 }, 'FF');
    assert.strictEqual(at(r[0]), '2,2:under'); assert.strictEqual(at(r[1]), '3,2');
  });
  test('under a bridge over water is a wall', () => {
    const L = lv({ '2,1': { h: 1 }, '2,2': { h: 1, kind: 'bridge', axis: 'EW', water: true }, '2,3': { h: 1 } });
    assert.strictEqual(step(L, { r: 1, c: 2, d: 2 }, 'F').type, 'wall');
    assert.strictEqual(at(step(L, { r: 2, c: 1, d: 1 }, 'F')), '2,2:top');
  });
  test('stepping off the side of a bridge on top, or along it from under, is a wall', () => {
    assert.strictEqual(step(br, { r: 2, c: 2, d: 0, layer: 'top' }, 'F').type, 'wall');
    assert.strictEqual(step(br, { r: 2, c: 2, d: 1, layer: 'under' }, 'F').type, 'wall');
    assert.strictEqual(step(br, { r: 2, c: 0, d: 1 }, 'F').type, 'wall');   // h0 into the platform: cliff
  });
  test('turning works on a bridge (layer kept) and on a ramp', () => {
    assert.deepStrictEqual(step(br, { r: 2, c: 2, d: 1, layer: 'top' }, 'L').state, { r: 2, c: 2, d: 0, layer: 'top' });
    assert.deepStrictEqual(step(br, { r: 2, c: 2, d: 2, layer: 'under' }, 'R').state, { r: 2, c: 2, d: 3, layer: 'under' });
    assert.deepStrictEqual(step(ramps, { r: 2, c: 1, d: 1 }, 'R').state, { r: 2, c: 1, d: 2 });
  });
  test('win on a bridge cell needs the cheese layer', () => {
    const L = Object.assign({}, br, { cheese: [2, 2], cheeseLayer: 'under' });
    assert.ok(isWin(L, { r: 2, c: 2, d: 2, layer: 'under' })); assert.ok(!isWin(L, { r: 2, c: 2, d: 1, layer: 'top' }));
    assert.ok(isWin(Object.assign({}, L, { cheeseLayer: undefined }), { r: 2, c: 2, d: 1, layer: 'top' }));
  });
  test('full win on a 5x5 board (cheese at row 4, col 4)', () => {
    const L = lv({}, { start: [0, 0], dir: 1 });
    assert.strictEqual(runProgram(L, 'FFFFRFFFF'.split('')).result, 'win');
    assert.strictEqual(step(L, { r: 0, c: 4, d: 1 }, 'F').type, 'off');
    assert.strictEqual(step(lv({}, { size: 4 }), { r: 0, c: 3, d: 1 }, 'F').type, 'off');
  });
  test('solver tracks the layer: over a bridge, round, and back under the same cell', () => {
    const L = Object.assign({}, br, { start: [2, 1], dir: 1, cheese: [2, 2], cheeseLayer: 'under',
      cells: Object.assign({}, br.cells, { '3,3': R(0, { rampDir: 'N' }) }), walls: ['1,2,S'] });
    const s = solve(L, 24); assert.ok(s, 'no solution');
    const tr = runProgram(L, s).trace;
    assert.ok(tr.some(x => x.r === 2 && x.c === 2 && x.layer === 'top')); assert.strictEqual(tr[tr.length - 1].layer, 'under');
  });
  test('solver respects crates and cliffs (no route through them)', () => {
    const L = lv({ '0,1': { h: 1 }, '1,1': { h: 0, kind: 'crate' }, '2,1': { h: 0, kind: 'water' }, '3,1': { h: 1 }, '4,1': { h: 1 } }, { start: [2, 0], dir: 1, cheese: [2, 4] });
    assert.strictEqual(solve(L, 24), null);
  });

  // ---------------- world 2 level design ----------------
  const W = LEVELS.slice(10, 20), SOL = W.map(L => solve(L, 16)), N = i => 'L' + (i + 11);
  const bareLen = (L, allowed) => { const k = s => [s.r, s.c, s.d, s.layer || ''].join(); let f = [{ r: L.start[0], c: L.start[1], d: L.dir }]; const seen = new Set(f.map(k));
    for (let n = 1; n <= 24; n++) { const nx = []; for (const s of f) for (const m of allowed) { const r = step(L, s, m); if (r.type !== 'move' && r.type !== 'turn') continue;
      if (isWin(L, r.state)) return n; if (!seen.has(k(r.state))) { seen.add(k(r.state)); nx.push(r.state); } } f = nx; } return Infinity; };
  const trace = i => runProgram(W[i], SOL[i]).trace;
  const cellsOf = (L, kind) => Object.keys(L.cells || {}).filter(k => L.cells[k].kind === kind);
  const kindAt = (L, s) => cellAt(L, s.r, s.c).kind;

  test('there are 20 levels: L1-L10 4x4 with no terrain, L11-L14 4x4, L15-L20 5x5', () => {
    assert.strictEqual(LEVELS.length, 20);
    LEVELS.slice(0, 10).forEach((L, i) => { assert.ok(!L.size || L.size === 4, 'L' + (i + 1)); assert.ok(!L.cells, 'L' + (i + 1)); });
    W.forEach((L, i) => assert.strictEqual(L.size, i < 4 ? 4 : 5, N(i)));
  });
  W.forEach((L, i) => {
    test(N(i) + ' (' + L.name + ') is valid and its solution wins within 16 moves', () => {
      const ok = p => p[0] >= 0 && p[0] < L.size && p[1] >= 0 && p[1] < L.size;
      assert.ok(ok(L.start) && ok(L.cheese)); assert.notDeepStrictEqual(L.start, L.cheese);
      ['crate', 'water'].forEach(k => { assert.notStrictEqual(kindAt(L, { r: L.start[0], c: L.start[1] }), k); assert.notStrictEqual(kindAt(L, { r: L.cheese[0], c: L.cheese[1] }), k); });
      assert.strictEqual(cellAt(L, L.start[0], L.start[1]).kind === 'bridge', false);
      L.walls.forEach(w => assert.ok(/^\d,\d,[NESW]$/.test(w), w));
      Object.entries(L.cells).forEach(([k, c]) => { assert.ok(ok(k.split(',').map(Number)), k); assert.ok(c.h === 0 || c.h === 1);
        if (c.kind === 'ramp') assert.ok('NESW'.includes(c.rampDir) && c.rampDir.length === 1); if (c.kind === 'bridge') assert.ok(c.axis === 'NS' || c.axis === 'EW'); });
      assert.ok(SOL[i], 'unsolvable'); assert.ok(SOL[i].length <= MAX_PROGRAM);
      assert.strictEqual(runProgram(L, SOL[i]).result, 'win');
    });
  });
  test('all 20 shortest answers are distinct', () => {
    const k = LEVELS.map(L => solve(L, 16).join('')); assert.strictEqual(new Set(k).size, 20, k.join(' '));
  });
  test('world 2 difficulty: L11 is 8-10 moves, L20 is 15-17, never decreasing, at most +2 per level', () => {
    const n = SOL.map(s => s.length); assert.ok(n[0] >= 8 && n[0] <= 10, n.join()); assert.ok(n[9] >= 15 && n[9] <= 17, n.join());
    for (let i = 1; i < 10; i++) assert.ok(n[i] >= n[i - 1] && n[i] - n[i - 1] <= 2, N(i) + ': ' + n.join());
  });
  test('world 2: at least 3 levels need B (no F/L/R-only route as short)', () => {
    const need = W.filter((L, i) => bareLen(L, 'FLR') > SOL[i].length); assert.ok(need.length >= 3, need.length);
  });
  test('world 2: at least 5 levels need R (no F/L-only route as short)', () => {
    const need = W.filter((L, i) => SOL[i].includes('R') && bareLen(L, 'FL') > SOL[i].length); assert.ok(need.length >= 5, need.length);
  });
  test('L11 First Ramp: climbs a ramp to cheese on a 2-tile platform', () => {
    const t = trace(0); assert.ok(t.some(s => kindAt(W[0], s) === 'ramp')); assert.strictEqual(cellAt(W[0], ...W[0].cheese).h, 1);
    assert.strictEqual(Object.values(W[0].cells).filter(c => c.h === 1 && !c.kind).length, 2);
  });
  test('L12 Down Again: up one ramp, across, down a different ramp', () => {
    const t = trace(1); assert.strictEqual(new Set(t.filter(s => kindAt(W[1], s) === 'ramp').map(s => s.r + ',' + s.c)).size, 2);
    assert.strictEqual(cellAt(W[1], ...W[1].cheese).h, 0);
  });
  test('L13 Crate Maze: crates and a needed R turn', () => {
    assert.ok(cellsOf(W[2], 'crate').length >= 2); assert.ok(bareLen(W[2], 'FL') > SOL[2].length);
    assert.ok(solve(Object.assign({}, W[2], { cells: {} }), 16).length < SOL[2].length, 'crates force the detour');
  });
  test('L14 The Stream: water splits the board and the route crosses the one bridge on top', () => {
    assert.strictEqual(cellsOf(W[3], 'bridge').length, 1); assert.ok(cellsOf(W[3], 'water').length >= 2); assert.ok(trace(3).some(s => s.layer === 'top'));
  });
  test('L15 Two Ramps: two ramps, the answer uses only one', () => {
    const rs = cellsOf(W[4], 'ramp'); assert.strictEqual(rs.length, 2);
    assert.strictEqual(rs.filter(k => trace(4).some(s => s.r + ',' + s.c === k)).length, 1);
  });
  test('L16 Under the Bridge: cheese is under the bridge and the mouse ends under it', () => {
    const L = W[5]; assert.strictEqual(cellAt(L, ...L.cheese).kind, 'bridge'); assert.strictEqual(L.cheeseLayer, 'under');
    const t = trace(5); assert.strictEqual(t[t.length - 1].layer, 'under');
  });
  test('L17 Over and Under: over the bridge, round, then back under the same cell', () => {
    const t = trace(6), top = t.findIndex(s => s.layer === 'top'); assert.ok(top >= 0);
    assert.ok(t.slice(top).some(s => s.layer === 'under' && s.r === t[top].r && s.c === t[top].c));
  });
  test('L18 Back Up: needs B, and a B move starts or ends on a ramp', () => {
    const t = trace(7); assert.ok(bareLen(W[7], 'FLR') > SOL[7].length);
    assert.ok(SOL[7].some((m, j) => m === 'B' && (kindAt(W[7], t[j]) === 'ramp' || kindAt(W[7], t[j + 1]) === 'ramp')));
  });
  test('L19 Island: raised cheese reachable only by the bridge', () => {
    const L = W[8]; assert.strictEqual(cellAt(L, ...L.cheese).h, 1);
    const cells = Object.assign({}, L.cells); cellsOf(L, 'bridge').forEach(k => { cells[k] = { h: 0, kind: 'water' }; });
    assert.strictEqual(solve(Object.assign({}, L, { cells }), 24), null);
  });
  test('L20 Big Climb: ramp, bridge top and under, water, no opening B, about 16 moves', () => {
    const L = W[9], t = trace(9); assert.ok(t.some(s => kindAt(L, s) === 'ramp')); assert.ok(t.some(s => s.layer === 'top')); assert.ok(t.some(s => s.layer === 'under'));
    assert.ok(cellsOf(L, 'water').length > 0); assert.notStrictEqual(SOL[9][0], 'B');
  });
  test('L18-L20 vary: exactly one of them opens with B', () => {
    assert.strictEqual(SOL.slice(7).filter(s => s[0] === 'B').length, 1, SOL.slice(7).map(s => s.join('')).join(' '));
  });
  // Blocker audit: every blocked step on every level (1-20), from every reachable state, must have a visible cue.
  const cueOf = (L, s, m) => {
    const dir = m === 'F' ? s.d : (s.d + 2) % 4, DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1], SD = 'NESW';
    const nr = s.r + DR[dir], nc = s.c + DC[dir], a = cellAt(L, s.r, s.c), b = cellAt(L, nr, nc);
    const ek = (r, c, d) => d === 0 ? (r - 1) + ',' + c + ',S' : d === 1 ? r + ',' + c + ',E' : d === 2 ? r + ',' + c + ',S' : r + ',' + (c - 1) + ',E';
    const walls = new Set(L.walls.map(w => { const p = w.split(','); return ek(+p[0], +p[1], SD.indexOf(p[2])); }));
    if (walls.has(ek(s.r, s.c, dir))) return 'purple wall';
    if (b.kind === 'crate') return 'crate'; if (b.kind === 'water') return 'water';
    const along = (c, d) => (c.axis === 'NS') === (d % 2 === 0);
    if (a.kind === 'ramp' && !along({ axis: 'NS' }, dir) !== (a.rampDir === 'E' || a.rampDir === 'W')) return 'ramp side rail';
    if (b.kind === 'ramp' && (SD.indexOf(b.rampDir) % 2) !== (dir % 2)) return 'ramp side rail';
    if (a.kind === 'bridge' && s.layer === 'top' && !along(a, dir)) return 'bridge rail';
    if (b.kind === 'bridge' && b.water && !along(b, dir)) return 'water under bridge';
    if (b.kind === 'bridge' && !along(b, dir) && s.layer !== 'under' && (a.h === 1 && a.kind !== 'ramp')) return 'cliff rim';
    const hA = a.kind === 'bridge' ? (s.layer === 'under' ? 0 : 1) : a.kind === 'ramp' ? -1 : a.h, hB = b.kind === 'bridge' ? 1 : b.kind === 'ramp' ? -1 : b.h;
    if (hA >= 0 && hB >= 0 && hA !== hB) return 'cliff rim';
    if (a.kind === 'bridge' && s.layer === 'under' && along(a, dir) && (b.h === 1 || b.kind === 'ramp')) return 'cliff face';
    if ((a.kind === 'ramp') !== (b.kind === 'ramp') && (hA === 1 || hB === 1 || hA === -1 || hB === -1)) return 'ramp end face';
    if (a.kind === 'ramp' && b.kind === 'ramp') return 'ramp end face';
    return null;
  };
  test('blocker audit: every wall result on L1-L20 has a visible cue', () => {
    const bad = [];
    LEVELS.forEach((L, i) => { const k = s => [s.r, s.c, s.d, s.layer || ''].join(); let f = [{ r: L.start[0], c: L.start[1], d: L.dir }]; const seen = new Set(f.map(k));
      while (f.length) { const nx = []; for (const s of f) for (const m of 'FLRB') { const r = step(L, s, m);
        if (r.type === 'wall' && !cueOf(L, s, m)) bad.push('L' + (i + 1) + ' ' + k(s) + ' ' + m);
        if ((r.type === 'move' || r.type === 'turn') && !seen.has(k(r.state))) { seen.add(k(r.state)); nx.push(r.state); } } f = nx; } });
    assert.deepStrictEqual(bad, []);
  });
  test('Level data for L1-L10 unchanged', () => {
    const expectedLines = [
      `{ name: "Straight Shot", start: [0, 0], dir: 2, cheese: [3, 0], walls: [] }`,
      `{ name: "First Corner", start: [3, 3], dir: 1, cheese: [2, 2], walls: ['3,2,E'] }`,
      `{ name: "Right Turn", start: [1, 2], dir: 1, cheese: [2, 0], walls: ['0,1,E', '1,0,S'] }`,
      `{ name: "Fence Hop", start: [1, 0], dir: 2, cheese: [2, 2], walls: ['0,1,S', '1,0,S', '1,2,S'] }`,
      `{ name: "Around the Post", start: [1, 1], dir: 3, cheese: [2, 0], walls: ['1,0,E', '2,0,E', '2,2,S'] }`,
      `{ name: "Twisty Lane", start: [2, 0], dir: 2, cheese: [2, 2], walls: ['0,3,S', '1,0,S', '2,1,E', '3,1,E'] }`,
      `{ name: "Long Way Round", start: [1, 2], dir: 3, cheese: [3, 0], walls: ['0,3,S', '1,1,E', '2,0,E', '2,1,S', '3,1,E'] }`,
      `{ name: "Purple Maze", start: [3, 0], dir: 3, cheese: [2, 3], walls: ['1,1,E', '1,2,S', '2,0,E', '3,0,E', '3,1,E'] }`,
      `{ name: "Back Out", start: [2, 3], dir: 0, cheese: [0, 3], walls: ['0,3,S', '1,1,E', '1,2,S', '1,3,S', '2,1,E', '2,2,S'] }`,
      `{ name: "Big Maze", start: [0, 2], dir: 3, cheese: [3, 0], walls: ['0,0,E', '0,0,S', '0,2,S', '1,0,S', '1,1,S', '1,3,S', '3,0,E'] }`,
    ];
    expectedLines.forEach((line, i) => {
       assert(logicCode.includes(line), `Reference LEVELS line ${i + 1} not found in logicCode`);
    });
  });

  test('renderer draws the v2.1 pieces (water, deck, rock, pot) and the chevron fix', () => {
    ['buildTerrain', '0x7fd3e6', '0xc98a4b', '0xb8743a', '0x8a5426', 'buildRampRails', 'deckEdge', '0x6f9a22', '0xc4e86a'].forEach(s => assert.ok(html.includes(s), s));
  });
};

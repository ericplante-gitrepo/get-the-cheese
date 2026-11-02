(function () {
  'use strict';

  var TILE = 1.0;
  var STEP = 0.40; // v2.2: deck top 0.40, underside 0.34, so the 0.30-tall mouse fits under a bridge
  var FLOOR_Y = 0.15;
  var COLORS = {
    floor: 0xe9e5d8,
    grout: 0xd3cdbd,
    tileA: 0xa3d13c,
    tileB: 0x9bc936,
    slabSeam: 0x86b52a,
    wall: 0x8e44c9,
    mouse: 0x7ec4f2,
    belly: 0xd6efff,
    inner: 0xff8fa8,
    nose: 0xff8fa8,
    eye: 0x202b50,
    outline: 0x202b50,
    cheese: 0xffd23f,
    hole: 0xe0901c,
    sparkle: 0xfff3c4,
    platSide: 0x6f9a22,
    rampRidge: 0xc4e86a,
    water: 0x7fd3e6,
    waterDeep: 0x5fb3c6,
    ripple: 0xb8eaf4,
    deck: 0xc98a4b,
    plank: 0x9c6630,
    rock: 0x9aa0a8,
    rockShade: 0x7a8089,
    pot: 0xe07a4f,
    soil: 0x6b4a2b,
    leaf: 0x5dbb4a,
    flower: 0xff8fa8,
    flowerCentre: 0xffd23f,
    crate: 0xb8743a,
    crateTrim: 0x8a5426
  };

  var state = {
    mode: '2d',
    container: null,
    canvas: null,
    ctx2d: null,
    getState: null,
    renderer: null,
    scene: null,
    camera: null,
    meshCount: 0,
    level: null,
    levelBuilt: null,
    boardSize: 0,
    boardGroup: null,
    terrain: null,
    bridgeMats: [],
    rippleMeshes: [],
    walls: null,
    cheeseGroup: null,
    cheeseBase: null,
    mouse: null,
    lastView: null,
    lastMoveT: 0,
    lastFrameT: 0,
    sparkles: [],
    sparkleGroup: null,
    sparkleT0: null,
    lastCelebrate: null,
    w: 0,
    h: 0,
    dpr: 1,
    boardRadius: 3,
    boardFrac: 0,
    maxH: 0,
    approach: null
  };

  // ---------- Helpers ----------
  function boardN() {
    return state.boardSize || 4;   // set at the start of rebuildLevel
  }

  function tileAt(r, c) {
    var n = boardN();
    return { x: (c - (n - 1) / 2) * TILE, z: (r - (n - 1) / 2) * TILE };
  }

  function cellAt(level, r, c) {
    if (!level || !level.cells) return null;
    return level.cells[r + ',' + c] || null;
  }

  function cellH(level, r, c) {
    var cell = cellAt(level, r, c);
    if (!cell) return 0;
    if (cell.kind === 'ramp') return 0;
    return cell.h ? 1 : 0;
  }

  function levelHasH1(level) {
    if (!level || !level.cells) return false;
    for (var k in level.cells) {
      if (level.cells.hasOwnProperty(k) && level.cells[k] && level.cells[k].h === 1) return true;
    }
    return false;
  }

  // Returns the height (in tile-step units * STEP, i.e. y offset above floor) for a continuous position.
  function surfaceAt(level, row, col, layer) {
    var r = Math.round(row), c = Math.round(col);
    var cell = cellAt(level, r, c);
    if (!cell) return 0;
    if (cell.kind === 'ramp') {
      var t;
      var dir = cell.rampDir || 'E';
      if (dir === 'E') t = (col - c) + 0.5;
      else if (dir === 'W') t = 0.5 - (col - c);
      else if (dir === 'S') t = (row - r) + 0.5;
      else t = 0.5 - (row - r);
      t = Math.max(0, Math.min(1, t));
      return STEP * t;
    }
    if (cell.kind === 'water' || cell.water === true && !cell.h) return 0;
    if (cell.kind === 'crate') return 0;
    if (cell.kind === 'bridge') return layer === 'under' ? 0 : STEP;
    return cell.h ? STEP : 0;
  }

  // ---------- WebGL setup ----------
  function tryWebGL() {
    try {
      if (!window.THREE) return false;
      var THREE = window.THREE;
      var r = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NoToneMapping;
      r.toneMappingExposure = 0.8;
      r.useLegacyLights = true;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      if (!r.getContext()) return false;
      state.renderer = r;
      state.canvas = r.domElement;
      state.canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        switchTo2D();
      }, false);
      return true;
    } catch (e) {
      return false;
    }
  }

  function buildScene() {
    var THREE = window.THREE;
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f1e8);
    state.scene = scene;

    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    state.camera = camera;

    // Floor
    var floorGeo = new THREE.PlaneGeometry(24, 24);
    var floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9 });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.07;
    floor.receiveShadow = false;
    scene.add(floor);
    state.meshCount++;

    // Lights
    var key = new THREE.DirectionalLight(0xfff4e0, 0.78);
    key.position.set(-4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1; key.shadow.camera.far = 20;
    key.shadow.radius = 2;
    scene.add(key);
    state.keyLight = key;
    var hemi = new THREE.HemisphereLight(0xe8f4ff, 0xc9c2ae, 0.45);
    scene.add(hemi);
    var rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(3, 4, -6);
    scene.add(rim);

    // Mouse
    state.mouse = buildMouse();
    scene.add(state.mouse.root);
  }

  function roundedRectShape(w, h, rad) {
    var THREE = window.THREE;
    var s = new THREE.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + rad, y);
    s.lineTo(x + w - rad, y);
    s.quadraticCurveTo(x + w, y, x + w, y + rad);
    s.lineTo(x + w, y + h - rad);
    s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    s.lineTo(x + rad, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - rad);
    s.lineTo(x, y + rad);
    s.quadraticCurveTo(x, y, x + rad, y);
    return s;
  }

  function outlineMesh(geo, scale) {
    var THREE = window.THREE;
    var mat = new THREE.MeshBasicMaterial({
      color: 0x202b50,
      side: THREE.BackSide
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(scale, scale, scale);
    state.meshCount++;
    return mesh;
  }

  function contactShadow(w, d) {
    var THREE = window.THREE;
    var geo = new THREE.CircleGeometry(0.5, 24);
    geo.rotateX(-Math.PI / 2);
    geo.scale(w, 1, d);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.30,
      depthWrite: false
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.002;
    mesh.renderOrder = 1;
    state.meshCount++;
    return mesh;
  }

  function buildMouse() {
    var THREE = window.THREE;
    var root = new THREE.Group();
    var body = new THREE.Group();
    root.add(body);

    // Body: egg shape, 0.46 wide (X), 0.30 tall (Y), 0.62 long (Z)
    var bodyGeo = new THREE.SphereGeometry(0.5, 24, 16);
    bodyGeo.scale(0.46, 0.30, 0.62);
    var pos = bodyGeo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var z = pos.getZ(i);
      if (z > 0) {
        var t = z / 0.31;
        var taper = 1 - 0.15 * Math.min(t, 1);
        pos.setX(i, pos.getX(i) * taper);
      }
    }
    pos.needsUpdate = true;
    bodyGeo.computeVertexNormals();

    var bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.mouse, roughness: 0.3 });
    var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.30;
    bodyMesh.castShadow = true;
    body.add(bodyMesh);
    body.add(outlineMesh(bodyGeo, 1.07).translateY(0.30));
    state.meshCount += 2;

    // Belly patch
    var bellyGeo = new THREE.SphereGeometry(0.5, 16, 12);
    bellyGeo.scale(0.26, 0.10, 0.30);
    var belly = new THREE.Mesh(bellyGeo,
      new THREE.MeshStandardMaterial({ color: COLORS.belly, roughness: 0.35 }));
    belly.position.set(0, 0.22, 0.10);
    body.add(belly);
    state.meshCount++;

    // Ears
    var earGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    var earMat = new THREE.MeshStandardMaterial({ color: COLORS.mouse, roughness: 0.3 });
    var innerGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.022, 16);
    var innerMat = new THREE.MeshStandardMaterial({ color: COLORS.inner, roughness: 0.4 });
    var ears = [];
    [-1, 1].forEach(function (s) {
      var g = new THREE.Group();
      var e = new THREE.Mesh(earGeo, earMat);
      e.rotation.x = Math.PI / 2;
      e.castShadow = true;
      g.add(e);
      var ie = new THREE.Mesh(innerGeo, innerMat);
      ie.rotation.x = Math.PI / 2;
      ie.position.z = 0.001;
      g.add(ie);
      g.position.set(s * 0.13, 0.39, 0.10); // final: ears lowered 0.04, tips ~0.32 above the floor, clear the 0.36 deck underside
      body.add(g);
      ears.push(g);
      state.meshCount += 2;
    });

    // Eyes
    var eyes = [];
    [-1, 1].forEach(function (s) {
      var eg = new THREE.Group();
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10),
        new THREE.MeshStandardMaterial({ color: COLORS.eye, roughness: 0.2 }));
      eg.add(eye);
      var spec = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      spec.position.set(0.010, 0.010, 0.027);
      eg.add(spec);
      eg.position.set(s * 0.09, 0.36, 0.24);
      body.add(eg);
      eyes.push(eg);
      state.meshCount += 2;
    });

    // Nose
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10),
      new THREE.MeshStandardMaterial({ color: COLORS.nose, roughness: 0.3 }));
    nose.position.set(0, 0.30, 0.32);
    body.add(nose);
    state.meshCount++;

    // Tail
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.22, -0.30),
      new THREE.Vector3(0, 0.20, -0.42),
      new THREE.Vector3(0.10, 0.18, -0.50),
      new THREE.Vector3(0.18, 0.18, -0.44),
      new THREE.Vector3(0.14, 0.18, -0.36)
    ]);
    var tailGeo = new THREE.TubeGeometry(curve, 16, 0.018, 8, false);
    var tail = new THREE.Mesh(tailGeo,
      new THREE.MeshStandardMaterial({ color: COLORS.mouse, roughness: 0.3 }));
    tail.castShadow = true;
    body.add(tail);
    state.meshCount++;

    // Contact shadow stays on the root
    root.add(contactShadow(0.5, 0.66));

    // Facing chevron: white 85%, navy outline behind it, 0.25 tile, 0.30 ahead of centre.
    var ch = new THREE.Shape();
    ch.moveTo(0, 0.125); ch.lineTo(0.125, -0.05); ch.lineTo(0.06, -0.05); ch.lineTo(0, 0.03);
    ch.lineTo(-0.06, -0.05); ch.lineTo(-0.125, -0.05); ch.lineTo(0, 0.125);

    var chevOutlineShape = new THREE.Shape();
    var sc = (0.125 + 0.015) / 0.125;
    chevOutlineShape.moveTo(0, 0.125 * sc); chevOutlineShape.lineTo(0.125 * sc, -0.05 * sc);
    chevOutlineShape.lineTo(0.06 * sc, -0.05 * sc); chevOutlineShape.lineTo(0, 0.03 * sc);
    chevOutlineShape.lineTo(-0.06 * sc, -0.05 * sc); chevOutlineShape.lineTo(-0.125 * sc, -0.05 * sc);
    chevOutlineShape.lineTo(0, 0.125 * sc);

    var chevOutline = new THREE.Mesh(new THREE.ShapeGeometry(chevOutlineShape),
      new THREE.MeshBasicMaterial({ color: 0x202b50, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
    chevOutline.rotation.x = -Math.PI / 2;
    chevOutline.rotation.z = Math.PI;
    chevOutline.position.set(0, 0.16, 0.30);
    chevOutline.renderOrder = 1;
    root.add(chevOutline); state.meshCount++;

    var chev = new THREE.Mesh(new THREE.ShapeGeometry(ch),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
    chev.rotation.x = -Math.PI / 2;
    chev.rotation.z = Math.PI;
    chev.position.set(0, 0.16, 0.30);
    chev.renderOrder = 2;
    root.add(chev); state.meshCount++;

    return { root: root, body: body, ears: ears, eyes: eyes, tail: tail, chevron: chev,
      chevronOutline: chevOutline, pitch: 0, bob: 0, breathT: 0, twitchT: 0, nextTwitch: 4 };
  }

  function buildCheeseGeo() {
    var THREE = window.THREE;
    var s = new THREE.Shape();
    s.moveTo(-0.19, 0);
    s.lineTo(0.19, 0);
    s.lineTo(-0.19, 0.22);
    s.lineTo(-0.19, 0);
    var geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 4
    });
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var cx = (bb.min.x + bb.max.x) / 2;
    var cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, -bb.min.y, -cz);
    return geo;
  }

  function buildCheese() {
    var THREE = window.THREE;
    var g = new THREE.Group();
    var geo = buildCheeseGeo();
    var mat = new THREE.MeshStandardMaterial({ color: COLORS.cheese, roughness: 0.5 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    g.add(mesh);
    g.add(outlineMesh(geo, 1.08));
    state.meshCount += 2;

    var holeMat = new THREE.MeshStandardMaterial({ color: COLORS.hole, roughness: 0.6 });
    var holeGeo = new THREE.CircleGeometry(0.035, 12);
    var H = 0.22, L = 0.38, D = 0.26;
    var eps = 0.003;

    function addHole(x, y, z, nx, ny, nz) {
      var h = new THREE.Mesh(holeGeo, holeMat);
      var n = new THREE.Vector3(nx, ny, nz).normalize();
      h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      h.position.set(x + n.x * eps, y + n.y * eps, z + n.z * eps);
      g.add(h);
      state.meshCount++;
    }

    var slopeNx = H, slopeNy = L;
    var sx = 0, sy = H / 2;
    addHole(sx - 0.02, sy - 0.02, D / 2, slopeNx, slopeNy, 0);
    addHole(sx + 0.07, sy - 0.07, D / 2, slopeNx, slopeNy, 0);
    addHole(sx - 0.07, sy + 0.01, D / 2, slopeNx, slopeNy, 0);

    addHole(-0.06, 0.06, D / 2, 0, 0, 1);
    addHole(0.06, 0.03, -D / 2, 0, 0, -1);
    addHole(0.0, 0.0, 0.0, 0, -1, 0);

    g.add(contactShadow(0.38, 0.30));
    return g;
  }

  // ---------- Board (slab + grass tiles) ----------
  function buildBoard(n, level) {
    var THREE = window.THREE;
    var group = new THREE.Group();

    // v0.5: water cells are holes cut through the slab so the pool can sit 0.10 below the floor.
    var half = (n + 0.03) / 2, slabShape = new THREE.Shape(), holes = 0;
    slabShape.moveTo(-half, -half); slabShape.lineTo(half, -half); slabShape.lineTo(half, half); slabShape.lineTo(-half, half); slabShape.lineTo(-half, -half);
    for (var hr = 0; hr < n; hr++) for (var hc = 0; hc < n; hc++) {
      var hcell = cellAt(level, hr, hc);
      if (!hcell || !(hcell.kind === 'water' || hcell.water)) continue;
      var hp = tileAt(hr, hc), hole = new THREE.Path(), e = 0.49;
      // shape y maps to world -z after rotateX(-PI/2)
      hole.moveTo(hp.x - e, -hp.z - e); hole.lineTo(hp.x - e, -hp.z + e); hole.lineTo(hp.x + e, -hp.z + e); hole.lineTo(hp.x + e, -hp.z - e); hole.lineTo(hp.x - e, -hp.z - e);
      slabShape.holes.push(hole); holes++;
    }
    var slabGeo = new THREE.BoxGeometry(n + 0.03, 0.12, n + 0.03);
    var slabMat = new THREE.MeshStandardMaterial({ color: COLORS.slabSeam, roughness: 0.5 });
    if (!holes) {
      var slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = 0.07; slab.receiveShadow = true;
      group.add(slab); state.meshCount++;
    } else {
      // v2.2: water cells are cut out of a per-cell slab so neighbouring water joins with no seam; banks show the #6F9A22 side face.
      var isW = function (r, c) { var q = cellAt(level, r, c); return !!(q && r >= 0 && c >= 0 && r < n && c < n && (q.kind === 'water' || q.water)); };
      var bankMat = new THREE.MeshStandardMaterial({ color: COLORS.platSide, roughness: 0.5 });
      for (var sr = 0; sr < n; sr++) for (var sc = 0; sc < n; sc++) {
        var sp = tileAt(sr, sc);
        if (!isW(sr, sc)) {
          var cw = 1 + (sc === 0 || sc === n - 1 ? 0.015 : 0), cd = 1 + (sr === 0 || sr === n - 1 ? 0.015 : 0);
          var cb = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.12, cd), slabMat);
          cb.position.set(sp.x + (sc === 0 ? -0.0075 : sc === n - 1 ? 0.0075 : 0), 0.07, sp.z + (sr === 0 ? -0.0075 : sr === n - 1 ? 0.0075 : 0));
          cb.receiveShadow = true; group.add(cb); state.meshCount++;
          continue;
        }
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (dd) {
          if (isW(sr + dd[0], sc + dd[1])) return;
          var inb = sr + dd[0] >= 0 && sr + dd[0] < n && sc + dd[1] >= 0 && sc + dd[1] < n; if (!inb) return;
          var bank = new THREE.Mesh(new THREE.BoxGeometry(dd[0] ? 1 : 0.004, 0.085, dd[0] ? 0.004 : 1), bankMat);
          bank.position.set(sp.x + dd[1] * 0.497, 0.05 + 0.0425, sp.z + dd[0] * 0.497); group.add(bank); state.meshCount++;
        });
      }
    }

    var tileShape = roundedRectShape(0.93, 0.93, 0.08);
    var tileGeo = new THREE.ExtrudeGeometry(tileShape, {
      depth: 0, bevelEnabled: true, bevelThickness: 0.01,
      bevelSize: 0.02, bevelSegments: 2, curveSegments: 6
    });
    tileGeo.rotateX(-Math.PI / 2);
    var matA = new THREE.MeshStandardMaterial({ color: COLORS.tileA, roughness: 0.45 });
    var matB = new THREE.MeshStandardMaterial({ color: COLORS.tileB, roughness: 0.45 });
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cell = cellAt(level, r, c);
        // Skip the grass top for water cells (pool sits sunk in its place) and bridge-over-water
        if (cell && cell.water) continue;
        if (cell && cell.kind === 'water') continue;
        // Raised platforms / ramps draw their own top; skip the flat grass top there too
        if (cell && ((cell.h === 1 && cell.kind !== 'bridge') || cell.kind === 'ramp')) continue;
        var t = new THREE.Mesh(tileGeo, ((r + c) % 2) ? matB : matA);
        var p = tileAt(r, c);
        t.position.set(p.x, 0.14, p.z);
        t.receiveShadow = true;
        group.add(t);
        state.meshCount++;
      }
    }
    return group;
  }

  // ---------- Terrain (platforms, ramps, water, bridges, obstacles) ----------
  function addBox(parent, w, h, d, color, x, y, z, cast) {
    var THREE = window.THREE;
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.45 }));
    m.position.set(x, y, z);
    m.castShadow = cast !== false;
    m.receiveShadow = true;
    parent.add(m);
    state.meshCount++;
    return m;
  }

  function addPool(parent, p, withRipples) {
    var THREE = window.THREE;
    // Sunk water top at y 0.05
    var waterMat = new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.2 });
    var base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 1.0),
      new THREE.MeshStandardMaterial({ color: COLORS.waterDeep, roughness: 0.6 }));
    base.position.set(p.x, 0.03, p.z);
    parent.add(base); state.meshCount++;
    var top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.01, 1.0), waterMat);
    top.position.set(p.x, 0.05 - 0.005, p.z);
    top.receiveShadow = true;
    parent.add(top); state.meshCount++;

    if (withRipples) {
      var ringMat = new THREE.MeshBasicMaterial({ color: COLORS.ripple, transparent: true, opacity: 0.9, depthWrite: false });
      var r1 = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.21, 24), ringMat);
      var r2 = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.35, 24), ringMat);
      [r1, r2].forEach(function (rg) {
        rg.rotation.x = -Math.PI / 2;
        rg.position.set(p.x, 0.052, p.z);
        parent.add(rg);
        state.meshCount++;
        state.rippleMeshes.push(rg);
      });
    }
  }

  function buildRamp(parent, p, dir) {
    var THREE = window.THREE;
    var half = 0.485;
    var lo = FLOOR_Y, hi = FLOOR_Y + STEP;
    // Build a prism in local space: low edge at z=+half, high edge at z=-half (facing -z = North)
    var shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(half, 0);
    shape.lineTo(half, 0);
    shape.lineTo(-half, 0);
    // Use a custom triangle prism via BufferGeometry for accuracy
    var w = 0.97;
    var verts = new Float32Array([
      // top slope (two triangles)
      -w / 2, lo, half,   w / 2, lo, half,   w / 2, hi, -half,
      -w / 2, lo, half,   w / 2, hi, -half,  -w / 2, hi, -half,
      // sides (left/right) and bottom
      -w / 2, lo, half,  -w / 2, hi, -half,  -w / 2, lo, -half,
       w / 2, lo, half,   w / 2, lo, -half,   w / 2, hi, -half,
      -w / 2, lo, -half,  w / 2, lo, -half,  w / 2, hi, -half,
      -w / 2, lo, -half,  w / 2, hi, -half, -w / 2, hi, -half,
      -w / 2, lo, half,   w / 2, lo, half,   w / 2, lo, -half,
      -w / 2, lo, half,   w / 2, lo, -half, -w / 2, lo, -half
    ]);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    var slopeNormal = geo.clone();
    var topCount = 6;
    var topVerts = verts.slice(0, topCount * 3);
    var topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.BufferAttribute(topVerts, 3));
    topGeo.computeVertexNormals();

    var sideMat = new THREE.MeshStandardMaterial({ color: COLORS.platSide, roughness: 0.5 });
    var topMat = new THREE.MeshStandardMaterial({ color: COLORS.tileA, roughness: 0.45, side: THREE.DoubleSide });
    var sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.BufferAttribute(verts.slice(topCount * 3), 3));
    sideGeo.computeVertexNormals();

    var ramp = new THREE.Group();
    var topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.castShadow = true; topMesh.receiveShadow = true;
    ramp.add(topMesh);
    var sideMesh = new THREE.Mesh(sideGeo, sideMat);
    sideMesh.castShadow = true; sideMesh.receiveShadow = true;
    ramp.add(sideMesh);
    state.meshCount += 2;

    // Cross ridges lying on the slope
    var angle = Math.atan(STEP / 1.0);
    var ridgeMat = new THREE.MeshStandardMaterial({ color: COLORS.rampRidge, roughness: 0.4 });
    var ridgeGeo = new THREE.BoxGeometry(w, 0.01, 0.05);
    for (var i = 1; i <= 3; i++) {
      var f = i / 4;
      var rz = half - f * 2 * half;
      var ry = lo + f * STEP;
      var rm = new THREE.Mesh(ridgeGeo, ridgeMat);
      rm.rotation.x = -angle;
      rm.position.set(0, ry + 0.01 * Math.cos(angle), rz);
      ramp.add(rm);
      state.meshCount++;
    }

    // Orient so the high edge points toward dir (low edge is +z = S in local)
    var yaw = 0;
    if (dir === 'N') yaw = Math.PI;      // high end toward -z
    else if (dir === 'E') yaw = -Math.PI / 2;
    else if (dir === 'S') yaw = 0;
    else if (dir === 'W') yaw = Math.PI / 2;
    // Local high end is -z, so for 'S' (high toward +z) we need yaw = PI; fix mapping:
    // dir is direction travelled to go UP: high edge lies in that direction.
    // Local high end is at -z; rotating by yaw maps -z to the desired direction.
    // -z rotated by yaw: N(-z) -> yaw 0; E(+x) -> yaw = -PI/2; S(+z) -> yaw = PI; W(-x) -> yaw = PI/2.
    yaw = 0;
    if (dir === 'N') yaw = 0;
    else if (dir === 'E') yaw = -Math.PI / 2;
    else if (dir === 'S') yaw = Math.PI;
    else if (dir === 'W') yaw = Math.PI / 2;
    ramp.rotation.y = yaw;
    ramp.position.set(p.x, 0, p.z);
    parent.add(ramp);
    slopeNormal.dispose();
  }

  function buildBridge(parent, p, axis, water) {
    var THREE = window.THREE;
    var bridge = new THREE.Group();
    var mats = [];
    var deckMat = new THREE.MeshStandardMaterial({ color: COLORS.deck, roughness: 0.5, transparent: true, opacity: 1 });
    var plankMat = new THREE.MeshStandardMaterial({ color: COLORS.plank, roughness: 0.6, transparent: true, opacity: 1 });
    var railMat = new THREE.MeshStandardMaterial({ color: COLORS.deck, roughness: 0.5, transparent: true, opacity: 1 });
    plankMat.userData.underOpacity = 0; // v0.5: the gap plate under the planks fades out fully, so only one 45% layer covers the mouse
    mats.push(deckMat, plankMat, railMat);

    var len = 1.0, wid = 0.70; // v2.2
    var deckTop = FLOOR_Y + STEP;
    var deckThick = 0.04; // v2.3: underside at 0.36
    var deckY = deckTop - deckThick / 2;
    var alongX = axis === 'EW';

    // Base plate (plank colour shows through gaps)
    var base = new THREE.Mesh(
      alongX ? new THREE.BoxGeometry(len, 0.05, wid) : new THREE.BoxGeometry(wid, 0.05, len),
      plankMat);
    base.scale.y = (deckThick - 0.004) / 0.05; base.position.set(0, deckY, 0); // v2.3: gap plate stays inside the deck, so nothing hangs below 0.36
    bridge.add(base); state.meshCount++;

    // 5 planks across the travel direction, 0.01 gaps
    var plankCount = 5;
    var span = len;   // planks lie across the travel direction, spread along it
    var plankW = (span - (plankCount - 1) * 0.01) / plankCount;
    for (var i = 0; i < plankCount; i++) {
      var off = -span / 2 + plankW / 2 + i * (plankW + 0.01);
      var pm = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(plankW, deckThick, wid) : new THREE.BoxGeometry(wid, deckThick, plankW),
        deckMat);
      if (alongX) pm.position.set(off, deckY, 0);
      else pm.position.set(0, deckY, off);
      pm.castShadow = true; pm.receiveShadow = true;
      bridge.add(pm); state.meshCount++;
    }

    // Rails along travel axis on both sides
    var railH = 0.12;
    var railY = deckTop + railH / 2;
    var railLen = len;
    for (var s = -1; s <= 1; s += 2) {
      var rail = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(railLen, 0.04, 0.04) : new THREE.BoxGeometry(0.04, 0.04, railLen),
        railMat);
      if (alongX) rail.position.set(0, railY, s * (wid / 2 - 0.02));
      else rail.position.set(s * (wid / 2 - 0.02), railY, 0);
      rail.castShadow = true;
      bridge.add(rail); state.meshCount++;
    }
    // v2.3: navy 0.015 edge line along the deck's long edges (fades with the deck)
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0x202b50, transparent: true, opacity: 1 }); mats.push(edgeMat);
    for (var se = -1; se <= 1; se += 2) {
      var edge = new THREE.Mesh(alongX ? new THREE.BoxGeometry(len, 0.015, 0.015) : new THREE.BoxGeometry(0.015, 0.015, len), edgeMat);
      if (alongX) edge.position.set(0, deckTop - 0.0075 + 0.001, se * (wid / 2 - 0.0075)); else edge.position.set(se * (wid / 2 - 0.0075), deckTop - 0.0075 + 0.001, 0);
      edge.name = 'deckEdge'; bridge.add(edge); state.meshCount++;
    }
    // Posts at ends down to the floor
    var postMat = new THREE.MeshStandardMaterial({ color: COLORS.plank, roughness: 0.6 });
    for (var e = -1; e <= 1; e += 2) {
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.04, deckTop - FLOOR_Y, 0.04), postMat);
        var ex = alongX ? e * (len / 2 - 0.04) : s2 * (wid / 2 - 0.02);
        var ez = alongX ? s2 * (wid / 2 - 0.02) : e * (len / 2 - 0.04);
        post.position.set(ex, FLOOR_Y + (deckTop - FLOOR_Y) / 2 - 0.02, ez);
        bridge.add(post); state.meshCount++;
      }
    }

    if (water) addPool(parent, p, true);
    bridge.position.set(p.x, 0, p.z);
    parent.add(bridge);
    state.bridgeMats = state.bridgeMats.concat(mats);
  }

  function buildCrate(parent, p) {
    var THREE = window.THREE;
    var g = new THREE.Group(), W = 0.70, H = 0.50;
    var geo = new THREE.BoxGeometry(W, H, W);
    var box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb8743a, roughness: 0.6 }));
    box.position.y = FLOOR_Y + H / 2; box.castShadow = true; box.receiveShadow = true; g.add(box);
    var ol = outlineMesh(geo, 1.04); ol.position.y = FLOOR_Y + H / 2; g.add(ol);
    var trim = new THREE.MeshStandardMaterial({ color: 0x8a5426, roughness: 0.6 }), T = 0.05, e = 0.002;
    // edge trim (0.05 wide) on the 4 vertical edges and the top/bottom rims, plus an X brace on each side face
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (q) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(T, H, T), trim); m.position.set(q[0] * (W / 2 - T / 2 + e), FLOOR_Y + H / 2, q[1] * (W / 2 - T / 2 + e)); g.add(m); state.meshCount++; });
    [FLOOR_Y + T / 2, FLOOR_Y + H - T / 2].forEach(function (y) { [0, 1].forEach(function (rot) { [-1, 1].forEach(function (sd) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * e, T, T), trim); m.position.set(0, y, sd * (W / 2 - T / 2 + e)); if (rot) { m.rotation.y = Math.PI / 2; m.position.set(sd * (W / 2 - T / 2 + e), y, 0); } g.add(m); state.meshCount++; }); }); });
    var diag = Math.sqrt(W * W + H * H) - 2 * T, ang = Math.atan2(H, W);
    for (var f = 0; f < 4; f++) for (var d = -1; d <= 1; d += 2) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(diag, T, 0.01), trim); var pv = new THREE.Group();
      b.rotation.z = d * ang; pv.add(b); pv.rotation.y = f * Math.PI / 2;
      b.position.set(0, 0, W / 2 + 0.006); pv.position.y = FLOOR_Y + H / 2; g.add(pv); state.meshCount++; }
    g.add(contactShadow(0.80, 0.80));
    g.position.set(p.x, 0, p.z); parent.add(g); state.meshCount += 2;
  }

  // v2.3 final: ramp side rails, navy #202B50, 0.04 thick, 0.14 tall, full ramp length on both sides.
  function buildRampRails(parent, p, dir) {
    var THREE = window.THREE, ang = Math.atan(STEP), L = Math.sqrt(1 + STEP * STEP);
    var mat = new THREE.MeshStandardMaterial({ color: 0x202b50, roughness: 0.5 });
    var ns = dir === 'N' || dir === 'S';
    for (var sd = -1; sd <= 1; sd += 2) {
      var rail = new THREE.Mesh(ns ? new THREE.BoxGeometry(0.04, 0.14, L) : new THREE.BoxGeometry(L, 0.14, 0.04), mat);
      if (dir === 'E') rail.rotation.z = ang; if (dir === 'W') rail.rotation.z = -ang;
      if (dir === 'S') rail.rotation.x = -ang; if (dir === 'N') rail.rotation.x = ang;
      rail.position.set(p.x + (ns ? sd * 0.465 : 0), FLOOR_Y + STEP / 2 + 0.07, p.z + (ns ? 0 : sd * 0.465));
      rail.castShadow = true; rail.name = 'rampRail'; parent.add(rail); state.meshCount++;
    }
  }

  function buildRock(parent, p) {
    var THREE = window.THREE;
    var root = new THREE.Group();
    var geo = new THREE.DodecahedronGeometry(0.5, 0);
    geo.scale(0.55, 0.30 / 0.5 * 0.5, 0.55);
    var rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 0.7, flatShading: true }));
    rock.position.y = 0.15;
    rock.castShadow = true; rock.receiveShadow = true;
    root.add(rock);
    state.meshCount++;
    var lumpGeo = new THREE.DodecahedronGeometry(0.2, 0);
    var lump = new THREE.Mesh(lumpGeo, new THREE.MeshStandardMaterial({ color: COLORS.rockShade, roughness: 0.7, flatShading: true }));
    lump.position.set(0.18, 0.08, 0.12);
    lump.castShadow = true;
    root.add(lump);
    state.meshCount++;
    root.add(contactShadow(0.6, 0.6));
    root.position.set(p.x, FLOOR_Y, p.z);
    parent.add(root);
  }

  function buildPot(parent, p) {
    var THREE = window.THREE;
    var root = new THREE.Group();
    var potMat = new THREE.MeshStandardMaterial({ color: COLORS.pot, roughness: 0.6 });
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.175, 0.28, 16), potMat);
    pot.position.y = 0.14;
    pot.castShadow = true; pot.receiveShadow = true;
    root.add(pot);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 8, 16),
      potMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.28;
    root.add(rim);
    var soil = new THREE.Mesh(new THREE.CircleGeometry(0.155, 16),
      new THREE.MeshStandardMaterial({ color: COLORS.soil, roughness: 0.9 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.275;
    root.add(soil);
    state.meshCount += 4;
    var leafMat = new THREE.MeshStandardMaterial({ color: COLORS.leaf, roughness: 0.5 });
    for (var i = 0; i < 3; i++) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), leafMat);
      leaf.scale.set(1, 0.4, 0.6);
      var a = (i / 3) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.1, 0.33, Math.sin(a) * 0.1);
      leaf.rotation.y = -a;
      leaf.castShadow = true;
      root.add(leaf);
      state.meshCount++;
    }
    var flower = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8),
      new THREE.MeshStandardMaterial({ color: COLORS.flower, roughness: 0.4 }));
    flower.position.set(0, 0.42, 0);
    root.add(flower);
    var centre = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
      new THREE.MeshStandardMaterial({ color: COLORS.flowerCentre, roughness: 0.4 }));
    centre.position.set(0, 0.47, 0);
    root.add(centre);
    state.meshCount += 2;
    root.add(contactShadow(0.35, 0.35));
    root.position.set(p.x, FLOOR_Y, p.z);
    parent.add(root);
  }

  function buildCrate(parent, p) {
    var THREE = window.THREE;
    var root = new THREE.Group();
    var boxMat = new THREE.MeshStandardMaterial({ color: COLORS.crate, roughness: 0.7 });
    var trimMat = new THREE.MeshStandardMaterial({ color: COLORS.crateTrim, roughness: 0.7 });
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.50, 0.70), boxMat);
    box.position.y = 0.25;
    box.castShadow = true; box.receiveShadow = true;
    root.add(box);
    state.meshCount++;
    // Edge trim (4 vertical + top/bottom perimeter approximated by thin boxes)
    var tw = 0.05;
    var tp = [[-0.35, 0.25, -0.35], [0.35, 0.25, -0.35], [-0.35, 0.25, 0.35], [0.35, 0.25, 0.35]];
    tp.forEach(function (q) {
      var t = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.52, tw), trimMat);
      t.position.set(q[0], q[1], q[2]);
      root.add(t);
      state.meshCount++;
    });
    // X brace on front and back faces
    var brace = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.04, 0.04), trimMat);
    brace.rotation.z = Math.atan(0.5 / 0.7);
    brace.position.set(0, 0.25, 0.36);
    root.add(brace);
    var brace2 = brace.clone();
    brace2.rotation.z = -Math.atan(0.5 / 0.7);
    root.add(brace2);
    state.meshCount += 2;
    root.add(outlineMesh(new THREE.BoxGeometry(0.70, 0.50, 0.70), 1.04).translateY(0.25));
    root.add(contactShadow(0.7, 0.7));
    root.position.set(p.x, FLOOR_Y, p.z);
    parent.add(root);
  }

  function buildTerrain(level) {
    var THREE = window.THREE;
    var n = level.size || 4;
    var group = new THREE.Group();
    state.rippleMeshes = [];
    state.bridgeMats = [];
    var cells = level.cells || {};
    for (var key in cells) {
      if (!cells.hasOwnProperty(key)) continue;
      var parts = key.split(',');
      var r = +parts[0], c = +parts[1];
      if (r < 0 || c < 0 || r >= n || c >= n) continue;
      var cell = cells[key];
      if (!cell) continue;
      var p = tileAt(r, c);

      if (cell.kind === 'ramp') {
        buildRamp(group, p, cell.rampDir || 'E');
        buildRampRails(group, p, cell.rampDir || 'E');
      } else if (cell.kind === 'bridge') {
        buildBridge(group, p, cell.axis || 'EW', !!cell.water);
      } else if (cell.kind === 'water' || cell.water) {
        addPool(group, p, true);
      } else if (cell.kind === 'crate') {
        buildCrate(group, p); // v2.2: crates are wooden boxes; rocks/pots kept for later decoration
      } else if (cell.h === 1) {
        // Raised platform: 0.97x0.97 box from y 0.15 to 0.45
        var h = STEP;
        var pl = new THREE.Group();
        var sideMat = new THREE.MeshStandardMaterial({ color: COLORS.platSide, roughness: 0.5 });
        var side = new THREE.Mesh(new THREE.BoxGeometry(0.97, h, 0.97), sideMat);
        side.position.set(0, FLOOR_Y + h / 2, 0);
        side.castShadow = true; side.receiveShadow = true;
        pl.add(side);
        state.meshCount++;
        var topMat = new THREE.MeshStandardMaterial({ color: ((r + c) % 2) ? COLORS.tileB : COLORS.tileA, roughness: 0.45 });
        var top = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.01, 0.97), topMat);
        top.position.set(0, FLOOR_Y + h + 0.005, 0);
        top.receiveShadow = true;
        pl.add(top);
        state.meshCount++;
        // Navy rim line 0.015 thick around the top edge
        var rimMat = new THREE.MeshBasicMaterial({ color: COLORS.outline });
        var rimY = FLOOR_Y + h + 0.011;
        var rw = 0.97;
        var t = 0.015;
        var rims = [
          [0, rimY, -rw / 2 + t / 2, rw, 0.01, t],
          [0, rimY, rw / 2 - t / 2, rw, 0.01, t],
          [-rw / 2 + t / 2, rimY, 0, t, 0.01, rw],
          [rw / 2 - t / 2, rimY, 0, t, 0.01, rw]
        ];
        rims.forEach(function (d) {
          var rm = new THREE.Mesh(new THREE.BoxGeometry(d[3], d[4], d[5]), rimMat);
          rm.position.set(d[0], d[1], d[2]);
          pl.add(rm);
          state.meshCount++;
        });
        pl.position.set(p.x, 0, p.z);
        group.add(pl);
      }
    }
    return group;
  }

  // ---------- Walls ----------
  function buildWalls(level) {
    var THREE = window.THREE;
    var group = new THREE.Group();
    var seen = {};
    var mat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.35 });
    var n = level.size || 4;
    (level.walls || []).forEach(function (w) {
      var parts = w.split(',');
      var r = +parts[0], c = +parts[1], d = parts[2];
      var key = edgeKey(r, c, d);
      if (seen[key]) return;
      seen[key] = true;
      var p = tileAt(r, c);
      var thick = 0.10;
      // Wall base height = 0.30 * max(height of the two cells either side)
      var r2 = r, c2 = c;
      if (d === 'N') r2 = r - 1;
      if (d === 'S') r2 = r + 1;
      if (d === 'E') c2 = c + 1;
      if (d === 'W') c2 = c - 1;
      var hMax = Math.max(cellH(level, r, c), cellH(level, r2, c2));
      var baseY = STEP * hMax;
      var h = 0.30;
      var box = new THREE.BoxGeometry(1, h, thick);
      var cap = new THREE.CylinderGeometry(thick / 2, thick / 2, 1, 12);
      var wall = new THREE.Group();
      var body = new THREE.Mesh(box, mat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      wall.add(body);
      var top = new THREE.Mesh(cap, mat);
      top.rotation.z = Math.PI / 2;
      top.position.y = h;
      top.castShadow = true;
      wall.add(top);
      state.meshCount += 2;
      var ex = p.x, ez = p.z;
      if (d === 'N') { ez -= 0.5; wall.rotation.y = 0; }
      if (d === 'S') { ez += 0.5; wall.rotation.y = 0; }
      if (d === 'E') { ex += 0.5; wall.rotation.y = Math.PI / 2; }
      if (d === 'W') { ex -= 0.5; wall.rotation.y = Math.PI / 2; }
      wall.position.set(ex, baseY + FLOOR_Y - 0.15, ez);
      group.add(wall);
    });
    return group;
  }

  function edgeKey(r, c, d) {
    var dr = 0, dc = 0;
    if (d === 'N') dr = -1;
    if (d === 'S') dr = 1;
    if (d === 'E') dc = 1;
    if (d === 'W') dc = -1;
    var r2 = r + dr, c2 = c + dc;
    var a = r + ',' + c, b = r2 + ',' + c2;
    return a < b ? a + '|' + b : b + '|' + a;
  }

  // ---------- Level rebuild ----------
  function rebuildLevel(level) {
    var THREE = window.THREE;
    var n = level.size || 4;
    state.boardSize = n;

    // Board: rebuild when size changes (and always rebuild terrain-dependent tiles)
    if (state.boardGroup) state.scene.remove(state.boardGroup);
    state.boardGroup = buildBoard(n, level);
    state.scene.add(state.boardGroup);
    state.boardSize = n;

    if (state.keyLight) {
      var half = n / 2 + 0.05;
      state.keyLight.shadow.camera.left = -half;
      state.keyLight.shadow.camera.right = half;
      state.keyLight.shadow.camera.top = half;
      state.keyLight.shadow.camera.bottom = -half;
      state.keyLight.shadow.camera.updateProjectionMatrix();
    }

    if (state.terrain) state.scene.remove(state.terrain);
    state.terrain = buildTerrain(level);
    state.scene.add(state.terrain);

    if (state.walls) state.scene.remove(state.walls);
    state.walls = buildWalls(level);
    state.scene.add(state.walls);

    if (state.cheeseGroup) state.scene.remove(state.cheeseGroup);
    state.cheeseGroup = buildCheese();
    var cp = tileAt(level.cheese[0], level.cheese[1]);
    var cLayer = level.cheeseLayer || 'top';
    var cH = surfaceAt(level, level.cheese[0], level.cheese[1], cLayer);
    state.cheeseGroup.position.set(cp.x, FLOOR_Y + cH, cp.z);
    state.cheeseGroup.rotation.y = 0.5;
    state.scene.add(state.cheeseGroup);

    state.maxH = levelHasH1(level) ? STEP : 0;
    state.levelBuilt = level;
    state.approach = null;
    state.lastView = null;
    fitCamera();
  }

  // ---------- Per-frame updates ----------
  function updateMouse(view, now, celebrate, level, dt) {
    var m = state.mouse;
    var n = level.size || 4;
    var p = tileAt(view.row + view.oy, view.col + view.ox);
    // Convert continuous row/col to world: tileAt uses boardN(); use n directly for consistency
    p = { x: (view.col + view.ox - (n - 1) / 2) * TILE, z: (view.row + view.oy - (n - 1) / 2) * TILE };
    var moving = false;
    if (state.lastView) {
      var dx = Math.abs(view.row - state.lastView.row) + Math.abs(view.col - state.lastView.col)
        + Math.abs(view.ox - state.lastView.ox) + Math.abs(view.oy - state.lastView.oy);
      moving = dx > 1e-4;
    }
    state.lastView = { row: view.row, col: view.col, ox: view.ox, oy: view.oy };
    if (moving) state.lastMoveT = now;
    var moveAge = now - state.lastMoveT;
    var movingNow = moveAge < 300;

    // Never sit on the cheese; stop at the near edge of its tile
    var cp = tileAt(level.cheese[0], level.cheese[1]);
    var vx = p.x - cp.x, vz = p.z - cp.z, d = Math.sqrt(vx * vx + vz * vz), STOP = 0.36;
    if (d >= 0.05) state.approach = { x: vx / d, z: vz / d };
    if (d < STOP && state.approach) p = { x: cp.x + state.approach.x * STOP, z: cp.z + state.approach.z * STOP };

    // Height from the surface under the mouse
    var surfY = surfaceAt(level, view.row + view.oy, view.col + view.ox, view.layer);
    m.root.position.set(p.x, FLOOR_Y + surfY - FLOOR_Y + (surfY > 0 ? 0 : 0), p.z);
    m.root.position.y = surfY;
    m.root.rotation.y = -view.angle + Math.PI;

    // Ramp pitch
    var rr = Math.round(view.row + view.oy), rc = Math.round(view.col + view.ox);
    var targetPitch = 0;
    var rcell = cellAt(level, rr, rc);
    if (rcell && rcell.kind === 'ramp') {
      var slope = Math.atan(STEP / 1.0);
      var dir = rcell.rampDir || 'E';
      var facing = ((-view.angle) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
      // Direction the mouse faces in world (dir 0 = N = -z)
      var fx = -Math.sin(view.angle), fz = -Math.cos(view.angle);
      var ux = 0, uz = 0;
      if (dir === 'N') uz = -1; else if (dir === 'S') uz = 1;
      else if (dir === 'E') ux = 1; else if (dir === 'W') ux = -1;
      var dot = fx * ux + fz * uz;
      if (Math.abs(dot) > 0.5) targetPitch = dot > 0 ? slope : -slope;
    }
    var k = 1 - Math.exp(-(dt || 0.016) / 0.15);
    m.pitch += (targetPitch - m.pitch) * k;
    m.body.rotation.x = -m.pitch;
    if (Math.abs(m.pitch) > 0.001) m.root.position.y += 0.05;
    var chy = 0.16 + Math.tan(m.pitch) * 0.30 - (Math.abs(m.pitch) > 0.001 ? 0.05 : 0); // v2.2: chevron follows the ramp slope
    m.chevron.position.y = chy; m.chevronOutline.position.y = chy - 0.001;
    m.chevron.rotation.x = m.chevronOutline.rotation.x = -Math.PI / 2 - m.pitch;

    // Idle breathing
    m.breathT = now;
    var breathPhase = (now % 1600) / 1600;
    var breath = 1 + 0.015 * (1 - Math.cos(breathPhase * Math.PI * 2));
    var bobY = movingNow ? 0.02 * Math.abs(Math.sin(now / 80)) : 0;
    m.body.scale.set(breath, breath, breath);
    m.body.position.y = bobY;
    m.tail.rotation.y = movingNow ? Math.sin(now / 60) * 0.4 : Math.sin(now / 900) * 0.15;

    // Ear twitch
    if (now > m.nextTwitch) {
      m.twitchT = now;
      m.nextTwitch = now + 3000 + Math.random() * 2000;
    }
    var twitch = view.layer === 'under' ? 0 : Math.max(0, 1 - (now - m.twitchT) / 250); // no twitch under a bridge
    m.ears[0].rotation.z = twitch * 0.4;
    m.ears[1].rotation.z = -twitch * 0.4;

    // Celebrate: hop and nibble
    var hop = 0, cheeseScale = 1;
    if (celebrate) {
      var age = (now - celebrate.t0) / 1000;
      if (age >= 0 && age < 1.6) {
        hop = (view.layer === 'under' ? 0 : 0.15) * Math.max(0, Math.sin(Math.min(age, 0.6) * Math.PI / 0.6));
        var bites = [0.6, 1.1];
        bites.forEach(function (bt) {
          if (age > bt && age < bt + 0.3) cheeseScale = 0.9;
        });
        spawnSparkles(celebrate.t0, age);
      }
    }
    m.body.position.y += hop;
    if (state.cheeseGroup) state.cheeseGroup.scale.setScalar(cheeseScale);

    // Under-bridge transparency
    var baseTarget = view.layer === 'under' ? 0.45 : 1; // v2.2: fade while the mouse is under, over 0.15 s; camera stays put
    var fk = 1 - Math.exp(-(dt || 0.016) / 0.15);
    state.bridgeMats.forEach(function (mt) {
      var targetOpacity = (view.layer === 'under' && mt.userData.underOpacity !== undefined) ? mt.userData.underOpacity : baseTarget;
      var o = Math.abs(targetOpacity - mt.opacity) < 0.005 ? targetOpacity : mt.opacity + (targetOpacity - mt.opacity) * fk;
      if (o !== mt.opacity) { mt.opacity = o; mt.depthWrite = o > 0.99; mt.needsUpdate = true; }
    });

    // Ripples drift
    var ripT = (now / 1000) * 0.2;
    state.rippleMeshes.forEach(function (rg, i) {
      var s = 1 + 0.15 * Math.sin((now / 800) + i);
      rg.scale.set(s, s, 1);
      if (rg.userData.x0 === undefined) { rg.userData.x0 = rg.position.x; rg.userData.z0 = rg.position.z; }
      var off = ((ripT + i * 0.13) % 0.4) - 0.2; // v2.2: drift at 0.2 tile/s, looping inside the cell
      rg.position.x = rg.userData.x0 + off;
    });
  }

  var SPARKLE_COUNT = 12;
  function spawnSparkles(t0, age) {
    if (state.sparkleT0 === t0) return;
    state.sparkleT0 = t0;
    var THREE = window.THREE;
    var grp = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: COLORS.sparkle });
    var geo = new THREE.SphereGeometry(0.035, 8, 6);
    for (var i = 0; i < SPARKLE_COUNT; i++) {
      var s = new THREE.Mesh(geo, mat);
      var a = (i / SPARKLE_COUNT) * Math.PI * 2;
      s.userData = { a: a, r: 0.35 + Math.random() * 0.15 };
      grp.add(s);
      state.meshCount++;
    }
    if (state.sparkleGroup) state.scene.remove(state.sparkleGroup);
    state.sparkles = [grp];
    state.scene.add(grp);
    state.sparkleGroup = grp;
  }

  function animateSparkles(celebrate, now) {
    if (!state.sparkleGroup) return;
    if (!celebrate) {
      state.scene.remove(state.sparkleGroup);
      state.sparkleGroup = null;
      state.sparkles = [];
      state.sparkleT0 = null;
      return;
    }
    var age = (now - celebrate.t0) / 1000;
    var cheese = state.cheeseGroup.position;
    state.sparkleGroup.position.set(cheese.x, cheese.y, cheese.z);
    var k = Math.min(1, age / 0.4);
    var fade = age > 1.6 ? 0 : 1;
    state.sparkleGroup.children.forEach(function (s) {
      var u = s.userData;
      var rr = u.r * k;
      s.position.set(Math.cos(u.a + age) * rr, 0.2 + age * 0.3, Math.sin(u.a + age) * rr);
      s.scale.setScalar(fade * (0.6 + 0.4 * Math.sin(age * 10 + u.a)));
    });
  }

  // ---------- Camera ----------
  function fitCamera() {
    var cam = state.camera;
    var w = state.w, h = state.h;
    if (!w || !h || !cam) return;
    var THREE = window.THREE;
    var n = boardN();
    cam.aspect = w / h;
    var pitch = 50 * Math.PI / 180, yaw = 30 * Math.PI / 180;
    var maxH = state.maxH || 0;
    var target = new THREE.Vector3(0, FLOOR_Y + maxH / 2, 0);
    var land = window.innerWidth > window.innerHeight;
    var wantH = 0.84, wantW = 0.84; // v0.5 layout spec: whole board (incl. ramps/platforms) inside its area with an 8% margin on every side, centred
    var pts = [];
    var ext = n / 2 + 0.05;
    [-ext, ext].forEach(function (x) {
      [-ext, ext].forEach(function (z) {
        [-0.05, 0.66 + (maxH > 0 ? 0.10 : 0)].forEach(function (y) {
          pts.push(new THREE.Vector3(x, y, z));
        });
      });
    });
    function place(dist) {
      cam.position.set(target.x + dist * Math.cos(pitch) * Math.sin(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.cos(yaw));
      cam.lookAt(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      var x0 = 1, x1 = -1, y0 = 1, y1 = -1;
      pts.forEach(function (p) { var q = p.clone().project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
      return { w: (x1 - x0) / 2, h: (y1 - y0) / 2, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }
    cam.clearViewOffset();
    var lo = 3, hi = 40;
    for (var it = 0; it < 30; it++) {
      var mid = (lo + hi) / 2, f = place(mid);
      if (f.h > wantH || f.w > wantW) lo = mid; else hi = mid;
    }
    var fit = place(hi);
    cam.setViewOffset(w, h, fit.cx * w / 2, -fit.cy * h / 2, w, h);
    state.boardFrac = fit.h * h / window.innerHeight;
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }

  function sizeCanvas() {
    if (!state.container) return;
    var w = state.container.clientWidth || 1;
    var h = state.container.clientHeight || 1;
    state.w = w; state.h = h;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (state.mode === 'webgl' && state.renderer) {
      state.renderer.setPixelRatio(state.dpr);
      state.renderer.setSize(w, h, false);
      state.canvas.style.width = w + 'px';
      state.canvas.style.height = h + 'px';
      fitCamera();
    } else if (state.canvas) {
      state.canvas.width = Math.floor(w * state.dpr);
      state.canvas.height = Math.floor(h * state.dpr);
      state.canvas.style.width = w + 'px';
      state.canvas.style.height = h + 'px';
    }
  }

  // ---------- 2D fallback ----------
  function draw2D(s) {
    var ctx = state.ctx2d;
    if (!ctx) return;
    var dpr = state.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(0, 0, state.w, state.h);
    var level = s.level;
    var n = level.size || 4;
    var size = Math.min(state.w, state.h) * 0.8;
    var cell = size / n;
    var ox0 = (state.w - size) / 2, oy0 = (state.h - size) / 2;
    var r, c;
    for (r = 0; r < n; r++) {
      for (c = 0; c < n; c++) {
        var cd = cellAt(level, r, c);
        var x = ox0 + c * cell, y = oy0 + r * cell;
        if (cd && (cd.water || cd.kind === 'water')) {
          ctx.fillStyle = '#7fd3e6';
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          continue;
        }
        if (cd && cd.kind === 'ramp') {
          ctx.fillStyle = '#a3d13c';
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          ctx.fillStyle = '#c4e86a';
          for (var st = 1; st <= 3; st++) {
            ctx.fillRect(x + 2, y + st * cell / 4 - 1, cell - 4, 3);
          }
          continue;
        }
        if (cd && cd.kind === 'bridge') {
          ctx.fillStyle = '#7fd3e6';
          if (cd.water) ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          ctx.fillStyle = '#c98a4b';
          if (cd.axis === 'NS') ctx.fillRect(x + cell * 0.1, y + 2, cell * 0.8, cell - 4);
          else ctx.fillRect(x + 2, y + cell * 0.1, cell - 4, cell * 0.8);
          ctx.fillStyle = '#9c6630';
          for (var pk = 1; pk < 5; pk++) {
            if (cd.axis === 'NS') ctx.fillRect(x + cell * 0.1, y + pk * cell / 5, cell * 0.8, 2);
            else ctx.fillRect(x + pk * cell / 5, y + cell * 0.1, 2, cell * 0.8);
          }
          continue;
        }
        if (cd && cd.kind === 'crate') {
          ctx.fillStyle = ((r + c) % 2 === 0) ? '#a3d13c' : '#9bc936';
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = '#9aa0a8';
            ctx.beginPath();
            ctx.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#e07a4f';
            ctx.fillRect(x + cell * 0.3, y + cell * 0.3, cell * 0.4, cell * 0.4);
          }
          continue;
        }
        if (cd && cd.h === 1) {
          ctx.fillStyle = '#6f9a22';
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          ctx.fillStyle = '#a3d13c';
          ctx.fillRect(x + 6, y + 6, cell - 12, cell - 12);
          continue;
        }
        ctx.fillStyle = ((r + c) % 2) ? '#9bc936' : '#a3d13c';
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      }
    }
    ctx.fillStyle = '#8e44c9';
    (level.walls || []).forEach(function (w) {
      var p = w.split(',');
      var wr = +p[0], wc = +p[1], d = p[2];
      var x = ox0 + wc * cell, y = oy0 + wr * cell;
      if (d === 'N') ctx.fillRect(x, y - 4, cell, 8);
      if (d === 'S') ctx.fillRect(x, y + cell - 4, cell, 8);
      if (d === 'E') ctx.fillRect(x + cell - 4, y, 8, cell);
      if (d === 'W') ctx.fillRect(x - 4, y, 8, cell);
    });
    var cx = ox0 + (level.cheese[1] + 0.5) * cell;
    var cy = oy0 + (level.cheese[0] + 0.5) * cell;
    drawBlob(ctx, cx, cy + cell * 0.25, cell * 0.25);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(cx - cell * 0.2, cy + cell * 0.12);
    ctx.lineTo(cx + cell * 0.2, cy + cell * 0.12);
    ctx.lineTo(cx, cy - cell * 0.18);
    ctx.closePath();
    ctx.fill();
    var mx = ox0 + (s.view.col + s.view.ox + 0.5) * cell;
    var my = oy0 + (s.view.row + s.view.oy + 0.5) * cell;
    drawBlob(ctx, mx, my + cell * 0.25, cell * 0.28);
    ctx.fillStyle = '#7ec4f2';
    ctx.beginPath();
    ctx.arc(mx, my, cell * 0.24, 0, Math.PI * 2);
    ctx.fill();
    var nx = mx + Math.sin(-s.view.angle) * cell * 0.24;
    var ny = my - Math.cos(-s.view.angle) * cell * 0.24;
    ctx.fillStyle = '#ff8fa8';
    ctx.beginPath();
    ctx.arc(nx, ny, cell * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlob(ctx, x, y, rad) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function switchTo2D() {
    if (state.mode === '2d') return;
    state.mode = '2d';
    if (state.canvas && state.renderer) {
      try { state.renderer.dispose(); } catch (e) {}
    }
    state.renderer = null;
    var c = document.createElement('canvas');
    if (state.canvas && state.canvas.parentNode) {
      state.canvas.parentNode.replaceChild(c, state.canvas);
    } else if (state.container) {
      state.container.appendChild(c);
    }
    state.canvas = c;
    state.ctx2d = c.getContext('2d');
    sizeCanvas();
  }

  // ---------- Main loop ----------
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = state.lastFrameT ? Math.min(0.1, (now - state.lastFrameT) / 1000) : 0.016;
    state.lastFrameT = now;
    var s = null;
    try { s = state.getState ? state.getState() : null; } catch (e) { s = null; }
    if (!s || !s.level || !s.view) {
      return;
    }
    if (state.mode === '2d') {
      try { draw2D(s); } catch (e) {}
      return;
    }
    try {
      if (state.levelBuilt !== s.level) rebuildLevel(s.level);
      updateMouse(s.view, now, s.celebrate, s.level, dt);
      animateSparkles(s.celebrate, now);
      state.renderer.render(state.scene, state.camera);
    } catch (e) {
      switchTo2D();
    }
  }

  function onResize() { sizeCanvas(); }

  window.Renderer = {
    init: function (containerEl, getState) {
      state.container = containerEl;
      state.getState = getState;
      var ok = tryWebGL();
      if (ok) {
        state.mode = 'webgl';
        state.canvas = state.renderer.domElement;
        containerEl.appendChild(state.canvas);
        try { buildScene(); } catch (e) { switchTo2D(); }
      } else {
        state.mode = '2d';
        var c = document.createElement('canvas');
        containerEl.appendChild(c);
        state.canvas = c;
        state.ctx2d = c.getContext('2d');
      }
      sizeCanvas();
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      if (typeof ResizeObserver !== 'undefined') {
        try { new ResizeObserver(onResize).observe(containerEl); } catch (e) {}
      }
      requestAnimationFrame(frame);
    },
    _dbg: function () { return state; },
    info: function () {
      return { mode: state.mode, meshes: state.meshCount, boardFrac: state.boardFrac, size: state.boardSize || 4 };
    }
  };
})();

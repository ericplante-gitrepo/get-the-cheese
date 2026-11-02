Rewrite these three.js r159 functions (classic global THREE, ES5 style like the input, no modules): buildMouse(), buildCheeseGeo(), buildCheese(), and outlineMesh(geo, scale). Output ONE ```js block containing only those 4 functions plus one new helper contactShadow(w, d) (returns a Mesh), nothing else. Same return shapes as now: buildMouse returns { root, body, ears, eyes, tail, bob:0, breathT:0, twitchT:0, nextTwitch:4 } (root is the group the game positions at the tile centre at y=0 and rotates about Y; body is a child group that gets scaled and bobbed). Increment state.meshCount for meshes as now. Use COLORS.* (mouse 0x7ec4f2, belly 0xd6efff, inner 0xff8fa8, nose 0xff8fa8, eye 0x202b50, outline 0x202b50, cheese 0xffd23f, hole 0xe0901c).

Facts: tile top surface is at y = 0.15. 1 tile = 1.0 unit. The mouse model's nose must point +Z (the game rotates root by -angle+PI). Everything must be centred on x=0, z=0 (the tile centre), with the body's centre of its footprint exactly at the origin (nose at +0.31, rump at -0.31).

Mouse (style guide): egg body exactly 0.62 long (Z), 0.46 wide (X), 0.30 tall (Y): SphereGeometry(0.5) scaled (0.46, 0.30, 0.62), sitting ON the tile (bottom at y=0.15, so centre y=0.30), slightly egg-shaped (narrower toward the nose: taper vertices with z>0 by up to 15% in x). Belly patch #d6efff on the underside/front, fully inside the silhouette. Two round ears 0.16 across (CylinderGeometry radius 0.08, thin, standing upright, facing forward) attached ON the body: at x=±0.13, z=+0.10, y=0.43 (overlapping the body surface). Pink inner ears. Two eyes (navy spheres r 0.032 with a white specular dot) embedded in the body surface at x=±0.09, z=+0.24, y=0.36. Pink nose r 0.04 at z=+0.31, y=0.30. Thin curled tail (TubeGeometry r 0.018) starting at the rump (z=-0.30, y=0.22) curling back 0.35 long, lying low near the tile. All these parts are children of body so they move with it.
Outline: solid navy #202b50 inverted hull (MeshBasicMaterial BackSide) on the body and on the cheese, about 2 px at 1x: hull scale 1.07 for the mouse body, 1.08 for the cheese. outlineMesh must copy the target mesh's position so it wraps it exactly.
Contact shadow: contactShadow(w, d) = a flat ellipse (CircleGeometry(0.5, 24) scaled (w,1,d) after rotating to lie flat) with MeshBasicMaterial black, transparent, opacity 0.30, depthWrite false, at y = 0.152, renderOrder 1. Add one to the mouse root (w 0.5, d 0.66, not in body so it doesn't hop) and one to the cheese group (w 0.38, d 0.30).
Cheese: a real wedge 0.38 long and 0.22 tall: triangular prism; triangle in the XY plane with base 0.38 along X on y=0 and the high end 0.22 tall at x=-0.19 (right triangle), extruded 0.26 deep along Z, small bevel 0.01. Translate so its footprint centre is at x=0,z=0 and its bottom at y=0 (the game sets the group y to the tile top 0.15). 4 hole discs #e0901c (r 0.03-0.04) placed ON the front sloped face and the two side faces, slightly proud of the surface (0.003), oriented to the face normals, none floating. castShadow on body/cheese.

Current code for reference:
  function buildMouse() {
    var THREE = window.THREE;
    var root = new THREE.Group();
    var body = new THREE.Group();
    root.add(body);
    var bodyGeo = new THREE.SphereGeometry(0.5, 24, 16);
    bodyGeo.scale(0.62, 0.30, 0.46);
    var bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.mouse, roughness: 0.3 });
    var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.30;
    bodyMesh.castShadow = true;
    body.add(bodyMesh);
    body.add(outlineMesh(bodyGeo, 1.05).translateY(0.30));
    state.meshCount += 2;

    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.belly, roughness: 0.35 }));
    belly.scale.set(1.2, 0.7, 1.0);
    belly.position.set(0, 0.22, 0.14);
    body.add(belly);

    // Ears
    var earGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
    var earMat = new THREE.MeshStandardMaterial({ color: COLORS.mouse, roughness: 0.3 });
    var innerGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.045, 16);
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
      ie.position.z = 0.005;
      g.add(ie);
      g.position.set(s * 0.2, 0.52, -0.05);
      g.rotation.y = s * 0.2;
      body.add(g);
      ears.push(g);
      state.meshCount += 2;
    });

    // Eyes
    var eyes = [];
    [-1, 1].forEach(function (s) {
      var eg = new THREE.Group();
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10),
        new THREE.MeshStandardMaterial({ color: COLORS.eye, roughness: 0.2 }));
      eg.add(eye);
      var spec = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      spec.position.set(0.012, 0.012, 0.03);
      eg.add(spec);
      eg.position.set(s * 0.11, 0.42, 0.37);
      body.add(eg);
      eyes.push(eg);
      state.meshCount += 2;
    });

    // Nose
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10),
      new THREE.MeshStandardMaterial({ color: COLORS.nose, roughness: 0.3 }));
    nose.position.set(0, 0.34, 0.40);
    body.add(nose);
    state.meshCount++;

    // Tail
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.2, -0.3),
      new THREE.Vector3(0, 0.25, -0.45),
      new THREE.Vector3(0.1, 0.3, -0.55),
      new THREE.Vector3(0.2, 0.25, -0.5),
      new THREE.Vector3(0.22, 0.2, -0.42)
    ]);
    var tailGeo = new THREE.TubeGeometry(curve, 16, 0.02, 8, false);
    var tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: COLORS.mouse, roughness: 0.3 }));
    tail.castShadow = true;
    body.add(tail);
    state.meshCount++;

    return { root: root, body: body, ears: ears, eyes: eyes, tail: tail,
      bob: 0, breathT: 0, twitchT: 0, nextTwitch: 4 };
  }

  function buildCheeseGeo() {
    var THREE = window.THREE;
    var s = new THREE.Shape();
    s.moveTo(-0.19, -0.11);
    s.lineTo(0.19, -0.11);
    s.lineTo(-0.19, 0.11);
    s.lineTo(-0.19, -0.11);
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true,
      bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 4 });
    geo.center();
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
    g.add(outlineMesh(geo, 1.04));
    var holeMat = new THREE.MeshStandardMaterial({ color: COLORS.hole, roughness: 0.6 });
    var holeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12);
    [[0.0, 0.0], [0.08, -0.04], [-0.06, -0.05]].forEach(function (p) {
      var h = new THREE.Mesh(holeGeo, holeMat);
      h.rotation.x = Math.PI / 2;
      h.position.set(p[0], p[1], 0.115);
      g.add(h);
      state.meshCount++;
    });
    state.meshCount += 3;
    return g;
  }


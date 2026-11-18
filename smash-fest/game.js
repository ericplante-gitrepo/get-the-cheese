(function () {
'use strict';
const C = window.CANNON;
const STEP = 1 / 120;
const SHOT_IMPULSE = 9;
const COLORS = [0xFF6B6B, 0xFFC845, 0x7BD3C4, 0xFF8FB1, 0x9B5DE5, 0x4FB8FF];
let random = mulberry32(20261117);
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rand(a, b) { return a + (b - a) * random(); }
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xBFE6FF, 60, 155);
const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 240);
scene.add(camera);
// Software rasterisers (SwiftShader, llvmpipe: no-GPU tablets, CI) get a lighter path so they hold 30 fps:
// no MSAA, plain PCF shadows. Real GPUs keep antialiasing and soft shadows.
const softwareGL = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (gl && gl.getExtension('WEBGL_lose_context')) gl.getExtension('WEBGL_lose_context').loseContext();
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch (err) { return false; }
})();
const renderer = new THREE.WebGLRenderer({antialias: !softwareGL, alpha: false});
renderer.setPixelRatio(softwareGL ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = softwareGL ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Smash Fest. Tap a tower block to fire.');
const world = new C.World({gravity: new C.Vec3(0, -9.82, 0), allowSleep: true});
world.broadphase = new C.SAPBroadphase(world);
world.solver.iterations = 12;
world.solver.tolerance = 0.0001;
world.defaultContactMaterial.friction = 0.3;
world.defaultContactMaterial.restitution = 0.02;
const physicsMaterials = {};
['ice', 'wood', 'candy', 'gold', 'support', 'plank', 'ground', 'ball'].forEach(name => {
  physicsMaterials[name] = new C.Material(name);
});
function contact(a, b, friction, restitution) {
  world.addContactMaterial(new C.ContactMaterial(physicsMaterials[a], physicsMaterials[b], {
    friction, restitution, contactEquationStiffness: 1e7,
    contactEquationRelaxation: 4, frictionEquationStiffness: 1e7
  }));
}
for (const support of ['ground', 'support', 'plank']) {
  contact('ice', support, 0.08, 0.05);
  contact('candy', support, support === 'plank' ? 0.12 : 0.3, 0.45);
  contact('wood', support, support === 'plank' ? 0.2 : 0.5, 0.02);
}
contact('ice', 'ice', 0.08, 0.05);
contact('wood', 'wood', 0.5, 0.02);
contact('candy', 'candy', 0.3, 0.45);
contact('candy', 'wood', 0.3, 0.45);
contact('ice', 'wood', 0.08, 0.05);
for (const other of ['support', 'plank', 'wood', 'candy']) contact('gold', other, 0.3, 0.2);
contact('plank', 'ground', 0.15, 0.01);
contact('ball', 'ground', 0.35, 0.25);
function material(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.6, metalness: 0, flatShading: true
  }, extra || {}));
}
const mats = {
  ice: material(0xA8E4FF, {transparent: true, opacity: 0.85}),
  wood: material(0xffffff, {vertexColors: true}),
  candy: material(0xffffff, {vertexColors: true}),
  support: material(0xE89A4B), plank: material(0xFF8A3D),
  navy: material(0x202B50), cream: material(0xD8D0C3), // top face renders as ~#F2EBDD under the key light
  side: material(0xC9B79C), grass: material(0x7BC86C),
  patch: material(0x5AA84F), blue: material(0x2F7FD8),
  yellow: material(0xFFC845), gold: material(0xFFC845, {emissive: 0x6B4A00, emissiveIntensity: 0.15}),
  ball: material(0x6B7280, {emissive: 0xD1D5DB, emissiveIntensity: 0.12})
};
// three r159 uses physical light units (no legacy x PI), so camera-facing faces need about PI of
// total irradiance to show their spec colour. Tuned so front faces sample within 8% of the palette.
scene.add(new THREE.HemisphereLight(0xBFE6FF, 0x7BC86C, 1.1));
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {left: -10, right: 10, top: 12, bottom: -8, near: 1, far: 55});
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const skyGeo = new THREE.SphereGeometry(190, 24, 16);
const skyColors = [];
const skyPos = skyGeo.attributes.position;
const skyTop = new THREE.Color(0x4FB8FF), skyBottom = new THREE.Color(0xBFE6FF);
for (let i = 0; i < skyPos.count; i++) {
  const c = skyBottom.clone().lerp(skyTop, THREE.MathUtils.clamp(skyPos.getY(i) / 175, 0, 1));
  skyColors.push(c.r, c.g, c.b);
}
skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
  vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
}));
sky.renderOrder = -10;
scene.add(sky);
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), mats.grass);
groundMesh.rotation.x = -Math.PI / 2;
scene.add(groundMesh);
const groundBody = new C.Body({mass: 0, material: physicsMaterials.ground});
groundBody.addShape(new C.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.isGrass = true;
world.addBody(groundBody);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 10, 7);
const ballGeo = new THREE.SphereGeometry(0.175, 14, 10);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
const coneGeo = new THREE.ConeGeometry(1, 1, 6);
const tempV = new THREE.Vector3(), tempV2 = new THREE.Vector3();
const tempC = new C.Vec3(), tempEuler = new C.Vec3();
const dummy = new THREE.Object3D(), tempColor = new THREE.Color();
const woodCache = new Map();
function woodGeometry(w, h, d) {
  const key = [w, h, d].join(',');
  if (woodCache.has(key)) return woodCache.get(key);
  const pieces = [];
  const base = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  pieces.push({g: base, c: 0xF2A04E}); // a touch above #E89A4B: grain shading pulls the face sample down
  for (let i = 0; i < 5; i++) {
    const y = -h * 0.36 + h * 0.18 * i;
    const g = new THREE.BoxGeometry(w * (0.67 + 0.04 * (i % 3)), Math.min(0.018, h * 0.035), d + 0.003).toNonIndexed();
    g.translate((i % 2 ? 1 : -1) * w * 0.05, y, 0);
    pieces.push({g, c: 0xB8692E});
  }
  const positions = [], normals = [], colors = [];
  pieces.forEach(p => {
    const pos = p.g.attributes.position, nor = p.g.attributes.normal;
    const color = new THREE.Color(p.c);
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(color.r, color.g, color.b);
    }
    p.g.dispose();
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  woodCache.set(key, g);
  return g;
}
const iceGeo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
for (let i = 0; i < iceGeo.attributes.position.count; i++) {
  tempV.fromBufferAttribute(iceGeo.attributes.position, i);
  tempV2.copy(tempV).clampScalar(-0.455, 0.455);
  tempV.sub(tempV2).normalize().multiplyScalar(0.045).add(tempV2);
  iceGeo.attributes.position.setXYZ(i, tempV.x, tempV.y, tempV.z);
}
iceGeo.computeVertexNormals();
const iceEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.97, 0.97, 0.97));
const edgeMat = new THREE.LineBasicMaterial({color: 0xE8F8FF, transparent: true, opacity: 0.7});
const candyGeo = new THREE.CylinderGeometry(0.25, 0.25, 1, 32, 48);
const candyColors = [];
for (let i = 0; i < candyGeo.attributes.position.count; i++) {
  const p = candyGeo.attributes.position;
  const angle = Math.atan2(p.getZ(i), p.getX(i));
  const phase = (p.getY(i) + 0.5) * 3 + angle * 0.34;
  const band = ((phase % 1) + 1) % 1 < 0.27;
  const c = new THREE.Color(band ? 0x9B5DE5 : 0xffffff);
  candyColors.push(c.r, c.g, c.b);
}
candyGeo.setAttribute('color', new THREE.Float32BufferAttribute(candyColors, 3));
function makeMesh(geometry, mat, shadow) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = !!shadow;
  mesh.receiveShadow = !!shadow;
  return mesh;
}
function decoration(geometry, mat, x, y, z, sx, sy, sz, parent) {
  const mesh = makeMesh(geometry, mat, false);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  (parent || scenery).add(mesh);
  return mesh;
}
const scenery = new THREE.Group();
scene.add(scenery);
// Castles: style-guide pink / lilac at 85% value so the blocks stay >= 25% brighter (Art Director, b6c994b check)
const bgPink = material(0xD28FB8), bgPurple = material(0xAA8ACC);
const bgPinkRoof = material(0xB77194); // roof cones tilt toward the sun; pre-darkened to match the walls
const castleMeshes = [], tentMeshes = [];
const bgGreen = material(0x78AF83), bgTrunk = material(0xAE947E);
const bgRed = material(0xE9A5A3), bgWhite = material(0xF8F3EB);
for (let side = -1; side <= 1; side += 2) {
  const x = side * 29, z = -27;
  decoration(unitBox, side < 0 ? bgPink : bgPurple, x, 2.2, z, 6, 4.4, 4);
  for (let j = -1; j <= 1; j += 2) {
    castleMeshes.push(decoration(cylinderGeo, bgPurple, x + j * 3, 3, z, 1.2, 6, 1.2));
    castleMeshes.push(decoration(coneGeo, bgPinkRoof, x + j * 3, 7, z, 1.65, 2, 1.65));
  }
  for (let j = 0; j < 3; j++) {
    const tx = side * (19 + j * 8), tz = -15 - j * 9;
    decoration(cylinderGeo, bgTrunk, tx, 0.7, tz, 0.25, 1.4, 0.25);
    decoration(coneGeo, bgGreen, tx, 2.7, tz, 1.7, 4.5, 1.7);
  }
  const tent = new THREE.ConeGeometry(3.2, 4.2, 12).toNonIndexed();
  const tc = [];
  for (let v = 0; v < tent.attributes.position.count; v++) {
    // r159 cone torso = 6 verts per segment (a zero-area apex triangle + the visible face), so stripe by segment
    const c = new THREE.Color(Math.floor(v / 6) % 2 ? 0xFFFFFF : 0xFF6B6B);
    c.lerp(new THREE.Color(0xD9D5CC), 0.3);
    tc.push(c.r, c.g, c.b);
  }
  tent.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
  tentMeshes.push(decoration(tent, material(0xffffff, {vertexColors: true}), side * 23, 2.1, -6, 1, 1, 1));
}
for (let i = 0; i < 3; i++) {
  const x = [-26, 28, 36][i], y = [12, 15, 10][i], z = -35 - i * 3;
  decoration(sphereGeo, material([0xFFC845, 0x7BD3C4, 0xFF8FB1][i]), x, y, z, 1.15, 1.5, 1.15);
  decoration(cylinderGeo, bgWhite, x, y - 3, z, 0.025, 3, 0.025);
}
for (let i = 0; i < 9; i++) {
  const p = decoration(cylinderGeo, mats.patch, rand(-45, 45), 0.008, rand(-38, 22), rand(1.2, 3.5), 0.01, rand(1, 3));
  p.rotation.y = rand(0, Math.PI);
}
const cannonRig = new THREE.Group();
camera.add(cannonRig);
decoration(unitBox, mats.yellow, 0, 0.04, 0.06, 0.8, 0.22, 0.65, cannonRig);
const barrel = decoration(cylinderGeo, mats.blue, 0, 0.41, -0.12, 0.255, 0.85, 0.255, cannonRig);
barrel.rotation.x = Math.PI / 2 - 0.15;
const muzzleRing = decoration(cylinderGeo, mats.navy, 0, 0.475, -0.55, 0.258, 0.035, 0.258, cannonRig);
muzzleRing.rotation.x = barrel.rotation.x;
for (const x of [-0.43, 0.43]) {
  const rim = decoration(cylinderGeo, mats.navy, x, 0.13, 0.12, 0.27, 0.14, 0.27, cannonRig);
  rim.rotation.z = Math.PI / 2;
  const wheel = decoration(cylinderGeo, mats.yellow, x * 1.02, 0.13, 0.12, 0.205, 0.15, 0.205, cannonRig);
  wheel.rotation.z = Math.PI / 2;
}
const muzzle = new THREE.Object3D();
muzzle.position.set(0, 0.48, -0.58);
cannonRig.add(muzzle);
let recoil = 0, cannonBaseY = 0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const CANNON_SHARE = 0.125; // measured silhouette ~16% of screen height (style guide cap: 18%)
  const scale = 2 * 2.3 * Math.tan(THREE.MathUtils.degToRad(25)) * CANNON_SHARE / 0.9;
  cannonRig.scale.setScalar(scale);
  cannonBaseY = -2.3 * Math.tan(THREE.MathUtils.degToRad(25)) + 0.045 + 0.14 * scale;
  cannonRig.position.set(0, cannonBaseY, -2.3);
  updateCamera();
}
class ParticlePool {
  constructor(geometry, capacity) {
    this.capacity = capacity;
    this.cursor = 0;
    this.items = Array.from({length: capacity}, () => ({
      life: 0, total: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      rx: 0, ry: 0, rz: 0, spin: 0, sx: 1, sy: 1, sz: 1, gravity: 0
    }));
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    const g = geometry.clone();
    g.setAttribute('particleAlpha', this.alpha);
    const mat = material(0xffffff, {transparent: true, depthWrite: false, side: THREE.DoubleSide});
    mat.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float particleAlpha; varying float vParticleAlpha;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvParticleAlpha = particleAlpha;');
      shader.fragmentShader = 'varying float vParticleAlpha;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vParticleAlpha;');
    };
    this.mesh = new THREE.InstancedMesh(g, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) {
      dummy.scale.setScalar(0); dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, tempColor.set(0xffffff));
    }
    scene.add(this.mesh);
  }
  spawn(x, y, z, color, life, size, vx, vy, vz, gravity, stretch) {
    const i = this.cursor++ % this.capacity, p = this.items[i];
    Object.assign(p, {x, y, z, vx, vy, vz, gravity, life, total: life,
      rx: rand(0, 6.28), ry: rand(0, 6.28), rz: rand(0, 6.28),
      spin: rand(-9, 9), sx: size, sy: size * (stretch || 1), sz: size});
    this.mesh.setColorAt(i, tempColor.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.items[i];
      if (p.life > 0) {
        p.life = Math.max(0, p.life - dt);
        p.vy -= p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.spin * dt; p.rz += p.spin * dt * 0.7;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rx, p.ry, p.rz);
        const shrink = 0.45 + 0.55 * p.life / p.total;
        dummy.scale.set(p.sx * shrink, p.sy * shrink, p.sz * shrink);
        this.alpha.array[i] = p.life / p.total;
      } else {
        dummy.scale.setScalar(0);
        this.alpha.array[i] = 0;
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
  clear() { this.items.forEach(p => { p.life = 0; }); this.update(0); }
}
const puffs = new ParticlePool(sphereGeo, 180);
const chips = new ParticlePool(unitBox, 220);
const confetti = new ParticlePool(new THREE.PlaneGeometry(1, 1), 180);
function puff(x, y, z) {
  for (let i = 0; i < 9; i++) {
    puffs.spawn(x, y, z, 0xffffff, 0.4, rand(0.065, 0.13), rand(-0.8, 0.8), rand(0.1, 1.1), rand(-0.8, 0.8), 0);
  }
}
function burst(x, y, z, count, life) {
  for (let i = 0; i < count; i++) {
    confetti.spawn(x, y, z, COLORS[i % COLORS.length], life, rand(0.08, 0.16),
      rand(-4, 4), rand(2, 7), rand(-3, 3), 9.82, 0.5);
  }
}
let current = null, incoming = null, phase = 'play', balls = 20;
let clears = 0, retries = 0, serial = 0, settling = false;
let clock = 0, lastShotTime = -100, lastShot = null, accumulator = 0;
let clearTimer = 0, sleepTimer = 0, retryTimer = 0, wakeTimer = 0;
let transition = null;
const shots = [], spentBalls = [], shards = [], removalQueue = [];
const counter = document.getElementById('balls'), retryBubble = document.getElementById('retry');
function refreshCounter() {
  counter.textContent = String(balls);
  counter.style.color = balls < 5 ? '#FF6B6B' : '#FFFFFF';
}
function addEntity(tower, mesh, body, type, target, support) {
  const e = {mesh, body, type, target: !!target, support: !!support, removed: false, hits: 0, queued: false};
  body.entity = e;
  body.tower = tower;
  body.sleepSpeedLimit = 0.15;
  body.sleepTimeLimit = 0.6;
  body.linearDamping = type === 'candy' ? 0.12 : 0.15;
  body.angularDamping = type === 'plank' ? 0.4 : 0.25;
  tower.entities.push(e);
  if (target) tower.targets.push(e);
  if (support) tower.supports.add(body);
  world.addBody(body);
  tower.group.add(mesh);
  mesh.userData.entity = e;
  tower.raycast.push(mesh);
  body.addEventListener('collide', event => onCollision(e, event));
  syncEntity(e, 0);
  return e;
}
function box(t, type, x, y, z, w, h, d, target, isStatic) {
  const density = type === 'ice' ? 3 : 0.6;
  const body = new C.Body({
    mass: isStatic ? 0 : density * w * h * d,
    material: physicsMaterials[type === 'support' ? 'support' : type],
    position: new C.Vec3(x, y, t.z + z),
    shape: new C.Box(new C.Vec3(w / 2, h / 2, d / 2))
  });
  let mesh;
  if (type === 'ice') {
    mesh = makeMesh(iceGeo, mats.ice, true);
    mesh.add(new THREE.LineSegments(iceEdges, edgeMat));
    if (w !== 1 || h !== 1 || d !== 1) mesh.scale.set(w, h, d); // iceGeo is a 1 m bevelled cube
  } else if (type === 'wood') {
    mesh = makeMesh(woodGeometry(w, h, d), mats.wood, true);
  } else {
    mesh = makeMesh(new THREE.BoxGeometry(w, h, d), mats[type], true);
  }
  return addEntity(t, mesh, body, type, target, type === 'support' || type === 'plank');
}
// Gold pyramid (tower 7 crown): medium weight like candy, never breaks; square pyramid on a box body.
const goldGeo = new THREE.ConeGeometry(0.62, 0.8, 4, 1); goldGeo.rotateY(Math.PI / 4);
function gold(t, x, y) {
  const body = new C.Body({mass: 1.5 * 0.85 * 0.8 * 0.85 / 3, material: physicsMaterials.gold,
    position: new C.Vec3(x, y, t.z), shape: new C.Box(new C.Vec3(0.43, 0.4, 0.43))});
  return addEntity(t, makeMesh(goldGeo, mats.gold, true), body, 'gold', true, false);
}
function candy(t, x, y) {
  const body = new C.Body({
    mass: 1.5 * Math.PI * 0.25 * 0.25,
    material: physicsMaterials.candy,
    position: new C.Vec3(x, y, t.z),
    shape: new C.Cylinder(0.25, 0.25, 1, 20)
  });
  return addEntity(t, makeMesh(candyGeo, mats.candy, true), body, 'candy', true, false);
}
function seesaw(t) {
  const pivotY = 1.88;
  const pivotBody = new C.Body({
    mass: 0, material: physicsMaterials.support,
    position: new C.Vec3(0, 1.24, t.z),
    shape: new C.Box(new C.Vec3(0.24, 0.64, 0.48))
  });
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, -0.64); shape.lineTo(0.75, -0.64); shape.lineTo(0, 0.64); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {depth: 0.95, bevelEnabled: false});
  geo.translate(0, 0, -0.475);
  addEntity(t, makeMesh(geo, mats.navy, true), pivotBody, 'pivot', false, true);
  const plank = box(t, 'plank', 0, pivotY + 0.15, 0, 6, 0.3, 1.4, false, false);
  plank.body.mass = 4;
  plank.body.updateMassProperties();
  const hinge = new C.HingeConstraint(pivotBody, plank.body, {
    pivotA: new C.Vec3(0, 0.64, 0), pivotB: new C.Vec3(0, -0.15, 0),
    axisA: new C.Vec3(0, 0, 1), axisB: new C.Vec3(0, 0, 1),
    collideConnected: false, maxForce: 1e6
  });
  world.addConstraint(hinge);
  t.hinge = hinge; t.seesaw = plank;
  return pivotY + 0.3;
}
const TOWERS = [
  {balls: 20, build(t) {
    [-1.6, 0, 1.6].forEach(x => box(t, 'support', x, 1.8, 0, 0.6, 2.4, 0.6, false, true));
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) box(t, 'ice', col - 1.5, 3.505 + row * 1.005, 0, 1, 1, 1, true, false);
    }
  }},
  {balls: 20, build(t) {
    const top = seesaw(t);
    for (let i = -2; i <= 2; i++) candy(t, i, top + 0.505);
    box(t, 'wood', 0, top + 1.13, 0, 5, 0.25, 0.9, true, false);
    for (let i = -2; i <= 2; i++) candy(t, i, top + 1.76);
  }},
  {balls: 20, build(t) {
    const top = seesaw(t);
    for (let i = 0; i < 3; i++) box(t, 'wood', 0, top + 0.505 + i * 1.005, 0, 1, 1, 1, true, false);
    box(t, 'wood', 0, top + 3.14, 0, 4, 0.25, 0.9, true, false);
    [-1.5, 1.5].forEach(x => box(t, 'wood', x, top + 3.77, 0, 1, 1, 1, true, false));
  }},
  {balls: 23, build(t) { // 4: ice arch on a seesaw (two ice columns, an ice lintel, a keystone cube)
    const top = seesaw(t);
    [-2, 2].forEach(x => { box(t, 'ice', x, top + 0.505, 0, 1, 1, 1, true, false); box(t, 'ice', x, top + 1.51, 0, 1, 1, 1, true, false); });
    box(t, 'ice', 0, top + 2.27, 0, 5, 0.5, 1, true, false);
    box(t, 'ice', 0, top + 3.03, 0, 1, 1, 1, true, false);
  }},
  {balls: 24, build(t) { // 5: tall narrow candy tower with gaps, on a seesaw
    const top = seesaw(t);
    for (let lv = 0; lv < 4; lv++) {
      const y0 = top + lv * 1.255;
      [-0.55, 0.55].forEach(x => candy(t, x, y0 + 0.505));
      box(t, 'wood', 0, y0 + 1.13, 0, 1.7, 0.25, 0.9, true, false);
    }
  }},
  {balls: 20, build(t) { // 6: tall wood frame (pillars and crossbeams) on a seesaw
    const top = seesaw(t);
    [-1.5, 1.5].forEach(x => box(t, 'wood', x, top + 1.005, 0, 0.3, 2, 0.3, true, false));
    box(t, 'wood', 0, top + 2.135, 0, 3.6, 0.25, 0.6, true, false);
    [-1.1, 1.1].forEach(x => box(t, 'wood', x, top + 3.265, 0, 0.3, 2, 0.3, true, false));
    box(t, 'wood', 0, top + 4.395, 0, 2.8, 0.25, 0.6, true, false);
    box(t, 'wood', 0, top + 5.025, 0, 1, 1, 1, true, false);
  }},
  {balls: 20, build(t) { // 7: mixed tower on a static base, gold pyramid on top
    box(t, 'support', 0, 1.2, 0, 3.2, 1.2, 1.6, false, true);
    [-1, 0, 1].forEach(x => box(t, 'ice', x, 2.305, 0, 1, 1, 1, true, false));
    box(t, 'wood', 0, 2.94, 0, 3.2, 0.25, 0.9, true, false);
    [-1, 0, 1].forEach(x => candy(t, x, 3.575));
    box(t, 'wood', 0, 4.21, 0, 2.8, 0.25, 0.9, true, false);
    gold(t, 0, 4.74);
  }}
];
function makeTower(index, track) {
  const t = {index, track, z: -40 * track, group: new THREE.Group(),
    entities: [], targets: [], supports: new Set(), raycast: [], hinge: null, seesaw: null, drop: 0};
  scene.add(t.group);
  const platform = new C.Body({
    mass: 0, material: physicsMaterials.ground,
    position: new C.Vec3(0, 0.3, t.z),
    shape: new C.Cylinder(4.5, 4.5, 0.6, 48)
  });
  const pg = new THREE.CylinderGeometry(4.5, 4.5, 0.6, 48);
  const pm = makeMesh(pg, [mats.side, mats.cream, mats.side], true);
  addEntity(t, pm, platform, 'platform', false, false);
  TOWERS[index].build(t);
  settle(t);
  t.entities.forEach(e => syncEntity(e, 0));
  computeFitBox(t);
  return t;
}
function settle(t) {
  settling = true;
  const saved = [];
  t.entities.forEach(e => {
    if (!e.body.mass) return;
    saved.push([e.body, e.body.linearDamping, e.body.angularDamping]);
    e.body.linearDamping = 0.9; e.body.angularDamping = 0.9; e.body.wakeUp();
  });
  if (t.hinge) {
    t.hinge.enableMotor(); t.hinge.setMotorSpeed(0); t.hinge.setMotorMaxForce(1e6);
  }
  // Isolate existing towers and debris while the new layout is pre-simulated.
  const keep = new Set(t.entities.map(e => e.body));
  keep.add(groundBody);
  const excluded = world.bodies.filter(b => !keep.has(b));
  const excludedConstraints = world.constraints.filter(c => c !== t.hinge);
  excludedConstraints.forEach(c => world.removeConstraint(c));
  excluded.forEach(b => world.removeBody(b));
  for (let i = 0; i < 120; i++) world.step(STEP);
  excluded.forEach(b => world.addBody(b));
  excludedConstraints.forEach(c => world.addConstraint(c));
  if (t.hinge) t.hinge.disableMotor();
  saved.forEach(a => {
    a[0].linearDamping = a[1]; a[0].angularDamping = a[2];
    a[0].velocity.setZero(); a[0].angularVelocity.setZero();
    a[0].force.setZero(); a[0].torque.setZero(); a[0].sleep();
  });
  t.entities.forEach(e => syncEntity(e, 0));
  settling = false;
}
function syncEntity(e, drop) {
  if (e.removed) return;
  e.mesh.position.copy(e.body.position);
  if (e.target) e.mesh.position.y += drop;
  e.mesh.quaternion.copy(e.body.quaternion);
}
function wakeTower(t) {
  if (!t) return;
  t.entities.forEach(e => { if (!e.removed && e.body.mass) e.body.wakeUp(); });
}
function onCollision(e, event) {
  if (settling || e.removed || e.queued || !e.target) return;
  const other = event.body;
  if (other.isGrass) { queueRemove(e, 'pop'); return; }
  const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
  if (e.type === 'ice' && other.mass === 0 && speed > 3.5) queueRemove(e, 'ice');
  if (e.type === 'wood' && speed > 4) queueRemove(e, 'wood');
}
function queueRemove(e, effect) {
  if (e.removed || e.queued) return;
  e.queued = true; removalQueue.push({e, effect});
}
const breakStats = {};
function removeTarget(e, effect) {
  if (e.removed) return;
  const p = e.body.position, x = p.x, y = p.y, z = p.z;
  e.removed = true;
  world.removeBody(e.body);
  e.mesh.visible = false;
  const k = e.type + ':' + effect; breakStats[k] = (breakStats[k] || 0) + 1; // test-only tally, e.g. 'ice:ice', 'candy:pop'
  if (effect === 'ice') {
    puff(x, y, z);
    const count = 6 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const size = rand(0.25, 0.35);
      const body = new C.Body({mass: 3 * size ** 3, material: physicsMaterials.ice,
        shape: new C.Box(new C.Vec3(size / 2, size / 2, size / 2)),
        position: new C.Vec3(x + rand(-0.3, 0.3), y + rand(-0.2, 0.3), z + rand(-0.3, 0.3))});
      body.velocity.set(rand(-2.5, 2.5), rand(1, 3.5), rand(-2.5, 2.5));
      body.angularVelocity.set(rand(-5, 5), rand(-5, 5), rand(-5, 5));
      const mesh = makeMesh(iceGeo, mats.ice, false);
      mesh.scale.setScalar(size); scene.add(mesh); world.addBody(body);
      shards.push({body, mesh, life: 4});
    }
  } else if (effect === 'wood') {
    for (let i = 0; i < 8; i++) {
      chips.spawn(x, y, z, 0xB8692E, 0.6, rand(0.035, 0.065),
        rand(-3, 3), rand(1, 4), rand(-3, 3), 9.82, rand(4, 7));
    }
  } else burst(x, Math.max(y, 0.15), z, 9, 0.6);
  wakeTower(e.body.tower);
}
function isDown(e) {
  if (e.removed) return true;
  const b = e.body;
  if (b.position.y < 0.6) return true;
  if (b.position.y >= 1.6 || b.velocity.lengthSquared() >= 0.36) return false;
  const supports = b.tower.supports;
  for (let i = 0; i < world.contacts.length; i++) {
    const c = world.contacts[i];
    if (!c.enabled) continue;
    if ((c.bi === b && supports.has(c.bj)) || (c.bj === b && supports.has(c.bi))) return false;
  }
  return true;
}
function destroyTower(t) {
  if (!t) return;
  if (t.hinge) world.removeConstraint(t.hinge);
  t.entities.forEach(e => {
    if (!e.removed) world.removeBody(e.body);
    const g = e.mesh.geometry;
    if (g !== iceGeo && g !== candyGeo && g !== goldGeo && !Array.from(woodCache.values()).includes(g)) g.dispose();
  });
  scene.remove(t.group);
}
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function fireAt(x, y) {
  if (phase !== 'play' || balls <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  camera.updateMatrixWorld(true);
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const meshes = current.raycast.filter(m => !m.userData.entity.removed);
  meshes.push(groundMesh);
  scene.updateMatrixWorld(true);
  const hits = raycaster.intersectObjects(meshes, false);
  const hit = hits.length ? hits[0] : null;
  const to = hit ? hit.point.clone() : raycaster.ray.at(25, new THREE.Vector3());
  const from = muzzle.getWorldPosition(new THREE.Vector3());
  const mesh = makeMesh(ballGeo, mats.ball, false);
  mesh.position.copy(from); scene.add(mesh);
  const direction = to.clone().sub(from);
  const velocity = direction.clone().multiplyScalar(1 / 0.12);
  direction.normalize();
  shots.push({mesh, from, to, velocity, direction, age: 0,
    entity: hit ? hit.object.userData.entity || null : null});
  balls--; refreshCounter(); lastShotTime = clock; sleepTimer = 0;
  lastShot = {from: {x: from.x, y: from.y, z: from.z}, to: {x: to.x, y: to.y, z: to.z}};
  recoil = 0.08;
  puff(from.x, from.y, from.z);
  return true;
}
renderer.domElement.addEventListener('pointerdown', event => {
  event.preventDefault();
  fireAt(event.clientX, event.clientY);
}, {passive: false});
function arrive(s) {
  const e = s.entity;
  if (e && !e.removed) {
    wakeTower(e.body.tower);
    if (e.body.mass) {
      const impulse = new C.Vec3(s.direction.x * SHOT_IMPULSE, s.direction.y * SHOT_IMPULSE, s.direction.z * SHOT_IMPULSE);
      const relative = new C.Vec3(s.to.x - e.body.position.x, s.to.y - e.body.position.y, s.to.z - e.body.position.z);
      e.body.applyImpulse(impulse, relative);
    }
    e.hits++;
    if (e.type === 'wood' && e.hits >= 2) queueRemove(e, 'wood');
    if (e.type === 'candy') {
      for (let i = 0; i < 6; i++) chips.spawn(s.to.x, s.to.y, s.to.z, i % 2 ? 0xffffff : 0x9B5DE5,
        0.45, 0.065, rand(-2, 2), rand(0.8, 3), rand(-2, 2), 5, 1.8);
    }
  }
  puff(s.to.x, s.to.y, s.to.z);
  const body = new C.Body({mass: 0.3, material: physicsMaterials.ball,
    shape: new C.Sphere(0.175), position: new C.Vec3(s.to.x, s.to.y, s.to.z)});
  body.velocity.set(s.velocity.x * 0.15, s.velocity.y * 0.15, s.velocity.z * 0.15);
  world.addBody(body);
  spentBalls.push({body, mesh: s.mesh, life: 3});
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.age += dt;
    s.mesh.position.lerpVectors(s.from, s.to, Math.min(1, s.age / 0.12));
    if (s.age + 1e-9 >= 0.12) { arrive(s); shots.splice(i, 1); }
  }
}
function updateDebris(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    a.life -= dt;
    if (a.life <= 0) {
      world.removeBody(a.body); scene.remove(a.mesh); list.splice(i, 1);
    } else {
      a.mesh.position.copy(a.body.position); a.mesh.quaternion.copy(a.body.quaternion);
    }
  }
}
function clearDebris() {
  shots.forEach(s => scene.remove(s.mesh)); shots.length = 0;
  [spentBalls, shards].forEach(list => {
    list.forEach(s => { world.removeBody(s.body); scene.remove(s.mesh); }); list.length = 0;
  });
  removalQueue.length = 0;
  puffs.clear(); chips.clear(); confetti.clear();
}
// Camera fit: find the nearest distance (8..34 m) at which the tower's box (all its pieces at
// spawn plus the platform top, padded) fits inside the frame on BOTH axes: x in the middle
// 60% of the width when possible (else 88%), y between the cannon (bottom 20%) and the counter (top 10%).
// Camera fit: find the nearest distance (8..34 m) at which the tower (box corners of all its pieces
// at spawn, padded 0.4 m) and the platform rim fit inside the frame on BOTH axes: x in the middle
// 60% of the width when possible (else 88%), y between the cannon (bottom 15%) and the counter (top 10%).
const fitCam = new THREE.PerspectiveCamera(50, 1, 0.08, 240), fitV = new THREE.Vector3();
function fitPoints(box, rim, lift) {
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x,
    i & 2 ? box.max.y + lift : box.min.y, i & 4 ? box.max.z : box.min.z));
  if (rim) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(new THREE.Vector3(4.5 * Math.cos(a), 0.6, 4.5 * Math.sin(a))); }
  return pts;
}
function fitsAt(pts, d, xLimit) {
  fitCam.aspect = camera.aspect; fitCam.updateProjectionMatrix();
  fitCam.position.set(0, 3.6, d); fitCam.lookAt(0, 2.5, 0); fitCam.updateMatrixWorld(true);
  const top = xLimit > 0.9 ? 0.97 : 0.8;
  for (const p of pts) {
    fitV.copy(p).project(fitCam);
    if (Math.abs(fitV.x) > xLimit || fitV.y > top || fitV.y < -0.7) return false;
  }
  return true;
}
function cameraDistance(t) {
  if (!t || !t.fitBox) return 12;
  const key = camera.aspect.toFixed(4);
  if (t.fitKey === key) return t.fitDist;
  const pts = fitPoints(t.fitBox, true, 0);
  let d = 34;
  for (const xLimit of [0.6, 0.88]) {
    let found = 0;
    for (let k = 8; k <= 34; k += 0.25) if (fitsAt(pts, k, xLimit)) { found = k; break; }
    if (found) { d = found; break; }
  }
  t.fitKey = key; t.fitDist = d;
  return d;
}
function computeFitBox(t) {
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  t.entities.forEach(e => {
    if (e.type === 'platform') return;
    e.mesh.updateMatrixWorld(true); tmp.setFromObject(e.mesh);
    tmp.min.z -= t.z; tmp.max.z -= t.z; box.union(tmp);
  });
  box.expandByScalar(0.4);
  t.fitBox = box; t.fitKey = null;
}
// Flight plan: pick the highest arc (<= 6 m) and drop-in height (<= 4 m) that keep the incoming tower
// (including its lifted blocks) inside the frame at every moment of the 1.7 s camera move.
const flightPos = new THREE.Vector3(), flightA = new THREE.Vector3(), flightB = new THREE.Vector3();
function flightPose(cur, inc, u, arc, outPos) { // camera pose at move fraction u, relative to inc.z
  const s = smooth(u);
  cameraPose(cur, flightA); cameraPose(inc, flightB);
  outPos.lerpVectors(flightA, flightB, s); outPos.y += Math.sin(Math.PI * u) * arc; outPos.z -= inc.z;
  return THREE.MathUtils.lerp(cur.z, inc.z, s) - inc.z; // look-at z, relative
}
function dropAt(h, u) { const remaining = 1.7 * (1 - u); return remaining > 0.5 ? h : h * (1 - smooth(1 - remaining / 0.5)); }
function viewFits(pts, pos, lookZ) {
  fitCam.aspect = camera.aspect; fitCam.updateProjectionMatrix();
  fitCam.position.copy(pos); fitCam.lookAt(0, 2.5, lookZ); fitCam.updateMatrixWorld(true);
  for (const p of pts) {
    fitV.copy(p).project(fitCam);
    if (!Number.isFinite(fitV.x) || fitV.z < -1 || fitV.z > 1) return false; // outside the near/far range
    if (Math.abs(fitV.x) > 0.98 || fitV.y > 0.97) return false; // bottom may run under the cannon mid-move
  }
  return true;
}
const flightPlans = new Map(); // cached per (from tower, to tower, aspect): the search runs once per pair
function planFlight(cur, inc) {
  const key = cur.index + '>' + inc.index + '@' + camera.aspect.toFixed(4) + ':' + cameraDistance(cur) + ',' + cameraDistance(inc);
  if (!flightPlans.has(key)) flightPlans.set(key, searchFlight(cur, inc));
  return flightPlans.get(key);
}
function searchFlight(cur, inc) {
  for (const arc of [6, 5, 4, 3, 2, 1, 0]) {
    for (let h = 4; h >= 0; h -= 0.5) {
      let ok = true;
      const full = fitPoints(inc.fitBox, false, h);
      for (let u = 0; u <= 1.0001 && ok; u += 0.04) {
        const uu = Math.min(1, u), lift = dropAt(h, uu);
        const lookZ = flightPose(cur, inc, uu, arc, flightPos);
        ok = viewFits(lift === h ? full : fitPoints(inc.fitBox, false, lift), flightPos, lookZ);
      }
      if (ok) return {arc, drop: h};
    }
  }
  return {arc: 0, drop: 0};
}
function cameraPose(t, out) {
  out.set(0, 3.6, t.z + cameraDistance(t));
}
const camStart = new THREE.Vector3(), camEnd = new THREE.Vector3();
const lookPoint = new THREE.Vector3();
function smooth(t) { return t * t * (3 - 2 * t); }
function updateCamera() {
  if (!current) return;
  let z = current.z;
  if (transition && transition.time >= 0 && incoming) {
    const t = Math.min(1, transition.time / 1.7), s = smooth(t);
    cameraPose(current, camStart); cameraPose(incoming, camEnd);
    camera.position.lerpVectors(camStart, camEnd, s);
    camera.position.y += Math.sin(Math.PI * t) * (transition.arc ?? 6);
    z = THREE.MathUtils.lerp(current.z, incoming.z, s);
  } else cameraPose(current, camera.position);
  lookPoint.set(0, 2.5, z);
  camera.lookAt(lookPoint);
  sky.position.copy(camera.position);
  sun.position.set(-12, 20, z + 12);
  sun.target.position.set(0, 1, z);
  scenery.position.z = z;
  groundMesh.position.z = z;
  cannonRig.position.y = cannonBaseY;
  cannonRig.position.z = -2.3 + (recoil > 0 ? 0.15 * Math.sin(Math.PI * (1 - recoil / 0.08)) : 0);
  camera.updateMatrixWorld(true);
}
function beginClear() {
  clears++;
  phase = 'flying';
  transition = {time: -0.6};
  burst(0, 4, current.z, 40, 0.6);
}
function updateTransition(dt) {
  transition.time += dt;
  if (transition.time >= -1e-8 && !incoming) {
    transition.time = Math.max(0, transition.time);
    incoming = makeTower((current.index + 1) % TOWERS.length, ++serial);
    const plan = planFlight(current, incoming);
    transition.arc = plan.arc; incoming.dropMax = plan.drop;
    incoming.drop = incoming.dropMax;
    incoming.entities.forEach(e => syncEntity(e, incoming.drop));
  }
  if (!incoming) return;
  const remaining = 1.7 - transition.time;
  incoming.drop = remaining > 0.5 ? incoming.dropMax : incoming.dropMax * (1 - smooth(1 - Math.max(0, remaining) / 0.5));
  if (transition.time + 1e-8 >= 1.7) {
    destroyTower(current);
    current = incoming; incoming = null; transition = null;
    current.drop = 0; current.entities.forEach(e => syncEntity(e, 0));
    balls = TOWERS[current.index].balls; refreshCounter();
    phase = 'play'; clearTimer = 0; sleepTimer = 0; lastShotTime = clock;
  }
}
function startRetry() {
  phase = 'retry'; retryTimer = 1;
  retryBubble.style.display = 'block';
}
function rebuild() {
  const index = current.index, track = current.track;
  clearDebris(); destroyTower(current);
  current = makeTower(index, track);
  balls = TOWERS[index].balls; refreshCounter();
  retries++; phase = 'play'; clearTimer = 0; sleepTimer = 0;
  lastShotTime = clock; retryBubble.style.display = 'none';
}
function checkPlay(dt) {
  let allDown = true, allAsleep = true;
  for (const e of current.targets) if (!isDown(e)) { allDown = false; break; }
  clearTimer = allDown ? clearTimer + dt : 0;
  if (clearTimer + 1e-8 >= 0.5) { beginClear(); return; }
  for (const e of current.entities) {
    if (!e.removed && e.body.mass && e.body.sleepState !== C.Body.SLEEPING) {
      allAsleep = false; break;
    }
  }
  sleepTimer = allAsleep && shots.length === 0 ? sleepTimer + dt : 0;
  if (balls === 0 && shots.length === 0 && (clock - lastShotTime >= 3 || sleepTimer >= 1)) startRetry();
}
function fixedUpdate(dt) {
  clock += dt;
  recoil = Math.max(0, recoil - dt);
  updateShots(dt);
  const active = [current, incoming];
  for (const t of active) {
    if (!t || !t.seesaw || t.seesaw.removed) continue;
    const sq = t.seesaw.body.quaternion; // hinge is about z: angle = 2*atan2(qz, qw)
    t.seesaw.body.torque.z += -6 * 2 * Math.atan2(sq.z, sq.w);
  }
  world.step(dt);
  while (removalQueue.length) {
    const item = removalQueue.shift();
    removeTarget(item.e, item.effect);
  }
  wakeTimer += dt;
  if (wakeTimer >= 0.2) {
    wakeTimer -= 0.2;
    for (const t of active) {
      if (t && t.entities.some(e => !e.removed && e.body.mass && e.body.velocity.lengthSquared() > 0.09)) wakeTower(t);
    }
  }
  updateDebris(spentBalls, dt); updateDebris(shards, dt);
  puffs.update(dt); chips.update(dt); confetti.update(dt);
  if (phase === 'play') checkPlay(dt);
  else if (phase === 'flying') updateTransition(dt);
  else if (phase === 'retry') {
    retryTimer -= dt;
    if (retryTimer <= 1e-8) rebuild();
  }
  if (current) current.entities.forEach(e => syncEntity(e, 0));
  if (incoming) incoming.entities.forEach(e => syncEntity(e, incoming.drop));
  updateCamera();
}
function advance(dt) {
  accumulator += dt;
  let substeps = 0;
  while (accumulator + 1e-10 >= STEP && substeps < 8) {
    fixedUpdate(STEP); accumulator -= STEP; substeps++;
  }
  if (accumulator < 0) accumulator = 0;
}
function render() {
  renderer.render(scene, camera);
}
function gotoTower(i) {
  const number = Math.max(1, Math.floor(Number(i) || 1));
  clearDebris();
  destroyTower(current); destroyTower(incoming);
  incoming = null; transition = null; accumulator = 0;
  serial = number;
  current = makeTower((number - 1) % TOWERS.length, serial);
  phase = 'play'; balls = TOWERS[current.index].balls;
  clearTimer = 0; sleepTimer = 0; wakeTimer = 0; recoil = 0;
  lastShot = null; lastShotTime = clock;
  retryBubble.style.display = 'none';
  refreshCounter(); updateCamera(); render();
}
window.__test = {
  manual: false,
  getState() {
    return {
      tower: current.index + 1, towerCount: TOWERS.length, balls,
      blocksOnSupport: current.targets.reduce((n, e) => n + (isDown(e) ? 0 : 1), 0),
      targetsTotal: current.targets.length, phase, clears, retries,
      ballsInFlight: shots.length, breaks: Object.assign({}, breakStats),
      lastShot: lastShot ? {from: Object.assign({}, lastShot.from), to: Object.assign({}, lastShot.to)} : null
    };
  },
  fireAt,
  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0) return;
    let remaining = dt;
    while (remaining > 1e-10) {
      const slice = Math.min(remaining, 0.05);
      advance(slice); remaining -= slice;
    }
    render();
  },
  targetsOnScreen() {
    camera.updateMatrixWorld(true);
    const rect = renderer.domElement.getBoundingClientRect(), result = [];
    current.targets.forEach(e => {
      if (isDown(e)) return;
      tempV.copy(e.mesh.position).project(camera);
      result.push({x: rect.left + (tempV.x + 1) * rect.width / 2, y: rect.top + (1 - tempV.y) * rect.height / 2});
    });
    return result;
  },
  seed(n) { random = mulberry32(Number(n) >>> 0); },
  goto: gotoTower,
  flightPlan() { return transition ? {arc: transition.arc, drop: incoming && incoming.dropMax} : null; },
  forceClear() { if (phase === 'play') beginClear(); }
};
window.__game = {
  castleMeshes, tentMeshes, cannonRig, softwareGL,
  scene, camera, renderer, world, TOWERS, SHOT_IMPULSE,
  get current() { return current; },
  get incoming() { return incoming; },
  fireAt, isDown, wakeTower
};
window.addEventListener('resize', resize);
current = makeTower(0, ++serial);
refreshCounter(); resize(); render();
let previousTime = null;
function frame(timestamp) {
  requestAnimationFrame(frame);
  const dt = previousTime === null ? 0 : Math.min(0.05, Math.max(0, (timestamp - previousTime) / 1000));
  previousTime = timestamp;
  if (!window.__test.manual) advance(dt);
  render();
}
requestAnimationFrame(frame);
})();

// Ear clearance under the L17 bridge: min (deck underside - ear top) over idle+breathing (3 s parked under) and walking under (real program run).
const { chromium } = require('playwright-core');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 const p = await (await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true })).newPage();
 await p.goto('file:///workspace/get-the-cheese/game/index.html'); await p.waitForTimeout(900);
 await p.evaluate(() => document.querySelectorAll('#levels > *')[16].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await p.waitForTimeout(600);
 // per-frame sampler: record ear top while the mouse is within 0.5 tile of the bridge cell on the under layer
 await p.evaluate(() => { const st = Renderer._dbg(); window.__s = []; let under = 9;
   st.terrain.traverse(o => { if (o.isMesh && st.bridgeMats.indexOf(o.material) >= 0 && o.geometry.type === 'BoxGeometry' && o.name !== 'deckEdge') { const bb = new THREE.Box3().setFromObject(o); if (bb.max.y > 0.5) under = Math.min(under, bb.min.y); } });
   const bp = { x: 0, z: 0 }; // bridge (2,2) is the centre of the 5x5 board
   (function f() { const v = st.getState().view, mp = st.mouse.root.position;
     if (v.layer === 'under' && Math.abs(mp.x - bp.x) < 0.5 && Math.abs(mp.z - bp.z) < 0.5) { let ear = -1; st.mouse.ears.forEach(e => { ear = Math.max(ear, new THREE.Box3().setFromObject(e).max.y); }); window.__s.push({ c: under - ear, ear: ear - 0.15, phase: st.getState().celebrate && window.__phase === 'walk' ? 'win-hop' : window.__phase }); }
     requestAnimationFrame(f); })(); window.__under = under - 0.15; });
 await p.evaluate(() => { window.__phase = 'walk'; }); const sol = await p.evaluate(() => solve(LEVELS[16], 24));
 for (const m of sol) await p.tap(`[data-move="${m}"]`); await p.tap('#go');
 await p.waitForSelector('#overlay:not([hidden])', { timeout: 20000 }); // run ends under the bridge (cheese there)
 await p.evaluate(() => { window.__phase = 'idle'; document.getElementById('overlay').hidden = true; }); await p.waitForTimeout(4000);
 const r = await p.evaluate(() => { const g = ph => { const a = window.__s.filter(x => x.phase === ph); return { n: a.length, minClear: +Math.min(...a.map(x => x.c)).toFixed(4), maxEarTop: +Math.max(...a.map(x => x.ear)).toFixed(4), minEarTop: +Math.min(...a.map(x => x.ear)).toFixed(4) }; };
   return { underside: +window.__under.toFixed(4), walk: g('walk'), winHop: g('win-hop'), idleBreathing: g('idle') }; });
 console.log(JSON.stringify(r)); await b.close(); })();

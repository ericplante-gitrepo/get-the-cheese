// Mouse visibility under the bridge (L17, mouse under the deck): count mouse-coloured pixels with the deck vs with the deck hidden.
const { chromium } = require('playwright-core');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 const res = {};
 for (const vp of [{width:1024,height:768},{width:768,height:1024}]) { const tag = vp.width + 'x' + vp.height;
  const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage();
  await p.goto('file:///workspace/get-the-cheese/game/index.html'); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelectorAll('#levels > *')[16].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await p.waitForTimeout(600);
  // park the mouse under the bridge cell (2,2), facing W, layer under (the game's view object is read every frame)
  await p.evaluate(() => { const s = Renderer._dbg().getState(); Object.assign(s.view, { row: 2, col: 2, angle: 3 * Math.PI / 2, layer: 'under' }); });
  await p.waitForTimeout(1500);
  const shot = async (name, hide, mask) => { await p.evaluate(([hide, mask]) => { const st = Renderer._dbg();
      st.terrain.traverse(o => { if (o.material && st.bridgeMats.indexOf(o.material) >= 0) o.visible = !hide; });
      st.mouse.root.traverse(o => { if (o.isMesh) { if (!o.userData.m0) o.userData.m0 = o.material; o.material = mask ? (o.userData.mk = o.userData.mk || new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: true })) : o.userData.m0; } });
      st.mouse.chevron.visible = st.mouse.chevronOutline.visible = !mask; st.mouse.root.children.forEach(c => { if (c.material && c.material.opacity === 0.30) c.visible = !mask; });
    }, [hide, mask]); await p.waitForTimeout(400); return p.locator('#board canvas').screenshot({ path: '/tmp/vis-' + name + '-' + tag + '.png' }); };
  await shot('deck', false, true); await shot('nodeck', true, true); await shot('real', false, false); await p.evaluate(() => { Renderer._dbg().mouse.root.visible = false; }); await shot('nomouse', false, false); await p.evaluate(() => { Renderer._dbg().mouse.root.visible = true; });
  res[tag] = await p.evaluate(() => Renderer._dbg().bridgeMats.map(m => +m.opacity.toFixed(2)));
 }
 console.log(JSON.stringify(res)); await b.close(); })();

// v0.5 headless WebGL playthrough: all levels at 1024x768 and 768x1024, 0 console errors, portrait no scroll. Shots -> shots/v05/
const { chromium } = require('playwright-core');
const SH = '/workspace/get-the-cheese/game/shots/v05/';
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 const out=[]; const errs=[]; let wins=0, fails=0;
 const pick = (p, i) => p.evaluate(i => document.querySelectorAll('#levels > *')[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), i);
 for (const vp of [{width:1024,height:768},{width:768,height:1024}]) {
  const tag = vp.width + 'x' + vp.height;
  const p = await (await b.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file:///workspace/get-the-cheese/game/index.html'); await p.waitForTimeout(1400);
  const n = await p.evaluate(() => LEVELS.length);
  // chevron crop: L11 starts facing N (away from the camera)
  await pick(p, 10); await p.waitForTimeout(900);
  const box = await p.evaluate(() => { const s = Renderer._dbg(), v = s.mouse.root.position.clone().project(s.camera), r = s.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, w: r.width }; });
  const half = Math.round(box.w * 0.09);
  await p.screenshot({ path: SH + 'chevron-facing-away-L11-' + tag + '.png', clip: { x: box.x - half, y: box.y - half * 1.3, width: half * 2, height: half * 2 } });
  for (let i = 0; i < n; i++) {
    await pick(p, i); await p.waitForTimeout(350);
    const sol = await p.evaluate(i => solve(LEVELS[i], 24), i);
    await p.click('#clear');
    for (const m of sol) await p.tap(`[data-move="${m}"]`);
    await p.tap('#go');
    if (i === 10) { await p.waitForFunction(() => [...document.querySelectorAll('.card-step')].indexOf(document.querySelector('.card-step.active')) === 7, null, { timeout: 20000 }); await p.screenshot({ path: SH + 'ramp-platform-L11-' + tag + '.png' }); }
    if (i === 16) { await p.waitForFunction(() => [...document.querySelectorAll('.card-step')].indexOf(document.querySelector('.card-step.active')) === 12, null, { timeout: 20000 }); await p.waitForTimeout(380); await p.screenshot({ path: SH + 'under-bridge-L17-' + tag + '.png' }); }
    await p.waitForSelector('#overlay:not([hidden])', { timeout: 20000 }).catch(()=>{});
    await p.waitForTimeout(500);
    const t = await p.textContent('#ov-title').catch(()=>null);
    if (i === 13) await p.screenshot({ path: SH + 'bridge-over-water-L14-win-' + tag + '.png' });
    if (i === 19) await p.screenshot({ path: SH + 'win-5x5-L20-' + tag + '.png' });
    const info = await p.evaluate(() => ({ mode: Renderer.info().mode, size: Renderer.info().size, scroll: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight }));
    const ok = t === 'You got the cheese!' && info.mode === 'webgl' && info.scroll <= 0; ok ? wins++ : fails++;
    out.push(`${tag} L${i+1} ${info.size}x${info.size} ${sol.join('')} -> ${t} [${info.mode}, scroll ${info.scroll}]${ok ? '' : '  <-- FAIL'}`);
    await p.tap('#ov-btn').catch(()=>{}); await p.waitForTimeout(250);
  }
  // board shots of the new world before moving: L15 (5x5, two ramps), L16 (path under), L20 (5x5)
  for (const i of [14, 15, 19]) { await pick(p, i); await p.waitForTimeout(700); await p.screenshot({ path: SH + 'board-L' + (i + 1) + '-' + tag + '.png' }); }
  await pick(p, 0); await p.waitForTimeout(300); await p.click('#clear');
  await p.tap('[data-move="B"]'); await p.tap('#go'); await p.waitForTimeout(2500);
  out.push(`${tag} lose -> ${await p.textContent('#ov-title')}`);
 }
 console.log(out.join('\n')); console.log(`wins ${wins}/${wins + fails}`); console.log('errors', errs); await b.close(); })();

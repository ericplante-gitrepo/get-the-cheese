// v0.5 screenshots: node tools/v05/shots.js [levels...] ; saves to shots/v05
const { chromium } = require('playwright-core');
const OUT = '/workspace/get-the-cheese/game/shots/v05/';
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 const errs = []; const want = (process.env.LV || '11,16,17,15,20').split(',').map(Number);
 for (const vp of [{width:1024,height:768},{width:768,height:1024}]) {
  const p = await (await b.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file:///workspace/get-the-cheese/game/index.html'); await p.waitForTimeout(800);
  const tag = vp.width + 'x' + vp.height;
  for (const n of want) {
    await p.evaluate(i => document.querySelectorAll('#levels > *')[i].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})), n - 1); await p.waitForTimeout(700);
    await p.screenshot({ path: OUT + 'L' + n + '-' + tag + '.png' });
    const info = await p.evaluate(() => ({ ...Renderer.info(), scroll: document.documentElement.scrollHeight - innerHeight }));
    console.log(tag, 'L' + n, JSON.stringify(info));
  }
 }
 console.log('errors', errs); await b.close(); })();

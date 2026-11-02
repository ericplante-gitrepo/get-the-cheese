const { chromium } = require('playwright-core');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] }); const errs=[];
 for (const vp of [{width:1024,height:768},{width:768,height:1024}]) { const p = await (await b.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 2 })).newPage(); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file:///workspace/get-the-cheese/game/index.html'); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelectorAll('#levels > *')[16].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await p.waitForTimeout(500);
  for (const m of await p.evaluate(() => solve(LEVELS[16], 24))) await p.tap(`[data-move="${m}"]`);
  await p.tap('#go'); await p.waitForFunction(() => Renderer._dbg().lastView && LEVELS && document.querySelector('.card-step.active') && [...document.querySelectorAll('.card-step')].indexOf(document.querySelector('.card-step.active')) === 12, null, { timeout: 20000 });
  await p.waitForTimeout(380); await p.screenshot({ path: `/workspace/get-the-cheese/game/shots/v05/under-bridge-L17-${vp.width}x${vp.height}.png` }); }
 console.log('errors', errs); await b.close(); })();

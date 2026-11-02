// v0.6 title screen check: no scroll, all controls on screen, Play resumes the saved level, Levels opens the 1-20 picker, home button returns. Shots -> shots/v06/
const { chromium } = require('playwright-core');
const VPS = [[390,664],[430,750],[390,844],[430,932],[664,390],[844,390],[768,1024],[1024,768],[1024,1366],[1366,1024]];
const URL = 'file:///workspace/get-the-cheese/game/index.html';
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 let pass = 0, fail = 0; const errs = [];
 const inside = p => p.evaluate(() => { const vw = innerWidth, vh = innerHeight, out = [];
   document.querySelectorAll('#home button, #home h1, #home-foot, #home-level').forEach(el => { if (el.closest('[hidden]')) return; const r = el.getBoundingClientRect(); if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) out.push(el.id || el.className || el.tagName); });
   const t = document.getElementById('home-title').getBoundingClientRect(), pl = document.getElementById('home-play').getBoundingClientRect(), hero = document.getElementById('hero').getBoundingClientRect();
   const rg = document.createRange(); rg.selectNodeContents(document.getElementById('home-title')); const tb = rg.getBoundingClientRect(), cb = document.getElementById('home-col').getBoundingClientRect();
   const margin = { vl: Math.round(tb.left), vr: Math.round(vw - tb.right), vt: Math.round(tb.top), cl: Math.round(tb.left - cb.left), cr: Math.round(cb.right - tb.right), font: getComputedStyle(document.getElementById('home-title')).fontSize };
   const boardMid = (hero.top + hero.bottom) / 2, grp = document.getElementById('home-title').getBoundingClientRect(), ctlb = document.getElementById('home-ctl').getBoundingClientRect(), stackMid = (grp.top + ctlb.bottom) / 2;
   return { margin, stackOff: vw > vh ? Math.round(stackMid - boardMid) : null, out, scroll: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - vh, hscroll: document.documentElement.scrollWidth - vw, overlap: t.bottom > pl.top + 1, heroPct: Math.round(100 * (vw > vh ? hero.width / vw : hero.height / vh)), mode: Renderer.info().mode, tab: document.title }; });
 const check = (name, ok, info) => { ok ? pass++ : fail++; console.log(`${name}: ${ok ? 'ok' : 'FAIL'} ${info || ''}`); };
 for (const [w, h] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2, isMobile: w < 500 || h < 500 });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(1200);
  const r = await inside(p); const tag = `${w}x${h}`;
  check(`${tag} title`, !r.out.length && r.scroll <= 0 && r.hscroll <= 0 && !r.overlap && Math.min(r.margin.vl, r.margin.vr, r.margin.vt, r.margin.cl, r.margin.cr) >= 24 && (r.stackOff === null || Math.abs(r.stackOff) <= 12) && r.mode === 'webgl' && r.tab === 'Move That Mouse', JSON.stringify(r));
  await p.screenshot({ path: `shots/v06/title-${tag}.png` });
  await p.tap('#home-levels'); await p.waitForTimeout(300);
  const pk = await inside(p); const nd = await p.evaluate(() => document.querySelectorAll('#home-dots .hdot').length);
  check(`${tag} levels picker`, nd === 20 && !pk.out.length && pk.scroll <= 0, `dots=${nd} ${JSON.stringify(pk.out)}`);
  await p.screenshot({ path: `shots/v06/picker-${tag}.png` });
  await p.tap('#home-dots .hdot:nth-child(7)'); await p.waitForTimeout(700);
  const g = await p.evaluate(() => ({ hidden: document.getElementById('home').hidden, title: document.getElementById('title').textContent, inBoard: !!document.querySelector('#board canvas') }));
  check(`${tag} picker -> L7`, g.hidden && g.title.startsWith('Level 7:') && g.inBoard, JSON.stringify(g));
  await p.tap('#home-btn'); await p.waitForTimeout(400);
  const c = await p.evaluate(() => ({ shown: !document.getElementById('home').hidden, cap: document.getElementById('home-level').textContent }));
  check(`${tag} home button`, c.shown && c.cap === 'Level 7', JSON.stringify(c));
  await p.reload(); await p.waitForTimeout(900);
  const cap = await p.textContent('#home-level'); await p.tap('#home-play', { force: true }); await p.waitForTimeout(700);
  const t2 = await p.textContent('#title');
  check(`${tag} reload + Play resumes`, cap === 'Level 7' && t2.startsWith('Level 7:'), `${cap} -> ${t2}`);
  await ctx.close();
 }
 // first launch with storage blocked: Level 1, no errors
 const ctx = await b.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
 await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
 await p.goto(URL); await p.waitForTimeout(800); const cap = await p.textContent('#home-level'); await p.tap('#home-play', { force: true }); await p.waitForTimeout(600);
 check('storage blocked first launch', cap === 'Level 1' && (await p.textContent('#title')).startsWith('Level 1:'), cap);
 console.log(`title ${pass}/${pass + fail}`, 'errors', errs); await b.close(); process.exitCode = fail || errs.length ? 1 : 0; })();

// v0.5 layout check: no page scroll and GO/Clear/Reset/Hint + move buttons fully inside the viewport, empty and full (24-move) program, L5 and L17.
const { chromium } = require('playwright-core');
const VPS = [[390,664],[430,750],[390,844],[430,932],[768,1024],[1024,768]];
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 let pass = 0, fail = 0; const errs = [];
 for (const [w, h] of VPS) for (const lv of [5, 17]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2, isMobile: w < 500 })).newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///workspace/get-the-cheese/game/index.html'); await p.waitForTimeout(700);
  await p.evaluate(i => document.querySelectorAll('#levels > *')[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), lv - 1); await p.waitForTimeout(500);
  for (const n of [0, 24]) {
    if (n) { const order = 'FFRFLFBFFRFLFFRFLFBFFRLF'; for (const m of order) await p.tap(`[data-move="${m}"]`); await p.waitForTimeout(400); }
    const r = await p.evaluate(() => { const vw = innerWidth, vh = innerHeight, out = [];
      document.querySelectorAll('#buttons button').forEach(el => { const b = el.getBoundingClientRect(); if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) out.push(el.id || el.dataset.move); });
      const pr = document.getElementById('program'), last = pr.lastElementChild, pb = pr.getBoundingClientRect(), lb = last.getBoundingClientRect();
      const bd = document.getElementById('board').getBoundingClientRect();
      return { outside: out, scroll: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - vh, hscroll: document.documentElement.scrollWidth - vw,
        newestVisible: lb.top >= pb.top - 1 && lb.bottom <= pb.bottom + 1, programH: Math.round(pb.height), boardPct: Math.round(100 * bd.height / vh), count: document.getElementById('count').textContent, mode: Renderer.info().mode }; });
    const ok = !r.outside.length && r.scroll <= 0 && r.hscroll <= 0 && r.newestVisible && r.mode === 'webgl' && (h < w || r.boardPct >= 45);
    ok ? pass++ : fail++;
    const path = `shots/v05/layout/${w}x${h}-L${lv}-${n ? 'full24' : 'empty'}.png`;
    await p.screenshot({ path: '/workspace/get-the-cheese/game/' + path });
    console.log(`${w}x${h} L${lv} ${n ? 'full ' + r.count : 'empty'}: ${ok ? 'ok' : 'FAIL'} outside=[${r.outside}] scroll=${r.scroll} board=${r.boardPct}% list=${r.programH}px newestVisible=${r.newestVisible} -> ${path}`);
  }
  await p.context().close();
 }
 console.log(`layout ${pass}/${pass + fail}`, 'errors', errs); await b.close(); process.exitCode = fail ? 1 : 0; })();

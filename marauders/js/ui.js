/* =====================================================================
 * THE MARAUDERS — renderer + input   (ui.js)
 * ---------------------------------------------------------------------
 * Isometric canvas view with torchlight, fog-of-war and a camera that
 * follows the active student; plus the hot-seat turn flow.
 *
 * PERFORMANCE MODEL (the fix for "runs at 7fps"):
 *   · The world (tiles/walls/fog/light pools) is rendered ONCE per game
 *     action onto an offscreen "static layer", then blitted per frame.
 *   · reachable(), spell-target markers, torch lists and the minimap are
 *     CACHED per action — never recomputed per frame.
 *   · All animated glows use pre-rendered glow sprites (drawImage), not
 *     per-frame createRadialGradient.
 *   Per frame we draw: one blit + a handful of sprites/diamonds. ~60fps.
 *
 * RELIABILITY (hard-won, keep):
 *   · draw() re-arms rAF FIRST and the movement tween resolves OUTSIDE
 *     the render try/catch — one bad frame can never freeze the game.
 *   · Any error surfaces in a red on-screen banner (#errbar).
 *   · The camera SNAPS to integers when idle so clicks can't drift.
 * ===================================================================== */
(function (root) {
  'use strict';

  const data = root.MAR.data;
  const { CONFIG, TILES, SPELLS, HOUSES } = data;
  const TW = CONFIG.tileW, TH = CONFIG.tileH, WALL_H = 52, PAD = 150;
  // kind -> the spell that clears it (derived from the spellbook)
  const OPENER = {}; for (const id in SPELLS) { const t = SPELLS[id].transforms; if (t) for (const k in t) OPENER[k] = id; }
  const key = (x, y) => x + ',' + y;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let g, canvas, ctx, raf, ro;
  let ox = 0, oy = 0, cssW = 0, cssH = 0;
  let camX = 0, camY = 0, camReady = false;
  let mode = 'idle';               // idle | target | fling | anim | over
  let selSpell = null, flingAlly = null;
  let hover = null;
  let rpos = {};                    // id -> render position (for gliding)
  let anim = null;                  // current movement tween
  let effects = [];                // transient spell rings
  let motes = [];                  // drifting embers
  let players = 1, seats = [], lastSeat = -1;
  let t0 = 0, toastCursor = 0;
  let lastTs = 0, fpsMs = 16;       // rolling frame-time (exposed for debugging)

  /* static layer + per-action caches */
  let world = null, wctx = null, worldOX = 0, worldOY = 0, worldCssW = 0, worldCssH = 0, worldScale = 1;
  let staticsDirty = true;
  let cachedReach = new Map(), cachedMarkers = [], cachedTorches = [], exitPos = null;
  let cachedAuras = [], cachedTrail = null, ghost = null;
  let bgGrad = null, bgGlow = null, vigGrad = null, alarmGrad = null;
  const glows = {};
  let keyHandler = null;

  /* ---- error reporting (never let a failure be silent) ---------------- */
  function showError(where, e) {
    try {
      console.error('Marauders [' + where + ']', (e && e.stack) || e);
      let el = document.getElementById('errbar');
      if (!el) { el = document.createElement('div'); el.id = 'errbar'; (document.body || document.documentElement).appendChild(el); }
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#5a1414;color:#ffe0db;font:12px/1.4 ui-monospace,monospace;padding:8px 14px;text-align:center;border-top:1px solid #ff6b6b';
      el.textContent = '⚠ ' + where + ': ' + ((e && e.message) || e) + '  — please send this to Claude';
    } catch (_) { /* never throw from the reporter */ }
  }

  /* ---- colour & sprite helpers ----------------------------------------- */
  function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function rgba(r, g_, b, a) { return 'rgba(' + (r | 0) + ',' + (g_ | 0) + ',' + (b | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function shade(rgb, f, warm) {
    let [r, gg, b] = rgb;
    r *= f; gg *= f; b *= f;
    if (warm) { r += (255 - r) * warm * 0.45; gg += (200 - gg) * warm * 0.28; b -= b * warm * 0.25; }
    return rgba(r, gg, b);
  }
  // pre-rendered radial glow sprites: drawImage beats createRadialGradient
  function glowSprite(col) {
    const k = col.join(',');
    if (glows[k]) return glows[k];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, rgba(col[0], col[1], col[2], 1)); gr.addColorStop(1, rgba(col[0], col[1], col[2], 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glows[k] = c; return c;
  }
  function drawGlowAt(cx, cy, r, col, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(glowSprite(col), cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /* ---- iso geometry + camera ------------------------------------------- */
  const isoX = (x, y) => (x - y) * (TW / 2);
  const isoY = (x, y) => (x + y) * (TH / 2);
  const screenOf = (x, y) => ({ cx: ox + isoX(x, y), cy: oy + isoY(x, y) });
  function tileOf(mx, my) {
    const a = (mx - ox) / (TW / 2), b = (my - oy) / (TH / 2);
    return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
  }
  function layout() {
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const stage = canvas.parentElement;
    cssW = stage.clientWidth; cssH = stage.clientHeight;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgGrad = ctx.createLinearGradient(0, 0, 0, cssH);
    bgGrad.addColorStop(0, '#15121f'); bgGrad.addColorStop(0.55, '#0c0a14'); bgGrad.addColorStop(1, '#070610');
    bgGlow = ctx.createRadialGradient(cssW / 2, cssH * 0.42, 40, cssW / 2, cssH * 0.42, Math.max(cssW, cssH) * 0.6);
    bgGlow.addColorStop(0, 'rgba(70,56,110,0.18)'); bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
    vigGrad = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.35, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.72);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(1, 'rgba(0,0,0,0.62)');
    alarmGrad = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.22, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.7);
    alarmGrad.addColorStop(0, 'rgba(0,0,0,0)'); alarmGrad.addColorStop(0.6, 'rgba(150,20,20,0.4)'); alarmGrad.addColorStop(1, 'rgba(220,35,35,1)');
  }
  // SNAP when the player can act (clicks never drift); ease only mid-anim.
  function updateCamera() {
    const c = g.activeChar(); const f = rpos[c.id] || c;
    const tx = isoX(f.x, f.y), ty = isoY(f.x, f.y) - 40;
    if (mode === 'anim' && camReady) { camX += (tx - camX) * 0.25; camY += (ty - camY) * 0.25; }
    else { camX = tx; camY = ty; camReady = true; }
    ox = Math.round(cssW / 2 - camX); oy = Math.round(cssH / 2 - camY);
  }

  /* ---- lighting --------------------------------------------------------- */
  function lightSources() {
    const src = [];
    for (const c of g.chars) if (!c.down) src.push({ x: c.x, y: c.y, r: c.lumos ? CONFIG.lumosRadius : CONFIG.lightRadius });
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) { const d = TILES[g.tiles[y][x]]; if (d && d.light) src.push({ x, y, r: d.light }); }
    return src;
  }
  function brightness(x, y, src) {
    let best = 99;
    for (const s of src) { const d = Math.hypot(x - s.x, y - s.y) / (s.r + 0.001); if (d < best) best = d; }
    return Math.max(0, 1 - best);
  }

  /* ---- primitive shapes -------------------------------------------------- */
  function diamond(cx, cy, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - TH / 2); ctx.lineTo(cx + TW / 2, cy);
    ctx.lineTo(cx, cy + TH / 2); ctx.lineTo(cx - TW / 2, cy); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function quad(p, fill) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function block(cx, cy, h, top, b, warm) {
    const lc = [38, 35, 47], rc = [24, 22, 33];      // cool gothic stone
    const L = [cx - TW / 2, cy], B = [cx, cy + TH / 2], R = [cx + TW / 2, cy];
    quad([L, B, [B[0], B[1] - h], [L[0], L[1] - h]], shade(lc, b * 0.9));
    quad([B, R, [R[0], R[1] - h], [B[0], B[1] - h]], shade(rc, b * 0.78));
    diamond(cx, cy - h, shade(top, b, warm * 0.3));
    ctx.strokeStyle = rgba(255, 240, 210, 0.06 + warm * 0.2); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx - TW / 2, cy - h); ctx.lineTo(cx, cy - h - TH / 2); ctx.lineTo(cx + TW / 2, cy - h); ctx.stroke();
  }

  /* ---- STATIC tile drawing (no time-dependence; baked per action) ------- */
  function drawTile(x, y, src) {
    const k = key(x, y);
    if (!g.explored.has(k)) return;
    const lit = g.visible.has(k);
    const d = TILES[g.tiles[y][x]] || TILES['#'];
    const { cx, cy } = screenOf(x, y);
    const b = lit ? 0.5 + 0.5 * brightness(x, y, src) : 0.26;
    const warm = lit ? brightness(x, y, src) : 0;

    if (d.kind === 'chasm') {
      diamond(cx, cy, rgba(4, 4, 9, 1));
      diamond(cx, cy, null, rgba(60, 55, 80, lit ? 0.45 : 0.18));
      return;
    }
    if (d.kind === 'wall' || d.kind === 'secret') {
      block(cx, cy, WALL_H, d.kind === 'secret' ? [62, 58, 66] : [72, 69, 84], b, warm);
      ctx.strokeStyle = rgba(0, 0, 0, 0.18); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - TW / 4, cy - WALL_H - TH / 4); ctx.lineTo(cx + TW / 4, cy - WALL_H + TH / 4); ctx.stroke();
      return;
    }
    if (d.kind === 'rubble') {
      block(cx, cy, WALL_H * 0.42, [96, 82, 64], b, warm);
      ctx.fillStyle = shade([70, 60, 47], b);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx - 12 + i * 9, cy - WALL_H * 0.42 + (i % 2 ? 5 : -3), 7 - i, 0, 7); ctx.fill(); }
      return;
    }
    if (d.kind === 'door') { drawFloor(cx, cy, [52, 47, 42], b, warm, lit, x, y); drawDoor(cx, cy, b, lit); return; }

    let base = d.kind === 'exit' ? [72, 96, 84] : d.kind === 'bridge' ? [46, 34, 26] : [57, 53, 58];
    drawFloor(cx, cy, base, b, warm, lit, x, y);
    if (d.kind === 'bridge') { ctx.strokeStyle = shade([96, 64, 32], b); ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - TW / 4, cy + i * 8); ctx.lineTo(cx + TW / 4, cy + i * 8); ctx.stroke(); } }
    if (d.kind === 'exit') drawExitArch(cx, cy, b, lit);
    if (d.light) {                                   // baked torch pool + flame
      const r = TW * 0.7; const grd = ctx.createRadialGradient(cx, cy - 8, 1, cx, cy - 8, r);
      grd.addColorStop(0, rgba(255, 196, 110, 0.5)); grd.addColorStop(1, rgba(255, 150, 70, 0));
      ctx.fillStyle = grd; ctx.fillRect(cx - r, cy - r - 8, r * 2, r * 2);
      ctx.fillStyle = rgba(255, 220, 150, 0.9); ctx.beginPath(); ctx.ellipse(cx, cy - 10, 3, 6, 0, 0, 7); ctx.fill();
    }
  }
  function drawFloor(cx, cy, base, b, warm, lit, x, y) {
    const noise = ((x * 73 + y * 137) % 11 - 5);
    const top = shade(base.map(v => v + noise + 6), b, warm);
    const bot = shade(base.map(v => v + noise - 8), b, warm * 0.6);
    const g2 = ctx.createLinearGradient(cx, cy - TH / 2, cx, cy + TH / 2); g2.addColorStop(0, top); g2.addColorStop(1, bot);
    diamond(cx, cy, g2);
    diamond(cx, cy, null, rgba(0, 0, 0, lit ? 0.22 : 0.32));
    if (((x * 31 + y * 17) % 7) === 0) { ctx.strokeStyle = rgba(0, 0, 0, lit ? 0.16 : 0.08); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 3); ctx.lineTo(cx + 6, cy + 5); ctx.stroke(); }
  }
  function drawDoor(cx, cy, b, lit) {
    const dh = WALL_H + 18, dw = TW * 0.42;
    const top = cy - dh, archR = dw * 0.9;
    block(cx, cy, WALL_H, [78, 72, 64], b, 0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - dw, cy); ctx.lineTo(cx - dw, top + archR);
    ctx.quadraticCurveTo(cx - dw, top, cx, top); ctx.quadraticCurveTo(cx + dw, top, cx + dw, top + archR);
    ctx.lineTo(cx + dw, cy); ctx.closePath();
    const wg = ctx.createLinearGradient(cx, top, cx, cy); wg.addColorStop(0, shade([96, 62, 30], b)); wg.addColorStop(1, shade([58, 36, 16], b));
    ctx.fillStyle = wg; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = rgba(0, 0, 0, 0.35); ctx.lineWidth = 2;
    for (let px = -dw + 10; px < dw; px += 13) { ctx.beginPath(); ctx.moveTo(cx + px, top); ctx.lineTo(cx + px, cy); ctx.stroke(); }
    ctx.fillStyle = shade([40, 38, 42], b); ctx.fillRect(cx - dw, top + archR + 6, dw * 2, 5); ctx.fillRect(cx - dw, cy - 14, dw * 2, 5);
    ctx.restore();
    ctx.strokeStyle = shade([30, 22, 12], b); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - dw, cy); ctx.lineTo(cx - dw, top + archR); ctx.quadraticCurveTo(cx - dw, top, cx, top); ctx.quadraticCurveTo(cx + dw, top, cx + dw, top + archR); ctx.lineTo(cx + dw, cy); ctx.stroke();
    ctx.fillStyle = rgba(255, 209, 102, lit ? 0.6 : 0.3); ctx.beginPath(); ctx.arc(cx + dw - 12, cy - dh * 0.45, 4, 0, 7); ctx.fill();
    ctx.fillStyle = rgba(20, 14, 8, 1); ctx.fillRect(cx + dw - 13.5, cy - dh * 0.45, 3, 6);
  }

  // the way home: a stone archway filled with warm golden light — unmissable
  function drawExitArch(cx, cy, b, lit) {
    const dw = TW * 0.34, dh = WALL_H + 14, top = cy - dh, archR = dw * 0.9;
    const a = lit ? 1 : 0.55;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - dw, cy); ctx.lineTo(cx - dw, top + archR);
    ctx.quadraticCurveTo(cx - dw, top, cx, top); ctx.quadraticCurveTo(cx + dw, top, cx + dw, top + archR);
    ctx.lineTo(cx + dw, cy); ctx.closePath();
    const ig = ctx.createLinearGradient(cx, top, cx, cy);
    ig.addColorStop(0, rgba(255, 236, 170, 0.16 * a)); ig.addColorStop(0.7, rgba(255, 220, 140, 0.5 * a)); ig.addColorStop(1, rgba(255, 240, 190, 0.85 * a));
    ctx.fillStyle = ig; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = shade([88, 84, 100], b); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx - dw, cy); ctx.lineTo(cx - dw, top + archR); ctx.quadraticCurveTo(cx - dw, top, cx, top); ctx.quadraticCurveTo(cx + dw, top, cx + dw, top + archR); ctx.lineTo(cx + dw, cy); ctx.stroke();
    // light spilling onto the floor
    const fg = ctx.createRadialGradient(cx, cy + 4, 2, cx, cy + 4, TW * 0.6);
    fg.addColorStop(0, rgba(255, 230, 160, 0.4 * a)); fg.addColorStop(1, rgba(255, 230, 160, 0));
    ctx.fillStyle = fg; ctx.fillRect(cx - TW * 0.6, cy - 18, TW * 1.2, TW * 0.8);
    // steps rising into the glow
    ctx.fillStyle = rgba(30, 26, 20, 0.55 * a);
    ctx.fillRect(cx - dw * 0.6, cy - 8, dw * 1.2, 3.5);
    ctx.fillRect(cx - dw * 0.45, cy - 15, dw * 0.9, 3.5);
  }

  /* ---- set dressing (static; this is what makes it Hogwarts) ------------- */
  function drawProp(p, b) {
    const { cx, cy } = screenOf(p.x, p.y);
    const back = cy - TH / 4;                          // props hug the back of their tile
    if (p.type === 'barrel') {
      ctx.fillStyle = shade([96, 66, 36], b); ctx.fillRect(cx - 8, back - 18, 16, 18);
      ctx.fillStyle = shade([116, 82, 46], b); ctx.beginPath(); ctx.ellipse(cx, back - 18, 8, 3.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = shade([60, 44, 26], b); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 8, back - 6); ctx.lineTo(cx + 8, back - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 8, back - 13); ctx.lineTo(cx + 8, back - 13); ctx.stroke();
    } else if (p.type === 'cauldron') {
      ctx.fillStyle = shade([34, 36, 42], b); ctx.beginPath(); ctx.ellipse(cx, back - 8, 11, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = rgba(120, 230, 140, 0.85); ctx.beginPath(); ctx.ellipse(cx, back - 14, 8, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = shade([26, 28, 33], b); ctx.fillRect(cx - 12, back - 4, 4, 5); ctx.fillRect(cx + 8, back - 4, 4, 5);
    } else if (p.type === 'bottles') {
      ctx.fillStyle = shade([70, 52, 34], b); ctx.fillRect(cx - 14, back - 12, 28, 3);   // shelf
      const cols = [[150, 220, 170], [180, 140, 220], [220, 170, 130], [140, 180, 230]];
      for (let i = 0; i < 4; i++) { const c2 = cols[i]; ctx.fillStyle = rgba(c2[0], c2[1], c2[2], 0.9); ctx.fillRect(cx - 12 + i * 7, back - 12 - 7 - (i % 2) * 3, 4, 7 + (i % 2) * 3); }
    } else if (p.type === 'books') {
      const cols = [[140, 60, 50], [60, 80, 130], [120, 100, 50], [70, 100, 70]];
      for (let i = 0; i < 4; i++) { const c2 = cols[i]; ctx.fillStyle = shade(c2, b); ctx.fillRect(cx - 10 + (i % 2) * 2, back - 5 - i * 4.5, 18 - (i % 2) * 4, 4); }
    } else if (p.type === 'armor') {
      ctx.fillStyle = shade([150, 155, 170], b);
      ctx.beginPath(); ctx.arc(cx, back - 26, 5, 0, 7); ctx.fill();                       // helm
      ctx.beginPath(); ctx.moveTo(cx - 7, back - 20); ctx.lineTo(cx + 7, back - 20); ctx.lineTo(cx + 5, back - 2); ctx.lineTo(cx - 5, back - 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade([90, 95, 110], b); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + 9, back - 28); ctx.lineTo(cx + 9, back - 4); ctx.stroke();   // halberd
      ctx.fillStyle = shade([90, 95, 110], b); ctx.beginPath(); ctx.moveTo(cx + 9, back - 34); ctx.lineTo(cx + 13, back - 28); ctx.lineTo(cx + 5, back - 28); ctx.closePath(); ctx.fill();
    } else if (p.type === 'web') {
      ctx.strokeStyle = rgba(210, 215, 230, 0.28); ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - TW / 2 + 4, cy - TH / 2 - WALL_H * 0.2 + i * 3); ctx.lineTo(cx - TW / 2 + 16 + i * 5, cy - TH / 2 + 10); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx - TW / 2 + 12, cy - TH / 2 + 2, 4, 0, 7); ctx.stroke();
    } else if (p.type === 'candles') {
      for (let i = 0; i < 3; i++) {                     // floating candles — pure Hogwarts
        const fx = cx - 12 + i * 12, fy = back - 34 - (i % 2) * 9;
        ctx.fillStyle = rgba(235, 228, 205, 0.95); ctx.fillRect(fx - 1.5, fy, 3, 9);
        ctx.fillStyle = rgba(255, 220, 140, 1); ctx.beginPath(); ctx.ellipse(fx, fy - 2.5, 1.6, 3, 0, 0, 7); ctx.fill();
      }
    } else if (p.type === 'banner') {
      const hs = Object.keys(HOUSES); const h = HOUSES[hs[(p.h || 0) % hs.length]];
      const bw = 14, bt = cy - WALL_H - 6;
      ctx.fillStyle = h.color; ctx.beginPath();
      ctx.moveTo(cx - bw / 2, bt); ctx.lineTo(cx + bw / 2, bt); ctx.lineTo(cx + bw / 2, bt + 26); ctx.lineTo(cx, bt + 32); ctx.lineTo(cx - bw / 2, bt + 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = h.trim; ctx.fillRect(cx - bw / 2, bt, bw, 3);
    } else if (p.type === 'moonbeam') {
      ctx.fillStyle = rgba(180, 205, 255, 0.06);
      ctx.beginPath(); ctx.moveTo(cx - 70, cy - 230); ctx.lineTo(cx - 20, cy - 230); ctx.lineTo(cx + 28, cy + 4); ctx.lineTo(cx - 30, cy + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(190, 215, 255, 0.07); ctx.beginPath(); ctx.ellipse(cx, cy + 2, 30, 12, 0, 0, 7); ctx.fill();
    }
  }

  /* ---- the static layer -------------------------------------------------- */
  function ensureWorld() {
    const wCss = (g.W + g.H) * (TW / 2) + PAD * 2, hCss = (g.W + g.H) * (TH / 2) + PAD * 2;
    if (world && worldCssW === wCss && worldCssH === hCss) return;
    world = document.createElement('canvas');
    worldCssW = wCss; worldCssH = hCss;
    worldScale = Math.max(1, Math.min(root.devicePixelRatio || 1, 2, Math.sqrt(9e6 / (wCss * hCss))));
    world.width = Math.round(wCss * worldScale); world.height = Math.round(hCss * worldScale);
    wctx = world.getContext('2d');
    worldOX = (g.H - 1) * (TW / 2) + PAD; worldOY = PAD;
  }
  function renderStatics() {
    ensureWorld();
    wctx.setTransform(worldScale, 0, 0, worldScale, 0, 0);
    wctx.clearRect(0, 0, worldCssW, worldCssH);
    const saveC = ctx, saveX = ox, saveY = oy;
    ctx = wctx; ox = worldOX; oy = worldOY;          // tile fns draw into the layer
    const src = lightSources();
    for (let s = 0; s <= g.W + g.H; s++) for (let y = 0; y < g.H; y++) { const x = s - y; if (x >= 0 && x < g.W) drawTile(x, y, src); }
    // set dressing on top of the tiles (depth order; only what's been seen)
    const vp = (g.scenario.props || []).filter(p => g.explored.has(key(p.x, p.y))).sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const p of vp) drawProp(p, g.visible.has(key(p.x, p.y)) ? 0.95 : 0.55);
    ctx = saveC; ox = saveX; oy = saveY;
    /* per-action caches */
    cachedReach = (g.status === 'play' && mode !== 'over') ? g.reachable(g.activeChar()) : new Map();
    cachedMarkers = computeMarkers();
    cachedTorches = [];
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) { const d = TILES[g.tiles[y][x]]; if (d && d.light && g.visible.has(key(x, y))) cachedTorches.push({ x, y }); }
    cachedAuras = [];
    for (const p of vp) {
      if (p.type === 'candles') cachedAuras.push({ x: p.x, y: p.y, dy: -40, r: 22, col: [255, 220, 150], a: 0.3 });
      if (p.type === 'cauldron') cachedAuras.push({ x: p.x, y: p.y, dy: -14, r: 20, col: [130, 240, 150], a: 0.3 });
    }
    // the Marauder's Map: once you hold the Cup, a golden trail traces the way home
    cachedTrail = null;
    if (g.alarm && g.item.held && exitPos) {
      const carrier = g.chars.find(c => c.id === g.item.carrier);
      if (carrier) cachedTrail = trailPath(carrier, exitPos);
    }
    drawMinimap();
    staticsDirty = false;
  }
  // walk-only BFS for the map trail (it shows the way, not the danger)
  function trailPath(from, to) {
    const seen = new Set([key(from.x, from.y)]);
    let fr = [{ x: from.x, y: from.y, path: [] }];
    while (fr.length) {
      const nf = [];
      for (const n of fr) {
        for (const [dx, dy] of DIRS) {
          const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
          if (seen.has(k) || !g.isWalk(nx, ny)) continue;
          const p = n.path.concat([{ x: nx, y: ny }]);
          if (nx === to.x && ny === to.y) return p;
          seen.add(k); nf.push({ x: nx, y: ny, path: p });
        }
      }
      fr = nf;
    }
    return null;
  }
  function computeMarkers() {
    const c = g.activeChar(); const out = [];
    if (!c || g.status !== 'play') return out;
    const tsets = {};
    for (const s of (c.spells || [])) if (SPELLS[s].transforms) tsets[s] = new Set(g.spellTargets(c, s).map(t => key(t.x, t.y)));
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      const k = key(x, y); if (!g.visible.has(k)) continue;
      const kind = g.def(x, y).kind; const spell = OPENER[kind]; if (!spell) continue;
      if (kind === 'secret') {       // secrets stay a discovery: shimmer only when a revealer is near
        const near = g.chars.some(o => !o.down && g.knows(o, 'revelio') && Math.abs(o.x - x) + Math.abs(o.y - y) <= 2);
        if (!near) continue;
      }
      out.push({ x, y, glyph: SPELLS[spell].glyph, col: hex(SPELLS[spell].color), canNow: !!(tsets[spell] && tsets[spell].has(k)), raised: kind === 'rubble' ? WALL_H * 0.42 : (kind === 'bridge' ? 0 : WALL_H) });
    }
    return out;
  }

  /* ---- minimap (exploration at a glance; secrets stay hidden) ----------- */
  function drawMinimap() {
    const mm = document.getElementById('minimap'); if (!mm || !g) return;
    const s = 4;
    if (mm.width !== g.W * s) { mm.width = g.W * s; mm.height = g.H * s; }
    const m = mm.getContext('2d');
    m.fillStyle = '#070610'; m.fillRect(0, 0, mm.width, mm.height);
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      const k = key(x, y); if (!g.explored.has(k)) continue;
      const kind = g.def(x, y).kind;
      let col = '#3a3344';
      if (kind === 'wall' || kind === 'secret') col = '#221d2d';
      else if (kind === 'exit') col = '#2f8a63';
      else if (kind === 'door') col = '#8a6526';
      else if (kind === 'rubble') col = '#6e5230';
      else if (g.visible.has(k)) col = '#544a66';
      m.fillStyle = col; m.fillRect(x * s, y * s, s, s);
    }
    // home is ALWAYS marked — you know the way you came in
    if (exitPos) { m.fillStyle = '#42c98a'; m.fillRect(exitPos.x * s - 1, exitPos.y * s - 1, s + 2, s + 2); m.strokeStyle = '#bdf3da'; m.lineWidth = 1; m.strokeRect(exitPos.x * s - 1.5, exitPos.y * s - 1.5, s + 3, s + 3); }
    for (const L of g.loot) if (!L.taken && g.explored.has(key(L.x, L.y))) { m.fillStyle = '#e8c15a'; m.fillRect(L.x * s + 1, L.y * s + 1, s - 2, s - 2); }
    if (g.item && !g.item.held && g.explored.has(key(g.item.x, g.item.y))) { m.fillStyle = '#ffd84d'; m.fillRect(g.item.x * s - 1, g.item.y * s - 1, s + 2, s + 2); }
    for (const p of g.patrols) if (g.visible.has(key(p.x, p.y))) { m.fillStyle = p.alerted ? '#ff5b5b' : '#d98a4a'; m.fillRect(p.x * s, p.y * s, s, s); }
    for (const c of g.chars) if (!c.down) { m.fillStyle = HOUSES[c.house].color; m.fillRect(c.x * s, c.y * s, s, s); }
  }

  /* ---- dynamic drawing (cheap, per frame) -------------------------------- */
  function drawDanger() {
    if (!g.patrolVision) return;
    for (const pv of g.patrolVision) {
      if (pv.dormant) continue;
      const col = pv.alerted ? [255, 70, 60] : [255, 150, 70];
      const base = pv.alerted ? 0.22 : 0.12;
      for (const k of pv.tiles) {
        if (!g.explored.has(k)) continue;
        const [x, y] = k.split(',').map(Number); const { cx, cy } = screenOf(x, y);
        diamond(cx, cy, rgba(col[0], col[1], col[2], base + (pv.alerted ? 0.07 * Math.sin(t0 / 150) : 0)));
        diamond(cx, cy, null, rgba(col[0], col[1], col[2], 0.18));
      }
    }
  }
  function drawHighlights() {
    if (mode === 'anim' || mode === 'over') return;
    const c = g.activeChar();
    if (mode === 'idle') {
      for (const [k] of cachedReach) { const [x, y] = k.split(',').map(Number); const { cx, cy } = screenOf(x, y); diamond(cx, cy, rgba(120, 200, 255, 0.13)); diamond(cx, cy, null, rgba(150, 220, 255, 0.3)); }
      if (hover) { const path = cachedReach.get(key(hover.x, hover.y)); if (path) for (const p of path) { const { cx, cy } = screenOf(p.x, p.y); ctx.fillStyle = rgba(170, 230, 255, .8); ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill(); } }
    } else if (mode === 'target') {
      const pulse = 0.25 + 0.2 * Math.sin(t0 / 180);
      const col = hex(SPELLS[selSpell].color);
      for (const t of g.spellTargets(c, selSpell)) { const { cx, cy } = screenOf(t.x, t.y); diamond(cx, cy, rgba(col[0], col[1], col[2], pulse)); diamond(cx, cy, null, rgba(col[0], col[1], col[2], .8)); }
    } else if (mode === 'fling') {
      const pulse = 0.25 + 0.2 * Math.sin(t0 / 180);
      for (const t of g.flingTargets(c, flingAlly)) { const { cx, cy } = screenOf(t.x, t.y); diamond(cx, cy, rgba(138, 211, 255, pulse)); diamond(cx, cy, null, rgba(138, 211, 255, .9)); }
    }
  }
  function drawMarkers() {
    if (mode === 'over') return;
    const bob = 4 * Math.abs(Math.sin(t0 / 320));
    for (const mk of cachedMarkers) {
      const { cx, cy } = screenOf(mk.x, mk.y); const yo = -mk.raised;
      diamond(cx, cy + yo, mk.canNow ? rgba(mk.col[0], mk.col[1], mk.col[2], 0.18 + 0.12 * Math.sin(t0 / 160)) : null, rgba(mk.col[0], mk.col[1], mk.col[2], mk.canNow ? 0.95 : 0.45));
      ctx.fillStyle = rgba(mk.col[0], mk.col[1], mk.col[2], mk.canNow ? 0.95 : 0.6);
      ctx.font = (mk.canNow ? 'bold 15px' : '12px') + ' serif'; ctx.textAlign = 'center';
      ctx.fillText(mk.glyph, cx, cy + yo - 16 - (mk.canNow ? bob : 0));
    }
  }
  function drawAmbience() {
    for (const t of cachedTorches) {                 // live flicker over baked pools
      const { cx, cy } = screenOf(t.x, t.y);
      drawGlowAt(cx, cy - 8, TW * 0.55, [255, 200, 120], 0.16 + 0.1 * Math.sin(t0 / 95 + t.x * 1.7));
    }
    for (const a of cachedAuras) {                   // candle / cauldron halos
      const { cx, cy } = screenOf(a.x, a.y);
      drawGlowAt(cx, cy + a.dy, a.r, a.col, a.a + 0.12 * Math.sin(t0 / 260 + a.x * 2.1));
    }
    if (exitPos && g.explored.has(key(exitPos.x, exitPos.y))) {
      const { cx, cy } = screenOf(exitPos.x, exitPos.y);
      drawGlowAt(cx, cy - 30, 56, [255, 226, 150], 0.22 + 0.1 * Math.sin(t0 / 350));
      nameTag(cx, cy - WALL_H - 44, 'Way Out', '#ffe2a0');
    }
  }
  // the Marauder's Map trail — golden footstep-dots tracing the way home
  function drawTrail() {
    if (!cachedTrail) return;
    for (let i = 0; i < cachedTrail.length - 1; i += 2) {
      const p = cachedTrail[i];
      const { cx, cy } = screenOf(p.x, p.y);
      const a = 0.35 + 0.3 * Math.sin(t0 / 200 - i * 0.55);
      drawGlowAt(cx, cy, 11, [255, 215, 120], Math.max(0.1, a));
      ctx.fillStyle = rgba(255, 235, 170, Math.max(0.25, a));
      ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 5, cy); ctx.closePath(); ctx.fill();
    }
  }
  // a house ghost drifts through the halls (and the walls) — pure atmosphere
  function drawGhost() {
    if (!ghost) ghost = { name: ['The Grey Lady', 'Nearly Headless Nick', 'The Fat Friar'][Math.floor(Math.random() * 3)], seen: false };
    const gx = g.W / 2 + Math.sin(t0 / 13000 + 2.1) * g.W * 0.38;
    const gy = g.H / 2 + Math.cos(t0 / 9100) * g.H * 0.33;
    if (!g.explored.has(key(Math.round(gx), Math.round(gy)))) return;
    const { cx, cy } = screenOf(gx, gy);
    const bob = Math.sin(t0 / 700) * 4;
    if (!ghost.seen) {
      ghost.seen = true;
      const box = document.getElementById('toasts');
      if (box) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = ghost.name + ' drifts past…'; box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 2800); }
    }
    ctx.globalAlpha = 0.3 + 0.08 * Math.sin(t0 / 900);
    drawGlowAt(cx, cy - 22 + bob, 34, [190, 215, 255], 0.5);
    ctx.fillStyle = 'rgba(205,222,250,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 38 + bob);
    ctx.quadraticCurveTo(cx + 12, cy - 26 + bob, cx + 10, cy - 6 + bob);
    ctx.quadraticCurveTo(cx + 5, cy - 12 + bob, cx, cy - 4 + bob);
    ctx.quadraticCurveTo(cx - 5, cy - 12 + bob, cx - 10, cy - 6 + bob);
    ctx.quadraticCurveTo(cx - 12, cy - 26 + bob, cx, cy - 38 + bob);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,70,110,0.8)';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 28 + bob, 1.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 3, cy - 28 + bob, 1.5, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function nameTag(cx, cy, text, color) {
    ctx.font = '600 12px ui-sans-serif,system-ui'; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = rgba(10, 8, 16, 0.75); roundRect(cx - w / 2, cy, w, 16, 8); ctx.fill();
    ctx.fillStyle = color || '#ece3cf'; ctx.fillText(text, cx, cy + 11.5);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawWizard(cx, cy, h, name, active, hasCup) {
    cy += Math.sin(t0 / 500 + cx) * 2;
    ctx.fillStyle = rgba(0, 0, 0, 0.4); ctx.beginPath(); ctx.ellipse(cx, cy + 16, 16, 7, 0, 0, 7); ctx.fill();
    if (active) {
      const ar = 26 + Math.sin(t0 / 240) * 2;
      ctx.strokeStyle = rgba(255, 226, 150, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 16, ar, ar * 0.45, 0, 0, 7); ctx.stroke();
      drawGlowAt(cx, cy, 40, [255, 226, 150], 0.3);
    }
    const dark = h.color.replace('#', ''); const dc = [parseInt(dark.slice(0, 2), 16) * 0.5, parseInt(dark.slice(2, 4), 16) * 0.5, parseInt(dark.slice(4, 6), 16) * 0.5];
    const rg = ctx.createLinearGradient(cx, cy - 22, cx, cy + 16); rg.addColorStop(0, h.color); rg.addColorStop(1, rgba(dc[0], dc[1], dc[2]));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 24);
    ctx.quadraticCurveTo(cx + 16, cy - 6, cx + 15, cy + 15);
    ctx.quadraticCurveTo(cx, cy + 19, cx - 15, cy + 15);
    ctx.quadraticCurveTo(cx - 16, cy - 6, cx, cy - 24);
    ctx.fill();
    ctx.fillStyle = h.trim; ctx.fillRect(cx - 14, cy + 12, 28, 3);
    ctx.fillStyle = h.color; ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.quadraticCurveTo(cx + 11, cy - 18, cx + 8, cy - 10); ctx.lineTo(cx - 8, cy - 10); ctx.quadraticCurveTo(cx - 11, cy - 18, cx, cy - 30); ctx.fill();
    ctx.fillStyle = 'rgba(15,12,20,0.92)'; ctx.beginPath(); ctx.ellipse(cx, cy - 14, 6, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8cda0'; ctx.beginPath(); ctx.arc(cx, cy - 13, 3.2, 0, 7); ctx.fill();
    const wx = cx + 13, wy = cy + 2, tx2 = cx + 22, ty2 = cy - 10;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx2, ty2); ctx.stroke();
    drawGlowAt(tx2, ty2, 12, [255, 245, 210], 0.9);
    if (hasCup) { ctx.font = '15px serif'; ctx.textAlign = 'center'; ctx.fillText('🏆', cx - 16, cy - 8); }
    nameTag(cx, cy - 48, name, active ? h.trim : '#cfc6df');
  }
  function drawCat(cx, cy, name, alerted) {
    cy += Math.sin(t0 / 380) * 1.2;
    ctx.fillStyle = rgba(0, 0, 0, 0.45); ctx.beginPath(); ctx.ellipse(cx, cy + 12, 17, 6, 0, 0, 7); ctx.fill();
    const eye = alerted ? [255, 70, 60] : [180, 230, 120];
    drawGlowAt(cx, cy - 2, alerted ? 46 : 30, eye, alerted ? 0.4 : 0.22);
    ctx.fillStyle = '#2a2630';
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, 16, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 9, cy - 6, 7, 7, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 14, cy - 11); ctx.lineTo(cx - 12, cy - 18); ctx.lineTo(cx - 8, cy - 12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 6, cy - 12); ctx.lineTo(cx - 4, cy - 18); ctx.lineTo(cx - 2, cy - 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a2630'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 14, cy + 2); ctx.quadraticCurveTo(cx + 26, cy + 2, cx + 22, cy - 12); ctx.stroke();
    const blink = (Math.sin(t0 / 130) > -0.9) ? 1 : 0.2;
    ctx.fillStyle = rgba(eye[0], eye[1], eye[2], blink);
    ctx.beginPath(); ctx.arc(cx - 11, cy - 6, 1.9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx - 6, cy - 6, 1.9, 0, 7); ctx.fill();
    if (alerted) { ctx.fillStyle = '#ff5b5b'; ctx.font = 'bold 16px serif'; ctx.textAlign = 'center'; ctx.fillText('!', cx, cy - 26); }
    nameTag(cx, cy - 40, name, alerted ? '#ffb3aa' : '#bdb6c8');
  }

  function drawEntities() {
    const items = [];
    for (const L of g.loot) if (!L.taken && g.explored.has(key(L.x, L.y))) items.push({ x: L.x, y: L.y, kind: 'loot', e: L });
    if (g.item && !g.item.held && g.explored.has(key(g.item.x, g.item.y))) items.push({ x: g.item.x, y: g.item.y, kind: 'item' });
    for (const p of g.patrols) if (g.visible.has(key(p.x, p.y))) items.push({ x: p.x, y: p.y, kind: 'patrol', e: p });
    for (const c of g.chars) { if (c.down) continue; const r = rpos[c.id] || c; items.push({ x: r.x, y: r.y, kind: 'char', e: c, depth: c.x + c.y }); }
    items.sort((a, b) => (a.depth != null ? a.depth : a.x + a.y) - (b.depth != null ? b.depth : b.x + b.y));

    for (const it of items) {
      const { cx, cy } = screenOf(it.x, it.y);
      if (it.kind === 'loot') {
        drawGlowAt(cx, cy - 4, 16, [255, 226, 140], 0.3 + 0.2 * Math.sin(t0 / 300 + it.x));
        ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText(it.e.glyph, cx, cy + 2);
      } else if (it.kind === 'item') {
        const float = Math.sin(t0 / 400) * 3;
        drawGlowAt(cx, cy - 6 + float, 34, [255, 226, 140], 0.5 + 0.3 * Math.sin(t0 / 240));
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.fillText(g.item.glyph, cx, cy + 4 + float);
      } else if (it.kind === 'patrol') drawCat(cx, cy, it.e.name, it.e.alerted);
      else { const h = HOUSES[it.e.house]; const active = (it.e === g.activeChar() && mode !== 'over'); drawWizard(cx, cy, h, it.e.name, active, !!(g.item && g.item.held && g.item.carrier === it.e.id)); }
    }
  }

  /* ---- frame loop --------------------------------------------------------- */
  function stepAnim() {
    if (!anim) return;
    anim.t += 16 / anim.dur;
    const seg = Math.min(anim.pts.length - 1, Math.floor(anim.t));
    const f = anim.t - seg;
    const a = anim.pts[seg], bb = anim.pts[Math.min(seg + 1, anim.pts.length - 1)];
    rpos[anim.id] = { x: a.x + (bb.x - a.x) * f, y: a.y + (bb.y - a.y) * f };
    if (anim.t >= anim.pts.length - 1) finishAnim();
  }
  function finishAnim() {
    if (!anim) return;
    rpos[anim.id] = anim.pts[anim.pts.length - 1];
    anim = null; mode = 'idle';
    try { afterAction(); } catch (e) { showError('after-move', e); }
  }

  let workMs = 0;                        // actual render cost per frame (EMA)
  function draw(ts) {
    raf = requestAnimationFrame(draw);   // re-arm FIRST: a bad frame can never freeze the game
    t0 = ts || 0;
    if (lastTs) fpsMs = fpsMs * 0.9 + Math.min(100, ts - lastTs) * 0.1;
    lastTs = ts;
    const w0 = performance.now();
    stepAnim();                          // resolve movement OUTSIDE the render try/catch
    try {
      if (staticsDirty) renderStatics();
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = bgGlow; ctx.fillRect(0, 0, cssW, cssH);
      for (const m of motes) {
        m.y -= m.s; m.x += Math.sin((t0 / 1000) + m.p) * 0.2;
        if (m.y < -5) { m.y = cssH + 5; m.x = Math.random() * cssW; }
        ctx.fillStyle = rgba(255, 210, 150, m.a * (0.5 + 0.5 * Math.sin(t0 / 600 + m.p)));
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
      }
      updateCamera();
      ctx.drawImage(world, 0, 0, world.width, world.height, ox - worldOX, oy - worldOY, worldCssW, worldCssH);
      drawDanger();
      drawTrail();
      drawHighlights();
      drawMarkers();
      drawAmbience();
      drawEntities();
      drawGhost();
      effects = effects.filter(e => e.t < e.life);
      for (const e of effects) {
        e.t += 16; const p = Math.min(1, e.t / e.life);
        const { cx, cy } = screenOf(e.x, e.y); const col = hex(e.color);
        ctx.strokeStyle = rgba(col[0], col[1], col[2], 1 - p); ctx.lineWidth = Math.max(0, 3 * (1 - p));
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, 6 + p * 26), 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i / 6 * 7 + p * 3; ctx.fillStyle = rgba(col[0], col[1], col[2], 1 - p); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * p * 24, cy + Math.sin(a) * p * 14, Math.max(0, 2 * (1 - p)), 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, cssW, cssH);
      if (g.alarm) { ctx.globalAlpha = 0.22 + 0.16 * Math.abs(Math.sin(t0 / 240)); ctx.fillStyle = alarmGrad; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
    } catch (e) { showError('render', e); }
    workMs = workMs * 0.9 + (performance.now() - w0) * 0.1;
  }

  /* ---- input: mouse ------------------------------------------------------- */
  function onMove(ev) {
    if (mode === 'anim' || mode === 'over') return;
    const r = canvas.getBoundingClientRect();
    hover = tileOf(ev.clientX - r.left, ev.clientY - r.top);
  }
  function onClick(ev) { try { onClickInner(ev); } catch (e) { showError('click', e); } }
  function onClickInner(ev) {
    if (mode === 'over') return;
    if (mode === 'anim') finishAnim();               // impatient clicks just fast-forward
    const r = canvas.getBoundingClientRect();
    const t = tileOf(ev.clientX - r.left, ev.clientY - r.top);
    const c = g.activeChar();

    if (mode === 'idle') {
      let path = cachedReach.get(key(t.x, t.y));
      if (!path && c.moves > 0) {                    // click ANYWHERE explored → travel toward it
        let full = routeExplored(c, t.x, t.y);
        if (full) {
          full = full.slice(0, c.moves);
          while (full.length && g.charAt(full[full.length - 1].x, full[full.length - 1].y)) full.pop();   // can't stop on a teammate
          path = full;
        }
      }
      if (path && path.length) startMove(c, path);
    } else if (mode === 'target') {
      const tgt = g.spellTargets(c, selSpell).find(s => s.x === t.x && s.y === t.y);
      if (!tgt) { setMode('idle'); return; }
      if (SPELLS[selSpell].target === 'ally') { flingAlly = g.chars.find(o => o.x === tgt.x && o.y === tgt.y); setMode('fling'); }
      else castAt(c, selSpell, tgt.x, tgt.y);
    } else if (mode === 'fling') {
      const land = g.flingTargets(c, flingAlly).find(s => s.x === t.x && s.y === t.y);
      if (!land) { setMode('idle'); return; }
      g.cast(c, 'wingardium', flingAlly.x, flingAlly.y, { to: land });
      effects.push({ x: land.x, y: land.y, color: SPELLS.wingardium.color, t: 0, life: 450 });
      rpos[flingAlly.id] = { x: land.x, y: land.y };
      setMode('idle'); afterAction();
    }
  }
  // BFS toward any explored tile — lets a click travel across the map.
  // Teammates are pass-through (matching the engine); patrols block.
  // Prefers a route through tiles you've SEEN; if the only way runs through
  // the dark, walk into the dark — discovering the way IS the exploring.
  function routeExplored(c, tx, ty) {
    if (!g.explored.has(key(tx, ty)) || !g.isWalk(tx, ty) || g.patrolAt(tx, ty)) return null;
    const bfs = (exploredOnly) => {
      const seen = new Set([key(c.x, c.y)]);
      let fr = [{ x: c.x, y: c.y, path: [] }];
      while (fr.length) {
        const nf = [];
        for (const n of fr) {
          for (const [dx, dy] of DIRS) {
            const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
            if (seen.has(k) || !g.isWalk(nx, ny) || g.patrolAt(nx, ny)) continue;
            if (exploredOnly && !g.explored.has(k)) continue;
            const p = n.path.concat([{ x: nx, y: ny }]);
            if (nx === tx && ny === ty) return p;
            seen.add(k); nf.push({ x: nx, y: ny, path: p });
          }
        }
        fr = nf;
      }
      return null;
    };
    return bfs(true) || bfs(false);
  }

  /* ---- input: keyboard ------------------------------------------------------ */
  const KEYDIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  function onKey(ev) {
    try {
      if (!g || mode === 'over') return;
      const ovl = document.getElementById('overlay');
      if (ovl && ovl.className === 'ov') return;     // an overlay is up — let its button handle input
      const k = ev.key;
      if (k === 'Escape') { if (mode === 'target' || mode === 'fling') setMode('idle'); return; }
      if (k === ' ' || k === 'Enter') { ev.preventDefault(); if (mode === 'anim') finishAnim(); if (mode === 'idle') doEndTurn(); return; }
      if (KEYDIRS[k]) {
        ev.preventDefault();
        if (mode === 'anim') finishAnim();
        if (mode !== 'idle') return;
        const c = g.activeChar();
        if (c.moves <= 0) return;
        const [dx, dy] = KEYDIRS[k];
        if (g.blocked(c.x + dx, c.y + dy)) return;
        startMove(c, [{ x: c.x + dx, y: c.y + dy }]);
        return;
      }
      const num = parseInt(k, 10);
      if (num >= 1 && num <= 9) { const b = document.querySelectorAll('.spell')[num - 1]; if (b && !b.disabled) { if (mode === 'anim') finishAnim(); b.click(); } }
    } catch (e) { showError('key', e); }
  }

  /* ---- actions ---------------------------------------------------------------- */
  function startMove(c, path) {
    const from = { x: c.x, y: c.y };
    mode = 'anim';
    g.moveTo(c, path[path.length - 1].x, path[path.length - 1].y);
    anim = { id: c.id, pts: [from].concat(path.map(p => ({ x: p.x, y: p.y }))), t: 0, dur: path.length > 5 ? 45 : 75 };
    staticsDirty = true;                              // fog may have grown mid-glide
    renderHUD();
  }
  function setMode(m) { mode = m; if (m === 'idle') { selSpell = null; flingAlly = null; } renderHUD(); }
  function castAt(c, spell, x, y) {
    if (g.cast(c, spell, x, y)) { effects.push({ x, y, color: SPELLS[spell].color, t: 0, life: 450 }); setMode('idle'); afterAction(); }
    else setMode('idle');
  }
  function afterAction() {
    staticsDirty = true;
    renderHUD();
    flushToasts();
    if (g.status !== 'play') return showOver();
  }

  /* ---- turn / hot-seat flow ---------------------------------------------------- */
  function doEndTurn() {
    g.endTurn();
    staticsDirty = true;
    flushToasts();
    if (g.status !== 'play') return showOver();
    const seat = seats[g.activeIdx];
    if (players > 1 && seat !== lastSeat) showHandoff(seat);
    else { lastSeat = seat; setMode('idle'); }
  }
  function showHandoff(seat) {
    mode = 'idle';
    const c = g.activeChar(); const h = HOUSES[c.house];
    const ov = document.getElementById('overlay');
    ov.className = 'ov';
    ov.innerHTML = '<div class="handoff"><div class="crest" style="color:' + h.trim + '">' + h.crest + '</div>' +
      '<h2>Pass the wand</h2><p>Player ' + (seat + 1) + ' — you control <b style="color:' + h.color + '">' + c.name + '</b> of ' + c.house + '.</p>' +
      '<button id="hgo">I\'m ready</button></div>';
    document.getElementById('hgo').onclick = () => { ov.className = 'hidden'; lastSeat = seat; setMode('idle'); };
  }
  function showOver() {
    mode = 'over';
    const won = g.status === 'won';
    const ov = document.getElementById('overlay');
    ov.className = 'ov';
    const found = g.treasures + ' of ' + g.loot.length + ' treasures';
    ov.innerHTML = '<div class="handoff ' + (won ? 'win' : 'lose') + '">' +
      '<div class="crest">' + (won ? '🏆' : '🕯️') + '</div>' +
      '<h2>' + (won ? 'Quest Complete' : 'Caught!') + '</h2>' +
      '<p>' + (won
        ? 'You slip back into the light with ' + g.item.name + ' — ' + g.housePoints + ' House Point' + (g.housePoints === 1 ? '' : 's') + ' to spare, and ' + found + ' found.'
        : 'The caretaker caught you one too many times. You got away with ' + found + '… the Cup keeps waiting.') + '</p>' +
      '<p class="again-note">The dungeons will rearrange themselves for the next run.</p>' +
      '<button id="again">Brave a new dungeon ▸</button></div>';
    document.getElementById('again').onclick = () => root.MAR.main.newGame(players);
  }

  /* ---- HUD --------------------------------------------------------------------- */
  function spellBtns(c) {
    return (c.spells || []).map((id, i) => {
      const s = SPELLS[id];
      const hasTarget = g.spellTargets(c, id).length > 0;
      const usable = !c.acted && (id === 'lumos' || hasTarget);
      const ready = usable && id !== 'lumos' && hasTarget && selSpell !== id;
      const on = (selSpell === id);
      return '<button class="spell' + (on ? ' on' : '') + (ready ? ' ready' : '') + '" data-spell="' + id + '"' + (usable ? '' : ' disabled') +
        ' title="' + s.desc + '"><span class="kbd">' + (i + 1) + '</span><span class="g" style="color:' + s.color + '">' + s.glyph + '</span>' + s.name + '</button>';
    }).join('');
  }
  function renderHUD() {
    const c = g.activeChar(); const h = HOUSES[c.house];
    const stars = '★'.repeat(g.housePoints) + '☆'.repeat(Math.max(0, CONFIG.startHousePoints - g.housePoints));
    document.getElementById('topbar').innerHTML =
      '<div class="quest"><b>' + g.scenario.title + '</b><span>' + g.scenario.objective + '</span></div>' +
      '<div class="loot" title="Treasures found">✨ ' + g.treasures + '/' + g.loot.length + '</div>' +
      '<div class="hp" title="House Points — lose them all and you\'re caught for good">' + stars + '</div>' +
      '<div class="turn">Round ' + g.turn + '</div>';
    const spent = c.moves === 0 && c.acted;
    const room = g.roomAt ? g.roomAt(c.x, c.y) : null;
    const where = room ? room.name : 'the corridors';
    document.getElementById('botbar').innerHTML =
      '<div class="who" style="border-color:' + h.color + '"><span class="crest">' + h.crest + '</span>' +
      '<div><b style="color:' + h.color + '">' + c.name + '</b><i>' + where + ' · ' + c.moves + ' moves left</i></div></div>' +
      '<div class="spells">' + spellBtns(c) + '</div>' +
      '<button id="endturn"' + (spent ? ' class="done"' : '') + '>End turn ▸</button>';
    document.querySelectorAll('.spell').forEach(b => b.onclick = () => {
      if (mode === 'over') return;
      if (mode === 'anim') finishAnim();
      const id = b.dataset.spell;
      if (selSpell === id) return setMode('idle');
      if (id === 'lumos') { castAt(c, 'lumos', c.x, c.y); return; }
      selSpell = id; setMode('target');
    });
    document.getElementById('endturn').onclick = () => { if (mode === 'over') return; if (mode === 'anim') finishAnim(); doEndTurn(); };
    const hb = document.getElementById('hintbar');
    if (hb) { const h2 = g.hint(); hb.textContent = h2.text; hb.className = 'hintbar show' + (h2.urgent ? ' urgent' : '') + (h2.danger ? ' danger' : ''); }
  }
  function flushToasts() {
    const box = document.getElementById('toasts'); if (!box || !g) return;
    while (toastCursor < g.log.length) {
      const msg = g.log[toastCursor++].msg;
      const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
      box.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 2800);
    }
  }

  /* ---- public -------------------------------------------------------------------- */
  function start(game, opts) {
    g = game; players = (opts && opts.players) || 1;
    root.MAR.game = g;
    seats = g.chars.map((_, i) => i % players);
    lastSeat = seats[g.activeIdx];
    selSpell = null; flingAlly = null; anim = null; effects = []; mode = 'idle'; rpos = {};
    camReady = false; staticsDirty = true; world = null; lastTs = 0;
    cachedTrail = null; cachedAuras = []; ghost = null;
    exitPos = null;
    for (let y = 0; y < g.H && !exitPos; y++) for (let x = 0; x < g.W; x++) if (g.def(x, y).kind === 'exit') { exitPos = { x, y }; break; }
    canvas = document.getElementById('board'); ctx = canvas.getContext('2d');
    const eb = document.getElementById('errbar'); if (eb) eb.remove();
    motes = Array.from({ length: 38 }, () => ({ x: Math.random() * 1600, y: Math.random() * 1000, r: 0.6 + Math.random() * 1.6, s: 0.15 + Math.random() * 0.5, a: 0.1 + Math.random() * 0.25, p: Math.random() * 7 }));
    canvas.onmousemove = onMove; canvas.onclick = onClick;
    if (keyHandler) root.removeEventListener('keydown', keyHandler);
    keyHandler = onKey;
    root.addEventListener('keydown', keyHandler);
    if (!root._marErrHooked) {
      root._marErrHooked = true;
      root.addEventListener('error', ev => showError('uncaught', ev.error || ev.message));
      root.addEventListener('unhandledrejection', ev => showError('promise', ev.reason));
    }
    layout();
    if (ro) ro.disconnect();
    ro = new ResizeObserver(() => { layout(); });
    ro.observe(canvas.parentElement);
    toastCursor = g.log.length;
    document.getElementById('overlay').className = 'hidden';
    renderHUD();
    if (players > 1) showHandoff(seats[g.activeIdx]);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }

  root.MAR.ui = {
    start,
    _state: () => ({ mode, selSpell, anim: !!anim, raf: !!raf, ox, oy, cssW, cssH, fps: Math.round(1000 / fpsMs), frameWorkMs: Math.round(workMs * 100) / 100, staticsDirty, active: g && g.activeChar() && g.activeChar().id, moves: g && g.activeChar() && g.activeChar().moves, acted: g && g.activeChar() && g.activeChar().acted }),
    _clickTile: (tx, ty) => { const cx = ox + isoX(tx, ty), cy = oy + isoY(tx, ty); const r = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent('click', { clientX: r.left + cx, clientY: r.top + cy, bubbles: true })); }
  };

})(typeof window !== 'undefined' ? window : globalThis);

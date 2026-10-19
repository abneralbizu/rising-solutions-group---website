(function(){
"use strict";
var html = document.documentElement, body = document.body;
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
var shortSide = Math.min(screen.width || 1200, screen.height || 800);
var LOW = shortSide < 700 || (navigator.hardwareConcurrency || 8) <= 4 || /[?&]low\b/.test(location.search);
function $(s, el){ return (el || document).querySelector(s); }
function $$(s, el){ return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function smooth(a, b, x){ var t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); }
function fmt(n){ return n.toLocaleString('en-US'); }
var rnd = (function(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(20261019);
function R(a, b){ return a + (b - a)*rnd(); }

/* =========================================================
   1. Parcel plan (plan units 640 x 460) and exact areas
   ========================================================= */
var GROSS = 4.20;
function parse(d){
  var t = d.match(/[MLCZ]|-?\d*\.?\d+/g), pts = [], i = 0, cx = 0, cy = 0, cmd = '';
  while (i < t.length){
    var k = t[i];
    if (/[MLCZ]/.test(k)){ cmd = k; i++; if (k === 'Z') continue; }
    if (cmd === 'M' || cmd === 'L'){ cx = +t[i]; cy = +t[i+1]; pts.push([cx, cy]); i += 2; }
    else if (cmd === 'C'){
      var x1 = +t[i], y1 = +t[i+1], x2 = +t[i+2], y2 = +t[i+3], x = +t[i+4], y = +t[i+5];
      for (var s = 1; s <= 14; s++){ var u = s/14, a = (1-u)*(1-u)*(1-u), b = 3*(1-u)*(1-u)*u, c = 3*(1-u)*u*u, e = u*u*u; pts.push([a*cx+b*x1+c*x2+e*x, a*cy+b*y1+c*y2+e*y]); }
      cx = x; cy = y; i += 6;
    } else i++;
  }
  return pts;
}
var G = {
  parcel: parse("M70 60 L560 40 L592 382 L70 386 Z"),
  inner:  parse("M94 84 L538 66 L566 352 L94 356 Z"),
  flood:  parse("M470 20 C505 110 488 210 545 290 C570 325 600 352 640 372 L640 20 Z"),
  wet:    parse("M60 50 L250 42 C262 112 222 176 150 186 C104 192 60 168 60 132 Z"),
  wetCore:parse("M74 62 L222 56 C230 108 200 152 146 160 C110 164 74 146 74 120 Z"),
  esmt:   parse("M318 44 L344 43 L352 384 L326 385 Z"),
  trees:  [[402,160,24],[440,262,20],[232,312,18]],
  bldA:   [[134,206],[302,206],[302,282],[134,282]],
  bldB:   [[372,292],[478,292],[478,342],[372,342]]
};
var mc = document.createElement('canvas'); mc.width = 640; mc.height = 460;
var mx = mc.getContext('2d', {willReadFrequently:true});
function poly(ctx, pts){ ctx.beginPath(); pts.forEach(function(p, i){ i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
function treesPath(ctx){ ctx.beginPath(); G.trees.forEach(function(t){ ctx.moveTo(t[0]+t[2], t[1]); ctx.arc(t[0], t[1], t[2], 0, Math.PI*2); }); }
function fillLayer(ctx, k){
  if (k === 'trees'){ treesPath(ctx); ctx.fill(); return; }
  if (k === 'setback'){ poly(ctx, G.parcel); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; poly(ctx, G.inner); ctx.fill(); return; }
  poly(ctx, G[k]); ctx.fill();
}
function count(){ var d = mx.getImageData(0, 0, 640, 460).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 127) n++; return n; }
function reset(){ mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, 640, 460); mx.fillStyle = '#000'; }
reset(); poly(mx, G.parcel); mx.fill(); var PARCEL_PX = count() || 1;
var SF_PER_PX = GROSS*43560/PARCEL_PX;
var single = {};
['setback','flood','wet','esmt','trees'].forEach(function(k){
  var tc = document.createElement('canvas'); tc.width = 640; tc.height = 460; var t = tc.getContext('2d'); t.fillStyle = '#000'; fillLayer(t, k);
  reset(); poly(mx, G.parcel); mx.fill(); mx.globalCompositeOperation = 'destination-in'; mx.drawImage(tc, 0, 0); single[k] = count();
});
function polyArea(p){ var a = 0; for (var i = 0; i < p.length; i++){ var j = (i+1) % p.length; a += p[i][0]*p[j][1] - p[j][0]*p[i][1]; } return Math.abs(a/2); }
var SF_A = Math.round(polyArea(G.bldA)*SF_PER_PX/100)*100, SF_B = Math.round(polyArea(G.bldB)*SF_PER_PX/100)*100;
var COVER = (polyArea(G.bldA) + polyArea(G.bldB))/PARCEL_PX;

// buildable texture (drawn from the mask)
var tex2d = document.createElement('canvas'); tex2d.width = 1280; tex2d.height = 920;
var tx = tex2d.getContext('2d');
var pat = document.createElement('canvas'); pat.width = 16; pat.height = 16;
(function(){ var p = pat.getContext('2d'); p.fillStyle = 'rgba(158,194,255,0.28)'; p.fillRect(0, 0, 16, 16); p.strokeStyle = 'rgba(200,222,255,1)'; p.lineWidth = 2; p.beginPath(); p.moveTo(-4, 4); p.lineTo(4, -4); p.moveTo(0, 16); p.lineTo(16, 0); p.moveTo(12, 20); p.lineTo(20, 12); p.stroke(); })();
var buildPattern = tx.createPattern(pat, 'repeat');
function computeBuildable(a){
  reset(); poly(mx, G.parcel); mx.fill();
  if (a.setback){ mx.globalCompositeOperation = 'destination-in'; poly(mx, G.inner); mx.fill(); }
  mx.globalCompositeOperation = 'destination-out';
  ['flood','wet','esmt','trees'].forEach(function(k){ if (a[k]) fillLayer(mx, k); });
  var n = count();
  tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, 1280, 920); tx.drawImage(mc, 0, 0, 1280, 920);
  tx.globalCompositeOperation = 'source-in'; tx.fillStyle = buildPattern; tx.fillRect(0, 0, 1280, 920);
  return n;
}

/* =========================================================
   2. Page UI (works with or without 3D)
   ========================================================= */
var boxes = $$('#layerList input');
var hoverK = null, hoverSrc = null;
var W = null; // 3D world handles
Object.keys(single).forEach(function(k){ var el = $('[data-imp="'+k+'"]'); if (el) el.textContent = '−' + (single[k]/PARCEL_PX*GROSS).toFixed(2) + ' ac'; });
function activeMap(){ var a = {}; boxes.forEach(function(b){ a[b.dataset.layer] = b.checked; }); return a; }
function refresh(){
  var a = activeMap();
  boxes.forEach(function(b){ b.closest('.it').classList.toggle('off', !b.checked); });
  var n = computeBuildable(a), ac = n/PARCEL_PX*GROSS, pct = Math.round(ac/GROSS*100);
  $('#roAc').innerHTML = ac.toFixed(2) + '<small>of ' + GROSS.toFixed(2) + ' ac</small>';
  $('#roPct').textContent = pct + '%';
  $('#roBar').style.width = pct + '%';
  var cnt = boxes.filter(function(b){ return b.checked; }).length;
  $('#roNote').innerHTML = cnt ? '<b>' + cnt + (cnt === 1 ? ' finding.' : ' findings.') + '</b> ' + (100 - pct >= 40 ? 'Close to half of this parcel can’t hold a building.' : 'About ' + (100 - pct) + '% of the parcel is off the table.') : 'Turn on a layer to see what it takes away.';
  if (W) W.layersChanged(a);
}
boxes.forEach(function(b){ b.addEventListener('change', refresh); });
function bindHover(list){
  $$('.it', list).forEach(function(it){
    var k = it.dataset.k;
    function on(){ hoverK = k; hoverSrc = list.id; $$('.it', list).forEach(function(o){ o.classList.toggle('hot', o === it); }); }
    function off(){ if (hoverK === k){ hoverK = null; } it.classList.remove('hot'); }
    it.addEventListener('pointerenter', on); it.addEventListener('pointerleave', off);
    it.addEventListener('focusin', on); it.addEventListener('focusout', off);
  });
}
['#layerList','#stdList','#qList'].forEach(function(s){ bindHover($(s)); });
var parkSpaces = 0;

// chapters + scroll
var chapters = $$('.chapter'), railLinks = $$('.rail a');
var anchors = [];
function computeAnchors(){
  var vh = innerHeight, max = document.documentElement.scrollHeight - vh;
  anchors = chapters.map(function(c, i){ if (!i) return 0; var r = c.getBoundingClientRect(); return clamp(r.top + scrollY + r.height/2 - vh/2, 0, max); });
  for (var i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i-1] + 1);
}
function progress(){
  var y = scrollY; if (!anchors.length || y <= anchors[0]) return 0;
  for (var i = 0; i < anchors.length - 1; i++) if (y < anchors[i+1]) return i + (y - anchors[i])/(anchors[i+1] - anchors[i]);
  return anchors.length - 1;
}
var curCh = -1;
var CH_NAMES = ['Overview','01 Analyze','02 Design','03 Present','Who we serve','Process','The book','Questions','Contact'];
var pgPrev = $('#pgPrev'), pgNext = $('#pgNext');
function goChapter(i){
  computeAnchors(); i = clamp(i, 0, chapters.length - 1);
  scrollTo({top: anchors[i], behavior: REDUCED ? 'auto' : 'smooth'});
  var hd = chapters[i].querySelector('h1, h2'); if (hd){ hd.setAttribute('tabindex', '-1'); hd.focus({preventScroll:true}); }
}
function pagerUpdate(i){
  var last = chapters.length - 1;
  $('#pgNum').textContent = (i < 9 ? '0' : '') + (i + 1) + ' / ' + (last < 9 ? '0' : '') + (last + 1);
  $('#pgName').textContent = CH_NAMES[i] || '';
  pgPrev.disabled = i === 0;
  $('#pgNextLbl').textContent = i === last ? 'Back to top' : 'Next';
  $('#pgNextAr').textContent = i === last ? '↑' : '→';
  pgNext.setAttribute('aria-label', i === last ? 'Back to top' : 'Next chapter: ' + (CH_NAMES[i + 1] || ''));
  pgPrev.setAttribute('aria-label', i === 0 ? 'Previous chapter' : 'Previous chapter: ' + CH_NAMES[i - 1]);
}
// On phones the bar steps aside while the visitor scrolls down to read,
// and comes back on scroll up, at the top or bottom, or after Back/Next.
var pager = $('#pager'), lastY = scrollY, tuckLock = 0;
var narrowMQ = window.matchMedia('(max-width: 820px)');
function pagerShow(){ pager.classList.remove('tuck'); }
addEventListener('scroll', function(){
  var y = scrollY, dy = y - lastY; lastY = y;
  if (!narrowMQ.matches || Date.now() < tuckLock){ pagerShow(); return; }
  var atEnd = y + innerHeight >= document.documentElement.scrollHeight - 8;
  if (y < 40 || atEnd || dy < -4) pagerShow();
  else if (dy > 4) pager.classList.add('tuck');
}, {passive:true});
pager.addEventListener('focusin', pagerShow);
[pgPrev, pgNext].forEach(function(btn){ btn.addEventListener('click', function(){ tuckLock = Date.now() + 1400; pagerShow(); }); });
pgPrev.addEventListener('click', function(){ var p = progress(); goChapter(Math.ceil(p - .05) - 1); });
pgNext.addEventListener('click', function(){ var p = progress(); if (Math.round(p) >= chapters.length - 1 || scrollY + innerHeight >= document.documentElement.scrollHeight - 4) goChapter(0); else goChapter(Math.floor(p + .05) + 1); });
document.addEventListener('keydown', function(e){
  if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test((e.target.tagName || ''))) return;
  if (e.key === 'ArrowRight'){ e.preventDefault(); pgNext.click(); }
  if (e.key === 'ArrowLeft'){ e.preventDefault(); pgPrev.click(); }
});
function setChapter(i){
  if (i === curCh) return; curCh = i; pagerUpdate(i);
  body.dataset.side = chapters[i].dataset.side || 'left';
  railLinks.forEach(function(a){ a.classList.toggle('on', +a.dataset.ch === i); });
}
document.addEventListener('click', function(e){
  var a = e.target.closest('a[href^="#"]'); if (!a) return;
  var id = a.getAttribute('href').slice(1), t = document.getElementById(id); if (!t) return;
  var ch = t.closest('.chapter') || t, i = chapters.indexOf(ch); if (i < 0) return;
  e.preventDefault(); computeAnchors();
  scrollTo({top: anchors[i], behavior: REDUCED ? 'auto' : 'smooth'});
});
addEventListener('resize', computeAnchors); addEventListener('load', computeAnchors); if (document.fonts && document.fonts.ready) document.fonts.ready.then(computeAnchors);

// reveals
if ('IntersectionObserver' in window && !REDUCED){
  $$('.reveal').forEach(function(el){ $$(':scope > *', el).forEach(function(c, i){ c.style.setProperty('--i', i); }); });
  var io = new IntersectionObserver(function(es){ es.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('shown'); io.unobserve(en.target); } }); }, {threshold:.12});
  $$('.reveal').forEach(function(el){ io.observe(el); });
} else html.classList.add('static');

// book tilt
var bk = $('#bk'), bw = $('#bkWrap');
if (bk && !REDUCED){
  bw.addEventListener('pointermove', function(e){ var r = bw.getBoundingClientRect(), x = (e.clientX - r.left)/r.width - .5, y = (e.clientY - r.top)/r.height - .5; bk.style.transform = 'rotateY(' + (-26 + x*40).toFixed(1) + 'deg) rotateX(' + (6 - y*18).toFixed(1) + 'deg)'; });
  bw.addEventListener('pointerleave', function(){ bk.style.transform = ''; });
}
// forms
function show(el, t){ el.textContent = t; el.hidden = false; }
$('#inquiryForm').addEventListener('submit', function(e){
  e.preventDefault();
  var m = $('#inquiryMsg'), n = $('#fName'), em = $('#fEmail');
  if (!n.value.trim()){ show(m, 'Please add your name so we know who to reply to.'); n.focus(); return; }
  if (!em.value.trim() || !em.checkValidity()){ show(m, 'Please enter a valid email address, such as you@company.com.'); em.focus(); return; }
  send(e.target, m, 'Thank you. Your request was sent, and we will reply with a proposal.');
});
$('#notifyForm').addEventListener('submit', function(e){
  e.preventDefault();
  var em = $('#notifyEmail'), m = $('#notifyMsg');
  if (!em.value.trim() || !em.checkValidity()){ show(m, 'Please enter a valid email address.'); em.focus(); return; }
  send(e.target, m, 'Thank you. We will email you when the book is released.');
});
function send(form, m, okText){
  var btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
  fetch('/', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(new FormData(form)).toString()})
    .then(function(r){ if (!r.ok) throw new Error(r.status); show(m, okText); form.reset(); })
    .catch(function(){ show(m, 'The form could not be sent from this address. Please call 407-739-5959.'); })
    .then(function(){ if (btn) btn.disabled = false; });
}
$$('[data-copy]').forEach(function(btn){
  btn.addEventListener('click', function(){
    var t = document.getElementById(btn.getAttribute('data-copy'));
    function sel(){ var r = document.createRange(); r.selectNodeContents(t); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    try { navigator.clipboard.writeText(t.textContent).then(function(){ btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = 'Copy'; }, 1600); }, sel); } catch(err){ sel(); }
  });
});

// loader
var ldPct = $('#ldPct'), ldBar = $('#ldBar');
function setLoad(f){ var p = Math.round(f*100); ldPct.textContent = p + '%'; ldBar.style.width = p + '%'; }
function finishLoad(){ setLoad(1); setTimeout(function(){ $('#loader').classList.add('done'); }, 250); }
/* =========================================================
   3. The plan-set drawing engine (Canvas 2D)
   World units = plan units (≈1.05 ft). Parcel sits at x 70–592, y 40–386.
   ========================================================= */
var FT = Math.sqrt(GROSS*43560/polyArea(G.parcel));
function ftStr(u){ var f = u*FT; var whole = Math.floor(f), inch = Math.round((f - whole)*12); if (inch === 12){ whole++; inch = 0; } return whole + '′-' + inch + '″'; }
function bearing(a, b){
  var dx = b[0] - a[0], dn = -(b[1] - a[1]);
  var ns = dn >= 0 ? 'N' : 'S', ew = dx >= 0 ? 'E' : 'W';
  var ang = Math.atan2(Math.abs(dx), Math.abs(dn))*180/Math.PI;
  var d = Math.floor(ang), mf = (ang - d)*60, m = Math.floor(mf), s = Math.round((mf - m)*60);
  if (s === 60){ s = 0; m++; } if (m === 60){ m = 0; d++; }
  function p2(n){ return (n < 10 ? '0' : '') + n; }
  return ns + ' ' + p2(d) + '°' + p2(m) + '′' + p2(s) + '″ ' + ew;
}
var E0 = 563140, N0 = 1580920; // display-only grid offset for the coordinate readout

function engine(done){
  var stage = $('#stage');
  var cv = document.createElement('canvas'); stage.appendChild(cv);
  var g = cv.getContext('2d');
  var buf = document.createElement('canvas'), b = buf.getContext('2d');
  var Wd = 0, Hd = 0, DPR = 1, PX = 1, bpat = null;
  var MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  var SANS = 'Jost, "Century Gothic", "Avenir Next", Arial, sans-serif';
  var BG = '#0A1222';

  function makePattern(){
    var s = Math.round(8*DPR), c = document.createElement('canvas'); c.width = c.height = s; var q = c.getContext('2d');
    q.fillStyle = 'rgba(150,190,255,0.09)'; q.fillRect(0, 0, s, s);
    q.strokeStyle = 'rgba(170,205,255,0.62)'; q.lineWidth = Math.max(1, DPR*.9);
    q.beginPath(); q.moveTo(0, s); q.lineTo(s, 0); q.moveTo(-s/2, s/2); q.lineTo(s/2, -s/2); q.moveTo(s/2, s*1.5); q.lineTo(s*1.5, s/2); q.stroke();
    bpat = b.createPattern(c, 'repeat');
  }
  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2);
    Wd = innerWidth; Hd = innerHeight;
    cv.width = Math.round(Wd*DPR); cv.height = Math.round(Hd*DPR); cv.style.width = Wd + 'px'; cv.style.height = Hd + 'px';
    buf.width = cv.width; buf.height = cv.height; makePattern(); dirty = true;
  }

  /* ---------- world generation ---------- */
  var TS = 700, TILES = {};
  function tile(x, y){
    var i = Math.floor(x/TS), j = Math.floor(y/TS), k = i + ',' + j, t = TILES[k];
    if (!t) t = TILES[k] = {i:i, j:j, lots:new Path2D(), houses:new Path2D(), bld:new Path2D(), lotsCom:new Path2D(), stalls:new Path2D(), cont:new Path2D(), conti:new Path2D()};
    return t;
  }
  function addPoly(path, pts){ path.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); path.closePath(); }
  function dSeg(px, py, ax, ay, bx, by){ var vx = bx - ax, vy = by - ay, l = vx*vx + vy*vy, t = l ? clamp(((px - ax)*vx + (py - ay)*vy)/l, 0, 1) : 0; var dx = ax + vx*t - px, dy = ay + vy*t - py; return Math.sqrt(dx*dx + dy*dy); }
  function dPoly(px, py, pts){ var m = 1e9; for (var i = 0; i < pts.length - 1; i++) m = Math.min(m, dSeg(px, py, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1])); return m; }
  function inPoly(x, y, pts){ var c = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++){ if (((pts[i][1] > y) !== (pts[j][1] > y)) && (x < (pts[j][0] - pts[i][0])*(y - pts[i][1])/(pts[j][1] - pts[i][1]) + pts[i][0])) c = !c; } return c; }

  // noise
  function hash(i, j){ var h = Math.sin(i*127.1 + j*311.7)*43758.5453; return h - Math.floor(h); }
  function vn(x, y){ var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy); var a = hash(i, j), bb = hash(i+1, j), c = hash(i, j+1), d = hash(i+1, j+1); return a + (bb - a)*u + (c - a)*v + (a - bb - c + d)*u*v; }
  function fbm(x, y){ return vn(x, y)*.62 + vn(x*2.03 + 5.2, y*2.03 + 1.3)*.26 + vn(x*4.1 + 9.7, y*4.1 + 3.1)*.12; }

  var ROADS = [];
  function road(pts, w, kind, name, lbl){ ROADS.push({pts:pts, w:w, kind:kind, name:name, lbl:lbl}); }
  function wave(y0, x0, x1, amp, len, ph){ var p = []; for (var x = x0; x <= x1 + .1; x += 40) p.push([x, y0 + amp*Math.sin((x + ph)/len)]); return p; }
  var LAKES = [], CREEK = null, PARKS = [];
  var EX = [[30, -10, 640, 420], [600, -70, 910, 410]]; // keep clear: parcel + drawing area
  function excluded(x, y, pad){ pad = pad || 0; for (var i = 0; i < EX.length; i++){ var e = EX[i]; if (x > e[0] - pad && x < e[2] + pad && y > e[1] - pad && y < e[3] + pad) return true; } return false; }

  function genRoads(){
    road([[-3200, 432], [3800, 432]], 84, 'art', 'COMMERCE PKWY', [[-700, 432], [1100, 432]]);
    road([[24, -2600], [24, 432]], 58, 'col', 'OAK ST', [[24, -500]]);
    road([[-3200, -1350], [3800, -1350]], 80, 'art', 'CYPRESS BLVD', [[-400, -1350], [1200, -1350]]);
    road([[-1500, -2600], [-1500, 2700]], 74, 'art', 'PALMETTO AVE', [[-1500, -800], [-1500, 1000]]);
    road([[1480, -2600], [1480, 2700]], 84, 'art', 'MAGNOLIA RD', [[1480, -700], [1480, 1000]]);
    road([[-3200, 1520], [3800, 1520]], 74, 'art', 'LAKESHORE DR', [[-600, 1520]]);
    road([[2620, -2600], [2620, 2700]], 64, 'col');
    // north subdivision streets (curvilinear)
    [-1180, -920, -660, -400, -140, 120].forEach(function(y0, i){ road(wave(y0, -1460, 1440, 34 + i*3, 230 + i*25, i*170), 40, 'loc'); });
    // south grid
    [830, 1130].forEach(function(y){ road([[-1460, y], [640, y]], 40, 'loc'); });
    [-1000, -420, 200].forEach(function(x){ road([[x, 474], [x, 1520]], 40, 'loc'); });
    // west grid
    for (var y = -2300; y <= 2500; y += 290) road([[-3200, y], [-1540, y]], 36, 'loc');
    [-2700, -2120].forEach(function(x){ road([[x, -2600], [x, 2700]], 40, 'loc'); });
    // east-south subdivision
    [700, 960, 1220].forEach(function(y0, i){ road(wave(y0, 1525, 2590, 30, 210 + i*30, i*90), 40, 'loc'); });
    // downtown grid
    for (var dx = 1560; dx <= 2560; dx += 240) road([[dx, -2600], [dx, -1390]], 44, 'loc');
    for (var dy = -2300; dy <= -1440; dy += 240) road([[1480, dy], [2620, dy]], 44, 'loc');
    // office park loop
    road([[660, 900], [1100, 900], [1100, 1300], [660, 1300], [660, 900]], 40, 'loc');
  }
  function genWater(){
    function lake(cx, cy, r, seed, name){ var pts = []; for (var i = 0; i < 90; i++){ var a = i/90*Math.PI*2; var rr = r*(1 + .22*(fbm(Math.cos(a)*1.4 + seed, Math.sin(a)*1.4 + seed) - .5)*2); pts.push([cx + Math.cos(a)*rr, cy + Math.sin(a)*rr*.82]); } LAKES.push({c:[cx, cy], r:r, pts:pts, name:name}); }
    lake(-720, -760, 250, 3, 'LAKE'); lake(880, -640, 170, 7, 'LAKE'); lake(260, 1040, 190, 11, 'LAKE'); lake(2290, -1680, 95, 15, 'LAKE');
    lake(-2350, 420, 210, 19, 'LAKE'); lake(2120, 1060, 120, 23, null); lake(960, 1120, 70, 27, null); lake(-240, 650, 55, 31, null);
    CREEK = []; var pts = [[-500, -640], [-330, -520], [-220, -360], [-120, -230], [-40, -120], [60, -20], [120, 70]];
    for (var i = 0; i < pts.length - 1; i++){ for (var s = 0; s < 8; s++){ var t = s/8, x = pts[i][0] + (pts[i+1][0] - pts[i][0])*t, y = pts[i][1] + (pts[i+1][1] - pts[i][1])*t; CREEK.push([x + 18*Math.sin(i*2.1 + s*.8), y + 14*Math.cos(i*1.7 + s*.9)]); } }
    CREEK.push([140, 92]);
    PARKS.push([[2040, -1676], [2190, -1676], [2190, -1594], [2040, -1594]]);
  }
  function nearRoad(x, y, pad, skip){ for (var i = 0; i < ROADS.length; i++){ var r = ROADS[i]; if (r === skip) continue; if (dPoly(x, y, r.pts) < r.w/2 + pad) return true; } return false; }
  function inWater(x, y, pad){ for (var i = 0; i < LAKES.length; i++){ var L = LAKES[i]; if (Math.hypot(x - L.c[0], (y - L.c[1])/.82) < L.r*1.25 + pad) return true; } return CREEK && dPoly(x, y, CREEK) < 26 + pad; }
  var nHouses = 0;
  function streetLots(r, front, depth, sides, houses){
    var pts = r.pts, acc = 0, segs = [];
    for (var i = 0; i < pts.length - 1; i++){ var l = Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]); segs.push({a:pts[i], b:pts[i+1], l:l, s:acc}); acc += l; }
    function at(d){ for (var i = 0; i < segs.length; i++){ var sg = segs[i]; if (d <= sg.s + sg.l || i === segs.length - 1){ var t = (d - sg.s)/sg.l; var x = sg.a[0] + (sg.b[0] - sg.a[0])*t, y = sg.a[1] + (sg.b[1] - sg.a[1])*t; var tx = (sg.b[0] - sg.a[0])/sg.l, ty = (sg.b[1] - sg.a[1])/sg.l; return [x, y, tx, ty]; } } }
    var off = r.w/2 + 6;
    for (var d = 20; d + front < acc - 20; d += front){
      var A = at(d), B = at(d + front);
      sides.forEach(function(sd){
        var nxA = -A[3]*sd, nyA = A[2]*sd, nxB = -B[3]*sd, nyB = B[2]*sd;
        var q = [[A[0] + nxA*off, A[1] + nyA*off], [B[0] + nxB*off, B[1] + nyB*off], [B[0] + nxB*(off + depth), B[1] + nyB*(off + depth)], [A[0] + nxA*(off + depth), A[1] + nyA*(off + depth)]];
        var cx = (q[0][0] + q[2][0])/2, cy = (q[0][1] + q[2][1])/2;
        if (excluded(cx, cy, 30) || inWater(cx, cy, 10) || nearRoad(cx, cy, depth*.42, r)) return;
        var t = tile(cx, cy); addPoly(t.lots, q);
        if (houses){
          var mx = (A[0] + B[0])/2, my = (A[1] + B[1])/2, tx = A[2], ty = A[3], nx = -ty*sd, ny = tx*sd;
          var hw = front*.32, hd = depth*.24, c0 = off + depth*.34;
          var hc = [mx + nx*(c0 + hd), my + ny*(c0 + hd)];
          var h = [[hc[0] - tx*hw - nx*hd, hc[1] - ty*hw - ny*hd], [hc[0] + tx*hw - nx*hd, hc[1] + ty*hw - ny*hd], [hc[0] + tx*hw + nx*hd, hc[1] + ty*hw + ny*hd], [hc[0] - tx*hw + nx*hd, hc[1] - ty*hw + ny*hd]];
          if (rnd() < .5){ var gx = tx*hw*.45, gy = ty*hw*.45; h.splice(2, 0, [h[1][0] + nx*hd*.6, h[1][1] + ny*hd*.6]); }
          addPoly(t.houses, h); nHouses++;
        }
      });
    }
  }
  function rectPts(x0, y0, x1, y1){ return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function commercialStrip(x0, x1, yFront, dir){
    var x = x0;
    while (x < x1){
      var w = R(130, 260); if (x + w > x1) break;
      var y0 = yFront, y1 = yFront + dir*180, cx = x + w/2, cy = (y0 + y1)/2;
      if (!excluded(cx, cy, 20) && !nearRoad(cx, cy, 70, null) && !inWater(cx, cy, 0)){
        var t = tile(cx, cy);
        addPoly(t.lotsCom, rectPts(x, Math.min(y0, y1), x + w, Math.max(y0, y1)));
        var bw = w*R(.45, .7), bd = R(55, 80), bx = x + (w - bw)/2, by = dir > 0 ? y1 - 18 - bd : y1 + 18;
        addPoly(t.bld, rectPts(bx, by, bx + bw, by + bd));
        // parking rows in front
        var py0 = dir > 0 ? y0 + 22 : y0 - 22, rows = 2;
        for (var r = 0; r < rows; r++){
          var ry = py0 + dir*r*44;
          for (var sx = x + 14; sx < x + w - 14; sx += 9){ t.stalls.moveTo(sx, ry); t.stalls.lineTo(sx, ry + dir*18); }
        }
      }
      x += w + R(8, 30);
    }
  }
  function blockBuildings(x0, y0, x1, y1){
    var t = tile((x0 + x1)/2, (y0 + y1)/2);
    function split(a, bq, c, d, depth){
      var w = c - a, h = d - bq;
      if (depth > 2 || (w < 90 && h < 90) || (depth > 0 && rnd() < .25)){
        var ins = R(4, 10); var p = rectPts(a + ins, bq + ins, c - ins, d - ins); addPoly(t.bld, p);
        if (w > 120 && h > 120 && rnd() < .5){ var ci = Math.min(w, h)*.28; addPoly(t.lotsCom, rectPts(a + ci, bq + ci, c - ci, d - ci)); }
        return;
      }
      if (w > h){ var m = a + w*R(.35, .65); split(a, bq, m, d, depth + 1); split(m, bq, c, d, depth + 1); }
      else { var mm = bq + h*R(.35, .65); split(a, bq, c, mm, depth + 1); split(a, mm, c, d, depth + 1); }
    }
    split(x0, y0, x1, y1, 0);
  }
  function genFabric(){
    ROADS.forEach(function(r){
      if (r.kind !== 'loc') return;
      var x0 = r.pts[0][0], y0 = r.pts[0][1];
      if (y0 >= -1200 && y0 <= 130 && x0 < -1400) streetLots(r, 64, 112, [1, -1], true);        // north curvilinear
      else if ((y0 === 830 || y0 === 1130) && r.pts.length === 2) streetLots(r, 60, 118, [1, -1], true); // south grid
      else if (x0 === -3200) streetLots(r, 58, 112, [1, -1], true);                                 // west grid
      else if (x0 === 1525) streetLots(r, 66, 112, [1, -1], true);                                   // east-south
    });
    commercialStrip(-1460, -10, 390, -1); commercialStrip(640, 1440, 390, -1);
    commercialStrip(-1460, 1440, 474, 1);
    commercialStrip(1520, 2600, 390, -1); commercialStrip(1520, 2600, 474, 1);
    // downtown blocks
    for (var bx = 1560; bx < 2560; bx += 240) for (var by = -2300; by < -1440; by += 240){
      var x0 = bx + 22, x1 = bx + 218, y0 = by + 22, y1 = by + 218;
      if (Math.hypot((x0 + x1)/2 - 2290, (y0 + y1)/2 + 1680) < 150) continue;
      blockBuildings(x0, y0, x1, y1);
      addPoly(tile((x0 + x1)/2, (y0 + y1)/2).lotsCom, rectPts(x0, y0, x1, y1));
    }
    // office / flex east of Magnolia (north of pkwy)
    for (var oy = -1280; oy < 340; oy += R(170, 230)) for (var ox = 1540; ox < 2560; ox += R(190, 280)){
      var w = R(110, 190), h = R(70, 120); var cx = ox + w/2, cy = oy + h/2;
      if (nearRoad(cx, cy, 70, null) || inWater(cx, cy, 20)) continue;
      var t = tile(cx, cy); addPoly(t.bld, rectPts(ox, oy, ox + w, oy + h)); addPoly(t.lotsCom, rectPts(ox - 20, oy - 26, ox + w + 20, oy + h + 46));
      for (var sx = ox; sx < ox + w; sx += 9){ t.stalls.moveTo(sx, oy + h + 22); t.stalls.lineTo(sx, oy + h + 40); }
    }
    // office park buildings
    [[700, 940, 180, 90], [880, 940, 160, 110], [700, 1120, 140, 120], [1150, 960, 200, 110], [1180, 1160, 180, 120], [700, 1360, 260, 90]].forEach(function(o){
      var t = tile(o[0] + o[2]/2, o[1] + o[3]/2); addPoly(t.bld, rectPts(o[0], o[1], o[0] + o[2], o[1] + o[3]));
      for (var sx = o[0]; sx < o[0] + o[2]; sx += 9){ t.stalls.moveTo(sx, o[1] - 40); t.stalls.lineTo(sx, o[1] - 22); }
    });
  }
  function genContours(){
    var x0 = -3400, y0 = -2700, step = LOW ? 70 : 50, nx = Math.ceil(7600/step), ny = Math.ceil(5600/step);
    var F = new Float32Array((nx + 1)*(ny + 1));
    for (var j = 0; j <= ny; j++) for (var i = 0; i <= nx; i++) F[j*(nx + 1) + i] = fbm((x0 + i*step)/1100 + 3, (y0 + j*step)/1100 + 7);
    var lv = []; for (var v = .18; v < .86; v += (LOW ? .035 : .022)) lv.push(v);
    lv.forEach(function(L, li){
      var idx = li % 4 === 0;
      for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++){
        var a = F[j*(nx + 1) + i], bq = F[j*(nx + 1) + i + 1], c = F[(j + 1)*(nx + 1) + i + 1], d = F[(j + 1)*(nx + 1) + i];
        var k = (a > L ? 8 : 0) | (bq > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0); if (k === 0 || k === 15) continue;
        var X = x0 + i*step, Y = y0 + j*step;
        var top = [X + step*(L - a)/(bq - a), Y], right = [X + step, Y + step*(L - bq)/(c - bq)], bot = [X + step*(L - d)/(c - d), Y + step], left = [X, Y + step*(L - a)/(d - a)];
        var segs = {1:[left, bot], 2:[bot, right], 3:[left, right], 4:[top, right], 5:[left, top, bot, right], 6:[top, bot], 7:[left, top], 8:[left, top], 9:[top, bot], 10:[left, bot, top, right], 11:[top, right], 12:[left, right], 13:[bot, right], 14:[left, bot]}[k];
        var t = tile(X + step/2, Y + step/2), P = idx ? t.conti : t.cont;
        for (var s = 0; s < segs.length; s += 2){ P.moveTo(segs[s][0], segs[s][1]); P.lineTo(segs[s+1][0], segs[s+1][1]); }
      }
    });
  }

  /* ---------- the site ---------- */
  var P2 = {};
  function path(pts, closed){ var p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); if (closed !== false) p.closePath(); return p; }
  function circ(x, y, r){ var p = new Path2D(); p.arc(x, y, r, 0, Math.PI*2); return p; }
  var SITE = {};
  function genSite(){
    P2.parcel = path(G.parcel); P2.inner = path(G.inner);
    P2.ring = new Path2D(); P2.ring.addPath(P2.parcel); P2.ring.addPath(path(G.inner.slice().reverse()));
    P2.flood = path(G.flood); P2.wet = path(G.wet); P2.wetCore = path(G.wetCore); P2.esmt = path(G.esmt);
    P2.trees = new Path2D(); G.trees.forEach(function(t){ P2.trees.moveTo(t[0] + t[2], t[1]); P2.trees.arc(t[0], t[1], t[2], 0, Math.PI*2); });
    P2.water = path([[-3200, 404], [3800, 404]], false);
    P2.sewer = path([[-3200, 450], [150, 450]], false);
    P2.gap = path([[158, 448], [470, 394]], false);
    // concept
    var A = G.bldA, B = G.bldB;
    SITE.A = A; SITE.B = B;
    SITE.stalls = []; SITE.stallRects = [];
    function stallRow(x0, x1, yTop, depth, skip){ for (var x = x0; x + 9 <= x1 + .1; x += 9){ if (skip && x + 9 > skip[0] && x < skip[1]) continue; SITE.stallRects.push([x, yTop, 9, depth]); } }
    function stallCol(y0, y1, xL, depth){ for (var y = y0; y + 9 <= y1 + .1; y += 9){ SITE.stallRects.push([xL, y, depth, 9, 'v']); } }
    stallRow(134, 302, 292, 18, [212, 252]); stallRow(134, 302, 334, 18, [212, 252]); stallRow(372, 414, 274, 18); stallCol(292, 346, 484, 18);
    SITE.island = [[212, 292], [252, 292], [252, 352], [212, 352]];
    SITE.curbs = path([[104, 390], [104, 310], [302, 310]], false); SITE.curbs.addPath(path([[128, 390], [128, 334], [134, 334]], false)); SITE.curbs.addPath(path([[302, 334], [302, 352]], false));
    SITE.curbs.addPath(path([[502, 390], [502, 290], [526, 290], [526, 390]], false));
    SITE.drives = [[[104, 310], [302, 310], [302, 334], [128, 334], [128, 390], [104, 390]], [[502, 274], [526, 274], [526, 390], [502, 390]]];
    SITE.arrows = [[150, 322, 1], [260, 322, 1], [514, 320, -2], [116, 360, -2]];
    SITE.canopy = path([[146, 290], [290, 290]], false);
    SITE.entries = [[170, 282], [218, 282], [266, 282], [425, 342]];
    SITE.nStalls = SITE.stallRects.length;
  }

  /* ---------- camera ---------- */
  var KF = [
    {c:[330, 200],  vw:2700, ox:.2,   mob:.55},
    {c:[330, 214],  vw:1180, ox:-.22, mob:.62},
    {c:[476, 214],  vw:1520, ox:.2,   mob:.62},
    {c:[330, 250],  vw:1120, ox:-.22, mob:.62},
    {c:[300, -60],  vw:4600, ox:0,    mob:.45},
    {c:[-860, -640],vw:2000, ox:.2,   mob:.55},
    {c:[2010, -1600],vw:1800,ox:-.22, mob:.55},
    {c:[1320, 820], vw:1900, ox:-.22, mob:.55},
    {c:[430, 255],  vw:2080, ox:.2,   mob:.75}
  ];
  function ease5(t){ return t*t*t*(t*(t*6 - 15) + 10); }
  var VIEW = {cx:0, cy:0, z:1, ox:0, oy:0};
  function sampleCam(p){
    var i = clamp(Math.floor(p), 0, KF.length - 2), f = clamp(p - i, 0, 1), e = ease5(f), A = KF[i], B = KF[i+1];
    var narrow = Wd/Hd < .9;
    var vwA = A.vw*(narrow ? A.mob : 1), vwB = B.vw*(narrow ? B.mob : 1);
    var cx = A.c[0] + (B.c[0] - A.c[0])*e, cy = A.c[1] + (B.c[1] - A.c[1])*e;
    var vw = Math.exp(Math.log(vwA) + (Math.log(vwB) - Math.log(vwA))*e);
    var D = Math.hypot(B.c[0] - A.c[0], B.c[1] - A.c[1]);
    if (D > Math.min(vwA, vwB)*.6) vw *= 1 + Math.sin(Math.PI*e)*Math.min(1.2, D/Math.min(vwA, vwB))*.55;
    VIEW.cx = cx; VIEW.cy = cy; VIEW.z = Wd/vw;
    VIEW.ox = narrow ? 0 : (A.ox + (B.ox - A.ox)*e)*Wd;
    VIEW.oy = narrow ? -Hd*.2 : 0;
  }
  function setWorld(ctx){ (ctx || g).setTransform(DPR*VIEW.z, 0, 0, DPR*VIEW.z, DPR*(Wd/2 + VIEW.ox + par.x - VIEW.cx*VIEW.z), DPR*(Hd/2 + VIEW.oy + par.y - VIEW.cy*VIEW.z)); }
  function setScreen(ctx){ (ctx || g).setTransform(DPR, 0, 0, DPR, 0, 0); }
  function w2s(x, y){ return [(x - VIEW.cx)*VIEW.z + Wd/2 + VIEW.ox + par.x, (y - VIEW.cy)*VIEW.z + Hd/2 + VIEW.oy + par.y]; }
  function s2w(x, y){ return [(x - Wd/2 - VIEW.ox - par.x)/VIEW.z + VIEW.cx, (y - Hd/2 - VIEW.oy - par.y)/VIEW.z + VIEW.cy]; }

  /* ---------- drawing helpers ---------- */
  function lw(px){ g.lineWidth = px*PX; }
  function strokePartial(pts, t, closed){
    if (t <= 0) return; var all = pts.slice(); if (closed !== false) all.push(pts[0]);
    var L = 0, seg = []; for (var i = 0; i < all.length - 1; i++){ var l = Math.hypot(all[i+1][0] - all[i][0], all[i+1][1] - all[i][1]); seg.push(l); L += l; }
    var goal = L*Math.min(1, t), acc = 0; g.beginPath(); g.moveTo(all[0][0], all[0][1]);
    for (var j = 0; j < seg.length; j++){ if (acc + seg[j] >= goal){ var f = (goal - acc)/seg[j]; g.lineTo(all[j][0] + (all[j+1][0] - all[j][0])*f, all[j][1] + (all[j+1][1] - all[j][1])*f); break; } g.lineTo(all[j+1][0], all[j+1][1]); acc += seg[j]; }
    g.stroke();
  }
  function hatch(clipPath, bbox, spacingPx, ang, color, alpha, rule){
    g.save(); g.clip(clipPath, rule || 'nonzero'); g.strokeStyle = color; g.globalAlpha *= alpha; lw(1);
    var sp = spacingPx*PX, cx = (bbox[0] + bbox[2])/2, cy = (bbox[1] + bbox[3])/2, rad = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1])/2 + 2;
    var ca = Math.cos(ang), sa = Math.sin(ang); g.beginPath();
    for (var d = -rad; d <= rad; d += sp){ var px = cx - sa*d, py = cy + ca*d; g.moveTo(px - ca*rad, py - sa*rad); g.lineTo(px + ca*rad, py + sa*rad); }
    g.stroke(); g.restore();
  }
  function bbox(pts){ var a = [1e9, 1e9, -1e9, -1e9]; pts.forEach(function(p){ a[0] = Math.min(a[0], p[0]); a[1] = Math.min(a[1], p[1]); a[2] = Math.max(a[2], p[0]); a[3] = Math.max(a[3], p[1]); }); return a; }
  var BB = {};
  function font(px, w, fam){ g.font = (w || 500) + ' ' + px + 'px ' + (fam || MONO); }
  function setLS(v){ if ('letterSpacing' in g) g.letterSpacing = v; }
  var panelRect = null;
  function blocked(x, y, w, h){
    if (x < 8 || y < 70 || x + w > Wd - 8 || y + h > Hd - 8) return true;
    if (panelRect && x + w > panelRect.left - 12 && x < panelRect.right + 12 && y + h > panelRect.top - 8 && y < panelRect.bottom + 8) return true;
    return false;
  }
  // screen-space tag with leader
  function tag(text, wx, wy, color, alpha, opt){
    if (alpha <= .02) return; opt = opt || {};
    var s = w2s(wx, wy); setScreen(); font(opt.size || 10.5, 500); setLS('0.08em');
    var tw = g.measureText(text).width, h = (opt.size || 10.5) + 10, w = tw + 16, lead = opt.lead == null ? 16 : opt.lead;
    var x = s[0] - w/2, y = s[1] - lead - h;
    if (blocked(x, y, w, h + lead)) { setLS('0px'); return; }
    g.globalAlpha = alpha;
    if (lead){ g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[0], s[1] - lead); g.stroke(); g.fillStyle = color; g.beginPath(); g.arc(s[0], s[1], 2, 0, Math.PI*2); g.fill(); }
    g.fillStyle = opt.bg || 'rgba(8,14,28,0.88)'; g.fillRect(x, y, w, h); g.strokeStyle = color; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
    g.fillStyle = opt.ink || color; g.textBaseline = 'middle'; g.fillText(text, x + 8, y + h/2 + .5);
    setLS('0px'); g.globalAlpha = 1;
  }
  function worldText(text, wx, wy, ang, sizePx, color, alpha, align, weight, fam){
    if (alpha <= .02) return; var s = w2s(wx, wy); setScreen();
    g.save(); g.translate(s[0], s[1]); g.rotate(ang); font(sizePx, weight || 500, fam); setLS(fam ? '0px' : '0.1em'); g.textAlign = align || 'center'; g.textBaseline = 'middle';
    g.globalAlpha = alpha; g.fillStyle = color; g.fillText(text, 0, 0); g.restore(); setLS('0px'); g.textAlign = 'left';
  }
  function upright(a){ if (a > Math.PI/2) return a - Math.PI; if (a < -Math.PI/2) return a + Math.PI; return a; }

  /* ---------- per-frame state ---------- */
  var LA = activeMap(), dirty = true, intro = REDUCED ? 1 : 0, pSm = 0, time = 0, last = performance.now();
  var hl = {}, vis = {}; ['zone','setback','flood','wet','esmt','trees','util','height','far','cov','park','q1','q2','q3','q4'].forEach(function(k){ hl[k] = 0; vis[k] = 0; });
  var par = {x:0, y:0}, ptr = {x:-1, y:-1, nx:0, ny:0, inside:false, overUI:true}, canvasHover = null;
  var LAYERS = ['zone','setback','flood','wet','esmt','trees','util'];
  var main = document.querySelector('main');
  if (FINE){
    addEventListener('pointermove', function(e){
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.nx = e.clientX/Wd*2 - 1; ptr.ny = e.clientY/Hd*2 - 1; ptr.inside = true;
      var t = e.target; ptr.overUI = !!(t && t.closest && t.closest('.panel, header, .rail, footer, a, button, input, label, select, textarea, summary'));
      dirty = true;
    }, {passive:true});
    document.addEventListener('pointerleave', function(){ ptr.inside = false; dirty = true; });
  }
  function hitTest(){
    if (!FINE || !ptr.inside || ptr.overUI) return null;
    setWorld(); var x = ptr.x*DPR, y = ptr.y*DPR, k = null;
    if (pSm > .55 && pSm < 1.5){
      if (LA.trees && g.isPointInPath(P2.trees, x, y)) k = 'trees';
      else if (LA.esmt && g.isPointInPath(P2.esmt, x, y)) k = 'esmt';
      else if (LA.wet && g.isPointInPath(P2.wet, x, y)) k = 'wet';
      else if (LA.flood && g.isPointInPath(P2.flood, x, y)) k = 'flood';
      else if (LA.setback && g.isPointInPath(P2.ring, x, y, 'evenodd')) k = 'setback';
      else if (LA.util){ g.lineWidth = 12*PX; if (g.isPointInStroke(P2.sewer, x, y) || g.isPointInStroke(P2.gap, x, y) || g.isPointInStroke(P2.water, x, y)) k = 'util'; }
      if (!k && LA.zone && g.isPointInPath(P2.parcel, x, y)) k = 'zone';
    } else if (pSm > 1.55 && pSm < 2.45){
      var w = s2w(ptr.x, ptr.y);
      if (inPoly(w[0], w[1], SITE.A) || inPoly(w[0], w[1], SITE.B)) k = 'far';
      else if (SITE.stallRects.some(function(r){ return r[4] ? (w[0] > r[0] && w[0] < r[0] + r[2] && w[1] > r[1] && w[1] < r[1] + r[3]) : (w[0] > r[0] && w[0] < r[0] + r[2] && w[1] > r[1] && w[1] < r[1] + r[3]); })) k = 'park';
      else if (g.isPointInPath(P2.ring, x, y, 'evenodd')) k = 'setback';
    } else if (pSm > 2.55 && pSm < 3.45){
      var ww = s2w(ptr.x, ptr.y);
      CLOUDS.forEach(function(c){ if (Math.hypot((ww[0] - c.x)/c.rx, (ww[1] - c.y)/c.ry) < 1.15) k = c.k; });
    }
    return k;
  }
  var lastCanvasHot = null;
  function syncListHot(k){
    if (k === lastCanvasHot) return; lastCanvasHot = k;
    $$('.hl .it').forEach(function(it){ if (!it.matches(':hover') && !it.contains(document.activeElement)) it.classList.toggle('hot', !!k && it.dataset.k === k && (
      (it.closest('#layerList') && pSm < 1.5) || (it.closest('#stdList') && pSm >= 1.5 && pSm < 2.5) || (it.closest('#qList') && pSm >= 2.5))); });
    main.style.cursor = k ? 'crosshair' : '';
  }

  var CLOUDS = [
    {k:'q1', x:116, y:384, rx:30, ry:26, n:1, t:'DRIVEWAY SPACING ON COMMERCE PKWY?', tx:14, ty:128},
    {k:'q2', x:232, y:322, rx:32, ry:40, n:2, t:'PRESERVE TREE vs. PARKING COUNT?', tx:24, ty:-400},
    {k:'q3', x:540, y:300, rx:44, ry:48, n:3, t:'STORMWATER AT FLOOD-ZONE EDGE?', tx:-200, ty:190},
    {k:'q4', x:150, y:450, rx:34, ry:20, n:4, t:'WHO FUNDS THE SEWER EXTENSION?', tx:250, ty:104}
  ];
  function cloudPath(c){
    var n = Math.max(10, Math.round((Math.PI*(c.rx + c.ry))/11)), p = new Path2D(), pts = [];
    for (var i = 0; i <= n; i++){ var a = i/n*Math.PI*2; pts.push([c.x + Math.cos(a)*c.rx, c.y + Math.sin(a)*c.ry]); }
    p.moveTo(pts[0][0], pts[0][1]);
    for (var j = 0; j < n; j++){ var m = [(pts[j][0] + pts[j+1][0])/2, (pts[j][1] + pts[j+1][1])/2], o = [m[0] - c.x, m[1] - c.y], l = Math.hypot(o[0], o[1]); p.quadraticCurveTo(m[0] + o[0]/l*7, m[1] + o[1]/l*7, pts[j+1][0], pts[j+1][1]); }
    return p;
  }

  /* ---------- draw ---------- */
  var tilesArr = null;
  function draw(){
    var p = pSm, vb;
    setScreen(); g.globalAlpha = 1; g.fillStyle = BG; g.fillRect(0, 0, Wd, Hd);
    sampleCam(p);
    if (!REDUCED){ par.x += (-ptr.nx*10 - par.x)*.08; par.y += (-ptr.ny*6 - par.y)*.08; }
    PX = 1/VIEW.z;
    var tl = s2w(0, 0), br = s2w(Wd, Hd); vb = [tl[0], tl[1], br[0], br[1]];
    var panel = chapters[curCh] && chapters[curCh].querySelector('.panel'); panelRect = panel ? panel.getBoundingClientRect() : null;
    if (panelRect && (panelRect.bottom < 0 || panelRect.top > Hd)) panelRect = null;

    var focus = clamp(smooth(.25, .9, p)*(1 - smooth(3.5, 4.1, p)) + smooth(7.25, 7.85, p)*.8, 0, 1);
    var ctxA = 1 - .5*focus;
    setWorld(); g.lineJoin = 'round'; g.lineCap = 'butt';

    // intro clip
    var PC = [330, 214], introR = intro < 1 ? (Math.pow(intro, 1.6))*5200 : 1e9;
    g.save();
    if (intro < 1){ g.beginPath(); g.arc(PC[0], PC[1], Math.max(1, introR), 0, Math.PI*2); g.clip(); }

    // survey grid
    var gs = VIEW.z < .25 ? 500 : 100; g.strokeStyle = 'rgba(140,165,215,1)'; lw(1);
    g.globalAlpha = .045*ctxA; g.beginPath();
    for (var gx = Math.floor(vb[0]/gs)*gs; gx < vb[2]; gx += gs){ g.moveTo(gx, vb[1]); g.lineTo(gx, vb[3]); }
    for (var gy = Math.floor(vb[1]/gs)*gs; gy < vb[3]; gy += gs){ g.moveTo(vb[0], gy); g.lineTo(vb[2], gy); }
    g.stroke();
    // tiles in view
    var vis_t = []; for (var k in TILES){ var t = TILES[k]; var x0 = t.i*TS, y0 = t.j*TS; if (x0 > vb[2] + 40 || x0 + TS < vb[0] - 40 || y0 > vb[3] + 40 || y0 + TS < vb[1] - 40) continue; vis_t.push(t); }
    // contours
    g.globalAlpha = ctxA; g.strokeStyle = 'rgba(110,138,196,0.16)'; lw(1); vis_t.forEach(function(t){ g.stroke(t.cont); });
    g.strokeStyle = 'rgba(120,150,210,0.28)'; lw(1.1); vis_t.forEach(function(t){ g.stroke(t.conti); });
    // water
    LAKES.forEach(function(L){
      var lp = path(L.pts); g.globalAlpha = ctxA; g.fillStyle = '#0C1C38'; g.fill(lp);
      g.strokeStyle = 'rgba(96,160,232,0.85)'; lw(1.2); g.stroke(lp);
      g.strokeStyle = 'rgba(96,160,232,0.22)'; lw(1);
      [.84, .68, .52, .36].forEach(function(sc){ g.save(); g.translate(L.c[0], L.c[1]); g.scale(sc, sc); g.translate(-L.c[0], -L.c[1]); lw(1/sc); g.stroke(lp); g.restore(); });
    });
    g.strokeStyle = 'rgba(96,160,232,0.7)'; lw(1.3); g.globalAlpha = ctxA; strokePartial(CREEK, 1, false);
    // roads
    g.globalAlpha = ctxA;
    ROADS.forEach(function(r){ g.strokeStyle = r.kind === 'loc' ? 'rgba(150,170,212,0.45)' : 'rgba(180,196,232,0.7)'; g.lineWidth = r.w + 2.2*PX; g.lineCap = 'butt'; g.stroke(path(r.pts, false)); });
    ROADS.forEach(function(r){ g.strokeStyle = BG; g.lineWidth = Math.max(.1, r.w - (r.kind === 'loc' ? 1.1 : 1.6)*PX); g.stroke(path(r.pts, false)); });
    g.setLineDash([16*PX, 12*PX]);
    ROADS.forEach(function(r){ if (r.kind === 'loc') return; g.strokeStyle = 'rgba(180,196,232,0.32)'; lw(1); g.stroke(path(r.pts, false)); if (r.kind === 'art'){ var ofs = r.w*.25; } });
    g.setLineDash([]);
    // fabric
    vis_t.forEach(function(t){
      g.globalAlpha = ctxA;
      g.strokeStyle = 'rgba(140,160,205,0.26)'; lw(.8); g.stroke(t.lots); g.stroke(t.lotsCom);
      g.fillStyle = '#17243F'; g.fill(t.houses); g.strokeStyle = 'rgba(165,185,228,0.5)'; lw(.8); g.stroke(t.houses);
      g.fillStyle = '#1A2848'; g.fill(t.bld); g.strokeStyle = 'rgba(190,206,240,0.66)'; lw(1); g.stroke(t.bld);
      g.strokeStyle = 'rgba(150,170,212,0.3)'; lw(.7); g.stroke(t.stalls);
    });
    g.restore();
    // intro scan ring
    if (intro < 1){ setWorld(); g.globalAlpha = (1 - intro)*.9; g.strokeStyle = '#E8B45A'; lw(1.4); g.beginPath(); g.arc(PC[0], PC[1], Math.max(1, introR), 0, Math.PI*2); g.stroke(); g.globalAlpha = 1; }

    drawSite(p);
    drawLabels(p, ctxA);
    drawHUD(p);
  }

  function drawSite(p){
    setWorld(); g.globalAlpha = 1; g.lineJoin = 'miter';
    var A = 1;
    var heroPulse = (1 - smooth(.4, 1, p))*(REDUCED ? 0 : .5 + .5*Math.sin(time*2.2));
    var bnd = smooth(.15, .85, intro);
    // parcel fill
    g.fillStyle = 'rgba(232,180,90,0.045)'; g.fill(P2.parcel);
    // constraint layers
    var after = 1 - .62*smooth(1.25, 1.75, p);
    var hovering = hoverK && LAYERS.indexOf(hoverK) >= 0 && p > .5 && p < 1.55;
    LAYERS.forEach(function(k, j){ vis[k] = smooth(.28 + j*.075, .55 + j*.075, p)*(LA[k] ? 1 : 0); });
    function al(k){ return vis[k]*after*(hovering && hoverK !== k ? .22 : 1); }
    function glow(k){ if (hl[k] > .05){ g.shadowColor = 'rgba(255,255,255,0.55)'; g.shadowBlur = 10*hl[k]*DPR; } else { g.shadowBlur = 0; } }
    // buildable (screen buffer)
    var bA = smooth(.6, 1.05, p)*(1 - smooth(1.15, 1.6, p))*(hovering ? .35 : 1);
    if (bA > .01){
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
      b.save(); setWorld(b); b.clip(LA.setback ? P2.inner : P2.parcel); b.setTransform(1, 0, 0, 1, 0, 0); b.fillStyle = bpat; b.fillRect(0, 0, buf.width, buf.height); b.restore();
      setWorld(b); b.globalCompositeOperation = 'destination-out'; b.fillStyle = '#000';
      if (LA.flood) b.fill(P2.flood); if (LA.wet) b.fill(P2.wet); if (LA.esmt) b.fill(P2.esmt); if (LA.trees) b.fill(P2.trees);
      b.globalCompositeOperation = 'source-over';
      setScreen(); g.globalAlpha = bA; g.drawImage(buf, 0, 0, Wd, Hd); setWorld(); g.globalAlpha = 1;
    }
    // zoning
    var a = al('zone'); if (a > .01){ g.globalAlpha = a; g.fillStyle = 'rgba(183,155,234,' + (0.07 + .16*hl.zone) + ')'; g.fill(P2.parcel); glow('zone'); g.strokeStyle = '#B79BEA'; lw(1.2 + hl.zone); g.setLineDash([10*PX, 4*PX, 2*PX, 4*PX]);
      g.beginPath(); g.moveTo(-1460, 250); g.lineTo(-10, 250); g.lineTo(-10, 0); g.lineTo(640, -14); g.lineTo(640, 250); g.lineTo(1440, 250); g.stroke(); g.setLineDash([]); g.shadowBlur = 0; }
    // setbacks
    a = al('setback'); if (a > .01 || hoverK === 'setback'){ var aa = hoverK === 'setback' && p >= 1.5 && p < 2.5 ? Math.max(a, .9) : a; g.globalAlpha = aa; hatch(P2.ring, BB.parcel, 5, Math.PI/4, '#BCC9E4', .55 + .4*hl.setback, 'evenodd'); glow('setback'); g.strokeStyle = '#D6DEF0'; lw(1.2 + hl.setback); g.setLineDash([8*PX, 5*PX]); g.stroke(P2.inner); g.setLineDash([]); g.shadowBlur = 0; if (hl.setback > .05){ g.globalAlpha = .2*hl.setback; g.fillStyle = '#BCC9E4'; g.fill(P2.ring, 'evenodd'); } }
    // flood
    a = al('flood'); if (a > .01){ g.globalAlpha = a; g.fillStyle = 'rgba(94,176,234,0.10)'; g.fill(P2.flood); hatch(P2.flood, BB.flood, 6, -Math.PI/4, '#5EB0EA', .7 + .3*hl.flood); glow('flood'); g.strokeStyle = '#7CC4F5'; lw(1.6 + hl.flood); strokePartial(G.flood.slice(0, G.flood.length - 1), 1, false); g.shadowBlur = 0; if (hl.flood > .05){ g.globalAlpha = .22*hl.flood; g.fillStyle = '#5EB0EA'; g.fill(P2.flood); } }
    // wetlands
    a = al('wet'); if (a > .01){ g.globalAlpha = a; g.save(); g.clip(P2.wetCore); g.fillStyle = 'rgba(87,195,140,0.12)'; g.fill(P2.wetCore);
      g.strokeStyle = '#6BD39B'; lw(1); var bbw = BB.wetCore, st = 16*PX < 7 ? 7 : 16*PX; g.beginPath();
      for (var wy = bbw[1]; wy < bbw[3]; wy += st) for (var wx = bbw[0] + ((Math.round(wy/st)) % 2)*st/2; wx < bbw[2]; wx += st){ var tsz = 3.2*PX; g.moveTo(wx - tsz, wy); g.lineTo(wx + tsz, wy); g.moveTo(wx, wy); g.lineTo(wx, wy - tsz*1.4); g.moveTo(wx, wy); g.lineTo(wx - tsz*.9, wy - tsz); g.moveTo(wx, wy); g.lineTo(wx + tsz*.9, wy - tsz); }
      g.stroke(); g.restore(); glow('wet'); g.strokeStyle = '#6BD39B'; lw(1.4 + hl.wet); g.stroke(P2.wetCore); g.setLineDash([6*PX, 5*PX]); lw(1.1 + hl.wet); g.stroke(P2.wet); g.setLineDash([]); g.shadowBlur = 0; if (hl.wet > .05){ g.globalAlpha = .2*hl.wet; g.fillStyle = '#57C38C'; g.fill(P2.wet); } }
    // easement
    a = al('esmt'); if (a > .01){ g.globalAlpha = a; hatch(P2.esmt, BB.esmt, 5, Math.PI/4, '#F0B04A', .75); hatch(P2.esmt, BB.esmt, 5, -Math.PI/4, '#F0B04A', .75); glow('esmt'); g.strokeStyle = '#FFCC77'; lw(1.3 + hl.esmt); g.stroke(P2.esmt); g.shadowBlur = 0; if (hl.esmt > .05){ g.globalAlpha = .28*hl.esmt; g.fillStyle = '#F0B04A'; g.fill(P2.esmt); } }
    // trees
    a = al('trees'); if (a > .01){ g.globalAlpha = a; glow('trees');
      if (hl.trees > .05){ g.save(); g.globalAlpha = .25*hl.trees; g.fillStyle = '#A4D77E'; g.fill(P2.trees); g.restore(); }
      G.trees.forEach(function(t){ g.strokeStyle = '#A4D77E'; lw(1.1 + hl.trees); g.setLineDash([4*PX, 4*PX]); g.beginPath(); g.arc(t[0], t[1], t[2], 0, Math.PI*2); g.stroke(); g.setLineDash([]);
        var r = t[2]*.42; lw(1.2); g.beginPath(); for (var i = 0; i < 9; i++){ var an = i/9*Math.PI*2, an2 = (i + .5)/9*Math.PI*2; var px0 = t[0] + Math.cos(an)*r, py0 = t[1] + Math.sin(an)*r; if (!i) g.moveTo(px0, py0); g.quadraticCurveTo(t[0] + Math.cos(an2)*r*1.35, t[1] + Math.sin(an2)*r*1.35, t[0] + Math.cos(an + Math.PI*2/9)*r, t[1] + Math.sin(an + Math.PI*2/9)*r); } g.stroke();
        g.beginPath(); g.moveTo(t[0] - r*.6, t[1]); g.lineTo(t[0] + r*.6, t[1]); g.moveTo(t[0], t[1] - r*.6); g.lineTo(t[0], t[1] + r*.6); g.stroke(); });
      g.shadowBlur = 0; }
    // utilities
    a = al('util'); if (a > .01){ g.globalAlpha = a; glow('util');
      g.strokeStyle = '#5EB0EA'; lw(1.6 + hl.util); g.stroke(P2.water);
      g.strokeStyle = '#F2857A'; lw(1.6 + hl.util); g.setLineDash([12*PX, 6*PX]); g.stroke(P2.sewer); g.setLineDash([3*PX, 5*PX]); lw(1.3 + hl.util); g.stroke(P2.gap); g.setLineDash([]);
      g.beginPath(); g.arc(150, 450, 5*PX + 3, 0, Math.PI*2); g.stroke(); g.shadowBlur = 0;
      var vb0 = s2w(0, 0)[0], vb1 = s2w(Wd, 0)[0];
      for (var wx2 = Math.ceil(vb0/160)*160; wx2 < vb1; wx2 += 160){ worldText('W', wx2, 404, 0, 9, '#5EB0EA', a, 'center', 600); if (wx2 < 150) worldText('S', wx2, 450, 0, 9, '#F2857A', a, 'center', 600); }
    }
    g.globalAlpha = 1; setWorld();

    // boundary + monuments
    g.strokeStyle = '#E8B45A'; lw(2 + heroPulse*.8); g.globalAlpha = 1; strokePartial(G.parcel, bnd, true);
    var mA = smooth(.85, 1, intro);
    if (mA > 0){ g.globalAlpha = mA; G.parcel.forEach(function(pt){ var r = 6*PX; lw(1.2); g.beginPath(); g.arc(pt[0], pt[1], r, 0, Math.PI*2); g.moveTo(pt[0] - r*1.8, pt[1]); g.lineTo(pt[0] + r*1.8, pt[1]); g.moveTo(pt[0], pt[1] - r*1.8); g.lineTo(pt[0], pt[1] + r*1.8); g.stroke(); });
      if (heroPulse > .01){ g.globalAlpha = heroPulse*.35; lw(1); var rr = (12 + 10*((time*.6) % 1))*PX; G.parcel.forEach(function(pt){ g.beginPath(); g.arc(pt[0], pt[1], rr, 0, Math.PI*2); g.stroke(); }); } }
    g.globalAlpha = 1;

    // ---------- concept (phase 2) ----------
    var wall = smooth(1.15, 1.8, p), stl = smooth(1.45, 1.95, p), dim = smooth(1.7, 2.1, p);
    var cFade = 1 - .35*smooth(3.5, 4.2, p) + .35*smooth(7.2, 7.8, p);
    if (wall > 0){
      g.globalAlpha = cFade;
      // drives
      g.fillStyle = 'rgba(20,32,60,0.9)'; SITE.drives.forEach(function(d){ g.fill(path(d)); });
      g.strokeStyle = 'rgba(200,214,240,0.75)'; lw(1.1); g.globalAlpha = cFade*stl; g.stroke(SITE.curbs);
      // stalls
      var n = Math.floor(SITE.stallRects.length*stl), hp = hl.park;
      g.strokeStyle = hp > .05 ? 'rgba(255,255,255,' + (.75 + .25*hp) + ')' : 'rgba(200,214,240,0.75)'; lw(1 + hp*.8); g.globalAlpha = cFade;
      if (hp > .05){ g.shadowColor = 'rgba(255,255,255,0.5)'; g.shadowBlur = 8*hp*DPR; }
      g.beginPath(); for (var i = 0; i < n; i++){ var r = SITE.stallRects[i]; if (r[4]){ g.moveTo(r[0], r[1]); g.lineTo(r[0] + r[2], r[1]); if (i === n - 1 || !SITE.stallRects[i+1] || !SITE.stallRects[i+1][4]){ g.moveTo(r[0], r[1] + r[3]); g.lineTo(r[0] + r[2], r[1] + r[3]); } } else { g.moveTo(r[0], r[1]); g.lineTo(r[0], r[1] + r[3]); var nx = SITE.stallRects[i+1]; if (!nx || nx[0] !== r[0] + 9 || nx[1] !== r[1]){ g.moveTo(r[0] + 9, r[1]); g.lineTo(r[0] + 9, r[1] + r[3]); } } } g.stroke(); g.shadowBlur = 0;
      // island + preserved tree
      if (stl > .3){ g.globalAlpha = cFade*smooth(.3, .8, stl); g.strokeStyle = 'rgba(164,215,126,0.9)'; lw(1.2); g.beginPath(); g.roundRect ? g.roundRect(212, 292, 40, 60, 10) : g.rect(212, 292, 40, 60); g.stroke(); }
      // arrows
      g.globalAlpha = cFade*stl; g.strokeStyle = 'rgba(220,230,250,0.8)'; lw(1.2);
      SITE.arrows.forEach(function(a2){ var x = a2[0], y = a2[1], o = a2[2], s = 5; g.beginPath(); if (o === 1){ g.moveTo(x - s, y - s*.7); g.lineTo(x, y); g.lineTo(x - s, y + s*.7); g.moveTo(x - s*3, y); g.lineTo(x, y); } else { g.moveTo(x - s*.7, y - s); g.lineTo(x, y); g.lineTo(x + s*.7, y - s); g.moveTo(x, y - s*3); g.lineTo(x, y); } g.stroke(); });
      // buildings
      [SITE.A, SITE.B].forEach(function(fp, bi){
        var w2 = clamp(wall*1.15 - bi*.15, 0, 1); if (w2 <= 0) return;
        var hf = hl.far, hc = hl.cov;
        g.globalAlpha = cFade*smooth(.6, 1, w2); g.fillStyle = hf > .05 ? 'rgba(52,84,150,' + (.75 + .25*hf) + ')' : 'rgba(30,48,90,0.92)'; g.fill(path(fp));
        g.globalAlpha = cFade; g.strokeStyle = hc > .05 ? '#F0B04A' : '#EEF3FC'; lw(2.2 + hc*1.2); if (hc > .05){ g.shadowColor = 'rgba(240,176,74,.7)'; g.shadowBlur = 10*hc*DPR; } strokePartial(fp, w2, true); g.shadowBlur = 0;
        if (w2 >= 1){ var ins = 3; g.strokeStyle = 'rgba(170,192,232,0.7)'; lw(.8); g.strokeRect(fp[0][0] + ins, fp[0][1] + ins, fp[1][0] - fp[0][0] - ins*2, fp[2][1] - fp[0][1] - ins*2);
          // structural grid dots
          g.fillStyle = 'rgba(170,192,232,0.55)'; for (var gx2 = fp[0][0] + 24; gx2 < fp[1][0] - 8; gx2 += 24) for (var gy2 = fp[0][1] + 19; gy2 < fp[2][1] - 6; gy2 += 19){ g.fillRect(gx2 - 1.2*PX, gy2 - 1.2*PX, 2.4*PX, 2.4*PX); } }
      });
      g.globalAlpha = cFade*stl; g.strokeStyle = 'rgba(220,230,250,0.7)'; lw(1); g.setLineDash([6*PX, 4*PX]); g.stroke(SITE.canopy); g.setLineDash([]);
      g.fillStyle = '#EEF3FC'; SITE.entries.forEach(function(e2){ var s = 4*PX + 2; g.beginPath(); g.moveTo(e2[0] - s, e2[1] + s*1.4); g.lineTo(e2[0] + s, e2[1] + s*1.4); g.lineTo(e2[0], e2[1] + .5); g.closePath(); g.fill(); });
      // dimensions
      if (dim > 0){
        g.globalAlpha = cFade*dim*(1 - .6*smooth(2.4, 2.9, p)); g.strokeStyle = '#C7D3EA'; lw(.9);
        function dimLine(x1, y1, x2, y2, off, label){
          var dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy/l, ny = dx/l, ax = x1 + nx*off, ay = y1 + ny*off, bx = x2 + nx*off, by = y2 + ny*off, t = 4*PX;
          g.beginPath(); g.moveTo(x1 + nx*(off*.2), y1 + ny*(off*.2)); g.lineTo(ax + nx*t*1.5, ay + ny*t*1.5); g.moveTo(x2 + nx*(off*.2), y2 + ny*(off*.2)); g.lineTo(bx + nx*t*1.5, by + ny*t*1.5);
          g.moveTo(ax - dx/l*t*2, ay - dy/l*t*2); g.lineTo(bx + dx/l*t*2, by + dy/l*t*2);
          [[ax, ay], [bx, by]].forEach(function(q){ g.moveTo(q[0] - (dx/l + nx)*t, q[1] - (dy/l + ny)*t); g.lineTo(q[0] + (dx/l + nx)*t, q[1] + (dy/l + ny)*t); }); g.stroke();
          var ang = upright(Math.atan2(dy, dx)); worldText(label, (ax + bx)/2 + nx*9*PX*1.2, (ay + by)/2 + ny*9*PX*1.2, ang, 10, '#DCE5F5', g.globalAlpha, 'center', 500); setWorld();
        }
        dimLine(134, 206, 302, 206, -12, ftStr(168)); dimLine(134, 282, 134, 206, -12, ftStr(76));
        dimLine(372, 342, 372, 292, -10, ftStr(50)); dimLine(372, 292, 478, 292, -10, ftStr(106));
        var sbA = (hoverK === 'setback' && p > 1.5) ? 1 : .8; g.globalAlpha = cFade*dim*sbA*(1 - .6*smooth(2.4, 2.9, p)); g.strokeStyle = hoverK === 'setback' ? '#FFFFFF' : '#C7D3EA';
        dimLine(440, 384.5, 440, 353.7, 0, '30′ FRONT'); dimLine(70, 250, 94, 250, 0, '25′');
      }
      // elevation inset
      var eA = dim*(1 - smooth(2.4, 2.9, p));
      if (eA > .01){
        var ex0 = 660, ey = 336, hgt = 24/FT, wd = 168; g.globalAlpha = eA*(1 - .35*(hoverK && hoverK !== 'height' && p < 2.5 ? 1 : 0));
        var hh = hl.height; g.strokeStyle = hh > .05 ? '#FFFFFF' : '#C7D3EA';
        lw(1); g.beginPath(); g.moveTo(ex0 - 14, ey); g.lineTo(ex0 + wd + 30, ey); g.stroke();
        g.fillStyle = 'rgba(30,48,90,0.85)'; g.fillRect(ex0, ey - hgt, wd, hgt); lw(1.6 + hh); if (hh > .05){ g.shadowColor = 'rgba(255,255,255,.6)'; g.shadowBlur = 10*hh*DPR; } g.strokeRect(ex0, ey - hgt, wd, hgt); g.shadowBlur = 0;
        lw(.8); g.beginPath(); for (var mx = ex0 + 12; mx < ex0 + wd - 6; mx += 12){ g.moveTo(mx, ey); g.lineTo(mx, ey - hgt*.55); } g.moveTo(ex0 + 6, ey - hgt*.55); g.lineTo(ex0 + wd - 6, ey - hgt*.55); g.moveTo(ex0, ey - hgt*.82); g.lineTo(ex0 + wd, ey - hgt*.82); g.stroke();
        // height dim
        g.strokeStyle = hh > .05 ? '#FFFFFF' : '#C7D3EA'; lw(.9); var dx0 = ex0 + wd + 16; g.beginPath(); g.moveTo(dx0, ey); g.lineTo(dx0, ey - hgt); g.moveTo(dx0 - 4*PX, ey + 4*PX); g.lineTo(dx0 + 4*PX, ey - 4*PX); g.moveTo(dx0 - 4*PX, ey - hgt + 4*PX); g.lineTo(dx0 + 4*PX, ey - hgt - 4*PX); g.stroke();
        worldText('±24′-0″', dx0 + 8*PX*1.4, ey - hgt/2, -Math.PI/2, 10, hh > .05 ? '#FFFFFF' : '#DCE5F5', g.globalAlpha, 'center', 500);
        worldText('SOUTH ELEVATION · RETAIL', ex0, ey + 12*PX*1.3, 0, 9.5, '#9FB0D0', g.globalAlpha, 'left', 500);
        setWorld();
      }
    }
    // ---------- redlines (phase 3) ----------
    var red = smooth(2.42, 2.85, p)*(1 - smooth(3.4, 3.8, p));
    if (red > .01){
      CLOUDS.forEach(function(c, i){
        var r = clamp(red*1.6 - i*.15, 0, 1); if (r <= 0) return; var h2 = hl[c.k];
        g.globalAlpha = r; g.strokeStyle = '#FF6B5E'; lw(1.6 + h2*1.2); if (h2 > .05){ g.shadowColor = 'rgba(255,107,94,.8)'; g.shadowBlur = 12*h2*DPR; }
        g.stroke(cloudPath(c)); g.shadowBlur = 0;
      });
      setWorld();
    }
    // ---------- sheet frame (contact) ----------
    var sh = smooth(7.2, 7.85, p);
    if (sh > .01){
      var F0 = [[-150, -150], [1010, -150], [1010, 660], [-150, 660]], F1 = [[-136, -136], [996, -136], [996, 646], [-136, 646]];
      g.globalAlpha = .9; g.strokeStyle = '#C7D3EA'; lw(1.6); strokePartial(F0, sh, true); lw(.8); strokePartial(F1, sh, true);
      if (sh > .7){
        var ta = smooth(.7, 1, sh); g.globalAlpha = ta; var tb = [700, 526, 996, 646];
        g.fillStyle = 'rgba(10,18,34,0.94)'; g.fillRect(tb[0], tb[1], tb[2] - tb[0], tb[3] - tb[1]);
        lw(1); g.strokeRect(tb[0], tb[1], tb[2] - tb[0], tb[3] - tb[1]);
        g.beginPath(); g.moveTo(tb[0], 566); g.lineTo(tb[2], 566); g.moveTo(tb[0], 596); g.lineTo(tb[2], 596); g.moveTo(880, 596); g.lineTo(880, 646); g.moveTo(940, 596); g.lineTo(940, 646); g.stroke();
        var z = VIEW.z;
        worldText('RISING SOLUTIONS GROUP', 712, 546, 0, Math.max(7, 15*z), '#EEF3FC', ta, 'left', 500, SANS);
        worldText('CONCEPT SITE PLAN · SAMPLE PARCEL · NOT FOR CONSTRUCTION', 712, 581, 0, Math.max(6, 8.5*z), '#9FB0D0', ta, 'left', 500);
        worldText('PLANNING · DEVELOPMENT · DUE DILIGENCE', 712, 621, 0, Math.max(6, 8.5*z), '#9FB0D0', ta, 'left', 500);
        worldText('SHEET', 910, 608, 0, Math.max(5, 7*z), '#9FB0D0', ta, 'center', 500);
        worldText('C-1', 910, 628, 0, Math.max(8, 16*z), '#EEF3FC', ta, 'center', 500, SANS);
        worldText('DATE', 968, 608, 0, Math.max(5, 7*z), '#9FB0D0', ta, 'center', 500);
        worldText('10.19.26', 968, 628, 0, Math.max(5, 8*z), '#EEF3FC', ta, 'center', 500);
        setWorld();
      }
    }
    g.globalAlpha = 1;
  }

  function drawLabels(p, ctxA){
    // context labels
    var ctxLab = (1 - smooth(.6, 1.0, p)) + smooth(3.6, 4.1, p)*(1 - smooth(7.2, 7.7, p));
    if (ctxLab > .02 && intro > .8){
      var vb0 = s2w(0, 0), vb1 = s2w(Wd, Hd);
      ROADS.forEach(function(r){ if (!r.lbl) return; r.lbl.forEach(function(q){ if (q[0] < vb0[0] || q[0] > vb1[0] || q[1] < vb0[1] || q[1] > vb1[1]) return; var vert = r.pts[0][0] === r.pts[1][0]; var s = w2s(q[0], q[1]); font(9.5, 500); setLS('0.18em'); var tw = g.measureText(r.name).width; setLS('0px'); if (blocked(vert ? s[0] - 8 : s[0] - tw/2, vert ? s[1] - tw/2 : s[1] - 8, vert ? 16 : tw, vert ? tw : 16)) return; worldText(r.name, q[0], q[1], vert ? -Math.PI/2 : 0, 9.5, 'rgba(200,214,240,0.8)', ctxLab*.9, 'center', 500); }); });
      if (VIEW.z > .35){ var dl = w2s(2050, -1430); if (!blocked(dl[0] - 40, dl[1] - 10, 80, 20)) worldText('DOWNTOWN', 2050, -1420, 0, 10, 'rgba(200,214,240,0.75)', ctxLab, 'center', 500); }
    }
    // hero callout
    var hc = smooth(.75, 1, intro)*(1 - smooth(.35, .75, p));
    tag('SUBJECT PARCEL · 4.20 AC', 560, 40, '#E8B45A', hc);
    // survey bearings & distances
    var narrowL = Wd < 700;
    var sv = narrowL ? 0 : smooth(.42, .8, p)*(1 - smooth(1.15, 1.45, p));
    if (sv > .02){
      for (var i = 0; i < G.parcel.length; i++){
        var a = G.parcel[i], bq = G.parcel[(i + 1) % G.parcel.length], mx = (a[0] + bq[0])/2, my = (a[1] + bq[1])/2;
        var cxp = 330, cyp = 214, dx = bq[0] - a[0], dy = bq[1] - a[1], l = Math.hypot(dx, dy), nx = -dy/l, ny = dx/l; if (nx*(mx - cxp) + ny*(my - cyp) < 0){ nx = -nx; ny = -ny; }
        var ang = upright(Math.atan2(dy, dx)), s = w2s(mx, my);
        var txt = bearing(a, bq) + '   ' + (l*FT).toFixed(2) + '′';
        font(9.5, 500); var tw = g.measureText(txt).width;
        var ox = nx*14, oy = ny*14; if (blocked(s[0] + ox - tw/2, s[1] + oy - 8, tw, 16)) continue;
        setScreen(); g.save(); g.translate(s[0] + ox, s[1] + oy); g.rotate(ang); setLS('0.06em'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = sv; g.fillStyle = '#E8C98E'; g.fillText(txt, 0, 0); g.restore(); setLS('0px'); g.textAlign = 'left';
      }
    }
    // layer tags
    var on = function(k){ return (narrowL ? 0 : 1)*vis[k]*(1 - smooth(1.15, 1.45, p))*(hoverK && LAYERS.indexOf(hoverK) >= 0 && hoverK !== k && p < 1.5 ? .3 : 1); };
    tag('C-2 · GENERAL COMMERCIAL', 262, 232, '#C9B4F2', on('zone'));
    tag('SETBACK LINE', 470, 360, '#D6DEF0', on('setback'));
    tag('FLOOD ZONE', 588, 110, '#7CC4F5', on('flood'));
    tag('WETLAND + BUFFER', 132, 96, '#6BD39B', on('wet'));
    tag('20′ DRAINAGE EASEMENT', 335, 120, '#FFCC77', on('esmt'));
    tag('SPECIMEN TREES', 402, 136, '#B8E48E', on('trees'));
    tag('±380′ TO SEWER', 150, 452, '#FF9C8F', on('util'));
    tag('R-1 · SINGLE-FAMILY', 300, -40, '#C9B4F2', on('zone')*.9, {lead:0});
    // building labels
    var bl = smooth(1.75, 2.1, p)*(1 - smooth(2.45, 2.8, p) * .5)*(1 - smooth(3.5, 4, p));
    if (bl > .02){
      [[218, 244, 'RETAIL', '±' + fmt(SF_A) + ' SF'], [425, 317, 'OUTPARCEL', '±' + fmt(SF_B) + ' SF']].forEach(function(t){ var s = w2s(t[0], t[1]); if (blocked(s[0] - 50, s[1] - 16, 100, 32)) return; worldText(t[2], t[0], t[1], 0, 11, '#FFFFFF', bl, 'center', 600); var s2 = s2w(s[0], s[1] + 15); worldText(t[3], s2[0], s2[1], 0, 10, '#C7D3EA', bl, 'center', 500); });
    }
    // site data table
    var tA = smooth(1.75, 2.15, p)*(1 - smooth(2.4, 2.8, p));
    if (tA > .02){
      var s = w2s(650, 46), tw2 = 220, rows = [['GROSS AREA', GROSS.toFixed(2) + ' AC', ''], ['ZONING', 'C-2', ''], ['BUILDING AREA', fmt(SF_A + SF_B) + ' SF', 'far'], ['FLOOR AREA RATIO', ((polyArea(G.bldA) + polyArea(G.bldB))/PARCEL_PX).toFixed(2), 'far'], ['LOT COVERAGE', Math.round(COVER*100) + '%', 'cov'], ['PARKING PROVIDED', SITE.nStalls + ' SP', 'park'], ['HEIGHT', '±24′ · 1 STORY', 'height'], ['SETBACKS', '30′ / 25′ / 25′', 'setback']];
      var rh = 19, th = 30 + rows.length*rh;
      if (!blocked(s[0], s[1], tw2, th)){
        setScreen(); g.globalAlpha = tA; g.fillStyle = 'rgba(8,14,28,0.92)'; g.fillRect(s[0], s[1], tw2, th); g.strokeStyle = 'rgba(199,211,234,0.8)'; g.lineWidth = 1; g.strokeRect(s[0] + .5, s[1] + .5, tw2 - 1, th - 1);
        font(9.5, 600); setLS('0.14em'); g.fillStyle = '#EEF3FC'; g.textBaseline = 'middle'; g.fillText('SITE DATA', s[0] + 12, s[1] + 15); setLS('0.04em');
        rows.forEach(function(r, i){ var y = s[1] + 30 + i*rh, hot = r[2] && hoverK === r[2]; g.strokeStyle = 'rgba(199,211,234,0.18)'; g.beginPath(); g.moveTo(s[0] + 1, y); g.lineTo(s[0] + tw2 - 1, y); g.stroke();
          if (hot){ g.fillStyle = 'rgba(158,194,255,0.16)'; g.fillRect(s[0] + 1, y, tw2 - 2, rh); }
          font(9.5, 500); g.fillStyle = hot ? '#FFFFFF' : '#9FB0D0'; g.textAlign = 'left'; g.fillText(r[0], s[0] + 12, y + rh/2); g.fillStyle = hot ? '#FFFFFF' : '#EEF3FC'; g.textAlign = 'right'; g.fillText(r[1], s[0] + tw2 - 12, y + rh/2); g.textAlign = 'left'; });
        setLS('0px'); g.globalAlpha = 1;
      }
    }
    // redline tags
    var red = smooth(2.5, 2.9, p)*(1 - smooth(3.4, 3.8, p));
    if (red > .02){
      CLOUDS.forEach(function(c){
        var s = w2s(c.x, c.y), h2 = hl[c.k], sc = Math.min(1, VIEW.z/1.25), tx = s[0] + c.tx*sc, ty = s[1] + c.ty*sc; font(10.5, 600); setLS('0.06em'); var tw = g.measureText(c.t).width + 44; setLS('0px');
        var bx = tx - (c.tx < 0 ? tw : 0), by = ty - 14; if (blocked(bx, by, tw, 28)) return;
        setScreen(); g.globalAlpha = red; g.strokeStyle = '#FF6B5E'; g.lineWidth = 1 + h2;
        var e = w2s(c.x + (c.tx > 0 ? c.rx : -c.rx)*.7, c.y + (c.ty > 0 ? c.ry : -c.ry)*.7);
        g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(c.tx < 0 ? bx + tw : bx, ty); g.stroke();
        g.fillStyle = h2 > .05 ? 'rgba(255,107,94,0.22)' : 'rgba(8,14,28,0.9)'; g.fillRect(bx, by, tw, 28); g.strokeRect(bx + .5, by + .5, tw - 1, 27);
        g.beginPath(); g.arc(bx + 16, ty, 9, 0, Math.PI*2); g.fillStyle = '#FF6B5E'; g.fill();
        font(10, 700); g.fillStyle = '#0A1222'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c.n), bx + 16, ty + .5); g.textAlign = 'left';
        font(10.5, 600); setLS('0.06em'); g.fillStyle = '#FFD9D4'; g.fillText(c.t, bx + 32, ty + .5); setLS('0px');
      });
      g.globalAlpha = 1;
    }
    // canvas hover tooltip
    if (canvasHover && FINE && ptr.inside && !ptr.overUI){
      var names = {zone:'Zoning: C-2 General Commercial', setback:'Setbacks', flood:'Flood zone', wet:'Wetlands + buffer', esmt:'Drainage easement', trees:'Specimen trees', util:'Sewer ±380 ft away', far:'Floor area', park:'Parking: ' + SITE.nStalls + ' spaces', cov:'Lot coverage'};
      var nm = names[canvasHover]; if (nm){ var imp = single[canvasHover] ? '  −' + (single[canvasHover]/PARCEL_PX*GROSS).toFixed(2) + ' ac' : ''; var txt = nm + imp;
        setScreen(); font(12, 500, SANS); var tw = g.measureText(txt).width + 20; var x = Math.min(ptr.x + 16, Wd - tw - 8), y = ptr.y + 18; g.globalAlpha = 1; g.fillStyle = 'rgba(238,243,252,0.96)'; g.fillRect(x, y, tw, 26); g.fillStyle = '#0A1222'; g.textBaseline = 'middle'; g.fillText(txt, x + 10, y + 13.5); }
    }
  }

  function drawHUD(p){
    if (Wd < 821) return;
    setScreen(); var x1 = Wd - 26, y = Hd - 30, scales = [20, 50, 100, 200, 500, 1000, 2000, 5000], sc = scales[0];
    for (var i = 0; i < scales.length; i++){ if (scales[i]/FT*VIEW.z <= 150) sc = scales[i]; }
    var len = sc/FT*VIEW.z, x0 = x1 - len, hudL = x0 - 70;
    if (panelRect && hudL < panelRect.right + 10 && Hd - 80 < panelRect.bottom) return;
    g.globalAlpha = .9; g.strokeStyle = '#C7D3EA'; g.fillStyle = '#C7D3EA'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.moveTo(x0, y - 5); g.lineTo(x0, y + 5); g.moveTo(x1, y - 5); g.lineTo(x1, y + 5); g.moveTo((x0 + x1)/2, y - 3); g.lineTo((x0 + x1)/2, y + 3); g.stroke();
    g.fillRect(x0, y - 2, len/2, 4);
    font(9.5, 500); setLS('0.1em'); g.textBaseline = 'alphabetic'; g.textAlign = 'center'; g.fillText('0', x0, y - 9); g.fillText(fmt(sc) + ' FT', x1 - 12, y - 9); g.textAlign = 'left';
    // north arrow
    var nx = x0 - 34, ny = y; g.beginPath(); g.moveTo(nx, ny - 20); g.lineTo(nx + 6, ny + 2); g.lineTo(nx, ny - 3); g.closePath(); g.fill(); g.beginPath(); g.moveTo(nx, ny - 20); g.lineTo(nx - 6, ny + 2); g.lineTo(nx, ny - 3); g.closePath(); g.stroke();
    g.textAlign = 'center'; g.fillText('N', nx, ny - 25); g.textAlign = 'left';
    // coordinates
    if (FINE && ptr.inside){ var w = s2w(ptr.x, ptr.y); var t = 'E ' + fmt(Math.round((E0 + w[0]*FT)*100)/100) + '   N ' + fmt(Math.round((N0 - w[1]*FT)*100)/100); g.textAlign = 'right'; g.globalAlpha = .7; g.fillText(t, x1, y + 20); g.textAlign = 'left'; }
    setLS('0px'); g.globalAlpha = 1;
  }

  /* ---------- loop ---------- */
  var sig = '';
  function frame(now){
    requestAnimationFrame(frame);
    if (document.hidden) return;
    var dt = Math.min((now - last)/1000, .05); last = now; time += dt;
    var p = progress();
    pSm += (p - pSm)*(REDUCED ? 1 : 1 - Math.exp(-dt*5)); if (Math.abs(p - pSm) < .0005) pSm = p;
    setChapter(clamp(Math.round(p), 0, chapters.length - 1));
    if (intro < 1){ intro = Math.min(1, intro + dt/2.8); dirty = true; }
    // hover
    var ch = hitTest(); if (ch !== canvasHover){ canvasHover = ch; dirty = true; }
    var listHover = hoverK; if (canvasHover){ hoverK = canvasHover; hoverSrc = 'canvas'; } else if (hoverSrc === 'canvas'){ hoverK = null; hoverSrc = null; }
    syncListHot(canvasHover);
    var anim = false;
    for (var k in hl){ var tgt = hoverK === k ? 1 : 0; var nv = hl[k] + (tgt - hl[k])*(1 - Math.exp(-dt*10)); if (Math.abs(nv - tgt) < .002) nv = tgt; if (nv !== hl[k]){ hl[k] = nv; anim = true; } }
    var parMoving = Math.abs(par.x + ptr.nx*10) > .05 || Math.abs(par.y + ptr.ny*6) > .05;
    var heroAnim = pSm < 1 && !REDUCED;
    var s = pSm.toFixed(4);
    if (!(dirty || anim || parMoving || heroAnim || s !== sig)) return;
    sig = s; dirty = false;
    draw();
  }

  /* ---------- build ---------- */
  var steps = [genRoads, genWater, genFabric, genContours, genSite, function(){ BB.parcel = bbox(G.parcel); BB.flood = bbox(G.flood); BB.wetCore = bbox(G.wetCore); BB.esmt = bbox(G.esmt); }];
  var si = 0;
  function next(){
    if (si < steps.length){ try { steps[si](); } catch(e){ console.error('build step', si, e); } si++; setLoad(.1 + .85*si/steps.length); setTimeout(next, 0); return; }
    resize(); addEventListener('resize', function(){ resize(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ dirty = true; });
    $('#parkV').textContent = SITE.nStalls + ' spaces'; $('#farV').textContent = ((polyArea(G.bldA) + polyArea(G.bldB))/PARCEL_PX).toFixed(2); $('#covV').textContent = Math.round(COVER*100) + '%';
    requestAnimationFrame(frame);
    done({layersChanged:function(a){ LA = a; dirty = true; }});
  }
  next();
}

computeAnchors(); setChapter(0);
refresh();
var cvTest = document.createElement('canvas');
if (cvTest.getContext && cvTest.getContext('2d') && window.Path2D){
  setLoad(.05);
  try { engine(function(w){ W = w; refresh(); computeAnchors(); finishLoad(); }); }
  catch(err){ console.error(err); html.classList.add('nogl'); finishLoad(); }
} else { html.classList.add('nogl'); finishLoad(); }
addEventListener('scroll', function(){ if (!W){ setChapter(clamp(Math.round(progress()), 0, chapters.length - 1)); } }, {passive:true});
})();

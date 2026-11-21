/* Antidote Rush (easter egg 10, ED&G Pharmacy Portal). Self-contained 3D driving game: the pharmacy response van drives west to east along the
   Sussex coast road past Worthing Pier, the West Pier ruins, the i360, Brighton Palace Pier and the Royal Pavilion, delivering antidote vials to
   the Royal Sussex County Hospital. Free driving with real vehicle controls (W/Up gas, S/Down brake and reverse, A/D steer, Shift boost,
   Space handbrake), collisions with traffic and walls, potholes that slow you down, a minimap and a timed route. Esc or Exit leaves.
   three.js r128 is hosted in vendor/three-r128.min.js. Only the weekly best scores are shared (submit_drive_score / get_drive_weekly). */
(function () {
"use strict";
if (window.PortalRush) return;
let root = null, stopFn = null, loading = false;
const CSS = `#arRoot body{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:12px}
#arRoot .arg{position:relative;width:100%;aspect-ratio:16/10;max-height:72vh;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 18px 40px -20px #000;touch-action:none;user-select:none}
#arRoot canvas{display:block;width:100%;height:100%}
#arRoot .hud{position:absolute;left:14px;right:14px;top:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;font-weight:800;font-size:17px;text-shadow:0 2px 6px rgba(0,0,0,.7);pointer-events:none;color:#fff}
#arRoot .hud small{display:block;font-weight:600;font-size:11px;opacity:.8}
#arRoot .meter{width:120px;height:10px;border-radius:6px;background:rgba(255,255,255,.25);overflow:hidden;margin-top:4px}
#arRoot .meter i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#00b8e6,#4caf50)}
#arRoot .loc{position:absolute;left:14px;top:58px;font-weight:700;font-size:12.5px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.8);pointer-events:none;max-width:40%}
#arRoot .banner{position:absolute;left:50%;top:24%;transform:translate(-50%,-8px);opacity:0;transition:opacity .35s,transform .35s;background:rgba(10,24,60,.74);border:1px solid rgba(255,255,255,.35);padding:8px 18px;border-radius:999px;font-weight:800;font-size:clamp(14px,2.6vw,19px);color:#fff;pointer-events:none;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis}
#arRoot .banner.on{opacity:1;transform:translate(-50%,0)}
#arRoot .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;background:rgba(10,18,44,.7);padding:16px;color:#fff}
#arRoot .ov[hidden]{display:none}
#arRoot .ov h2{margin:0;font-size:32px;letter-spacing:-.5px}
#arRoot .ov .sub{color:#c9d6f5;max-width:46ch}
#arRoot button{font:inherit;font-weight:800;padding:10px 24px;border-radius:10px;border:0;background:#00b8e6;color:#fff;cursor:pointer}
#arRoot .rule{display:flex;height:3px;width:90px;border-radius:2px;overflow:hidden}
#arRoot .rule span{flex:1}
#arRoot .rule span:nth-child(1){background:#fff}
#arRoot .rule span:nth-child(2){background:#00b8e6}
#arRoot .rule span:nth-child(3){background:#4caf50}
#arRoot .keys{font-size:12.5px;color:#c9d6f5}
#arRoot{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at 50% 30%,#14235c 0,#070d26 75%);display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif;color:#eef2ff}
#arRoot .arx{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.08);color:#dfe6ff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px 14px;font:600 14px 'Segoe UI',Arial,sans-serif;cursor:pointer;z-index:3}
#arRoot .arx:hover{background:rgba(255,255,255,.18)}
#arRoot .ars{position:absolute;top:14px;right:84px;background:rgba(255,255,255,.08);color:#dfe6ff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px 14px;font:600 14px 'Segoe UI',Arial,sans-serif;cursor:pointer;z-index:3}
#arRoot .ars:hover{background:rgba(255,255,255,.18)}
#arRoot .arg{width:min(96vw,calc(86vh*1.6));max-height:none;aspect-ratio:16/10;border:2px solid #1d2c6b;box-shadow:0 0 0 1px #000,0 0 40px rgba(0,184,230,.18)}
#arRoot .ov{background:rgba(12,22,64,.78)}
#arRoot .ov .brand{font:800 15px 'Segoe UI',Arial,sans-serif;letter-spacing:.08em;color:#fff}
#arRoot .arh{color:#9fb0d6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
#arRoot .arr{display:flex;justify-content:space-between;gap:18px;color:#d5defa;font-size:14px;padding:1px 0}
#arRoot .arr.me{color:#00cfff}
#arRoot .arb{min-width:210px}
#arRoot .meter.hp{width:110px;margin:4px auto 0}
#arRoot .meter.hp i{background:#4caf50}
#arRoot .hud b{font-weight:800}
#arRoot .gps{position:absolute;left:14px;top:78px;font-weight:700;font-size:12px;color:#baf5ca;text-shadow:0 2px 6px rgba(0,0,0,.8);pointer-events:none;max-width:44%}
#arRoot .map{position:absolute;left:12px;bottom:12px;width:min(36%,250px);height:auto;border-radius:10px;border:1px solid rgba(255,255,255,.28);pointer-events:none}
#arRoot .tc{display:none}
@media (pointer:coarse){#arRoot .tc{display:block}#arRoot .map{left:auto;right:12px;top:78px;bottom:auto;width:28%}}
#arRoot .tc .tl{position:absolute;left:8px;bottom:8px;display:flex;gap:6px}
#arRoot .tc .tr{position:absolute;right:8px;bottom:8px;display:flex;gap:6px}
#arRoot .tc button{min-width:50px;height:50px;padding:0 8px;border-radius:14px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);color:#fff;font-size:16px;touch-action:none}
`;
const HTML = `<button class="arx" type="button">Exit</button><button class="ars snd" type="button">Sound on</button><div class="arg" id="arstage"><div class="hud"><div><span id="artm">2:30</span><small>time left &middot; score <b id="arsc">0</b></small></div><div style="text-align:center"><span id="arvi">0</span> vials<div class="meter hp"><i id="arhp"></i></div><small>van health</small></div><div style="text-align:right"><span id="arsp">0</span> mph<div class="meter"><i id="arbo"></i></div><small id="arbest">Best 0</small></div></div><div class="loc" id="arloc"></div><div class="gps" id="argps"></div><div class="banner" id="arbn"></div><canvas class="map" id="armap" width="320" height="110"></canvas><div class="tc" id="artc"><div class="tl"><button type="button" data-k="left">Left</button><button type="button" data-k="right">Right</button></div><div class="tr"><button type="button" data-k="boost">Boost</button><button type="button" data-k="down">Brake</button><button type="button" data-k="up">Gas</button></div></div><div class="ov" id="arov"><div class="brand">ED&amp;G&trade;</div><div class="rule"><span></span><span></span><span></span></div><h2>Antidote Rush</h2><div class="sub">Drive the pharmacy response van along the Sussex coast from Worthing to the Royal Sussex County Hospital in Brighton. Follow the map, watch the traffic and potholes, grab vials, and park in the green ring before time runs out.</div><div class="arb" id="arboard"></div><button id="argo" type="button">Start the run</button><div class="keys">W / Up gas &middot; S / Down brake and reverse &middot; A / D or Left / Right steer &middot; Shift boost &middot; Space handbrake &middot; Esc to exit</div></div></div>`;
function build() {
  const $ = id => root.querySelector("#ar" + id);
  const stage = root.querySelector(".arg"), ov = $("ov");
  const scEl = $("sc"), viEl = $("vi"), spEl = $("sp"), boEl = $("bo"), bestEl = $("best"), locEl = $("loc"), bnEl = $("bn");
  let dead = false, raf = 0, bonus = 0, bt = 0, held = null; const offs = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputEncoding = THREE.sRGBEncoding;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  const FOG = 0xffc7a0;
  const scene = new THREE.Scene();
  const skyC = document.createElement("canvas"); skyC.width = 4; skyC.height = 256; const sx = skyC.getContext("2d");
  const gr = sx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#3a68b4"); gr.addColorStop(.3, "#8fb5e4"); gr.addColorStop(.43, "#ffd3a8"); gr.addColorStop(.5, "#ffc7a0"); gr.addColorStop(1, "#ffc7a0");
  sx.fillStyle = gr; sx.fillRect(0, 0, 4, 256);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 16, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyC), side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false })); sky.renderOrder = -10; scene.add(sky);
  scene.fog = new THREE.Fog(FOG, 55, 185);
  const cam = new THREE.PerspectiveCamera(62, 16 / 10, .1, 210);
  cam.position.set(0, 3.5, 8.4); cam.lookAt(0, 1.3, -12);
  scene.add(new THREE.HemisphereLight(0xdbe6ff, 0xc9a48c, .85));
  const sun = new THREE.DirectionalLight(0xffd0a0, 1.5); sun.position.set(14, 16, -16); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -24, far: 70 }); scene.add(sun); scene.add(sun.target);
  const SUNP = [36, 20, -175];
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false })); sunDisc.position.set(...SUNP); scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .28, fog: false, depthWrite: false })); sunGlow.position.set(...SUNP); scene.add(sunGlow);

  // ---------- Helpers and materials ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const col = (c, r = .9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const B = (w, h, d, mat, x = 0, y = 0, z = 0, cast = false) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; return m; };
  const CY = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); return m; };
  const mSand = col(0xe3cfa0, 1), mWet = col(0xbda57a, 1), mProm = col(0xcfc9bf), mRoad = col(0x3b3e48, .9), mLand = col(0x688655, 1), mHill = col(0x7c9a5e, 1), mSlate = col(0x4a4f5a, .8);
  const mWood = col(0x8a6a4a), mIron = col(0x2e3440, .6, .4), mWhite = col(0xf4f1ea, .6), mCream = col(0xf1e2c4, .7), mTeal = col(0x2aa6a0, .5), mRust = col(0x5b3a2a, .9, .3), mGoldM = col(0xd8a52a, .4, .7);
  const mBulb = new THREE.MeshBasicMaterial({ color: 0xfff0b0 }), mCyanB = new THREE.MeshBasicMaterial({ color: 0x00cfff });
  const mLine = new THREE.MeshBasicMaterial({ color: 0xf3f5fa }), mYel = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const mPole = col(0x2a2f3a, .6, .5), mLamp = new THREE.MeshBasicMaterial({ color: 0xfff0b0 });
  const bulbG = new THREE.SphereGeometry(.16, 8, 6);
  const mSail = col(0xffffff, .7), mHull = [col(0xd6483a), col(0x2d4f9e), col(0x222831), col(0xf2c14e)];
  const hutCols = [0xe8575a, 0x3aa6b9, 0xf2c14e, 0x7bc47f, 0xf28ab2, 0xffffff, 0x6a7fd6].map(c => col(c, .7));

  // sea
  function seaTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#9fc3d2"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 320; i++) { const px = Math.random() * 230, py = Math.random() * 256, l = 8 + Math.random() * 24; x.strokeStyle = Math.random() < .5 ? "rgba(255,255,255,.45)" : "rgba(30,90,125,.4)"; x.lineWidth = 1 + Math.random() * 1.6; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 3, px + l, py); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t; }
  const seaT = seaTex();

  // terrace facades (left of the road)
  function facade(base, floors) { const c = document.createElement("canvas"); c.width = 128; c.height = floors * 42; const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 128, c.height);
    for (let f = 0; f < floors; f++) { x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(0, f * 42, 128, 3);
      for (let q = 0; q < 3; q++) { const wx = 12 + q * 38, wy = f * 42 + 9; x.fillStyle = "#ffffff"; x.fillRect(wx - 3, wy - 3, 28, 34); x.fillStyle = Math.random() < .12 ? "#ffd98a" : "#3b4a66"; x.fillRect(wx, wy, 22, 28); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(wx + 10, wy, 2, 28); } }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t; }
  const pastel = ["#f3e6cf", "#efd2cd", "#d5e2ee", "#fbf6ea", "#f1e6b6", "#d8e8d5"];
  const terr = pastel.map(c => [3, 4, 5].map(f => new THREE.MeshStandardMaterial({ map: facade(c, f), roughness: .85 })));



  // ---------- Vehicle parts (shared by the van and the traffic) ----------
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x101c2c, roughness: .08, metalness: .7 }), mTyre = col(0x141418, .95), mChrome = col(0xcfd4dc, .25, .8), mBlk = col(0x15171c, .6), mArch = new THREE.MeshBasicMaterial({ color: 0x0b0c10 });
  const mHead = new THREE.MeshStandardMaterial({ color: 0xf8fbff, emissive: 0xdfeeff, emissiveIntensity: .6, roughness: .15 }), mAmber = new THREE.MeshBasicMaterial({ color: 0xffa31a });
  const rimTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#1a1c22"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#c9ced8"; g.beginPath(); g.arc(32, 32, 30, 0, 6.3); g.fill(); g.fillStyle = "#2a2d35";
    for (let i = 0; i < 5; i++) { g.save(); g.translate(32, 32); g.rotate(i * Math.PI * 2 / 5 + .3); g.beginPath(); g.moveTo(8, -4); g.lineTo(27, -6); g.lineTo(27, 6); g.lineTo(8, 4); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = "#8b919c"; g.beginPath(); g.arc(32, 32, 7, 0, 6.3); g.fill(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
  const mRim = new THREE.MeshStandardMaterial({ map: rimTex, roughness: .35, metalness: .5 });
  function wheel(r, wd, side) { const g = new THREE.Group(), t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 20), mTyre); t.rotation.z = Math.PI / 2; t.castShadow = true; g.add(t);
    const rim = new THREE.Mesh(new THREE.CircleGeometry(r * .66, 20), mRim); rim.rotation.y = side * Math.PI / 2; rim.position.x = side * (wd / 2 + .003); g.add(rim); return g; }
  function plateMesh(front, w, h) { const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d"); g.fillStyle = front ? "#f4f4f4" : "#f2c200"; g.fillRect(0, 0, 128, 32); g.strokeStyle = "#222"; g.lineWidth = 2; g.strokeRect(1, 1, 126, 30);
    g.fillStyle = "#111"; g.font = "700 22px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; const Lt = () => String.fromCharCode(65 + Math.floor(Math.random() * 26)); g.fillText(Lt() + Lt() + (10 + Math.floor(Math.random() * 15)) + " " + Lt() + Lt() + Lt(), 64, 17);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t })); }
  function shapeGeo(pts, depth) { const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2 }); g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); return g; }
  function arches(g, w, r, zs, wd) { zs.forEach(zz => [-1, 1].forEach(sx => { const wh = wheel(r, wd, sx); wh.position.set(sx * (w / 2 - .05), r, zz); g.add(wh); wheels2.push(wh); const ar = new THREE.Mesh(new THREE.CircleGeometry(r + .07, 20), mArch); ar.rotation.y = sx * Math.PI / 2; ar.position.set(sx * (w / 2 + .056), r, zz); g.add(ar); })); }
  const wheels2 = [];
  const PROF = {
    sedan: { L: 4.5, w: 1.82, r: .33, belt: .97, low: [[.05, .32], [0, .55], [.1, .78], [.9, .9], [1.3, .97], [3.5, .97], [4.2, .95], [4.5, .8], [4.48, .45], [4.4, .32]], gl: [[1.35, .97], [2.05, 1.42], [3.15, 1.42], [3.75, .97]], roof: [2.05, 3.15, 1.42] },
    hatch: { L: 3.9, w: 1.74, r: .31, belt: .95, low: [[.05, .3], [0, .52], [.1, .75], [.8, .88], [1.15, .95], [3.5, .95], [3.9, .85], [3.88, .45], [3.8, .3]], gl: [[1.2, .95], [1.8, 1.42], [3.0, 1.45], [3.75, .97]], roof: [1.8, 3.0, 1.45] },
    suv: { L: 4.6, w: 1.95, r: .38, belt: 1.12, low: [[.05, .38], [0, .7], [.12, .98], [.9, 1.08], [1.25, 1.12], [4.3, 1.12], [4.6, 1.0], [4.58, .55], [4.5, .38]], gl: [[1.3, 1.12], [1.9, 1.72], [4.1, 1.72], [4.45, 1.12]], roof: [1.9, 4.1, 1.72] }
  };
  const geoC = {}, paints = [0xf2f2f2, 0xc9ccd1, 0x1c1f26, 0x5b6068, 0x1f3a73, 0xa72b2b, 0x2f5d3a, 0xe9e3d3, 0x8a1f3d];
  function frontKit(g, w, z0, yB, yG, yH) { // grille, headlights, bumper, plate, indicators on a front face at z0
    g.add(B(w * .46, .15, .05, mBlk, 0, yG, z0 - .05)); g.add(B(w * .46, .025, .055, mChrome, 0, yG + .03, z0 - .052)); g.add(B(w * .56, .1, .05, mBlk, 0, yB - .12, z0 - .04));
    [-1, 1].forEach(s => { const h = B(.42, .13, .06, mHead, s * (w / 2 - .33), yH, z0 - .04); h.rotation.y = s * .18; g.add(h); g.add(B(.14, .05, .06, mAmber, s * (w / 2 - .1), yH - .08, z0 - .03)); });
    const pm = plateMesh(true, .5, .11); pm.position.set(0, yB, z0 - .075); pm.rotation.y = Math.PI; g.add(pm); }
  function car(kind) {
    if (kind === "truck") return lorry();
    const ty = ["sedan", "hatch", "suv"][Math.floor(Math.random() * 3)], P = PROF[ty], g = new THREE.Group(), w = P.w, L = P.L, z0 = -L / 2, belt = P.belt, paint = new THREE.MeshStandardMaterial({ color: paints[Math.floor(Math.random() * paints.length)], roughness: .35, metalness: .3 });
    if (!geoC[ty]) geoC[ty] = { low: shapeGeo(P.low, w - .1), gl: shapeGeo(P.gl, w - .24) };
    const lo = new THREE.Mesh(geoC[ty].low, paint); lo.position.z = z0; lo.castShadow = true; g.add(lo); const gl = new THREE.Mesh(geoC[ty].gl, mGlass); gl.position.z = z0; g.add(gl);
    g.add(B(w - .2, .05, P.roof[1] - P.roof[0], paint, 0, P.roof[2] + .02, z0 + (P.roof[0] + P.roof[1]) / 2)); g.add(B(w - .1, P.roof[2] - belt, .07, paint, 0, (belt + P.roof[2]) / 2, z0 + (P.roof[0] + P.roof[1]) / 2 + .1));
    frontKit(g, w, z0, belt - .47, belt - .3, belt - .25);
    [-1, 1].forEach(s => { g.add(B(.1, .09, .17, paint, s * (w / 2 + .06), belt + .06, z0 + 1.45)); g.add(B(.05, .05, .14, mBlk, s * (w / 2 - .02), belt + .03, z0 + 1.4)); g.add(B(.4, .14, .05, tl, s * (w / 2 - .33), belt - .22, -z0 + .04)); });
    g.add(B(w - .2, .14, .08, mBlk, 0, .42, -z0 + .03)); const rp = plateMesh(false, .5, .11); rp.position.set(0, belt - .42, -z0 + .075); g.add(rp);
    arches(g, w, P.r, [z0 + .85, -z0 - .85], .24);
    g.userData = { kind: "car", w: w / 2, l: L / 2, v: 12 }; return g; }
  function lorry() {
    const g = new THREE.Group(), w = 2.3, L = 7.4, z0 = -L / 2, cabP = new THREE.MeshStandardMaterial({ color: paints[Math.floor(Math.random() * paints.length)], roughness: .4, metalness: .2 }), boxM = col([0xf2f2f2, 0xe9edf2, 0xdfe6ee][Math.floor(Math.random() * 3)], .6), strip = col([0x1d3f8f, 0xd9253a, 0x12a0ad][Math.floor(Math.random() * 3)], .5);
    const cab = new THREE.Mesh(shapeGeo([[0, .55], [0, 2.35], [.22, 2.55], [2.0, 2.55], [2.0, .55]], w - .1), cabP); cab.position.z = z0; cab.castShadow = true; g.add(cab);
    g.add(B(w - .35, .85, .04, mGlass, 0, 1.98, z0 - .05)); [-1, 1].forEach(s => { g.add(B(.03, .75, 1.1, mGlass, s * (w / 2 + .01), 1.95, z0 + 1.0)); g.add(B(.12, .5, .2, mBlk, s * (w / 2 + .2), 2.0, z0 + .25)); g.add(B(.3, .22, .07, mHead, s * 1.02, .85, z0 - .05)); g.add(B(.12, .05, .06, mAmber, s * 1.02, .64, z0 - .05)); g.add(B(.2, .35, .05, tl, s * (w / 2 - .2), 1.0, L / 2 + .03)); });
    g.add(B(1.5, .7, .06, mBlk, 0, 1.0, z0 - .05)); [.8, 1.0, 1.2].forEach(y => g.add(B(1.5, .03, .07, mChrome, 0, y, z0 - .056))); [-.5, 0, .5].forEach(x => g.add(B(.2, .1, .1, mAmber, x, 2.62, z0 + .2)));
    g.add(B(w, .3, .2, mBlk, 0, .5, z0 - .1)); const pm = plateMesh(true, .5, .11); pm.position.set(0, .5, z0 - .21); pm.rotation.y = Math.PI; g.add(pm);
    const bl = L - 2.15, bz = z0 + 2.15 + bl / 2; g.add(B(w, 2.55, bl, boxM, 0, 2.125, bz, true)); g.add(B(w + .02, .2, bl, strip, 0, 1.6, bz)); g.add(B(w - .3, .3, L - .5, mBlk, 0, .7, .2));
    g.add(B(.03, 2.4, .03, mBlk, 0, 2.1, L / 2 + .02)); g.add(B(w, .2, .15, mBlk, 0, .62, L / 2 + .1)); const rp = plateMesh(false, .5, .11); rp.position.set(0, .9, L / 2 + .18); g.add(rp);
    arches(g, w + .1, .5, [z0 + 1.2, L / 2 - 1.4, L / 2 - 2.7], .32);
    g.userData = { kind: "car", w: w / 2, l: L / 2, v: 9 }; return g; }
  const winTex = hex => { const c = document.createElement("canvas"); c.width = 64; c.height = 32; const x = c.getContext("2d"); x.fillStyle = "#101c2c"; x.fillRect(0, 0, 64, 32); x.fillStyle = hex; x.fillRect(0, 0, 7, 32); x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(10, 3, 22, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); t.encoding = THREE.sRGBEncoding; return t; };
  function busCar() {
    const g = new THREE.Group(), hex = Math.random() < .5 ? 0xd9253a : 0x1d3f8f, css = "#" + hex.toString(16).padStart(6, "0"), w = 2.5, L = 9.8, z0 = -L / 2, m = col(hex, .45, .2), wm = new THREE.MeshStandardMaterial({ map: winTex(css), roughness: .1, metalness: .5 });
    g.add(B(w, 4.0, L, m, 0, 2.4, 0, true)); [[1.95, 1.0], [3.45, .95]].forEach(([y, h]) => g.add(B(w + .04, h, 8.4, wm, 0, y, .3)));
    g.add(B(2.2, 1.0, .05, mGlass, 0, 1.95, z0 - .02)); g.add(B(2.2, .95, .05, mGlass, 0, 3.45, z0 - .02)); g.add(B(w - .3, .12, L - .6, col(0x555b66, .8), 0, 4.45, 0));
    const c = document.createElement("canvas"); c.width = 128; c.height = 26; const x = c.getContext("2d"); x.fillStyle = "#0a0a0a"; x.fillRect(0, 0, 128, 26); x.fillStyle = "#ffb020"; x.font = "800 20px monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(["7 BRIGHTON", "21 HOVE", "1 WORTHING", "5 MARINA"][Math.floor(Math.random() * 4)], 64, 14);
    const dt = new THREE.CanvasTexture(c); dt.encoding = THREE.sRGBEncoding; const db = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .34), new THREE.MeshBasicMaterial({ map: dt })); db.position.set(0, 4.12, z0 - .02); db.rotation.y = Math.PI; g.add(db);
    [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .06, 14), mHead); h.rotation.x = Math.PI / 2; h.position.set(s * .85, .95, z0 - .04); g.add(h); g.add(B(.08, .6, .3, mBlk, s * (w / 2 + .55), 2.2, z0 + .5)); g.add(B(.06, .06, .5, mBlk, s * (w / 2 + .3), 2.3, z0 + .5)); g.add(B(.3, .16, .05, tl, s * .9, 1.0, L / 2 + .03)); });
    g.add(B(1.4, .45, .05, mBlk, 0, .85, z0 - .03)); g.add(B(w + .04, .3, .18, mBlk, 0, .55, z0 - .08)); const pm = plateMesh(true, .5, .11); pm.position.set(0, .55, z0 - .18); pm.rotation.y = Math.PI; g.add(pm);
    g.add(B(.04, 2.1, 1.1, mGlass, -(w / 2 + .03), 1.4, z0 + 1.5)); g.add(B(w + .04, .3, .18, mBlk, 0, .55, L / 2 + .08)); const rp = plateMesh(false, .5, .11); rp.position.set(0, .55, L / 2 + .18); g.add(rp); g.add(B(1.8, .8, .04, mGlass, 0, 3.1, L / 2 + .02));
    arches(g, w + .1, .5, [z0 + 1.6, L / 2 - 2.2], .36);
    g.userData = { kind: "car", w: w / 2, l: L / 2, v: 9 }; return g; }

  // Pharmacy response van (white, ED&G teal/navy/green stripes, blue beacon)
  const van = new THREE.Group(), vb = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: .35, metalness: .15 });
  const bodyV = new THREE.Mesh(new THREE.BoxGeometry(2, 1.7, 4.1), white); bodyV.position.y = 1.25; bodyV.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, .8, 1.4), white); cab.position.set(0, 1.0, -2.45); cab.castShadow = true;
  const glass = new THREE.MeshStandardMaterial({ color: 0x142033, roughness: .1, metalness: .6 });
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.6, .5, .05), glass); wind.position.set(0, 1.5, -3.15);
  const stripeT = new THREE.Mesh(new THREE.BoxGeometry(2.04, .22, 4.1), new THREE.MeshStandardMaterial({ color: 0x12a0ad })); stripeT.position.y = 1.25;
  const stripeN = new THREE.Mesh(new THREE.BoxGeometry(2.05, .1, 4.1), new THREE.MeshStandardMaterial({ color: 0x1a2744 })); stripeN.position.y = 1.0;
  const stripeG = new THREE.Mesh(new THREE.BoxGeometry(2.05, .1, 4.1), new THREE.MeshStandardMaterial({ color: 0x4caf50 })); stripeG.position.y = 1.5;
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(.7, .22, .04), new THREE.MeshBasicMaterial({ color: 0x4caf50 })), crossV = new THREE.Mesh(new THREE.BoxGeometry(.22, .7, .04), new THREE.MeshBasicMaterial({ color: 0x4caf50 }));
  crossH.position.set(0, 1.9, 2.07); crossV.position.copy(crossH.position);
  const beaconA = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, .3), new THREE.MeshBasicMaterial({ color: 0x35b6ff })), beaconB = beaconA.clone();
  beaconA.position.set(-.45, 2.2, -.4); beaconB.position.set(.45, 2.2, -.4); beaconB.material = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(.4, .2, .06), tl); tailL.position.set(-.7, 1.0, 2.08); const tailR = tailL.clone(); tailR.position.x = .7;
  const wheels = [];
  [[-1.02, -1.5], [1.02, -1.5], [-1.02, 1.4], [1.02, 1.4]].forEach(([x, z]) => { const sd = Math.sign(x), w = wheel(.45, .3, sd); w.position.set(x - sd * .08, .45, z); vb.add(w); wheels.push(w); const ar = new THREE.Mesh(new THREE.CircleGeometry(.52, 20), mArch); ar.rotation.y = sd * Math.PI / 2; ar.position.set(sd * 1.03, .45, z); vb.add(ar); });
  vb.add(bodyV, cab, wind, stripeT, stripeN, stripeG, crossH, crossV, beaconA, beaconB, tailL, tailR);
  { vb.add(B(.04, 1.5, .02, mBlk, 0, 1.3, 2.09), B(.75, .5, .03, mGlass, -.46, 1.65, 2.09), B(.75, .5, .03, mGlass, .46, 1.65, 2.09), B(2.0, .2, .18, mBlk, 0, .55, 2.12)); const pm = plateMesh(false, .5, .11); pm.position.set(0, .8, 2.12); vb.add(pm);
    [-1, 1].forEach(sd => { vb.add(B(.1, .22, .2, white, sd * 1.1, 1.3, -2.3), B(.06, .06, .3, mBlk, sd * 1.04, 1.3, -2.3)); }); }
  van.add(vb); van.scale.setScalar(.84); scene.add(van);
  const blueL = new THREE.PointLight(0x35b6ff, 1.5, 10), redL = new THREE.PointLight(0xff3b30, 1.5, 10); scene.add(blueL, redL);
  const head = new THREE.SpotLight(0xfff2cf, 1.4, 40, .5, .5); head.position.set(0, 1.2, -2.5); head.target.position.set(0, 0, -20); van.add(head, head.target);

  const carCols = [0xc0392b, 0x2e86de, 0xf1c40f, 0x7f8c8d, 0x8e44ad, 0x27ae60, 0x2c3e50];
  function vial() {
    const g = new THREE.Group();
    const glassV = new THREE.MeshStandardMaterial({ color: 0xbfffd2, transparent: true, opacity: .55, roughness: .1, emissive: 0x2fe07a, emissiveIntensity: .8 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .8, 14), glassV); body.position.y = 1.2;
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .5, 14), new THREE.MeshBasicMaterial({ color: 0x4cff8a })); liq.position.y = 1.12;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .2, 12), new THREE.MeshStandardMaterial({ color: 0xe5533d })); cap.position.y = 1.7;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.65, .05, 8, 24), new THREE.MeshBasicMaterial({ color: 0x4cff8a, transparent: true, opacity: .7 })); ring.position.y = 1.2; ring.rotation.x = Math.PI / 2;
    g.add(body, liq, cap, ring); g.userData = { kind: "vial", w: .9, l: .9, v: 0 }; return g;
  }

  // ---------- Bus ----------

  // ---------- Landmarks (scenery along the route) ----------
  function signTex(txt, bg, fg) { const c = document.createElement("canvas"); c.width = 512; c.height = 128; const x = c.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, 512, 128); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, 496, 112);
    let fs = 60; x.textAlign = "center"; x.textBaseline = "middle"; do { fs -= 2; x.font = "800 " + fs + "px system-ui,sans-serif"; } while (x.measureText(txt).width > 450 && fs > 16);
    x.fillStyle = fg; x.fillText(txt, 256, 66); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
  const sign = (txt, bg, fg, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(txt, bg, fg), fog: false }));
  const dome = (r, hh, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.scale.y = hh / r; return m; };
  const onionPts = [[.001, 0], [.7, 0], [1, .35], [1.05, .7], [.8, 1.1], [.4, 1.5], [.1, 1.9], [.001, 2.15]].map(p => new THREE.Vector2(p[0], p[1]));
  const onion = (r, h, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.LatheGeometry(onionPts, 22), mat); m.scale.set(r, h / 2.15, r); m.position.set(x, y, z); m.castShadow = true; return m; };

  function pier(o) {
    const g = new THREE.Group(), xs = 11, xe = o.xe, Dd = o.Dd, len = xe - xs, cx = (xs + xe) / 2, dyn = [];
    g.add(B(len, .6, Dd, mWood, cx, 4.5, 0, true)); g.add(B(len, .3, Dd - .4, mIron, cx, 4.05, 0));
    [-1, 1].forEach(s => { g.add(B(len, .1, .1, mWhite, cx, 5.55, s * (Dd / 2 - .12))); g.add(B(len, .1, .1, mWhite, cx, 5.15, s * (Dd / 2 - .12))); });
    for (let x = xs + 1; x < xe; x += 3) { [-1, 1].forEach(s => g.add(B(.1, 1.1, .1, mWhite, x, 5.1, s * (Dd / 2 - .12)))); const b = new THREE.Mesh(bulbG, mBulb); b.position.set(x, 5.8, ((x / 3 | 0) % 2 ? 1 : -1) * (Dd / 2 - .12)); g.add(b); }
    for (let x = xs + 2; x < xe; x += 6) [-1, 1].forEach(s => g.add(CY(.28, .36, 4.6, mIron, x, 2.2, s * (Dd / 2 - .7), 8)));
    if (o.name === "w") {
      const sg = sign("WORTHING PIER", "#12306b", "#ffffff", 8, 2); sg.position.set(xs + 5, 9, Dd / 2); g.add(sg); [xs + 1.5, xs + 8.5].forEach(x => g.add(CY(.14, .14, 4.6, mIron, x, 7.2, 0, 6)));
      const pv = new THREE.Group(); pv.position.set(xe - 6, 4.8, 0);
      pv.add(B(10, 3.2, 6.2, mWhite, 0, 1.6, 0, true)); pv.add(B(10.4, .35, 6.6, mTeal, 0, 3.4, 0)); const dm = dome(3.2, 2, mWhite); dm.scale.x = 1.55; dm.position.y = 3.5; pv.add(dm);
      pv.add(B(8.4, .6, .1, mCyanB, 0, 1.9, 3.12)); pv.add(B(1.7, 5.2, 1.7, mWhite, 4.3, 2.6, 0)); pv.add(B(2, .3, 2, mTeal, 4.3, 5.3, 0)); g.add(pv);
    } else {
      const sg = sign("BRIGHTON PALACE PIER", "#0f5c57", "#fff3c9", 11, 2.75); sg.position.set(xs + 6, 10.7, Dd / 2 - .3); g.add(sg);
      g.add(B(12, 5, Dd - 1, mCream, xs + 6, 7.3, 0, true)); const dm = dome(3.4, 3.2, mTeal); dm.position.set(xs + 6, 9.8, 0); g.add(dm);
      [[xe - 40, 0xe86a8c], [xe - 32, 0x2aa6a0], [xe - 24, 0xf2c14e]].forEach(([x, c]) => { const m = col(c, .5); g.add(B(4, 2.4, 4, mWhite, x, 6, 0)); const d = dome(2.7, 2.2, m); d.position.set(x, 7.2, 0); g.add(d); g.add(CY(.06, .06, 1.6, mIron, x, 9.3, 0, 5)); });
      const wx = xe - 12, wh = new THREE.Group(); wh.position.set(wx, 11.2, 0); const wr = new THREE.Group(); wh.add(wr);
      [-.6, .6].forEach(z => { const r = new THREE.Mesh(new THREE.TorusGeometry(4.6, .14, 8, 40), mWhite); r.position.z = z; wr.add(r); const r2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, .07, 6, 32), mCyanB); r2.position.z = z; wr.add(r2); });
      const gcol = [0xe8575a, 0x00b8e6, 0xf2c14e, 0x4caf50], gond = [];
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const sp = B(4.6, .08, .08, mWhite, Math.cos(a) * 2.3, Math.sin(a) * 2.3, .6); sp.rotation.z = a; wr.add(sp); const sp2 = sp.clone(); sp2.position.z = -.6; wr.add(sp2);
        const gp = new THREE.Group(); gp.position.set(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0); gp.add(B(1, .8, 1.5, col(gcol[k % 4], .5), 0, -.6, 0)); wr.add(gp); gond.push(gp); }
      wh.add(new THREE.Mesh(new THREE.SphereGeometry(.5, 10, 8), mWhite)); g.add(wh);
      [-1, 1].forEach(s => { const dxl = s * 3.4, l = CY(.22, .26, 7.4, mWhite, wx + dxl / 2 * 0, 8, 0, 6); l.position.set(wx + dxl / 2, (4.8 + 11.2) / 2, 0); l.rotation.z = -Math.atan2(dxl, 6.4); g.add(l); });
      dyn.push((t) => { wr.rotation.z = -t * .28; gond.forEach(gp => gp.rotation.z = t * .28); });
    }
    g.userData = { kind: "lm", D: Math.max(Dd, 8) + 6, dyn }; return g;
  }
  function westPier() {
    const g = new THREE.Group();
    [-6, 6].forEach(x => [-4, 0, 4].forEach(z => g.add(CY(.26, .34, 8.6, mRust, x, 4.3, z, 8))));
    [-4, 0, 4].forEach(z => { [[-7.6, -2.2], [2.2, 7.6]].forEach(([a, b]) => { if (Math.random() < .85) g.add(B(b - a, .32, .32, mRust, (a + b) / 2, 8.5, z)); }); g.add(B(13, .2, .2, mRust, 0, 4.4, z)); });
    [1, -1].forEach(s => [-4, 0, 4].forEach(z => { const a = new THREE.Mesh(new THREE.TorusGeometry(6.4, .2, 6, 14, Math.PI * .34), mRust); a.position.set(0, 2.1, z); a.rotation.z = s > 0 ? Math.PI * .5 - Math.PI * .34 : Math.PI * .5; g.add(a); }));
    g.add(B(15, .4, 10, mRust, 0, .8, 0)); g.add(B(6, 3, 3, mRust, 0, 2.2, 0)); g.scale.x = 1.7;
    g.userData = { kind: "lm", D: 12, dyn: [] }; return g;
  }
  function i360() {
    const g = new THREE.Group(); g.add(B(7, .7, 7, mCream, 0, .1, 0)); const tw = CY(.6, 1.05, 58, mWhite, 0, 29.5, 0, 14); tw.castShadow = true; g.add(tw);
    const pod = new THREE.Group(); const tr = new THREE.Mesh(new THREE.TorusGeometry(2.2, .95, 12, 28), mWhite); tr.rotation.x = Math.PI / 2; tr.scale.z = .6; pod.add(tr);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(3.12, 3.12, .85, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x6fd6f2, emissive: 0x1196c0, emissiveIntensity: .6, roughness: .1, transparent: true, opacity: .8 })); pod.add(gl);
    pod.position.set(0, 20, 0); g.add(pod); g.add(B(.9, .9, .9, mCyanB, 0, 59, 0));
    const ph = Math.random() * 6; g.userData = { kind: "lm", D: 8, dyn: [t => { pod.position.y = 21 + 15 * Math.sin(t * .5 + ph); }] }; return g;
  }
  function pavilion() {
    const g = new THREE.Group(), cr = col(0xf3e6c8, .7), dm = col(0xf7f0de, .5), win = col(0x7a5a46, .8), gold = mGoldM;
    g.add(B(12, 4.6, 34, cr, 0, 2.3, 0, true)); for (let z = -14; z <= 14; z += 4) g.add(B(.2, 2.6, 1.7, win, 6.05, 2.4, z));
    g.add(B(12.6, .5, 34.6, col(0xc99b7a), 0, 4.85, 0));
    g.add(CY(3.4, 3.4, 3.4, cr, 0, 6.7, 0, 20)); g.add(onion(3.7, 5.2, dm, 0, 8.4, 0)); g.add(CY(.12, .12, 3, gold, 0, 15.2, 0, 6)); { const fb = new THREE.Mesh(new THREE.SphereGeometry(.4, 8, 6), gold); fb.position.set(0, 16.9, 0); g.add(fb); }
    [-9, 9].forEach(z => { g.add(CY(2.3, 2.3, 2.6, cr, 0, 6.2, z, 16)); g.add(onion(2.5, 3.6, dm, 0, 7.5, z)); g.add(CY(.08, .08, 1.8, gold, 0, 11.3, z, 6)); });
    [-15, 15].forEach(z => { g.add(CY(1.6, 1.6, 2.2, cr, 0, 6, z, 14)); g.add(onion(1.8, 2.8, dm, 0, 7.1, z)); });
    [[-5, -16], [-5, 16], [5, -16], [5, 16], [5, -4.5], [5, 4.5], [-5, -4.5], [-5, 4.5]].forEach(([x, z]) => { g.add(CY(.4, .5, 7.5, cr, x, 6.1, z, 10)); g.add(onion(.75, 1.6, dm, x, 9.8, z)); g.add(CY(.05, .05, 1, gold, x, 11.8, z, 5)); });
    g.scale.setScalar(2.7); g.userData = { kind: "lm", D: 92, boxes: [] }; return g;
  }

  function hospital() {
    const g = new THREE.Group(), tex = facade("#e9eef4", 6), m = new THREE.MeshStandardMaterial({ map: tex, roughness: .7 });
    g.add(B(16, 25, 30, m, 0, 12.5, 0, true)); g.add(B(8, 8, 14, m, -10, 4, 0)); g.add(B(10, .4, 12, col(0x2a2f3a), 0, 25.2, 0));
    const hp = CY(3.4, 3.4, .2, col(0x2a2f3a), 0, 25.5, 0, 24); g.add(hp); const hh = B(3, .05, .5, mWhite, 0, 25.65, 0); g.add(hh); g.add(B(.5, .05, 3, mWhite, 0, 25.65, 0));
    const cm = new THREE.MeshBasicMaterial({ color: 0x4caf50 }); g.add(B(.2, 2, 7, cm, 8.1, 19, 0)); g.add(B(.2, 7, 2, cm, 8.1, 19, 0));
    const sg = sign("ROYAL SUSSEX COUNTY HOSPITAL", "#12306b", "#ffffff", 22, 3.2); sg.rotation.y = Math.PI / 2; sg.position.set(8.15, 12, 0); g.add(sg);
    g.userData = { kind: "lm", D: 34, dyn: [] }; return g;
  }
  function arch() {
    const g = new THREE.Group(); [-6.8, 6.8].forEach(x => g.add(CY(.3, .3, 8.4, mIron, x, 4.2, 0, 8)));
    g.add(B(14.4, .5, .6, mIron, 0, 8.4, 0)); const sg = sign("ANTIDOTE DELIVERY", "#0f5c3a", "#ffffff", 14, 3.2); sg.position.set(0, 10.2, .35); g.add(sg);
    g.userData = { kind: "lm", D: 4, dyn: [] }; return g;
  }


  // ---------- Route: a winding coast road, Worthing (west) to Brighton (east). Sea on the right, town on the left. ----------
  const DS = 2, LEN = 2600, NS = Math.floor(LEN / DS) + 1;
  const PX = new Float32Array(NS), PZ = new Float32Array(NS), TX = new Float32Array(NS), TZ = new Float32Array(NS);
  { let x = 0, z = 0; for (let i = 0; i < NS; i++) { const s = i * DS, th = .5 * Math.sin(s / 300) + .25 * Math.sin(s / 130 + 1); PX[i] = x; PZ[i] = z; TX[i] = Math.cos(th); TZ[i] = Math.sin(th); x += TX[i] * DS; z += TZ[i] * DS; } }
  const F = { x: 0, z: 0, tx: 1, tz: 0, nx: 0, nz: 1 };
  function fr(s) { s = Math.max(0, Math.min(LEN - .01, s)); const i = Math.floor(s / DS), f = s / DS - i, j = Math.min(NS - 1, i + 1);
    F.x = PX[i] + (PX[j] - PX[i]) * f; F.z = PZ[i] + (PZ[j] - PZ[i]) * f; const tx = TX[i] + (TX[j] - TX[i]) * f, tz = TZ[i] + (TZ[j] - TZ[i]) * f, m = Math.hypot(tx, tz) || 1;
    F.tx = tx / m; F.tz = tz / m; F.nx = -F.tz; F.nz = F.tx; return F; }
  let PS = 0, PL = 0, hint = 0;
  function proj(x, z) { let bi = hint, bd = 1e12; const a = Math.max(0, hint - 14), b = Math.min(NS - 1, hint + 14);
    for (let i = a; i <= b; i++) { const dx = x - PX[i], dz = z - PZ[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
    hint = bi; const dx = x - PX[bi], dz = z - PZ[bi]; PS = bi * DS + dx * TX[bi] + dz * TZ[bi]; PL = -dx * TZ[bi] + dz * TX[bi]; }

  // ---------- Ground ribbons following the route ----------
  function ribbon(prof, mat, uS, uO, vS, step, recv) {
    const n = Math.floor((NS - 1) / step) + 1, m = prof.length, pos = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2), idx = [];
    for (let k = 0; k < n; k++) { const i = Math.min(NS - 1, k * step); for (let j = 0; j < m; j++) { const lat = prof[j][0], o = k * m + j; pos[o * 3] = PX[i] - TZ[i] * lat; pos[o * 3 + 1] = prof[j][1]; pos[o * 3 + 2] = PZ[i] + TX[i] * lat; uv[o * 2] = lat / uS + uO; uv[o * 2 + 1] = i * DS / vS; } }
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < m - 1; j++) { const a = k * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const me = new THREE.Mesh(g, mat); me.receiveShadow = !!recv; me.frustumCulled = false; scene.add(me); return me; }
  function roadTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#3b3e48"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < .5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.1)"; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.fillStyle = "#f3f5fa"; g.fillRect(6, 0, 4, 256); g.fillRect(246, 0, 4, 256); g.fillRect(121, 0, 3, 256); g.fillRect(132, 0, 3, 256);
    for (let y = 0; y < 256; y += 128) { g.fillRect(62, y, 3, 64); g.fillRect(191, y, 3, 64); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t; }
  const mRoadT = new THREE.MeshStandardMaterial({ map: roadTex(), roughness: .95 });
  const dbl = (c, r) => { const m = col(c, r || .9); m.side = THREE.DoubleSide; return m; };
  const WR = 12.2, WL = -10.4;
  ribbon([[-7.2, 0], [7.2, 0]], mRoadT, 14.4, .5, 12, 1, true);
  ribbon([[WL, .14], [-7.2, .14], [-7.2, 0]], mProm, 6, 0, 6, 2, true);
  ribbon([[7.2, 0], [7.2, .14], [WR, .14]], mProm, 6, 0, 6, 2, true);
  ribbon([[WR, .14], [WR, 1.05], [WR + .9, 1.05], [WR + .9, -.2]], dbl(0xe6e1d6), 6, 0, 6, 2);
  ribbon([[WL, .14], [WL, 1.5]], dbl(0x4f7a46), 6, 0, 6, 2);
  ribbon([[WR + .9, -.15], [38, -.4]], mSand, 6, 0, 6, 3);
  ribbon([[38, -.4], [48, -.7]], mWet, 6, 0, 6, 3);
  ribbon([[-130, 0], [WL - .8, 0], [WL - .3, .14]], mLand, 6, 0, 6, 4);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < NS; i++) { minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]); minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]); }
  seaT.wrapS = seaT.wrapT = THREE.RepeatWrapping; seaT.repeat.set(400, 400);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ map: seaT })); sea.rotation.x = -Math.PI / 2; sea.position.set((minX + maxX) / 2, -.55, (minZ + maxZ) / 2); scene.add(sea);

  // ---------- Scenery (instanced) ----------
  const Yax = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
  const lamps = [], _v = new THREE.Vector3();
  const mx4 = (x, y, z, th, sx, sy, sz) => _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(Yax, th), _s.set(sx, sy, sz)).clone();
  function inst(geo, material, list) { if (!list.length) return; const im = new THREE.InstancedMesh(geo, material, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; scene.add(im); return im; }
  const place = (g, s, x, y) => { fr(s); g.position.set(F.x + F.nx * x, y, F.z + F.nz * x); g.rotation.y = Math.atan2(-F.tx, -F.tz); scene.add(g); return g; };
  const LMD = [
    { s: LEN * .12, name: "Worthing Pier", mk: () => pier({ name: "w", xe: 62, Dd: 3.4 }), x: 0, y: -.5, ex: 12 },
    { s: LEN * .30, name: "West Pier (ruins)", mk: westPier, x: 50, y: -.5, ex: 14 },
    { s: LEN * .38, name: "The i360", mk: i360, x: 24, y: -.3, ex: 10 },
    { s: LEN * .58, name: "Brighton Palace Pier", mk: () => pier({ name: "b", xe: 82, Dd: 7 }), x: 0, y: -.5, ex: 12 },
    { s: LEN * .78, name: "Royal Pavilion", mk: pavilion, x: -49, y: 0, ex: 52 }
  ];
  const DEST = LEN - 20, RING = { s: LEN - 22, lat: -3.6, r: 4.6 };
  const lms = LMD.map(d => { const g = place(d.mk(), d.s, d.x, d.y); return { g, s: d.s, dyn: g.userData.dyn || [] }; });
  { const h = place(hospital(), LEN - 24, -22, 0), a = place(arch(), LEN - 70, 0, 0); lms.push({ g: h, s: LEN - 24, dyn: [] }, { g: a, s: LEN - 70, dyn: [] }); }
  const near = (s, w) => LMD.some(d => Math.abs(d.s - s) < d.ex + w) || s > LEN - 100 && w > 0;
  { // terraces on the town side
    const bm = terr.flat().map(() => []), roof = [];
    for (let s = 20; s < LEN - 90; s += rnd(15, 19)) { if (LMD[4] && Math.abs(LMD[4].s - s) < 60) continue;
      fr(s); const ci = Math.floor(Math.random() * 6), fi = Math.floor(Math.random() * 3), h = [3, 4, 5][fi] * 3.2, w = rnd(13.5, 17), th = Math.atan2(-F.tz, F.tx), lat = -(14.5 + rnd(0, 2));
      bm[ci * 3 + fi].push(mx4(F.x + F.nx * lat, h / 2, F.z + F.nz * lat, th, w, h, 12)); roof.push(mx4(F.x + F.nx * lat, h + .3, F.z + F.nz * lat, th, w + .4, .6, 12.4)); }
    const bg = new THREE.BoxGeometry(1, 1, 1); terr.flat().forEach((m, i) => inst(bg, m, bm[i])); inst(bg, mSlate, roof);
    for (let s = 14, k = 0; s < LEN - 10; s += 26, k++) { fr(s); const side = k % 2 ? 1 : -1, lat = side > 0 ? 8.3 : -8.7, g = new THREE.Group(), pm = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, 5.2, 6), mPole), bm2 = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), mLamp); pm.position.y = 2.6; bm2.position.set(-F.nx * side * .8, 5.3, -F.nz * side * .8); g.add(pm, bm2); g.position.set(F.x + F.nx * lat, 0, F.z + F.nz * lat); scene.add(g); lamps.push({ g, x: g.position.x, z: g.position.z, s, down: false, a: 0, w: 0, dx: 0, dz: 1 }); }
    const huts = hutCols.map(() => []), gro = [];
    for (let s = 30; s < LEN - 100; s += rnd(10, 16)) { if (near(s, 8)) continue; fr(s); const lat = 16 + rnd(0, 4); huts[Math.floor(Math.random() * huts.length)].push(mx4(F.x + F.nx * lat, 1.15, F.z + F.nz * lat, Math.atan2(F.nx, F.nz), 2.4, 2.6, 2.2)); }
    for (let s = 60; s < LEN - 100; s += 90) { if (near(s, 6)) continue; fr(s); gro.push(mx4(F.x + F.nx * 29, -.2, F.z + F.nz * 29, Math.atan2(F.nx, F.nz), .7, .8, 31)); }
    const hg = new THREE.BoxGeometry(1, 1, 1); hutCols.forEach((m, i) => inst(hg, m, huts[i])); inst(hg, mWood, gro);
    const hills = []; for (let s = 0; s < LEN + 100; s += 150) { fr(s); const lat = -(125 + rnd(0, 25)); hills.push(mx4(F.x + F.nx * lat, -6, F.z + F.nz * lat, 0, rnd(70, 100), rnd(24, 40), rnd(60, 80))); }
    inst(new THREE.SphereGeometry(1, 14, 8), mHill, hills);
  }
  const rotors = [];
  for (let s = 100; s < LEN; s += 230) { fr(s); const lat = 105 + rnd(0, 40), g = new THREE.Group(); g.position.set(F.x + F.nx * lat, -.5, F.z + F.nz * lat);
    g.add(CY(.7, 1.3, 70, mSail, 0, 35, 0, 8)); const rot = new THREE.Group(); rot.position.set(0, 70, -1.6); for (let b = 0; b < 3; b++) { const bl = B(1.1, 32, .4, mSail, 0, 16, 0); const pv = new THREE.Group(); pv.rotation.z = b * Math.PI * 2 / 3; pv.add(bl); rot.add(pv); } g.add(rot); g.rotation.y = Math.atan2(-F.tx, -F.tz) + Math.PI / 2; scene.add(g); rotors.push(rot); }
  for (let k = 0; k < 14; k++) { fr(rnd(0, LEN)); const lat = 62 + rnd(0, 50), g = new THREE.Group(); g.add(B(1.6, .8, 5, mHull[k % 4], 0, .2, 0)); g.add(B(.1, 5, 2.4, mSail, 0, 3.2, .2)); g.position.set(F.x + F.nx * lat, -.5, F.z + F.nz * lat); g.rotation.y = rnd(0, 6.28); scene.add(g); }

  // ---------- Statics: the end barrier ----------
  const statics = [];
  const mkStatic = (x, z, tx, tz, hw, hl, s) => statics.push({ x, z, gx: tx, gz: tz, hw, hl, s });
  { fr(LEN - 4); const bar = B(15.6, 1.2, .8, mYel, 0, .6, 0); bar.position.set(F.x, .6, F.z); bar.rotation.y = Math.atan2(-F.tx, -F.tz); scene.add(bar); mkStatic(F.x, F.z, F.tx, F.tz, 7.8, .4, LEN - 4); }
  // ---------- Potholes: slow the van down, no damage ----------
  const potholes = [];
  { const mRimP = new THREE.MeshBasicMaterial({ color: 0x23252c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), mHoleP = new THREE.MeshBasicMaterial({ color: 0x0a0b0d, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (let s = 90, k = 0; s < LEN - 120; s += rnd(35, 70), k++) { const lat = rnd(-6.4, 6.4), r = rnd(.55, .95); fr(s);
      const mkP = (rad, m, jit, y) => { const g = new THREE.CircleGeometry(rad, 14), pp = g.attributes.position; for (let i = 1; i < pp.count; i++) { const a = Math.atan2(pp.getY(i), pp.getX(i)), q = 1 + (Math.sin(a * 3 + k) * .5 + Math.sin(a * 5 + k * 2) * .5) * jit; pp.setXY(i, pp.getX(i) * q, pp.getY(i) * q); } const me = new THREE.Mesh(g, m); me.rotation.x = -Math.PI / 2; me.position.set(F.x + F.nx * lat, y, F.z + F.nz * lat); scene.add(me); };
      mkP(r * 1.25, mRimP, .25, .02); mkP(r, mHoleP, .22, .025); potholes.push({ x: F.x + F.nx * lat, z: F.z + F.nz * lat, r: r * 1.1, s, hit: false }); } }
  // delivery ring
  const ring = new THREE.Group(); { fr(RING.s); ring.position.set(F.x + F.nx * RING.lat, 0, F.z + F.nz * RING.lat); const rm = new THREE.Mesh(new THREE.CylinderGeometry(RING.r, RING.r, 9, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x4cff8a, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false })); rm.position.y = 4.5; ring.add(rm);
    const rf = new THREE.Mesh(new THREE.CircleGeometry(RING.r, 28), new THREE.MeshBasicMaterial({ color: 0x4cff8a, transparent: true, opacity: .35 })); rf.rotation.x = -Math.PI / 2; rf.position.y = .06; ring.add(rf); scene.add(ring); }
  const RX = ring.position.x, RZ = ring.position.z;

  // ---------- Vials ----------
  const VL = [-5.4, -1.8, 1.8, 5.4, 9.2, -8.6], vials3 = [];
  for (let k = 0; k < 72; k++) { const s = 70 + k * (LEN - 220) / 72 + rnd(-8, 8), lat = VL[Math.floor(Math.random() * VL.length)], g = vial(); fr(s); g.position.set(F.x + F.nx * lat, 0, F.z + F.nz * lat); scene.add(g); vials3.push({ g, s, got: false, x: g.position.x, z: g.position.z }); }

  // ---------- Traffic ----------
  const LANES = [{ lat: -5.4, dir: 1, v: 8.5 }, { lat: -1.8, dir: 1, v: 12 }, { lat: 1.8, dir: -1, v: 14 }, { lat: 5.4, dir: -1, v: 11 }];
  const ai = [];
  for (let i = 0; i < 15; i++) { const k = Math.random(), g = k < .17 ? busCar() : k < .33 ? car("truck") : car("car"); scene.add(g); ai.push({ g, lane: LANES[0], s: -999, stun: 0, u: g.userData, x: 0, z: 0, gx: 1, gz: 0, vx: 0, vz: 0 }); }
  function placeAI(a, s0, s1) { for (let k = 0; k < 8; k++) { const ln = LANES[Math.floor(Math.random() * 4)], s = rnd(s0, s1); if (ai.every(o => o === a || o.lane !== ln || Math.abs(o.s - s) > 34)) { a.lane = ln; a.s = s; a.stun = 0; return; } } a.s = -999; }

  // ---------- Game state ----------
  const T0 = 150, K = { up: false, down: false, left: false, right: false, boost: false, hb: false };
  let running = false, alive = true, yaw = 0, vx = 0, vz = 0, vanX = 0, vanZ = 0, steer = 0, hp = 100, timeLeft = T0, nVials = 0, boost = .5, nChk = 0, chkPts = 0, prog = 0, shake = 0, t = 0, last = performance.now(), best = 0, ringHint = false, lastLoc = "", extra = 0, spinV = 0;
  try { best = +localStorage.getItem("arbest") || 0; } catch (e) {}
  bestEl.textContent = "Best " + best;
  const camF = { x: 1, z: 0 };
  const smoke = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0x555a63, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; scene.add(m); smoke.push({ m, life: 0 }); }
  let smokeT = 0;
  const LOC = [[0, "Worthing seafront"], [.2, "Heading east"], [.26, "Hove"], [.3, "West Pier & i360"], [.45, "Brighton seafront"], [.6, "Brighton"], [.7, "Kemp Town"], [.76, "Royal Pavilion"], [.88, "Royal Sussex County Hospital approach"]];
  function showBanner(txt) { bnEl.textContent = txt; bnEl.classList.add("on"); clearTimeout(bt); bt = setTimeout(() => bnEl.classList.remove("on"), 2800); }
  function reset() {
    fr(18); vanX = F.x - F.nx * 1.8; vanZ = F.z - F.nz * 1.8; yaw = Math.atan2(F.tz, F.tx); vx = vz = 0; steer = 0; hp = 100; timeLeft = T0; nVials = 0; boost = .5; nChk = 0; chkPts = 0; prog = 0; shake = 0; extra = 0; ringHint = false; spinV = 0;
    hint = 9; alive = true; camF.x = Math.cos(yaw); camF.z = Math.sin(yaw); Object.keys(K).forEach(k => K[k] = false);
    lamps.forEach(l => { l.down = false; l.a = 0; l.w = 0; l.g.quaternion.identity(); }); ai.forEach(a => { a.s = -999; }); ai.forEach(a => placeAI(a, 45, 330)); vials3.forEach(v => { v.got = false; v.g.visible = true; });
    smoke.forEach(s => { s.life = 0; s.m.visible = false; }); bnEl.classList.remove("on"); viEl.textContent = 0;
  }
  // ---------- Controls ----------
  const KM = { arrowleft: "left", a: "left", arrowright: "right", d: "right", arrowup: "up", w: "up", arrowdown: "down", s: "down", shift: "boost", " ": "hb" };
  on(window, "keydown", e => { const k = KM[e.key.toLowerCase()];
    if (!ov.hidden) { if (e.key === "Enter" || e.key === " ") { $("go").click(); e.preventDefault(); } return; }
    if (k) { K[k] = true; e.preventDefault(); } });
  on(window, "keyup", e => { const k = KM[e.key.toLowerCase()]; if (k) K[k] = false; });
  on(window, "blur", () => { Object.keys(K).forEach(k => K[k] = false); });
  root.querySelectorAll("#artc [data-k]").forEach(b => { const k = b.dataset.k;
    b.addEventListener("pointerdown", e => { K[k] = true; try { b.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => b.addEventListener(ev, () => { K[k] = false; })); });
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  on(window, "resize", resize); resize();
  // ---------- Sound (Web Audio, no files). M or the Sound button mutes; the choice is remembered. ----------
  const AU = (() => {
    let ac = null, master = null, on = true, nzb = null, wg = null, wf = null, eg = null, e1 = null, e2 = null, ef = null, sg = null, so = null, kg = null, kf = null, hg = null, ho = null;
    try { on = localStorage.getItem("pdSound") !== "off"; } catch (e) {}
    const btn = root.querySelector(".snd"), label = () => { if (btn) btn.textContent = on ? "Sound on" : "Sound off"; };
    const noise = (dur, type, f, v, t0, q) => { if (!ac) return; const s = ac.createBufferSource(); s.buffer = nzb; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = ac.createGain(); const t = t0 || ac.currentTime; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05); };
    const tone = (f, t, d, type, v, to) => { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .03); };
    const loopNoise = (type, f, q) => { const s = ac.createBufferSource(); s.buffer = nzb; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return [g, fl]; };
    const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
    const set = (p, v, k) => { if (ac) p.setTargetAtTime(v, ac.currentTime, k || .08); };
    const T = () => ac.currentTime;
        const setup = () => { e1 = osc("sawtooth", 50); e2 = osc("square", 25); ef = ac.createBiquadFilter(); ef.type = "lowpass"; ef.frequency.value = 520; eg = ac.createGain(); eg.gain.value = 0; e1.connect(ef); e2.connect(ef); ef.connect(eg); eg.connect(master);
      so = osc("sine", 800); sg = ac.createGain(); sg.gain.value = 0; so.connect(sg); sg.connect(master); [kg, kf] = loopNoise("highpass", 1800, 2); };
    const api = {
      init() { if (ac) { try { ac.resume(); } catch (e) {} return; }
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = on ? .55 : 0; master.connect(ac.destination);
          nzb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nzb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          [wg, wf] = loopNoise("bandpass", 600, .7); setup(); label(); } catch (e) { ac = null; } },
      toggle() { on = !on; try { localStorage.setItem("pdSound", on ? "on" : "off"); } catch (e) {} if (master) set(master.gain, on ? .55 : 0, .02); label(); },
      close() { try { if (ac) ac.close(); } catch (e) {} ac = null; },
      get ok() { return !!ac; }, tone, noise, set, T, label,
      nodes: () => ({ ac, master, wg, wf }), osc, loopNoise
    };
        Object.assign(api, {
      drive(sp, thr, bst, skid, run, live) { if (!ac) return; set(eg.gain, !live ? 0 : run ? .05 + .05 * thr + (bst ? .03 : 0) : .02, .1); set(e1.frequency, 36 + sp * 2.2 + (thr ? 6 : 0) + (bst ? 10 : 0), .1); set(e2.frequency, 18 + sp * 1.1, .1); set(ef.frequency, 300 + sp * 20, .1); set(wg.gain, live ? Math.min(.12, sp * .0035) : 0, .15); set(wf.frequency, 400 + sp * 25, .2); set(kg.gain, live && run ? Math.min(.1, skid * .012) : 0, .05); },
      siren(t, on2) { if (!ac) return; set(so.frequency, 760 + 190 * Math.sign(Math.sin(t * 5.2)), .03); set(sg.gain, on2 ? .012 : 0, .1); },
      hit(vn) { if (!ac || vn < 1.5) return; const t = T(), v = Math.min(.5, .1 + vn * .02); noise(.25 + vn * .01, "lowpass", 700 + vn * 30, v, t); tone(100, t, .3, "sawtooth", v * .8, 40); if (vn > 6) noise(.25, "highpass", 3000, .1, t); },
      vial() { if (!ac) return; const t = T(); tone(988, t, .08, "square", .07); tone(1480, t + .06, .14, "square", .07); },
      chk() { if (ac) [523, 659, 784].forEach((f, i) => tone(f, T() + i * .09, .25, "triangle", .15)); },
      win() { if (ac) [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, T() + i * .11, .3, "triangle", .16)); },
      lose() { if (ac) [392, 330, 262, 196].forEach((f, i) => tone(f, T() + i * .2, .35, "sawtooth", .08)); },
      tick() { if (ac) tone(1000, T(), .06, "square", .05); },
      pothole() { if (!ac) return; const t = T(); noise(.22, "lowpass", 350, .4, t); tone(80, t, .25, "square", .18, 40); tone(160, t + .08, .15, "triangle", .1, 90); },
      boost() { if (ac) noise(.6, "bandpass", 1200, .14, T(), 1.2); }
    });
    label(); return api;
  })();
  if (root.querySelector(".snd")) on(root.querySelector(".snd"), "click", () => AU.toggle());
  on(window, "keydown", e => { if (e.key && e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey) AU.toggle(); });
  let bstWas = false, lastTick = -1, jolt = 0;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function loadBoard() { const el = $("board"); if (!el || typeof sb === "undefined") return; try { Promise.resolve(sb.rpc("get_drive_weekly", { p_weeks_ago: 0 })).then(r => { const d = (r && r.data) || []; if (dead || !el.isConnected) return;
    el.innerHTML = d.length ? '<div class="arh">This week</div>' + d.slice(0, 5).map(x => '<div class="arr' + (x.is_me ? " me" : "") + '"><span>' + x.rank + ". " + esc(x.display_name) + "</span><span>" + Number(x.score).toLocaleString("en-GB") + "</span></div>").join("") : ""; }).catch(() => {}); } catch (e) {} }

  // ---------- Minimap ----------
  const mapC = $("map"), mg = mapC.getContext("2d"), MW = mapC.width, MH = mapC.height, PAD = 10, mk = Math.min((MW - 2 * PAD) / (maxX - minX), (MH - 2 * PAD) / Math.max(60, maxZ - minZ)), mox = (MW - (maxX - minX) * mk) / 2, moz = (MH - (maxZ - minZ) * mk) / 2;
  const mX = x => mox + (x - minX) * mk, mZ = z => moz + (z - minZ) * mk;
  const mapBg = document.createElement("canvas"); mapBg.width = MW; mapBg.height = MH;
  { const g = mapBg.getContext("2d"); g.fillStyle = "rgba(8,18,44,.72)"; g.fillRect(0, 0, MW, MH); g.fillStyle = "rgba(60,130,190,.35)"; g.fillRect(0, MH * .62, MW, MH);
    g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = "#e8eefc"; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < NS; i += 2) { const x = mX(PX[i]), z = mZ(PZ[i]); i ? g.lineTo(x, z) : g.moveTo(x, z); } g.stroke();
    g.font = "700 9px system-ui,sans-serif"; g.textAlign = "center";
    [["Worthing Pier", LMD[0].s, "W"], ["West Pier", LMD[1].s, "WP"], ["i360", LMD[2].s, "i"], ["Palace Pier", LMD[3].s, "PP"], ["Pavilion", LMD[4].s, "RP"]].forEach(([n, s, l]) => { fr(s); g.fillStyle = "#35b6ff"; g.beginPath(); g.arc(mX(F.x), mZ(F.z), 3.2, 0, 6.3); g.fill(); g.fillStyle = "#cfe8ff"; g.fillText(l, mX(F.x), mZ(F.z) - 6); });
    fr(DEST); g.fillStyle = "#4cff8a"; g.beginPath(); g.arc(mX(F.x), mZ(F.z), 5, 0, 6.3); g.fill(); g.fillStyle = "#06240f"; g.font = "800 9px system-ui,sans-serif"; g.fillText("H", mX(F.x), mZ(F.z) + 3.2);
    fr(0); g.fillStyle = "#fff"; g.beginPath(); g.arc(mX(F.x), mZ(F.z), 3, 0, 6.3); g.fill(); }
  function drawMap() { mg.drawImage(mapBg, 0, 0); const x = mX(vanX), z = mZ(vanZ); mg.save(); mg.translate(x, z); mg.rotate(yaw); mg.fillStyle = "#ffd23f"; mg.strokeStyle = "#000"; mg.lineWidth = 1.2; mg.beginPath(); mg.moveTo(7, 0); mg.lineTo(-5, -4.5); mg.lineTo(-3, 0); mg.lineTo(-5, 4.5); mg.closePath(); mg.fill(); mg.stroke(); mg.restore(); }

  // ---------- Collisions (oriented boxes) ----------
  const SN = { x: 0, z: 0, d: 0 };
  function sat(ax, az, fx, fz, hw, hl, bx, bz, gx, gz, hw2, hl2) {
    const dx = bx - ax, dz = bz - az; let best = 1e9;
    for (let k = 0; k < 4; k++) { const ux = k === 0 ? fx : k === 1 ? -fz : k === 2 ? gx : -gz, uz = k === 0 ? fz : k === 1 ? fx : k === 2 ? gz : gx;
      const rA = hl * Math.abs(fx * ux + fz * uz) + hw * Math.abs(-fz * ux + fx * uz), rB = hl2 * Math.abs(gx * ux + gz * uz) + hw2 * Math.abs(-gz * ux + gx * uz), d = dx * ux + dz * uz, ov = rA + rB - Math.abs(d);
      if (ov <= 0) return false; if (ov < best) { best = ov; const sg = d >= 0 ? 1 : -1; SN.x = ux * sg; SN.z = uz * sg; SN.d = ov; } }
    return true; }
  function hurt(vn) { AU.hit(vn); shake = Math.max(shake, Math.min(.7, vn * .035)); if (vn > 3) { hp -= (vn - 3) * 2.2; if (hp <= 0) { hp = 0; over("wreck"); } } }
  function hitBox(bx, bz, gx, gz, hw2, hl2, bvx, bvz, e) {
    const fx = Math.cos(yaw), fz = Math.sin(yaw), cx = vanX + fx * .46, cz = vanZ + fz * .46;
    if (!sat(cx, cz, fx, fz, .9, 2.2, bx, bz, gx, gz, hw2, hl2)) return false;
    vanX -= SN.x * SN.d; vanZ -= SN.z * SN.d;
    const vn = (vx - bvx) * SN.x + (vz - bvz) * SN.z;
    if (vn > 0) { vx -= (1 + e) * vn * SN.x; vz -= (1 + e) * vn * SN.z; hurt(vn); const lat = SN.x * -fz + SN.z * fx, fw = SN.x * fx + SN.z * fz; spinV += -lat * (fw >= 0 ? 1 : -1) * Math.min(1.2, vn * .06); }
    return true; }
  function collide(dt) {
    proj(vanX, vanZ); const ps = PS; fr(ps); const nx = F.nx, nz = F.nz, fx = Math.cos(yaw), fz = Math.sin(yaw), rx = -fz, rz = fx;
    let mxL = -1e9, mnL = 1e9; for (const a of [-2.05, 3.15]) for (const b of [-1.02, 1.02]) { const l = PL + (fx * a + rx * b) * nx + (fz * a + rz * b) * nz; mxL = Math.max(mxL, l); mnL = Math.min(mnL, l); }
    if (mxL > WR) { const p = mxL - WR; vanX -= nx * p; vanZ -= nz * p; const vn = vx * nx + vz * nz; if (vn > 0) { vx -= 1.25 * vn * nx; vz -= 1.25 * vn * nz; hurt(vn); } vx *= 1 - dt * .8; vz *= 1 - dt * .8; }
    if (mnL < WL) { const p = WL - mnL; vanX += nx * p; vanZ += nz * p; const vn = -(vx * nx + vz * nz); if (vn > 0) { vx += 1.25 * vn * nx; vz += 1.25 * vn * nz; hurt(vn); } vx *= 1 - dt * .8; vz *= 1 - dt * .8; }
    for (const o of statics) if (Math.abs(o.s - ps) < 26) hitBox(o.x, o.z, o.gx, o.gz, o.hw, o.hl, 0, 0, .2);
    for (const l of lamps) if (!l.down && Math.abs(l.s - ps) < 20 && hitBox(l.x, l.z, 1, 0, .3, .3, 0, 0, .1)) { const dx = l.x - vanX, dz = l.z - vanZ, d = Math.hypot(dx, dz) || 1; l.down = true; l.dx = dx / d; l.dz = dz / d; l.w = 1.2; AU.hit(8); shake = Math.max(shake, .35); showBanner("Lamp post down!"); }
    for (const a of ai) if (a.s > 0 && Math.abs(a.s - ps) < 16 && hitBox(a.x, a.z, a.gx, a.gz, a.u.w, a.u.l, a.vx, a.vz, .3)) a.stun = 1.6;
  }
  function over(kind) {
    if (!alive) return; alive = false; running = false; if (kind === "win") AU.win(); else AU.lose(); shake = Math.max(shake, .6); Object.keys(K).forEach(k => K[k] = false);
    let fin = 0; if (kind === "win") { fin = 1000 + Math.floor(timeLeft * 15) + Math.floor(hp * 5) + nVials * 100; extra += fin; }
    const total = curScore(), h = ov.querySelector("h2"), sub = ov.querySelector(".sub");
    if (total > best) { best = total; try { localStorage.setItem("arbest", best); } catch (e) {} bestEl.textContent = "Best " + best; }
    const km = (prog / 1000).toFixed(2);
    if (kind === "win") { h.textContent = "Antidote delivered! " + total.toLocaleString("en-GB"); sub.textContent = "Royal Sussex County Hospital reached with " + Math.ceil(timeLeft) + " s to spare, " + Math.round(hp) + "% van health and " + nVials + " vial" + (nVials === 1 ? "" : "s") + ". Delivery bonus " + fin.toLocaleString("en-GB") + "."; }
    else if (kind === "wreck") { h.textContent = "Van wrecked. Score " + total.toLocaleString("en-GB"); sub.textContent = km + " km driven. The van could not take another hit, and the patient is still waiting."; }
    else { h.textContent = "Out of time. Score " + total.toLocaleString("en-GB"); sub.textContent = km + " km driven. The antidote did not reach the hospital in time."; }
    $("go").textContent = "Drive again"; ov.hidden = false; $("board").innerHTML = "";
    if (total > 0 && typeof sb !== "undefined") { try { Promise.resolve(sb.rpc("submit_drive_score", { p_score: total, p_metres: Math.floor(prog) })).then(() => { if (!dead) loadBoard(); }).catch(() => {}); } catch (e) {} } else loadBoard();
  }
  const curScore = () => Math.floor(prog / 4) + nVials * 50 + chkPts + extra;
  const fmtT = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

  // ---------- Main loop ----------
  function frame(now) {
    if (dead) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    const run = running && alive;
    if (run) { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; over("out"); } }
    // driving model
    let fx = Math.cos(yaw), fz = Math.sin(yaw), vf = vx * fx + vz * fz;
    if (alive) {
      const sT = (K.right ? 1 : 0) - (K.left ? 1 : 0); steer += (sT - steer) * Math.min(1, dt * 7);
      if (run) yaw += steer * 1.75 * Math.min(1, Math.abs(vf) / 6) / (1 + Math.abs(vf) / 36) * (vf < -.2 ? -1 : 1) * (K.hb ? 1.5 : 1) * dt;
      yaw += spinV * dt; spinV *= Math.exp(-3 * dt);
    } else { yaw += spinV * dt; spinV *= Math.exp(-1.5 * dt); }
    fx = Math.cos(yaw); fz = Math.sin(yaw); const rx = -fz, rz = fx; vf = vx * fx + vz * fz; let vl = vx * rx + vz * rz;
    const bst = run && K.boost && boost > .02, vmax = bst ? 46 : 31;
    if (run) {
      if (bst) boost = Math.max(0, boost - dt * .2); else boost = Math.min(1, boost + dt * .03);
      if (K.up) { if (vf < -.5) vf += 34 * dt; else vf += (bst ? 24 : 15) * Math.max(0, 1 - vf / vmax) * dt; }
      if (K.down) { if (vf > .5) vf -= 34 * dt; else vf = Math.max(-9, vf - 9 * dt); }
    }
    if (!run || (!K.up && !K.down)) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.6 + Math.abs(vf) * .05) * dt);
    if (K.hb && run) vf -= vf * 1.4 * dt;
    if (vf > vmax) vf -= (vf - vmax) * dt * 1.5;
    vl *= Math.exp(-(K.hb && run ? 1.3 : 7) * dt);
    AU.drive(Math.abs(vf), K.up && run ? 1 : 0, bst, Math.abs(vl) + (K.hb && run ? Math.abs(vf) * .5 : 0), run, alive); AU.siren(t, run); if (bst && !bstWas) AU.boost(); bstWas = bst;
    if (run && timeLeft < 15 && Math.ceil(timeLeft) !== lastTick) { lastTick = Math.ceil(timeLeft); AU.tick(); }
    vx = fx * vf + rx * vl; vz = fz * vf + rz * vl; vanX += vx * dt; vanZ += vz * dt;
    // traffic
    proj(vanX, vanZ); const ps = PS;
    for (const a of ai) {
      const spd = a.lane.v * (a.stun > 0 ? .3 : 1); a.stun -= dt; a.vx = 0; a.vz = 0;
      a.s += a.lane.dir * spd * dt; if (a.s < ps - 110 || a.s > ps + 330) { if (ps + 150 < LEN - 70) placeAI(a, ps + 150, Math.min(ps + 300, LEN - 70)); else a.s = -999; }
      const ok = a.s > 8 && a.s < LEN - 14; a.g.visible = ok; if (!ok) continue;
      fr(a.s); a.x = F.x + F.nx * a.lane.lat; a.z = F.z + F.nz * a.lane.lat; a.gx = F.tx * a.lane.dir; a.gz = F.tz * a.lane.dir; a.vx = a.gx * spd; a.vz = a.gz * spd;
      a.g.position.set(a.x, 0, a.z); a.g.rotation.y = Math.atan2(-a.gx, -a.gz); }
    ai.forEach(a => { if (a.s < 8 || a.s > LEN - 14) { a.x = 1e6; a.z = 1e6; } });
    if (alive) collide(dt);
    proj(vanX, vanZ); if (alive && PS > prog) prog = PS;
    // pickups, checkpoints, delivery
    if (run) {
      for (const v of vials3) { if (v.got || Math.abs(v.s - PS) > 20) continue; if ((v.x - vanX) * (v.x - vanX) + (v.z - vanZ) * (v.z - vanZ) < 7) { v.got = true; v.g.visible = false; nVials++; viEl.textContent = nVials; boost = Math.min(1, boost + .25); timeLeft += 2; AU.vial(); } }
      for (const p of potholes) { if (Math.abs(p.s - PS) > 14) { p.hit = false; continue; } if (p.hit) continue;
        for (const [a, b2] of [[1.26, -.86], [1.26, .86], [-1.18, -.86], [-1.18, .86]]) { const wx = vanX + fx * a + rx * b2, wz = vanZ + fz * a + rz * b2; if ((wx - p.x) * (wx - p.x) + (wz - p.z) * (wz - p.z) < (p.r + .3) * (p.r + .3)) { p.hit = true; vx *= .55; vz *= .55; jolt = 1; shake = Math.max(shake, .3); spinV += (Math.random() - .5) * .25; AU.pothole(); showBanner("Pothole! Slowed down"); break; } } }
      while (nChk < LMD.length && PS >= LMD[nChk].s) { timeLeft += 12; chkPts += 150; showBanner(LMD[nChk].name + "  +12 s"); AU.chk(); nChk++; }
      const dd = Math.hypot(vanX - RX, vanZ - RZ);
      if (dd < RING.r + 5 && !ringHint && PS > LEN - 140) { ringHint = true; showBanner("Park in the green ring to hand over the antidote"); }
      if (dd < RING.r - .6 && Math.hypot(vx, vz) < 5) { over("win"); }
    }
    // visibility of far landmarks, animation
    lms.forEach(o => { const vis = Math.abs(o.s - PS) < 300; o.g.visible = vis; if (vis) o.dyn.forEach(f => f(t)); });
    vials3.forEach(v => { if (v.got) return; const nr = Math.abs(v.s - PS) < 190; v.g.visible = nr; if (nr) { v.g.rotation.y += dt * 2.4; v.g.position.y = Math.sin(t * 3 + v.s) * .12; } });
    for (const l of lamps) if (l.down && l.a < 1.57) { l.w += dt * 7; l.a = Math.min(1.57, l.a + l.w * dt); l.g.quaternion.setFromAxisAngle(_v.set(l.dz, 0, -l.dx), l.a); if (l.a >= 1.57) AU.pothole(); }
    rotors.forEach((r, i) => r.rotation.z += dt * (.5 + i % 3 * .1)); ring.children[0].material.opacity = .22 + .08 * Math.sin(t * 4);
    // van model
    van.position.set(vanX, 0, vanZ); van.rotation.y = Math.atan2(-fx, -fz);
    vb.rotation.z = -steer * Math.min(1, Math.abs(vf) / 25) * .05 * (vf >= 0 ? 1 : -1); vb.rotation.x = -(K.up ? .015 : 0) + (K.down && vf > 1 ? .025 : 0); jolt = Math.max(0, jolt - dt * 3); vb.position.y = (run ? Math.sin(t * 24) * .01 * Math.min(1, Math.abs(vf) / 10) : 0) + jolt * Math.sin(t * 38) * .07; vb.rotation.x += jolt * Math.sin(t * 30) * .04;
    wheels.forEach(w => w.rotation.x += vf * dt * 2.2);
    const flip = Math.floor(t * 6) % 2; beaconA.visible = !!flip; beaconB.visible = !flip;
    blueL.position.set(vanX, 2.6, vanZ); redL.position.set(vanX, 2.6, vanZ); blueL.intensity = flip ? 2.2 : .2; redL.intensity = flip ? .2 : 2.2;
    tl.color.setHex(K.down && vf > .5 ? 0xff7070 : 0xff2d2d);
    sun.position.set(vanX + 16, 16, vanZ - 6); sun.target.position.set(vanX, 0, vanZ);
    // smoke when badly damaged
    if (hp < 38 && alive) { smokeT -= dt; if (smokeT <= 0) { smokeT = .09; const s = smoke.find(q => q.life <= 0); if (s) { s.life = 1; s.m.visible = true; s.m.position.set(vanX - fx * -2.6 + (Math.random() - .5) * .6, 1.6, vanZ - fz * -2.6 + (Math.random() - .5) * .6); s.m.scale.setScalar(.6); } } }
    smoke.forEach(s => { if (s.life > 0) { s.life -= dt * .7; s.m.position.y += dt * 2.2; s.m.scale.addScalar(dt * 1.4); s.m.material.opacity = Math.max(0, s.life * .5); if (s.life <= 0) s.m.visible = false; } });
    // camera
    const lerp = Math.min(1, dt * 3.4); camF.x += (fx - camF.x) * lerp; camF.z += (fz - camF.z) * lerp; const cm = Math.hypot(camF.x, camF.z) || 1; camF.x /= cm; camF.z /= cm;
    const back = 8.4 + Math.min(3, Math.abs(vf) * .06); shake = Math.max(0, shake - dt * 1.4);
    cam.position.set(vanX - camF.x * back + (Math.random() - .5) * shake, 3.8 + (Math.random() - .5) * shake * .7 + (bst ? (Math.random() - .5) * .05 : 0), vanZ - camF.z * back + (Math.random() - .5) * shake);
    cam.lookAt(vanX + camF.x * 9, 1.3, vanZ + camF.z * 9);
    const fov = 60 + Math.min(10, Math.abs(vf) * .22) + (bst ? 8 : 0); cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
    sky.position.copy(cam.position); sunDisc.position.set(cam.position.x + 170, 24, cam.position.z - 60); sunGlow.position.copy(sunDisc.position);
    seaT.offset.x = t * .004;
    // HUD
    scEl.textContent = curScore().toLocaleString("en-GB"); spEl.textContent = Math.round(Math.abs(vf) * 2.237); boEl.style.width = Math.round(boost * 100) + "%";
    $("hp").style.width = Math.round(hp) + "%"; $("hp").style.background = hp > 55 ? "linear-gradient(90deg,#4caf50,#9be564)" : hp > 28 ? "#ffb020" : "#ff3b30";
    $("tm").textContent = fmtT(timeLeft); $("tm").style.color = timeLeft < 20 ? "#ff7b72" : "#fff";
    let ln = LOC[0][1]; LOC.forEach(l => { if (PS >= l[0] * LEN) ln = l[1]; }); if (ln !== lastLoc) { lastLoc = ln; locEl.textContent = ln; }
    const nxt = nChk < LMD.length ? LMD[nChk] : null, dm = Math.max(0, Math.round((nxt ? nxt.s : DEST) - PS));
    $("gps").textContent = nxt ? "Next: " + nxt.name + " \u00b7 " + dm + " m" : "Hospital \u00b7 " + (dm >= 1000 ? (dm / 1000).toFixed(1) + " km" : dm + " m");
    drawMap();
    renderer.render(scene, cam);
  }
  $("go").onclick = () => { AU.init(); reset(); running = true; ov.hidden = true; };
  loadBoard(); reset(); last = performance.now(); raf = requestAnimationFrame(frame);
  return function close() {
    dead = true; AU.close(); cancelAnimationFrame(raf); clearTimeout(bt); offs.forEach(f => f());
    try { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
  };
}

function ensureThree(cb, fail) {
  if (window.THREE) return cb();
  const s = document.createElement("script"); s.src = "vendor/three-r128.min.js?v=r128"; s.onload = cb; s.onerror = fail; document.head.appendChild(s);
}
function onKeyEscAR(e) { if (e.key === "Escape" && root) { e.preventDefault(); e.stopPropagation(); closeGame(); } }
function open() {
  if (window.__pdOpen || loading) return;
  window.__pdOpen = true; loading = true;
  if (!document.getElementById("arCss")) { const st = document.createElement("style"); st.id = "arCss"; st.textContent = CSS; document.head.appendChild(st); }
  root = document.createElement("div"); root.id = "arRoot"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Antidote Rush");
  root.innerHTML = HTML; document.body.appendChild(root);
  root.querySelector(".arx").addEventListener("click", closeGame);
  window.addEventListener("keydown", onKeyEscAR, true);
  ensureThree(() => { loading = false; if (!root) return; try { stopFn = build(); } catch (e) { closeGame(); } }, () => { loading = false; closeGame(); });
}
function closeGame() {
  window.removeEventListener("keydown", onKeyEscAR, true);
  if (stopFn) { try { stopFn(); } catch (e) {} stopFn = null; }
  if (root) { root.remove(); root = null; }
  loading = false; window.__pdOpen = false;
}
window.PortalRush = { open };
})();

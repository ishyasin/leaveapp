/* Coastal Flight (easter egg 9, ED&G Pharmacy Portal). Self-contained 3D game: GRAEMe flies west to east along the Sussex coast,
   past Worthing Pier, the West Pier ruins, the i360, Brighton Palace Pier and the Royal Pavilion.
   Mouse, drag, arrows or WASD steer; Space or hold boosts. Esc or Exit leaves. three.js r128 is hosted in vendor/three-r128.min.js.
   Only the weekly best scores are shared (submit_coast_score / get_coast_weekly). */
(function () {
"use strict";
if (window.PortalCoast) return;
let root = null, stopFn = null, loading = false;
const CSS = `#cfRoot body{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:12px}
#cfRoot .cfg{position:relative;width:100%;aspect-ratio:16/10;max-height:72vh;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 18px 40px -20px #000;touch-action:none;user-select:none;cursor:crosshair}
#cfRoot canvas{display:block;width:100%;height:100%}
#cfRoot .hud{position:absolute;left:14px;right:14px;top:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;font-weight:800;font-size:17px;text-shadow:0 2px 6px rgba(0,0,0,.7);pointer-events:none;color:#fff}
#cfRoot .hud small{display:block;font-weight:600;font-size:11px;opacity:.8}
#cfRoot .meter{width:120px;height:10px;border-radius:6px;background:rgba(255,255,255,.25);overflow:hidden;margin-top:4px}
#cfRoot .meter i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#00b8e6,#4caf50)}
#cfRoot .loc{position:absolute;left:14px;top:58px;font-weight:700;font-size:12.5px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.8);pointer-events:none;max-width:40%}
#cfRoot .banner{position:absolute;left:50%;top:24%;transform:translate(-50%,-8px);opacity:0;transition:opacity .35s,transform .35s;background:rgba(10,24,60,.74);border:1px solid rgba(255,255,255,.35);padding:8px 18px;border-radius:999px;font-weight:800;font-size:clamp(14px,2.6vw,19px);color:#fff;pointer-events:none;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis}
#cfRoot .banner.on{opacity:1;transform:translate(-50%,0)}
#cfRoot .route{position:absolute;left:50%;bottom:32px;width:min(320px,66%);height:4px;background:rgba(255,255,255,.35);border-radius:3px;transform:translateX(-50%);pointer-events:none}
#cfRoot .route b{position:absolute;top:-3px;width:2px;height:10px;background:#fff}
#cfRoot .route u{position:absolute;top:10px;font-size:9.5px;font-weight:700;text-decoration:none;white-space:nowrap;transform:translateX(-50%);color:#fff;text-shadow:0 1px 4px #000}
#cfRoot .route u.up{top:-22px}
#cfRoot .route .dot{position:absolute;top:-5px;left:0;width:12px;height:12px;border-radius:50%;background:#00b8e6;border:2px solid #fff;transform:translateX(-50%)}
#cfRoot .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;background:rgba(10,18,44,.7);padding:16px;color:#fff}
#cfRoot .ov[hidden]{display:none}
#cfRoot .ov h2{margin:0;font-size:32px;letter-spacing:-.5px}
#cfRoot .ov .sub{color:#c9d6f5;max-width:46ch}
#cfRoot button{font:inherit;font-weight:800;padding:10px 24px;border-radius:10px;border:0;background:#00b8e6;color:#fff;cursor:pointer}
#cfRoot .rule{display:flex;height:3px;width:90px;border-radius:2px;overflow:hidden}
#cfRoot .rule span{flex:1}
#cfRoot .rule span:nth-child(1){background:#fff}
#cfRoot .rule span:nth-child(2){background:#00b8e6}
#cfRoot .rule span:nth-child(3){background:#4caf50}
#cfRoot .keys{font-size:12.5px;color:#c9d6f5}
#cfRoot{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at 50% 30%,#14235c 0,#070d26 75%);display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif;color:#eef2ff}
#cfRoot .cfx{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.08);color:#dfe6ff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px 14px;font:600 14px 'Segoe UI',Arial,sans-serif;cursor:pointer;z-index:3}
#cfRoot .cfx:hover{background:rgba(255,255,255,.18)}
#cfRoot .cfs{position:absolute;top:14px;right:84px;background:rgba(255,255,255,.08);color:#dfe6ff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px 14px;font:600 14px 'Segoe UI',Arial,sans-serif;cursor:pointer;z-index:3}
#cfRoot .cfs:hover{background:rgba(255,255,255,.18)}
#cfRoot .cfg{width:min(96vw,calc(86vh*1.6));max-height:none;aspect-ratio:16/10;border:2px solid #1d2c6b;box-shadow:0 0 0 1px #000,0 0 40px rgba(0,184,230,.18)}
#cfRoot .ov{background:rgba(12,22,64,.78)}
#cfRoot .ov .brand{font:800 15px 'Segoe UI',Arial,sans-serif;letter-spacing:.08em;color:#fff}
#cfRoot .cfh{color:#9fb0d6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
#cfRoot .cfr{display:flex;justify-content:space-between;gap:18px;color:#d5defa;font-size:14px;padding:1px 0}
#cfRoot .cfr.me{color:#00cfff}
#cfRoot .cfb{min-width:210px}
`;
const HTML = `<button class="cfx" type="button">Exit</button><button class="cfs snd" type="button">Sound on</button><div class="cfg" id="cfstage"><div class="hud"><div><span id="cfsc">0</span><small>score</small></div><div style="text-align:center"><span id="cfhp">&hearts;&hearts;&hearts;</span><div class="meter"><i id="cfbo"></i></div><small>boost (Space / hold)</small></div><div style="text-align:right"><span id="cfal">0</span> m<small id="cfbest">Best 0</small></div></div><div class="loc" id="cfloc"></div><div class="banner" id="cfbn"></div><div class="route" id="cfroute"><span class="dot" id="cfrdot"></span></div><div class="ov" id="cfov"><div class="brand">ED&amp;G&trade;</div><div class="rule"><span></span><span></span><span></span></div><h2>Coastal Flight</h2><div class="sub">Fly west to east along the Sussex coast: Worthing Pier, the i360, Brighton Palace Pier and the Royal Pavilion. Hoops for points, capsules for boost, a golden loop for a trick.</div><div class="cfb" id="cfboard"></div><button id="cfgo" type="button">Take off</button><div class="keys">Mouse / drag / arrows steer &middot; Space or hold to boost &middot; Esc to exit</div></div></div>`;
function build() {
  const $ = id => root.querySelector("#cf" + id);
  const stage = root.querySelector(".cfg"), ov = $("ov");
  const scEl = $("sc"), hpEl = $("hp"), boEl = $("bo"), alEl = $("al"), bestEl = $("best"), locEl = $("loc"), bnEl = $("bn"), rdot = $("rdot");
  let dead = false, raf = 0, bonus = 0; const offs = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputEncoding = THREE.sRGBEncoding;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  const scene = new THREE.Scene();
  const FOG = 0xffbf93;
  const skyC = document.createElement("canvas"); skyC.width = 4; skyC.height = 256; const sx = skyC.getContext("2d");
  const gr = sx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#3a68b4"); gr.addColorStop(.3, "#8fb5e4"); gr.addColorStop(.43, "#ffd3a8"); gr.addColorStop(.5, "#ffbf93"); gr.addColorStop(1, "#ffbf93");
  sx.fillStyle = gr; sx.fillRect(0, 0, 4, 256);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 16, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyC), side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false })); sky.renderOrder = -10; scene.add(sky);
  scene.fog = new THREE.Fog(FOG, 100, 245);
  const cam = new THREE.PerspectiveCamera(65, 16 / 10, .1, 260);
  scene.add(new THREE.HemisphereLight(0xdbe6ff, 0xc9a48c, .8));
  const sun = new THREE.DirectionalLight(0xffd0a0, 1.5); sun.position.set(12, 22, -30); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, far: 120 }); scene.add(sun); scene.add(sun.target);
  const SUNP = [34, 17, -225];
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false })); sunDisc.position.set(...SUNP); scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(38, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .28, fog: false, depthWrite: false })); sunGlow.position.set(...SUNP); scene.add(sunGlow);


  // ---------- GRAEMe ----------
  const M = {
    white: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .2, clearcoat: 1, clearcoatRoughness: .12 }),
    black: new THREE.MeshPhysicalMaterial({ color: 0x07090e, roughness: .3, metalness: .2, clearcoat: .9, clearcoatRoughness: .15 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: .05, metalness: .5, clearcoat: 1 }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x00cfff }),
    cyanSoft: new THREE.MeshStandardMaterial({ color: 0x00cfff, emissive: 0x00b8e6, emissiveIntensity: 1.6, roughness: .3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: .35, metalness: .85 })
  };
  const S = (geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  const sph = new THREE.SphereGeometry(1, 36, 24);
  const robot = new THREE.Group(), bodyG = new THREE.Group(); robot.add(bodyG); robot.scale.setScalar(.72);
  const head = new THREE.Group(); head.position.set(0, 1.55, 0); bodyG.add(head);
  head.add(S(sph, M.white, 0, 0, 0, 1.22, 1.02, 1.08));
  head.add(S(sph, M.visor, 0, -.02, .5, .98, .8, .62));
  const eyes = new THREE.Group(); eyes.position.set(0, .02, 1.08); head.add(eyes);
  [-.4, .4].forEach(x => { const e = new THREE.Mesh(new THREE.TorusGeometry(.2, .045, 10, 24, Math.PI), M.cyan); e.position.x = x; e.scale.z = .7; eyes.add(e); });
  [1, -1].forEach(s => { const g = new THREE.Group(); g.position.set(s * 1.2, -.02, .05); g.rotation.y = s * Math.PI / 2;
    const c = S(new THREE.CylinderGeometry(.46, .46, .22, 28), M.black); c.rotation.x = Math.PI / 2; g.add(c);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(.4, .05, 10, 28), M.cyanSoft); r1.position.z = .12; g.add(r1);
    const d = new THREE.Mesh(new THREE.CircleGeometry(.26, 24), M.cyan); d.position.z = .125; g.add(d); head.add(g); });
  const ant = new THREE.Group(); ant.position.set(-.25, .92, -.05); ant.rotation.z = .32; head.add(ant);
  ant.add(S(new THREE.CylinderGeometry(.04, .05, .5, 8), M.black, 0, .25, 0)); ant.add(S(new THREE.SphereGeometry(.14, 16, 12), M.cyanSoft, 0, .58, 0));
  head.add(S(new THREE.CylinderGeometry(.5, .6, .26, 24), M.black, 0, -.98, 0));
  const torso = new THREE.Group(); torso.position.set(0, .35, 0); bodyG.add(torso);
  torso.add(S(sph, M.white, 0, 0, 0, .82, .95, .72)); torso.add(S(sph, M.black, 0, -.55, 0, .6, .55, .55));
  const plate = S(new THREE.BoxGeometry(.5, .5, .1), M.black, 0, .12, .66); plate.rotation.x = -.12; torso.add(plate);
  const cA = S(new THREE.BoxGeometry(.3, .09, .04), M.cyanSoft, 0, .12, .73), cB = S(new THREE.BoxGeometry(.09, .3, .04), M.cyanSoft, 0, .12, .73); cA.rotation.x = cB.rotation.x = -.12; torso.add(cA, cB);
  function arm(s) { const g = new THREE.Group(); g.position.set(s * .85, 1.0, .08); bodyG.add(g); const up = new THREE.Group(); g.add(up);
    up.add(S(new THREE.SphereGeometry(.26, 16, 12), M.black)); up.add(S(new THREE.CylinderGeometry(.17, .16, .5, 14), M.white, 0, -.32, 0));
    const el = new THREE.Group(); el.position.set(0, -.62, 0); up.add(el); el.add(S(new THREE.SphereGeometry(.18, 14, 10), M.black)); el.add(S(new THREE.CylinderGeometry(.15, .14, .45, 14), M.white, 0, -.28, 0));
    el.add(S(sph, M.white, 0, -.58, 0, .24, .24, .24)); return { g, up, el }; }
  const aL = arm(-1), aR = arm(1);
  const pack = new THREE.Group(); pack.position.set(0, .45, -.78); bodyG.add(pack);
  pack.add(S(new THREE.BoxGeometry(1.0, 1.3, .55), M.black)); pack.add(S(new THREE.BoxGeometry(.9, .08, .58), M.cyanSoft, 0, .25, 0)); pack.add(S(new THREE.BoxGeometry(.9, .08, .58), M.cyanSoft, 0, -.05, 0));
  const flames = [];
  [-.28, .28].forEach(x => { pack.add(S(new THREE.CylinderGeometry(.2, .27, .3, 14), M.metal, x, -.78, 0)); const f = new THREE.Mesh(new THREE.ConeGeometry(.2, 1.6, 14), new THREE.MeshBasicMaterial({ color: 0x57e6ff, transparent: true, opacity: .85 })); f.rotation.x = Math.PI; f.position.set(x, -1.7, 0); pack.add(f);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(.1, .9, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); f2.rotation.x = Math.PI; f2.position.set(x, -1.4, 0); pack.add(f2); flames.push(f, f2); });
  const jetL = new THREE.PointLight(0x00cfff, 1.4, 12); jetL.position.set(0, -.5, -1.4); bodyG.add(jetL);
  // flying pose: Superman style, looking back at the player over his shoulder
  bodyG.rotation.x = .38; aL.up.rotation.x = aR.up.rotation.x = -1.1; aL.up.rotation.z = .15; aR.up.rotation.z = -.15; aL.el.rotation.x = aR.el.rotation.x = -.15;
  robot.rotation.y = Math.PI; head.rotation.y = 0; head.rotation.x = .12;
  const player = new THREE.Group(), trickG = new THREE.Group(); trickG.add(robot); player.add(trickG); scene.add(player);
  const flameMats = flames.map(f => f.material);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0, depthWrite: false })); player.add(shield);

  // ---------- Helpers ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const col = (c, r = .9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const B = (w, h, d, mat, x = 0, y = 0, z = 0, cast = false) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; return m; };
  const CY = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); return m; };
  const mSand = col(0xe3cfa0, 1), mWet = col(0xbda57a, 1), mProm = col(0xcfc9bf), mRoad = col(0x464952, .95), mLand = col(0x688655, 1), mHill = col(0x7c9a5e, 1), mSlate = col(0x4a4f5a, .8);
  const mWood = col(0x8a6a4a), mIron = col(0x2e3440, .6, .4), mWhite = col(0xf4f1ea, .6), mCream = col(0xf1e2c4, .7), mTeal = col(0x2aa6a0, .5), mRust = col(0x5b3a2a, .9, .3), mGoldM = col(0xd8a52a, .4, .7);
  const mBulb = new THREE.MeshBasicMaterial({ color: 0xfff0b0 }), mCyanB = new THREE.MeshBasicMaterial({ color: 0x00cfff });
  const bulbG = new THREE.SphereGeometry(.16, 8, 6);

  // ---------- Sea ----------
  function seaTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#9fc3d2"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 320; i++) { const px = Math.random() * 230, py = Math.random() * 256, l = 8 + Math.random() * 24; x.strokeStyle = Math.random() < .5 ? "rgba(255,255,255,.45)" : "rgba(30,90,125,.4)"; x.lineWidth = 1 + Math.random() * 1.6; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 3, px + l, py); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 64); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t; }
  const seaT = seaTex();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 720), new THREE.MeshPhongMaterial({ color: 0x3d8fb2, map: seaT, specular: 0x000000, shininess: 1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(60, 0, -210); sea.receiveShadow = true; scene.add(sea);
  // ---------- Shore ----------
  function facade(base, floors) { const c = document.createElement("canvas"); c.width = 128; c.height = floors * 42; const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 128, c.height);
    for (let f = 0; f < floors; f++) { x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(0, f * 42, 128, 3);
      for (let q = 0; q < 3; q++) { const wx = 12 + q * 38, wy = f * 42 + 9; x.fillStyle = "#ffffff"; x.fillRect(wx - 3, wy - 3, 28, 34); x.fillStyle = Math.random() < .12 ? "#ffd98a" : "#3b4a66"; x.fillRect(wx, wy, 22, 28); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(wx + 10, wy, 2, 28); } }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t; }
  const pastel = ["#f3e6cf", "#efd2cd", "#d5e2ee", "#fbf6ea", "#f1e6b6", "#d8e8d5"];
  const terr = pastel.map(c => [3, 4, 5, 7].map(f => new THREE.MeshStandardMaterial({ map: facade(c, f), roughness: .85 })));
  const hutCols = [0xe8575a, 0x3aa6b9, 0xf2c14e, 0x7bc47f, 0xf28ab2, 0xffffff, 0x6a7fd6].map(c => col(c, .7));
  const mLamp = col(0x2a2f3a, .6, .5), mSail = col(0xffffff, .7), mHull = [col(0xd6483a), col(0x2d4f9e), col(0x222831), col(0xf2c14e)];
  const SEG = 90, segs = [];
  function farTurbine(x, z) { const g = new THREE.Group(); g.add(CY(.5, .8, 34, mWhite, 0, 17, 0, 8)); for (let k = 0; k < 3; k++) { const b = B(.5, 15, .2, mWhite, 0, 7.5, 0); const h = new THREE.Group(); h.add(b); h.rotation.z = k * 2.094 + Math.random(); h.position.set(0, 34, 1); g.add(h); } g.position.set(x, 0, z); return g; }
  // ---------- Traffic ----------
  const mTyre = col(0x15171c, .9), mGlass = col(0x25303f, .3, .4), mTail = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), mHead = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const carCols = [0xc0392b, 0x2d4f9e, 0xf2f2f2, 0x222831, 0x8d99a6, 0xf2c14e, 0x3a8f5a, 0xd9d9d9, 0x7a3b8f].map(c => col(c, .35, .3));
  const mBus = col(0xd9253a, .5, .2), mBus2 = col(0x1d3f8f, .5, .2);
  const wheelG = new THREE.CylinderGeometry(.36, .36, .28, 12);
  function car(kind) {
    const g = new THREE.Group();
    if (kind === "bus") {
      const m = Math.random() < .5 ? mBus : mBus2; g.add(B(2.5, 4.6, 10.5, m, 0, 2.7, 0)); g.add(B(2.52, .9, 10.4, mGlass, 0, 2.2, 0)); g.add(B(2.52, .9, 10.4, mGlass, 0, 4.1, 0));
      [[-1.1, -5.3], [1.1, -5.3]].forEach(([x, z]) => g.add(B(.4, .25, .05, mHead, x, 1.1, z))); [-1.1, 1.1].forEach(x => g.add(B(.4, .25, .05, mTail, x, 1.1, 5.3)));
      [[-1.25, -3.3], [1.25, -3.3], [-1.25, 3.2], [1.25, 3.2]].forEach(([x, z]) => { const w = new THREE.Mesh(wheelG, mTyre); w.rotation.z = Math.PI / 2; w.position.set(x, .5, z); w.scale.set(1.4, 1, 1.4); g.add(w); });
    } else {
      const m = carCols[Math.floor(Math.random() * carCols.length)], van = kind === "van";
      g.add(B(1.9, .75, 4.3, m, 0, .65, 0)); g.add(B(1.65, van ? 1.2 : .7, van ? 2.8 : 2.2, van ? m : mGlass, 0, van ? 1.5 : 1.3, van ? .7 : .2));
      if (!van) g.add(B(1.7, .08, 2.0, m, 0, 1.68, .2));
      [-.7, .7].forEach(x => { g.add(B(.4, .2, .05, mHead, x, .75, -2.16)); g.add(B(.4, .2, .05, mTail, x, .75, 2.16)); });
      [[-.95, -1.4], [.95, -1.4], [-.95, 1.4], [.95, 1.4]].forEach(([x, z]) => { const w = new THREE.Mesh(wheelG, mTyre); w.rotation.z = Math.PI / 2; w.position.set(x, .36, z); g.add(w); });
    }
    return g;
  }
  function makeSeg() {
    const g = new THREE.Group(), land = new THREE.Group(); land.position.x = -16; g.add(land);
    land.add(B(8, .41, SEG, mSand, -18, 0, 0)); land.add(B(2.6, .42, SEG, mWet, -15.3, 0, 0));
    const foam = new THREE.Mesh(new THREE.BoxGeometry(1.8, .04, SEG), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 })); foam.position.set(-14.4, .06, 0); land.add(foam);
    land.add(B(7, .9, SEG, mProm, -25.5, .25, 0)); land.add(B(8, .5, SEG, mRoad, -33.5, 0, 0)); land.add(B(1.6, .55, SEG, mProm, -38.3, .05, 0)); land.add(B(160, .8, SEG, mLand, -132, 0, 0));
    for (let z = -SEG / 2 + 3; z < SEG / 2; z += 7) land.add(B(.18, .02, 3, mWhite, -33.5, .27, z));
    for (let z = -SEG / 2 + 5; z < SEG / 2; z += 15) { land.add(CY(.08, .11, 3.4, mLamp, -22.3, 2.4, z, 6)); const b = new THREE.Mesh(bulbG, mBulb); b.position.set(-22.3, 4.2, z); land.add(b); }
    for (let i = 0; i < 3; i++) land.add(B(7, .5, .5, mWood, -17.5, .45, rnd(-SEG / 2 + 4, SEG / 2 - 4)));
    for (let i = 0; i < 6; i++) { const z = rnd(-SEG / 2 + 3, SEG / 2 - 3), x = rnd(-21, -16.5); land.add(B(1.9, 2.2, 2.3, hutCols[Math.floor(Math.random() * hutCols.length)], x, 1.3, z)); land.add(B(2.2, .22, 2.6, mSlate, x, 2.5, z)); }
    for (let z = -SEG / 2 + 6; z < SEG / 2 - 2; z += 10.5) {
      if (Math.random() < .12) continue;
      const fl = Math.random() < .12 ? 3 : Math.floor(Math.random() * 3), floors = [3, 4, 5, 7][fl], h = floors * 4.2, ci = Math.floor(Math.random() * 6), bw = 9.6, zz = z + rnd(-.4, .4);
      land.add(B(10, h, bw, terr[ci][fl], -44, h / 2 + .3, zz)); land.add(B(10.4, .5, bw + .1, mSlate, -44, h + .55, zz));
    }
    for (let i = 0; i < 3; i++) { const r = rnd(30, 48), top = rnd(16, 28), sy = .55, h = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10), mHill); h.scale.set(1.4, sy, 1.1); h.position.set(rnd(-170, -118), top - r * sy, rnd(-SEG / 2, SEG / 2)); land.add(h); }
    // traffic: eastbound (same way as GRAEMe) on the left lane, westbound on the right
    g.userData.cars = [];
    for (const east of [true, false]) { const sp = (east ? -1 : 1) * (east ? 12 : 15); for (let k = 0; k < 6; k++) {
      const kind = k === 2 ? "bus" : k % 3 === 1 ? "van" : "car", c = car(kind);
      c.position.set(-16 + (east ? -35.6 : -31.4), .25, -SEG / 2 + k * SEG / 6 + rnd(-3, 3)); if (!east) c.rotation.y = Math.PI;
      c.userData = { v: sp, z0: c.position.z }; g.add(c); g.userData.cars.push(c); } }
    for (let i = 0; i < 2; i++) { const bt = new THREE.Group(); bt.add(B(1.4, .6, 4, mHull[Math.floor(Math.random() * 4)], 0, .3, 0)); bt.add(CY(.05, .05, 5, mSail, 0, 3, -.2, 6)); const sl = B(.06, 4.2, 2.4, mSail, 0, 3, .9); bt.add(sl); bt.position.set(rnd(-14, 70), 0, rnd(-SEG / 2, SEG / 2)); bt.rotation.y = rnd(-.4, .4); g.add(bt); }
    for (let i = 0; i < 3; i++) g.add(farTurbine(rnd(85, 160), rnd(-SEG / 2, SEG / 2)));
    return g;
  }
  for (let i = 0; i < 4; i++) { const s = makeSeg(); s.position.z = 40 - i * SEG; scene.add(s); segs.push(s); }
  // drifting clouds
  const clouds = [], mCloud = new THREE.MeshBasicMaterial({ color: 0xfff1e6, transparent: true, opacity: .8, fog: true });
  for (let i = 0; i < 18; i++) { const c = new THREE.Group(); for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 3, 10, 8), mCloud); s.position.set(k * 3.2 - 6, Math.random() * 1.2, Math.random() * 2); s.scale.y = .5; c.add(s); } c.position.set((Math.random() - .5) * 220, 30 + Math.random() * 18, -Math.random() * 300 + 20); scene.add(c); clouds.push(c); }
  // speed streaks
  const NS = 100, stP = new Float32Array(NS * 6), stG = new THREE.BufferGeometry(); stG.setAttribute("position", new THREE.BufferAttribute(stP, 3));
  const streaks = new THREE.LineSegments(stG, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4 })); streaks.frustumCulled = false; scene.add(streaks);
  const stI = []; for (let i = 0; i < NS; i++) stI.push({ x: (Math.random() - .5) * 70, y: Math.random() * 18, z: -Math.random() * 80 });

  // ---------- Pick-ups and hazards ----------
  const things = [];
  const mRing = new THREE.MeshStandardMaterial({ color: 0x00cfff, emissive: 0x00a6d6, emissiveIntensity: 1.3, roughness: .3 });
  function ring() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(2.1, .22, 12, 36), mRing)); const i2 = new THREE.Mesh(new THREE.TorusGeometry(1.6, .05, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6 })); g.add(i2); g.userData = { kind: "ring" }; return g; }
  const mGold = new THREE.MeshStandardMaterial({ color: 0xe8a200, emissive: 0xff9500, emissiveIntensity: 1.4, roughness: .3, metalness: .6, fog: false });
  function goldRing() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(3.1, .38, 14, 44), mGold)); const i2 = new THREE.Mesh(new THREE.TorusGeometry(2.5, .08, 8, 44), new THREE.MeshBasicMaterial({ color: 0xfff1a6, transparent: true, opacity: .8 })); g.add(i2);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .13, side: THREE.DoubleSide, depthWrite: false })); g.add(gl); g.userData = { kind: "gold" }; return g; }
  function capsule() { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x4caf50, emissive: 0x2fb35a, emissiveIntensity: .9, roughness: .3 });
    const a = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .7, 14), m), b = new THREE.Mesh(new THREE.SphereGeometry(.4, 14, 10), m), c = b.clone(); a.rotation.z = Math.PI / 2; b.position.x = .35; c.position.x = -.35;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.41, .41, .35, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 })); w.rotation.z = Math.PI / 2; g.add(a, b, c, w); g.userData = { kind: "cap" }; return g; }
  function heart() { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xd01f45, emissiveIntensity: .8 });
    const a = new THREE.Mesh(new THREE.SphereGeometry(.45, 14, 10), m), b = a.clone(); a.position.set(-.3, .2, 0); b.position.set(.3, .2, 0); const t = new THREE.Mesh(new THREE.ConeGeometry(.68, .9, 4), m); t.rotation.z = Math.PI; t.position.y = -.35; t.rotation.y = Math.PI / 4; g.add(a, b, t); g.userData = { kind: "heart" }; return g; }
  // offshore wind turbine (Rampion style)
  function turbine(hub) { const g = new THREE.Group(); const p = CY(.22, .45, hub, mWhite, 0, hub / 2, 0, 10); p.castShadow = true; g.add(p); g.add(B(.55, .55, 1.4, mWhite, 0, hub, .2));
    const rot = new THREE.Group(); rot.position.set(0, hub, .95); g.add(rot); rot.add(new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), mWhite));
    for (let k = 0; k < 3; k++) { const bl = new THREE.Group(); bl.add(B(.3, 2.9, .07, mWhite, 0, 1.55, 0)); bl.rotation.z = k * 2.094; rot.add(bl); }
    g.add(B(2.6, .5, 2.6, col(0xd8483a), 0, .25, 0)); g.userData = { kind: "turb", h: hub, rot }; return g; }
  // seagull
  const mGull = col(0xf6f6f2, .7), mGullG = col(0x8f98a5, .7), mBeak = col(0xf2a31a, .6);
  function gull() { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 10), mGull); body.scale.set(.62, .5, 1.15); g.add(body);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.27, 10, 8), mGull); hd.position.set(0, .14, -.72); g.add(hd); const bk = new THREE.Mesh(new THREE.ConeGeometry(.07, .34, 6), mBeak); bk.rotation.x = -Math.PI / 2; bk.position.set(0, .1, -1.05); g.add(bk);
    g.add(B(.3, .06, .6, mGullG, 0, .02, .9)); const w = [];
    for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * .25, .1, -.05); const inner = B(1.2, .06, .75, mGull, s * .6, 0, 0); a.add(inner); const o = new THREE.Group(); o.position.set(s * 1.2, 0, 0); o.add(B(1.1, .05, .55, mGullG, s * .55, 0, .05)); a.add(o); g.add(a); w.push({ a, o, s }); }
    g.userData = { kind: "gull", ph: Math.random() * 6, w }; return g; }

  // ---------- Landmarks ----------
  function signTex(txt, bg, fg) { const c = document.createElement("canvas"); c.width = 512; c.height = 128; const x = c.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, 512, 128); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, 496, 112);
    let fs = 60; x.textAlign = "center"; x.textBaseline = "middle"; do { fs -= 2; x.font = "800 " + fs + "px system-ui,sans-serif"; } while (x.measureText(txt).width > 450 && fs > 16);
    x.fillStyle = fg; x.fillText(txt, 256, 66); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
  const sign = (txt, bg, fg, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(txt, bg, fg), fog: false }));
  const dome = (r, hh, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.scale.y = hh / r; return m; };
  const onionPts = [[.001, 0], [.7, 0], [1, .35], [1.05, .7], [.8, 1.1], [.4, 1.5], [.1, 1.9], [.001, 2.15]].map(p => new THREE.Vector2(p[0], p[1]));
  const onion = (r, h, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.LatheGeometry(onionPts, 22), mat); m.scale.set(r, h / 2.15, r); m.position.set(x, y, z); m.castShadow = true; return m; };

  function pier(o) {
    const g = new THREE.Group(), boxes = [], xs = -54, xe = o.xe, Dd = o.Dd, len = xe - xs, cx = (xs + xe) / 2;
    const deck = B(len, .6, Dd, mWood, cx, 4.5, 0, true); g.add(deck); g.add(B(len, .3, Dd - .4, mIron, cx, 4.05, 0));
    [-1, 1].forEach(s => { g.add(B(len, .1, .1, mWhite, cx, 5.55, s * (Dd / 2 - .12))); g.add(B(len, .1, .1, mWhite, cx, 5.15, s * (Dd / 2 - .12))); });
    for (let x = xs + 1; x < xe; x += 3) { [-1, 1].forEach(s => g.add(B(.1, 1.1, .1, mWhite, x, 5.1, s * (Dd / 2 - .12)))); const b = new THREE.Mesh(bulbG, mBulb); b.position.set(x, 5.8, ((x / 3 | 0) % 2 ? 1 : -1) * (Dd / 2 - .12)); g.add(b); }
    for (let x = xs + 2; x < xe; x += 6) { [-1, 1].forEach(s => g.add(CY(.28, .36, 4.2, mIron, x, 2.1, s * (Dd / 2 - .7), 8))); if (x > -18 && x < 18) boxes.push({ x0: x - .4, x1: x + .4, y0: 0, y1: 4.2, z0: -Dd / 2, z1: Dd / 2 }); }
    boxes.push({ x0: xs, x1: xe, y0: 3.8, y1: 5.7, z0: -Dd / 2, z1: Dd / 2 });
    const gz = Dd / 2 - .02;
    if (o.name === "w") {
      const sg = sign("WORTHING PIER", "#12306b", "#ffffff", 9, 2.25); sg.position.set(-34, 9.2, 0); g.add(sg); [-38.5, -29.5].forEach(x => g.add(CY(.14, .14, 5, mIron, x, 7.3, 0, 6)));
      const pv = new THREE.Group(); pv.position.set(20, 4.8, 0);
      pv.add(B(10, 3.2, 6.2, mWhite, 0, 1.6, 0, true)); pv.add(B(10.4, .35, 6.6, mTeal, 0, 3.4, 0)); const dm = dome(3.2, 2, mWhite); dm.scale.x = 1.55; dm.position.y = 3.5; pv.add(dm);
      pv.add(B(8.4, .6, .1, mCyanB, 0, 1.9, 3.12)); pv.add(B(1.7, 5.2, 1.7, mWhite, 4.3, 2.6, 0)); pv.add(B(2, .3, 2, mTeal, 4.3, 5.3, 0)); pv.add(CY(.05, .05, 2.2, mIron, 4.3, 6.4, 0, 5)); g.add(pv);
      [[-6, 4.8, 3.6], [-3, 4.8, 3.6]].forEach(() => {}); g.add(B(2.4, 2, 2.2, mCream, -26, 5.9, 0)); g.add(B(2.8, .3, 2.6, mTeal, -26, 7, 0)); boxes.push({ x0: 14.8, x1: 25.2, y0: 4.6, y1: 8.8, z0: -3.4, z1: 3.4 });
    } else {
      const sg = sign("BRIGHTON PALACE PIER", "#0f5c57", "#fff3c9", 11, 2.75); sg.position.set(-40, 10.7, Dd / 2 - .3); g.add(sg);
      g.add(B(13, 5, Dd - 1, mCream, -40, 7.3, 0, true)); const dm = dome(3.6, 3.4, mTeal); dm.position.set(-40, 9.8, 0); g.add(dm); [-45, -35].forEach(x => { const t = CY(.3, .3, 3, mWhite, x, 11.8, 0, 8); g.add(t); g.add(B(1.8, .8, .05, col(0xe8575a), x + 1, 12.9, 0)); });
      [[14, 0xe86a8c], [21, 0x2aa6a0], [29, 0xf2c14e]].forEach(([x, c]) => { const m = col(c, .5); g.add(B(4, 2.4, 4, mWhite, x, 6, 0)); const d = dome(2.7, 2.2, m); d.position.set(x, 7.2, 0); g.add(d); g.add(CY(.06, .06, 1.6, mIron, x, 9.3, 0, 5)); });
      const wh = new THREE.Group(); wh.position.set(2, 11.2, 0); const wr = new THREE.Group(); wh.add(wr);
      [-.6, .6].forEach(z => { const r = new THREE.Mesh(new THREE.TorusGeometry(4.6, .14, 8, 40), mWhite); r.position.z = z; wr.add(r); const r2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, .07, 6, 32), mCyanB); r2.position.z = z; wr.add(r2); });
      const gcol = [0xe8575a, 0x00b8e6, 0xf2c14e, 0x4caf50]; const gond = [];
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const sp = B(4.6, .08, .08, mWhite, Math.cos(a) * 2.3, Math.sin(a) * 2.3, .6); sp.rotation.z = a; wr.add(sp); const sp2 = sp.clone(); sp2.position.z = -.6; wr.add(sp2);
        const gp = new THREE.Group(); gp.position.set(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0); gp.add(B(1, .8, 1.5, col(gcol[k % 4], .5), 0, -.6, 0)); wr.add(gp); gond.push(gp); }
      wh.add(new THREE.Mesh(new THREE.SphereGeometry(.5, 10, 8), mWhite));
      g.add(wh);
      [[-1.9, -1.2], [5.9, 1.2]].forEach(([x, dx]) => { const ln = Math.hypot(4, 6.9); const l = CY(.22, .26, ln, mWhite, (x + 2) / 2 + .0, 8, 0, 6); l.position.set((x + 2) / 2, (4.8 + 11.2) / 2, 0); l.rotation.z = -Math.atan2(2 - x, 6.4); g.add(l); });
      boxes.push({ x0: -2.6, x1: -1.0, y0: 4.8, y1: 8.8, z0: -1.4, z1: 1.4 }, { x0: 5.0, x1: 6.6, y0: 4.8, y1: 8.8, z0: -1.4, z1: 1.4 });
      boxes.push({ x0: 12, x1: 16, y0: 4.6, y1: 9.8, z0: -2.2, z1: 2.2 }); g.userData.circs = [{ x: 2, y: 11.2, r: 4.7, zh: 1.1 }]; g.userData.dyn = (o2, t) => { wr.rotation.z = -t * .28; gond.forEach(gp => gp.rotation.z = t * .28); };
    }
    g.userData.kind = "lm"; g.userData.D = Math.max(Dd, 8); g.userData.boxes = boxes; g.userData.under = { x0: xs, x1: xe, z0: -Dd / 2, z1: Dd / 2, pts: o.name === "w" ? 60 : 90 }; return g;
  }
  function westPier() {
    const g = new THREE.Group(); const boxes = [];
    [-6, 6].forEach(x => [-4, 0, 4].forEach(z => g.add(CY(.26, .34, 8.6, mRust, x, 4.3, z, 8))));
    [-4, 0, 4].forEach(z => { [[-7.6, -2.2], [2.2, 7.6]].forEach(([a, b]) => { if (Math.random() < .85) g.add(B(b - a, .32, .32, mRust, (a + b) / 2, 8.5, z)); }); g.add(B(13, .2, .2, mRust, 0, 4.4, z)); });
    [1, -1].forEach(s => [-4, 0, 4].forEach(z => { const a = new THREE.Mesh(new THREE.TorusGeometry(6.4, .2, 6, 14, Math.PI * .34), mRust); a.position.set(0, 2.1, z); a.rotation.z = s > 0 ? Math.PI * .5 - Math.PI * .34 : Math.PI * .5; g.add(a); }));
    g.add(B(15, .4, 10, mRust, 0, .8, 0)); g.add(B(6, 3, 3, mRust, 0, 2.2, 0)); 
    boxes.push({ x0: -7.6, x1: -3.2, y0: 0, y1: 9.2, z0: -4.6, z1: 4.6 }, { x0: 3.2, x1: 7.6, y0: 0, y1: 9.2, z0: -4.6, z1: 4.6 });
    g.scale.x = 1.7; g.userData = { kind: "lm", D: 10, boxes: boxes.map(q => ({ x0: q.x0 * 1.7, x1: q.x1 * 1.7, y0: q.y0, y1: q.y1, z0: q.z0, z1: q.z1 })) }; return g;
  }
  function i360() {
    const g = new THREE.Group(); g.add(B(7, .7, 7, mCream, -17, .35, 0)); const tw = CY(.6, 1.05, 58, mWhite, -17, 29.7, 0, 14); tw.castShadow = true; g.add(tw);
    const pod = new THREE.Group(); const tr = new THREE.Mesh(new THREE.TorusGeometry(2.2, .95, 12, 28), mWhite); tr.rotation.x = Math.PI / 2; tr.scale.z = .6; pod.add(tr);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(3.12, 3.12, .85, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x6fd6f2, emissive: 0x1196c0, emissiveIntensity: .6, roughness: .1, transparent: true, opacity: .8 })); pod.add(gl);
    pod.position.set(-17, 20, 0); g.add(pod); g.add(B(.9, .9, .9, mCyanB, -17, 59.3, 0));
    const boxes = [{ x0: -18.2, x1: -15.8, y0: 0, y1: 60, z0: -1.3, z1: 1.3 }, { x0: -20.3, x1: -13.7, y0: 0, y1: 0, z0: -3.2, z1: 3.2 }];
    const ph = Math.random() * 6; g.userData = { kind: "lm", D: 8, boxes, dyn: (o, t) => { const y = 21 + 15 * Math.sin(t * .5 + ph); pod.position.y = y; boxes[1].y0 = y - 1.4; boxes[1].y1 = y + 1.4; } }; return g;
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

  // ---------- Route timeline (distance along one lap) ----------
  const LAP = 3400, SPZ = 190;
  const add = (o, x, y, z) => { o.position.set(x, y, z); scene.add(o); things.push(o); return o; };
  const TL = [
    { at: 450, quiet: [380, 540], fn: z => add(pier({ name: "w", xe: 27, Dd: 3.4 }), 0, 0, z) },
    { at: 1200, quiet: [1130, 1280], fn: z => add(westPier(), 0, 0, z) },
    { at: 1420, quiet: [1350, 1480], fn: z => add(i360(), 0, 0, z) },
    { at: 2100, quiet: [2020, 2210], fn: z => add(pier({ name: "b", xe: 40, Dd: 7 }), 0, 0, z) },
    { at: 2900, quiet: [2780, 2950], fn: z => add(pavilion(), -96, 0, z) }
  ];
  for (let i = 0; i < 6; i++) TL.push({ at: 2790 + i * 14, fn: z => { const x = Math.sin(i * .9) * 5; add(ring(), x, 6.5 + Math.cos(i * .9) * 2.5, z); } });
  TL.push({ at: 2880, fn: z => add(goldRing(), 0, 7.5, z) });
  TL.sort((a, b) => a.at - b.at);
  const PASS = [
    { at: 0, text: "Worthing seafront" }, { at: 450, text: "Worthing Pier" }, { at: 820, text: "Hove seafront" }, { at: 1200, text: "West Pier (ruins)" },
    { at: 1420, text: "The i360" }, { at: 1650, text: "Brighton seafront" }, { at: 2100, text: "Brighton Palace Pier" }, { at: 2500, text: "Kemp Town" }, { at: 2900, text: "Royal Pavilion \u00b7 journey complete +250", bonus: 250 }
  ];
  const LOC = [[0, "Worthing seafront"], [500, "Heading east"], [820, "Hove"], [1200, "West Pier & i360"], [1520, "Brighton seafront"], [2200, "Brighton"], [2500, "Kemp Town"], [2820, "Royal Pavilion"], [3100, "Heading west again"]];
  const STOPS = [[450, "Worthing Pier"], [1200, "West Pier"], [1420, "i360"], [2100, "Palace Pier"], [2900, "Royal Pavilion"]];
  STOPS.forEach((s, i) => { const b = document.createElement("b"), u = document.createElement("u"); b.style.left = u.style.left = (s[0] / LAP * 100) + "%"; u.textContent = s[1]; if (i % 2) u.className = "up"; $("route").append(b, u); });
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function loadBoard() { const el = $("board"); if (!el || typeof sb === "undefined") return; try { Promise.resolve(sb.rpc("get_coast_weekly", { p_weeks_ago: 0 })).then(r => { const d = (r && r.data) || []; if (dead || !el.isConnected) return;
    el.innerHTML = d.length ? '<div class="cfh">This week</div>' + d.slice(0, 5).map(x => '<div class="cfr' + (x.is_me ? " me" : "") + '"><span>' + x.rank + ". " + esc(x.display_name) + "</span><span>" + Number(x.score).toLocaleString("en-GB") + "</span></div>").join("") : ""; }).catch(() => {}); } catch (e) {} }

  // ---------- Spawning ----------
  const BX = 16, BYMIN = 1.6, BYMAX = 13;
  let lapOff = 0, li = 0, pi = 0, lapNo = 1;
  const inQuiet = P => TL.some(e => e.quiet && P >= e.quiet[0] && P <= e.quiet[1]);
  function spawn(lapD) {
    const z = -SPZ, r = Math.random();
    if (inQuiet(lapD + SPZ)) {
      const q = Math.random();
      if (q < .06) add(goldRing(), rnd(-9, 9), rnd(5, 10.5), z);
      else if (q < .7) { const n = 1 + Math.floor(Math.random() * 3), x0 = rnd(-11, 11), y0 = rnd(4, 11), dx = rnd(-4, 4), dy = rnd(-1.5, 1.5); for (let i = 0; i < n; i++) add(ring(), Math.max(-BX + 2, Math.min(BX - 2, x0 + dx * i)), Math.max(3.5, Math.min(12, y0 + dy * i)), z - i * 16); }
      else if (q < .92) add(capsule(), rnd(-11, 11), rnd(4, 11), z); else add(heart(), rnd(-11, 11), rnd(4, 11), z);
      return;
    }
    if (r < .1) { add(goldRing(), rnd(-9, 9), rnd(5, 10.5), z); }
    else if (r < .45) { const n = 1 + Math.floor(Math.random() * 3), x0 = rnd(-11, 11), y0 = rnd(4, 11), dx = rnd(-4, 4), dy = rnd(-1.5, 1.5); for (let i = 0; i < n; i++) add(ring(), Math.max(-BX + 2, Math.min(BX - 2, x0 + dx * i)), Math.max(3.5, Math.min(12, y0 + dy * i)), z - i * 16); }
    else if (r < .68) { const gap = Math.floor(Math.random() * 6); for (let i = 0; i < 6; i++) { if (i === gap) continue; if (Math.random() < .3) continue; add(turbine(rnd(10, 12.5)), -12.5 + i * 5, 0, z); } if (Math.random() < .7) add(capsule(), -12.5 + gap * 5, rnd(4, 9), z); }
    else if (r < .9) { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) add(gull(), rnd(-BX + 1, BX - 1), rnd(3, 12), z - i * 9); if (Math.random() < .6) add(capsule(), rnd(-11, 11), rnd(4, 10), z - 18); }
    else { add(capsule(), rnd(-11, 11), rnd(4, 11), z); if (Math.random() < .25) add(heart(), rnd(-11, 11), rnd(4, 11), z - 12); }
  }

  // ---------- State and controls ----------
  let trick = 0, surge = 0, sparks = null, bt = 0;
  let speed, dist, score, hearts, boost, alive, running = false, t = 0, best = 0, nextAt, invul, shake, boosting = false, combo, tx = 0, ty = 6, px = 0, py = 6;
  try { best = +localStorage.getItem("cfbest") || 0; } catch (e) {}
  bestEl.textContent = "Best " + best;
  const heartsTxt = () => { hpEl.textContent = "\u2665".repeat(Math.max(0, hearts)) + "\u2661".repeat(Math.max(0, 3 - hearts)); };
  function showBanner(txt) { bnEl.textContent = txt; bnEl.classList.add("on"); clearTimeout(bt); bt = setTimeout(() => bnEl.classList.remove("on"), 3000); }
  function reset() { things.forEach(o => scene.remove(o)); things.length = 0; speed = 28; dist = 0; score = 0; hearts = 3; boost = 1; alive = true; nextAt = 40; invul = 0; shake = 0; combo = 0; trick = 0; surge = 0; trickG.rotation.set(0, 0, 0); tx = 0; ty = 6; px = 0; py = 6; player.position.set(0, 6, 0); lapOff = 0; li = 0; pi = 0; lapNo = 1; bnEl.classList.remove("on"); heartsTxt(); }
  const keys = {};
  on(window, "keydown", e => { const k = e.key.toLowerCase(); keys[k] = true; if (k === " ") { if (!ov.hidden) $("go").click(); else boosting = true; e.preventDefault(); } if (k === "enter" && !ov.hidden) $("go").click(); if (k.startsWith("arrow")) e.preventDefault(); });
  on(window, "keyup", e => { const k = e.key.toLowerCase(); keys[k] = false; if (k === " ") boosting = false; });
  function pointer(e) { const r = stage.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height; tx = (nx - .5) * 2 * BX; ty = BYMAX - ny * (BYMAX - BYMIN); }
  stage.addEventListener("pointermove", e => { if (running && alive && (e.pointerType === "mouse" || e.buttons)) pointer(e); });
  let hold = null; stage.addEventListener("pointerdown", e => { pointer(e); hold = setTimeout(() => boosting = true, 350); });
  on(window, "pointerup", () => { clearTimeout(hold); if (!keys[" "]) boosting = false; });
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  on(window, "resize", resize); resize();
  // ---------- Sound (Web Audio, no files). M or the Sound button mutes; the choice is remembered. ----------
  const AU = (() => {
    let ac = null, master = null, on = true, nzb = null, wg = null, wf = null, eg = null, e1 = null, e2 = null, ef = null, sg = null, so = null, kg = null, kf = null, hg = null, ho = null, rg = null, rf = null, ag = null, af = null, abOn = false;
    try { on = localStorage.getItem("pdSound") !== "off"; } catch (e) {}
    const btn = root.querySelector(".snd"), label = () => { if (btn) btn.textContent = on ? "Sound on" : "Sound off"; };
    const noise = (dur, type, f, v, t0, q) => { if (!ac) return; const s = ac.createBufferSource(); s.buffer = nzb; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = ac.createGain(); const t = t0 || ac.currentTime; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05); };
    const tone = (f, t, d, type, v, to) => { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .03); };
    const loopNoise = (type, f, q) => { const s = ac.createBufferSource(); s.buffer = nzb; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return [g, fl]; };
    const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
    const set = (p, v, k) => { if (ac) p.setTargetAtTime(v, ac.currentTime, k || .08); };
    const T = () => ac.currentTime;
        const setup = () => {
      ho = osc("sawtooth", 1100); const ho2 = osc("sine", 1650); const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 4; hg = ac.createGain(); hg.gain.value = 0; ho.connect(f); ho2.connect(f); f.connect(hg); hg.connect(master); ho.w2 = ho2;
      [rg, rf] = loopNoise("lowpass", 240, .5); [ag, af] = loopNoise("lowpass", 520, .8);
      const lf = osc("sine", 31), lg = ac.createGain(); lg.gain.value = .5; lf.connect(lg); lg.connect(ag.gain); };
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
      fly(sp, bo, run) { if (!ac) return; const k = run ? 1 : 0;
        set(wg.gain, k * (.07 + sp * .003 + (bo ? .06 : 0)), .2); set(wf.frequency, 900 + sp * 25 + (bo ? 500 : 0), .25);
        set(rg.gain, k * (.2 + sp * .008 + (bo ? .12 : 0)), .2); set(rf.frequency, 220 + sp * 6 + (bo ? 120 : 0), .25);
        set(ho.frequency, 1000 + sp * 22 + (bo ? 450 : 0), .3); ho.w2.frequency.setTargetAtTime(1500 + sp * 33 + (bo ? 650 : 0), ac.currentTime, .3); set(hg.gain, k * (.012 + (bo ? .01 : 0)), .2);
        set(ag.gain, k && bo ? .34 : 0, bo ? .08 : .25); set(af.frequency, bo ? 700 : 400, .15); },
      ring(c) { if (!ac) return; const t = T(), f = 523 * Math.pow(2, Math.min(c, 12) / 12 * .9); tone(f, t, .18, "triangle", .16); tone(f * 1.5, t + .07, .22, "triangle", .14); noise(.12, "highpass", 5000, .04, t); },
      miss() { if (ac) tone(260, T(), .2, "triangle", .07, 150); },
      gold() { if (!ac) return; const t = T(); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * .07, .2, "square", .08)); noise(.5, "highpass", 3000, .05, t); },
      cap() { if (!ac) return; const t = T(); tone(880, t, .08, "square", .08); tone(1320, t + .06, .12, "square", .08); },
      heart() { if (ac) [659, 880, 1175].forEach((f, i) => tone(f, T() + i * .09, .18, "sine", .16)); },
      bonus() { if (!ac) return; tone(988, T(), .1, "square", .08); tone(1480, T() + .08, .18, "square", .08); },
      boost() { if (!ac) return; const t = T(); const o = ac.createBufferSource(); o.buffer = nzb; const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 1; fl.frequency.setValueAtTime(200, t); fl.frequency.exponentialRampToValueAtTime(1800, t + .22); fl.frequency.exponentialRampToValueAtTime(500, t + .9); const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + .9); o.connect(fl); fl.connect(g); g.connect(master); o.start(t, Math.random()); o.stop(t + 1); tone(60, t, .35, "sine", .3, 38); },
      hit() { if (!ac) return; const t = T(); noise(.35, "lowpass", 900, .35, t); tone(110, t, .4, "sawtooth", .25, 45); },
      over() { if (ac) [392, 330, 262, 196].forEach((f, i) => tone(f, T() + i * .18, .3, "triangle", .14)); }
    });
    label(); return api;
  })();
  if (root.querySelector(".snd")) on(root.querySelector(".snd"), "click", () => AU.toggle());
  on(window, "keydown", e => { if (e.key && e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey) AU.toggle(); });
  let boWas = false;

  function hurt() {
    if (invul > 0 || trick > 0) return; AU.hit(); hearts--; invul = 1.6; shake = .5; combo = 0; heartsTxt();
    if (hearts <= 0) { alive = false; AU.over(); const total = score; if (total > best) { best = total; try { localStorage.setItem("cfbest", best); } catch (e) {} bestEl.textContent = "Best " + best; }
      ov.querySelector("h2").textContent = "Score " + total.toLocaleString("en-GB"); ov.querySelector(".sub").textContent = Math.floor(dist) + " m flown along the coast. GRAEMe needs a lie down."; $("go").textContent = "Fly again"; ov.hidden = false; $("board").innerHTML = "";
      if (total > 0 && typeof sb !== "undefined") { try { Promise.resolve(sb.rpc("submit_coast_score", { p_score: total, p_metres: Math.floor(dist) })).then(() => { if (!dead) loadBoard(); }).catch(() => {}); } catch (e) {} } else loadBoard(); }
  }
  function burst() {
    if (sparks) { scene.remove(sparks.p); }
    const n = 90, pos = new Float32Array(n * 3), vel = []; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, b = Math.random() * 3.14 - 1.57, sp = 4 + Math.random() * 9; vel.push([Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp, Math.sin(a) * Math.cos(b) * sp]); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd34d, size: .5, transparent: true, opacity: 1, depthWrite: false })); p.frustumCulled = false; p.position.copy(player.position); scene.add(p); sparks = { p, vel, age: 0 };
  }
  function startTrick() { AU.gold(); trick = 1.5; surge = 3.2; boost = 1; shake = .25; bonus = (bonus || 0) + 50; flameMats.forEach(m => m.color.set(0xffc928)); burst(); }
  let last = performance.now(), lapD = 0, locNow = "";
  function frame(now) {
    if (dead) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    const run = running && alive;
    if (run) {
      const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0), ky = (keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0);
      if (kx || ky) { tx = Math.max(-BX, Math.min(BX, tx + kx * dt * 20)); ty = Math.max(BYMIN, Math.min(BYMAX, ty + ky * dt * 11)); }
      let target = 30 + Math.min(22, dist / 60);
      if (surge > 0) { target += 34; surge -= dt; if (surge <= 0) flameMats.forEach(m => m.color.set(0x57e6ff)); } else if (boosting && boost > 0) { target += 22; boost = Math.max(0, boost - dt * .3); } else if (!boosting) boost = Math.min(1, boost + dt * .03);
      speed += (target - speed) * Math.min(1, dt * 1.5);
      dist += speed * dt; nextAt -= speed * dt; lapD = dist - lapOff;
      if (lapD >= LAP) { lapOff += LAP; lapD -= LAP; li = 0; pi = 0; lapNo++; }
      while (li < TL.length && lapD >= TL[li].at - SPZ) { const e = TL[li++]; e.fn(-(e.at - lapD)); }
      while (pi < PASS.length && lapD >= PASS[pi].at) { const p = PASS[pi++]; showBanner(p.text + (p.at === 0 && lapNo > 1 ? " \u00b7 lap " + lapNo : "")); if (p.bonus) bonus = (bonus || 0) + p.bonus; }
      if (nextAt <= 0) { spawn(lapD); nextAt = 38 + Math.random() * 16 - Math.min(16, dist / 150); }
      let ln = LOC[0][1]; LOC.forEach(l => { if (lapD >= l[0]) ln = l[1]; }); if (ln !== locNow) { locNow = ln; locEl.textContent = ln; }
      rdot.style.left = (lapD / LAP * 100) + "%";
      score = Math.floor(dist / 4) + (bonus || 0); scEl.textContent = score; alEl.textContent = Math.floor(dist);
    }
    const mv = run ? speed : running ? Math.max(0, speed - dt * 40) : 12;
    boEl.style.width = Math.round(boost * 100) + "%";
    segs.forEach(s => { s.position.z += mv * dt; s.userData.cars.forEach(c => { c.position.z += c.userData.v * dt; }); if (s.position.z > 40 + SEG) { s.position.z -= SEG * 4; s.userData.cars.forEach(c => { c.position.z = c.userData.z0; }); } });
    clouds.forEach(c => { c.position.z += mv * dt * .5; if (c.position.z > 40) { c.position.z = -280; c.position.x = (Math.random() - .5) * 220; } });
    seaT.offset.y += mv * dt / 11.25;
    // player
    px += (tx - px) * Math.min(1, dt * 7); py += (ty - py) * Math.min(1, dt * 7);
    const vx = (tx - px), vy = (ty - py);
    player.position.set(px, py + Math.sin(t * 3) * .12, 0);
    robot.rotation.z = -vx * .09; player.rotation.x = vy * .05; player.rotation.z = -vx * .05;
    head.rotation.y = Math.sin(t * .9) * .12; head.rotation.x = .12 + Math.sin(t * 1.3) * .05;
    aL.up.rotation.x = aR.up.rotation.x = -1.1 + Math.sin(t * 6) * .05;
    const bo = (surge > 0 || (boosting && boost > 0)) && run; AU.fly(mv, bo, run); if (bo && !boWas) AU.boost(); boWas = bo; flames.forEach((f, i) => { const k = (bo ? 1.7 : 1) * (1 + Math.sin(t * 40 + i) * .12 + Math.random() * .1); f.scale.set(1, k, 1); }); jetL.intensity = (bo ? 2.6 : 1.4) + Math.random() * .4;
    if (trick > 0) { trick = Math.max(0, trick - dt); const k = 1 - trick / 1.5, ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      trickG.rotation.x = -Math.PI * 2 * ease(Math.min(1, k / .55));
      trickG.rotation.y = k > .4 ? Math.PI * 2 * ease(Math.min(1, (k - .4) / .6)) : 0;
      if (trick === 0) trickG.rotation.set(0, 0, 0); }
    if (sparks) { sparks.age += dt; const pa = sparks.p.geometry.attributes.position.array; sparks.vel.forEach((v, i) => { pa[i * 3] += v[0] * dt; pa[i * 3 + 1] += v[1] * dt; pa[i * 3 + 2] += v[2] * dt + mv * dt; v[1] -= 6 * dt; }); sparks.p.geometry.attributes.position.needsUpdate = true; sparks.p.material.opacity = Math.max(0, 1 - sparks.age); if (sparks.age >= 1) { scene.remove(sparks.p); sparks = null; } }
    if (!alive) { player.rotation.z += dt * 4; player.position.y = Math.max(.8, player.position.y - dt * 8); }
    invul = Math.max(0, invul - dt); robot.visible = invul > 0 ? Math.floor(t * 18) % 2 === 0 : true; shield.material.opacity = invul > 0 ? .18 : 0;
    // things
    for (let i = things.length - 1; i >= 0; i--) {
      const o = things[i], u = o.userData; o.position.z += mv * dt;
      if (u.kind === "ring") o.rotation.z += dt * 1.2; else if (u.kind === "gold") o.rotation.z += dt * 1.6; else if (u.kind === "cap") { o.rotation.y += dt * 3; o.rotation.z += dt * 1.5; } else if (u.kind === "heart") o.rotation.y += dt * 2.5;
      else if (u.kind === "turb") u.rot.rotation.z += dt * 1.3;
      else if (u.kind === "gull") { o.position.y += Math.sin(t * 1.6 + u.ph) * dt * .8; u.w.forEach(w => { w.a.rotation.z = w.s * Math.sin(t * 9 + u.ph) * .55; w.o.rotation.z = w.s * Math.sin(t * 9 + u.ph - .9) * .45; }); }
      else if (u.dyn) u.dyn(o, t);
      if (o.position.z - (u.D || 0) / 2 > 14) { scene.remove(o); things.splice(i, 1); continue; }
      if (!run) continue;
      const dx = o.position.x - px, dy = o.position.y - py, dz = Math.abs(o.position.z);
      if (u.kind === "ring") { if (dz < 1.2 && !u.done) { u.done = true; if (Math.hypot(dx, dy) < 2.4) { combo++; bonus = (bonus || 0) + 10 + combo * 5; mRing.emissiveIntensity = 3; setTimeout(() => mRing.emissiveIntensity = 1.3, 150); AU.ring(combo); scene.remove(o); things.splice(i, 1); } else { combo = 0; AU.miss(); } } }
      else if (u.kind === "gold") { if (dz < 1.4 && !u.done) { u.done = true; if (Math.hypot(dx, dy) < 3.3) { startTrick(); scene.remove(o); things.splice(i, 1); } } }
      else if (u.kind === "cap") { if (dz < 1.4 && Math.hypot(dx, dy) < 1.8) { boost = Math.min(1, boost + .4); bonus = (bonus || 0) + 15; AU.cap(); scene.remove(o); things.splice(i, 1); } }
      else if (u.kind === "heart") { if (dz < 1.4 && Math.hypot(dx, dy) < 1.8) { hearts = Math.min(3, hearts + 1); heartsTxt(); AU.heart(); scene.remove(o); things.splice(i, 1); } }
      else if (u.kind === "turb") { if (dz < 1.7) { if (Math.abs(dx) < 1.3 && py < u.h + .4) hurt(); else if (Math.hypot(dx, dy - u.h) < 3.3) hurt(); } }
      else if (u.kind === "gull") { if (dz < 1.5 && Math.hypot(dx, dy * 1.5) < 2.0) hurt(); }
      else if (u.kind === "lm") {
        const lz = -o.position.z;
        for (const b of u.boxes) { if (lz > b.z0 - .8 && lz < b.z1 + .8 && px > b.x0 - .8 && px < b.x1 + .8 && py > b.y0 - .7 && py < b.y1 + .7) { hurt(); break; } }
        if (u.under && !u.underDone && lz > u.under.z0 && lz < u.under.z1 && px > u.under.x0 && px < u.under.x1 && py < 3.0) { u.underDone = true; AU.bonus(); bonus += u.under.pts; showBanner("Under the pier +" + u.under.pts); }
        if (u.circs) for (const c of u.circs) { if (Math.abs(lz) < c.zh + .8 && Math.hypot(px - c.x, py - c.y) < c.r + .5) { hurt(); break; } }
      }
    }
    // streaks
    const sp = stG.attributes.position.array, len = 2 + mv * .1;
    stI.forEach((s, i) => { s.z += mv * dt * 1.4; if (s.z > 12) { s.z = -80; s.x = (Math.random() - .5) * 70; s.y = Math.random() * 18; } sp[i * 6] = s.x; sp[i * 6 + 1] = s.y; sp[i * 6 + 2] = s.z; sp[i * 6 + 3] = s.x; sp[i * 6 + 4] = s.y; sp[i * 6 + 5] = s.z - len; });
    stG.attributes.position.needsUpdate = true; streaks.material.opacity = .15 + Math.min(.4, (mv - 25) * .012);
    // camera
    const fov = 65 + (bo ? 12 : 0) + (surge > 0 ? 8 : 0) + Math.max(0, mv - 30) * .2; cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
    shake = Math.max(0, shake - dt);
    cam.position.set(px * .55 + (shake ? (Math.random() - .5) * shake : 0), py * .55 + 5.2 + (shake ? (Math.random() - .5) * shake : 0), 12);
    cam.lookAt(px * .5, py * .6 + .2, -14);
    sky.position.x = cam.position.x;
    renderer.render(scene, cam);
  }
  $("go").onclick = () => { AU.init(); bonus = 0; reset(); running = true; ov.hidden = true; };
  loadBoard();
  reset(); last = performance.now(); raf = requestAnimationFrame(frame);
  return function close() {
    dead = true; AU.close(); cancelAnimationFrame(raf); clearTimeout(bt); clearTimeout(hold); offs.forEach(f => f());
    try { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
  };
}

function ensureThree(cb, fail) {
  if (window.THREE) return cb();
  const s = document.createElement("script"); s.src = "vendor/three-r128.min.js?v=r128"; s.onload = cb; s.onerror = fail; document.head.appendChild(s);
}
function onKeyEsc(e) { if (e.key === "Escape" && root) { e.preventDefault(); e.stopPropagation(); closeGame(); } }
function open() {
  if (window.__pdOpen || loading) return;
  window.__pdOpen = true; loading = true;
  if (!document.getElementById("cfCss")) { const st = document.createElement("style"); st.id = "cfCss"; st.textContent = CSS; document.head.appendChild(st); }
  root = document.createElement("div"); root.id = "cfRoot"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Coastal Flight");
  root.innerHTML = HTML; document.body.appendChild(root);
  root.querySelector(".cfx").addEventListener("click", closeGame);
  window.addEventListener("keydown", onKeyEsc, true);
  ensureThree(() => { loading = false; if (!root) return; try { stopFn = build(); } catch (e) { closeGame(); } }, () => { loading = false; closeGame(); });
}
function closeGame() {
  window.removeEventListener("keydown", onKeyEsc, true);
  if (stopFn) { try { stopFn(); } catch (e) {} stopFn = null; }
  if (root) { root.remove(); root = null; }
  loading = false; window.__pdOpen = false;
}
window.PortalCoast = { open };
})();

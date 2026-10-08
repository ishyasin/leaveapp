/* =====================================================================
   Pharmacy Portal — shared.js
   by ED&G™

   Fill in SUPABASE_URL / SUPABASE_ANON_KEY below before deploying.
   ===================================================================== */

const SUPABASE_URL = "https://otbdyjvfavghytznxzfd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9yzKRyJmB032pbBUcuTNHg_H0Lezdxf";
const LOGIN_EMAIL_DOMAIN = "leave.gdgspecialprojects.local";
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEAVE_TYPE_LABEL = {
  full_day: "Annual Leave (Full Day)",
  annual_part_day: "Annual Leave (Part Day)",
  study_leave: "Study Leave",
  toil_full_day: "TOIL (Full Day)",
  toil_part_day: "TOIL (Part Day)",
  full_day_split: "Annual Leave (Split AL/TOIL)",
};

const ROLE_LABEL = {
  pharmacist: "Pharmacist",
  lead_pharmacist: "Lead Pharmacist",
  superuser: "Clinical Team Lead",
  developer: "Developer",
};

const SITE_LABEL = {
  worthing: "Worthing Hospital",
  st_richards: "St Richard's Hospital",
};

/* =====================================================================
   Colour themes (Developer-settable per user, via set_user_theme() —
   see admin.html) and Light/Dark/Inverted colour modes (each user's own
   choice, via set_own_color_mode() — see the topbar). A theme is just
   the brand accent palette (navy/teal/honey); a colour mode is the
   light-vs-dark surface/text treatment it's drawn on top of. The two
   are independent and combine via the data-theme / data-color-mode
   attributes shared.css reads on <html> — see that file for the actual
   colour values. Keep the key lists here in sync with
   profiles_theme_check / profiles_color_mode_check in schema.sql.
   ===================================================================== */
const THEMES = {
  default:   "Default (Navy & Teal)",
  magenta:   "GD&G (Navy & Magenta)",
  forest:    "Forest",
  crimson:   "Crimson",
  halloween: "Halloween",
  christmas: "Christmas",
  easter:    "Easter",
};
const COLOR_MODES = {
  light:    "Light",
  dark:     "Dark",
  inverted: "Inverted",
};
const THEME_STORAGE_KEY = "lm_theme";
const COLOR_MODE_STORAGE_KEY = "lm_color_mode";

// Applies instantly (so the UI never has to wait on a round trip) and
// caches to localStorage purely so the next page load's inline
// bootstrap snippet (see the top of every page's <head>) can set the
// attribute before first paint, avoiding a flash of the wrong palette.
// The database profile row remains the source of truth — requireAuth()
// re-applies from it, and corrects the cache, on every page load.
function applyTheme(theme) {
  if (!THEMES[theme]) theme = "default";
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) {}
  buildThemeFx();
}

/* ---- Theme by month (Developer sets it in Admin -> Appearance) ----
   THEME_SCHEDULE maps month number (1-12) -> theme. When the current
   month has an entry, it wins over the person's own theme for everyone;
   otherwise their own theme applies. Repeats every year. */
let THEME_SCHEDULE = {};
function scheduledTheme(date) {
  const t = THEME_SCHEDULE[(date || new Date()).getMonth() + 1];
  return THEMES[t] ? t : null;
}
async function loadThemeSchedule() {
  try {
    const { data, error } = await sb.from("theme_schedule").select("month, theme");
    if (error) throw error;
    THEME_SCHEDULE = {};
    (data || []).forEach(r => { THEME_SCHEDULE[r.month] = r.theme; });
  } catch (e) { /* table not created yet, or offline: just use personal themes */ }
  return THEME_SCHEDULE;
}
function applyColorMode(mode) {
  if (!COLOR_MODES[mode]) mode = "light";
  document.documentElement.setAttribute("data-color-mode", mode);
  try { localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode); } catch (e) {}
}

// Called from the topbar's own mode picker — a personal display
// preference, so no confirmation dialog, just apply-and-save.
async function setOwnColorMode(mode) {
  applyColorMode(mode);
  try {
    const { error } = await sb.rpc("set_own_color_mode", { p_mode: mode });
    if (error) throw error;
  } catch (e) {
    // Best-effort: it still applies for this browser even if saving it
    // to the account fails (e.g. a dropped connection), so a flaky
    // network never blocks switching modes.
  }
}


/* =====================================================================
   Seasonal animations (Halloween, Christmas, Easter). Built from small
   inline-SVG sprites; all movement is CSS (see "theme fx" in shared.css)
   and is switched off for people who prefer reduced motion and when
   printing. Two layers: a banner strip under the top bar (#themeBanner)
   and a full-page, click-through layer (#themeFx) for falling snow and
   drifting ghosts.
   ===================================================================== */
const FX_SVG = {
  reindeer: `<svg viewBox="0 0 70 46" width="70" height="46" aria-hidden="true">
    <g class="leg lb"><line x1="18" y1="28" x2="15" y2="42" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/></g>
    <g class="leg lf"><line x1="24" y1="29" x2="26" y2="43" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/></g>
    <g class="leg rb"><line x1="38" y1="29" x2="36" y2="43" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/></g>
    <g class="leg rf"><line x1="44" y1="28" x2="48" y2="42" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/></g>
    <ellipse cx="30" cy="25" rx="19" ry="10" fill="#8a5a2b"/>
    <path d="M12,22 Q6,20 7,14" stroke="#6b4423" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="52" cy="15" r="8" fill="#8a5a2b"/>
    <ellipse cx="59" cy="18" rx="4.5" ry="3.6" fill="#6b4423"/>
    <circle cx="62" cy="17" r="2.6" fill="#e63946" class="nose"/>
    <circle cx="53" cy="13" r="1.5" fill="#1b1420"/>
    <polygon points="48,9 45,3 51,7" fill="#8a5a2b"/>
    <g stroke="#d9c7a0" stroke-width="2" fill="none" stroke-linecap="round"><polyline points="50,8 47,0 42,-1"/><polyline points="47,0 49,-4"/><polyline points="55,8 57,0 62,-2"/><polyline points="57,0 54,-3"/></g>
    <path d="M42,19 Q36,24 30,19" stroke="#b91c1c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`,
  ghost: `<svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">
    <path d="M4,44 L4,20 Q4,3 20,3 Q36,3 36,20 L36,44 L30,38 L25,44 L20,38 L15,44 L10,38 Z" fill="#f3f4ff"/>
    <ellipse cx="14" cy="21" rx="3.4" ry="4.6" fill="#1b1420"/><ellipse cx="26" cy="21" rx="3.4" ry="4.6" fill="#1b1420"/>
    <ellipse cx="20" cy="31" rx="4" ry="5" fill="#1b1420"/>
    <ellipse cx="9" cy="28" rx="3" ry="1.8" fill="#ffc2d4" opacity=".7"/><ellipse cx="31" cy="28" rx="3" ry="1.8" fill="#ffc2d4" opacity=".7"/>
  </svg>`,
  pumpkin: `<svg viewBox="0 0 56 52" width="56" height="52" aria-hidden="true">
    <rect x="25" y="3" width="6" height="9" rx="2" fill="#5a8a3a"/>
    <path d="M28,5 Q35,2 33,-1" stroke="#5a8a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="28" cy="30" rx="25" ry="19" fill="#f07f13"/>
    <path d="M15,13 Q10,30 15,47 M28,11 Q28,30 28,49 M41,13 Q46,30 41,47" stroke="#c9600a" stroke-width="2" fill="none"/>
    <g class="glow" fill="#ffe066"><polygon points="14,23 24,23 19,32"/><polygon points="32,23 42,23 37,32"/>
      <path d="M14,37 L19,43 L24,37 L28,43 L33,37 L37,43 L42,37 L40,45 L16,45 Z"/></g>
  </svg>`,
  bunny: `<svg viewBox="0 0 50 56" width="46" height="52" aria-hidden="true">
    <ellipse cx="17" cy="14" rx="5" ry="13" fill="#fff"/><ellipse cx="17" cy="15" rx="2.6" ry="9" fill="#ffb3c7"/>
    <ellipse cx="32" cy="14" rx="5" ry="13" fill="#fff" class="ear2"/><ellipse cx="32" cy="15" rx="2.6" ry="9" fill="#ffb3c7"/>
    <ellipse cx="24" cy="42" rx="17" ry="12" fill="#fff"/><circle cx="8" cy="46" r="5" fill="#fff"/>
    <circle cx="24" cy="29" r="12" fill="#fff"/>
    <circle cx="19" cy="27" r="1.9" fill="#3b2f4a"/><circle cx="29" cy="27" r="1.9" fill="#3b2f4a"/>
    <ellipse cx="24" cy="32" rx="2.2" ry="1.6" fill="#ff8fab"/>
    <path d="M24,33.5 Q21,37 18.5,35 M24,33.5 Q27,37 29.5,35" stroke="#3b2f4a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <circle cx="15" cy="32" r="2.4" fill="#ffc2d4" opacity=".8"/><circle cx="33" cy="32" r="2.4" fill="#ffc2d4" opacity=".8"/>
    <ellipse cx="14" cy="52" rx="6" ry="3" fill="#fff"/><ellipse cx="32" cy="52" rx="6" ry="3" fill="#fff"/>
  </svg>`,
  bunnySide: `<svg viewBox="0 0 64 52" width="62" height="50" aria-hidden="true">
    <circle cx="8" cy="34" r="5.5" fill="#fff"/>
    <ellipse cx="25" cy="34" rx="19" ry="11.5" fill="#fff"/>
    <ellipse cx="17" cy="40" rx="10" ry="8" fill="#f4eefb"/>
    <ellipse cx="14" cy="47" rx="9" ry="3.2" fill="#fff"/>
    <ellipse cx="42" cy="46" rx="6.5" ry="2.8" fill="#fff"/>
    <path d="M38,38 Q43,43 41,46" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="46" cy="22" rx="10.5" ry="9.5" fill="#fff"/>
    <ellipse cx="55" cy="25" rx="5.5" ry="4.4" fill="#fff"/>
    <ellipse cx="60" cy="24.5" rx="2" ry="1.6" fill="#ff8fab"/>
    <ellipse cx="38" cy="9" rx="4" ry="12" fill="#fff" transform="rotate(-24 38 9)"/><ellipse cx="38" cy="10" rx="1.9" ry="8" fill="#ffb3c7" transform="rotate(-24 38 10)"/>
    <ellipse cx="46" cy="7" rx="4" ry="12" fill="#fff" transform="rotate(-8 46 7)"/><ellipse cx="46" cy="8" rx="1.9" ry="8" fill="#ffb3c7" transform="rotate(-8 46 8)"/>
    <circle cx="50.5" cy="20" r="1.9" fill="#3b2f4a"/><circle cx="51" cy="19.4" r=".6" fill="#fff"/>
    <circle cx="48" cy="26" r="2.6" fill="#ffc2d4" opacity=".75"/>
    <path d="M57,27.5 Q55,30 52.5,29" stroke="#3b2f4a" stroke-width="1" fill="none" stroke-linecap="round"/>
  </svg>`,
  chick: `<svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
    <path d="M18,6 Q20,1 22,6 M22,6 Q26,2 25,8" stroke="#f4b400" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="22" r="14" fill="#ffe14d"/>
    <path d="M6,22 Q1,26 6,29 Q9,26 8,22 Z" fill="#f6c915"/><path d="M34,22 Q39,26 34,29 Q31,26 32,22 Z" fill="#f6c915"/>
    <circle cx="14.5" cy="19" r="2" fill="#2b2233"/><circle cx="25.5" cy="19" r="2" fill="#2b2233"/>
    <circle cx="15" cy="18.4" r=".7" fill="#fff"/><circle cx="26" cy="18.4" r=".7" fill="#fff"/>
    <polygon points="17,24 23,24 20,29" fill="#ff9a1f"/>
    <circle cx="10.5" cy="25" r="2.3" fill="#ffb199" opacity=".8"/><circle cx="29.5" cy="25" r="2.3" fill="#ffb199" opacity=".8"/>
    <g stroke="#ff9a1f" stroke-width="2" stroke-linecap="round"><line x1="15" y1="35" x2="15" y2="39"/><line x1="25" y1="35" x2="25" y2="39"/></g>
  </svg>`,
  egg: (c1, c2) => `<svg viewBox="0 0 24 30" width="20" height="25" aria-hidden="true"><ellipse cx="12" cy="17" rx="10" ry="12" fill="${c1}"/><path d="M3,15 Q7,11 12,15 T21,15" stroke="${c2}" stroke-width="2.2" fill="none"/><path d="M4,21 Q8,18 12,21 T20,21" stroke="${c2}" stroke-width="1.6" fill="none"/></svg>`,
  tree: `<svg viewBox="0 0 40 52" width="34" height="44" aria-hidden="true">
    <polygon points="20,2 22,7 27,7 23,10 24.5,15 20,12 15.5,15 17,10 13,7 18,7" fill="#d4af37"/>
    <polygon points="20,8 8,26 32,26" fill="#1f6b3a"/><polygon points="20,18 5,38 35,38" fill="#2f8f50"/><polygon points="20,28 2,48 38,48" fill="#1f6b3a"/>
    <rect x="17" y="46" width="6" height="6" fill="#6b4423"/>
    <circle class="lt a" cx="14" cy="26" r="2" fill="#ffd34d"/><circle class="lt b" cx="26" cy="22" r="2" fill="#ff5a5f"/>
    <circle class="lt b" cx="20" cy="36" r="2" fill="#ffd34d"/><circle class="lt a" cx="11" cy="43" r="2" fill="#ff5a5f"/><circle class="lt b" cx="29" cy="43" r="2" fill="#ffd34d"/>
  </svg>`,
};

// Animations are ON unless the person has turned them off (kept per browser).
const ANIM_STORAGE_KEY = "lm_anim";
function animationsOn() { try { return localStorage.getItem(ANIM_STORAGE_KEY) !== "off"; } catch (e) { return true; } }
function applyAnimPref() {
  document.documentElement.setAttribute("data-anim", animationsOn() ? "on" : "off");
  const b = document.getElementById("animToggle");
  if (b) { b.textContent = animationsOn() ? "Animations: On" : "Animations: Off"; b.setAttribute("aria-pressed", animationsOn() ? "true" : "false"); }
}
function toggleAnimations() {
  try { localStorage.setItem(ANIM_STORAGE_KEY, animationsOn() ? "off" : "on"); } catch (e) {}
  applyAnimPref();
}
applyAnimPref();

function fxRand(a, b) { return a + Math.random() * (b - a); }

/* ---- Easter bunny: every 90 s a bunny hops in from the left (side view),
   stops half-way across, turns to look at the viewer, then hops off to
   the right. Uses the Web Animations API; skipped when animations are
   off or the device prefers reduced motion. ---- */
const BUNNY_EVERY_MS = 90000;
let _bunnyTimer = null, _bunnyRun = 0;
function stopBunnyCycle() { clearTimeout(_bunnyTimer); _bunnyTimer = null; _bunnyRun++; }
function startBunnyCycle() {
  stopBunnyCycle();
  const run = _bunnyRun;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const alive = () => run === _bunnyRun && document.getElementById("themeBanner");
  async function once() {
    const banner = document.getElementById("themeBanner");
    const actor = banner && banner.querySelector(".bunny-actor");
    if (!actor || reduce || !animationsOn() || document.hidden) return;
    const hop = actor.querySelector(".b-hop"), side = actor.querySelector(".b-side"), front = actor.querySelector(".b-front");
    const W = banner.clientWidth, w = 62, mid = Math.round(W / 2 - w / 2), hopMs = 700;
    const hopFrames = [{ transform: "translateY(0) scale(1.08,.9)" }, { transform: "translateY(-20px) scale(1,1)", offset: .5 }, { transform: "translateY(0) scale(.96,1.04)" }];
    const travel = async (from, to) => {
      const n = Math.max(3, Math.round(Math.abs(to - from) / 64));      // one hop ≈ 64 px
      const move = actor.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: n * hopMs, easing: "linear", fill: "forwards" });
      const h = hop.animate(hopFrames, { duration: hopMs, iterations: n, easing: "ease-out" });
      await Promise.all([move.finished, h.finished]).catch(() => {});
    };
    side.style.display = ""; front.style.display = "none";
    actor.style.display = "";
    await travel(-80, mid);                       // hop in from the left
    if (!alive()) return;
    await sleep(350);
    side.style.display = "none"; front.style.display = "";   // turns to look at the viewer
    const wig = front.animate([{ transform: "rotate(0)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0)" }], { duration: 900, iterations: 3 });
    await sleep(2800);
    wig.cancel();
    if (!alive()) return;
    front.style.display = "none"; side.style.display = "";
    await sleep(250);
    await travel(mid, banner.clientWidth + 20);   // hop off to the right
    actor.style.display = "none";
  }
  const loop = async () => {
    try { await once(); } catch (e) {}
    if (run === _bunnyRun) _bunnyTimer = setTimeout(loop, BUNNY_EVERY_MS);
  };
  _bunnyTimer = setTimeout(loop, 2500);        // first visit shortly after the page loads
}

function buildThemeFx() {
  const theme = document.documentElement.getAttribute("data-theme");
  const kind = ["halloween", "christmas", "easter"].includes(theme) ? theme : null;
  const tgl = document.getElementById("animToggle");
  if (tgl) tgl.classList.toggle("show", !!kind);

  // ---- full-page layer (falling snow, drifting ghosts) ----
  let layer = document.getElementById("themeFx");
  if (!kind || kind === "easter") { if (layer) layer.remove(); layer = null; }
  else if (document.body) {
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "themeFx"; layer.className = "theme-fx"; layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    if (layer.dataset.kind !== kind) {
      layer.dataset.kind = kind;
      let h = "";
      if (kind === "christmas") {
        for (let i = 0; i < 42; i++) {
          const size = fxRand(9, 20).toFixed(1), left = fxRand(0, 100).toFixed(1);
          const dur = fxRand(9, 18).toFixed(1), delay = (-fxRand(0, 18)).toFixed(1), sway = fxRand(14, 46).toFixed(0);
          h += `<i class="flake" style="left:${left}%;font-size:${size}px;animation-duration:${dur}s,${(dur / 3).toFixed(1)}s;animation-delay:${delay}s,${delay}s;--sway:${sway}px;opacity:${fxRand(.55, .95).toFixed(2)}">${i % 3 ? "&#10052;" : "&#10053;"}</i>`;
        }
      } else {
        for (let i = 0; i < 4; i++) {
          h += `<span class="drift" style="top:${fxRand(15, 75).toFixed(0)}%;animation-duration:${fxRand(26, 44).toFixed(0)}s;animation-delay:${(-fxRand(0, 40)).toFixed(0)}s;transform:scale(${fxRand(.7, 1.15).toFixed(2)})"><span class="bob">${FX_SVG.ghost}</span></span>`;
        }
      }
      layer.innerHTML = h;
    }
  }

  // ---- banner strip under the top bar ----
  const banner = document.getElementById("themeBanner");
  if (!banner) return;
  if (!kind) { banner.innerHTML = ""; banner.dataset.kind = ""; stopBunnyCycle(); return; }
  if (banner.dataset.kind === kind) return;
  banner.dataset.kind = kind;
  let b = "";
  if (kind === "christmas") {
    for (let i = 0; i < 6; i++) b += `<span class="sprite tree" style="left:${(6 + i * 17).toFixed(0)}%">${FX_SVG.tree}</span>`;
    for (let i = 0; i < 2; i++) b += `<span class="runner" style="animation-duration:${14 + i * 3}s;animation-delay:${-i * 7}s"><span class="rd">${FX_SVG.reindeer}</span></span>`;
  } else if (kind === "halloween") {
    for (let i = 0; i < 7; i++) b += `<span class="sprite pumpkin" style="left:${(4 + i * 15).toFixed(0)}%;animation-delay:${(-fxRand(0, 3)).toFixed(1)}s">${FX_SVG.pumpkin}</span>`;
    for (let i = 0; i < 3; i++) b += `<span class="floater" style="left:${(14 + i * 33).toFixed(0)}%;animation-delay:${(-i * 2.2).toFixed(1)}s">${FX_SVG.ghost}</span>`;
  } else {
    const eggs = [["#ffb3c7", "#fff"], ["#b8e6d8", "#fff7a8"], ["#c9b8f0", "#fff"], ["#ffe08a", "#ff9ab8"]];
    for (let i = 0; i < 4; i++) b += `<span class="sprite egg" style="left:${(10 + i * 24).toFixed(0)}%">${FX_SVG.egg(...eggs[i])}</span>`;
    for (let i = 0; i < 3; i++) b += `<span class="chick" style="left:${(18 + i * 30).toFixed(0)}%;animation-delay:${(-i * 0.5).toFixed(1)}s">${FX_SVG.chick}</span>`;
    b += `<span class="bunny-actor" style="display:none"><span class="b-hop"><span class="b-side">${FX_SVG.bunnySide}</span><span class="b-front" style="display:none">${FX_SVG.bunny}</span></span></span>`;
  }
  banner.innerHTML = b;
  startBunnyCycle();
}
document.addEventListener("DOMContentLoaded", buildThemeFx);

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_ABBR = ["Sun","Mon","Tue","Wed","Thur","Fri","Sat"];
function weekdayAbbr(y, mIdx, d) { return WEEKDAY_ABBR[new Date(y, mIdx, d).getDay()]; }

/* =====================================================================
   UI dialogs — replaces window.confirm/alert/prompt everywhere in the
   app with a styled modal matching the rest of the UI, since browser-
   native dialogs look and behave inconsistently across platforms. The
   markup is injected into every page on first use rather than needing
   to be added to each HTML file individually.
   ===================================================================== */
function ensureDialogRoot() {
  if (document.getElementById("uiDialogOverlay")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="overlay" id="uiDialogOverlay" style="display:none;">
      <div class="modal">
        <h3 id="uiDialogTitle">Notice</h3>
        <p class="small" id="uiDialogMessage" style="white-space:pre-line;"></p>
        <div id="uiDialogBody"></div>
        <div id="uiDialogMsg"></div>
        <div class="modal-actions" id="uiDialogActions"></div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);
}

/** Styled replacement for window.alert(). Resolves once dismissed. */
function uiAlert(message, title) {
  return new Promise((resolve) => {
    ensureDialogRoot();
    document.getElementById("uiDialogTitle").textContent = title || "Notice";
    document.getElementById("uiDialogMessage").textContent = message;
    document.getElementById("uiDialogBody").innerHTML = "";
    document.getElementById("uiDialogMsg").innerHTML = "";
    document.getElementById("uiDialogActions").innerHTML =
      `<button class="primary" id="uiDialogOk">OK</button>`;
    document.getElementById("uiDialogOverlay").style.display = "flex";
    document.getElementById("uiDialogOk").onclick = () => {
      document.getElementById("uiDialogOverlay").style.display = "none";
      resolve();
    };
  });
}

/** Styled replacement for window.confirm(). Resolves true/false. */
function uiConfirm(message, title) {
  return new Promise((resolve) => {
    ensureDialogRoot();
    document.getElementById("uiDialogTitle").textContent = title || "Please confirm";
    document.getElementById("uiDialogMessage").textContent = message;
    document.getElementById("uiDialogBody").innerHTML = "";
    document.getElementById("uiDialogMsg").innerHTML = "";
    document.getElementById("uiDialogActions").innerHTML = `
      <button class="secondary" id="uiDialogCancel">Cancel</button>
      <button class="danger" id="uiDialogConfirm">Confirm</button>`;
    document.getElementById("uiDialogOverlay").style.display = "flex";
    const close = (result) => {
      document.getElementById("uiDialogOverlay").style.display = "none";
      resolve(result);
    };
    document.getElementById("uiDialogCancel").onclick = () => close(false);
    document.getElementById("uiDialogConfirm").onclick = () => close(true);
  });
}

/** Styled replacement for window.prompt(). Resolves the entered string,
 *  or null if cancelled. opts: {type, required, title, okLabel}. */
function uiPrompt(message, defaultValue, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    ensureDialogRoot();
    document.getElementById("uiDialogTitle").textContent = opts.title || "Input required";
    document.getElementById("uiDialogMessage").textContent = message;
    document.getElementById("uiDialogMsg").innerHTML = "";
    const inputType = opts.type || "text";
    const val = defaultValue == null ? "" : defaultValue;
    document.getElementById("uiDialogBody").innerHTML = inputType === "textarea"
      ? `<textarea id="uiDialogInput" rows="3">${escapeHtml(val)}</textarea>`
      : `<input type="${inputType}" id="uiDialogInput" value="${escapeHtml(val)}">`;
    document.getElementById("uiDialogActions").innerHTML = `
      <button class="secondary" id="uiDialogCancel">Cancel</button>
      <button class="primary" id="uiDialogConfirm">${opts.okLabel || "OK"}</button>`;
    document.getElementById("uiDialogOverlay").style.display = "flex";
    const input = document.getElementById("uiDialogInput");
    setTimeout(() => input.focus(), 30);
    const close = (result) => {
      document.getElementById("uiDialogOverlay").style.display = "none";
      resolve(result);
    };
    document.getElementById("uiDialogCancel").onclick = () => close(null);
    const submit = () => {
      const v = input.value;
      if (opts.required && !v.trim()) {
        showMsg(document.getElementById("uiDialogMsg"), "This field is required.", "error");
        return;
      }
      close(v);
    };
    document.getElementById("uiDialogConfirm").onclick = submit;
    if (inputType !== "textarea") {
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    }
  });
}

/* =====================================================================
   Reusable TOIL multi-time-range picker — a clock dial (07:00–19:00,
   5-minute increments): click once for a start time, click again for
   the end, and it becomes a highlighted range; repeat for as many
   separate ranges as needed in the same request (e.g. 08:00–10:00 AND
   16:00–18:00). Every range is also editable afterwards via a
   start/end dropdown pair in the list underneath, with its own Remove
   button, plus Undo-last-range and Clear-all. This is a factory
   function (not globals) specifically so more than one instance can
   exist on a page — e.g. the request modal and an "amend times" modal
   — without their state colliding.
   ===================================================================== */
function createTimeRangePicker(container, initialRanges) {
  const START = 420, END = 1140, STEP = 5; // 07:00–19:00
  let pending = null;
  const timeStrToMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  let ranges = (initialRanges || []).map(r => ({ start: timeStrToMin(r.start), end: timeStrToMin(r.end) }));

  function fmt(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function inRange(m) { return ranges.some(q => m >= q.start && m < q.end); }
  function sortMerge() {
    ranges.sort((a, b) => a.start - b.start);
    const out = [];
    for (const q of ranges) {
      if (out.length && q.start <= out[out.length - 1].end) {
        out[out.length - 1].end = Math.max(out[out.length - 1].end, q.end);
      } else out.push({ ...q });
    }
    ranges = out;
  }

  container.innerHTML = `
    <div class="trp-layout" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
      <div class="trp-dial-col" style="flex:0 0 auto;margin:0 auto;">
        <svg class="trp-svg" viewBox="0 0 310 310" style="width:100%;max-width:230px;touch-action:manipulation;"></svg>
      </div>
      <div class="trp-info-col" style="flex:1 1 220px;min-width:220px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;background:var(--surface-subtle);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
          <div>
            <div class="trp-instruction" style="font-weight:700;font-size:13px;"></div>
            <div class="small">Click once for start, then click again for end.</div>
          </div>
          <div class="trp-current" style="font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;"></div>
        </div>
        <div class="trp-ranges" style="max-height:150px;overflow-y:auto;"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button type="button" class="secondary trp-undo">Undo last range</button>
          <button type="button" class="secondary trp-clear">Clear all</button>
        </div>
      </div>
    </div>`;

  const svg = container.querySelector(".trp-svg");
  const instructionEl = container.querySelector(".trp-instruction");
  const currentEl = container.querySelector(".trp-current");
  const rangeListEl = container.querySelector(".trp-ranges");

  const NS = "http://www.w3.org/2000/svg";
  const cx = 155, cy = 155, r = 128;
  function E(n, attrs) {
    const el = document.createElementNS(NS, n);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function point(m, rad) {
    rad = rad == null ? r : rad;
    const f = (m - START) / (END - START);
    const a = -Math.PI / 2 + f * Math.PI * 2;
    return { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
  }

  svg.appendChild(E("circle", { cx, cy, r, fill: "#fbfcfe", stroke: "#d0d7e2", "stroke-width": 2 }));
  const arcLayer = E("g"); svg.appendChild(arcLayer);
  for (let h = 7; h <= 18; h++) {
    const p = point(h * 60, r - 26);
    const t = E("text", { x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "middle", fill: "#172033", "font-size": 11, "font-weight": 700 });
    t.textContent = String(h).padStart(2, "0");
    svg.appendChild(t);
  }
  const epText = E("text", { x: cx, y: 16, "text-anchor": "middle", fill: "#667085", "font-size": 9 });
  epText.textContent = "07:00 / 19:00";
  svg.appendChild(epText);

  // A single wide, invisible ring sits under the dots and is the REAL
  // click target for most of the dial — clicking anywhere in this
  // band computes the angle from the centre and picks the nearest
  // 5-minute time, rather than requiring a precise hit on one of the
  // 144 individual dots (which, packed this tightly, would just cause
  // mis-clicks if each dot's own hit-area were simply made bigger —
  // adjacent dots are only a few pixels apart). A click landing
  // exactly on a dot still uses that dot's own handler underneath, so
  // both paths agree.
  const hitRing = E("circle", { cx, cy, r, fill: "none", stroke: "transparent", "stroke-width": 26, "pointer-events": "stroke" });
  hitRing.style.cursor = "pointer";
  hitRing.addEventListener("click", (evt) => {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width;
    const scaleY = vb.height / rect.height;
    const clickX = (evt.clientX - rect.left) * scaleX + vb.x;
    const clickY = (evt.clientY - rect.top) * scaleY + vb.y;
    let a = Math.atan2(clickY - cy, clickX - cx) + Math.PI / 2; // 0 = 07:00 position (top)
    if (a < 0) a += 2 * Math.PI;
    const f = a / (2 * Math.PI);
    let m = START + f * (END - START);
    m = Math.round(m / STEP) * STEP;
    m = Math.max(START, Math.min(END, m));
    choose(m);
  });
  svg.appendChild(hitRing);

  const dots = [];
  for (let m = START; m < END; m += STEP) {
    const p = point(m);
    const d = E("circle", { cx: p.x, cy: p.y, r: m % 60 === 0 ? 4 : 2.2, fill: "#94a3b8", tabindex: 0, role: "button", "aria-label": "Select " + fmt(m) });
    d.style.cursor = "pointer";
    d.dataset.m = m;
    d.addEventListener("click", () => choose(m));
    d.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(m); } });
    svg.appendChild(d);
    dots.push(d);
  }
  const p19 = point(END, r - 13);
  const endDot = E("circle", { cx: p19.x, cy: p19.y, r: 4.5, fill: "#475569", tabindex: 0, role: "button", "aria-label": "Select 19:00" });
  endDot.style.cursor = "pointer";
  endDot.addEventListener("click", () => choose(END));
  svg.appendChild(endDot);

  function redrawArcs() {
    arcLayer.innerHTML = "";
    ranges.forEach((q) => {
      const samples = [];
      for (let m = q.start; m <= q.end; m += 5) samples.push(point(m, r - 16));
      if (samples.length > 1) {
        let d = "M " + samples[0].x + " " + samples[0].y;
        for (let i = 1; i < samples.length; i++) d += " L " + samples[i].x + " " + samples[i].y;
        arcLayer.appendChild(E("path", { d, fill: "none", stroke: "#dbeafe", "stroke-width": 22, "stroke-linecap": "round" }));
      }
    });
  }

  function renderRangeList() {
    rangeListEl.innerHTML = "";
    if (!ranges.length) {
      rangeListEl.innerHTML = '<div class="small">No time ranges selected yet.</div>';
      return;
    }
    ranges.forEach((q, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;margin:4px 0;border:1px solid var(--border);border-radius:6px;background:var(--surface-subtle);flex-wrap:wrap;";

      function makeSelect(value, min, max) {
        const sel = document.createElement("select");
        sel.style.cssText = "width:auto;min-width:80px;";
        for (let m = min; m <= max; m += STEP) {
          const opt = document.createElement("option");
          opt.value = m; opt.textContent = fmt(m);
          if (m === value) opt.selected = true;
          sel.appendChild(opt);
        }
        return sel;
      }

      const startSel = makeSelect(q.start, START, END - STEP);
      const endSel = makeSelect(q.end, START + STEP, END);
      const dash = document.createElement("span");
      dash.textContent = "–";
      dash.style.fontWeight = "700";

      function applyEdit() {
        let newStart = Number(startSel.value);
        let newEnd = Number(endSel.value);
        if (newEnd <= newStart) {
          newEnd = Math.min(END, newStart + STEP);
          endSel.value = String(newEnd);
        }
        ranges[i] = { start: newStart, end: newEnd };
        sortMerge();
        rerender();
      }
      startSel.addEventListener("change", applyEdit);
      endSel.addEventListener("change", applyEdit);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "danger";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => { ranges.splice(i, 1); rerender(); });

      const editWrap = document.createElement("div");
      editWrap.style.cssText = "display:flex;align-items:center;gap:6px;";
      editWrap.append(startSel, dash, endSel);
      row.append(editWrap, removeBtn);
      rangeListEl.appendChild(row);
    });
  }

  function rerender() {
    redrawArcs();
    dots.forEach((d) => {
      const m = +d.dataset.m;
      const selected = inRange(m);
      const isPending = pending === m;
      d.setAttribute("fill", isPending ? "#172033" : selected ? "#2563eb" : "#94a3b8");
      d.setAttribute("r", isPending ? 7 : selected ? 5 : (m % 60 === 0 ? 4 : 2.2));
    });
    const endSelected = ranges.some((q) => q.end === END);
    endDot.setAttribute("fill", pending === END ? "#172033" : endSelected ? "#2563eb" : "#475569");
    instructionEl.textContent = pending === null ? "Select a start time" : "Now select the end time";
    currentEl.textContent = pending === null ? "—" : fmt(pending) + " →";
    renderRangeList();
  }

  function choose(m) {
    if (pending === null) { pending = m; rerender(); return; }
    if (m === pending) { pending = null; rerender(); return; }
    const a = Math.min(pending, m), b = Math.max(pending, m);
    ranges.push({ start: a, end: b });
    pending = null;
    sortMerge();
    rerender();
  }

  container.querySelector(".trp-undo").addEventListener("click", () => {
    if (pending !== null) pending = null; else ranges.pop();
    rerender();
  });
  container.querySelector(".trp-clear").addEventListener("click", () => {
    ranges = []; pending = null; rerender();
  });

  rerender();

  return {
    getRanges() { return ranges.map((q) => ({ start: fmt(q.start), end: fmt(q.end) })); },
  };
}

/* ---------------- session / auth ---------------- */
async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

/* =====================================================================
   Outage handling — shown when the portal's backend (Supabase) can't be
   reached. Instead of a broken page, or being signed out because the
   profile couldn't be loaded, people get a clear message and the page
   retries by itself and reloads as soon as the service is back.
   (If GitHub itself is down the page never loads at all.)
   ===================================================================== */
const OUTAGE_CONTACT = "";   // optional, e.g. "Contact Ish Yasin on ext. 1234" — shown on the message
let _outageShown = false, _outageTimer = null, _profileOutage = false;

function isOutageError(e) {
  if (!e) return false;
  const st = e.status, msg = String(e.message || e);
  return st === 0 || (st >= 500 && st < 600) ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|gateway/i.test(msg);
}

async function backendReachable() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, cache: "no-store", signal: ctl.signal });
    return r.status < 500;
  } catch (e) { return false; }
  finally { clearTimeout(t); }
}

function showOutage() {
  if (_outageShown) return;
  _outageShown = true;
  const el = document.createElement("div");
  el.id = "outageOverlay";
  el.setAttribute("role", "alertdialog");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-label", "Pharmacy Portal is temporarily unavailable");
  el.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:#eef1f5;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#1a2744;overflow:auto;";
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  el.innerHTML = `
    <div style="max-width:480px;width:100%;background:#fff;border:1px solid #d9dee7;border-top:4px solid #12a0ad;border-radius:14px;padding:30px 28px;box-shadow:0 20px 50px rgba(26,39,68,.14);text-align:center;">
      <div style="font-size:22px;font-weight:800;">Pharmacy Portal</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#667085;margin:3px 0 18px;">by ED&amp;G&trade;</div>
      <h1 style="font-size:19px;margin:0 0 10px;">${offline ? "You appear to be offline" : "The portal is temporarily unavailable"}</h1>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#3b4560;">${offline
        ? "Your device has lost its internet connection. Check your network and the page will carry on by itself."
        : "The portal can&rsquo;t reach its server right now. This is usually short-lived and nothing has been lost &mdash; anything saved before this appeared is safe."}</p>
      <p style="margin:0 0 18px;font-size:13px;color:#667085;" id="outageStatus">Checking again automatically&hellip;</p>
      <button type="button" id="outageRetry" style="background:#0f7b84;color:#fff;border:0;border-radius:8px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;">Try again now</button>
      ${OUTAGE_CONTACT ? `<p style="margin:18px 0 0;font-size:13px;color:#3b4560;">${escapeHtml(OUTAGE_CONTACT)}</p>` : ""}
    </div>`;
  document.body.appendChild(el);

  const status = el.querySelector("#outageStatus");
  const check = async () => {
    status.textContent = "Checking…";
    if (await backendReachable()) { status.textContent = "Back online — reloading…"; window.location.reload(); return true; }
    status.textContent = "Still unavailable. Trying again in 15 seconds…";
    return false;
  };
  el.querySelector("#outageRetry").addEventListener("click", check);
  _outageTimer = setInterval(check, 15000);
  window.addEventListener("online", check);
}

// A failed network call that nobody caught (e.g. a page's own data load) also means an outage.
window.addEventListener("unhandledrejection", (ev) => {
  if (ev.reason instanceof TypeError || isOutageError(ev.reason)) {
    backendReachable().then(ok => { if (!ok) showOutage(); });
  }
});

async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  _profileOutage = !!error && isOutageError(error);
  if (error) return null;
  return data;
}

async function signOut() {
  try {
    // 'local' scope only clears THIS browser's session — it doesn't
    // need to revoke every other session tied to the account, which
    // is less work and less likely to hit a snag than the default
    // 'global' scope. Combined with the try/catch below, this makes
    // sign-out work even if the remote call has any trouble at all.
    await sb.auth.signOut({ scope: "local" });
  } catch (e) {
    // Even if the remote sign-out call fails (an already-expired or
    // already-rotated token, a network blip), we still want to clear
    // the local session and get back to the login page — a failed
    // network call here should never leave someone stuck unable to log out.
  }
  // Belt-and-braces: sb.auth.signOut() above can itself bail out
  // *without* clearing the stored session — it first calls
  // getSession(), which can try to silently refresh an expired/invalid
  // token, and if THAT fails, the client returns an error instead of
  // throwing and skips clearing localStorage entirely. When that
  // happened, this function still redirected to login.html believing
  // sign-out had worked, but login.html's own getSession() check found
  // the still-present session and bounced straight back into the app —
  // "signed out" in appearance only, with no way to actually log out.
  // Wiping every sb-*-auth-token key directly guarantees the session is
  // gone regardless of what the SDK call above did or didn't manage.
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    // localStorage can throw in rare cases (private browsing, storage
    // disabled) — never let that stop the redirect below.
  }
  // replace(), not href — so the browser's back button can't land on
  // a cached, still-"logged-in"-looking page after signing out.
  window.location.replace("login.html");
}

/** Call at the top of every protected page. Redirects if not logged in,
 *  not active, needs a password reset, or lacks an allowed role. */
async function requireAuth(allowedRoles) {
  const session = await getSession();
  if (!session) { window.location.href = "login.html"; return null; }

  const profile = await getCurrentProfile();
  if (!profile && _profileOutage) {
    // Backend unreachable — don't sign anyone out for that.
    showOutage();
    return null;
  }
  if (!profile || !profile.active) {
    await sb.auth.signOut();
    window.location.href = "login.html?err=inactive";
    return null;
  }
  await loadThemeSchedule();
  applyTheme(scheduledTheme() || profile.theme);
  applyColorMode(profile.color_mode);
  if (profile.must_reset_password && !window.location.pathname.endsWith("reset-password.html")) {
    window.location.href = "reset-password.html";
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    window.location.href = "portal.html";
    return null;
  }
  renderTopbar(profile);
  return profile;
}

function isLeadPlus(profile) { return ["lead_pharmacist", "superuser", "developer"].includes(profile.role); }
function isSuperuserPlus(profile) { return ["superuser", "developer"].includes(profile.role); }
function isDeveloper(profile) { return profile.role === "developer"; }
// In the on-call pool for at least one site — governs whether "My
// On-Call Dates" and "Swaps" are shown on oncall.html.
function isOncallPoolMember(profile) { return !!(profile.oncall_worthing || profile.oncall_st_richards); }

// Mirrors the database's can_process_leave_for() rule — used purely to
// show/hide Approve/Reject buttons in the UI; the real enforcement
// happens server-side in approve_leave()/reject_leave() regardless.
//  - Developer: anyone, including themselves.
//  - Clinical Team Lead (superuser): Pharmacist/Lead Pharmacist targets,
//    or their own leave — never another Clinical Team Lead's.
//  - Lead Pharmacist: Pharmacist targets only — never their own, never
//    another Lead Pharmacist's, never a Clinical Team Lead's.
function canProcessLeaveForRole(actorProfile, targetProfile) {
  if (!actorProfile || !targetProfile) return false;
  if (actorProfile.role === "developer") return true;
  if (actorProfile.role === "superuser") {
    if (targetProfile.id === actorProfile.id) return true;
    return targetProfile.role === "pharmacist" || targetProfile.role === "lead_pharmacist";
  }
  if (actorProfile.role === "lead_pharmacist") {
    return targetProfile.role === "pharmacist";
  }
  return false;
}

/* ---------------- topbar ---------------- */
function renderTopbar(profile) {
  const el = document.getElementById("topbar");
  if (!el) return;
  const page = window.location.pathname.split("/").pop();
  // Pharmacy Portal: one app-level nav across every page. Leave Manager
  // is itself a group of pages (Calendar / My Leave / Approvals), shown
  // as a second row of links whenever one of them is open. Admin and
  // Audit Trail are portal-wide, so they sit in the main nav.
  const LEAVE_PAGES = ["calendar.html", "my-leave.html", "approvals.html"];
  const inLeave = LEAVE_PAGES.includes(page);
  const links = [
    ["portal.html", "Home", page === "portal.html"],
    ["calendar.html", "Leave Manager", inLeave],
    ["huddle.html", "Huddle Board", page === "huddle.html"],
    ["links.html", "Quick Links", page === "links.html"],
    ["oncall.html", "On-Call Rota", page === "oncall.html"],
  ];
  if (isSuperuserPlus(profile)) {
    links.push(["admin.html", "Admin", page === "admin.html"]);
    links.push(["audit.html", "Audit Trail", page === "audit.html"]);
  }
  const subLinks = [["calendar.html", "Calendar"], ["my-leave.html", "My Leave"]];
  if (isLeadPlus(profile)) subLinks.push(["approvals.html", "Approvals"]);

  const modeOptions = Object.entries(COLOR_MODES)
    .map(([val, label]) => `<option value="${val}"${profile.color_mode === val ? " selected" : ""}>${label}</option>`)
    .join("");

  el.innerHTML = `
    <div class="brand">
      <div>Pharmacy Portal<small>by ED&amp;G&trade;</small></div>
    </div>
    <div class="nav">${links.map(([href,label,active]) =>
      `<a href="${href}" class="${active?'active':''}">${label}</a>`).join("")}</div>
    <div class="userbox">
      <button type="button" id="animToggle" class="anim-toggle" title="Stop or start the seasonal animations"></button>
      <select id="colorModeSelect" class="mode-select" aria-label="Display mode">${modeOptions}</select>
      <span>${escapeHtml(profile.full_name)} (${escapeHtml(profile.initials)}) &middot; ${ROLE_LABEL[profile.role]}</span>
      <button onclick="signOut()">Sign out</button>
    </div>`;
  document.getElementById("colorModeSelect").addEventListener("change", (e) => setOwnColorMode(e.target.value));
  document.getElementById("animToggle").addEventListener("click", toggleAnimations);
  applyAnimPref();

  // A thin decorative strip right under the topbar — cartoon pumpkins/
  // spiders for the Halloween theme, a tree/reindeer/snow for
  // Christmas, nothing for every other theme (see .theme-banner in
  // shared.css, which does the actual showing/hiding/artwork). Created
  // once per page as a sibling of #topbar, since every protected page
  // calls renderTopbar() exactly once.
  if (inLeave && !document.getElementById("subnav")) {
    const sub = document.createElement("div");
    sub.id = "subnav";
    sub.className = "subnav";
    sub.innerHTML = subLinks.map(([href,label]) =>
      `<a href="${href}" class="${page===href?'active':''}">${label}</a>`).join("");
    el.insertAdjacentElement("afterend", sub);
  }
  if (!document.getElementById("themeBanner")) {
    const banner = document.createElement("div");
    banner.id = "themeBanner";
    banner.className = "theme-banner";
    banner.setAttribute("aria-hidden", "true");
    (document.getElementById("subnav") || el).insertAdjacentElement("afterend", banner);
  }
  buildThemeFx();
}

/* ---------------- utils ---------------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

function pad2(n) { return String(n).padStart(2, "0"); }
function isoDate(y, mIdx, d) { return `${y}-${pad2(mIdx + 1)}-${pad2(d)}`; }
function daysInMonth(y, mIdx) { return new Date(y, mIdx + 1, 0).getDate(); }
function isWeekend(y, mIdx, d) {
  const dow = new Date(y, mIdx, d).getDay();
  return dow === 0 || dow === 6;
}
// Same check, from a 'YYYY-MM-DD' string — for validating a date-input
// value directly rather than a (year, month-index, day) triple.
function isWeekendDate(isoStr) {
  if (!isoStr) return false;
  const [y, m, d] = isoStr.split("-").map(Number);
  return isWeekend(y, m - 1, d);
}
function isToday(y, mIdx, d) {
  const t = new Date();
  return y === t.getFullYear() && mIdx === t.getMonth() && d === t.getDate();
}
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(t) {
  if (!t) return "";
  return t.slice(0, 5); // "08:30:00" -> "08:30"
}
// e.g. [{"start":"08:00","end":"10:00"},{"start":"16:00","end":"18:00"}]
// -> "08:00–10:00, 16:00–18:00"
function formatToilRanges(ranges) {
  if (!ranges || !ranges.length) return "";
  return ranges.map(r => `${r.start}\u2013${r.end}`).join(", ");
}
// Which ranges column applies for a given part-day leave_type.
function rangesFieldForType(leaveType) {
  if (leaveType === "toil_part_day") return "toil_ranges";
  if (leaveType === "annual_part_day") return "annual_leave_ranges";
  if (leaveType === "study_leave") return "study_ranges";
  return null;
}
// A note showing what was ORIGINALLY requested, when an approver has
// since amended the times to something different — "" if there's
// nothing to show (never amended, or not a part-day type at all).
// original_ranges is set once at creation and never touched again by
// amend_leave_ranges(), so any difference from the current ranges
// means it was amended after the fact.
function rangesAmendmentNote(r) {
  const field = rangesFieldForType(r.leave_type);
  if (!field || !r.original_ranges) return "";
  const current = r[field];
  if (!current || !current.length) return "";
  if (JSON.stringify(r.original_ranges) === JSON.stringify(current)) return "";
  return `Originally requested: ${formatToilRanges(r.original_ranges)}`;
}
// Reverse of the above, for the plain-text fallback entry points (the
// admin Import/Edit flows use a comma-separated prompt rather than the
// full dial picker). Returns null if any segment can't be parsed.
function parseToilRangesText(text) {
  if (!text || !text.trim()) return null;
  const timeRe = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const parts = text.split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const ranges = [];
  for (const part of parts) {
    const m = part.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return null;
    const start = m[1].padStart(5, "0");
    const end = m[2].padStart(5, "0");
    if (!timeRe.test(start) || !timeRe.test(end) || start >= end) return null;
    ranges.push({ start, end });
  }
  return ranges;
}

function showMsg(container, text, type) {
  container.innerHTML = `<div class="msg ${type}">${escapeHtml(text)}</div>`;
}

/* ---------------- edge function calls ---------------- */
async function callEdgeFunction(name, payload) {
  let session = await getSession();
  if (!session) {
    // Token missing/expired: try to refresh it once before giving up.
    try { const r = await sb.auth.refreshSession(); session = r && r.data ? r.data.session : null; } catch (e) { session = null; }
  }
  if (!session) throw new Error("Your sign-in has expired. Please sign in again (refresh the page), then retry.");
  const res = await fetch(`${EDGE_FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "request failed");
  return json;
}

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
  viewer: "Read-only (Huddle & Links)",
  huddle_poster: "Read-only + Huddle poster",
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
  antimicrobial: "Antimicrobial",
  swiftie:   "Swiftie (sparkles & bracelets)",
  barbie:    "Barbie-style (pink)",
  fairytale: "Fairytale (Disney-style)",
  autumn:    "Autumn",
  winter:    "Winter",
  spring:    "Spring",
  summer:    "Summer",
  seaside:   "Seaside",
  hills:     "South Downs (hills)",
  stdavid:   "St David's Day (Wales)",
  stgeorge:  "St George's Day (England)",
  stpatrick: "St Patrick's Day (Ireland)",
  standrew:  "St Andrew's Day (Scotland)",
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
  // ---- swiftie: generic sparkle motifs only (no likeness, lyrics, logos or album art) ----
  disco: `<svg viewBox="0 0 44 66" width="40" height="60" aria-hidden="true">
    <defs><radialGradient id="dbG" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#cfd6e6"/><stop offset="1" stop-color="#7d86a3"/></radialGradient></defs>
    <line x1="22" y1="0" x2="22" y2="16" stroke="#e8e8f2" stroke-width="1.4"/>
    <circle cx="22" cy="40" r="22" fill="url(#dbG)"/>
    <g stroke="#8d96b3" stroke-width=".8" fill="none" opacity=".85"><ellipse cx="22" cy="40" rx="22" ry="8"/><ellipse cx="22" cy="40" rx="22" ry="15"/><ellipse cx="22" cy="40" rx="8" ry="22"/><ellipse cx="22" cy="40" rx="15" ry="22"/><line x1="0" y1="40" x2="44" y2="40"/><line x1="22" y1="18" x2="22" y2="62"/></g>
    <g class="shine"><path d="M14,30 l2,-5 l2,5 l5,2 l-5,2 l-2,5 l-2,-5 l-5,-2z" fill="#fff"/><circle cx="31" cy="46" r="2" fill="#fff"/><circle cx="16" cy="51" r="1.4" fill="#fff"/></g>
  </svg>`,
  bracelet: (colors) => {
    let b = ""; const n = colors.length;
    for (let i = 0; i < n; i++) b += `<circle cx="${(9 + i * (102 / (n - 1))).toFixed(1)}" cy="${(11 + Math.sin(i * 1.3) * 2).toFixed(1)}" r="5.6" fill="${colors[i]}" stroke="#fff" stroke-width="1"/><circle cx="${(7.5 + i * (102 / (n - 1))).toFixed(1)}" cy="${(9 + Math.sin(i * 1.3) * 2).toFixed(1)}" r="1.5" fill="#fff" opacity=".7"/>`;
    return `<svg viewBox="0 0 120 24" width="108" height="22" aria-hidden="true"><path d="M2,11 Q60,17 118,11" stroke="#fff" stroke-width="1.6" fill="none" opacity=".9"/>${b}</svg>`;
  },
  // ---- antimicrobial: bacteria and viruses (stylised, friendly) ----
  bacillus: `<svg viewBox="0 0 64 28" aria-hidden="true">
    <path d="M54,12 Q60,6 63,10 M54,16 Q59,22 63,19" stroke="#b6f5d2" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <rect x="3" y="4" width="52" height="20" rx="10" fill="#4fd08f" stroke="#c8ffe3" stroke-width="1.6"/>
    <ellipse cx="18" cy="11" rx="6" ry="2.3" fill="#fff" opacity=".35"/>
    <circle cx="30" cy="16" r="2.2" fill="#238a5b" opacity=".6"/><circle cx="41" cy="12" r="1.7" fill="#238a5b" opacity=".6"/><circle cx="24" cy="17" r="1.4" fill="#238a5b" opacity=".6"/>
  </svg>`,
  cocci: `<svg viewBox="0 0 54 50" aria-hidden="true">
    <g fill="#ffd45c" stroke="#fff0b0" stroke-width="1.5">
      <circle cx="18" cy="14" r="9.5"/><circle cx="36" cy="14" r="9.5"/><circle cx="27" cy="30" r="9.5"/>
      <circle cx="11" cy="32" r="8.5"/><circle cx="43" cy="32" r="8.5"/><circle cx="27" cy="44" r="5.5"/>
    </g>
    <g fill="#fff" opacity=".45"><circle cx="15" cy="11" r="2.6"/><circle cx="33" cy="11" r="2.6"/><circle cx="24" cy="27" r="2.6"/></g>
  </svg>`,
  spirillum: `<svg viewBox="0 0 72 30" aria-hidden="true">
    <path d="M4,15 Q12,1 20,15 T36,15 T52,15 T68,15" stroke="#b27cf5" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M4,15 Q12,1 20,15 T36,15 T52,15 T68,15" stroke="#e6d3ff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>
  </svg>`,
  virus: (() => {
    let sp = "";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      sp += `<line x1="${(25 + 14 * c).toFixed(1)}" y1="${(25 + 14 * s).toFixed(1)}" x2="${(25 + 20.5 * c).toFixed(1)}" y2="${(25 + 20.5 * s).toFixed(1)}" stroke="#ff9db1" stroke-width="2"/><circle cx="${(25 + 22 * c).toFixed(1)}" cy="${(25 + 22 * s).toFixed(1)}" r="2.7" fill="#ff7d96"/>`;
    }
    return `<svg viewBox="0 0 50 50" aria-hidden="true">${sp}<circle cx="25" cy="25" r="14.5" fill="#ff6b8a" stroke="#ffd0da" stroke-width="1.5"/><circle cx="20" cy="21" r="3.2" fill="#fff" opacity=".4"/><circle cx="29" cy="29" r="2" fill="#c43d5e" opacity=".6"/><circle cx="30" cy="20" r="1.6" fill="#c43d5e" opacity=".6"/></svg>`;
  })(),
  phage: `<svg viewBox="0 0 44 64" aria-hidden="true">
    <polygon points="22,2 34,9 34,23 22,30 10,23 10,9" fill="#ffb454" stroke="#ffe3b3" stroke-width="1.5"/>
    <polygon points="22,2 34,9 22,16 10,9" fill="#fff" opacity=".3"/>
    <rect x="17" y="30" width="10" height="3.5" rx="1.5" fill="#e28f26"/>
    <rect x="19.5" y="33" width="5" height="16" fill="#ffcf8a" stroke="#e28f26" stroke-width=".8"/>
    <g stroke="#ffcf8a" stroke-width="2" stroke-linecap="round" fill="none"><path d="M22,49 L7,61"/><path d="M22,49 L22,62"/><path d="M22,49 L37,61"/></g>
  </svg>`,
  capsule: `<svg viewBox="0 0 46 20" width="40" height="17" aria-hidden="true">
    <rect x="1" y="1" width="44" height="18" rx="9" fill="#fff" stroke="#d8f5ff" stroke-width="1"/>
    <path d="M23,1 H36 A9,9 0 0 1 36,19 H23 Z" fill="#a3e635"/>
    <ellipse cx="12" cy="6" rx="6" ry="1.8" fill="#bfeaff" opacity=".7"/>
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

// Pages people see before signing in never use a theme.
const PRE_LOGIN_PAGE = /\/(login|join|index)(\.html)?$|\/$/.test(window.location.pathname);
if (PRE_LOGIN_PAGE) {
  document.documentElement.removeAttribute("data-theme");
  try { localStorage.removeItem("lm_theme"); } catch (e) {}
}

/* =====================================================================
   Scene themes (Barbie-style, Fairytale, Autumn, Winter, Spring, Summer,
   Seaside, South Downs hills). Every picture is generic artwork drawn
   here as inline SVG — no characters, logos or brand imagery. Each theme
   supplies layer() (the faint full-page animation) and banner() (the
   strip under the top bar), both returning HTML strings.
   ===================================================================== */
const SCN = {
  heart: (c) => `<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12,21 C3,14 0,9 0,6 A6,6 0 0 1 12,4 A6,6 0 0 1 24,6 C24,9 21,14 12,21Z" fill="${c}"/></svg>`,
  sparkle: (c) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,0 C13,8 16,11 24,12 C16,13 13,16 12,24 C11,16 8,13 0,12 C8,11 11,8 12,0Z" fill="${c}"/></svg>`,
  shades: `<svg viewBox="0 0 54 22" aria-hidden="true"><path d="M1,5 H53" stroke="#d81b7a" stroke-width="2.6" stroke-linecap="round"/><path d="M4,6 H25 L23,16 Q21,21 14,21 Q7,21 5.5,15Z" fill="#ff2d95" stroke="#fff" stroke-width="1.3"/><path d="M29,6 H50 L48.5,15 Q47,21 40,21 Q33,21 31,16Z" fill="#ff2d95" stroke="#fff" stroke-width="1.3"/><path d="M8,9 L13,8" stroke="#fff" stroke-width="1.5" opacity=".7" stroke-linecap="round"/><path d="M33,9 L38,8" stroke="#fff" stroke-width="1.5" opacity=".7" stroke-linecap="round"/></svg>`,
  convertible: `<svg viewBox="0 0 96 42" aria-hidden="true"><path d="M3,28 Q3,19 14,18 L36,17 L45,9 L54,10 L57,17 L84,18 Q94,19 94,28 L94,33 H3Z" fill="#ff5fb1" stroke="#fff" stroke-width="1.4"/><path d="M45,9 L54,10 L57,17 L38,17Z" fill="#c9ecff" stroke="#fff" stroke-width="1"/><path d="M8,26 H90" stroke="#fff" stroke-width="1.4" opacity=".6"/><circle cx="24" cy="33" r="8" fill="#3b3b4a"/><circle cx="24" cy="33" r="3.2" fill="#e8e8f0"/><circle cx="72" cy="33" r="8" fill="#3b3b4a"/><circle cx="72" cy="33" r="3.2" fill="#e8e8f0"/></svg>`,
  castle: `<svg viewBox="0 0 130 74" aria-hidden="true">
    <g fill="#2a3790" stroke="#4d5fc8" stroke-width="1"><rect x="22" y="40" width="86" height="34"/><rect x="8" y="32" width="16" height="42"/><rect x="106" y="32" width="16" height="42"/><rect x="52" y="14" width="26" height="60"/><rect x="34" y="30" width="12" height="44"/><rect x="84" y="30" width="12" height="44"/></g>
    <g fill="#f6c945"><polygon points="8,32 16,12 24,32"/><polygon points="106,32 114,12 122,32"/><polygon points="52,14 65,-4 78,14"/></g>
    <g fill="#9a7cf5"><polygon points="34,30 40,16 46,30"/><polygon points="84,30 90,16 96,30"/></g>
    <g stroke="#f6c945" stroke-width="1.2"><line x1="16" y1="12" x2="16" y2="4"/><line x1="114" y1="12" x2="114" y2="4"/><line x1="65" y1="-4" x2="65" y2="-12"/></g>
    <g fill="#f6c945"><polygon points="16,4 24,6 16,8"/><polygon points="114,4 122,6 114,8"/><polygon points="65,-12 74,-9 65,-6"/></g>
    <g fill="#ffe27a"><rect x="60" y="24" width="10" height="14" rx="5"/><rect x="12" y="44" width="6" height="9" rx="3"/><rect x="112" y="44" width="6" height="9" rx="3"/><rect x="37" y="42" width="6" height="9" rx="3"/><rect x="87" y="42" width="6" height="9" rx="3"/><rect x="58" y="52" width="14" height="22" rx="7"/></g>
  </svg>`,
  burst: (c) => { let l = ""; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = Math.cos(a), y = Math.sin(a); l += `<line x1="${(30 + 8 * x).toFixed(1)}" y1="${(30 + 8 * y).toFixed(1)}" x2="${(30 + 22 * x).toFixed(1)}" y2="${(30 + 22 * y).toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="${(30 + 27 * x).toFixed(1)}" cy="${(30 + 27 * y).toFixed(1)}" r="2" fill="#fff"/>`; } return `<svg viewBox="0 0 60 60" aria-hidden="true">${l}</svg>`; },
  leaf: (c) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,2 C20,6 22,15 12,22 C2,15 4,6 12,2Z" fill="${c}"/><path d="M12,5 V21" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>`,
  autumnTree: (c) => `<svg viewBox="0 0 44 58" aria-hidden="true"><rect x="19" y="30" width="6" height="28" fill="#6b4423"/><path d="M22,40 L12,30 M22,36 L33,27" stroke="#6b4423" stroke-width="3" fill="none"/><circle cx="22" cy="20" r="14" fill="${c}"/><circle cx="11" cy="28" r="9" fill="${c}"/><circle cx="33" cy="28" r="9" fill="${c}"/><circle cx="17" cy="15" r="4" fill="#fff" opacity=".18"/></svg>`,
  pine: `<svg viewBox="0 0 40 58" aria-hidden="true"><rect x="18" y="50" width="5" height="8" fill="#6b4423"/><polygon points="20,2 34,26 6,26" fill="#2f7d52"/><polygon points="20,14 38,40 2,40" fill="#2f7d52"/><polygon points="20,26 40,52 0,52" fill="#2f7d52"/><polygon points="20,2 26,13 14,13" fill="#fff"/><polygon points="20,14 29,27 11,27" fill="#fff"/><polygon points="20,27 31,43 9,43" fill="#fff"/></svg>`,
  snowman: `<svg viewBox="0 0 40 56" aria-hidden="true"><circle cx="20" cy="44" r="11" fill="#fff" stroke="#c6dcef"/><circle cx="20" cy="26" r="8.5" fill="#fff" stroke="#c6dcef"/><circle cx="20" cy="12" r="6.5" fill="#fff" stroke="#c6dcef"/><rect x="13" y="3" width="14" height="3" fill="#333"/><rect x="15.5" y="-3" width="9" height="7" fill="#333"/><polygon points="20,12 29,14 20,15" fill="#ff8a1f"/><circle cx="17.5" cy="10" r="1" fill="#222"/><circle cx="22.5" cy="10" r="1" fill="#222"/><circle cx="20" cy="26" r="1.2" fill="#555"/><circle cx="20" cy="31" r="1.2" fill="#555"/><path d="M13,19 Q20,24 27,19" stroke="#3b82c4" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M11,30 L2,24 M29,30 L38,24" stroke="#6b4423" stroke-width="2" stroke-linecap="round"/></svg>`,
  tulip: (c) => `<svg viewBox="0 0 20 42" aria-hidden="true"><path d="M10,40 V16" stroke="#3f9a4d" stroke-width="2.4" fill="none"/><path d="M10,36 Q2,32 3,22 Q9,26 10,34 M10,32 Q18,29 17,20 Q11,24 10,31" fill="#4fb860"/><path d="M3,10 Q3,18 10,19 Q17,18 17,10 L14,13 L10,6 L6,13Z" fill="${c}"/></svg>`,
  butterfly: (a, b) => `<svg viewBox="0 0 32 26" aria-hidden="true"><g class="wings"><ellipse cx="9" cy="8" rx="8" ry="7" fill="${a}"/><ellipse cx="23" cy="8" rx="8" ry="7" fill="${a}"/><ellipse cx="10" cy="18" rx="6" ry="5.5" fill="${b}"/><ellipse cx="22" cy="18" rx="6" ry="5.5" fill="${b}"/></g><rect x="15" y="4" width="2" height="18" rx="1" fill="#4a3a55"/><path d="M15.5,4 Q13,0 11,1 M16.5,4 Q19,0 21,1" stroke="#4a3a55" stroke-width=".9" fill="none"/></svg>`,
  bee: `<svg viewBox="0 0 34 24" aria-hidden="true"><g class="wings"><ellipse cx="13" cy="6" rx="7" ry="5" fill="#fff" opacity=".8"/><ellipse cx="21" cy="6" rx="7" ry="5" fill="#fff" opacity=".8"/></g><ellipse cx="17" cy="15" rx="11" ry="7" fill="#ffd23f"/><path d="M12,9 V21 M18,8.5 V21.5 M24,9.5 V20.5" stroke="#3a2e1a" stroke-width="2.4"/><circle cx="29" cy="14" r="3.2" fill="#3a2e1a"/></svg>`,
  petal: (c) => `<svg viewBox="0 0 14 18" aria-hidden="true"><path d="M7,1 C13,5 13,13 7,17 C1,13 1,5 7,1Z" fill="${c}"/></svg>`,
  sun: `<svg viewBox="0 0 84 84" aria-hidden="true"><g class="spin-sun" stroke="#ffc400" stroke-width="4" stroke-linecap="round">${(() => { let r = ""; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; r += `<line x1="${(42 + 26 * Math.cos(a)).toFixed(1)}" y1="${(42 + 26 * Math.sin(a)).toFixed(1)}" x2="${(42 + 38 * Math.cos(a)).toFixed(1)}" y2="${(42 + 38 * Math.sin(a)).toFixed(1)}"/>`; } return r; })()}</g><circle cx="42" cy="42" r="21" fill="#ffd93d" stroke="#fff3a8" stroke-width="2"/></svg>`,
  cloud: `<svg viewBox="0 0 90 38" aria-hidden="true"><g fill="#fff"><circle cx="24" cy="24" r="12"/><circle cx="40" cy="17" r="15"/><circle cx="58" cy="22" r="13"/><circle cx="72" cy="26" r="9"/><rect x="14" y="24" width="64" height="11" rx="5"/></g></svg>`,
  sunflower: `<svg viewBox="0 0 38 58" aria-hidden="true"><path d="M19,56 V26" stroke="#3f9a4d" stroke-width="3"/><path d="M19,46 Q7,44 6,34 Q16,36 19,44 M19,42 Q31,40 32,30 Q22,32 19,40" fill="#4fb860"/><g fill="#ffcf1f">${(() => { let r = ""; for (let i = 0; i < 12; i++) r += `<ellipse cx="19" cy="9" rx="3.6" ry="7" transform="rotate(${i * 30} 19 19)"/>`; return r; })()}</g><circle cx="19" cy="19" r="6.5" fill="#6b3e1b"/></svg>`,
  beachball: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#fff" stroke="#e8eef5"/><path d="M16,16 L16,1 A15,15 0 0 1 29,8.5Z" fill="#ff5a5f"/><path d="M16,16 L29,23.5 A15,15 0 0 1 16,31Z" fill="#ffd23f"/><path d="M16,16 L3,23.5 A15,15 0 0 1 3,8.5Z" fill="#3b9de0"/><circle cx="16" cy="16" r="3" fill="#fff"/></svg>`,
  gull: `<svg viewBox="0 0 44 22" aria-hidden="true"><g class="wings"><path d="M2,15 Q11,1 22,13 Q33,1 42,15 Q33,9 22,17 Q11,9 2,15Z" fill="#fff" stroke="#7b8ba0" stroke-width=".9" stroke-linejoin="round"/></g></svg>`,
  sailboat: `<svg viewBox="0 0 52 52" aria-hidden="true"><path d="M26,4 V38" stroke="#6b4423" stroke-width="2"/><path d="M27,6 Q44,22 46,36 H27Z" fill="#fff" stroke="#cfdcea"/><path d="M25,12 Q12,24 8,36 H25Z" fill="#ffd7a8" stroke="#e9c28f"/><path d="M4,38 H48 L42,47 Q26,50 10,47Z" fill="#c0392b"/></svg>`,
  lighthouse: `<svg viewBox="0 0 34 66" aria-hidden="true"><polygon points="11,22 23,22 26,62 8,62" fill="#fff" stroke="#cfdcea"/><polygon points="10.2,34 23.8,34 24.6,44 9.4,44" fill="#d64545"/><polygon points="9,50 25,50 25.8,58 8.2,58" fill="#d64545"/><rect x="9" y="14" width="16" height="8" fill="#ffe27a"/><rect x="7" y="21" width="20" height="3" fill="#555"/><polygon points="9,14 17,4 25,14" fill="#d64545"/><rect x="6" y="62" width="22" height="4" fill="#8b9aae"/></svg>`,
  sheep: `<svg viewBox="0 0 42 28" aria-hidden="true"><g stroke="#4a4a52" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="27"/><line x1="18" y1="21" x2="18" y2="27"/><line x1="27" y1="21" x2="27" y2="27"/><line x1="32" y1="20" x2="32" y2="27"/></g><g fill="#fff" stroke="#e4e4ea"><circle cx="13" cy="14" r="7"/><circle cx="21" cy="11" r="8"/><circle cx="29" cy="14" r="7"/><circle cx="20" cy="18" r="7"/></g><g class="head"><ellipse cx="36.5" cy="14" rx="4.5" ry="3.8" fill="#4a4a52"/><ellipse cx="34" cy="10.5" rx="2" ry="1.2" fill="#4a4a52" transform="rotate(-30 34 10.5)"/></g></svg>`,
  windmill: `<svg viewBox="0 0 64 74" aria-hidden="true"><polygon points="22,30 42,30 46,70 18,70" fill="#fff" stroke="#c9d3de"/><polygon points="20,30 32,18 44,30" fill="#5b4636"/><rect x="28" y="52" width="8" height="18" rx="4" fill="#6b4423"/><rect x="26" y="38" width="5" height="6" fill="#8aa5bd"/><rect x="33" y="38" width="5" height="6" fill="#8aa5bd"/><g class="sails" style="transform-origin:32px 24px"><g stroke="#5b4636" stroke-width="2"><line x1="32" y1="24" x2="32" y2="-2"/><line x1="32" y1="24" x2="32" y2="50"/><line x1="32" y1="24" x2="6" y2="24"/><line x1="32" y1="24" x2="58" y2="24"/></g><g fill="#fff" opacity=".85" stroke="#c9d3de" stroke-width=".6"><rect x="33" y="0" width="7" height="14"/><rect x="24" y="34" width="7" height="14"/><rect x="8" y="17" width="14" height="7"/><rect x="42" y="25" width="14" height="7"/></g><circle cx="32" cy="24" r="2.6" fill="#5b4636"/></g></svg>`,
  kite: `<svg viewBox="0 0 56 24" aria-hidden="true"><g class="wings"><path d="M2,13 Q16,3 28,10 Q40,3 54,13 Q42,10 28,16 Q14,10 2,13Z" fill="#a0522d" stroke="#6b3a1f" stroke-width=".8"/></g><path d="M25,15 L22,23 L28,19 L34,23 L31,15Z" fill="#c0642f"/></svg>`,
};
function scnWaves(color, opacity, cls, amp, yBase) {
  let d = "M0,40 "; const W = 2400, step = 40;
  for (let x = 0; x <= W; x += step) d += `L${x},${(yBase + amp * Math.sin(x / 200 * Math.PI)).toFixed(1)} `;
  d += `L${W},40 Z`;
  return `<svg class="scn-wave ${cls}" viewBox="0 0 2400 40" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="${color}" opacity="${opacity}"/></svg>`;
}
function scnRidge(color, base, amp, phase, k) {
  let d = "M0,60 "; for (let x = 0; x <= 1200; x += 20) d += `L${x},${(base + amp * Math.sin(x / 1200 * Math.PI * 2 * k + phase) + amp * .45 * Math.sin(x / 1200 * Math.PI * 2 * k * 2.3 + phase * 1.7)).toFixed(1)} `;
  return `<path d="${d}L1200,60Z" fill="${color}"/>`;
}
const SBX = (cls, html, style) => `<span class="bx ${cls}" style="${style || ""}">${html}</span>`;
const pick = (a, i) => a[i % a.length];

const THEME_SCENES = {
  barbie: {
    layer() {
      const cols = ["#fff", "#ffd1ea", "#ff9ac9", "#ffe3f3"]; let h = "";
      for (let i = 0; i < 22; i++) h += `<i class="sp" style="left:${fxRand(1, 97).toFixed(1)}%;top:${fxRand(3, 95).toFixed(1)}%;font-size:${fxRand(10, 22).toFixed(0)}px;color:${pick(cols, i)};animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#10022;</i>`;
      for (let i = 0; i < 14; i++) h += `<i class="rise" style="--dx:${fxRand(-80, 80).toFixed(0)}px;left:${fxRand(2, 96).toFixed(1)}%;font-size:${fxRand(14, 28).toFixed(0)}px;color:${pick(["#ff6fb5", "#ff9ac9", "#ff4fa3"], i)};animation-duration:${fxRand(28, 55).toFixed(0)}s;animation-delay:${(-fxRand(0, 55)).toFixed(0)}s">${i % 3 ? "&#9829;" : "&#9825;"}</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#e5177f"></span>`;
      b += SBX("bbob", SCN.shades, "left:10%;top:8px;--w:44") + SBX("bbob", SCN.shades, "left:62%;top:12px;--w:34;animation-delay:-1.5s");
      b += SBX("bcross", SCN.convertible, "left:0;bottom:5px;--w:70;--still:34%;animation-duration:16s");
      for (let i = 0; i < 9; i++) b += SBX("brise", SCN.heart(pick(["#fff", "#ffd1ea", "#ffe3f3"], i)), `left:${fxRand(3, 95).toFixed(0)}%;--w:${fxRand(10, 20).toFixed(0)};animation-duration:${fxRand(4, 8).toFixed(1)}s;animation-delay:${(-fxRand(0, 8)).toFixed(1)}s`);
      for (let i = 0; i < 16; i++) b += `<i class="bsp" style="left:${fxRand(2, 97).toFixed(0)}%;top:${fxRand(4, 70).toFixed(0)}%;font-size:${fxRand(9, 17).toFixed(0)}px;color:#fff;animation-duration:${fxRand(1.8, 4).toFixed(1)}s;animation-delay:${(-fxRand(0, 4)).toFixed(1)}s">&#10022;</i>`;
      return b;
    },
  },
  fairytale: {
    layer() {
      let h = ""; const cols = ["#fff", "#ffe9a8", "#cfd8ff", "#f6c945"];
      for (let i = 0; i < 40; i++) h += `<i class="sp" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(2, 96).toFixed(1)}%;font-size:${fxRand(8, 20).toFixed(0)}px;color:${pick(cols, i)};animation-duration:${fxRand(2.2, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">${i % 5 === 4 ? "&#10023;" : "&#10022;"}</i>`;
      for (let i = 0; i < 2; i++) h += `<i class="shoot" style="top:${(8 + i * 22)}%;left:${(10 + i * 30)}%;animation-delay:${(-i * 6)}s"></i>`;
      return h;
    },
    banner() {
      let b = "";
      for (let i = 0; i < 26; i++) b += `<i class="bsp" style="left:${fxRand(1, 98).toFixed(0)}%;top:${fxRand(2, 60).toFixed(0)}%;font-size:${fxRand(7, 14).toFixed(0)}px;color:${pick(["#fff", "#ffe9a8", "#cfd8ff"], i)};animation-duration:${fxRand(1.8, 4.5).toFixed(1)}s;animation-delay:${(-fxRand(0, 4)).toFixed(1)}s">&#10022;</i>`;
      b += SBX("", SCN.castle, "left:50%;margin-left:-60px;bottom:0;--w:120");
      [["#ffd34d", 14], ["#ff7eb6", 76], ["#7fc3f0", 90], ["#b79cff", 30]].forEach(([c, l], i) => { b += SBX("bfw", SCN.burst(c), `left:${l}%;top:${(i % 2) * 4 - 2}px;--w:50;animation-duration:${(3.2 + i * .7).toFixed(1)}s;animation-delay:${(-i * 1.1).toFixed(1)}s`); });
      return b;
    },
  },
  autumn: {
    layer() {
      const cols = ["#d9531e", "#e6962b", "#c0392b", "#b8860b", "#a0522d", "#e8b923"]; let h = "";
      for (let i = 0; i < 18; i++) h += `<i class="fall" style="left:${fxRand(0, 98).toFixed(1)}%;width:${fxRand(14, 26).toFixed(0)}px;animation-duration:${fxRand(11, 20).toFixed(1)}s,${fxRand(3, 5).toFixed(1)}s;animation-delay:${(-fxRand(0, 20)).toFixed(1)}s,${(-fxRand(0, 5)).toFixed(1)}s;--sway:${fxRand(20, 70).toFixed(0)}px;opacity:.8">${SCN.leaf(pick(cols, i))}</i>`;
      return h;
    },
    banner() {
      const cols = ["#d9531e", "#e6962b", "#c0392b", "#e8b923", "#b8860b"]; let b = `<span class="bgrd" style="background:#7a4b22;height:8px"></span>`;
      for (let i = 0; i < 7; i++) b += SBX("bsway", SCN.autumnTree(pick(cols, i)), `left:${(3 + i * 14.5).toFixed(0)}%;bottom:5px;--w:${(40 + (i % 3) * 8)};animation-delay:${(-i * .7).toFixed(1)}s`);
      for (let i = 0; i < 12; i++) b += SBX("bfall", SCN.leaf(pick(cols, i)), `left:${fxRand(2, 96).toFixed(0)}%;--w:${fxRand(10, 17).toFixed(0)};--dx:${fxRand(-40, 60).toFixed(0)}px;animation-duration:${fxRand(5, 10).toFixed(1)}s;animation-delay:${(-fxRand(0, 10)).toFixed(1)}s`);
      return b;
    },
  },
  winter: {
    layer() {
      let h = "";
      for (let i = 0; i < 40; i++) h += `<i class="fall snowW" style="left:${fxRand(0, 99).toFixed(1)}%;font-size:${fxRand(9, 20).toFixed(0)}px;animation-duration:${fxRand(9, 18).toFixed(1)}s,${fxRand(3, 5).toFixed(1)}s;animation-delay:${(-fxRand(0, 18)).toFixed(1)}s,${(-fxRand(0, 5)).toFixed(1)}s;--sway:${fxRand(14, 46).toFixed(0)}px">${i % 3 ? "&#10052;" : "&#10053;"}</i>`;
      return h;
    },
    banner() {
      let ic = "M0,0 "; for (let x = 0; x < 1200; x += 24) { const hgt = 6 + ((x / 24) * 7 % 11); ic += `L${x},0 L${x + 12},${hgt} L${x + 24},0 `; }
      let b = `<svg class="scn" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="${ic}Z" fill="#fff" opacity=".9"/><path d="M0,60 L0,52 Q300,44 600,52 T1200,52 L1200,60Z" fill="#fff"/></svg>`;
      for (let i = 0; i < 6; i++) b += SBX("", SCN.pine, `left:${(4 + i * 15).toFixed(0)}%;bottom:2px;--w:${(26 + (i % 2) * 8)}`);
      b += SBX("bsway", SCN.snowman, "left:80%;bottom:2px;--w:34;animation-duration:5s");
      for (let i = 0; i < 16; i++) b += `<i class="bsnow" style="left:${fxRand(1, 98).toFixed(0)}%;font-size:${fxRand(7, 13).toFixed(0)}px;--dx:${fxRand(-30, 30).toFixed(0)}px;animation-duration:${fxRand(4, 8).toFixed(1)}s;animation-delay:${(-fxRand(0, 8)).toFixed(1)}s">&#10052;</i>`;
      return b;
    },
  },
  spring: {
    layer() {
      const cols = ["#ffc2d9", "#ff9ec2", "#fff", "#ffd9e8"]; let h = "";
      for (let i = 0; i < 16; i++) h += `<i class="fall" style="left:${fxRand(0, 98).toFixed(1)}%;width:${fxRand(9, 15).toFixed(0)}px;animation-duration:${fxRand(12, 22).toFixed(1)}s,${fxRand(3, 5).toFixed(1)}s;animation-delay:${(-fxRand(0, 22)).toFixed(1)}s,${(-fxRand(0, 5)).toFixed(1)}s;--sway:${fxRand(20, 60).toFixed(0)}px;opacity:.85">${SCN.petal(pick(cols, i))}</i>`;
      return h;
    },
    banner() {
      let b = `<svg class="scn" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">${scnRidge("#b8e08a", 44, 5, 0.6, 2)}${scnRidge("#7fc56a", 52, 4, 2.1, 3)}</svg>`;
      const tc = ["#ff5f9e", "#ffd23f", "#fff", "#c58bff", "#ff8a65"];
      for (let i = 0; i < 9; i++) b += SBX("bsway", SCN.tulip(pick(tc, i)), `left:${(3 + i * 10.6).toFixed(0)}%;bottom:2px;--w:${(14 + (i % 3) * 3)};animation-delay:${(-i * .5).toFixed(1)}s`);
      for (let i = 0; i < 8; i++) b += SBX("bfall", SCN.petal(pick(["#ffc2d9", "#fff", "#ff9ec2"], i)), `left:${fxRand(2, 96).toFixed(0)}%;--w:${fxRand(7, 11).toFixed(0)};--dx:${fxRand(-30, 40).toFixed(0)}px;animation-duration:${fxRand(5, 9).toFixed(1)}s;animation-delay:${(-fxRand(0, 9)).toFixed(1)}s`);
      return b;
    },
  },
  summer: {
    layer() {
      let h = "";
      for (let i = 0; i < 16; i++) h += `<i class="sp" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(3, 96).toFixed(1)}%;font-size:${fxRand(9, 20).toFixed(0)}px;color:${pick(["#ffd23f", "#fff3a8", "#ffae4d"], i)};animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#10022;</i>`;
      return h;
    },
    banner() {
      let b = SBX("bsun", SCN.sun, "left:6%;top:-6px;--w:66");
      for (let i = 0; i < 2; i++) b += SBX("bcross", SCN.cloud, `left:0;top:${6 + i * 14}px;--w:${70 - i * 16};--still:${28 + i * 36}%;opacity:.95;animation-duration:${(46 + i * 18)}s;animation-delay:${(-i * 22)}s`);
      for (let i = 0; i < 7; i++) b += SBX("bsway", SCN.sunflower, `left:${(24 + i * 11).toFixed(0)}%;bottom:0;--w:${(24 + (i % 3) * 5)};animation-delay:${(-i * .6).toFixed(1)}s`);
      b += SBX("bbounce", SCN.beachball, "left:14%;bottom:2px;--w:24");
      b += `<span class="bgrd" style="background:#f2d27a;height:5px"></span>`;
      return b;
    },
  },
  seaside: {
    layer() {
      let h = "";
      for (let i = 0; i < 14; i++) h += `<i class="rise" style="--dx:${fxRand(-40, 40).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(8, 20).toFixed(0)}px;opacity:.5;animation-duration:${fxRand(22, 45).toFixed(0)}s;animation-delay:${(-fxRand(0, 45)).toFixed(0)}s"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="rgba(255,255,255,.35)" stroke="#7fc8e6"/><circle cx="4" cy="4" r="1.2" fill="#fff"/></svg></i>`;
      return h;
    },
    banner() {
      let b = SBX("", SCN.lighthouse, "left:6%;bottom:6px;--w:26") + `<span class="beam" style="left:calc(6% + 13px);bottom:46px"></span>`;
      b += SBX("bbob", SCN.sailboat, "left:58%;bottom:7px;--w:40;animation-duration:5s");
      b += scnWaves("#2f9fd1", .75, "wvA", 4, 18) + scnWaves("#1a7fb8", .9, "wvB", 3, 28);
      return b;
    },
  },
  hills: {
    layer() {
      let h = "";
      for (let i = 0; i < 4; i++) h += `<span class="xing" style="top:${(6 + i * 18)}%;animation-duration:${(70 + i * 25)}s;animation-delay:${(-i * 30)}s;--w:${130 + i * 30};opacity:.5"><span class="bob">${SCN.cloud}</span></span>`;
      for (let i = 0; i < 10; i++) h += `<i class="rise" style="--dx:${fxRand(-70, 70).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;font-size:${fxRand(12, 22).toFixed(0)}px;color:#fff;opacity:.6;animation-duration:${fxRand(35, 70).toFixed(0)}s;animation-delay:${(-fxRand(0, 70)).toFixed(0)}s;text-shadow:0 0 6px rgba(120,160,100,.7)">&#10023;</i>`;
      return h;
    },
    banner() {
      let b = `<svg class="scn" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">${scnRidge("#a9d68a", 36, 6, 0.3, 1.5)}${scnRidge("#82bb5e", 44, 6, 2.2, 2)}${scnRidge("#5d9a43", 52, 4, 4.1, 2.6)}</svg>`;
      for (let i = 0; i < 3; i++) b += SBX("bcross", SCN.cloud, `left:0;top:${3 + i * 9}px;--w:${58 - i * 8};--still:${(15 + i * 33)}%;animation-duration:${(60 + i * 22)}s;animation-delay:${(-i * 25)}s`);
      b += SBX("", SCN.windmill, "left:22%;bottom:10px;--w:46");
      [[40, 9], [48, 5], [62, 8], [70, 4], [86, 7], [8, 4]].forEach(([l, bt], i) => { b += SBX("bgraze", SCN.sheep, `left:${l}%;bottom:${bt}px;--w:${26 + (i % 2) * 5};animation-delay:${(-i * 1.1).toFixed(1)}s`); });
      return b;
    },
  },
};

/* =====================================================================
   National-day themes: St David's Day (Wales), St George's Day (England),
   St Patrick's Day (Ireland), St Andrew's Day (Scotland). Generic drawn
   emblems only — daffodils, leeks, a stylised dragon, roses, shamrocks,
   thistles, simple cross/saltire bunting.
   ===================================================================== */
Object.assign(SCN, {
  daffodil: `<svg viewBox="0 0 30 46" aria-hidden="true"><path d="M15,45 V20" stroke="#3f9a4d" stroke-width="2.4" fill="none"/><path d="M15,41 Q5,37 4,26 Q13,30 15,39" fill="#4fb860"/><g fill="#ffe46b" stroke="#f2c230" stroke-width=".6">${(() => { let r = ""; for (let i = 0; i < 6; i++) r += `<ellipse cx="15" cy="6.5" rx="4.2" ry="7.5" transform="rotate(${i * 60} 15 14)"/>`; return r; })()}</g><ellipse cx="15" cy="14" rx="5.2" ry="4.6" fill="#ffb300"/><path d="M10.5,12.5 L12,9.5 L13.5,12 L15,9 L16.5,12 L18,9.5 L19.5,12.5Z" fill="#ff9f00"/></svg>`,
  leek: `<svg viewBox="0 0 18 48" aria-hidden="true"><path d="M7,46 L5.5,24 H12.5 L11,46Z" fill="#f4f7ee" stroke="#cfd8c0" stroke-width=".8"/><path d="M5.5,26 Q-1,12 4,2 Q8,12 9,24Z" fill="#3f9a4d"/><path d="M12.5,26 Q19,12 14,2 Q10,12 9,24Z" fill="#52b265"/><path d="M9,26 Q8,10 9,1 Q10,10 9,26Z" fill="#2f7d3f"/><path d="M6.5,46 q-3,2 -4,1 M11.5,46 q3,2 4,1" stroke="#cfd8c0" stroke-width=".9" fill="none"/></svg>`,
  dragon: `<svg viewBox="0 0 96 56" aria-hidden="true"><g fill="#d4202c" stroke="#8a1018" stroke-width="1.2" stroke-linejoin="round">
    <path d="M6,48 Q24,56 36,42 Q46,32 58,36 Q66,38 70,30 Q72,22 68,14 L76,8 L88,10 L92,16 L84,18 Q80,20 82,26 Q82,34 74,42 Q66,52 52,50 Q40,50 32,52 Q18,56 6,48Z"/>
    <path d="M46,36 Q40,12 60,4 Q54,16 62,24 Q64,14 72,12 Q66,22 68,32Z"/>
    <path d="M30,50 L26,56 M36,52 L34,56 M54,50 L52,56 M62,48 L62,56" stroke-linecap="round" fill="none"/>
    <path d="M76,8 L78,2 L82,8 M84,10 L88,5 L88,11" fill="#8a1018"/></g>
    <circle cx="84" cy="13" r="1.6" fill="#fff"/><path d="M90,15 q4,0 5,-2" stroke="#ffd23f" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  rose: `<svg viewBox="0 0 28 38" aria-hidden="true"><path d="M14,37 V20" stroke="#2f7d3f" stroke-width="2.2" fill="none"/><path d="M14,32 Q5,30 4,22 Q12,23 14,30 M14,29 Q23,27 24,19 Q16,20 14,27" fill="#3f9a4d"/><circle cx="14" cy="12" r="10" fill="#c8102e"/><circle cx="14" cy="12" r="7" fill="#e0233f"/><path d="M14,12 m0,0 q4,-5 0,-6 q-5,0 -5,5 q0,5 6,5 q6,-1 5,-7" stroke="#8c0a1f" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="14" cy="12" r="10" fill="none" stroke="#fff" stroke-width=".8" opacity=".5"/></svg>`,
  shamrock: (c) => `<svg viewBox="-16 -16 32 44" aria-hidden="true"><g fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width=".6">${[0, 120, 240].map(a => `<path transform="rotate(${a})" d="M0,0 C-6,-3 -10,-10 -5,-14 C-2,-16 0,-13 0,-11 C0,-13 2,-16 5,-14 C10,-10 6,-3 0,0Z"/>`).join("")}</g><path d="M0,0 Q2,12 -2,22" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  coin: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#ffd23f" stroke="#c99a10" stroke-width="1.2"/><circle cx="10" cy="10" r="6" fill="none" stroke="#e8b923" stroke-width="1.2"/><path d="M7,6 Q10,4 13,6" stroke="#fff3a8" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  potgold: `<svg viewBox="0 0 46 38" aria-hidden="true"><g fill="#ffd23f" stroke="#c99a10" stroke-width=".8"><circle cx="14" cy="10" r="5"/><circle cx="23" cy="7" r="5.5"/><circle cx="32" cy="10" r="5"/><circle cx="19" cy="13" r="4.5"/><circle cx="28" cy="13" r="4.5"/></g><path d="M5,16 Q3,34 12,36 H34 Q43,34 41,16Z" fill="#2c2c34"/><rect x="3" y="14" width="40" height="5" rx="2.5" fill="#42424f"/><path d="M10,22 Q9,30 13,33" stroke="#fff" stroke-width="1.2" fill="none" opacity=".35" stroke-linecap="round"/></svg>`,
  thistle: `<svg viewBox="0 0 24 46" aria-hidden="true"><path d="M12,45 V24" stroke="#4a7a3a" stroke-width="2.4" fill="none"/><path d="M12,38 Q3,35 2,26 Q10,29 12,36 M12,34 Q21,31 22,22 Q14,25 12,32" fill="#5c9a48"/><path d="M5,22 Q4,28 12,30 Q20,28 19,22Z" fill="#5c9a48"/><path d="M6,22 L8,26 L10,22 L12,26 L14,22 L16,26 L18,22" stroke="#3f7a30" stroke-width="1" fill="none"/><g stroke="#a259c4" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="21" x2="12" y2="6"/><line x1="12" y1="21" x2="7" y2="8"/><line x1="12" y1="21" x2="17" y2="8"/><line x1="12" y1="21" x2="4" y2="12"/><line x1="12" y1="21" x2="20" y2="12"/></g><circle cx="12" cy="17" r="4" fill="#c27ee0"/></svg>`,
  fuzz: `<svg viewBox="0 0 20 20" aria-hidden="true"><g stroke="#fff" stroke-width="1" stroke-linecap="round"><line x1="10" y1="10" x2="10" y2="1"/><line x1="10" y1="10" x2="3" y2="4"/><line x1="10" y1="10" x2="17" y2="4"/><line x1="10" y1="10" x2="1" y2="10"/><line x1="10" y1="10" x2="19" y2="10"/><line x1="10" y1="10" x2="4" y2="16"/><line x1="10" y1="10" x2="16" y2="16"/></g><circle cx="10" cy="10" r="2" fill="#e8f0ff"/></svg>`,
  flagCross: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect x=".5" y=".5" width="29" height="19" fill="#fff" stroke="#c9d0d8"/><rect x="12.5" y="0" width="5" height="20" fill="#c8102e"/><rect x="0" y="7.5" width="30" height="5" fill="#c8102e"/></svg>`,
  flagSaltire: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#005EB8"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="4"/></svg>`,
  flagWales: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#00812c"/><path d="M8,14 Q10,6 15,8 Q18,4 22,7 Q20,10 22,13 Q16,17 8,14Z" fill="#d4202c" stroke="#8a1018" stroke-width=".5"/></svg>`,
  rainbow: `<svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">${["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"].map((c, i) => `<path d="M${6 + i * 5},60 A${54 - i * 5},${54 - i * 5} 0 0 1 ${114 - i * 5},60" fill="none" stroke="${c}" stroke-width="5" opacity=".85"/>`).join("")}</svg>`,
});
function scnBunting(cols) {
  let t = ""; const n = 30;
  for (let i = 0; i < n; i++) { const x = i * 40 + 6, y = 4 + 6 * Math.sin(i / n * Math.PI * 4); t += `<polygon points="${x},${y.toFixed(1)} ${x + 28},${(y + 1.5).toFixed(1)} ${x + 14},${(y + 22).toFixed(1)}" fill="${cols[i % cols.length]}" stroke="rgba(0,0,0,.18)" stroke-width=".6"/>`; }
  return `<svg class="scn" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0,3 ${Array.from({ length: n + 1 }, (_, i) => `L${i * 40},${(3 + 6 * Math.sin(i / n * Math.PI * 4)).toFixed(1)}`).join(" ")}" fill="none" stroke="rgba(60,60,60,.55)" stroke-width="1"/>${t}</svg>`;
}
const scnFall = (cls, svg, w, i, dur, sway) => `<i class="${cls}" style="left:${fxRand(0, 98).toFixed(1)}%;width:${w}px;animation-duration:${fxRand(dur[0], dur[1]).toFixed(1)}s,${fxRand(3, 5).toFixed(1)}s;animation-delay:${(-fxRand(0, dur[1])).toFixed(1)}s,${(-fxRand(0, 5)).toFixed(1)}s;--sway:${fxRand(sway[0], sway[1]).toFixed(0)}px;opacity:.85">${svg}</i>`;

Object.assign(THEME_SCENES, {
  stdavid: {
    layer() {
      let h = ""; const c = ["#ffd84d", "#ffe98a", "#fff", "#ffc400"];
      for (let i = 0; i < 20; i++) h += scnFall("fall", SCN.petal(pick(c, i)), fxRand(10, 18).toFixed(0), i, [12, 22], [20, 60]);
      for (let i = 0; i < 8; i++) h += `<i class="sp" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(3, 96).toFixed(1)}%;font-size:${fxRand(9, 16).toFixed(0)}px;color:#ffd84d;animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#10022;</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#2c7a3f;height:7px"></span>` + scnBunting(["#00812c", "#fff", "#d4202c"]);
      for (let i = 0; i < 11; i++) b += SBX("bsway", SCN.daffodil, `left:${(3 + i * 8.8).toFixed(0)}%;bottom:3px;--w:${(18 + (i % 3) * 3)};animation-delay:${(-i * .55).toFixed(1)}s`);
      for (let i = 0; i < 3; i++) b += SBX("bsway", SCN.leek, `left:${(30 + i * 24).toFixed(0)}%;bottom:3px;--w:13;animation-delay:${(-i * .8).toFixed(1)}s`);
      b += SBX("bbob", SCN.dragon, "left:12%;bottom:8px;--w:74;animation-duration:4.5s");
      b += SBX("bbob", SCN.flagWales, "left:90%;bottom:12px;--w:34;animation-duration:3.2s");
      for (let i = 0; i < 10; i++) b += SBX("bfall", SCN.petal(pick(["#ffd84d", "#fff", "#ffe98a"], i)), `left:${fxRand(2, 96).toFixed(0)}%;--w:${fxRand(7, 11).toFixed(0)};--dx:${fxRand(-30, 40).toFixed(0)}px;animation-duration:${fxRand(5, 9).toFixed(1)}s;animation-delay:${(-fxRand(0, 9)).toFixed(1)}s`);
      return b;
    },
  },
  stgeorge: {
    layer() {
      let h = ""; const c = ["#c8102e", "#e0394a", "#fff", "#b00d28"];
      for (let i = 0; i < 20; i++) h += scnFall("fall", SCN.petal(pick(c, i)), fxRand(10, 18).toFixed(0), i, [12, 22], [20, 60]);
      return h;
    },
    banner() {
      let b = scnBunting(["#c8102e", "#fff"]);
      for (let i = 0; i < 6; i++) b += SBX("bsway", SCN.flagCross, `left:${(8 + i * 17).toFixed(0)}%;bottom:14px;--w:30;animation-duration:${(2.6 + (i % 3) * .5).toFixed(1)}s;animation-delay:${(-i * .6).toFixed(1)}s`) + `<span class="bgrd" style="left:calc(${(8 + i * 17).toFixed(0)}% - 1px);width:2px;height:30px;right:auto;background:#7a6a55;opacity:.7"></span>`;
      for (let i = 0; i < 10; i++) b += SBX("bsway", SCN.rose, `left:${(4 + i * 10).toFixed(0)}%;bottom:2px;--w:${(18 + (i % 3) * 3)};animation-delay:${(-i * .5).toFixed(1)}s`);
      for (let i = 0; i < 9; i++) b += SBX("bfall", SCN.petal(pick(["#c8102e", "#e0394a", "#fff"], i)), `left:${fxRand(2, 96).toFixed(0)}%;--w:${fxRand(7, 11).toFixed(0)};--dx:${fxRand(-30, 40).toFixed(0)}px;animation-duration:${fxRand(5, 9).toFixed(1)}s;animation-delay:${(-fxRand(0, 9)).toFixed(1)}s`);
      return b;
    },
  },
  stpatrick: {
    layer() {
      let h = ""; const c = ["#2e9e4f", "#52c26f", "#1f7a3d", "#7ad68f"];
      for (let i = 0; i < 18; i++) h += scnFall("fall", SCN.shamrock(pick(c, i)), fxRand(14, 24).toFixed(0), i, [12, 22], [20, 60]);
      for (let i = 0; i < 10; i++) h += `<i class="sp" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(3, 96).toFixed(1)}%;font-size:${fxRand(9, 17).toFixed(0)}px;color:#e8b923;animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#10022;</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#17632f;height:7px"></span>`;
      b += SBX("", SCN.rainbow, "left:34%;bottom:4px;--w:150;opacity:.95");
      b += SBX("", SCN.potgold, "left:70%;bottom:3px;--w:40");
      for (let i = 0; i < 7; i++) b += SBX("bsway", SCN.shamrock(pick(["#52c26f", "#7ad68f", "#2e9e4f"], i)), `left:${(3 + i * 5.2).toFixed(0)}%;bottom:2px;--w:${(18 + (i % 3) * 4)};animation-delay:${(-i * .6).toFixed(1)}s`);
      for (let i = 0; i < 8; i++) b += SBX("bfall", SCN.coin, `left:${fxRand(2, 96).toFixed(0)}%;--w:${fxRand(8, 13).toFixed(0)};--dx:${fxRand(-30, 40).toFixed(0)}px;animation-duration:${fxRand(5, 9).toFixed(1)}s;animation-delay:${(-fxRand(0, 9)).toFixed(1)}s`);
      for (let i = 0; i < 12; i++) b += `<i class="bsp" style="left:${fxRand(2, 97).toFixed(0)}%;top:${fxRand(4, 60).toFixed(0)}%;font-size:${fxRand(8, 14).toFixed(0)}px;color:#ffe27a;animation-duration:${fxRand(1.8, 4).toFixed(1)}s;animation-delay:${(-fxRand(0, 4)).toFixed(1)}s">&#10022;</i>`;
      return b;
    },
  },
  standrew: {
    layer() {
      let h = "";
      for (let i = 0; i < 14; i++) h += `<i class="rise" style="--dx:${fxRand(-60, 60).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(12, 22).toFixed(0)}px;opacity:.7;animation-duration:${fxRand(30, 60).toFixed(0)}s;animation-delay:${(-fxRand(0, 60)).toFixed(0)}s;filter:drop-shadow(0 0 3px rgba(0,94,184,.6))">${SCN.fuzz}</i>`;
      for (let i = 0; i < 8; i++) h += `<i class="sp" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(3, 96).toFixed(1)}%;font-size:${fxRand(9, 16).toFixed(0)}px;color:#5aa3ea;animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#10022;</i>`;
      return h;
    },
    banner() {
      let b = scnBunting(["#fff", "#cfe3fa"]);
      for (let i = 0; i < 6; i++) b += SBX("bsway", SCN.flagSaltire, `left:${(8 + i * 17).toFixed(0)}%;bottom:14px;--w:30;animation-duration:${(2.6 + (i % 3) * .5).toFixed(1)}s;animation-delay:${(-i * .6).toFixed(1)}s`) + `<span class="bgrd" style="left:calc(${(8 + i * 17).toFixed(0)}% - 1px);width:2px;height:30px;right:auto;background:#cfe3fa;opacity:.8"></span>`;
      for (let i = 0; i < 10; i++) b += SBX("bsway", SCN.thistle, `left:${(4 + i * 10).toFixed(0)}%;bottom:2px;--w:${(14 + (i % 3) * 3)};animation-delay:${(-i * .5).toFixed(1)}s`);
      for (let i = 0; i < 12; i++) b += SBX("brise", SCN.fuzz, `left:${fxRand(2, 97).toFixed(0)}%;--w:${fxRand(8, 14).toFixed(0)};animation-duration:${fxRand(4, 8).toFixed(1)}s;animation-delay:${(-fxRand(0, 8)).toFixed(1)}s`);
      return b;
    },
  },
});

function buildThemeFx() {
  const theme = document.documentElement.getAttribute("data-theme");
  const SCENE = THEME_SCENES[theme];
  const kind = (["halloween", "christmas", "easter", "antimicrobial", "swiftie"].includes(theme) || SCENE) ? theme : null;
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
      } else if (SCENE) {
        h = SCENE.layer();
      } else if (kind === "swiftie") {
        const cols = ["#ffffff", "#ffd1ea", "#d9c2ff", "#bfe3ff", "#ffe9a8"];
        for (let i = 0; i < 26; i++) {
          const c = cols[i % cols.length];
          h += `<i class="sp" style="left:${fxRand(1, 97).toFixed(1)}%;top:${fxRand(3, 95).toFixed(1)}%;font-size:${fxRand(10, 22).toFixed(0)}px;color:${c};animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">${i % 4 === 3 ? "&#10023;" : "&#10022;"}</i>`;
        }
        const glyphs = ["&#9825;", "&#9834;", "&#9835;", "&#9825;", "&#10022;"], gc = ["#ff9ac9", "#b79cff", "#7fc3f0", "#f5c451", "#ff7eb6"];
        for (let i = 0; i < 12; i++) {
          h += `<i class="rise" style="--dx:${fxRand(-90, 90).toFixed(0)}px;left:${fxRand(2, 96).toFixed(1)}%;font-size:${fxRand(14, 26).toFixed(0)}px;color:${gc[i % gc.length]};animation-duration:${fxRand(30, 60).toFixed(0)}s;animation-delay:${(-fxRand(0, 60)).toFixed(0)}s">${glyphs[i % glyphs.length]}</i>`;
        }
      } else if (kind === "antimicrobial") {
        const types = ["bacillus", "virus", "cocci", "phage", "spirillum", "virus", "bacillus"];
        for (let i = 0; i < 20; i++) {
          const t = types[i % types.length];
          h += `<span class="germ" style="--s:${fxRand(.6, 1.5).toFixed(2)};--dx:${fxRand(-140, 140).toFixed(0)}px;left:${fxRand(0, 96).toFixed(1)}%;animation-duration:${fxRand(45, 90).toFixed(0)}s;animation-delay:${(-fxRand(0, 90)).toFixed(0)}s"><span class="g" style="--r:${fxRand(20, 70).toFixed(0)}deg;animation-duration:${fxRand(6, 12).toFixed(1)}s">${FX_SVG[t]}</span></span>`;
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
  } else if (SCENE) {
    b = SCENE.banner();
  } else if (kind === "swiftie") {
    b += `<span class="disco" style="left:7%">${FX_SVG.disco}</span><span class="disco" style="left:78%;zoom:.8;animation-delay:-2s">${FX_SVG.disco}</span>`;
    const sets = [["#ff9ac9", "#fff", "#b79cff", "#7fc3f0", "#ffe08a", "#ff9ac9", "#fff", "#b79cff"], ["#7fc3f0", "#ffe08a", "#ff9ac9", "#fff", "#b79cff", "#7fc3f0", "#ffe08a", "#ff9ac9"], ["#fff", "#b79cff", "#ffe08a", "#ff9ac9", "#7fc3f0", "#fff", "#b79cff", "#ffe08a"]];
    sets.forEach((c, i) => { b += `<span class="bracelet" style="left:${(22 + i * 19).toFixed(0)}%;bottom:${(8 + (i % 2) * 14)}px;animation-delay:${(-i * 1.4).toFixed(1)}s">${FX_SVG.bracelet(c)}</span>`; });
    const cols = ["#fff", "#ffd1ea", "#fff3b0", "#d9c2ff"];
    for (let i = 0; i < 18; i++) b += `<i class="bsp" style="left:${fxRand(2, 97).toFixed(0)}%;top:${fxRand(4, 70).toFixed(0)}%;font-size:${fxRand(9, 17).toFixed(0)}px;color:${cols[i % 4]};animation-duration:${fxRand(1.8, 4).toFixed(1)}s;animation-delay:${(-fxRand(0, 4)).toFixed(1)}s">${i % 5 === 4 ? "&#9834;" : "&#10022;"}</i>`;
  } else if (kind === "antimicrobial") {
    const types = ["bacillus", "virus", "cocci", "phage", "spirillum", "virus", "bacillus", "cocci"];
    for (let i = 0; i < 8; i++) {
      b += `<span class="germb" style="--s:${fxRand(.55, .95).toFixed(2)};--y0:${fxRand(2, 18).toFixed(0)}px;--y1:${fxRand(10, 28).toFixed(0)}px;--still:${(6 + i * 12).toFixed(0)}%;animation-duration:${fxRand(24, 40).toFixed(0)}s;animation-delay:${(-fxRand(0, 40)).toFixed(0)}s"><span class="g" style="--r:${fxRand(15, 45).toFixed(0)}deg">${FX_SVG[types[i]]}</span></span>`;
    }
    for (let i = 0; i < 3; i++) b += `<span class="capsule" style="left:${(18 + i * 30).toFixed(0)}%;animation-delay:${(-i * 1.3).toFixed(1)}s">${FX_SVG.capsule}</span>`;
    for (let i = 0; i < 9; i++) b += `<span class="bubble" style="left:${fxRand(2, 96).toFixed(0)}%;animation-duration:${fxRand(3, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s"></span>`;
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
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch (e) {}   // the theme belongs to the signed-in session only
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
  // A viewer may only open the Huddle Board and Quick Links (and the portal home).
  if (isViewerRole(profile) && !VIEWER_PAGES.includes(window.location.pathname.split("/").pop())) {
    window.location.href = "portal.html";
    return null;
  }
  renderTopbar(profile);
  return profile;
}

function isLeadPlus(profile) { return ["lead_pharmacist", "superuser", "developer"].includes(profile.role); }
function isSuperuserPlus(profile) { return ["superuser", "developer"].includes(profile.role); }
function isDeveloper(profile) { return profile.role === "developer"; }
// Two limited roles. "viewer" sees ONLY the Huddle Board and Quick Links;
// "huddle_poster" is read-only everywhere except that they can post on the
// Huddle Board. Neither takes leave or sits in the on-call pool.
function isViewerRole(profile) { return profile.role === "viewer"; }
function isReadOnlyRole(profile) { return profile.role === "viewer" || profile.role === "huddle_poster"; }
function canPostHuddle(profile) { return ["lead_pharmacist", "superuser", "developer", "huddle_poster"].includes(profile.role); }
const VIEWER_PAGES = ["portal.html", "huddle.html", "links.html", "reset-password.html", "login.html", "index.html", ""];
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
  if (isViewerRole(profile)) {
    // Only Home, Huddle Board and Quick Links.
    for (let i = links.length - 1; i >= 0; i--) if (["calendar.html", "oncall.html"].includes(links[i][0])) links.splice(i, 1);
  }
  if (isSuperuserPlus(profile)) {
    links.push(["admin.html", "Admin", page === "admin.html"]);
    links.push(["audit.html", "Audit Trail", page === "audit.html"]);
  }
  const subLinks = [["calendar.html", "Calendar"]];
  if (!isReadOnlyRole(profile)) subLinks.push(["my-leave.html", "My Leave"]);
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

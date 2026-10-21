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
  technician: "Technician",
  senior_technician: "Senior Technician",
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
  swiftie:   "Taylor Quick",
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
  emergency: "EF / ACU",
  surgical:  "Surgical Care",
  intensive: "Intensive Care",
  elderly:   "Elderly Medicine",
  paeds:     "Paediatrics",
  cardiology:  "Cardiology",
  endocrine:   "Endocrine",
  respiratory: "Respiratory",
  nightsky:  "Night Sky / Space",
  deepocean: "Deep Ocean",
  botanical: "Botanical Garden",
  retro80s:  "Retro 80s",
  library:   "Library / Study",
  win98:     "Windows 98",
  arcade:    "Arcade",
  rainforest:"Rainforest",
  tropical:  "Tropical Island",
  skyline:   "City Skyline at Dusk",
  desert:    "Desert Sunset",
  spaceconflict: "Space Conflict",
  edgadp: "ED&G ADP",
  fishzoo: "Fish Zoo",
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
/* ---- Which themes people may pick for themselves (Developer sets it in
   Admin -> Appearance). THEME_RESTRICTED = themes only a Developer can
   assign; everything else is open to everyone. A person whose theme a
   Developer has LOCKED (profiles.theme_locked) can't change it, and a
   locked theme also beats the monthly schedule. */
let THEME_RESTRICTED = new Set();
async function loadThemeRestrictions() {
  try {
    const { data, error } = await sb.from("theme_restrictions").select("theme");
    if (error) throw error;
    THEME_RESTRICTED = new Set((data || []).map(r => r.theme));
  } catch (e) { /* table not created yet: every theme stays open */ }
  return THEME_RESTRICTED;
}
// The theme this person should actually see right now.
function effectiveTheme(profile) {
  if (profile.theme_locked) return profile.theme;
  return scheduledTheme() || profile.theme;
}
// Called from the topbar's own theme picker.
async function setOwnTheme(theme) {
  const sel = document.getElementById("themeSelectOwn");
  const prev = sel ? sel.dataset.current : null;
  try {
    const { error } = await sb.rpc("set_own_theme", { p_theme: theme });
    if (error) throw error;
    if (sel) sel.dataset.current = theme;
    applyTheme(scheduledTheme() || theme);   // a monthly theme (if any) still shows
  } catch (e) {
    if (typeof uiAlert === "function") uiAlert(e.message || "Could not change theme.");
    if (sel && prev) sel.value = prev;
  }
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

/* =====================================================================
   Specialty themes: Emergency Hospital Care, Surgical Care, Intensive
   Care, Elderly Medicine, Paediatrics. Generic drawn artwork only.
   ===================================================================== */
Object.assign(SCN, {
  plus: (c) => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7,1H13V7H19V13H13V19H7V13H1V7H7Z" fill="${c}"/></svg>`,
  ambulance: `<svg viewBox="0 0 100 48" aria-hidden="true"><path d="M3,36 V16 Q3,10 9,10 H60 V36Z" fill="#ffd100" stroke="#c9a400" stroke-width="1.2"/><path d="M60,16 H80 Q88,16 92,26 L97,30 Q99,32 99,36 H60Z" fill="#ffd100" stroke="#c9a400" stroke-width="1.2"/><path d="M66,19 H79 Q84,19 87,26 H66Z" fill="#cfe6f5" stroke="#7aa6c8" stroke-width=".8"/><rect x="3" y="24" width="6" height="4" fill="#1b8a3c"/><rect x="3" y="28" width="6" height="4" fill="#ffd100"/><rect x="9" y="28" width="6" height="4" fill="#1b8a3c"/><rect x="9" y="24" width="6" height="4" fill="#ffd100"/><rect x="15" y="24" width="6" height="4" fill="#1b8a3c"/><rect x="15" y="28" width="6" height="4" fill="#ffd100"/><rect x="21" y="28" width="6" height="4" fill="#1b8a3c"/><rect x="21" y="24" width="6" height="4" fill="#ffd100"/><rect x="27" y="24" width="6" height="4" fill="#1b8a3c"/><rect x="27" y="28" width="6" height="4" fill="#ffd100"/><rect x="33" y="28" width="6" height="4" fill="#1b8a3c"/><rect x="33" y="24" width="6" height="4" fill="#ffd100"/><rect x="39" y="24" width="6" height="4" fill="#1b8a3c"/><rect x="39" y="28" width="6" height="4" fill="#ffd100"/><rect x="45" y="28" width="6" height="4" fill="#1b8a3c"/><rect x="45" y="24" width="6" height="4" fill="#ffd100"/><rect x="51" y="24" width="6" height="4" fill="#1b8a3c"/><rect x="51" y="28" width="6" height="4" fill="#ffd100"/><rect x="3" y="32" width="96" height="3" fill="#1b8a3c"/><circle cx="31" cy="17" r="6.5" fill="#fff"/><path d="M31,12 V22 M26,17 H36" stroke="#1f5fa8" stroke-width="3" stroke-linecap="round"/><rect x="34" y="5" width="14" height="5" rx="2" fill="#2a6fb8"/><circle cx="22" cy="38" r="7" fill="#2c2c34"/><circle cx="22" cy="38" r="3" fill="#cfd5dc"/><circle cx="80" cy="38" r="7" fill="#2c2c34"/><circle cx="80" cy="38" r="3" fill="#cfd5dc"/></svg>`,
  siren: (c) => `<svg viewBox="0 0 18 14" aria-hidden="true"><path d="M2,13 A7,11 0 0 1 16,13Z" fill="${c}"/><rect x="0" y="11" width="18" height="3" rx="1" fill="#444"/></svg>`,
  lamp: `<svg viewBox="0 0 60 56" aria-hidden="true"><path d="M30,0 V14" stroke="#9fb0bb" stroke-width="3"/><circle cx="30" cy="34" r="21" fill="#eef3f6" stroke="#9fb0bb" stroke-width="1.6"/><circle cx="30" cy="34" r="13" fill="#fff8d6" stroke="#e3d58b"/><g fill="#fff3a8" stroke="#e3d58b" stroke-width=".6">${[0, 60, 120, 180, 240, 300].map(a => `<circle cx="${(30 + 8 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(34 + 8 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="2.6"/>`).join("")}<circle cx="30" cy="34" r="3.2"/></g></svg>`,
  scissors: `<svg viewBox="0 0 30 42" aria-hidden="true"><path d="M11,28 L22,2 M19,28 L8,2" stroke="#d3dce3" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="34" r="5" fill="none" stroke="#9fb0bb" stroke-width="2.4"/><circle cx="22" cy="34" r="5" fill="none" stroke="#9fb0bb" stroke-width="2.4"/></svg>`,
  scalpel: `<svg viewBox="0 0 16 46" aria-hidden="true"><path d="M6,44 V18 H10 V44Z" fill="#8fa3b0" stroke="#6f8492" stroke-width=".8"/><path d="M6,18 Q8,10 8,1 Q8,10 10,18Z" fill="#e8eef2" stroke="#9fb0bb" stroke-width=".8"/></svg>`,
  monitor: `<svg viewBox="0 0 54 44" aria-hidden="true"><rect x="2" y="2" width="50" height="32" rx="3" fill="#0b1a24" stroke="#9fb0bb" stroke-width="2"/><path d="M6,20 H16 L19,12 L23,28 L26,20 H34 L37,15 L40,22 H48" stroke="#39e08d" stroke-width="1.6" fill="none" stroke-linejoin="round"/><text x="8" y="10" font-size="6" fill="#ffd43b" font-family="Arial,sans-serif">72</text><text x="40" y="10" font-size="6" fill="#7fd0ff" font-family="Arial,sans-serif">98%</text><rect x="22" y="34" width="10" height="5" fill="#9fb0bb"/><rect x="14" y="39" width="26" height="3" rx="1.5" fill="#9fb0bb"/></svg>`,
  dropBag: `<svg viewBox="0 0 26 56" aria-hidden="true"><path d="M13,0 V6" stroke="#9fb0bb" stroke-width="2"/><path d="M4,6 H22 V30 Q13,40 4,30Z" fill="rgba(170,215,255,.45)" stroke="#9bc4e6" stroke-width="1.4"/><path d="M4,22 Q13,26 22,22 V30 Q13,40 4,30Z" fill="rgba(110,180,240,.55)"/><path d="M13,38 V44" stroke="#9bc4e6" stroke-width="1.6"/></svg>`,
  drop: `<svg viewBox="0 0 10 16" aria-hidden="true"><path d="M5,0 Q10,7 10,10.5 A5,5 0 1 1 0,10.5 Q0,7 5,0Z" fill="#7fd0ff"/></svg>`,
  teacup: `<svg viewBox="0 0 48 44" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"><path class="steam" d="M16,14 q-4,-4 0,-8 q4,-4 0,-8"/><path class="steam" style="animation-delay:-1s" d="M24,14 q-4,-4 0,-8 q4,-4 0,-8"/><path class="steam" style="animation-delay:-2s" d="M32,14 q-4,-4 0,-8 q4,-4 0,-8"/></g><path d="M8,18 H40 Q40,36 24,36 Q8,36 8,18Z" fill="#fff" stroke="#d9c8e0" stroke-width="1.4"/><path d="M40,21 Q48,21 46,28 Q44,33 38,32" fill="none" stroke="#d9c8e0" stroke-width="2.4"/><ellipse cx="24" cy="39" rx="19" ry="3.5" fill="#f3e9f6" stroke="#d9c8e0"/><path d="M14,24 q3,-3 6,0 M26,28 q3,-3 6,0" stroke="#e58aab" stroke-width="1.6" fill="none"/></svg>`,
  clock: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fffaf0" stroke="#8a6d4b" stroke-width="2.4"/>${[0, 90, 180, 270].map(a => `<line x1="20" y1="4.5" x2="20" y2="8" stroke="#8a6d4b" stroke-width="1.6" transform="rotate(${a} 20 20)"/>`).join("")}<line class="hh" x1="20" y1="20" x2="20" y2="11" stroke="#5b4636" stroke-width="2.4" stroke-linecap="round"/><line class="hm" x1="20" y1="20" x2="20" y2="7" stroke="#5b4636" stroke-width="1.6" stroke-linecap="round"/><circle cx="20" cy="20" r="1.8" fill="#5b4636"/></svg>`,
  glasses: `<svg viewBox="0 0 54 24" aria-hidden="true"><g fill="rgba(200,230,255,.35)" stroke="#6b4f7a" stroke-width="2.2"><circle cx="14" cy="13" r="9.5"/><circle cx="40" cy="13" r="9.5"/></g><path d="M23.5,12 Q27,8 30.5,12" stroke="#6b4f7a" stroke-width="2.2" fill="none"/><path d="M4.5,12 L1,6 M49.5,12 L53,6" stroke="#6b4f7a" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  wool: (c) => `<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="14" cy="16" r="12" fill="${c}"/><path d="M5,10 Q14,16 23,8 M3,17 Q14,23 25,15 M6,24 Q15,20 22,24" stroke="rgba(255,255,255,.55)" stroke-width="1.4" fill="none"/><path d="M24,26 Q30,28 29,22" stroke="${c}" stroke-width="2" fill="none"/></svg>`,
  plant: `<svg viewBox="0 0 30 40" aria-hidden="true"><path d="M15,24 Q4,20 5,8 Q14,10 15,22 M15,24 Q26,20 25,6 Q16,9 15,22 M15,24 V14" fill="#4fb860" stroke="#3f9a4d" stroke-width="1"/><path d="M7,26 H23 L21,38 H9Z" fill="#c9784a" stroke="#a65e36"/></svg>`,
  teddy: `<svg viewBox="0 0 46 52" aria-hidden="true"><g fill="#c68a52" stroke="#a06a38" stroke-width="1.2"><circle cx="9" cy="8" r="6"/><circle cx="37" cy="8" r="6"/><ellipse cx="23" cy="36" rx="14" ry="13"/><circle cx="23" cy="18" r="13"/><ellipse cx="8" cy="34" rx="5" ry="8" transform="rotate(20 8 34)"/><ellipse cx="38" cy="34" rx="5" ry="8" transform="rotate(-20 38 34)"/><ellipse cx="14" cy="48" rx="6" ry="4"/><ellipse cx="32" cy="48" rx="6" ry="4"/></g><circle cx="9" cy="8" r="3" fill="#e9b98a"/><circle cx="37" cy="8" r="3" fill="#e9b98a"/><ellipse cx="23" cy="36" rx="8" ry="8" fill="#e9b98a"/><ellipse cx="23" cy="22" rx="6" ry="4.5" fill="#e9b98a"/><circle cx="18" cy="15" r="1.8" fill="#3b2a1a"/><circle cx="28" cy="15" r="1.8" fill="#3b2a1a"/><ellipse cx="23" cy="20" rx="2.4" ry="1.7" fill="#3b2a1a"/><path d="M23,22 Q20,25 17.5,23 M23,22 Q26,25 28.5,23" stroke="#3b2a1a" stroke-width="1" fill="none"/><path d="M16,29 L23,32 L30,29 L30,35 L23,32 L16,35Z" fill="#d4202c"/></svg>`,
  balloon: (c) => `<svg viewBox="0 0 26 50" aria-hidden="true"><ellipse cx="13" cy="15" rx="11" ry="14" fill="${c}"/><ellipse cx="9" cy="9" rx="3" ry="5" fill="#fff" opacity=".4"/><path d="M11,29 L15,29 L13,32Z" fill="${c}"/><path d="M13,32 Q9,38 14,43 Q18,47 12,50" stroke="#8a8a96" stroke-width="1" fill="none"/></svg>`,
  block: (c, l) => `<svg viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="2" width="26" height="26" rx="3.5" fill="${c}" stroke="rgba(0,0,0,.2)" stroke-width="1"/><text x="15" y="22.5" text-anchor="middle" font-size="19" font-weight="700" fill="#fff" font-family="Arial,sans-serif">${l}</text></svg>`,
  star: (c) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,1.5 L15,9 L23,9.6 L17,14.8 L19,22.5 L12,18.3 L5,22.5 L7,14.8 L1,9.6 L9,9Z" fill="${c}" stroke="rgba(0,0,0,.15)" stroke-width=".7" stroke-linejoin="round"/></svg>`,
});
function scnEcg(color, op, cls, style, kind) {
  let d = "M0,20 ";
  if (kind === "pleth") { for (let x = 0; x <= 2400; x += 8) d += `L${x},${(30 - 22 * Math.pow(Math.max(0, Math.sin(x / 160 * Math.PI)), 3) - 3 * Math.sin(x / 80 * Math.PI)).toFixed(1)} `; }
  else if (kind === "wave") { for (let x = 0; x <= 2400; x += 8) d += `L${x},${(20 + 11 * Math.sin(x / 90 * Math.PI) * Math.sin(x / 700)).toFixed(1)} `; }
  else for (let b = 0; b < 12; b++) { const o = b * 200; d += `L${o + 60},20 L${o + 70},16 L${o + 80},20 L${o + 95},20 L${o + 100},26 L${o + 108},2 L${o + 118},37 L${o + 124},20 L${o + 150},20 L${o + 160},13 L${o + 175},20 L${o + 200},20 `; }
  return `<svg class="scn-wave ${cls}" style="${style || ""}" viewBox="0 0 2400 40" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="${op}"/></svg>`;
}
const scnNum = (txt, col, left, top, size) => `<span class="bnum" style="left:${left};top:${top}px;color:${col};font-size:${size || 11}px">${txt}</span>`;

Object.assign(THEME_SCENES, {
  emergency: {
    // Calm and uncluttered: a few faint crosses, a quiet heartbeat line and a
    // slow UK-style (yellow, green Battenburg) ambulance. No flashing lights.
    layer() {
      let h = ""; const c = ["#c9d3dd", "#ffe27a", "#a9d8bd"];
      for (let i = 0; i < 6; i++) h += `<i class="rise" style="--dx:${fxRand(-30, 30).toFixed(0)}px;left:${fxRand(4, 95).toFixed(1)}%;width:${fxRand(12, 20).toFixed(0)}px;opacity:.16;animation-duration:${fxRand(90, 140).toFixed(0)}s;animation-delay:${(-fxRand(0, 140)).toFixed(0)}s">${SCN.plus(pick(c, i))}</i>`;
      return h;
    },
    banner() {
      let b = scnEcg("#cfe3f2", .3, "wvA", "height:22px;bottom:0;animation-duration:30s");
      b += SBX("bcross", SCN.ambulance, "left:0;bottom:6px;--w:80;--still:40%;animation-duration:75s");
      return b;
    },
  },
  surgical: {
    layer() {
      let h = "";
      for (let i = 0; i < 16; i++) h += `<i class="rise" style="--dx:${fxRand(-40, 40).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(8, 20).toFixed(0)}px;opacity:.5;animation-duration:${fxRand(22, 45).toFixed(0)}s;animation-delay:${(-fxRand(0, 45)).toFixed(0)}s"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="rgba(255,255,255,.4)" stroke="#5fd3c6"/><circle cx="4" cy="4" r="1.2" fill="#fff"/></svg></i>`;
      for (let i = 0; i < 10; i++) h += `<i class="sp" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(3, 96).toFixed(1)}%;font-size:${fxRand(9, 16).toFixed(0)}px;color:#5fd3c6;animation-duration:${fxRand(2.5, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#10022;</i>`;
      return h;
    },
    banner() {
      let b = scnEcg("#baf5e6", .85, "wvA", "height:20px;bottom:0;animation-duration:8s");
      b += SBX("bswing", SCN.lamp, "left:14%;top:-4px;--w:54") + SBX("bswing b2", SCN.lamp, "left:74%;top:-4px;--w:54");
      b += SBX("", SCN.monitor, "left:44%;bottom:6px;--w:50");
      b += SBX("bsway", SCN.scissors, "left:30%;bottom:6px;--w:20;animation-delay:-1s") + SBX("bsway", SCN.scalpel, "left:34%;bottom:6px;--w:11;animation-delay:-2s");
      b += SBX("bsway", SCN.scalpel, "left:60%;bottom:6px;--w:11") + SBX("bsway", SCN.scissors, "left:63%;bottom:6px;--w:20;animation-delay:-1.5s");
      for (let i = 0; i < 9; i++) b += `<i class="bubble" style="left:${fxRand(3, 96).toFixed(0)}%;animation-duration:${fxRand(3, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s;border-color:rgba(255,255,255,.7)"></i>`;
      return b;
    },
  },
  intensive: {
    layer() {
      let h = ""; const t = ["72", "98%", "120/80", "36.8", "16", "SpO2", "HR 68", "BP", "EtCO2 4.8", "MAP 84"], c = ["#39e08d", "#7fd0ff", "#ffd43b", "#ff7b7b"];
      for (let i = 0; i < 18; i++) h += `<i class="rise" style="--dx:${fxRand(-30, 30).toFixed(0)}px;left:${fxRand(2, 96).toFixed(1)}%;font-size:${fxRand(11, 20).toFixed(0)}px;color:${pick(c, i)};opacity:.28;font-family:ui-monospace,Menlo,monospace;font-weight:600;animation-duration:${fxRand(70, 130).toFixed(0)}s;animation-delay:${(-fxRand(0, 130)).toFixed(0)}s;text-shadow:0 0 8px currentColor">${pick(t, i)}</i>`;
      return h;
    },
    banner() {
      let b = scnEcg("#39e08d", .95, "wvA", "height:18px;bottom:36px;animation-duration:15s");
      b += scnEcg("#7fd0ff", .9, "wvB", "height:16px;bottom:19px;animation-duration:22s;animation-direction:normal", "pleth");
      b += scnEcg("#ffd43b", .85, "wvA", "height:14px;bottom:3px;animation-duration:32s", "wave");
      b += scnNum("HR 72", "#39e08d", "3%", 4, 12) + scnNum("SpO2 98%", "#7fd0ff", "13%", 4, 11) + scnNum("120/80", "#ffd43b", "26%", 4, 11);
      b += `<span class="bpulse" style="left:92%;top:8px"></span>`;
      b += SBX("", SCN.dropBag, "left:84%;top:2px;--w:20");
      b += `<span class="bdrip" style="left:calc(84% + 9px);top:34px"></span>`;
      return b;
    },
  },
  elderly: {
    layer() {
      let h = "";
      for (let i = 0; i < 12; i++) h += `<i class="rise" style="--dx:${fxRand(-60, 60).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(12, 22).toFixed(0)}px;opacity:.4;animation-duration:${fxRand(40, 75).toFixed(0)}s;animation-delay:${(-fxRand(0, 75)).toFixed(0)}s">${SCN.heart(pick(["#e58aab", "#c9a7dc", "#f2c0d0"], i))}</i>`;
      for (let i = 0; i < 12; i++) h += scnFall("fall", SCN.petal(pick(["#f2c0d0", "#e8d5f0", "#fff3e0"], i)), fxRand(9, 15).toFixed(0), i, [16, 28], [20, 50]);
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#9c7b5c;height:7px"></span>`;
      b += SBX("", SCN.teacup, "left:6%;bottom:6px;--w:46") + SBX("", SCN.clock, "left:24%;bottom:8px;--w:40");
      b += SBX("bbob", SCN.glasses, "left:40%;bottom:8px;--w:54;animation-duration:6s");
      b += SBX("", SCN.wool("#e58aab"), "left:56%;bottom:6px;--w:28") + SBX("", SCN.wool("#9a86c4"), "left:61%;bottom:6px;--w:24");
      b += SBX("bsway", SCN.plant, "left:72%;bottom:6px;--w:30") + SBX("bsway", SCN.plant, "left:90%;bottom:6px;--w:26;animation-delay:-1.2s");
      b += SBX("", SCN.teacup, "left:80%;bottom:6px;--w:42");
      for (let i = 0; i < 8; i++) b += SBX("brise", SCN.heart(pick(["#e58aab", "#c9a7dc", "#f2c0d0"], i)), `left:${fxRand(3, 95).toFixed(0)}%;--w:${fxRand(9, 16).toFixed(0)};animation-duration:${fxRand(5, 9).toFixed(1)}s;animation-delay:${(-fxRand(0, 9)).toFixed(1)}s`);
      return b;
    },
  },
  paeds: {
    layer() {
      let h = ""; const bc = ["#ff5a5f", "#ffd23f", "#3b9de0", "#4cc97a", "#c27ee0", "#ff9a3c"];
      for (let i = 0; i < 10; i++) h += `<i class="rise" style="--dx:${fxRand(-70, 70).toFixed(0)}px;left:${fxRand(2, 96).toFixed(1)}%;width:${fxRand(20, 34).toFixed(0)}px;opacity:.55;animation-duration:${fxRand(30, 60).toFixed(0)}s;animation-delay:${(-fxRand(0, 60)).toFixed(0)}s">${SCN.balloon(pick(bc, i))}</i>`;
      for (let i = 0; i < 14; i++) h += scnFall("fall", SCN.star(pick(bc, i)), fxRand(10, 18).toFixed(0), i, [14, 26], [20, 60]);
      return h;
    },
    banner() {
      const bc = ["#ff5a5f", "#ffd23f", "#3b9de0", "#4cc97a", "#c27ee0", "#ff9a3c"];
      let b = `<span class="bgrd" style="background:#5fc46f;height:8px"></span>`;
      b += SBX("", SCN.rainbow, "left:22%;bottom:6px;--w:130;opacity:.95");
      for (let i = 0; i < 2; i++) b += SBX("bcross", SCN.cloud, `left:0;top:${4 + i * 12}px;--w:${60 - i * 14};--still:${25 + i * 40}%;animation-duration:${(50 + i * 20)}s;animation-delay:${(-i * 20)}s`);
      b += SBX("", SCN.block("#ff5a5f", "A"), "left:56%;bottom:6px;--w:26") + SBX("", SCN.block("#3b9de0", "B"), "left:59.5%;bottom:6px;--w:26") + SBX("", SCN.block("#ffb400", "C"), "left:57.7%;bottom:30px;--w:26");
      b += SBX("bbob", SCN.teddy, "left:72%;bottom:6px;--w:38;animation-duration:3.2s");
      for (let i = 0; i < 7; i++) b += SBX("bbob", SCN.balloon(pick(bc, i)), `left:${(4 + i * 6.5).toFixed(0)}%;top:${(-2 + (i % 3) * 3)}px;--w:18;animation-duration:${(3.5 + (i % 4) * .6).toFixed(1)}s;animation-delay:${(-i * .5).toFixed(1)}s`);
      for (let i = 0; i < 6; i++) b += SBX("bbob", SCN.balloon(pick(bc, i + 2)), `left:${(84 + i * 2.6).toFixed(0)}%;top:${(-2 + (i % 3) * 3)}px;--w:16;animation-duration:${(3.5 + (i % 4) * .6).toFixed(1)}s;animation-delay:${(-i * .5).toFixed(1)}s`);
      for (let i = 0; i < 10; i++) b += `<i class="bsp" style="left:${fxRand(2, 97).toFixed(0)}%;top:${fxRand(8, 60).toFixed(0)}%;font-size:${fxRand(8, 14).toFixed(0)}px;color:${pick(["#ffd23f", "#fff", "#ff9a3c"], i)};animation-duration:${fxRand(1.8, 4).toFixed(1)}s;animation-delay:${(-fxRand(0, 4)).toFixed(1)}s">&#10022;</i>`;
      return b;
    },
  },
});

/* =====================================================================
   Specialty themes (2): Cardiology, Endocrine, Respiratory.
   Generic drawn artwork only.
   ===================================================================== */
Object.assign(SCN, {
  heartAnat: `<svg viewBox="0 0 48 52" aria-hidden="true"><path d="M17,10 Q14,0 22,1 L24,10Z" fill="#3b82c4" stroke="#245a8e" stroke-width="1"/><path d="M26,10 Q26,0 36,2 Q40,4 36,10Z" fill="#d4202c" stroke="#8a1018" stroke-width="1"/><path d="M24,48 C6,36 2,24 6,16 C10,9 20,10 24,18 C28,10 38,9 42,16 C46,24 42,36 24,48Z" fill="#e0344a" stroke="#a01428" stroke-width="1.4"/><path d="M12,18 Q10,26 16,34" stroke="#ff9aa8" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/><path d="M24,18 Q22,28 28,40" stroke="#a01428" stroke-width="1.6" fill="none" opacity=".6"/></svg>`,
  bloodcell: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#d4202c" stroke="#9c1220" stroke-width="1"/><ellipse cx="12" cy="12" rx="5" ry="3.6" fill="#a8101f" opacity=".7"/></svg>`,
  stetho: `<svg viewBox="0 0 44 56" aria-hidden="true"><path d="M8,2 V14 Q8,26 22,26 Q36,26 36,14 V2" stroke="#5b6b78" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="8" cy="3" r="3" fill="#8fa3b0"/><circle cx="36" cy="3" r="3" fill="#8fa3b0"/><path d="M22,26 V38" stroke="#5b6b78" stroke-width="3"/><circle cx="22" cy="46" r="8" fill="#c9d3da" stroke="#5b6b78" stroke-width="2.4"/><circle cx="22" cy="46" r="4" fill="#8fa3b0"/></svg>`,
  lungs: `<svg viewBox="0 0 70 60" aria-hidden="true"><path d="M35,4 V26" stroke="#e8a0ac" stroke-width="4" stroke-linecap="round"/><path d="M35,24 Q26,28 20,34 M35,24 Q44,28 50,34" stroke="#e8a0ac" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M30,16 C20,12 10,22 8,38 C6,52 12,58 20,57 C28,56 31,50 31,40Z" fill="#f4a3b4" stroke="#d9778c" stroke-width="1.6"/><path d="M40,16 C50,12 60,22 62,38 C64,52 58,58 50,57 C42,56 39,50 39,40Z" fill="#f4a3b4" stroke="#d9778c" stroke-width="1.6"/><path d="M20,36 Q18,46 22,52 M50,36 Q52,46 48,52" stroke="#fff" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/></svg>`,
  inhaler: `<svg viewBox="0 0 40 46" aria-hidden="true"><rect x="12" y="2" width="14" height="22" rx="3" fill="#8fa3b0" stroke="#5b6b78" stroke-width="1.2"/><path d="M8,22 H30 V34 Q30,42 22,42 H8 Q4,42 4,36 V26 Q4,22 8,22Z" fill="#3b9de0" stroke="#1f6aa8" stroke-width="1.4"/><rect x="4" y="34" width="16" height="9" rx="2" fill="#2c8ad0" stroke="#1f6aa8"/><circle cx="26" cy="30" r="2.4" fill="#fff" opacity=".7"/></svg>`,
  wind: `<svg viewBox="0 0 80 26" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M2,9 H52 C64,9 66,0 59,0 C55,0 54,5 57,6"/><path d="M10,18 H66 C77,18 79,10 73,10 C69,10 68,14 71,15"/><path d="M4,24 H36"/></g></svg>`,
  hex: (c) => `<svg viewBox="0 0 30 30" aria-hidden="true"><polygon points="15,2 26,8.5 26,21.5 15,28 4,21.5 4,8.5" fill="none" stroke="${c}" stroke-width="2"/><circle cx="15" cy="2" r="2.4" fill="${c}"/><circle cx="26" cy="21.5" r="2.4" fill="${c}"/><circle cx="4" cy="21.5" r="2.4" fill="${c}"/><path d="M15,15 V9 M15,15 L21,18.5 M15,15 L9,18.5" stroke="${c}" stroke-width="1.4"/></svg>`,
  molecule: (c) => `<svg viewBox="0 0 34 24" aria-hidden="true"><path d="M5,12 L15,5 L25,12 L15,19Z M25,12 L31,6" stroke="${c}" stroke-width="1.8" fill="none"/><circle cx="5" cy="12" r="3.6" fill="${c}"/><circle cx="15" cy="5" r="3" fill="${c}" opacity=".8"/><circle cx="25" cy="12" r="3.6" fill="${c}"/><circle cx="15" cy="19" r="3" fill="${c}" opacity=".8"/><circle cx="31" cy="6" r="2.6" fill="${c}"/></svg>`,
  thyroid: `<svg viewBox="0 0 60 44" aria-hidden="true"><path d="M30,0 V44" stroke="#d9c2e8" stroke-width="7" stroke-linecap="round" opacity=".8"/><path d="M27,18 C12,2 2,14 6,30 C9,42 22,40 27,28Z" fill="#b070d0" stroke="#7d3fa6" stroke-width="1.4"/><path d="M33,18 C48,2 58,14 54,30 C51,42 38,40 33,28Z" fill="#b070d0" stroke="#7d3fa6" stroke-width="1.4"/><path d="M26,20 H34 V25 H26Z" fill="#a05cc2"/><path d="M12,16 Q8,24 12,32" stroke="#e8c8f5" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/></svg>`,
  glucometer: `<svg viewBox="0 0 34 54" aria-hidden="true"><rect x="2" y="2" width="30" height="50" rx="7" fill="#2f4f7a" stroke="#1d3558" stroke-width="1.4"/><rect x="6" y="6" width="22" height="16" rx="3" fill="#b8f0d8"/><text x="17" y="19" text-anchor="middle" font-size="11" font-weight="700" fill="#14573a" font-family="Arial,sans-serif">5.6</text><circle cx="17" cy="34" r="6" fill="#5aa0e0" stroke="#1d3558"/><rect x="12" y="44" width="10" height="3" rx="1.5" fill="#8fb0d6"/></svg>`,
  pen: `<svg viewBox="0 0 70 18" aria-hidden="true"><rect x="2" y="3" width="50" height="12" rx="3" fill="#e8eef5" stroke="#9fb0bb" stroke-width="1.2"/><rect x="2" y="3" width="18" height="12" rx="3" fill="#3b9de0"/><rect x="24" y="6" width="14" height="6" rx="1" fill="#fff" stroke="#9fb0bb" stroke-width=".8"/><text x="31" y="11" text-anchor="middle" font-size="5.5" font-weight="700" fill="#2b4a6b" font-family="Arial,sans-serif">10</text><path d="M52,8 H66" stroke="#8fa3b0" stroke-width="1.6"/><path d="M66,8 H69" stroke="#5b6b78" stroke-width="1"/><rect x="50" y="5" width="4" height="8" fill="#9fb0bb"/></svg>`,
});

Object.assign(THEME_SCENES, {
  cardiology: {
    layer() {
      let h = "";
      for (let i = 0; i < 12; i++) h += `<i class="rise" style="--dx:${fxRand(-50, 50).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(14, 24).toFixed(0)}px;opacity:.32;animation-duration:${fxRand(40, 75).toFixed(0)}s;animation-delay:${(-fxRand(0, 75)).toFixed(0)}s">${SCN.bloodcell}</i>`;
      for (let i = 0; i < 10; i++) h += `<i class="rise" style="--dx:${fxRand(-70, 70).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(14, 26).toFixed(0)}px;opacity:.4;animation-duration:${fxRand(40, 80).toFixed(0)}s;animation-delay:${(-fxRand(0, 80)).toFixed(0)}s">${SCN.heart(pick(["#e0425f", "#f0728a", "#c2185b"], i))}</i>`;
      return h;
    },
    banner() {
      let b = scnEcg("#fff", .9, "wvA", "height:22px;bottom:0;animation-duration:12s");
      b += SBX("bheart", SCN.heartAnat, "left:10%;top:4px;--w:44") + SBX("bheart", SCN.heartAnat, "left:86%;top:4px;--w:44;animation-delay:-.4s");
      b += SBX("bsway", SCN.stetho, "left:30%;top:2px;--w:34") + SBX("bsway", SCN.stetho, "left:66%;top:2px;--w:34;animation-delay:-1.5s");
      b += scnNum("72 bpm", "#fff", "46%", 8, 14);
      for (let i = 0; i < 9; i++) b += SBX("brise", SCN.heart(pick(["#fff", "#ffd1d9", "#ffb3c1"], i)), `left:${fxRand(8, 92).toFixed(0)}%;--w:${fxRand(9, 15).toFixed(0)};animation-duration:${fxRand(6, 11).toFixed(1)}s;animation-delay:${(-fxRand(0, 11)).toFixed(1)}s`);
      return b;
    },
  },
  endocrine: {
    layer() {
      let h = ""; const c = ["#7d3fa6", "#1fa39a", "#d99a1f", "#e0709a"];
      for (let i = 0; i < 12; i++) h += `<i class="rise" style="--dx:${fxRand(-50, 50).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(16, 30).toFixed(0)}px;opacity:.35;animation-duration:${fxRand(40, 80).toFixed(0)}s;animation-delay:${(-fxRand(0, 80)).toFixed(0)}s">${i % 2 ? SCN.hex(pick(c, i)) : SCN.molecule(pick(c, i))}</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#7d3fa6;height:6px"></span>`;
      b += SBX("bbreath", SCN.thyroid, "left:8%;bottom:8px;--w:56");
      b += SBX("", SCN.glucometer, "left:28%;bottom:6px;--w:26") + SBX("bbob", SCN.pen, "left:38%;bottom:12px;--w:66;animation-duration:5s");
      b += SBX("bbob", SCN.hex("#7d3fa6"), "left:60%;top:6px;--w:32;animation-duration:5.5s") + SBX("bbob", SCN.molecule("#1fa39a"), "left:70%;top:20px;--w:38;animation-duration:6.5s") + SBX("bbob", SCN.hex("#d99a1f"), "left:82%;top:8px;--w:28;animation-duration:4.8s");
      b += scnNum("5.6 mmol/L", "#14573a", "52%", 38, 11);
      return b;
    },
  },
  respiratory: {
    layer() {
      let h = "";
      for (let i = 0; i < 16; i++) h += `<i class="rise" style="--dx:${fxRand(-40, 40).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(8, 22).toFixed(0)}px;opacity:.5;animation-duration:${fxRand(24, 50).toFixed(0)}s;animation-delay:${(-fxRand(0, 50)).toFixed(0)}s"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="rgba(255,255,255,.4)" stroke="#6bc3e6"/><circle cx="4" cy="4" r="1.2" fill="#fff"/></svg></i>`;
      for (let i = 0; i < 4; i++) h += `<span class="xing" style="top:${(12 + i * 20)}%;animation-duration:${(46 + i * 14)}s;animation-delay:${(-i * 17)}s;--w:${70 + i * 12};opacity:.45">${SCN.wind.replace('stroke="#fff"', 'stroke="#7fb8dc"')}</span>`;
      return h;
    },
    banner() {
      let b = "";
      for (let i = 0; i < 3; i++) b += SBX("bcross", SCN.wind, `left:0;top:${6 + i * 14}px;--w:${60 - i * 8};--still:${20 + i * 30}%;opacity:.9;animation-duration:${(26 + i * 9)}s;animation-delay:${(-i * 9)}s`);
      b += SBX("bbreath", SCN.lungs, "left:44%;bottom:2px;--w:62");
      b += SBX("bbreath", SCN.lungs, "left:8%;bottom:4px;--w:44;animation-delay:-1.6s") + SBX("bbreath", SCN.lungs, "left:86%;bottom:4px;--w:44;animation-delay:-.8s");
      b += SBX("bbob", SCN.inhaler, "left:28%;bottom:6px;--w:34;animation-duration:5s") + SBX("bbob", SCN.inhaler, "left:68%;bottom:6px;--w:34;animation-duration:6s");
      b += scnNum("SpO2 98%", "#1b6fa8", "56%", 8, 11);
      for (let i = 0; i < 12; i++) b += `<i class="bubble" style="left:${fxRand(3, 96).toFixed(0)}%;animation-duration:${fxRand(3, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s;border-color:rgba(255,255,255,.8)"></i>`;
      return b;
    },
  },
});

/* =====================================================================
   General themes: Night Sky / Space, Deep Ocean, Botanical Garden,
   Retro 80s, Library / Study, Windows 98. Generic drawn artwork only.
   ===================================================================== */
const scnShelf = (h) => {
  const cols = ["#8b2e2e", "#2f5d8a", "#3f7a52", "#c9a54a", "#5c3a6e", "#a65e36", "#2d4a4f", "#b8453a", "#4a6fa5", "#6b7f3a"];
  let x = 0, out = "", i = 0;
  while (x < 1600) {
    const w = 9 + (i * 7 % 9), ht = 24 + (i * 13 % 17), c = cols[(i * 5 + (i >> 2)) % cols.length];
    out += `<rect x="${x}" y="${44 - 4 - ht}" width="${w}" height="${ht}" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><rect x="${x + 2}" y="${44 - 4 - ht + 4}" width="${Math.max(2, w - 4)}" height="2" fill="rgba(255,255,255,.35)"/>`;
    x += w + 1; i++;
  }
  return `<svg class="scn" viewBox="0 0 1600 44" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style="height:${h}px">${out}<rect x="0" y="40" width="1600" height="4" fill="#2a170c"/></svg>`;
};
Object.assign(SCN, {
  moon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M26,3 A18,18 0 1 0 37,28 A14.5,14.5 0 1 1 26,3Z" fill="#fff3c4"/><circle cx="14" cy="20" r="2.4" fill="#e8dba5"/><circle cx="21" cy="29" r="1.8" fill="#e8dba5"/></svg>`,
  saturn: `<svg viewBox="0 0 76 44" aria-hidden="true"><g transform="rotate(-16 38 22)"><ellipse cx="38" cy="22" rx="34" ry="7" fill="none" stroke="#c9a46a" stroke-width="3" opacity=".7"/><circle cx="38" cy="22" r="14" fill="#d9a05b"/><path d="M26,18 Q38,13 50,19 M25,26 Q38,22 51,28" stroke="#b97d3a" stroke-width="1.6" fill="none"/><path d="M4,22 A34,7 0 0 0 72,22" fill="none" stroke="#e8c98a" stroke-width="3"/></g></svg>`,
  rocket: `<svg viewBox="-14 0 84 30" aria-hidden="true"><path d="M3,10 L-12,15 L3,20Z" fill="#ffb347"/><path d="M12,8 H44 Q62,8 67,15 Q62,22 44,22 H12Z" fill="#f2f4ff" stroke="#b9c0e8"/><path d="M12,8 L2,1 L8,15 L2,29 L12,22Z" fill="#e0425f"/><circle cx="38" cy="15" r="4.2" fill="#5fb2ff" stroke="#3b7fc0"/><path d="M52,9 Q60,15 52,21" stroke="#e0425f" stroke-width="2.4" fill="none"/></svg>`,
  satellite: `<svg viewBox="0 0 50 26" aria-hidden="true"><rect x="19" y="7" width="12" height="12" rx="2" fill="#cfd6ff" stroke="#8ea2ff"/><rect x="2" y="9" width="14" height="8" fill="#4f6bd8" stroke="#8ea2ff"/><rect x="34" y="9" width="14" height="8" fill="#4f6bd8" stroke="#8ea2ff"/><path d="M25,7 V2" stroke="#cfd6ff" stroke-width="1.4"/><circle cx="25" cy="2" r="1.6" fill="#ff8b8b"/></svg>`,
  fish: (c) => `<svg viewBox="0 0 40 22" aria-hidden="true"><g transform="matrix(-1 0 0 1 40 0)"><path d="M2,11 C10,0 26,0 32,11 C26,22 10,22 2,11Z" fill="${c}"/><path d="M30,11 L40,3 V19Z" fill="${c}"/><circle cx="9" cy="9" r="1.9" fill="#fff"/><circle cx="9" cy="9" r=".8" fill="#123"/></g></svg>`,
  jelly: (c) => `<svg viewBox="0 0 30 44" aria-hidden="true"><path d="M3,18 A12,14 0 0 1 27,18Z" fill="${c}" opacity=".85"/><path d="M7,18 Q6,28 9,38 M12,18 Q13,30 11,42 M18,18 Q17,30 19,42 M23,18 Q24,28 21,38" stroke="${c}" stroke-width="1.8" fill="none" opacity=".7"/></svg>`,
  whale: `<svg viewBox="0 0 124 52" aria-hidden="true"><g transform="matrix(-1 0 0 1 124 0)"><path d="M4,26 Q10,6 50,6 Q100,6 112,24 Q116,30 122,20 Q121,40 108,37 Q100,34 96,37 Q60,50 20,41 Q6,37 4,26Z" fill="#3f6f9e"/><path d="M14,34 Q50,46 94,36 Q60,40 14,34Z" fill="#a9c9e4"/><circle cx="16" cy="24" r="2" fill="#0b1f33"/></g></svg>`,
  weed: (c) => `<svg viewBox="0 0 20 50" aria-hidden="true"><path d="M10,50 C2,40 18,32 10,22 C2,12 16,6 10,0" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  flower: (p, c) => `<svg viewBox="0 0 30 42" aria-hidden="true"><path d="M15,42 V18" stroke="#3f8a55" stroke-width="2.5"/><path d="M15,34 Q6,32 5,25 Q12,25 15,32" fill="#4fae68"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="15" cy="9" rx="4.6" ry="7" fill="${p}" transform="rotate(${a} 15 15)"/>`).join("")}<circle cx="15" cy="15" r="3.8" fill="${c}"/></svg>`,
  tulip: (c) => `<svg viewBox="0 0 24 44" aria-hidden="true"><path d="M12,44 V20" stroke="#3f8a55" stroke-width="2.6"/><path d="M12,36 Q4,34 3,26 Q10,27 12,34" fill="#4fae68"/><path d="M4,5 Q3,19 12,22 Q21,19 20,5 L15,11 L12,3 L9,11Z" fill="${c}"/></svg>`,
  monstera: `<svg viewBox="0 0 50 50" aria-hidden="true"><path d="M25,48 V30" stroke="#2f6f40" stroke-width="3"/><path d="M25,30 C4,34 0,12 12,4 C18,10 22,6 25,2 C28,6 32,10 38,4 C50,12 46,34 25,30Z" fill="#3f9a58"/><path d="M25,30 V6 M25,24 L12,14 M25,24 L38,14 M25,18 L16,10 M25,18 L34,10" stroke="#2a7a45" stroke-width="1.2" fill="none"/></svg>`,
  fern: `<svg viewBox="0 0 34 52" aria-hidden="true"><path d="M17,52 Q15,26 20,2" stroke="#2f7a45" stroke-width="2" fill="none"/>${Array.from({ length: 9 }, (_, i) => { const y = 8 + i * 4.6, w = 13 - i * 0.9; return `<path d="M${(17 + i * 0.4).toFixed(1)},${y.toFixed(1)} Q${(17 - w).toFixed(1)},${(y - 4).toFixed(1)} ${(17 - w - 2).toFixed(1)},${(y - 1).toFixed(1)} M${(17 + i * 0.4).toFixed(1)},${y.toFixed(1)} Q${(17 + w).toFixed(1)},${(y - 4).toFixed(1)} ${(17 + w + 2).toFixed(1)},${(y - 1).toFixed(1)}" stroke="#3f9a58" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; }).join("")}</svg>`,
  can: `<svg viewBox="0 0 56 40" aria-hidden="true"><path d="M10,12 H34 L36,34 H8Z" fill="#6fb2d8" stroke="#4a8fb8"/><path d="M34,18 L50,6 L53,10 L36,25Z" fill="#6fb2d8" stroke="#4a8fb8"/><path d="M10,17 Q0,15 2,27 Q4,31 9,29" fill="none" stroke="#4a8fb8" stroke-width="3"/><path d="M14,12 Q22,1 30,12" fill="none" stroke="#4a8fb8" stroke-width="3"/></svg>`,
  palm: `<svg viewBox="0 0 56 72" aria-hidden="true"><path d="M28,72 Q31,42 26,20" stroke="#12052a" stroke-width="3.6" fill="none"/><g fill="#12052a"><path d="M26,20 Q8,8 1,22 Q14,14 26,22Z"/><path d="M26,20 Q12,0 4,6 Q16,6 26,19Z"/><path d="M26,20 Q44,6 54,20 Q42,13 26,22Z"/><path d="M26,20 Q40,0 50,6 Q38,6 26,19Z"/><path d="M26,20 Q26,2 30,0 Q30,10 27,20Z"/></g></svg>`,
  sun80: `<svg viewBox="0 0 100 52" aria-hidden="true"><defs><linearGradient id="g80" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14a"/><stop offset="1" stop-color="#ff2d95"/></linearGradient><mask id="m80"><rect width="100" height="52" fill="#fff"/><rect y="30" width="100" height="2" fill="#000"/><rect y="36" width="100" height="3" fill="#000"/><rect y="42" width="100" height="4" fill="#000"/><rect y="48" width="100" height="4" fill="#000"/></mask></defs><path d="M0,52 A50,50 0 0 1 100,52Z" fill="url(#g80)" mask="url(#m80)"/></svg>`,
  cassette: `<svg viewBox="0 0 50 32" aria-hidden="true"><rect x="1" y="1" width="48" height="30" rx="3" fill="#2a2a3a" stroke="#6be9ff" stroke-width="1.2"/><rect x="6" y="5" width="38" height="12" rx="2" fill="#ff6fd0"/><circle cx="16" cy="11" r="3.6" fill="#2a2a3a"/><circle cx="34" cy="11" r="3.6" fill="#2a2a3a"/><rect x="12" y="21" width="26" height="7" rx="1.5" fill="#12052a"/></svg>`,
  neonTri: (c) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,3 L22,21 H2Z" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  neonDia: (c) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,2 L22,12 L12,22 L2,12Z" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  neonCircle: (c) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="${c}" stroke-width="2"/></svg>`,
  banker: `<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M8,6 H32 Q36,6 34,16 H6 Q4,6 8,6Z" fill="#2f7a52" stroke="#1d5238"/><rect x="18" y="16" width="4" height="22" fill="#b4832a"/><ellipse cx="20" cy="40" rx="11" ry="4" fill="#b4832a"/></svg>`,
  globe: `<svg viewBox="0 0 40 50" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="#4a86b8" stroke="#2d5f8a"/><path d="M10,14 Q16,10 20,16 Q18,22 12,22Z M24,22 Q30,20 32,26 Q28,32 24,28Z" fill="#7bbf6f"/><path d="M6,8 Q-2,22 8,34" stroke="#b4832a" stroke-width="2" fill="none"/><path d="M20,35 V42 M12,47 H28" stroke="#b4832a" stroke-width="3"/></svg>`,
  owl: `<svg viewBox="0 0 30 36" aria-hidden="true"><ellipse cx="15" cy="22" rx="10" ry="13" fill="#8a5a33"/><circle cx="10" cy="15" r="5.5" fill="#f3e3c3"/><circle cx="20" cy="15" r="5.5" fill="#f3e3c3"/><circle cx="10" cy="15" r="2.4" fill="#222"/><circle cx="20" cy="15" r="2.4" fill="#222"/><path d="M13,18 L15,22 L17,18Z" fill="#e0a030"/><path d="M6,6 L9,11 M24,6 L21,11" stroke="#8a5a33" stroke-width="3"/></svg>`,
  stackBooks: `<svg viewBox="0 0 40 30" aria-hidden="true"><rect x="2" y="20" width="34" height="8" rx="1.5" fill="#8b2e2e" stroke="rgba(0,0,0,.3)"/><rect x="5" y="12" width="30" height="8" rx="1.5" fill="#2f5d8a" stroke="rgba(0,0,0,.3)"/><rect x="3" y="4" width="32" height="8" rx="1.5" fill="#c9a54a" stroke="rgba(0,0,0,.3)"/></svg>`,
  w98computer: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="13" fill="#c0c0c0" stroke="#000"/><rect x="5" y="5" width="14" height="9" fill="#008080" stroke="#000" stroke-width=".6"/><rect x="8" y="17" width="8" height="2" fill="#c0c0c0" stroke="#000" stroke-width=".6"/><rect x="5" y="19" width="14" height="3" fill="#c0c0c0" stroke="#000" stroke-width=".6"/></svg>`,
  w98bin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6,7 H18 L17,22 H7Z" fill="#dfdfdf" stroke="#000"/><path d="M4,7 H20" stroke="#000" stroke-width="2"/><path d="M9,3 H15 V7 H9Z" fill="#c0c0c0" stroke="#000"/><path d="M10,10 V19 M14,10 V19" stroke="#808080"/></svg>`,
  w98folder: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2,6 H10 L12,8 H22 V20 H2Z" fill="#ffe27a" stroke="#000"/></svg>`,
});

Object.assign(THEME_SCENES, {
  nightsky: {
    layer() {
      let h = "";
      for (let i = 0; i < 34; i++) h += `<i class="twk" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(2, 96).toFixed(1)}%;font-size:${fxRand(6, 15).toFixed(0)}px;color:${pick(["#ffffff", "#ffe9a8", "#bfd0ff"], i)};animation-duration:${fxRand(3, 7).toFixed(1)}s;animation-delay:${(-fxRand(0, 7)).toFixed(1)}s">${i % 5 === 4 ? "&#10022;" : "&#8226;"}</i>`;
      h += `<i class="shoot" style="top:8%;left:12%;animation-delay:-2s"></i><i class="shoot" style="top:30%;left:48%;animation-delay:-8s;animation-duration:17s"></i>`;
      return h;
    },
    banner() {
      let b = "";
      for (let i = 0; i < 16; i++) b += `<i class="twk" style="position:absolute;left:${fxRand(1, 98).toFixed(0)}%;top:${fxRand(3, 52).toFixed(0)}px;font-size:${fxRand(6, 11).toFixed(0)}px;color:#fff;animation-duration:${fxRand(3, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#8226;</i>`;
      b += SBX("btw", SCN.moon, "left:6%;top:6px;--w:38");
      b += SBX("bbob", SCN.saturn, "left:80%;top:8px;--w:58;animation-duration:7s");
      b += SBX("bbob", SCN.satellite, "left:30%;top:10px;--w:36;animation-duration:6s");
      b += SBX("bcross", SCN.rocket, "left:0;top:22px;--w:62;--still:55%;animation-duration:70s");
      return b;
    },
  },
  deepocean: {
    layer() {
      let h = "";
      for (let i = 0; i < 18; i++) h += `<i class="rise" style="--dx:${fxRand(-30, 30).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(6, 18).toFixed(0)}px;opacity:.4;animation-duration:${fxRand(30, 60).toFixed(0)}s;animation-delay:${(-fxRand(0, 60)).toFixed(0)}s"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="rgba(160,230,255,.12)" stroke="rgba(160,230,255,.7)" stroke-width="1"/></svg></i>`;
      for (let i = 0; i < 3; i++) h += `<span class="xing" style="top:${(14 + i * 28)}%;animation-duration:${(80 + i * 25)}s;animation-delay:${(-i * 30)}s;--w:${50 + i * 14};opacity:.22">${SCN.fish(pick(["#7fd6e8", "#9fe3c4", "#a8c8f0"], i))}</span>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#c9b27a;height:6px"></span>`;
      for (let i = 0; i < 9; i++) b += SBX("bsway", SCN.weed(pick(["#2f9a6a", "#3fb27a", "#238a5c"], i)), `left:${(2 + i * 11.5).toFixed(0)}%;bottom:4px;--w:${(12 + (i % 3) * 4)};animation-delay:${(-i * .8).toFixed(1)}s`);
      b += SBX("bcross", SCN.whale, "left:0;top:6px;--w:100;--still:30%;opacity:.55;animation-duration:110s");
      for (let i = 0; i < 6; i++) b += SBX("bcross", SCN.fish(pick(["#ffb347", "#ff8a65", "#ffd166", "#7fd6e8"], i)), `left:0;top:${12 + (i % 3) * 13}px;--w:${(18 + (i % 3) * 4)};--still:${(12 + i * 15)}%;animation-duration:${(34 + i * 7)}s;animation-delay:${(-i * 9)}s`);
      b += SBX("bbob", SCN.jelly("#ff9ad5"), "left:20%;top:6px;--w:22;animation-duration:7s") + SBX("bbob", SCN.jelly("#b69cff"), "left:72%;top:10px;--w:26;animation-duration:8.5s");
      for (let i = 0; i < 10; i++) b += `<i class="bubble" style="left:${fxRand(3, 96).toFixed(0)}%;animation-duration:${fxRand(4, 8).toFixed(1)}s;animation-delay:${(-fxRand(0, 8)).toFixed(1)}s"></i>`;
      return b;
    },
  },
  botanical: {
    layer() {
      const cols = ["#f7b6d2", "#ffe7a3", "#c9eccf", "#f2c1e0", "#ffd2a8"]; let h = "";
      for (let i = 0; i < 14; i++) h += `<i class="fall" style="left:${fxRand(0, 98).toFixed(1)}%;width:${fxRand(9, 16).toFixed(0)}px;animation-duration:${fxRand(16, 28).toFixed(1)}s,${fxRand(4, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 28)).toFixed(1)}s,${(-fxRand(0, 6)).toFixed(1)}s;--sway:${fxRand(20, 60).toFixed(0)}px;opacity:.65">${SCN.leaf(pick(cols, i))}</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#2d6a3e;height:7px"></span>`;
      b += SBX("bsway", SCN.monstera, "left:2%;bottom:5px;--w:50") + SBX("bsway", SCN.monstera, "left:92%;bottom:5px;--w:46;animation-delay:-1.4s");
      b += SBX("bsway", SCN.fern, "left:12%;bottom:5px;--w:34;animation-delay:-.6s") + SBX("bsway", SCN.fern, "left:82%;bottom:5px;--w:34;animation-delay:-2s");
      const pet = [["#e75c9a", "#ffd23f"], ["#fff", "#f2c94c"], ["#ff9a5c", "#fff1a8"], ["#b389e8", "#ffd23f"], ["#ff6b81", "#ffe08a"]];
      for (let i = 0; i < 8; i++) { const p = pet[i % pet.length]; b += i % 3 === 2 ? SBX("bsway", SCN.tulip(p[0]), `left:${(22 + i * 7.3).toFixed(0)}%;bottom:5px;--w:15;animation-delay:${(-i * .5).toFixed(1)}s`) : SBX("bsway", SCN.flower(p[0], p[1]), `left:${(22 + i * 7.3).toFixed(0)}%;bottom:5px;--w:${(24 + (i % 2) * 6)};animation-delay:${(-i * .5).toFixed(1)}s`); }
      b += SBX("", SCN.can, "left:60%;bottom:20px;--w:40") + `<i class="bdrip" style="left:calc(60% + 36px);bottom:12px"></i><i class="bdrip" style="left:calc(60% + 41px);bottom:12px;animation-delay:-1.2s"></i>`;
      return b;
    },
  },
  retro80s: {
    layer() {
      let h = ""; const c = ["#ff6fd0", "#6be9ff", "#ffe14a", "#b58bff"];
      for (let i = 0; i < 14; i++) { const f = [SCN.neonTri, SCN.neonDia, SCN.neonCircle][i % 3]; h += `<i class="rise" style="--dx:${fxRand(-60, 60).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(14, 28).toFixed(0)}px;opacity:.38;animation-duration:${fxRand(45, 90).toFixed(0)}s;animation-delay:${(-fxRand(0, 90)).toFixed(0)}s">${f(pick(c, i))}</i>`; }
      return h;
    },
    banner() {
      let b = SBX("", SCN.sun80, "left:calc(50% - 60px);bottom:14px;--w:120");
      b += `<span class="bgrid"></span>`;
      b += SBX("bsway", SCN.palm, "left:6%;bottom:8px;--w:44") + SBX("bsway", SCN.palm, "left:13%;bottom:6px;--w:32;animation-delay:-1.2s") + SBX("bsway", SCN.palm, "left:88%;bottom:8px;--w:44;animation-delay:-.7s");
      b += SBX("bbob", SCN.cassette, "left:26%;top:8px;--w:40;animation-duration:6s");
      b += scnNum("1985", "#6be9ff", "68%", 10, 16);
      return b;
    },
  },
  library: {
    layer() {
      let h = "";
      for (let i = 0; i < 14; i++) h += `<i class="rise" style="--dx:${fxRand(-20, 20).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(3, 7).toFixed(0)}px;opacity:.3;animation-duration:${fxRand(50, 100).toFixed(0)}s;animation-delay:${(-fxRand(0, 100)).toFixed(0)}s"><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#d9a441"/></svg></i>`;
      return h;
    },
    banner() {
      let b = scnShelf(26);
      b += `<span class="bglow" style="left:calc(18% - 14px);bottom:10px;width:76px;height:50px"></span>`;
      b += SBX("", SCN.banker, "left:18%;bottom:22px;--w:30");
      b += SBX("", SCN.globe, "left:34%;bottom:22px;--w:26") + SBX("", SCN.stackBooks, "left:46%;bottom:22px;--w:32");
      b += SBX("", SCN.teacup, "left:58%;bottom:22px;--w:28") + SBX("", SCN.owl, "left:72%;bottom:22px;--w:22") + SBX("", SCN.glasses, "left:84%;bottom:22px;--w:30");
      return b;
    },
  },
  win98: {
    layer() { return ""; },
    banner() {
      const d = new Date(), t = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const icon = (svg, label, left) => `<span class="w98-icon" style="left:${left}px">${svg}<em>${label}</em></span>`;
      return icon(SCN.w98computer, "My Computer", 14) + icon(SCN.w98bin, "Recycle Bin", 100) + icon(SCN.w98folder, "Documents", 186)
        + `<span class="w98-task"><span class="w98-start"><b>&#9632;</b> Start</span><span class="w98-win">Pharmacy Portal</span><span class="w98-tray">${t}</span></span>`;
    },
  },
});

/* =====================================================================
   More general themes: Arcade, Rainforest, Tropical Island, City Skyline
   at Dusk, Desert Sunset. Generic drawn artwork only (original pixel
   creatures; no game characters).
   ===================================================================== */
const scnPix = (rows, fill) => {
  let r = "";
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    const c = typeof fill === "string" ? fill : (fill[ch] || fill.X);
    r += `<rect x="${x}" y="${y}" width="1.04" height="1.04" fill="${c}"/>`;
  }));
  return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
};
const scnCity = (fill, hMax, win, off) => {
  let x = 0, i = 0, out = "";
  while (x < 1600) {
    const w = 28 + ((i * 37 + off) % 46), h = 16 + ((i * 53 + off) % hMax);
    out += `<rect x="${x}" y="${60 - h}" width="${w}" height="${h}" fill="${fill}"/>`;
    if (i % 5 === 2) out += `<rect x="${x + w / 2 - 1}" y="${60 - h - 9}" width="2" height="9" fill="${fill}"/>`;
    if (win) for (let wy = 60 - h + 4; wy < 54; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 7) {
      const k = (wx * 7 + wy * 13 + i) % 7;
      if (k < 2) out += `<rect x="${wx}" y="${wy}" width="2.6" height="3.4" fill="#ffd98a" opacity=".85"${k === 0 && (wx + wy) % 3 === 0 ? ` class="btw" style="animation-duration:${(5 + (wx % 6)).toFixed(0)}s;animation-delay:-${(wy % 7)}s"` : ""}/>`;
    }
    x += w + (i % 3); i++;
  }
  return `<svg class="scn" viewBox="0 0 1600 60" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${out}</svg>`;
};
Object.assign(SCN, {
  slime: (c) => scnPix(["X........X", "XX......XX", ".XXXXXXXX.", "XXXXXXXXXX", "XXXWWWWXXX", "XXXWKKWXXX", "XXXWWWWXXX", "XXXXXXXXXX", ".XX.XX.XX.", "XX......XX"], { X: c, W: "#ffffff", K: "#12052a" }),
  pship: (c) => scnPix(["....X....", "...XXX...", "..XXXXX..", ".XXXXXXX.", "XXXXXXXXX", "XX.XXX.XX"], c),
  pheart: (c) => scnPix([".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."], c),
  pcoin: scnPix([".XXXX.", "XXXXXX", "XXYXXX", "XXYXXX", "XXXXXX", ".XXXX."], { X: "#ffd400", Y: "#fff3a0" }),
  vine: `<svg viewBox="0 0 16 64" aria-hidden="true"><path d="M8,0 C2,12 14,22 8,34 C2,46 12,54 8,64" stroke="#2f7a45" stroke-width="2.4" fill="none"/><ellipse cx="4.5" cy="15" rx="5" ry="2.6" fill="#3fae62" transform="rotate(-30 4.5 15)"/><ellipse cx="11.5" cy="31" rx="5" ry="2.6" fill="#4fc472" transform="rotate(30 11.5 31)"/><ellipse cx="5" cy="47" rx="5" ry="2.6" fill="#3fae62" transform="rotate(-25 5 47)"/></svg>`,
  frog: `<svg viewBox="0 0 36 28" aria-hidden="true"><ellipse cx="18" cy="18" rx="13" ry="8.5" fill="#5fc24a" stroke="#3f9a34"/><ellipse cx="18" cy="21" rx="8" ry="4.5" fill="#d4f5a8"/><circle cx="10" cy="9" r="4.6" fill="#5fc24a" stroke="#3f9a34"/><circle cx="26" cy="9" r="4.6" fill="#5fc24a" stroke="#3f9a34"/><circle cx="10" cy="9" r="3" fill="#e8403a"/><circle cx="26" cy="9" r="3" fill="#e8403a"/><rect x="9.2" y="7" width="1.6" height="4" rx=".8" fill="#12210d"/><rect x="25.2" y="7" width="1.6" height="4" rx=".8" fill="#12210d"/><path d="M4,25 q2,3 5,1 M32,25 q-2,3 -5,1" stroke="#ff9a3c" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  sloth: `<svg viewBox="0 0 44 46" aria-hidden="true"><path d="M0,6 H44" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round"/><path d="M13,6 Q10,16 17,20 M31,6 Q34,16 27,20" stroke="#8a6a4a" stroke-width="4.5" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="31" rx="11" ry="12" fill="#9c8468"/><ellipse cx="22" cy="21" rx="8.5" ry="7.5" fill="#d9c9a8"/><ellipse cx="17.8" cy="20" rx="2.6" ry="3.4" fill="#5a4630"/><ellipse cx="26.2" cy="20" rx="2.6" ry="3.4" fill="#5a4630"/><circle cx="17.8" cy="20.4" r="1" fill="#fff"/><circle cx="26.2" cy="20.4" r="1" fill="#fff"/><path d="M19.5,25.2 Q22,27.4 24.5,25.2" stroke="#5a4630" stroke-width="1.4" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="23.4" rx="1.4" ry=".9" fill="#3a2c1c"/></svg>`,
  heli: `<svg viewBox="0 0 30 46" aria-hidden="true"><path d="M15,46 V14" stroke="#2f7a45" stroke-width="2.4"/><path d="M15,34 L4,28 L15,30Z M15,22 L26,16 L15,18Z M15,14 L6,6 L15,10Z" fill="#e8402a" stroke="#ffc107" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  palmC: `<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M30,80 Q36,50 28,24" stroke="#8a5a33" stroke-width="5" fill="none" stroke-linecap="round"/><g stroke="#2f7a45" stroke-width=".8"><path d="M28,24 Q8,10 0,26 Q16,18 28,26Z" fill="#3fae62"/><path d="M28,24 Q12,2 4,6 Q18,6 28,23Z" fill="#4fc472"/><path d="M28,24 Q48,8 62,24 Q46,16 28,26Z" fill="#3fae62"/><path d="M28,24 Q44,0 56,6 Q40,6 28,23Z" fill="#4fc472"/><path d="M28,24 Q28,4 34,0 Q34,12 29,24Z" fill="#2f9a52"/></g><circle cx="26" cy="27" r="2.6" fill="#7a4a22"/><circle cx="31" cy="28" r="2.6" fill="#7a4a22"/></svg>`,
  crab: `<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M5,12 Q0,6 4,3 Q8,4 8,9 M29,12 Q34,6 30,3 Q26,4 26,9" fill="#e5533d" stroke="#b03a28"/><ellipse cx="17" cy="14" rx="11" ry="7" fill="#e5533d" stroke="#b03a28"/><path d="M8,18 l-4,3 M12,20 l-2,2 M22,20 l2,2 M26,18 l4,3" stroke="#b03a28" stroke-width="1.6" stroke-linecap="round"/><path d="M13,8 v-4 M21,8 v-4" stroke="#b03a28" stroke-width="1.4"/><circle cx="13" cy="3.5" r="2" fill="#fff"/><circle cx="21" cy="3.5" r="2" fill="#fff"/><circle cx="13" cy="3.7" r=".9" fill="#222"/><circle cx="21" cy="3.7" r=".9" fill="#222"/></svg>`,
  umbrella: `<svg viewBox="0 0 44 46" aria-hidden="true"><path d="M22,12 V44" stroke="#8a5a33" stroke-width="2.4"/><path d="M2,22 Q22,-6 42,22 Q36,18 32,22 Q27,17 22,22 Q17,17 12,22 Q8,18 2,22Z" fill="#ff6f4d"/><path d="M22,6 Q18,14 12,22 Q17,17 22,22Z M22,6 Q26,14 32,22 Q27,17 22,22Z" fill="#fff"/></svg>`,
  sandmound: `<svg viewBox="0 0 150 20" aria-hidden="true"><path d="M0,20 Q22,3 62,5 Q112,3 150,20Z" fill="#f2d9a0"/><path d="M20,17 Q60,8 110,16" stroke="#e0c07a" stroke-width="1.4" fill="none"/></svg>`,
  cactus: `<svg viewBox="0 0 30 52" aria-hidden="true"><path d="M12,52 V10 Q12,2 15,2 Q18,2 18,10 V52Z" fill="#2e6a45"/><path d="M12,32 H7 Q4,32 4,28 V18 Q4,15 7,15 Q10,15 10,18 V27 H12Z" fill="#2e6a45"/><path d="M18,24 H23 Q26,24 26,20 V12 Q26,9 23,9 Q20,9 20,12 V19 H18Z" fill="#2e6a45"/></svg>`,
  tumble: `<svg viewBox="0 0 26 26" aria-hidden="true"><g class="sails" style="transform-box:fill-box;transform-origin:50% 50%"><g fill="none" stroke="#a67c4e" stroke-width="1.5" stroke-linecap="round"><circle cx="13" cy="13" r="10.5"/><path d="M3,10 Q13,16 23,9 M4,18 Q13,8 22,17 M9,3 Q16,13 9,23 M17,3 Q10,13 17,23"/></g></g></svg>`,
  plane: `<svg viewBox="0 0 34 12" aria-hidden="true"><path d="M2,7 H28 Q33,7 33,6 Q33,5 28,5 H16 L11,1 H9 L12,5 H5 L2,3 V7Z" fill="#cfd6ee"/><circle cx="3" cy="5" r="1.4" fill="#ff5a5a" class="btw" style="animation-duration:3s"/></svg>`,
  dunesun: `<svg viewBox="0 0 80 40" aria-hidden="true"><path d="M0,40 A40,40 0 0 1 80,40Z" fill="#ffd27a"/><path d="M12,40 A28,28 0 0 1 68,40Z" fill="#ffe7a8"/></svg>`,
  joy: `<svg viewBox="0 0 28 34" aria-hidden="true"><rect x="2" y="24" width="24" height="8" rx="2" fill="#35307a" stroke="#6a62d6"/><path d="M14,24 V12" stroke="#c9c9e8" stroke-width="3"/><circle cx="14" cy="9" r="6" fill="#ff4d6d" stroke="#b8304a"/></svg>`,
});

Object.assign(THEME_SCENES, {
  arcade: {
    layer() {
      let h = ""; const c = ["#ff4d9a", "#00e0ff", "#ffd400", "#7dff7a"];
      for (let i = 0; i < 16; i++) h += `<i class="rise" style="--dx:${fxRand(-30, 30).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(8, 16).toFixed(0)}px;opacity:.32;animation-duration:${fxRand(45, 95).toFixed(0)}s;animation-delay:${(-fxRand(0, 95)).toFixed(0)}s"><svg viewBox="0 0 10 10" shape-rendering="crispEdges"><rect width="10" height="10" fill="${pick(c, i)}"/></svg></i>`;
      return h;
    },
    banner() {
      let b = scnNum("1UP", "#ff4d6d", "3%", 5, 11) + scnNum("000260", "#fff", "3%", 19, 11);
      b += scnNum("HI-SCORE", "#ffd400", "40%", 5, 11) + scnNum("042690", "#fff", "41%", 19, 11);
      b += `<span class="bnum btw" style="left:80%;top:12px;color:#5cffc8;font-size:12px;animation-duration:2.6s">INSERT COIN</span>`;
      for (let i = 0; i < 5; i++) b += SBX("bbob", SCN.slime(pick(["#ff4d9a", "#00e0ff", "#7dff7a", "#b58bff", "#ffd400"], i)), `left:${(14 + i * 12)}%;bottom:8px;--w:22;animation-duration:${(3 + i * .4).toFixed(1)}s;animation-delay:${(-i * .6).toFixed(1)}s`);
      b += SBX("bcross", SCN.pship("#5cffc8"), "left:0;bottom:8px;--w:20;--still:76%;animation-duration:60s");
      for (let i = 0; i < 3; i++) b += SBX("", SCN.pheart("#ff4d6d"), `left:${(88 + i * 3.6)}%;bottom:8px;--w:10`);
      b += SBX("bbob", SCN.pcoin, "left:30%;top:6px;--w:12;animation-duration:2.4s");
      return b;
    },
  },
  rainforest: {
    layer() {
      let h = "";
      for (let i = 0; i < 20; i++) h += `<i class="fall" style="left:${fxRand(0, 99).toFixed(1)}%;width:4px;animation-duration:${fxRand(1.8, 3.2).toFixed(1)}s,${fxRand(3, 5).toFixed(1)}s;animation-delay:${(-fxRand(0, 3)).toFixed(1)}s,${(-fxRand(0, 5)).toFixed(1)}s;--sway:6px;opacity:.3">${SCN.drop}</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#0b3d24;height:6px"></span>`;
      b += SBX("bsway", SCN.monstera, "left:1%;bottom:4px;--w:46") + SBX("bsway", SCN.fern, "left:9%;bottom:4px;--w:30;animation-delay:-.8s") + SBX("bsway", SCN.monstera, "left:93%;bottom:4px;--w:44;animation-delay:-1.6s");
      b += SBX("bsway", SCN.heli, "left:17%;bottom:4px;--w:20;animation-delay:-.4s") + SBX("bsway", SCN.flower("#e07bd8", "#ffe08a"), "left:78%;bottom:4px;--w:22") + SBX("bsway", SCN.heli, "left:85%;bottom:4px;--w:18;animation-delay:-1.2s");
      for (let i = 0; i < 7; i++) b += SBX("bhang", SCN.vine, `left:${(6 + i * 14.5).toFixed(0)}%;top:0;--w:${(14 + (i % 3) * 3)};animation-delay:${(-i * .9).toFixed(1)}s`);
      b += SBX("bhang", SCN.sloth, "left:56%;top:0;--w:40;animation-duration:7s");
      b += SBX("bbob", SCN.frog, "left:32%;bottom:6px;--w:30;animation-duration:6s");
      return b;
    },
  },
  tropical: {
    layer() {
      const cols = ["#ff8fab", "#ffb3c7", "#ffd54a", "#ff9a76"]; let h = "";
      for (let i = 0; i < 12; i++) h += `<i class="fall" style="left:${fxRand(0, 98).toFixed(1)}%;width:${fxRand(9, 15).toFixed(0)}px;animation-duration:${fxRand(16, 28).toFixed(1)}s,${fxRand(4, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 28)).toFixed(1)}s,${(-fxRand(0, 6)).toFixed(1)}s;--sway:${fxRand(20, 60).toFixed(0)}px;opacity:.65">${SCN.leaf(pick(cols, i))}</i>`;
      return h;
    },
    banner() {
      let b = SBX("bsun", SCN.sun, "left:84%;top:2px;--w:34");
      for (let i = 0; i < 2; i++) b += SBX("bcross", SCN.cloud, `left:0;top:${4 + i * 10}px;--w:${46 - i * 10};--still:${22 + i * 40}%;opacity:.9;animation-duration:${(58 + i * 22)}s;animation-delay:${(-i * 26)}s`);
      b += scnWaves("#2fc4d8", .85, "wvA", 3, 20) + scnWaves("#12a0b3", .95, "wvB", 3, 28);
      b += SBX("", SCN.sandmound, "left:2%;bottom:4px;--w:150") + SBX("", SCN.sandmound, "left:78%;bottom:3px;--w:96");
      b += SBX("bsway", SCN.palmC, "left:6%;bottom:12px;--w:44") + SBX("bsway", SCN.palmC, "left:15%;bottom:11px;--w:32;animation-delay:-1.1s") + SBX("bsway", SCN.palmC, "left:86%;bottom:10px;--w:36;animation-delay:-.6s");
      b += SBX("", SCN.umbrella, "left:25%;bottom:10px;--w:26") + SBX("bbob", SCN.crab, "left:90%;bottom:5px;--w:20;animation-duration:3s");
      b += SBX("bbob", SCN.sailboat, "left:55%;bottom:14px;--w:34;animation-duration:5s");
      return b;
    },
  },
  skyline: {
    layer() {
      let h = "";
      for (let i = 0; i < 14; i++) h += `<i class="twk" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(2, 90).toFixed(1)}%;font-size:${fxRand(5, 10).toFixed(0)}px;color:${pick(["#ffffff", "#ffe2c2"], i)};animation-duration:${fxRand(4, 8).toFixed(1)}s;animation-delay:${(-fxRand(0, 8)).toFixed(1)}s">&#8226;</i>`;
      return h;
    },
    banner() {
      let b = "";
      for (let i = 0; i < 8; i++) b += `<i class="twk" style="position:absolute;left:${fxRand(2, 96).toFixed(0)}%;top:${fxRand(3, 20).toFixed(0)}px;font-size:7px;color:#fff;animation-duration:${fxRand(3, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#8226;</i>`;
      b += SBX("btw", SCN.moon, "left:8%;top:4px;--w:22");
      b += SBX("bcross", SCN.plane, "left:0;top:9px;--w:34;--still:62%;opacity:.9;animation-duration:95s");
      b += scnCity("#3a2a78", 26, false, 11) + scnCity("#120a2a", 30, true, 0);
      for (let i = 0; i < 4; i++) b += SBX("bcross", `<svg viewBox="0 0 14 4" aria-hidden="true"><circle cx="2" cy="2" r="1.6" fill="#fff6c0"/><circle cx="12" cy="2" r="1.6" fill="#ff5a5a"/></svg>`, `left:0;bottom:1px;--w:12;--still:${(10 + i * 24)}%;animation-duration:${(32 + i * 11)}s;animation-delay:${(-i * 13)}s`);
      return b;
    },
  },
  desert: {
    layer() {
      let h = "";
      for (let i = 0; i < 12; i++) h += `<i class="rise" style="--dx:${fxRand(-60, 60).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${fxRand(3, 6).toFixed(0)}px;opacity:.35;animation-duration:${fxRand(40, 85).toFixed(0)}s;animation-delay:${(-fxRand(0, 85)).toFixed(0)}s"><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.5" fill="#d9a05b"/></svg></i>`;
      return h;
    },
    banner() {
      let b = SBX("", SCN.dunesun, "left:62%;bottom:16px;--w:80");
      b += `<svg class="scn" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0,60 V34 L60,32 L74,20 L150,20 L164,32 L260,34 V60Z M520,60 V30 L560,28 L572,14 L640,14 L652,28 L720,30 V60Z M900,60 V36 L950,34 L962,24 L1030,24 L1044,34 L1100,36 V60Z" fill="#8a3f4f" opacity=".7"/>${scnRidge("#d98a4a", 42, 5, 0.4, 1.4)}${scnRidge("#b96a35", 48, 5, 2.4, 1.9)}${scnRidge("#8f4d26", 54, 4, 4.3, 2.5)}</svg>`;
      b += SBX("", SCN.cactus, "left:8%;bottom:6px;--w:20") + SBX("", SCN.cactus, "left:14%;bottom:5px;--w:14") + SBX("", SCN.cactus, "left:84%;bottom:6px;--w:22") + SBX("", SCN.cactus, "left:49%;bottom:5px;--w:12");
      b += SBX("bcross", SCN.tumble, "left:0;bottom:4px;--w:16;--still:30%;animation-duration:42s");
      return b;
    },
  },
});

/* =====================================================================
   Space Conflict: an original space-opera look (two fleets trading slow
   laser fire in front of a gas giant). All ships/planets are original.
   ===================================================================== */
Object.assign(SCN, {
  dart: (c1, c2, flip) => `<svg viewBox="0 0 38 20" aria-hidden="true"><g${flip ? ' transform="matrix(-1 0 0 1 38 0)"' : ""}><path d="M36,10 L9,1 L15,10 L9,19Z" fill="${c1}" stroke="rgba(255,255,255,.35)" stroke-width=".8" stroke-linejoin="round"/><path d="M36,10 L19,6.5 L22,10 L19,13.5Z" fill="rgba(255,255,255,.28)"/><circle cx="24" cy="10" r="1.7" fill="#bfe6ff"/><circle cx="5" cy="10" r="3.2" fill="${c2}" opacity=".9"/></g></svg>`,
  frigate: (c1, c2, flip) => `<svg viewBox="0 0 76 26" aria-hidden="true"><g${flip ? ' transform="matrix(-1 0 0 1 76 0)"' : ""}><path d="M4,7 H52 L74,13 L52,19 H4Z" fill="${c1}" stroke="rgba(255,255,255,.3)" stroke-width=".8" stroke-linejoin="round"/><rect x="16" y="2" width="18" height="6" rx="1.5" fill="${c1}" stroke="rgba(255,255,255,.3)" stroke-width=".8"/><rect x="21" y="3.4" width="8" height="2" fill="#bfe6ff"/><path d="M10,10 H46 M10,14 H46" stroke="rgba(255,255,255,.22)" stroke-width="1"/><rect x="0" y="8" width="5" height="3.4" fill="${c2}"/><rect x="0" y="14.4" width="5" height="3.4" fill="${c2}"/></g></svg>`,
  freighter: `<svg viewBox="0 0 70 18" aria-hidden="true"><path d="M2,5 H52 V13 H2Z" fill="#7d8aa6" stroke="rgba(255,255,255,.3)" stroke-width=".8"/><path d="M52,7 L68,9 L52,11Z" fill="#9fb0cc"/><rect x="10" y="2" width="9" height="3" fill="#6a7690"/><rect x="26" y="13" width="14" height="3" fill="#6a7690"/><rect x="0" y="6.4" width="3" height="5" fill="#ffb020"/></svg>`,
  bolt: (c) => `<svg viewBox="0 0 16 4" aria-hidden="true"><rect y=".8" width="16" height="2.4" rx="1.2" fill="${c}"/></svg>`,
  giant: `<svg viewBox="0 0 80 52" aria-hidden="true"><defs><clipPath id="gcl"><circle cx="40" cy="26" r="20"/></clipPath></defs><g transform="rotate(-14 40 26)"><ellipse cx="40" cy="26" rx="38" ry="6.5" fill="none" stroke="#8fb4e8" stroke-width="2.4" opacity=".55"/></g><circle cx="40" cy="26" r="20" fill="#5b6fd6"/><g clip-path="url(#gcl)"><rect x="18" y="12" width="44" height="5" fill="#7d90f0" opacity=".7"/><rect x="18" y="22" width="44" height="6" fill="#3f4fb0" opacity=".7"/><rect x="18" y="33" width="44" height="5" fill="#8fa2f5" opacity=".6"/><circle cx="52" cy="30" r="5" fill="#ffb020" opacity=".55"/></g><g transform="rotate(-14 40 26)"><path d="M2,26 A38,6.5 0 0 0 78,26" fill="none" stroke="#bcd3f5" stroke-width="2.6" opacity=".8"/></g></svg>`,
  cmoon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#9aa3b5"/><circle cx="8" cy="9" r="2.6" fill="#7d8698"/><circle cx="16" cy="15" r="3" fill="#7d8698"/><circle cx="14" cy="6.5" r="1.6" fill="#7d8698"/></svg>`,
});
Object.assign(THEME_SCENES, {
  spaceconflict: {
    layer() {
      let h = "";
      for (let i = 0; i < 36; i++) h += `<i class="twk" style="left:${fxRand(1, 98).toFixed(1)}%;top:${fxRand(2, 96).toFixed(1)}%;font-size:${fxRand(5, 13).toFixed(0)}px;color:${pick(["#ffffff", "#bfe6ff", "#ffd9a0"], i)};animation-duration:${fxRand(3, 7).toFixed(1)}s;animation-delay:${(-fxRand(0, 7)).toFixed(1)}s">${i % 6 === 5 ? "&#10022;" : "&#8226;"}</i>`;
      h += `<i class="shoot" style="top:12%;left:20%;animation-delay:-4s"></i>`;
      h += `<span class="xing" style="top:24%;animation-duration:110s;animation-delay:-40s;--w:70;opacity:.28">${SCN.freighter}</span>`;
      return h;
    },
    banner() {
      const blue = "#4aa8ff", amber = "#ffb020";
      let b = `<span class="bglow" style="left:36%;top:2px;width:30%;height:56px;background:radial-gradient(ellipse,rgba(120,90,220,.45),transparent 70%)"></span>`;
      for (let i = 0; i < 14; i++) b += `<i class="twk" style="position:absolute;left:${fxRand(1, 98).toFixed(0)}%;top:${fxRand(3, 54).toFixed(0)}px;font-size:7px;color:#fff;animation-duration:${fxRand(3, 6).toFixed(1)}s;animation-delay:${(-fxRand(0, 6)).toFixed(1)}s">&#8226;</i>`;
      b += SBX("bbob", SCN.giant, "left:46%;top:4px;--w:78;animation-duration:9s") + SBX("btw", SCN.cmoon, "left:62%;top:30px;--w:12");
      b += SBX("bbob", SCN.frigate("#35588c", blue, false), "left:3%;top:20px;--w:70;animation-duration:7s");
      b += SBX("bbob", SCN.dart("#3f6fb8", blue, false), "left:20%;top:8px;--w:34;animation-duration:5s") + SBX("bbob", SCN.dart("#3f6fb8", blue, false), "left:22%;top:34px;--w:30;animation-duration:6s;animation-delay:-2s");
      b += SBX("bbob", SCN.frigate("#8c5a2a", amber, true), "left:84%;top:22px;--w:66;animation-duration:8s;animation-delay:-3s");
      b += SBX("bbob", SCN.dart("#b8762f", amber, true), "left:74%;top:10px;--w:32;animation-duration:5.5s;animation-delay:-1s") + SBX("bbob", SCN.dart("#b8762f", amber, true), "left:72%;top:36px;--w:28;animation-duration:6.5s");
      for (let i = 0; i < 3; i++) b += SBX("bcross", SCN.bolt(blue), `left:0;top:${(18 + i * 13)}px;--w:14;--still:${(34 + i * 6)}%;filter:drop-shadow(0 0 3px ${blue});animation-duration:${(9 + i * 2)}s;animation-delay:${(-i * 3.4)}s`);
      for (let i = 0; i < 3; i++) b += SBX("bcross rev", SCN.bolt(amber), `left:0;top:${(24 + i * 11)}px;--w:14;--still:${(52 + i * 5)}%;filter:drop-shadow(0 0 3px ${amber});animation-duration:${(10 + i * 2)}s;animation-delay:${(-i * 3.9)}s`);
      return b;
    },
  },
});

/* ED&G ADP (Advanced Development Programme): generic intelligence-agency look
   (manila files, TOP SECRET stamps, redacted pages, world-map tracking, satellite). No real agency seal or logo. */
Object.assign(SCN, {
  folder: `<svg viewBox="0 0 52 38" aria-hidden="true"><path d="M2,6 a3,3 0 0 1 3,-3 H18 l4,4 H47 a3,3 0 0 1 3,3 V34 a3,3 0 0 1 -3,3 H5 a3,3 0 0 1 -3,-3Z" fill="#c9a96a" stroke="#8a6d32" stroke-width="1.2"/><rect x="2" y="12" width="48" height="25" rx="3" fill="#dcc08a" stroke="#8a6d32" stroke-width="1.2"/><rect x="8" y="18" width="20" height="3" fill="#7a5c25"/><rect x="8" y="24" width="30" height="2" fill="#7a5c25" opacity=".6"/><text x="40" y="33" text-anchor="middle" font-family="Courier New,monospace" font-weight="700" font-size="7" fill="#b3261e">TS</text></svg>`,
  doc: `<svg viewBox="0 0 34 44" aria-hidden="true"><path d="M2,2 H24 L32,10 V42 H2Z" fill="#efe6cf" stroke="#8a6d32" stroke-width="1.2"/><path d="M24,2 V10 H32" fill="#d9ccaa" stroke="#8a6d32" stroke-width="1"/><rect x="6" y="14" width="22" height="4" fill="#111"/><rect x="6" y="21" width="15" height="4" fill="#111"/><rect x="6" y="28" width="22" height="4" fill="#111"/><rect x="6" y="35" width="10" height="3" fill="#111"/></svg>`,
  stamp: (t, c, w = 130) => `<svg viewBox="0 0 ${w} 30" aria-hidden="true"><rect x="2" y="2" width="${w - 4}" height="26" rx="2" fill="none" stroke="${c}" stroke-width="2.6"/><text x="${w / 2}" y="21" text-anchor="middle" font-family="Courier New,monospace" font-weight="700" font-size="12" letter-spacing="1" fill="${c}">${t}</text></svg>`,
  redact: (w) => `<svg viewBox="0 0 ${w} 8" aria-hidden="true"><rect width="${w}" height="8" fill="#000"/></svg>`,
  worldmap: () => {
    const rows = ["....oooo...ooooo.......", "..ooooooo.ooooooooo....", ".oooooo...ooooooooooo..", "..oooo.....oooooooo....", "...ooo......ooooo......", "....oo.......oo........"];
    let d = "";
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "o") d += `<circle cx="${x * 4 + 2}" cy="${y * 4 + 2}" r="1.2"/>`; }));
    return `<svg viewBox="0 0 92 26" aria-hidden="true"><g fill="#4f7aa8" opacity=".85">${d}</g><circle cx="26" cy="9" r="2.4" fill="none" stroke="#e23b34" stroke-width="1"><animate attributeName="r" values="2;6;2" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="3s" repeatCount="indefinite"/></circle><circle cx="26" cy="9" r="1.6" fill="#e23b34"/><circle cx="62" cy="13" r="1.6" fill="#e23b34"/><circle cx="74" cy="7" r="1.6" fill="#e23b34"/><path d="M26,9 L62,13 L74,7" fill="none" stroke="#e23b34" stroke-width=".7" stroke-dasharray="2 2" opacity=".8"/></svg>`;
  },
  cam: `<svg viewBox="0 0 40 26" aria-hidden="true"><rect x="2" y="4" width="26" height="12" rx="2" fill="#3a4658" stroke="#8aa0bf" stroke-width="1"/><circle cx="26" cy="10" r="4.5" fill="#0d1420" stroke="#8aa0bf" stroke-width="1"/><circle cx="26" cy="10" r="1.6" fill="#e23b34"/><path d="M12,16 V22 H20" fill="none" stroke="#8aa0bf" stroke-width="2"/></svg>`,
  lens: `<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="13" cy="13" r="9" fill="rgba(160,200,255,.12)" stroke="#c9a96a" stroke-width="2.6"/><path d="M20,20 L31,31" stroke="#c9a96a" stroke-width="4" stroke-linecap="round"/><path d="M8,10 a6,6 0 0 1 5,-3" fill="none" stroke="#fff" stroke-width="1.4" opacity=".6"/></svg>`,
});
Object.assign(THEME_SCENES, {
  edgadp: {
    layer() {
      let h = "";
      for (let i = 0; i < 7; i++) h += `<i class="rise" style="left:${fxRand(3, 94).toFixed(1)}%;width:${fxRand(30, 44).toFixed(0)}px;opacity:.22;text-shadow:none;animation-duration:${fxRand(70, 110).toFixed(0)}s;animation-delay:${(-fxRand(0, 100)).toFixed(0)}s;--dx:${fxRand(-40, 40).toFixed(0)}px">${SCN.doc}</i>`;
      const co = ["51.5074 N  0.1278 W", "38.9072 N  77.0369 W", "48.8566 N  2.3522 E", "35.6762 N  139.6503 E", "33.3152 N  44.3661 E", "55.7558 N  37.6173 E"];
      for (let i = 0; i < 6; i++) h += `<i class="rise" style="left:${fxRand(2, 88).toFixed(1)}%;font:600 11px 'Courier New',monospace;color:#c9a96a;opacity:.3;text-shadow:none;animation-duration:${fxRand(60, 100).toFixed(0)}s;animation-delay:${(-fxRand(0, 90)).toFixed(0)}s;--dx:0px">${co[i]}</i>`;
      return h;
    },
    banner() {
      let b = `<span class="bscan"></span>`;
      b += SBX("bbob", SCN.folder, "left:3%;top:10px;--w:46;animation-duration:8s") + SBX("bbob", SCN.doc, "left:10%;top:6px;--w:30;animation-duration:7s;animation-delay:-2s");
      b += SBX("btw", SCN.stamp("TOP SECRET", "#e23b34"), "left:19%;top:14px;--w:128;transform:rotate(-5deg)");
      b += SBX("", SCN.worldmap(), "left:38%;top:12px;--w:130");
      b += SBX("bbob", SCN.lens, "left:56%;top:12px;--w:34;animation-duration:5s");
      b += SBX("bsway", SCN.cam, "left:64%;top:6px;--w:42");
      b += SBX("", SCN.redact(86), "left:74%;top:8px;--w:80") + SBX("", SCN.redact(50), "left:74%;top:20px;--w:46") + SBX("", SCN.redact(70), "left:86%;top:14px;--w:64");
      b += SBX("btw", SCN.stamp("RESTRICTED ACCESS", "#c9a96a", 190), "left:78%;top:26px;--w:150;transform:rotate(-3deg)");
      return b;
    },
  },
});

/* Fish Zoo: a bright aquarium (original drawn fish, coral, castle and treasure chest). */
Object.assign(SCN, {
  clown: `<svg viewBox="0 0 40 24" aria-hidden="true"><g transform="matrix(-1 0 0 1 40 0)"><path d="M2,12 C9,1 25,1 31,12 C25,23 9,23 2,12Z" fill="#ff7a1a" stroke="#fff" stroke-width=".6"/><path d="M30,12 L40,4 V20Z" fill="#ff7a1a"/><path d="M12,3 Q9,12 12,21 M22,3.5 Q19,12 22,20.5" stroke="#fff" stroke-width="3" fill="none"/><path d="M13,2 Q18,-1 24,2.5" stroke="#ff7a1a" stroke-width="2" fill="none"/><circle cx="7" cy="10" r="1.9" fill="#fff"/><circle cx="7" cy="10" r=".8" fill="#123"/></g></svg>`,
  angel: (c) => `<svg viewBox="0 0 34 40" aria-hidden="true"><g transform="matrix(-1 0 0 1 34 0)"><path d="M3,20 C8,8 20,8 26,20 C20,32 8,32 3,20Z" fill="${c}"/><path d="M16,10 L22,0 L24,12Z M16,30 L22,40 L24,28Z" fill="${c}" opacity=".85"/><path d="M26,20 L34,12 V28Z" fill="${c}"/><path d="M13,11 V29 M18,10 V30" stroke="rgba(0,40,70,.35)" stroke-width="2"/><circle cx="8" cy="18" r="1.7" fill="#fff"/><circle cx="8" cy="18" r=".7" fill="#123"/></g></svg>`,
  puffer: `<svg viewBox="0 0 34 28" aria-hidden="true"><g transform="matrix(-1 0 0 1 34 0)"><circle cx="16" cy="14" r="11" fill="#f2d06b"/><path d="M8,20 Q16,28 24,20 Q16,24 8,20Z" fill="#fff6d0"/><path d="M26,14 L33,8 V20Z" fill="#e2b948"/><path d="M12,5 l-1,-4 M17,3 l0,-3 M22,5 l1,-4 M8,9 l-3,-2 M25,10 l3,-2" stroke="#e2b948" stroke-width="1.4"/><circle cx="9" cy="11" r="2.4" fill="#fff"/><circle cx="8.6" cy="11" r="1.1" fill="#123"/><path d="M5,17 q2,2 4,0" stroke="#c0902a" stroke-width="1.2" fill="none"/></g></svg>`,
  star5: (c) => `<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15,2 L18.6,11 L28,11.6 L20.8,17.8 L23,27.4 L15,22.2 L7,27.4 L9.2,17.8 L2,11.6 L11.4,11Z" fill="${c}" stroke="rgba(0,0,0,.15)" stroke-width="1" stroke-linejoin="round"/><circle cx="15" cy="14" r="1.2" fill="rgba(255,255,255,.6)"/><circle cx="10" cy="12" r=".8" fill="rgba(255,255,255,.5)"/><circle cx="20" cy="12" r=".8" fill="rgba(255,255,255,.5)"/></svg>`,
  coral: (c) => `<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20,46 V26 M20,34 L8,22 V10 M20,28 L32,18 V6 M8,22 L4,16 M32,18 L37,12" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="9" r="3.4" fill="${c}"/><circle cx="32" cy="5" r="3.4" fill="${c}"/><circle cx="4" cy="15" r="2.4" fill="${c}"/><circle cx="37" cy="11" r="2.4" fill="${c}"/></svg>`,
  tankcastle: `<svg viewBox="0 0 70 56" aria-hidden="true"><path d="M4,54 V22 H12 V16 H18 V22 H24 V54Z M46,54 V22 H52 V16 H58 V22 H66 V54Z M24,54 V30 H46 V54Z" fill="#b69cdd" stroke="#6f55a8" stroke-width="1.4"/><path d="M4,22 L8,8 L12,22 M46,22 L52,6 L58,22" fill="#7d62bf" stroke="#6f55a8" stroke-width="1.2"/><path d="M24,54 V42 a11,11 0 0 1 22,0 V54Z" fill="#2a1f4d"/><rect x="28" y="22" width="14" height="8" fill="#b69cdd" stroke="#6f55a8" stroke-width="1.2"/><path d="M32,22 V16 M38,22 V14 L44,17 L38,19" stroke="#6f55a8" fill="#ff5c7a" stroke-width="1.2"/></svg>`,
  chest: `<svg viewBox="0 0 44 34" aria-hidden="true"><path d="M3,14 a19,12 0 0 1 38,0Z" fill="#a8672a" stroke="#5e3612" stroke-width="1.4"/><rect x="3" y="14" width="38" height="18" rx="2" fill="#8a5220" stroke="#5e3612" stroke-width="1.4"/><rect x="3" y="14" width="38" height="4" fill="#f3c640" stroke="#5e3612" stroke-width="1"/><rect x="19" y="16" width="6" height="8" rx="1" fill="#f3c640" stroke="#5e3612" stroke-width="1"/><circle cx="22" cy="20" r="1.2" fill="#5e3612"/><circle cx="12" cy="12" r="2" fill="#f3c640"/><circle cx="19" cy="9" r="2" fill="#f3c640"/><circle cx="28" cy="10" r="2" fill="#f3c640"/></svg>`,
});
Object.assign(THEME_SCENES, {
  fishzoo: {
    layer() {
      let h = "";
      for (let i = 0; i < 16; i++) { const w = fxRand(8, 22).toFixed(0); h += `<i class="rise" style="--dx:${fxRand(-30, 30).toFixed(0)}px;left:${fxRand(2, 97).toFixed(1)}%;width:${w}px;opacity:.5;text-shadow:none;animation-duration:${fxRand(26, 52).toFixed(0)}s;animation-delay:${(-fxRand(0, 52)).toFixed(0)}s"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="rgba(120,220,240,.18)" stroke="rgba(60,170,200,.7)" stroke-width="1"/><circle cx="4" cy="4" r="1.2" fill="rgba(255,255,255,.8)"/></svg></i>`; }
      const f = [SCN.clown, SCN.angel("#ffd23f"), SCN.fish("#ff7ab6"), SCN.puffer];
      for (let i = 0; i < 4; i++) h += `<span class="xing" style="top:${(14 + i * 21)}%;animation-duration:${(70 + i * 20)}s;animation-delay:${(-i * 24)}s;--w:${46 + (i % 2) * 14};opacity:.32">${f[i]}</span>`;
      return h;
    },
    banner() {
      let b = `<span class="bgrd" style="background:#e8cf93;height:7px"></span>`;
      b += SBX("bsway", SCN.coral("#ff6f91"), "left:3%;bottom:5px;--w:34") + SBX("bsway", SCN.coral("#ff9a3c"), "left:90%;bottom:5px;--w:36;animation-delay:-1.4s");
      b += SBX("", SCN.tankcastle, "left:12%;bottom:5px;--w:58") + SBX("", SCN.chest, "left:78%;bottom:5px;--w:42");
      for (let i = 0; i < 6; i++) b += SBX("bsway", SCN.weed(pick(["#2f9a6a", "#3fb27a", "#238a5c"], i)), `left:${(34 + i * 7.5).toFixed(0)}%;bottom:5px;--w:${(11 + (i % 3) * 4)};animation-delay:${(-i * .7).toFixed(1)}s`);
      b += SBX("", SCN.star5("#ff7a59"), "left:28%;bottom:4px;--w:20") + SBX("", SCN.star5("#ffb347"), "left:70%;bottom:4px;--w:16;transform:rotate(18deg)");
      const f = [SCN.clown, SCN.angel("#ffd23f"), SCN.fish("#ff7ab6"), SCN.puffer, SCN.angel("#7fa8ff"), SCN.fish("#ffd166"), SCN.clown];
      for (let i = 0; i < 7; i++) b += SBX("bcross", f[i], `left:0;top:${6 + (i % 3) * 12}px;--w:${(24 + (i % 3) * 4)};--still:${(6 + i * 13)}%;animation-duration:${(30 + i * 6)}s;animation-delay:${(-i * 7)}s`);
      b += SBX("bbob", SCN.jelly("#ff9ad5"), "left:54%;top:4px;--w:22;animation-duration:7s");
      for (let i = 0; i < 10; i++) b += `<i class="bubble" style="left:${fxRand(3, 96).toFixed(0)}%;animation-duration:${fxRand(4, 8).toFixed(1)}s;animation-delay:${(-fxRand(0, 8)).toFixed(1)}s;border-color:rgba(255,255,255,.8)"></i>`;
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

// Topbar theme picker. Locked people see it greyed out with the reason;
// otherwise it lists every theme open to everyone, plus their current
// theme (so it always displays correctly), or everything for a Developer.
function themePickerHtml(profile) {
  const dev = profile.role === "developer";
  const locked = !!profile.theme_locked && !dev;
  const keys = Object.keys(THEMES).filter(k => dev || k === profile.theme || !THEME_RESTRICTED.has(k));
  if (!locked && keys.length <= 1) return "";
  const opts = keys.map(k => `<option value="${k}"${profile.theme === k ? " selected" : ""}>${THEMES[k]}</option>`).join("");
  return `<select id="themeSelectOwn" class="mode-select" data-current="${profile.theme}" aria-label="Theme"${locked ? ' disabled title="Your theme has been locked by an administrator"' : ' title="Choose your theme"'}>${opts}</select>`;
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
  await loadThemeRestrictions();
  applyTheme(effectiveTheme(profile));
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
  if (isTechnicianRole(profile) && !VIEWER_PAGES.includes(window.location.pathname.split("/").pop())) {
    window.location.href = "portal.html";
    return null;
  }
  renderTopbar(profile);
  return profile;
}

function isLeadPlus(profile) { return ["lead_pharmacist", "superuser", "developer"].includes(profile.role); }
function isSuperuserPlus(profile) { return ["superuser", "developer"].includes(profile.role); }
function isDeveloper(profile) { return profile.role === "developer"; }
// Two limited roles. "technician" sees ONLY the Huddle Board and Quick Links;
// "senior_technician" can also post on the Huddle Board and view the on-call
// rota (read-only). Neither sees the leave calendar. Neither takes leave or sits in the on-call pool.
function isTechnicianRole(profile) { return profile.role === "technician"; }
function isReadOnlyRole(profile) { return profile.role === "technician" || profile.role === "senior_technician"; }
function canPostHuddle(profile) { return ["lead_pharmacist", "superuser", "developer", "senior_technician"].includes(profile.role); }
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
  if (isTechnicianRole(profile)) {
    // Technician: only Home, Huddle Board and Quick Links.
    for (let i = links.length - 1; i >= 0; i--) if (["calendar.html", "oncall.html"].includes(links[i][0])) links.splice(i, 1);
  } else if (profile.role === "senior_technician") {
    // Huddle Board, Quick Links and the on-call rota — no leave calendar.
    for (let i = links.length - 1; i >= 0; i--) if (links[i][0] === "calendar.html") links.splice(i, 1);
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
      <div>Pharmacy Portal<small><a href="https://home.edandg.com/" target="_blank" rel="noopener noreferrer" class="brand-edg" title="ED&amp;G — home.edandg.com">by ED&amp;G&trade;</a></small></div>
    </div>
    <div class="nav">${links.map(([href,label,active]) =>
      `<a href="${href}" class="${active?'active':''}">${label}</a>`).join("")}</div>
    <div class="userbox">
      <button type="button" id="animToggle" class="anim-toggle" title="Stop or start the seasonal animations"></button>
      ${themePickerHtml(profile)}
      <select id="colorModeSelect" class="mode-select" aria-label="Display mode">${modeOptions}</select>
      <span>${escapeHtml(profile.full_name)} (${escapeHtml(profile.initials)}) &middot; ${ROLE_LABEL[profile.role]}</span>
      <button onclick="signOut()">Sign out</button>
    </div>`;
  document.getElementById("colorModeSelect").addEventListener("change", (e) => setOwnColorMode(e.target.value));
  const ownThemeSel = document.getElementById("themeSelectOwn");
  if (ownThemeSel) ownThemeSel.addEventListener("change", (e) => setOwnTheme(e.target.value));
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

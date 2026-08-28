/* =====================================================================
   Leave Management — shared.js
   GD&G Special Projects

   Fill in SUPABASE_URL / SUPABASE_ANON_KEY below before deploying.
   ===================================================================== */

const SUPABASE_URL = "https://otbdyjvfavghytznxzfd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9yzKRyJmB032pbBUcuTNHg_H0Lezdxf";
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEAVE_TYPE_LABEL = {
  full_day: "Full Day",
  half_day_am: "Half Day (AM)",
  half_day_pm: "Half Day (PM)",
  study_leave: "Study Leave",
};

const ROLE_LABEL = {
  pharmacist: "Pharmacist",
  lead_pharmacist: "Lead Pharmacist",
  superuser: "Clinical Team Lead",
  developer: "Developer",
};

const SITE_LABEL = {
  worthing: "Worthing",
  st_richards: "St Richard's",
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ---------------- logo ---------------- */
function gdgLogoSvg(size = 28) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="18" rx="9" ry="7" fill="#ffffff" opacity="0.85" transform="rotate(-25 20 18)"/>
    <ellipse cx="44" cy="18" rx="9" ry="7" fill="#ffffff" opacity="0.85" transform="rotate(25 44 18)"/>
    <path d="M18 26c0-4 6-7 14-7s14 3 14 7-3 26-14 26-14-22-14-26z" fill="#f5b400" stroke="#1a2744" stroke-width="2"/>
    <path d="M19 30c2 2 24 2 26 0M18 38c3 2 25 2 28 0M20 46c2 2 20 2 24 0" stroke="#1a2744" stroke-width="3" stroke-linecap="round" fill="none"/>
    <line x1="27" y1="12" x2="24" y2="6" stroke="#1a2744" stroke-width="2" stroke-linecap="round"/>
    <line x1="37" y1="12" x2="40" y2="6" stroke="#1a2744" stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="6" r="1.6" fill="#1a2744"/>
    <circle cx="40" cy="6" r="1.6" fill="#1a2744"/>
  </svg>`;
}

/* ---------------- session / auth ---------------- */
async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return null;
  return data;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = "login.html";
}

/** Call at the top of every protected page. Redirects if not logged in,
 *  not active, needs a password reset, or lacks an allowed role. */
async function requireAuth(allowedRoles) {
  const session = await getSession();
  if (!session) { window.location.href = "login.html"; return null; }

  const profile = await getCurrentProfile();
  if (!profile || !profile.active) {
    await sb.auth.signOut();
    window.location.href = "login.html?err=inactive";
    return null;
  }
  if (profile.must_reset_password && !window.location.pathname.endsWith("reset-password.html")) {
    window.location.href = "reset-password.html";
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    window.location.href = "calendar.html";
    return null;
  }
  renderTopbar(profile);
  return profile;
}

function isLeadPlus(profile) { return ["lead_pharmacist", "superuser", "developer"].includes(profile.role); }
function isSuperuserPlus(profile) { return ["superuser", "developer"].includes(profile.role); }
function isDeveloper(profile) { return profile.role === "developer"; }

/* ---------------- topbar ---------------- */
function renderTopbar(profile) {
  const el = document.getElementById("topbar");
  if (!el) return;
  const page = window.location.pathname.split("/").pop();
  const links = [["calendar.html", "Calendar"]];
  if (isLeadPlus(profile)) links.push(["approvals.html", "Approvals"]);
  if (isSuperuserPlus(profile)) { links.push(["admin.html", "Admin"]); links.push(["audit.html", "Audit Trail"]); }

  el.innerHTML = `
    <div class="brand">${gdgLogoSvg(30)}
      <div>Leave Management<small>GD&amp;G Special Projects</small></div>
    </div>
    <div class="nav">${links.map(([href,label]) =>
      `<a href="${href}" class="${page===href?'active':''}">${label}</a>`).join("")}</div>
    <div class="userbox">
      <span>${escapeHtml(profile.full_name)} (${escapeHtml(profile.initials)}) &middot; ${ROLE_LABEL[profile.role]}</span>
      <button onclick="signOut()">Sign out</button>
    </div>`;
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

function showMsg(container, text, type) {
  container.innerHTML = `<div class="msg ${type}">${escapeHtml(text)}</div>`;
}

/* ---------------- edge function calls ---------------- */
async function callEdgeFunction(name, payload) {
  const session = await getSession();
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

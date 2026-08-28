/* =====================================================================
   Leave Manager — shared.js
   GD&G Special Projects™

   Fill in SUPABASE_URL / SUPABASE_ANON_KEY below before deploying.
   ===================================================================== */

const SUPABASE_URL = "https://otbdyjvfavghytznxzfd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9yzKRyJmB032pbBUcuTNHg_H0Lezdxf";
const LOGIN_EMAIL_DOMAIN = "leave.gdgspecialprojects.local";
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEAVE_TYPE_LABEL = {
  full_day: "Full Day",
  study_leave: "Study Leave",
  toil_full_day: "TOIL (Full Day)",
  toil_am: "TOIL (AM)",
  toil_pm: "TOIL (PM)",
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

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
  const links = [["calendar.html", "Calendar"]];
  if (isLeadPlus(profile)) links.push(["approvals.html", "Approvals"]);
  if (isSuperuserPlus(profile)) { links.push(["admin.html", "Admin"]); links.push(["audit.html", "Audit Trail"]); }

  el.innerHTML = `
    <div class="brand">
      <div>Leave Manager<small>GD&amp;G Special Projects&trade;</small></div>
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

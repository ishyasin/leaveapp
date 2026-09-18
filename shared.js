/* =====================================================================
   Leave Manager — shared.js
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
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
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
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;margin:4px 0;border:1px solid var(--border);border-radius:6px;background:#f8fafc;flex-wrap:wrap;";

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

async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
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
  const links = [["calendar.html", "Calendar"], ["my-leave.html", "My Leave"]];
  if (isLeadPlus(profile)) links.push(["approvals.html", "Approvals"]);
  if (isSuperuserPlus(profile)) { links.push(["admin.html", "Admin"]); links.push(["audit.html", "Audit Trail"]); }

  el.innerHTML = `
    <div class="brand">
      <div>Leave Manager<small>by ED&amp;G&trade;</small></div>
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

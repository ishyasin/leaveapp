/* Dashboard: a large dialog summarising what needs the signed-in person.
   Loaded on demand by shared.js (openDashboard). Uses only the data the
   person can already see through the normal row-level security, and each
   tile fails quietly on its own if its data can't be read. */
(function () {
  "use strict";
  const TZ = "Europe/London";
  const $ = (s, r) => (r || document).querySelector(s);
  const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const dayNum = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const esc = (s) => escapeHtml(String(s == null ? "" : s));
  const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };
  const initialsOf = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ov = null, lastFocus = null, profileRef = null;

  function greeting(profile) {
    const h = Number(new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return `${part}, ${esc((profile.full_name || "").split(/\s+/)[0] || "there")}.`;
  }

  async function gather(profile) {
    const today = todayStr();
    const hasLeave = !isReadOnlyRole(profile);
    const canApprove = isLeadPlus(profile) || isPharmacyAdmin(profile);
    const dirRes = await safe(() => sb.rpc("get_profile_directory"));
    const dir = (dirRes && dirRes.data) || [];
    const nameOf = (id) => { const p = dir.find(x => x.id === id); return p ? p.full_name : "Someone"; };
    const initOf = (id) => { const p = dir.find(x => x.id === id); return p && p.initials ? p.initials : initialsOf(nameOf(id)); };
    const D = { today, hasLeave, canApprove, nameOf, initOf };

    const jobs = [];
    if (canApprove) jobs.push(safe(async () => {
      const r = await sb.from("leave_requests").select("id,user_id,leave_date,leave_type,requested_at").eq("status", "pending").eq("deleted", false).order("requested_at", { ascending: true }).limit(200);
      if (r.error) return;
      const groups = new Map();
      (r.data || []).forEach(x => { const k = x.user_id + "|" + x.requested_at + "|" + x.leave_type; (groups.get(k) || groups.set(k, []).get(k)).push(x); });
      D.pending = [...groups.values()].map(g => g.sort((a, b) => a.leave_date.localeCompare(b.leave_date)));
    }));
    if (hasLeave) {
      jobs.push(safe(async () => {
        const r = await sb.from("leave_requests").select("id,leave_date,leave_type,status").eq("user_id", profile.id).eq("deleted", false).gte("leave_date", today).in("status", ["pending", "approved"]).order("leave_date", { ascending: true }).limit(6);
        if (!r.error) D.myLeave = r.data || [];
      }));
      jobs.push(safe(async () => {
        const r = await sb.from("leave_requests").select("user_id,leave_date,leave_type,snapshot_primary_site,snapshot_cross_site").eq("status", "approved").eq("deleted", false).eq("leave_date", today);
        if (!r.error) D.off = r.data || [];
      }));
    }
    jobs.push(safe(async () => {
      const r = await sb.from("personal_tasks").select("*");
      if (r.error) return;
      const t = r.data || [];
      const lg = t.filter(x => x.kind === "long" && !x.done && x.due_date);
      D.overdue = lg.filter(x => x.due_date < today).length;
      D.week = lg.filter(x => x.due_date >= today && dayNum(x.due_date) - dayNum(today) <= 7).length;
      D.longOpen = lg.length;
      const dy = t.filter(x => x.kind === "daily" && x.task_date === today);
      D.dailyTotal = dy.length; D.dailyDone = dy.filter(x => x.done).length;
      const as = await sb.rpc("get_assigned_tasks");
      D.setOpen = as.error ? 0 : (as.data || []).filter(x => x.assigned_to === profile.id && !x.done).length;
      D.tasksOk = true;
    }));
    jobs.push(safe(async () => {
      const r = await sb.from("oncall_assignments").select("site,shift_date,duty_type").eq("user_id", profile.id).gte("shift_date", today).order("shift_date", { ascending: true }).limit(1);
      if (!r.error) D.nextShift = (r.data || [])[0] || null; D.shiftOk = !r.error;
    }));
    jobs.push(safe(async () => {
      const r = await sb.rpc("search_huddle_posts", { p_query: null, p_site: null, p_limit: 10, p_offset: 0 });
      if (r.error) return;
      const posts = (r.data || []).filter(p => !p.deleted);
      D.huddle = posts.find(p => p.pinned) || posts[0] || null;
    }));
    jobs.push(safe(async () => {
      const r = await sb.from("quick_links").select("id,title").order("sort_order").order("created_at").limit(8);
      if (!r.error) D.links = r.data || [];
    }));
    await Promise.all(jobs);
    return D;
  }

  const fmt = (iso) => (typeof fmtDate === "function" ? fmtDate(iso) : iso);
  const daysTo = (iso, today) => dayNum(iso) - dayNum(today);
  const spanLabel = (g) => g.length === 1 ? fmt(g[0].leave_date) : `${fmt(g[0].leave_date)} to ${fmt(g[g.length - 1].leave_date)}, ${g.length} days`;

  function tile(cls, href, title, badge, inner) {
    return `<a class="dash-tile ${cls}" href="${href}"><h3>${title}${badge ? `<em>${badge}</em>` : ""}</h3>${inner}</a>`;
  }

  function render(D, profile) {
    const needs = (D.pending ? D.pending.length : 0) + (D.overdue || 0) + (D.week || 0) + (D.setOpen || 0);
    let tiles = "";
    // Row 1
    if (D.canApprove && D.pending) {
      const top = D.pending.slice(0, 4);
      tiles += tile("c8", "approvals.html", "Leave to approve", D.pending.length ? `${D.pending.length} waiting` : "", D.pending.length
        ? top.map(g => `<div class="dash-req"><span class="dash-av">${esc(D.initOf(g[0].user_id))}</span><div><b>${esc(D.nameOf(g[0].user_id))}</b><span class="dash-sub">${esc(spanLabel(g))}</span></div>${g.length > 1 ? '<span class="dash-chip">Multiple dates</span>' : ""}<span class="dash-review">Review</span></div>`).join("") + (D.pending.length > top.length ? `<div class="dash-sub" style="margin-top:6px;">and ${D.pending.length - top.length} more</div>` : "")
        : '<div class="dash-empty">Nothing waiting for approval.</div>');
    } else if (D.hasLeave && D.myLeave) {
      tiles += tile("c8", "my-leave.html", "My upcoming leave", "", D.myLeave.length
        ? D.myLeave.slice(0, 4).map(x => `<div class="dash-req"><span class="dash-av">${esc(initialsOf(profile.full_name))}</span><div><b>${esc(fmt(x.leave_date))}</b><span class="dash-sub">${esc(LEAVE_TYPE_LABEL[x.leave_type] || x.leave_type)}</span></div><span class="dash-chip ${x.status}">${esc(x.status)}</span></div>`).join("")
        : '<div class="dash-empty">No upcoming leave booked.</div>');
    }
    if (D.tasksOk) {
      const pct = D.dailyTotal ? Math.round(D.dailyDone / D.dailyTotal * 100) : 0;
      const due = (D.overdue || 0) + (D.week || 0);
      tiles += tile("c4", "tasks.html", "My tasks", due ? `${due} due soon` : "", `<div class="dash-ring" style="--p:${pct}" data-l="${D.dailyTotal ? pct + "%" : "0"}"></div>
        <div class="dash-sub">Today ${D.dailyDone || 0} of ${D.dailyTotal || 0} done${D.overdue ? ` &middot; <strong class="dash-bad">${D.overdue} overdue</strong>` : ""}${D.setOpen ? ` &middot; ${D.setOpen} set for you` : ""}</div>`);
    }
    // Row 2
    if (D.shiftOk) {
      const s = D.nextShift;
      tiles += tile("c4", "oncall.html", "Next on-call", "", s
        ? `<div class="dash-big" data-n="${Math.max(0, daysTo(s.shift_date, D.today))}">0</div><div class="dash-sub">${daysTo(s.shift_date, D.today) === 0 ? "day. You are on today" : "days until"} ${esc(fmt(s.shift_date))}<br>${esc(SITE_LABEL[s.site] || s.site)}, ${esc(s.duty_type === "on_call" ? "on-call" : "on-site")}</div>`
        : '<div class="dash-empty">No upcoming shifts on the rota.</div>');
    }
    if (D.off) {
      const bySite = (site) => { const seen = new Set(); return D.off.filter(r => r.snapshot_primary_site === site || r.snapshot_cross_site === true).filter(r => !seen.has(r.user_id) && seen.add(r.user_id)); };
      const sites = Object.keys(SITE_LABEL);
      tiles += tile("c4", "calendar.html", "Off today", "", sites.map(site => {
        const arr = bySite(site);
        return `<div class="dash-off"><div class="dash-sub"><strong>${esc(SITE_LABEL[site])}</strong></div>${arr.length ? `<div class="dash-avs">${arr.map(r => `<span class="dash-av sm" title="${esc(D.nameOf(r.user_id))}">${esc(D.initOf(r.user_id))}</span>`).join("")}</div><div class="dash-sub">${arr.map(r => esc(D.nameOf(r.user_id)) + (r.snapshot_primary_site !== site ? " (cross-site)" : "")).join(", ")}</div>` : '<div class="dash-sub">Nobody</div>'}</div>`;
      }).join(""));
    }
    if (D.huddle) {
      tiles += tile("c4", "huddle.html", "Huddle", D.huddle.pinned ? "Pinned" : "Latest", `<p class="dash-post">${esc(D.huddle.title)}</p><div class="dash-sub">${D.huddle.created_at ? esc(fmt(String(D.huddle.created_at).slice(0, 10))) : ""}</div>`);
    }
    if (D.links && D.links.length) {
      tiles += tile("c12", "links.html", "Quick links", "", `<div class="dash-links">${D.links.map(l => `<span>${esc(l.title)}</span>`).join("")}</div>`);
    }
    const lead = needs ? `${needs} thing${needs === 1 ? "" : "s"} need${needs === 1 ? "s" : ""} you.` : "You're all caught up.";
    const dateLine = new Date().toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
    return `<div class="dash-head"><div><p class="dash-date">${esc(dateLine)}</p><h2 id="dashTitle">${greeting(profile)} <span>${esc(lead)}</span></h2></div>
        <button type="button" class="dash-x" id="dashClose" aria-label="Close dashboard">&times;</button></div>
      <div class="dash-grid">${tiles || '<div class="dash-empty">Nothing to show yet.</div>'}</div>
      <div class="dash-foot"><label class="dash-opt"><input type="checkbox" id="dashAuto"${dashAutoOn(profile) ? " checked" : ""}> Open this dashboard when I sign in</label>
        <button type="button" class="primary" id="dashDone">Close</button></div>`;
  }

  function countUp() {
    ov.querySelectorAll("[data-n]").forEach(el => {
      const to = Number(el.dataset.n) || 0;
      if (reduce() || document.documentElement.getAttribute("data-anim") === "off") { el.textContent = to; return; }
      let s = null;
      const f = (ts) => { if (!s) s = ts; const p = Math.min(1, (ts - s) / 800); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
  }

  function close() {
    if (!ov) return;
    const o = ov; ov = null;
    document.removeEventListener("keydown", onKey, true);
    o.classList.remove("show");
    setTimeout(() => { o.remove(); }, 260);
    document.body.classList.remove("dash-open");
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key === "Tab" && ov) {
      const f = [...ov.querySelectorAll("a[href],button,input")].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  window.__openDashboard = async function (profile) {
    if (ov) return;
    profileRef = profile; lastFocus = document.activeElement;
    ov = document.createElement("div");
    ov.className = "dash-overlay"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "dashTitle");
    ov.innerHTML = `<div class="dash-card"><div class="dash-head"><div><p class="dash-date">Loading</p><h2 id="dashTitle">${greeting(profile)}</h2></div><button type="button" class="dash-x" id="dashClose" aria-label="Close dashboard">&times;</button></div>
      <div class="dash-grid"><div class="dash-sk c8"></div><div class="dash-sk c4"></div><div class="dash-sk c4"></div><div class="dash-sk c4"></div><div class="dash-sk c4"></div></div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add("dash-open");
    void ov.offsetWidth; ov.classList.add("show");
    document.addEventListener("keydown", onKey, true);
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    ov.addEventListener("click", (e) => { if (e.target.closest("#dashClose,#dashDone")) close(); });
    ov.addEventListener("mousemove", (e) => { const t = e.target.closest(".dash-tile"); if (!t) return; const r = t.getBoundingClientRect(); t.style.setProperty("--x", (e.clientX - r.left) + "px"); t.style.setProperty("--y", (e.clientY - r.top) + "px"); });
    ov.addEventListener("change", (e) => { if (e.target.id === "dashAuto") setDashAuto(e.target.checked); });
    const closeBtn = $("#dashClose", ov); if (closeBtn) closeBtn.focus();
    const mine = ov;
    const D = await gather(profile);
    if (ov !== mine) return;   // closed while loading
    const card = $(".dash-card", ov);
    card.innerHTML = render(D, profile);
    card.classList.add("ready");
    countUp();
    const c2 = $("#dashClose", ov); if (c2 && document.activeElement === document.body) c2.focus();
  };
})();

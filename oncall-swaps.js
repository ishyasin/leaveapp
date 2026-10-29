/* On-call swaps as a table, one block per pharmacist: each shift date is a row and the
   swapped ones are flagged. Used by the Audit Trail page (Developer / Team Lead) and the
   On-call page's Audit Trail tab (everyone with access to the rota).
   Built from get_oncall_audit() (manual swaps and agreed swaps) and, for the "All shifts"
   view, the rota itself (oncall_assignments). Read-only. */
(function () {
  "use strict";
  const esc = (s) => escapeHtml(String(s == null ? "" : s));
  const DUTY = { on_call: "Overnight", onsite: "Onsite" };
  const SITE = (s) => (typeof SITE_LABEL !== "undefined" && SITE_LABEL[s]) || s || "";
  const day = (iso) => (typeof fmtDate === "function" ? fmtDate(iso) : iso);
  const stamp = (iso) => (typeof fmtDateTime === "function" ? fmtDateTime(iso) : iso);

  function parse(audit, profiles) {
    const byInit = new Map();
    profiles.forEach(p => { const k = (p.initials || "").toUpperCase(); byInit.set(k, byInit.has(k) ? null : p.id); });
    const swaps = [];
    audit.forEach(a => {
      const b = a.before_state, n = a.after_state;
      if (a.action === "set_oncall_assignment" && b && n && b.user_id !== n.user_id && n.shift_date) {
        swaps.push({ key: [n.site, n.shift_date, n.duty_type].join("|"), site: n.site, date: n.shift_date, duty: n.duty_type, when: a.created_at,
          from: b.user_id, to: n.user_id, how: "Manual swap", reason: (n.note || "").replace(/\s*\[after completion\]/, "").trim() });
      } else if (a.action === "apply_oncall_swap" && a.note) {
        const site = a.note.includes(":") ? a.note.split(":")[0].trim() : "";
        const re = /(\d{4}-\d{2}-\d{2}) (\w+) (\w+) -> (\w+)/g; let m;
        while ((m = re.exec(a.note))) {
          swaps.push({ key: [site, m[1], m[2]].join("|"), site, date: m[1], duty: m[2], when: a.created_at,
            from: byInit.get(m[3].toUpperCase()) || m[3], to: byInit.get(m[4].toUpperCase()) || m[4], how: "Agreed swap", reason: "" });
        }
      }
    });
    swaps.sort((x, y) => String(x.when).localeCompare(String(y.when)));
    return swaps;
  }

  function build(swaps, assignments, mode) {
    const chains = new Map();
    swaps.forEach(s => (chains.get(s.key) || chains.set(s.key, []).get(s.key)).push(s));
    const people = new Map();   // id -> rows
    const add = (id, r) => { if (!id) return; (people.get(id) || people.set(id, []).get(id)).push(r); };
    chains.forEach(ch => {
      const last = ch[ch.length - 1], involved = new Set(); ch.forEach(s => { involved.add(s.from); involved.add(s.to); });
      involved.forEach(id => {
        const inn = last.to === id;
        add(id, { date: last.date, duty: last.duty, site: last.site, swapped: true, status: inn ? "Swapped in" : "Swapped out",
          with: inn ? last.from : last.to, when: last.when, how: last.how, reason: last.reason, times: ch.length });
      });
    });
    if (mode === "all") {
      (assignments || []).forEach(a => {
        if (chains.has([a.site, a.shift_date, a.duty_type].join("|"))) return;
        add(a.user_id, { date: a.shift_date, duty: a.duty_type, site: a.site, swapped: false, status: "Own shift" });
      });
    }
    people.forEach(rows => rows.sort((x, y) => x.date.localeCompare(y.date) || x.duty.localeCompare(y.duty)));
    return people;
  }

  async function fetchAudit() {
    let all = [], before = null;
    for (let i = 0; i < 4; i++) {
      const { data, error } = await sb.rpc("get_oncall_audit", { p_limit: 500, p_before: before });
      if (error) throw error;
      const rows = data || []; all = all.concat(rows);
      if (rows.length < 500) break;
      before = rows[rows.length - 1].created_at;
    }
    return all;
  }
  async function fetchAssignments() {
    try {
      const from = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
      const { data, error } = await sb.from("oncall_assignments").select("shift_date,duty_type,site,user_id").gte("shift_date", from).order("shift_date").limit(3000);
      return error ? [] : (data || []);
    } catch (e) { return []; }
  }

  window.OncallSwaps = {
    parse, build,
    async mount(el, profiles) {
      el.innerHTML = '<p class="small">Loading swaps…</p>';
      let swaps, assignments;
      try { [swaps, assignments] = [parse(await fetchAudit(), profiles), await fetchAssignments()]; }
      catch (e) { el.innerHTML = `<p class="small">Could not load swaps: ${esc(e.message || e)}</p>`; return; }
      const nameOf = (id) => { const p = profiles.find(x => x.id === id); return p ? `${p.full_name} (${p.initials})` : (id ? String(id) : "Unknown"); };
      const sortName = (id) => { const p = profiles.find(x => x.id === id); return p ? p.full_name : String(id); };
      let mode = "swapped", who = "";
      function draw() {
        const people = build(swaps, assignments, mode);
        const ids = [...people.keys()].sort((a, b) => sortName(a).localeCompare(sortName(b)));
        const shown = ids.filter(id => !who || id === who);
        const opts = '<option value="">All pharmacists</option>' + ids.map(id => `<option value="${esc(id)}"${id === who ? " selected" : ""}>${esc(nameOf(id))}</option>`).join("");
        let body = "";
        shown.forEach(id => {
          const rows = people.get(id), n = rows.filter(r => r.swapped).length;
          body += `<div class="sw-person"><h3>${esc(nameOf(id))} <span>${n} swapped${mode === "all" ? `, ${rows.length - n} own` : ""}</span></h3>
            <div class="sw-scroll"><table class="sw-table"><thead><tr><th>Date</th><th>Duty</th><th>Site</th><th>Status</th><th>With</th><th>Swapped on</th><th>How</th><th>Reason</th></tr></thead><tbody>`
            + rows.map(r => `<tr class="${r.swapped ? (r.status === "Swapped in" ? "sw-in" : "sw-out") : "sw-own"}"><td>${esc(day(r.date))}</td><td>${esc(DUTY[r.duty] || r.duty)}</td><td>${esc(SITE(r.site))}</td>
              <td><span class="sw-badge">${esc(r.status)}${r.times > 1 ? ` (${r.times}x)` : ""}</span></td><td>${r.with ? esc(nameOf(r.with)) : ""}</td><td>${r.when ? esc(stamp(r.when)) : ""}</td><td>${esc(r.how || "")}</td><td>${esc(r.reason || "")}</td></tr>`).join("")
            + "</tbody></table></div></div>";
        });
        el.innerHTML = `<div class="sw-bar"><div class="sw-seg" role="group" aria-label="Show"><button type="button" data-m="swapped" class="${mode === "swapped" ? "on" : ""}">Swapped shifts only</button><button type="button" data-m="all" class="${mode === "all" ? "on" : ""}">All shifts</button></div>
          <select id="swWho" aria-label="Pharmacist" style="width:auto;margin:0;">${opts}</select></div>`
          + (body || `<p class="small">${mode === "swapped" ? "No swaps recorded yet." : "Nothing to show."}</p>`)
          + (mode === "all" ? '<p class="small">All shifts lists rota dates from 30 days ago onwards.</p>' : "");
      }
      el.addEventListener("click", (e) => { const b = e.target.closest(".sw-seg button[data-m]"); if (b) { mode = b.dataset.m; draw(); } });
      el.addEventListener("change", (e) => { if (e.target.id === "swWho") { who = e.target.value; draw(); } });
      draw();
    },
  };
})();

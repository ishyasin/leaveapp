# Pharmacy Portal
**by ED&G™**

A Supabase-backed staff portal. After signing in, everyone lands on a
home page (`portal.html`) with four sections:

- **Leave Manager** — leave requests, approvals and the calendar (§6 onwards).
- **Huddle Board** — notices for Worthing, St Richard's or both (§17b).
- **Quick Links** — tiles linking to useful systems, managed by Lead Pharmacists and above (§17c).
- **On-Call Rota** — overnight and onsite cover (§17a).

Role-based access and a full audit trail apply across all of it. Static
frontend (plain HTML/JS) — hosts for free on GitHub Pages.

---

## 1. Roles

Three grades of seniority — 1. Clinical Team Lead, 2. Lead Pharmacist,
3. Pharmacist:

| Role | Can do |
|---|---|
| **Pharmacist** | Request Annual Leave, TOIL, or Study Leave for **themselves**, for today or the future — **never retrospective (past-dated), of any type**. View the whole team calendar. Cancel their own still-pending requests (not once approved/rejected) — including **in bulk** via Ctrl+click. |
| **Lead Pharmacist** | Everything a Pharmacist can, plus: **allocate and approve** a **Pharmacist's** leave (any type — Annual, TOIL, Study Leave, full or part day) for current, future, **and retrospective** dates. Approve/reject a Pharmacist's pending request (never their own, another Lead Pharmacist's, or a Clinical Team Lead's). Tick **Clinical Rota Completed** / **DSR complete** for a month. **Can reject leave but cannot delete it** — deleting is Clinical Team Lead+ only, with one narrow exception: see §6b. |
| **Clinical Team Lead** (`superuser`) | **Allocate and approve any user's leave, of any type, for current, future, and retrospective dates — including their own.** Also: create/deactivate/reactivate Pharmacist, Lead Pharmacist, **and other Clinical Team Lead** logins (never a Developer), change a Pharmacist's/Lead Pharmacist's role (see §6a), reset their passwords, manage bank holidays/restricted days/capacity settings, **edit / unapprove** any leave request, **delete** any leave request (a note is mandatory), and **un-tick** Rota/DSR complete. Can suspend another Clinical Team Lead's account — but never their own, and never a Developer's. Cannot hide, delete, reset the password of, edit the site of, or change the role of another Clinical Team Lead or a Developer account — those stay narrower than suspend (see §6c). |
| **Developer** | Total control — can allocate/approve/reject/delete anyone's leave (including their own), and promote anyone up to Clinical Team Lead. The one thing even a Developer can't do from the app is touch **another Developer** account (role, suspend, hide, delete) — that's Supabase-dashboard-only, for everyone, always. |

The approval hierarchy above is enforced in the database
(`can_process_leave_for()`), not just hidden in the UI — a direct API
call bypassing the frontend gets rejected exactly the same way. "Leave"
throughout this table means Annual Leave, TOIL, and Study Leave alike,
full day or part day — the hierarchy doesn't vary by leave type.

## 2. What's in this repo

```
index.html              redirects to login.html
login.html               sign in (User ID + password)
reset-password.html      forced password change (first login / after an admin reset)
calendar.html             month-tab calendar for both sites, request leave, view/action a tile
my-leave.html             personal view of your own pending/approved leave, every type together
approvals.html            queue of pending requests, with same-day-clash highlighting (Lead Pharmacist+)
admin.html                 users, bank holidays, restricted days, leave capacity, on-call settings, leave records + Excel export (Clinical Team Lead+)
portal.html                home page — tiles for the four sections
huddle.html                Huddle Board (§17b) — everyone reads, Lead Pharmacist+ posts
links.html                 Quick Links tiles (§17c) — everyone reads, Lead Pharmacist+ edits
tasks.html                 My Tasks — private long-term (deadline progress bars) and daily task lists, available to every role
oncall.html                on-call rota, swaps, and swap approvals (§17a) — viewable by everyone, edited by Lead Pharmacist+; swap approval mode (automatic/manual) set by Clinical Team Lead or Developer
audit.html                  full audit trail (Clinical Team Lead+)
shared.css / shared.js    common styling, Supabase helpers, and the UI dialog system (§5a)
schema.sql                 full database schema, RLS policies, RPC functions
supabase/functions/
  admin-create-user/         edge function — creates a login (role-restricted)
  admin-reset-password/      edge function — resets a login's password (admin-only, no email flow)
  admin-invite-users/        edge function — bulk invitation emails (see §4a)
  complete-invitation/       edge function — public, token-authenticated sign-up for invitees (§4a)
  login-with-user-id/        edge function — resolves User ID + password to a session server-side, rate-limited (§15)
  reset-initial-password/    edge function — atomically verifies current password, changes it, and clears must_reset_password (§15)
  send-leave-backup/         edge function — generates the full Excel backup and emails it (§17)
supabase/backup-cron-setup.sql  one-off SQL to schedule the daily backup (§17) — not part of schema.sql
.nojekyll                  needed for GitHub Pages to serve files starting with _
```

## 3. Supabase setup

1. Create a new Supabase project (choose a UK/EU region if data residency matters).
2. In the SQL Editor, run the entire contents of `schema.sql`. It's idempotent — safe to re-run, including as an upgrade over an older version of this schema.
3. Deploy the four core edge functions (a fifth, `send-leave-backup`,
   is optional — see §17 — since it needs a separate email-provider
   account to actually be useful):
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy admin-create-user
   supabase functions deploy admin-reset-password
   supabase functions deploy login-with-user-id
   supabase functions deploy reset-initial-password
   ```
   No extra secrets to set for these four — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase for every edge function. `send-leave-backup` needs three more of its own (§17).
4. **Create the first account (Developer) — dashboard only, deliberately not possible from the app itself:**
   - Authentication → Users → Add user. Any email/password will do — it's never actually used for anything (see the password-reset note below).
   - Copy the new user's UUID.
   - In the SQL Editor:
     ```sql
     select public.bootstrap_developer(
       '<paste-the-uuid-here>'::uuid,
       'admin',        -- the User ID they'll type on the login screen
       'DEV',          -- initials
       'System Administrator'
     );
     ```
   - Sign in on the login page with User ID `admin` and the password you set. From there, use **Admin → Create login** to add everyone else — Clinical Team Leads can then create Pharmacist, Lead Pharmacist, or further Clinical Team Lead logins day to day (never a Developer login — that stays Developer-only).

## 4. Frontend setup & hosting

1. Open `shared.js` and fill in:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-PUBLISHABLE-OR-ANON-KEY"; // Project Settings → API
   ```
2. Push this folder to a GitHub repo.
3. Repo → Settings → Pages → Deploy from branch → `main` / root. Give it a minute, then visit the Pages URL.
4. Because this is a static site, the anon key in `shared.js` is public by design (that's what it's for) — every real permission check happens in Postgres RLS and the RPC functions, not the frontend.

## 4a. Creating logins and emailing invitations

Admin → Users → **Create new login** asks for **Email address**,
**First name**, **Last name**, role and site. Everything else is generated:

- **Username** = `firstname.lastname` (lower case, letters and digits
  only, accents removed): Ish Yasin → `ish.yasin`.
- **Initials** = first letter of each name: Ish Yasin → `IY`.
- Both must be unique. If taken, a number is added: `ish.yasin1`,
  `ish.yasin2`… and `IY1`, `IY2`… (so Ian Yousef after Ish Yasin gets
  `IY1`). The form shows a live preview; the server makes the final
  allocation (safe even if two admins create people at once) and the
  confirmation message shows what was assigned.
- **Temporary password** is pre-filled with a random one (**Generate**
  makes another). The login details — username, temporary password and a
  sign-in button — are emailed through Resend unless you untick the box.
  The user must change the password at first sign-in.

Email uses the same `RESEND_API_KEY` / `BACKUP_FROM_EMAIL` secrets as
the daily backup (optionally `INVITE_FROM_EMAIL` for a different sender
and `APP_URL` to force the sign-in link). The address is never stored;
the audit trail records "invitation emailed to j***@…" or that it
failed. If the email fails the account is still created and you're told
to share the password yourself. **Reset password** also offers to email
the new temporary password. Redeploy after updating:
`supabase functions deploy admin-create-user admin-reset-password`.

### Bulk invitations (self-service sign-up)

Admin → Users → **Invite people by email** is the quickest way to onboard
a group. Paste any number of addresses (one per line, or separated by
commas/semicolons; `Name <address>` is fine — up to 100 per send), choose
the role for the batch and press **Send invitations**. Each person gets
a personal link to `join.html` where they:

1. enter their **first and last name** — the username (`first.last`) and
   initials (first letters, `IY`, `IY1`, `IY2`…) are generated from it,
   guaranteed unique;
2. choose their **base site** (Worthing / St Richard's) and tick
   **cross-site** if they also cover the other hospital;
3. **choose their own password** (12+ characters). There is no temporary
   password, so nothing to reset afterwards; they are signed straight in.

A Clinical Team Lead or Developer can change anyone's site afterwards
with **Edit site** in the user list. The invitations list shows each
address as Waiting / Expired / Email failed / Accepted / Revoked, with
**Resend** (fresh link, fresh 7 days — the old link stops working),
**Resend all waiting** and **Revoke**. Links work once and last 7 days.
Only a hash of the token is stored; the address is kept only while the
invitation is open and is cleared on acceptance or revocation. A
Clinical Team Lead cannot invite (or revoke) a Developer.

**One account per email address.** A keyed hash of each person's address
(never the address itself) is stored on their profile and made unique, so a
second account for the same address is refused — whether by invitation,
by the "Create new login" form, or by someone opening an older link. Bulk
invites skip anyone who already has an account and list them as failed
("an account already exists for this email address"); the rest still send.
Addresses are compared case-insensitively. Limits: accounts created before
this change have no address on file, so they can't be matched; and
`name+tag@…` is treated as a different address. Don't rotate the service
role key without re-hashing, as the hash is keyed with it.
Deploy all three: `supabase functions deploy admin-invite-users admin-create-user`
and `supabase functions deploy complete-invitation --no-verify-jwt`.

Deploy (two new functions; `complete-invitation` is called by someone who
is not signed in yet, so it must be deployed without JWT verification — it
authenticates with the one-time token instead):
```bash
supabase functions deploy admin-invite-users
supabase functions deploy complete-invitation --no-verify-jwt
```
Re-run `schema.sql` first (new `invitations` table). Uses the same
`RESEND_API_KEY` / `BACKUP_FROM_EMAIL` secrets; optionally set `APP_URL`
to the full address of `join.html` to force the link in the email.

## 5. Password resets — admin-managed only

There is **no self-service "forgot password" flow**. A login's password
can only be reset by a Clinical Team Lead or Developer, from
**Admin → Users → Reset password**. Because of this, accounts don't
need a real, deliverable email address at all — each one gets a
synthetic `<user id>@leave.gdgspecialprojects.local` address purely as
its internal Supabase Auth identity; sign-in is always by **User ID**.
New logins, and any account that's just had its password reset, start
with `must_reset_password = true` and are forced to `reset-password.html`
to choose their own password before doing anything else.

## 5a. Confirmations, alerts, and prompts

Every confirmation, alert, and text-entry dialog in the app (delete
warnings, "enter a note", "enter a new date", etc.) is a **styled
in-app modal**, not a browser-native `confirm()`/`alert()`/`prompt()`
— those look and behave inconsistently across browsers and platforms,
and can be visually easy to miss or dismiss by accident. The system
lives in `shared.js` (`uiConfirm()`, `uiAlert()`, `uiPrompt()`) and
injects its markup into the page on first use, so it works the same
way on every page without needing to be added to each HTML file by hand.

## 6. How leave requests work

- **Full Day** — annual leave, a whole day. Requesting Full-day TOIL
  works exactly the same way — no time to pick.
- **TOIL** (time off in lieu) — choose **Full day** (behaves exactly
  like Full Day annual leave) or **Part day**. A part day is picked on
  a **clock dial** (07:00–19:00, 5-minute increments): click once for
  a start time, click again for the end, and it becomes a highlighted
  range — repeat as many times as needed for **several separate
  ranges in the same request** (e.g. 08:00–10:00 **and** 16:00–18:00
  together). Every range is also editable afterwards via a start/end
  dropdown pair in the list underneath the dial, each with its own
  Remove button, plus Undo-last-range and Clear-all. The chosen ranges
  are stored as-is; the tile itself just shows a small "Part day"
  marker rather than the actual times (there isn't room to show them
  usefully on something that narrow) — the full range list is in the
  tooltip and the detail popup. **Approving a part-day TOIL request
  requires a note** confirming the agreed times — the approver is
  prompted for it as part of clicking Approve (on the calendar or on
  `approvals.html`), pre-filled with whatever the requester originally
  picked, and the request simply won't approve without one. Approving
  any other leave type still needs no note, same as before.
- **Amending the times on any part-day request** — TOIL, Annual
  Leave, or Study Leave alike — is available to Lead Pharmacist+ from
  the tile's detail popup ("Amend times"): the same dial widget in a
  dedicated modal, pre-filled with the current ranges — a lighter
  action than a full edit, for correcting a mistake without touching
  the date or type. Logged to the audit trail (`amend_leave_ranges`)
  with an optional note. **What was originally requested always stays
  visible alongside an amendment** — a dedicated `original_ranges`
  column is set once, when the request is first made, and is never
  touched by amending it, so the tooltip, the detail popup, the
  Approvals queue, My Leave, Admin → Leave Records, and the Excel
  export all show a note like *"Originally requested: 08:00–10:00"*
  whenever the current times differ from what was first asked for —
  nothing needs to be typed manually for this to appear; it's derived
  automatically by comparing the two.
- **Study Leave** — has always been able to be raised **for someone
  else**; a Lead Pharmacist, Clinical Team Lead, or Developer picks
  who it's for from a dropdown, with no restriction on which role that
  person holds. Like TOIL, it can be a **Full day** or a **Part day**
  — a part day uses the exact same clock-dial picker as TOIL, supports
  multiple separate ranges the same way, and is stored in its own
  `study_ranges` column (same `{"start","end"}` shape). The tile shows
  a small "Part day" marker, same treatment as part-day TOIL.
- **Allocating Full Day / TOIL for someone else.** A Lead Pharmacist
  or above can now do the same for Full Day and TOIL too — the "For"
  dropdown is always visible to them (not just for Study Leave
  anymore), and who they can pick exactly matches who they're allowed
  to **approve**: a Lead Pharmacist can allocate for a Pharmacist
  only; a Clinical Team Lead can allocate for a Pharmacist, a Lead
  Pharmacist, or themselves; a Developer can allocate for anyone —
  same scope as `can_process_leave_for()` (§1), so the person
  allocating leave is always guaranteed to also be able to approve it.
  Allocated leave still lands as **Pending** like any other request —
  it isn't auto-approved — and is tagged **"Allocated"** everywhere it
  shows (the tile, its tooltip, the detail popup, `approvals.html`,
  Admin → Leave Records, and the Excel export), purely by comparing
  who requested it against whose leave it is — no separate flag was
  needed. **Retrospective (past-dated) allocation** works too, with
  one extra wrinkle: a Clinical Team Lead/Developer can backdate an
  allocation for anyone they can otherwise allocate for, same as their
  general rule; a **Lead Pharmacist can also backdate an allocation,
  but only when it's *for a Pharmacist*** — never for their own
  past-dated leave, which stays blocked exactly as before. A plain
  Pharmacist still can never submit retrospective leave, for
  themselves or anyone else.
- **Requesting more leave on a day that already has TOIL or Study
  Leave.** The one-request-per-day rule only blocks a genuinely
  duplicate **Full Day** — an existing TOIL or Study Leave request
  never blocks a further request for that same date. This covers the
  case where someone had, say, 1 hour of TOIL approved and then needs
  the whole day off after all: they can submit a new Full Day request
  straight on top of it rather than the system refusing it as a
  duplicate. Any tile that shares its date and person with another
  **live** (non-rejected) request gets a distinct amber outline — on
  both the original and the new one — so an approver reviewing the
  calendar or `approvals.html` notices the overlap immediately (hover
  a flagged tile for an explanation). From there it's the existing
  actions doing the work: approve the new request, amend the old
  TOIL's times if needed, then **Delete** the now-superseded original
  (Lead Pharmacist+, note required) — a deleted request is hidden from
  the calendar entirely (not shown as rejected), which is exactly
  right here since the person now has a clean day off covering it.
  A **part-day TOIL request goes further still**: it's never blocked
  by anything already on record for that date, even an already-
  approved Full Day. This is deliberately for putting in writing that
  you'd like part of an already-approved day converted to TOIL — it
  doesn't change the existing day on its own (that's still something
  to sort out with an approver directly, same as above), it just
  creates the record showing the request was made.
- **Bulk approve/reject.** A Lead Pharmacist, Clinical Team Lead, or
  Developer can hold **Ctrl** (or **Cmd** on a Mac) and click any
  number of **pending** tiles on the calendar to select them — each
  gets a gold outline, and a bar appears at the bottom of the screen
  with the count and **Approve selected** / **Reject selected** /
  **Clear selection** buttons. Approving a batch that includes a
  part-day TOIL request still prompts for that request's confirming
  note individually (one prompt per TOIL request in the batch, since
  each needs its own); rejecting a batch asks for one shared reason
  applied to everything selected. Each request is actioned
  independently through the same `approve_leave()`/`reject_leave()`
  RPCs as a single approval — the same role-hierarchy permission rule
  (§1) still applies to every one of them individually, so a request
  the approver isn't allowed to action fails with the usual message
  rather than silently succeeding, and the results (how many
  succeeded, and why any failed) are shown once the batch finishes. A
  plain click still opens the detail popup as normal; only Ctrl/Cmd+
  click selects, and only for Lead Pharmacist+.
- **Splitting a Full Day between annual leave and TOIL.** When a
  Pharmacist requests a Full Day but doesn't actually have enough
  annual leave left to cover it, the approver can use **"Split: AL +
  TOIL"** instead of a plain Approve — on a pending Full Day request's
  detail popup (calendar) or its row on `approvals.html`. It opens a
  modal with **two separate clock dials**: one for the hours that are
  genuinely annual leave, one for the hours covered by TOIL instead —
  same dial widget as a TOIL request, so multiple ranges are fine on
  either side too. A note explaining the split is mandatory. Saving
  approves the request directly (no separate Approve click needed)
  with `leave_type` set to `full_day_split`, storing both range sets
  on the one row — it deliberately does **not** create a second,
  separate request for the same date (which the one-request-per-day
  rule would reject anyway); the breakdown lives on the original row
  instead. On the calendar it stays in the Annual Leave lane with a
  small "Split" marker, and the tooltip/detail popup shows exactly
  which hours were AL and which were TOIL. The Excel export gets an
  "Annual Leave Hours" column alongside the existing TOIL one, and the
  breakdown shows inline in Admin → Leave Records. This can only be
  done from pending — an already-approved Full Day can't be split
  retroactively without first unapproving it (Clinical Team Lead+).
- **Date ranges:** the request form takes a start and end date. A
  single date (start = end) creates one tile. A wider range creates
  one tile per **weekday** in between — Saturdays and Sundays are
  skipped automatically — via `request_leave_range()`, which is
  all-or-nothing: if any day fails validation, none of them are
  created. A single specific date (even a weekend) still works exactly
  as entered — the weekend skip only applies to the automatic range fill.
- **Ctrl+click to select several days on the calendar:** hold **Ctrl**
  and click day numbers on either site's calendar to build up a
  selection (click again to deselect one). A **"Request Leave"**
  button appears next to that site's name once at least one day is
  selected — pressing it opens the request form with the start/end
  date already filled in from the earliest and latest day picked.
- **One request per person per day.** The database rejects a new (or
  edited) request for a date that already has a live pending/approved
  request on record for that person — this applies inside a range too,
  so accidentally submitting an overlapping range a second time fails
  cleanly instead of quietly creating duplicate tiles. A rejected or
  already-cancelled request doesn't block the date — it's free again.
- **Retrospective (past-dated) leave.** A plain Pharmacist can never
  request, or delete, leave for a date that's already gone. A
  **Clinical Team Lead or Developer** can add or remove a past-dated
  entry for anyone they can otherwise act for (editing was already
  Clinical Team Lead+ only, covering this automatically). A **Lead
  Pharmacist** can also add one — but *only while allocating it for a
  Pharmacist*, never for their own past-dated leave — and cannot
  delete a retrospective entry at all (`delete_leave()` keeps that
  Clinical Team Lead+ only, unchanged). This is separate from **Import
  Historical Leave** (§13a), which stays Developer-only and isn't
  affected by this rule either way.
- **Wrong-year check.** If the date you're requesting falls in a
  different year than the current one — a date-picker slip is the
  usual cause — the request form shows a confirmation before
  submitting (e.g. *"You're requesting leave for 2027, which is not
  the current year (2026). Continue anyway?"*). This applies to every
  role, including a Clinical Team Lead adding a retrospective entry —
  it's a sanity check, not a permission gate, so cancelling it just
  stops that one submission rather than blocking anything.
- New requests land as **Pending** and queue in `approvals.html`
  **oldest first** — first come, first served, and is open to Lead
  Pharmacist and above (not just Clinical Team Lead+). Every pending
  request shares **one queue regardless of type** — Annual Leave,
  TOIL, and Study Leave are all numbered 1st, 2nd, 3rd... in the order
  they were submitted, so priority is obvious at a glance whatever
  kind of leave it is. If two or more pharmacists have pending
  requests for the **same date**, that page also highlights it with a
  banner ("N pharmacists have requested [date]: ...") listing them in
  the order they applied, and badges each affected row so it's
  obvious while scanning the list.
- **Restricted-day / at-capacity warning.** If a pending request falls
  on a day that's — for the site(s) it applies to — either a Clinical
  Team Lead's forced red capacity override, an explicit Restricted
  Day, or auto-flagged because that site's leave-capacity threshold
  has been met, `approvals.html` shows a **"⚠ Restricted day"** badge
  right on that row (hover it for which of the three it is).
- **Who can approve/reject whom** — a strict hierarchy, enforced by
  `can_process_leave_for()` in the database (see §1's table): a Lead
  Pharmacist can only action a Pharmacist's request; a Clinical Team
  Lead can action a Pharmacist's, a Lead Pharmacist's, or their own; a
  Developer can action anyone's, including their own. Buttons are
  hidden client-side for combinations that would be rejected anyway,
  but the real boundary is server-side.
- **Pressing Approve** on `approvals.html` first shows a confirmation:
  *"There are N pharmacists off on this day, please check rota
  capacity before approving leave."* N counts everyone — any leave
  type, pending or already approved — with live leave on that date at
  the same site(s) the request applies to, so it reflects the actual
  rota impact rather than just the same-day queue count above. If the
  row carries the restricted-day warning above, that dialog leads with
  it (e.g. "This day is flagged: Marked as a Restricted Day.") so the
  approver can't miss it even if they didn't notice the badge.
  Cancelling the dialog leaves the request untouched.
- A pharmacist can **cancel their own request while it's still
  pending**; once approved or rejected, only a Clinical Team
  Lead can remove it (with a mandatory note — deleting is Clinical
  Team Lead+ only; a Lead Pharmacist can reject but not delete).
  Cancelling can also be done **in bulk**: Ctrl+click your own pending
  tiles to select several, then "Cancel selected" in the bar that
  appears at the bottom of the screen.
- Hovering any tile shows the person's name, leave type (including
  the TOIL/Annual Leave/Study Leave time, where relevant) and date,
  who requested or **allocated** it and when (allocated leave always
  shows this, even to the Pharmacist it's for — see below), and once
  actioned, who approved/rejected it and when, plus the reason if rejected.
- **No leave of any kind can be requested for a weekend** — enforced
  both server-side (any date falling on a Saturday/Sunday is rejected
  outright) and in the UI (a weekend day-number can't be Ctrl+clicked
  into a selection at all). A date **range** still only ever creates
  tiles for the weekdays within it, same as before — weekends inside a
  range are silently skipped, not rejected.
- **Annual Leave** works exactly like TOIL now: choose **Full day** or
  **Part day** from the Annual Leave sub-selector, and a part day uses
  the identical clock-dial picker as TOIL (multiple ranges, editable
  list, etc.), stored as `leave_type = 'annual_part_day'`.
- **Allocating leave for someone else** (Lead Pharmacist+) works the
  same way across every leave type now, including Study Leave (which
  used to be allocatable for anyone — it's now scoped to the same
  hierarchy as everything else: Lead Pharmacist → Pharmacist only;
  Clinical Team Lead → Pharmacist/Lead Pharmacist/self; Developer →
  anyone). Allocated leave is tagged **"Allocated"** everywhere it
  shows, and both the tooltip and the detail popup spell out **who
  allocated it and when**, and **who approved it and when** once
  actioned — visible to the Pharmacist it's for, even though they
  don't otherwise see request/audit timing on their own ordinary
  self-requests. The request modal itself always **defaults the "For"
  picker back to yourself** every time it's freshly opened — so
  allocating for someone else once doesn't mean you have to remember
  to switch it back before requesting your own leave next time — and
  submitting for anyone other than yourself shows a dedicated
  confirmation ("You're requesting leave for X, not yourself.
  Continue?") before it goes through.
- The clock dial's **click target is a wide invisible band around the
  whole ring**, not just the tiny visible dots — clicking anywhere
  near the ring computes the nearest 5-minute time from the click
  angle, so you don't need pixel-precise accuracy to pick a time.
- **My Leave** (`my-leave.html`, in the nav for everyone) is a
  personal view of your own pending and approved leave — one table,
  every type together, with who requested/allocated each one and who
  approved it. Rejected and deleted requests aren't shown there.

## 6b. Deleting an allocation you both raised and approved

The Delete button only ever appears for someone the database will
actually let delete that specific request — never shown speculatively.
Clinical Team Lead+ always sees it. There's one narrow exception below
that: if you **both allocated** a piece of leave (you're
`requested_by`) **and approved it yourself** (you're `approved_by`) —
for someone else's leave, not your own — you can delete it once it's
approved, even if your role otherwise can't delete at all (a Lead
Pharmacist, say). The reasoning: you made the whole decision start to
finish, so there's no one else to ask, and without this exception that
allocation would sit on the calendar permanently with no way to remove
it. The audit trail entry for the delete is written exactly as always
— this exception only affects who can clear the tile off the
calendar, not whether the deletion itself gets recorded.

## 6a. Changing someone's role

A Clinical Team Lead or Developer can change an existing Pharmacist's
or Lead Pharmacist's role from **Admin → Users → Edit role** — e.g.
promoting a Pharmacist who's been promoted in real life up to Lead
Pharmacist, so they immediately get the extra access that comes with
it (approving Pharmacist leave, raising Study Leave for others, and so
on). It takes effect the moment it's saved: every permission check
throughout the app reads the person's current role live rather than
caching anything from when they signed in, so there's no need for them
to log out and back in.

- A **Clinical Team Lead** can promote/demote between **Pharmacist**
  and **Lead Pharmacist** only, and never on an existing Clinical Team
  Lead/Developer account.
- A **Developer** can additionally promote someone up to **Clinical
  Team Lead**.
- **Nobody** can set a role to Developer this way, and a Developer
  account's own role can never be changed by anyone (including another
  Developer) — becoming a Developer stays exclusively the
  dashboard-only `bootstrap_developer()` path described in §3.

## 7. Calendar layout

Matches the paper rota style: one tab per month, day-of-month columns
running 1 → last day, today's column outlined so it's easy to spot.
Three lanes per site — **Annual Leave**, **TOIL**, and **Study
Leave** — where each request gets its own full-width line for that
day; if more than one person is off the same day, the next request
stacks in the row underneath it, oldest requested first. Each leave
type has its own colour identity rather than a single shared
pending/approved scheme:
- **Annual Leave** — status-based: amber = pending, green = approved,
  red/struck-through = rejected.
- **TOIL** — its own purple identity: light purple while pending,
  dark purple once approved, red/struck-through if rejected.
- **Study Leave** — stays blue throughout, whether pending (faded) or
  approved (solid), so it keeps its own identity rather than only
  turning blue once approved; a rejected study leave request still
  turns red like everything else.

Hovering (or opening) a tile always leads with its **category** —
Annual Leave, TOIL, or Study Leave — so it's clear at a glance which
kind of leave it is, with TOIL adding its part-of-day and chosen time
(e.g. "TOIL — AM (start 08:30)"). The grid uses the full width of the
screen with a fixed table layout, so it never needs a horizontal
scrollbar, and on load it scrolls to bring today's column into view.

## 8. Sites

There are two fixed sites — **Worthing Hospital** and **St Richard's
Hospital** — shown
as two calendars stacked one above the other on the same page, so both
can be seen at once. A Clinical Team Lead or Developer sets each
person's site when creating their login, and can change it later from
**Admin → Users → Edit site**.

- Most staff have one **primary site**; the calendar for that site is
  the only one their leave appears on.
- Ticking **cross-site** means the person works at both — their leave
  then appears on **both** site calendars automatically, and shows as
  **pending on both, and approved on both** the moment it's actioned —
  no need to submit or approve it twice.
- **Editing someone's site only affects leave requested from that
  point on.** Each leave request stores a snapshot of the requester's
  site at the moment it was made (`snapshot_primary_site` /
  `snapshot_cross_site`); the calendar always filters by that
  snapshot, never by the person's current profile. So moving someone
  from single-site to cross-site (or vice versa) doesn't retroactively
  move their existing leave between calendars — only what they request
  afterwards uses the new setting.

### 8a. Site view toggle

Above the two calendars, a **Worthing Hospital / St Richard's Hospital
/ Both sites** toggle lets anyone show just one site's calendar instead
of both stacked together — handy on a smaller screen, or when you only
care about one site right now. It defaults to **Both sites** and is
purely a display filter for that browser (saved to `localStorage`, not
the account) — it doesn't change what leave you can see or request,
only which calendar card is shown.

## 9. Restricted days

Alongside bank holidays, a Clinical Team Lead or Developer can mark
any single day or date range, **for one site**, with a custom label
and colour from **Admin → Restricted Days** — e.g. "Restricted Leave
— Christmas" at Worthing Hospital only, or something more urgent at
St Richard's Hospital only. Each marking applies to the site chosen
when it was added; the same date can carry a different (or no)
marking at each site. Independent of bank holidays, which stay a
single shared list across both sites (a day can be a bank holiday, a
restricted day at one or both sites, both, or neither). A range skips
weekends and any date that's already a bank holiday, same logic as a
leave-request range, so only genuinely workable days get marked. The
colour still shows on the calendar even though the legend no longer
calls it out explicitly. If a leave tile and a restricted-day
highlight land on the same date, the leave tile's colour still takes priority.

**Picking the colour:** rather than a fixed yellow/pink choice, Admin
→ Restricted Days has a **colour table** (a row of base hues to pick
from) and an **intensity slider** underneath it — dragging the slider
runs from a very pale tint up to a bold, saturated version of
whichever hue is selected, with a live swatch and hex value shown as
you adjust it. The result is stored as an actual hex colour
(`restricted_days.highlight_color`, validated server-side as a real
`#rrggbb` value), not a fixed enum, so any shade is possible.

**Favourites:** once you've landed on a colour you like, **"☆ Save to
favourites"** adds it (with an optional label) to a shared palette
shown underneath the picker — anyone with access to this page can
click a favourite swatch to reuse that exact shade instantly, or
remove one with the small "×" beneath it. Favourites are stored in
`restricted_day_favourite_colors`, visible to Clinical Team Lead/
Developer only (same audience as the Restricted Days feature itself).

## 10. Leave capacity warnings

**Admin → Leave Capacity** lets a Clinical Team Lead or Developer set,
per site, how many pharmacists being off on the same day (approved or
pending, counting Annual Leave, TOIL, and Study Leave together) should
trigger a warning. Once that many **distinct** people are off, the day
automatically highlights **yellow** on that site's calendar. A
Clinical Team Lead/Developer can also **force a specific day to red**
from the same tab, overriding the automatic yellow calculation for
that one date — useful for flagging a day as critical regardless of
the count. Priority on the calendar (highest to lowest): a red
override, then a manual Restricted Day marking (pink or yellow), then
the automatic yellow capacity threshold, then a bank holiday, then a
plain weekend — an actual leave tile's colour always wins over any of
these. A day someone has deliberately marked — as a red override or as
a Restricted Day — always keeps that colour; the automatic yellow
threshold never silently overrides it just because the headcount also
happens to cross the limit that same day.

## 11. Rota complete / DSR complete

Each site, each month, has two independent flags, both set from the
controls next to that site's calendar heading (Lead Pharmacist+ only):

- **Clinical Rota Completed** — ticking it (after a confirmation
  prompt) shows a banner on that month: *"The rota for this month has
  been completed. Please update the clinical rota for any new leave
  approvals."*
- **DSR complete** — ticking it shows: *"The DSR for this month has
  been completed. Pharmacists requesting leave; please make
  arrangements for swaps."*

Either can be **ticked** by a Lead Pharmacist and above. Only a
**Clinical Team Lead or Developer can un-tick** either one — a Lead
Pharmacist's checkbox is simply disabled once it's already ticked.
Both changes go through a confirmation dialog before being applied and
are logged to the audit trail (`set_rota_complete` / `set_dsr_complete`).

## 12. Deactivating, hiding, and deleting an account

Three different strengths of "remove someone," matching who's doing it
and how reversible each one is:

- **Deactivate/Reactivate (Clinical Team Lead+).** The lightest-touch
  option — flips `active` off, immediately revoking sign-in, and can
  be reversed just as easily with "Reactivate." Available on any
  Pharmacist, Lead Pharmacist, **or another Clinical Team Lead** — the
  one exception is your own account, which you can never deactivate
  (there'd be no one left to undo it short of a Developer or the
  dashboard). Never available on a Developer account, by anyone.
  The button is now **Suspend / Unsuspend**. Suspending asks for the
  person's **last working day** (a calendar picker, required), an
  optional **leaving time** and an optional **note**, all recorded in
  the audit trail. From that moment any of their leave dated **after
  the last day turns grey** on the calendar (struck through, and not
  counted towards capacity; the approvals list tags it "After last
  day"). **Edit leaving details** changes them later, and
  **Unsuspend** restores the account and clears the details, so the
  leave returns to normal. The last day is visible to everyone (it
  drives the greying); the time and note are visible only to Clinical
  Team Lead / Developer.
- **Clinical Team Lead → Hide account.** A step further than
  deactivating, and deliberately narrower in who it can target — only
  a Pharmacist or Lead Pharmacist, never another Clinical Team Lead.
  This also **revokes access** (deactivated, and its password
  invalidated to a random value nobody knows, as genuine defense in
  depth beyond just the app-level lockout) and additionally removes
  the row from *that Clinical Team Lead's own* view of the Users list
  — a Developer still sees it there, marked "hidden." Nothing about
  the account, its role, or its leave history is deleted. Because a
  hidden row disappears from a Superuser's own list, only a Developer
  can reverse it ("Unhide account") — and unhiding does **not**
  automatically restore access; reactivating is still a separate,
  deliberate step.
- **Developer → Delete account.** Available on any Pharmacist, Lead
  Pharmacist, or Clinical Team Lead. This is meant as a genuine,
  permanent removal from the operator's point of view: access is
  revoked for good (deactivated, password invalidated, hidden from
  Superuser's list, flagged as deleted) and there's no "undelete"
  button in the app. What it deliberately does **not** do is delete
  the underlying database row or that person's leave history —
  `leave_requests.user_id` cascades on a real profile deletion, so an
  actual row-delete would silently wipe their entire leave record,
  which runs against the whole point of keeping an audit trail in a
  governance system. "Deleted" here means their access is gone
  permanently, not that the record vanishes.

A Developer account can never be deactivated, hidden, or deleted by
anyone from the app, even another Developer — that stays
Supabase-dashboard-only.

## 12a. Renaming a Display Name

A **Developer** can rename any account's Display Name from Admin →
Users → **Edit name** — including another Clinical Team Lead's or
Developer's, since this is a low-risk, easily-reversible metadata edit
rather than an access change, unlike everything else in §12. It only
changes `profiles.full_name`; **initials, User ID, and role are
untouched**. Logged to the audit trail (`set_user_display_name`) with
the before/after name recorded.

## 12b. Themes and Light/Dark/Inverted display modes

There are two independent display settings, shown together in the
topbar once logged in:

- **Theme** (`profiles.theme`) — the app's accent colour palette:
  navy/teal/honey by default, plus GD&G navy/magenta, Forest, Crimson,
  and the seasonal **Halloween**, **Christmas**, **Easter** and
  **Antimicrobial**, **Swiftie**, **Barbie-style**, **Fairytale (Disney-style)**,
  **Autumn**, **Winter**, **Spring**, **Summer**, **Seaside** and **South Downs (hills)** palettes.
  Not a personal preference — nobody can change their own theme, same reasoning as Renaming a
  Display Name above. Two ways to set it:
  - **One account at a time** (Developer only) — Admin → Users → **Edit theme**
    (`set_user_theme`, audit-logged).
  - **Several accounts at once** (Clinical Team Lead or Developer) — Admin → **Appearance** → "Apply a
    theme", either to every account or to a hand-picked selection
    (`set_user_theme_bulk`, one audit-log entry per batch covering how
    many accounts changed and to what). Handy for switching everyone
    over to a seasonal theme and back again.

  The **Halloween** and **Christmas** themes also add a thin cartoon
  decoration strip right under the topbar on every page — pumpkins and
  a dangling spider for Halloween, a Christmas tree, a reindeer, and
  snow for Christmas — inline SVG, hand-drawn flat/cartoon style, no
  external image requests (fits the existing CSP as-is). Easter and
  the other palettes are colour-only, no banner.
- **Colour mode** (`profiles.color_mode`) — **Light**, **Dark**, or
  **Inverted**. This one is each person's own choice, picked from the
  dropdown next to their name in the topbar on every page
  (`set_own_color_mode`) — nobody needs Admin access to change it, and
  it isn't audit-logged, since it's purely a personal display
  preference with no bearing on access or data.

Both settings are stored on the profile so they follow the person to
any device they log in from, and both apply instantly when changed —
no page reload needed. A small `localStorage` cache (keyed separately
from the account) lets each page apply the last-known theme/mode
before first paint, avoiding a flash of the wrong palette while the
profile is still loading; the database row is always the source of
truth and corrects the cache on every page load.

## 13. Exporting to Excel

**Admin → Leave Records → Export to Excel** (Clinical Team Lead/
Developer only) downloads one `.xlsx` workbook with three tabs —
**Approved**, **Pending**, and **Rejected** — covering every
non-deleted leave request. Each row includes the person, initials,
site (from that request's own snapshot — see Sites above), leave
type, TOIL time where relevant, who requested it and when, who
actioned it and when, and the rejection reason if applicable. Built
client-side with [SheetJS](https://sheetjs.com) (loaded from a CDN in
`admin.html`) — nothing is sent anywhere beyond the browser generating
the file locally from data it already queried from Supabase.

## 14. Audit trail

Every create, approve, reject, edit, unapprove, delete, user-creation,
deactivation, hide/unhide, password reset, site change, bank-holiday
change, restricted-day change, capacity threshold/override change, and
rota/DSR-complete change is written to `audit_log` by the same
database function that performs the action — never trusted to the
frontend, and every field (`before_state`/`after_state` included) is
still there in the database even though the UI only surfaces When /
Action / Actor / Note — kept deliberately plain, without a raw-JSON
detail view, since that level of detail isn't needed day to day.
Deleting a leave request **requires** a note; editing/unapproving
(Clinical Team Lead+ only) accept an optional one. Viewable at
`audit.html` (Clinical Team Lead/Developer only), filterable by action type.

**Developer only — Clear All Logs.** A Developer can permanently
delete every existing audit log entry from `audit.html`. This is
gated behind re-entering their own password: the button opens a
modal that re-authenticates the current account against Supabase Auth
before the database call is even attempted, so simply having the page
open isn't enough. The database itself only accepts this call from a
Developer account, regardless of what the frontend does. A single new
entry (`clear_audit_log`) is written immediately afterwards recording
that the clear happened — the fact that it occurred is never itself erased.

## 13a. Importing historical leave

**Admin → Import Historical Leave** (Developer only — the tab is
hidden entirely for anyone else) lets you manually back-fill a leave
record from an old spreadsheet or paper record, since that's how leave
was tracked before this system existed. Unlike a normal request, an
import can:

- Be created for **anyone** by a Developer, not just the requester
  themselves — and the "requested by" field can be a different person
  again (e.g. recording that someone's manager submitted it on their
  behalf back then).
- Be set **directly to Approved or Rejected** (with a reason) without
  going through the approvals queue, since it's recreating something
  that already happened rather than raising something new.
- **Backdate** when it was requested and when it was actioned, so the
  record reflects the original dates rather than "now".
- Target an **inactive** account too, for backfilling leave belonging
  to someone who's since left.

The same one-request-per-day guard as an ordinary request still
applies, so an import can't silently create a duplicate for a date
that already has something on record. Every import is logged to the
audit trail (`import_historical_leave`) with an optional note (e.g.
"Ported from 2025 leave spreadsheet"), and the record then behaves
exactly like any other leave request — it shows on the calendar, in
Leave Records, and in the Excel export. Dates/times are entered and
stored in your browser's local time zone, so it's worth a quick
sanity check on the calendar afterwards if precise TOIL timing matters.

## 14a. Resetting app data for go-live

**Admin → Reset Data** (Developer only — the tab is hidden entirely
for anyone else) lets you wipe every piece of operational data
accumulated while setting up or testing, so the app starts genuinely
clean for real use, **without recreating any accounts**:

- Deletes every leave request, bank holiday, restricted day, capacity
  override, and Clinical Rota Completed/DSR complete flag.
- Resets each site's leave-capacity threshold back to its default (3).
- Clears the audit log as part of the same reset, then writes one
  fresh `reset_app_data` entry recording that it happened — so, like
  Clear All Logs, the fact of the reset itself is never erased.
- **Does not touch `profiles` or `auth.users` at all** — every login,
  role, and site assignment you configured stays exactly as it was.

Same password re-entry requirement as Clear All Logs: the button
opens a modal that re-authenticates against Supabase Auth before the
database call is even attempted. This is the single most destructive
action in the app — there is no undo — so it's worth double-checking
you're pointed at the right Supabase project before running it.

## 15. Security notes

- **Signing out is now resilient to a failed remote sign-out call.**
  `signOut()` previously had no error handling — if the remote
  `auth.signOut()` request failed for any reason (a stale/already-
  rotated token, a network blip), the whole function would throw and
  the redirect back to `login.html` would never run, leaving someone
  stuck unable to log out even though they'd clicked Sign out. It now
  always redirects regardless of whether the remote call succeeded.
- All writes go through `SECURITY DEFINER` RPC functions — the tables
  themselves have **no** direct INSERT/UPDATE/DELETE policy for
  clients, only SELECT. Every business rule (self-approval only for
  Clinical Team Lead+, delete requires a note, role restrictions on
  user creation, the Developer-account protections, etc.) is enforced
  in Postgres, not just hidden in the UI.
- `bootstrap_developer()` has its EXECUTE privilege revoked from
  `public`/`anon`/`authenticated` — it can only ever be run from the
  Supabase SQL Editor by someone with dashboard access, never from the app.
- The hierarchy is enforced consistently across every admin action
  (suspend, hide, reset password, edit site, create): a Clinical Team
  Lead can never touch another Clinical Team Lead or a Developer
  account; nobody — not even another Developer — can suspend or hide a
  Developer account from within the app.
- **`profiles` visibility is now split in two.** The base table's
  RLS only returns a plain Pharmacist their **own** full row (Lead
  Pharmacist+ still see everyone's full row directly, which
  `admin.html`/`approvals.html` need). A separate `get_profile_directory()`
  RPC returns just `id, initials, full_name, role, active,
  primary_site, cross_site` — the columns actually needed to render
  names on the calendar — to every authenticated, **active** user;
  it deliberately never includes `user_id`, `must_reset_password`,
  `hidden_by_superuser`, `deleted_by_developer`, `created_by`, or
  `created_at`. This is a function rather than a plain view on
  purpose: a Postgres view normally runs with its *owner's*
  privileges and bypasses the base table's RLS entirely, which would
  keep handing back the whole directory to a deactivated user whose
  JWT hasn't expired yet — the function explicitly re-checks
  `current_profile_id() is not null` itself before returning anything,
  so the "suspended account = no application data" guarantee holds
  here too. `calendar.html` calls the RPC; every Superuser+/
  Developer-only page still reads the full table directly.
- **Every SELECT policy now requires an active account**
  (`current_profile_id() is not null`), not just an authenticated
  session — a deactivated user's still-valid JWT can no longer read
  `profiles`, `bank_holidays`, `restricted_days`, `site_settings`,
  `capacity_overrides`, or `month_status` via a direct API call, even
  though the frontend already signed them out. (`leave_requests` and
  `audit_log` already had this.)
- **Login never resolves or returns an account's email to the
  browser, and is rate-limited.** The old `email_for_user_id()` RPC
  (grant-able to `anon`) let anyone probe which User IDs existed and
  read back the matching synthetic email in one query — a real
  account-enumeration weakness for a login page. Sign-in now goes
  through the `login-with-user-id` edge function, which resolves the
  email and performs the sign-in entirely server-side, handing the
  browser back only session tokens — a nonexistent User ID, an
  inactive account, a wrong password, **and being rate-limited** all
  produce the identical generic error, so none of those states are
  distinguishable from outside. The rate limits themselves (tracked in
  a service-role-only `login_attempts` table, unreachable via the
  client REST API) are 8 failed attempts per account and 25 total
  attempts per IP address, both per 5-minute window.
  `email_for_user_id()`'s EXECUTE privilege has been revoked from
  `public`/`anon`/`authenticated` (kept only for SQL-editor use).
- **Forced password reset can no longer be bypassed by sequencing, or
  used to hijack an account from a stolen session.** The original
  flow was two independent client calls — `auth.updateUser()`
  followed by a separately-callable `clear_must_reset_flag()` RPC —
  with no database evidence the password had actually changed in
  between, so someone signed in with an admin-issued temporary
  password could call the RPC directly and permanently skip the
  reset. An early fix made this one atomic `reset-initial-password`
  edge function, but that still had a serious gap: it changed the
  password on request with no proof the caller actually knew the
  *current* one, meaning anyone holding a stolen or leaked access
  token (browser compromise, XSS, an unlocked device) could call it
  with a password of their own choosing and permanently take over the
  account. It now requires the current (temporary) password as well
  as the new one, and re-verifies it by attempting a real sign-in with
  it — server-side, via the service role — before changing anything.
  It also only works while `must_reset_password = true`, so it can't
  be used as a general "change my password" endpoint outside the
  forced first-login flow it's meant for.
  `clear_must_reset_flag()`'s EXECUTE privilege has been revoked from
  every client-facing role.
- **Dynamic content never reaches an inline event handler.** The one
  place a user-controlled string (an account's full name) was
  interpolated directly into an `onclick="..."` attribute — Admin →
  Users → Delete account — has been rewritten to use
  `addEventListener()` with the value passed as a real JS closure
  value instead of a string built into markup, closing a stored-XSS
  path where a crafted name could execute script when a Developer
  opened that page. Every other `onclick` in the app only ever
  interpolates UUIDs or fixed enum values (dates, site codes, month
  indices) — none of those are attacker-controllable free text, so
  they don't carry the same risk; a genuinely comprehensive move away
  from inline handlers app-wide is a larger follow-up, not done here.
- **A Content-Security-Policy is now set on every page** (`default-src
  'self'`, scripts/styles limited to this origin plus the jsDelivr CDN,
  `connect-src` limited to Supabase, `object-src`/`base-uri`/
  `frame-ancestors` all `'none'`). It still has to allow
  `'unsafe-inline'` for scripts and styles, since the app relies
  heavily on inline `onclick`/`style` attributes throughout — so this
  is real defense-in-depth (blocking arbitrary external script/fetch
  destinations) rather than a guarantee against inline-handler-based
  XSS specifically; the fix above is what actually closes that hole.
- **The Supabase JS SDK is pinned to an exact version everywhere** —
  `@supabase/supabase-js@2.45.4` in the browser (every page's
  `<script>` tag) *and* in all four edge functions' `esm.sh` imports,
  rather than floating on `@2` in either place, so a new upstream
  release can't change behaviour under you without a deliberate,
  tested bump. The XLSX library was already pinned.
- **Minimum password length raised from 8 to 12 characters**, enforced
  both client-side (form `minlength`) and server-side in both
  `admin-create-user` and `admin-reset-password`. Consider also
  enabling Supabase Auth's built-in password-strength/leaked-password
  checks in the dashboard for defense in depth beyond length alone.

## 17. Daily emailed backup

A full Excel workbook covering **both the leave rota and the on-call rota** (every leave request on record — one calendar-styled tab per month — plus a coloured rota tab per on-call period and site, with the on-call bank holidays, periods, swaps and audit), emailed once a
day. Two genuinely new pieces of infrastructure this needed, since the
app had neither before:

- **Excel generation with actual cell colours.** The `xlsx`/SheetJS
  library already used client-side (Admin → Export to Excel) can't set
  cell fills at all in its free tier — so this uses **ExcelJS**
  instead (`npm:exceljs`, via Deno's npm compatibility layer), imported
  only in this one edge function.
- **Sending email at all.** Nothing else in this app sends a real
  email — Supabase Auth's built-in email is for its own auth flows
  only. This uses **[Resend](https://resend.com)**, a simple
  transactional email API, purely because *something* had to be
  picked and it's a common, straightforward pairing with Supabase edge
  functions. Swapping in SendGrid/Postmark/etc. instead just means
  rewriting the one `fetch()` call at the bottom of the function.

**Who receives it — two ways to set this, DB takes priority:**
Admin → **Daily Backup** (Clinical Team Lead+/Developer) has a simple
form to set the recipient address(es) — comma-separated for more than
one — stored in the `backup_settings` table and readable/writable only
by that same audience. This is the easier way to manage it day to day
without needing CLI access. Leaving it blank falls back to the
`BACKUP_TO_EMAIL` secret below, for anyone who'd rather configure it
that way (or already had before this UI existed).

**Sending on demand, alongside the automatic daily run.** The same
Admin → Daily Backup page has a **"Send backup now"** button — it
triggers exactly the same function immediately, to whoever's set
above, and runs completely independently of the scheduled 7pm send
(neither affects the other, and there's no limit on triggering it
manually as often as you like). The edge function itself checks the
caller's role for this path — Clinical Team Lead+/Developer only, same
as everywhere else this setting lives — since a real person's session
token, unlike `pg_cron`'s service role key, isn't automatically
trustworthy just for being valid.

**What's in the workbook:**
- One tab **per month**, for every month actually spanned by the data
  on record (so it grows with your history, not a fixed window) —
  laid out like the calendar itself: day numbers and weekday
  abbreviations across the top, weekends and bank holidays shaded the
  same colours as the live calendar, one row per active person split
  into the two site blocks, each cell coloured and short-labelled
  (`AL`, `AL½`, `TOIL`, `TOIL½`, `SL`, `SL½`, `AL+TOIL`) to match the
  exact colours `shared.css` uses for that status/type.
- Six flat summary tabs covering the **complete history regardless of
  date** — All Approved, All Pending, All Rejected, TOIL, Study Leave,
  Annual Leave — each with who requested/allocated it and when, who
  actioned it and when, and the rejection reason where relevant.

**One-off setup, in order:**
1. Run the updated `schema.sql` (adds the `backup_settings` table + `set_backup_recipients()`).
2. Deploy the function: `supabase functions deploy send-leave-backup`
3. Create a [Resend](https://resend.com) account, verify a sending
   domain (or use their test domain while trying this out), and get an
   API key.
4. Set two secrets (a third, `BACKUP_TO_EMAIL`, is now optional — see above):
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set BACKUP_FROM_EMAIL="Pharmacy Portal <backups@yourdomain.com>"
   ```
   Then set the actual recipients from Admin → Daily Backup in the app
   itself, rather than a third secret — or set `BACKUP_TO_EMAIL` too if
   you'd rather manage it from the CLI instead.
5. Run `supabase/backup-cron-setup.sql` once, manually, in the SQL
   Editor (**not** part of `schema.sql` — it embeds your service role
   key, so it's deliberately kept separate and isn't meant to be
   re-run casually or committed anywhere with real values filled in).
   It schedules the function daily at **19:00 UTC (7pm)** via
   `pg_cron`; the file explains how to check it ran, how to remove it,
   and a caveat worth reading — `pg_cron` has no daylight-saving
   awareness, so this is genuinely 7pm UK time only outside British
   Summer Time (the file explains the two ways to handle that).

**Changing the send time afterwards, from the app itself.** This one-off
SQL Editor run is only ever needed **once**, to create the schedule in
the first place. After that, **Admin → Daily Backup → Send time**
(Clinical Team Lead+/Developer) lets you change what time it fires —
pick a UTC time and save — without going anywhere near the SQL Editor
or the service role key again. Under the hood this calls
`set_backup_schedule()`, which only ever updates that existing job's
schedule (via `cron.alter_job()`), never its command — so the project
URL and service role key baked in by step 5 are never touched or
re-exposed. If that step hasn't been run yet, this part of the page
says so instead of a time picker, since there's no job yet for it to
reschedule.

**Being upfront about what I couldn't verify:** I don't have a Deno
runtime or a live Supabase project available while building this, so
none of this has actually been executed — not the Excel generation,
not the email send, not the cron trigger. The code is written
carefully against each service's documented API, but `exceljs` is a
fairly heavy dependency to run inside an edge function (cold-start
time and memory both matter more there than in a normal server), and
this is the kind of integration that's genuinely worth a manual test
run (call the function directly first, confirm the email arrives and
the workbook opens correctly) before trusting the cron schedule to run
it unattended every day.

## 17a. On-call rota (Worthing / St Richard's)

**Audit Trail:** shown as a day-grouped timeline with colour-coded cards and filter chips (All / Swaps / Allocations / Setup). Swaps show a clear *who → who* panel with the shift, reason and who made the change.

**Layout:** the rota shows four weeks per row. A week only partly inside the period (e.g. a year starting on a Friday, or ending mid-week) is shown on a row of its own.

A separate on-call system, run independently per site, for `oncall.html`.

**Eligibility.** Clinical Team Lead (`superuser`) and Developer tick
which Pharmacists/Lead Pharmacists are in each site's on-call pool
from Admin → Users → **Edit on-call** (per-site checkboxes, plus a
personal colour shown on the rota). This is a dedicated flag
(`oncall_worthing` / `oncall_st_richards` on `profiles`) — separate
from the ordinary `primary_site`/`cross_site` leave fields.

**The rota.** Two columns of cover, each independently assignable:
- **Overnight** — every day of the year.
- **Onsite** — only Saturdays, Sundays and bank holidays (the database
  rejects an onsite shift on any other day).

Developer, Clinical Team Lead and Lead Pharmacist can set the rota
period, allocate shifts and mark bank holidays; everyone else with app
access can view it read-only. The Rota tab shows week-blocks running
**Sunday to Saturday** with the columns **Day, Date, Overnight,
Onsite**. Rows are light green for Sunday–Tuesday and light pink for
Wednesday–Saturday (the usual pattern is one pharmacist covering
Sun–Tue and another Wed–Sat). The whole year (or the selected rota
period) is shown on one page under a title such as "On-Call Rota 2027",
with pharmacists shown by **initials** (hover for the full name; a key
lists them). A Print button gives an A3-landscape layout.

**Build rota (slide-out).** All the rota-building controls are hidden
in a **+ Build rota** panel (click to slide it open, like "+ Create new
login" in Admin) that only Lead Pharmacists and above see: rota
periods (new / archive / reopen), pharmacist colours, bank holidays,
**Quick build** and **Complete rota**.

**Quick build.** Choose a pharmacist, paste their dates as
**DD/MM/YYYY** (one per line, or separated by spaces/commas) and press
Fill dates: that person goes into every one of those slots (Overnight,
plus Onsite on Saturdays, Sundays and bank holidays). Anything that isn't
a real date, or falls outside the selected period, stops the fill with a
message and changes nothing. Repeat for each pharmacist.

**Complete rota and the audit trail.** A rota period starts as a
**Draft** — while building, individual changes are not logged one by
one. Pressing **Complete rota** marks it complete (itself recorded in the
audit trail); from then on every change to a shift inside it (assign,
clear, swap, quick build) is listed in the Audit Trail, marked "edit made
after the rota was completed". Periods that existed before this feature
are treated as already complete.

**Pharmacist colours.** Each pharmacist has their own colour, shown in
their Overnight/Onsite cells (and in the key and the Excel backup). Anyone
who can build the rota (Lead Pharmacist and above) sets it from the Build
rota panel; it is the same colour the Admin "Edit on-call" box edits.
Pastel defaults are used until one is chosen. Re-run `schema.sql` (adds
`complete_oncall_rota_period`, `set_oncall_user_color`) and redeploy
`send-leave-backup` for the coloured backup.

**On-call bank holidays.** Lead Pharmacist and above mark which
dates are bank holidays for the rota, from the Rota tab — deliberately
separate from the leave calendar's own bank holidays (§9), so marking
one here never changes anything about ordinary leave capacity. A
marked day takes its own colour on the grid (light blue by default;
pick any colour when adding it, or change it later from the list),
and if its onsite shift is still empty the cell flags "Onsite needed" rather than a plain dash, as a
reminder — nothing stops it being left unfilled if that's genuinely
correct for that day.

**Rota periods (one per year — there is no rolling view).** The rota
only exists inside a named rota period: a name that includes the year
(e.g. "2027") plus its exact first and last dates (e.g. 1 Jan 2027 to
31 Dec 2027; typing just the year pre-fills these). A period covers at
most one year (366 days) and can't overlap another. Lead Pharmacist and
above create one (Rota tab → "+ New period"), allocate shifts inside
it, then **archive** it when done, which blocks further edits without
deleting anything ("Reopen" undoes it). The page always shows exactly
one period, titled e.g. "On-Call Rota 2027 — Worthing Hospital" with its
dates and day count underneath; it opens on the period covering today.
There is no free browsing, and the database refuses to save a shift on a
date outside any period (shifts saved before this rule remain visible
only once a period covering them is created).

**Highlighting a shift / overwriting an assignment.** Clicking any
assigned cell opens a small form to reassign it, clear it, or —
without changing who's assigned — attach a note. The note is shown directly under the name on the
grid itself (not just on hover), so reassigning someone's shift and
noting why (e.g. "Replaced with J Smith due to sickness") is visible
at a glance, not just to whoever happens to hover over it.

**Overnight at the weekend = onsite too.** Putting someone on
**Overnight** on a Saturday, Sunday or bank holiday automatically puts
the same person in that day's **Onsite** slot (applies to the cell
form, Ctrl-select and Quick build alike). The onsite
slot is filled when it's empty, or when it holds the person being
replaced (so a manual swap moves both and both get the red *); if onsite
was deliberately given to someone else it's left alone. Adding a bank
holiday afterwards doesn't backfill existing days — those show "Onsite
needed" until filled. Clearing overnight doesn't clear onsite.

**Fixed-size tiles.** Every week tile and row is the same size
whatever it contains, so the colours always run to the borders. Notes
therefore aren't printed inside cells: a small dot marks a shift with a
note (click it, or hover, to read it), and the red * does the same for
manual swaps.

**Viewing one pharmacist.** The **Show** dropdown above the rota
(Everyone / My shifts / any pharmacist) hides everyone else and any
week with none of their shifts, and shows their shift count for the
period. It's view-only; choose Everyone to edit again.

**Requesting a swap from the rota.** On-call pharmacists hold **Ctrl** (**Cmd** on a Mac), click one or more of their *own* upcoming shifts, then click one or more shifts belonging to *one* colleague, and press **Request swap** in the bar that appears. On a phone or tablet, **Select shifts to swap** replaces the Ctrl key. At least one of the selected shifts must be the requester's own (you can't arrange a swap between two other people), shifts in the past and empty cells can't be swapped, and the database enforces the same rules. The colleague then accepts or declines in the Swaps tab, with approval as set in Admin → On-Call Settings. Everyone signed in can see who is on call (via `get_oncall_people()`, names only). A shift with a swap in progress is shown to everyone with a dashed outline and a ⇄ badge (orange = awaiting the colleague's reply, purple = agreed and awaiting Lead approval; hover for who is swapping). **A date can only be in one swap at a time**: it can't be offered in another request until the first is cancelled, declined or rejected (enforced in the database, so two people can't both grab it).

**Manual swaps (the red \*).** When a Lead Pharmacist, Clinical Team
Lead or Developer replaces the person on a shift, a red **\*** appears
next to the new person's initials. Click it (anyone can) for the
detail, e.g. "IY swapped with AM due to sickness. IY now covering.",
plus who made the change and when. Type the reason in the cell's
"Reason / note" box (just "sickness" is enough). Swaps agreed between
pharmacists through the Swaps tab are not starred; they are logged in
the audit trail instead.

**Selecting several shifts.** Hold **Ctrl** (⌘ on Mac) and click as
many cells as you like (Overnight and Onsite can be mixed); a bar
appears at the bottom to choose the person and an optional reason, then
**Assign**. Esc clears the selection.

**On-call audit trail.** The **Audit Trail** tab on the rota page
shows every on-call action — allocations, manual swaps, swap requests
and approvals, bank holidays, periods — in plain English, newest first.
Unlike the main audit trail (Clinical Team Lead+), every user with
access to the rota can see it (it only exposes on-call entries).

**Resetting the on-call rota only.** Developer → Admin → Reset tab →
**Reset On-Call Rota** (password re-entry required) deletes all
on-call shifts, swap requests, on-call bank holidays and rota periods,
and nothing else: leave data, accounts, pool eligibility, swap
settings, Huddle Board and Quick Links stay, and the audit trail logs
the reset. (The separate "Reset App Data" never touched the on-call
rota.)

**Backup.** The daily emailed backup (§17) now also contains
one **visual rota sheet per rota period and site** (e.g. "OC 2027
Worthing": every day of the period with Overnight and Onsite, the same
green/pink/bank-holiday colours as the page, * for manual swaps and
notes), plus flat **On-Call Rota** (every shift, full names, who was
replaced and why), **On-Call Bank Holidays**, **On-Call Periods**,
**On-Call Swaps** and **On-Call Audit** tabs covering the full history.

**Swaps.** Pool members can offer any of their own upcoming shifts
and ask for any of a colleague's in return, from the **Swaps** tab —
a pure give-away (nothing asked back) and an uneven trade (e.g. 3
days for 4) are both supported; it isn't restricted to 1-for-1. Both
people have to agree before anything changes. Once they do, each
site's setting (Admin → On-Call Settings, Developer-only to change)
decides what happens next:
- **Automatic** — the swap applies immediately.
- **Requires approval** — it queues on the **Swap Approvals** tab for
  a Lead Pharmacist, Clinical Team Lead, or Developer to approve or
  reject.

Pool members see their own upcoming shifts under **My On-Call
Dates**. Every eligibility change, assignment, and swap action is
written to the same audit trail as the rest of the app (`audit_log`
— see §14).

## 17b. Huddle Board

`huddle.html`. Two boards — **Worthing** and **St Richard's** — with
tabs for *Both sites*, *Worthing* or *St Richard's* (everyone can view
either or both).

- **Posting.** Lead Pharmacist, Clinical Team Lead and Developer can
  post. A post is made to both sites at once or to a single site (one
  post, tagged with its sites), with a title, text and optional **PDF
  attachments** (up to 10 per post, 10 MB each). PDFs live in the
  private `huddle-attachments` Storage bucket (created by `schema.sql`)
  and open through short-lived signed links.
- **Pinning.** Lead+ can pin/unpin. A pin belongs to the post, so it
  applies on every site the post is shown on. Pinned posts sit at the
  top of the unfiltered view.
- **Editing and deleting.** The author, or a Clinical Team Lead/
  Developer, can edit or delete a post. Deleting hides it (it stays in
  the database and audit trail).
- **History and search.** Nothing expires; older posts load with
  "Load more". The search box looks in both the title and the body;
  every word you type must appear somewhere in the post, in any order.
- All posting, editing, pinning and deleting goes through database
  functions that check your role, and is written to the audit trail.

**Reactions and comments.** Everyone signed in (not just Lead Pharmacists)
can react to any post **and to any comment** with ❤️ 👍 😂 😢 😮 — one of each
per person. Only reactions that have been used are shown (with a count;
hovering shows who); the smiley **+** button pops up the five choices, and
clicking a shown reaction again takes yours back. People can also add comments (up to 2,000 characters) under "Comment".
A comment can be deleted by whoever wrote it; a Clinical Team Lead or
Developer can also remove anyone's (that is recorded in the audit trail).

**Who can edit a post.** Only the person who made it (they must still be a
Lead Pharmacist or above). Nobody else — including Clinical Team Leads and
the Developer — can edit someone else's post. Delete is unchanged: the
author, or a Clinical Team Lead / Developer for moderation. Re-run
`schema.sql` to add the new tables and functions.

## 17c. Quick Links

`links.html`. A grid of tiles, each a name, a link and an optional
logo. Everyone can click through (links open in a new tab); only the
Lead Pharmacists, Clinical Team Leads and the Developer can add, edit,
reorder (arrows) or delete tiles — but only after pressing the **Edit
links** button at the top. That reveals Add link plus Edit / Delete / arrow
controls on every tile (tiles don't open their links while editing);
**Done** puts the page back to normal. Everyone else just sees the tiles.
Re-run `schema.sql` so the quick-link functions accept Lead Pharmacists.
Logos are
resized to 128 px in the browser and stored inside the database (a
strict security policy blocks images from other sites), so no external
hosting is needed. Only `http://`/`https://` links are accepted.

**Tile text (optional).** Add or edit a tile and fill in *Text* (up to
1,000 characters, line breaks kept). A tile with text shows a small arrow;
the **first click expands it to show the text** and the **next click opens
the link**. Opening another tile, pressing Escape or clicking elsewhere
folds it back up; selecting the text to copy it doesn't trigger the link.
Tiles without text open the link on a single click as before. Re-run
`schema.sql` to add the column (it also replaces `create_quick_link` /
`update_quick_link` with versions that take the text).

## 17c-2. Home-screen banners

A banner is a short message (up to 500 characters; web links become
clickable) shown at the top of the Pharmacy Portal home page to **everyone
at Worthing and St Richard's**. **Only Clinical Team Leads and the Developer**
see a **Manage banners** button on the home page (Pharmacists and Lead
Pharmacists cannot post, and the database refuses it too) to add,
edit, hide/show or delete them, with a live preview. The list and the edit
form show **who posted each banner and when**, and who last edited it. Choose a style
(information blue, good-news green, warning amber, urgent red) and
optionally a *show from* / *show until* date so a banner appears and expires
by itself (dates use UK time). Hidden, scheduled and expired banners are
visible only to those who manage them. Every create / edit / delete is
recorded in the audit trail. Re-run `schema.sql` (adds `home_banners`,
`save_home_banner`, `delete_home_banner`).

## 17d. Themes by month and seasonal animations

**Theme by month.** Admin → Appearance → *Theme by month* (Clinical Team Lead or Developer)
lists the twelve months, each with a theme drop-down. A month with a
theme shows it to **everyone** automatically for that whole month
(overriding each person's own theme) and repeats every year — e.g.
October → Halloween, December → Christmas, April → Easter. Months left
on "No theme" use each person's own theme as before. Changes are
audit-logged (`set_theme_for_month`). Re-run `schema.sql` to add the
`theme_schedule` table and function.

**Animations.** *Christmas*: snowflakes falling across the page, trees
with twinkling lights and reindeer trotting along the banner (glowing
nose). *Halloween*: glowing, flickering carved pumpkins, ghosts floating
in the banner and drifting across the page. *Easter*: every 90 seconds a bunny hops in from the left (side view), stops half-way across, turns to look at you, then hops off to the right; chicks peck and decorated eggs sit along the banner. *Swiftie* (light, pastel purple/pink/gold): twinkling sparkles, drifting hearts and music notes, a banner strip with two swinging disco balls and shimmering friendship-bracelet bead strands, and a slowly shifting colour sweep. It uses generic sparkle motifs only (no likeness, lyrics, logos or album artwork). *Antimicrobial* (dark, deep petri-dish teal): bacteria (rods, clusters, spirals) and viruses (spiky and bacteriophage) float slowly up the page, while a banner strip of drifting microbes, antibiotic capsules and bubbles sits under the top bar. It is chosen like any other theme (per user, or per month under Appearance → Theme by month; re-run `schema.sql` so the database accepts it). The eight newer themes are all generic drawn scenes (no characters, logos or brand imagery): *Barbie-style* (hot pink, sparkles, hearts, sunglasses, a pink convertible), *Fairytale* (dark, twinkling stars, shooting stars, a generic castle and fireworks), *Autumn* (falling leaves, orange trees), *Winter* (snowfall, icicles, pines, a snowman), *Spring* (petals, tulips), *Summer* (sun, drifting clouds, sunflowers, beach ball), *Seaside* (waves, lighthouse with beam, sailboat) and *South Downs* (layered green hills, windmill, grazing sheep). Four national-day themes use only generic drawn emblems: *St David's Day (Wales)* (daffodils, leeks, a stylised red dragon, green/white/red bunting, falling petals), *St George's Day (England)* (red-cross flags and bunting, roses, falling petals), *St Patrick's Day (Ireland)* (shamrocks, rainbow, pot of gold, coins) and *St Andrew's Day (Scotland)* (blue saltire flags and bunting, thistles, drifting thistledown). Five specialty themes (generic drawn artwork): *Emergency Hospital Care* (red, flashing blue/red sirens, an ambulance driving across, a scrolling ECG trace, rising crosses), *Surgical Care* (theatre teal, swinging operating lights, a monitor, scalpels and scissors, bubbles), *Intensive Care* (dark, three scrolling monitor traces, a pulsing heartbeat dot, an IV bag with a falling drip, floating vital-sign numbers), *Elderly Medicine* (soft plum and cream: steaming teacups, a ticking clock, spectacles, balls of wool, plants, floating hearts) and *Paediatrics* (bright primary colours: balloons, a rainbow, building blocks, a teddy bear, stars). Three more specialty themes: *Cardiology* (burgundy and rose, beating hearts, stethoscopes, a scrolling ECG, floating blood cells and hearts), *Endocrine* (purple and teal: a thyroid, glucometer, insulin pen, glucose and hormone molecules) and *Respiratory* (sky blue: breathing lungs, inhalers, drifting wind lines, bubbles). The Emergency and Intensive Care themes were slowed down (ECG traces, ambulance, sirens, heartbeat and drip all run at roughly half speed or slower). All are click-through
decoration, switched off for people whose device is set to "reduce
motion", and hidden when printing.

**Halloween and Christmas are dark.** Both themes always use dark surfaces
(unless the person has chosen Inverted). **Animations on/off:** whenever a seasonal
theme is showing, an *Animations: On/Off* button appears in the top bar.
Animations are on by default; the choice is remembered per browser/device.

## 16. Before going live — please test locally against a real project first

This was built to spec but hasn't been run against a live Supabase
instance yet. Before trusting it with real rota data:
- Re-run through the full RLS test matrix (a Pharmacist trying to
  approve their own leave, a Clinical Team Lead trying to create
  another Clinical Team Lead or hide a Developer, a Lead Pharmacist
  trying to un-tick Clinical Rota Completed, etc.) against your actual project.
- Check the `email_for_user_id` RPC doesn't leak whether a User ID
  exists to an unauthenticated caller in a way you're not comfortable
  with (it currently returns `null` either way, which is intentional).
- Decide whether you want IP-based rate limiting on the login lookup,
  as was added to the Bee List after its own security review — it
  wasn't included here to keep the first cut simple, but the pattern
  carries over directly if you want it.
- If you were previously running an earlier version of this app with
  `half_day_am`/`half_day_pm` leave already in use, note that
  `schema.sql`'s migration replaces that check constraint outright —
  any existing rows of those types would need converting to the new
  TOIL types by hand; there's no automatic data migration for that.
- The new `snapshot_primary_site`/`snapshot_cross_site` columns on
  `leave_requests` are backfilled from each row's **current** profile
  the first time you run the updated `schema.sql` on an existing
  database — that's the closest available approximation, since the
  actual site at the historical time of request isn't recoverable.
  Anything requested after that point captures the real snapshot going forward.
- If you had restricted days set up before they became per-site, the
  migration duplicates each existing marking across **both** sites the
  first time you run the updated `schema.sql`, so nothing that used to
  show disappears — it just now technically exists as two rows (one
  per site) that you can edit independently going forward.

## 18. "Temporarily unavailable" pages (Supabase / GitHub down)

If Supabase (the database/login) is unreachable, the portal shows this instead of a broken page:

| What's down | What people see | Where it lives |
|---|---|---|
| **Supabase** (the database/login) — the portal still loads from GitHub | A full-screen "The portal is temporarily unavailable" message. It retries every 15 s and reloads itself when the service is back. People are **not** signed out. A failed sign-in caused by an outage says so instead of "wrong password". | Built into `shared.js` — nothing to set up. Optional contact line: set `OUTAGE_CONTACT` at the top of the outage section. |

(If GitHub Pages itself is down, the portal can't load at all — nothing in this project can show a page in that case.)


## Two limited roles: Technician and Senior Technician

Added alongside Pharmacist / Lead Pharmacist / Clinical Team Lead / Developer. Re-run `schema.sql` (it also renames any accounts created under the earlier names), then redeploy the four edge functions that list roles: `admin-create-user`, `admin-invite-users`, `complete-invitation` and `send-leave-backup`. Without the schema run the database rejects the new roles, and without the function redeploy the invite/create forms answer "invalid role".

- **Technician** (`technician`): can only see the **Huddle Board** and **Quick Links** (plus the portal home). The Leave Manager, My Leave, On-Call Rota and Admin are hidden and the database refuses to return leave or rota data to this role. View-only on the Huddle Board: no posting, reacting or commenting.
- **Senior Technician** (`senior_technician`): can **post on the Huddle Board** (create, edit and delete their own posts, with PDF attachments; react and comment), see **Quick Links**, and view the **On-Call Rota** read-only (no swaps, no editing). No leave calendar or My Leave. Cannot pin posts, manage Quick Links or delete other people's posts.
- Neither role takes leave, is in the on-call pool or appears on the backup workbook, and leave can never be allocated to them.
- Set when inviting or creating a user, or from Admin → Users → Edit role (Clinical Team Lead or Developer). The Users filter lists both.
- Enforced in the database (RLS and role checks inside the functions), not only by hiding buttons. Names on Huddle posts come from `get_name_directory()` (names only), so Technicians never receive roles, sites or leave information.

## Theme control: who can pick, apply to all, lock

- **Everyone** gets a theme picker in the top bar (beside Display mode), listing the themes a Developer has left open.
- **Admin → Appearance → "Themes people can choose"** (Developer only): untick a theme to make it Developer-controlled (only a Developer can assign it). People keep any theme they already have.
- **Apply a theme** (Clinical Team Lead+) applies one theme to all or selected users. A Developer can also **lock** them into it (they can't change it) or **unlock** them. **Users → Edit theme** has the same Lock tick per person.
- Priority: a locked theme beats the monthly schedule, which beats a person's own pick. Developers are never restricted or locked.
- Re-run `schema.sql` (adds `theme_restrictions`, `profiles.theme_locked`, `set_own_theme`, `set_theme_restrictions`; `set_user_theme` / `set_user_theme_bulk` gain a lock argument).

## Approver notes on approval

When approving leave (Approvals page, a single request on the calendar, or Ctrl+click several tiles then Approve selected), the approver gets an optional note box. A note on a multi-approve is saved against every request approved in that go. Notes live in `leave_approver_notes`, which only Lead Pharmacist and above can read, so the requester, other pharmacists and technicians never see them; approvers see the note in the leave's detail pop-up on the calendar. Re-run `schema.sql` (new table; `approve_leave` gains a third `p_approver_note` argument).

## More themes: Night Sky / Space, Deep Ocean, Botanical Garden, Retro 80s, Library / Study, Windows 98

Six more theme keys (`nightsky`, `deepocean`, `botanical`, `retro80s`, `library`, `win98`). Night Sky, Deep Ocean and Retro 80s use dark surfaces; Library has a parchment look; Windows 98 forces the grey-bevel desktop style whatever the Light/Dark mode. Animations are gentle and obey the Animations switch / reduced-motion. Re-run `schema.sql` (theme lists) and upload `shared.js`, `shared.css`, `portal.html`.

## Five more themes + a rename

Arcade (original pixel creatures), Rainforest, Tropical Island, City Skyline at Dusk and Desert Sunset (keys `arcade`, `rainforest`, `tropical`, `skyline`, `desert`). The theme previously labelled "Swiftie" is now called "Taylor Quick" (same key, so nobody's saved theme changes). Re-run `schema.sql`; upload `shared.js`, `shared.css`, `portal.html`.

### Space Conflict theme
Original space-opera theme (`spaceconflict`): a blue fleet and an amber fleet trade slow laser bolts in front of a ringed gas giant, with hyperspace-dark surfaces and amber/ice-blue accents. All ships and planets are original designs. Files: `shared.js`, `shared.css`, `portal.html`, and `schema.sql` (re-run it so the new theme key is accepted).

### EF / AAU and ED&G ADP themes
The *Emergency Hospital Care* theme is now labelled **EF / AAU** (key unchanged, so saved choices keep working). New **ED&G ADP** theme (`edgadp`, Advanced Development Programme): dark classified-dossier look with magenta and teal accents, a scanning beam, CLASSIFIED / RESTRICTED ACCESS stamps, redacted bars, a radar, padlock, fingerprint and slowly rising hex codes. Re-run `schema.sql`; upload `shared.js`, `shared.css`, `portal.html`.

*Update:* ED&G ADP was restyled as a generic intelligence-agency look (navy, manila and stamp red: manila files, TOP SECRET / RESTRICTED ACCESS stamps, redacted pages, a world map with tracked locations, magnifier, camera, drifting documents and coordinates). It uses no real agency seal or logo.

### Fish Zoo theme
Bright aquarium theme (`fishzoo`, light): clownfish, angelfish, a pufferfish and other fish swim across the banner and page; coral, weed, a castle, treasure chest and starfish sit on the sand; bubbles and a jellyfish drift. All artwork is original. Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### Rock Pool theme
Bright cartoon seabed-town theme (`rockpool`, light): bold-outline kelp, a teapot house, a boot cafe, a shell hut, a signpost, anemones and a sun glow in the banner, with bubbles and jellyfish drifting up the page. Environment only, no characters, all original artwork. Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### Discount Items theme
Generic bargain-marketplace theme (`flashsale`, light): orange/red banner with discount tags, a shopping cart, a countdown timer, gift boxes, lightning bolts and parcels sliding past; confetti and parcels drift down the page. No brand names, logos or mascots. Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### Wizard Academy theme
Generic magic-school theme (`wizard`, dark purple and gold): a candlelit castle silhouette with lit windows, floating candles, a pointed hat, potions, spellbooks and a wand in the banner; twinkling stars, shooting stars and slowly rising candles on the page. Original artwork, no franchise names, symbols or characters, and no birds. Re-run `schema.sql`; upload `shared.js`, `shared.css` and `portal.html`.

*Wizard Academy:* the mouse cursor becomes a small wand with a spark at its tip (clickable things show the same wand; text fields keep the normal text cursor).

### Hospital Pharmacy theme
Clean dispensary theme (`hospharm`, light green/teal): two shelves of medicine boxes, a floating pharmacy cross, prescription pad, mortar and pestle and blister pack in the banner, capsules and tablets drifting down the page, with faint crosses rising. Generic artwork. Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### Clinical Informatics theme
Dark health-IT theme (`clinfo`, navy with blue and green data colours): record screens, database stacks, a server rack, a pulsing network graph, SQL-style query text, a workflow diagram and a scanning barcode in the banner; faint code and query snippets (SELECT, FHIR, HL7, SNOMED) rise up the page. Generic artwork. Re-run `schema.sql`; upload `shared.js`, `shared.css` and `portal.html`.

### The Bee List theme
Honey-and-hive theme (`beelist`, light yellow): uses the supplied bee illustration (`bee.png`, must be uploaded next to `shared.js`). The wings are a clipped copy of the image that flaps quickly (turned off with Animations: Off). Bees hover and bob in place (they do not fly across the page). Banner: honeycomb background, a skep hive, honey pot, flowers and hexagons; honey drops fall and hexagons rise up the page. Re-run `schema.sql`; upload `bee.png`, `shared.js` and `shared.css`.

### NHS Blue theme
NHS-style blue theme (`nhsblue`, light: NHS-style blue, dark blue and warm yellow): hospital buildings, a rainbow, a pulsing heart, a stethoscope, a ward bed and a clipboard in the banner, with soft hearts rising and faint rainbows drifting across the page. It deliberately does not draw the NHS logo, lozenge or wordmark (a protected identity). Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### Camo theme
Woodland camouflage theme (`camo`, dark olive): a camo-pattern banner with swaying pines, a tent, compass, binoculars, dog tags and stencil text, a faint camo overlay and falling leaves on the page. Generic artwork. Re-run `schema.sql`; upload `shared.js`, `shared.css` and `portal.html`.

### UFO theme
Night-field theme (`ufo`, dark navy with green and purple glow): flying saucers with blinking lights, a tractor beam lifting a cow, a barn, a crop circle, little aliens and a moon in the banner; twinkling stars, shooting stars and two saucers drifting slowly across the page. Original artwork. Re-run `schema.sql`; upload `shared.js`, `shared.css` and `portal.html`.

### Ancient Egypt, Ancient Rome and Ancient Greece themes
Three light historical themes (`egypt`, `rome`, `greece`) with original drawn scenery and no birds. *Egypt* (lapis blue and gold): pyramids, a sphinx, obelisk, palm, ankh and Eye symbols, a sun disc, reeds; drifting sand. *Rome* (crimson and gold): a colosseum, aqueduct, columns, laurel wreath, shield, helmet and cypress trees; drifting laurel leaves. *Greece* (Aegean blue and white): a temple, columns, olive branches, amphorae, a lyre and a trireme on gentle waves, with a Greek-key border under the top bar; drifting olive leaves. Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### April Fools theme
Loud, playful theme (`aprilfools`, purple, pink and yellow): a rainbow-striped banner with a jester hat, a banana peel, a whoopee cushion, a rubber duck, a snake-in-a-can, a pie, a "GOTCHA!" bubble, a "KICK ME" sign, dangling spiders and balloons; confetti falls and balloons rise on the page. Headings use a comic font and the home tiles sit very slightly crooked (straight again with Animations: Off). Re-run `schema.sql`; upload `shared.js` and `shared.css`.

*April Fools prank:* on the home page the tiles run away from the mouse pointer (mouse only; keyboard Tab/Enter and touch still work) until the user switches Animations to Off in the top bar, which stops it and straightens the tiles.

### Updates (22 Oct)
- *The Bee List* is now labelled "The Bee List™" and the falling honey drops were removed.
- *Winter* was redone: a snowy cabin village (cabin with a glowing window and chimney smoke, lamp post with glow, snow-capped pines, a snowman with a scarf), a soft aurora, ice crystals, a moon, and layered snowfall.
- *UFO*: the banner saucer, its tractor beam and the cow are now one group so the beam stays attached as the saucer bobs.
- New *Word Processor* theme (`wordproc`, light grey and blue): a 1990s word-processor look with clip-art style icons (bulb, globe, trophy, envelope, smiley, briefcase, calculator, starbursts), WordArt-style "Pharmacy Portal" text, serif headings with a red wavy "spell-check" underline on the page title, and an original pencil helper called Penny who waves and shows rotating tips in a speech bubble (sits still with a single tip when Animations is Off). Penny is an original character and is not based on any Microsoft assistant. Re-run `schema.sql`; upload `shared.js` and `shared.css`.
- Housekeeping: several newer themes had accidentally reused sprite names from older themes (capsule, hex, drop, rainbow, pine, leaf, palm, balloon, tulip); they now have unique names so older themes draw correctly again.

*Word Processor:* Penny now shows six tips per page load, mixing page-specific tips (e.g. Leave Manager, Approvals, Huddle Board, On-Call Rota, Admin) with a random selection from a general pool, in a random order, each visible for six seconds.

### Calm Forest theme
Soft, slow, low-contrast misty woodland (`calmforest`, light sage green with muted gold): layered conifers and an oak, a slim deer that walks across, stops to graze, then walks on, a brown bunny hopping through the trees (pausing three times per crossing), ferns, mushrooms and a mossy rock in the banner with faint sunbeams and drifting mist; on the page a few leaves fall very slowly, mist drifts and fireflies glow softly. Nothing flies. Re-run `schema.sql`; upload `shared.js` and `shared.css`.

### Storm Austen theme
A dark, stormy theme (`stormaustin`, slate blue with lightning yellow): slanted rain across the page, wind streaks and leaves blown right-to-left, soft rare lightning flashes (gentle, well under 3 per second), and a banner of racing storm clouds, trees bending in the wind, a flapping windsock, a street lamp, a tumbling umbrella, rippling puddles and a flashing bolt. No birds or insects. Turning animations off removes the rain, wind and flashes. Re-run `schema.sql`; upload `shared.js`, `shared.css` and `portal.html`.

### Critical Care theme (replaces Intensive Care)
The old dark *Intensive Care* theme is replaced by a bright, colourful **Critical Care** theme (same internal key `intensive`, so anyone who had picked it keeps it). Vivid blue banner with neon ECG, pleth and wave traces, a ventilator, syringe pump, drip, pulsing heart and vitals; on the page, coloured vitals numbers and hearts drift upwards on a light surface. Upload `shared.js`, `shared.css` and `portal.html`; no `schema.sql` change.

### Pharmacy Admin role (read-only)
New account type `pharmacy_admin` ("Pharmacy Admin"). It can VIEW everything (the full leave calendar and everyone's leave, Approvals, Admin, Audit Trail, on-call rota and swaps, Huddle Board, Quick Links, users, approver notes) but can never request, amend, approve, reject or delete anything, and has no leave of its own (no "My Leave", not in the on-call pool, not counted in leave capacity or in the backup's staff list).
- **Database (authoritative):** `schema.sql` adds the role to the role checks, two helpers (`is_pharmacy_admin()`, `can_view_all()`), and extends the SELECT policies only. Every write already goes through an RPC gated by `is_staff()` / `is_lead_plus()` / `is_superuser_plus()` / `can_post_huddle()`, none of which include the new role, so it is refused server-side ("your account is read-only"). Reactions/comments on the Huddle Board are blocked too. Tested on a scratch Postgres: reads work, `request_leave`, `approve_leave`, `reject_leave`, huddle reactions and `set_user_role` are all refused.
- **Pages:** a yellow "Read-only account" banner shows under the top bar; Save/Add/Approve/Delete-style buttons are hidden; the browser also refuses to call any write function (friendly message). It can still change its own theme and Light/Dark mode.
- **Creating one:** Admin → Users / Invitations → choose role "Pharmacy Admin" (Clinical Team Lead and Developer can).
- **Deploy:** upload `shared.js`, `shared.css`, `admin.html`, `approvals.html`, `audit.html`, `calendar.html`, `huddle.html`; re-run `schema.sql`; redeploy the edge functions `admin-create-user`, `admin-invite-users`, `complete-invitation` and `send-leave-backup` (keep Verify JWT off for `send-leave-backup`).

*Pharmacy Admin:* now sees the same approver notes as a leave approver (the asterisk on noted tiles and the note in the leave detail box). Only `calendar.html` changed for this; the database already allowed it.


### Supabase Data API grants (from 30 Oct 2026)
Supabase stops auto-granting access to *new* `public` tables on 30 Oct 2026. Existing tables are unaffected. `schema.sql` now ends with explicit grants (SELECT for `authenticated`, full for `service_role`, nothing for `anon`; RLS still gates reads and all writes go through RPCs), so a new project or `supabase db reset` works. When adding a new table later, include its `grant select ... to authenticated;` in the same migration.


### My Tasks (tasks.html)
A private personal task tracker open to **every role** (including technicians and Pharmacy Admin). Two lists: **Long-term** (title, deadline, optional note; a bar fills from the day it was added to the deadline and turns green → amber → red, with "N days left" / "Overdue") and **Daily list** (today's tasks with a progress bar; ticked tasks clear at midnight, unfinished ones can be carried over or discarded). Table `personal_tasks` has RLS select-own only and all writes go through `add_/update_/toggle_/delete_personal_task` and `carry_over_personal_tasks`, each restricted to `auth.uid()` — nobody else (including Developers) can see or change another person's tasks. Re-run `schema.sql`; upload `tasks.html`, `portal.html` and `shared.js`.


### Set tasks and notifications
**Set tasks** (third tab on `tasks.html`): a task can be set for one or several people at once. Clinical Team Lead → Pharmacists and Lead Pharmacists; Lead Pharmacist → Pharmacists only; Developer → Pharmacists, Lead Pharmacists and Clinical Team Leads. Users of the same grade can't set tasks for each other (enforced in `can_set_task_for()`). The recipient sees them under "Set for me" and ticks them off. **Who sees what** (`can_view_assigned_task()`, also the RLS policy): a Pharmacist sees only their own; a Lead Pharmacist sees tasks set for any Pharmacist plus their own, never another Lead Pharmacist's; a Clinical Team Lead sees tasks set for Pharmacists and Lead Pharmacists plus their own; a Developer sees all. Only the person who set a task can delete it.

**Notifications** (bell in the top bar, unread count, Mark all read / Clear all): sent by database triggers when leave is approved (several days approved together become one notice), when a task is set for you, when an on-call swap is requested of you, and when a swap is approved (both people). Table `notifications` is select-own only. Re-run `schema.sql`; upload `tasks.html`, `shared.js`, `shared.css`.


### Huddle Board hyperlinks
In the post editor, highlight some text and click **Add link** (or press Ctrl/Cmd+K), paste the web address and press Apply. The link is stored in the post text as `[text](https://address)` (no database change) and shown as just the highlighted text, opening in a new tab. Only `http://` and `https://` addresses are accepted; plain web addresses typed into a post or comment are still linked automatically. Upload `huddle.html`.

**Text formatting:** the same editor toolbar also has **Bold, Italic, Underline, Strikethrough** (Ctrl/Cmd+B / I / U), an 8-colour **text colour** picker (with Remove colour) and a **Preview** button. Formatting is stored as simple tags in the post text (`[b]..[/b]`, `[i]`, `[u]`, `[s]`, `[color=#rrggbb]..[/color]`); only those exact tags and the fixed colour format are rendered, everything else stays escaped, so no database change and no script injection. Upload `huddle.html`.

**Set a task dock:** on the Set tasks tab (Lead Pharmacists, Clinical Team Leads, Developers) the "Set a task" form is docked to the bottom of the screen as a teal bar and expands upwards when clicked (Esc or clicking the bar closes it; it closes itself after a task is set). Upload `tasks.html`.

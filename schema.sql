-- =====================================================================
-- LEAVE MANAGEMENT SYSTEM — SCHEMA
-- by ED&G
-- Idempotent: safe to re-run against an existing database.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- TABLES
-- =====================================================================

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  user_id             text not null unique,           -- login id, e.g. jsmith
  initials            text not null unique,            -- e.g. KP — shown on calendar chips
  full_name           text not null,
  role                text not null check (role in ('pharmacist','lead_pharmacist','superuser','developer','technician','senior_technician','pharmacy_admin')),
  active              boolean not null default true,
  must_reset_password boolean not null default true,
  primary_site        text not null default 'worthing' check (primary_site in ('worthing','st_richards')),
  cross_site          boolean not null default false,  -- works at both sites; leave shows/pending/approves on both
  hidden_by_superuser boolean not null default false,  -- soft-delete: hidden from Superuser's admin list, Developer still sees it, nothing actually removed
  deleted_by_developer boolean not null default false, -- Developer's permanent "delete": access revoked for good, leave history retained
  theme               text not null default 'default',   -- Developer-settable colour palette — see set_user_theme()
  color_mode          text not null default 'light' check (color_mode in ('light','dark','inverted')), -- user's own Light/Dark/Inverted display preference — see set_own_color_mode()
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

-- Idempotent migration for databases created before these columns existed.
alter table public.profiles add column if not exists primary_site text not null default 'worthing';
-- One account per email address. Real addresses are never stored on a
-- profile; instead a keyed hash (HMAC-SHA256, computed in the edge
-- functions) is kept so a second account for the same address can be refused.
alter table public.profiles add column if not exists email_hash text;
create unique index if not exists profiles_email_hash_uniq on public.profiles(email_hash) where email_hash is not null;
alter table public.profiles add column if not exists cross_site boolean not null default false;
alter table public.profiles add column if not exists hidden_by_superuser boolean not null default false;
alter table public.profiles add column if not exists deleted_by_developer boolean not null default false;
alter table public.profiles add column if not exists theme text not null default 'default';
alter table public.profiles add column if not exists theme_locked boolean not null default false;  -- Developer lock: the person can't change their own theme (see set_own_theme)
alter table public.profiles add column if not exists color_mode text not null default 'light';
-- Leaver details, set when an account is suspended with a last working
-- day (see suspend_user()) and cleared again when it is reactivated.
-- Leave dated AFTER suspended_last_day is shown greyed out on the calendar.
-- Only the date is exposed to everyone (via get_profile_directory); the
-- leaving time and note stay with Clinical Team Lead / Developer.
alter table public.profiles add column if not exists suspended_last_day   date;
alter table public.profiles add column if not exists suspended_leave_time time;
alter table public.profiles add column if not exists suspended_note       text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_primary_site_check') then
    alter table public.profiles add constraint profiles_primary_site_check check (primary_site in ('worthing','st_richards'));
  end if;
  -- Unlike the other constraints here, this one is dropped and
  -- recreated on every run rather than left alone once it exists —
  -- the allowed theme list has already grown once (seasonal themes
  -- added after the original four) and will likely grow again, so
  -- re-running this script should always bring it up to date rather
  -- than requiring a one-off manual ALTER each time. Keep in sync
  -- with THEMES in shared.js.
  alter table public.profiles drop constraint if exists profiles_theme_check;
  alter table public.profiles add constraint profiles_theme_check
    check (theme in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm'));
  if not exists (select 1 from pg_constraint where conname = 'profiles_color_mode_check') then
    alter table public.profiles add constraint profiles_color_mode_check check (color_mode in ('light','dark','inverted'));
  end if;
end $$;

create table if not exists public.bank_holidays (
  holiday_date date primary key,
  name         text not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- Restricted-leave marking: superuser+ can highlight a day or a whole
-- range, PER SITE, with a label and a custom colour (e.g. "Restricted
-- Leave — Christmas" in whatever shade/intensity they pick from the
-- colour table), independent of bank holidays. Same date can carry a
-- different (or no) marking at each site.
create table if not exists public.restricted_days (
  site            text not null check (site in ('worthing','st_richards')),
  restricted_date date not null,
  label           text not null,
  highlight_color text not null default '#fdf1b8'
                  check (highlight_color ~ '^#[0-9a-fA-F]{6}$'),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  primary key (site, restricted_date)
);

-- Idempotent migration for databases created before restricted days
-- were site-specific: add the column, then duplicate every existing
-- (global) row across BOTH sites so it keeps applying exactly as it
-- did before — a marking that used to show everywhere still does,
-- until someone edits it to a single site going forward.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'restricted_days' and column_name = 'site'
  ) then
    alter table public.restricted_days add column site text;
    alter table public.restricted_days drop constraint if exists restricted_days_pkey;

    insert into public.restricted_days (restricted_date, label, highlight, created_by, created_at, site)
    select restricted_date, label, highlight, created_by, created_at, 'st_richards'
      from public.restricted_days where site is null;

    update public.restricted_days set site = 'worthing' where site is null;

    alter table public.restricted_days alter column site set not null;
    alter table public.restricted_days add constraint restricted_days_site_check
      check (site in ('worthing','st_richards'));
    alter table public.restricted_days add primary key (site, restricted_date);
  end if;
end $$;

-- Idempotent migration for databases created before restricted days
-- used a free-form colour: replace the old two-option highlight
-- ('yellow'/'pink') with an actual hex colour, converting each
-- existing row to the exact shade it used to render as, so nothing
-- visually changes for anyone until they deliberately pick a new
-- colour for a marking.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'restricted_days' and column_name = 'highlight'
  ) then
    alter table public.restricted_days add column if not exists highlight_color text;
    update public.restricted_days
       set highlight_color = case highlight when 'pink' then '#fbdadf' else '#fdf1b8' end
     where highlight_color is null;
    alter table public.restricted_days alter column highlight_color set not null;
    alter table public.restricted_days alter column highlight_color set default '#fdf1b8';
    if not exists (select 1 from pg_constraint where conname = 'restricted_days_highlight_color_check') then
      alter table public.restricted_days add constraint restricted_days_highlight_color_check
        check (highlight_color ~ '^#[0-9a-fA-F]{6}$');
    end if;
    alter table public.restricted_days drop column highlight;
  end if;
end $$;

-- A shared palette of colours worth reusing — saved from the colour
-- table/intensity picker in Admin -> Restricted Days so anyone with
-- access to that page can quickly reapply a shade someone else (or
-- they themselves) already picked, rather than recreating it from
-- scratch. Superuser+ only, same as restricted days themselves.
create table if not exists public.restricted_day_favourite_colors (
  id         bigint generated always as identity primary key,
  color      text not null unique check (color ~ '^#[0-9a-fA-F]{6}$'),
  label      text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Per-site capacity threshold: if this many pharmacists are off
-- (approved or pending — annual/TOIL/study leave all count) on the
-- same day, that day auto-highlights yellow on the calendar.
create table if not exists public.site_settings (
  site                       text primary key check (site in ('worthing','st_richards')),
  leave_capacity_threshold   int not null default 3,
  updated_by                 uuid references public.profiles(id),
  updated_at                 timestamptz not null default now()
);
insert into public.site_settings (site) values ('worthing'), ('st_richards')
  on conflict (site) do nothing;

-- Single-row config for the daily emailed backup (send-leave-backup
-- edge function) — lets a Clinical Team Lead/Developer manage who
-- receives it from Admin -> Daily Backup, rather than only via
-- `supabase secrets set BACKUP_TO_EMAIL=...` on the CLI. A
-- comma-separated list, same format the edge function's env-var
-- fallback already used. Null/empty means "use the BACKUP_TO_EMAIL
-- secret instead" — this table is checked first, but never required.
create table if not exists public.backup_settings (
  id               int primary key default 1,
  recipient_emails text,
  updated_by       uuid references public.profiles(id),
  updated_at       timestamptz not null default now(),
  constraint backup_settings_singleton check (id = 1)
);
insert into public.backup_settings (id) values (1) on conflict (id) do nothing;

-- Superuser+ can force a specific site+date to show red regardless of
-- the automatic capacity calculation above — e.g. to flag a day as
-- critical even before the threshold is technically met.
create table if not exists public.capacity_overrides (
  site           text not null check (site in ('worthing','st_richards')),
  override_date  date not null,
  set_by         uuid references public.profiles(id),
  set_at         timestamptz not null default now(),
  primary key (site, override_date)
);

-- Per-site, per-month Rota-complete / DSR-complete flags and the
-- banners they trigger on the calendar.
create table if not exists public.month_status (
  site               text not null check (site in ('worthing','st_richards')),
  year               int not null,
  month              int not null check (month between 1 and 12),
  rota_complete      boolean not null default false,
  rota_completed_by  uuid references public.profiles(id),
  rota_completed_at  timestamptz,
  dsr_complete       boolean not null default false,
  dsr_completed_by   uuid references public.profiles(id),
  dsr_completed_at   timestamptz,
  primary key (site, year, month)
);

create table if not exists public.leave_requests (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade, -- whose leave
  leave_date            date not null,
  leave_type            text not null check (leave_type in ('full_day','study_leave','toil_full_day','toil_part_day','full_day_split','annual_part_day')),
  -- Only for toil_part_day: a JSON array of {"start":"HH:MM","end":"HH:MM"}
  -- time ranges within that day, e.g. [{"start":"08:00","end":"10:00"},
  -- {"start":"16:00","end":"18:00"}] — a single TOIL request can cover
  -- several separate ranges in the same day. Also used, alongside
  -- annual_leave_ranges below, for the TOIL portion of a full_day_split row.
  toil_ranges           jsonb,
  -- Only for full_day_split: an approver's record of exactly which
  -- hours of a Full Day request were covered by annual leave, when the
  -- requester didn't have enough annual leave for the whole day and
  -- the shortfall was covered by TOIL instead (see split_leave_with_toil()).
  annual_leave_ranges   jsonb,
  -- Only for study_leave when it's a PART day rather than a full day —
  -- same {"start","end"} array shape as toil_ranges. Null means the
  -- study leave is a full day (the original, still-default behaviour).
  study_ranges          jsonb,
  -- Whichever of toil_ranges/annual_leave_ranges/study_ranges applied
  -- at CREATION time, for a part-day request — set once and never
  -- touched again by amend_leave_ranges(), so it always shows what was
  -- originally requested even after an approver corrects/amends the
  -- times. Null for anything that was never a part-day request.
  original_ranges       jsonb,
  status                text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by          uuid not null references public.profiles(id),
  requested_at          timestamptz not null default now(),
  approved_by           uuid references public.profiles(id),
  approved_at           timestamptz,
  rejected_reason       text,
  deleted               boolean not null default false,
  updated_at            timestamptz not null default now(),
  -- Snapshot of the requester's site AT THE TIME the request was made.
  -- The calendar filters by THESE columns, not by the person's current
  -- profile — so editing someone's site assignment later only affects
  -- requests made from that point on, never requests already on record.
  snapshot_primary_site text not null default 'worthing' check (snapshot_primary_site in ('worthing','st_richards')),
  snapshot_cross_site   boolean not null default false
);

alter table public.leave_requests add column if not exists annual_leave_ranges jsonb;
alter table public.leave_requests add column if not exists study_ranges jsonb;
alter table public.leave_requests add column if not exists original_ranges jsonb;
-- Backfill for rows that predate this column: their current ranges
-- become their recorded "original" (the true original, before this
-- feature existed, isn't recoverable — this is the closest sensible
-- baseline). Only touches rows that don't have one set yet, so this
-- is a no-op on every subsequent re-run.
update public.leave_requests
   set original_ranges = case
     when leave_type = 'toil_part_day' then toil_ranges
     when leave_type = 'annual_part_day' then annual_leave_ranges
     when leave_type = 'study_leave' then study_ranges
     else null
   end
 where original_ranges is null
   and (toil_ranges is not null or annual_leave_ranges is not null or study_ranges is not null);
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'leave_requests_leave_type_check') then
    alter table public.leave_requests drop constraint leave_requests_leave_type_check;
  end if;
  alter table public.leave_requests add constraint leave_requests_leave_type_check
    check (leave_type in ('full_day','study_leave','toil_full_day','toil_part_day','full_day_split','annual_part_day'));
end $$;

-- Idempotent migration for databases created before TOIL requests
-- could cover several time ranges: convert the old single-time-point
-- toil_am/toil_pm model into the new toil_ranges array, converting
-- each old single time into a one-off single-point range so the data
-- isn't silently lost (this is a best-effort approximation — the old
-- model only ever stored ONE point in time, not a real range, so
-- there's no way to recover what full range someone originally meant).
alter table public.leave_requests add column if not exists toil_ranges jsonb;
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'leave_requests' and column_name = 'toil_time'
  ) then
    -- Widen the constraint FIRST — the UPDATE below sets leave_type to
    -- 'toil_part_day', which the OLD constraint (still only allowing
    -- 'toil_am'/'toil_pm') would reject.
    if exists (select 1 from pg_constraint where conname = 'leave_requests_leave_type_check') then
      alter table public.leave_requests drop constraint leave_requests_leave_type_check;
    end if;
    alter table public.leave_requests add constraint leave_requests_leave_type_check
      check (leave_type in ('full_day','study_leave','toil_full_day','toil_part_day','full_day_split','toil_am','toil_pm'));

    update public.leave_requests
       set leave_type = 'toil_part_day',
           toil_ranges = jsonb_build_array(jsonb_build_object(
             'start', to_char(toil_time, 'HH24:MI'), 'end', to_char(toil_time, 'HH24:MI')
           ))
     where leave_type in ('toil_am', 'toil_pm') and toil_time is not null;

    -- Now every row is on the new values — tighten the constraint back
    -- down to just what's actually valid going forward.
    alter table public.leave_requests drop constraint leave_requests_leave_type_check;
    alter table public.leave_requests add constraint leave_requests_leave_type_check
      check (leave_type in ('full_day','study_leave','toil_full_day','toil_part_day','full_day_split','annual_part_day'));

    alter table public.leave_requests drop column toil_time;
  end if;
end $$;

-- Idempotent migration for databases created before the site-snapshot
-- columns existed: add nullable, backfill from each row's CURRENT
-- profile (the closest available approximation for pre-existing rows,
-- since the state at the actual time of request is not recoverable),
-- then lock down not-null/default/constraint.
alter table public.leave_requests add column if not exists snapshot_primary_site text;
alter table public.leave_requests add column if not exists snapshot_cross_site boolean;
update public.leave_requests lr
   set snapshot_primary_site = p.primary_site, snapshot_cross_site = p.cross_site
  from public.profiles p
 where p.id = lr.user_id and lr.snapshot_primary_site is null;
update public.leave_requests set snapshot_primary_site = 'worthing' where snapshot_primary_site is null;
update public.leave_requests set snapshot_cross_site = false where snapshot_cross_site is null;
alter table public.leave_requests alter column snapshot_primary_site set not null;
alter table public.leave_requests alter column snapshot_primary_site set default 'worthing';
alter table public.leave_requests alter column snapshot_cross_site set not null;
alter table public.leave_requests alter column snapshot_cross_site set default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leave_requests_snapshot_site_check') then
    alter table public.leave_requests add constraint leave_requests_snapshot_site_check
      check (snapshot_primary_site in ('worthing','st_richards'));
  end if;
end $$;

create index if not exists idx_leave_requests_date   on public.leave_requests(leave_date);
create index if not exists idx_leave_requests_user    on public.leave_requests(user_id);
create index if not exists idx_leave_requests_status  on public.leave_requests(status);
create index if not exists idx_leave_requests_active  on public.leave_requests(leave_date) where deleted = false;

create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  action          text not null,   -- create_leave, approve, reject, edit, amend_leave_ranges, split_leave_with_toil, unapprove, delete, import_historical_leave, create_user, deactivate_user, reactivate_user, set_bank_holiday, remove_bank_holiday, reset_password, set_user_site, set_user_role, set_user_display_name, set_user_theme, set_user_theme_bulk, set_restricted_day, remove_restricted_day, hide_user, unhide_user, delete_user, set_rota_complete, set_dsr_complete, set_capacity_threshold, set_capacity_override, remove_capacity_override, set_backup_recipients, set_backup_schedule, clear_audit_log, reset_app_data, invite_users, accept_invitation, revoke_invitation, complete_oncall_rota_period, set_oncall_user_color, set_theme_for_month, set_theme_restrictions, delete_huddle_comment, create_home_banner, edit_home_banner, delete_home_banner
  actor_id        uuid references public.profiles(id),
  target_leave_id uuid,
  target_user_id  uuid,
  before_state    jsonb,
  after_state     jsonb,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_log_created on public.audit_log(created_at desc);

-- Pre-auth login attempt log, purely for rate limiting in the
-- login-with-user-id edge function (which uses the service role to
-- read/write this — no client-facing RLS policy exists for it at all,
-- so it's unreachable via the REST API regardless). Rows older than a
-- few minutes are meaningless for this purpose and can be purged
-- periodically; nothing in the app currently does that automatically,
-- so it's worth an occasional manual `delete from login_attempts
-- where created_at < now() - interval '1 day'` if this ever gets large.
create table if not exists public.login_attempts (
  id               bigint generated always as identity primary key,
  user_id_attempted text,
  ip_address       text,
  success          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_login_attempts_user on public.login_attempts(user_id_attempted, created_at);
create index if not exists idx_login_attempts_ip   on public.login_attempts(ip_address, created_at);

alter table public.login_attempts enable row level security;
-- Deliberately no policies at all — not even a SELECT one. Only the
-- edge function's service-role client can touch this table.

-- Single-use "forgotten password" links (password-reset edge function). Only the SHA-256 of the
-- token is stored. Service-role only: RLS on, no policies.
create table if not exists public.password_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_resets_user on public.password_resets(user_id);
alter table public.password_resets enable row level security;

-- =====================================================================
-- FIX: deleting a user directly from Supabase Auth was blocked
-- Every foreign key to profiles(id) below was originally left with NO
-- `on delete` behaviour, which defaults to RESTRICT. That silently
-- blocked deleting a user straight from Authentication -> Users in
-- Supabase Studio (which deletes the auth.users row and relies on
-- profiles.id's own `on delete cascade` to follow through) the moment
-- that person had ever performed ANY logged action — requested
-- someone else's leave, approved/rejected anything, created a bank
-- holiday, or simply appeared as audit_log.actor_id once, which in
-- practice is nearly every active account. These now SET NULL
-- instead: the leave request / audit entry / bank holiday etc. is
-- kept exactly as it was, just with the "who" attribution cleared for
-- a person who's since been hard-deleted outside the app. This is
-- unrelated to — and doesn't change — the app's own Developer
-- "Delete account" feature, which remains a soft-delete that never
-- touches auth.users at all; this fix is specifically for the case of
-- deleting a user directly via the Supabase dashboard/API instead.
-- leave_requests.user_id keeps its existing `on delete cascade` — a
-- genuine hard delete via Studio is a deliberate, more destructive
-- action taken outside the app's own safeguards, so losing that
-- person's OWN leave rows (as opposed to just their attribution on
-- other records) is accepted collateral of choosing that path.
-- =====================================================================

alter table public.leave_requests alter column requested_by drop not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'leave_requests_requested_by_fkey') then
    alter table public.leave_requests drop constraint leave_requests_requested_by_fkey;
  end if;
  alter table public.leave_requests add constraint leave_requests_requested_by_fkey
    foreign key (requested_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'leave_requests_approved_by_fkey') then
    alter table public.leave_requests drop constraint leave_requests_approved_by_fkey;
  end if;
  alter table public.leave_requests add constraint leave_requests_approved_by_fkey
    foreign key (approved_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'bank_holidays_created_by_fkey') then
    alter table public.bank_holidays drop constraint bank_holidays_created_by_fkey;
  end if;
  alter table public.bank_holidays add constraint bank_holidays_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'restricted_days_created_by_fkey') then
    alter table public.restricted_days drop constraint restricted_days_created_by_fkey;
  end if;
  alter table public.restricted_days add constraint restricted_days_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'site_settings_updated_by_fkey') then
    alter table public.site_settings drop constraint site_settings_updated_by_fkey;
  end if;
  alter table public.site_settings add constraint site_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'capacity_overrides_set_by_fkey') then
    alter table public.capacity_overrides drop constraint capacity_overrides_set_by_fkey;
  end if;
  alter table public.capacity_overrides add constraint capacity_overrides_set_by_fkey
    foreign key (set_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'month_status_rota_completed_by_fkey') then
    alter table public.month_status drop constraint month_status_rota_completed_by_fkey;
  end if;
  alter table public.month_status add constraint month_status_rota_completed_by_fkey
    foreign key (rota_completed_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'month_status_dsr_completed_by_fkey') then
    alter table public.month_status drop constraint month_status_dsr_completed_by_fkey;
  end if;
  alter table public.month_status add constraint month_status_dsr_completed_by_fkey
    foreign key (dsr_completed_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'profiles_created_by_fkey') then
    alter table public.profiles drop constraint profiles_created_by_fkey;
  end if;
  alter table public.profiles add constraint profiles_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

  if exists (select 1 from pg_constraint where conname = 'audit_log_actor_id_fkey') then
    alter table public.audit_log drop constraint audit_log_actor_id_fkey;
  end if;
  alter table public.audit_log add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;
end $$;

-- =====================================================================
-- ROLE HELPERS  (security definer, owner-bypass-RLS, used inside policies)
-- =====================================================================

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_lead_plus()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() in ('lead_pharmacist','superuser','developer');
$$;

create or replace function public.is_superuser_plus()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() in ('superuser','developer');
$$;

create or replace function public.is_developer()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() = 'developer';
$$;

-- ---- Two limited roles ------------------------------------------------
--  technician         can only SEE the Huddle Board and Quick Links.
--                     No leave, no on-call, no reacting or commenting.
--  senior_technician  can post (and edit/delete their OWN posts) on the
--                     Huddle Board, react/comment, see Quick Links and view
--                     the on-call rota (read-only). No leave calendar.
-- Neither is a leave-taker or in the on-call pool.
--
-- Roles were first added under the names viewer / huddle_poster; rename any
-- existing rows, and drop whatever role check constraint the table has
-- (whatever it is called) before adding the current one.
do $$
declare c record;
begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
            where contype = 'c' and conrelid in ('public.profiles'::regclass)
              and pg_get_constraintdef(oid) ilike '%role%' and pg_get_constraintdef(oid) ilike '%pharmacist%'
  loop execute format('alter table %s drop constraint %I', c.tbl, c.conname); end loop;
  if to_regclass('public.invitations') is not null then
    for c in select conrelid::regclass as tbl, conname from pg_constraint
              where contype = 'c' and conrelid = 'public.invitations'::regclass
                and pg_get_constraintdef(oid) ilike '%role%' and pg_get_constraintdef(oid) ilike '%pharmacist%'
    loop execute format('alter table %s drop constraint %I', c.tbl, c.conname); end loop;
    update public.invitations set role = 'technician' where role = 'viewer';
    update public.invitations set role = 'senior_technician' where role = 'huddle_poster';
  end if;
  update public.profiles set role = 'technician' where role = 'viewer';
  update public.profiles set role = 'senior_technician' where role = 'huddle_poster';
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('pharmacist','lead_pharmacist','superuser','developer','technician','senior_technician','pharmacy_admin'));
do $$ begin
  if to_regclass('public.invitations') is not null then
    alter table public.invitations add constraint invitations_role_check
      check (role in ('pharmacist','lead_pharmacist','superuser','developer','technician','senior_technician','pharmacy_admin'));
  end if;
end $$;

-- May view the on-call rota (read-only).
create or replace function public.can_view_oncall()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() in ('pharmacist','lead_pharmacist','superuser','developer','senior_technician','pharmacy_admin');
$$;
-- May create huddle posts (and edit/delete their own).
create or replace function public.can_post_huddle()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() in ('lead_pharmacist','superuser','developer','senior_technician');
$$;
-- A full member of staff (can request leave, swap on-call, react, comment).
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() in ('pharmacist','lead_pharmacist','superuser','developer');
$$;

-- Pharmacy Admin: a READ-ONLY role that can view everything (all leave, the
-- calendar, on-call, approvals, users, audit log) but cannot request, amend,
-- approve or delete anything. Every write already goes through an RPC that
-- checks is_staff()/is_lead_plus()/is_superuser_plus()/can_post_huddle(), none
-- of which include this role, so it is blocked server-side.
create or replace function public.is_pharmacy_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() = 'pharmacy_admin';
$$;
-- May READ everything a full member of staff can read.
create or replace function public.can_view_all()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_name() in ('pharmacist','lead_pharmacist','superuser','developer','pharmacy_admin');
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- All writes go through the SECURITY DEFINER functions below (owned by
-- the table owner, which bypasses RLS). Direct client insert/update/
-- delete is therefore denied by default — only SELECT policies exist.
-- =====================================================================

alter table public.profiles           enable row level security;
alter table public.bank_holidays      enable row level security;
alter table public.restricted_days    enable row level security;
alter table public.restricted_day_favourite_colors enable row level security;
alter table public.site_settings      enable row level security;
alter table public.backup_settings    enable row level security;
alter table public.capacity_overrides enable row level security;
alter table public.month_status       enable row level security;
alter table public.leave_requests     enable row level security;
alter table public.audit_log          enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    auth.role() = 'authenticated'
    and public.current_profile_id() is not null
    and (id = auth.uid() or public.is_lead_plus() or public.is_pharmacy_admin())
  );

drop policy if exists bank_holidays_select on public.bank_holidays;
create policy bank_holidays_select on public.bank_holidays for select
  using (auth.role() = 'authenticated' and public.can_view_all());

drop policy if exists restricted_days_select on public.restricted_days;
create policy restricted_days_select on public.restricted_days for select
  using (auth.role() = 'authenticated' and public.can_view_all());

-- Favourite colours are only ever shown on the Restricted Days admin
-- tab, which is already Clinical Team Lead+/Developer only — so this
-- stays scoped to the same audience rather than everyone.
drop policy if exists restricted_day_favourite_colors_select on public.restricted_day_favourite_colors;
create policy restricted_day_favourite_colors_select on public.restricted_day_favourite_colors for select
  using (public.is_superuser_plus() or public.is_pharmacy_admin());

drop policy if exists site_settings_select on public.site_settings;
create policy site_settings_select on public.site_settings for select
  using (auth.role() = 'authenticated' and public.can_view_all());

-- Only ever shown on Admin -> Daily Backup, which is Clinical Team
-- Lead+/Developer only — scoped to match, not everyone.
drop policy if exists backup_settings_select on public.backup_settings;
create policy backup_settings_select on public.backup_settings for select
  using (public.is_superuser_plus() or public.is_pharmacy_admin());

drop policy if exists capacity_overrides_select on public.capacity_overrides;
create policy capacity_overrides_select on public.capacity_overrides for select
  using (auth.role() = 'authenticated' and public.can_view_all());

drop policy if exists month_status_select on public.month_status;
create policy month_status_select on public.month_status for select
  using (auth.role() = 'authenticated' and public.can_view_all());

drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests for select
  using (auth.role() = 'authenticated' and public.can_view_all());

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select
  using (public.is_superuser_plus() or public.is_pharmacy_admin());

-- A limited "directory" — every authenticated, ACTIVE user needs to
-- see everyone's name/initials/role/site to render the calendar and
-- leave tiles, but the base profiles_select policy above now only
-- returns a plain Pharmacist's OWN full row (Lead Pharmacist+ still see
-- everyone's full row directly, which admin.html/approvals.html need).
--
-- This is deliberately an RPC function, not a plain VIEW: a Postgres
-- view normally executes with its OWNER's privileges (the table
-- owner here, which bypasses RLS entirely), so a plain view over
-- profiles would hand back the full directory to a caller whose
-- account has since been deactivated but whose JWT hasn't expired —
-- exactly the "suspended account = no application data" guarantee
-- profiles_select above exists to provide, silently undermined. This
-- function explicitly re-checks current_profile_id() itself before
-- returning anything, so that guarantee holds here too. It never
-- exposes user_id, must_reset_password, hidden_by_superuser,
-- deleted_by_developer, created_by, or created_at — none of which a
-- plain Pharmacist has any reason to see about a colleague.
-- Idempotent migration: remove the old profile_directory VIEW from any
-- database that already had it — it bypassed RLS for a deactivated
-- user's still-valid JWT, which is exactly what get_profile_directory()
-- below fixes.
drop view if exists public.profile_directory;

-- The return shape gained a column, which CREATE OR REPLACE can't do.
drop function if exists public.get_profile_directory();

create or replace function public.get_profile_directory()
returns table (
  id                  uuid,
  initials            text,
  full_name           text,
  role                text,
  active              boolean,
  primary_site        text,
  cross_site          boolean,
  suspended_last_day  date
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_role_name() in ('technician','senior_technician') then raise exception 'not permitted'; end if;
  if public.current_profile_id() is null then
    raise exception 'not permitted';
  end if;

  return query
    select p.id, p.initials, p.full_name, p.role, p.active, p.primary_site, p.cross_site, p.suspended_last_day
    from public.profiles p;
end;
$$;

grant execute on function public.get_profile_directory() to authenticated;

-- Names only (no role, site or leave details) — every signed-in user,
-- including the Technician roles, needs this to show who wrote a Huddle post
-- or comment.
create or replace function public.get_name_directory()
returns table (id uuid, initials text, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null then raise exception 'not permitted'; end if;
  return query select p.id, p.initials, p.full_name from public.profiles p;
end;
$$;
revoke execute on function public.get_name_directory() from public, anon;
grant  execute on function public.get_name_directory() to authenticated;

-- =====================================================================
-- RPC: LEAVE REQUESTS
-- =====================================================================

-- Validates a TOIL time-range JSON array — a non-empty array of
-- {"start":"HH:MM","end":"HH:MM"} objects, each with a properly
-- formatted, ordered start/end. Only ever called from inside another
-- SECURITY DEFINER function (never directly via RPC).
create or replace function public.validate_toil_ranges(p_ranges jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_bad boolean;
begin
  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' or jsonb_array_length(p_ranges) = 0 then
    raise exception 'at least one time range is required for TOIL';
  end if;

  select true into v_bad
    from jsonb_array_elements(p_ranges) elem
   where not (
     (elem->>'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and (elem->>'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and (elem->>'start') < (elem->>'end')
   )
   limit 1;

  if v_bad then
    raise exception 'each TOIL time range needs a valid start and end time, with start before end';
  end if;
end;
$$;

-- Request leave. Pharmacists request Annual Leave / TOIL only for
-- themselves, and can now also request Study Leave for themselves
-- (previously Lead Pharmacist+ only). Nobody — any role — can request
-- leave, of any type, for a weekend.
--
-- A Lead Pharmacist or above can additionally ALLOCATE any leave type
-- for someone else — using exactly the same target scope as
-- can_process_leave_for() (Lead Pharmacist -> Pharmacist only;
-- Clinical Team Lead -> Pharmacist/Lead Pharmacist/self; Developer ->
-- anyone), so "who can allocate for whom" always matches "who can
-- approve for whom" — the allocating user is guaranteed to also be
-- able to approve what they just allocated. Allocated leave still
-- lands as PENDING like any other request — it isn't auto-approved —
-- and the frontend tags it "Allocated" wherever requested_by differs
-- from the leave owner, for every leave type, purely by comparing
-- those two columns (no separate flag needed).
--
-- Retrospective (past-dated) leave: a Clinical Team Lead/Developer can
-- always add it, for anyone they can otherwise act for (including
-- themselves). A Lead Pharmacist can ALSO add it, but only while
-- ALLOCATING it for a Pharmacist — never their own past-dated leave.
-- A plain Pharmacist can never add retrospective leave at all.
--
-- Annual Leave can now be a Full day (p_annual_ranges left null) or a
-- Part day with specific time ranges (leave_type 'annual_part_day'),
-- same shape/picker as TOIL — stored in annual_leave_ranges, the same
-- column full_day_split uses for its own AL portion (never both at
-- once on one row, so no collision). Study leave can likewise be a
-- full day (p_study_ranges left null) or a part day.
--
-- The old (uuid, date, text, time), (uuid, date, text, jsonb), and
-- (uuid, date, text, jsonb, jsonb) signatures are dropped, not just
-- replaced — the parameter list changed again (added annual-leave
-- ranges), which Postgres treats as a distinct overload rather than a
-- replacement, so the old ones have to be removed explicitly or they'd
-- stay callable alongside this one.
drop function if exists public.request_leave(uuid, date, text, time);
drop function if exists public.request_leave(uuid, date, text, jsonb);
drop function if exists public.request_leave(uuid, date, text, jsonb, jsonb);

create or replace function public.request_leave(
  p_user_id       uuid,
  p_leave_date    date,
  p_leave_type    text,
  p_toil_ranges   jsonb default null,
  p_study_ranges  jsonb default null,
  p_annual_ranges jsonb default null
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.leave_requests;
  v_target_site  text;
  v_target_cross boolean;
  v_target_role  text;
begin
  if not public.is_staff() then raise exception 'your account is read-only'; end if;
  if v_actor is null then
    raise exception 'not authenticated or inactive account';
  end if;

  if p_leave_type not in ('full_day','study_leave','toil_full_day','toil_part_day','annual_part_day') then
    raise exception 'invalid leave type';
  end if;

  if extract(dow from p_leave_date) in (0, 6) then -- 0=Sunday, 6=Saturday
    raise exception 'leave cannot be requested for a weekend';
  end if;

  if p_leave_type = 'toil_part_day' then
    perform public.validate_toil_ranges(p_toil_ranges);
  end if;
  if p_leave_type = 'annual_part_day' then
    perform public.validate_toil_ranges(p_annual_ranges);
  end if;
  if p_leave_type = 'study_leave' and p_study_ranges is not null then
    perform public.validate_toil_ranges(p_study_ranges);
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;

  -- Retrospective (past-dated) leave — see the function comment above.
  if p_leave_date < current_date and not public.is_superuser_plus() then
    if not (
      public.current_role_name() = 'lead_pharmacist'
      and p_user_id <> v_actor
      and v_target_role = 'pharmacist'
    ) then
      raise exception 'retrospective (past-dated) leave can only be added by a Clinical Team Lead/Developer, or by a Lead Pharmacist allocating it for a Pharmacist';
    end if;
  end if;

  if p_leave_type = 'study_leave' then
    -- Anyone can request study leave for THEMSELVES now; allocating it
    -- for someone else still follows the same hierarchy as every other
    -- leave type below.
    if p_user_id <> v_actor and not public.can_process_leave_for(p_user_id) then
      raise exception 'you can only request study leave for yourself, or allocate it for someone whose leave you''re able to approve';
    end if;
  else
    if p_user_id <> v_actor and not public.can_process_leave_for(p_user_id) then
      raise exception 'you can only request annual leave or TOIL for yourself, or allocate it for someone whose leave you''re able to approve';
    end if;
  end if;

  select primary_site, cross_site into v_target_site, v_target_cross
    from public.profiles where id = p_user_id and active = true;

  if v_target_site is null then
    raise exception 'target user not found or inactive';
  end if;

  -- One FULL DAY of leave per person per day. A live (pending or
  -- approved, non-rejected/non-deleted) TOIL, Study Leave, or part-day
  -- Annual Leave request doesn't block a further request for that
  -- same date — e.g. someone approved for 1 hour of TOIL who then
  -- needs the whole day off can still submit a Full Day request on
  -- top of it. Only an existing FULL-DAY Annual Leave / split request
  -- blocks a new one, since those already cover the whole day and
  -- stacking more makes no sense — EXCEPT a new part-day TOIL request,
  -- which is never blocked by anything already on record for that
  -- date, even an existing Full Day. That's deliberate: it lets
  -- someone put in writing that they'd like to convert part of an
  -- already-approved day to TOIL, as a first step, without the system
  -- silently rejecting it — actually changing an already-approved day
  -- still has to be sorted out with an approver in person (edit/delete
  -- the other request), this just creates the record showing they asked.
  if p_leave_type <> 'toil_part_day' and exists (
    select 1 from public.leave_requests
     where user_id = p_user_id
       and leave_date = p_leave_date
       and deleted = false
       and status <> 'rejected'
       and leave_type not in ('toil_full_day', 'toil_part_day', 'study_leave', 'annual_part_day')
  ) then
    raise exception 'this person already has a full day''s leave on record for that date';
  end if;

  insert into public.leave_requests (
    user_id, leave_date, leave_type, toil_ranges, study_ranges, annual_leave_ranges, original_ranges, requested_by,
    snapshot_primary_site, snapshot_cross_site
  )
  values (
    p_user_id, p_leave_date, p_leave_type,
    case when p_leave_type = 'toil_part_day' then p_toil_ranges else null end,
    case when p_leave_type = 'study_leave' then p_study_ranges else null end,
    case when p_leave_type = 'annual_part_day' then p_annual_ranges else null end,
    case
      when p_leave_type = 'toil_part_day' then p_toil_ranges
      when p_leave_type = 'annual_part_day' then p_annual_ranges
      when p_leave_type = 'study_leave' then p_study_ranges
      else null
    end,
    v_actor, v_target_site, v_target_cross
  )
  returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, after_state, note)
  values ('create_leave', v_actor, v_row.id, p_user_id, to_jsonb(v_row), null);

  return v_row;
end;
$$;

-- Request leave across a date range in one go — one tile per weekday,
-- weekends (Saturday/Sunday) skipped automatically. Reuses request_leave()
-- for each day so every normal rule applies exactly as it does for a
-- single-day request. All-or-nothing: if any day in the range fails
-- validation, the whole range is rolled back. For TOIL/study/annual
-- leave, the SAME time ranges are applied to every day in the span
-- (e.g. "TOIL 08:00–10:00 every day this week").
drop function if exists public.request_leave_range(uuid, date, date, text, time);
drop function if exists public.request_leave_range(uuid, date, date, text, jsonb);
drop function if exists public.request_leave_range(uuid, date, date, text, jsonb, jsonb);

create or replace function public.request_leave_range(
  p_user_id       uuid,
  p_start_date    date,
  p_end_date      date,
  p_leave_type    text,
  p_toil_ranges   jsonb default null,
  p_study_ranges  jsonb default null,
  p_annual_ranges jsonb default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_date  date;
  v_count int := 0;
begin
  if not public.is_staff() then raise exception 'your account is read-only'; end if;
  if p_end_date < p_start_date then
    raise exception 'end date must be on or after the start date';
  end if;
  if p_end_date - p_start_date > 90 then
    raise exception 'leave ranges are limited to 90 days at a time';
  end if;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    if extract(dow from v_date) not in (0, 6) then -- 0=Sunday, 6=Saturday
      perform public.request_leave(p_user_id, v_date, p_leave_type, p_toil_ranges, p_study_ranges, p_annual_ranges);
      v_count := v_count + 1;
    end if;
    v_date := v_date + 1;
  end loop;

  if v_count = 0 then
    raise exception 'that range contains no weekdays';
  end if;

  return v_count;
end;
$$;

-- Developer-only: manually back-fills a historical leave record —
-- e.g. porting old entries over from a spreadsheet that predates this
-- system. Unlike request_leave(), this can set ANY user as the leave
-- owner AND a separate requester, set the status directly to
-- approved/rejected without going through the normal approval flow,
-- and backdate requested_at/approved_at to when they actually
-- happened rather than "now". The same one-full-day-per-day guard as
-- request_leave() still applies, so an import can't silently create a
-- duplicate Full Day for a date that already has one on record — but
-- a TOIL/study-leave day can still take an additional import, same as
-- an ordinary request.
--
-- Old (uuid, date, text, time, ...) and (uuid, date, text, jsonb,
-- text, uuid, timestamptz, uuid, timestamptz, text, text) signatures
-- dropped, not replaced — the parameter list changed again (added
-- annual-leave ranges).
drop function if exists public.import_historical_leave(uuid, date, text, time, text, uuid, timestamptz, uuid, timestamptz, text, text);
drop function if exists public.import_historical_leave(uuid, date, text, jsonb, text, uuid, timestamptz, uuid, timestamptz, text, text);
drop function if exists public.import_historical_leave(uuid, date, text, jsonb, jsonb, text, uuid, timestamptz, uuid, timestamptz, text, text);

create or replace function public.import_historical_leave(
  p_user_id         uuid,
  p_leave_date      date,
  p_leave_type      text,
  p_toil_ranges     jsonb default null,
  p_study_ranges    jsonb default null,
  p_annual_ranges   jsonb default null,
  p_status          text default 'approved',
  p_requested_by    uuid default null,
  p_requested_at    timestamptz default null,
  p_approved_by     uuid default null,
  p_approved_at     timestamptz default null,
  p_rejected_reason text default null,
  p_note            text default null
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.leave_requests;
  v_target_site  text;
  v_target_cross boolean;
  v_req_by uuid;
  v_req_at timestamptz;
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;

  if p_leave_type not in ('full_day', 'study_leave', 'toil_full_day', 'toil_part_day', 'annual_part_day') then
    raise exception 'invalid leave type';
  end if;
  if p_leave_type = 'toil_part_day' then
    perform public.validate_toil_ranges(p_toil_ranges);
  end if;
  if p_leave_type = 'annual_part_day' then
    perform public.validate_toil_ranges(p_annual_ranges);
  end if;
  if p_leave_type = 'study_leave' and p_study_ranges is not null then
    perform public.validate_toil_ranges(p_study_ranges);
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid status';
  end if;
  if p_status = 'rejected' and (p_rejected_reason is null or btrim(p_rejected_reason) = '') then
    raise exception 'a rejected reason is required when importing a rejected record';
  end if;
  if p_status in ('approved', 'rejected') and p_approved_by is null then
    raise exception 'an approver is required for an approved or rejected historical record';
  end if;

  select primary_site, cross_site into v_target_site, v_target_cross
    from public.profiles where id = p_user_id;
  if v_target_site is null then raise exception 'target user not found'; end if;

  if p_leave_type <> 'toil_part_day' and exists (
    select 1 from public.leave_requests
     where user_id = p_user_id
       and leave_date = p_leave_date
       and deleted = false
       and status <> 'rejected'
       and leave_type not in ('toil_full_day', 'toil_part_day', 'study_leave', 'annual_part_day')
  ) then
    raise exception 'this person already has a full day''s leave on record for that date';
  end if;

  v_req_by := coalesce(p_requested_by, p_user_id);
  if not exists (select 1 from public.profiles where id = v_req_by) then
    raise exception 'requested-by user not found';
  end if;
  if p_approved_by is not null and not exists (select 1 from public.profiles where id = p_approved_by) then
    raise exception 'approved-by user not found';
  end if;

  v_req_at := coalesce(p_requested_at, now());

  insert into public.leave_requests (
    user_id, leave_date, leave_type, toil_ranges, study_ranges, annual_leave_ranges, original_ranges, status,
    requested_by, requested_at, approved_by, approved_at, rejected_reason,
    snapshot_primary_site, snapshot_cross_site
  ) values (
    p_user_id, p_leave_date, p_leave_type,
    case when p_leave_type = 'toil_part_day' then p_toil_ranges else null end,
    case when p_leave_type = 'study_leave' then p_study_ranges else null end,
    case when p_leave_type = 'annual_part_day' then p_annual_ranges else null end,
    case
      when p_leave_type = 'toil_part_day' then p_toil_ranges
      when p_leave_type = 'annual_part_day' then p_annual_ranges
      when p_leave_type = 'study_leave' then p_study_ranges
      else null
    end,
    p_status,
    v_req_by, v_req_at,
    p_approved_by,
    case when p_status in ('approved', 'rejected') then coalesce(p_approved_at, v_req_at) else null end,
    case when p_status = 'rejected' then p_rejected_reason else null end,
    v_target_site, v_target_cross
  )
  returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, after_state, note)
  values ('import_historical_leave', v_actor, v_row.id, p_user_id, to_jsonb(v_row),
          coalesce(p_note, 'backfilled from spreadsheet'));

  return v_row;
end;
$$;

-- Cancel your own PENDING request (not approved/rejected — those need superuser).
create or replace function public.cancel_own_pending_leave(p_leave_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.leave_requests;
begin
  if not public.is_staff() then raise exception 'your account is read-only'; end if;
  select * into v_row from public.leave_requests where id = p_leave_id and deleted = false;
  if v_row is null then raise exception 'leave request not found'; end if;
  if v_row.requested_by <> v_actor and v_row.user_id <> v_actor then
    raise exception 'you may only cancel your own request';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'only pending requests can be cancelled directly — ask a Clinical Team Lead to remove a processed one';
  end if;

  update public.leave_requests set deleted = true, updated_at = now() where id = p_leave_id;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, before_state, note)
  values ('delete', v_actor, p_leave_id, v_row.user_id, to_jsonb(v_row), 'self-cancelled while pending');
end;
$$;

-- Can the current actor approve/reject THIS target's leave?
--  - Developer: anyone, including another Developer or themselves.
--  - Clinical Team Lead (superuser): Pharmacist or Lead Pharmacist
--    targets, or their OWN leave — never another Clinical Team Lead's.
--  - Lead Pharmacist: Pharmacist targets ONLY — never their own leave,
--    never another Lead Pharmacist's, never a Clinical Team Lead's.
create or replace function public.can_process_leave_for(p_target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor_id   uuid := public.current_profile_id();
  v_actor_role text := public.current_role_name();
  v_target_role text;
begin
  if v_actor_id is null then return false; end if;
  select role into v_target_role from public.profiles where id = p_target_user_id;
  if v_target_role is null then return false; end if;
  -- Read-only roles never take or are given leave.
  if v_target_role in ('technician', 'senior_technician', 'pharmacy_admin') then return false; end if;
  if v_actor_role = 'developer' then return true; end if;

  if v_actor_role = 'superuser' then
    if p_target_user_id = v_actor_id then return true; end if;
    return v_target_role in ('pharmacist', 'lead_pharmacist');
  end if;

  if v_actor_role = 'lead_pharmacist' then
    return v_target_role = 'pharmacist';
  end if;

  return false;
end;
$$;

-- Approve. Permission is role-hierarchy-aware — see can_process_leave_for().
-- Takes an optional note, EXCEPT when approving a part-day TOIL
-- request, where a note is mandatory: the approver must confirm the
-- agreed times, since that's the definitive record (it may differ
-- from, or simply confirm, whatever the requester originally picked).
--
-- The old single-argument approve_leave(uuid) is dropped, not just
-- replaced, so no path into this action can skip the note requirement
-- by calling an older overload.
drop function if exists public.approve_leave(uuid);
drop function if exists public.approve_leave(uuid, text);

-- Approver notes: an optional note an approver can add when approving. It
-- is stored on its own table (not on leave_requests, which everyone on the
-- rota can read) so only approvers — Lead Pharmacist and above — can ever
-- see it. One note per leave request; approving a batch applies the same
-- note to each of them.
create table if not exists public.leave_approver_notes (
  leave_id   uuid primary key references public.leave_requests(id) on delete cascade,
  note       text not null check (btrim(note) <> '' and length(note) <= 1000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.leave_approver_notes enable row level security;
drop policy if exists leave_approver_notes_select on public.leave_approver_notes;
create policy leave_approver_notes_select on public.leave_approver_notes for select
  using (public.is_lead_plus() or public.is_pharmacy_admin());

create or replace function public.approve_leave(p_leave_id uuid, p_note text default null, p_approver_note text default null)
returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.leave_requests;
begin
  select * into v_row from public.leave_requests where id = p_leave_id and deleted = false;
  if v_row is null then raise exception 'leave request not found'; end if;
  if not public.can_process_leave_for(v_row.user_id) then
    raise exception 'not permitted to approve this person''s leave';
  end if;
  if v_row.status <> 'pending' then raise exception 'only pending requests can be approved'; end if;
  if v_row.leave_type = 'toil_part_day' and (p_note is null or btrim(p_note) = '') then
    raise exception 'a note confirming the TOIL times is required to approve part-day TOIL leave';
  end if;

  update public.leave_requests
     set status = 'approved', approved_by = v_actor, approved_at = now(), updated_at = now()
   where id = p_leave_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, after_state, note)
  values ('approve', v_actor, v_row.id, v_row.user_id, to_jsonb(v_row), p_note);

  -- Optional note for other approvers (separate from p_note above, which
  -- is the confirmed TOIL times / audit note).
  if p_approver_note is not null and btrim(p_approver_note) <> '' then
    insert into public.leave_approver_notes (leave_id, note, created_by)
    values (v_row.id, left(btrim(p_approver_note), 1000), v_actor)
    on conflict (leave_id) do update set note = excluded.note, created_by = excluded.created_by, created_at = now();
  end if;

  return v_row;
end;
$$;

-- Splits a PENDING Full Day request between annual leave and TOIL, and
-- approves it in the same action — for when the approver reviews a
-- Full Day request and the person doesn't actually have enough annual
-- leave left to cover it, so part of the day needs to come out of
-- TOIL instead. The approver picks, on two separate clock pickers,
-- exactly which hours are annual leave and which are TOIL (both go
-- through the same validate_toil_ranges() check as an ordinary TOIL
-- request — same {"start","end"} shape, it isn't TOIL-specific despite
-- the name). This keeps one row per person per day (same as
-- everything else here) rather than creating a second, separate
-- request for the same date, which the one-request-per-day rule would
-- reject anyway — the breakdown is instead recorded directly on the
-- original row via leave_type='full_day_split', annual_leave_ranges,
-- and toil_ranges together. A note is mandatory, same reasoning as
-- approving ordinary TOIL: this is exactly the kind of thing that
-- needs a clear record of why the split happened.
--
-- Same permission rule as approve_leave() — see can_process_leave_for().
create or replace function public.split_leave_with_toil(
  p_leave_id             uuid,
  p_annual_leave_ranges  jsonb,
  p_toil_ranges          jsonb,
  p_note                 text
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.leave_requests;
begin
  if p_note is null or btrim(p_note) = '' then
    raise exception 'a note explaining the split is required';
  end if;

  select * into v_row from public.leave_requests where id = p_leave_id and deleted = false;
  if v_row is null then raise exception 'leave request not found'; end if;
  if not public.can_process_leave_for(v_row.user_id) then
    raise exception 'not permitted to approve this person''s leave';
  end if;
  if v_row.status <> 'pending' then raise exception 'only pending requests can be split and approved'; end if;
  if v_row.leave_type <> 'full_day' then
    raise exception 'only a Full Day request can be split between annual leave and TOIL';
  end if;

  perform public.validate_toil_ranges(p_annual_leave_ranges);
  perform public.validate_toil_ranges(p_toil_ranges);

  update public.leave_requests
     set leave_type = 'full_day_split',
         annual_leave_ranges = p_annual_leave_ranges,
         toil_ranges = p_toil_ranges,
         status = 'approved', approved_by = v_actor, approved_at = now(), updated_at = now()
   where id = p_leave_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, after_state, note)
  values ('split_leave_with_toil', v_actor, v_row.id, v_row.user_id, to_jsonb(v_row), p_note);

  return v_row;
end;
$$;

-- Reject. Same permission rule as approve_leave(). Reason required.
create or replace function public.reject_leave(p_leave_id uuid, p_reason text)
returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.leave_requests;
begin
  if p_reason is null or btrim(p_reason) = '' then raise exception 'a reason is required to reject leave'; end if;
  select * into v_row from public.leave_requests where id = p_leave_id and deleted = false;
  if v_row is null then raise exception 'leave request not found'; end if;
  if not public.can_process_leave_for(v_row.user_id) then
    raise exception 'not permitted to reject this person''s leave';
  end if;
  if v_row.status <> 'pending' then raise exception 'only pending requests can be rejected'; end if;

  update public.leave_requests
     set status = 'rejected', approved_by = v_actor, approved_at = now(),
         rejected_reason = p_reason, updated_at = now()
   where id = p_leave_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, after_state, note)
  values ('reject', v_actor, v_row.id, v_row.user_id, to_jsonb(v_row), p_reason);

  return v_row;
end;
$$;

-- Unapprove — superuser+ only. Puts an approved/rejected request back to pending.
create or replace function public.unapprove_leave(p_leave_id uuid, p_note text)
returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_before public.leave_requests;
  v_row    public.leave_requests;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  select * into v_before from public.leave_requests where id = p_leave_id and deleted = false;
  if v_before is null then raise exception 'leave request not found'; end if;
  if v_before.status = 'pending' then raise exception 'already pending'; end if;

  update public.leave_requests
     set status = 'pending', approved_by = null, approved_at = null,
         rejected_reason = null, updated_at = now()
   where id = p_leave_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, before_state, after_state, note)
  values ('unapprove', v_actor, v_row.id, v_row.user_id, to_jsonb(v_before), to_jsonb(v_row), p_note);

  return v_row;
end;
$$;

-- Edit — superuser+ only. Change date/type/TOIL/study/annual ranges.
-- Note optional but recorded.
--
-- Old (uuid, date, text, text, time), (uuid, date, text, text, jsonb),
-- and (uuid, date, text, text, jsonb, jsonb) signatures dropped, not
-- replaced — the parameter list changed again (added annual-leave ranges).
drop function if exists public.edit_leave(uuid, date, text, text, time);
drop function if exists public.edit_leave(uuid, date, text, text, jsonb);
drop function if exists public.edit_leave(uuid, date, text, text, jsonb, jsonb);

create or replace function public.edit_leave(
  p_leave_id uuid,
  p_new_date date,
  p_new_type text,
  p_note text,
  p_new_toil_ranges jsonb default null,
  p_new_study_ranges jsonb default null,
  p_new_annual_ranges jsonb default null
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_before public.leave_requests;
  v_row    public.leave_requests;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_new_type not in ('full_day','study_leave','toil_full_day','toil_part_day','annual_part_day') then
    raise exception 'invalid leave type';
  end if;
  if extract(dow from p_new_date) in (0, 6) then -- 0=Sunday, 6=Saturday
    raise exception 'leave cannot be moved to a weekend';
  end if;
  if p_new_type = 'toil_part_day' then
    perform public.validate_toil_ranges(p_new_toil_ranges);
  end if;
  if p_new_type = 'annual_part_day' then
    perform public.validate_toil_ranges(p_new_annual_ranges);
  end if;
  if p_new_type = 'study_leave' and p_new_study_ranges is not null then
    perform public.validate_toil_ranges(p_new_study_ranges);
  end if;
  select * into v_before from public.leave_requests where id = p_leave_id and deleted = false;
  if v_before is null then raise exception 'leave request not found'; end if;

  if p_new_type <> 'toil_part_day' and exists (
    select 1 from public.leave_requests
     where user_id = v_before.user_id
       and leave_date = p_new_date
       and deleted = false
       and status <> 'rejected'
       and id <> p_leave_id
       and leave_type not in ('toil_full_day', 'toil_part_day', 'study_leave', 'annual_part_day')
  ) then
    raise exception 'this person already has another leave request for that date';
  end if;

  update public.leave_requests
     set leave_date = p_new_date,
         leave_type = p_new_type,
         toil_ranges = case when p_new_type = 'toil_part_day' then p_new_toil_ranges else null end,
         study_ranges = case when p_new_type = 'study_leave' then p_new_study_ranges else null end,
         annual_leave_ranges = case when p_new_type = 'annual_part_day' then p_new_annual_ranges else null end,
         -- edit_leave() redefines the request outright (date, type,
         -- and all), unlike the lighter amend_leave_ranges() below —
         -- so an edit establishes a fresh "originally requested"
         -- baseline rather than preserving whatever it was before.
         original_ranges = case
           when p_new_type = 'toil_part_day' then p_new_toil_ranges
           when p_new_type = 'annual_part_day' then p_new_annual_ranges
           when p_new_type = 'study_leave' then p_new_study_ranges
           else null
         end,
         updated_at = now()
   where id = p_leave_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, before_state, after_state, note)
  values ('edit', v_actor, v_row.id, v_row.user_id, to_jsonb(v_before), to_jsonb(v_row), p_note);

  return v_row;
end;
$$;

-- Change the TYPE (and part-day times) of a still-PENDING request — for the approver who is looking at it.
-- Typical use: someone asked for a Full Day of TOIL by mistake, so the approver switches it to Part Day TOIL
-- and picks the times. Allowed for anyone who may process that person's leave (can_process_leave_for), so it
-- covers Lead Pharmacists (for Pharmacists) as well as Clinical Team Leads and Developers. The date is not
-- changed here (that stays in edit_leave(), Clinical Team Lead+). Logged to the audit trail as an edit.
create or replace function public.change_leave_type(
  p_leave_id uuid,
  p_new_type text,
  p_note text default null,
  p_new_toil_ranges jsonb default null,
  p_new_study_ranges jsonb default null,
  p_new_annual_ranges jsonb default null
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_before public.leave_requests;
  v_row    public.leave_requests;
begin
  if p_new_type not in ('full_day','study_leave','toil_full_day','toil_part_day','annual_part_day') then
    raise exception 'invalid leave type';
  end if;
  select * into v_before from public.leave_requests where id = p_leave_id and deleted = false;
  if v_before is null then raise exception 'leave request not found'; end if;
  if not public.can_process_leave_for(v_before.user_id) then raise exception 'not permitted'; end if;
  if v_before.status <> 'pending' then raise exception 'only a pending request can be changed this way'; end if;
  if v_before.leave_type = 'full_day_split' then raise exception 'a split request cannot be changed this way'; end if;
  if p_new_type = 'toil_part_day' then perform public.validate_toil_ranges(p_new_toil_ranges); end if;
  if p_new_type = 'annual_part_day' then perform public.validate_toil_ranges(p_new_annual_ranges); end if;
  if p_new_type = 'study_leave' and p_new_study_ranges is not null then perform public.validate_toil_ranges(p_new_study_ranges); end if;

  if p_new_type <> 'toil_part_day' and exists (
    select 1 from public.leave_requests
     where user_id = v_before.user_id and leave_date = v_before.leave_date and deleted = false and status <> 'rejected'
       and id <> p_leave_id
       and leave_type not in ('toil_full_day', 'toil_part_day', 'study_leave', 'annual_part_day')
  ) then
    raise exception 'this person already has another leave request for that date';
  end if;

  update public.leave_requests
     set leave_type = p_new_type,
         toil_ranges = case when p_new_type = 'toil_part_day' then p_new_toil_ranges else null end,
         study_ranges = case when p_new_type = 'study_leave' then p_new_study_ranges else null end,
         annual_leave_ranges = case when p_new_type = 'annual_part_day' then p_new_annual_ranges else null end,
         original_ranges = case
           when p_new_type = 'toil_part_day' then p_new_toil_ranges
           when p_new_type = 'annual_part_day' then p_new_annual_ranges
           when p_new_type = 'study_leave' then p_new_study_ranges
           else null end,
         updated_at = now()
   where id = p_leave_id returning * into v_row;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, before_state, after_state, note)
  values ('edit', v_actor, v_row.id, v_row.user_id, to_jsonb(v_before), to_jsonb(v_row),
          'Leave type changed by approver' || coalesce(': ' || nullif(btrim(coalesce(p_note, '')), ''), ''));
  return v_row;
end;
$$;
revoke execute on function public.change_leave_type(uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.change_leave_type(uuid, text, text, jsonb, jsonb, jsonb) to authenticated;

-- Amend just the time ranges on an existing PART-DAY request — TOIL,
-- Annual Leave, or Study Leave alike — a lighter-weight action than
-- the full edit_leave() above, open to Lead Pharmacist and above (not
-- just Clinical Team Lead+), since correcting a mistyped time is a
-- minor admin fix, not a change to what leave someone's actually
-- taking. Logged to the audit trail like every other change here.
--
-- Deliberately does NOT touch original_ranges — that column exists
-- specifically to keep showing what was originally requested even
-- after this amends it, so the frontend can display both side by
-- side ("Requested 08:00-10:00; Approved (amended) 09:00-11:00").
--
-- Replaces amend_toil_ranges(uuid, jsonb, text) (TOIL-only) and the
-- older amend_toil_time(uuid, time, text) before that — both dropped
-- entirely rather than kept alongside this, since this one covers
-- everything they did and more.
drop function if exists public.amend_toil_time(uuid, time, text);
drop function if exists public.amend_toil_ranges(uuid, jsonb, text);

create or replace function public.amend_leave_ranges(
  p_leave_id   uuid,
  p_new_ranges jsonb,
  p_note       text default null
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.leave_requests;
  v_row    public.leave_requests;
begin
  if not public.is_lead_plus() then raise exception 'not permitted'; end if;
  perform public.validate_toil_ranges(p_new_ranges);

  select * into v_before from public.leave_requests where id = p_leave_id and deleted = false;
  if v_before is null then raise exception 'leave request not found'; end if;

  if v_before.leave_type = 'toil_part_day' then
    update public.leave_requests set toil_ranges = p_new_ranges, updated_at = now()
     where id = p_leave_id returning * into v_row;
  elsif v_before.leave_type = 'annual_part_day' then
    update public.leave_requests set annual_leave_ranges = p_new_ranges, updated_at = now()
     where id = p_leave_id returning * into v_row;
  elsif v_before.leave_type = 'study_leave' and v_before.study_ranges is not null then
    update public.leave_requests set study_ranges = p_new_ranges, updated_at = now()
     where id = p_leave_id returning * into v_row;
  else
    raise exception 'this leave request does not have time ranges to amend';
  end if;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, before_state, after_state, note)
  values ('amend_leave_ranges', v_actor, v_row.id, v_row.user_id, to_jsonb(v_before), to_jsonb(v_row), p_note);

  return v_row;
end;
$$;

-- Delete — Clinical Team Lead+ only, with one exception: whoever both
-- ALLOCATED a piece of leave (requested_by) AND APPROVED it
-- (approved_by) — the same person, both roles — can delete it
-- themselves once it's been approved, even if their normal role
-- (e.g. Lead Pharmacist) otherwise can't delete at all. This is
-- deliberately narrow: it only fires when it's genuinely an
-- allocation for someone else (user_id <> requested_by), not a
-- self-request, and only once approved — the point is to stop a
-- Lead Pharmacist's own allocate-then-approve leave from becoming
-- permanently stuck cluttering the calendar with no way to remove it,
-- since they own the whole decision start to finish anyway. The
-- audit trail entry for the delete is still written as always — nothing
-- about this exception hides that it happened, it just keeps the
-- calendar itself from visually clogging up. A note is MANDATORY
-- either way.
create or replace function public.delete_leave(p_leave_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_before public.leave_requests;
begin
  if p_note is null or btrim(p_note) = '' then
    raise exception 'a note is required when deleting a leave request';
  end if;
  select * into v_before from public.leave_requests where id = p_leave_id and deleted = false;
  if v_before is null then raise exception 'leave request not found'; end if;

  if not (
    public.is_superuser_plus()
    or (
      v_before.requested_by = v_actor
      and v_before.approved_by = v_actor
      and v_before.user_id <> v_actor
      and v_before.status = 'approved'
    )
  ) then
    raise exception 'not permitted';
  end if;

  update public.leave_requests set deleted = true, updated_at = now() where id = p_leave_id;

  insert into public.audit_log (action, actor_id, target_leave_id, target_user_id, before_state, note)
  values ('delete', v_actor, p_leave_id, v_before.user_id, to_jsonb(v_before), p_note);
end;
$$;

-- =====================================================================
-- RPC: BANK HOLIDAYS — superuser+ only
-- =====================================================================

create or replace function public.set_bank_holiday(p_date date, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  insert into public.bank_holidays (holiday_date, name, created_by)
  values (p_date, p_name, v_actor)
  on conflict (holiday_date) do update set name = excluded.name;

  insert into public.audit_log (action, actor_id, note, after_state)
  values ('set_bank_holiday', v_actor, p_name, jsonb_build_object('date', p_date, 'name', p_name));
end;
$$;

create or replace function public.remove_bank_holiday(p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  delete from public.bank_holidays where holiday_date = p_date;

  insert into public.audit_log (action, actor_id, note)
  values ('remove_bank_holiday', v_actor, p_date::text);
end;
$$;

-- =====================================================================
-- RPC: RESTRICTED DAYS — superuser+ only
-- Marks a day (or, via the range wrapper, a whole span of days) with a
-- label and a custom hex colour on the calendar — e.g. "Restricted
-- Leave — Christmas" in whatever shade someone picked from the colour
-- table/intensity slider. Independent of bank holidays: a day can be
-- a bank holiday, a restricted day, both, or neither.
--
-- Both functions below have a parameter RENAMED from an earlier
-- version (p_highlight -> p_highlight_color) with its type unchanged —
-- Postgres does not allow CREATE OR REPLACE FUNCTION to rename a
-- parameter on its own (only DROP FUNCTION first permits that), so
-- both are explicitly dropped before being recreated.
-- =====================================================================

drop function if exists public.set_restricted_day(text, date, text, text);

create or replace function public.set_restricted_day(p_site text, p_date date, p_label text, p_highlight_color text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_site not in ('worthing', 'st_richards') then raise exception 'invalid site'; end if;
  if p_highlight_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'invalid highlight colour — must be a hex value like #fdf1b8'; end if;
  if p_label is null or btrim(p_label) = '' then raise exception 'a label is required'; end if;

  insert into public.restricted_days (site, restricted_date, label, highlight_color, created_by)
  values (p_site, p_date, p_label, p_highlight_color, v_actor)
  on conflict (site, restricted_date) do update set label = excluded.label, highlight_color = excluded.highlight_color;

  insert into public.audit_log (action, actor_id, note, after_state)
  values ('set_restricted_day', v_actor, p_label,
          jsonb_build_object('site', p_site, 'date', p_date, 'label', p_label, 'highlight_color', p_highlight_color));
end;
$$;

-- Applies set_restricted_day() to every WEEKDAY in a range (inclusive)
-- that ISN'T already a bank holiday — weekends and bank holidays are
-- skipped automatically, since a restricted-leave notice only makes
-- sense on a day people could otherwise have worked. Bank holidays
-- themselves stay a single global list (they're not site-specific).
drop function if exists public.set_restricted_range(text, date, date, text, text);

create or replace function public.set_restricted_range(
  p_site            text,
  p_start_date      date,
  p_end_date        date,
  p_label           text,
  p_highlight_color text
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_date  date;
  v_count int := 0;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_site not in ('worthing', 'st_richards') then raise exception 'invalid site'; end if;
  if p_end_date < p_start_date then
    raise exception 'end date must be on or after the start date';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'restricted-day ranges are limited to 366 days at a time';
  end if;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    if extract(dow from v_date) not in (0, 6) -- 0=Sunday, 6=Saturday
       and not exists (select 1 from public.bank_holidays where holiday_date = v_date)
    then
      perform public.set_restricted_day(p_site, v_date, p_label, p_highlight_color);
      v_count := v_count + 1;
    end if;
    v_date := v_date + 1;
  end loop;

  if v_count = 0 then
    raise exception 'that range contains no eligible days (all weekends/bank holidays)';
  end if;

  return v_count;
end;
$$;

create or replace function public.remove_restricted_day(p_site text, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_site not in ('worthing', 'st_richards') then raise exception 'invalid site'; end if;
  delete from public.restricted_days where site = p_site and restricted_date = p_date;

  insert into public.audit_log (action, actor_id, note)
  values ('remove_restricted_day', v_actor, p_site || ' ' || p_date::text);
end;
$$;

-- Saves a colour (as picked from the colour table + intensity slider)
-- to the shared favourites palette for quick reuse next time. Re-saving
-- a colour that's already favourited just updates its label, rather
-- than erroring or duplicating.
create or replace function public.add_favourite_color(p_color text, p_label text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'invalid colour — must be a hex value like #fdf1b8'; end if;

  insert into public.restricted_day_favourite_colors (color, label, created_by)
  values (lower(p_color), p_label, v_actor)
  on conflict (color) do update set label = excluded.label;
end;
$$;

create or replace function public.remove_favourite_color(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  delete from public.restricted_day_favourite_colors where id = p_id;
end;
$$;

-- =====================================================================
-- RPC: DAILY BACKUP RECIPIENTS — superuser+ only
-- =====================================================================

-- Sets who the send-leave-backup edge function emails the daily
-- workbook to. A comma-separated list, basic per-address format check
-- only (not full RFC 5322 validation — good enough to catch an
-- obviously mistyped address without being a maintenance burden).
-- Empty/null is allowed — it just means the edge function falls back
-- to its BACKUP_TO_EMAIL secret instead.
create or replace function public.set_backup_recipients(p_emails text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_clean text := nullif(btrim(coalesce(p_emails, '')), '');
  v_addr  text;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;

  if v_clean is not null then
    foreach v_addr in array string_to_array(v_clean, ',') loop
      if btrim(v_addr) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid email address: %', btrim(v_addr);
      end if;
    end loop;
  end if;

  update public.backup_settings
     set recipient_emails = v_clean, updated_by = v_actor, updated_at = now()
   where id = 1;

  insert into public.audit_log (action, actor_id, note)
  values ('set_backup_recipients', v_actor, coalesce(v_clean, '(cleared — falls back to BACKUP_TO_EMAIL secret)'));
end;
$$;

-- Reads back the daily-leave-backup pg_cron job's current schedule, so
-- Admin → Daily Backup can show (and let a Clinical Team Lead+/
-- Developer change) the send time without ever touching the SQL
-- Editor again after the one-off supabase/backup-cron-setup.sql run.
-- Returns {"scheduled": false} if that script hasn't been run yet (no
-- job by that name exists) — the frontend uses this to tell the two
-- states apart and prompt for the one-off setup when needed.
create or replace function public.get_backup_schedule()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_job record;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;

  select jobid, schedule, active into v_job
    from cron.job where jobname = 'daily-leave-backup';

  if v_job.jobid is null then
    return jsonb_build_object('scheduled', false);
  end if;
  return jsonb_build_object('scheduled', true, 'schedule', v_job.schedule, 'active', v_job.active);
end;
$$;

-- Changes WHEN the existing daily-leave-backup pg_cron job fires, in
-- UTC — it only ever touches that job's schedule field via
-- cron.alter_job(), never its command (which embeds the project URL
-- and service role key baked in by the one-off
-- supabase/backup-cron-setup.sql run), so this never needs that key
-- again. Raises a clear error if that script hasn't been run yet —
-- there's no job to reschedule, and this deliberately doesn't create
-- one, since doing so would need the service role key, which the app
-- itself never holds.
create or replace function public.set_backup_schedule(p_hour_utc int, p_minute_utc int default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_jobid  bigint;
  v_before text;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_hour_utc not between 0 and 23 then raise exception 'hour must be 0-23'; end if;
  if p_minute_utc not between 0 and 59 then raise exception 'minute must be 0-59'; end if;

  select jobid, schedule into v_jobid, v_before
    from cron.job where jobname = 'daily-leave-backup';
  if v_jobid is null then
    raise exception 'the daily-leave-backup job hasn''t been set up yet — run supabase/backup-cron-setup.sql once first (see README §17)';
  end if;

  perform cron.alter_job(v_jobid, schedule := format('%s %s * * *', p_minute_utc, p_hour_utc));

  insert into public.audit_log (action, actor_id, before_state, after_state)
  values ('set_backup_schedule', v_actor,
          jsonb_build_object('schedule_utc', v_before),
          jsonb_build_object('hour_utc', p_hour_utc, 'minute_utc', p_minute_utc));
end;
$$;

-- =====================================================================
-- RPC: LEAVE CAPACITY — superuser+ only
-- =====================================================================

create or replace function public.set_capacity_threshold(p_site text, p_threshold int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;
  if p_threshold < 1 then raise exception 'threshold must be at least 1'; end if;

  insert into public.site_settings (site, leave_capacity_threshold, updated_by, updated_at)
  values (p_site, p_threshold, v_actor, now())
  on conflict (site) do update
    set leave_capacity_threshold = excluded.leave_capacity_threshold,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.audit_log (action, actor_id, note, after_state)
  values ('set_capacity_threshold', v_actor, p_site,
          jsonb_build_object('site', p_site, 'threshold', p_threshold));
end;
$$;

-- Forces a specific site+date to show red on the calendar, overriding
-- the automatic yellow-threshold calculation for that one day.
create or replace function public.set_capacity_override(p_site text, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;

  insert into public.capacity_overrides (site, override_date, set_by)
  values (p_site, p_date, v_actor)
  on conflict (site, override_date) do nothing;

  insert into public.audit_log (action, actor_id, note, after_state)
  values ('set_capacity_override', v_actor, p_site, jsonb_build_object('site', p_site, 'date', p_date));
end;
$$;

create or replace function public.remove_capacity_override(p_site text, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  delete from public.capacity_overrides where site = p_site and override_date = p_date;

  insert into public.audit_log (action, actor_id, note)
  values ('remove_capacity_override', v_actor, p_site || ' ' || p_date::text);
end;
$$;

-- =====================================================================
-- RPC: CLEAR AUDIT LOG — Developer only
-- Permanently deletes every existing audit_log row. The frontend
-- requires the Developer to re-enter their password (re-authenticated
-- against Supabase Auth) immediately before calling this, as a second
-- factor beyond just being logged in — but that check happens
-- client-side, so the database enforces the real boundary: only a
-- Developer account can call this at all. One row is written
-- immediately afterwards recording that the clear happened, so the
-- fact of it is never itself erased.
-- =====================================================================

create or replace function public.clear_audit_log()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;

  delete from public.audit_log where true;

  insert into public.audit_log (action, actor_id, note)
  values ('clear_audit_log', v_actor, 'all prior audit log entries permanently deleted');
end;
$$;

-- =====================================================================
-- RPC: RESET APP DATA — Developer only
-- A "go-live" reset: permanently deletes every leave request, bank
-- holiday, restricted day, capacity override, and month-complete flag,
-- and resets each site's leave-capacity threshold back to its default
-- — but does NOT touch profiles/auth.users at all. Every login,
-- role, and site assignment configured while testing is kept exactly
-- as-is, so nobody has to be recreated before real use begins.
-- Requires the same password re-entry as clear_audit_log() before the
-- frontend even calls this, and clears the audit log too (as part of
-- the same reset) before writing one fresh entry recording that it happened.
-- =====================================================================

create or replace function public.reset_app_data()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;

  delete from public.leave_requests where true;
  delete from public.bank_holidays where true;
  delete from public.restricted_days where true;
  delete from public.capacity_overrides where true;
  delete from public.month_status where true;
  update public.site_settings set leave_capacity_threshold = 3, updated_by = null, updated_at = now() where true;
  delete from public.audit_log where true;

  insert into public.audit_log (action, actor_id, note)
  values ('reset_app_data', v_actor,
          'app reset for go-live: all leave requests, bank holidays, restricted days, capacity overrides, and month-complete flags permanently deleted, capacity thresholds reset to default — user accounts untouched');
end;
$$;

-- On-call rota ONLY reset (Developer only). Clears every on-call
-- assignment, swap request, on-call bank holiday and rota period.
-- Leaves untouched: leave data, user accounts, each person's on-call
-- pool eligibility, swap-approval settings, the Huddle Board, Quick
-- Links, and the audit trail (which records the reset itself).
create or replace function public.reset_oncall_rota()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_a int; v_s int; v_h int; v_p int;
begin
  if not public.is_developer() then raise exception 'only the Developer can reset the on-call rota'; end if;

  delete from public.oncall_swap_items where true;
  delete from public.oncall_swap_requests where true;
  with d as (delete from public.oncall_assignments where true returning 1) select count(*) into v_a from d;
  with d as (delete from public.oncall_bank_holidays where true returning 1) select count(*) into v_h from d;
  with d as (delete from public.oncall_rota_periods where true returning 1) select count(*) into v_p from d;

  insert into public.audit_log (action, actor_id, note)
  values ('reset_oncall_rota', v_actor,
          'on-call rota reset: ' || v_a || ' shifts, ' || v_h || ' bank holidays and ' || v_p ||
          ' rota periods deleted, plus all swap requests — pool eligibility, settings and everything outside the on-call rota untouched');
end;
$$;

-- =====================================================================
-- RPC: ROTA / DSR COMPLETE — per site, per month
-- Ticking on ("complete = true") is Lead Pharmacist and above.
-- Ticking off ("complete = false") is Clinical Team Lead/Developer only.
-- =====================================================================

create or replace function public.set_rota_complete(p_site text, p_year int, p_month int, p_complete boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;
  if p_month < 1 or p_month > 12 then raise exception 'invalid month'; end if;

  if p_complete then
    if not public.is_lead_plus() then raise exception 'not permitted'; end if;
  else
    if not public.is_superuser_plus() then
      raise exception 'only a Clinical Team Lead or Developer can un-tick this';
    end if;
  end if;

  insert into public.month_status (site, year, month, rota_complete, rota_completed_by, rota_completed_at)
  values (p_site, p_year, p_month, p_complete, v_actor, now())
  on conflict (site, year, month) do update
    set rota_complete = excluded.rota_complete,
        rota_completed_by = excluded.rota_completed_by,
        rota_completed_at = excluded.rota_completed_at;

  insert into public.audit_log (action, actor_id, note, after_state)
  values ('set_rota_complete', v_actor, p_site,
          jsonb_build_object('site', p_site, 'year', p_year, 'month', p_month, 'complete', p_complete));
end;
$$;

create or replace function public.set_dsr_complete(p_site text, p_year int, p_month int, p_complete boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;
  if p_month < 1 or p_month > 12 then raise exception 'invalid month'; end if;

  if p_complete then
    if not public.is_lead_plus() then raise exception 'not permitted'; end if;
  else
    if not public.is_superuser_plus() then
      raise exception 'only a Clinical Team Lead or Developer can un-tick this';
    end if;
  end if;

  insert into public.month_status (site, year, month, dsr_complete, dsr_completed_by, dsr_completed_at)
  values (p_site, p_year, p_month, p_complete, v_actor, now())
  on conflict (site, year, month) do update
    set dsr_complete = excluded.dsr_complete,
        dsr_completed_by = excluded.dsr_completed_by,
        dsr_completed_at = excluded.dsr_completed_at;

  insert into public.audit_log (action, actor_id, note, after_state)
  values ('set_dsr_complete', v_actor, p_site,
          jsonb_build_object('site', p_site, 'year', p_year, 'month', p_month, 'complete', p_complete));
end;
$$;

-- =====================================================================
-- RPC: USER ADMINISTRATION
-- (account creation itself happens in the admin-create-user edge
--  function, which needs the service role to call auth.admin — this
--  function only covers changes to an EXISTING profile.)
--
-- Hierarchy enforced throughout:
--  - A Clinical Team Lead (superuser) can suspend/reactivate ANOTHER
--    Clinical Team Lead's account — but never their own (that would
--    just lock them out with no one able to undo it, short of a
--    Developer or the dashboard), and never a Developer account.
--  - A Developer account can never be suspended or hidden by ANYONE
--    from within the app — even another Developer — only directly via
--    the Supabase dashboard. This mirrors bootstrap_developer() being
--    dashboard-only.
-- =====================================================================

create or replace function public.set_user_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
begin
  select * into v_target from public.profiles where id = p_user_id;
  if v_target is null then raise exception 'user not found'; end if;

  if v_target.role = 'developer' then
    raise exception 'developer accounts cannot be suspended from the app';
  end if;
  if v_target.id = v_actor then
    raise exception 'you cannot suspend your own account';
  end if;
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;

  -- Reactivating restores everything: the last-day details are cleared,
  -- so any leave that had been greyed out returns to normal.
  update public.profiles
     set active = p_active,
         suspended_last_day   = case when p_active then null else suspended_last_day end,
         suspended_leave_time = case when p_active then null else suspended_leave_time end,
         suspended_note       = case when p_active then null else suspended_note end
   where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values (case when p_active then 'reactivate_user' else 'deactivate_user' end, v_actor, p_user_id, null);
end;
$$;

-- Suspend an account WITH leaver details: the last working day (required),
-- the time they leave on that day (optional) and a note (optional). Also
-- used to edit those details on an account that is already suspended.
-- Same hierarchy rules as set_user_active(). Leave dated after the last
-- day is greyed out on the calendar until the account is reactivated.
create or replace function public.suspend_user(
  p_user_id    uuid,
  p_last_day   date,
  p_leave_time time default null,
  p_note       text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
  v_note   text := nullif(btrim(p_note), '');
begin
  select * into v_target from public.profiles where id = p_user_id;
  if v_target is null then raise exception 'user not found'; end if;

  if v_target.role = 'developer' then
    raise exception 'developer accounts cannot be suspended from the app';
  end if;
  if v_target.id = v_actor then
    raise exception 'you cannot suspend your own account';
  end if;
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_last_day is null then raise exception 'a last working day is required'; end if;
  if p_last_day < date '2000-01-01' or p_last_day > date '2100-12-31' then
    raise exception 'that last working day is not valid';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'the note is too long (500 characters at most)';
  end if;

  update public.profiles
     set active = false,
         suspended_last_day   = p_last_day,
         suspended_leave_time = p_leave_time,
         suspended_note       = v_note
   where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values ('deactivate_user', v_actor, p_user_id,
    'last day ' || p_last_day::text
    || coalesce(' at ' || to_char(p_leave_time, 'HH24:MI'), '')
    || coalesce(' — ' || v_note, ''));
end;
$$;

-- Hiding also locks the account (active=false) — a Superuser's "Hide"
-- is meant to fully remove someone's access, not just tidy the list.
-- The frontend follows this up with an edge-function password reset
-- (to a random value the admin never sees) for real defense in depth,
-- but active=false alone already blocks every RLS-gated action and
-- signs them straight back out on their next page load. Un-hiding
-- does NOT auto-reactivate — that stays a deliberate separate step.
create or replace function public.set_user_hidden(p_user_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
begin
  select * into v_target from public.profiles where id = p_user_id;
  if v_target is null then raise exception 'user not found'; end if;

  if v_target.role = 'developer' then
    raise exception 'developer accounts cannot be hidden from the app';
  end if;
  if public.current_role_name() = 'superuser' and v_target.role in ('superuser','developer') then
    raise exception 'a Clinical Team Lead cannot change Clinical Team Lead/Developer accounts';
  end if;
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;

  update public.profiles
     set hidden_by_superuser = p_hidden,
         active = case when p_hidden then false else active end
   where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values (case when p_hidden then 'hide_user' else 'unhide_user' end, v_actor, p_user_id, null);
end;
$$;

-- Developer-only permanent removal. Unlike hide_user() (a Superuser's
-- reversible, list-only soft-delete), this is meant as a genuine
-- "delete" from the operator's point of view: the account is locked
-- out for good (active=false, hidden from Superuser's list, flagged
-- deleted_by_developer) and the frontend follows up with a password
-- reset to a value nobody knows, same as hide_user. The underlying
-- profiles row and leave_requests history are deliberately NOT
-- removed — leave_requests.user_id cascades on profile deletion, so
-- an actual row delete would silently wipe that person's entire leave
-- history, which is exactly the kind of governance record this system
-- exists to keep. "Deleted" here means access is gone permanently,
-- not that the record disappears.
create or replace function public.delete_user_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;

  select * into v_target from public.profiles where id = p_user_id;
  if v_target is null then raise exception 'user not found'; end if;
  if v_target.role = 'developer' then
    raise exception 'developer accounts cannot be deleted from the app';
  end if;

  update public.profiles
     set active = false, hidden_by_superuser = true, deleted_by_developer = true
   where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values ('delete_user', v_actor, p_user_id, 'account permanently deleted — access revoked, leave history retained');
end;
$$;

-- Set / edit a user's site assignment. Superuser+ only (same restriction
-- as other profile edits: a Clinical Team Lead cannot touch a
-- Clinical Team Lead/Developer account). cross_site=true means the
-- person works at both sites — their leave requests then show as
-- pending/approved on BOTH site calendars automatically, since the
-- calendar filters by the requester's own site membership rather than
-- by anything stored on the leave request itself.
create or replace function public.set_user_site(p_user_id uuid, p_primary_site text, p_cross_site boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
begin
  if p_primary_site not in ('worthing','st_richards') then
    raise exception 'invalid site';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if v_target is null then raise exception 'user not found'; end if;

  if public.current_role_name() = 'superuser' and v_target.role in ('superuser','developer') then
    raise exception 'a Clinical Team Lead cannot change Clinical Team Lead/Developer accounts';
  end if;
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;

  update public.profiles
     set primary_site = p_primary_site, cross_site = p_cross_site
   where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state)
  values ('set_user_site', v_actor, p_user_id,
          jsonb_build_object('primary_site', v_target.primary_site, 'cross_site', v_target.cross_site),
          jsonb_build_object('primary_site', p_primary_site, 'cross_site', p_cross_site));
end;
$$;

-- Change an existing user's role — e.g. promoting a Pharmacist to
-- Lead Pharmacist gives them the extra access that comes with the
-- role immediately, since every permission check throughout this app
-- reads current_role_name() live rather than caching anything.
--  - A Clinical Team Lead (superuser) can promote/demote between
--    Pharmacist and Lead Pharmacist only — never to/from Clinical Team
--    Lead, and never touching an existing Clinical Team Lead/Developer
--    account (same restriction as every other profile edit here).
--  - A Developer can additionally promote up to Clinical Team Lead.
--  - Nobody can set a role to 'developer' via this function — that
--    stays exclusively bootstrap_developer()'s dashboard-only path,
--    and a Developer account's own role can never be changed by
--    anyone, including another Developer.
create or replace function public.set_user_role(p_user_id uuid, p_new_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_new_role not in ('pharmacist', 'lead_pharmacist', 'superuser', 'technician', 'senior_technician', 'pharmacy_admin') then
    raise exception 'invalid role — developer accounts can only be created via the Supabase dashboard bootstrap process';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if v_target is null then raise exception 'user not found'; end if;
  if v_target.role = 'developer' then
    raise exception 'a developer account''s role cannot be changed from the app';
  end if;

  if public.current_role_name() = 'superuser' then
    if v_target.role in ('superuser', 'developer') then
      raise exception 'a Clinical Team Lead cannot change a Clinical Team Lead/Developer account';
    end if;
    if p_new_role = 'superuser' then
      raise exception 'a Clinical Team Lead cannot promote anyone to Clinical Team Lead — only a Developer can';
    end if;
  end if;

  if v_target.role = p_new_role then
    raise exception 'that is already their role';
  end if;

  update public.profiles set role = p_new_role where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state)
  values ('set_user_role', v_actor, p_user_id,
          jsonb_build_object('role', v_target.role),
          jsonb_build_object('role', p_new_role));
end;
$$;

-- Developer-only: renames an account's Display Name (profiles.full_name).
-- Deliberately Developer-only rather than Superuser+ — unlike role/site
-- changes, this touches how someone's identity shows up everywhere
-- (tiles, tooltips, audit trail, exports), so it's kept to the
-- narrowest audience rather than opened up to Clinical Team Lead too.
-- No target-role restriction — a Developer can rename anyone,
-- including another Developer or Clinical Team Lead, since this is a
-- low-risk, easily-reversible metadata edit, not an access change.
create or replace function public.set_user_display_name(p_user_id uuid, p_full_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before text;
  v_new    text := btrim(p_full_name);
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;
  if v_new = '' then raise exception 'a display name is required'; end if;

  select full_name into v_before from public.profiles where id = p_user_id;
  if v_before is null then raise exception 'user not found'; end if;

  update public.profiles set full_name = v_new where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state)
  values ('set_user_display_name', v_actor, p_user_id,
          jsonb_build_object('full_name', v_before),
          jsonb_build_object('full_name', v_new));
end;
$$;

-- Developer-only: sets another account's colour theme (the accent
-- palette — navy/teal/honey vs. the other options in THEMES in
-- shared.js). Developer-only rather than Superuser+ for the same
-- reason as set_user_display_name() — it's a low-risk cosmetic change,
-- but keeping branding consistent across the Trust's accounts is kept
-- to the narrowest audience rather than opened up further. No
-- target-role restriction — a Developer can theme anyone, including
-- another Developer or Clinical Team Lead.
drop function if exists public.set_user_theme(uuid, text);
create or replace function public.set_user_theme(p_user_id uuid, p_theme text, p_lock boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before text;
  v_before_lock boolean;
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;
  -- Keep in sync with the profiles_theme_check constraint and THEMES in shared.js.
  if p_theme not in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm') then
    raise exception 'invalid theme';
  end if;

  select theme, theme_locked into v_before, v_before_lock from public.profiles where id = p_user_id;
  if v_before is null then raise exception 'user not found'; end if;

  -- p_lock null = leave the lock as it is; true/false sets it.
  update public.profiles set theme = p_theme, theme_locked = coalesce(p_lock, theme_locked) where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state)
  values ('set_user_theme', v_actor, p_user_id,
          jsonb_build_object('theme', v_before, 'locked', v_before_lock),
          jsonb_build_object('theme', p_theme, 'locked', coalesce(p_lock, v_before_lock)));
end;
$$;

-- Theme by month: the Developer can give a calendar month its own theme
-- (e.g. October -> Halloween, December -> Christmas, April -> Easter).
-- During that month, everyone sees it automatically, taking priority
-- over their personal theme; in months with no entry, each account's own
-- theme applies as before. It repeats every year. Everyone signed in can
-- read the schedule (it is cosmetic); only a Clinical Team Lead or Developer can change it.
create table if not exists public.theme_schedule (
  month      int primary key check (month between 1 and 12),
  theme      text not null check (theme in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.theme_schedule drop constraint if exists theme_schedule_theme_check;
alter table public.theme_schedule add constraint theme_schedule_theme_check check (theme in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm'));
alter table public.theme_schedule enable row level security;
drop policy if exists theme_schedule_select on public.theme_schedule;
create policy theme_schedule_select on public.theme_schedule for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null);

-- p_theme = 'none' (or null) removes the month's entry.
create or replace function public.set_theme_for_month(p_month int, p_theme text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before text;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  if p_month is null or p_month < 1 or p_month > 12 then raise exception 'invalid month'; end if;
  select theme into v_before from public.theme_schedule where month = p_month;
  if p_theme is null or p_theme = 'none' then
    delete from public.theme_schedule where month = p_month;
  else
    -- Keep in sync with THEMES in shared.js.
    if p_theme not in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm') then
      raise exception 'invalid theme';
    end if;
    insert into public.theme_schedule (month, theme, updated_by, updated_at)
    values (p_month, p_theme, v_actor, now())
    on conflict (month) do update set theme = excluded.theme, updated_by = excluded.updated_by, updated_at = now();
  end if;
  insert into public.audit_log (action, actor_id, before_state, after_state, note)
  values ('set_theme_for_month', v_actor,
          jsonb_build_object('theme', v_before),
          jsonb_build_object('theme', case when p_theme = 'none' then null else p_theme end),
          'month ' || p_month);
end;
$$;

-- Developer-only: sets the colour theme for SEVERAL accounts in one
-- call — either a specific list (p_user_ids) or, when p_user_ids is
-- NULL, every account in the system. Used by the Admin → Appearance
-- "Apply a theme" tool for seasonal palettes (Halloween/Christmas/
-- Easter) a Developer wants everyone (or a chosen group) to see at
-- once, rather than clicking "Edit theme" on each account individually.
-- One audit_log entry covers the whole batch (listing how many
-- accounts and which, capped, rather than one entry per account) so a
-- bulk change doesn't flood the audit trail with near-duplicate rows.
drop function if exists public.set_user_theme_bulk(uuid[], text);
create or replace function public.set_user_theme_bulk(p_user_ids uuid[], p_theme text, p_lock boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor    uuid := public.current_profile_id();
  v_targets  uuid[];
  v_count    int;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;
  -- Locking / unlocking people's themes is Developer-only.
  if p_lock is not null and not public.is_developer() then raise exception 'not permitted'; end if;
  -- Keep in sync with the profiles_theme_check constraint and THEMES in shared.js.
  if p_theme not in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm') then
    raise exception 'invalid theme';
  end if;

  if p_user_ids is null then
    select array_agg(id) into v_targets from public.profiles;
  else
    if array_length(p_user_ids, 1) is null then
      raise exception 'no users selected';
    end if;
    select array_agg(id) into v_targets from public.profiles where id = any(p_user_ids);
  end if;

  v_count := coalesce(array_length(v_targets, 1), 0);
  if v_count = 0 then raise exception 'no matching users found'; end if;

  update public.profiles set theme = p_theme, theme_locked = coalesce(p_lock, theme_locked) where id = any(v_targets);

  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state)
  values ('set_user_theme_bulk', v_actor, null,
          jsonb_build_object('scope', case when p_user_ids is null then 'all_users' else 'selected_users' end),
          jsonb_build_object('theme', p_theme, 'locked', p_lock, 'user_count', v_count,
                              'user_ids', to_jsonb(v_targets)));
end;
$$;

-- Which themes people may pick for THEMSELVES. A theme listed here is
-- Developer-controlled (only a Developer / Admin -> Users can assign it);
-- every theme not listed is open to everyone. Everyone signed in can read
-- it (the topbar picker needs it); only a Developer changes it.
create table if not exists public.theme_restrictions (
  theme text primary key check (theme <> 'default')
);
alter table public.theme_restrictions enable row level security;
drop policy if exists theme_restrictions_select on public.theme_restrictions;
create policy theme_restrictions_select on public.theme_restrictions for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null);

-- Developer-only: replaces the whole list of Developer-controlled themes.
create or replace function public.set_theme_restrictions(p_restricted text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id();
begin
  if not public.is_developer() then raise exception 'not permitted'; end if;
  delete from public.theme_restrictions where true;
  insert into public.theme_restrictions (theme)
    select distinct t from unnest(coalesce(p_restricted, '{}'::text[])) t where t <> 'default';
  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state)
  values ('set_theme_restrictions', v_actor, null, null,
          jsonb_build_object('developer_only_themes', to_jsonb(coalesce(p_restricted, '{}'::text[]))));
end;
$$;

-- Anyone can set their OWN colour theme, unless a Developer has locked it
-- or the theme is Developer-controlled (a Developer is never restricted).
create or replace function public.set_own_theme(p_theme text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_locked boolean;
begin
  if p_theme not in ('default','magenta','forest','crimson','halloween','christmas','easter','antimicrobial','swiftie','barbie','fairytale','autumn','winter','spring','summer','seaside','hills','stdavid','stgeorge','stpatrick','standrew','emergency','surgical','intensive','elderly','paeds','cardiology','endocrine','respiratory','nightsky','deepocean','botanical','retro80s','library','win98','arcade','rainforest','tropical','skyline','desert','spaceconflict','edgadp','fishzoo','rockpool','flashsale','wizard','hospharm','clinfo','beelist','nhsblue','camo','ufo','egypt','rome','greece','aprilfools','wordproc','calmforest','stormaustin','aurora','retropharm') then
    raise exception 'invalid theme';
  end if;
  if not public.is_developer() then
    select theme_locked into v_locked from public.profiles where id = auth.uid();
    if coalesce(v_locked, false) then raise exception 'your theme has been locked by an administrator'; end if;
    if exists (select 1 from public.theme_restrictions where theme = p_theme) then
      raise exception 'that theme is not available to choose';
    end if;
  end if;
  update public.profiles set theme = p_theme where id = auth.uid();
end;
$$;

-- Anyone can set their OWN Light/Dark/Inverted display preference —
-- this is a personal display setting, not an access control, so it
-- carries no role check and (unlike set_user_theme()) is never
-- audit-logged; it only ever touches auth.uid()'s own row.
create or replace function public.set_own_color_mode(p_mode text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_mode not in ('light','dark','inverted') then
    raise exception 'invalid colour mode';
  end if;
  update public.profiles set color_mode = p_mode where id = auth.uid();
end;
$$;

-- No longer called directly by any client — the reset-initial-password
-- edge function clears the flag itself (via a direct table update with
-- the service role) only AFTER it has actually changed the password,
-- so the flag can never be cleared without evidence the password
-- genuinely changed. Kept only for any SQL-editor/administrative use;
-- revoked from every client-facing role so it can't be called directly
-- to bypass the forced-reset requirement the way the old two-step
-- frontend flow (auth.updateUser() then a separate RPC call) allowed.
create or replace function public.clear_must_reset_flag()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set must_reset_password = false where id = auth.uid();
$$;

revoke execute on function public.clear_must_reset_flag() from public, anon, authenticated;

-- One-off bootstrap: promote an already-created auth user (made via the
-- Supabase dashboard) to 'developer'. Run manually from the SQL editor
-- only — never exposed through the app.
create or replace function public.bootstrap_developer(p_auth_uid uuid, p_user_id text, p_initials text, p_full_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, user_id, initials, full_name, role, active, must_reset_password)
  values (p_auth_uid, p_user_id, p_initials, p_full_name, 'developer', true, true)
  on conflict (id) do update set role = 'developer', active = true;
end;
$$;

revoke execute on function public.bootstrap_developer(uuid, text, text, text) from public, anon, authenticated;

-- =====================================================================
-- LEGACY: email_for_user_id
-- Superseded by the login-with-user-id edge function, which resolves
-- User ID -> email entirely server-side and never returns the email to
-- the browser at all — this RPC used to be callable anonymously
-- (`grant ... to anon`) so ANY unauthenticated caller could probe
-- which User IDs exist and learn their synthetic email in one query,
-- which is a real account-enumeration weakness for a login system.
-- Kept only for any SQL-editor/administrative use; revoked from every
-- client-facing role so it can no longer be used that way.
-- =====================================================================

create or replace function public.email_for_user_id(p_user_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_auth_email text;
begin
  select u.email into v_auth_email
    from auth.users u
    join public.profiles p on p.id = u.id
   where p.user_id = p_user_id and p.active = true;
  return v_auth_email;
end;
$$;

revoke execute on function public.email_for_user_id(text) from public, anon, authenticated;

-- =====================================================================
-- RPC EXECUTION HARDENING
--
-- By default, Postgres grants EXECUTE on every newly created function
-- to PUBLIC — meaning, until now, every function in this file
-- (including internal helpers never meant to be called directly) was
-- technically callable by anyone with an API key, `anon` included.
-- Each RPC's own internal role check (is_lead_plus(), etc.) already
-- prevented that from being exploitable, but this closes the gap
-- properly: deny by default, then explicitly grant only what's needed.
--
-- Every function here falls into exactly one of three categories,
-- determined by grepping how it's actually used (not guessed):
--
-- 1. FRONTEND RPCs — called directly via supabase.rpc(...) somewhere
--    in the app. REVOKE from PUBLIC/anon, GRANT to authenticated only.
--    Their own internal role checks are unchanged and still the real
--    authorization boundary — this is defense in depth on top of them,
--    not a replacement.
--
-- 2. RLS-POLICY HELPERS — current_profile_id(), is_lead_plus(), and
--    is_superuser_plus() are referenced DIRECTLY inside a `using (...)`
--    clause on profiles/audit_log (see the RLS section above). A
--    policy's USING clause runs as whichever role is actually querying
--    (`authenticated`, via PostgREST) — NOT as the function owner —
--    so `authenticated` must keep EXECUTE on these three specifically,
--    or every policy that calls them fails outright with "permission
--    denied" instead of correctly enforcing anything. This was
--    verified against a real Postgres instance before writing it here
--    (blanket-revoking a policy-referenced function breaks the policy
--    itself, it doesn't just deny the underlying rows) — anon still
--    gets nothing, since these are only meaningful for a logged-in caller.
--
-- 3. TRUE INTERNAL HELPERS — current_role_name(), is_developer(), and
--    can_process_leave_for() are only ever called from INSIDE other
--    SECURITY DEFINER functions (never from an RLS policy directly,
--    never from the frontend). A SECURITY DEFINER function's body runs
--    as its OWNER, so a nested call from within one doesn't need the
--    original caller's role to hold EXECUTE — these can be revoked
--    from every client-facing role, same as bootstrap_developer(),
--    clear_must_reset_flag(), and email_for_user_id() above.
-- =====================================================================

-- 1. Frontend RPCs — authenticated only.
revoke execute on function public.amend_leave_ranges(uuid, jsonb, text) from public, anon;
grant  execute on function public.amend_leave_ranges(uuid, jsonb, text) to authenticated;

revoke execute on function public.approve_leave(uuid, text, text) from public, anon;
grant  execute on function public.approve_leave(uuid, text, text) to authenticated;

revoke execute on function public.split_leave_with_toil(uuid, jsonb, jsonb, text) from public, anon;
grant  execute on function public.split_leave_with_toil(uuid, jsonb, jsonb, text) to authenticated;

revoke execute on function public.cancel_own_pending_leave(uuid) from public, anon;
grant  execute on function public.cancel_own_pending_leave(uuid) to authenticated;

revoke execute on function public.clear_audit_log() from public, anon;
grant  execute on function public.clear_audit_log() to authenticated;

revoke execute on function public.delete_leave(uuid, text) from public, anon;
grant  execute on function public.delete_leave(uuid, text) to authenticated;

revoke execute on function public.delete_user_account(uuid) from public, anon;
grant  execute on function public.delete_user_account(uuid) to authenticated;

revoke execute on function public.edit_leave(uuid, date, text, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.edit_leave(uuid, date, text, text, jsonb, jsonb, jsonb) to authenticated;

revoke execute on function public.get_profile_directory() from public, anon;
grant  execute on function public.get_profile_directory() to authenticated;

revoke execute on function public.import_historical_leave(
  uuid, date, text, jsonb, jsonb, jsonb, text, uuid, timestamptz, uuid, timestamptz, text, text
) from public, anon;
grant  execute on function public.import_historical_leave(
  uuid, date, text, jsonb, jsonb, jsonb, text, uuid, timestamptz, uuid, timestamptz, text, text
) to authenticated;

revoke execute on function public.reject_leave(uuid, text) from public, anon;
grant  execute on function public.reject_leave(uuid, text) to authenticated;

revoke execute on function public.remove_bank_holiday(date) from public, anon;
grant  execute on function public.remove_bank_holiday(date) to authenticated;

revoke execute on function public.remove_capacity_override(text, date) from public, anon;
grant  execute on function public.remove_capacity_override(text, date) to authenticated;

revoke execute on function public.remove_restricted_day(text, date) from public, anon;
grant  execute on function public.remove_restricted_day(text, date) to authenticated;

revoke execute on function public.add_favourite_color(text, text) from public, anon;
grant  execute on function public.add_favourite_color(text, text) to authenticated;

revoke execute on function public.remove_favourite_color(bigint) from public, anon;
grant  execute on function public.remove_favourite_color(bigint) to authenticated;

revoke execute on function public.request_leave(uuid, date, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.request_leave(uuid, date, text, jsonb, jsonb, jsonb) to authenticated;

revoke execute on function public.request_leave_range(uuid, date, date, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.request_leave_range(uuid, date, date, text, jsonb, jsonb, jsonb) to authenticated;

revoke execute on function public.reset_oncall_rota() from public, anon;
grant  execute on function public.reset_oncall_rota() to authenticated;

revoke execute on function public.reset_app_data() from public, anon;
grant  execute on function public.reset_app_data() to authenticated;

revoke execute on function public.set_bank_holiday(date, text) from public, anon;
grant  execute on function public.set_bank_holiday(date, text) to authenticated;

revoke execute on function public.set_capacity_override(text, date) from public, anon;
grant  execute on function public.set_capacity_override(text, date) to authenticated;

revoke execute on function public.set_capacity_threshold(text, int) from public, anon;
grant  execute on function public.set_capacity_threshold(text, int) to authenticated;

revoke execute on function public.set_backup_recipients(text) from public, anon;
grant  execute on function public.set_backup_recipients(text) to authenticated;

revoke execute on function public.get_backup_schedule() from public, anon;
grant  execute on function public.get_backup_schedule() to authenticated;

revoke execute on function public.set_backup_schedule(int, int) from public, anon;
grant  execute on function public.set_backup_schedule(int, int) to authenticated;

revoke execute on function public.set_dsr_complete(text, int, int, boolean) from public, anon;
grant  execute on function public.set_dsr_complete(text, int, int, boolean) to authenticated;

revoke execute on function public.set_restricted_day(text, date, text, text) from public, anon;
grant  execute on function public.set_restricted_day(text, date, text, text) to authenticated;

revoke execute on function public.set_restricted_range(text, date, date, text, text) from public, anon;
grant  execute on function public.set_restricted_range(text, date, date, text, text) to authenticated;

revoke execute on function public.set_rota_complete(text, int, int, boolean) from public, anon;
grant  execute on function public.set_rota_complete(text, int, int, boolean) to authenticated;

revoke execute on function public.suspend_user(uuid, date, time, text) from public, anon;
grant  execute on function public.suspend_user(uuid, date, time, text) to authenticated;
revoke execute on function public.set_user_active(uuid, boolean) from public, anon;
grant  execute on function public.set_user_active(uuid, boolean) to authenticated;

revoke execute on function public.set_user_hidden(uuid, boolean) from public, anon;
grant  execute on function public.set_user_hidden(uuid, boolean) to authenticated;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant  execute on function public.set_user_role(uuid, text) to authenticated;

revoke execute on function public.set_user_display_name(uuid, text) from public, anon;
grant  execute on function public.set_user_display_name(uuid, text) to authenticated;

revoke execute on function public.set_user_theme(uuid, text, boolean) from public, anon;
grant  execute on function public.set_user_theme(uuid, text, boolean) to authenticated;

revoke execute on function public.set_theme_for_month(int, text) from public, anon;
grant  execute on function public.set_theme_for_month(int, text) to authenticated;

revoke execute on function public.set_user_theme_bulk(uuid[], text, boolean) from public, anon;
grant  execute on function public.set_user_theme_bulk(uuid[], text, boolean) to authenticated;

revoke execute on function public.set_theme_restrictions(text[]) from public, anon;
grant  execute on function public.set_theme_restrictions(text[]) to authenticated;
revoke execute on function public.set_own_theme(text) from public, anon;
grant  execute on function public.set_own_theme(text) to authenticated;

revoke execute on function public.set_own_color_mode(text) from public, anon;
grant  execute on function public.set_own_color_mode(text) to authenticated;

revoke execute on function public.set_user_site(uuid, text, boolean) from public, anon;
grant  execute on function public.set_user_site(uuid, text, boolean) to authenticated;

revoke execute on function public.unapprove_leave(uuid, text) from public, anon;
grant  execute on function public.unapprove_leave(uuid, text) to authenticated;

-- 2. RLS-policy helpers — authenticated must keep EXECUTE (see note
--    above); anon still gets nothing.
revoke execute on function public.current_profile_id() from public, anon;
grant  execute on function public.current_profile_id() to authenticated;

revoke execute on function public.is_lead_plus() from public, anon;
grant  execute on function public.is_lead_plus() to authenticated;

revoke execute on function public.is_superuser_plus() from public, anon;
grant  execute on function public.is_superuser_plus() to authenticated;

revoke execute on function public.is_pharmacy_admin() from public, anon;
grant  execute on function public.is_pharmacy_admin() to authenticated;
revoke execute on function public.can_view_all() from public, anon;
grant  execute on function public.can_view_all() to authenticated;

-- 3. True internal helpers — never called directly by anyone, only
--    nested inside other SECURITY DEFINER functions. No client-facing
--    role needs (or gets) EXECUTE on these at all.
revoke execute on function public.current_role_name() from public, anon, authenticated;
revoke execute on function public.is_developer() from public, anon, authenticated;
revoke execute on function public.can_process_leave_for(uuid) from public, anon, authenticated;
revoke execute on function public.validate_toil_ranges(jsonb) from public, anon, authenticated;

-- Already fully locked down where they were first defined above —
-- restated here too so this section is a complete, standalone audit
-- of every function in the file, not just the ones added since.
revoke execute on function public.clear_must_reset_flag() from public, anon, authenticated;
revoke execute on function public.bootstrap_developer(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.email_for_user_id(text) from public, anon, authenticated;

-- =====================================================================
-- ON-CALL ROTA  (Worthing / St Richard's, independently)
-- =====================================================================
-- Eligibility for a site's on-call pool is a dedicated flag, separate
-- from primary_site/cross_site (which govern ordinary leave). A
-- pharmacist can be eligible at one site, both, or neither. Only
-- Clinical Team Lead (superuser) and Developer can set eligibility;
-- Lead Pharmacist and above can set rota periods/bank holidays and
-- assign duties; only the Developer changes swap settings; everyone with app access can view the rota; pool members
-- can request/respond to/cancel swaps involving their own
-- assignments.
--
-- Weeks on the rota run Sunday-to-Saturday (not Monday-to-Sunday) —
-- the usual pattern is one pharmacist covering Sun-Tue and a second
-- covering Wed-Sat within the same week block.

alter table public.profiles add column if not exists oncall_worthing boolean not null default false;
alter table public.profiles add column if not exists oncall_st_richards boolean not null default false;
alter table public.profiles add column if not exists oncall_color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_oncall_color_check'
  ) then
    alter table public.profiles add constraint profiles_oncall_color_check
      check (oncall_color is null or oncall_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

-- Per-site configuration: how a mutually-agreed swap gets confirmed.
create table if not exists public.oncall_settings (
  site               text primary key check (site in ('worthing','st_richards')),
  swap_approval_mode text not null default 'lead_approval' check (swap_approval_mode in ('auto','lead_approval')),
  updated_by         uuid references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);
insert into public.oncall_settings (site) values ('worthing'), ('st_richards')
  on conflict (site) do nothing;

-- A named date range (typically a calendar year) the rota is built
-- within, e.g. "2027" running 2027-01-01 to 2027-12-31. Not site-
-- specific — the same period applies to both sites. Archiving one
-- (once it's finished with) blocks further edits to any shift whose
-- date falls inside it, without deleting anything, so a new period
-- can be started for the next year while the old one stays on record
-- exactly as it was. Idempotent re-run note: this table is only ever
-- created once — re-running this script never touches existing rows.
create table if not exists public.oncall_rota_periods (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'active' check (status in ('active','archived')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  constraint oncall_rota_periods_date_order check (end_date >= start_date)
);
create index if not exists oncall_rota_periods_dates_idx
  on public.oncall_rota_periods (start_date, end_date);

-- "Complete rota": while a period is a draft it is being built and
-- individual edits aren't logged one by one; once it is marked complete,
-- every later edit appears in the audit trail. Periods that already existed
-- when this was added are treated as complete, so nothing already in use
-- stops being audited.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'oncall_rota_periods' and column_name = 'completed_at') then
    alter table public.oncall_rota_periods add column completed_at timestamptz;
    alter table public.oncall_rota_periods add column completed_by uuid references public.profiles(id) on delete set null;
    update public.oncall_rota_periods set completed_at = created_at;
  end if;
end $$;

-- Bank holidays as they apply to the on-call rota specifically —
-- deliberately separate from the leave-calendar bank_holidays table
-- (§9 of the README), since marking a day here is just a rota
-- planning aid (it flags that an onsite shift is expected) and
-- shouldn't change anything about ordinary leave capacity elsewhere.
create table if not exists public.oncall_bank_holidays (
  holiday_date date primary key,
  label        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Colour the day is shown in on the rota (light blue by default).
alter table public.oncall_bank_holidays add column if not exists color text not null default '#bfe3f7';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'oncall_bank_holidays_color_check') then
    alter table public.oncall_bank_holidays add constraint oncall_bank_holidays_color_check
      check (color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

-- One row per (site, date, duty_type). duty_type:
--   on_call — the main on-call pharmacist for the day.
--   onsite  — the separate "Onsite on-call shift (Vor) 1100-1500"
--             slot; independently assignable, may be a different
--             person than on_call for the same day. On a day marked
--             in oncall_bank_holidays, an onsite shift is expected —
--             the rota view flags it if left empty, though nothing
--             here stops it being saved that way.
-- note/highlight_color let a Team Lead annotate a specific cell (e.g.
-- "First on call", or "Replaced with J Smith due to sickness" when
-- overwriting who's assigned) with an optional hover note and/or
-- colour override, shown instead of the assigned person's own
-- oncall_color.
create table if not exists public.oncall_assignments (
  id               uuid primary key default gen_random_uuid(),
  site             text not null check (site in ('worthing','st_richards')),
  shift_date       date not null,
  duty_type        text not null check (duty_type in ('on_call','onsite')),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  note             text,
  highlight_color  text check (highlight_color is null or highlight_color ~ '^#[0-9a-fA-F]{6}$'),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now(),
  unique (site, shift_date, duty_type)
);
-- Set when someone with edit rights manually replaces the person on a
-- shift: holds who was on it before (shown as a "*" on the rota).
alter table public.oncall_assignments
  add column if not exists replaced_user_id uuid references public.profiles(id) on delete set null;

create index if not exists oncall_assignments_site_date_idx
  on public.oncall_assignments (site, shift_date);
create index if not exists oncall_assignments_user_idx
  on public.oncall_assignments (user_id);

-- Idempotent migration: an earlier version of this feature also had a
-- "volunteer_cover" duty type, since removed. Drop any such rows and
-- tighten the constraint back down to just on_call/onsite, on a
-- database that already had the old version.
delete from public.oncall_assignments where duty_type = 'volunteer_cover';
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'oncall_assignments_duty_type_check'
      and pg_get_constraintdef(oid) like '%volunteer_cover%'
  ) then
    alter table public.oncall_assignments drop constraint oncall_assignments_duty_type_check;
    alter table public.oncall_assignments add constraint oncall_assignments_duty_type_check
      check (duty_type in ('on_call','onsite'));
  end if;
end $$;

-- A swap offer between two pool members. Flexible, not strict 1-for-1:
-- the requester offers zero-or-more of their own assignments and asks
-- for zero-or-more of the counterparty's (e.g. "3 days for 4 days", or
-- a pure give-away with nothing asked in return) — see
-- oncall_swap_items. status:
--   pending            — awaiting the counterparty's decision.
--   declined           — counterparty said no.
--   cancelled          — requester withdrew it before the counterparty acted.
--   awaiting_approval  — both agreed; site is in lead_approval mode, pending Lead/Team Lead sign-off.
--   rejected           — a Lead/Team Lead declined it at that stage.
--   completed          — applied: the underlying assignments have swapped owners.
create table if not exists public.oncall_swap_requests (
  id                       uuid primary key default gen_random_uuid(),
  site                     text not null check (site in ('worthing','st_richards')),
  requested_by             uuid not null references public.profiles(id) on delete cascade,
  counterparty_id          uuid not null references public.profiles(id) on delete cascade,
  status                   text not null default 'pending'
                             check (status in ('pending','declined','cancelled','awaiting_approval','rejected','completed')),
  note                     text,
  counterparty_decision_at timestamptz,
  reviewed_by              uuid references public.profiles(id) on delete set null,
  reviewed_at              timestamptz,
  review_note              text,
  created_at               timestamptz not null default now()
);
create index if not exists oncall_swap_requests_status_idx
  on public.oncall_swap_requests (status);
create index if not exists oncall_swap_requests_parties_idx
  on public.oncall_swap_requests (requested_by, counterparty_id);

-- Which specific assignments move, and in which direction, as part of
-- a swap request. direction = 'from_requester' means this assignment
-- currently belongs to requested_by and would move to counterparty_id
-- on completion; 'from_counterparty' is the reverse.
create table if not exists public.oncall_swap_items (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.oncall_swap_requests(id) on delete cascade,
  assignment_id uuid not null references public.oncall_assignments(id) on delete cascade,
  direction     text not null check (direction in ('from_requester','from_counterparty'))
);
create index if not exists oncall_swap_items_request_idx
  on public.oncall_swap_items (request_id);

alter table public.oncall_settings      enable row level security;
alter table public.oncall_rota_periods  enable row level security;
alter table public.oncall_bank_holidays enable row level security;
alter table public.oncall_assignments   enable row level security;
alter table public.oncall_swap_requests enable row level security;
alter table public.oncall_swap_items    enable row level security;

-- The rota itself, which rota periods exist, and which days are bank
-- holidays, are all viewable by anyone with app access.
drop policy if exists oncall_assignments_select on public.oncall_assignments;
create policy oncall_assignments_select on public.oncall_assignments for select
  using (auth.role() = 'authenticated' and public.can_view_oncall());

drop policy if exists oncall_rota_periods_select on public.oncall_rota_periods;
create policy oncall_rota_periods_select on public.oncall_rota_periods for select
  using (auth.role() = 'authenticated' and public.can_view_oncall());

drop policy if exists oncall_bank_holidays_select on public.oncall_bank_holidays;
create policy oncall_bank_holidays_select on public.oncall_bank_holidays for select
  using (auth.role() = 'authenticated' and public.can_view_oncall());

-- The swap-approval-mode setting is only ever shown on the Admin ->
-- On-Call Settings tab, which is Clinical Team Lead+/Developer only.
drop policy if exists oncall_settings_select on public.oncall_settings;
create policy oncall_settings_select on public.oncall_settings for select
  using (public.is_superuser_plus() or public.is_pharmacy_admin());

-- A swap request is visible to its two parties and to anyone who can
-- approve it (Lead Pharmacist+), not to the whole app.
drop policy if exists oncall_swap_requests_select on public.oncall_swap_requests;
create policy oncall_swap_requests_select on public.oncall_swap_requests for select
  using (
    auth.role() = 'authenticated'
    and public.current_profile_id() is not null
    and (
      requested_by = public.current_profile_id()
      or counterparty_id = public.current_profile_id()
      or public.is_lead_plus() or public.is_pharmacy_admin()
    )
  );

drop policy if exists oncall_swap_items_select on public.oncall_swap_items;
create policy oncall_swap_items_select on public.oncall_swap_items for select
  using (
    exists (
      select 1 from public.oncall_swap_requests r
      where r.id = oncall_swap_items.request_id
        and (
          r.requested_by = public.current_profile_id()
          or r.counterparty_id = public.current_profile_id()
          or public.is_lead_plus() or public.is_pharmacy_admin()
        )
    )
  );

-- ---------------------------------------------------------------
-- Internal helper: refuses to let a shift inside an ARCHIVED rota
-- period be changed. A date that falls outside any period, or inside
-- an active one, is left alone (periods are a planning aid, not a
-- precondition for every single assignment). Not exposed to clients —
-- called from inside the write functions below.
-- ---------------------------------------------------------------
create or replace function public.assert_oncall_date_editable(p_date date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_period public.oncall_rota_periods;
begin
  select * into v_period from public.oncall_rota_periods
    where p_date between start_date and end_date
    order by created_at desc
    limit 1;
  if v_period is null then
    raise exception 'no rota period covers % — create the rota period (with its exact start and end dates) first', p_date;
  end if;
  if v_period.status = 'archived' then
    raise exception 'that date is in the "%" rota period, which is archived and can no longer be edited', v_period.label;
  end if;
end;
$$;

-- True when the rota period covering this date has been marked complete
-- (so edits to it must be recorded in the audit trail). Internal helper.
create or replace function public.oncall_date_is_complete(p_date date)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select completed_at is not null
                     from public.oncall_rota_periods
                    where p_date between start_date and end_date
                    order by created_at desc
                    limit 1), false);
$$;

-- ---------------------------------------------------------------
-- Eligibility & personal colour (Clinical Team Lead / Developer only)
-- ---------------------------------------------------------------
create or replace function public.set_user_oncall_eligibility(
  p_user_id        uuid,
  p_worthing       boolean,
  p_st_richards    boolean,
  p_color          text default null
)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_before public.profiles;
  v_row    public.profiles;
begin
  if not public.is_superuser_plus() then
    raise exception 'not permitted to set on-call eligibility';
  end if;
  if p_color is not null and p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'colour must be a 6-digit hex value, e.g. #1a2b3c';
  end if;

  select * into v_before from public.profiles where id = p_user_id;
  if v_before is null then raise exception 'user not found'; end if;

  update public.profiles
     set oncall_worthing    = p_worthing,
         oncall_st_richards = p_st_richards,
         oncall_color       = coalesce(p_color, oncall_color)
   where id = p_user_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state, note)
  values ('set_oncall_eligibility', v_actor, p_user_id, to_jsonb(v_before), to_jsonb(v_row), null);

  return v_row;
end;
$$;

-- ---------------------------------------------------------------
-- Swap-approval mode per site (Developer only)
-- ---------------------------------------------------------------
create or replace function public.set_oncall_swap_mode(p_site text, p_mode text)
returns public.oncall_settings
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.oncall_settings;
begin
  if not public.is_superuser_plus() then
    raise exception 'only a Clinical Team Lead or Developer can change the swap approval mode';
  end if;
  if p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;
  if p_mode not in ('auto','lead_approval') then raise exception 'invalid mode'; end if;

  insert into public.oncall_settings (site, swap_approval_mode, updated_by, updated_at)
  values (p_site, p_mode, v_actor, now())
  on conflict (site) do update
    set swap_approval_mode = excluded.swap_approval_mode,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
  returning * into v_row;

  insert into public.audit_log (action, actor_id, note)
  values ('set_oncall_swap_mode', v_actor, p_site || ' -> ' || p_mode);

  return v_row;
end;
$$;

-- ---------------------------------------------------------------
-- Rota periods (Clinical Team Lead / Developer only)
-- ---------------------------------------------------------------
create or replace function public.create_oncall_rota_period(
  p_label      text,
  p_start_date date,
  p_end_date   date
)
returns public.oncall_rota_periods
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.oncall_rota_periods;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to manage rota periods';
  end if;
  if p_label is null or btrim(p_label) = '' then raise exception 'a label is required, e.g. 2027'; end if;
  if p_label !~ '(19|20)[0-9]{2}' then raise exception 'the label must include the year, e.g. "2027"'; end if;
  if p_start_date is null or p_end_date is null then raise exception 'start and end dates are required'; end if;
  if p_end_date < p_start_date then raise exception 'end date must be on or after the start date'; end if;
  if p_end_date - p_start_date > 365 then raise exception 'a rota period covers at most one year (366 days)'; end if;
  if exists (
    select 1 from public.oncall_rota_periods
    where p_start_date <= end_date and p_end_date >= start_date
  ) then
    raise exception 'that date range overlaps an existing rota period';
  end if;

  insert into public.oncall_rota_periods (label, start_date, end_date, created_by)
  values (btrim(p_label), p_start_date, p_end_date, v_actor)
  returning * into v_row;

  insert into public.audit_log (action, actor_id, note)
  values ('create_oncall_rota_period', v_actor, v_row.label || ' (' || p_start_date || ' to ' || p_end_date || ')');

  return v_row;
end;
$$;

create or replace function public.archive_oncall_rota_period(p_period_id uuid)
returns public.oncall_rota_periods
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.oncall_rota_periods;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to manage rota periods';
  end if;

  update public.oncall_rota_periods
     set status = 'archived', archived_by = v_actor, archived_at = now()
   where id = p_period_id
   returning * into v_row;
  if v_row is null then raise exception 'rota period not found'; end if;

  insert into public.audit_log (action, actor_id, note)
  values ('archive_oncall_rota_period', v_actor, v_row.label);

  return v_row;
end;
$$;

create or replace function public.reopen_oncall_rota_period(p_period_id uuid)
returns public.oncall_rota_periods
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.oncall_rota_periods;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to manage rota periods';
  end if;

  update public.oncall_rota_periods
     set status = 'active', archived_by = null, archived_at = null
   where id = p_period_id
   returning * into v_row;
  if v_row is null then raise exception 'rota period not found'; end if;

  insert into public.audit_log (action, actor_id, note)
  values ('reopen_oncall_rota_period', v_actor, v_row.label);

  return v_row;
end;
$$;

-- Mark a rota period as complete. From then on every change to a shift
-- inside it is recorded in the audit trail.
create or replace function public.complete_oncall_rota_period(p_period_id uuid)
returns public.oncall_rota_periods
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.oncall_rota_periods;
  v_n     bigint;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to manage rota periods';
  end if;

  select * into v_row from public.oncall_rota_periods where id = p_period_id;
  if v_row.id is null then raise exception 'rota period not found'; end if;
  if v_row.completed_at is not null then raise exception 'this rota is already marked complete'; end if;

  update public.oncall_rota_periods
     set completed_at = now(), completed_by = v_actor
   where id = p_period_id
   returning * into v_row;

  select count(*) into v_n from public.oncall_assignments
   where shift_date between v_row.start_date and v_row.end_date;

  insert into public.audit_log (action, actor_id, note)
  values ('complete_oncall_rota_period', v_actor, v_row.label || ' marked complete (' || v_n || ' shifts allocated)');

  return v_row;
end;
$$;

-- A pharmacist's own colour on the rota. Anyone who can build the rota
-- (Lead Pharmacist and above) can set it.
create or replace function public.set_oncall_user_color(p_user_id uuid, p_color text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to set rota colours';
  end if;
  if p_color is null or p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'colour must be a 6-digit hex value, e.g. #a5d8ff';
  end if;
  select * into v_target from public.profiles where id = p_user_id;
  if v_target.id is null then raise exception 'user not found'; end if;

  update public.profiles set oncall_color = lower(p_color) where id = p_user_id;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values ('set_oncall_user_color', v_actor, p_user_id, 'rota colour -> ' || lower(p_color));
end;
$$;

-- ---------------------------------------------------------------
-- On-call bank holidays (Clinical Team Lead / Developer only)
-- ---------------------------------------------------------------
-- The earlier two-argument version is dropped so the new signature
-- below doesn't leave an ambiguous overload behind.
drop function if exists public.set_oncall_bank_holiday(date, text);

create or replace function public.set_oncall_bank_holiday(p_date date, p_label text default null, p_color text default null)
returns public.oncall_bank_holidays
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.oncall_bank_holidays;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to set on-call bank holidays';
  end if;
  if p_color is not null and p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'colour must be a 6-digit hex value';
  end if;

  insert into public.oncall_bank_holidays (holiday_date, label, color, created_by)
  values (p_date, p_label, coalesce(p_color, '#bfe3f7'), v_actor)
  on conflict (holiday_date) do update
    set label = excluded.label,
        color = coalesce(p_color, public.oncall_bank_holidays.color)
  returning * into v_row;

  insert into public.audit_log (action, actor_id, note)
  values ('set_oncall_bank_holiday', v_actor, p_date || coalesce(': ' || p_label, ''));

  return v_row;
end;
$$;

create or replace function public.remove_oncall_bank_holiday(p_date date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to remove on-call bank holidays';
  end if;

  delete from public.oncall_bank_holidays where holiday_date = p_date;

  insert into public.audit_log (action, actor_id, note)
  values ('remove_oncall_bank_holiday', v_actor, p_date::text);
end;
$$;

-- ---------------------------------------------------------------
-- Assign / clear a single day's duty (Clinical Team Lead / Developer only)
-- ---------------------------------------------------------------
create or replace function public.set_oncall_assignment(
  p_site            text,
  p_shift_date      date,
  p_duty_type       text,
  p_user_id         uuid,
  p_note            text default null,
  p_highlight_color text default null
)
returns public.oncall_assignments
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_target public.profiles;
  v_before public.oncall_assignments;
  v_row    public.oncall_assignments;
  v_onsite public.oncall_assignments;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to edit the on-call rota';
  end if;
  if p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;
  if p_duty_type not in ('on_call','onsite') then raise exception 'invalid duty type'; end if;
  if p_highlight_color is not null and p_highlight_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'highlight colour must be a 6-digit hex value';
  end if;
  perform public.assert_oncall_date_editable(p_shift_date);

  -- The onsite shift only exists on Saturdays, Sundays and days marked
  -- as on-call bank holidays.
  if p_duty_type = 'onsite'
     and extract(dow from p_shift_date) not in (0, 6)
     and not exists (select 1 from public.oncall_bank_holidays where holiday_date = p_shift_date) then
    raise exception 'onsite shifts can only be set on Saturdays, Sundays and bank holidays';
  end if;

  select * into v_target from public.profiles where id = p_user_id and active = true;
  if v_target is null then raise exception 'person not found or inactive'; end if;

  if (p_site = 'worthing' and not v_target.oncall_worthing)
     or (p_site = 'st_richards' and not v_target.oncall_st_richards) then
    raise exception 'that person is not in the on-call pool for this site';
  end if;

  select * into v_before from public.oncall_assignments
    where site = p_site and shift_date = p_shift_date and duty_type = p_duty_type;

  insert into public.oncall_assignments (site, shift_date, duty_type, user_id, note, highlight_color, created_by, updated_by)
  values (p_site, p_shift_date, p_duty_type, p_user_id, p_note, p_highlight_color, v_actor, v_actor)
  on conflict (site, shift_date, duty_type) do update
    set replaced_user_id = case
                             when public.oncall_assignments.user_id <> excluded.user_id then public.oncall_assignments.user_id
                             else public.oncall_assignments.replaced_user_id
                           end,
        user_id         = excluded.user_id,
        note            = excluded.note,
        highlight_color = excluded.highlight_color,
        updated_by      = excluded.updated_by,
        updated_at      = now()
  returning * into v_row;

  -- Only edits to a completed rota are individually audited (a draft is still being built).
  if public.oncall_date_is_complete(p_shift_date) then
    insert into public.audit_log (action, actor_id, target_user_id, before_state, after_state, note)
    values ('set_oncall_assignment', v_actor, p_user_id, to_jsonb(v_before), to_jsonb(v_row),
            p_site || ' ' || p_shift_date || ' ' || p_duty_type || coalesce(' — ' || nullif(btrim(p_note), ''), '') || ' [after completion]');
  end if;

  -- Whoever is on overnight at the weekend or on a bank holiday is also
  -- the onsite person: fill the onsite slot automatically. It's filled
  -- when empty, or when it currently holds the person being replaced
  -- (so a manual swap moves both). An onsite slot deliberately given to
  -- somebody else is left alone.
  if p_duty_type = 'on_call'
     and (extract(dow from p_shift_date) in (0, 6)
          or exists (select 1 from public.oncall_bank_holidays where holiday_date = p_shift_date)) then
    select * into v_onsite from public.oncall_assignments
      where site = p_site and shift_date = p_shift_date and duty_type = 'onsite';
    if v_onsite.id is null
       or (v_before.id is not null and v_onsite.user_id = v_before.user_id and v_onsite.user_id <> p_user_id) then
      perform public.set_oncall_assignment(p_site, p_shift_date, 'onsite', p_user_id, p_note, p_highlight_color);
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.clear_oncall_assignment(
  p_site       text,
  p_shift_date date,
  p_duty_type  text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.oncall_assignments;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to edit the on-call rota';
  end if;
  perform public.assert_oncall_date_editable(p_shift_date);

  select * into v_before from public.oncall_assignments
    where site = p_site and shift_date = p_shift_date and duty_type = p_duty_type;
  if v_before is null then return; end if;

  delete from public.oncall_assignments
    where site = p_site and shift_date = p_shift_date and duty_type = p_duty_type;

  if public.oncall_date_is_complete(p_shift_date) then
    insert into public.audit_log (action, actor_id, target_user_id, before_state, note)
    values ('clear_oncall_assignment', v_actor, v_before.user_id, to_jsonb(v_before),
            p_site || ' ' || p_shift_date || ' ' || p_duty_type || ' [after completion]');
  end if;
end;
$$;

-- Quick-fill helper: assign the SAME person/duty/note/colour across
-- several dates in one call and one audit entry (e.g. building out a
-- whole year's rota a block at a time). Each date still goes through
-- set_oncall_assignment() above, so pool-eligibility and archived-
-- period checks apply exactly as they would one at a time.
create or replace function public.bulk_set_oncall_assignments(
  p_site            text,
  p_duty_type       text,
  p_user_id         uuid,
  p_dates           date[],
  p_note            text default null,
  p_highlight_color text default null
)
returns setof public.oncall_assignments
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_date  date;
  v_row   public.oncall_assignments;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to edit the on-call rota';
  end if;
  if p_dates is null or array_length(p_dates, 1) is null then
    raise exception 'no dates supplied';
  end if;

  foreach v_date in array p_dates loop
    v_row := public.set_oncall_assignment(p_site, v_date, p_duty_type, p_user_id, p_note, p_highlight_color);
    return next v_row;
  end loop;

  if exists (select 1 from unnest(p_dates) d where public.oncall_date_is_complete(d)) then
    insert into public.audit_log (action, actor_id, target_user_id, note)
    values ('bulk_set_oncall_assignments', v_actor, p_user_id,
            p_site || ' ' || p_duty_type || ' x' || array_length(p_dates, 1) ||
            ' (' || (select min(d) from unnest(p_dates) d) || ' to ' || (select max(d) from unnest(p_dates) d) || ') [after completion]');
  end if;

  return;
end;
$$;

-- Highlight one or more existing assignments with a note (hover
-- tooltip, shown on the grid itself too — e.g. to record "Replaced
-- with J Smith due to sickness" against a day that's been
-- reassigned) and/or a colour override, without changing who's
-- assigned.
create or replace function public.annotate_oncall_assignments(
  p_assignment_ids  uuid[],
  p_note            text default null,
  p_highlight_color text default null
)
returns setof public.oncall_assignments
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_count int;
  v_id    uuid;
  v_date  date;
begin
  if not public.is_lead_plus() then
    raise exception 'not permitted to edit the on-call rota';
  end if;
  if p_assignment_ids is null or array_length(p_assignment_ids, 1) is null then
    raise exception 'no shifts selected';
  end if;
  if p_highlight_color is not null and p_highlight_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'highlight colour must be a 6-digit hex value';
  end if;

  foreach v_id in array p_assignment_ids loop
    select shift_date into v_date from public.oncall_assignments where id = v_id;
    if v_date is not null then perform public.assert_oncall_date_editable(v_date); end if;
  end loop;

  update public.oncall_assignments
     set note = p_note, highlight_color = p_highlight_color, updated_by = v_actor, updated_at = now()
   where id = any(p_assignment_ids);
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'no matching shifts found'; end if;

  insert into public.audit_log (action, actor_id, note)
  values ('annotate_oncall_assignments', v_actor, 'x' || v_count || coalesce(': ' || p_note, ''));

  return query select * from public.oncall_assignments where id = any(p_assignment_ids);
end;
$$;

-- ---------------------------------------------------------------
-- Swaps (pool members request/respond/cancel; Lead+ review when the
-- site requires approval)
-- ---------------------------------------------------------------
create or replace function public.request_oncall_swap(
  p_counterparty_id       uuid,
  p_give_assignment_ids   uuid[] default '{}',
  p_take_assignment_ids   uuid[] default '{}',
  p_note                  text default null
)
returns public.oncall_swap_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_site  text;
  v_id    uuid;
  v_a     public.oncall_assignments;
  v_row   public.oncall_swap_requests;
begin
  if not public.is_staff() then raise exception 'your account is read-only'; end if;
  if v_actor is null then raise exception 'not signed in'; end if;
  if p_counterparty_id = v_actor then raise exception 'cannot request a swap with yourself'; end if;
  -- A swap must include at least one of the requester's OWN shifts and at
  -- least one of the counterparty's — nobody can broker a swap between
  -- two other people, and a swap is an exchange, not a hand-over.
  if p_give_assignment_ids is null or array_length(p_give_assignment_ids, 1) is null then
    raise exception 'select at least one of your own shifts to give';
  end if;
  if p_take_assignment_ids is null or array_length(p_take_assignment_ids, 1) is null then
    raise exception 'select at least one of the other person''s shifts to take';
  end if;

  if not exists (select 1 from public.profiles where id = p_counterparty_id and active = true) then
    raise exception 'that person was not found or is inactive';
  end if;

  if p_give_assignment_ids is not null then
    foreach v_id in array p_give_assignment_ids loop
      select * into v_a from public.oncall_assignments where id = v_id for update;
      if v_a is null then raise exception 'one of the offered shifts no longer exists'; end if;
      if exists (select 1 from public.oncall_swap_items i
                   join public.oncall_swap_requests r on r.id = i.request_id
                  where i.assignment_id = v_id and r.status in ('pending','awaiting_approval')) then
        raise exception 'the shift on % already has a swap request in progress — it must be cancelled or rejected before it can be offered again', v_a.shift_date;
      end if;
      if v_a.user_id <> v_actor then raise exception 'you can only offer your own shifts'; end if;
      if v_a.shift_date < current_date then raise exception 'shifts in the past cannot be swapped'; end if;
      if v_site is null then v_site := v_a.site; elsif v_site <> v_a.site then raise exception 'all shifts in a swap must be at the same site'; end if;
    end loop;
  end if;

  if p_take_assignment_ids is not null then
    foreach v_id in array p_take_assignment_ids loop
      select * into v_a from public.oncall_assignments where id = v_id for update;
      if v_a is null then raise exception 'one of the requested shifts no longer exists'; end if;
      if exists (select 1 from public.oncall_swap_items i
                   join public.oncall_swap_requests r on r.id = i.request_id
                  where i.assignment_id = v_id and r.status in ('pending','awaiting_approval')) then
        raise exception 'the shift on % already has a swap request in progress — it must be cancelled or rejected before it can be offered again', v_a.shift_date;
      end if;
      if v_a.user_id <> p_counterparty_id then raise exception 'you can only request that person''s own shifts'; end if;
      if v_a.shift_date < current_date then raise exception 'shifts in the past cannot be swapped'; end if;
      if v_site is null then v_site := v_a.site; elsif v_site <> v_a.site then raise exception 'all shifts in a swap must be at the same site'; end if;
    end loop;
  end if;

  insert into public.oncall_swap_requests (site, requested_by, counterparty_id, note)
  values (v_site, v_actor, p_counterparty_id, p_note)
  returning * into v_row;

  if p_give_assignment_ids is not null then
    foreach v_id in array p_give_assignment_ids loop
      insert into public.oncall_swap_items (request_id, assignment_id, direction)
      values (v_row.id, v_id, 'from_requester');
    end loop;
  end if;
  if p_take_assignment_ids is not null then
    foreach v_id in array p_take_assignment_ids loop
      insert into public.oncall_swap_items (request_id, assignment_id, direction)
      values (v_row.id, v_id, 'from_counterparty');
    end loop;
  end if;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values ('request_oncall_swap', v_actor, p_counterparty_id,
    v_site || ' — offering: ' ||
      coalesce((select string_agg(a.shift_date::text || ' ' || a.duty_type, ', ' order by a.shift_date)
                from public.oncall_swap_items i join public.oncall_assignments a on a.id = i.assignment_id
                where i.request_id = v_row.id and i.direction = 'from_requester'), 'nothing') ||
      '; asking for: ' ||
      coalesce((select string_agg(a.shift_date::text || ' ' || a.duty_type, ', ' order by a.shift_date)
                from public.oncall_swap_items i join public.oncall_assignments a on a.id = i.assignment_id
                where i.request_id = v_row.id and i.direction = 'from_counterparty'), 'nothing') ||
      coalesce(' (' || nullif(btrim(p_note), '') || ')', ''));

  return v_row;
end;
$$;

-- Internal helper (not exposed/granted directly): actually moves the
-- underlying assignments' ownership once a swap is confirmed, whether
-- that happened automatically or via Lead/Team Lead approval. Checked
-- again here (not just at request time) in case a rota period was
-- archived in the meantime.
create or replace function public.apply_oncall_swap(p_request_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req  public.oncall_swap_requests;
  v_date date;
  v_summary text;
begin
  select * into v_req from public.oncall_swap_requests where id = p_request_id;
  if v_req is null then raise exception 'swap request not found'; end if;

  select string_agg(a.shift_date::text || ' ' || a.duty_type || ' ' || po.initials || ' -> ' || pn.initials, '; ' order by a.shift_date)
    into v_summary
    from public.oncall_swap_items i
    join public.oncall_assignments a on a.id = i.assignment_id
    join public.profiles po on po.id = a.user_id
    join public.profiles pn on pn.id = case when i.direction = 'from_requester' then v_req.counterparty_id else v_req.requested_by end
   where i.request_id = p_request_id;

  for v_date in
    select a.shift_date from public.oncall_assignments a
    join public.oncall_swap_items i on i.assignment_id = a.id
    where i.request_id = p_request_id
  loop
    perform public.assert_oncall_date_editable(v_date);
  end loop;

  update public.oncall_assignments a
     set user_id = v_req.counterparty_id, replaced_user_id = null, updated_by = v_req.counterparty_id, updated_at = now()
   where a.id in (
     select assignment_id from public.oncall_swap_items
     where request_id = p_request_id and direction = 'from_requester'
   );

  update public.oncall_assignments a
     set user_id = v_req.requested_by, replaced_user_id = null, updated_by = v_req.requested_by, updated_at = now()
   where a.id in (
     select assignment_id from public.oncall_swap_items
     where request_id = p_request_id and direction = 'from_counterparty'
   );

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values ('apply_oncall_swap', v_req.requested_by, v_req.counterparty_id, coalesce(v_req.site || ': ' || v_summary, 'request ' || p_request_id));
end;
$$;

create or replace function public.respond_oncall_swap(
  p_request_id uuid,
  p_accept     boolean,
  p_note       text default null
)
returns public.oncall_swap_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_req   public.oncall_swap_requests;
  v_mode  text;
  v_row   public.oncall_swap_requests;
begin
  if not public.is_staff() then raise exception 'your account is read-only'; end if;
  select * into v_req from public.oncall_swap_requests where id = p_request_id;
  if v_req is null then raise exception 'swap request not found'; end if;
  if v_req.counterparty_id <> v_actor then raise exception 'only the other party can respond to this swap'; end if;
  if v_req.status <> 'pending' then raise exception 'this swap has already been actioned'; end if;

  if not p_accept then
    update public.oncall_swap_requests
       set status = 'declined', counterparty_decision_at = now(), review_note = p_note
     where id = p_request_id
     returning * into v_row;

    insert into public.audit_log (action, actor_id, target_user_id, note)
    values ('decline_oncall_swap', v_actor, v_req.requested_by, p_note);

    return v_row;
  end if;

  select swap_approval_mode into v_mode from public.oncall_settings where site = v_req.site;

  if coalesce(v_mode, 'lead_approval') = 'auto' then
    update public.oncall_swap_requests
       set status = 'completed', counterparty_decision_at = now(), review_note = p_note
     where id = p_request_id
     returning * into v_row;

    perform public.apply_oncall_swap(p_request_id);

    insert into public.audit_log (action, actor_id, target_user_id, note)
    values ('accept_oncall_swap', v_actor, v_req.requested_by, 'auto-confirmed: ' || coalesce(p_note, ''));
  else
    update public.oncall_swap_requests
       set status = 'awaiting_approval', counterparty_decision_at = now(), review_note = p_note
     where id = p_request_id
     returning * into v_row;

    insert into public.audit_log (action, actor_id, target_user_id, note)
    values ('accept_oncall_swap', v_actor, v_req.requested_by, 'awaiting lead approval: ' || coalesce(p_note, ''));
  end if;

  return v_row;
end;
$$;

create or replace function public.cancel_oncall_swap(p_request_id uuid, p_note text default null)
returns public.oncall_swap_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_req   public.oncall_swap_requests;
  v_row   public.oncall_swap_requests;
begin
  if not public.is_staff() then raise exception 'your account is read-only'; end if;
  select * into v_req from public.oncall_swap_requests where id = p_request_id;
  if v_req is null then raise exception 'swap request not found'; end if;
  if v_req.requested_by <> v_actor then raise exception 'only the requester can cancel this swap'; end if;
  if v_req.status <> 'pending' then raise exception 'this swap can no longer be cancelled'; end if;

  update public.oncall_swap_requests
     set status = 'cancelled'
   where id = p_request_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, target_user_id, note)
  values ('cancel_oncall_swap', v_actor, v_req.counterparty_id, p_note);

  return v_row;
end;
$$;

create or replace function public.review_oncall_swap(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns public.oncall_swap_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_req   public.oncall_swap_requests;
  v_row   public.oncall_swap_requests;
begin
  if not public.is_lead_plus() then raise exception 'not permitted to approve swaps'; end if;

  select * into v_req from public.oncall_swap_requests where id = p_request_id;
  if v_req is null then raise exception 'swap request not found'; end if;
  if v_req.status <> 'awaiting_approval' then raise exception 'this swap is not awaiting approval'; end if;

  if p_approve then
    update public.oncall_swap_requests
       set status = 'completed', reviewed_by = v_actor, reviewed_at = now(), review_note = p_note
     where id = p_request_id
     returning * into v_row;

    perform public.apply_oncall_swap(p_request_id);

    insert into public.audit_log (action, actor_id, target_user_id, note)
    values ('approve_oncall_swap', v_actor, v_req.requested_by, p_note);
  else
    update public.oncall_swap_requests
       set status = 'rejected', reviewed_by = v_actor, reviewed_at = now(), review_note = p_note
     where id = p_request_id
     returning * into v_row;

    insert into public.audit_log (action, actor_id, target_user_id, note)
    values ('reject_oncall_swap', v_actor, v_req.requested_by, p_note);
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------
-- On-call audit trail — readable by EVERY signed-in, active user (the
-- main audit_log table is Clinical Team Lead+ only). Returns only the
-- on-call related entries, newest first, paged by timestamp.
-- ---------------------------------------------------------------
create or replace function public.get_oncall_audit(
  p_limit  int default 200,
  p_before timestamptz default null
)
returns table (
  id             uuid,
  created_at     timestamptz,
  action         text,
  actor_id       uuid,
  target_user_id uuid,
  note           text,
  before_state   jsonb,
  after_state    jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null then
    raise exception 'not signed in';
  end if;
  return query
    select a.id, a.created_at, a.action, a.actor_id, a.target_user_id, a.note, a.before_state, a.after_state
      from public.audit_log a
     where a.action like '%oncall%'
       and (p_before is null or a.created_at < p_before)
     order by a.created_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

revoke execute on function public.get_oncall_audit(int, timestamptz) from public, anon;
grant  execute on function public.get_oncall_audit(int, timestamptz) to authenticated;

-- Who is on call is visible to every signed-in, active user (it is how
-- swaps are arranged). The profiles table is select-limited to the user's
-- own row (Lead Pharmacist+ see all), so this returns ONLY the fields the
-- rota needs: name, initials, active flag, site pools and rota colour.
-- No email, role, leave or any other profile data.
create or replace function public.get_oncall_people()
returns table (
  id                 uuid,
  full_name          text,
  initials           text,
  active             boolean,
  oncall_worthing    boolean,
  oncall_st_richards boolean,
  oncall_color       text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_oncall() then raise exception 'not permitted'; end if;
  if public.current_profile_id() is null then
    raise exception 'not signed in';
  end if;
  return query
    select p.id, p.full_name, p.initials, p.active,
           p.oncall_worthing, p.oncall_st_richards, p.oncall_color
      from public.profiles p
     where p.oncall_worthing or p.oncall_st_richards
        or p.id in (select a.user_id from public.oncall_assignments a);
end;
$$;

-- Which shifts currently have a swap request in progress (pending the
-- other person's answer, or awaiting Lead sign-off). Shown to everyone on
-- the rota so a shift is visibly "spoken for". Only ids and parties.
create or replace function public.get_oncall_pending_swaps()
returns table (
  assignment_id   uuid,
  request_id      uuid,
  status          text,
  requested_by    uuid,
  counterparty_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_oncall() then raise exception 'not permitted'; end if;
  if public.current_profile_id() is null then
    raise exception 'not signed in';
  end if;
  return query
    select i.assignment_id, r.id, r.status, r.requested_by, r.counterparty_id
      from public.oncall_swap_items i
      join public.oncall_swap_requests r on r.id = i.request_id
     where r.status in ('pending','awaiting_approval');
end;
$$;

revoke execute on function public.get_oncall_pending_swaps() from public, anon;
grant  execute on function public.get_oncall_pending_swaps() to authenticated;

revoke execute on function public.get_oncall_people() from public, anon;
grant  execute on function public.get_oncall_people() to authenticated;

-- ---------------------------------------------------------------
-- Grants — same pattern as the rest of the file: deny public/anon,
-- grant authenticated, and the function body itself enforces the
-- real permission check (so a Pharmacist calling set_oncall_assignment
-- directly still gets a clean 'not permitted' exception, not a bypass).
-- ---------------------------------------------------------------
revoke execute on function public.set_user_oncall_eligibility(uuid, boolean, boolean, text) from public, anon;
grant  execute on function public.set_user_oncall_eligibility(uuid, boolean, boolean, text) to authenticated;

revoke execute on function public.set_oncall_swap_mode(text, text) from public, anon;
grant  execute on function public.set_oncall_swap_mode(text, text) to authenticated;

revoke execute on function public.create_oncall_rota_period(text, date, date) from public, anon;
grant  execute on function public.create_oncall_rota_period(text, date, date) to authenticated;

revoke execute on function public.archive_oncall_rota_period(uuid) from public, anon;
grant  execute on function public.archive_oncall_rota_period(uuid) to authenticated;

revoke execute on function public.reopen_oncall_rota_period(uuid) from public, anon;
grant  execute on function public.reopen_oncall_rota_period(uuid) to authenticated;

revoke execute on function public.complete_oncall_rota_period(uuid) from public, anon;
grant  execute on function public.complete_oncall_rota_period(uuid) to authenticated;

revoke execute on function public.set_oncall_user_color(uuid, text) from public, anon;
grant  execute on function public.set_oncall_user_color(uuid, text) to authenticated;

-- Internal helper only (called from inside the write functions).
revoke execute on function public.oncall_date_is_complete(date) from public, anon, authenticated;

revoke execute on function public.set_oncall_bank_holiday(date, text, text) from public, anon;
grant  execute on function public.set_oncall_bank_holiday(date, text, text) to authenticated;

revoke execute on function public.remove_oncall_bank_holiday(date) from public, anon;
grant  execute on function public.remove_oncall_bank_holiday(date) to authenticated;

revoke execute on function public.set_oncall_assignment(text, date, text, uuid, text, text) from public, anon;
grant  execute on function public.set_oncall_assignment(text, date, text, uuid, text, text) to authenticated;

revoke execute on function public.clear_oncall_assignment(text, date, text) from public, anon;
grant  execute on function public.clear_oncall_assignment(text, date, text) to authenticated;

revoke execute on function public.bulk_set_oncall_assignments(text, text, uuid, date[], text, text) from public, anon;
grant  execute on function public.bulk_set_oncall_assignments(text, text, uuid, date[], text, text) to authenticated;

revoke execute on function public.annotate_oncall_assignments(uuid[], text, text) from public, anon;
grant  execute on function public.annotate_oncall_assignments(uuid[], text, text) to authenticated;

revoke execute on function public.request_oncall_swap(uuid, uuid[], uuid[], text) from public, anon;
grant  execute on function public.request_oncall_swap(uuid, uuid[], uuid[], text) to authenticated;

revoke execute on function public.respond_oncall_swap(uuid, boolean, text) from public, anon;
grant  execute on function public.respond_oncall_swap(uuid, boolean, text) to authenticated;

revoke execute on function public.cancel_oncall_swap(uuid, text) from public, anon;
grant  execute on function public.cancel_oncall_swap(uuid, text) to authenticated;

revoke execute on function public.review_oncall_swap(uuid, boolean, text) from public, anon;
grant  execute on function public.review_oncall_swap(uuid, boolean, text) to authenticated;

-- Internal only — never called directly by any client, only nested
-- inside the write functions above.
revoke execute on function public.assert_oncall_date_editable(date) from public, anon, authenticated;
revoke execute on function public.apply_oncall_swap(uuid) from public, anon, authenticated;



-- =====================================================================
-- HUDDLE BOARD  (Worthing / St Richard's)
-- =====================================================================
-- Posts are visible to everyone with app access. Lead Pharmacist and
-- above can post (to one site or both at once — a post carries a list
-- of sites rather than being duplicated per site, so editing, pinning
-- or deleting it applies everywhere it appears), pin posts, and attach
-- PDFs. A post can be edited/deleted by its author or a Clinical Team
-- Lead/Developer. "Delete" is a soft delete so the audit trail still
-- points at something real. Search covers every historic post, matching
-- keywords against the title and the body.

create table if not exists public.huddle_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  body        text not null default '' check (char_length(body) <= 20000),
  sites       text[] not null check (cardinality(sites) >= 1 and sites <@ array['worthing','st_richards']::text[]),
  pinned      boolean not null default false,
  pinned_at   timestamptz,
  deleted     boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists huddle_posts_recent_idx on public.huddle_posts (created_at desc) where deleted = false;
create index if not exists huddle_posts_sites_idx on public.huddle_posts using gin (sites);

create table if not exists public.huddle_attachments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.huddle_posts(id) on delete cascade,
  file_name     text not null check (char_length(file_name) between 1 and 200),
  storage_path  text not null unique,
  size_bytes    bigint not null check (size_bytes between 1 and 10485760),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists huddle_attachments_post_idx on public.huddle_attachments (post_id);

alter table public.huddle_posts       enable row level security;
alter table public.huddle_attachments enable row level security;

drop policy if exists huddle_posts_select on public.huddle_posts;
create policy huddle_posts_select on public.huddle_posts for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null and deleted = false);

drop policy if exists huddle_attachments_select on public.huddle_attachments;
create policy huddle_attachments_select on public.huddle_attachments for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null);

-- PDFs live in a private Storage bucket (10 MB cap, PDF only). Files
-- are uploaded straight from the browser into a folder named after the
-- uploader's own user id — the upload policy enforces that, and the
-- create/update functions below refuse to attach any path outside the
-- caller's own folder or one that doesn't actually exist in Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('huddle-attachments', 'huddle-attachments', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists huddle_attachments_read on storage.objects;
create policy huddle_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'huddle-attachments' and public.current_profile_id() is not null);

drop policy if exists huddle_attachments_upload on storage.objects;
create policy huddle_attachments_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'huddle-attachments'
    and public.can_post_huddle()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists huddle_attachments_remove on storage.objects;
create policy huddle_attachments_remove on storage.objects for delete to authenticated
  using (bucket_id = 'huddle-attachments' and public.can_post_huddle());

-- Internal: validates an attachments array of
-- [{"path": "<uid>/<file>.pdf", "name": "...", "size": 12345}, ...]
create or replace function public.validate_huddle_attachments(p_actor uuid, p_att jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_path text;
  v_name text;
  v_size bigint;
begin
  if p_att is null or p_att = '[]'::jsonb then return; end if;
  if jsonb_typeof(p_att) <> 'array' then raise exception 'attachments must be a list'; end if;
  if jsonb_array_length(p_att) > 10 then raise exception 'a post can have at most 10 attachments'; end if;

  for v_item in select * from jsonb_array_elements(p_att) loop
    v_path := v_item->>'path';
    v_name := v_item->>'name';
    v_size := (v_item->>'size')::bigint;
    if v_path is null or v_name is null or v_size is null then raise exception 'attachment details are incomplete'; end if;
    if left(v_path, length(p_actor::text) + 1) <> p_actor::text || '/' or position('..' in v_path) > 0 then
      raise exception 'attachment path is not in your upload folder';
    end if;
    if lower(v_path) not like '%.pdf' then raise exception 'only PDF attachments are allowed'; end if;
    if char_length(btrim(v_name)) = 0 or char_length(v_name) > 200 then raise exception 'attachment name is invalid'; end if;
    if v_size < 1 or v_size > 10485760 then raise exception 'attachments must be 10 MB or smaller'; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'huddle-attachments' and name = v_path) then
      raise exception 'attachment "%" was not uploaded', v_name;
    end if;
  end loop;
end;
$$;

create or replace function public.create_huddle_post(
  p_title        text,
  p_body         text,
  p_sites        text[],
  p_pinned       boolean default false,
  p_attachments  jsonb   default '[]'::jsonb
)
returns public.huddle_posts
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_sites text[];
  v_row   public.huddle_posts;
  v_item  jsonb;
begin
  if not public.can_post_huddle() then raise exception 'you do not have permission to post to the huddle board'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'a title is required'; end if;
  select coalesce(array_agg(distinct s order by s), '{}') into v_sites from unnest(p_sites) s;
  if cardinality(v_sites) = 0 or not (v_sites <@ array['worthing','st_richards']::text[]) then
    raise exception 'choose Worthing, St Richard''s, or both';
  end if;
  perform public.validate_huddle_attachments(v_actor, p_attachments);

  insert into public.huddle_posts (title, body, sites, pinned, pinned_at, created_by, updated_by)
  values (btrim(p_title), coalesce(p_body, ''), v_sites, (coalesce(p_pinned, false) and public.is_lead_plus()),
          case when (coalesce(p_pinned, false) and public.is_lead_plus()) then now() end, v_actor, v_actor)
  returning * into v_row;

  if p_attachments is not null and p_attachments <> '[]'::jsonb then
    for v_item in select * from jsonb_array_elements(p_attachments) loop
      insert into public.huddle_attachments (post_id, file_name, storage_path, size_bytes, created_by)
      values (v_row.id, v_item->>'name', v_item->>'path', (v_item->>'size')::bigint, v_actor);
    end loop;
  end if;

  insert into public.audit_log (action, actor_id, after_state, note)
  values ('create_huddle_post', v_actor, to_jsonb(v_row), v_row.title);

  return v_row;
end;
$$;

create or replace function public.update_huddle_post(
  p_post_id               uuid,
  p_title                 text,
  p_body                  text,
  p_sites                 text[],
  p_add_attachments       jsonb  default '[]'::jsonb,
  p_remove_attachment_ids uuid[] default '{}'
)
returns public.huddle_posts
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.huddle_posts;
  v_row    public.huddle_posts;
  v_sites  text[];
  v_item   jsonb;
  v_count  int;
begin
  if not public.can_post_huddle() then raise exception 'not permitted to edit huddle posts'; end if;
  select * into v_before from public.huddle_posts where id = p_post_id and deleted = false;
  if v_before is null then raise exception 'post not found'; end if;
  if v_before.created_by is distinct from v_actor then
    raise exception 'only the person who made this post can edit it';
  end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'a title is required'; end if;
  select coalesce(array_agg(distinct s order by s), '{}') into v_sites from unnest(p_sites) s;
  if cardinality(v_sites) = 0 or not (v_sites <@ array['worthing','st_richards']::text[]) then
    raise exception 'choose Worthing, St Richard''s, or both';
  end if;

  delete from public.huddle_attachments
   where post_id = p_post_id and id = any(coalesce(p_remove_attachment_ids, '{}'));

  perform public.validate_huddle_attachments(v_actor, p_add_attachments);
  select count(*) into v_count from public.huddle_attachments where post_id = p_post_id;
  if v_count + coalesce(jsonb_array_length(p_add_attachments), 0) > 10 then
    raise exception 'a post can have at most 10 attachments';
  end if;
  if p_add_attachments is not null and p_add_attachments <> '[]'::jsonb then
    for v_item in select * from jsonb_array_elements(p_add_attachments) loop
      insert into public.huddle_attachments (post_id, file_name, storage_path, size_bytes, created_by)
      values (p_post_id, v_item->>'name', v_item->>'path', (v_item->>'size')::bigint, v_actor);
    end loop;
  end if;

  update public.huddle_posts
     set title = btrim(p_title), body = coalesce(p_body, ''), sites = v_sites,
         updated_by = v_actor, updated_at = now()
   where id = p_post_id
   returning * into v_row;

  insert into public.audit_log (action, actor_id, before_state, after_state, note)
  values ('edit_huddle_post', v_actor, to_jsonb(v_before), to_jsonb(v_row), v_row.title);

  return v_row;
end;
$$;

create or replace function public.set_huddle_post_pinned(p_post_id uuid, p_pinned boolean)
returns public.huddle_posts
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.huddle_posts;
begin
  if not public.is_lead_plus() then raise exception 'not permitted to pin huddle posts'; end if;

  update public.huddle_posts
     set pinned = p_pinned,
         pinned_at = case when p_pinned then now() end,
         updated_by = v_actor, updated_at = now()
   where id = p_post_id and deleted = false
   returning * into v_row;
  if v_row is null then raise exception 'post not found'; end if;

  insert into public.audit_log (action, actor_id, note)
  values (case when p_pinned then 'pin_huddle_post' else 'unpin_huddle_post' end, v_actor, v_row.title);

  return v_row;
end;
$$;

create or replace function public.delete_huddle_post(p_post_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.huddle_posts;
begin
  if not public.can_post_huddle() then raise exception 'not permitted to delete huddle posts'; end if;
  select * into v_before from public.huddle_posts where id = p_post_id and deleted = false;
  if v_before is null then raise exception 'post not found'; end if;
  if v_before.created_by is distinct from v_actor and not public.is_superuser_plus() then
    raise exception 'only the author, a Clinical Team Lead or a Developer can delete this post';
  end if;

  update public.huddle_posts
     set deleted = true, pinned = false, pinned_at = null, updated_by = v_actor, updated_at = now()
   where id = p_post_id;

  insert into public.audit_log (action, actor_id, before_state, note)
  values ('delete_huddle_post', v_actor, to_jsonb(v_before), v_before.title);
end;
$$;

-- Reactions and comments. Anyone signed in can react (heart, thumbs up,
-- laughing, sad, shocked) and comment on any post. A person has at most one
-- of each reaction per post; pressing it again removes it. Tables are
-- select-only to the app — all changes go through the functions below.
create table if not exists public.huddle_reactions (
  post_id    uuid not null references public.huddle_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('heart','thumbs_up','laugh','sad','shocked')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create table if not exists public.huddle_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.huddle_posts(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  deleted    boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists huddle_comments_post_idx on public.huddle_comments (post_id, created_at);
-- Reactions on individual comments (same five emojis).
create table if not exists public.huddle_comment_reactions (
  comment_id uuid not null references public.huddle_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('heart','thumbs_up','laugh','sad','shocked')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);
alter table public.huddle_comment_reactions enable row level security;
drop policy if exists huddle_comment_reactions_select on public.huddle_comment_reactions;
create policy huddle_comment_reactions_select on public.huddle_comment_reactions for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null);
alter table public.huddle_reactions enable row level security;
alter table public.huddle_comments  enable row level security;
drop policy if exists huddle_reactions_select on public.huddle_reactions;
create policy huddle_reactions_select on public.huddle_reactions for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null);
drop policy if exists huddle_comments_select on public.huddle_comments;
create policy huddle_comments_select on public.huddle_comments for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null and deleted = false);

-- Returns true if the reaction is now on, false if it was removed.
create or replace function public.toggle_huddle_reaction(p_post_id uuid, p_emoji text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if public.current_role_name() in ('technician','pharmacy_admin') then raise exception 'your account is read-only'; end if;
  if v_actor is null then raise exception 'not permitted'; end if;
  if p_emoji not in ('heart','thumbs_up','laugh','sad','shocked') then raise exception 'invalid reaction'; end if;
  if not exists (select 1 from public.huddle_posts where id = p_post_id and deleted = false) then
    raise exception 'post not found';
  end if;
  if exists (select 1 from public.huddle_reactions where post_id = p_post_id and user_id = v_actor and emoji = p_emoji) then
    delete from public.huddle_reactions where post_id = p_post_id and user_id = v_actor and emoji = p_emoji;
    return false;
  end if;
  insert into public.huddle_reactions (post_id, user_id, emoji) values (p_post_id, v_actor, p_emoji);
  return true;
end;
$$;

-- Returns true if the reaction is now on, false if it was removed.
create or replace function public.toggle_huddle_comment_reaction(p_comment_id uuid, p_emoji text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if public.current_role_name() in ('technician','pharmacy_admin') then raise exception 'your account is read-only'; end if;
  if v_actor is null then raise exception 'not permitted'; end if;
  if p_emoji not in ('heart','thumbs_up','laugh','sad','shocked') then raise exception 'invalid reaction'; end if;
  if not exists (select 1 from public.huddle_comments c join public.huddle_posts p on p.id = c.post_id
                  where c.id = p_comment_id and c.deleted = false and p.deleted = false) then
    raise exception 'comment not found';
  end if;
  if exists (select 1 from public.huddle_comment_reactions where comment_id = p_comment_id and user_id = v_actor and emoji = p_emoji) then
    delete from public.huddle_comment_reactions where comment_id = p_comment_id and user_id = v_actor and emoji = p_emoji;
    return false;
  end if;
  insert into public.huddle_comment_reactions (comment_id, user_id, emoji) values (p_comment_id, v_actor, p_emoji);
  return true;
end;
$$;

create or replace function public.add_huddle_comment(p_post_id uuid, p_body text)
returns public.huddle_comments
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.huddle_comments;
begin
  if public.current_role_name() in ('technician','pharmacy_admin') then raise exception 'your account is read-only'; end if;
  if v_actor is null then raise exception 'not permitted'; end if;
  if p_body is null or btrim(p_body) = '' then raise exception 'write a comment first'; end if;
  if char_length(btrim(p_body)) > 2000 then raise exception 'comments can be at most 2,000 characters'; end if;
  if not exists (select 1 from public.huddle_posts where id = p_post_id and deleted = false) then
    raise exception 'post not found';
  end if;
  insert into public.huddle_comments (post_id, body, created_by) values (p_post_id, btrim(p_body), v_actor)
  returning * into v_row;
  return v_row;
end;
$$;

-- A comment can be removed by whoever wrote it, or by a Clinical Team Lead /
-- Developer (moderation — that case is recorded in the audit trail).
create or replace function public.delete_huddle_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.huddle_comments;
begin
  if v_actor is null then raise exception 'not permitted'; end if;
  select * into v_before from public.huddle_comments where id = p_comment_id and deleted = false;
  if v_before.id is null then raise exception 'comment not found'; end if;
  if v_before.created_by is distinct from v_actor and not public.is_superuser_plus() then
    raise exception 'you can only delete your own comments';
  end if;
  update public.huddle_comments set deleted = true where id = p_comment_id;
  if v_before.created_by is distinct from v_actor then
    insert into public.audit_log (action, actor_id, target_user_id, before_state, note)
    values ('delete_huddle_comment', v_actor, v_before.created_by, to_jsonb(v_before), 'comment removed from a huddle post');
  end if;
end;
$$;

-- Browse + search. Every whitespace-separated keyword has to appear in
-- the title or the body (case-insensitive, partial words match). With
-- no keywords, pinned posts come first, then newest; with keywords it
-- is plain newest-first across all historic posts. Row-level security
-- still applies (this runs as the caller), so deleted posts never show.
create or replace function public.search_huddle_posts(
  p_query  text    default null,
  p_site   text    default null,
  p_limit  int     default 20,
  p_offset int     default 0
)
returns setof public.huddle_posts
language plpgsql stable set search_path = '' as $$
declare
  v_terms text[];
  v_has_q boolean;
begin
  if p_site is not null and p_site not in ('worthing','st_richards') then raise exception 'invalid site'; end if;

  select coalesce(array_agg(replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_')), '{}')
    into v_terms
    from (select t from regexp_split_to_table(coalesce(btrim(p_query), ''), '\s+') t
           where t <> '' limit 8) q;
  v_has_q := cardinality(v_terms) > 0;

  return query
    select p.* from public.huddle_posts p
     where p.deleted = false
       and (p_site is null or p.sites @> array[p_site])
       and not exists (
         select 1 from unnest(v_terms) k
          where not (p.title ilike '%' || k || '%' escape '\'
                  or p.body  ilike '%' || k || '%' escape '\')
       )
     order by (p.pinned and not v_has_q) desc, p.created_at desc, p.id
     limit greatest(1, least(coalesce(p_limit, 20), 100))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- =====================================================================
-- HOME-SCREEN BANNERS  (Clinical Team Lead and Developer post them; everyone
-- signed in, at both sites, sees the live ones on the portal home page)
-- =====================================================================
create table if not exists public.home_banners (
  id         uuid primary key default gen_random_uuid(),
  message    text not null check (char_length(btrim(message)) between 1 and 500),
  severity   text not null default 'info' check (severity in ('info','success','warning','urgent')),
  active     boolean not null default true,      -- false = hidden without deleting
  starts_on  date,                               -- optional: first day shown
  ends_on    date,                               -- optional: last day shown
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint home_banners_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
alter table public.home_banners enable row level security;
-- Everyone sees live banners; Clinical Team Lead / Developer also see hidden/scheduled/expired ones so they can manage them.
drop policy if exists home_banners_select on public.home_banners;
create policy home_banners_select on public.home_banners for select
  using (
    auth.role() = 'authenticated' and public.current_profile_id() is not null
    and (
      public.is_superuser_plus() or public.is_pharmacy_admin()
      or (active
          and (starts_on is null or starts_on <= (now() at time zone 'Europe/London')::date)
          and (ends_on   is null or ends_on   >= (now() at time zone 'Europe/London')::date))
    )
  );

-- Create (p_id null) or edit a banner.
create or replace function public.save_home_banner(
  p_id        uuid,
  p_message   text,
  p_severity  text,
  p_starts_on date,
  p_ends_on   date,
  p_active    boolean
)
returns public.home_banners
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.home_banners;
  v_row    public.home_banners;
begin
  if not public.is_superuser_plus() then raise exception 'only a Clinical Team Lead or Developer can manage banners'; end if;
  if p_message is null or btrim(p_message) = '' then raise exception 'write the banner text first'; end if;
  if char_length(btrim(p_message)) > 500 then raise exception 'a banner can be at most 500 characters'; end if;
  if p_severity not in ('info','success','warning','urgent') then raise exception 'invalid banner style'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'the end date must be on or after the start date';
  end if;

  if p_id is null then
    insert into public.home_banners (message, severity, active, starts_on, ends_on, created_by, updated_by)
    values (btrim(p_message), p_severity, coalesce(p_active, true), p_starts_on, p_ends_on, v_actor, v_actor)
    returning * into v_row;
    insert into public.audit_log (action, actor_id, after_state, note)
    values ('create_home_banner', v_actor, to_jsonb(v_row), left(v_row.message, 80));
  else
    select * into v_before from public.home_banners where id = p_id;
    if v_before.id is null then raise exception 'banner not found'; end if;
    update public.home_banners
       set message = btrim(p_message), severity = p_severity, active = coalesce(p_active, true),
           starts_on = p_starts_on, ends_on = p_ends_on, updated_by = v_actor, updated_at = now()
     where id = p_id returning * into v_row;
    insert into public.audit_log (action, actor_id, before_state, after_state, note)
    values ('edit_home_banner', v_actor, to_jsonb(v_before), to_jsonb(v_row), left(v_row.message, 80));
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_home_banner(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public.current_profile_id();
  v_before public.home_banners;
begin
  if not public.is_superuser_plus() then raise exception 'only a Clinical Team Lead or Developer can manage banners'; end if;
  select * into v_before from public.home_banners where id = p_id;
  if v_before.id is null then raise exception 'banner not found'; end if;
  delete from public.home_banners where id = p_id;
  insert into public.audit_log (action, actor_id, before_state, note)
  values ('delete_home_banner', v_actor, to_jsonb(v_before), left(v_before.message, 80));
end;
$$;

-- =====================================================================
-- QUICK LINKS  (tiles with a custom logo; Developer-managed)
-- =====================================================================
-- Logos are stored inline as small data: images (the browser resizes
-- them before upload) rather than in Storage, so they render under the
-- app's strict img-src policy without opening it up.
create table if not exists public.quick_links (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  url         text not null check (url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 2000),
  logo_data   text check (logo_data is null or (logo_data ~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' and char_length(logo_data) <= 200000)),
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Optional text shown when a tile is first clicked (the second click opens the link).
alter table public.quick_links add column if not exists note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quick_links_note_check') then
    alter table public.quick_links add constraint quick_links_note_check
      check (note is null or char_length(note) between 1 and 1000);
  end if;
end $$;
alter table public.quick_links enable row level security;

drop policy if exists quick_links_select on public.quick_links;
create policy quick_links_select on public.quick_links for select
  using (auth.role() = 'authenticated' and public.current_profile_id() is not null);

-- Signatures gained p_note; drop the old ones so there is only one callable version.
drop function if exists public.create_quick_link(text, text, text);
drop function if exists public.update_quick_link(uuid, text, text, text, boolean);

create or replace function public.create_quick_link(p_title text, p_url text, p_logo_data text default null, p_note text default null)
returns public.quick_links
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.quick_links;
begin
  if not public.is_lead_plus() then raise exception 'only Lead Pharmacists and above can manage quick links'; end if;

  insert into public.quick_links (title, url, logo_data, note, sort_order, created_by)
  values (btrim(p_title), btrim(p_url), p_logo_data, nullif(btrim(coalesce(p_note, '')), ''),
          coalesce((select max(sort_order) from public.quick_links), 0) + 1, v_actor)
  returning * into v_row;

  insert into public.audit_log (action, actor_id, note)
  values ('create_quick_link', v_actor, v_row.title || ' -> ' || v_row.url);

  return v_row;
end;
$$;

-- p_logo_data: null keeps the current logo; p_clear_logo = true removes it.
-- p_note: always replaces the tile text; empty / blank removes it.
create or replace function public.update_quick_link(
  p_id uuid, p_title text, p_url text, p_logo_data text default null, p_clear_logo boolean default false,
  p_note text default null
)
returns public.quick_links
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.quick_links;
begin
  if not public.is_lead_plus() then raise exception 'only Lead Pharmacists and above can manage quick links'; end if;

  update public.quick_links
     set title = btrim(p_title), url = btrim(p_url),
         logo_data = case when coalesce(p_clear_logo, false) then null
                          when p_logo_data is not null then p_logo_data
                          else logo_data end,
         note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = p_id
   returning * into v_row;
  if v_row.id is null then raise exception 'link not found'; end if;

  insert into public.audit_log (action, actor_id, note)
  values ('update_quick_link', v_actor, v_row.title || ' -> ' || v_row.url);

  return v_row;
end;
$$;

create or replace function public.delete_quick_link(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_row   public.quick_links;
begin
  if not public.is_lead_plus() then raise exception 'only Lead Pharmacists and above can manage quick links'; end if;

  delete from public.quick_links where id = p_id returning * into v_row;
  if v_row is null then raise exception 'link not found'; end if;

  insert into public.audit_log (action, actor_id, note)
  values ('delete_quick_link', v_actor, v_row.title || ' -> ' || v_row.url);
end;
$$;

-- Swaps a tile with its neighbour. Renumbers everything 1..n first so
-- ties and gaps in sort_order can never make a move do nothing.
create or replace function public.move_quick_link(p_id uuid, p_direction text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pos   int;
  v_other uuid;
begin
  if not public.is_lead_plus() then raise exception 'only Lead Pharmacists and above can manage quick links'; end if;
  if p_direction not in ('up','down') then raise exception 'invalid direction'; end if;

  update public.quick_links q set sort_order = r.rn
    from (select id, row_number() over (order by sort_order, created_at, id) as rn from public.quick_links) r
   where q.id = r.id;

  select sort_order into v_pos from public.quick_links where id = p_id;
  if v_pos is null then raise exception 'link not found'; end if;

  select id into v_other from public.quick_links
   where sort_order = case when p_direction = 'up' then v_pos - 1 else v_pos + 1 end;
  if v_other is null then return; end if;

  update public.quick_links set sort_order = case when id = p_id then sort_order + (case when p_direction = 'up' then -1 else 1 end)
                                                  else sort_order + (case when p_direction = 'up' then 1 else -1 end) end
   where id in (p_id, v_other);
end;
$$;

-- =====================================================================
-- INVITATIONS (bulk, self-service account creation)
-- An admin invites many people at once by email. Each person gets a
-- one-time link (join.html#t=<token>) where they enter their name,
-- choose their base site / cross-site and set their own password; the
-- accept-invitation edge function then creates the login. Only a hash
-- of the token is stored. The email address is kept only while the
-- invitation is open (so it can be re-sent) and cleared once accepted
-- or revoked; the masked form stays for the record.
-- Rows are written by the edge functions (service role); the client can
-- only read the non-secret columns and revoke via revoke_invitation().
-- =====================================================================
create table if not exists public.invitations (
  id               uuid primary key default gen_random_uuid(),
  email            text,
  email_masked     text not null,
  email_hash       text,
  role             text not null check (role in ('pharmacist','lead_pharmacist','superuser','developer','technician','senior_technician','pharmacy_admin')),
  token_hash       text not null unique,
  status           text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  last_sent_at     timestamptz,
  send_count       int not null default 0,
  email_error      text,
  accepted_at      timestamptz,
  accepted_user_id uuid references public.profiles(id) on delete set null
);
alter table public.invitations add column if not exists email_hash text;
create index if not exists idx_invitations_status on public.invitations(status, created_at desc);
alter table public.invitations enable row level security;

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select
  using (public.is_superuser_plus() or public.is_pharmacy_admin());

-- Column-level read access: the token hash is never exposed to the browser.
revoke all on public.invitations from public, anon, authenticated;
grant select (id, email, email_masked, role, status, created_by, created_at, expires_at,
              last_sent_at, send_count, email_error, accepted_at, accepted_user_id)
  on public.invitations to authenticated;

create or replace function public.revoke_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.current_profile_id();
  v_inv   public.invitations;
begin
  if not public.is_superuser_plus() then raise exception 'not permitted'; end if;

  select * into v_inv from public.invitations where id = p_id;
  if v_inv.id is null then raise exception 'invitation not found'; end if;
  if v_inv.status <> 'pending' then raise exception 'only open invitations can be revoked'; end if;
  if v_inv.role = 'developer' and not public.is_developer() then
    raise exception 'only a Developer can revoke a Developer invitation';
  end if;

  update public.invitations
     set status = 'revoked', email = null
   where id = p_id;

  insert into public.audit_log (action, actor_id, note)
  values ('revoke_invitation', v_actor, 'invitation to ' || v_inv.email_masked || ' revoked');
end;
$$;

-- ---------------------------------------------------------------
-- Grants (same pattern as everywhere else in this file)
-- ---------------------------------------------------------------
revoke execute on function public.save_home_banner(uuid, text, text, date, date, boolean) from public, anon;
grant  execute on function public.save_home_banner(uuid, text, text, date, date, boolean) to authenticated;
revoke execute on function public.delete_home_banner(uuid) from public, anon;
grant  execute on function public.delete_home_banner(uuid) to authenticated;

revoke execute on function public.toggle_huddle_reaction(uuid, text) from public, anon;
grant  execute on function public.toggle_huddle_reaction(uuid, text) to authenticated;
revoke execute on function public.toggle_huddle_comment_reaction(uuid, text) from public, anon;
grant  execute on function public.toggle_huddle_comment_reaction(uuid, text) to authenticated;
revoke execute on function public.add_huddle_comment(uuid, text) from public, anon;
grant  execute on function public.add_huddle_comment(uuid, text) to authenticated;
revoke execute on function public.delete_huddle_comment(uuid) from public, anon;
grant  execute on function public.delete_huddle_comment(uuid) to authenticated;

revoke execute on function public.create_huddle_post(text, text, text[], boolean, jsonb) from public, anon;
grant  execute on function public.create_huddle_post(text, text, text[], boolean, jsonb) to authenticated;

revoke execute on function public.update_huddle_post(uuid, text, text, text[], jsonb, uuid[]) from public, anon;
grant  execute on function public.update_huddle_post(uuid, text, text, text[], jsonb, uuid[]) to authenticated;

revoke execute on function public.set_huddle_post_pinned(uuid, boolean) from public, anon;
grant  execute on function public.set_huddle_post_pinned(uuid, boolean) to authenticated;

revoke execute on function public.delete_huddle_post(uuid) from public, anon;
grant  execute on function public.delete_huddle_post(uuid) to authenticated;

revoke execute on function public.search_huddle_posts(text, text, int, int) from public, anon;
grant  execute on function public.search_huddle_posts(text, text, int, int) to authenticated;

revoke execute on function public.create_quick_link(text, text, text, text) from public, anon;
grant  execute on function public.create_quick_link(text, text, text, text) to authenticated;

revoke execute on function public.update_quick_link(uuid, text, text, text, boolean, text) from public, anon;
grant  execute on function public.update_quick_link(uuid, text, text, text, boolean, text) to authenticated;

revoke execute on function public.delete_quick_link(uuid) from public, anon;
grant  execute on function public.delete_quick_link(uuid) to authenticated;

revoke execute on function public.move_quick_link(uuid, text) from public, anon;
grant  execute on function public.move_quick_link(uuid, text) to authenticated;

revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant  execute on function public.revoke_invitation(uuid) to authenticated;

-- Internal only — nested inside create_/update_huddle_post.
revoke execute on function public.validate_huddle_attachments(uuid, jsonb) from public, anon, authenticated;

-- Deny-by-default for anything created after this point, by whichever
-- role runs this script (normally the SQL Editor's connection role) —
-- a new function no longer becomes callable by everyone the moment
-- it's created; it has to be deliberately granted, the same way every
-- function above now is.
alter default privileges in schema public revoke execute on functions from public;

-- Old helper from the first version of the limited roles; nothing refers to it now
-- that the policies above have been recreated.
drop function if exists public.can_view_rota();

-- ===========================================================================
-- MY TASKS (private personal task lists: long-term with deadlines + daily list)
-- Strictly private: a user can only ever read or change their OWN rows. Not even
-- Developers or Pharmacy Admins can see anyone else's. Available to every role.
-- ===========================================================================
create table if not exists public.personal_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('long','daily')),
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  note        text check (note is null or char_length(note) <= 500),
  start_date  date,
  due_date    date,
  task_date   date,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint personal_tasks_shape check (
    (kind = 'long'  and due_date is not null and start_date is not null) or
    (kind = 'daily' and task_date is not null))
);
create index if not exists personal_tasks_user_idx on public.personal_tasks (user_id, kind);
alter table public.personal_tasks enable row level security;
drop policy if exists personal_tasks_select_own on public.personal_tasks;
create policy personal_tasks_select_own on public.personal_tasks
  for select to authenticated using (user_id = auth.uid());

create or replace function public.add_personal_task(p_kind text, p_title text, p_note text default null, p_due date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Europe/London')::date; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('long','daily') then raise exception 'invalid task type'; end if;
  if p_title is null or char_length(btrim(p_title)) = 0 then raise exception 'please enter a task'; end if;
  if (select count(*) from public.personal_tasks where user_id = auth.uid() and not done) >= 300 then
    raise exception 'you have too many open tasks - complete or delete some first';
  end if;
  -- housekeeping: forget ticked daily tasks older than two weeks
  delete from public.personal_tasks where user_id = auth.uid() and kind = 'daily' and done and task_date < v_today - 14;
  if p_kind = 'long' then
    if p_due is null then raise exception 'please choose a deadline'; end if;
    if p_due < v_today then raise exception 'the deadline cannot be in the past'; end if;
    insert into public.personal_tasks (user_id, kind, title, note, start_date, due_date)
      values (auth.uid(), 'long', btrim(p_title), nullif(btrim(coalesce(p_note,'')), ''), v_today, p_due) returning id into v_id;
  else
    insert into public.personal_tasks (user_id, kind, title, task_date)
      values (auth.uid(), 'daily', btrim(p_title), v_today) returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.update_personal_task(p_id uuid, p_title text, p_note text default null, p_due date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.personal_tasks;
begin
  select * into r from public.personal_tasks where id = p_id and user_id = auth.uid();
  if not found then raise exception 'task not found'; end if;
  if p_title is null or char_length(btrim(p_title)) = 0 then raise exception 'please enter a task'; end if;
  if r.kind = 'long' then
    if p_due is null then raise exception 'please choose a deadline'; end if;
    update public.personal_tasks set title = btrim(p_title), note = nullif(btrim(coalesce(p_note,'')), ''), due_date = p_due,
      start_date = least(start_date, p_due) where id = p_id;
  else
    update public.personal_tasks set title = btrim(p_title) where id = p_id;
  end if;
end;
$$;

create or replace function public.toggle_personal_task(p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.personal_tasks set done = coalesce(p_done, false), done_at = case when coalesce(p_done,false) then now() else null end
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'task not found'; end if;
end;
$$;

create or replace function public.delete_personal_task(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.personal_tasks where id = p_id and user_id = auth.uid();
end;
$$;

-- Unfinished daily tasks from earlier days: carry them over to today, or throw them away.
create or replace function public.carry_over_personal_tasks(p_discard boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Europe/London')::date; n integer;
begin
  if coalesce(p_discard, false) then
    delete from public.personal_tasks where user_id = auth.uid() and kind = 'daily' and not done and task_date < v_today;
  else
    update public.personal_tasks set task_date = v_today where user_id = auth.uid() and kind = 'daily' and not done and task_date < v_today;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.add_personal_task(text, text, text, date) from public, anon;
revoke execute on function public.update_personal_task(uuid, text, text, date) from public, anon;
revoke execute on function public.toggle_personal_task(uuid, boolean) from public, anon;
revoke execute on function public.delete_personal_task(uuid) from public, anon;
revoke execute on function public.carry_over_personal_tasks(boolean) from public, anon;
grant execute on function public.add_personal_task(text, text, text, date) to authenticated;
grant execute on function public.update_personal_task(uuid, text, text, date) to authenticated;
grant execute on function public.toggle_personal_task(uuid, boolean) to authenticated;
grant execute on function public.delete_personal_task(uuid) to authenticated;
grant execute on function public.carry_over_personal_tasks(boolean) to authenticated;

-- ===========================================================================
-- SET TASKS (a task set for someone by a more senior grade) + NOTIFICATIONS
-- ===========================================================================
-- Who may set a task for whom (users of the same grade can't set tasks for each other; a task can be set for several people at once):
--   Clinical Team Lead (superuser) -> Pharmacist, Lead Pharmacist
--   Lead Pharmacist                -> Pharmacist
--   Developer                      -> Pharmacist, Lead Pharmacist, Clinical Team Lead
create or replace function public.can_set_task_for(p_target uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_actor text := public.current_role_name(); v_target text;
begin
  if auth.uid() is null or p_target is null or p_target = auth.uid() then return false; end if;
  select role into v_target from public.profiles
   where id = p_target and active and not coalesce(deleted_by_developer, false) and not coalesce(hidden_by_superuser, false);
  if v_target is null then return false; end if;
  if v_actor = 'developer'       then return v_target in ('pharmacist','lead_pharmacist','superuser'); end if;
  if v_actor = 'superuser'       then return v_target in ('pharmacist','lead_pharmacist'); end if;
  if v_actor = 'lead_pharmacist' then return v_target = 'pharmacist'; end if;
  return false;
end;
$$;

create table if not exists public.assigned_tasks (
  id          uuid primary key default gen_random_uuid(),
  assigned_by uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  note        text check (note is null or char_length(note) <= 500),
  start_date  date not null default ((now() at time zone 'Europe/London')::date),
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists assigned_tasks_to_idx on public.assigned_tasks (assigned_to);
create index if not exists assigned_tasks_by_idx on public.assigned_tasks (assigned_by);
alter table public.assigned_tasks enable row level security;

-- Who can SEE a set task. Everyone sees tasks set for / by themselves. On top of that:
--   Lead Pharmacist   -> tasks set for any Pharmacist (never for another Lead Pharmacist or a Clinical Team Lead)
--   Clinical Team Lead-> tasks set for any Pharmacist or Lead Pharmacist (never for another Clinical Team Lead)
--   Developer         -> everything (oversight)
-- A Pharmacist therefore only ever sees their own tasks.
create or replace function public.can_view_assigned_task(p_by uuid, p_to uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_actor text := public.current_role_name(); v_target text;
begin
  if auth.uid() is null then return false; end if;
  if auth.uid() = p_by or auth.uid() = p_to then return true; end if;
  select role into v_target from public.profiles where id = p_to;
  if v_actor = 'developer'       then return true; end if;
  if v_actor = 'superuser'       then return v_target in ('pharmacist','lead_pharmacist'); end if;
  if v_actor = 'lead_pharmacist' then return v_target = 'pharmacist'; end if;
  return false;
end;
$$;
drop policy if exists assigned_tasks_select_own on public.assigned_tasks;
drop policy if exists assigned_tasks_select on public.assigned_tasks;
create policy assigned_tasks_select on public.assigned_tasks
  for select to authenticated using (public.can_view_assigned_task(assigned_by, assigned_to));

-- People the signed-in user is allowed to set a task for (drives the picker).
create or replace function public.get_assignable_users()
returns table (id uuid, full_name text, initials text, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.initials, p.role from public.profiles p
   where public.can_set_task_for(p.id) order by p.full_name;
$$;

-- Every set task the signed-in user is allowed to see (see can_view_assigned_task), names attached.
create or replace function public.get_assigned_tasks()
returns table (id uuid, assigned_by uuid, assigned_to uuid, by_name text, to_name text, to_role text, title text, note text,
               start_date date, due_date date, done boolean, done_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.assigned_by, t.assigned_to,
         b.full_name || ' (' || b.initials || ')', a.full_name || ' (' || a.initials || ')', a.role,
         t.title, t.note, t.start_date, t.due_date, t.done, t.done_at, t.created_at
    from public.assigned_tasks t
    join public.profiles b on b.id = t.assigned_by
    join public.profiles a on a.id = t.assigned_to
   where public.can_view_assigned_task(t.assigned_by, t.assigned_to)
   order by t.created_at desc;
$$;
drop function if exists public.get_my_assigned_tasks();

-- Set one task for one OR MORE people at once (everyone chosen is checked against can_set_task_for).
drop function if exists public.assign_task(uuid, text, text, date);
create or replace function public.assign_task(p_to uuid[], p_title text, p_note text default null, p_due date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Europe/London')::date; v_to uuid; n integer := 0;
begin
  if p_to is null or coalesce(array_length(p_to, 1), 0) = 0 then raise exception 'choose at least one person'; end if;
  if array_length(p_to, 1) > 100 then raise exception 'too many people selected'; end if;
  if p_title is null or char_length(btrim(p_title)) = 0 then raise exception 'please enter a task'; end if;
  if p_due is not null and p_due < v_today then raise exception 'the deadline cannot be in the past'; end if;
  for v_to in select distinct x from unnest(p_to) x loop
    if not public.can_set_task_for(v_to) then raise exception 'you cannot set a task for one of the people selected'; end if;
  end loop;
  for v_to in select distinct x from unnest(p_to) x loop
    insert into public.assigned_tasks (assigned_by, assigned_to, title, note, due_date)
      values (auth.uid(), v_to, btrim(p_title), nullif(btrim(coalesce(p_note,'')), ''), p_due);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.toggle_assigned_task(p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.assigned_tasks set done = coalesce(p_done,false), done_at = case when coalesce(p_done,false) then now() else null end
   where id = p_id and assigned_to = auth.uid();
  if not found then raise exception 'task not found'; end if;
end;
$$;

create or replace function public.delete_assigned_task(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.assigned_tasks where id = p_id and assigned_by = auth.uid();
  if not found then raise exception 'task not found'; end if;
end;
$$;

-- ---- notifications ---------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- Internal only (called by the triggers below); never exposed to the browser.
create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  delete from public.notifications where user_id = p_user and read_at is not null and created_at < now() - interval '30 days';
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
end;
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
end;
$$;
create or replace function public.clear_notifications()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where user_id = auth.uid();
end;
$$;

-- Leave approved -> tell the person whose leave it is (several days approved together are merged into one notice).
create or replace function public.trg_notify_leave_approved()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_by text; v_day text; v_id uuid;
begin
  if new.approved_by is not distinct from new.user_id then return new; end if;
  select full_name into v_by from public.profiles where id = new.approved_by;
  v_day := to_char(new.leave_date, 'Dy DD Mon YYYY');
  select id into v_id from public.notifications
   where user_id = new.user_id and kind = 'leave_approved' and read_at is null and created_at > now() - interval '10 minutes'
   order by created_at desc limit 1;
  if v_id is not null then
    update public.notifications set title = 'Leave approved', body = left(body || ', ' || v_day, 400), created_at = now() where id = v_id;
  else
    perform public.notify_user(new.user_id, 'leave_approved', 'Leave approved',
      'Approved by ' || coalesce(v_by, 'your approver') || ': ' || v_day, 'my-leave.html');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_leave_approved on public.leave_requests;
create trigger notify_leave_approved after update of status on public.leave_requests
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.trg_notify_leave_approved();

-- A task has been set for me.
create or replace function public.trg_notify_task_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_by text;
begin
  select full_name into v_by from public.profiles where id = new.assigned_by;
  perform public.notify_user(new.assigned_to, 'task_assigned', 'New task set for you',
    coalesce(v_by, 'Someone') || ' set you: ' || new.title || case when new.due_date is not null then ' (due ' || to_char(new.due_date, 'DD Mon YYYY') || ')' else '' end,
    'tasks.html#set');
  return new;
end;
$$;
drop trigger if exists notify_task_assigned on public.assigned_tasks;
create trigger notify_task_assigned after insert on public.assigned_tasks
  for each row execute function public.trg_notify_task_assigned();

-- On-call swap: requested (tell the colleague asked) and approved/completed (tell both people).
create or replace function public.trg_notify_swap_requested()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_by text;
begin
  select full_name into v_by from public.profiles where id = new.requested_by;
  perform public.notify_user(new.counterparty_id, 'swap_requested', 'On-call swap requested',
    coalesce(v_by, 'A colleague') || ' has asked to swap on-call shifts with you.', 'oncall.html');
  return new;
end;
$$;
drop trigger if exists notify_swap_requested on public.oncall_swap_requests;
create trigger notify_swap_requested after insert on public.oncall_swap_requests
  for each row execute function public.trg_notify_swap_requested();

create or replace function public.trg_notify_swap_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_a text; v_b text;
begin
  select full_name into v_a from public.profiles where id = new.requested_by;
  select full_name into v_b from public.profiles where id = new.counterparty_id;
  perform public.notify_user(new.requested_by, 'swap_approved', 'On-call swap approved',
    'Your swap with ' || coalesce(v_b, 'your colleague') || ' has been approved and applied to the rota.', 'oncall.html');
  perform public.notify_user(new.counterparty_id, 'swap_approved', 'On-call swap approved',
    'Your swap with ' || coalesce(v_a, 'your colleague') || ' has been approved and applied to the rota.', 'oncall.html');
  return new;
end;
$$;
drop trigger if exists notify_swap_completed on public.oncall_swap_requests;
create trigger notify_swap_completed after update of status on public.oncall_swap_requests
  for each row when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.trg_notify_swap_completed();

revoke execute on function public.can_set_task_for(uuid) from public, anon;
revoke execute on function public.get_assignable_users() from public, anon;
revoke execute on function public.get_assigned_tasks() from public, anon;
revoke execute on function public.can_view_assigned_task(uuid, uuid) from public, anon;
revoke execute on function public.assign_task(uuid[], text, text, date) from public, anon;
revoke execute on function public.toggle_assigned_task(uuid, boolean) from public, anon;
revoke execute on function public.delete_assigned_task(uuid) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function public.clear_notifications() from public, anon;
grant execute on function public.can_set_task_for(uuid) to authenticated;
grant execute on function public.get_assignable_users() to authenticated;
grant execute on function public.get_assigned_tasks() to authenticated;
grant execute on function public.can_view_assigned_task(uuid, uuid) to authenticated;
grant execute on function public.assign_task(uuid[], text, text, date) to authenticated;
grant execute on function public.toggle_assigned_task(uuid, boolean) to authenticated;
grant execute on function public.delete_assigned_task(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.clear_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- Trust logo for the login page. A single public SVG (trust-logo.svg) in the
-- "branding" bucket: anyone can read it (the login page is pre-sign-in), only a
-- Developer can add, replace or remove it. The bucket itself refuses anything but
-- an SVG under 512 KB. The page shows it through an <img>, so scripts inside an
-- SVG never run.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 524288, array['image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- is_developer() itself is not executable by signed-in users (by design), and
-- Storage policies run as the signed-in user, so they call this thin wrapper instead.
create or replace function public.can_manage_branding()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_developer();
$$;
revoke execute on function public.can_manage_branding() from public, anon;
grant execute on function public.can_manage_branding() to authenticated;

-- Replacing a file (upload with upsert) and removing one both need to be able to SEE the
-- existing row, so signed-in users get read access to this one bucket. (The logo is public
-- anyway; the bucket is public so the sign-in page can show it without an account.)
drop policy if exists branding_logo_read on storage.objects;
create policy branding_logo_read on storage.objects for select to authenticated
  using (bucket_id = 'branding');

drop policy if exists branding_logo_insert on storage.objects;
create policy branding_logo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and name = 'trust-logo.svg' and public.can_manage_branding());

drop policy if exists branding_logo_update on storage.objects;
create policy branding_logo_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and name = 'trust-logo.svg' and public.can_manage_branding())
  with check (bucket_id = 'branding' and name = 'trust-logo.svg' and public.can_manage_branding());

drop policy if exists branding_logo_delete on storage.objects;
create policy branding_logo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and name = 'trust-logo.svg' and public.can_manage_branding());

-- ---------------------------------------------------------------------------
-- Data API table grants. From 30 Oct 2026 Supabase no longer grants access to
-- newly created "public" tables automatically, so a fresh project / db reset
-- needs these. Every table has RLS enabled (writes only via RPCs), so SELECT for
-- signed-in users is still limited by the policies. anon gets nothing.
-- Safe to re-run; existing projects already have equivalent grants.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

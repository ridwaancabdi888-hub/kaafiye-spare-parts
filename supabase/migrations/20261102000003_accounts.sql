-- Username login, forced password change, account audit log and login throttling.

-- ───────── Usernames: lowercase, unique across the app (they are the login identifier) ─────────
update public.memberships set username = lower(trim(username)) where username is not null;
update public.memberships set username = null where username is not null and username !~ '^[a-z0-9._-]{3,32}$';
alter table public.memberships
  add constraint memberships_username_format check (username is null or username ~ '^[a-z0-9._-]{3,32}$');
create unique index memberships_username_key on public.memberships (username) where username is not null;

-- Set when an admin issues a temporary password; cleared when the user picks their own.
alter table public.memberships add column must_change_password boolean not null default false;

-- ───────── Account audit log (never stores passwords) ─────────
-- No FKs to auth.users on purpose: the log must survive account removal and stay append-only.
create table public.account_events (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses (id),
  target_user uuid,
  target_name text,
  actor uuid,
  actor_name text,
  event text not null check (event in ('account_created', 'password_reset', 'password_changed', 'disabled',
                                       'enabled', 'username_set')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index account_events_business_idx on public.account_events (business_id, id desc);
create trigger account_events_append_only before update or delete on public.account_events
  for each row execute function public._forbid_mutation();
alter table public.account_events enable row level security;
create policy account_events_read on public.account_events for select to authenticated
  using ((select public.is_super_admin()) or (select public.is_admin_of(business_id)));
revoke insert, update, delete, truncate on public.account_events from anon, authenticated;
revoke all on public.account_events from anon;

-- ───────── Login throttling (server-only; keys are SHA-256 hashes, never raw usernames/IPs) ─────────
create table public.login_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_key_idx on public.login_attempts (key_hash, created_at desc);
alter table public.login_attempts enable row level security; -- no policies: service role only
revoke all on public.login_attempts from anon, authenticated;

-- Seconds until another attempt is allowed (0 = allowed). p_limits[i] failures per window for p_keys[i].
create function public.login_wait_seconds(p_keys text[], p_limits integer[], p_window_minutes integer default 15)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_wait integer := 0;
  v_fail integer;
  v_oldest timestamptz;
begin
  delete from public.login_attempts where created_at < now() - interval '1 day';
  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    select count(*), min(created_at) into v_fail, v_oldest from public.login_attempts
    where key_hash = p_keys[i] and not success and created_at > now() - make_interval(mins => p_window_minutes);
    if v_fail >= p_limits[i] then
      v_wait := greatest(v_wait, ceil(extract(epoch from (v_oldest + make_interval(mins => p_window_minutes) - now())))::integer);
    end if;
  end loop;
  return greatest(v_wait, 0);
end $$;

-- A success clears that account's failure streak (the IP keeps its history).
create function public.login_record(p_user_key text, p_ip_key text, p_success boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_success then
    delete from public.login_attempts where key_hash = p_user_key and not success;
  end if;
  insert into public.login_attempts (key_hash, success) values (p_user_key, p_success), (p_ip_key, p_success);
end $$;

revoke execute on function public.login_wait_seconds(text[], integer[], integer), public.login_record(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.login_wait_seconds(text[], integer[], integer), public.login_record(text, text, boolean)
  to service_role;

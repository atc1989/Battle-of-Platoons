-- ================================================================
-- Week Finalization governance layer
-- ================================================================
-- Adds finalized_weeks table, helper functions, and triggers that
-- block raw_data/raw_data_audit mutations for finalized weeks
-- (except for super admins).
-- ================================================================

-- 1) Table --------------------------------------------------------
create table if not exists public.finalized_weeks (
  id bigserial primary key,
  week_key text not null unique,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','finalized')),
  finalized_at timestamptz null,
  finalized_by uuid null,
  finalize_reason text null,
  reopened_at timestamptz null,
  reopened_by uuid null,
  reopen_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finalized_weeks_range on public.finalized_weeks (start_date, end_date);
create index if not exists idx_finalized_weeks_status on public.finalized_weeks (status);

-- 2) Timestamp maintenance ----------------------------------------
create or replace function public.touch_finalized_weeks_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_finalized_weeks_updated_at on public.finalized_weeks;
create trigger trg_finalized_weeks_updated_at
before update on public.finalized_weeks
for each row execute function public.touch_finalized_weeks_updated_at();

-- 3) Helper functions ---------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create or replace function public.week_key_for_date(d date)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when d is null then null
    else to_char(d, 'IYYY') || '-W' || to_char(d, 'IW')
  end;
$$;

create or replace function public.ensure_week_row(d date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wk text;
  week_start date;
  week_end date;
begin
  if d is null then
    return;
  end if;

  wk := public.week_key_for_date(d);
  week_start := date_trunc('week', d)::date;
  week_end := (date_trunc('week', d)::date + 6);

  insert into public.finalized_weeks (week_key, start_date, end_date)
  values (wk, week_start, week_end)
  on conflict (week_key) do update
    set start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = now();
end;
$$;

create or replace function public.is_week_finalized(d date)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  wk text;
begin
  if d is null then
    return false;
  end if;

  wk := public.week_key_for_date(d);

  return exists (
    select 1
    from public.finalized_weeks fw
    where fw.status = 'finalized'
      and (
        fw.week_key = wk
        or (d between fw.start_date and fw.end_date)
      )
  );
end;
$$;

-- 4) Triggers to block finalized weeks ----------------------------
create or replace function public.block_raw_data_if_finalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date;
begin
  if tg_op = 'DELETE' then
    target_date := old.date_real;
  else
    target_date := new.date_real;
  end if;

  if target_date is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform public.ensure_week_row(target_date);

  if public.is_week_finalized(target_date) and not public.is_super_admin() then
    raise exception 'Week is finalized. Changes are locked.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_raw_data_if_finalized on public.raw_data;
create trigger trg_block_raw_data_if_finalized
before insert or update or delete on public.raw_data
for each row execute function public.block_raw_data_if_finalized();

create or replace function public.block_raw_data_audit_if_finalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date;
  target_id text;
begin
  target_id := coalesce(new.raw_data_id, old.raw_data_id);
  if target_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select rd.date_real
  into target_date
  from public.raw_data rd
  where rd.id = target_id
  limit 1;

  if target_date is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform public.ensure_week_row(target_date);

  if public.is_week_finalized(target_date) and not public.is_super_admin() then
    raise exception 'Week is finalized. Changes are locked.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_raw_data_audit_if_finalized on public.raw_data_audit;
create trigger trg_block_raw_data_audit_if_finalized
before insert or update or delete on public.raw_data_audit
for each row execute function public.block_raw_data_audit_if_finalized();

-- 5) RLS for finalized_weeks --------------------------------------
alter table public.finalized_weeks enable row level security;

drop policy if exists finalized_weeks_select_authenticated on public.finalized_weeks;
create policy finalized_weeks_select_authenticated
  on public.finalized_weeks
  for select
  to authenticated
  using (true);

drop policy if exists finalized_weeks_insert_super_admin on public.finalized_weeks;
create policy finalized_weeks_insert_super_admin
  on public.finalized_weeks
  for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists finalized_weeks_update_super_admin on public.finalized_weeks;
create policy finalized_weeks_update_super_admin
  on public.finalized_weeks
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists finalized_weeks_delete_super_admin on public.finalized_weeks;
create policy finalized_weeks_delete_super_admin
  on public.finalized_weeks
  for delete
  to authenticated
  using (public.is_super_admin());

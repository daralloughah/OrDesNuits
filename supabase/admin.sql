-- OrDesNuits · gérant automatique (relançable)
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;
insert into public.admin_emails (email) values ('daralloughah2@gmail.com') on conflict do nothing;

create or replace function public.auto_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails where email = lower(new.email)) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_admin on auth.users;
create trigger on_auth_user_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.auto_admin();

insert into public.admins (user_id)
select u.id from auth.users u join public.admin_emails a on a.email = lower(u.email)
where u.email_confirmed_at is not null
on conflict do nothing;

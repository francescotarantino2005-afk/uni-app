-- Account senza tetto giornaliero della chat (il fondatore, i collaudi).
-- Il flag si cambia SOLO dal database (SQL editor / service role), mai
-- dall'app: la policy "own data" su profiles lascia allo studente l'UPDATE di
-- tutte le colonne, quindi un trigger rimette il valore di prima quando a
-- scrivere e' il ruolo dello studente (authenticated/anon). Stessa protezione
-- per premium, che aveva lo stesso buco (al 9 ottobre nessun profilo e' premium).

alter table public.profiles add column if not exists senza_limiti boolean not null default false;

create or replace function public.proteggi_flag_profilo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.senza_limiti := false;
      new.premium := false;
    else
      new.senza_limiti := old.senza_limiti;
      new.premium := old.premium;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteggi_flag_profilo on public.profiles;
create trigger proteggi_flag_profilo
  before insert or update on public.profiles
  for each row execute function public.proteggi_flag_profilo();

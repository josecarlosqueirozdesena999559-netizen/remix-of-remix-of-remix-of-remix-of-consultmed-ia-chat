create table if not exists public.whatsapp_sessions (
  phone_number text primary key,
  step text not null default 'welcome',
  user_name text,
  selected_posto_id uuid references public.postos(id) on delete set null,
  selected_posto_nome text,
  selected_posto_localidade text,
  pdf_url text,
  last_interaction_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at_whatsapp_sessions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_sessions_updated_at on public.whatsapp_sessions;

create trigger trg_whatsapp_sessions_updated_at
before update on public.whatsapp_sessions
for each row
execute function public.set_updated_at_whatsapp_sessions();

alter table public.whatsapp_sessions enable row level security;

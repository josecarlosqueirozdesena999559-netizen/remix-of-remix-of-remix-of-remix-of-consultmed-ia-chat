create table if not exists public.whatsapp_posto_subscriptions (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  posto_id uuid not null references public.postos(id) on delete cascade,
  posto_nome text not null,
  posto_localidade text not null,
  active boolean not null default true,
  last_notified_pdf_id text,
  last_notified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (phone_number, posto_id)
);

create or replace function public.set_updated_at_whatsapp_posto_subscriptions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_posto_subscriptions_updated_at on public.whatsapp_posto_subscriptions;

create trigger trg_whatsapp_posto_subscriptions_updated_at
before update on public.whatsapp_posto_subscriptions
for each row
execute function public.set_updated_at_whatsapp_posto_subscriptions();

alter table public.whatsapp_posto_subscriptions enable row level security;

alter table public.whatsapp_sessions
  add column if not exists auto_closed_at timestamptz,
  add column if not exists notification_prompted_at timestamptz;

create index if not exists idx_whatsapp_sessions_step_last_interaction
  on public.whatsapp_sessions (step, last_interaction_at);

create index if not exists idx_whatsapp_posto_subscriptions_active
  on public.whatsapp_posto_subscriptions (active, posto_id);

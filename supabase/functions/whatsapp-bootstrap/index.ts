import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const bootstrapStatements = [
  "create extension if not exists pgcrypto",
  "create extension if not exists pg_net",
  "create extension if not exists pg_cron",
  `
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
    )
  `,
  `
    create or replace function public.set_updated_at_whatsapp_posto_subscriptions()
    returns trigger
    language plpgsql
    as $$
    begin
      new.updated_at = timezone('utc', now());
      return new;
    end;
    $$;
  `,
  "drop trigger if exists trg_whatsapp_posto_subscriptions_updated_at on public.whatsapp_posto_subscriptions",
  `
    create trigger trg_whatsapp_posto_subscriptions_updated_at
    before update on public.whatsapp_posto_subscriptions
    for each row
    execute function public.set_updated_at_whatsapp_posto_subscriptions()
  `,
  "alter table public.whatsapp_posto_subscriptions enable row level security",
  "alter table public.whatsapp_sessions add column if not exists auto_closed_at timestamptz",
  "alter table public.whatsapp_sessions add column if not exists notification_prompted_at timestamptz",
  "create index if not exists idx_whatsapp_sessions_step_last_interaction on public.whatsapp_sessions (step, last_interaction_at)",
  "create index if not exists idx_whatsapp_posto_subscriptions_active on public.whatsapp_posto_subscriptions (active, posto_id)",
  `
    do $$
    begin
      perform cron.unschedule('whatsapp-maintenance-every-5-min');
    exception
      when others then
        null;
    end;
    $$;
  `,
  `
    select cron.schedule(
      'whatsapp-maintenance-every-5-min',
      '*/5 * * * *',
      $job$
        select net.http_post(
          url := 'https://btfecoijribbvynljxxy.supabase.co/functions/v1/whatsapp-maintenance',
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{}'::jsonb
        );
      $job$
    )
  `,
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return jsonResponse({ ok: false, error: "SUPABASE_DB_URL nao encontrado" }, { status: 500 });
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();

    for (const statement of bootstrapStatements) {
      await client.queryArray(statement);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Erro no bootstrap do WhatsApp:", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 },
    );
  } finally {
    await client.end();
  }
});

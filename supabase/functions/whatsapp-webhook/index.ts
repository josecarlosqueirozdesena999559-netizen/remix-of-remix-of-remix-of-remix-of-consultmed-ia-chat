import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runChatFlow } from "../_shared/chatFlow.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendWhatsAppMessage } from "../_shared/whatsapp.ts";

interface StoredSessionRow {
  phone_number: string;
  step: string;
  user_name: string | null;
  selected_posto_id: string | null;
  selected_posto_nome: string | null;
  selected_posto_localidade: string | null;
  pdf_url: string | null;
}

function getVerifyToken() {
  const token = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  if (!token) {
    throw new Error("WHATSAPP_VERIFY_TOKEN precisa estar configurado");
  }
  return token;
}

function extractIncomingText(message: Record<string, unknown>): string | null {
  if (message.type === "text") {
    return typeof (message.text as { body?: string })?.body === "string"
      ? (message.text as { body: string }).body
      : null;
  }

  if (message.type === "interactive") {
    const interactive = message.interactive as
      | { button_reply?: { id?: string }; list_reply?: { id?: string } }
      | undefined;

    return interactive?.button_reply?.id || interactive?.list_reply?.id || null;
  }

  return null;
}

async function getSession(phoneNumber: string): Promise<StoredSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("phone_number, step, user_name, selected_posto_id, selected_posto_nome, selected_posto_localidade, pdf_url")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (error) throw error;
  return (data as StoredSessionRow | null) ?? null;
}

async function saveSession(session: StoredSessionRow) {
  const { error } = await supabaseAdmin.from("whatsapp_sessions").upsert({
    ...session,
    last_interaction_at: new Date().toISOString(),
  });

  if (error) throw error;
}

async function processWebhook(body: Record<string, unknown>) {
  const entryList = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entryList) {
    const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
      ? ((entry as { changes: unknown[] }).changes as Array<Record<string, unknown>>)
      : [];

    for (const change of changes) {
      const value = (change.value as Record<string, unknown> | undefined) ?? {};
      const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];

      for (const message of messages) {
        const phoneNumber = typeof message.from === "string" ? message.from : null;
        const incomingText = extractIncomingText(message);

        if (!phoneNumber) continue;

        if (!incomingText) {
          await sendWhatsAppMessage(phoneNumber, {
            type: "text",
            text: "No momento eu consigo responder apenas mensagens de texto e selecoes da lista.",
          });
          continue;
        }

        const session = await getSession(phoneNumber);
        const flowResult = await runChatFlow(phoneNumber, session, incomingText);

        await saveSession(flowResult.nextSession);

        for (const outgoingMessage of flowResult.messages) {
          await sendWhatsAppMessage(phoneNumber, outgoingMessage);
        }
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === getVerifyToken() && challenge) {
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    await processWebhook(body);

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Erro no webhook do WhatsApp:", error);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
});

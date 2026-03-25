import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getLatestPdfInfo, listActivePostoSubscriptions, markSubscriptionNotified, type ChatSession } from "../_shared/chatData.ts";
import { buildInactivityClosureMessages } from "../_shared/chatFlow.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

interface SessionRow extends ChatSession {
  last_interaction_at?: string | null;
}

const INACTIVITY_MINUTES = 13;

async function listSessionsToAutoClose(): Promise<SessionRow[]> {
  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("phone_number, step, user_name, selected_posto_id, selected_posto_nome, selected_posto_localidade, pdf_url, last_interaction_at")
    .eq("step", "ask_continue")
    .lte("last_interaction_at", cutoff);

  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

async function markSessionAutoClosed(session: SessionRow) {
  const { error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .update({
      step: "ask_notify",
    })
    .eq("phone_number", session.phone_number);

  if (error) throw error;
}

async function processInactiveSessions() {
  const sessions = await listSessionsToAutoClose();

  for (const session of sessions) {
    const messages = buildInactivityClosureMessages(session);

    for (const message of messages) {
      await sendWhatsAppMessage(session.phone_number, message);
    }

    await markSessionAutoClosed(session);
  }

  return sessions.length;
}

async function processSubscriptions() {
  const subscriptions = await listActivePostoSubscriptions();
  let notified = 0;
  const templateName = Deno.env.get("WHATSAPP_NOTIFY_TEMPLATE_NAME") || "consultmed_atualizacao_estoque";
  const templateLanguage = Deno.env.get("WHATSAPP_NOTIFY_TEMPLATE_LANGUAGE") || "pt_BR";

  for (const subscription of subscriptions) {
    const latestPdf = await getLatestPdfInfo(subscription.posto_id);
    if (!latestPdf?.id) continue;
    if (latestPdf.id === subscription.last_notified_pdf_id) continue;

    await sendWhatsAppTemplate(subscription.phone_number, {
      name: templateName,
      languageCode: templateLanguage,
      bodyParameters: [subscription.posto_nome, subscription.posto_localidade],
    });

    await markSubscriptionNotified(subscription.id, latestPdf.id);
    notified += 1;
  }

  return notified;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const autoClosed = await processInactiveSessions();
    const notified = await processSubscriptions();

    return jsonResponse({ ok: true, autoClosed, notified });
  } catch (error) {
    console.error("Erro na manutencao do WhatsApp:", error);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
});

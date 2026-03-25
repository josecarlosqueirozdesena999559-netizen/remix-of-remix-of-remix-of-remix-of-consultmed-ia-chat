export interface WhatsAppTextMessage {
  type: "text";
  text: string;
}

export interface WhatsAppButtonsMessage {
  type: "buttons";
  body: string;
  buttons: Array<{ id: string; title: string }>;
}

export interface WhatsAppListMessage {
  type: "list";
  body: string;
  buttonText: string;
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export type OutgoingWhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppButtonsMessage
  | WhatsAppListMessage;

export interface WhatsAppTemplateMessage {
  name: string;
  languageCode: string;
  bodyParameters?: string[];
}

function graphApiUrl(phoneNumberId: string) {
  const version = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") || "v22.0";
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
}

export async function sendWhatsAppMessage(to: string, message: OutgoingWhatsAppMessage) {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID precisam estar configuradas");
  }

  const baseBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
  };

  const payload =
    message.type === "text"
      ? {
          ...baseBody,
          type: "text",
          text: { body: message.text, preview_url: false },
        }
      : message.type === "buttons"
        ? {
            ...baseBody,
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: message.body },
              action: {
                buttons: message.buttons.slice(0, 3).map((button) => ({
                  type: "reply",
                  reply: {
                    id: button.id,
                    title: button.title.slice(0, 20),
                  },
                })),
              },
            },
          }
        : {
            ...baseBody,
            type: "interactive",
            interactive: {
              type: "list",
              body: { text: message.body },
              action: {
                button: message.buttonText.slice(0, 20),
                sections: message.sections.map((section) => ({
                  title: section.title?.slice(0, 24),
                  rows: section.rows.slice(0, 10).map((row) => ({
                    id: row.id,
                    title: row.title.slice(0, 24),
                    description: row.description?.slice(0, 72),
                  })),
                })),
              },
            },
          };

  const response = await fetch(graphApiUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar mensagem WhatsApp: ${response.status} ${errorText}`);
  }
}

export async function sendWhatsAppTemplate(to: string, template: WhatsAppTemplateMessage) {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID precisam estar configuradas");
  }

  const components = template.bodyParameters?.length
    ? [
        {
          type: "body",
          parameters: template.bodyParameters.map((text) => ({
            type: "text",
            text,
          })),
        },
      ]
    : undefined;

  const response = await fetch(graphApiUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template.name,
        language: {
          policy: "deterministic",
          code: template.languageCode,
        },
        components,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar template WhatsApp: ${response.status} ${errorText}`);
  }
}

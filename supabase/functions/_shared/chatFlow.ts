import {
  getPdfUrl,
  getPostoById,
  listOpenPostos,
  normalize,
  resolveMedicamentoQuery,
  searchPostos,
  upsertPostoSubscription,
  type ChatSession,
  type PostoRecord,
} from "./chatData.ts";
import { searchMedicamentoInPdf } from "./searchMedicamento.ts";
import { type OutgoingWhatsAppMessage } from "./whatsapp.ts";

type ChatStep = "welcome" | "ask_name" | "select_posto" | "ask_medicamento" | "ask_continue" | "ask_notify" | "closed";

const INITIAL_STEP: ChatStep = "welcome";
const MAX_LIST_ROWS = 10;
const SESSION_RESTART_MINUTES = 15;
const RESTART_PATTERNS = [
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
  "menu",
  "inicio",
  "início",
  "reiniciar",
  "recomecar",
  "recomeçar",
  "comecar",
  "começar",
  "start",
];

interface FlowResult {
  nextSession: ChatSession;
  messages: OutgoingWhatsAppMessage[];
}

function baseSession(phoneNumber: string): ChatSession {
  return {
    phone_number: phoneNumber,
    step: INITIAL_STEP,
    user_name: null,
    selected_posto_id: null,
    selected_posto_nome: null,
    selected_posto_localidade: null,
    pdf_url: null,
  };
}

function withStep(session: ChatSession, step: ChatStep, changes: Partial<ChatSession> = {}): ChatSession {
  return {
    ...session,
    ...changes,
    step,
  };
}

function isKnownStep(step: string): step is ChatStep {
  return ["welcome", "ask_name", "select_posto", "ask_medicamento", "ask_continue", "ask_notify", "closed"].includes(step);
}

function isRestartIntent(text: string) {
  const normalized = normalize(text);
  return RESTART_PATTERNS.some((pattern) => normalized === pattern || normalized.startsWith(`${pattern} `));
}

function isSessionExpired(session: ChatSession) {
  if (!session.last_interaction_at) return false;

  const lastInteraction = new Date(session.last_interaction_at).getTime();
  if (Number.isNaN(lastInteraction)) return false;

  return Date.now() - lastInteraction > SESSION_RESTART_MINUTES * 60 * 1000;
}

function introMessages(): OutgoingWhatsAppMessage[] {
  return [
    {
      type: "text",
      text: "👋 Olá! Eu sou o assistente do ConsultMed IA e estou aqui para ajudar você a consultar medicamentos disponíveis nas UBS da sua cidade.",
    },
    {
      type: "text",
      text: "Para começar, qual é o seu nome?",
    },
  ];
}

function buildPostoListMessage(postos: PostoRecord[], prompt: string): OutgoingWhatsAppMessage[] {
  if (postos.length === 0) {
    return [{ type: "text", text: "No momento, não há postos disponíveis para consulta." }];
  }

  const visiblePostos = postos.slice(0, MAX_LIST_ROWS);

  const messages: OutgoingWhatsAppMessage[] = [
    {
      type: "list",
      body: prompt,
      buttonText: "Ver postos",
      sections: [
        {
          title: "Postos disponíveis",
          rows: visiblePostos.map((posto) => ({
            id: `posto:${posto.id}`,
            title: posto.nome,
            description: posto.localidade,
          })),
        },
      ],
    },
  ];

  if (postos.length > MAX_LIST_ROWS) {
    messages.push({
      type: "text",
      text: `Encontrei ${postos.length} postos. Estou exibindo os primeiros ${MAX_LIST_ROWS}. Se a unidade desejada não aparecer, digite parte do nome ou do bairro para filtrar.`,
    });
  }

  return messages;
}

function buildNotificationPrompt(session: ChatSession): OutgoingWhatsAppMessage[] {
  if (!session.selected_posto_nome || !session.selected_posto_localidade) {
    return [];
  }

  return [
    {
      type: "buttons",
      body: `🔔 Deseja receber avisos quando o estoque da unidade ${session.selected_posto_nome} (${session.selected_posto_localidade}) for atualizado?`,
      buttons: [
        { id: "notify:yes", title: "Receber avisos" },
        { id: "notify:no", title: "Não, obrigado" },
      ],
    },
  ];
}

function formatMedicamentoMessage(
  nomeDigitado: string,
  postoNome: string,
  postoLocalidade: string,
  resposta: Awaited<ReturnType<typeof searchMedicamentoInPdf>>,
): OutgoingWhatsAppMessage[] {
  const messages: OutgoingWhatsAppMessage[] = [];

  if (resposta.encontrado && resposta.medicamentos.length > 0) {
    const quantidade = resposta.medicamentos.length;
    messages.push({
      type: "text",
      text: `✅ Consulta realizada com sucesso.\nEncontrei ${quantidade} medicamento${quantidade > 1 ? "s" : ""} disponível${quantidade > 1 ? "eis" : ""}.`,
    });

    for (const medicamento of resposta.medicamentos.slice(0, 5)) {
      const lines = [
        `💊 *${medicamento.nome}*`,
        `🏷️ Código: ${medicamento.codigo}`,
      ];

      if (medicamento.unidade) {
        lines.push(`📦 Unidade: ${medicamento.unidade}`);
      }

      if (medicamento.lotes.length > 0) {
        lines.push("📋 Lotes disponíveis:");
        for (const lote of medicamento.lotes.slice(0, 5)) {
          lines.push(`- Lote ${lote.lote} | validade ${lote.validade} | quantidade ${lote.quantidade}`);
        }
      }

      lines.push(`✅ Quantidade total informada no PDF: ${medicamento.quantidadeTotal}`);
      messages.push({ type: "text", text: lines.join("\n") });
    }
  } else {
    messages.push({
      type: "text",
      text: `❌ No momento, "${nomeDigitado}" não consta no estoque atual do ${postoNome}.`,
    });
  }

  messages.push({
    type: "text",
    text: `📍 Para mais informações, dirija-se ao ${postoNome} (${postoLocalidade}) com receita médica e Cartão do SUS.`,
  });

  messages.push({
    type: "buttons",
    body: "📌 O que você deseja fazer agora?\n\nSelecione uma das opções abaixo para continuar o atendimento.",
    buttons: [
      { id: "continue:mesmo_posto", title: "Outro medicamento" },
      { id: "continue:outro_posto", title: "Outro posto" },
      { id: "continue:encerrar", title: "Encerrar" },
    ],
  });

  return messages;
}

async function selectPosto(session: ChatSession, postoId: string): Promise<FlowResult> {
  const posto = await getPostoById(postoId);
  if (!posto) {
    return {
      nextSession: withStep(session, "select_posto"),
      messages: [{ type: "text", text: "Não consegui localizar esse posto. Tente escolher outra opção da lista." }],
    };
  }

  const pdfUrl = await getPdfUrl(posto.id);

  return {
    nextSession: withStep(session, "ask_medicamento", {
      selected_posto_id: posto.id,
      selected_posto_nome: posto.nome,
      selected_posto_localidade: posto.localidade,
      pdf_url: pdfUrl,
    }),
    messages: [
      {
        type: "text",
        text: `✅ Ótimo! Você selecionou ${posto.nome} - ${posto.localidade}.\nQual medicamento você gostaria de consultar?`,
      },
    ],
  };
}

export function buildInactivityClosureMessages(session: ChatSession): OutgoingWhatsAppMessage[] {
  const messages: OutgoingWhatsAppMessage[] = [
    {
      type: "text",
      text: "⏳ Seu atendimento foi encerrado automaticamente por inatividade.",
    },
  ];

  return messages.concat(buildNotificationPrompt(session));
}

export async function runChatFlow(phoneNumber: string, sessionInput: ChatSession | null, incomingText: string): Promise<FlowResult> {
  const incoming = incomingText.trim();
  const shouldRestart =
    !sessionInput ||
    !isKnownStep(sessionInput.step) ||
    isSessionExpired(sessionInput) ||
    isRestartIntent(incoming);
  const session = shouldRestart ? baseSession(phoneNumber) : { ...sessionInput };
  const step = isKnownStep(session.step) ? session.step : INITIAL_STEP;

  if (!incoming) {
    return {
      nextSession: session,
      messages: [{ type: "text", text: "Envie uma mensagem de texto para eu continuar a consulta." }],
    };
  }

  if (step === "welcome") {
    return {
      nextSession: withStep(session, "ask_name"),
      messages: introMessages(),
    };
  }

  if (step === "ask_name") {
    const postos = await listOpenPostos();
    if (postos.length === 0) {
      return {
        nextSession: withStep(session, "ask_name", { user_name: incoming }),
        messages: [{ type: "text", text: `Prazer em conhecer você, ${incoming}. No momento, não há postos disponíveis para consulta.` }],
      };
    }

    return {
      nextSession: withStep(session, "select_posto", { user_name: incoming }),
      messages: [
        { type: "text", text: `Prazer em conhecer você, ${incoming}!` },
        ...buildPostoListMessage(postos, "Selecione o posto de saúde que deseja consultar:"),
      ],
    };
  }

  if (step === "select_posto") {
    if (incoming.startsWith("posto:")) {
      return selectPosto(session, incoming.replace("posto:", ""));
    }

    const foundPostos = await searchPostos(incoming);

    if (foundPostos.length === 0) {
      return {
        nextSession: withStep(session, "select_posto"),
        messages: [{ type: "text", text: `Não encontrei nenhum posto com "${incoming}". Digite outro nome, bairro ou selecione uma opção da lista.` }],
      };
    }

    if (foundPostos.length === 1) {
      return selectPosto(session, foundPostos[0].id);
    }

    return {
      nextSession: withStep(session, "select_posto"),
      messages: buildPostoListMessage(foundPostos, `Encontrei ${foundPostos.length} postos. Escolha uma opção na lista:`),
    };
  }

  if (step === "ask_medicamento") {
    if (!session.selected_posto_id || !session.selected_posto_nome || !session.selected_posto_localidade) {
      const postos = await listOpenPostos();
      return {
        nextSession: withStep(session, "select_posto", {
          selected_posto_id: null,
          selected_posto_nome: null,
          selected_posto_localidade: null,
          pdf_url: null,
        }),
        messages: buildPostoListMessage(postos, "Não consegui recuperar o posto selecionado. Escolha novamente uma unidade para continuar:"),
      };
    }

    if (/^\d+$/.test(incoming)) {
      return {
        nextSession: withStep(session, "ask_medicamento"),
        messages: [{ type: "text", text: "Por favor, digite o nome do medicamento. Exemplo: Paracetamol ou Dipirona." }],
      };
    }

    let queryForPdf = incoming;
    try {
      queryForPdf = await resolveMedicamentoQuery(session.selected_posto_id, incoming);
    } catch (error) {
      console.warn("Falha ao resolver query do medicamento:", error);
    }
    
    const pdfResponse = await searchMedicamentoInPdf(session.pdf_url, queryForPdf);
    const userTermNorm = normalize(incoming);
    const firstMedNorm = normalize(pdfResponse.medicamentos[0]?.nome || "");
    const searchedByBrand = userTermNorm && firstMedNorm && !firstMedNorm.startsWith(userTermNorm.split(" ")[0]);

    if (searchedByBrand && pdfResponse.encontrado && pdfResponse.medicamentos.length > 0) {
      const quantidade = pdfResponse.medicamentos.length;
      pdfResponse.mensagem = `Encontrei ${quantidade} medicamento${quantidade > 1 ? "s" : ""} relacionado${quantidade > 1 ? "s" : ""} à sua busca.`;
    }

    return {
      nextSession: withStep(session, "ask_continue"),
      messages: formatMedicamentoMessage(incoming, session.selected_posto_nome, session.selected_posto_localidade, pdfResponse),
    };
  }

  if (step === "ask_continue") {
    const option = incoming.toLowerCase();

    if (option === "continue:mesmo_posto" || option === "1" || option.includes("mesmo posto") || option.includes("outro medicamento")) {
      return {
        nextSession: withStep(session, "ask_medicamento"),
        messages: [{ type: "text", text: `Perfeito. Qual medicamento você gostaria de consultar no ${session.selected_posto_nome}?` }],
      };
    }

    if (option === "continue:outro_posto" || option === "2" || option.includes("outro posto") || option.includes("trocar")) {
      const postos = await listOpenPostos();
      return {
        nextSession: withStep(session, "select_posto", {
          selected_posto_id: null,
          selected_posto_nome: null,
          selected_posto_localidade: null,
          pdf_url: null,
        }),
        messages: buildPostoListMessage(postos, "Sem problemas. Selecione o posto de saúde que deseja consultar:"),
      };
    }

    if (option === "continue:encerrar" || option === "3" || option.includes("encerrar") || option.includes("sair") || option === "nao" || option === "não") {
      return {
        nextSession: withStep(session, "ask_notify"),
        messages: [
          { type: "text", text: `🙂 Foi um prazer ajudar você, ${session.user_name || "usuário"}.` },
          ...buildNotificationPrompt(session),
        ],
      };
    }

    return {
      nextSession: withStep(session, "ask_continue"),
      messages: [{ type: "text", text: "Por favor, escolha uma opção usando os botões ou envie 1, 2 ou 3." }],
    };
  }

  if (step === "ask_notify") {
    const option = incoming.toLowerCase();

    if (option === "notify:yes" || option === "1" || option.includes("receber")) {
      await upsertPostoSubscription(session);

      return {
        nextSession: withStep(session, "closed"),
        messages: [
          {
            type: "text",
            text: "Avisos ativados com sucesso. Você será informado quando houver atualização do estoque da unidade " + session.selected_posto_nome + ".",
          },
          {
            type: "text",
            text: "Atendimento encerrado. Quando quiser iniciar uma nova consulta, envie oi.",
          },
        ],
      };
    }

    if (option === "notify:no" || option === "2" || option.includes("nao") || option.includes("não") || option.includes("obrigado")) {
      return {
        nextSession: withStep(session, "closed", {
          selected_posto_id: null,
          selected_posto_nome: null,
          selected_posto_localidade: null,
          pdf_url: null,
        }),
        messages: [{ type: "text", text: "Atendimento encerrado. Quando precisar, estarei por aqui." }],
      };
    }

    return {
      nextSession: withStep(session, "ask_notify"),
      messages: [{ type: "text", text: "Por favor, escolha uma opção usando os botões de aviso." }],
    };
  }

  if (step === "closed") {
    return {
      nextSession: withStep(session, "closed"),
      messages: [{ type: "text", text: "Seu atendimento foi encerrado. Para iniciar uma nova consulta, envie oi." }],
    };
  }

  return {
    nextSession: session,
    messages: [{ type: "text", text: "Não consegui identificar o estado atual da conversa. Vamos tentar novamente." }],
  };
}


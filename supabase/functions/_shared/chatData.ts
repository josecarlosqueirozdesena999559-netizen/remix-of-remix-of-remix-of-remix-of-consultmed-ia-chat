import { supabaseAdmin } from "./supabaseAdmin.ts";

export interface PostoRecord {
  id: string;
  nome: string;
  localidade: string;
  horario_funcionamento?: string;
  contato?: string | null;
  status?: string;
}

export interface ChatSession {
  phone_number: string;
  step: string;
  user_name: string | null;
  selected_posto_id: string | null;
  selected_posto_nome: string | null;
  selected_posto_localidade: string | null;
  pdf_url: string | null;
  last_interaction_at?: string | null;
}

export interface LatestPdfInfo {
  id: string;
  url: string;
  data_upload: string | null;
}

export interface PostoSubscription {
  id: string;
  phone_number: string;
  posto_id: string;
  posto_nome: string;
  posto_localidade: string;
  active: boolean;
  last_notified_pdf_id: string | null;
  last_notified_at: string | null;
}

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}

export async function listOpenPostos(): Promise<PostoRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("postos")
    .select("id, nome, localidade, horario_funcionamento, contato, status")
    .eq("status", "aberto")
    .order("nome", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PostoRecord[];
}

export async function getPostoById(postoId: string): Promise<PostoRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("postos")
    .select("id, nome, localidade, horario_funcionamento, contato, status")
    .eq("id", postoId)
    .maybeSingle();

  if (error) throw error;
  return (data as PostoRecord | null) ?? null;
}

export async function getPdfUrl(postoId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("arquivos_pdf")
    .select("url")
    .eq("posto_id", postoId)
    .order("data_upload", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.url ?? null;
}

export async function getLatestPdfInfo(postoId: string): Promise<LatestPdfInfo | null> {
  const { data, error } = await supabaseAdmin
    .from("arquivos_pdf")
    .select("id, url, data_upload")
    .eq("posto_id", postoId)
    .order("data_upload", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as LatestPdfInfo | null) ?? null;
}

export async function searchPostos(query: string): Promise<PostoRecord[]> {
  const postos = await listOpenPostos();
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) return postos;

  return postos.filter((posto) => {
    const nome = normalize(posto.nome);
    const localidade = normalize(posto.localidade);
    return nome.includes(normalizedQuery) || localidade.includes(normalizedQuery);
  });
}

export async function resolveMedicamentoQuery(postoId: string, query: string): Promise<string> {
  const normalizedQuery = normalize(query);
  const token = normalizedQuery.split(" ")[0];
  if (!token) return query;

  const { data, error } = await supabaseAdmin
    .from("medicamentos")
    .select("nome, marcas")
    .eq("posto_id", postoId);

  if (error) throw error;

  const meds = (data ?? []) as Array<{ nome: string; marcas?: string[] | null }>;

  for (const med of meds) {
    for (const marca of med.marcas ?? []) {
      const marcaNorm = normalize(marca);
      if (!marcaNorm) continue;

      const left = marcaNorm.slice(0, normalizedQuery.length);
      const typoDist = levenshtein(left, normalizedQuery);

      const isMatch =
        marcaNorm === normalizedQuery ||
        marcaNorm.startsWith(normalizedQuery) ||
        normalizedQuery.startsWith(marcaNorm) ||
        typoDist <= 1;

      if (isMatch) {
        const nomeToken = normalize(med.nome).split(" ")[0];
        return nomeToken || med.nome.trim() || query;
      }
    }
  }

  const matchByPrefix = meds.filter((med) => {
    const nomeNorm = normalize(med.nome);
    return token ? nomeNorm.startsWith(token) : false;
  });

  if (matchByPrefix.length >= 2) return query;

  if (matchByPrefix.length === 1) {
    const resolvedNome = matchByPrefix[0].nome?.trim();
    const resolvedToken = resolvedNome ? normalize(resolvedNome).split(" ")[0] : "";
    const isBrandMapping = resolvedToken && !resolvedToken.startsWith(token);
    return isBrandMapping ? resolvedToken || resolvedNome : query;
  }

  let best: { dist: number; nomeToken: string } | null = null;

  for (const med of meds) {
    const nomeToken = normalize(med.nome).split(" ")[0];
    if (!nomeToken) continue;

    const compareNome = nomeToken.slice(0, token.length) || nomeToken;
    const distNome = levenshtein(token, compareNome);

    if (!best || distNome < best.dist) {
      best = { dist: distNome, nomeToken };
    }
  }

  const threshold = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
  if (!best || best.dist > threshold) return query;

  const suggested = token.length <= 6 ? best.nomeToken.slice(0, 4) || best.nomeToken : best.nomeToken;
  return suggested;
}

export async function upsertPostoSubscription(session: ChatSession) {
  if (!session.phone_number || !session.selected_posto_id || !session.selected_posto_nome || !session.selected_posto_localidade) {
    throw new Error("Dados do posto ou telefone ausentes para criar inscricao");
  }

  const latestPdf = await getLatestPdfInfo(session.selected_posto_id);
  const chave = `whatsapp_notify:${session.phone_number}:${session.selected_posto_id}`;
  const payload: Omit<PostoSubscription, "id"> = {
    phone_number: session.phone_number,
    posto_id: session.selected_posto_id,
    posto_nome: session.selected_posto_nome,
    posto_localidade: session.selected_posto_localidade,
    active: true,
    last_notified_pdf_id: latestPdf?.id ?? null,
    last_notified_at: latestPdf ? new Date().toISOString() : null,
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("config_sistema")
    .select("id")
    .eq("chave", chave)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("config_sistema")
      .update({
        valor: JSON.stringify(payload),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
    return { id: existing.id, ...payload };
  }

  const { data, error } = await supabaseAdmin
    .from("config_sistema")
    .insert({
      chave,
      valor: JSON.stringify(payload),
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, ...payload };
}

export async function listActivePostoSubscriptions(): Promise<PostoSubscription[]> {
  const { data, error } = await supabaseAdmin
    .from("config_sistema")
    .select("id, chave, valor")
    .like("chave", "whatsapp_notify:%");

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      try {
        const parsed = JSON.parse(row.valor as string) as Omit<PostoSubscription, "id">;
        return { id: row.id as string, ...parsed };
      } catch {
        return null;
      }
    })
    .filter((item): item is PostoSubscription => Boolean(item?.active));
}

export async function markSubscriptionNotified(subscriptionId: string, pdfId: string) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("config_sistema")
    .select("valor")
    .eq("id", subscriptionId)
    .single();

  if (fetchError) throw fetchError;

  const parsed = JSON.parse(existing.valor as string) as Omit<PostoSubscription, "id">;

  const { error } = await supabaseAdmin
    .from("config_sistema")
    .update({
      valor: JSON.stringify({
        ...parsed,
        last_notified_pdf_id: pdfId,
        last_notified_at: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) throw error;
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Medicamento {
  id: string;
  nome: string;
  marcas?: string[] | null;
  quantidade: string | null;
  pagina_pdf: string | null;
  posto_id: string;
}

interface LoteInfo {
  lote: string;
  validade: string;
  quantidade: string;
}

interface MedicamentoAI {
  nome: string;
  codigo: string;
  unidade?: string;
  lotes: LoteInfo[];
  quantidadeTotal: string;
}

interface AIResponse {
  encontrado: boolean;
  podeEstarEsgotado?: boolean;
  mensagem: string;
  medicamentos: MedicamentoAI[];
}

export type { LoteInfo, MedicamentoAI };

export function useMedicamentos() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const levenshtein = (a: string, b: string) => {
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
  };

  const resolveMedicamentoQuery = async (postoId: string, query: string): Promise<string> => {
    const normalizedQuery = normalize(query);
    const token = normalizedQuery.split(' ')[0];
    if (!token) return query;

    const { data, error } = await supabase
      .from('medicamentos')
      .select('nome, marcas')
      .eq('posto_id', postoId);

    if (error) throw error;

    const meds = (data || []) as Array<{ nome: string; marcas?: string[] | null }>;

    // 1) Se o usuário digitou uma MARCA (nome comercial), mapeia para o princípio ativo.
    // Importante: devolvemos um termo CURTO (primeiro token do nome) para aumentar a chance de match no PDF.
    for (const med of meds) {
      const marcas = med.marcas || [];
      for (const marca of marcas) {
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
          const nomeToken = normalize(med.nome).split(' ')[0];
          return nomeToken || med.nome.trim() || query;
        }
      }
    }

    // 2) Prefixo no nome do medicamento (princípio ativo digitado)
    const matchByPrefix = meds.filter((med) => {
      const nomeNorm = normalize(med.nome);
      return token ? nomeNorm.startsWith(token) : false;
    });

    if (matchByPrefix.length >= 2) return query;

    if (matchByPrefix.length === 1) {
      const resolvedNome = matchByPrefix[0].nome?.trim();
      const resolvedToken = resolvedNome ? normalize(resolvedNome).split(' ')[0] : '';
      const isBrandMapping = resolvedToken && !resolvedToken.startsWith(token);
      return isBrandMapping ? resolvedToken || resolvedNome : query;
    }

    // 3) Correção de erros de digitação (Levenshtein)
    let best: { dist: number; nomeToken: string } | null = null;

    for (const med of meds) {
      const nomeToken = normalize(med.nome).split(' ')[0];
      if (!nomeToken) continue;

      const compareNome = nomeToken.slice(0, token.length) || nomeToken;
      const distNome = levenshtein(token, compareNome);

      if (!best || distNome < best.dist) best = { dist: distNome, nomeToken };
    }

    const threshold = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
    if (!best || best.dist > threshold) return query;

    const suggested = token.length <= 6 ? best.nomeToken.slice(0, 4) || best.nomeToken : best.nomeToken;
    return suggested;
  };

  const searchMedicamento = async (postoId: string, query: string): Promise<Medicamento[]> => {
    setLoading(true);
    setError(null);

    try {
      const normalizedQuery = normalize(query);
      const firstToken = normalizedQuery.split(' ')[0];

      const { data, error } = await supabase.from('medicamentos').select('*').eq('posto_id', postoId);

      if (error) throw error;

      const filtered = (data || []).filter((med) => {
        const normalizedNome = normalize(med.nome);
        return firstToken ? normalizedNome.startsWith(firstToken) : false;
      });

      return filtered;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar medicamentos');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const searchMedicamentoWithAI = async (
    postoNome: string,
    postoLocalidade: string,
    medicamentoQuery: string,
    pdfUrl: string | null
  ): Promise<AIResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('search-medicamento', {
        body: {
          postoNome,
          postoLocalidade,
          medicamentoQuery,
          pdfUrl,
        },
      });

      if (error) throw error;
      return data as AIResponse;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar PDF');
      return {
        encontrado: false,
        mensagem: 'Desculpe, não foi possível ler o PDF deste posto no momento. Por favor, tente novamente.',
        medicamentos: [],
      };
    } finally {
      setLoading(false);
    }
  };

  const getPdfUrl = async (postoId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('arquivos_pdf')
        .select('url')
        .eq('posto_id', postoId)
        .order('data_upload', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.url || null;
    } catch {
      return null;
    }
  };

  return { resolveMedicamentoQuery, searchMedicamento, searchMedicamentoWithAI, getPdfUrl, loading, error };
}

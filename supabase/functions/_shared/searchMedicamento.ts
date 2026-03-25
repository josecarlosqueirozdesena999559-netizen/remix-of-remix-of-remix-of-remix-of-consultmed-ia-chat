export interface LoteInfo {
  lote: string;
  validade: string;
  quantidade: string;
}

export interface MedicamentoAI {
  nome: string;
  codigo: string;
  unidade?: string;
  lotes: LoteInfo[];
  quantidadeTotal: string;
}

export interface AIResponse {
  encontrado: boolean;
  podeEstarEsgotado?: boolean;
  mensagem: string;
  medicamentos: MedicamentoAI[];
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildPrompt(queryNormalized: string) {
  return `Voce e um extrator de dados de PDFs de estoque de medicamentos de UBS/farmacias brasileiras.

TAREFA: Extrair TODOS os medicamentos que contenham "${queryNormalized}" no nome.

IMPORTANTE - COMO LER ESTE PDF:
Este e um relatorio de "Posicao de Estoque" com formato de tabela. Cada medicamento aparece em linhas que comecam com "Produto:" ou "ProdutO:" seguido de um codigo (ex: BR0309040) e o nome do medicamento.

REGRAS DE BUSCA (seja FLEXIVEL):
1. Busque medicamentos onde o NOME contem "${queryNormalized}" em QUALQUER parte
2. Ignore acentos e maiusculas/minusculas na comparacao
3. Se o usuario buscar "PARA" ou "PACO" ou "PARAC", encontre PARACETAMOL
4. Se o usuario buscar "DIPIR", encontre DIPIRONA
5. Aceite correspondencias parciais (prefixo, substring)
6. Se nao encontrar nada com correspondencia exata, tente variacoes proximas

EXTRACAO DE DADOS:
Para cada medicamento encontrado, extraia:
- CODIGO: codigo que vem apos "Produto:" (ex: BR0309040)
- NOME: nome completo do medicamento
- UNIDADE: apos "Unidade:"
- Para cada LOTE:
  - VALIDADE: data no formato DD/MM/AAAA
  - LOTE: codigo alfanumerico
  - QUANTIDADE: numero que representa a quantidade em estoque
- QUANTIDADE TOTAL: soma ou valor apos "Total:"

FORMATO DE RESPOSTA (JSON obrigatorio):
{
  "encontrado": true,
  "mensagem": "Encontrei X medicamento(s):",
  "medicamentos": [
    {
      "nome": "NOME COMPLETO DO MEDICAMENTO",
      "codigo": "CODIGO",
      "unidade": "UNIDADE",
      "lotes": [
        {"lote": "CODIGO_LOTE", "validade": "DD/MM/AAAA", "quantidade": "X"}
      ],
      "quantidadeTotal": "X"
    }
  ]
}

Se NAO encontrar nenhum medicamento correspondente:
{
  "encontrado": false,
  "podeEstarEsgotado": true,
  "mensagem": "Nao encontrei '${queryNormalized}' no estoque atual deste posto.",
  "medicamentos": []
}

RETORNE APENAS O JSON, sem texto adicional, sem markdown.`;
}

export async function searchMedicamentoInPdf(pdfUrl: string | null, medicamentoQuery: string): Promise<AIResponse> {
  if (!pdfUrl) {
    return {
      encontrado: false,
      mensagem: "Nao encontrei o PDF deste posto. Verifique se o arquivo foi cadastrado.",
      medicamentos: [],
    };
  }

  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY nao esta configurada");
  }

  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
  }

  const pdfBytes = await pdfResponse.arrayBuffer();
  const pdfBase64 = arrayBufferToBase64(pdfBytes);
  const queryNormalized = medicamentoQuery
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildPrompt(queryNormalized) },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: "estoque.pdf",
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            {
              type: "text",
              text: `Analise este PDF de estoque e encontre TODOS os medicamentos que contenham "${queryNormalized}" no nome. Retorne os dados em formato JSON.`,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro na API:", response.status, errorText);

    if (response.status === 429) {
      return {
        encontrado: false,
        mensagem: "Sistema ocupado. Aguarde alguns segundos e tente novamente.",
        medicamentos: [],
      };
    }

    if (response.status === 402) {
      return {
        encontrado: false,
        mensagem: "Sistema temporariamente indisponivel.",
        medicamentos: [],
      };
    }

    throw new Error(`Erro ao consultar IA: ${response.status}`);
  }

  const data = await response.json();
  const aiContent = data.choices?.[0]?.message?.content || "";

  let cleanContent = aiContent
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanContent = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(cleanContent);

    if (Array.isArray(parsed.medicamentos)) {
      parsed.medicamentos = parsed.medicamentos.map((med: Record<string, unknown>) => ({
        nome: typeof med.nome === "string" ? med.nome : "N/A",
        codigo: typeof med.codigo === "string" ? med.codigo : "N/A",
        unidade: typeof med.unidade === "string" ? med.unidade : undefined,
        lotes: Array.isArray(med.lotes) ? med.lotes : [],
        quantidadeTotal: typeof med.quantidadeTotal === "string" ? med.quantidadeTotal : "0",
      }));
    }

    return parsed as AIResponse;
  } catch (parseError) {
    console.error("Erro ao parsear JSON:", parseError);
    console.log("Conteudo recebido:", cleanContent.substring(0, 500));

    return {
      encontrado: false,
      mensagem: "Nao foi possivel processar a resposta. Tente novamente.",
      medicamentos: [],
    };
  }
}

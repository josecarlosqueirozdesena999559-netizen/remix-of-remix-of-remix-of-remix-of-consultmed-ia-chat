import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postoNome, postoLocalidade, medicamentoQuery, pdfUrl } = await req.json();
    
    console.log("=== NOVA BUSCA ===");
    console.log("Medicamento:", medicamentoQuery, "| Posto:", postoNome);
    console.log("PDF URL:", pdfUrl);
    
    if (!pdfUrl) {
      return new Response(JSON.stringify({
        encontrado: false,
        mensagem: "Não encontrei o PDF deste posto. Por favor, verifique se o PDF foi cadastrado.",
        medicamentos: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    console.log("Baixando PDF...");
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
    }
    
    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    console.log("PDF baixado:", pdfBytes.byteLength, "bytes");

    const queryNormalized = medicamentoQuery
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    
    console.log("Termo de busca normalizado:", queryNormalized);

    const systemPrompt = `Você é um extrator de dados de PDFs de estoque de medicamentos de UBS/farmácias brasileiras.

TAREFA: Extrair TODOS os medicamentos que contenham "${queryNormalized}" no nome.

IMPORTANTE - COMO LER ESTE PDF:
Este é um relatório de "Posição de Estoque" com formato de tabela. Cada medicamento aparece em linhas que começam com "Produto:" ou "ProdutO:" seguido de um código (ex: BR0309040) e o nome do medicamento.

REGRAS DE BUSCA (seja FLEXÍVEL):
1. Busque medicamentos onde o NOME contém "${queryNormalized}" em QUALQUER parte
2. Ignore acentos e maiúsculas/minúsculas na comparação
3. Se o usuário buscar "PARA" ou "PACO" ou "PARAC", encontre PARACETAMOL
4. Se o usuário buscar "DIPIR", encontre DIPIRONA
5. Aceite correspondências parciais (prefixo, substring)
6. Se não encontrar nada com correspondência exata, tente variações próximas

EXTRAÇÃO DE DADOS:
Para cada medicamento encontrado, extraia:
- CÓDIGO: código que vem após "Produto:" (ex: BR0309040)
- NOME: nome completo do medicamento (ex: ÁCIDO URSODESOXICÓLICO 300 MG COMPRIMIDO)
- UNIDADE: após "Unidade:" (ex: COMP., FR., UN)
- Para cada LOTE:
  - VALIDADE: data no formato DD/MM/AAAA
  - LOTE: código alfanumérico (ex: PTG1263A, 4M9304)
  - QUANTIDADE: número que representa a quantidade em estoque
- QUANTIDADE TOTAL: soma ou valor após "Total:"

FORMATO DE RESPOSTA (JSON obrigatório):
{
  "encontrado": true,
  "mensagem": "Encontrei X medicamento(s):",
  "medicamentos": [
    {
      "nome": "NOME COMPLETO DO MEDICAMENTO",
      "codigo": "CÓDIGO",
      "unidade": "UNIDADE",
      "lotes": [
        {"lote": "CÓDIGO_LOTE", "validade": "DD/MM/AAAA", "quantidade": "X"}
      ],
      "quantidadeTotal": "X"
    }
  ]
}

Se NÃO encontrar nenhum medicamento correspondente:
{
  "encontrado": false,
  "podeEstarEsgotado": true,
  "mensagem": "Não encontrei '${queryNormalized}' no estoque atual deste posto.",
  "medicamentos": []
}

RETORNE APENAS O JSON, sem texto adicional, sem markdown.`;

    console.log("Enviando para IA...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
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
        return new Response(JSON.stringify({ 
          encontrado: false,
          mensagem: "Sistema ocupado. Por favor, aguarde alguns segundos e tente novamente.",
          medicamentos: []
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          encontrado: false,
          mensagem: "Sistema temporariamente indisponível.",
          medicamentos: []
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro ao consultar IA: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || "";
    
    console.log("Resposta da IA (primeiros 800 chars):", aiContent.substring(0, 800));

    let cleanContent = aiContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }
    
    try {
      const parsed = JSON.parse(cleanContent);
      
      if (parsed.medicamentos && Array.isArray(parsed.medicamentos)) {
        parsed.medicamentos = parsed.medicamentos.map((med: any) => ({
          nome: med.nome || "N/A",
          codigo: med.codigo || "N/A",
          unidade: med.unidade || undefined,
          lotes: Array.isArray(med.lotes) ? med.lotes : [],
          quantidadeTotal: med.quantidadeTotal || "0"
        }));
      }
      
      console.log("Medicamentos encontrados:", parsed.medicamentos?.length || 0);
      if (parsed.medicamentos?.length > 0) {
        console.log("Primeiro resultado:", JSON.stringify(parsed.medicamentos[0]));
      }
      
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("Erro ao parsear JSON:", parseError);
      console.log("Conteúdo recebido:", cleanContent.substring(0, 500));
      
      return new Response(JSON.stringify({ 
        encontrado: false,
        mensagem: "Não foi possível processar a resposta. Tente novamente.",
        medicamentos: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido",
      encontrado: false,
      mensagem: "Ocorreu um erro ao processar sua consulta. Por favor, tente novamente.",
      medicamentos: []
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

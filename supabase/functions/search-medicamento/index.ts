import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { searchMedicamentoInPdf } from "../_shared/searchMedicamento.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postoNome, medicamentoQuery, pdfUrl } = await req.json();

    console.log("=== NOVA BUSCA ===");
    console.log("Medicamento:", medicamentoQuery, "| Posto:", postoNome);
    console.log("PDF URL:", pdfUrl);

    const result = await searchMedicamentoInPdf(pdfUrl, medicamentoQuery);

    console.log("Medicamentos encontrados:", result.medicamentos?.length || 0);
    if (result.medicamentos?.length > 0) {
      console.log("Primeiro resultado:", JSON.stringify(result.medicamentos[0]));
    }

    return jsonResponse(result);
  } catch (error) {
    console.error("Erro na funcao:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        encontrado: false,
        mensagem: "Ocorreu um erro ao processar sua consulta. Por favor, tente novamente.",
        medicamentos: [],
      },
      { status: 500 },
    );
  }
});

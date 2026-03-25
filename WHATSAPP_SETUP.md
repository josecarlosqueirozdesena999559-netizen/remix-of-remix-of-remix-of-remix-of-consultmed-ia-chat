# Integracao WhatsApp Cloud API

## O que foi criado

- `supabase/functions/whatsapp-webhook/index.ts`
  - Recebe o webhook da Meta.
  - Faz a verificacao `GET`.
  - Processa mensagens `POST`.
  - Responde ao usuario usando a API oficial.
- `supabase/functions/_shared/chatFlow.ts`
  - Reproduz o fluxo atual do chat no backend.
- `supabase/functions/_shared/searchMedicamento.ts`
  - Reaproveita a busca no PDF para o site e para o WhatsApp.
- `supabase/migrations/20260324_create_whatsapp_sessions.sql`
  - Salva o estado da conversa por numero de telefone.

## Variaveis de ambiente

Configure estas secrets no Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_API_VERSION`
  - Opcional. Se nao informar, o codigo usa `v22.0`.
- `WHATSAPP_NOTIFY_TEMPLATE_NAME`
  - Opcional. Se nao informar, o codigo usa `consultmed_atualizacao_estoque`.
- `WHATSAPP_NOTIFY_TEMPLATE_LANGUAGE`
  - Opcional. Se nao informar, o codigo usa `pt_BR`.

## Deploy

1. Rodar a migration do banco.
2. Publicar as functions:

```bash
supabase functions deploy search-medicamento
supabase functions deploy whatsapp-webhook
```

3. Cadastrar no painel da Meta o webhook da function `whatsapp-webhook`.

URL esperada:

```text
https://<PROJECT-REF>.supabase.co/functions/v1/whatsapp-webhook
```

4. Informar no painel da Meta o mesmo valor usado em `WHATSAPP_VERIFY_TOKEN`.
5. Assinar os eventos de mensagens do WhatsApp Business.

## Como o fluxo funciona

1. Usuario envia a primeira mensagem.
2. O webhook responde com a saudacao e pede o nome.
3. Depois envia lista interativa com os postos.
4. Usuario escolhe o posto e informa o medicamento.
5. O sistema consulta o PDF com a mesma logica do chat web.
6. O webhook responde com resultado e botoes para continuar.

## Observacoes

- A lista interativa do WhatsApp mostra no maximo 10 postos por vez.
- Se houver mais de 10 resultados, o usuario recebe orientacao para filtrar por nome ou bairro.
- O estado da conversa fica salvo na tabela `whatsapp_sessions`.
- Para notificacoes fora da janela de 24 horas, use template aprovado na Meta.

## Template sugerido

Cadastre este template na Meta:

- Nome: `consultmed_atualizacao_estoque`
- Idioma: `pt_BR`
- Categoria: `UTILITY`

Texto sugerido:

```text
Ola! O estoque da unidade {{1}} ({{2}}) foi atualizado.

Se desejar, envie uma mensagem para consultar os medicamentos disponiveis.
```

Parametros:

- `{{1}}` = nome do posto
- `{{2}}` = localidade do posto

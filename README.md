# WhatsCRM — Backend

CRM completo para WhatsApp com agente de IA, disparo em massa, remarketing e agendamentos.

## Stack

- Node.js + Express (API)
- Supabase (banco de dados PostgreSQL)
- Evolution API (WhatsApp)
- Anthropic Claude (agente de IA)

## Deploy rápido

### 1. Banco de dados (Supabase)
1. Crie conta em supabase.com
2. Crie novo projeto na região São Paulo
3. Vá em SQL Editor e cole o conteúdo de `banco.sql`
4. Copie a URL e a chave pública em Settings → API

### 2. Backend (Railway)
1. Crie conta em railway.app
2. New Project → Deploy from GitHub
3. Adicione as variáveis de ambiente (veja .env.example)
4. Copie a URL gerada pelo Railway

### 3. WhatsApp (Evolution API)
1. Instale em um VPS com Docker:
   ```
   docker run -d --name evolution-api -p 8080:8080 \
     -e AUTHENTICATION_API_KEY=sua-chave \
     atendai/evolution-api:latest
   ```
2. Acesse seuip:8080, crie uma instância e escaneie o QR Code
3. Configure o webhook apontando para: https://sua-url.railway.app/webhook/whatsapp

### 4. Variáveis de ambiente
Copie `.env.example` para `.env` e preencha todos os valores.

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/contatos | Lista contatos |
| POST | /api/contatos | Cria contato |
| PATCH | /api/contatos/:id/ia | Liga/desliga IA |
| POST | /api/campanhas | Cria campanha |
| POST | /api/campanhas/:id/disparar | Executa disparo |
| POST | /api/agente/simular | Testa o agente |
| POST | /api/agente/assumir | Humano assume conversa |
| POST | /api/agente/devolver | Devolve para IA |
| POST | /webhook/whatsapp | Recebe mensagens |

## Desenvolvimento local

```bash
npm install
cp .env.example .env
# preencha o .env
npm run dev
```

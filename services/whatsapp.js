const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'whatscrm';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { apikey: API_KEY, 'Content-Type': 'application/json' }
});

// Formata número para padrão internacional
function formatarNumero(tel) {
  const limpo = tel.replace(/\D/g, '');
  if (limpo.startsWith('55')) return limpo + '@s.whatsapp.net';
  return '55' + limpo + '@s.whatsapp.net';
}

// Envia mensagem de texto
async function enviarMensagem(telefone, texto) {
  try {
    const numero = formatarNumero(telefone);
    const res = await api.post(`/message/sendText/${INSTANCE}`, {
      number: numero,
      text: texto
    });
    return { ok: true, data: res.data };
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
    return { ok: false, erro: err.message };
  }
}

// Disparo em massa com delay entre mensagens (evita bloqueio)
async function dispararEmMassa(contatos, mensagem, delayMs = 4000) {
  const resultados = [];
  for (const contato of contatos) {
    // Substitui variáveis como {{nome}}, {{data}}
    const texto = mensagem
      .replace(/{{nome}}/gi, contato.nome || 'Cliente')
      .replace(/{{data}}/gi, new Date().toLocaleDateString('pt-BR'));

    const res = await enviarMensagem(contato.telefone, texto);
    resultados.push({ contato: contato.nome, ...res });

    // Delay humano entre mensagens (reduz risco de bloqueio)
    const espera = delayMs + Math.random() * 2000;
    await new Promise(r => setTimeout(r, espera));
  }
  return resultados;
}

// Busca status da instância (conectado / desconectado)
async function statusConexao() {
  try {
    const res = await api.get(`/instance/connectionState/${INSTANCE}`);
    return res.data;
  } catch (err) {
    return { state: 'error', erro: err.message };
  }
}

module.exports = { enviarMensagem, dispararEmMassa, statusConexao, formatarNumero };

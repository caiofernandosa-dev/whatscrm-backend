const axios = require('axios');

const EVOLUTION_URL      = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY      = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

function formatarNumero(telefone) {
  // Se for @lid (WhatsApp Business), retorna o jid completo
  if (String(telefone).includes('@lid')) {
    return telefone;
  }
  if (String(telefone).startsWith('lid_')) {
    // Formato interno lid_XXXXXXX — reconstrói o @lid
    return telefone.replace('lid_', '') + '@lid';
  }
  
  // Número normal — limpa e formata
  let num = String(telefone).replace(/\D/g, '');
  if (!num.startsWith('55')) num = '55' + num;
  return num;
}

async function enviarMensagem(telefone, mensagem) {
  try {
    const numero = formatarNumero(telefone);
    console.log(`[WhatsApp] Enviando para ${numero}: ${mensagem.substring(0, 50)}`);

    const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

    const response = await axios.post(url, {
      number: numero,
      text: mensagem
    }, {
      headers: {
        'apikey': EVOLUTION_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log(`[WhatsApp] Enviado! Status: ${response.status}`);
    return { ok: true, data: response.data };

  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`[WhatsApp] Erro ${status}:`, JSON.stringify(data));
    return { ok: false, erro: err.message, status, data };
  }
}

module.exports = { enviarMensagem, formatarNumero };

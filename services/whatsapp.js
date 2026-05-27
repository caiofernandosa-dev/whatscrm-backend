const axios = require('axios');

const EVOLUTION_URL      = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY      = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

function formatarNumero(telefone) {
  // Remove tudo que não é número
  let num = String(telefone).replace(/\D/g, '');
  
  // Remove @lid, @s.whatsapp.net etc
  num = num.split('@')[0];
  
  // Se começar com 0, remove
  if (num.startsWith('0')) num = num.slice(1);
  
  // Se não começar com 55, adiciona
  if (!num.startsWith('55')) num = '55' + num;
  
  // Garante que tem 12 ou 13 dígitos (55 + DDD + numero)
  // Se tiver 9 dígito no celular com DDD: 55 + 2 + 9 = 13 digitos
  // Se não tiver: 55 + 2 + 8 = 12 digitos
  
  return num;
}

async function enviarMensagem(telefone, mensagem) {
  try {
    const numero = formatarNumero(telefone);
    
    console.log(`[WhatsApp] Enviando para ${numero}: ${mensagem.substring(0, 50)}`);
    
    const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    
    const response = await axios.post(url, {
      number: numero,
      textMessage: { text: mensagem }
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

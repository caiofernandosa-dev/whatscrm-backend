const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { responderIA }    = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

// POST /webhook/whatsapp
// A Evolution API chama essa rota toda vez que chega uma mensagem
router.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body;

    // Ignora mensagens do próprio bot e grupos
    if (!body?.data?.message || body?.data?.key?.fromMe) {
      return res.sendStatus(200);
    }

    const telefone = body.data.key.remoteJid.replace('@s.whatsapp.net', '').replace('55', '');
    const texto    = body.data.message.conversation ||
                     body.data.message.extendedTextMessage?.text || '';

    if (!texto.trim()) return res.sendStatus(200);

    console.log(`[Webhook] Mensagem de ${telefone}: ${texto.substring(0, 60)}`);

    // Busca ou cria contato
    let { data: contato } = await supabase
      .from('contatos')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (!contato) {
      const { data: novo } = await supabase
        .from('contatos')
        .insert({ telefone, nome: 'Novo contato', ia_ativa: true, ativo: true, remarketing_ativo: true })
        .select()
        .single();
      contato = novo;
    }

    // Atualiza última interação
    await supabase
      .from('contatos')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('id', contato.id);

    // Se IA está pausada para este contato, não responde
    if (!contato.ia_ativa) {
      console.log(`[Webhook] IA pausada para ${telefone}`);
      return res.sendStatus(200);
    }

    // Delay humanizado antes de responder (simula digitação)
    const delay = 2000 + Math.random() * 3000;
    await new Promise(r => setTimeout(r, delay));

    // Chama o agente de IA
    const { ok, resposta, erro } = await responderIA(contato, texto);

    if (ok) {
      await enviarMensagem(contato.telefone, resposta);
      console.log(`[Webhook] IA respondeu para ${telefone}`);
    } else {
      console.error(`[Webhook] Falha IA: ${erro}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Webhook] Erro geral:', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;

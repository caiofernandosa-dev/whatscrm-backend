const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { responderIA }    = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

// POST /webhook/whatsapp
router.post('/whatsapp', async (req, res) => {
  try {
    res.sendStatus(200); // Responde rápido para o Evolution API não dar timeout

    const body = req.body;

    // Ignora mensagens enviadas pelo próprio bot
    if (!body?.data?.message || body?.data?.key?.fromMe) return;

    // Extrai o número do remetente
    const remoteJid = body?.data?.key?.remoteJid || '';
    if (remoteJid.includes('@g.us')) return; // Ignora grupos

    const telefone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '')
      .replace('55', '')
      .replace(/\D/g, '');

    const texto =
      body?.data?.message?.conversation ||
      body?.data?.message?.extendedTextMessage?.text ||
      body?.data?.message?.imageMessage?.caption ||
      '';

    if (!telefone) return;

    console.log(`[Webhook] Msg de ${telefone}: ${texto.substring(0, 60)}`);

    // Busca ou cria contato
    let contato;
    const { data: existente } = await supabase
      .from('contatos')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (existente) {
      contato = existente;
      // Atualiza última interação e última mensagem
      await supabase
        .from('contatos')
        .update({
          ultima_interacao: new Date().toISOString(),
          ultima_msg: texto.substring(0, 100)
        })
        .eq('id', contato.id);
    } else {
      // Cria novo contato
      const { data: novo } = await supabase
        .from('contatos')
        .insert({
          telefone,
          nome: 'WhatsApp +' + telefone,
          ia_ativa: true,
          ativo: true,
          remarketing_ativo: true,
          ultima_interacao: new Date().toISOString(),
          ultima_msg: texto.substring(0, 100)
        })
        .select()
        .single();
      contato = novo;
      console.log(`[Webhook] Novo contato criado: ${telefone}`);
    }

    if (!contato) return;

    // Salva mensagem no histórico
    await supabase.from('mensagens').insert({
      contato_id: contato.id,
      role: 'user',
      conteudo: texto || '[mídia]',
      criado_em: new Date().toISOString()
    });

    // Se IA está pausada, não responde
    if (!contato.ia_ativa) {
      console.log(`[Webhook] IA pausada para ${telefone}`);
      return;
    }

    // Só responde se tiver texto
    if (!texto.trim()) return;

    // Delay humanizado
    const delay = 2000 + Math.random() * 3000;
    await new Promise(r => setTimeout(r, delay));

    // Chama IA
    const { ok, resposta, erro } = await responderIA(contato, texto);

    if (ok && resposta) {
      await enviarMensagem(contato.telefone, resposta);
      console.log(`[Webhook] IA respondeu para ${telefone}`);
    } else {
      console.log(`[Webhook] IA falhou: ${erro}`);
    }

  } catch (err) {
    console.error('[Webhook] Erro:', err.message);
  }
});

module.exports = router;

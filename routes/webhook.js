const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { responderIA }    = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

router.post('/whatsapp', async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;

    // LOG COMPLETO para debug do número
    const remoteJid = body?.data?.key?.remoteJid || '';
    const pushName  = body?.data?.pushName || '';
    const fromMe    = body?.data?.key?.fromMe;
    console.log(`[Webhook] remoteJid: ${remoteJid} | pushName: ${pushName} | fromMe: ${fromMe}`);
    console.log(`[Webhook] sender: ${JSON.stringify(body?.data?.sender)}`);
    console.log(`[Webhook] participant: ${JSON.stringify(body?.data?.participant)}`);

    if (!body?.data?.message || fromMe) return;
    if (remoteJid.includes('@g.us')) return;

    const texto =
      body?.data?.message?.conversation ||
      body?.data?.message?.extendedTextMessage?.text ||
      body?.data?.message?.imageMessage?.caption ||
      '[mídia]';

    // Extrair número real
    let telefone = '';

    if (remoteJid.includes('@s.whatsapp.net')) {
      telefone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    } else if (remoteJid.includes('@lid')) {
      // @lid não tem número real — pegar do sender ou participant
      const sender = body?.data?.sender || '';
      if (sender && sender.includes('@s.whatsapp.net')) {
        telefone = sender.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      }
    }

    // Garante 55 no início
    if (telefone && !telefone.startsWith('55')) {
      telefone = '55' + telefone;
    }

    // Se ainda não tiver número válido, log e sai
    if (!telefone || telefone.length < 12) {
      console.log(`[Webhook] Número inválido extraído: "${telefone}" de remoteJid: "${remoteJid}"`);
      console.log(`[Webhook] Body completo: ${JSON.stringify(body?.data?.key)}`);
      return;
    }

    const nome = pushName || `WhatsApp +${telefone}`;
    console.log(`[Webhook] Msg de ${telefone} (${nome}): ${texto.substring(0, 60)}`);

    // Busca ou cria contato
    const { data: existente } = await supabase
      .from('contatos')
      .select('*')
      .eq('telefone', telefone)
      .single();

    let contato;
    if (existente) {
      contato = existente;
      await supabase.from('contatos').update({
        ultima_interacao: new Date().toISOString(),
        ultima_msg: texto.substring(0, 100)
      }).eq('id', contato.id);
    } else {
      const { data: novo } = await supabase
        .from('contatos')
        .insert({
          telefone,
          nome,
          ia_ativa: true,
          ativo: true,
          remarketing_ativo: true,
          ultima_interacao: new Date().toISOString(),
          ultima_msg: texto.substring(0, 100)
        })
        .select()
        .single();
      contato = novo;
      console.log(`[Webhook] Novo contato: ${telefone} (${nome})`);
    }

    if (!contato) return;

    await supabase.from('mensagens').insert({
      contato_id: contato.id,
      role: 'user',
      conteudo: texto,
      criado_em: new Date().toISOString()
    });

    if (!contato.ia_ativa) return;
    if (!texto.trim() || texto === '[mídia]') return;

    const delay = 2000 + Math.random() * 3000;
    await new Promise(r => setTimeout(r, delay));

    const { ok, resposta, erro } = await responderIA(contato, texto);
    if (ok && resposta) {
      await enviarMensagem(telefone, resposta);
      console.log(`[Webhook] IA respondeu para ${telefone}`);
    } else {
      console.log(`[Webhook] Falha IA: ${erro}`);
    }

  } catch (err) {
    console.error('[Webhook] Erro:', err.message);
  }
});

module.exports = router;

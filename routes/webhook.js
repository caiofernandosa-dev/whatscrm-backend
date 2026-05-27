const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { responderIA }    = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

router.post('/whatsapp', async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;
    if (!body?.data?.message || body?.data?.key?.fromMe) return;

    const remoteJid = body?.data?.key?.remoteJid || '';
    if (remoteJid.includes('@g.us')) return;

    // Extrair número real — prioriza pushName + remoteJid sem @lid
    // remoteJid pode ser: 5511999999999@s.whatsapp.net OU 196516279017700@lid
    let telefone = '';
    
    if (remoteJid.includes('@s.whatsapp.net')) {
      // Formato normal: 5511999999999@s.whatsapp.net
      telefone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      // Garante que tem 55 no início
      if (!telefone.startsWith('55')) telefone = '55' + telefone;
    } else if (remoteJid.includes('@lid')) {
      // Formato @lid — usar o número do participant
      const participant = body?.data?.participant || body?.data?.key?.participant || '';
      if (participant.includes('@s.whatsapp.net')) {
        telefone = participant.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
      } else {
        // Último recurso: remoteJid sem @lid
        telefone = remoteJid.replace('@lid', '').replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
      }
    }

    if (!telefone) {
      console.log('[Webhook] Não foi possível extrair telefone de:', remoteJid);
      return;
    }

    const texto =
      body?.data?.message?.conversation ||
      body?.data?.message?.extendedTextMessage?.text ||
      body?.data?.message?.imageMessage?.caption ||
      '[mídia]';

    const pushName = body?.data?.pushName || body?.data?.key?.pushName || '';
    const nome = pushName || `WhatsApp +${telefone}`; // telefone já tem 55

    console.log(`[Webhook] Msg de ${telefone} (${nome}): ${texto.substring(0, 60)}`);

    // Busca ou cria contato pelo telefone
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
        ultima_msg: texto.substring(0, 100),
        nome: existente.nome === `WhatsApp +${telefone}` && pushName ? pushName : existente.nome
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

    // Salva mensagem
    await supabase.from('mensagens').insert({
      contato_id: contato.id,
      role: 'user',
      conteudo: texto,
      criado_em: new Date().toISOString()
    });

    if (!contato.ia_ativa) {
      console.log(`[Webhook] IA pausada para ${telefone}`);
      return;
    }

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

const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../services/supabase');
const { responderIA }    = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

const EVO_URL  = process.env.EVOLUTION_API_URL;
const EVO_KEY  = process.env.EVOLUTION_API_KEY;
const EVO_INST = process.env.EVOLUTION_INSTANCE;

// Busca número real de um @lid pelo nome na agenda (v2)
async function resolverLid(lid, pushName) {
  try {
    if (!pushName) return null;
    const r = await axios.post(
      `${EVO_URL}/chat/findContacts/${EVO_INST}`,
      { where: {} },
      { headers: { apikey: EVO_KEY }, timeout: 8000 }
    );
    const contatos = r.data || [];
    // Procura contatos com mesmo pushName e @s.whatsapp.net
    const reais = contatos.filter(c => 
      c.remoteJid && 
      c.remoteJid.includes('@s.whatsapp.net') && 
      c.pushName === pushName
    );
    if (reais.length > 0) {
      // Pega o mais recente
      const real = reais.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      const num = real.remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g,'');
      console.log(`[Webhook] @lid resolvido: ${lid} → ${num} (${pushName})`);
      return num;
    }
    console.log(`[Webhook] @lid não resolvido para ${pushName} — ${contatos.filter(c=>c.pushName===pushName).length} contatos encontrados`);
  } catch(e) {
    console.log('[Webhook] Erro ao resolver @lid:', e.message);
  }
  return null;
}

router.post('/whatsapp', async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;
    if (!body?.data?.message) return;
    if (body?.data?.key?.fromMe) return;

    const remoteJid = body?.data?.key?.remoteJid || '';
    if (!remoteJid) return;
    if (remoteJid.includes('@g.us')) return;

    const pushName = body?.data?.pushName || '';
    // Ignorar mensagens de sistema/status
    const msgType = Object.keys(body?.data?.message || {})[0] || '';
    if (['protocolMessage','ephemeralMessage','reactionMessage','senderKeyDistributionMessage'].includes(msgType)) return;

    const texto =
      body?.data?.message?.conversation ||
      body?.data?.message?.extendedTextMessage?.text ||
      body?.data?.message?.imageMessage?.caption ||
      '';
    
    // Ignorar mensagens vazias ou só de mídia sem legenda
    if (!texto.trim()) return;

    // Extrair número real
    let telefone = '';
    let jidEnvio = remoteJid; // usado para enviar resposta

    if (remoteJid.includes('@s.whatsapp.net')) {
      telefone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      if (!telefone.startsWith('55')) telefone = '55' + telefone;
      jidEnvio = telefone;
    } else if (remoteJid.includes('@lid')) {
      // Tenta resolver pelo nome na agenda
      const lidId = remoteJid.replace('@lid','').replace(/\D/g,'');
      const numeroReal = await resolverLid(lidId, pushName);
      if (numeroReal) {
        telefone = numeroReal.startsWith('55') ? numeroReal : '55' + numeroReal;
        jidEnvio = telefone;
      } else {
        // Sem número real — salva com lid_ como fallback
        telefone = 'lid_' + lidId;
        jidEnvio = remoteJid;
        console.log(`[Webhook] Não resolveu @lid, salvando como ${telefone}`);
      }
    }

    if (!telefone) return;

    const nome = pushName || `WhatsApp +${telefone}`;
    console.log(`[Webhook] Msg de ${telefone} (${nome}): ${texto.substring(0,60)}`);

    // Busca ou cria contato
    const { data: existente } = await supabase
      .from('contatos').select('*').eq('telefone', telefone).single();

    let contato;
    if (existente) {
      contato = existente;
      // Se tinha lid_ e agora temos número real, atualiza
      if (existente.telefone.startsWith('lid_') && !telefone.startsWith('lid_')) {
        await supabase.from('contatos').update({ telefone, nome }).eq('id', existente.id);
      } else {
        await supabase.from('contatos').update({
          ultima_interacao: new Date().toISOString(),
          ultima_msg: texto.substring(0,100)
        }).eq('id', contato.id);
      }
    } else {
      const { data: novo } = await supabase.from('contatos').insert({
        telefone, nome,
        ia_ativa: true, ativo: true, remarketing_ativo: true,
        ultima_interacao: new Date().toISOString(),
        ultima_msg: texto.substring(0,100)
      }).select().single();
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

    await new Promise(r => setTimeout(r, 2000 + Math.random()*3000));

    const { ok, resposta, erro } = await responderIA(contato, texto);
    if (ok && resposta) {
      await enviarMensagem(jidEnvio, resposta);
      console.log(`[Webhook] IA respondeu para ${telefone}`);
    } else {
      console.log(`[Webhook] Falha IA: ${erro}`);
    }

  } catch (err) {
    console.error('[Webhook] Erro:', err.message);
  }
});

module.exports = router;

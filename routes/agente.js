const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { responderIA, salvarMensagem } = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

// GET /api/agente/status
router.get('/status', async (req, res) => {
  try {
    const { count } = await supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('ia_ativa', true);
    res.json({ ok: true, ia_global: true, contatos_com_ia: count });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agente/simular
router.post('/simular', async (req, res) => {
  try {
    const { mensagem, segmento, prompt_personalizado } = req.body;
    if (!mensagem) return res.status(400).json({ ok: false, erro: 'Mensagem obrigatória' });
    const contatoFake = {
      id: 'simulacao',
      nome: 'Teste',
      segmento: segmento || 'geral',
      prompt_personalizado: prompt_personalizado || null
    };
    const { ok, resposta, erro } = await responderIA(contatoFake, mensagem);
    if (!ok) throw new Error(erro);
    res.json({ ok: true, resposta });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/agente/historico/:contatoId
// Busca histórico de mensagens direto do banco
router.get('/historico/:contatoId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('mensagens')
      .select('id, role, conteudo, criado_em')
      .eq('contato_id', req.params.contatoId)
      .order('criado_em', { ascending: true })
      .limit(50);

    if (error) throw error;

    // Garante que conteudo nunca é undefined
    const historico = (data || []).map(m => ({
      ...m,
      conteudo: m.conteudo || ''
    }));

    res.json({ ok: true, historico });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agente/assumir — pausa IA e envia mensagem opcional
router.post('/assumir', async (req, res) => {
  try {
    const { contato_id, mensagem } = req.body;
    const { data: contato } = await supabase
      .from('contatos').select('*').eq('id', contato_id).single();
    if (!contato) return res.status(404).json({ ok: false, erro: 'Contato não encontrado' });

    // Pausa IA
    await supabase.from('contatos').update({ ia_ativa: false }).eq('id', contato_id);

    // Envia mensagem se tiver
    if (mensagem) {
      await enviarMensagem(contato.telefone, mensagem);
      await supabase.from('mensagens').insert({
        contato_id,
        role: 'assistant',
        conteudo: mensagem,
        criado_em: new Date().toISOString()
      });
    }

    res.json({ ok: true, mensagem: `IA pausada para ${contato.nome}` });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agente/devolver — reativa IA
router.post('/devolver', async (req, res) => {
  try {
    const { contato_id } = req.body;
    const { data: contato } = await supabase
      .from('contatos').update({ ia_ativa: true }).eq('id', contato_id).select().single();
    res.json({ ok: true, mensagem: `IA reativada para ${contato.nome}` });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;

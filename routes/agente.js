const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { responderIA, buscarHistorico } = require('../services/ia');
const { enviarMensagem } = require('../services/whatsapp');

// GET /api/agente/status — status geral do agente
router.get('/status', async (req, res) => {
  try {
    const { count } = await supabase.from('contatos').select('*', { count: 'exact', head: true }).eq('ia_ativa', true);
    res.json({ ok: true, ia_global: true, contatos_com_ia: count });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agente/simular — testa o agente sem WhatsApp real
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

// GET /api/agente/historico/:contatoId — histórico de conversa
router.get('/historico/:contatoId', async (req, res) => {
  try {
    const historico = await buscarHistorico(req.params.contatoId);
    res.json({ ok: true, historico });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agente/assumir — humano assume a conversa (pausa IA)
router.post('/assumir', async (req, res) => {
  try {
    const { contato_id, mensagem } = req.body;
    const { data: contato } = await supabase.from('contatos').select('*').eq('id', contato_id).single();
    if (!contato) return res.status(404).json({ ok: false, erro: 'Contato não encontrado' });
    await supabase.from('contatos').update({ ia_ativa: false }).eq('id', contato_id);
    if (mensagem) await enviarMensagem(contato.telefone, mensagem);
    res.json({ ok: true, mensagem: `IA pausada para ${contato.nome}. Você assumiu o atendimento.` });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agente/devolver — devolve conversa para a IA
router.post('/devolver', async (req, res) => {
  try {
    const { contato_id } = req.body;
    const { data: contato } = await supabase.from('contatos').update({ ia_ativa: true }).eq('id', contato_id).select().single();
    res.json({ ok: true, mensagem: `IA reativada para ${contato.nome}.` });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;

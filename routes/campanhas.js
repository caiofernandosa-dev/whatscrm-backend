const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { dispararEmMassa } = require('../services/whatsapp');

// GET /api/campanhas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('campanhas').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, campanhas: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/campanhas — cria campanha
router.post('/', async (req, res) => {
  try {
    const { nome, mensagem, segmento, tag, agendado_para } = req.body;
    if (!nome || !mensagem) return res.status(400).json({ ok: false, erro: 'Nome e mensagem obrigatórios' });
    const { data, error } = await supabase.from('campanhas').insert({
      nome, mensagem, segmento, tag,
      agendado_para: agendado_para || null,
      status: agendado_para ? 'agendada' : 'rascunho',
      criado_em: new Date().toISOString()
    }).select().single();
    if (error) throw error;
    res.status(201).json({ ok: true, campanha: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/campanhas/:id/disparar — executa o disparo
router.post('/:id/disparar', async (req, res) => {
  try {
    const { data: campanha, error: ce } = await supabase.from('campanhas').select('*').eq('id', req.params.id).single();
    if (ce || !campanha) return res.status(404).json({ ok: false, erro: 'Campanha não encontrada' });

    // Busca contatos do segmento
    let query = supabase.from('contatos').select('id, nome, telefone').eq('ativo', true);
    if (campanha.segmento) query = query.eq('segmento', campanha.segmento);
    if (campanha.tag)      query = query.eq('tag', campanha.tag);
    const { data: contatos } = await query;

    if (!contatos || contatos.length === 0) {
      return res.status(400).json({ ok: false, erro: 'Nenhum contato encontrado para este segmento' });
    }

    // Marca como enviando
    await supabase.from('campanhas').update({ status: 'enviando', total_contatos: contatos.length }).eq('id', campanha.id);

    // Dispara em background (não bloqueia a resposta)
    res.json({ ok: true, mensagem: `Disparando para ${contatos.length} contatos...`, total: contatos.length });

    // Executa o disparo
    const resultados = await dispararEmMassa(contatos, campanha.mensagem);
    const enviados   = resultados.filter(r => r.ok).length;
    const falhas     = resultados.filter(r => !r.ok).length;

    await supabase.from('campanhas').update({
      status: 'concluida',
      total_enviados: enviados,
      total_falhas: falhas,
      concluido_em: new Date().toISOString()
    }).eq('id', campanha.id);

    console.log(`[Campanha] ${campanha.nome}: ${enviados} enviados, ${falhas} falhas`);
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;

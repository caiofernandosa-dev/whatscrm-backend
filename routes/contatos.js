const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');

// GET /api/contatos — lista contatos ordenados por última interação
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('contatos')
      .select('*')
      .order('ultima_interacao', { ascending: false, nullsFirst: false });

    if (req.query.tag)      query = query.eq('tag', req.query.tag);
    if (req.query.segmento) query = query.eq('segmento', req.query.segmento);
    if (req.query.busca)    query = query.ilike('nome', `%${req.query.busca}%`);
    if (req.query.limit)    query = query.limit(parseInt(req.query.limit));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ ok: true, total: data.length, contatos: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/contatos/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contatos').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ ok: true, contato: data });
  } catch (err) {
    res.status(404).json({ ok: false, erro: 'Contato não encontrado' });
  }
});

// POST /api/contatos
router.post('/', async (req, res) => {
  try {
    const { nome, telefone, tag, segmento, prompt_personalizado } = req.body;
    if (!telefone) return res.status(400).json({ ok: false, erro: 'Telefone obrigatório' });
    const { data, error } = await supabase.from('contatos').insert({
      nome, telefone, tag, segmento, prompt_personalizado,
      ia_ativa: true, ativo: true, remarketing_ativo: true,
      criado_em: new Date().toISOString()
    }).select().single();
    if (error) throw error;
    res.status(201).json({ ok: true, contato: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PATCH /api/contatos/:id
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contatos').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, contato: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PATCH /api/contatos/:id/ia — liga/desliga IA
router.patch('/:id/ia', async (req, res) => {
  try {
    const { ia_ativa } = req.body;
    const { data, error } = await supabase
      .from('contatos').update({ ia_ativa }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, ia_ativa: data.ia_ativa });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /api/contatos/:id
router.delete('/:id', async (req, res) => {
  try {
    await supabase.from('contatos').delete().eq('id', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;

const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { enviarMensagem } = require('../services/whatsapp');

// GET /api/agendamentos?data=2026-05-26&segmento=clinica
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('agendamentos').select('*, contatos(nome, telefone)').order('data_hora');
    if (req.query.data) {
      const inicio = new Date(req.query.data); inicio.setHours(0,0,0,0);
      const fim    = new Date(req.query.data); fim.setHours(23,59,59,999);
      query = query.gte('data_hora', inicio.toISOString()).lte('data_hora', fim.toISOString());
    }
    if (req.query.segmento) query = query.eq('segmento', req.query.segmento);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ ok: true, agendamentos: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/agendamentos — cria agendamento e notifica pelo WhatsApp
router.post('/', async (req, res) => {
  try {
    const { contato_id, data_hora, tipo, segmento, observacoes, profissional } = req.body;
    if (!contato_id || !data_hora) return res.status(400).json({ ok: false, erro: 'contato_id e data_hora obrigatórios' });

    const { data: ag, error } = await supabase.from('agendamentos').insert({
      contato_id, data_hora, tipo, segmento, observacoes, profissional,
      status: 'confirmado', lembrete_enviado: false,
      criado_em: new Date().toISOString()
    }).select('*, contatos(nome, telefone)').single();
    if (error) throw error;

    // Envia confirmação pelo WhatsApp
    const dataFmt = new Date(data_hora).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const msg = `Agendamento confirmado!\n\n📅 ${dataFmt}\n👤 ${profissional || 'A definir'}\n📋 ${tipo || 'Consulta'}\n\nQualquer dúvida estamos à disposição!`;
    await enviarMensagem(ag.contatos.telefone, msg);

    res.status(201).json({ ok: true, agendamento: ag });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PATCH /api/agendamentos/:id — atualiza status
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('agendamentos').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, agendamento: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;

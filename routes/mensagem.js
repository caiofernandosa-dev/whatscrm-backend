const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { enviarMensagem } = require('../services/whatsapp');

// POST /api/mensagem/enviar
// Envia mensagem real pelo WhatsApp e salva no histórico
router.post('/enviar', async (req, res) => {
  try {
    const { telefone, mensagem, contato_id } = req.body;
    if (!telefone || !mensagem) {
      return res.status(400).json({ ok: false, erro: 'telefone e mensagem obrigatórios' });
    }

    // Envia pelo WhatsApp via Evolution API
    const resultado = await enviarMensagem(telefone, mensagem);

    if (!resultado.ok) {
      return res.status(500).json({ ok: false, erro: resultado.erro });
    }

    // Salva no histórico se tiver contato_id
    if (contato_id) {
      await supabase.from('mensagens').insert({
        contato_id,
        role: 'assistant',
        conteudo: mensagem,
        criado_em: new Date().toISOString()
      });

      // Atualiza última mensagem do contato
      await supabase.from('contatos')
        .update({ ultima_interacao: new Date().toISOString(), ultima_msg: mensagem.substring(0, 100) })
        .eq('id', contato_id);
    }

    console.log(`[Mensagem] Enviada para ${telefone}: ${mensagem.substring(0, 50)}`);
    res.json({ ok: true, mensagem: 'Enviada com sucesso' });

  } catch (err) {
    console.error('[Mensagem] Erro:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;

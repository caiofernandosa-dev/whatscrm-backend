const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../services/supabase');
const { enviarMensagem } = require('../services/whatsapp');

const EVO_URL  = process.env.EVOLUTION_API_URL;
const EVO_KEY  = process.env.EVOLUTION_API_KEY;
const EVO_INST = process.env.EVOLUTION_INSTANCE;

// POST /api/mensagem/enviar — texto
router.post('/enviar', async (req, res) => {
  try {
    const { telefone, mensagem, contato_id } = req.body;
    if (!telefone || !mensagem) {
      return res.status(400).json({ ok: false, erro: 'telefone e mensagem obrigatórios' });
    }
    const resultado = await enviarMensagem(telefone, mensagem);
    if (!resultado.ok) {
      return res.status(500).json({ ok: false, erro: resultado.erro });
    }
    if (contato_id) {
      await supabase.from('mensagens').insert({
        contato_id, role: 'assistant',
        conteudo: mensagem,
        criado_em: new Date().toISOString()
      });
      await supabase.from('contatos')
        .update({ ultima_interacao: new Date().toISOString(), ultima_msg: mensagem.substring(0, 100) })
        .eq('id', contato_id);
    }
    console.log(`[Mensagem] Enviada para ${telefone}: ${mensagem.substring(0, 50)}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Mensagem] Erro:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/mensagem/enviar-midia — imagem ou audio em base64
router.post('/enviar-midia', async (req, res) => {
  try {
    const { telefone, tipo, base64, mimetype, caption, filename } = req.body;
    if (!telefone || !base64) {
      return res.status(400).json({ ok: false, erro: 'telefone e base64 obrigatórios' });
    }

    let num = String(telefone).replace(/\D/g, '');
    if (!num.startsWith('55')) num = '55' + num;

    let endpoint, payload;

    if (tipo === 'imagem') {
      endpoint = `${EVO_URL}/message/sendMedia/${EVO_INST}`;
      payload = {
        number: num,
        mediatype: 'image',
        mimetype: mimetype || 'image/jpeg',
        caption: caption || '',
        media: base64,
        delay: 1000
      };
    } else if (tipo === 'audio') {
      endpoint = `${EVO_URL}/message/sendWhatsAppAudio/${EVO_INST}`;
      payload = {
        number: num,
        audio: base64,
        delay: 1000
      };
    } else {
      endpoint = `${EVO_URL}/message/sendMedia/${EVO_INST}`;
      payload = {
        number: num,
        mediatype: 'document',
        mimetype: mimetype || 'application/octet-stream',
        caption: caption || filename || '',
        media: base64,
        fileName: filename || 'arquivo',
        delay: 1000
      };
    }

    const response = await axios.post(endpoint, payload, {
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log(`[Midia] ${tipo} enviado para ${num}`);
    res.json({ ok: true, data: response.data });

  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error(`[Midia] Erro ${status}:`, JSON.stringify(data));
    res.status(500).json({ ok: false, erro: err.message, data });
  }
});

module.exports = router;

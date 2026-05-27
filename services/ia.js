const axios = require('axios');
const supabase = require('./supabase');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

async function buscarHistorico(contatoId) {
  try {
    const { data } = await supabase
      .from('mensagens')
      .select('role, conteudo')
      .eq('contato_id', contatoId)
      .order('criado_em', { ascending: true })
      .limit(20);
    return (data || []).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.conteudo || ''
    })).filter(m => m.content);
  } catch (e) {
    return [];
  }
}

async function responderIA(contato, mensagem) {
  try {
    const historico = await buscarHistorico(contato.id);

    const systemPrompt = contato.prompt_personalizado ||
      `Você é Sofia, assistente virtual prestativa e simpática. 
Atenda com cordialidade e responda sempre em português brasileiro.
Nunca invente informações. Se não souber algo, diga que vai verificar.
Seja conciso — respostas curtas e diretas.
Nome do cliente: ${contato.nome || 'Cliente'}.
Segmento: ${contato.segmento || 'geral'}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historico,
      { role: 'user', content: mensagem }
    ];

    // Mostrar "digitando..." antes de responder
    try {
      await axios.post(
        `${process.env.EVOLUTION_API_URL}/chat/presence/${process.env.EVOLUTION_INSTANCE}`,
        { number: contato.telefone, delay: 1000, presence: 'composing' },
        { headers: { apikey: process.env.EVOLUTION_API_KEY }, timeout: 3000 }
      );
    } catch(e) { /* ignora erro de presence */ }

    const response = await axios.post(GROQ_URL, {
      model: GROQ_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const resposta = response.data.choices[0].message.content.trim();

    // Salva resposta no histórico
    await supabase.from('mensagens').insert({
      contato_id: contato.id,
      role: 'assistant',
      conteudo: resposta,
      criado_em: new Date().toISOString()
    });

    console.log(`[IA] Groq respondeu para ${contato.nome}: ${resposta.substring(0, 60)}`);
    return { ok: true, resposta };

  } catch (err) {
    const erro = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`Erro IA: ${err.response?.status} ${erro}`);
    return { ok: false, erro };
  }
}

module.exports = { responderIA };

const Anthropic = require('@anthropic-ai/sdk');
const supabase  = require('./supabase');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Prompt base padrão (pode ser sobrescrito por contato/segmento)
const PROMPT_BASE = `Você é Sofia, assistente virtual inteligente. 
Atenda com cordialidade e objetividade. 
Responda sempre em português brasileiro informal mas profissional.
Nunca invente informações que não sabe.
Se não souber responder, diga: "Vou verificar isso com nossa equipe e te retorno em breve!"
Seja conciso — respostas curtas funcionam melhor no WhatsApp.`;

// Busca histórico de conversa do contato (últimas 10 mensagens)
async function buscarHistorico(contatoId) {
  const { data } = await supabase
    .from('mensagens')
    .select('role, conteudo')
    .eq('contato_id', contatoId)
    .order('criado_em', { ascending: true })
    .limit(10);
  return (data || []).map(m => ({ role: m.role, content: m.conteudo }));
}

// Salva mensagem no histórico
async function salvarMensagem(contatoId, role, conteudo) {
  await supabase.from('mensagens').insert({
    contato_id: contatoId,
    role,
    conteudo,
    criado_em: new Date().toISOString()
  });
}

// Responde com IA
async function responderIA(contato, mensagemUsuario) {
  try {
    // Busca prompt personalizado do contato/segmento
    let systemPrompt = PROMPT_BASE;
    if (contato.prompt_personalizado) {
      systemPrompt = contato.prompt_personalizado;
    } else if (contato.segmento === 'clinica') {
      systemPrompt = `Você é recepcionista virtual de clínica médica. 
Ajude a agendar consultas, confirmar horários e enviar lembretes.
Nunca dê diagnósticos ou orientações médicas.
Colete: nome, especialidade desejada, convênio e data preferida.`;
    } else if (contato.segmento === 'advocacia') {
      systemPrompt = `Você é assistente jurídica virtual.
Faça triagem e agendamento — nunca dê parecer jurídico.
Identifique a área (trabalhista, cível, família, criminal).
Colete dados do caso e agende reunião com o advogado responsável.`;
    }

    // Busca histórico da conversa
    const historico = await buscarHistorico(contato.id);

    // Chama a API da Anthropic
    const resposta = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...historico,
        { role: 'user', content: mensagemUsuario }
      ]
    });

    const textoResposta = resposta.content[0].text;

    // Salva no histórico
    await salvarMensagem(contato.id, 'user',      mensagemUsuario);
    await salvarMensagem(contato.id, 'assistant', textoResposta);

    return { ok: true, resposta: textoResposta };
  } catch (err) {
    console.error('Erro IA:', err.message);
    return { ok: false, erro: err.message };
  }
}

module.exports = { responderIA, salvarMensagem, buscarHistorico };

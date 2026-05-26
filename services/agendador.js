const cron      = require('node-cron');
const supabase   = require('./supabase');
const { enviarMensagem } = require('./whatsapp');

// Roda a cada hora para verificar lembretes de agendamento
cron.schedule('0 * * * *', async () => {
  console.log('[Agendador] Verificando lembretes...');
  await enviarLembretesConsulta();
});

// Roda todo dia às 9h para reengajamento de inativos
cron.schedule('0 9 * * *', async () => {
  console.log('[Agendador] Verificando inativos para reengajamento...');
  await reengajarInativos();
});

// Lembra contatos com agendamento nas próximas 24h
async function enviarLembretesConsulta() {
  try {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const inicio = new Date(amanha);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(amanha);
    fim.setHours(23, 59, 59, 999);

    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*, contatos(nome, telefone)')
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .eq('lembrete_enviado', false)
      .eq('status', 'confirmado');

    for (const ag of agendamentos || []) {
      const contato = ag.contatos;
      const dataFmt = new Date(ag.data_hora).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      const msg = `Olá ${contato.nome}! Lembrando do seu agendamento amanhã às ${dataFmt}. Confirme respondendo SIM ou cancele respondendo NÃO.`;
      await enviarMensagem(contato.telefone, msg);
      await supabase.from('agendamentos').update({ lembrete_enviado: true }).eq('id', ag.id);
      console.log(`[Lembrete] Enviado para ${contato.nome}`);
    }
  } catch (err) {
    console.error('[Lembrete] Erro:', err.message);
  }
}

// Reengaja contatos sem interação há 30 dias
async function reengajarInativos() {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);

    const { data: contatos } = await supabase
      .from('contatos')
      .select('*')
      .lt('ultima_interacao', limite.toISOString())
      .eq('ativo', true)
      .eq('remarketing_ativo', true);

    for (const c of contatos || []) {
      const msg = `Olá ${c.nome}! Sentimos sua falta 😊 Temos novidades especiais para você. Posso te contar mais?`;
      await enviarMensagem(c.telefone, msg);
      await supabase.from('contatos').update({ ultima_interacao: new Date().toISOString() }).eq('id', c.id);
      console.log(`[Remarketing] Enviado para ${c.nome}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (err) {
    console.error('[Remarketing] Erro:', err.message);
  }
}

module.exports = { enviarLembretesConsulta, reengajarInativos };

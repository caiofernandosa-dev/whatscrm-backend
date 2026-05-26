require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rate limit geral (proteção contra abuso)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { erro: 'Muitas requisições. Tente em breve.' }
}));

// Rotas
app.use('/api/contatos',    require('./routes/contatos'));
app.use('/api/campanhas',   require('./routes/campanhas'));
app.use('/api/agente',      require('./routes/agente'));
app.use('/api/agendamentos',require('./routes/agendamentos'));
app.use('/webhook',         require('./routes/webhook'));

// Health check (Railway usa isso para saber se o app está vivo)
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'WhatsCRM',
    versao: '1.0.0',
    hora: new Date().toISOString()
  });
});

// Erro genérico
app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`✅ WhatsCRM rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Agendamentos automáticos (remarketing, lembretes)
require('./services/agendador');

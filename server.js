require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// CORREÇÃO: trust proxy para Railway/Heroku/Vercel
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Rate limit com trust proxy ativado
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: { erro: 'Muitas requisições.' }
}));

// Rotas
app.use('/api/contatos',     require('./routes/contatos'));
app.use('/api/campanhas',    require('./routes/campanhas'));
app.use('/api/agente',       require('./routes/agente'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/webhook',          require('./routes/webhook'));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', app: 'WhatsCRM', versao: '1.0.0', hora: new Date().toISOString() });
});

// Erro genérico
app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(500).json({ erro: 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`✅ WhatsCRM rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

require('./services/agendador');

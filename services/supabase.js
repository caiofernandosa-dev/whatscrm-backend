const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: { persistSession: false },
    global: {
      fetch: (...args) => import('node-fetch').then(({default: f}) => f(...args))
    }
  }
);

module.exports = supabase;

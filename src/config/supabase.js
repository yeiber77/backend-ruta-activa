const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el archivo .env');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function createUserScopedClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = {
  supabaseUrl,
  supabaseAnonKey,
  supabase,
  supabaseAdmin,
  createUserScopedClient,
};

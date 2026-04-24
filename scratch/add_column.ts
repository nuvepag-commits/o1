
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function addColumn() {
  console.log('Tentando adicionar coluna verification_payload...');
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE rooms ADD COLUMN IF NOT EXISTS verification_payload text;'
  });
  
  if (error) {
    console.error('Erro ao adicionar coluna via RPC:', error);
    console.log('Tentando via consulta direta (pode falhar dependendo das permissões RLS)...');
  } else {
    console.log('Coluna adicionada com sucesso!');
  }
}

addColumn();

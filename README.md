# KryptoAnon - Mensagens Criptografadas Efêmeras

Sistema de chat anônimo com criptografia de ponta a ponta (AES-256-GCM) e backend em Supabase.

## Funcionalidades
- Identidade efêmera (RSA-2048) gerada localmente.
- Salas protegidas por senha e aprovação do dono.
- Criptografia de mensagens e imagens no navegador.
- Remoção automática de metadados de imagens (EXIF).
- Real-time com Supabase.

## Como Rodar Localmente

1. **Instalar dependências**:
   `npm install`

2. **Configurar o `.env`**:
   Crie um arquivo `.env` com sua URL e Key do Supabase:
   `VITE_SUPABASE_URL=sua_url`
   `VITE_SUPABASE_ANON_KEY=sua_key`

3. **Executar o SQL**:
   Rode o conteúdo de `supabase_schema.sql` no seu painel do Supabase.

4. **Iniciar**:
   `npm run dev`

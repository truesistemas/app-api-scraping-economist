require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔐 Verificando variáveis de ambiente...');
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) {
      console.error('❌ DATABASE_URL não encontrada no .env');
      process.exitCode = 1;
      return;
    }
    console.log(`✅ DATABASE_URL carregada (tamanho: ${dbUrl.length} chars)`);

    console.log('🌐 Testando conexão com o Supabase/Postgres via Prisma...');
    // SELECT simples para validar a conexão
    const result = await prisma.$queryRaw`SELECT 1 AS result`;

    console.log('✅ Conexão OK! Resultado da query:');
    console.log(result);

    console.log('\n🔍 Listando funções disponíveis no banco...');
    try {
      // Lista todas as funções que começam com 'insert' e 'post'
      const functions = await prisma.$queryRaw`
        SELECT 
          routine_name,
          routine_type,
          data_type as return_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND (routine_name LIKE '%insert%' AND routine_name LIKE '%post%')
        ORDER BY routine_name;
      `;
      console.log('📋 Funções encontradas:');
      console.log(JSON.stringify(functions, null, 2));
    } catch (e) {
      console.warn('⚠️ Não foi possível listar funções:', e.message);
    }

    console.log('\n🧪 Testando chamada da função insert_full_post_if_not_exists...');
    try {
      const testTitle = 'Nova Matéria Importante 2';
      const testUrl = 'https://link.com/nova';
      const testNews = 'Corpo da notícia.';

      const funcResult = await prisma.$queryRaw`
        SELECT * FROM insert_full_post_if_not_exists(${testTitle}, ${testUrl}, ${testNews})
      `;
      console.log('✅ Função executada com sucesso!');
      console.log('📊 Resultado:');
      console.log(JSON.stringify(funcResult, null, 2));
    } catch (e) {
      console.error('❌ Erro ao chamar insert_full_post_if_not_exists:');
      console.error('   Código:', e.code);
      console.error('   Mensagem:', e.message);
      console.error('   Detalhes:', e.meta || e);
      
      // Tenta com o nome alternativo
      console.log('\n🔄 Tentando com insert_post_if_not_exists...');
      try {
        const testTitle2 = 'Nova Matéria Importante 2';
        const testUrl2 = 'https://link.com/nova';
        const testNews2 = 'Corpo da notícia.';
        
        const funcResult2 = await prisma.$queryRaw`
          SELECT * FROM insert_post_if_not_exists(${testTitle2}, ${testUrl2}, ${testNews2})
        `;
        console.log('✅ Função insert_post_if_not_exists executada com sucesso!');
        console.log('📊 Resultado:');
        console.log(JSON.stringify(funcResult2, null, 2));
      } catch (e2) {
        console.error('❌ Também falhou com insert_post_if_not_exists:');
        console.error('   Código:', e2.code);
        console.error('   Mensagem:', e2.message);
      }
    }

  } catch (err) {
    console.error('❌ Erro ao testar conexão com o Supabase:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Prisma desconectado.');
  }
}

main();



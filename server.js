require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Valida variáveis de ambiente antes de importar o Prisma
function validateEnv() {
    const required = ['DATABASE_URL'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Variáveis de ambiente obrigatórias não encontradas:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\n💡 Configure as variáveis de ambiente na Railway:');
        console.error('   - DATABASE_URL');
        console.error('   - DIRECT_URL (opcional, mas recomendado)');
        return false;
    }
    return true;
}

// Valida antes de importar módulos que dependem do Prisma
if (!validateEnv()) {
    console.error('\n⚠️  Servidor iniciará, mas funcionalidades de banco não estarão disponíveis.');
}

const { extractLinksWithPuppeteer, saveToSupabase, prisma } = require('./puppeteer_scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Variável para controlar se há um scraping em andamento
let isScraping = false;

// Rota raiz - informações da API
app.get('/', (req, res) => {
    const hasDatabase = !!process.env.DATABASE_URL;
    
    res.json({
        name: 'Economist Scraper API',
        version: '1.0.0',
        description: 'API para scraping de artigos do The Economist sobre Inteligência Artificial',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            databaseConfigured: hasDatabase,
            port: PORT
        },
        endpoints: {
            health: '/health',
            envCheck: '/api/env-check',
            scrape: {
                method: 'POST',
                path: '/api/scrape',
                description: 'Executar scraping e retornar resultado'
            },
            posts: {
                method: 'GET',
                path: '/api/posts',
                description: 'Listar posts do banco de dados',
                requiresDatabase: true
            },
            postByUrl: {
                method: 'GET',
                path: '/api/posts/:url',
                description: 'Buscar post específico por URL',
                requiresDatabase: true
            },
            unpostedPost: {
                method: 'GET',
                path: '/api/posts/unposted/single',
                description: 'Obter um único post não publicado',
                requiresDatabase: true
            }
        },
        documentation: 'Veja o README.md para mais informações'
    });
});

// Endpoint para verificar variáveis de ambiente
app.get('/api/env-check', (req, res) => {
    const env = {
        DATABASE_URL: process.env.DATABASE_URL ? '✅ Configurada' : '❌ Não configurada',
        DIRECT_URL: process.env.DIRECT_URL ? '✅ Configurada' : '⚠️  Opcional (não configurada)',
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '3000 (padrão)'
    };
    
    const allConfigured = !!process.env.DATABASE_URL;
    
    res.json({
        success: allConfigured,
        message: allConfigured 
            ? 'Todas as variáveis obrigatórias estão configuradas' 
            : 'Algumas variáveis obrigatórias estão faltando',
        environment: env,
        timestamp: new Date().toISOString()
    });
});

// Endpoint de health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        isScraping 
    });
});

// Endpoint principal: faz o scraping e retorna o resultado quando terminar
app.post('/api/scrape', async (req, res) => {
    if (isScraping) {
        return res.status(409).json({ 
            error: 'Scraping já está em andamento',
            message: 'Aguarde a conclusão do scraping atual antes de iniciar um novo'
        });
    }

    const { saveToDb = true } = req.body;

    isScraping = true;
    const startTime = Date.now();

    try {
        console.log('🚀 Iniciando scraping via API...');
        
        // Executa o scraping
        const data = await extractLinksWithPuppeteer();
        
        const result = {
            success: true,
            articles: data,
            count: data.length,
            timestamp: new Date().toISOString(),
            duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
        };

        // Salva no banco se solicitado
        if (saveToDb) {
            try {
                console.log('💾 Salvando no Supabase...');
                const saveResults = await saveToSupabase(data);
                result.saved = saveResults;
                result.savedCount = saveResults.filter(r => r.success).length;
                result.failedCount = saveResults.filter(r => !r.success).length;
                console.log(`✅ Salvos: ${result.savedCount}, Falhas: ${result.failedCount}`);
            } catch (saveError) {
                console.error('❌ Erro ao salvar no banco:', saveError);
                result.saveError = saveError.message;
                result.saved = [];
                result.savedCount = 0;
                result.failedCount = 0;
            }
        } else {
            result.saved = [];
            result.savedCount = 0;
            result.failedCount = 0;
        }

        console.log('✅ Scraping concluído via API');
        res.json(result);

    } catch (error) {
        console.error('❌ Erro durante o scraping:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Erro ao executar o scraping',
            timestamp: new Date().toISOString(),
            duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
        });
    } finally {
        isScraping = false;
    }
});

// Endpoint para listar posts do banco (opcional - você pode ajustar conforme sua tabela)
app.get('/api/posts', async (req, res) => {
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({
            error: 'Variável de ambiente não configurada',
            message: 'DATABASE_URL não está configurada. Configure na Railway: Settings > Variables'
        });
    }

    try {
        const { limit = 50, offset = 0 } = req.query;
        
        // Ajuste esta query conforme sua estrutura de tabela
        const posts = await prisma.$queryRaw`
            SELECT * FROM posts 
            ORDER BY created_at DESC 
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `.catch(() => {
            // Se a tabela não existir ou tiver outro nome, retorna vazio
            return [];
        });

        res.json({
            posts,
            count: posts.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('❌ Erro ao buscar posts:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar posts',
            message: error.message 
        });
    }
});

// Endpoint para obter um post específico por URL
app.get('/api/posts/:url', async (req, res) => {
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({
            error: 'Variável de ambiente não configurada',
            message: 'DATABASE_URL não está configurada. Configure na Railway: Settings > Variables'
        });
    }

    try {
        const encodedUrl = req.params.url;
        const url = decodeURIComponent(encodedUrl);
        
        // Ajuste esta query conforme sua estrutura de tabela
        const posts = await prisma.$queryRaw`
            SELECT * FROM posts WHERE url = ${url} LIMIT 1
        `.catch(() => []);

        if (posts.length === 0) {
            return res.status(404).json({ 
                error: 'Post não encontrado',
                url 
            });
        }

        res.json(posts[0]);
    } catch (error) {
        console.error('❌ Erro ao buscar post:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar post',
            message: error.message 
        });
    }
});

// Endpoint para obter um único post não publicado
app.get('/api/posts/unposted/single', async (req, res) => {
    // Verifica se DATABASE_URL está configurada
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({
            success: false,
            error: 'Variável de ambiente não configurada',
            message: 'DATABASE_URL não está configurada. Configure na Railway: Settings > Variables',
            help: 'Adicione a variável DATABASE_URL com a URL de conexão do Supabase',
            timestamp: new Date().toISOString()
        });
    }

    try {
        console.log('🔍 Buscando post não publicado...');
        
        const result = await prisma.$queryRaw`
            SELECT * FROM get_single_unposted_post()
        `;

        if (!result || result.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Nenhum post não publicado encontrado',
                data: null,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            message: 'Post não publicado encontrado',
            data: result[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao buscar post não publicado:', error);
        
        // Mensagem de erro mais clara
        let errorMessage = error.message;
        if (error.message.includes('DATABASE_URL')) {
            errorMessage = 'DATABASE_URL não está configurada. Configure na Railway: Settings > Variables';
        } else if (error.message.includes('Environment variable not found')) {
            errorMessage = 'Variável de ambiente não encontrada. Verifique se DATABASE_URL está configurada na Railway.';
        }
        
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar post não publicado',
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: err.message 
    });
});

// Inicia o servidor
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔗 API endpoints:`);
    console.log(`   GET    / - Informações da API`);
    console.log(`   GET    /health - Health check`);
    console.log(`   POST   /api/scrape - Executar scraping e retornar resultado`);
    console.log(`   GET    /api/posts - Listar posts`);
    console.log(`   GET    /api/posts/:url - Buscar post por URL`);
    console.log(`   GET    /api/posts/unposted/single - Obter um único post não publicado`);
});

// Tratamento de erros na inicialização do servidor
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${PORT} já está em uso`);
    } else {
        console.error('❌ Erro ao iniciar servidor:', error);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM recebido, encerrando servidor...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT recebido, encerrando servidor...');
    await prisma.$disconnect();
    process.exit(0);
});


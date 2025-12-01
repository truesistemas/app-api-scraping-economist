require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { extractLinksWithPuppeteer, saveToSupabase, prisma } = require('./puppeteer_scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Variável para controlar se há um scraping em andamento
let isScraping = false;

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
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar post não publicado',
            message: error.message,
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔗 API endpoints:`);
    console.log(`   POST   /api/scrape - Executar scraping e retornar resultado`);
    console.log(`   GET    /api/posts - Listar posts`);
    console.log(`   GET    /api/posts/:url - Buscar post por URL`);
    console.log(`   GET    /api/posts/unposted/single - Obter um único post não publicado`);
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


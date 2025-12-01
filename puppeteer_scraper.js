
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const url = 'https://www.economist.com/topics/artificial-intelligence';
// Seletor da classe mãe: a classe que engloba o bloco de conteúdo.
const PARENT_CLASS_SELECTOR = '.css-etc195.e1ah2rwk0';
// Seletor da classe dos links: a classe específica do elemento <a>.
const LINK_CLASS_SELECTOR = '.link_mb-teaser__link__mGD37';
const BASE_URL = 'https://www.economist.com';
const NEWS_CLASS_SELECTOR = 'p[data-component="paragraph"]';
const PRIMARY_PARAGRAPH_SELECTOR = 'p[data-component="paragraph"].css-1l5amll.e1y9q0ei0';

async function extractLinksWithPuppeteer() {
    let browser;
    try {
        console.log('🚀 Iniciando o navegador Puppeteer...');
        // Inicia o navegador Chromium
        // Configurações para produção (containers/servidores)
        const isProduction = process.env.NODE_ENV === 'production';
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Ajuda em ambientes com pouca memória
                '--disable-gpu'
            ],
            ...(isProduction && {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
            })
        });
        
        const page = await browser.newPage();
        
        // Define um User-Agent para garantir que a requisição pareça legítima
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36');
        await page.setRequestInterception(true);
        const requestHandler = req => {
            const type = req.resourceType();
            if (type === 'image' || type === 'stylesheet' || type === 'font' || type === 'media') {
                req.abort();
            } else {
                req.continue();
            }
        };
        page.on('request', requestHandler);
        
        console.log(`🌐 Navegando para a URL: ${url}`);
        
        // Navega para a página e espera que o carregamento da rede termine
        await page.goto(url, { waitUntil: 'networkidle2' });

        console.log('✅ Página carregada. Extraindo links...');

        await page.waitForSelector(LINK_CLASS_SELECTOR, { timeout: 10000 });

        // Executa a lógica de extração DENTRO do contexto do navegador (DOM)
        const extractedData = await page.evaluate((parentSelector, linkSelector, baseUrl) => {
            const data = [];
            
            // Seleciona todos os blocos pais
            const parentElements = document.querySelectorAll(parentSelector);

            parentElements.forEach(parentElement => {
                // Dentro de cada bloco pai, seleciona todos os links
                const linkElements = parentElement.querySelectorAll(linkSelector);
                
                linkElements.forEach(linkElement => {
                    const relativeLink = linkElement.getAttribute('href');
                    const title = linkElement.textContent.trim();
                    
                    if (relativeLink) {
                        // Constrói o URL completo
                        const fullUrl = relativeLink.startsWith('/') ? `${baseUrl}${relativeLink}` : relativeLink;

                        data.push({
                            title: title,
                            url: fullUrl
                        });
                    }
                });
            });

            return data;
        }, PARENT_CLASS_SELECTOR, LINK_CLASS_SELECTOR, BASE_URL); // Passa as variáveis para o contexto do navegador
        
        console.log(`🔎 ${extractedData.length} links encontrados. Abrindo cada artigo...`);

        const results = [];
        for (const item of extractedData) {
            try {
                console.log(`➡️ Abrindo artigo: ${item.url}`);
                page.off('request', requestHandler);
                await page.setRequestInterception(false);
                await page.goto(item.url, { waitUntil: 'networkidle2' });
                console.log(`🔗 URL final: ${page.url()}`);
                const htmlLen = (await page.content()).length;
                console.log(`📦 HTML size: ${htmlLen}`);
                try { await page.waitForSelector(NEWS_CLASS_SELECTOR, { timeout: 12000 }); } catch {}
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const acceptBtn = btns.find(b => /accept|agree|ok/i.test((b.textContent || '').trim()));
                    if (acceptBtn) { try { acceptBtn.click(); } catch {} }
                });
                const dbg = await page.evaluate(() => {
                    const article = document.querySelector('article');
                    const main = document.querySelector('main');
                    return {
                        hasArticle: !!article,
                        articlePCount: article ? article.querySelectorAll('p').length : 0,
                        hasMain: !!main,
                        mainPCount: main ? main.querySelectorAll('p').length : 0,
                    };
                });
                console.log(`📄 Debug artigo: hasArticle=${dbg.hasArticle} articleP=${dbg.articlePCount} hasMain=${dbg.hasMain} mainP=${dbg.mainPCount}`);
                let news = '';
                const paraCount = await page.$$eval(NEWS_CLASS_SELECTOR, els => els.length).catch(() => 0);
                console.log(`🧩 Parágrafos encontrados: ${paraCount}`);
                if (paraCount > 0) {
                    news = await page.$$eval(NEWS_CLASS_SELECTOR, els => {
                        const clean = (html) => {
                            let t = html.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
                                        .replace(/<small[^>]*>(.*?)<\/small>/gi, '$1');
                            const tmp = document.createElement('div');
                            tmp.innerHTML = t;
                            const text = tmp.textContent || tmp.innerText || '';
                            return text.replace(/\s+/g, ' ').trim();
                        };
                        return els.map(el => clean(el.innerHTML)).filter(Boolean).join('\n');
                    });
                }
                if (!news) {
                    news = await page.evaluate((primarySel) => {
                        const clean = (html) => {
                            let t = html.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
                                        .replace(/<small[^>]*>(.*?)<\/small>/gi, '$1');
                            const tmp = document.createElement('div');
                            tmp.innerHTML = t;
                            const text = tmp.textContent || tmp.innerText || '';
                            return text.replace(/\s+/g, ' ').trim();
                        };
                        const primary = document.querySelector(primarySel);
                        if (primary) return clean(primary.innerHTML);
                        const alt = document.querySelector('article') || document.querySelector('main');
                        const ps = alt ? Array.from(alt.querySelectorAll('p[data-component="paragraph"], p')) : [];
                        if (ps.length) return ps.map(p => clean(p.innerHTML)).filter(Boolean).join('\n');
                        return '';
                    }, PRIMARY_PARAGRAPH_SELECTOR);
                }
                if (!news) {
                    news = await page.evaluate(() => {
                        const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const node of nodes) {
                            try {
                                const obj = JSON.parse(node.textContent || '{}');
                                const cand = obj.articleBody || (obj.mainEntity && obj.mainEntity.articleBody) || '';
                                if (cand) return String(cand);
                            } catch {}
                        }
                        return '';
                    });
                }
                if (!news) {
                    const nextData = await page.evaluate(() => {
                        const s = document.getElementById('__NEXT_DATA__');
                        return s ? s.textContent : null;
                    });
                    if (nextData) {
                        try {
                            const obj = JSON.parse(nextData);
                            const collectStrings = (o) => {
                                const out = [];
                                const visit = (v) => {
                                    if (!v) return;
                                    if (typeof v === 'string') {
                                        const t = v.replace(/\s+/g, ' ').trim();
                                        if (t.length > 40) out.push(t);
                                        return;
                                    }
                                    if (Array.isArray(v)) v.forEach(visit);
                                    else if (typeof v === 'object') Object.values(v).forEach(visit);
                                };
                                visit(o);
                                return out;
                            };
                            const strings = collectStrings(obj);
                            if (strings.length) news = strings.slice(0, 80).join('\n');
                        } catch {}
                    }
                }
                if (!news) {
                    try {
                        const ampUrl = item.url.includes('?') ? `${item.url}&amp` : `${item.url}?amp`;
                        console.log(`🔁 Tentando AMP: ${ampUrl}`);
                        await page.goto(ampUrl, { waitUntil: 'networkidle2' });
                        try { await page.waitForSelector('article', { timeout: 8000 }); } catch {}
                        const countAmp = await page.$$eval('article p', els => els.length).catch(() => 0);
                        console.log(`🧩 AMP parágrafos: ${countAmp}`);
                        if (countAmp > 0) {
                            news = await page.$$eval('article p', els => els.map(el => (el.textContent || '').trim()).filter(Boolean).join('\n'));
                        }
                    } catch {}
                }
                results.push({ title: item.title, url: item.url, news });
            } catch (e) {
                console.warn(`⚠️ Falha ao extrair conteúdo de: ${item.url}`);
                results.push({ title: item.title, url: item.url, news: '' });
            }
        }

        // 4. Retorna a estrutura em JSON
        return results;

    } catch (error) {
        console.error('❌ Ocorreu um erro durante a extração:', error.message);
        return [];
    } finally {
        if (browser) {
            await browser.close();
            console.log('👋 Navegador fechado.');
        }
    }
}

// Função para salvar os dados no Supabase
async function saveToSupabase(data) {
    try {
        console.log('💾 Iniciando inserção no Supabase...');
        const results = [];
        for (const item of data) {
            const title = item.title || '';
            const url = item.url || '';
            const news = item.news || '';

            if (!title || !url) {
                console.warn('⏭️ Registro ignorado por falta de título ou URL:', { title, url });
                results.push({ success: false, url, error: 'Título ou URL faltando' });
                continue;
            }

            try {
                // Função confirmada no banco: insert_full_post_if_not_exists
                const res = await prisma.$queryRaw`
                    SELECT * FROM insert_full_post_if_not_exists(${title}, ${url}, ${news})
                `;
                const rows = Array.isArray(res) ? res.length : 0;
                console.log(`✅ Inserido/atualizado no Supabase: ${url} (linhas retornadas: ${rows})`);
                results.push({ success: true, url, rows });
            } catch (e) {
                console.error(`❌ Erro ao inserir ${url} no Supabase:`, e.message || e);
                results.push({ success: false, url, error: e.message });
            }
        }
        console.log('🏁 Inserção no Supabase finalizada.');
        return results;
    } catch (err) {
        console.error('❌ Erro geral na inserção no Supabase:', err.message || err);
        throw err;
    }
}

// Exporta as funções para uso na API
module.exports = {
    extractLinksWithPuppeteer,
    saveToSupabase,
    prisma
};



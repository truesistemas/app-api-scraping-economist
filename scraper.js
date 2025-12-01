const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.economist.com/topics/artificial-intelligence';
// Seletor da classe mãe: 'css-etc195 e1ah2rwk0' (corrigido para o formato de seletor CSS)
// Seletor da classe dos links: 'link_mb-teaser__link__mGD37' (corrigido para o formato de seletor CSS)
const PARENT_CLASS_SELECTOR = '.css-etc195.e1ah2rwk0';
const LINK_CLASS_SELECTOR = '.link_mb-teaser__link__mGD37';
const BASE_URL = 'https://www.economist.com';

async function extractLinks() {
    try {
        console.log(`Acessando a URL: ${url}`);
        
        // 1. Acessa o link e obtém o HTML
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        const extractedData = [];
        
        // 2. Localiza o elemento pai com a classe 'css-etc195 e1ah2rwk0'
        $(PARENT_CLASS_SELECTOR).each((i, parentElement) => {
            
            // 3. Dentro de cada elemento pai, localiza os links com a classe 'link_mb-teaser__link__mGD37'
            $(parentElement).find(LINK_CLASS_SELECTOR).each((j, linkElement) => {
                const relativeLink = $(linkElement).attr('href');
                const title = $(linkElement).text().trim();
                
                if (relativeLink) {
                    // Constrói o URL completo
                    const fullUrl = relativeLink.startsWith('/') ? `${BASE_URL}${relativeLink}` : relativeLink;

                    extractedData.push({
                        title: title,
                        url: fullUrl
                    });
                }
            });
        });

        // 4. Retorna a estrutura em JSON
        return extractedData;

    } catch (error) {
        console.error('Ocorreu um erro durante a extração:', error.message);
        return [];
    }
}

// Execução da função e formatação do output
extractLinks().then(data => {
    // Exibe o JSON formatado no console
    console.log('\n--- Resultado JSON ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('----------------------');
});

//
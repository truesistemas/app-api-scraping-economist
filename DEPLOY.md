# 🚀 Guia de Deploy na Railway

Este guia explica como fazer o deploy da aplicação Economist Scraper API na Railway.

## 📋 Pré-requisitos

1. Conta na [Railway](https://railway.app)
2. Projeto no Supabase configurado
3. Repositório Git (GitHub, GitLab, etc)

## 🔧 Configuração

### 1. Variáveis de Ambiente na Railway

Configure as seguintes variáveis de ambiente no painel da Railway:

```
DATABASE_URL=postgresql://postgres:SUA_SENHA@HOST:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:SUA_SENHA@HOST:5432/postgres?sslmode=require
NODE_ENV=production
```

**Nota:** A Railway define automaticamente a variável `PORT`, não é necessário configurá-la manualmente.

### 2. Deploy via GitHub/GitLab

1. **Conecte seu repositório:**
   - No painel da Railway, clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha o repositório do projeto

2. **Configure o serviço:**
   - A Railway detectará automaticamente que é um projeto Node.js
   - O arquivo `railway.json` será usado para configurações de build

3. **Adicione as variáveis de ambiente:**
   - Vá em "Variables" no painel do serviço
   - Adicione `DATABASE_URL` e `DIRECT_URL` do seu Supabase
   - Adicione `NODE_ENV=production`

4. **Deploy:**
   - A Railway fará o build automaticamente
   - O script `postinstall` gerará o Prisma Client
   - O servidor iniciará com `npm start`

### 3. Deploy via Railway CLI

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Inicializar projeto
railway init

# Adicionar variáveis de ambiente
railway variables set DATABASE_URL="postgresql://..."
railway variables set DIRECT_URL="postgresql://..."
railway variables set NODE_ENV=production

# Deploy
railway up
```

## 📦 Build Process

O build na Railway segue estes passos:

1. **Instalação de dependências:** `npm install`
2. **Geração do Prisma Client:** `npx prisma generate` (via `postinstall`)
3. **Início do servidor:** `npm start`

## 🔍 Verificação

Após o deploy, verifique:

1. **Health Check:**
   ```bash
   curl https://seu-projeto.railway.app/health
   ```

2. **Testar scraping:**
   ```bash
   curl -X POST https://seu-projeto.railway.app/api/scrape \
     -H "Content-Type: application/json" \
     -d '{"saveToDb": true}'
   ```

## ⚠️ Considerações Importantes

### Puppeteer na Railway

O Puppeteer requer dependências do sistema. A Railway com Nixpacks deve detectar automaticamente, mas se houver problemas:

1. Certifique-se de que o `package.json` tem todas as dependências
2. O Puppeteer pode precisar de configurações adicionais em produção

### Recursos Necessários

- **Memória:** Recomendado pelo menos 1GB (Puppeteer consome bastante memória)
- **CPU:** Recomendado pelo menos 1 vCPU
- **Timeout:** Scraping pode levar vários minutos, configure timeout adequado

### Logs

Monitore os logs na Railway:
```bash
railway logs
```

Ou no painel web da Railway em "Deployments" > "View Logs"

## 🐛 Troubleshooting

### Erro: "Prisma Client not generated"
- Verifique se o script `postinstall` está no `package.json`
- Verifique os logs do build

### Erro: "Cannot connect to database"
- Verifique se `DATABASE_URL` e `DIRECT_URL` estão corretos
- Verifique se o Supabase permite conexões externas
- Verifique se o SSL está configurado (`sslmode=require`)

### Erro: "Puppeteer launch failed"
- Verifique se há memória suficiente
- Puppeteer pode precisar de flags adicionais em produção

### Timeout no scraping
- Aumente o timeout do serviço na Railway
- O scraping pode levar vários minutos dependendo da quantidade de artigos

## 📝 Notas Adicionais

- A Railway fornece HTTPS automaticamente
- O domínio é gerado automaticamente (ou você pode usar um domínio customizado)
- A Railway escala automaticamente conforme o uso


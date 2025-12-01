# 🚂 Configuração de Variáveis na Railway

## ⚠️ Erro: "Environment variable not found: DATABASE_URL"

Se você está vendo este erro, significa que as variáveis de ambiente não estão configuradas na Railway.

## 🔧 Como Configurar

### 1. Acesse o Painel da Railway

1. Vá para [railway.app](https://railway.app)
2. Faça login e selecione seu projeto
3. Clique no serviço da aplicação

### 2. Adicione as Variáveis de Ambiente

1. Clique em **"Variables"** no menu lateral
2. Clique em **"+ New Variable"**
3. Adicione as seguintes variáveis:

#### Variáveis Obrigatórias:

```
DATABASE_URL=postgresql://postgres:SUA_SENHA@HOST:5432/postgres?sslmode=require
```

**Onde encontrar:**
- No Supabase: Settings > Database > Connection string > URI
- Use a senha do seu banco Supabase
- Substitua `HOST` pelo host do seu Supabase

#### Variáveis Opcionais (mas recomendadas):

```
DIRECT_URL=postgresql://postgres:SUA_SENHA@HOST:5432/postgres?sslmode=require
NODE_ENV=production
```

**Nota:** `DIRECT_URL` geralmente é a mesma que `DATABASE_URL`, mas sem passar pelo pooler.

### 3. Verifique a Configuração

Após adicionar as variáveis:

1. A Railway reiniciará automaticamente o serviço
2. Aguarde alguns segundos
3. Teste o endpoint de verificação:

```bash
curl https://seu-projeto.railway.app/api/env-check
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Todas as variáveis obrigatórias estão configuradas",
  "environment": {
    "DATABASE_URL": "✅ Configurada",
    "DIRECT_URL": "✅ Configurada",
    "NODE_ENV": "production",
    "PORT": "3000"
  }
}
```

## 📋 Checklist de Configuração

- [ ] `DATABASE_URL` configurada
- [ ] `DIRECT_URL` configurada (opcional)
- [ ] `NODE_ENV=production` configurada (opcional)
- [ ] Serviço reiniciado após adicionar variáveis
- [ ] Endpoint `/api/env-check` retorna `success: true`

## 🔍 Verificar Logs

Se ainda houver problemas, verifique os logs:

1. No painel da Railway, vá em **"Deployments"**
2. Clique no deployment mais recente
3. Veja os logs para identificar erros

Ou via CLI:
```bash
railway logs
```

## 💡 Dicas

- **Não commite o `.env`**: As variáveis devem estar apenas na Railway
- **Use valores reais**: Substitua `SUA_SENHA` e `HOST` pelos valores reais do Supabase
- **Reinicie após mudanças**: A Railway geralmente reinicia automaticamente, mas pode levar alguns segundos
- **Teste os endpoints**: Use `/api/env-check` para verificar se tudo está configurado

## 🆘 Ainda com Problemas?

1. Verifique se a URL do banco está correta
2. Verifique se a senha está correta
3. Verifique se o Supabase permite conexões externas
4. Verifique os logs da Railway para mais detalhes


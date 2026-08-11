# OdontoApp

SaaS de gestão odontológica com frontend Angular, API NestJS, PostgreSQL multi-tenant, Redis, MinIO e assinaturas Stripe.

## Ambientes

| Ambiente | Branch | URL | Diretório no servidor | Compose | Banco master |
|---|---|---|---|---|---|
| Produção | `main` | `https://odontoapp.morelidev.com` | `/opt/odonto-app` | `docker-compose.yml` | `master` |
| Desenvolvimento | `develop` | `https://odontoapp-dev.morelidev.com` | `/opt/odonto-app-dev` | `docker-compose.dev.yml` | `master_dev` |

Os ambientes têm containers, volumes, credenciais, bancos master, bancos de clínicas, Redis, MinIO e segredos JWT independentes. O deploy preserva o `.env` e as configurações próprias de cada servidor.

## Deploy contínuo

O workflow `.github/workflows/deploy.yml` executa tipagem e build antes do deploy:

- push em `main`: publica produção;
- push em `develop`: publica desenvolvimento.

São necessários os secrets de repositório `SSH_HOST`, `SSH_PORT`, `SSH_USER` e `SSH_PRIVATE_KEY`. Os demais segredos ficam apenas nos `.env` do servidor.

O script `scripts/deploy-environment.sh` valida o Compose, compila as imagens, sincroniza o schema master e cada banco de clínica, inicia os serviços e exige resposta positiva de `/api/health`.

## Execução local

1. Copie `.env.example` para `.env` e troque todos os valores de exemplo.
2. Execute `docker compose up -d --build`.
3. Acesse o frontend pela porta configurada em `APP_HTTP_PORT`.

## Verificações locais

```bash
cd backend
npm ci
npm run prisma:generate
npm run typecheck
npm run build

cd ../frontend
npm ci
npm run typecheck
npm run build
```

## Assinaturas

Produção exige chaves live e Price IDs mensais fixos para Essencial, Profissional e Clínica. Desenvolvimento aceita apenas chaves de teste. O plano gratuito interno é controlado por `ALLOW_FREE_SIGNUP` e deve permanecer desativado em produção.

## Confirmações por WhatsApp

Na agenda, a ação **Abrir mensagem no WhatsApp** prepara gratuitamente uma conversa com o paciente pelo link oficial `wa.me`. O WhatsApp Desktop ou Web abre com uma mensagem pronta contendo clínica, profissional, data, hora e o link público de confirmação.

O envio é manual: a pessoa usuária revisa a mensagem e clica em **Enviar** no próprio WhatsApp. Não há provedor pago, credenciais externas, remetente central nem disparo em massa. O paciente confirma ou informa que não poderá comparecer pelo link recebido, e a resposta aparece na agenda.

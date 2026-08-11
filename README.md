# OdontoApp

SaaS de gestão odontológica com frontend Angular, API NestJS, PostgreSQL multi-tenant, Redis, MinIO e assinaturas Stripe.

## Ambientes

| Ambiente | Branch | URL | Diretório no servidor | Compose | Banco master |
|---|---|---|---|---|---|
| Produção | `main` | `https://odontoapp.morelidev.com` | `/opt/odonto-app` | `docker-compose.yml` | `master` |
| Desenvolvimento | `develop` | `https://odontoapp-dev.morelidev.com` | `/opt/odonto-app-dev` | `docker-compose.dev.yml` | `master_dev` |

Os ambientes têm containers, volumes, credenciais, bancos master, bancos de clínicas, Redis, MinIO e segredos JWT independentes. O deploy preserva o `.env` de cada servidor. Somente as três chaves da Twilio, explicitamente permitidas em `scripts/update-managed-env.sh`, são sincronizadas a partir dos secrets do GitHub; todas as demais configurações continuam pertencendo exclusivamente ao servidor.

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

A plataforma envia confirmações pelo Twilio usando uma conta central e um remetente aprovado por clínica. Configure no `.env` do ambiente:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_CONTENT_SID=
```

As mesmas três chaves devem existir como GitHub Actions secrets. O workflow escolhe os secrets do environment `production` ou `development` quando houver valores específicos por ambiente e os sincroniza de forma restrita antes de cada deploy.

O template deve usar `{{1}}` para o nome do paciente, `{{2}}` para a data/hora e `{{3}}` para o link público de confirmação. Depois, o administrador de cada clínica cadastra o próprio remetente em **Meu perfil > WhatsApp da clínica**. O número é salvo em E.164 e precisa estar habilitado como WhatsApp Sender na mesma conta Twilio.

Sem `TWILIO_WHATSAPP_CONTENT_SID`, o backend tenta uma mensagem livre, adequada apenas ao sandbox ou a uma conversa dentro da janela permitida pelo WhatsApp. O paciente confirma ou recusa pelo link recebido, e a resposta aparece na agenda.

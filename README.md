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

## Emissão de NFS-e

O módulo **Notas fiscais** emite NFS-e a partir de uma cobrança, preservando o vínculo com paciente, consulta, valor e usuário responsável. A integração usa a Nuvem Fiscal e possui fluxos separados de homologação e produção, consulta de status, cancelamento, DANFSe (PDF), XML e trilha de eventos.

1. Crie credenciais de homologação e produção no provedor e configure no `.env` do backend:
   `NUVEM_FISCAL_SANDBOX_CLIENT_ID`, `NUVEM_FISCAL_SANDBOX_CLIENT_SECRET`,
   `NUVEM_FISCAL_PRODUCTION_CLIENT_ID` e `NUVEM_FISCAL_PRODUCTION_CLIENT_SECRET`.
2. No OdontoApp, entre como administrador em **Notas fiscais > Configurar emissão**.
3. Preencha os dados fiscais e códigos confirmados pela contabilidade e salve.
4. Sincronize a empresa e envie o certificado A1 `.pfx`/`.p12`. O arquivo e a senha são enviados diretamente ao provedor e não são persistidos pelo OdontoApp.
5. Valide emissões em homologação antes de selecionar produção e ativar a emissão fiscal.

As permissões `FISCAL_VIEW`, `FISCAL_MANAGE` e `FISCAL_CONFIGURE` podem ser concedidas por perfil ou pessoa na Gestão de acessos. O administrador sempre mantém acesso completo.

## Confirmações por WhatsApp

Na agenda, a ação **Abrir mensagem no WhatsApp** prepara gratuitamente uma conversa com o paciente pelo link oficial `wa.me`. O WhatsApp Desktop ou Web abre com uma mensagem pronta contendo clínica, profissional, data, hora e o link público de confirmação.

O envio é manual: a pessoa usuária revisa a mensagem e clica em **Enviar** no próprio WhatsApp. Não há provedor pago, credenciais externas, remetente central nem disparo em massa. O paciente confirma ou informa que não poderá comparecer pelo link recebido, e a resposta aparece na agenda.

O link da mensagem passa por uma página pública de compartilhamento que fornece ao WhatsApp uma prévia específica da clínica: nome, descrição de confirmação e logo cadastrada. Quando não há logo, o backend gera um monograma com as iniciais e a cor da clínica. Ao abrir o link, o paciente é encaminhado automaticamente à tela de confirmação.

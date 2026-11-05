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

O catálogo público informa disponibilidade mensal/anual e duração do teste. O ciclo anual só é oferecido quando os três `STRIPE_PRICE_*_YEARLY` estiverem configurados. `STRIPE_PORTAL_CONFIGURATION` permite isolar o portal OdontoApp de outros produtos da mesma conta Stripe. O webhook precisa receber checkout concluído/expirado, pagamentos aprovados/recusados e mudanças/cancelamentos de assinatura. A reconciliação periódica consulta a Stripe a cada cinco minutos para recuperar eventos perdidos, sem criar cobranças.

Cadastros repetidos são serializados no PostgreSQL; a conclusão pelo retorno do navegador e pelo webhook compartilha o mesmo bloqueio. O provisionamento usa o endereço único da clínica, permite nomes comerciais repetidos e recupera uma interrupção sem criar outro banco. A rota legada `/api/public/signup`, que contornava o checkout, retorna 410.

## Assistente da clínica

Disponível em **Assistente**, com as mesmas permissões dos módulos correspondentes:

- Foto de agenda: leitura JPG/PNG/WebP (até 8 MB), revisão de nomes, pacientes, profissional, início e fim; importação transacional com detecção de conflitos e proteção contra dupla confirmação.
- Ditado clínico: gravação de até dois minutos ou envio de áudio de até 20 MB; transcrição e rascunho editável; o registro só é salvo após confirmar autoria/revisão. Não emite assinatura digital ICP-Brasil.
- Orçamentos: propostas separadas de cobranças, acompanhamento dos planos propostos no prontuário e mensagens editáveis. O envio é manual pelo WhatsApp; abrir o link não é registrado como mensagem enviada.
- Retornos: prazos configuráveis por paciente, data explícita ou intervalo desde a última consulta concluída. Exclui quem já tem consulta futura. Intervalo 0 desativa o acompanhamento. O intervalo padrão de seis meses é uma sugestão administrativa a revisar, não uma indicação clínica.
- Resumo semanal: indicadores calculados pelo banco, faltas explicitamente registradas na agenda, cancelamentos, orçamentos e saldo líquido a receber. O administrador pode ativar a geração recorrente por IA a cada nova semana, em Brasília, com recuperação após reinício. O resumo fica dentro do sistema e não dispara mensagens.

Configure `AI_PROVIDER=groq` e `GROQ_API_KEY` somente no backend. Padrões: texto `openai/gpt-oss-120b`, imagem `qwen/qwen3.8-27b`, áudio `whisper-large-v3-turbo`. Os modelos podem ser substituídos por `AI_TEXT_MODEL`, `AI_VISION_MODEL` e `AI_AUDIO_MODEL`; valide a disponibilidade na conta antes de publicar. O modelo de visão está sujeito ao ciclo de vida do provedor. A Groq oferece cotas gratuitas, sem garantia de disponibilidade contínua; erros de quota são apresentados ao usuário e nunca acionam um provedor pago automaticamente.

OpenAI é alternativa opcional com `AI_PROVIDER=openai` e `OPENAI_API_KEY`, com cobrança própria do provedor. Fotos e áudio são processados em memória, sem persistência desses arquivos. Os rascunhos ficam no banco isolado da clínica. Para mensagens e sugestões semanais, a IA recebe apenas contexto administrativo e métricas agregadas; nomes e telefones não são necessários nessas chamadas. A tela informa o provedor antes da geração; confira os controles de retenção e as condições do serviço contratado. Nenhum recurso deve ser tratado como diagnóstico automático.

### Testes

`cd backend && npm test` cobre bloqueio de checkout não pago, preços divergentes, duração do teste, configuração de ciclo anual, datas, respostas inválidas da IA e quota gratuita. `npm run test:integration` exige `TEST_TENANT_DATABASE_URL` apontando para um banco isolado chamado `tenant_qa`; verifica revisão, rollback, conflitos, autoria, acesso por paciente, mensagens, retornos e cálculo financeiro. Não utilize um banco de clínica real.

## Emissão de NFS-e

O módulo **Notas fiscais** emite NFS-e oficial a partir de uma cobrança, preservando o vínculo com paciente, consulta, valor e usuário responsável. A integração usa a Nuvem Fiscal exclusivamente em produção, com consulta de status, cancelamento, DANFSe (PDF), XML e trilha de eventos.

1. Crie as credenciais de produção no provedor e configure `NUVEM_FISCAL_PRODUCTION_CLIENT_ID` e `NUVEM_FISCAL_PRODUCTION_CLIENT_SECRET` no `.env` do backend.
2. No OdontoApp, entre como administrador em **Notas fiscais > Configurar emissão**.
3. Preencha os dados fiscais e códigos confirmados pela contabilidade e salve.
4. Sincronize a empresa e envie o certificado A1 `.pfx`/`.p12`. O arquivo e a senha são enviados diretamente ao provedor e não são persistidos pelo OdontoApp.
5. Revise os dados fiscais, códigos e alíquotas com a contabilidade antes de ativar a emissão oficial.

As permissões `FISCAL_VIEW`, `FISCAL_MANAGE` e `FISCAL_CONFIGURE` podem ser concedidas por perfil ou pessoa na Gestão de acessos. O administrador sempre mantém acesso completo.

## Confirmações por WhatsApp

Na agenda, a ação **Abrir mensagem no WhatsApp** prepara gratuitamente uma conversa com o paciente pelo link oficial `wa.me`. O WhatsApp Desktop ou Web abre com uma mensagem pronta contendo clínica, profissional, data, hora e o link público de confirmação.

O envio é manual: a pessoa usuária revisa a mensagem e clica em **Enviar** no próprio WhatsApp. Não há provedor pago, credenciais externas, remetente central nem disparo em massa. O paciente confirma ou informa que não poderá comparecer pelo link recebido, e a resposta aparece na agenda.

O link da mensagem passa por uma página pública de compartilhamento que fornece ao WhatsApp uma prévia específica da clínica: nome, descrição de confirmação e logo cadastrada. Quando não há logo, o backend gera um monograma com as iniciais e a cor da clínica. Ao abrir o link, o paciente é encaminhado automaticamente à tela de confirmação.

#!/usr/bin/env bash
# Painel de acessos privado (https://odontoapp.morelidev.com/painel/).
#
# Idempotente: roda a cada publicação, chamado por scripts/deploy-environment.sh
# antes de subir o container do frontend (que monta os diretórios criados aqui).
#
# - O beacon /e (frontend/src/app/services/analytics.service.ts) é gravado pelo
#   nginx do container em data/analytics/analytics.log; nada passa pelo backend
#   e nada entra no banco das clínicas.
# - <instância>-stats recalcula data/painel/www/stats.json a cada 5 minutos (cron).
# - /painel/ é servido pelo mesmo nginx, com senha (HTTP basic auth).
# - A cidade aproximada vem da base DB-IP Lite (CC BY 4.0), a mesma dos painéis
#   do Corujitos e do MoreliDev quando já existe no servidor.
#
# Nada aqui pode derrubar o deploy: quem chama trata a falha como aviso.
set -Eeuo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
# Produção e desenvolvimento vivem em pastas diferentes no mesmo servidor, então
# cada uma precisa do seu script, do seu cron e do seu estado.
instance="$(basename "$root")"

www_dir="$root/data/painel/www"
auth_dir="$root/data/painel/auth"
log_dir="$root/data/analytics"
state_dir="/var/lib/${instance}-stats"
credentials="/root/${instance}-painel-acesso.txt"

command -v python3 >/dev/null || { echo "python3 ausente; painel não instalado." >&2; exit 1; }

install -d -m 0755 "$www_dir" "$log_dir"
install -d -m 0755 "$auth_dir"
install -m 0644 "$here/index.html" "$www_dir/index.html"

is_root() { [[ "$(id -u)" == "0" ]]; }

# Acesso: o usuário é criado só na primeira vez. A senha fica apenas no servidor
# (arquivo do root, permissão 600) e nunca aparece nos logs do deploy.
#
# Só cria o htpasswd quando dá para guardar a senha em claro. Sem root, gerar o
# hash deixaria o painel trancado com uma senha que ninguém conhece — e, como o
# htpasswd passaria a existir, nenhuma publicação futura tentaria de novo. Sem
# arquivo, /painel/ responde 500 (ninguém entra) até a próxima publicação com root.
#
# Para trocar a senha: apague o htpasswd e publique de novo.
#   rm /opt/odonto-app/data/painel/auth/htpasswd
if [[ ! -s "$auth_dir/htpasswd" ]]; then
  if is_root; then
    password="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
    printf 'odontoapp:%s\n' "$(openssl passwd -apr1 "$password")" > "$auth_dir/htpasswd"
    # O nginx roda dentro do container com outro uid, então o hash precisa ser
    # legível por todos; o texto da senha fica só no arquivo do root abaixo.
    chmod 0644 "$auth_dir/htpasswd"
    (umask 077; printf 'Painel: https://odontoapp.morelidev.com/painel/\nUsuário: odontoapp\nSenha: %s\n' "$password" > "$credentials")
    echo "Acesso ao painel criado. Credenciais em $credentials (somente no servidor)."
  else
    echo "Aviso: sem root não há onde guardar a senha; o acesso ao painel não foi criado." >&2
  fi
fi

if ! is_root; then
  echo "Aviso: sem root, o cron e a rotação de log do painel não foram instalados." >&2
  exit 0
fi

if ! python3 -c 'import maxminddb' 2>/dev/null; then
  apt-get install -y -qq python3-maxminddb >/dev/null 2>&1 \
    || echo 'Aviso: python3-maxminddb indisponível; o painel funciona, sem a cidade.' >&2
fi

install -d -m 0750 "$state_dir"
install -m 0755 "$here/odonto-stats.py" "/usr/local/bin/${instance}-stats"
install -m 0755 "$here/geoip-update.sh" "/usr/local/bin/${instance}-geoip-update"

if [[ ! -f "$state_dir/dbip-city-lite.mmdb" ]]; then
  "/usr/local/bin/${instance}-geoip-update" \
    || echo 'Aviso: base de geolocalização não baixada; tenta de novo no próximo mês.' >&2
fi

# Logs rotacionados por semana e guardados por pouco mais de um ano, para o
# período "12 meses" do painel. copytruncate porque quem escreve é o nginx de
# dentro do container: não há como mandar o sinal de reabertura a partir daqui.
cat > "/etc/logrotate.d/${instance}-analytics" <<EOF
${log_dir}/*.log {
  weekly
  rotate 60
  missingok
  notifempty
  compress
  delaycompress
  copytruncate
}
EOF
chmod 0644 "/etc/logrotate.d/${instance}-analytics"

cat > "/etc/cron.d/${instance}-stats" <<EOF
OA_ROOT=${root}
*/5 * * * * root OA_STATE_DIR=${state_dir} /usr/local/bin/${instance}-stats >/dev/null 2>&1
23 4 3 * * root /usr/local/bin/${instance}-geoip-update >/dev/null 2>&1
EOF
chmod 0644 "/etc/cron.d/${instance}-stats"

OA_ROOT="$root" OA_STATE_DIR="$state_dir" "/usr/local/bin/${instance}-stats" \
  || echo 'Aviso: stats.json não gerado agora; o cron tenta em 5 minutos.' >&2
echo 'Painel de acessos instalado.'

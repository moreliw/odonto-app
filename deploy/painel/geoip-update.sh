#!/bin/sh
# Baixa as bases gratuitas DB-IP Lite (CC BY 4.0) usadas pelo odonto-stats:
#
#   city -> cidade aproximada do visitante
#   asn  -> provedor dono do IP, que é como separamos gente de infraestrutura
#           (rastreadores da Meta, nuvens, scanners). Sem ela o painel conta
#           data center da Meta como se fosse visitante em Oregon ou no Texas.
#
# A base de cidade é compartilhada com os painéis do Corujitos e do MoreliDev
# quando já existe no servidor; a de ASN é sempre nossa.
set -eu
DIR=/var/lib/odonto-stats
mkdir -p "$DIR"

download() {
  kind="$1"
  target="$2"
  for month in "$(date +%Y-%m)" "$(date -d '-1 month' +%Y-%m)"; do
    if curl -fsSL "https://download.db-ip.com/free/dbip-$kind-lite-$month.mmdb.gz" -o "$DIR/tmp-$kind.mmdb.gz"; then
      gunzip -f "$DIR/tmp-$kind.mmdb.gz"
      mv "$DIR/tmp-$kind.mmdb" "$target"
      return 0
    fi
  done
  return 1
}

status=0

if [ -f /var/lib/corujitos-stats/dbip-city-lite.mmdb ] || [ -f /var/lib/morelidev-stats/dbip-city-lite.mmdb ]; then
  : # já existe uma cópia compartilhada no servidor
elif ! download city "$DIR/dbip-city-lite.mmdb"; then
  echo "não foi possível baixar a base de cidades DB-IP" >&2
  status=1
fi

if ! download asn "$DIR/dbip-asn-lite.mmdb"; then
  echo "não foi possível baixar a base de ASN DB-IP" >&2
  status=1
fi

exit "$status"

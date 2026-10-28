#!/bin/sh
# Baixa a base gratuita DB-IP "IP to City Lite" (CC BY 4.0) usada pelo
# odonto-stats para a cidade aproximada. Se o painel do Corujitos ou do
# MoreliDev já mantém uma cópia neste servidor, ela é reaproveitada e nada
# é baixado.
set -eu
DIR=/var/lib/odonto-stats
[ -f /var/lib/corujitos-stats/dbip-city-lite.mmdb ] && exit 0
[ -f /var/lib/morelidev-stats/dbip-city-lite.mmdb ] && exit 0
mkdir -p "$DIR"
for month in "$(date +%Y-%m)" "$(date -d '-1 month' +%Y-%m)"; do
  if curl -fsSL "https://download.db-ip.com/free/dbip-city-lite-$month.mmdb.gz" -o "$DIR/geo.mmdb.gz"; then
    gunzip -f "$DIR/geo.mmdb.gz"
    mv "$DIR/geo.mmdb" "$DIR/dbip-city-lite.mmdb"
    exit 0
  fi
done
echo "não foi possível baixar a base DB-IP" >&2
exit 1

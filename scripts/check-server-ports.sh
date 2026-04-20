#!/usr/bin/env bash
# Uso no servidor (Linux): bash scripts/check-server-ports.sh
# Ou: curl -sSL ... | bash  (depois de revisar o conteúdo)
set -u

PORTS=(22 80 443 3000 5432 6379 8080 8085 9000 9001 19000 19001)

echo "========== Odonto deploy — checagem de portas =========="
echo "Data: $(date -u 2>/dev/null || date)"
echo

if command -v ss >/dev/null 2>&1; then
  echo "=== Escuta TCP (ss -tlnp) — trechos das portas alvo ==="
  for p in "${PORTS[@]}"; do
    lines="$(ss -tlnp 2>/dev/null | grep -E ":${p}\b" || true)"
    if [[ -n "${lines}" ]]; then
      echo "--- :${p} OCUPADA ---"
      echo "${lines}"
    else
      echo ":${p} parece LIVRE (nada em ss -tlnp para esta porta)"
    fi
  done
else
  echo "Comando 'ss' não encontrado. Instale iproute2 ou use netstat."
fi

echo
if command -v netstat >/dev/null 2>&1; then
  echo "=== netstat -tlnp (resumo) ==="
  netstat -tlnp 2>/dev/null | head -n 40
  echo
fi

if command -v docker >/dev/null 2>&1; then
  echo "=== Docker — containers e portas publicadas ==="
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
  echo
  echo "=== Docker — quem usa 9000/9001/80 (grep em docker ps) ==="
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ':(9000|9001|80)->' || echo "(nenhuma linha com essas portas)"
else
  echo "Docker não encontrado no PATH."
fi

echo
echo "=== Dica (odonto-app / docker-compose) ==="
echo "1) MinIO: se :9000 ou :9001 estiverem com OUTRO container (ex.: leg_minio), no .env:"
echo "     MINIO_API_PORT=19000"
echo "     MINIO_CONSOLE_PORT=19001"
echo "     S3_ENDPOINT=http://SEU_IP_OU_DOMINIO:19000"
echo "2) Frontend: se :80 for nginx do sistema, NÃO use 80 para o app-frontend. No .env:"
echo "     APP_HTTP_PORT=8085"
echo "   (ou coloque um server nginx que faça proxy para essa porta.)"
echo "3) Subir de novo: cd /opt/odonto-app && docker compose down && docker compose up -d --build"

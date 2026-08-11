#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ! -f .env ]]; then
  echo "Server-owned .env is missing in $(pwd)" >&2
  exit 1
fi

declare -A managed_values=()
while IFS= read -r encoded_line; do
  key="${encoded_line%%=*}"
  encoded_value="${encoded_line#*=}"
  case "${key}" in
    TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_WHATSAPP_CONTENT_SID)
      managed_values["${key}"]="$(printf '%s' "${encoded_value}" | base64 --decode)"
      ;;
    '') ;;
    *)
      echo "Refusing unmanaged environment key: ${key}" >&2
      exit 1
      ;;
  esac
done

for required_key in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_CONTENT_SID; do
  if [[ -z "${managed_values[${required_key}]:-}" ]]; then
    echo "Missing managed environment key: ${required_key}" >&2
    exit 1
  fi
done

tmp_env="$(mktemp .env.managed.XXXXXX)"
trap 'rm -f "${tmp_env}"' EXIT

while IFS= read -r line || [[ -n "${line}" ]]; do
  key="${line%%=*}"
  if [[ -v "managed_values[${key}]" ]]; then
    printf '%s=%s\n' "${key}" "${managed_values[${key}]}" >> "${tmp_env}"
    unset 'managed_values['"${key}"']'
  else
    printf '%s\n' "${line}" >> "${tmp_env}"
  fi
done < .env

for key in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_CONTENT_SID; do
  if [[ -v "managed_values[${key}]" ]]; then
    printf '%s=%s\n' "${key}" "${managed_values[${key}]}" >> "${tmp_env}"
  fi
done

chmod 600 "${tmp_env}"
mv "${tmp_env}" .env
trap - EXIT

echo "Managed Twilio environment keys synchronized."

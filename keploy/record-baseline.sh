#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_URL="${KEPLOY_PROXY_URL:-http://127.0.0.1:3100}"
OUT_DIR="${ROOT_DIR}/data/baseline-$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "${OUT_DIR}"

echo "Recording baseline traffic against ${PROXY_URL} -> ${OUT_DIR}"

hit() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local outfile="${OUT_DIR}/${name}.json"

  echo "-> ${method} ${path}"
  if [[ -n "${body}" ]]; then
    echo "${body}" | curl --fail --silent --show-error \
      -X "${method}" \
      -H 'content-type: application/json' \
      -d @- \
      "${PROXY_URL}${path}" | tee "${outfile}" >/dev/null
  else
    curl --fail --silent --show-error \
      -X "${method}" \
      "${PROXY_URL}${path}" | tee "${outfile}" >/dev/null
  fi
  echo "   saved ${outfile}"
}

hit "health" "GET" "/health"
hit "gpu-info" "GET" "/api/gpu-info"
hit "simulate-boids" "POST" "/api/simulate/boids" '{"simulation_type":"boids","steps":4,"num_particles":180}'
hit "simulate-sph" "POST" "/api/simulate/sph" '{"simulation_type":"sph","steps":4}'
hit "simulate-grayscott" "POST" "/api/simulate/grayscott" '{"simulation_type":"grayscott","steps":2}'

echo "Baseline capture complete. Inspect ${OUT_DIR} or replay via the Keploy CLI."

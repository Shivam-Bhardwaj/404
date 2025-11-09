# Keploy Proxy & Baseline Capture

This folder contains everything needed to record and replay the physics backend traffic with [Keploy](https://keploy.io). The proxy listens on `127.0.0.1:3100`, forwards requests to the backend on `127.0.0.1:3001`, and stores testcases/mocks under `keploy/data/`.

> The compose file now runs `keploy proxy --mode record --port 3100 --target 3001 --host 127.0.0.1`, matching the CLI command we verified manually.

## Prerequisites

1. Backend running on `localhost:3001` (`cargo run --release` or the `404-backend` PM2 service).
2. Docker Desktop or compatible engine.

## Usage

```bash
# 1. Boot the backend locally (or ensure the PM2 service is up).

# 2. Start the Keploy proxy.
cd keploy
docker compose -f docker-compose.keploy.yml up -d
docker ps | grep keploy    # confirm container is healthy

# 3. Record baseline traffic via the helper script (hits health, gpu-info, boids/sph/grayscott sims).
./record-baseline.sh

# 4. Inspect recorded artefacts (testcases + mocks).
ls data
```

The script writes `curl` responses to `data/baseline-*/` and also triggers Keploy's recorder so the proxy captures full request/response pairs.

### Replay

1. Stop the backend so Keploy can replay responses deterministically.
2. Exec into the container and run the Keploy CLI in `test` mode, or mount `./data` into a local Keploy CLI session if you prefer to replay outside Docker.

## Baseline Snapshots

For quick reference, the `baseline-snapshots/` directory contains sanitized outputs captured from a local run (see timestamps in the file headers). These files illustrate the expected JSON shape from each endpoint and can be compared against future captures.

- `health.txt` — raw `OK` payload
- `gpu-info.json` — sample GPU metadata
- `simulate-boids.json`, `simulate-sph.json`, `simulate-grayscott.json` — representative simulation responses

> Real recordings still live under `keploy/data/` (ignored in git). Re-run `record-baseline.sh` whenever kernel parameters change and commit any noteworthy diffs from the sanitized snapshots into PR descriptions for review.

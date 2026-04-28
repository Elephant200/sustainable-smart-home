#!/bin/bash
set -e

echo "[post-merge] Installing npm dependencies..."
npm install --no-audit --no-fund --prefer-offline

echo "[post-merge] Done."

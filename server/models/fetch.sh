#!/usr/bin/env bash
# Speaker-embedding models for server/src/voiceid.ts (single-phone mode). Idempotent.
# Source: https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models  (sic: "recongition")
set -euo pipefail
cd "$(dirname "$0")"
BASE=https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models
for m in nemo_en_titanet_small.onnx 3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx; do
  [ -s "$m" ] || curl -fL -o "$m" "$BASE/$m"
done
ls -la *.onnx

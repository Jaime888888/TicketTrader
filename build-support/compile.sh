#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/src/main/java"
OUT_DIR="$ROOT/src/main/webapp/WEB-INF/classes"
STUB_CP="$ROOT/build-support/stubs"
mkdir -p "$OUT_DIR"
# Compile all java sources using the stub servlet API so Tomcat can load classes without extra jars.
find "$SRC_DIR" -name '*.java' > "$ROOT/.java_sources.tmp"
javac -cp "$STUB_CP" -d "$OUT_DIR" @"$ROOT/.java_sources.tmp"
rm "$ROOT/.java_sources.tmp"
echo "Compiled classes to $OUT_DIR"

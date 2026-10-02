#!/usr/bin/env bash
set -e
CMAKE="/c/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe"
cd /d/临时工作/GU
echo "=== configure (regen) ==="
"$CMAKE" -S . -B build -DJUCE_SOURCE_DIR=/d/临时工作/GU/JUCE 2>&1 | tail -20 || true
echo "=== build ==="
"$CMAKE" --build build --config Debug 2>&1 | tail -60
echo "=== build exit: $? ==="

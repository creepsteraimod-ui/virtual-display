#!/usr/bin/bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(dirname -- "$script_dir")"
output_file="$project_dir/build/generic-4k60.bin"
report_file="$project_dir/build/edid-decode.txt"

mkdir -p "$project_dir/build"
gjs "$script_dir/generate-edid.js" "$project_dir/vendor/edid-generator" "$output_file"
edid-decode --check "$output_file" | tee "$report_file"
grep -q "EDID conformity: PASS" "$report_file"
echo "Generated: $output_file"
echo "Validation: $report_file"

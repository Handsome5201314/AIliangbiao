#!/usr/bin/env bash

require_env_file() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    echo "Environment file not found: $env_file" >&2
    exit 1
  fi
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  local line

  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo "Missing required key in $env_file: $key" >&2
    exit 1
  fi

  line="${line#*=}"
  line="${line%$'\r'}"

  if [[ "${line:0:1}" == '"' && "${line: -1}" == '"' ]]; then
    line="${line:1:-1}"
  elif [[ "${line:0:1}" == "'" && "${line: -1}" == "'" ]]; then
    line="${line:1:-1}"
  fi

  printf '%s' "$line"
}

#!/usr/bin/env bash
# Rend « node » disponible dans les hooks git (installation via nvm).
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null
fi
command -v node >/dev/null 2>&1 || { echo "✘ Node.js introuvable : vérification impossible, opération bloquée." >&2; exit 1; }

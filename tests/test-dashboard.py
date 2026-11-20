#!/usr/bin/env python3
"""Audita referências a elementos e rotas da interface estática."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "dashboard"
html = (root / "index.html").read_text()
js = (root / "app.js").read_text()
css = (root / "style.css").read_text()
ids_html = set(re.findall(r'\bid="([^"]+)"', html))
ids_js = set(re.findall(r'\$\("([^"]+)"\)', js))
missing = sorted(ids_js - ids_html)
assert not missing, f"ID referenciado pelo JS não existe no HTML: {missing}"
assert len(ids_html) == len(re.findall(r'\bid="([^"]+)"', html)), "IDs HTML duplicados"
for item in ("sign-form", "sign-run-id", "sign-artifact", "sign-btn", "repo-select", "login-form"):
    assert item in ids_html, f"Controle obrigatório ausente: {item}"
for item in ("aab-unsigned", "both-unsigned", "aab", "apk"):
    assert f'value="{item}"' in html, f"Formato de build não disponível: {item}"
assert "https://api.github.com" in js and "github.com" in js
assert "window.setInterval" in js
assert "localStorage" in js
assert "url(" not in css or "https://" not in css
assert not re.search(r'\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{25,}\b', js + html), "Possível token gravado"
print("Dashboard: IDs, recursos críticos e integração verificados.")

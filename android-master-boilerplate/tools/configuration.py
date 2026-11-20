"""Contrato e validação dos aplicativos derivados."""
import ipaddress
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ID = re.compile(r"^[a-z][a-z0-9-]{2,55}$")
PACKAGE = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$")
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
HOST = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
FLAGS = ("downloads", "favorites", "sharing", "fileUpload", "notifications", "ads", "billing")
NAV = ("topBar", "bottomBar", "drawer", "swipeBetweenTabs")
SECURITY = ("allowJavaScript", "allowThirdPartyCookies", "allowExternalLinks")


class InvalidConfiguration(ValueError):
    pass


def require(test, message):
    if not test:
        raise InvalidConfiguration(message)


def allowed_url(raw, allowed_hosts):
    if not isinstance(raw, str) or len(raw) > 2048:
        return False
    try:
        url = urlsplit(raw)
        port = url.port
    except ValueError:
        return False
    if url.scheme != "https" or not url.hostname or url.username or url.password:
        return False
    if port not in (None, 443):
        return False
    if url.hostname.lower() not in allowed_hosts:
        return False
    try:
        ipaddress.ip_address(url.hostname)
        return False
    except ValueError:
        return bool(HOST.fullmatch(url.hostname.lower()))


def validate(raw):
    require(isinstance(raw, dict), "A configuração precisa ser um objeto JSON.")
    for key in ("schemaVersion", "appId", "applicationId", "displayName", "versionCode",
                "versionName", "startUrl", "allowedHosts", "theme", "navigation",
                "features", "security"):
        require(key in raw, "Campo obrigatório ausente: " + key)
    require(type(raw["schemaVersion"]) is int and raw["schemaVersion"] == 1,
            "Versão de schema desconhecida")
    require(isinstance(raw["appId"], str) and ID.fullmatch(raw["appId"]),
            "appId inválido")
    require(isinstance(raw["applicationId"], str) and PACKAGE.fullmatch(raw["applicationId"]),
            "applicationId inválido")
    require(isinstance(raw["displayName"], str) and 2 <= len(raw["displayName"]) <= 50,
            "Nome de exibição inválido")
    require(type(raw["versionCode"]) is int and 1 <= raw["versionCode"] < 2_100_000_000,
            "versionCode inválido")
    require(isinstance(raw["versionName"], str) and
            re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", raw["versionName"]),
            "versionName inválida")
    hosts = raw["allowedHosts"]
    require(isinstance(hosts, list) and 1 <= len(hosts) <= 20,
            "allowedHosts precisa conter de 1 a 20 domínios")
    require(all(isinstance(h, str) and h == h.lower() and HOST.fullmatch(h) for h in hosts),
            "allowedHosts contém domínio inválido")
    allowed = set(hosts)
    require(allowed_url(raw["startUrl"], allowed), "startUrl precisa ser HTTPS e autorizado")
    theme = raw["theme"]
    require(isinstance(theme, dict), "theme inválido")
    require(theme.get("mode") in ("system", "light", "dark"), "Modo de tema inválido")
    require(isinstance(theme.get("primaryColor"), str) and HEX.fullmatch(theme["primaryColor"]),
            "primaryColor deve ser #RRGGBB")
    nav = raw["navigation"]
    require(isinstance(nav, dict), "navigation inválido")
    for flag in NAV:
        require(type(nav.get(flag)) is bool, "navigation." + flag + " deve ser booleano")
    require(not nav["swipeBetweenTabs"], "Gestos entre abas ainda indisponíveis na versão inicial")
    tabs = nav.get("tabs")
    require(isinstance(tabs, list) and 1 <= len(tabs) <= 12, "Informe 1-12 abas")
    ids = set()
    for tab in tabs:
        require(isinstance(tab, dict), "Objeto de aba inválido")
        name = tab.get("id")
        require(isinstance(name, str) and ID.fullmatch(name), "ID de aba inválido")
        require(name not in ids, "ID de aba duplicado")
        ids.add(name)
        require(isinstance(tab.get("title"), str) and 1 <= len(tab["title"]) <= 30,
                "Título de aba inválido")
        require(allowed_url(tab.get("url"), allowed), "URL de aba fora dos domínios permitidos")
    features = raw["features"]
    require(isinstance(features, dict), "features inválido")
    for flag in FLAGS:
        require(type(features.get(flag)) is bool, "features." + flag + " deve ser booleano")
    for flag in ("notifications", "ads", "billing"):
        require(not features[flag], "Módulo externo ainda não implementado: " + flag)
    security = raw["security"]
    require(isinstance(security, dict), "security inválido")
    for flag in SECURITY:
        require(type(security.get(flag)) is bool, "security." + flag + " deve ser booleano")
    require(not security["allowThirdPartyCookies"], "Cookies de terceiros não habilitados na v1")
    return raw


def load_checked(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        raise InvalidConfiguration("Erro de leitura JSON: " + str(error)) from error
    return validate(data)

#!/usr/bin/env python3
"""Gera projeto Android Gradle derivado a partir do template comum."""
import argparse
import json
import shutil
import sys
from pathlib import Path
from xml.sax.saxutils import escape
from configuration import InvalidConfiguration, load_checked

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "template"
MARKER = ".android-master-generated"


def generate(config_path: Path, destination: Path, force=False, icon_path=None):
    config = load_checked(config_path)
    destination = destination.resolve()
    if destination == TEMPLATE.resolve() or TEMPLATE.resolve() in destination.parents:
        raise InvalidConfiguration("Destino não pode estar dentro do template.")
    if destination.exists():
        if not force or not (destination / MARKER).exists():
            raise InvalidConfiguration("Destino já existe; --force somente em destino gerado.")
        shutil.rmtree(destination)
    if icon_path is not None:
        icon_path = icon_path.resolve()
        if not icon_path.is_file() or icon_path.stat().st_size > 2 * 1024 * 1024:
            raise InvalidConfiguration("Ícone PNG inexistente ou maior que 2 MiB")
        if not icon_path.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"):
            raise InvalidConfiguration("Ícone precisa ser um PNG válido")
    shutil.copytree(TEMPLATE, destination)
    (destination / "app/src/main/assets/app-config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    props = destination / "gradle.properties"
    lines = [line for line in props.read_text(encoding="utf-8").splitlines()
             if not line.startswith(("appId=", "appVersionCode=", "appVersionName="))]
    lines.extend(("appId=" + config["applicationId"],
                  "appVersionCode=" + str(config["versionCode"]),
                  "appVersionName=" + config["versionName"]))
    props.write_text("\n".join(lines) + "\n", encoding="utf-8")
    resources = destination / "app/src/main/res"
    (resources / "values/strings.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '  <string name="app_name">' + escape(config["displayName"]) + '</string>\n'
        '</resources>\n', encoding="utf-8")
    if icon_path:
        folder = resources / "drawable-nodpi"
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(icon_path, folder / "custom_launcher.png")
        manifest = destination / "app/src/main/AndroidManifest.xml"
        manifest.write_text(
            manifest.read_text(encoding="utf-8").replace(
                'android:icon="@drawable/ic_launcher"',
                'android:icon="@drawable/custom_launcher"'),
            encoding="utf-8")
    (destination / MARKER).write_text("Android Master Boilerplate v1\n", encoding="utf-8")
    (destination / "README-GENERATED.md").write_text(
        "# " + config["displayName"] + "\n\n"
        + "- Pacote: " + config["applicationId"] + "\n"
        + "- versionCode: " + str(config["versionCode"]) + "\n"
        + "- APK: gradle :app:assembleDebug\n"
        + "- AAB unsigned: gradle :app:bundleRelease\n"
        + "- Para Play Store, assinar o AAB após a compilação.\n", encoding="utf-8")
    return destination


def main():
    parser = argparse.ArgumentParser(description="Gerador Android sem Android Studio local")
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--icon", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        print("Aplicativo criado:", generate(args.config, args.output,
              force=args.force, icon_path=args.icon))
        return 0
    except (OSError, InvalidConfiguration) as error:
        print("Erro: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

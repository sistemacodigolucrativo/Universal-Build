#!/usr/bin/env python3
"""Extrai ZIP de projeto sem permitir zip-slip, links ou arquivos excessivos."""
import pathlib
import sys
import zipfile

MAX_FILES = 15000
MAX_UNCOMPRESSED = 500 * 1024 * 1024

def extract(source: str, destination: str) -> str:
    source_path = pathlib.Path(source).resolve()
    dest = pathlib.Path(destination).resolve()
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source_path) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_FILES:
            raise ValueError("ZIP excede limite de arquivos")
        if sum(f.file_size for f in entries) > MAX_UNCOMPRESSED:
            raise ValueError("ZIP excede limite de expansão de 500 MiB")
        valid = []
        for item in entries:
            name = item.filename
            if "\\" in name or name.startswith("/") or "\x00" in name:
                raise ValueError("Caminho inválido no ZIP")
            parts = pathlib.PurePosixPath(name).parts
            if not parts or any(p in ("..", ".") for p in parts):
                raise ValueError("Caminho relativo inseguro no ZIP")
            mode = (item.external_attr >> 16) & 0o170000
            if mode == 0o120000:
                raise ValueError("Links simbólicos não são permitidos")
            target = (dest / pathlib.Path(*parts)).resolve()
            if not target.is_relative_to(dest):
                raise ValueError("Tentativa de extração fora da pasta destino")
            valid.append((item, target))
        for item, target in valid:
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(item) as src, target.open("wb") as out:
                    import shutil
                    shutil.copyfileobj(src, out)
    top = {pathlib.PurePosixPath(item.filename).parts[0] for item, _ in valid}
    if len(top) == 1:
        candidate = dest / next(iter(top))
        if candidate.is_dir():
            return str(candidate)
    return str(dest)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Uso: extract_zip.py projeto.zip pasta_destino")
    try:
        print(extract(sys.argv[1], sys.argv[2]))
    except (ValueError, OSError, zipfile.BadZipFile) as exc:
        sys.exit("Falha na extração: " + str(exc))

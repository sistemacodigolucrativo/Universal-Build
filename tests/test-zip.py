import io
import pathlib
import tempfile
import zipfile
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from extract_zip import extract

with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    good = root / "ok.zip"
    with zipfile.ZipFile(good, "w") as z:
        z.writestr("project/settings.gradle", "include ':app'")
        z.writestr("project/gradlew", "#!/bin/sh")
    extracted = pathlib.Path(extract(str(good), str(root / "ok")))
    assert extracted.name == "project"
    assert (extracted / "settings.gradle").exists()
    bad = root / "bad.zip"
    with zipfile.ZipFile(bad, "w") as z:
        z.writestr("../escape.txt", "unsafe")
    try:
        extract(str(bad), str(root / "bad"))
        raise AssertionError("ZIP malicioso foi aceito")
    except ValueError:
        pass
    assert not (root / "escape.txt").exists()
print("ZIP: extração válida e zip-slip bloqueado.")

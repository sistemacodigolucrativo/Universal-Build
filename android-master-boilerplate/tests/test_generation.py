import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from configuration import InvalidConfiguration, load_checked, validate
from generate_app import generate


class BoilerplateTests(unittest.TestCase):
    def test_two_independent_projects(self):
        with tempfile.TemporaryDirectory() as folder:
            configs = []
            for filename in ("portal-demo.json", "second-app.json"):
                cfg_path = ROOT / "apps" / filename
                cfg = load_checked(cfg_path)
                output = Path(folder) / cfg["appId"]
                generate(cfg_path, output)
                self.assertTrue((output / "app/src/main/AndroidManifest.xml").exists())
                self.assertIn(cfg["applicationId"], (output / "gradle.properties").read_text())
                self.assertIn(cfg["displayName"], (output / "app/src/main/res/values/strings.xml").read_text())
                configs.append((output / "app/src/main/assets/app-config.json").read_text())
            self.assertNotEqual(configs[0], configs[1])

    def test_prevent_deleting_manual_directories(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "manual"
            out.mkdir()
            (out / "keep.txt").write_text("não apagar")
            with self.assertRaises(InvalidConfiguration):
                generate(ROOT / "apps/portal-demo.json", out, force=True)
            self.assertTrue((out / "keep.txt").exists())

    def test_reject_insecure_url(self):
        cfg = load_checked(ROOT / "apps/portal-demo.json")
        cfg["startUrl"] = "http://example.org/"
        with self.assertRaises(InvalidConfiguration):
            validate(cfg)

    def test_reject_external_tab(self):
        cfg = load_checked(ROOT / "apps/portal-demo.json")
        cfg["navigation"]["tabs"][0]["url"] = "https://evil.invalid/"
        with self.assertRaises(InvalidConfiguration):
            validate(cfg)

    def test_reject_unimplemented_features(self):
        cfg = load_checked(ROOT / "apps/portal-demo.json")
        cfg["features"]["ads"] = True
        with self.assertRaises(InvalidConfiguration):
            validate(cfg)

    def test_reject_invalid_package(self):
        cfg = load_checked(ROOT / "apps/portal-demo.json")
        cfg["applicationId"] = "Invalid package"
        with self.assertRaises(InvalidConfiguration):
            validate(cfg)

    def test_reject_third_party_cookies(self):
        cfg = load_checked(ROOT / "apps/portal-demo.json")
        cfg["security"]["allowThirdPartyCookies"] = True
        with self.assertRaises(InvalidConfiguration):
            validate(cfg)

    def test_regenerate_known_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "derived"
            source = ROOT / "apps/portal-demo.json"
            generate(source, out)
            (out / "temporary.txt").write_text("old")
            generate(source, out, force=True)
            self.assertFalse((out / "temporary.txt").exists())
            self.assertTrue((out / ".android-master-generated").exists())


if __name__ == "__main__":
    unittest.main()

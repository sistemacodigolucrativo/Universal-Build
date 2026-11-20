import pathlib
import yaml
root = pathlib.Path(__file__).resolve().parents[1]
paths = list((root / ".github/workflows").glob("*.yml")) + list((root / "templates").glob("*.yml"))
assert len(paths) >= 3
for path in paths:
    # BaseLoader preserva a chave "on", convertida em bool pelo YAML 1.1.
    data = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
    assert isinstance(data, dict) and "on" in data and "jobs" in data, path
    print("YAML válido:", path.relative_to(root))

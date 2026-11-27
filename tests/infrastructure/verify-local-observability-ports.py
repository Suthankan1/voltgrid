"""Verify the effective host publishes without starting the stack."""
import json
import subprocess
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[2]
    config = subprocess.check_output(
        ["docker", "compose", "-f", "observability/local/compose.yaml", "config", "--format", "json"],
        cwd=root,
        text=True,
    )
    services = json.loads(config)["services"]
    expected = {
        ("jaeger", "127.0.0.1", 16686, 16686, "tcp"),
        ("otel-collector", "127.0.0.1", 4317, 4317, "tcp"),
        ("otel-collector", "127.0.0.1", 4318, 4318, "tcp"),
        ("prometheus", "127.0.0.1", 9091, 9090, "tcp"),
    }
    published = {
        (service, port.get("host_ip"), int(port["published"]), int(port["target"]), port["protocol"])
        for service, settings in services.items()
        for port in settings.get("ports", [])
    }
    if published != expected:
        raise SystemExit(f"Unexpected observability host publishes: {sorted(published, key=str)}")
    print("All four local observability endpoints publish on IPv4 loopback.")


if __name__ == "__main__":
    main()

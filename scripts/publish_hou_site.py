#!/usr/bin/env python3
"""Publish site/ to the Perfect Dawn Time House of Ur static site.

Default target is dev. Production requires both --prod and --confirm-prod.
This script intentionally uploads/overwrites but does not delete stale remote files.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_DIR = ROOT / "site"
ENV_FILE = Path(__file__).with_name(".env")

# Hard locks: do not make these environment-configurable.
HOUSE_ID = "087a7b07-9967-445b-a6fc-2f8474ff2b24"
LIBRARY_PREFIX = "/sites/pdt"
SITE_SLUG = "pdt"

TARGETS = {
    "dev": {
        "api_base": "https://appdev.house-of-ur.com",
        "url": "https://pdt-bronzearch-dev.house-of-ur.com/",
    },
    "prod": {
        "api_base": "https://app.house-of-ur.com",
        "url": "https://pdt-bronzearch.house-of-ur.com/",
    },
}


def parse_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def api_key(target: str) -> str:
    file_values = parse_dotenv(ENV_FILE)
    names = (
        ("HOU_DEV_API_KEY", "HOU_API_KEY")
        if target == "dev"
        else ("HOU_PROD_API_KEY", "HOU_API_KEY")
    )
    for name in names:
        value = os.environ.get(name) or file_values.get(name)
        if value:
            return value.strip()
    return ""


def request_json(
    api_base: str,
    token: str | None,
    method: str,
    path: str,
    body: dict | None = None,
) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{api_base}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"HTTP {error.code} {path}: {detail}") from error


def exchange_token(api_base: str, key: str) -> str:
    response = request_json(
        api_base, None, "POST", "/auth/token/apikey", {"api_key": key}
    )
    token = response.get("access_token")
    if not token:
        raise RuntimeError("Token exchange returned no access_token")
    return str(token)


def content_type(path: Path) -> str:
    overrides = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
    }
    return overrides.get(
        path.suffix.lower(),
        mimetypes.guess_type(str(path))[0] or "application/octet-stream",
    )


def site_files() -> list[tuple[str, Path]]:
    return [
        (f"{LIBRARY_PREFIX}/{path.relative_to(SITE_DIR).as_posix()}", path)
        for path in SITE_DIR.rglob("*")
        if path.is_file()
    ]


def folder_paths(library_paths: list[str]) -> list[str]:
    folders = {LIBRARY_PREFIX}
    for library_path in library_paths:
        parts = library_path.strip("/").split("/")[:-1]
        for index in range(1, len(parts) + 1):
            folders.add("/" + "/".join(parts[:index]))
    return sorted(folders, key=lambda value: (value.count("/"), value))


def ensure_folder(api_base: str, token: str, folder: str) -> None:
    try:
        request_json(
            api_base,
            token,
            "POST",
            f"/api/houses/{HOUSE_ID}/library/folders",
            {"path": folder.rstrip("/") + "/"},
        )
    except RuntimeError as error:
        text = str(error).lower()
        if not any(marker in text for marker in ("400", "409", "exist")):
            raise


def upload(api_base: str, token: str, library_path: str, local_path: Path) -> str:
    if not library_path.startswith(LIBRARY_PREFIX + "/"):
        raise RuntimeError(f"Refusing path outside {LIBRARY_PREFIX}: {library_path}")
    media_type = content_type(local_path)
    metadata = request_json(
        api_base,
        token,
        "POST",
        f"/api/houses/{HOUSE_ID}/library/upload",
        {"path": library_path, "content_type": media_type},
    )
    upload_url = metadata.get("upload_url")
    if not upload_url:
        raise RuntimeError(f"No upload_url returned for {library_path}")
    request = urllib.request.Request(
        str(upload_url),
        data=local_path.read_bytes(),
        headers={"Content-Type": media_type},
        method="PUT",
    )
    with urllib.request.urlopen(request, timeout=180):
        pass
    return library_path


def extract_sites(response: object) -> list[dict]:
    if isinstance(response, list):
        return response
    if not isinstance(response, dict):
        return []
    sites = response.get("data") or response.get("sites") or []
    return sites if isinstance(sites, list) else []


def ensure_site(api_base: str, token: str) -> dict:
    sites = extract_sites(
        request_json(api_base, token, "GET", f"/api/houses/{HOUSE_ID}/sites")
    )
    existing = next(
        (item for item in sites if item.get("site_slug") == SITE_SLUG), None
    )
    payload = {
        "library_path": LIBRARY_PREFIX + "/",
        "configuration": {
            "mode": "github_pages",
            "index_document": "index.html",
            "error_document": "404.html",
        },
    }
    if existing:
        site_id = existing.get("site_id") or existing.get("id")
        return request_json(
            api_base,
            token,
            "PATCH",
            f"/api/houses/{HOUSE_ID}/sites/{site_id}",
            payload,
        )
    return request_json(
        api_base,
        token,
        "POST",
        f"/api/houses/{HOUSE_ID}/sites",
        {"site_slug": SITE_SLUG, **payload},
    )


def unwrap_site(response: dict) -> dict:
    if isinstance(response.get("site"), dict):
        return response["site"]
    if isinstance(response.get("data"), dict):
        return response["data"]
    return response


def wait_active(
    api_base: str, token: str, site: dict, *, timeout_seconds: int = 420
) -> dict:
    current = unwrap_site(site)
    site_id = current.get("site_id") or current.get("id")
    if not site_id:
        raise RuntimeError("Site response contained no site id")
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        status = str(current.get("status") or "").upper()
        print(f"  site status: {status or 'UNKNOWN'}")
        if status in {"ACTIVE", "READY", "PROVISIONED"}:
            return current
        if status in {"FAILED", "ERROR"}:
            raise RuntimeError(f"Site provisioning failed with status {status}")
        time.sleep(8)
        current = unwrap_site(
            request_json(
                api_base,
                token,
                "GET",
                f"/api/houses/{HOUSE_ID}/sites/{site_id}",
            )
        )
    raise RuntimeError(
        f"Timed out waiting for Site to become active (last status "
        f"{current.get('status')!r})"
    )


def invalidate(api_base: str, token: str, site: dict) -> None:
    site = unwrap_site(site)
    site_id = site.get("site_id") or site.get("id")
    if not site_id:
        print("WARNING: no site id returned; cache was not invalidated.")
        return
    try:
        request_json(
            api_base,
            token,
            "POST",
            f"/api/houses/{HOUSE_ID}/sites/{site_id}/invalidate",
            {},
        )
    except RuntimeError as error:
        print(f"WARNING: cache invalidation failed: {error}")


def build() -> None:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.check_call([npm, "run", "build"], cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--dev", action="store_true", help="Publish to dev (default)")
    target.add_argument("--prod", action="store_true", help="Publish to production")
    parser.add_argument(
        "--confirm-prod",
        action="store_true",
        help="Required acknowledgement for production",
    )
    parser.add_argument("--build", action="store_true", help="Run npm run build first")
    args = parser.parse_args()

    environment = "prod" if args.prod else "dev"
    if environment == "prod" and not args.confirm_prod:
        raise SystemExit("Refusing production publish: add --confirm-prod.")
    if args.confirm_prod and environment != "prod":
        raise SystemExit("--confirm-prod is only valid with --prod.")
    if args.build:
        build()
    if not (SITE_DIR / "index.html").is_file():
        raise SystemExit("Missing site/index.html. Run npm run build or add --build.")

    config = TARGETS[environment]
    key = api_key(environment)
    if not key:
        expected = "HOU_DEV_API_KEY" if environment == "dev" else "HOU_PROD_API_KEY"
        raise SystemExit(f"No API key. Set {expected} (or HOU_API_KEY).")

    files = site_files()
    print(f"Target: {environment} -> {config['url']}")
    print(f"House: {HOUSE_ID}; library: {LIBRARY_PREFIX}/; site: {SITE_SLUG}")
    print(
        "WARNING: upload overwrites matching paths but does not delete stale remote files. "
        "Remove stale files through the House Library if the output shrinks."
    )
    token = exchange_token(config["api_base"], key)
    for folder in folder_paths([library_path for library_path, _ in files]):
        ensure_folder(config["api_base"], token, folder)

    completed = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {
            pool.submit(upload, config["api_base"], token, remote, local): remote
            for remote, local in files
        }
        for future in as_completed(jobs):
            remote = jobs[future]
            future.result()
            completed += 1
            print(f"  OK {remote}")

    site = wait_active(config["api_base"], token, ensure_site(config["api_base"], token))
    invalidate(config["api_base"], token, site)
    print(f"Uploaded {completed}/{len(files)} files.")
    print(f"URL: {config['url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

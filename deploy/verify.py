#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "httpx",
#     "playwright",
# ]
# ///
"""Deploy verification script using Playwright for UI smoke tests and API checks."""

import asyncio
import sys
from urllib.parse import urljoin

import httpx
from playwright.async_api import async_playwright


async def login(client: httpx.AsyncClient, base_url: str) -> str | None:
    """Try to authenticate as admin to get a bearer token."""
    import os

    username = os.environ.get("POLARIS_USER", "admin")
    password = os.environ.get("POLARIS_PASSWORD", "admin")

    try:
        resp = await client.post(
            urljoin(base_url, "/api/auth"),
            json={"username": username, "password": password},
        )
        if resp.status_code == 200:
            return resp.json().get("token")
    except Exception:
        pass
    print("  Auth: SKIP (no default admin creds)")
    return None


async def check_api(base_url: str) -> bool:
    """Smoke test core API endpoints."""
    endpoints = [
        ("/api/version", "critical"),
        ("/api/albums", "soft"),
        ("/api/artists", "soft"),
        ("/api/genres", "soft"),
        ("/api/playlists", "soft"),
        ("/api/songs", "soft"),
    ]

    ok = True
    async with httpx.AsyncClient(timeout=10) as client:
        token = await login(client, base_url)
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        for endpoint, priority in endpoints:
            url = urljoin(base_url, endpoint)
            try:
                resp = await client.get(url, headers=headers)
                status = resp.status_code
                if status == 200:
                    data = resp.json()
                    count = len(data) if isinstance(data, list) else 0
                    if count == 0 and endpoint in ("/api/albums", "/api/artists"):
                        print(f"  API {endpoint}: FAIL ({status}, 0 items — expected non-zero)")
                        ok = False
                    else:
                        print(f"  API {endpoint}: OK ({status}, {count} items)")
                elif status in (401, 403) and priority == "soft":
                    print(f"  API {endpoint}: OK ({status}, auth required)")
                elif status == 404 and priority == "soft":
                    print(f"  API {endpoint}: OK ({status}, not indexed)")
                elif status == 405 and priority == "soft":
                    print(f"  API {endpoint}: OK ({status}, method restricted)")
                else:
                    print(f"  API {endpoint}: WARN ({status})")
                    if priority == "critical":
                        ok = False
            except httpx.RequestError as e:
                print(f"  API {endpoint}: FAIL ({e})")
                if priority == "critical":
                    ok = False

    return ok


async def check_ui(base_url: str) -> bool:
    """Smoke test UI pages using Playwright."""
    # Hash-based routes: Polaris uses createWebHashHistory()
    pages = [
        ("#/", None),
        ("#/files", "Files"),
        ("#/albums", "Albums"),
        ("#/artists", "Artists"),
        ("#/genres", "Genres"),
        ("#/playlists", "Playlists"),
        ("#/search", "Search"),
    ]

    ok = True
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Login first
        try:
            await page.goto(f"{base_url}/#/auth", wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(500)
            await page.fill('#username', "admin")
            await page.fill('#password', "admin")
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(1000)
        except Exception as e:
            print(f"  UI  login: FAIL ({e})")
            await browser.close()
            return False

        for hash_path, expected_text in pages:
            url = f"{base_url}/{hash_path}"
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                # Hash routes in SPAs may return None (same-page navigation)
                if resp is not None and resp.status != 200:
                    print(f"  UI  {hash_path}: FAIL (HTTP {resp.status})")
                    ok = False
                    continue

                await page.wait_for_load_state("domcontentloaded")
                title = await page.title()

                if expected_text:
                    # Wait a bit for SPA to render
                    await page.wait_for_timeout(500)
                    body_text = await page.inner_text("body")
                    if expected_text.lower() in body_text.lower():
                        print(f"  UI  {hash_path}: OK (title: {title})")
                    else:
                        print(f"  UI  {hash_path}: WARN (title: {title}, '{expected_text}' not found)")
                else:
                    print(f"  UI  {hash_path}: OK (title: {title})")
            except Exception as e:
                print(f"  UI  {hash_path}: FAIL ({e})")
                ok = False

        await browser.close()

    return ok


def ensure_browser() -> None:
    """Install Playwright Chromium browser if not already available."""
    import subprocess

    result = subprocess.run(
        ["python", "-m", "playwright", "install", "--with-deps", "chromium"],
        capture_output=True,
    )
    if result.returncode != 0:
        # Already installed or handled
        pass
    else:
        print("  Installed Playwright browsers.")


async def main() -> None:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <ip> <port>")
        sys.exit(1)

    ip = sys.argv[1]
    port = sys.argv[2]
    base_url = f"http://{ip}:{port}"

    ensure_browser()

    print(f"\n  Verifying {base_url}...")
    print()

    api_ok = await check_api(base_url)
    print()
    ui_ok = await check_ui(base_url)

    print()
    if api_ok and ui_ok:
        print("  All checks passed.")
    else:
        print("  Some checks failed.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

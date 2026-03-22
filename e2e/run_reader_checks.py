from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('e2e/output')
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1600, 'height': 1100})
    page.goto('http://localhost:20261/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[type="email"]', 'demo@lumina.local')
    page.fill('input[type="password"]', 'lumina123')
    page.click('button[type="submit"]')
    page.wait_for_load_state('networkidle')

    page.goto('http://localhost:20261/library')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / 'library.png'), full_page=True)

    # pick latest epub card
    page.locator('text=继续阅读').first.click()
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / 'reader-initial.png'), full_page=True)

    # wheel flip
    page.mouse.wheel(0, 1200)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / 'reader-after-wheel.png'), full_page=True)

    page.goto('http://localhost:20261/knowledge')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / 'knowledge.png'), full_page=True)

    page.goto('http://localhost:20261/settings')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / 'settings.png'), full_page=True)
    browser.close()

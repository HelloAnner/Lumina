from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('e2e/output')
OUT.mkdir(parents=True, exist_ok=True)
LOG = OUT / 'browser-console.log'

messages = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1600, 'height': 1100})
    page.on('console', lambda msg: messages.append(f'console:{msg.type}:{msg.text}'))
    page.on('pageerror', lambda err: messages.append(f'pageerror:{err}'))
    page.goto('http://localhost:20261/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[type="email"]', 'demo@lumina.local')
    page.fill('input[type="password"]', 'lumina123')
    page.click('button[type="submit"]')
    page.wait_for_load_state('networkidle')

    page.goto('http://localhost:20261/library')
    page.wait_for_load_state('networkidle')
    assert 'Application error' not in page.locator('body').inner_text()
    page.screenshot(path=str(OUT / 'library.png'), full_page=True)

    books_json = page.evaluate("""async () => {
      const response = await fetch('/api/books')
      return await response.json()
    }""")
    books = books_json.get('items', [])
    target = next((item for item in books if item.get('title') == '未来简史'), books[0])
    page.evaluate("""async () => {
      await fetch('/api/settings/reader', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fontSize: 16,
          lineHeight: 1.75,
          fontFamily: 'serif',
          theme: 'night',
          navigationMode: 'horizontal'
        })
      })
    }""")

    page.goto(f"http://localhost:20261/reader/{target['id']}")
    page.wait_for_load_state('networkidle')
    assert 'Application error' not in page.locator('body').inner_text()
    page.screenshot(path=str(OUT / 'reader-horizontal.png'), full_page=True)

    page.mouse.wheel(0, 1200)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / 'reader-horizontal-after-wheel.png'), full_page=True)

    page.evaluate("""async () => {
      await fetch('/api/settings/reader', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fontSize: 16,
          lineHeight: 1.75,
          fontFamily: 'serif',
          theme: 'night',
          navigationMode: 'vertical'
        })
      })
    }""")
    page.goto(f"http://localhost:20261/reader/{target['id']}")
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / 'reader-vertical.png'), full_page=True)
    page.mouse.wheel(0, 1800)
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / 'reader-vertical-after-scroll.png'), full_page=True)

    page.goto('http://localhost:20261/knowledge')
    page.wait_for_load_state('networkidle')
    assert 'Application error' not in page.locator('body').inner_text()
    page.screenshot(path=str(OUT / 'knowledge.png'), full_page=True)

    page.goto('http://localhost:20261/settings')
    page.wait_for_load_state('networkidle')
    assert 'Application error' not in page.locator('body').inner_text()
    page.screenshot(path=str(OUT / 'settings.png'), full_page=True)
    browser.close()

LOG.write_text('\n'.join(messages), encoding='utf-8')

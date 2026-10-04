"""Headless browser smoke tests for mobile and desktop PDT."""
from playwright.sync_api import sync_playwright
from pathlib import Path
BASE="http://127.0.0.1:8766/"
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",args=["--no-sandbox"])
    errors=[]
    for name,viewport in [("mobile",{"width":390,"height":844}),("desktop",{"width":1440,"height":900})]:
        context=browser.new_context(viewport=viewport,permissions=[])
        page=context.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(BASE,wait_until="domcontentloaded")
        page.wait_for_timeout(1100)
        clock=page.locator("#clock").inner_text()
        assert clock[:2].isdigit(),f"Clock did not render: {clock}"
        assert page.locator("#location-name").inner_text()
        assert page.locator("#next-jump").inner_text() != "—"
        page.locator("#edit-coords").click()
        page.locator('input[name="latitude"]').fill("34")
        page.locator('input[name="longitude"]').fill("20")
        page.locator("#location-form button").click()
        assert "Chosen" in page.locator("#location-name").inner_text()
        overflow=page.evaluate("document.documentElement.scrollWidth - innerWidth")
        assert overflow <= 3,f"Home horizontal overflow on {name}: {overflow}"
        page.screenshot(path=str(Path(__file__).resolve().parents[1]/f"pdt-{name}-home.png"),full_page=True)
        page.locator("#focus-clock").click()
        assert page.locator("body.focus-clock").count() == 1
        assert page.locator("#clock").is_visible()
        assert page.locator(".site-header").is_hidden()
        assert page.evaluate("document.documentElement.scrollWidth - innerWidth") <= 3
        page.locator("#focus-clock").click()
        assert page.locator("body.focus-clock").count() == 0
        for route,needle in [("how-it-works.html","THE DEFINING EQUATION"),("equation-of-time.html","eot-chart"),("adjustments.html","jumps-chart"),("converter.html","from-clock")]:
            page.goto(BASE+route,wait_until="domcontentloaded")
            page.wait_for_timeout(600)
            assert page.locator("#"+needle).count() if "chart" in needle or "clock" in needle else needle in page.content(),route
            assert page.evaluate("document.documentElement.scrollWidth - innerWidth") <= 4,f"{route} overflow {name}"
            if route=="adjustments.html":
                assert page.locator("#largest-forward").inner_text()!="—"
                page.locator('[data-jump-preset="0,0"]').click()
                assert page.locator("#avg-jump").inner_text()!="—"
            if route=="converter.html":
                assert page.locator("#time-difference").inner_text()!="—"
                page.locator("#coords-form input[name='lat']").fill("64.1")
                page.locator("#coords-form input[name='lon']").fill("-21.9")
                page.locator("#coords-form button").click()
                assert "64.100" in page.locator("#to-coords").inner_text()
                if name=="mobile":page.screenshot(path=str(Path(__file__).resolve().parents[1]/"pdt-mobile-converter.png"),full_page=True)
        print(name,"clock",clock,"all 5 routes and manual converter passed")
        context.close()
    browser.close()
    if errors: raise AssertionError("Browser JavaScript errors: "+repr(errors))
    print("Browser page errors: 0")

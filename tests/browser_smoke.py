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
        page.route("https://nominatim.openstreetmap.org/reverse?**", lambda route: route.fulfill(status=200, content_type="application/json", body='{"address":{"town":"Mocktown","state":"Test State","country":"Australia"}}'))
        page.locator("#edit-coords").click()
        page.locator('input[name="latitude"]').fill("34")
        page.locator('input[name="longitude"]').fill("20")
        page.locator("#location-form button").click()
        page.locator("#location-name").get_by_text("Mocktown, Test State").wait_for(timeout=5000)
        assert page.locator("#location-name").inner_text()=="Mocktown, Test State"
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
    for scenario, body, expected in [
        ("town", '{"address":{"town":"Burra","state":"South Australia","country":"Australia"}}', "Burra, South Australia"),
        ("state only", '{"address":{"state":"South Australia","country":"Australia"}}', "South Australia, Australia"),
        ("service unavailable", None, "-33.682°, 138.940°"),
        ("older saved location", '{"address":{"town":"Burra","state":"South Australia","country":"Australia"}}', "Burra, South Australia"),
    ]:
        context=browser.new_context(
            viewport={"width":1100,"height":800},
            permissions=["geolocation"],
            geolocation={"latitude":-33.682,"longitude":138.94},
        )
        if scenario=="older saved location":
            context.add_init_script("localStorage.setItem('pdt-location',JSON.stringify({lat:-33.682,lon:138.94,name:'Your location'}))")
        page=context.new_page()
        requests=[]
        def answer_reverse(route):
            requests.append(route.request.url)
            route.fulfill(status=200 if body else 503,content_type="application/json",body=body or "{}")
        page.route("https://nominatim.openstreetmap.org/reverse?**",answer_reverse)
        page.goto(BASE,wait_until="domcontentloaded")
        page.locator("#location-name").get_by_text(expected,exact=True).wait_for(timeout=8000)
        assert page.locator("#location-name").inner_text()==expected,scenario
        assert len(requests)==1, (scenario,requests)
        assert "zoom=14" in requests[0],requests[0]
        assert "lat=-33.68" in requests[0] and "lon=138.94" in requests[0],requests[0]
        print("Reverse geocoding",scenario,"=>",expected)
        context.close()
    browser.close()
    if errors: raise AssertionError("Browser JavaScript errors: "+repr(errors))
    print("Browser page errors: 0")

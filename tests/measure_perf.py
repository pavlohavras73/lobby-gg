import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

PAGES = ["index", "poker", "bunker", "raskol", "space_invaders", "race"]

def measure_page(context, name):
    url = f"{BASE}/{'' if name == 'index' else name}"
    page = context.new_page()

    client = page.context.new_cdp_session(page)
    client.send("Network.enable")
    client.send("Network.emulateNetworkConditions", {
        "offline": False,
        "latency": 500,                         # 500ms RTT
        "downloadThroughput": 400 * 1024 // 8,  # 400 kbps = 50 KB/s
        "uploadThroughput": 150 * 1024 // 8,    # 150 kbps = 18.75 KB/s
        "connectionType": "cellular3g"
    })
    client.send("Emulation.setCPUThrottlingRate", {"rate": 4})

    transfer_bytes = 0
    def on_loading_finished(event):
        nonlocal transfer_bytes
        encoded = event.get("encodedDataLength", 0)
        transfer_bytes += encoded

    client.on("Network.loadingFinished", on_loading_finished)

    t_start = time.perf_counter()
    page.goto(url, wait_until="load", timeout=60000)
    page.wait_for_timeout(200)

    resources = page.evaluate("""() => {
        return performance.getEntriesByType('resource').map(r => ({
            name: r.name,
            size: r.transferSize || r.encodedBodySize || 0
        }));
    }""")

    metrics = page.evaluate("""() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const paints = performance.getEntriesByType('paint');
        let fcp = 0, fp = 0;
        for (const p of paints) {
            if (p.name === 'first-contentful-paint') fcp = p.startTime;
            if (p.name === 'first-paint') fp = p.startTime;
        }
        return {
            fcp: Math.round(fcp || fp || nav.domInteractive || 0),
            dcl: Math.round(nav.domContentLoadedEventEnd || 0),
            load: Math.round(nav.loadEventEnd || 0),
            domInteractive: Math.round(nav.domInteractive || 0)
        };
    }""")
    metrics["transferBytes"] = transfer_bytes
    metrics["resources"] = resources
    page.close()
    return metrics

def run():
    print(f"Connecting to {BASE}...")
    token = register()
    print("Registered user token successfully.")
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"]
        )
        for name in PAGES:
            # New context per page for clean cold cache
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True
            )
            context.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
            try:
                m = measure_page(context, name)
                results[name] = m
                print(f"{name:15}: FCP={m['fcp']:4d}ms | DCL={m['dcl']:4d}ms | Load={m['load']:4d}ms | Transfer={m['transferBytes'] / 1024:6.1f} KB")
                if name == "index" and "-v" in sys.argv:
                    for r in sorted(m["resources"], key=lambda x: -x["size"]):
                        print(f"   {r['size']/1024:5.1f} KB: {r['name']}")
            except Exception as e:
                print(f"{name:15}: ERROR {e}")
            finally:
                context.close()

        browser.close()
    return results

if __name__ == "__main__":
    run()

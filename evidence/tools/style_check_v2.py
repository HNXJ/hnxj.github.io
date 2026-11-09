"""Style check v2: a lane tree against its baseline at 375, 390, 768 and 1440 px, in light and dark schemes.

Usage: python evidence/tools/style_check_v2.py <baseline_root> <lane_root> <outdir> <page> [<page> ...]
  Regression rule: a new console error, page error, HTTP 400+ response or 390 px overflow not in the baseline.
  Dark = prefers-color-scheme: dark (the sites read it when no theme is stored).
  Prints one JSON line per case, then: STYLE CHECK v2: <cases> cases, <n> regressions.
Exit: 0 no regression, 1 regression, 2 usage or missing folder.
"""
import http.server
import json
import os
import re
import sys
import threading
import urllib.parse

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

VIEWPORTS = {"375": (375, 812), "390": (390, 844), "768": (768, 1024), "1440": (1440, 900)}
SCHEMES = ("light", "dark")


def serve(root):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=root, **kwargs)

        def log_message(self, *args):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def route_local_only(route):
    u = urllib.parse.urlsplit(route.request.url)
    if u.scheme in ("data", "blob") or u.hostname == "127.0.0.1":
        route.continue_()
    else:
        route.abort()


def capture(browser, base, page_path, vp_name, scheme, out_png):
    width, height = VIEWPORTS[vp_name]
    ctx = browser.new_context(viewport={"width": width, "height": height}, color_scheme=scheme)
    ctx.route("**/*", route_local_only)
    pg = ctx.new_page()
    msgs = []
    pg.on("console", lambda m: msgs.append("console: " + m.text)
          if m.type == "error" and not m.text.startswith("Failed to load resource") else None)
    pg.on("pageerror", lambda e: msgs.append("pageerror: " + str(e)))
    pg.on("response", lambda r: msgs.append(f"http {r.status}: " + r.url.replace(base, ""))
          if r.status >= 400 else None)
    pg.goto(f"{base}/{page_path}", wait_until="load", timeout=30000)
    pg.wait_for_timeout(800)
    scroll_w, inner_w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    pg.screenshot(path=out_png, full_page=True, animations="disabled", caret="hide")
    ctx.close()
    # Line:col inside stack traces move when lines are added above; compare the message, not its position.
    return {re.sub(r":\d+:\d+", ":L:C", m.replace(base, "")) for m in msgs}, scroll_w > inner_w + 1, scroll_w


def diff_px(a, b):
    ia = Image.open(a).convert("RGB")
    ib = Image.open(b).convert("RGB")
    if ia.size != ib.size:
        return f"size {ia.size} vs {ib.size}"
    r, g, bl = ImageChops.difference(ia, ib).split()
    mask = ImageChops.lighter(ImageChops.lighter(r, g), bl).point(lambda v: 255 if v else 0)
    return mask.histogram()[255]


def main(argv):
    if len(argv) < 5:
        print(__doc__)
        return 2
    base_root, lane_root, outdir = argv[1], argv[2], argv[3]
    pages = argv[4:]
    for root in (base_root, lane_root):
        if not os.path.isdir(root):
            print(f"no such folder: {root}")
            return 2
    b_srv, b_base = serve(base_root)
    l_srv, l_base = serve(lane_root)
    cases = 0
    regressions = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for page_path in pages:
                slug = page_path.replace("/", "__")
                for scheme in SCHEMES:
                    for vp in VIEWPORTS:
                        cases += 1
                        got = {}
                        for tag, base in (("base", b_base), ("lane", l_base)):
                            d = os.path.join(outdir, tag, scheme, vp)
                            os.makedirs(d, exist_ok=True)
                            got[tag] = capture(browser, base, page_path, vp, scheme,
                                               os.path.join(d, slug + ".png"))
                        b_msgs, b_over, b_w = got["base"]
                        l_msgs, l_over, l_w = got["lane"]
                        new = sorted(l_msgs - b_msgs)
                        gone = sorted(b_msgs - l_msgs)
                        over_reg = vp == "390" and l_over and not b_over
                        if new or over_reg:
                            regressions += 1
                        px = diff_px(os.path.join(outdir, "base", scheme, vp, slug + ".png"),
                                     os.path.join(outdir, "lane", scheme, vp, slug + ".png"))
                        print(json.dumps({
                            "page": page_path, "scheme": scheme, "vp": vp, "new": new, "gone": gone,
                            "scroll_w": {"base": b_w, "lane": l_w},
                            "overflow_390_regression": bool(over_reg), "diff_px": px,
                        }))
            browser.close()
    finally:
        b_srv.shutdown()
        l_srv.shutdown()
    print(f"STYLE CHECK v2: {cases} cases, {regressions} regressions")
    return 1 if regressions else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""Render template hotspot MikroTik menjadi HTML biasa untuk dilihat di browser.

Router MikroTik mengganti $(variabel) dan blok $(if)/$(elif)/$(else)/$(endif)
saat halaman dilayani. Skrip ini meniru itu dengan nilai contoh, lalu menulis
hasilnya ke folder preview/ bersama aset (css, js, img, md5.js, portal-config.js).

Pemakaian:
    python tools/preview.py [normal|error|nochap] [--error TEKS] [--asset-base URL]
    python -m http.server 8765 --directory preview

Skenario:
    normal   CHAP aktif, tanpa error
    error    CHAP aktif, ada pesan error router di login/error
    nochap   CHAP mati (chap-id kosong), tanpa error

--asset-base mengganti assetBase di salinan portal-config.js (hanya di
preview/), misalnya http://127.0.0.1:9/ untuk menguji kegagalan bundle.
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "preview"

PAGES = ["login.html", "alogin.html", "status.html", "logout.html", "error.html", "connect.html"]
ASSETS = ["css", "js", "img"]
ASSET_FILES = ["md5.js", "portal-config.js", "favicon.ico"]

# Nilai contoh. chap-id / chap-challenge berupa teks escape oktal, persis
# seperti yang dikirim router ke dalam string literal JavaScript.
BASE = {
    # Tautan ke halaman preview lokal supaya navigasi antarhalaman bisa dicoba.
    "link-login": "/login.html",
    "link-login-only": "/login.html",
    "link-logout": "/logout.html",
    "link-status": "/status.html",
    "link-advert": "/advert.html",
    "link-redirect": "http://example.com/",
    "link-orig": "http://example.com/",
    "link-orig-esc": "http%3A%2F%2Fexample.com%2F",
    "mac": "FA:E2:31:5C:9D:10",
    "mac-esc": "FA%3AE2%3A31%3A5C%3A9D%3A10",
    "ip": "192.0.2.10",
    "location-id": "lokasi-01",
    "username": "",
    "error": "",
    "error-orig": "",
    "login-by": "http-chap",
    "logged-in": "yes",
    "chap-id": r"\357",
    "chap-challenge": r"\357\015\243\002\377\101\177\033\200\061\147\330\012\376\274\225",
    "bytes-in": "1234567",
    "bytes-out": "987654321",
    "uptime-secs": "3725",
    "session-time-left-secs": "82475",
    "remain-bytes-total": "5368709120",
    "refresh-timeout": "",
    "refresh-timeout-secs": "",
    "advert-pending": "no",
    "blocked": "no",
}

DEFAULT_ERROR = "Simultaneous connections limited to 2"

DIRECTIVE = re.compile(r"\$\((if|elif|else|endif)(?:\s+([^)]*))?\)")
VARIABLE = re.compile(r"\$\(([A-Za-z][A-Za-z0-9_-]*)\)")
COMPARE = re.compile(r"""^([A-Za-z][A-Za-z0-9_-]*)\s*(==|!=)\s*(.+)$""")


def scenario_context(name, error_text):
    ctx = dict(BASE)
    if name == "error":
        ctx["error"] = error_text
        ctx["username"] = "V1BADCODE"
    elif name == "nochap":
        ctx["chap-id"] = ""
        ctx["chap-challenge"] = ""
    return ctx


def evaluate(cond, ctx):
    """Kondisi MikroTik: `var` (tidak kosong), `var == 'x'`, `var != 'x'`."""
    m = COMPARE.match(cond)
    if m:
        name, op, literal = m.groups()
        literal = literal.strip()
        if len(literal) >= 2 and literal[0] == literal[-1] and literal[0] in "'\"":
            literal = literal[1:-1]
        equal = ctx.get(name, "") == literal
        return equal if op == "==" else not equal
    return ctx.get(cond.strip(), "") != ""


def render(text, ctx, source, unknown):
    out = []
    stack = []  # (induk aktif, sudah ada cabang yang terambil)
    active = True
    pos = 0

    for m in DIRECTIVE.finditer(text):
        if active:
            out.append(text[pos:m.start()])
        pos = m.end()
        kind = m.group(1)
        cond = (m.group(2) or "").strip()

        if kind == "if":
            ok = active and evaluate(cond, ctx)
            stack.append((active, ok))
            active = ok
            continue

        if not stack:
            raise ValueError("%s: $(%s) tanpa $(if)" % (source, kind))
        parent, taken = stack.pop()

        if kind == "elif":
            ok = parent and not taken and evaluate(cond, ctx)
            stack.append((parent, taken or ok))
            active = ok
        elif kind == "else":
            ok = parent and not taken
            stack.append((parent, True))
            active = ok
        else:  # endif
            active = parent

    if stack:
        raise ValueError("%s: $(if) tanpa $(endif)" % source)
    if active:
        out.append(text[pos:])

    def value(m):
        name = m.group(1)
        if name not in ctx:
            unknown.add(name)
        return ctx.get(name, "")

    return VARIABLE.sub(value, "".join(out))


def copy_assets(asset_base):
    for name in ASSETS:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, OUT / name)
    for name in ASSET_FILES:
        src = ROOT / name
        if src.is_file():
            shutil.copy2(src, OUT / name)

    if asset_base:
        cfg = OUT / "portal-config.js"
        body = cfg.read_text(encoding="utf-8")
        body, n = re.subn(r"assetBase:\s*'[^']*'", "assetBase: '%s'" % asset_base, body)
        if n != 1:
            raise ValueError("assetBase tidak ditemukan di portal-config.js")
        cfg.write_text(body, encoding="utf-8", newline="\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("scenario", nargs="?", default="normal", choices=["normal", "error", "nochap"])
    parser.add_argument("--error", default=DEFAULT_ERROR, help="teks error untuk skenario error")
    parser.add_argument("--asset-base", help="ganti assetBase di preview/portal-config.js")
    args = parser.parse_args()

    # Hanya hapus folder preview/ di dalam repo ini.
    if OUT.exists():
        if OUT.name != "preview" or OUT.parent != ROOT:
            sys.exit("Menolak menghapus %s" % OUT)
        shutil.rmtree(OUT)
    OUT.mkdir()
    copy_assets(args.asset_base)

    ctx = scenario_context(args.scenario, args.error)
    unknown = set()
    for page in PAGES:
        src = ROOT / page
        html = render(src.read_text(encoding="utf-8"), ctx, page, unknown)
        (OUT / page).write_text(html, encoding="utf-8", newline="\n")
        print("ok  %s" % page)

    if unknown:
        print("peringatan: variabel tanpa nilai contoh: %s" % ", ".join(sorted(unknown)), file=sys.stderr)
    print("skenario %s -> %s" % (args.scenario, OUT))


if __name__ == "__main__":
    main()

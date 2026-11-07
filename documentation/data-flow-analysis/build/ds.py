"""Design-system import for the report build (the "token import").

Reads the SongNodes design system from the repo (single source of truth) and returns:
- inline-safe tokens.css (fonts embedded as base64), bundle.css, bundle.js for the self-contained page;
- svg_css: tokens.css without @font-face + the generated light block + the .sn-m-* module scopes,
  copied verbatim from bundle.css, for standalone SVG files;
- tokens.json values for places that cannot read CSS variables (PDF running header/footer).
Same rules as docs/design-system/build_standalone.py.
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]          # repo root (…/songnodes)
DS = ROOT / "design-system"


def _read(p):
    return Path(p).read_text(encoding="utf-8")


def safe_css(css):
    css = re.sub(r"</(style)", r"<\\/\1", css, flags=re.I)
    return css.replace("<!--", "<\\!--")


def safe_js(js):
    js = re.sub(r"</(script)", r"<\\/\1", js, flags=re.I)
    return js.replace("<!--", "\\x3C!--")


def embed_fonts(css):
    def repl(m):
        f = DS / m.group(1)
        return 'url("data:font/woff2;base64,%s")' % base64.b64encode(f.read_bytes()).decode("ascii")
    return re.sub(r'url\("(fonts/[^"]+\.woff2)"\)', repl, css)


def load():
    tokens_css = _read(DS / "tokens.css")
    bundle_css = _read(DS / "components" / "bundle.css")
    bundle_js = _read(DS / "components" / "bundle.js")
    tokens = json.loads(_read(DS / "tokens.json"))
    no_fonts = re.sub(r"@font-face\s*\{[^}]*\}", "", tokens_css)
    m = re.search(r"@media \(prefers-color-scheme: light\) \{.*?\n\}\n\}", bundle_css, re.S)
    light = m.group(0) if m else ""
    scopes = "\n".join(re.findall(r"^\.sn-m-[a-z]+\s*\{[^}]*\}", bundle_css, re.M))
    return {
        "version": tokens["version"],
        "tokens_css": safe_css(embed_fonts(tokens_css)),
        "bundle_css": safe_css(bundle_css),
        "bundle_js": safe_js(bundle_js),
        "svg_css": no_fonts + "\n" + light + "\n" + scopes,
        "tokens": tokens,
    }


def token_value(tokens, name, theme="light"):
    """A colour token's value in a theme, from tokens.json (for the PDF header/footer templates)."""
    def walk(o):
        if isinstance(o, dict):
            if o.get("name") == name and isinstance(o.get("value"), dict):
                return o["value"].get(theme)
            for v in o.values():
                r = walk(v)
                if r:
                    return r
        elif isinstance(o, list):
            for v in o:
                r = walk(v)
                if r:
                    return r
        return None
    return walk(tokens)


def type_style(tokens, name):
    for g in tokens["type"]["groups"]:
        for s in g["styles"]:
            if s["name"] == name:
                return s
    raise KeyError(name)


def family(tokens, key):
    return tokens["type"]["families"][key]

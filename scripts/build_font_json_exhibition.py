# -*- coding: utf-8 -*-
"""
Font JSON Exhibition builder.

Reads every font JSON in "Yuan Prometheus Screenshots/font JSON", walks the
provided transcript in narrative order, assigns transcript phrases of matching
word counts to every typography layer, and emits FONT_JSON_EXHIBITION.html
showing each profile over its original reference screenshot.

Font resolution order per layer candidate:
  1. local library (remotion-app/public/fonts/**, Fraunces/)
  2. Google Fonts (curated list)
  3. curated fallback stacks (system fonts)
  4. heuristic stack derived from the layer's font_classification

Usage: python scripts/build_font_json_exhibition.py
"""

from __future__ import annotations

import html
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
JSON_DIR = ROOT / "Yuan Prometheus Screenshots" / "font JSON"
PNG_DIR = ROOT / "Yuan Prometheus Screenshots" / "font pairing and placement"
OUT = ROOT / "FONT_JSON_EXHIBITION.html"

FONT_DIRS = [
    ROOT / "remotion-app" / "public" / "fonts",
    ROOT / "Fraunces",
]

# ---------------------------------------------------------------- transcript
TITLE = "THE REAL REASON YOUR BUSINESS ISN'T GROWING"

UNITS = [
    "Most businesses don't", "have a marketing problem.",
    "They have a", "business model problem.",
    "And I know", "that sounds obvious.",
    "But most founders", "completely miss it.",
    "They think they", "need more traffic.",
    "More followers.", "More leads.", "More content.", "More ads.",
    "So they start", "throwing money everywhere.",
    "They hire an agency.", "They run Facebook ads.",
    "They start posting", "every single day.",
    "And somehow,", "nothing changes.",
    "Why?",
    "Because they're trying", "to pour more water",
    "into a bucket", "that's already leaking.",
    "That's the real problem.",
    "Your business doesn't", "need more attention.",
    "It needs more efficiency.",
    "Think about what", "happens next.",
    "Someone discovers", "your company.",
    "They see your content.", "They click your profile.",
    "They visit your website.", "They look at your offer.",
    "And then they disappear.",
    "Why?",
    "Because there's friction", "everywhere.",
    "The message isn't clear.", "The offer isn't compelling.",
    "The proof isn't strong.", "The buying process drags.",
    "Nobody understands", "why they should choose you.",
    "So the founder says,", "\"We need more leads.\"",
    "No.",
    "You need to convert", "the leads you have.",
    "Here's what happens.",
    "Let's say you're generating", "one hundred leads monthly.",
    "And you close five.",
    "Your first instinct", "is probably simple.",
    "\"Let's get", "two hundred leads.\"",
    "But what happens", "if you simply",
    "double your conversion rate?",
    "You don't need", "two hundred leads.",
    "You need one hundred.",
    "And you make", "twice as much money.",
    "That's the difference", "between growth",
    "and real business building.",
    "Growth isn't just", "about adding more.",
    "It's about getting", "more from what exists.",
    "More revenue from", "the same traffic.",
    "More customers from", "the same leads.",
    "More profit from", "the same revenue.",
    "More output from", "the same team.",
    "That's where", "most founders get stuck.",
    "They optimize the", "visible problem.",
    "Not the actual constraint.",
    "So ask yourself:",
    "Where is", "the bottleneck?",
    "Not,", "\"What can we add?\"",
    "Ask,", "\"What's limiting growth?\"",
    "Because there's", "always something.",
    "Maybe it's traffic.", "Maybe it's conversion.",
    "Maybe it's retention.", "Maybe it's pricing.",
    "Maybe it's fulfillment.",
    "Maybe it's", "your sales process.",
    "Or maybe,", "it's simply", "the founder.",
    "And yes,", "sometimes the founder", "is the bottleneck.",
    "Everything needs", "their approval.",
    "Every client needs", "their attention.",
    "Every decision comes", "back to them.",
    "So the business", "can't move faster",
    "than one person", "can move.",
    "That's not", "a scalable company.",
    "That's a job", "with employees.",
    "The goal isn't", "becoming busier.",
    "The goal is", "building systems.",
    "Systems create", "repeatable results.",
    "And repeatable results", "create scalable businesses.",
    "So stop asking,", "\"How do I", "get bigger?\"",
    "Ask instead,", "\"What breaks", "if I grow?\"",
    "That's usually", "where the answer lives.",
    "Fix the bottleneck.", "Then increase volume.",
    "Don't scale chaos.", "Scale what works.",
]

TOKENS = TITLE.split() + [w for u in UNITS for w in u.split()]

# ---------------------------------------------------------------- fonts
GOOGLE_FONTS = {
    "Inter", "Outfit", "Bodoni Moda", "Playfair Display", "Montserrat",
    "Cormorant Garamond", "DM Sans", "Dancing Script", "Bebas Neue",
    "Poppins", "Oswald", "Archivo Black", "Big Shoulders Display",
    "Barlow Condensed", "Great Vibes", "Alex Brush", "DM Serif Display",
    "Anton", "Antonio", "Abril Fatface", "Archivo", "Black Han Sans",
    "Fraunces", "Lato", "League Gothic", "Pacifico", "Raleway",
    "Roboto Slab", "Rozha One", "Saira Extra Condensed", "Six Caps",
    "Space Mono", "Teko", "Press Start 2P", "VT323", "Special Elite",
    "IM Fell English", "Italiana", "Italianno", "Allura", "Sacramento",
    "Satisfy", "Caveat", "Kalam", "Parisienne", "Yellowtail",
    "Cinzel Decorative", "Plus Jakarta Sans", "Open Sans",
    "Source Sans 3", "Source Serif 4",
}

# candidate name -> resolved display family / stack
NAME_ALIASES = {
    "Senza Bella": "SenzaBella",
    "SenzaBella": "SenzaBella",
    "Amerika": "Amerika Alternates",
    "Helvetica": "Helvetica Neue",
    "Source Sans": "Source Sans 3",
    "Source Serif": "Source Serif 4",
    "Saira ExtraCondensed": "Saira Extra Condensed",
    "Aesthetic": "Aesthetic Beauty CF",
    "Montserrat Black": "Montserrat",
    "Montserrat ExtraBold": "Montserrat",
    "Montserrat Thin": "Montserrat",
    "Inter Black": "Inter",
    "Inter Thin": "Inter",
    "Haas Unica Black": "Haas Unica",
    "Quanton PERSONAL USE ONLY": "Quanton",
    "Blaak Thin PERSONAL USE": "Blaak",
}

FALLBACK_STACKS = {
    "Helvetica Neue": "'Helvetica Neue', Arial, sans-serif",
    "Helvetica Now Display": "'Inter', 'Helvetica Neue', Arial, sans-serif",
    "Helvetica Now": "'Inter', 'Helvetica Neue', Arial, sans-serif",
    "Neue Haas Grotesk": "'Inter', 'Helvetica Neue', Arial, sans-serif",
    "Neue Haas Grotesk Display": "'Inter', 'Helvetica Neue', Arial, sans-serif",
    "Didot": "'Bodoni Moda', 'Didot', serif",
    "Impact": "'Anton', Impact, 'Archivo Black', sans-serif",
    "Aesthetic Beauty CF": "'Great Vibes', 'Pinyon Script', cursive",
    "SF Pro Display": "'Inter', 'Helvetica Neue', Arial, sans-serif",
    "Apple Garamond": "'Cormorant Garamond', Garamond, serif",
    "Lemon Milk": "'Montserrat', sans-serif",
    "MADE Mirage": "'Playfair Display', serif",
    "The Glamoure": "'Great Vibes', cursive",
    "Paris Forbel": "'Italianno', cursive",
    "Brushelva": "'Dancing Script', cursive",
    "Candlescript": "'Great Vibes', cursive",
    "Dr Exclusive Editorial": "'Playfair Display', serif",
    "Leviathan": "'Bodoni Moda', serif",
    "Silver Hairline": "'Great Vibes', cursive",
    "Monrovia-ModernSerifFont": "'Playfair Display', serif",
    "Almera": "'Bodoni Moda', serif",
    "Haas Unica": "'Inter', sans-serif",
}

SUFFIX_RE = re.compile(
    r"\s+(Italic|Black|Thin|ExtraBold|Extra Condensed|Display|Bold|"
    r"PERSONAL USE ONLY|PERSONAL USE|Trial)$"
)


def norm_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


STRIP_TOKENS = {
    "rg", "bd", "it", "bi", "bold", "regular", "medium", "light", "thin",
    "black", "italic", "oblique", "extrabold", "semibold", "extralight",
    "demo", "trial", "personal", "used", "personaluseonly", "display",
    "condensed", "otf", "ttf", "variablefont", "soft", "wonk", "opsz", "wght",
}


def index_local_fonts():
    """Map normalized family names -> first font file found on disk.

    Registers, for every font file: the full stem, the stem with hash suffix
    removed, and iterative trailing-token strips (weight/trial/numeric tokens),
    so 'echelon-rg-<hash>' also answers to 'echelon'.
    """
    idx = {}
    exts = (".otf", ".ttf", ".woff2", ".woff")
    for base in FONT_DIRS:
        for p in sorted(base.rglob("*")):
            if p.suffix.lower() not in exts or p.stat().st_size == 0:
                continue
            names = set()
            stem = re.sub(r"-?[0-9a-f]{10,}$", "", p.stem)  # trailing hex hash
            tokens = stem.split("-")
            names.add(stem)
            while len(tokens) > 1 and (
                tokens[-1].lower() in STRIP_TOKENS or tokens[-1].isdigit()
            ):
                tokens.pop()
                names.add("-".join(tokens))
            for n in names:
                key = norm_key(n)
                if key and len(key) >= 3:
                    idx.setdefault(key, p)
            # also register parent dir name (library/<family>/<file>)
            parent = norm_key(p.parent.name)
            if parent and len(parent) >= 3:
                idx.setdefault(parent, p)
    return idx


LOCAL_INDEX = index_local_fonts()


def heuristic_stack(candidates, classification):
    blob = (classification or "") + " " + " ".join(candidates or [])
    blob = blob.lower()
    if any(k in blob for k in ("script", "calligraphy", "cursive", "brush", "handwritten")):
        return "'Great Vibes', 'Segoe Script', cursive"
    if any(k in blob for k in ("mono", "machine", "terminal", "typewriter")):
        return "'Courier Prime', 'Courier New', monospace"
    if any(k in blob for k in ("serif", "didone", "garamond", "roman")):
        return "'Bodoni Moda', Georgia, serif"
    return "'Inter', Arial, sans-serif"


def resolve_family(candidates, classification=""):
    """Return (css_font_family, canonical_name, status)."""
    for name in candidates or []:
        n = name.strip()
        base = SUFFIX_RE.sub("", n).strip()
        for cand in (n, base, base.replace(" ", "")):
            p = LOCAL_INDEX.get(norm_key(cand))
            if p:
                fam = base if base not in ("",) else n
                return f"'{fam}'", fam, "local"
        if n in NAME_ALIASES:
            n = base = NAME_ALIASES[n]
            p = LOCAL_INDEX.get(norm_key(base))
            if p:
                return f"'{base}'", base, "local"
        if base in NAME_ALIASES:
            base = NAME_ALIASES[base]
        if base in GOOGLE_FONTS:
            return f"'{base}', sans-serif", base, "google"
        if n in FALLBACK_STACKS:
            return FALLBACK_STACKS[n], n, "fallback"
        if base in FALLBACK_STACKS:
            return FALLBACK_STACKS[base], base, "fallback"
    return heuristic_stack(candidates, classification), (candidates[0] if candidates else "serif"), "fallback"


# ---------------------------------------------------------------- phrase bank
def build_banks():
    exact = defaultdict(list)
    for u in UNITS:
        exact[len(u.split())].append(u)
    exact[7].insert(0, TITLE)
    return exact


class PhraseGiver:
    """Yields phrases of a requested word count, transcript-ordered."""

    def __init__(self, exact):
        self.exact = exact
        self.cursor = defaultdict(int)
        self.tok_cursor = 0
        self.synth_used = defaultdict(int)

    def take(self, n):
        bank = self.exact.get(n, [])
        i = self.cursor[n]
        if bank and i < len(bank):
            self.cursor[n] = i + 1
            return bank[i], "exact"
        words = TOKENS[self.tok_cursor:self.tok_cursor + n]
        self.tok_cursor += n
        if self.tok_cursor >= len(TOKENS) - n:
            self.tok_cursor = 0
        self.synth_used[n] += 1
        return " ".join(words), "synth"

    def peek_all(self, n):
        return len(self.exact.get(n, []))

# ---------------------------------------------------------------- rendering
def esc(s):
    return html.escape(str(s), quote=True)


def text_shadow_css(effects):
    shadows = []
    ds = effects.get("drop_shadow")
    if isinstance(ds, dict):
        shadows.append(
            f"{ds.get('x_offset', 0)}px {ds.get('y_offset', 0)}px "
            f"{ds.get('blur_radius', 0)}px {ds.get('color', 'rgba(0,0,0,.4)')}"
        )
    glow = effects.get("glow")
    if isinstance(glow, dict):
        r = glow.get("radius", 10)
        c = glow.get("color", "rgba(255,255,255,.6)")
        shadows.append(f"0 0 {r}px {c}")
        shadows.append(f"0 0 {max(2, r // 2)}px {c}")
    ca = effects.get("chromatic_aberration")
    if isinstance(ca, dict):
        shadows.append(f"{ca.get('red_offset', 2)}px 0 rgba(255,0,60,.55)")
        shadows.append(f"{ca.get('blue_offset', -2)}px 0 rgba(0,120,255,.55)")
    return ", ".join(shadows)


def luminance_gradient_css(grad):
    """Deep-tone -> blown-white vertical luminance gradient."""
    low, high = grad.get("low", "#123"), grad.get("high", "#FFFFFF")
    return f"linear-gradient(178deg, {low} 0%, {low} 38%, #FFFFFF 62%, {high} 78%)"


def chrome_gradient_css(chrome):
    """Iridescent chrome: warm bronze -> blown silver, angled."""
    stops = chrome.get("stops") or CHROME_STOPS_DEFAULT
    angle = chrome.get("angle", 105)
    body = ", ".join(f"{c} {int(i * 100 / (len(stops) - 1))}%" for i, c in enumerate(stops))
    return f"linear-gradient({angle}deg, {body})"


CHROME_STOPS_DEFAULT = ["#8A5A2B", "#C98A4B", "#E8D9C0", "#FFFFFF", "#B9BEC9"]


def specular_overlay_css(sweep):
    """CC-Light-Sweep-style angled white band, screen-composited via extra
    text-shadow layers (works inside background-clip:text)."""
    return None  # rendered as a separate gradient stop, see layer_css


def layer_css(layer, frame_w, design_w):
    fs = layer.get("font_style") or {}
    fx = layer.get("effects") or {}
    casing = str(fs.get("casing", "normal")).lower()
    transform = {
        "uppercase": "uppercase", "lowercase": "lowercase",
        "title_case": "capitalize", "title": "capitalize",
        "normal": "none", "mixed": "none",
    }.get(casing, "none")
    family, _used, _status = resolve_family(
        layer.get("matched_font_candidates") or [], layer.get("font_classification")
    )
    # fluid sizing: px in design space -> cqw of the frame width
    def cq(px):
        return f"{float(px) / design_w * 100:.3f}cqw"

    decls = [
        f"font-family:{family}",
        f"font-weight:{fs.get('weight', 700)}",
        f"font-style:{'italic' if str(fs.get('style', '')).lower() == 'italic' else 'normal'}",
        f"font-size:{cq(float(fs.get('size_px_base', 32)) * float(fs.get('relative_scale', 1.0)))}",
        f"letter-spacing:{fs.get('letter_spacing_em', 0)}em",
        f"line-height:{fs.get('line_height', 1.05)}",
        f"color:{fs.get('color', '#FFFFFF')}",
        f"text-transform:{transform}",
        f"margin-top:{cq(float(fs.get('vertical_margin_top_px', 0)))}",
    ]

    matte = fx.get("matte_editorial")
    if isinstance(matte, dict) and matte.get("enabled"):
        # 0% specular: flat fill, no gradient, no shadow
        return ";".join(decls)

    bg_image_parts = []
    clip_text = False
    chrome = fx.get("metallic_chrome")
    lum = fx.get("luminance_gradient")
    grad = fx.get("vertical_gradient") or fx.get("gradient")
    sweep = fx.get("specular_sweep")

    if isinstance(chrome, dict):
        angle = chrome.get("angle", 105)
        stops = chrome.get("stops") or CHROME_STOPS_DEFAULT
        band = chrome.get("specular_band") or {}
        pos = float(band.get("position", 0.62))
        width = float(band.get("width", 0.2))
        body = ", ".join(f"{c} {int(i * 100 / (len(stops) - 1))}%" for i, c in enumerate(stops))
        # interleave a white-hot specular band
        band_start = max(0.0, pos - width / 2) * 100
        band_end = min(100.0, pos + width / 2) * 100
        bg_image_parts.append(
            f"linear-gradient({angle}deg, {body}, #FFFFFF {band_start:.0f}%, {body.split(', ')[-1]} {band_end:.0f}%)"
        )
        clip_text = True
    elif isinstance(lum, dict):
        low, high = lum.get("low", "#123"), lum.get("high", "#FFFFFF")
        if isinstance(sweep, dict):
            angle = sweep.get("angle", 115)
            band_w = float(sweep.get("width", 0.22)) * 100
            intensity = float(sweep.get("intensity", 0.9))
            bg_image_parts.append(
                f"linear-gradient({angle}deg, rgba(255,255,255,0) 40%, "
                f"rgba(255,255,255,{intensity}) 50%, rgba(255,255,255,0) 60%)"
            )
        bg_image_parts.append(
            f"linear-gradient(178deg, {low} 0%, {low} 38%, #FFFFFF 62%, {high} 80%)"
        )
        clip_text = True
    elif isinstance(grad, str) and "gradient(" in grad:
        if fx.get("glass_reflection"):
            bg_image_parts.append(
                "linear-gradient(105deg, rgba(255,255,255,.45) 0%, "
                "rgba(255,255,255,.12) 35%, rgba(255,255,255,0) 55%)"
            )
        bg_image_parts.append(grad)
        clip_text = True

    if clip_text and bg_image_parts:
        decls += [
            f"background-image:{', '.join(bg_image_parts)}",
            "-webkit-background-clip:text", "background-clip:text",
            "color:transparent", "-webkit-text-fill-color:transparent",
        ]
        if fx.get("glass_reflection"):
            decls.append("filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))")
    else:
        ts = text_shadow_css(fx)
        if ts:
            decls.append(f"text-shadow:{ts}")
    return ";".join(decls)


def profile_cards(name, data, giver):
    meta = data.get("metadata") or {}
    rules = data.get("layout_rules") or {}
    layers = data.get("typography_layers") or []
    aspect = meta.get("target_aspect_ratio", "16:9")
    tall = aspect == "9:16"
    design_w = 1080 if tall else 1280
    frame_w = 450 if tall else 800
    frame_h = frame_w * (16 / 9) if tall else frame_w * (9 / 16)

    assigned = [None] * len(layers)
    flags = []
    nonzero = [(i, int(l.get("word_count") or len((l.get("sample_text") or "").split())))
               for i, l in enumerate(layers)]
    all_empty = all(wc <= 0 for _, wc in nonzero)
    if all_empty and layers:
        title_words = re.findall(r"[A-Za-z0-9']+", data.get("profile_name", ""))
        n = len(layers)
        cuts = [0] * (n + 1)
        for k in range(1, n):
            cuts[k] = min(len(title_words) - (n - k), max(k, round(len(title_words) * k / n)))
        cuts[n] = len(title_words)
        for k in range(n):
            nonzero[k] = (k, max(0, cuts[k + 1] - cuts[k]))
        flags.append(
            f"layer word counts recovered from profile title ({len(title_words)} words: "
            + ", ".join(f"L{k+1}={wc}" for k, (_, wc) in enumerate(nonzero)) + ")"
        )
    echo_slots = [i for i, l in enumerate(layers)
                  if not l.get("sample_text") and (l.get("word_count") in (0, None))]
    for i, wc in nonzero:
        if wc <= 0:
            continue
        phrase, src = giver.take(wc)
        assigned[i] = phrase
        if src != "exact":
            flags.append(f"{wc}-word phrase synthesized from transcript stream")
    for i in echo_slots:
        if all_empty:
            break
        donor = next((p for p in assigned if p), None)
        if donor:
            assigned[i] = donor
            flags.append("echo layer mirrors sibling text (word_count 0)")
    # final sweep: no layer ships empty
    donor = next((p for p in assigned if p), None)
    for i, layer in enumerate(layers):
        if assigned[i] or (layer.get("sample_text") or "").strip():
            continue
        if donor:
            assigned[i] = donor
            flags.append("empty layer mirrors sibling text (fallback)")

    halign = rules.get("horizontal_alignment", "center")
    vpos = rules.get("vertical_position", "center")
    max_w = rules.get("max_width_percent", 88)
    bottom_m = rules.get("bottom_margin_percent", 12)
    stack_style = (
        f"max-width:{max_w}%;"
        + ("align-items:flex-start;text-align:left;" if halign == "left" else "align-items:center;text-align:center;")
        + ("top:50%;transform:translateY(-50%);" if vpos == "center" else f"top:{bottom_m}%;")
    )

    scrim = rules.get("scrim_overlay") or {}
    scrim_div = ""
    if scrim.get("enabled") and scrim.get("type") not in (None, "none"):
        op = float(scrim.get("opacity", 0.4))
        col = scrim.get("color", "#000000")
        if scrim.get("type") == "radial_vignette":
            bg = f"radial-gradient(ellipse at center, transparent 35%, {col} 160%)"
            scrim_div = f'<div class="scrim" style="background:{bg};opacity:{op:.2f}"></div>'
        elif scrim.get("type") == "linear_gradient":
            bg = f"linear-gradient(180deg, {col} 0%, transparent 65%)"
            scrim_div = f'<div class="scrim" style="background:{bg};opacity:{op:.2f}"></div>'

    png = PNG_DIR / f"{Path(name).stem}.png"
    bg = ""
    if png.is_file():
        bg = f'<img class="bg" src="{quote(str(png.relative_to(ROOT))).replace("%5C", "/")}" alt="">'

    layers_html = []
    for i, layer in enumerate(layers):
        txt = assigned[i] if assigned[i] else (layer.get("sample_text") or "")
        style = layer_css(layer, frame_w, design_w)
        layers_html.append(f'<div class="layer" style="{esc(style)}">{esc(txt)}</div>')

    fams = ", ".join(dict.fromkeys(
        (l.get("matched_font_candidates") or ["-"])[0]
        for l in layers if l.get("matched_font_candidates")
    ))
    wc_badges = " ".join(f'<span class="chip">{wc}w</span>' for _, wc in nonzero if wc > 0)
    flags = list(dict.fromkeys(flags))
    corr = ((data.get("metadata") or {}).get("correction_notes") or [])
    for c in corr:
        flags.append(c.split(":")[0] + " (spec corrected)")
    flag_html = f'<div class="flags">{esc(" | ".join(sorted(set(flags))))}</div>' if flags else ""
    card_id = re.sub(r"[^A-Za-z0-9_-]", "", Path(name).stem)
    return f"""
<article class="card" data-aspect="{aspect}" id="card-{card_id}">
  <header><b>{esc(data.get('profile_name', name))}</b>
    <span class="file">{esc(name)}</span>
    <span class="chip asp">{aspect}</span> {wc_badges}
  </header>
  <div class="frame {'tall' if tall else 'wide'}">
    {bg}{scrim_div}
    <div class="stack" style="{esc(stack_style)}">{''.join(layers_html)}</div>
  </div>
  <footer><span class="fonts">{esc(fams)}</span>{flag_html}</footer>
</article>"""

# ---------------------------------------------------------------- main
def main():
    files = sorted(JSON_DIR.glob("*.json"))
    giver = PhraseGiver(build_banks())

    demand = Counter()
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8-sig"))
        for l in (data.get("typography_layers") or []):
            wc = int(l.get("word_count") or 0) or len((l.get("sample_text") or "").split())
            if wc > 0:
                demand[wc] += 1

    cards, used_google, used_local, fallback_fams, used_fontfaces = [], set(), set(), set(), {}
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8-sig"))
        cards.append(profile_cards(f.name, data, giver))
        for l in (data.get("typography_layers") or []):
            fam, canonical, status = resolve_family(
                l.get("matched_font_candidates") or [], l.get("font_classification")
            )
            if status == "google":
                used_google.add(canonical)
            elif status == "local":
                used_local.add(canonical)
                p = LOCAL_INDEX.get(norm_key(canonical)) or LOCAL_INDEX.get(norm_key(fam))
                if p and canonical not in used_fontfaces:
                    used_fontfaces[canonical] = p
            else:
                fallback_fams.add(canonical)

    google_links = "&".join(
        f"family={quote(n)}:wght@300;400;600;700;800;900" for n in sorted(used_google)
    )
    fontfaces = "\n".join(
        f"@font-face{{font-family:'{n}';"
        f"src:url('{quote(str(p.relative_to(ROOT))).replace('%5C', '/')}');"
        for n, p in sorted(used_fontfaces.items())
    )

    report_rows = []
    for wc in sorted(demand):
        exact_n = giver.peek_all(wc)
        synth_n = giver.synth_used.get(wc, 0)
        status = "OK" if exact_n >= 1 and synth_n == 0 else ("PARTIAL" if exact_n else "SYNTH")
        report_rows.append(
            f"<tr><td>{wc} words</td><td>{demand[wc]} layers</td>"
            f"<td>{exact_n} transcript phrases</td><td>{synth_n} synthesized</td>"
            f"<td class='s-{status.lower()}'>{status}</td></tr>"
        )

    total = len(files)
    aspects = Counter()
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8-sig"))
        aspects[(d.get("metadata") or {}).get("target_aspect_ratio", "16:9")] += 1

    html_out = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Font JSON Exhibition — {esc(TITLE)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?{google_links}&display=swap" rel="stylesheet">
<style>
{fontfaces}
body{{margin:0;background:#0d0f14;color:#e8eaf0;font-family:Inter,system-ui,sans-serif}}
h1{{font-size:28px;margin:24px 16px 4px}} .sub{{margin:0 16px 16px;color:#9aa3b5}}
.report{{margin:0 16px 24px;padding:14px 18px;background:#161a23;border-radius:12px;font-size:14px}}
.report table{{border-collapse:collapse}} .report td,.report th{{padding:4px 14px;text-align:left;border-bottom:1px solid #232838}}
.s-ok{{color:#4ade80}}.s-partial{{color:#fbbf24}}.s-synth{{color:#f87171}}
.bar{{margin:0 16px 16px;display:flex;gap:8px;flex-wrap:wrap}}
.bar button{{background:#1c2230;border:1px solid #2a3245;color:#cdd6e6;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px}}
.bar button.on{{background:#3b5bdb;color:#fff}}
#q{{background:#1c2230;border:1px solid #2a3245;color:#e8eaf0;border-radius:8px;padding:6px 12px;font-size:13px;width:220px}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 10px 40px}}
@media(min-width:1900px){{.grid{{grid-template-columns:repeat(4,1fr)}}}}
@media(max-width:1200px){{.grid{{grid-template-columns:repeat(2,1fr)}}}}
.card{{background:#12151c;border:1px solid #232a3a;border-radius:10px;padding:8px;min-width:0;display:flex;flex-direction:column}}
.card header{{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;font-size:12px}}
.card header b{{font-size:12px;word-break:break-word}}
.card footer{{margin-top:6px;font-size:10px;color:#8b97b0;display:flex;flex-direction:column;gap:3px}}
.frame,.frame img.bg,.stack{{max-width:100%}}
.frame{{position:relative;border-radius:8px;overflow:hidden;background:#000;margin:0 auto;container-type:inline-size}}
.frame.tall{{width:100%;aspect-ratio:9/16}}
.frame.wide{{width:100%;aspect-ratio:16/9}}
.frame img.bg{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.scrim{{position:absolute;inset:0}}
.stack{{position:absolute;left:50%;transform:translate(-50%);display:flex;flex-direction:column;width:88%;pointer-events:none}}
.flags{{color:#fbbf24}}
</style></head><body>
<h1>Font JSON Exhibition</h1>
<p class="sub">Transcript: “{esc(TITLE)}” &nbsp;·&nbsp; {total} font JSON profiles &nbsp;·&nbsp;
{aspects.get('16:9', 0)} landscape (16:9) · {aspects.get('9:16', 0)} vertical (9:16)</p>
<div class="report"><b>Transcript fit report</b>
<table><tr><th>Layer demand</th><th></th><th>Transcript supply</th><th></th><th>Status</th></tr>
{''.join(report_rows)}</table>
<p>Each layer took a transcript phrase of its exact word count, walking the transcript in narrative
order. “Synthesized” phrases were stitched from the transcript word stream where standalone phrases
of that length ran out — those cards are flagged below.</p></div>
<div class="bar" id="bar">
<button data-f="all" class="on">All {total}</button>
<button data-f="16:9">Landscape</button>
<button data-f="9:16">Vertical</button>
<input id="q" placeholder="search profile or file…">
</div>
<div class="grid">
{''.join(cards)}
</div>
<script>
const bar=document.getElementById('bar'),q=document.getElementById('q');
let mode='all';const cards=[...document.querySelectorAll('.card')];
function apply(){{const t=q.value.toLowerCase();
cards.forEach(c=>{{const okF=mode==='all'||c.dataset.aspect===mode;
const okT=!t||c.textContent.toLowerCase().includes(t);
c.style.display=okF&&okT?'':'none';}});}}
bar.addEventListener('click',e=>{{if(e.target.dataset.f){{mode=e.target.dataset.f;
bar.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===e.target));apply();}}}});
q.addEventListener('input',apply);
</script></body></html>"""

    OUT.write_text(html_out, encoding="utf-8")
    print(f"cards: {total} -> {OUT.name} ({OUT.stat().st_size / 1024:.0f} KB)")
    print("local font files wired:", len(used_fontfaces))
    print("google fonts:", ", ".join(sorted(used_google)))
    print("fallback-only families:", ", ".join(sorted(fallback_fams)) or "none")
    print("synth usage:", dict(giver.synth_used) or "none")


if __name__ == "__main__":
    sys.exit(main())

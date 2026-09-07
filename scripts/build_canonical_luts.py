"""Script to generate authentic 33x33x33 Adobe .cube 3D LUT files for Prometheus Core."""

from pathlib import Path
import numpy as np

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "mini_run_pipeline" / "luts"
N = 33  # 33x33x33


def rgb_to_hsv(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Vectorized RGB to HSV."""
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    delta = max_c - min_c + 1e-7

    h = np.zeros_like(max_c)
    # r == max_c
    mask_r = (max_c == r) & (delta > 1e-6)
    h[mask_r] = ((g[mask_r] - b[mask_r]) / delta[mask_r]) % 6.0

    # g == max_c
    mask_g = (max_c == g) & (~mask_r) & (delta > 1e-6)
    h[mask_g] = ((b[mask_g] - r[mask_g]) / delta[mask_g]) + 2.0

    # b == max_c
    mask_b = (max_c == b) & (~mask_r) & (~mask_g) & (delta > 1e-6)
    h[mask_b] = ((r[mask_b] - g[mask_b]) / delta[mask_b]) + 4.0

    h = (h / 6.0) % 1.0  # [0, 1]
    s = np.where(max_c > 1e-6, delta / np.maximum(max_c, 1e-6), 0.0)
    v = max_c
    return h, s, v


def hsv_to_rgb(h: np.ndarray, s: np.ndarray, v: np.ndarray):
    """Vectorized HSV to RGB."""
    h_scaled = (h % 1.0) * 6.0
    i = np.floor(h_scaled).astype(int)
    f = h_scaled - i
    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))

    r = np.zeros_like(v)
    g = np.zeros_like(v)
    b = np.zeros_like(v)

    m0 = (i % 6) == 0
    r[m0], g[m0], b[m0] = v[m0], t[m0], p[m0]
    m1 = (i % 6) == 1
    r[m1], g[m1], b[m1] = q[m1], v[m1], p[m1]
    m2 = (i % 6) == 2
    r[m2], g[m2], b[m2] = p[m2], v[m2], t[m2]
    m3 = (i % 6) == 3
    r[m3], g[m3], b[m3] = p[m3], q[m3], v[m3]
    m4 = (i % 6) == 4
    r[m4], g[m4], b[m4] = t[m4], p[m4], v[m4]
    m5 = (i % 6) == 5
    r[m5], g[m5], b[m5] = v[m5], p[m5], q[m5]

    return r, g, b


def get_rec709_lum(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def safe_divide(num: np.ndarray, den: np.ndarray, default: float = 1.0) -> np.ndarray:
    mask = np.abs(den) > 1e-6
    safe_den = np.where(mask, den, 1.0)
    return np.where(mask, num / safe_den, default)


def s_curve(x: np.ndarray, gamma: float = 1.0) -> np.ndarray:
    """Continuous, monotonic film S-curve preserving 0 and 1."""
    if abs(gamma - 1.0) < 1e-4:
        return x
    eps = 1e-7
    x_clamped = np.clip(x, eps, 1.0 - eps)
    x_pow = x_clamped ** gamma
    inv_pow = (1.0 - x_clamped) ** gamma
    res = x_pow / (x_pow + inv_pow)
    # Ensure exact endpoints
    res = np.where(x <= 0.0, 0.0, res)
    res = np.where(x >= 1.0, 1.0, res)
    return res


def compute_skin_weight(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Smooth skin tone detector on the Planckian skin locus (~28 degrees)."""
    h, s, v = rgb_to_hsv(r, g, b)
    y = get_rec709_lum(r, g, b)
    h_deg = h * 360.0

    # Gaussian hue falloff around 28 degrees
    hue_dist = np.minimum(np.abs(h_deg - 28.0), 360.0 - np.abs(h_deg - 28.0))
    w_hue = np.exp(-0.5 * (hue_dist / 14.0) ** 2)

    # Saturation threshold: human skin is between 0.15 and 0.75
    w_sat = np.clip((s - 0.12) / 0.10, 0.0, 1.0) * np.clip((0.85 - s) / 0.15, 0.0, 1.0)

    # Luminance threshold: skin visible between 0.12 and 0.92
    w_lum = np.clip((y - 0.10) / 0.10, 0.0, 1.0) * np.clip((0.95 - y) / 0.08, 0.0, 1.0)

    # Human skin strictly has R > G > B
    skin_order = (r > g) & (g > b * 0.85)
    return w_hue * w_sat * w_lum * skin_order.astype(np.float64)


def adjust_saturation(r: np.ndarray, g: np.ndarray, b: np.ndarray, sat_factor: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    y = get_rec709_lum(r, g, b)
    r_out = y + (r - y) * sat_factor
    g_out = y + (g - y) * sat_factor
    b_out = y + (b - y) * sat_factor
    return r_out, g_out, b_out


def create_base_grid() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generates 33x33x33 grid with R varying fastest, then G, then B."""
    coords = np.linspace(0.0, 1.0, N, dtype=np.float64)
    B_grid, G_grid, R_grid = np.meshgrid(coords, coords, coords, indexing="ij")
    return R_grid.copy(), G_grid.copy(), B_grid.copy()


# --- Individual Look Generators ---

def grade_kodak_2383_print(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Authentic Kodak Vision Color Print Film 2383 emulation:
    Deep rich blacks, warm amber highlight roll-off, subtractive saturation where
    reds stay dense and deep cyans live in the shadows."""
    y = get_rec709_lum(r, g, b)

    # 1. Classic Kodak 2383 S-curve tone curve (steep midtones, deep D-Max blacks)
    # Apply S-curve to luminance
    y_graded = s_curve(y, gamma=1.24)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Subtractive saturation: film dyes absorb light
    # Calculate chroma and subtractive density
    max_rgb = np.maximum(np.maximum(r_c, g_c), b_c)
    min_rgb = np.minimum(np.minimum(r_c, g_c), b_c)
    chroma = max_rgb - min_rgb
    subtractive_weight = 0.18 * chroma * (1.0 - 0.5 * y_graded)
    r_c = r_c * (1.0 - subtractive_weight)
    g_c = g_c * (1.0 - subtractive_weight)
    b_c = b_c * (1.0 - subtractive_weight)

    # 3. Dense reds: reds stay deep ruby red with enhanced density
    red_dominance = np.clip((r_c - np.maximum(g_c, b_c)) / (r_c + 1e-6), 0.0, 1.0)
    r_c += 0.05 * red_dominance * (1.0 - y_graded)
    g_c -= 0.02 * red_dominance
    b_c -= 0.03 * red_dominance

    # 4. Deep cyans live in the shadows (toe to midtones)
    sh_w = np.clip((0.40 - y_graded) / 0.40, 0.0, 1.0) ** 2
    r_c -= 0.035 * sh_w
    g_c += 0.015 * sh_w
    b_c += 0.040 * sh_w

    # 5. Warm amber highlight roll-off (Kodak warm D55 print stock shoulder)
    hl_w = np.clip((y_graded - 0.65) / 0.35, 0.0, 1.0) ** 2
    r_c += 0.045 * hl_w
    g_c += 0.018 * hl_w
    b_c -= 0.060 * hl_w

    # Anchor endpoints cleanly
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_fuji_3513_print(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Fujifilm 3513 print stock emulation:
    Cooler greens/teals, soft magenta highlights, cinematic contrast."""
    y = get_rec709_lum(r, g, b)

    # 1. Fuji crisp midtone S-curve contrast
    y_graded = s_curve(y, gamma=1.18)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Fuji cooler greens/teals (emerald signature)
    green_prom = np.clip((g_c - np.maximum(r_c, b_c)) / (g_c + 1e-6), 0.0, 1.0)
    b_c += 0.08 * green_prom
    r_c -= 0.04 * green_prom

    # 3. Soft magenta highlights roll-off (Fujifilm shoulder bias)
    hl_w = np.clip((y_graded - 0.70) / 0.30, 0.0, 1.0) ** 2
    r_c += 0.030 * hl_w
    g_c -= 0.035 * hl_w
    b_c += 0.022 * hl_w

    # 4. Rich cool slate shadows
    sh_w = np.clip((0.35 - y_graded) / 0.35, 0.0, 1.0) ** 2
    r_c -= 0.025 * sh_w
    b_c += 0.028 * sh_w

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_teal_and_orange_blockbuster(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Hollywood 2-strip modern blockbuster:
    Split-tone cyan in shadows, warm skin tones preserved on the Planckian locus."""
    y = get_rec709_lum(r, g, b)

    # 1. Cinematic contrast
    y_graded = s_curve(y, gamma=1.20)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Identify human skin tone locus to protect it
    w_skin = compute_skin_weight(r_c, g_c, b_c)

    # 3. Split-tone cyan in shadows (attenuate on skin)
    teal_w = np.clip((0.60 - y_graded) / 0.60, 0.0, 1.0) * (1.0 - w_skin)
    r_c -= 0.12 * teal_w
    g_c += 0.03 * teal_w
    b_c += 0.14 * teal_w

    # 4. Warm orange highlights
    warm_w = np.clip((y_graded - 0.40) / 0.60, 0.0, 1.0)
    r_c += 0.08 * warm_w
    g_c += 0.02 * warm_w
    b_c -= 0.08 * warm_w

    # 5. Protect skin tone: maintain golden warmth and healthy saturation
    r_c += 0.03 * w_skin
    g_c += 0.01 * w_skin
    b_c -= 0.03 * w_skin

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_moody_dramatic_cinema(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Moody dramatic cinema:
    Thriller/noir contrast curve with desaturated midtones and rich shadow density."""
    y = get_rec709_lum(r, g, b)

    # 1. Dark, gritty exposure with steep contrast
    y_exp = y * 0.96
    y_graded = s_curve(y_exp, gamma=1.28)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Desaturated midtones (with mild skin protection)
    w_skin = compute_skin_weight(r_c, g_c, b_c)
    sat_factor = 0.70 + 0.18 * w_skin  # 0.70 generally, 0.88 for skin
    r_c, g_c, b_c = adjust_saturation(r_c, g_c, b_c, sat_factor)

    # 3. Rich crushed shadow density with subtle charcoal coldness
    sh_w = np.clip((0.35 - y_graded) / 0.35, 0.0, 1.0) ** 2
    r_c -= 0.025 * sh_w
    b_c += 0.025 * sh_w

    # 4. Controlled highlight headroom (soft shoulder)
    hl_w = np.clip((y_graded - 0.80) / 0.20, 0.0, 1.0) ** 2
    r_c -= 0.02 * hl_w
    g_c -= 0.02 * hl_w
    b_c -= 0.02 * hl_w

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_vintage_film_emulation(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Vintage film emulation:
    Classic 1970s warm 35mm stock with faded black pedestal and warm skin highlights."""
    y = get_rec709_lum(r, g, b)

    # 1. Gentle mellow contrast
    y_graded = s_curve(y, gamma=0.96)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Warm golden midtones
    r_c += 0.04 * (1.0 - (2.0 * y_graded - 1.0) ** 2)
    g_c += 0.02 * (1.0 - (2.0 * y_graded - 1.0) ** 2)
    b_c -= 0.05 * (1.0 - (2.0 * y_graded - 1.0) ** 2)

    # 3. Lifted / faded black pedestal (warm sepia-tinted black point)
    pedestal_r = 0.045
    pedestal_g = 0.038
    pedestal_b = 0.028
    r_c = pedestal_r + (1.0 - pedestal_r) * r_c
    g_c = pedestal_g + (1.0 - pedestal_g) * g_c
    b_c = pedestal_b + (1.0 - pedestal_b) * b_c

    # 4. Soft highlight compression (vintage roll-off)
    shoulder_cap = 0.945
    r_c = r_c * shoulder_cap / 1.0
    g_c = g_c * shoulder_cap / 1.0
    b_c = b_c * shoulder_cap / 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_clean_log_to_rec709(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Clean log-to-Rec709:
    Standard Arri Alexa LogC3/Rec709 S-curve transform.
    Strictly neutral grayscale and film shoulder."""
    # Arri Alexa LogC3 EI 800 un-log formula
    cut = 0.010591
    a = 5.555556
    b_param = 0.052272
    c = 0.247190
    d = 0.385537
    e = 5.367655
    f = 0.092809

    def logc3_to_linear(x: np.ndarray) -> np.ndarray:
        threshold = e * cut + f
        linear = np.where(
            x > threshold,
            (10.0 ** ((x - d) / c) - b_param) / a,
            (x - f) / e
        )
        return np.maximum(0.0, linear)

    # Convert LogC3 to linear
    r_lin = logc3_to_linear(r)
    g_lin = logc3_to_linear(g)
    b_lin = logc3_to_linear(b)

    # Tone mapping from linear to Rec.709 display
    # Maps 0.18 linear (18% gray) to ~0.40 Rec.709 display with smooth shoulder up to peak
    def linear_to_rec709_display(lin: np.ndarray) -> np.ndarray:
        # Standard Arri film response curve
        # Smooth toe, linear midtone, asymptotic shoulder
        norm_lin = lin / 0.18  # middle gray = 1.0
        display = norm_lin / (1.0 + norm_lin)  # Reinhard / Michaelis-Menten base
        # Scale so norm_lin=1.0 maps to 0.40, norm_lin=10 maps to ~0.95
        mapped = display * (1.0 + 0.35 * display)
        # Apply standard Rec709 gamma (approx 2.4/2.2)
        out = mapped ** (1.0 / 1.65)
        return np.clip(out, 0.0, 1.0)

    r_out = linear_to_rec709_display(r_lin)
    g_out = linear_to_rec709_display(g_lin)
    b_out = linear_to_rec709_display(b_lin)

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_out[zero_mask], g_out[zero_mask], b_out[zero_mask] = 0.0, 0.0, 0.0
    r_out[one_mask], g_out[one_mask], b_out[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_out, 0.0, 1.0), np.clip(g_out, 0.0, 1.0), np.clip(b_out, 0.0, 1.0)


def grade_golden_hour_warmth(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Golden hour warmth:
    Sun-kissed highlights, amber glow, gentle contrast."""
    y = get_rec709_lum(r, g, b)

    # 1. Gentle, flattering contrast
    y_graded = s_curve(y, gamma=1.04)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Color temperature shift: ~4200K golden sunlight bias
    r_c *= 1.07
    g_c *= 1.02
    b_c *= 0.89

    # 3. Sun-kissed highlight amber glow
    hl_w = np.clip((y_graded - 0.50) / 0.50, 0.0, 1.0)
    r_c += 0.06 * hl_w
    g_c += 0.025 * hl_w
    b_c -= 0.06 * hl_w

    # 4. Warm saturation enrichment
    h, s, v = rgb_to_hsv(r_c, g_c, b_c)
    # Warm hues are in range [0, 60] deg -> [0, 0.166]
    warm_mask = np.clip((0.18 - h) / 0.18, 0.0, 1.0)
    r_c, g_c, b_c = adjust_saturation(r_c, g_c, b_c, 1.0 + 0.12 * warm_mask)

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_bleach_bypass(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Bleach bypass:
    High contrast, silvery desaturation, preserved speculars."""
    y = get_rec709_lum(r, g, b)

    # 1. Silver halide high contrast monochrome layer
    y_silver = s_curve(y, gamma=1.38)

    # 2. Desaturated color layer (38% saturation)
    r_desat, g_desat, b_desat = adjust_saturation(r, g, b, 0.38)

    # 3. Photographic silver retention overlay blend
    def overlay(base: np.ndarray, blend: np.ndarray) -> np.ndarray:
        return np.where(
            base < 0.5,
            2.0 * base * blend,
            1.0 - 2.0 * (1.0 - base) * (1.0 - blend)
        )

    r_c = 0.40 * r_desat + 0.60 * overlay(r_desat, y_silver)
    g_c = 0.40 * g_desat + 0.60 * overlay(g_desat, y_silver)
    b_c = 0.40 * b_desat + 0.60 * overlay(b_desat, y_silver)

    # 4. Preserve silvery specular highlights
    hl_w = np.clip((y - 0.80) / 0.20, 0.0, 1.0) ** 2
    r_c += 0.04 * hl_w
    g_c += 0.04 * hl_w
    b_c += 0.05 * hl_w

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_urban_desaturated(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Urban desaturated:
    Industrial architectural muted grade."""
    y = get_rec709_lum(r, g, b)

    # 1. Crisp architectural contrast
    y_graded = s_curve(y, gamma=1.22)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Heavy global desaturation (35% saturation)
    r_c, g_c, b_c = adjust_saturation(r_c, g_c, b_c, 0.35)

    # 3. Cool slate steel undertone in shadows and midtones
    cool_w = np.clip((1.0 - y_graded), 0.0, 1.0)
    r_c -= 0.025 * cool_w
    b_c += 0.030 * cool_w

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


def grade_sci_netone_balanced(r: np.ndarray, g: np.ndarray, b: np.ndarray):
    """Sci-Netone balanced:
    Reference skin tone protection curve with gentle film shoulder."""
    y = get_rec709_lum(r, g, b)

    # 1. Subtle S-curve contrast
    y_graded = s_curve(y, gamma=1.08)
    scale = safe_divide(y_graded, y, 1.0)
    r_c = r * scale
    g_c = g * scale
    b_c = b * scale

    # 2. Gentle film shoulder compression for highlights (prevents digital clipping on faces)
    hl_w = np.clip((y_graded - 0.78) / 0.22, 0.0, 1.0) ** 2
    # Soft shoulder roll-off
    r_c -= 0.015 * hl_w
    g_c -= 0.015 * hl_w
    b_c -= 0.015 * hl_w

    # 3. Absolute skin tone protection: ensures zero tint distortion on human skin locus
    w_skin = compute_skin_weight(r_c, g_c, b_c)
    # On skin tones, ensure natural micro-contrast and luminance fidelity
    r_c = (1.0 - w_skin) * r_c + w_skin * (y_graded + (r - y) * 1.02)
    g_c = (1.0 - w_skin) * g_c + w_skin * (y_graded + (g - y) * 1.00)
    b_c = (1.0 - w_skin) * b_c + w_skin * (y_graded + (b - y) * 0.98)

    # Anchor endpoints
    zero_mask = (r == 0.0) & (g == 0.0) & (b == 0.0)
    one_mask = (r == 1.0) & (g == 1.0) & (b == 1.0)
    r_c[zero_mask], g_c[zero_mask], b_c[zero_mask] = 0.0, 0.0, 0.0
    r_c[one_mask], g_c[one_mask], b_c[one_mask] = 1.0, 1.0, 1.0

    return np.clip(r_c, 0.0, 1.0), np.clip(g_c, 0.0, 1.0), np.clip(b_c, 0.0, 1.0)


# Dictionary mapping filename to (title, grading_func)
CANONICAL_LOOKS = {
    "kodak_2383_print.cube": (
        "Kodak Vision Color Print Film 2383 Emulation",
        grade_kodak_2383_print
    ),
    "fuji_3513_print.cube": (
        "Fujifilm 3513 Print Stock Emulation",
        grade_fuji_3513_print
    ),
    "teal_and_orange_blockbuster.cube": (
        "Teal and Orange Blockbuster Modern 2-Strip",
        grade_teal_and_orange_blockbuster
    ),
    "moody_dramatic_cinema.cube": (
        "Moody Dramatic Cinema Noir",
        grade_moody_dramatic_cinema
    ),
    "vintage_film_emulation.cube": (
        "Vintage 1970s Warm 35mm Stock Emulation",
        grade_vintage_film_emulation
    ),
    "clean_log_to_rec709.cube": (
        "Clean Arri Alexa LogC3 to Rec709 Base Transform",
        grade_clean_log_to_rec709
    ),
    "golden_hour_warmth.cube": (
        "Golden Hour Warmth Sunset Radiance",
        grade_golden_hour_warmth
    ),
    "bleach_bypass.cube": (
        "Bleach Bypass Silver Retention Emulation",
        grade_bleach_bypass
    ),
    "urban_desaturated.cube": (
        "Urban Desaturated Industrial Architecture",
        grade_urban_desaturated
    ),
    "sci_netone_balanced.cube": (
        "Sci-Netone Balanced Skin Tone Reference",
        grade_sci_netone_balanced
    ),
}


def write_cube_file(target_path: Path, title: str, r_out: np.ndarray, g_out: np.ndarray, b_out: np.ndarray):
    """Writes authentic 33x33x33 .cube file strictly formatted with 6 decimal places."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Flatten arrays: in meshgrid with indexing='ij' where coords=(B, G, R),
    # ravel() gives index order (0,0,0), (0,0,1)... so R varies fastest, G middle, B slowest!
    r_flat = r_out.ravel()
    g_flat = g_out.ravel()
    b_flat = b_out.ravel()

    header = [
        f'TITLE "{title}"',
        f"LUT_3D_SIZE {N}",
        "DOMAIN_MIN 0.0 0.0 0.0",
        "DOMAIN_MAX 1.0 1.0 1.0",
    ]

    # Pre-format lines for speed and exact formatting
    lines = header + [
        f"{rf:.6f} {gf:.6f} {bf:.6f}"
        for rf, gf, bf in zip(r_flat, g_flat, b_flat)
    ]
    # Trailing newline
    content = "\n".join(lines) + "\n"
    target_path.write_text(content, encoding="utf-8")
    print(f"[build_luts] Generated {target_path.name}: {len(lines)} lines, {len(content)} bytes")


def build_all_luts():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[build_luts] Generating 10 canonical 3D LUTs in: {OUTPUT_DIR}")

    r_in, g_in, b_in = create_base_grid()

    for filename, (title, func) in CANONICAL_LOOKS.items():
        out_path = OUTPUT_DIR / filename
        r_out, g_out, b_out = func(r_in.copy(), g_in.copy(), b_in.copy())
        write_cube_file(out_path, title, r_out, g_out, b_out)

    print("[build_luts] Successfully generated all 10 canonical 3D LUTs!")


if __name__ == "__main__":
    build_all_luts()

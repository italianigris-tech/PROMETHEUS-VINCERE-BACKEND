/**
 * PROMETHEUS CORE — BRAND & MICRO-ASSET VECTOR REGISTRY
 * 
 * Procedural SVG Vector Generators & Micro-Animation Suite for
 * E-commerce, Tech Giants, Social Networks, SaaS, and Physical Entities.
 */

export type BrandCategory = "marketplace" | "tech_giant" | "social" | "saas_dev";

export interface BrandAssetDefinition {
  id: string;
  name: string;
  category: BrandCategory;
  keywords: string[];
  regex: RegExp;
  colorHex: string;
  accentGlow: string;
  defaultPosition: "left_shoulder" | "right_shoulder" | "center_stage" | "top_banner";
  renderWidthPx: number;
  microAnimation: "hologram_laser_scan" | "specular_glow_pulse" | "elastic_badge_pop" | "stroke_draw_reveal";
  audioCue: string;
  generator: () => string;
}

function toBase64Svg(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg.trim()).toString("base64");
}

// 1. EBAY (Multi-color letters in 120×120 square-core — matches Instagram square-core format)
export function generateEbayBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none">
  <defs>
    <filter id="ebayGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(229,50,56,0.55)"/>
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.7)"/>
    </filter>
    <linearGradient id="ebayBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.99"/>
    </linearGradient>
  </defs>
  <!-- Square Core with eBay-red accent stroke -->
  <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#ebayBg)" stroke="rgba(229,50,56,0.45)" stroke-width="2" filter="url(#ebayGlow)"/>
  <!-- Subpixel laser-edge accent -->
  <rect x="6" y="6" width="108" height="108" rx="26" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1" stroke-dasharray="6 5"/>
  <!-- eBay Multi-Color Letterforms — scaled to fill square -->
  <g transform="translate(8, 16)">
    <!-- 'e' Red -->
    <text x="0"  y="58" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="52" fill="#E53238" letter-spacing="-3">e</text>
    <!-- 'b' Blue -->
    <text x="26" y="58" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="52" fill="#0064D2" letter-spacing="-3">b</text>
    <!-- 'a' Yellow -->
    <text x="56" y="58" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="52" fill="#F5AF02" letter-spacing="-3">a</text>
    <!-- 'y' Green -->
    <text x="83" y="58" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="52" fill="#86B817" letter-spacing="-3">y</text>
  </g>
  <!-- Verified badge pip -->
  <circle cx="96" cy="28" r="9" fill="#0064D2"/>
  <path d="M 92 28 L 95 31 L 100 25" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);
}

// 2. AMAZON (Standalone "a" logomark in 120×120 square-core — matches Instagram square-core format)
export function generateAmazonBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none">
  <defs>
    <filter id="amazonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="rgba(255,153,0,0.5)"/>
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.75)"/>
    </filter>
    <linearGradient id="amzCardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#131921" stop-opacity="0.97"/>
      <stop offset="100%" stop-color="#0B0E14" stop-opacity="0.99"/>
    </linearGradient>
  </defs>
  <!-- Square Core — Amazon orange accent stroke -->
  <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#amzCardBg)" stroke="rgba(255,153,0,0.5)" stroke-width="2.5" filter="url(#amazonGlow)"/>
  <!-- Subpixel laser-edge accent -->
  <rect x="6" y="6" width="108" height="108" rx="26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="6 5"/>
  <!-- Amazon standalone "a" lettermark — centered in square -->
  <text x="24" y="82" font-family="'Amazon Ember', 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="72" fill="#FFFFFF" letter-spacing="-2">a</text>
  <!-- Characteristic orange smile-arrow — beneath the lettermark -->
  <path d="M 22 91 Q 60 108 96 91" stroke="#FF9900" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <!-- Arrow tip on right end -->
  <path d="M 90 86 L 98 91 L 90 96 Q 95 91 90 86" fill="#FF9900"/>
</svg>`);
}


// 3. ETSY (Warm artisanal orange card)
export function generateEtsyBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120" fill="none">
  <defs>
    <filter id="etsyShadow"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(0,0,0,0.6)"/></filter>
    <linearGradient id="etsyBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2D1810" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#1A0D08" stop-opacity="0.98"/>
    </linearGradient>
  </defs>
  <rect x="8" y="10" width="204" height="100" rx="26" fill="url(#etsyBg)" stroke="#F16521" stroke-width="2" filter="url(#etsyShadow)"/>
  <text x="45" y="72" font-family="'Georgia', serif" font-weight="bold" font-size="52" fill="#F16521">Etsy</text>
</svg>`);
}

// 4. LINKEDIN (Cobalt professional square badge)
export function generateLinkedInBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120" fill="none">
  <defs>
    <filter id="liShadow"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(10,102,194,0.4)"/></filter>
  </defs>
  <rect x="8" y="10" width="204" height="100" rx="26" fill="#0A66C2" filter="url(#liShadow)"/>
  <rect x="24" y="24" width="72" height="72" rx="14" fill="#FFFFFF"/>
  <text x="36" y="78" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="56" fill="#0A66C2">in</text>
  <text x="110" y="70" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="28" fill="#FFFFFF">PRO</text>
</svg>`);
}

// 5. INSTAGRAM (Vibrant Magenta/Purple Radial Gradient)
export function generateInstagramBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120" fill="none">
  <defs>
    <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD600"/>
      <stop offset="25%" stop-color="#FF0069"/>
      <stop offset="65%" stop-color="#D300C5"/>
      <stop offset="100%" stop-color="#7638FA"/>
    </linearGradient>
    <filter id="igGlow"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(211,0,197,0.4)"/></filter>
  </defs>
  <rect x="8" y="10" width="204" height="100" rx="28" fill="url(#igGrad)" filter="url(#igGlow)"/>
  <!-- Camera Glyph -->
  <rect x="36" y="28" width="64" height="64" rx="18" stroke="#FFFFFF" stroke-width="5" fill="none"/>
  <circle cx="68" cy="60" r="16" stroke="#FFFFFF" stroke-width="5" fill="none"/>
  <circle cx="85" cy="43" r="4.5" fill="#FFFFFF"/>
  <text x="114" y="70" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF">LIVE</text>
</svg>`);
}

// 6. SHOPIFY (Emerald green bag with white glyph)
export function generateShopifyBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120" fill="none">
  <defs>
    <filter id="shopGlow"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(150,191,67,0.4)"/></filter>
  </defs>
  <rect x="8" y="10" width="204" height="100" rx="26" fill="#0E1E14" stroke="#96BF43" stroke-width="2" filter="url(#shopGlow)"/>
  <!-- Shopping Bag -->
  <path d="M 45 42 L 55 35 Q 65 30 75 35 L 85 42 L 92 88 L 38 88 Z" fill="#96BF43"/>
  <path d="M 54 38 Q 65 24 76 38" stroke="#5E8E3E" stroke-width="4" fill="none"/>
  <text x="54" y="74" font-family="'Helvetica Neue', sans-serif" font-weight="900" font-size="34" fill="#0E1E14">S</text>
  <text x="108" y="70" font-family="'Helvetica Neue', sans-serif" font-weight="800" font-size="24" fill="#96BF43">STORE</text>
</svg>`);
}

// 7. STRIPE (Deep Indigo with glowing angled badge)
export function generateStripeBadgeSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120" fill="none">
  <defs>
    <filter id="stripeGlow"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(99,91,255,0.4)"/></filter>
  </defs>
  <rect x="8" y="10" width="204" height="100" rx="26" fill="#635BFF" filter="url(#stripeGlow)"/>
  <text x="38" y="72" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="44" fill="#FFFFFF" letter-spacing="-1">stripe</text>
</svg>`);
}

// 8. 3D PHYSICAL SHIPPING BOX / INVENTORY ASSET (For 12,000 physical products)
export function generatePhysicalProductsBoxSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" width="240" height="220" fill="none">
  <defs>
    <filter id="boxShadow"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="rgba(0,0,0,0.6)"/></filter>
    <linearGradient id="boxTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="boxLeft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#B45309"/>
      <stop offset="100%" stop-color="#78350F"/>
    </linearGradient>
    <linearGradient id="boxRight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#92400E"/>
      <stop offset="100%" stop-color="#451A03"/>
    </linearGradient>
  </defs>
  <!-- Isometric 3D Cardboard Shipping Package -->
  <g filter="url(#boxShadow)">
    <!-- Top Face -->
    <polygon points="120,25 195,65 120,105 45,65" fill="url(#boxTop)"/>
    <!-- Left Face -->
    <polygon points="45,65 120,105 120,190 45,150" fill="url(#boxLeft)"/>
    <!-- Right Face -->
    <polygon points="120,105 195,65 195,150 120,190" fill="url(#boxRight)"/>
    <!-- Packing Tape Strip across Top & Sides -->
    <polygon points="110,30 130,40 130,190 110,180" fill="rgba(255,255,255,0.18)"/>
    <!-- Barcode & Fragile Label -->
    <rect x="58" y="112" width="38" height="24" rx="2" fill="#F8FAFC" transform="skewY(18)"/>
    <line x1="62" y1="126" x2="62" y2="142" stroke="#000" stroke-width="2"/>
    <line x1="68" y1="128" x2="68" y2="144" stroke="#000" stroke-width="1.5"/>
    <line x1="74" y1="130" x2="74" y2="146" stroke="#000" stroke-width="3"/>
    <line x1="82" y1="132" x2="82" y2="148" stroke="#000" stroke-width="2"/>
  </g>
  <!-- Floating Telemetry Quantity Badge -->
  <rect x="135" y="115" width="85" height="30" rx="15" fill="#00F0FF" stroke="#FFFFFF" stroke-width="1.5"/>
  <text x="146" y="135" font-family="'DM Sans', sans-serif" font-weight="900" font-size="14" fill="#070913">12,000+</text>
</svg>`);
}

// 9. SIX FIGURES / PURE PROFIT FINANCIAL CLIMAX BADGE
export function generateSixFiguresProfitSvg(): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180" fill="none">
  <defs>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(234,179,8,0.5)"/>
    </filter>
    <linearGradient id="goldPlate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="35%" stop-color="#EAB308"/>
      <stop offset="70%" stop-color="#CA8A04"/>
      <stop offset="100%" stop-color="#854D0E"/>
    </linearGradient>
  </defs>
  <!-- Golden Vault Radiance Shield -->
  <rect x="12" y="20" width="216" height="140" rx="28" fill="#111827" stroke="url(#goldPlate)" stroke-width="3" filter="url(#goldGlow)"/>
  <!-- Specular Gold Star Accent -->
  <path d="M 120 30 L 126 44 L 140 46 L 130 56 L 132 70 L 120 63 L 108 70 L 110 56 L 100 46 L 114 44 Z" fill="url(#goldPlate)"/>
  <text x="32" y="105" font-family="'DM Sans', sans-serif" font-weight="900" font-size="28" fill="url(#goldPlate)" letter-spacing="1">SIX FIGURES</text>
  <text x="65" y="135" font-family="'DM Sans', sans-serif" font-weight="800" font-size="15" fill="#38BDF8" letter-spacing="3">PURE PROFIT</text>
</svg>`);
}

// =============================================================================
// COMPREHENSIVE BRAND & ENTITY REGISTRY
// =============================================================================
export const COMPREHENSIVE_BRAND_REGISTRY: BrandAssetDefinition[] = [
  {
    id: "brand_ebay",
    name: "eBay E-Commerce Marketplace",
    category: "marketplace",
    keywords: ["ebay", "ebay.com", "e2a", "auction"],
    regex: /\b(ebay(\.com)?|e2a)\b/i,
    colorHex: "#E53238",
    accentGlow: "rgba(229,50,56,0.5)",
    defaultPosition: "right_shoulder",
    renderWidthPx: 120,
    microAnimation: "hologram_laser_scan",
    audioCue: "HUD Optical Ping & Mechanical Ratchet Click (Z:10, 1400Hz)",
    generator: () => generateEbayBadgeSvg()
  },
  {
    id: "brand_amazon",
    name: "Amazon E-Commerce & Prime",
    category: "marketplace",
    keywords: ["amazon", "amazon.com", "fba", "prime"],
    regex: /\b(amazon(\.com)?|fba|prime)\b/i,
    colorHex: "#FF9900",
    accentGlow: "rgba(255,153,0,0.5)",
    defaultPosition: "left_shoulder",
    renderWidthPx: 120,
    microAnimation: "specular_glow_pulse",
    audioCue: "HUD Optical Ping (Z:10, 1400Hz)",
    generator: () => generateAmazonBadgeSvg()
  },
  {
    id: "brand_etsy",
    name: "Etsy Artisan Marketplace",
    category: "marketplace",
    keywords: ["etsy", "etsy.com", "handmade"],
    regex: /\b(etsy(\.com)?|handmade)\b/i,
    colorHex: "#F16521",
    accentGlow: "rgba(241,101,33,0.5)",
    defaultPosition: "right_shoulder",
    renderWidthPx: 200,
    microAnimation: "elastic_badge_pop",
    audioCue: "Avatar Pop Acoustic Resonance (Z:20, 6500Hz)",
    generator: () => generateEtsyBadgeSvg()
  },
  {
    id: "brand_linkedin",
    name: "LinkedIn Professional Network",
    category: "social",
    keywords: ["linkedin", "linkedin.com"],
    regex: /\b(linkedin(\.com)?)\b/i,
    colorHex: "#0A66C2",
    accentGlow: "rgba(10,102,194,0.5)",
    defaultPosition: "left_shoulder",
    renderWidthPx: 200,
    microAnimation: "elastic_badge_pop",
    audioCue: "HUD Optical Scan Ping (Z:10, 1400Hz)",
    generator: () => generateLinkedInBadgeSvg()
  },
  {
    id: "brand_instagram",
    name: "Instagram Meta Platform",
    category: "social",
    keywords: ["instagram", "instagram.com", "ig"],
    regex: /\b(instagram(\.com)?|ig)\b/i,
    colorHex: "#D300C5",
    accentGlow: "rgba(211,0,197,0.5)",
    defaultPosition: "right_shoulder",
    renderWidthPx: 200,
    microAnimation: "specular_glow_pulse",
    audioCue: "HUD Optical Ping (Z:10, 1400Hz)",
    generator: () => generateInstagramBadgeSvg()
  },
  {
    id: "brand_shopify",
    name: "Shopify Merchant Commerce",
    category: "saas_dev",
    keywords: ["shopify", "shopify.com"],
    regex: /\b(shopify(\.com)?)\b/i,
    colorHex: "#96BF43",
    accentGlow: "rgba(150,191,67,0.5)",
    defaultPosition: "left_shoulder",
    renderWidthPx: 200,
    microAnimation: "stroke_draw_reveal",
    audioCue: "HUD Optical Ping (Z:10, 1400Hz)",
    generator: () => generateShopifyBadgeSvg()
  },
  {
    id: "brand_stripe",
    name: "Stripe Global Payments",
    category: "saas_dev",
    keywords: ["stripe", "stripe.com"],
    regex: /\b(stripe(\.com)?)\b/i,
    colorHex: "#635BFF",
    accentGlow: "rgba(99,91,255,0.5)",
    defaultPosition: "right_shoulder",
    renderWidthPx: 200,
    microAnimation: "elastic_badge_pop",
    audioCue: "HUD Optical Ping (Z:10, 1400Hz)",
    generator: () => generateStripeBadgeSvg()
  }
];

/**
 * Match spoken statement to authoritative brand vector asset
 */
export function resolveBrandAsset(text: string): BrandAssetDefinition | null {
  for (const item of COMPREHENSIVE_BRAND_REGISTRY) {
    if (item.regex.test(text)) {
      return item;
    }
  }
  return null;
}

export const resolveBrandOrPhysicalAsset = resolveBrandAsset;


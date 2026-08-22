/**
 * SEMANTIC EXTRACTION AUDIT — runs every Transcript 1 chunk through
 * the semantic router AND the brand resolver side by side.
 */
import { routeStatementToArchetypes } from "./semantic_archetype_router.js";
import { COMPREHENSIVE_BRAND_REGISTRY } from "./brand_vector_registry.js";

const chunks = [
  { i: 1,  text: "Over the last" },
  { i: 2,  text: "12 months," },
  { i: 3,  text: "I've purchased more" },
  { i: 4,  text: "than 12,000 physical" },
  { i: 5,  text: "products from eBay.com" },
  { i: 6,  text: "that I've then" },
  { i: 7,  text: "resold on Amazon" },
  { i: 8,  text: "for more than" },
  { i: 9,  text: "six figures in" },
  { i: 10, text: "Pure profit." },
  { i: 11, text: "And the best" },
  { i: 12, text: "part is," },
  { i: 13, text: "I've done it" },
  { i: 14, text: "all from home." },
  { i: 15, text: "Sometimes in my" },
  { i: 16, text: "pajamas, sometimes in" },
  { i: 17, text: "my Sunday best." },
  { i: 18, text: "The point is," },
  { i: 19, text: "the choice was mine." },
  { i: 20, text: "Sounds like a" },
];

function resolveBrand(text: string) {
  for (const item of COMPREHENSIVE_BRAND_REGISTRY) {
    if (item.regex.test(text)) return item;
  }
  return null;
}

const DIV = "─".repeat(90);

console.log("\n" + DIV);
console.log("  SEMANTIC EXTRACTION AUDIT  —  Transcript 1 (eBay/Amazon/Six Figures)");
console.log(DIV + "\n");

for (const chunk of chunks) {
  const result = routeStatementToArchetypes(chunk.text);
  const brand = resolveBrand(chunk.text);
  const e = result.extractedEntities;

  const tokenGroups: { cat: string; tokens: string[] }[] = [
    { cat: "BRANDS",       tokens: e.brands },
    { cat: "TOOLS",        tokens: e.concreteTools },
    { cat: "CONCEPTS",     tokens: e.abstractConcepts },
    { cat: "HUMAN ROLES",  tokens: e.humanRoles },
    { cat: "METRICS $",    tokens: e.metrics },
    { cat: "PERCENTAGES",  tokens: e.percentages },
    { cat: "TIME MARKERS", tokens: e.timeMarkers },
    { cat: "CONTRASTS",    tokens: e.contrastPairs },
    { cat: "STEP/LIST",    tokens: e.steps },
  ].filter(g => g.tokens.length > 0);

  const pa = result.primaryArchetype;

  console.log(`┌─ Chunk #${String(chunk.i).padEnd(2)}  "${chunk.text}"`);
  console.log(`│  Primary Archetype : [${pa.archetypeSerial}] ${pa.archetypeName}`);
  console.log(`│  Confidence        : ${(pa.confidence * 100).toFixed(0)}%`);
  console.log(`│  Router Reason     : ${pa.reason}`);

  if (tokenGroups.length > 0) {
    console.log(`│  Extracted Tokens  :`);
    for (const g of tokenGroups) {
      console.log(`│    ${g.cat.padEnd(16)}: ${g.tokens.join(", ")}`);
    }
  } else {
    console.log(`│  Extracted Tokens  : (none — no tokens found)`);
  }

  if (brand) {
    console.log(`│  ⚠️  BRAND REGISTRY FIRED → "${brand.id}"  (${brand.name})`);
    console.log(`│     Matched regex : ${brand.regex}`);
    console.log(`│     ★ This OVERRIDES the semantic router. Asset shown regardless of archetype.`);
  } else {
    console.log(`│  Brand Resolver   : no match`);
  }

  console.log("└" + "─".repeat(88));
  console.log();
}

console.log(DIV);
console.log("  REGISTRY TYPE AUDIT  —  COMPREHENSIVE_BRAND_REGISTRY membership");
console.log(DIV);
console.log();
console.log(`  ${"ID".padEnd(32)} ${"CATEGORY".padEnd(22)} TYPE VERDICT`);
console.log("  " + "─".repeat(78));

const GENUINE_BRAND_CATS = ["marketplace", "tech_giant", "social", "saas_dev"];
for (const item of COMPREHENSIVE_BRAND_REGISTRY) {
  const isImpostor = !GENUINE_BRAND_CATS.includes(item.category);
  const verdict = isImpostor
    ? "⚠️  IMPOSTOR — descriptor/concept wrongly in brand list"
    : "✓  Proper brand entity";
  console.log(`  ${item.id.padEnd(32)} ${item.category.padEnd(22)} ${verdict}`);
}
console.log();

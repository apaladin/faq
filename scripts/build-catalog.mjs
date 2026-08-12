/**
 * Build public/soulara-catalog.json from a Shopify admin product CSV export.
 *
 * Usage:
 *   node scripts/build-catalog.mjs [path/to/products_export.csv]
 *
 * Re-run whenever you re-export products from Shopify Admin.
 * Only published products are included. Enriches each product with the
 * nutrition / allergen / spice / review metafields from the export —
 * far richer than the public products.json feed.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH =
  process.argv[2] || "C:/Users/1/Desktop/products_export_1.csv";
const OUT_PATH = path.join(__dirname, "..", "public", "soulara-catalog.json");
const STORE_URL = "https://dev-soulara.myshopify.com";

/* ---------- CSV parser (handles quotes + embedded newlines) ---------- */
function parseCSV(s) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && s[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* ---------- helpers ---------- */
function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function num(s) {
  const m = String(s || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** "Energy,Protein,Fat Total,..." + "2620kJ / 626Cal,27g,31.2g,..." -> object */
function parseNutrition(labelsStr, valuesStr) {
  if (!labelsStr || !valuesStr) return null;
  const labels = labelsStr.split(",").map((s) => s.trim().toLowerCase());
  const values = valuesStr.split(",").map((s) => s.trim());
  if (values.length < 2) return null;
  const out = {};
  labels.forEach((label, i) => {
    const v = values[i];
    if (!v || v === "-") return;
    if (label.includes("energy")) {
      const cal = v.match(/(\d+(\.\d+)?)\s*cal/i);
      const kj = v.match(/(\d+(\.\d+)?)\s*kj/i);
      if (cal) out.calories = parseFloat(cal[1]);
      if (kj) out.kilojoules = parseFloat(kj[1]);
    } else if (label.includes("protein")) out.protein_g = num(v);
    else if (label.includes("saturated")) out.saturated_fat_g = num(v);
    else if (label.includes("fat")) out.fat_g = num(v);
    else if (label.includes("sugars")) out.sugars_g = num(v);
    else if (label.includes("carbohydrate")) out.carbs_g = num(v);
    else if (label.includes("fibre") || label.includes("fiber")) out.fibre_g = num(v);
    else if (label.includes("sodium")) out.sodium_mg = num(v);
    else if (label.includes("calcium")) out.calcium_mg = num(v);
  });
  return Object.keys(out).length ? out : null;
}

function splitList(s) {
  const t = String(s || "").trim();
  if (!t || /^none\.?$/i.test(t)) return [];
  return t.replace(/\.$/, "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
}

/* ---------- build ---------- */
const raw = fs.readFileSync(CSV_PATH, "utf8");
const rows = parseCSV(raw);
const header = rows[0];
const col = (name) => {
  const i = header.findIndex((h) => h.trim() === name || h.includes(name));
  return i;
};

const C = {
  handle: col("Handle"),
  title: col("Title"),
  body: col("Body (HTML)"),
  type: col("Type"),
  tags: col("Tags"),
  published: col("Published"),
  price: col("Variant Price"),
  compareAt: col("Variant Compare At Price"),
  grams: col("Variant Grams"),
  image: col("Image Src"),
  allergens: col("allergen_contains"),
  allergensMay: col("allergen_may_contains"),
  nutrLabels: col("Nutritional Title"),
  nutrServe: col("average_quantity_per_serve"),
  spice: col("spice_level"),
  proteinTypes: col("protein_types"),
  benefits: col("food_benefits"),
  reviewCount: col("review_count"),
  reviewRating: col("review_rating"),
};

const byHandle = new Map();
for (const r of rows.slice(1)) {
  const h = r[C.handle];
  if (!h) continue;
  if (!byHandle.has(h)) byHandle.set(h, []);
  byHandle.get(h).push(r);
}

const products = [];
for (const [handle, prodRows] of byHandle) {
  const first = prodRows[0];
  if (String(first[C.published]).toLowerCase() !== "true") continue;

  const tags = String(first[C.tags] || "").split(",").map((s) => s.trim()).filter(Boolean);

  // Same meal exists as separate products per size — disambiguate the title.
  const sizeTag = tags.find((t) => /^Size_(Medium|Large|Family)$/.test(t));
  const sizeWord = sizeTag ? sizeTag.slice(5) : "";
  let title = first[C.title];
  if (sizeWord && !title.toLowerCase().includes(sizeWord.toLowerCase()))
    title += " (" + sizeWord + ")";

  // First row with a price / an image (rows repeat for extra variants/images)
  const priceRow = prodRows.find((r) => r[C.price]) || first;
  const imageRow = prodRows.find((r) => r[C.image]) || first;

  const nutrition = parseNutrition(first[C.nutrLabels], first[C.nutrServe]);
  const spice = String(first[C.spice] || "").replace(/[^\w\s]/g, "").trim() || null;
  const rating = num(first[C.reviewRating]);
  const reviews = num(first[C.reviewCount]);

  products.push({
    id: handle,
    title,
    description: stripHtml(first[C.body]).slice(0, 500),
    tags,
    productType: first[C.type] || "",
    price: priceRow[C.price] || "",
    compareAtPrice: priceRow[C.compareAt] || null,
    currency: "AUD",
    grams: num(priceRow[C.grams]),
    available: true,
    image: imageRow[C.image] || null,
    url: STORE_URL + "/products/" + handle,
    nutrition,
    allergens: {
      contains: splitList(first[C.allergens]),
      mayContain: splitList(first[C.allergensMay]),
    },
    spice,
    proteinTypes: splitList(first[C.proteinTypes]),
    benefits: splitList(first[C.benefits]),
    rating,
    reviews,
  });
}

fs.writeFileSync(
  OUT_PATH,
  JSON.stringify({ source: "shopify-csv-export", products }, null, 1)
);

const withNutr = products.filter((p) => p.nutrition && p.nutrition.calories).length;
console.log(
  "Wrote " + products.length + " published products to " + OUT_PATH +
  " (" + withNutr + " with calorie data)"
);

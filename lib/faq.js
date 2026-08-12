import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = path.join(__dirname, "..", "public", "products.json");

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set — add it to your .env file");
    }
    client = new OpenAI();
  }
  return client;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/** @type {Map<string, object>} */
const cache = new Map();

export function loadProducts() {
  const raw = fs.readFileSync(PRODUCTS_PATH, "utf8");
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error("products.json must be an array");
  return list;
}

export function getProduct(productId) {
  return loadProducts().find((p) => p.id === productId) ?? null;
}

export function getCachedFaq(productId) {
  return cache.get(productId) ?? null;
}

export function clearFaqCache(productId) {
  cache.delete(productId);
}

function normalizeProduct(input) {
  if (!input || !input.id || !input.title) return null;
  return {
    id: String(input.id),
    title: String(input.title),
    description: String(input.description || input.title),
    price: input.price != null ? String(input.price) : "",
    currency: input.currency || "AUD",
    image: input.image || null,
  };
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          author: { type: "string" },
          rating: { type: "integer" },
          body: { type: "string" },
        },
        required: ["id", "author", "rating", "body"],
      },
    },
    highlights: {
      type: "array",
      items: { type: "string" },
    },
    faqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["id", "question", "answer"],
      },
    },
  },
  required: ["reviews", "highlights", "faqs"],
};

/**
 * Resolve product from override body, then products.json.
 */
export function resolveProduct(productId, override) {
  const fromBody = normalizeProduct(
    override && { ...override, id: override.id || productId }
  );
  if (fromBody && fromBody.id === productId) return fromBody;
  return getProduct(productId);
}

/**
 * Generate placeholder reviews + highlights + FAQs for a product.
 * Results are cached in memory by product id.
 */
export async function getOrGenerateFaq(
  productId,
  { force = false, product: productOverride } = {}
) {
  if (!force) {
    const hit = cache.get(productId);
    if (hit) return hit;
  }

  const product = resolveProduct(productId, productOverride);
  if (!product) {
    const err = new Error(
      `Product not found: ${productId}. Add it to products.json or POST title/description.`
    );
    err.status = 404;
    throw err;
  }

  const prompt = `You generate content for a Shopify product-page widget called "AI Highlights & FAQ".

Product:
- id: ${product.id}
- title: ${product.title}
- description: ${product.description}
- price: ${product.price} ${product.currency || ""}

Invent 10–14 customer reviews that feel real (not marketing copy):
- Mix of ratings: mostly 4–5 stars, include 1–2 honest 3-star reviews with a mild complaint
- Different first names (varied regions), casual tone, typos/short sentences OK occasionally
- Specific details about taste, texture, portion size, reheating, value, who they bought for — not generic praise
- Vary length: some 1 sentence, some 2–4 sentences
- Avoid phrases like "highly recommend", "game changer", "as an AI", or sounding like ads

Then, based ONLY on those reviews and the product description:
- Write 3–5 concise "AI Highlights" bullets (shopper takeaways, not slogans)
- Write 8–12 FAQs covering practical shopper questions: taste/spice, portion/serving, ingredients/allergens, reheating/storage, who it's for, value/price, comparisons implied by reviews, dietary notes if relevant. Answers should be helpful and grounded in the reviews/description — not invent unrelated claims.

Use short stable ids like r1, r2 for reviews and f1, f2 for faqs.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ai_highlights_faq",
        strict: true,
        schema: outputSchema,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You output only valid JSON matching the schema. No markdown, no commentary.",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(text);
  const payload = {
    productId: product.id,
    product: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: product.currency || "AUD",
      image: product.image || null,
    },
    reviews: parsed.reviews,
    highlights: parsed.highlights,
    faqs: parsed.faqs.map((f) => ({ ...f, visible: true })),
    generatedAt: new Date().toISOString(),
    model: MODEL,
  };

  cache.set(productId, payload);
  return payload;
}

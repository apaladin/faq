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
 * Generate placeholder reviews + highlights + FAQs for a product.
 * Results are cached in memory by product id.
 */
export async function getOrGenerateFaq(productId, { force = false } = {}) {
  if (!force) {
    const hit = cache.get(productId);
    if (hit) return hit;
  }

  const product = getProduct(productId);
  if (!product) {
    const err = new Error(`Product not found: ${productId}`);
    err.status = 404;
    throw err;
  }

  const prompt = `You are generating demo content for a Shopify product-page widget called "AI Highlights & FAQ".

Product:
- id: ${product.id}
- title: ${product.title}
- description: ${product.description}
- price: ${product.price} ${product.currency || ""}

Invent 8–12 realistic customer reviews (varied ratings 3–5 stars, short natural language, different author first names). Then, based ONLY on those invented reviews and the product description:
- Write 3–5 concise "AI Highlights" bullets summarizing what shoppers love.
- Write 4–6 FAQs (question + answer) that a shopper might ask after reading the reviews.

Use short stable ids like r1, r2 for reviews and f1, f2 for faqs.
This is demo/placeholder data — make it believable but clearly grounded in the product.`;

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

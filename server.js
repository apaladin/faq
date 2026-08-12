import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { runChatTurn } from "./lib/ai.js";
import {
  clearFaqCache,
  getCachedFaq,
  getOrGenerateFaq,
  getProduct,
  loadProducts,
} from "./lib/faq.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS: allow your storefront to call this API ---
const allowed = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowed.includes("*") ? true : allowed,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// --- Simple per-IP rate limit (protects your Anthropic bill) ---
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const hits = new Map();
setInterval(() => hits.clear(), RATE_WINDOW_MS).unref();

function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] ?? req.ip;
  const count = (hits.get(ip) ?? 0) + 1;
  hits.set(ip, count);
  if (count > RATE_LIMIT) {
    return res
      .status(429)
      .json({ error: "Too many messages — please wait a minute." });
  }
  next();
}

// --- Chat endpoint ---
// Body: { messages: [{role: "user"|"assistant", content: string}, ...] }
// Reply: { reply: string, products: [{id,title,price,currency,image,url,available}] }
app.post("/chat", rateLimit, async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user" || !String(last.content ?? "").trim()) {
    return res.status(400).json({ error: "last message must be from the user" });
  }

  try {
    const { reply, products } = await runChatTurn(messages);
    res.json({
      reply,
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        image: p.image,
        url: p.url,
        available: p.available,
      })),
    });
  } catch (err) {
    console.error("Chat turn failed:", err);
    res.status(500).json({
      error: "Sorry, something went wrong. Please try again.",
    });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- AI Highlights & FAQ demo ---
app.get("/api/products", (_req, res) => {
  try {
    res.json({ products: loadProducts() });
  } catch (err) {
    console.error("Load products failed:", err);
    res.status(500).json({ error: "Could not load products.json" });
  }
});

app.get("/api/faq/:productId", rateLimit, async (req, res) => {
  const { productId } = req.params;
  if (!getProduct(productId)) {
    return res.status(404).json({ error: "Product not found in products.json" });
  }
  try {
    const payload = await getOrGenerateFaq(productId);
    res.json(payload);
  } catch (err) {
    console.error("FAQ generate failed:", err);
    res.status(500).json({
      error: err.message || "Could not generate AI highlights & FAQ.",
    });
  }
});

app.post("/api/faq/:productId/regenerate", rateLimit, async (req, res) => {
  const { productId } = req.params;
  if (!getProduct(productId)) {
    return res.status(404).json({ error: "Product not found in products.json" });
  }
  try {
    clearFaqCache(productId);
    const payload = await getOrGenerateFaq(productId, { force: true });
    res.json(payload);
  } catch (err) {
    console.error("FAQ regenerate failed:", err);
    res.status(500).json({
      error: err.message || "Could not regenerate AI highlights & FAQ.",
    });
  }
});

app.get("/api/faq/:productId/cached", (req, res) => {
  const cached = getCachedFaq(req.params.productId);
  if (!cached) return res.status(404).json({ error: "Not cached yet" });
  res.json(cached);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`AI FAQ demo: http://localhost:${PORT}/faq-demo.html`);
  console.log(`Chat demo:   http://localhost:${PORT}/demo.html`);
});

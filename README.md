# Shopify AI demos

## AI Highlights & FAQ (product page demo)

Lightweight demo: product data from JSON → backend generates placeholder reviews + highlights/FAQs with OpenAI → frontend shows an accordion on a mock product page.

```
products.json → Express (/api/faq/:id) → OpenAI (gpt-4o-mini) → faq-demo.html accordion
```

### Run

```sh
npm install
copy .env.example .env    # set OPENAI_API_KEY
npm start
```

Open http://localhost:3000/faq-demo.html

Edit products in [`public/products.json`](public/products.json). The OpenAI key stays in `.env` only; the browser only calls `/api/faq/...`.

| Endpoint | Purpose |
|---|---|
| `GET /api/products` | List products from JSON |
| `GET /api/faq/:productId` | Cached AI payload (generates on miss) |
| `POST /api/faq/:productId/regenerate` | Force new reviews + FAQs |

### Free hosting (no paid server)

Deploy this repo as a **Render Free Web Service**: build/start `npm start`, set `OPENAI_API_KEY` (and optional `OPENAI_MODEL=gpt-4o-mini`). The free tier sleeps when idle — first request after sleep is slow.

---

## Shopify AI Shopping Assistant

A chat widget for your Shopify store, powered by the OpenAI API. Visitors describe what
they want ("an Indian meal under 500 calories"); if the request is specific
enough the bot searches your catalog and shows product cards, and if not it
asks smart follow-up questions or gives advice.

## How it works

```
Visitor ↔ Chat widget (script tag in your theme)
              ↕ HTTPS
        Node.js server (this repo)
              ↕
   OpenAI API (decides: recommend or ask)
              ↕ tool calls
   Shopify Storefront API (product search)
```

The AI has two tools: `search_products` (searches your catalog) and
`recommend_products` (tells the widget which products to render as cards).
It reads product titles, descriptions, and tags to check constraints like
calories, and is instructed never to invent products or claim a constraint
the product data doesn't support.

## Setup

### 1. Install and configure

```sh
npm install
copy .env.example .env    # then edit .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | Optional — defaults to `gpt-4o`; use `gpt-4o-mini` for lower cost |
| `SHOPIFY_STORE_DOMAIN` | Your `*.myshopify.com` domain |
| `SHOPIFY_STOREFRONT_TOKEN` | Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app → enable Storefront API scope `unauthenticated_read_product_listings` → Install app → copy the Storefront API access token |
| `STORE_DESCRIPTION` | 1–2 sentences about what you sell (helps the bot) |
| `ALLOWED_ORIGINS` | Your storefront URL(s), e.g. `https://www.mystore.com` |

### 2. Run locally

```sh
npm start
```

Open http://localhost:3000/demo.html and chat with the bot against your real
product catalog.

### 3. Deploy the server

Deploy this repo to any Node host (Render, Railway, Fly.io, a VPS, etc.).
Set the same environment variables there. Note your public URL, e.g.
`https://bot.mystore.com`.

### 4. Add the widget to your Shopify theme

Shopify Admin → Online Store → Themes → Edit code → `layout/theme.liquid`,
then add this just before `</body>`:

```html
<script src="https://YOUR-BOT-SERVER/widget.js"
        data-api-url="https://YOUR-BOT-SERVER"
        defer></script>
```

Optional attributes:

- `data-greeting="..."` — first message shown to visitors
- `data-accent-color="#1a7f64"` — match your brand color

## Making constraint filtering work well (calories, vegan, etc.)

The bot can only verify what's in your product data. For best results:

- Put nutrition facts (e.g. "420 calories per serving") in product
  **descriptions**, and/or
- Add **tags** like `under-500-cal`, `vegan`, `gluten-free`, `indian`.

If a product's data doesn't state a constraint, the bot recommends it with a
caveat instead of guessing.

## Costs and safeguards

- Model: `gpt-4o` by default. Each chat turn is one or more API calls (search +
  reply). The server caps history at 20 messages and rate-limits each IP to
  20 messages/minute. Tune `RATE_LIMIT` in `server.js`, or set
  `OPENAI_MODEL=gpt-4o-mini` for cheaper, faster replies.
- The `/chat` endpoint is public by design (visitors aren't logged in), so
  keep the rate limit on and set `ALLOWED_ORIGINS` in production.

## Project layout

```
server.js              Express: /chat + /api/faq, CORS, rate limiting
lib/ai.js              Chat assistant tools / OpenAI loop
lib/faq.js             AI reviews + highlights/FAQ pipeline + cache
lib/shopify.js         Storefront API product search (chat)
public/products.json   Demo product data (edit this)
public/faq-demo.html   Mock product page
public/faq-widget.js   Highlights + FAQ accordion
public/widget.js       Chat widget
public/demo.html       Chat test page
```

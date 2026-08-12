/**
 * AI Highlights & FAQ accordion — storefront / Shopify theme script.
 * Calls your Express backend only (OpenAI key stays on the server).
 *
 * Shopify (recommended): paste the Liquid snippet from
 *   shopify/snippets/ai-faq.liquid
 *
 * Manual:
 *   <div id="ai-faq-root"></div>
 *   <script
 *     src="https://YOUR-SERVICE.onrender.com/faq-widget.js"
 *     data-api-url="https://YOUR-SERVICE.onrender.com"
 *     data-product-id="product-handle"
 *     data-product-title="Title"
 *     data-product-description="Description…"
 *     data-product-price="25.00"
 *     data-product-currency="AUD"
 *     defer></script>
 *
 * Optional: data-show-regenerate="true" (hidden on storefront by default)
 */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    document.querySelector('script[src*="faq-widget"]');

  function attr(name, fallback) {
    if (script && script.getAttribute(name) != null) {
      return script.getAttribute(name);
    }
    return fallback;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function injectStyles() {
    if (document.getElementById("ai-faq-styles")) return;
    var style = document.createElement("style");
    style.id = "ai-faq-styles";
    style.textContent =
      ".ai-faq{margin-top:28px;border-top:1px solid #e5e5e5;padding-top:24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a}" +
      ".ai-faq h2{font-size:1.25rem;font-weight:600;margin:0 0 8px;letter-spacing:-0.02em}" +
      ".ai-faq-highlights{list-style:none;padding:0;margin:0 0 22px;font-family:system-ui,-apple-system,sans-serif}" +

      ".ai-faq-highlights li{position:relative;padding:8px 0 8px 22px;font-size:14px;line-height:1.45;border-bottom:1px solid #f0f0f0}" +
      ".ai-faq-highlights li:before{content:'';position:absolute;left:0;color:#2d6a4f;font-size:14px}" +
      ".ai-faq-item{border-bottom:1px solid #e8e8e8;font-family:system-ui,-apple-system,sans-serif}" +
      ".ai-faq-item button{width:100%;text-align:left;background:none;border:0;padding:14px 28px 14px 0;font-size:15px;font-weight:560;cursor:pointer;color:inherit;display:flex;justify-content:space-between;gap:12px;align-items:center}" +
      ".ai-faq-item button span.chev{flex:none;transition:transform .2s;font-size:12px;color:#888}" +
      ".ai-faq-item.open button span.chev{transform:rotate(180deg)}" +
      ".ai-faq-item .ai-faq-a{display:none;padding:0 0 14px;font-size:14px;line-height:1.55;color:#444}" +
      ".ai-faq-item.open .ai-faq-a{display:block}" +
      ".ai-faq-status{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#666;padding:12px 0}" +
      ".ai-faq-status.error{color:#a33}";
    document.head.appendChild(style);
  }

  function productFrom(root) {
    var id =
      root.getAttribute("data-product-id") ||
      attr("data-product-id", "") ||
      "";
    var title =
      root.getAttribute("data-product-title") ||
      attr("data-product-title", "") ||
      "";
    var description =
      root.getAttribute("data-product-description") ||
      attr("data-product-description", "") ||
      "";
    var price =
      root.getAttribute("data-product-price") ||
      attr("data-product-price", "") ||
      "";
    var currency =
      root.getAttribute("data-product-currency") ||
      attr("data-product-currency", "AUD") ||
      "AUD";
    var image =
      root.getAttribute("data-product-image") ||
      attr("data-product-image", "") ||
      "";
    return {
      id: id,
      title: title,
      description: description,
      price: price,
      currency: currency,
      image: image || null,
    };
  }

  function apiBase(root) {
    var fromRoot = root.getAttribute("data-api-url");
    var base = (fromRoot != null ? fromRoot : attr("data-api-url", "")).replace(
      /\/$/,
      ""
    );
    return base;
  }

  function showRegenerate(root) {
    var v =
      root.getAttribute("data-show-regenerate") ||
      attr("data-show-regenerate", "");
    return v === "true" || v === "1";
  }

  function render(root, data) {
    root.innerHTML = "";
    var wrap = el("section", "ai-faq");
    wrap.appendChild(el("h2", null, "AI Highlights & FAQ"));

    if (data.highlights && data.highlights.length) {
      var ul = el("ul", "ai-faq-highlights");
      data.highlights.forEach(function (h) {
        ul.appendChild(el("li", null, h));
      });
      wrap.appendChild(ul);
    }

    var faqs = (data.faqs || []).filter(function (f) {
      return f.visible !== false;
    });
    faqs.forEach(function (f) {
      var item = el("div", "ai-faq-item");
      var btn = el("button", null);
      btn.type = "button";
      btn.appendChild(document.createTextNode(f.question));
      btn.appendChild(el("span", "chev", "▼"));
      btn.addEventListener("click", function () {
        item.classList.toggle("open");
      });
      item.appendChild(btn);
      item.appendChild(el("div", "ai-faq-a", f.answer));
      wrap.appendChild(item);
    });

    if (showRegenerate(root)) {
      var actions = el("div", "ai-faq-actions");
      actions.style.marginTop = "16px";
      var regen = el("button", null, "Regenerate");
      regen.type = "button";
      regen.style.cssText =
        "background:#1a1a1a;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:system-ui,sans-serif";
      regen.addEventListener("click", function () {
        load(root, { force: true });
      });
      actions.appendChild(regen);
      wrap.appendChild(actions);
    }

    root.appendChild(wrap);
  }

  function showStatus(root, msg, isError) {
    root.innerHTML = "";
    root.appendChild(
      el("p", "ai-faq-status" + (isError ? " error" : ""), msg)
    );
  }

  async function load(root, opts) {
    opts = opts || {};
    injectStyles();
    var product = productFrom(root);
    if (!product.id) {
      showStatus(root, "Missing product id (use data-product-id).", true);
      return;
    }

    showStatus(
      root,
      opts.force
        ? "Regenerating reviews & FAQ…"
        : "Loading AI Highlights & FAQ…"
    );

    var base = apiBase(root);

    try {
      var body;
      if (product.title) {
        var resPost = await fetch(base + "/api/faq", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: product.id,
            title: product.title,
            description: product.description || product.title,
            price: product.price,
            currency: product.currency,
            image: product.image,
            force: Boolean(opts.force),
          }),
        });
        body = await resPost.json().catch(function () {
          return {};
        });
        if (!resPost.ok) {
          throw new Error(body.error || "Request failed (" + resPost.status + ")");
        }
      } else {
        var path =
          base +
          "/api/faq/" +
          encodeURIComponent(product.id) +
          (opts.force ? "/regenerate" : "");
        var resGet = await fetch(path, {
          method: opts.force ? "POST" : "GET",
          headers: { Accept: "application/json" },
        });
        body = await resGet.json().catch(function () {
          return {};
        });
        if (!resGet.ok) {
          throw new Error(body.error || "Request failed (" + resGet.status + ")");
        }
      }
      render(root, body);
    } catch (err) {
      showStatus(
        root,
        err.message || "Could not load AI Highlights & FAQ.",
        true
      );
    }
  }

  function ensureRoot() {
    var root = document.getElementById("ai-faq-root");
    if (root) return root;

    // Auto-insert after add-to-cart form when Liquid didn't place a root.
    root = document.createElement("div");
    root.id = "ai-faq-root";
    var form =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("form.product-form") ||
      document.querySelector("[data-product-form]");
    if (form && form.parentNode) {
      form.parentNode.insertBefore(root, form.nextSibling);
    } else {
      document.body.appendChild(root);
    }
    return root;
  }

  function boot() {
    var root = ensureRoot();
    load(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

/**
 * AI Highlights & FAQ accordion for the demo product page.
 * Fetches from the Express backend only — no OpenAI key in the browser.
 *
 * Usage:
 *   <div id="ai-faq-root" data-product-id="your-product-id"></div>
 *   <script src="/faq-widget.js" defer></script>
 *
 * Optional on the root element:
 *   data-api-url=""     API origin (default: same origin)
 */
(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function apiBase(root) {
    var base = (root.getAttribute("data-api-url") || "").replace(/\/$/, "");
    return base;
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
      ".ai-faq .ai-faq-sub{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#666;margin:0 0 18px}" +
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
      ".ai-faq-status.error{color:#a33}" +
      ".ai-faq-actions{margin-top:16px;font-family:system-ui,-apple-system,sans-serif}" +
      ".ai-faq-actions button{background:#1a1a1a;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer}" +
      ".ai-faq-actions button:disabled{opacity:.5;cursor:wait}";
    document.head.appendChild(style);
  }

  function render(root, data) {
    root.innerHTML = "";
    var wrap = el("section", "ai-faq");
    wrap.appendChild(el("h2", null, "AI Highlights & FAQ"));
    wrap.appendChild(
      el(
        "p",
        "ai-faq-sub",
        "Generated from customer-style review insights (demo)."
      )
    );

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

    var actions = el("div", "ai-faq-actions");
    var regen = el("button", null, "Regenerate");
    regen.type = "button";
    regen.addEventListener("click", function () {
      load(root, { regenerate: true });
    });
    actions.appendChild(regen);
    wrap.appendChild(actions);

    root.appendChild(wrap);
  }

  function showStatus(root, msg, isError) {
    root.innerHTML = "";
    var p = el("p", "ai-faq-status" + (isError ? " error" : ""), msg);
    root.appendChild(p);
  }

  async function load(root, opts) {
    opts = opts || {};
    injectStyles();
    var productId = root.getAttribute("data-product-id");
    if (!productId) {
      showStatus(root, "Missing data-product-id on #ai-faq-root.", true);
      return;
    }

    showStatus(
      root,
      opts.regenerate
        ? "Regenerating reviews & FAQ…"
        : "Generating AI Highlights & FAQ…"
    );

    var base = apiBase(root);
    var url = opts.regenerate
      ? base + "/api/faq/" + encodeURIComponent(productId) + "/regenerate"
      : base + "/api/faq/" + encodeURIComponent(productId);

    try {
      var res = await fetch(url, {
        method: opts.regenerate ? "POST" : "GET",
        headers: { Accept: "application/json" },
      });
      var body = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        throw new Error(body.error || "Request failed (" + res.status + ")");
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

  function boot() {
    var root = document.getElementById("ai-faq-root");
    if (!root) return;
    load(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

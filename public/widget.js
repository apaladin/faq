/**
 * Shopify AI shopping assistant chat widget.
 * Embed on any page with:
 *   <script src="https://YOUR-BOT-SERVER/widget.js" data-api-url="https://YOUR-BOT-SERVER" defer></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var API_URL = (script && script.getAttribute("data-api-url")) || "";
  var GREETING =
    (script && script.getAttribute("data-greeting")) ||
    "Hi! I'm your shopping assistant. Tell me what you're looking for — for example, \"an Indian meal under 500 calories\".";
  var ACCENT =
    (script && script.getAttribute("data-accent-color")) || "#1a7f64";

  var history = []; // {role, content} — text only, sent to the backend
  var open = false;
  var busy = false;

  // ---------- styles ----------
  var css = `
    .rbot-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;
      background:${ACCENT};color:#fff;border:none;cursor:pointer;z-index:999999;
      box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:26px;line-height:1;display:flex;
      align-items:center;justify-content:center;transition:transform .15s}
    .rbot-btn:hover{transform:scale(1.07)}
    .rbot-panel{position:fixed;bottom:92px;right:24px;width:360px;max-width:calc(100vw - 32px);
      height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;z-index:999999;
      box-shadow:0 10px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .rbot-panel.rbot-open{display:flex}
    .rbot-head{background:${ACCENT};color:#fff;padding:14px 16px;font-weight:600;font-size:15px;
      display:flex;justify-content:space-between;align-items:center}
    .rbot-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 4px}
    .rbot-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;
      background:#f7f7f8}
    .rbot-msg{max-width:85%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;
      white-space:pre-wrap;word-wrap:break-word}
    .rbot-msg-user{align-self:flex-end;background:${ACCENT};color:#fff;border-bottom-right-radius:4px}
    .rbot-msg-bot{align-self:flex-start;background:#fff;color:#222;border:1px solid #e5e5e7;
      border-bottom-left-radius:4px}
    .rbot-typing{align-self:flex-start;color:#888;font-size:13px;padding:4px 13px}
    .rbot-cards{display:flex;flex-direction:column;gap:8px;align-self:stretch}
    .rbot-card{display:flex;gap:10px;background:#fff;border:1px solid #e5e5e7;border-radius:10px;
      padding:8px;text-decoration:none;color:inherit;transition:box-shadow .15s}
    .rbot-card:hover{box-shadow:0 2px 10px rgba(0,0,0,.12)}
    .rbot-card img{width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#eee}
    .rbot-card-body{display:flex;flex-direction:column;justify-content:center;min-width:0}
    .rbot-card-title{font-size:13px;font-weight:600;color:#222;overflow:hidden;text-overflow:ellipsis;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .rbot-card-price{font-size:13px;color:${ACCENT};font-weight:600;margin-top:2px}
    .rbot-card-oos{font-size:12px;color:#b00;margin-top:2px}
    .rbot-input-row{display:flex;border-top:1px solid #e5e5e7;background:#fff}
    .rbot-input{flex:1;border:none;padding:13px 14px;font-size:14px;outline:none;resize:none;
      font-family:inherit;max-height:90px}
    .rbot-send{background:none;border:none;color:${ACCENT};font-weight:700;font-size:14px;
      cursor:pointer;padding:0 16px}
    .rbot-send:disabled{color:#bbb;cursor:default}
  `;
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- DOM ----------
  var btn = el("button", "rbot-btn");
  btn.setAttribute("aria-label", "Open shopping assistant");
  btn.innerHTML = "&#128172;"; // 💬
  document.body.appendChild(btn);

  var panel = el("div", "rbot-panel");
  panel.innerHTML =
    '<div class="rbot-head"><span>Shopping Assistant</span>' +
    '<button class="rbot-close" aria-label="Close">&times;</button></div>' +
    '<div class="rbot-msgs"></div>' +
    '<div class="rbot-input-row">' +
    '<textarea class="rbot-input" rows="1" placeholder="Ask about products..."></textarea>' +
    '<button class="rbot-send">Send</button></div>';
  document.body.appendChild(panel);

  var msgsBox = panel.querySelector(".rbot-msgs");
  var input = panel.querySelector(".rbot-input");
  var sendBtn = panel.querySelector(".rbot-send");

  btn.addEventListener("click", toggle);
  panel.querySelector(".rbot-close").addEventListener("click", toggle);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  function toggle() {
    open = !open;
    panel.classList.toggle("rbot-open", open);
    if (open) {
      if (history.length === 0) addBotMessage(GREETING);
      input.focus();
    }
  }

  function send() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    addUserMessage(text);
    history.push({ role: "user", content: text });
    askBot();
  }

  function askBot() {
    busy = true;
    sendBtn.disabled = true;
    var typing = el("div", "rbot-typing");
    typing.textContent = "Assistant is thinking…";
    msgsBox.appendChild(typing);
    scroll();

    fetch(API_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || "Request failed");
          return data;
        });
      })
      .then(function (data) {
        typing.remove();
        if (data.reply) {
          addBotMessage(data.reply);
          history.push({ role: "assistant", content: data.reply });
        }
        if (data.products && data.products.length) {
          addProductCards(data.products);
        }
      })
      .catch(function (err) {
        typing.remove();
        addBotMessage(
          err.message === "Too many messages — please wait a minute."
            ? err.message
            : "Sorry, I ran into a problem. Please try again in a moment."
        );
      })
      .finally(function () {
        busy = false;
        sendBtn.disabled = false;
        input.focus();
      });
  }

  // ---------- rendering ----------
  function addUserMessage(text) {
    var m = el("div", "rbot-msg rbot-msg-user");
    m.textContent = text;
    msgsBox.appendChild(m);
    scroll();
  }

  function addBotMessage(text) {
    var m = el("div", "rbot-msg rbot-msg-bot");
    m.textContent = text;
    msgsBox.appendChild(m);
    scroll();
  }

  function addProductCards(products) {
    var wrap = el("div", "rbot-cards");
    products.forEach(function (p) {
      var a = document.createElement("a");
      a.className = "rbot-card";
      a.href = p.url;
      a.target = "_blank";
      a.rel = "noopener";

      var img = document.createElement("img");
      img.src = p.image || "";
      img.alt = p.title;
      img.loading = "lazy";
      a.appendChild(img);

      var body = el("div", "rbot-card-body");
      var title = el("div", "rbot-card-title");
      title.textContent = p.title;
      body.appendChild(title);

      var price = el("div", "rbot-card-price");
      price.textContent = formatPrice(p.price, p.currency);
      body.appendChild(price);

      if (p.available === false) {
        var oos = el("div", "rbot-card-oos");
        oos.textContent = "Out of stock";
        body.appendChild(oos);
      }

      a.appendChild(body);
      wrap.appendChild(a);
    });
    msgsBox.appendChild(wrap);
    scroll();
  }

  function formatPrice(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(parseFloat(amount));
    } catch (e) {
      return amount + " " + (currency || "");
    }
  }

  function el(tag, className) {
    var e = document.createElement(tag);
    e.className = className;
    return e;
  }

  function scroll() {
    msgsBox.scrollTop = msgsBox.scrollHeight;
  }
})();

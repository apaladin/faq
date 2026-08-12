import { createRoot } from "react-dom/client";
import AiFaqWidget from "./AiFaqWidget.jsx";
import styles from "./styles.css?inline";

function injectStyles() {
  if (document.getElementById("ai-faq-react-styles")) return;
  const style = document.createElement("style");
  style.id = "ai-faq-react-styles";
  style.textContent = styles;
  document.head.appendChild(style);
}

function readAttrs(el, script) {
  const get = (name, fallback = "") =>
    el?.getAttribute(name) || script?.getAttribute(name) || fallback;

  return {
    apiUrl: get("data-api-url", ""),
    showRegenerate: ["true", "1"].includes(get("data-show-regenerate", "")),
    product: {
      id: get("data-product-id"),
      title: get("data-product-title"),
      description: get("data-product-description"),
      price: get("data-product-price"),
      currency: get("data-product-currency", "AUD"),
      image: get("data-product-image") || null,
    },
  };
}

function ensureRoot(script) {
  let root = document.getElementById("ai-faq-root");
  if (root) return root;

  root = document.createElement("div");
  root.id = "ai-faq-root";
  const form =
    document.querySelector('form[action*="/cart/add"]') ||
    document.querySelector("form.product-form") ||
    document.querySelector("[data-product-form]");
  if (form?.parentNode) {
    form.parentNode.insertBefore(root, form.nextSibling);
  } else if (script?.parentNode) {
    script.parentNode.insertBefore(root, script);
  } else {
    document.body.appendChild(root);
  }
  return root;
}

function boot() {
  const script =
    document.currentScript ||
    document.querySelector('script[src*="ai-faq-bundle"]') ||
    document.querySelector("script[data-api-url]");

  injectStyles();
  const mountEl = ensureRoot(script);
  const props = readAttrs(mountEl, script);

  createRoot(mountEl).render(
    <AiFaqWidget
      apiUrl={props.apiUrl}
      product={props.product}
      showRegenerate={props.showRegenerate}
    />
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

import { useCallback, useEffect, useState } from "react";

async function fetchFaq(apiUrl, product, force) {
  const base = apiUrl.replace(/\/$/, "");
  if (product.title) {
    const res = await fetch(`${base}/api/faq`, {
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
        force: Boolean(force),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  const path = force
    ? `${base}/api/faq/${encodeURIComponent(product.id)}/regenerate`
    : `${base}/api/faq/${encodeURIComponent(product.id)}`;
  const res = await fetch(path, {
    method: force ? "POST" : "GET",
    headers: { Accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export default function AiFaqWidget({ apiUrl, product, showRegenerate = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(
    async (force = false) => {
      if (!product?.id) {
        setError("Missing product id.");
        setLoading(false);
        return;
      }
      if (!apiUrl) {
        setError("Missing API URL.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const payload = await fetchFaq(apiUrl, product, force);
        setData(payload);
      } catch (err) {
        setError(err.message || "Could not load AI Highlights & FAQ.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, product]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return <p className="ai-faq-status">Loading AI Highlights & FAQ…</p>;
  }
  if (error) {
    return <p className="ai-faq-status ai-faq-status--error">{error}</p>;
  }
  if (!data) return null;

  const faqs = (data.faqs || []).filter((f) => f.visible !== false);

  return (
    <section className="ai-faq">
      <h2>AI Highlights & FAQ</h2>
      <p className="ai-faq-sub">
        Generated from customer-style review insights (demo).
      </p>

      {data.highlights?.length > 0 && (
        <ul className="ai-faq-highlights">
          {data.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      {faqs.map((f) => {
        const open = openId === f.id;
        return (
          <div key={f.id} className={`ai-faq-item${open ? " open" : ""}`}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : f.id)}
            >
              <span>{f.question}</span>
              <span className="chev">▼</span>
            </button>
            {open && <div className="ai-faq-a">{f.answer}</div>}
          </div>
        );
      })}

      {showRegenerate && (
        <div className="ai-faq-actions">
          <button type="button" onClick={() => load(true)}>
            Regenerate
          </button>
        </div>
      )}
    </section>
  );
}

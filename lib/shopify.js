const API_VERSION = "2025-07";

/**
 * Search products via the Shopify Storefront API.
 * Returns a simplified product list the AI can reason about
 * (title, description, tags, price, image, url).
 */
export async function searchProducts(query, maxResults = 10) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!domain || !token) {
    throw new Error(
      "SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN must be set"
    );
  }

  const gql = `
    query SearchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
            description(truncateAt: 600)
            tags
            productType
            availableForSale
            onlineStoreUrl
            featuredImage { url altText }
            priceRange {
              minVariantPrice { amount currencyCode }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(
    `https://${domain}/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({
        query: gql,
        variables: { query, first: Math.min(maxResults, 25) },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    tags: node.tags,
    productType: node.productType,
    available: node.availableForSale,
    price: node.priceRange.minVariantPrice.amount,
    currency: node.priceRange.minVariantPrice.currencyCode,
    image: node.featuredImage?.url ?? null,
    imageAlt: node.featuredImage?.altText ?? null,
    url: node.onlineStoreUrl ?? `https://${domain}/products/${node.handle}`,
  }));
}

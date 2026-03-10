import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  url: string;
  image: string;
  match_score: number;
  finish?: string;
  dimensions?: string;
}

interface SearchFilters {
  style: string;
  category?: string;
  maxPrice?: number;
  minPrice?: number;
  finish?: string;
  limit?: number;
}

/** Query the product_catalog table with style-based matching and filters */
async function searchProductCatalog(
  supabase: any,
  filters: SearchFilters
): Promise<Product[]> {
  const { data, error } = await supabase.rpc("search_products", {
    query_style: filters.style,
    query_category: filters.category || null,
    max_price: filters.maxPrice || null,
    min_price: filters.minPrice || null,
    query_finish: filters.finish || null,
    result_limit: filters.limit || 10,
  });

  if (error) {
    console.error("Product catalog search failed:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    brand: row.brand as string,
    category: row.category as string,
    price: Number(row.price),
    url: row.url as string,
    image: (row.image_url as string) || "",
    match_score: Number(row.match_score),
    finish: row.finish as string | undefined,
    dimensions: row.dimensions as string | undefined,
  }));
}

const SOURCING_SYSTEM_PROMPT = `You are an expert interior design product sourcer. Given a design style, room description, budget, and an existing product catalog, recommend the best 5 products.

You will be given:
1. The design context (style, project type, description, budget)
2. Products already found in our catalog

Your job:
- If the catalog products are a good fit, select the best 5 from them and return them with adjusted match_scores
- If the catalog is missing key categories (e.g. no lighting, no textiles), supplement with real product recommendations from well-known retailers
- Always ensure a mix: at least 1 seating, 1 table, 1 lighting, and 1 textile/decor item

For each product, provide:
- name: specific product name
- brand: real retailer/manufacturer
- category: one of "seating", "tables", "lighting", "textiles", "storage", "decor", "outdoor"
- price: realistic USD price as a number
- url: retailer website URL
- image: image URL (use the catalog image if from catalog, empty string if supplemented)
- match_score: 0.7–0.98 based on style fit
- finish: material/finish if known
- dimensions: size if known

Return ONLY a JSON array of 5 product objects. No markdown, no explanation.`;

/** Use LLM to curate and supplement catalog results */
async function curateWithLLM(
  apiKey: string,
  style: string,
  description: string,
  budget: number | null,
  projectType: string,
  catalogProducts: Product[]
): Promise<Product[]> {
  const budgetContext = budget
    ? `Total budget: $${budget.toLocaleString()}. No single item should exceed $${Math.round(budget * 0.4).toLocaleString()}.`
    : "No specific budget constraint.";

  const catalogContext = catalogProducts.length > 0
    ? `\n\nProducts from our catalog (select from these first, supplement if gaps exist):\n${JSON.stringify(catalogProducts.map(p => ({
        name: p.name, brand: p.brand, category: p.category, price: p.price,
        url: p.url, image: p.image, finish: p.finish, dimensions: p.dimensions,
      })), null, 2)}`
    : "\n\nNo catalog products found — recommend 5 real products from known retailers.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SOURCING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Style: ${style}\nProject type: ${projectType}\nDescription: ${description || "General interior design project"}\n${budgetContext}${catalogContext}\n\nSelect/recommend the best 5 products.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty LLM response");

  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const raw = JSON.parse(content);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Invalid product list from LLM");
  }

  return raw.map((p: Record<string, unknown>, i: number) => ({
    id: `src-${Date.now()}-${i}`,
    name: (p.name as string) || "Product",
    brand: (p.brand as string) || "Unknown",
    category: (p.category as string) || "decor",
    price: typeof p.price === "number" ? p.price : parseFloat(String(p.price).replace(/[^0-9.]/g, "")) || 0,
    url: (p.url as string) || "",
    image: (p.image as string) || "",
    match_score: typeof p.match_score === "number" ? p.match_score : 0.85,
    finish: (p.finish as string) || undefined,
    dimensions: (p.dimensions as string) || undefined,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { style, budget, project_id, description, project_type, category, finish } = await req.json();

    const supabaseKey = supabaseServiceKey;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const budgetNum = budget ? parseInt(String(budget).replace(/[^0-9]/g, "")) : null;
    const maxItemPrice = budgetNum ? budgetNum * 0.4 : undefined;
    const queryStyle = (style || "contemporary").toLowerCase();

    // Step 1: Search the product catalog
    const catalogProducts = await searchProductCatalog(supabase, {
      style: queryStyle,
      category: category || undefined,
      maxPrice: maxItemPrice,
      finish: finish || undefined,
      limit: 15,
    });

    console.log(`Catalog search: found ${catalogProducts.length} products for style="${queryStyle}"`);

    // Step 2: If we have good catalog coverage (5+ products across categories), use directly
    const catalogCategories = new Set(catalogProducts.map(p => p.category));
    const hasGoodCoverage = catalogProducts.length >= 5 && catalogCategories.size >= 3;

    let finalProducts: Product[];
    let engine: string;

    if (openaiKey) {
      // Use LLM to curate catalog results + fill gaps
      try {
        finalProducts = await curateWithLLM(
          openaiKey,
          queryStyle,
          description || "",
          budgetNum,
          project_type || "interior",
          catalogProducts
        );
        engine = `product-catalog + gpt-4o-mini (${catalogProducts.length} catalog hits)`;
      } catch (llmErr) {
        console.error("LLM curation failed:", llmErr);
        // Fall through to catalog-only
        finalProducts = catalogProducts.slice(0, 5);
        engine = `product-catalog-only (${catalogProducts.length} hits, LLM failed)`;
      }
    } else if (hasGoodCoverage) {
      // No API key but catalog has enough products
      finalProducts = catalogProducts.slice(0, 5);
      engine = `product-catalog-only (${catalogProducts.length} hits)`;
    } else {
      // Minimal catalog, no LLM — return what we have
      finalProducts = catalogProducts.slice(0, 5);
      engine = `product-catalog-only (${catalogProducts.length} hits — set OPENAI_API_KEY for AI curation)`;
    }

    // Apply budget filter
    if (budgetNum && finalProducts.length > 0) {
      const filtered = finalProducts.filter((p) => p.price <= budgetNum * 0.4);
      if (filtered.length >= 3) finalProducts = filtered;
    }

    const totalPrice = finalProducts.reduce((sum, p) => sum + p.price, 0);

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        products: finalProducts,
        shopping_list: {
          total: totalPrice,
          item_count: finalProducts.length,
          budget_remaining: budgetNum ? budgetNum - totalPrice : null,
          currency: "USD",
        },
        catalog_hits: catalogProducts.length,
        engine,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

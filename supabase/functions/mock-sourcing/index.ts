import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

const PRODUCT_DB: Record<string, Product[]> = {
  modern: [
    { id: "p1", name: "Slope 3-Seat Sofa", brand: "Restoration Hardware", category: "seating", price: 3200, url: "https://rh.com", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80", match_score: 0.95 },
    { id: "p2", name: "Noguchi Coffee Table", brand: "Herman Miller", category: "tables", price: 1890, url: "https://hermanmiller.com", image: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80", match_score: 0.91 },
    { id: "p3", name: "Arco Floor Lamp", brand: "FLOS", category: "lighting", price: 2950, url: "https://flos.com", image: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80", match_score: 0.88 },
    { id: "p4", name: "Eames Lounge Chair", brand: "Herman Miller", category: "seating", price: 5495, url: "https://hermanmiller.com", image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80", match_score: 0.87 },
    { id: "p5", name: "Moroccan Wool Rug 8x10", brand: "West Elm", category: "textiles", price: 1299, url: "https://westelm.com", image: "https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80", match_score: 0.84 },
  ],
  japandi: [
    { id: "p6", name: "Muji Oak Sofa 3-Seat", brand: "Muji", category: "seating", price: 2400, url: "https://muji.com", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80", match_score: 0.96 },
    { id: "p7", name: "Gwyneth Coffee Table", brand: "CB2", category: "tables", price: 890, url: "https://cb2.com", image: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80", match_score: 0.93 },
    { id: "p8", name: "Akari Light Sculpture", brand: "Vitra", category: "lighting", price: 450, url: "https://vitra.com", image: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80", match_score: 0.90 },
    { id: "p9", name: "Woven Rattan Accent Chair", brand: "Article", category: "seating", price: 749, url: "https://article.com", image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80", match_score: 0.88 },
    { id: "p10", name: "Linen Curtain Panel", brand: "Crate & Barrel", category: "textiles", price: 189, url: "https://crateandbarrel.com", image: "https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80", match_score: 0.85 },
  ],
  default: [
    { id: "p11", name: "Haven Sectional Sofa", brand: "West Elm", category: "seating", price: 2800, url: "https://westelm.com", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80", match_score: 0.92 },
    { id: "p12", name: "Marble Round Table", brand: "CB2", category: "tables", price: 1200, url: "https://cb2.com", image: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80", match_score: 0.89 },
    { id: "p13", name: "Nelson Saucer Pendant", brand: "Herman Miller", category: "lighting", price: 750, url: "https://hermanmiller.com", image: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80", match_score: 0.86 },
    { id: "p14", name: "Leather Accent Chair", brand: "Article", category: "seating", price: 999, url: "https://article.com", image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80", match_score: 0.84 },
    { id: "p15", name: "Jute Area Rug 9x12", brand: "Pottery Barn", category: "textiles", price: 899, url: "https://potterybarn.com", image: "https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80", match_score: 0.82 },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, budget, project_id } = await req.json();

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

    const styleKey = (style || "default").toLowerCase();
    let products = PRODUCT_DB[styleKey] || PRODUCT_DB.default;

    // Filter by budget if provided
    const budgetNum = budget ? parseInt(String(budget).replace(/[^0-9]/g, "")) : null;
    if (budgetNum) {
      products = products.filter((p) => p.price <= budgetNum * 0.4); // No single item > 40% of budget
      if (products.length === 0) products = PRODUCT_DB[styleKey] || PRODUCT_DB.default; // fallback
    }

    const totalPrice = products.reduce((sum, p) => sum + p.price, 0);

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        products,
        shopping_list: {
          total: totalPrice,
          item_count: products.length,
          budget_remaining: budgetNum ? budgetNum - totalPrice : null,
          currency: "USD",
        },
        engine: "sourcerai.design/v1 (mock)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

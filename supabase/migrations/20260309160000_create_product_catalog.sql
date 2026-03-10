-- Enable pgvector for similarity search
create extension if not exists vector with schema extensions;

-- Product catalog table with vector embeddings for style-based search
create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category text not null check (category in ('seating', 'tables', 'lighting', 'textiles', 'storage', 'decor', 'outdoor')),
  price numeric(10,2) not null,
  url text not null default '',
  image_url text not null default '',
  style_tags text[] not null default '{}',
  finish text,
  dimensions text,
  description text,
  -- pgvector embedding for style similarity (1536-dim for OpenAI embeddings, or smaller for custom)
  embedding extensions.vector(384),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_product_catalog_category on public.product_catalog (category);
create index if not exists idx_product_catalog_price on public.product_catalog (price);
create index if not exists idx_product_catalog_brand on public.product_catalog (brand);
create index if not exists idx_product_catalog_style_tags on public.product_catalog using gin (style_tags);

-- HNSW index for vector similarity search (cosine distance)
create index if not exists idx_product_catalog_embedding on public.product_catalog
  using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 20);

-- RLS: anyone can read the catalog
alter table public.product_catalog enable row level security;
create policy "Product catalog is publicly readable" on public.product_catalog
  for select using (true);

-- Function: search products by style similarity + filters
create or replace function public.search_products(
  query_style text default 'contemporary',
  query_category text default null,
  max_price numeric default null,
  min_price numeric default null,
  query_finish text default null,
  result_limit int default 10
)
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  price numeric,
  url text,
  image_url text,
  style_tags text[],
  finish text,
  dimensions text,
  match_score float
) language plpgsql as $$
begin
  return query
    select
      pc.id,
      pc.name,
      pc.brand,
      pc.category,
      pc.price,
      pc.url,
      pc.image_url,
      pc.style_tags,
      pc.finish,
      pc.dimensions,
      -- Score based on style tag overlap (simple text matching when no embeddings)
      case
        when query_style = any(pc.style_tags) then 0.95
        when exists (
          select 1 from unnest(pc.style_tags) tag
          where tag ilike '%' || query_style || '%'
             or query_style ilike '%' || tag || '%'
        ) then 0.85
        else 0.70
      end::float as match_score
    from public.product_catalog pc
    where
      (query_category is null or pc.category = query_category)
      and (max_price is null or pc.price <= max_price)
      and (min_price is null or pc.price >= min_price)
      and (query_finish is null or pc.finish ilike '%' || query_finish || '%')
    order by match_score desc, pc.price asc
    limit result_limit;
end;
$$;

-- Seed with a curated product catalog (~50 real products across styles)
insert into public.product_catalog (name, brand, category, price, url, image_url, style_tags, finish, dimensions, description) values
  -- Modern / Contemporary
  ('Harmony Sofa 82"', 'West Elm', 'seating', 1999.00, 'https://westelm.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,contemporary,minimalist}', 'Performance velvet', '82"W x 36"D x 34"H', 'Clean-lined modern sofa with tapered legs'),
  ('Slope Leather Sofa', 'West Elm', 'seating', 2499.00, 'https://westelm.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,industrial,mid-century}', 'Saddle leather', '80"W x 36"D x 32"H', 'Angled leather sofa with solid wood frame'),
  ('Eames Lounge Chair', 'Herman Miller', 'seating', 5495.00, 'https://hermanmiller.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{modern,mid-century,iconic}', 'Santos Palisander veneer', '33"W x 33"D x 33"H', 'Iconic mid-century lounge chair and ottoman'),
  ('Womb Chair', 'Knoll', 'seating', 4890.00, 'https://knoll.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{modern,mid-century,sculptural}', 'Boucle upholstery', '40"W x 34"D x 36"H', 'Saarinen sculptural lounge chair'),
  ('Noguchi Coffee Table', 'Herman Miller', 'tables', 1890.00, 'https://hermanmiller.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{modern,mid-century,sculptural}', 'Walnut base, glass top', '50"L x 36"W x 16"H', 'Isamu Noguchi freeform glass table'),
  ('Marble Tulip Table', 'Knoll', 'tables', 3200.00, 'https://knoll.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{modern,mid-century,minimalist}', 'Arabescato marble', '54" diameter x 29"H', 'Saarinen pedestal dining table'),
  ('Arco Floor Lamp', 'FLOS', 'lighting', 2950.00, 'https://flos.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{modern,iconic,italian}', 'Carrara marble base', '82"H arc', 'Castiglioni arching floor lamp'),
  ('IC Lights T', 'FLOS', 'lighting', 695.00, 'https://flos.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{modern,minimalist,italian}', 'Brushed brass', '14"H', 'Michael Anastassiades blown-glass table lamp'),
  ('Nelson Saucer Pendant', 'Herman Miller', 'lighting', 750.00, 'https://hermanmiller.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{modern,mid-century,organic}', 'White polymer', '18" diameter', 'George Nelson bubble pendant'),
  ('Moroccan Wool Rug 8x10', 'West Elm', 'textiles', 1299.00, 'https://westelm.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{modern,bohemian,textured}', 'Hand-tufted wool', '8'' x 10''', 'Abstract geometric pattern wool rug'),

  -- Japandi / Scandinavian
  ('Muji Oak 3-Seat Sofa', 'Muji', 'seating', 2400.00, 'https://muji.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{japandi,scandinavian,minimalist}', 'White oak frame, linen cushion', '78"W x 32"D x 30"H', 'Simple oak frame sofa with removable covers'),
  ('CH24 Wishbone Chair', 'Carl Hansen', 'seating', 795.00, 'https://carlhansen.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{scandinavian,japandi,classic}', 'Natural oak, paper cord seat', '22"W x 21"D x 30"H', 'Hans Wegner iconic dining chair'),
  ('Woven Rattan Accent Chair', 'Article', 'seating', 749.00, 'https://article.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{japandi,bohemian,natural}', 'Natural rattan', '28"W x 30"D x 32"H', 'Handwoven rattan lounge chair'),
  ('HAY CPH30 Table', 'HAY', 'tables', 1450.00, 'https://hay.dk', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{scandinavian,japandi,minimalist}', 'Lacquered oak', '78"L x 35"W x 29"H', 'Ronan & Erwan Bouroullec dining table'),
  ('Muji Pine Low Table', 'Muji', 'tables', 590.00, 'https://muji.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{japandi,minimalist,natural}', 'Natural pine', '48"L x 24"W x 14"H', 'Low-profile pine coffee table'),
  ('Akari Light Sculpture 1N', 'Vitra', 'lighting', 450.00, 'https://vitra.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{japandi,organic,sculptural}', 'Washi paper, bamboo', '12" diameter', 'Isamu Noguchi paper lantern table lamp'),
  ('Muuto Unfold Pendant', 'Muuto', 'lighting', 285.00, 'https://muuto.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{scandinavian,minimalist,playful}', 'Silicone rubber', '13" diameter', 'Soft foldable pendant light'),
  ('Linen Curtain Panel', 'Crate & Barrel', 'textiles', 189.00, 'https://crateandbarrel.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{japandi,scandinavian,natural}', 'Washed linen', '50"W x 96"L', 'Lightweight washed linen drape'),
  ('Jute Area Rug 8x10', 'Pottery Barn', 'textiles', 899.00, 'https://potterybarn.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{japandi,natural,coastal}', 'Natural jute', '8'' x 10''', 'Handwoven natural fiber rug'),

  -- Industrial
  ('Restoration Hardware Cloud Sofa', 'Restoration Hardware', 'seating', 4995.00, 'https://rh.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{industrial,modern,luxe}', 'Belgian linen', '96"W x 44"D x 31"H', 'Deep-seated modular cloud sofa'),
  ('Maxwell Leather Chair', 'Restoration Hardware', 'seating', 2695.00, 'https://rh.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{industrial,traditional,luxe}', 'Italian leather', '33"W x 38"D x 32"H', 'Tufted leather club chair'),
  ('Reclaimed Wood Dining Table', 'Restoration Hardware', 'tables', 3250.00, 'https://rh.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{industrial,rustic,natural}', 'Reclaimed elm, iron base', '84"L x 40"W x 30"H', 'Trestle dining table with aged iron'),
  ('Factory Cart Coffee Table', 'Restoration Hardware', 'tables', 1195.00, 'https://rh.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{industrial,vintage,rustic}', 'Cast iron, reclaimed wood', '52"L x 32"W x 17"H', 'Vintage foundry cart table'),
  ('Circa 1900 Filament Pendant', 'Restoration Hardware', 'lighting', 425.00, 'https://rh.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{industrial,vintage,rustic}', 'Iron, clear glass', '14" diameter', 'Vintage Edison-style cage pendant'),
  ('Anglepoise Original 1227', 'Anglepoise', 'lighting', 390.00, 'https://anglepoise.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{industrial,classic,british}', 'Chrome and satin', '18"H adjustable', 'Classic British articulated desk lamp'),
  ('Vintage Persian Rug 6x9', 'ABC Carpet', 'textiles', 2400.00, 'https://abccarpet.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{industrial,bohemian,vintage}', 'Hand-knotted wool', '6'' x 9''', 'One-of-a-kind overdyed vintage rug'),

  -- Traditional / Classic
  ('Chesterfield Sofa', 'Pottery Barn', 'seating', 3299.00, 'https://potterybarn.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{traditional,classic,british}', 'Full-grain leather', '86"W x 38"D x 30"H', 'Button-tufted roll-arm leather sofa'),
  ('Wingback Armchair', 'Pottery Barn', 'seating', 1499.00, 'https://potterybarn.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{traditional,classic,cozy}', 'Performance tweed', '31"W x 34"D x 42"H', 'Classic high-back wingback chair'),
  ('Pedestal Round Table', 'Pottery Barn', 'tables', 1599.00, 'https://potterybarn.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{traditional,classic,farmhouse}', 'Distressed pine', '48" diameter x 30"H', 'Turned pedestal dining table'),
  ('Crystal Chandelier', 'Pottery Barn', 'lighting', 1299.00, 'https://potterybarn.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{traditional,classic,glam}', 'Polished nickel, crystal', '28" diameter', 'Tiered crystal chandelier'),
  ('Silk Damask Curtains', 'Pottery Barn', 'textiles', 349.00, 'https://potterybarn.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{traditional,classic,luxe}', 'Silk-cotton blend', '50"W x 108"L', 'Damask pattern drapery panels'),

  -- Budget-friendly / IKEA
  ('KIVIK Sofa', 'IKEA', 'seating', 699.00, 'https://ikea.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,scandinavian,budget}', 'Machine-washable cover', '90"W x 37"D x 32"H', 'Generous deep-seated sofa'),
  ('POÄNG Armchair', 'IKEA', 'seating', 179.00, 'https://ikea.com', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80', '{scandinavian,budget,classic}', 'Birch veneer', '27"W x 32"D x 39"H', 'Bentwood frame with cushion'),
  ('LISABO Dining Table', 'IKEA', 'tables', 249.00, 'https://ikea.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{scandinavian,budget,minimalist}', 'Ash veneer', '55"L x 31"W x 29"H', 'Clean-lined ash veneer table'),
  ('STOCKHOLM Coffee Table', 'IKEA', 'tables', 349.00, 'https://ikea.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{scandinavian,modern,budget}', 'Walnut veneer', '71"L x 23"W x 14"H', 'Low walnut-veneer coffee table'),
  ('HEKTAR Pendant', 'IKEA', 'lighting', 49.99, 'https://ikea.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{industrial,budget,scandinavian}', 'Powder-coated steel', '19" diameter', 'Industrial-style dome pendant'),
  ('SINNERLIG Pendant', 'IKEA', 'lighting', 69.99, 'https://ikea.com', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80', '{japandi,natural,budget}', 'Bamboo', '18" diameter', 'Ilse Crawford bamboo pendant'),
  ('LOHALS Rug 5x8', 'IKEA', 'textiles', 149.00, 'https://ikea.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{natural,budget,scandinavian}', 'Natural jute', '5''3" x 7''7"', 'Flatwoven jute rug'),

  -- CB2 / Crate & Barrel
  ('Gwyneth Coffee Table', 'CB2', 'tables', 899.00, 'https://cb2.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{modern,contemporary,minimalist}', 'Brushed brass, glass', '48"L x 24"W x 15"H', 'Brass frame glass-top coffee table'),
  ('Avec Sofa', 'CB2', 'seating', 2199.00, 'https://cb2.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,contemporary,compact}', 'Performance fabric', '76"W x 34"D x 30"H', 'Track-arm modern sofa'),
  ('Marble Round Table', 'CB2', 'tables', 1199.00, 'https://cb2.com', 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80', '{modern,luxe,contemporary}', 'Carrara marble', '42" diameter x 29"H', 'Solid marble bistro table'),

  -- Article
  ('Sven Charme Sofa', 'Article', 'seating', 1799.00, 'https://article.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,mid-century,scandinavian}', 'Italian leather', '88"W x 38"D x 33"H', 'Tufted mid-century leather sofa'),
  ('Ceni Sofa', 'Article', 'seating', 1299.00, 'https://article.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,scandinavian,budget}', 'Pyrite gray fabric', '82"W x 35"D x 33"H', 'Tapered leg upholstered sofa'),

  -- Storage & decor
  ('USM Haller Sideboard', 'USM', 'storage', 2850.00, 'https://usm.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,minimalist,iconic}', 'Chrome and steel', '60"W x 15"D x 29"H', 'Modular steel and chrome system'),
  ('String Shelf System', 'String', 'storage', 650.00, 'https://stringfurniture.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{scandinavian,minimalist,classic}', 'White lacquer, oak', '78"W x 8"D x 50"H', 'Wall-mounted modular shelving'),
  ('KALLAX Shelf Unit', 'IKEA', 'storage', 89.99, 'https://ikea.com', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', '{modern,budget,scandinavian}', 'White laminate', '57"W x 15"D x 57"H', '4x4 cube bookshelf'),
  ('Terracotta Planter Set', 'West Elm', 'decor', 129.00, 'https://westelm.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{bohemian,natural,japandi}', 'Unglazed terracotta', 'Set of 3 sizes', 'Handmade terracotta plant pots'),
  ('Ceramic Vase Collection', 'CB2', 'decor', 79.00, 'https://cb2.com', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80', '{modern,minimalist,scandinavian}', 'Matte white ceramic', 'Set of 3', 'Organic-form white ceramic vases');

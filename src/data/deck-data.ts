export type SlideType =
  | "cover"
  | "brief"
  | "perspective"
  | "floor-plan"
  | "palette"
  | "sourcing"
  | "budget"
  | "next-steps";

export interface DeckSlide {
  id: string;
  type: SlideType;
  label: string;
  aiGenerated: boolean;
}

export const deckSlides: DeckSlide[] = [
  { id: "s1", type: "cover", label: "Cover", aiGenerated: false },
  { id: "s2", type: "brief", label: "Brief", aiGenerated: true },
  { id: "s3", type: "perspective", label: "Perspective 1", aiGenerated: true },
  { id: "s4", type: "perspective", label: "Perspective 2", aiGenerated: true },
  { id: "s5", type: "floor-plan", label: "Floor Plan", aiGenerated: false },
  { id: "s6", type: "palette", label: "Material Palette", aiGenerated: true },
  { id: "s7", type: "sourcing", label: "Sourcing", aiGenerated: true },
  { id: "s8", type: "budget", label: "Budget", aiGenerated: true },
  { id: "s9", type: "next-steps", label: "Next Steps", aiGenerated: true },
];

export interface PaletteColor {
  name: string;
  hex: string;
}

export const materialPalette: PaletteColor[] = [
  { name: "White Oak", hex: "#c9b99a" },
  { name: "Natural Linen", hex: "#ddd5c8" },
  { name: "Warm Stone", hex: "#b8a99a" },
  { name: "Soft Clay", hex: "#c4a882" },
  { name: "Matte Charcoal", hex: "#5a5a58" },
  { name: "Fog Grey", hex: "#d4d2ce" },
];

export interface SourcingProduct {
  name: string;
  price: string;
  brand: string;
}

export const sourcingProducts: SourcingProduct[] = [
  { name: "Slope 3-Seat Sofa", price: "$3,200", brand: "RH" },
  { name: "Sadie Floor Lamp", price: "$480", brand: "Rejuvenation" },
  { name: "Arden Wool Rug 8×10", price: "$1,400", brand: "West Elm" },
];

export interface BudgetCategory {
  name: string;
  amount: number;
}

export const budgetCategories: BudgetCategory[] = [
  { name: "Seating", amount: 4600 },
  { name: "Lighting", amount: 1800 },
  { name: "Rugs & Textiles", amount: 2200 },
  { name: "Tables", amount: 1900 },
  { name: "Accessories", amount: 1900 },
];

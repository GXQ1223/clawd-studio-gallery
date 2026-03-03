export interface WallAsset {
  id: string;
  name: string;
  category: "render" | "plan" | "sketch" | "product" | "reference";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  aiGenerated?: boolean;
  /** product fields */
  productName?: string;
  productPrice?: string;
  productBrand?: string;
  /** visual style */
  style: "render" | "plan" | "sketch" | "product" | "reference";
}

export interface WallZone {
  label: string;
  x: number;
  y: number;
}

export const wallZones: WallZone[] = [
  { label: "RENDERS", x: 80, y: 60 },
  { label: "PLANS & DRAWINGS", x: 80, y: 520 },
  { label: "SOURCING", x: 900, y: 60 },
  { label: "REFERENCES", x: 80, y: 900 },
];

export const wallAssets: WallAsset[] = [
  // Renders zone
  { id: "w1", name: "Living Room — Japandi A", category: "render", x: 100, y: 100, width: 320, height: 220, rotation: -1.2, aiGenerated: true, style: "render" },
  { id: "w2", name: "Living Room — Japandi B", category: "render", x: 460, y: 120, width: 300, height: 210, rotation: 1.5, aiGenerated: true, style: "render" },
  { id: "w3", name: "Window Seat Detail", category: "render", x: 260, y: 340, width: 280, height: 200, rotation: -0.8, aiGenerated: true, style: "render" },
  // Plans zone
  { id: "w4", name: "Floor Plan — L-shaped", category: "plan", x: 100, y: 560, width: 300, height: 280, rotation: 0, style: "plan" },
  { id: "w5", name: "Initial Concept Sketch", category: "sketch", x: 440, y: 580, width: 280, height: 240, rotation: 1, style: "sketch" },
  // Sourcing zone
  { id: "w6", name: "Slope 3-Seat Sofa", category: "product", x: 920, y: 100, width: 220, height: 180, rotation: 0, productName: "Slope 3-Seat", productPrice: "$3,200", productBrand: "RH", style: "product" },
  { id: "w7", name: "Sadie Floor Lamp", category: "product", x: 1170, y: 110, width: 200, height: 180, rotation: -0.5, productName: "Sadie Lamp", productPrice: "$480", productBrand: "Rejuvenation", style: "product" },
  { id: "w8", name: "Gwyneth Coffee Table", category: "product", x: 940, y: 310, width: 210, height: 180, rotation: 0.8, productName: "Gwyneth Table", productPrice: "$890", productBrand: "CB2", style: "product" },
  // References zone
  { id: "w9", name: "Japandi Mood 1", category: "reference", x: 100, y: 940, width: 200, height: 150, rotation: -1.5, style: "reference" },
  { id: "w10", name: "Material Palette", category: "reference", x: 340, y: 960, width: 200, height: 150, rotation: 1, style: "reference" },
  { id: "w11", name: "Window Treatments Ref", category: "reference", x: 580, y: 930, width: 200, height: 150, rotation: -0.5, style: "reference" },
];

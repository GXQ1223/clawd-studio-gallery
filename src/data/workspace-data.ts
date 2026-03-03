export interface Asset {
  id: string;
  name: string;
  category: "perspective" | "plan" | "elevation" | "section" | "sketch" | "model photo" | "3d model" | "misc";
  date: string;
  aiGenerated: boolean;
}

export const riversideAssets: Asset[] = [
  { id: "a1", name: "Living Room — Japandi Direction A", category: "perspective", date: "Mar 2, 09:15", aiGenerated: true },
  { id: "a2", name: "Living Room — Japandi Direction B", category: "perspective", date: "Mar 2, 09:15", aiGenerated: true },
  { id: "a3", name: "Window Seat Detail", category: "perspective", date: "Mar 2, 09:16", aiGenerated: true },
  { id: "a4", name: "Floor Plan — L-shaped Layout", category: "plan", date: "Mar 1, 14:30", aiGenerated: false },
  { id: "a5", name: "Initial Concept Sketch", category: "sketch", date: "Feb 28, 11:00", aiGenerated: false },
];

export interface FeedEntry {
  id: string;
  time: string;
  text: string;
  inProgress?: boolean;
}

export const riversideFeed: FeedEntry[] = [
  { id: "f1", time: "09:12", text: "Opened project brief — Riverside Apartment, Living Room" },
  { id: "f2", time: "09:14", text: "Analyzed floor plan — 24ft × 16ft, L-shaped, 2 north windows" },
  { id: "f3", time: "09:15", text: "Generated 3 perspectives — Japandi direction" },
  { id: "f4", time: "09:31", text: "Found sofa at RH: Slope 3-seat $3,200 — fits 14ft wall" },
  { id: "f5", time: "09:45", text: "Found coffee table at CB2: Gwyneth $890 — walnut finish" },
  { id: "f6", time: "10:02", text: "Draft deck ready — 9 slides" },
  { id: "f7", time: "10:15", text: "Sourcing accent chairs under $800...", inProgress: true },
];

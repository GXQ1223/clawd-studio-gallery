export type JournalEntryType = "system" | "agent" | "user" | "upload";

export type AgentContentType = "image" | "product" | "analysis" | "none";
export type ImageStyle = "render" | "plan" | "sketch";

export interface JournalEntry {
  id: string;
  type: JournalEntryType;
  time: string;
  text: string;
  inProgress?: boolean;
  /** Agent-specific */
  contentType?: AgentContentType;
  imageStyle?: ImageStyle;
  /** Product-specific */
  productName?: string;
  productPrice?: string;
  productSource?: string;
  /** Upload-specific */
  fileName?: string;
  fileCategory?: string;
}

export const journalFeed: JournalEntry[] = [
  {
    id: "j1",
    type: "system",
    time: "Feb 28, 9:00 AM",
    text: "Project created · Feb 28",
  },
  {
    id: "j2",
    type: "upload",
    time: "Feb 28, 9:02 AM",
    text: "Floor plan uploaded",
    fileName: "floor-plan.jpg",
    fileCategory: "plan",
  },
  {
    id: "j3",
    type: "agent",
    time: "09:14",
    text: "Analyzed floor plan — 24ft × 16ft, L-shaped, 2 windows north wall",
    contentType: "image",
    imageStyle: "plan",
  },
  {
    id: "j4",
    type: "agent",
    time: "09:15",
    text: "Detected Japandi-leaning style from reference photos. Generating 3 perspectives.",
    contentType: "image",
    imageStyle: "render",
  },
  {
    id: "j5",
    type: "agent",
    time: "09:17",
    text: "Generated perspective 1 — morning light, east facing",
    contentType: "image",
    imageStyle: "render",
  },
  {
    id: "j6",
    type: "user",
    time: "09:22",
    text: "Focus on natural materials — oak, linen, stone",
  },
  {
    id: "j7",
    type: "agent",
    time: "09:24",
    text: "Noted. Adjusting material palette — warmer tones, matte finishes, woven textures.",
    contentType: "image",
    imageStyle: "render",
  },
  {
    id: "j8",
    type: "agent",
    time: "09:31",
    text: "Found sofa at RH: Slope 3-seat — fits 14ft wall ✓",
    contentType: "product",
    productName: "RH Slope 3-Seat Sofa",
    productPrice: "$3,200",
    productSource: "Restoration Hardware",
  },
  {
    id: "j9",
    type: "agent",
    time: "09:45",
    text: "Found floor lamp — corner placement by north window",
    contentType: "product",
    productName: "Sadie Floor Lamp",
    productPrice: "$480",
    productSource: "Rejuvenation",
  },
  {
    id: "j10",
    type: "system",
    time: "10:02 AM",
    text: "Draft deck assembled — 9 slides",
  },
  {
    id: "j11",
    type: "agent",
    time: "10:15",
    text: "Sourcing accent chairs under $800...",
    contentType: "none",
    inProgress: true,
  },
];

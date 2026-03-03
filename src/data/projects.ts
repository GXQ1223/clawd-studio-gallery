import imgRiverside from "@/assets/project-riverside.jpg";
import imgParkave from "@/assets/project-parkave.jpg";
import imgSoho from "@/assets/project-soho.jpg";
import imgChelsea from "@/assets/project-chelsea.jpg";
import imgHomeoffice from "@/assets/project-homeoffice.jpg";
import imgTribeca from "@/assets/project-tribeca.jpg";
import imgDining from "@/assets/project-dining.jpg";

export type ProjectStatus = "active" | "draft" | "complete";

export interface Project {
  id: string;
  name: string;
  room?: string;
  status: ProjectStatus;
  dimensions: string;
  budget?: string;
  image: string;
  agentTask?: string;
  folders?: { name: string; count: number }[];
}

export const projects: Project[] = [
  {
    id: "1",
    name: "Riverside Apartment",
    room: "LR",
    status: "active",
    dimensions: "24ft × 16ft × 9ft",
    budget: "$28k",
    image: imgRiverside,
    agentTask: "generating perspectives",
    folders: [
      { name: "perspective", count: 3 },
      { name: "sketch", count: 5 },
      { name: "plan", count: 1 },
      { name: "elevation", count: 0 },
      { name: "section", count: 0 },
      { name: "model photo", count: 2 },
      { name: "3d model", count: 0 },
    ],
  },
  {
    id: "2",
    name: "Park Ave Kitchen",
    status: "complete",
    dimensions: "18ft × 12ft",
    image: imgParkave,
    folders: [
      { name: "perspective", count: 4 },
      { name: "sketch", count: 2 },
      { name: "plan", count: 1 },
      { name: "elevation", count: 2 },
      { name: "section", count: 1 },
      { name: "model photo", count: 0 },
      { name: "3d model", count: 1 },
    ],
  },
  {
    id: "3",
    name: "SoHo Loft",
    room: "Master BR",
    status: "draft",
    dimensions: "20ft × 18ft",
    image: imgSoho,
    folders: [
      { name: "perspective", count: 1 },
      { name: "sketch", count: 3 },
      { name: "plan", count: 0 },
      { name: "elevation", count: 0 },
      { name: "section", count: 0 },
      { name: "model photo", count: 0 },
      { name: "3d model", count: 0 },
    ],
  },
  {
    id: "4",
    name: "Chelsea Studio",
    status: "active",
    dimensions: "400 sqft",
    budget: "$12k",
    image: imgChelsea,
    folders: [
      { name: "perspective", count: 2 },
      { name: "sketch", count: 4 },
      { name: "plan", count: 1 },
      { name: "elevation", count: 1 },
      { name: "section", count: 0 },
      { name: "model photo", count: 0 },
      { name: "3d model", count: 0 },
    ],
  },
  {
    id: "5",
    name: "Home Office",
    room: "SF",
    status: "complete",
    dimensions: "14ft × 12ft",
    image: imgHomeoffice,
    folders: [
      { name: "perspective", count: 3 },
      { name: "sketch", count: 2 },
      { name: "plan", count: 1 },
      { name: "elevation", count: 1 },
      { name: "section", count: 1 },
      { name: "model photo", count: 1 },
      { name: "3d model", count: 1 },
    ],
  },
  {
    id: "6",
    name: "Tribeca Bath Reno",
    status: "draft",
    dimensions: "8ft × 11ft",
    image: imgTribeca,
    folders: [
      { name: "perspective", count: 0 },
      { name: "sketch", count: 1 },
      { name: "plan", count: 0 },
      { name: "elevation", count: 0 },
      { name: "section", count: 0 },
      { name: "model photo", count: 0 },
      { name: "3d model", count: 0 },
    ],
  },
  {
    id: "7",
    name: "Dining Room",
    room: "Palo Alto",
    status: "active",
    dimensions: "16ft × 14ft",
    budget: "$18k",
    image: imgDining,
    folders: [
      { name: "perspective", count: 2 },
      { name: "sketch", count: 3 },
      { name: "plan", count: 1 },
      { name: "elevation", count: 0 },
      { name: "section", count: 0 },
      { name: "model photo", count: 0 },
      { name: "3d model", count: 0 },
    ],
  },
];

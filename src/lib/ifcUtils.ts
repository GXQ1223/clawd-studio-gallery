/**
 * Lightweight IFC (Industry Foundation Classes) utilities.
 *
 * IFC files use the STEP physical file format (ISO 10303-21).
 * This module provides:
 * - Basic IFC STEP parser for extracting entities & hierarchy
 * - IFC 2x3 file generator from project data
 *
 * For full BIM authoring, integrate with web-ifc or IFC.js.
 */

// ─── Types ────────────────────────────────────────────────────

export interface IfcEntity {
  id: number;
  type: string;
  name: string;
  description: string;
  attributes: string[];
  children: IfcEntity[];
}

export interface IfcProjectSummary {
  schema: string;
  projectName: string;
  entities: IfcEntity[];
  entityCounts: Record<string, number>;
  totalEntities: number;
}

export interface BimRoom {
  name: string;
  width?: number;
  length?: number;
  height?: number;
}

export interface BimProduct {
  name: string;
  category: string;
  brand?: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface BimProjectData {
  projectName: string;
  projectType?: string;
  dimensions?: string;
  rooms: BimRoom[];
  products: BimProduct[];
}

// ─── IFC STEP Parser (read) ──────────────────────────────────

const ENTITY_RE = /^#(\d+)\s*=\s*(\w+)\s*\((.*)?\)\s*;$/;

/** Extract a quoted string from STEP data, e.g. 'My Building' */
function extractString(raw: string): string {
  const match = raw.match(/^'(.*)'$/);
  return match ? match[1].replace(/''/g, "'") : raw.replace(/^\$/, "—");
}

/** Parse an IFC STEP file string into a project summary */
export function parseIfcFile(content: string): IfcProjectSummary {
  const lines = content.split("\n").map((l) => l.trim());

  // Detect schema
  let schema = "IFC2X3";
  const schemaLine = lines.find((l) => l.startsWith("FILE_SCHEMA"));
  if (schemaLine) {
    const m = schemaLine.match(/'([^']+)'/);
    if (m) schema = m[1];
  }

  // Parse entities
  const entityMap = new Map<number, IfcEntity>();
  const entityCounts: Record<string, number> = {};

  for (const line of lines) {
    const match = line.match(ENTITY_RE);
    if (!match) continue;

    const id = parseInt(match[1], 10);
    const type = match[2];
    const attrStr = match[3] || "";
    const attributes = splitStepAttributes(attrStr);

    entityCounts[type] = (entityCounts[type] || 0) + 1;

    // Extract name and description from common IFC entities
    let name = "";
    let description = "";

    if (isNamedEntity(type) && attributes.length >= 5) {
      name = extractString(attributes[2] || "$");
      description = extractString(attributes[3] || "$");
    }

    entityMap.set(id, { id, type, name, description, attributes, children: [] });
  }

  // Build parent-child relationships from IFCRELAGGREGATES and IFCRELCONTAINEDINSPATIALSTRUCTURE
  for (const entity of entityMap.values()) {
    if (entity.type === "IFCRELAGGREGATES") {
      const parentRef = parseRef(entity.attributes[4]);
      const childRefs = parseRefList(entity.attributes[5]);
      const parent = parentRef ? entityMap.get(parentRef) : null;
      if (parent) {
        for (const childId of childRefs) {
          const child = entityMap.get(childId);
          if (child) parent.children.push(child);
        }
      }
    }
    if (entity.type === "IFCRELCONTAINEDINSPATIALSTRUCTURE") {
      const containerRef = parseRef(entity.attributes[5]);
      const elementRefs = parseRefList(entity.attributes[4]);
      const container = containerRef ? entityMap.get(containerRef) : null;
      if (container) {
        for (const elId of elementRefs) {
          const el = entityMap.get(elId);
          if (el) container.children.push(el);
        }
      }
    }
  }

  // Find project root
  const projectName = findProjectName(entityMap) || "Untitled";

  // Build top-level tree: IFCPROJECT → IFCSITE → IFCBUILDING → IFCBUILDINGSTOREY → elements
  const roots = Array.from(entityMap.values()).filter(
    (e) => e.type === "IFCPROJECT" || (e.type === "IFCSITE" && e.children.length > 0)
  );

  // If no tree structure, group by spatial types
  const entities = roots.length > 0 ? roots : groupBySpatialType(entityMap);

  return {
    schema,
    projectName,
    entities,
    entityCounts,
    totalEntities: entityMap.size,
  };
}

function findProjectName(map: Map<number, IfcEntity>): string | null {
  for (const e of map.values()) {
    if (e.type === "IFCPROJECT" && e.name && e.name !== "—") return e.name;
  }
  return null;
}

function isNamedEntity(type: string): boolean {
  return [
    "IFCPROJECT", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY",
    "IFCSPACE", "IFCWALL", "IFCWALLSTANDARDCASE", "IFCSLAB",
    "IFCCOLUMN", "IFCBEAM", "IFCDOOR", "IFCWINDOW",
    "IFCFURNISHINGELEMENT", "IFCROOF", "IFCSTAIR", "IFCRAILING",
    "IFCCURTAINWALL", "IFCMEMBER", "IFCPLATE", "IFCFOOTING",
  ].includes(type);
}

function splitStepAttributes(s: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseRef(s: string): number | null {
  const m = s?.match(/#(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseRefList(s: string): number[] {
  if (!s) return [];
  const matches = s.matchAll(/#(\d+)/g);
  return Array.from(matches).map((m) => parseInt(m[1], 10));
}

function groupBySpatialType(map: Map<number, IfcEntity>): IfcEntity[] {
  const spatial = ["IFCPROJECT", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE"];
  return Array.from(map.values())
    .filter((e) => spatial.includes(e.type) || e.type.startsWith("IFCWALL") || e.type === "IFCDOOR" || e.type === "IFCWINDOW" || e.type === "IFCFURNISHINGELEMENT")
    .sort((a, b) => spatial.indexOf(a.type) - spatial.indexOf(b.type));
}

// ─── IFC STEP Generator (write) ──────────────────────────────

let nextId = 1;
function sid(): string {
  return `#${nextId++}`;
}

function stepString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Generate a minimal IFC 2x3 STEP file from project data.
 * Suitable for import into Revit, ArchiCAD, and other BIM tools.
 */
export function generateIfcFile(data: BimProjectData): string {
  nextId = 1;
  const lines: string[] = [];
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];

  // Header
  lines.push("ISO-10303-21;");
  lines.push("HEADER;");
  lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`);
  lines.push(`FILE_NAME(${stepString(`${data.projectName}.ifc`)},'${timestamp}',('clawd-studio'),('clawd-studio'),'','clawd-studio','');`);
  lines.push(`FILE_SCHEMA(('IFC2X3'));`);
  lines.push("ENDSEC;");
  lines.push("DATA;");

  // Organization / ownership
  const personId = sid();
  lines.push(`${personId}=IFCPERSON($,$,${stepString("Designer")},$,$,$,$,$);`);
  const orgId = sid();
  lines.push(`${orgId}=IFCORGANIZATION($,${stepString("clawd-studio")},$,$,$);`);
  const personOrgId = sid();
  lines.push(`${personOrgId}=IFCPERSONANDORGANIZATION(${personId},${orgId},$);`);
  const appId = sid();
  lines.push(`${appId}=IFCAPPLICATION(${orgId},'1.0',${stepString("clawd-studio")},'clawd-studio');`);
  const ownerHistId = sid();
  lines.push(`${ownerHistId}=IFCOWNERHISTORY(${personOrgId},${appId},$,.NOCHANGE.,$,${personOrgId},${appId},${Math.floor(now.getTime() / 1000)});`);

  // Geometric context
  const originId = sid();
  lines.push(`${originId}=IFCCARTESIANPOINT((0.,0.,0.));`);
  const dirZId = sid();
  lines.push(`${dirZId}=IFCDIRECTION((0.,0.,1.));`);
  const dirXId = sid();
  lines.push(`${dirXId}=IFCDIRECTION((1.,0.,0.));`);
  const axisId = sid();
  lines.push(`${axisId}=IFCAXIS2PLACEMENT3D(${originId},${dirZId},${dirXId});`);
  const contextId = sid();
  lines.push(`${contextId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-05,${axisId},$);`);

  // Units (metric — millimeters)
  const siLengthId = sid();
  lines.push(`${siLengthId}=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);`);
  const siAreaId = sid();
  lines.push(`${siAreaId}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);
  const siVolumeId = sid();
  lines.push(`${siVolumeId}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);
  const siAngleId = sid();
  lines.push(`${siAngleId}=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);`);
  const unitAssignId = sid();
  lines.push(`${unitAssignId}=IFCUNITASSIGNMENT((${siLengthId},${siAreaId},${siVolumeId},${siAngleId}));`);

  // Project
  const projectId = sid();
  lines.push(`${projectId}=IFCPROJECT('${generateGuid()}',${ownerHistId},${stepString(data.projectName)},${data.projectType ? stepString(data.projectType) : "$"},$,$,$,(${contextId}),${unitAssignId});`);

  // Site
  const siteId = sid();
  lines.push(`${siteId}=IFCSITE('${generateGuid()}',${ownerHistId},${stepString("Default Site")},$,$,$,$,$,.ELEMENT.,$,$,$,$,$);`);

  // Building
  const buildingId = sid();
  lines.push(`${buildingId}=IFCBUILDING('${generateGuid()}',${ownerHistId},${stepString(data.projectName + " Building")},$,$,$,$,$,.ELEMENT.,$,$,$);`);

  // Storey
  const storeyId = sid();
  lines.push(`${storeyId}=IFCBUILDINGSTOREY('${generateGuid()}',${ownerHistId},${stepString("Ground Floor")},$,$,$,$,$,.ELEMENT.,0.);`);

  // Aggregation relationships
  const relSiteId = sid();
  lines.push(`${relSiteId}=IFCRELAGGREGATES('${generateGuid()}',${ownerHistId},$,$,${projectId},(${siteId}));`);
  const relBuildingId = sid();
  lines.push(`${relBuildingId}=IFCRELAGGREGATES('${generateGuid()}',${ownerHistId},$,$,${siteId},(${buildingId}));`);
  const relStoreyId = sid();
  lines.push(`${relStoreyId}=IFCRELAGGREGATES('${generateGuid()}',${ownerHistId},$,$,${buildingId},(${storeyId}));`);

  // Rooms / Spaces
  const spaceIds: string[] = [];
  for (const room of data.rooms) {
    const spaceId = sid();
    const w = room.width || 4000; // default 4m
    const l = room.length || 5000; // default 5m
    const h = room.height || 2700; // default 2.7m

    // Create space with bounding box representation
    const ptId = sid();
    lines.push(`${ptId}=IFCCARTESIANPOINT((0.,0.,0.));`);
    const pt2Id = sid();
    lines.push(`${pt2Id}=IFCCARTESIANPOINT((${w}.,${l}.,${h}.));`);
    const boxId = sid();
    lines.push(`${boxId}=IFCBOUNDINGBOX(${ptId},${w}.,${l}.,${h}.);`);

    const placementOriginId = sid();
    lines.push(`${placementOriginId}=IFCCARTESIANPOINT((0.,0.,0.));`);
    const localPlacementAxisId = sid();
    lines.push(`${localPlacementAxisId}=IFCAXIS2PLACEMENT3D(${placementOriginId},$,$);`);
    const localPlacementId = sid();
    lines.push(`${localPlacementId}=IFCLOCALPLACEMENT($,${localPlacementAxisId});`);

    lines.push(`${spaceId}=IFCSPACE('${generateGuid()}',${ownerHistId},${stepString(room.name)},$,$,${localPlacementId},$,$,.ELEMENT.,.INTERNAL.,$);`);
    spaceIds.push(spaceId);
  }

  if (spaceIds.length > 0) {
    const relSpacesId = sid();
    lines.push(`${relSpacesId}=IFCRELAGGREGATES('${generateGuid()}',${ownerHistId},$,$,${storeyId},(${spaceIds.join(",")}));`);
  }

  // Furniture / products
  const furnIds: string[] = [];
  for (const product of data.products) {
    const furnId = sid();
    const px = product.x || 0;
    const py = product.y || 0;
    const pz = product.z || 0;

    const furnOriginId = sid();
    lines.push(`${furnOriginId}=IFCCARTESIANPOINT((${px}.,${py}.,${pz}.));`);
    const furnAxisId = sid();
    lines.push(`${furnAxisId}=IFCAXIS2PLACEMENT3D(${furnOriginId},$,$);`);
    const furnPlacementId = sid();
    lines.push(`${furnPlacementId}=IFCLOCALPLACEMENT($,${furnAxisId});`);

    const desc = product.brand ? `${product.brand} — ${product.category}` : product.category;
    lines.push(`${furnId}=IFCFURNISHINGELEMENT('${generateGuid()}',${ownerHistId},${stepString(product.name)},${stepString(desc)},$,${furnPlacementId},$,$);`);
    furnIds.push(furnId);
  }

  if (furnIds.length > 0) {
    const relFurnId = sid();
    lines.push(`${relFurnId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${generateGuid()}',${ownerHistId},$,$,(${furnIds.join(",")}),${storeyId});`);
  }

  lines.push("ENDSEC;");
  lines.push("END-ISO-10303-21;");

  return lines.join("\n");
}

/** Generate a simplified IFC GUID (22-char base64-like identifier) */
function generateGuid(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  let result = "";
  for (let i = 0; i < 22; i++) {
    result += chars[Math.floor(Math.random() * 64)];
  }
  return result;
}

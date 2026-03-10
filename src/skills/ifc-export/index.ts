import type { SkillPlugin, SkillContext, SkillToolResult, SkillManifest } from "@/lib/skills/types";
import { validateAndSanitizeParams } from "@/lib/skills/param-validation";

function generateGuid(): string {
  return "xxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  );
}

export default class IfcExportSkill implements SkillPlugin {
  manifest: SkillManifest = {
    slug: "ifc-export",
    name: "IFC Export",
    version: "1.0.0",
    description: "Export floor plans to IFC 2x3 format",
    disciplines: ["architectural", "interior"],
    requiredSecrets: [],
    optional: true,
    defaultEnabled: true,
    agentTools: [{
      name: "export_ifc",
      description: "Export the current floor plan to IFC format",
      parameters: { type: "object", properties: { include_furniture: { type: "boolean" }, ifc_version: { type: "string", enum: ["2x3", "4"] } } },
    }],
    hooks: ["onFloorPlanUpdated"],
  };

  private floorPlanData: any = null;

  async onLoad(_context: SkillContext): Promise<void> {
    console.log("IFC Export skill loaded");
  }

  async executeTool(toolName: string, _params: Record<string, any>, _context: SkillContext): Promise<SkillToolResult> {
    if (toolName !== "export_ifc") return { success: false, error: `Unknown tool: ${toolName}` };

    // Validate optional params
    const paramError = validateAndSanitizeParams(_params, ["ifc_version"]);
    if (paramError) return { success: false, error: paramError };
    if (_params.include_furniture !== undefined && typeof _params.include_furniture !== "boolean") {
      return { success: false, error: "include_furniture must be a boolean" };
    }
    if (!this.floorPlanData) return { success: false, error: "No floor plan available. Draw a floor plan first." };

    const now = new Date().toISOString();
    const guids = Array.from({ length: 8 }, generateGuid);
    let ifc = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('floor-plan.ifc','${now}',('Clawd Studio'),('Clawd Studio'),'','Clawd Studio','');\nFILE_SCHEMA(('IFC2X3'));\nENDSEC;\nDATA;\n`;
    ifc += `#1=IFCORGANIZATION($,'Clawd Studio',$,$,$);\n`;
    ifc += `#2=IFCAPPLICATION(#1,'1.0','Clawd Studio','ClawdStudio');\n`;
    ifc += `#3=IFCOWNERHISTORY(#1,#2,$,.NOCHANGE.,$,$,$,0);\n`;
    ifc += `#4=IFCDIRECTION((1.,0.,0.));\n#5=IFCDIRECTION((0.,0.,1.));\n#6=IFCCARTESIANPOINT((0.,0.,0.));\n`;
    ifc += `#7=IFCAXIS2PLACEMENT3D(#6,#5,#4);\n`;
    ifc += `#8=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-05,#7,$);\n`;
    ifc += `#9=IFCUNITASSIGNMENT((#10,#11));\n#10=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n#11=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);\n`;
    ifc += `#12=IFCPROJECT('${guids[0]}',#3,'Floor Plan',$,$,$,$,(#8),#9);\n`;
    ifc += `#13=IFCSITE('${guids[1]}',#3,'Site',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);\n`;
    ifc += `#14=IFCBUILDING('${guids[2]}',#3,'Building',$,$,$,$,$,.ELEMENT.,$,$,$);\n`;
    ifc += `#15=IFCBUILDINGSTOREY('${guids[3]}',#3,'Ground Floor',$,$,$,$,$,.ELEMENT.,0.);\n`;
    ifc += `#16=IFCRELAGGREGATES('${guids[4]}',#3,$,$,#12,(#13));\n`;
    ifc += `#17=IFCRELAGGREGATES('${guids[5]}',#3,$,$,#13,(#14));\n`;
    ifc += `#18=IFCRELAGGREGATES('${guids[6]}',#3,$,$,#14,(#15));\n`;

    let entityId = 19;
    if (this.floorPlanData.walls) {
      for (const _wall of this.floorPlanData.walls) {
        ifc += `#${entityId}=IFCWALLSTANDARDCASE('${generateGuid()}',#3,'Wall',$,$,$,$,$,$);\n`;
        entityId++;
      }
    }
    ifc += `ENDSEC;\nEND-ISO-10303-21;`;

    return { success: true, data: { ifc_content: ifc, filename: "floor-plan.ifc" } };
  }

  async onUnload(): Promise<void> { this.floorPlanData = null; }

  onFloorPlanUpdated?(_floorPlanUrl: string, roomData: any, _context: SkillContext): void {
    this.floorPlanData = roomData;
  }
}

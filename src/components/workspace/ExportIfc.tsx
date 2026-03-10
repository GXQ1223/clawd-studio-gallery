import { useCallback } from "react";
import { generateIfcFile, type BimProjectData, type BimRoom, type BimProduct } from "@/lib/ifcUtils";
import type { OrchestrationResult } from "@/lib/designerAgent";

interface Props {
  projectName: string;
  projectType?: string;
  dimensions?: string;
  results: OrchestrationResult | null;
}

/** Export project data as an IFC 2x3 file for Revit / ArchiCAD import */
const ExportIfc = ({ projectName, projectType, dimensions, results }: Props) => {
  const handleExport = useCallback(() => {
    // Build rooms from dimensions string (e.g. "20x30 ft" or "5x8 m")
    const rooms: BimRoom[] = [];
    if (dimensions) {
      const dimMatch = dimensions.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*(ft|m|mm)?/i);
      if (dimMatch) {
        let w = parseFloat(dimMatch[1]);
        let l = parseFloat(dimMatch[2]);
        const unit = (dimMatch[3] || "m").toLowerCase();
        // Convert to mm for IFC
        if (unit === "ft") { w *= 304.8; l *= 304.8; }
        else if (unit === "m") { w *= 1000; l *= 1000; }
        rooms.push({ name: "Main Space", width: w, length: l, height: 2700 });
      }
    }
    if (rooms.length === 0) {
      rooms.push({ name: "Main Space", width: 5000, length: 7000, height: 2700 });
    }

    // Convert sourced products to BIM products
    const products: BimProduct[] = (results?.products || []).map((p, i) => ({
      name: p.name,
      category: p.category,
      brand: p.brand,
      x: (i % 4) * 1500 + 500,
      y: Math.floor(i / 4) * 1500 + 500,
      z: 0,
    }));

    const data: BimProjectData = {
      projectName,
      projectType,
      dimensions,
      rooms,
      products,
    };

    const ifcContent = generateIfcFile(data);

    // Download as file
    const blob = new Blob([ifcContent], { type: "application/x-step" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}.ifc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projectName, projectType, dimensions, results]);

  return (
    <button
      onClick={handleExport}
      className="h-[30px] px-3 gallery-border text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      title="Export as IFC for Revit / ArchiCAD"
    >
      Export IFC
    </button>
  );
};

export default ExportIfc;

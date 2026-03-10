import { useState } from "react";
import { projects } from "@/data/projects";
import { riversideAssets, riversideFeed } from "@/data/workspace-data";
import WorkspaceNav from "@/components/workspace/WorkspaceNav";
import ProjectBrief from "@/components/workspace/ProjectBrief";
import AssetGallery from "@/components/workspace/AssetGallery";
import AgentFeed from "@/components/workspace/AgentFeed";

const project = { ...projects[0], folders: projects[0].folders || [] };

const StudioView = () => {
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  return (
    <div className="h-full flex flex-col bg-background">
      <WorkspaceNav projectName={project.name} />
      <div className="flex flex-1 min-h-0">
        <ProjectBrief project={project} activeFolder={activeFolder} onFolderClick={setActiveFolder} />
        <AssetGallery assets={riversideAssets} activeFolder={activeFolder} />
        <AgentFeed feed={riversideFeed} />
      </div>
    </div>
  );
};

export default StudioView;

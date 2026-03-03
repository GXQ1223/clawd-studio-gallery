import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { projects } from "@/data/projects";
import { riversideAssets, riversideFeed } from "@/data/workspace-data";
import WorkspaceNav from "@/components/workspace/WorkspaceNav";
import ProjectBrief from "@/components/workspace/ProjectBrief";
import AssetGallery from "@/components/workspace/AssetGallery";
import AgentFeed from "@/components/workspace/AgentFeed";

const ProjectWorkspace = () => {
  const { id } = useParams();
  const project = projects.find((p) => p.id === id);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  if (!project) return <Navigate to="/" replace />;

  return (
    <div className="h-screen flex flex-col bg-background">
      <WorkspaceNav projectName={project.name} />
      <div className="flex flex-1 min-h-0">
        <ProjectBrief
          project={project}
          activeFolder={activeFolder}
          onFolderClick={setActiveFolder}
        />
        <AssetGallery assets={riversideAssets} activeFolder={activeFolder} />
        <AgentFeed feed={riversideFeed} />
      </div>
    </div>
  );
};

export default ProjectWorkspace;

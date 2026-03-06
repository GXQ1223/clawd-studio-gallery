const ModelViewerPlaceholder = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center space-y-4 max-w-[320px]">
      <div
        className="w-[200px] h-[200px] mx-auto flex items-center justify-center gallery-border-dashed"
        style={{ background: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)" }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div>
        <p className="font-mono text-[12px] text-foreground">3D Model Viewer</p>
        <p className="font-mono text-[10px] text-muted-foreground mt-1">
          Supports Rhino, SketchUp, and Revit formats
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
          Drop a 3D file or generate from agent
        </p>
      </div>
    </div>
  </div>
);

export default ModelViewerPlaceholder;

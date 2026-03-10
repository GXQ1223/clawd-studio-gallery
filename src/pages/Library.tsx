import TopNav from "@/components/TopNav";

const Library = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-[48px] flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 48px)" }}>
        <div className="text-center space-y-4 px-6">
          <div className="text-[32px] select-none">📚</div>
          <h1 className="text-[20px] font-medium">Asset Library</h1>
          <p className="font-mono text-[12px] text-muted-foreground max-w-[400px] leading-relaxed">
            Your saved renders, floor plans, material palettes, and sourced products — organized across all projects.
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/50">
            Assets will appear here as you generate and keep them in your projects.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Library;

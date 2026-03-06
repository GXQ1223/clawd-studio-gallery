import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CronSession {
  id: string;
  project_id: string;
  agent_type: string;
  cron_interval: string;
  last_cron_run: string | null;
  completed_at: string | null;
  task_description: string;
  user_id: string | null;
  result_data: Record<string, unknown> | null;
}

/** Check if enough time has elapsed for the given interval */
function shouldRun(lastRun: string | null, interval: string): boolean {
  if (!lastRun) return true;
  const last = new Date(lastRun).getTime();
  const now = Date.now();
  const elapsed = now - last;

  const hours: Record<string, number> = {
    hourly: 1,
    "6h": 6,
    daily: 24,
  };
  const requiredMs = (hours[interval] || 24) * 60 * 60 * 1000;
  return elapsed >= requiredMs;
}

/** Map agent type to the edge function it should call */
function getEndpointForAgent(agentType: string): string {
  switch (agentType) {
    case "perspective":
    case "sketch":
    case "elevation":
    case "section":
    case "plan":
      return "mock-render";
    case "sourcing":
      return "mock-sourcing";
    default:
      return "mock-render";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all sessions with cron enabled
    const { data: sessions, error } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("cron_enabled", true)
      .not("cron_interval", "is", null);

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No cron sessions active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    const results: { session_id: string; agent_type: string; status: string }[] = [];

    for (const session of sessions as CronSession[]) {
      if (!shouldRun(session.last_cron_run, session.cron_interval)) {
        results.push({ session_id: session.id, agent_type: session.agent_type, status: "skipped" });
        continue;
      }

      const endpoint = getEndpointForAgent(session.agent_type);
      const functionUrl = `${supabaseUrl}/functions/v1/${endpoint}`;

      try {
        const body: Record<string, unknown> = {
          style: "contemporary",
          description: `Auto-generate ${session.agent_type} variation — ${session.task_description}`,
          project_id: session.project_id,
        };

        // Extract style from existing result_data if available
        if (session.result_data && typeof session.result_data === "object") {
          const rd = session.result_data as Record<string, unknown>;
          if (rd.style) body.style = rd.style;
          if (rd.budget) body.budget = rd.budget;
        }

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        // Update last_cron_run
        await supabase
          .from("agent_sessions")
          .update({ last_cron_run: new Date().toISOString() })
          .eq("id", session.id);

        // Post agent message about the auto-generation
        const itemCount =
          data.renders?.length || data.products?.length || 0;

        await supabase.from("agent_messages").insert({
          project_id: session.project_id,
          agent_session_id: session.id,
          message_type: "status_update",
          content: `⟳ Auto-generated ${itemCount} new ${session.agent_type} variation(s)`,
          metadata: { auto_generated: true, cron_interval: session.cron_interval },
          user_id: session.user_id,
        });

        processed++;
        results.push({ session_id: session.id, agent_type: session.agent_type, status: "completed" });
      } catch (err) {
        console.error(`Cron failed for session ${session.id}:`, err);
        results.push({ session_id: session.id, agent_type: session.agent_type, status: "failed" });
      }
    }

    return new Response(
      JSON.stringify({ processed, total: sessions.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("agent-cron error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

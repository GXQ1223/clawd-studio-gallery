import { useState, useCallback, useRef, useEffect } from "react";
import { DesignerAgent, type AgentSession, type AgentMessage, type OrchestrationResult, type RenderResult, type ProductResult } from "@/lib/designerAgent";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FeedEntry } from "@/data/workspace-data";
import { generatePlanningQuestions, composeFinalPrompt } from "@/lib/planningQuestions";
import type { PlanningQuestion } from "@/components/workspace/PlanningQuestions";
// RealtimeChannel type inferred from supabase.channel() return

interface ConversationEntry {
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

/** Persist a conversation message to agent_messages */
async function persistMessage(
  projectId: string,
  role: "user" | "agent",
  content: string,
  userId?: string
) {
  await supabase.from("agent_messages").insert({
    project_id: projectId,
    message_type: role === "user" ? "user_message" : "status_update",
    content,
    metadata: { conversation: true },
    user_id: userId || null,
  });
}

export function useDesignerAgent(projectId: string, projectType?: string) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [results, setResults] = useState<OrchestrationResult | null>(null);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [acknowledgment, setAcknowledgment] = useState<string | null>(null);
  const [planningQuestions, setPlanningQuestions] = useState<PlanningQuestion[] | null>(null);
  const [pendingBrief, setPendingBrief] = useState<string | null>(null);
  const conversationRef = useRef<ConversationEntry[]>([]);
  const hasLoadedRef = useRef(false);
  const { user } = useAuth();

  // Load persisted results and conversation history on mount
  useEffect(() => {
    if (!projectId || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Load persisted render/sourcing results
    DesignerAgent.loadPersistedResults(projectId).then((persisted) => {
      if (persisted) {
        setResults((prev) => {
          if (!prev) return persisted;
          return {
            renders: [...persisted.renders, ...prev.renders],
            products: [...persisted.products, ...prev.products],
            shoppingList: prev.shoppingList,
          };
        });
      }
    });

    // Load persisted conversation history and feed entries
    DesignerAgent.getProjectMessages(projectId).then((messages) => {
      if (!messages || messages.length === 0) return;

      // Rebuild conversation ref from persisted messages
      const restoredConversation: ConversationEntry[] = [];
      const restoredFeed: FeedEntry[] = [];

      for (const msg of messages) {
        const timestamp = msg.created_at ? new Date(msg.created_at).getTime() : Date.now();
        const time = msg.created_at
          ? new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
          : "00:00";

        // Rebuild conversation history
        const isConversation = (msg.metadata as Record<string, unknown>)?.conversation === true;
        if (msg.message_type === "user_message") {
          restoredConversation.push({ role: "user", content: msg.content, timestamp });
        } else if (isConversation && msg.message_type === "status_update") {
          restoredConversation.push({ role: "agent", content: msg.content, timestamp });
        }

        // Rebuild feed entries
        restoredFeed.push({
          id: msg.id,
          time,
          text: msg.message_type === "user_message" ? `You: ${msg.content}` : msg.content,
          inProgress: false,
        });
      }

      conversationRef.current = restoredConversation;
      setFeedEntries(restoredFeed);
    });
  }, [projectId]);

  // Supabase Realtime: subscribe to agent_messages and agent_sessions changes
  useEffect(() => {
    if (!projectId) return;

    const messagesChannel = supabase
      .channel(`agent-messages-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const msg = payload.new as Record<string, any>;
          // Skip messages we inserted ourselves (conversation messages from this client)
          const isOwnMessage = msg.user_id === user?.id && (msg.metadata as Record<string, unknown>)?.conversation === true;
          if (isOwnMessage) return;

          const time = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
            : new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

          setFeedEntries((prev) => {
            // Deduplicate by id
            if (prev.some((e) => e.id === msg.id)) return prev;
            return [
              ...prev,
              {
                id: msg.id,
                time,
                text: msg.message_type === "user_message" ? `Team: ${msg.content}` : msg.content,
                inProgress: false,
              },
            ];
          });
        }
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel(`agent-sessions-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_sessions",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const session = payload.new as Record<string, any>;
          setSessions((prev) => {
            const idx = prev.findIndex((s) => s.id === session.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = session as unknown as AgentSession;
              return updated;
            }
            return [...prev, session as unknown as AgentSession];
          });

          // If a session completed with results from another client, merge them
          if (
            payload.eventType === "UPDATE" &&
            session.status === "completed" &&
            session.result_data
          ) {
            const rd = session.result_data as Record<string, unknown>;
            const newRenders = Array.isArray(rd.renders) ? rd.renders : [];
            const newProducts = Array.isArray(rd.products) ? rd.products : [];

            if (newRenders.length > 0 || newProducts.length > 0) {
              setResults((prev) => {
                const existingRenderIds = new Set(prev?.renders.map((r) => r.id) || []);
                const existingProductIds = new Set(prev?.products.map((p) => p.id) || []);
                const freshRenders = (newRenders as RenderResult[]).filter((r) => !existingRenderIds.has(r.id));
                const freshProducts = (newProducts as ProductResult[]).filter((p) => !existingProductIds.has(p.id));

                if (freshRenders.length === 0 && freshProducts.length === 0) return prev;

                const sl = rd.shoppingList as OrchestrationResult["shoppingList"] | undefined;
                return {
                  renders: [...(prev?.renders || []), ...freshRenders],
                  products: [...(prev?.products || []), ...freshProducts],
                  shoppingList: sl || prev?.shoppingList || { total: 0, item_count: 0, budget_remaining: null },
                };
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [projectId, user?.id]);

  const addFeedEntry = useCallback((text: string, inProgress = false) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const entry: FeedEntry = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time,
      text,
      inProgress,
    };
    setFeedEntries((prev) => [...prev, entry]);
    return entry.id;
  }, []);

  // Store reference image URLs across planning flow
  const referenceImagesRef = useRef<string[]>([]);

  /** Start planning mode — ask questions before generating */
  const startPlanning = useCallback(async (brief: string, referenceImageUrls?: string[]) => {
    setPendingBrief(brief);
    if (referenceImageUrls?.length) {
      referenceImagesRef.current = referenceImageUrls;
    }
    conversationRef.current.push({ role: "user", content: brief, timestamp: Date.now() });
    persistMessage(projectId, "user", brief, user?.id);

    // Show acknowledgment while questions load
    setAcknowledgment("Let me understand your vision before I start designing. A few quick questions:");

    const questions = await generatePlanningQuestions(brief);
    setPlanningQuestions(questions);
  }, [projectId, user?.id]);

  /** Complete planning and run orchestration with composed prompt */
  const completePlanning = useCallback(async (answers: Record<string, string>) => {
    if (!pendingBrief) return;

    const finalPrompt = composeFinalPrompt(pendingBrief, answers);
    setPlanningQuestions(null);
    setAcknowledgment(null);

    // Store answers in conversation history
    const answerSummary = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join(", ");
    conversationRef.current.push({ role: "user", content: `Planning answers: ${answerSummary}`, timestamp: Date.now() });
    persistMessage(projectId, "user", `Planning answers: ${answerSummary}`, user?.id);

    // Now run the actual orchestration with any stored reference images
    await runOrchestrationDirect(finalPrompt, referenceImagesRef.current);
    referenceImagesRef.current = [];
  }, [pendingBrief, projectId, user?.id]);

  /** Generate an acknowledgment for follow-up messages (not first message) */
  const generateAcknowledgment = useCallback((brief: string): string => {
    const history = conversationRef.current;
    const briefLower = brief.toLowerCase();

    if (history.length > 0) {
      if (briefLower.includes("hate") || briefLower.includes("remove") || briefLower.includes("no more")) {
        const target = brief.replace(/^(client |i |we )?(hates?|remove|no more)\s*/i, "").trim();
        return `Got it — removing ${target || "that element"}. I'll regenerate based on your existing direction.`;
      }
      if (briefLower.includes("refine") || briefLower.includes("adjust") || briefLower.includes("tweak")) {
        return `Understood — I'll make refinements based on your feedback while keeping the overall direction.`;
      }
      return `Got it — updating based on: "${brief}". Building on your previous direction.`;
    }

    return `Starting design pipeline based on your brief.`;
  }, []);

  /** Direct orchestration — skips planning (used for follow-ups and after planning completes) */
  const runOrchestrationDirect = useCallback(async (brief: string, referenceImageUrls?: string[]) => {
    setIsAnalyzing(true);

    try {
      // Detect floor plan from brief text or reference image file names
      const briefLower = brief.toLowerCase();
      const hasFloorPlanMention = /floor\s*plan|blueprint|layout\s*drawing|spatial\s*layout/.test(briefLower);
      let floorPlanUrl: string | undefined;

      if (hasFloorPlanMention && referenceImageUrls?.length) {
        // Use the first reference image as the floor plan conditioning image
        floorPlanUrl = referenceImageUrls[0];
      }

      const agent = new DesignerAgent(projectId, brief, {
        onProgress: (msg) => addFeedEntry(msg, true),
        userId: user?.id,
        conversationHistory: conversationRef.current.map(c => `${c.role}: ${c.content}`),
        projectType: projectType || "interior",
        referenceImageUrls,
        floorPlanUrl,
      });

      const result = await agent.runFullOrchestration();
      setResults(prev => {
        if (!prev) return result;
        return {
          renders: [...prev.renders, ...result.renders],
          products: [...prev.products, ...result.products],
          shoppingList: result.shoppingList,
        };
      });

      for (const render of result.renders) {
        addFeedEntry(`Generated: ${render.label}`);
      }
      for (const product of result.products) {
        addFeedEntry(`Found ${product.name} at ${product.brand}: $${product.price.toLocaleString()}`);
      }

      const agentSummary = `Generated ${result.renders.length} renders and found ${result.products.length} products`;
      conversationRef.current.push({
        role: "agent",
        content: agentSummary,
        timestamp: Date.now(),
      });
      persistMessage(projectId, "agent", agentSummary, user?.id);

      toast(`✦ ${result.renders.length} renders + ${result.products.length} products ready`);
      setAcknowledgment(null);
      return result;
    } catch (err) {
      console.error("Orchestration failed:", err);
      addFeedEntry("Orchestration failed — check console for details");
      toast.error("Orchestration failed");
      setAcknowledgment(null);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, addFeedEntry, user?.id]);

  /** Main entry point — first message triggers planning, follow-ups go direct */
  const runOrchestration = useCallback(async (brief: string, referenceImageUrls?: string[]) => {
    const isFirstMessage = conversationRef.current.length === 0;

    if (isFirstMessage) {
      // First message → enter planning mode (ask questions)
      startPlanning(brief, referenceImageUrls);
      return null;
    }

    // Follow-up messages → direct orchestration with acknowledgment
    conversationRef.current.push({ role: "user", content: brief, timestamp: Date.now() });
    persistMessage(projectId, "user", brief, user?.id);
    const ack = generateAcknowledgment(brief);
    setAcknowledgment(ack);
    return runOrchestrationDirect(brief, referenceImageUrls);
  }, [startPlanning, generateAcknowledgment, runOrchestrationDirect, projectId, user?.id]);

  const refreshSessions = useCallback(async () => {
    const data = await DesignerAgent.getProjectSessions(projectId);
    setSessions(data);
    return data;
  }, [projectId]);

  /** Toggle cron auto-generation for a specific agent session */
  const toggleCron = useCallback(async (sessionId: string, enabled: boolean, interval: string | null) => {
    const { error } = await supabase
      .from("agent_sessions")
      .update({
        cron_enabled: enabled,
        cron_interval: interval,
      })
      .eq("id", sessionId);

    if (error) {
      toast.error("Failed to update auto-generate setting");
      return;
    }
    toast(enabled ? `⟳ Auto-generate enabled (${interval})` : "Auto-generate disabled");
    refreshSessions();
  }, [refreshSessions]);

  return {
    runOrchestration,
    completePlanning,
    isAnalyzing,
    sessions,
    results,
    feedEntries,
    refreshSessions,
    acknowledgment,
    planningQuestions,
    toggleCron,
  };
}

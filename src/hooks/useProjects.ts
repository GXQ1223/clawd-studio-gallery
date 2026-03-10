import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Json } from "@/integrations/supabase/types";

export interface ProjectFolder {
  name: string;
  count: number;
}

export type ProjectStatus = "active" | "draft" | "complete";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  room: string | null;
  status: string;
  dimensions: string;
  budget: string | null;
  image_url: string | null;
  agent_task: string | null;
  project_type: string;
  share_token: string | null;
  wall_layout: Record<string, { x: number; y: number; rotation: number }> | null;
  folders: ProjectFolder[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useProjects(filter?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["projects", filter],
    queryFn: async () => {
      let query = supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (filter && filter !== "all") {
        query = query.eq("status", filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Project[];
    },
    enabled: !!user,
  });
}

export function useProject(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as unknown as Project;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (project: { name: string; room?: string; dimensions: string; budget?: string; status?: string; project_type?: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          ...project,
          user_id: user!.id,
          status: project.status || "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      // Convert domain types to Supabase-compatible Json types
      const payload: Record<string, Json | undefined> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      if (updates.folders !== undefined) {
        payload.folders = updates.folders as unknown as Json;
      }
      if (updates.wall_layout !== undefined) {
        payload.wall_layout = updates.wall_layout as unknown as Json;
      }
      const { data, error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", data.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Fetch a project by its public share token (no auth required) */
export function useSharedProject(shareToken: string | undefined) {
  return useQuery({
    queryKey: ["shared-project", shareToken],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("share_token", shareToken!)
        .single();
      if (error) throw error;
      return data as unknown as Project;
    },
    enabled: !!shareToken,
  });
}

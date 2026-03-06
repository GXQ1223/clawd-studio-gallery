import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
    mutationFn: async (project: { name: string; room?: string; dimensions: string; budget?: string; status?: string }) => {
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
      const { data, error } = await supabase
        .from("projects")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
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

-- Agent sessions tracking
CREATE TABLE public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  session_label TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'spawned',
  task_description TEXT NOT NULL,
  dependencies TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 1,
  spawned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  result_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent coordination messages
CREATE TABLE public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  agent_session_id UUID REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_agent_sessions_project ON public.agent_sessions(project_id, status);
CREATE INDEX idx_agent_messages_project ON public.agent_messages(project_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all for now since no auth)
CREATE POLICY "Allow all access to agent_sessions" ON public.agent_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agent_messages" ON public.agent_messages FOR ALL USING (true) WITH CHECK (true);
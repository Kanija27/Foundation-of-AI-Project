import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT_ID') && !anonKey.includes('YOUR_SUPABASE'));
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || !url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function generateExamQuestionsWithAI(input: {
  topic: string; marks: '2' | '5' | '11'; count: number; material?: string;
}): Promise<{question:string;outline:string}[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please log in with your Supabase account before generating AI questions.');
  const response = await fetch('/api/ai/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI service returned HTTP ${response.status}.`);
  if (!Array.isArray(data.questions)) throw new Error('AI returned an unexpected response. Please try again.');
  return data.questions;
}

export async function saveStudyKit(input: {
  topic: string; marks: '2'|'5'|'11'; questions: {question:string;outline:string}[];
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('study_kits').insert({
    user_id: user.id, topic: input.topic, marks: Number(input.marks),
    questions: input.questions, created_at: new Date().toISOString()
  });
  if (error) throw new Error(`Questions generated, but couldn't save them: ${error.message}`);
}

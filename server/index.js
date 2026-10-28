import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 3001);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const supabaseAuth = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: Boolean(supabaseAuth),
    groqConfigured: Boolean(groqApiKey),
    message: 'StudyForge AI API is running'
  });
});

async function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !supabaseAuth) return res.status(401).json({ error: 'Please sign in with Supabase first.' });
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Your session is invalid or expired. Please log in again.' });
  req.user = data.user;
  req.accessToken = token;
  next();
}

app.post('/api/ai/generate-questions', requireUser, async (req, res) => {
  if (!groqApiKey) return res.status(503).json({ error: 'AI is not configured yet. Add GROQ_API_KEY to the backend .env file and restart the server.' });
  const topic = typeof req.body.topic === 'string' ? req.body.topic.trim().slice(0, 240) : '';
  const marks = String(req.body.marks || '');
  const count = Math.max(1, Math.min(15, Number(req.body.count) || 5));
  const material = typeof req.body.material === 'string' ? req.body.material.trim().slice(0, 12000) : '';
  if (!topic) return res.status(400).json({ error: 'Enter a topic for your questions.' });
  if (!['2','5','11'].includes(marks)) return res.status(400).json({ error: 'Marks must be 2, 5, or 11.' });

  const lengthGuide = marks === '2'
    ? 'Short-answer question suitable for 2 marks. Answer guide should contain a precise definition or two key points.'
    : marks === '5'
      ? 'Medium-answer question suitable for 5 marks. Answer guide should contain an introduction and 4–5 structured points, with an example where appropriate.'
      : 'Long-answer question suitable for 11 marks. Answer guide should contain an introduction, headings/subheadings, detailed explanation, example or diagram suggestion, and conclusion.';
  const prompt = `Create ${count} distinct university exam practice questions for the topic: ${topic}.
Marks per question: ${marks}. Level: undergraduate engineering/computer-science student unless the material indicates otherwise.
${lengthGuide}
${material ? `Use this supplied study material as the primary source; do not invent claims that contradict it:\n${material}` : 'Use accurate, standard subject knowledge.'}
Return ONLY valid JSON with this exact shape: {"questions":[{"question":"...","outline":"..."}]}. Do not use markdown fences. Make questions distinct and avoid repeating the same wording.`;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are StudyForge AI, a careful academic exam-preparation assistant. Return valid JSON only when asked for JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.65,
        max_tokens: Math.min(6500, 400 + count * (marks === '11' ? 220 : marks === '5' ? 120 : 60)),
        response_format: { type: 'json_object' }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || `Groq returned HTTP ${response.status}.`;
      return res.status(response.status === 401 ? 502 : 502).json({ error: `AI request failed: ${detail}` });
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return res.status(502).json({ error: 'AI returned an empty response. Please try again.' });
    let parsed;
    try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'AI returned invalid JSON. Please try generating again.' }); }
    const questions = Array.isArray(parsed.questions) ? parsed.questions
      .filter(q => q && typeof q.question === 'string' && typeof q.outline === 'string')
      .slice(0, count)
      .map(q => ({ question: q.question.trim(), outline: q.outline.trim() })) : [];
    if (!questions.length) return res.status(502).json({ error: 'AI could not create a valid question set. Please try again.' });
    return res.json({ questions, model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' });
  } catch (error) {
    console.error('AI question generation failed:', error);
    return res.status(502).json({ error: 'Could not reach Groq. Check the backend internet connection and try again.' });
  }
});

app.listen(port, () => {
  console.log(`StudyForge AI API listening on http://localhost:${port}`);
  if (!supabaseAuth) console.warn('Supabase backend environment is incomplete. See .env.example.');
  if (!groqApiKey) console.warn('Groq AI is not configured yet. Add GROQ_API_KEY to .env.');
});

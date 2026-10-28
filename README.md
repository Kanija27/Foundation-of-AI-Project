# StudyForge AI

A polished, responsive student study workspace built with React, TypeScript, and Vite. It includes a public landing page, signup/login flow, avatar selection, a study dashboard, library, study-kit creator, quizzes, flashcards, planner, progress, profile settings, logout, and bright/dark themes.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). To verify a production build:

```bash
npm run build
npm run preview
```

## Included functionality

- **Landing page:** responsive product introduction and features; footer credits `Developed by Kanija Fathima J Kamali RJ`.
- **Authentication demo:** signup/login modal, profile avatar selection, validation, session persistence, and logout.
- **Dashboard:** welcome panel, XP, streak, study tasks, study stats, recent source, and quick actions.
- **Study library:** add TXT/MD/CSV text files and manage source materials. A sample biology document is included.
- **Study kit:** create notes/summary views, open practice quizzes, review flashcards, and generate 2-, 5-, or 11-mark question sets for a chosen topic. Includes answer-structure guides and copy-to-clipboard export.
- **Quiz:** multiple-choice quiz, navigation, answer validation, explanations, results, and progress tracking.
- **Flashcards:** flip cards, mark known/review again, and earn XP.
- **Planner:** add, complete, and delete tasks.
- **Progress:** activity totals, accuracy, streak and achievements.
- **Settings:** edit name/email, choose an emoji avatar, change theme, and logout.
- **Bright/dark mode:** persisted in localStorage.
- **Persistence:** user profile, local demo accounts, material, tasks, XP, streak, and quiz stats are stored in browser localStorage.

## Important implementation notes

Most features are front-end/local-storage based and do not require API keys or a backend. CodeLab requires an internet connection to reach the Piston online execution service. It does **not** call a hosted LLM, so generated study notes/summaries and question sets are rule-based from the selected text, not true generative AI. The included sample document has a hand-authored quiz for a polished first run; other plain-text material gets a simple sentence-based practice set. TXT, Markdown, and CSV text are read in-browser. PDF and DOCX files can be selected but require adding a parser/service to extract their contents; the app explains this rather than pretending extraction succeeded. Authentication is local demo authentication, not production-secure authentication. Do not use it for real passwords or sensitive data until a backend and secure auth provider are connected.

## Suggested next production steps

1. Connect Supabase Auth and PostgreSQL for secure accounts and synced study history.
2. Add a document parsing pipeline (e.g. PyMuPDF/python-docx on a backend) for PDF and DOCX.
3. Connect an LLM API server-side for source-grounded notes, questions, explanations, and document Q&A.
4. Add server-side validation, rate limits, file-size limits, and secure access controls.

## Added feature workspaces

- **SolveSpace:** guided Mathematics, Algorithms, and Digital Logic examples; progressive hints; step-by-step solutions; custom problem saving; autosaved working notes; solved-problem tracking; a progress bar; and a quick-reference panel.
- **StudySync:** create rooms, share invite codes, search rooms and discussions, post messages, maintain shared notes and revision checklists, create/vote in quick polls, and export room notes/tasks/discussion to a text file. Data persists in this browser; cross-device, real multi-user collaboration requires a shared backend such as Supabase.
- **CodeLab:** eleven beginner programs—addition, even/odd, largest of three, factorial, prime check, Fibonacci, string reversal, palindrome, vowel count, linear search, and array sum—each with three test cases and JavaScript/Python/C starter solutions. The selected language is compiled/executed through the public Wandbox compiler API (the app discovers available compiler versions and does not require an API key), with expected-vs-actual results shown for every test case.

The new pages share the existing responsive UI and light/dark theme. The original landing page, login/signup UI, avatars, settings, logout, library, study kit, quiz, flashcards, planner, progress, and developer credit are retained. Without environment configuration, the app keeps its local demo mode.

## Demo scope and safety

This is a front-end demonstration. Browser storage is not secure account storage. StudySync invite codes do not connect separate users or devices without a backend. CodeLab sends the code you run to the Wandbox online compilation service; do not paste secrets or personal data into the editor. Availability depends on the external service and internet connection. Production deployment should add secure authentication, database policies, real-time room subscriptions, and an isolated server-side code runner.


## Code runner and theme fixes

- Replaced the Piston endpoint (which was returning HTTP 401) with Wandbox's public compiler API and dynamic compiler discovery for Node.js, Python, and C.
- Added a request timeout and clearer messages for network errors, compilation errors, and unavailable compilers.
- Scoped the midnight/violet redesign to the dark-theme app root. Bright mode now uses the original light-theme palette and its existing theme variables instead of inheriting hard-coded dark colors.
- The online runner still depends on the external compiler service and internet access; this environment could not perform a live network test. The frontend TypeScript/TSX syntax check passed.


# Connect Supabase + Groq (real accounts and AI)

The project includes a Vite frontend and a small Express backend. Follow these steps to enable real authentication, AI-generated exam questions, saved study kits, and cloud-backed StudySync rooms.

## 1. Create your Supabase project

1. Visit https://supabase.com and create a project.
2. Open **Project Settings → API** (or **Connect**) and copy the project URL and publishable/anon key.
3. Open **SQL Editor → New query**, paste the full contents of `supabase-schema.sql`, and click **Run**.
4. In **Authentication → URL Configuration**, add your local site URL `http://localhost:5173` to the allowed redirect URLs. For email confirmation, keep email confirmation enabled and confirm the message delivered to your inbox.

## 2. Create a Groq API key

1. Visit https://console.groq.com and create an API key.
2. Keep the key private. Do not paste it into chat, commit it to Git, or put it in a variable beginning with `VITE_`.

## 3. Configure environment variables

1. Copy `.env.example` to a new file named `.env` in the project root.
2. Replace the placeholder values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
GROQ_API_KEY=gsk_your_private_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3001
```

The two `VITE_` variables are browser-visible and should contain only the Supabase project URL and publishable/anon key. `GROQ_API_KEY` is server-only. Never use a Supabase `service_role` key in the browser or in this project.

## 4. Install and run both servers

Node.js 20 or newer is recommended. From the project root:

```bash
npm install
npm run dev:all
```

Vite runs at `http://localhost:5173`; the Express API runs at `http://localhost:3001`. The Vite development server proxies `/api` calls to Express. Check `http://localhost:3001/api/health` to see whether Supabase and Groq environment values were detected (it never returns the keys).

If you prefer separate terminals, run `npm run server` in one and `npm run dev` in the other.

## 5. Test the integration

1. Open the Vite URL and sign up with an email and a password of at least 6 characters.
2. If email confirmation is enabled, confirm the email, then log in.
3. Open Create Study Kit, enter a topic, choose 2, 5, or 11 marks, and generate questions. With Supabase + Groq configured, questions are generated by Groq and saved in `study_kits`.
4. Open StudySync, create a room, and share its invite code. Other users must sign up/log in to join it. Room membership and messages are stored in Supabase; message updates use Supabase Realtime when that table is included in the project's Realtime publication.

## What is connected

- **Supabase Auth:** signup, login, session restoration and logout. The original local demo remains available only when the Supabase frontend values are absent.
- **Profiles:** profile data is stored in `profiles` with row-level security.
- **Groq:** `/api/ai/generate-questions` checks the Supabase session on the server and calls Groq without exposing the private key.
- **Study kits:** generated question sets are saved to `study_kits`.
- **StudySync:** rooms, memberships, messages, notes, tasks and poll state have Supabase-backed paths; room messages can be subscribed to via Supabase Realtime.
- **CodeLab:** continues to use its external compiler API and does not need Groq.

## Troubleshooting

- **AI is not configured:** check `GROQ_API_KEY` in `.env`, then restart `npm run dev:all`.
- **Please log in with Supabase:** frontend values are present, so demo auth is disabled. Sign up/log in with your Supabase account.
- **Invalid API key / project URL:** make sure the URL and publishable/anon key come from the same Supabase project.
- **Email confirmation:** confirm the signup email before logging in if your Supabase project requires it.
- **Table or permission errors:** rerun `supabase-schema.sql` in the Supabase SQL Editor and check the returned error. Never disable row-level security as a workaround.
- **Groq model errors:** set `GROQ_MODEL` to a currently available model in your Groq console, then restart the backend.

The environment-specific credentials are intentionally not included in this ZIP. You must add your own `.env` values locally.

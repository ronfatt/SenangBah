# SPM Writing MVP

Minimal web app for SPM Writing micro‑drills with OpenAI JSON outputs.

## Setup
1. `cp .env.example .env` and fill values
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000`

## Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/training/start`
- `POST /api/training/next`
- `POST /api/weekly/start`
- `POST /api/weekly/submit`

## Notes
- Training flow: Warmup → Core Drill → Reinforce → Feedback
- JSON schema validation + 1 retry on invalid output
- SQLite local storage

## Railway deploy (quick)
1. Push this repo to GitHub.
2. In Railway: New Project → Deploy from GitHub → select repo.
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `JWT_SECRET`
   - `OPENAI_MODEL` (optional)
   - `ENV=production`
4. Create a Volume and mount to `/app/data`.
5. Deploy, then open the public URL.

The app will store SQLite at `/app/data/data.sqlite` when a volume is attached.

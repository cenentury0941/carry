# Carry

Cultural landing briefs for a move. Name the places that make up your week, pick a destination, and choose whether the next chapter should **rhyme** with this one or **depart** from it. Carry returns streets, venues, and a first-week plan grounded in Qloo's taste graph.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

## What it does

1. Resolves your origin places to Qloo entities (via autocomplete).
2. Profiles their taste tags (`GET /v2/insights`, `filter.type=urn:tag`).
3. Finds candidate areas in the destination (`urn:heatmap`, or place fallback).
4. Gathers venues per area (`urn:entity:place` + geohash / location).
5. Compares origin vs area audiences (`GET /v2/analysis/compare`).
6. Scores **continuity** (Carry's metric) and writes a brief (OpenAI or template).

### Continuity score (disclaimer)

Continuity is **Carry's own metric**, not a Qloo product field. It combines heatmap affinity, shared-tag strength from `/v2/analysis/compare`, and how many origin rituals have a matching venue nearby. It is a taste signal for choosing a street — not a prediction of happiness, rent, or safety.

## Stack

- Next.js App Router (UI + API routes)
- Framework-free `src/core` pipeline (injectable Qloo + LLM)
- Zod contracts shared by client and server
- Upstash Redis for Qloo cache, brief storage, rate limits (in-memory fallback)
- OpenAI for brief copy + refine agent (template fallback without a key)

## Setup

```bash
cp .env.example .env
# fill QLOO_API_KEY (hackathon key against https://hackathon.api.qloo.com)
# optional: OPENAI_*, UPSTASH_*

npm install
npm test
npm run dev
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run spike` | Live go/no-go against Qloo for 3 city routes |
| `npm run live-check` | One call per endpoint; checks filters change results |
| `npm run seed-featured` | Build two shareable briefs and mark them featured |
| `npm test` | Unit tests with a fake Qloo (no network) |

## API

| Route | Method | Notes |
|-------|--------|-------|
| `/api/places/search?q=` | GET | Place autocomplete |
| `/api/briefs` | POST | NDJSON stream of pipeline steps + final brief |
| `/api/briefs/:id` | GET | Saved brief |
| `/api/briefs/:id/refine` | POST | Agent follow-up → new version or answer |
| `/api/health` | GET | Config readiness |

## Deploy (public demo for Devpost)

1. Put secrets in `.env` (copy from `.env.example`).
2. Run the go/no-go spike, then live-check:

```bash
npm run spike
npm run live-check
```

3. Create a **public** GitHub repo and push (hackathon requires a public repo + MIT license):

```bash
gh auth login
gh repo create carry --public --source=. --remote=origin --push
```

4. Deploy to Vercel and set the same env vars in the project settings:

```bash
npx vercel --prod
```

5. Seed featured briefs against production Redis (optional but nice for judges):

```bash
npm run seed-featured
```

## License

MIT — see [LICENSE](./LICENSE).

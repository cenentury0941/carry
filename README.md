# Carry

Relocation is usually decided with rent, commute, and a map pin. Carry answers a different question: **which parts of your week will still feel like yours after you move?**

You name where you live now, the places that make up your routine, and a set of candidate homes, neighborhoods, or a wider region. Carry ranks those destinations by cultural fit — what carries over, what breaks, and which venues nearby support the same rituals — using [Qloo](https://docs.qloo.com/)’s taste graph rather than generic “creative neighborhood” copy.

## Who it’s for

People mid-move, and teams helping someone relocate, who need a concrete read on cultural continuity before they sign a lease — not another list of tourist spots.

## What you get

An end-to-end product, not a single API demo:

1. Sign in (or open the app in demo mode without Clerk keys).
2. Start a **new move** → residence → targets → tastes → run.
3. Review a **ranked list** of destinations with matches, mismatches, what to expect, and supporting venues.
4. **Compare** two destinations side by side.
5. **Export a PDF** brief for the destination you’re considering.

Target modes cover three real situations: homes you’ve already scouted, a shortlist of cities/neighborhoods, or an open region (“somewhere in Oregon”).

Priority modes — **rhyme** (keep similar), **depart**/**Change** (max taste distance — reverse similarity), or **balanced** — decide how destinations are ranked.

Walkthrough: [docs/USER_FLOW.md](docs/USER_FLOW.md).

## How Qloo is used

Carry’s rankings collapse without the taste graph. The move pipeline does non-trivial, multi-step work against Qloo — not a single “places like this” call:

| Step | Qloo surface | Role |
|------|--------------|------|
| Taste profile | Taste tags for residence + ritual places | Build the origin cultural fingerprint |
| Candidate expansion | Heatmap clustering and/or location/geohash place search | Turn homes, areas, or a region into ranked seeds |
| Venue coverage | Places in location / geohash | Find venues that could continue each ritual |
| Origin vs destination | `/v2/analysis/compare` | Shared vs unique tags between your life and each candidate |

Optional OpenAI polish turns those signals into readable summaries; without it, template copy still surfaces the same entity-backed evidence.

Details and call map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Continuity score

**Continuity** is Carry’s own metric, not a Qloo product field. It combines affinity, shared tags from compare, and ritual venue coverage. It is a **taste signal** — not rent, commute, safety, or lease advice.

## Stack

- **Next.js** App Router + **Clerk** (optional demo-user fallback)
- Framework-free `src/core` (`move-pipeline`, scoring, agents)
- Zod contracts, **Upstash Redis** (in-memory fallback), OpenAI optional, `@react-pdf/renderer`
- Typed **Qloo** client with cache and retries

## Setup

```bash
cp .env.example .env
# QLOO_API_KEY required. Optional: OPENAI_*, UPSTASH_*, Clerk keys.

npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open app** (demo) or sign in.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run spike` | Live Qloo connectivity check |
| `npm run live-check` | Endpoint field checks |
| `npm run seed-featured` | Seed featured briefs (legacy) |
| `npm test` | Unit tests with a fake Qloo client |

## Docs

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, Qloo map, scoring |
| [USER_FLOW.md](docs/USER_FLOW.md) | End-to-end walkthrough |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Redis keys + Postgres sketch |
| [API.md](docs/API.md) | HTTP contracts |
| [ROADMAP.md](docs/ROADMAP.md) | Next steps |

## Legacy

The original one-shot brief form remains at `/legacy` (`/api/briefs*`). Prefer the move wizard for new work.

## License

MIT — see [LICENSE](./LICENSE).

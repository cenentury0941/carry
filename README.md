# Carry

**Which parts of your week will still feel like yours after you move?**

Relocation is usually decided with rent, commute, and a map pin. Carry ranks candidate homes, neighborhoods, and regions by cultural fit — what carries over, what breaks, and which nearby venues support the same rituals — using [Qloo](https://docs.qloo.com/)’s taste graph rather than generic “creative neighborhood” copy.

If the ranking would look the same without Qloo, Carry would not exist. Continuity scores, venue evidence, compare, and exported briefs all depend on multi-step taste-graph work.

## The idea

Moving is not only a logistics problem. People leave behind coffee shops, music venues, bookstores, and neighborhood textures that make a week feel like *theirs*. Listings and commute tools ignore that; tourist guides oversell the obvious spots.

Carry treats relocation as a **taste continuity** problem: build a fingerprint of the life you have now, then score destinations on how well that life can continue — or how deliberately different it would feel, if that is what you want.

That is a non-obvious use of a cultural taste graph: geography and housing as the interface, affinity and ritual coverage as the signal.

## Who it’s for

- People mid-move who have scouted apartments, a shortlist of cities, or only a vague region
- Anyone who wants a concrete read on cultural fit before signing a lease
- Teams helping someone relocate (HR, relocation partners) who need a shareable brief, not another list of tourist spots

Three target modes match those situations: **Homes** you already viewed, **Areas** on a shortlist, or an open **Region** (“somewhere in Oregon”).

## Product

Carry is an end-to-end product, not a single API demo:

1. Sign in (or open the app in demo mode without Clerk keys)
2. Start a **new move** → residence → targets → tastes → run
3. Review a **ranked list** of destinations with matches, mismatches, what to expect, and supporting venues
4. **Compare** two destinations side by side
5. **Export a PDF** brief for the destination you are considering

Priority modes shape both ranking and how results are framed:

| Priority | Intent |
|----------|--------|
| **Keep Similar** (`rhyme`) | Maximize continuity with your current rituals |
| **Change** (`depart`) | Prefer destinations that feel meaningfully different |
| **Balanced** | Blend similarity and distance |

Walkthrough: [docs/USER_FLOW.md](docs/USER_FLOW.md).

## How Qloo is used

Rankings collapse without the taste graph. The move pipeline does non-trivial, multi-step work against Qloo — not a single “places like this” call:

| Step | Qloo surface | Role |
|------|--------------|------|
| Resolve places & tags | Entity search, `/v2/tags` | Turn ritual places and freeform preferences into graph entities |
| Taste profile | Taste tags for residence + ritual places | Build the origin cultural fingerprint |
| Candidate expansion | Heatmap clustering and/or location / geohash place search | Turn homes, areas, or a region into ranked seeds |
| Venue coverage | Places in location / geohash | Find venues that could continue each ritual |
| Origin vs destination | `/v2/analysis/compare` | Shared vs unique tags between your life and each candidate |

Optional OpenAI polish turns those signals into readable summaries; without it, template copy still surfaces the same entity-backed evidence. The LLM never invents venues or tags that Qloo did not return.

Details and call map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Continuity score

**Continuity** is Carry’s own metric, not a Qloo product field. It combines affinity, shared tags from compare, and ritual venue coverage, then applies a priority bias (Keep Similar reads higher, Change reads lower) and a light spread across the destinations in a move so differences are easier to read.

It is a **taste signal** — not rent, commute, safety, or lease advice.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js App Router |
| Auth | Clerk (optional demo-user fallback) |
| Domain | Framework-free `src/core` (`move-pipeline`, scoring, agents) |
| Contracts | Zod schemas shared by API and UI |
| Data | Upstash Redis (in-memory fallback) |
| Taste | Typed Qloo client with cache and retries |
| Copy / PDF | OpenAI optional, `@react-pdf/renderer` |

## Getting started

```bash
cp .env.example .env
# QLOO_API_KEY required. Optional: OPENAI_*, UPSTASH_*, Clerk keys.

npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open app** (demo) or sign in.

### Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `QLOO_API_KEY` | Yes | Qloo hackathon / API access |
| `QLOO_BASE_URL` | No | Defaults to `https://hackathon.api.qloo.com` |
| `OPENAI_API_KEY` | No | Destination / venue “why” copy; templates work without it |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | No | Cache, move store, rate limits (memory fallback locally) |
| Clerk publishable + secret keys | No | Without them, the app runs as `demo-user` |

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local app |
| `npm test` | Unit tests with a fake Qloo client |
| `npm run spike` | Live Qloo connectivity check |
| `npm run live-check` | Endpoint field checks |
| `npm run seed-featured` | Seed featured briefs (legacy) |

## Documentation

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, Qloo call map, scoring |
| [USER_FLOW.md](docs/USER_FLOW.md) | End-to-end walkthrough |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Redis keys + Postgres sketch |
| [API.md](docs/API.md) | HTTP contracts |
| [SUBMISSION.md](docs/SUBMISSION.md) | Problem summary, Qloo surfaces, limitations |
| [ROADMAP.md](docs/ROADMAP.md) | Next steps |

## Limitations

- Qloo results describe **aggregate** cultural affinities. They are not evidence of a person’s identity, preferences as a protected class, or future behavior.
- Continuity is a taste signal only — not rent, commute, safety, listing availability, or housing eligibility advice.
- Freeform preference tags only affect ranking when Qloo resolves them to a clear tag; uncertain matches are skipped.
- Photon / free-text addresses are locations only until linked to Qloo place entities.

## Legacy

The original one-shot brief form remains at `/legacy` (`/api/briefs*`). Prefer the move wizard for new work.

## License

MIT — see [LICENSE](./LICENSE).

# Carry architecture

## Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| Contracts | `src/contracts/` | Zod schemas shared by API and UI (`brief`, `move`, `events`, `places`) |
| Core | `src/core/` | Framework-free pipelines (`pipeline.ts` legacy briefs, `move-pipeline.ts` ranked moves), scoring, agents |
| Server | `src/server/` | Env, Redis, Qloo client, LLM, auth, move store, PDF |
| Client | `src/client/` | Hooks and React components |
| App | `src/app/` | Next.js routes (marketing, Clerk, `/app/*`, APIs) |

Core never imports Next.js. Inject `Deps` (`qloo`, `llm`, `log`, `now`, `id`) so pipelines are testable with fakes.

## Primary demo flow

```
Login (Clerk or demo-user)
  → Dashboard /app
  → Wizard /app/moves/[id]  (residence → targets → tastes → run)
  → POST /api/moves/[id]/run  (NDJSON steps)
  → Results /app/moves/[id]/results
  → Compare / PDF
```

## Qloo call map (move pipeline)

1. `getTasteTags(tasteEntityIds)` — profile residence + ritual places  
2. Expand candidates:
   - `addresses` / `areas` — one seed per resolved place  
   - `ambiguous` — `getHeatmap` then geohash cluster, or `getPlacesInLocation` fallback  
3. Per candidate: `getPlacesInLocation` / `getPlacesInGeohash` for venues  
4. `compareEntities(originIds, candidateIds)` — shared vs unique tags  
5. Optional OpenAI polish of summaries (template fallback)

## Scoring (Carry metric)

For each destination:

- `sharedTagScore` — mean of top shared compare tags  
- `ritualCoverage` — venue count vs origin ritual count  
- `rhymeScore` = `0.5*affinity + 0.3*shared + 0.2*coverage`  
- `departScore` = popularity × (1 − affinity)  
- Final score depends on priority: `rhyme` | `depart` | `balanced`  
- **Continuity** = round(rhymeScore × 100)

These are cultural taste signals, not housing, rent, or safety predictions.

## Auth

- With `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`: Clerk middleware protects `/app` and `/api/moves`.  
- Without keys: `requireUserId()` returns `demo-user` for local/CI demos.

## Persistence

- Upstash Redis (memory fallback): moves, briefs, Qloo cache, rate limits.  
- See `docs/DATA_MODEL.md` for key layout and Postgres migration sketch.

## Legacy

`/legacy` and `/api/briefs*` remain for the original one-shot brief form. Prefer the move wizard for demos.

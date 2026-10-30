# API

All `/api/moves*` routes require auth (Clerk session, or demo-user when Clerk unset).

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/moves` | — | `{ moves: MoveProject[] }` |
| POST | `/api/moves` | — | `MoveProject` 201 |
| GET | `/api/moves/:id` | — | `MoveProject` |
| PATCH | `/api/moves/:id` | `{ residence?, target?, tastes? }` | `MoveProject` |
| DELETE | `/api/moves/:id` | — | `{ ok: true }` |
| POST | `/api/moves/:id/run` | — | NDJSON stream of `MoveStreamEvent` |
| POST | `/api/moves/:id/compare` | `{ aId, bId }` | `DestinationCompare` |
| GET | `/api/moves/:id/pdf` | optional `?destinationId=` | PDF for one destination, or all destinations when omitted |

### MoveStreamEvent

```json
{"type":"step","step":"profile","status":"start"}
{"type":"step","step":"profile","status":"done"}
{"type":"move","move":{ /* MoveProject with result */ }}
{"type":"error","kind":"no_data","message":"..."}
```

### Legacy (deprecated for demos)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/places/search?q=` | Qloo place autocomplete (areas / tastes) |
| GET | `/api/geocode?q=` | Photon address geocode (Homes targets) |
| POST | `/api/briefs` | NDJSON legacy brief |
| GET | `/api/briefs/:id` | Saved brief |
| POST | `/api/briefs/:id/refine` | Refine agent |
| GET | `/api/health` | `{ ok, qloo, redis, openai }` |

# Data model

## Redis keys (current)

| Key | Value |
|-----|-------|
| `move:{id}` | JSON `MoveProject` |
| `user:{userId}:moves` | JSON string[] of move ids (newest first, max 100) |
| `brief:{id}:latest` | Legacy brief JSON |
| `brief:{id}:v{n}` | Legacy brief version |
| `featured:briefs` | string[] |
| `qloo:{hash}` | Cached Qloo response (7d TTL when Redis available) |
| `rl:brief:*` / `rl:refine:*` | Upstash ratelimit |

In-memory `Map` mirrors these keys when Upstash is unset (local only; not shared across serverless instances).

## MoveProject (Zod)

See `src/contracts/move.ts`:

- `residence: ResolvedPlace | null`  
- `target: addresses | areas | ambiguous | null`  
- `tastes: TasteProfile | null`  
- `status: draft | running | ready | error`  
- `result: RankedMoveResult | null`  

`RankedMoveResult` also stores `priority` (`rhyme` | `depart` | `balanced`) and `priorityLabel` (`Keep Similar` | `Change` | `Balanced`) used when that result was scored and briefs were written.

`RankedDestination` holds score, continuity, matches, mismatches, summary, expect, venues.

## Postgres migration (next)

Suggested tables (not implemented):

```sql
users (id text pk) -- Clerk user id
moves (
  id text pk,
  user_id text references users,
  residence jsonb,
  target jsonb,
  tastes jsonb,
  status text,
  result jsonb,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
);
create index on moves (user_id, updated_at desc);
```

Swap `src/server/move-store.ts` for a Drizzle repository implementing the same function signatures.

# Submission

Hackathon kit checklist for Carry.

## Problem

Relocation is usually decided with rent, commute, and a map pin. Carry answers a different question: **which parts of your week will still feel like yours after you move?** People name where they live now, ritual places that make up their routine, and candidate homes, neighborhoods, or a region. Carry ranks destinations by cultural fit — what carries over, what breaks, and which nearby venues support the same rituals — using Qloo’s taste graph rather than generic “creative neighborhood” copy.

## Qloo surfaces used

| Surface | Role in Carry |
|---------|----------------|
| Entity search (`search`) | Resolve ritual / destination places into Qloo entities |
| Tag search (`/v2/tags`) | Resolve freeform preference tags into Qloo tag IDs when the name clearly matches |
| Taste insights (`filter.type=urn:tag`) | Build the origin cultural fingerprint from residence + ritual places |
| Heatmap / places insights | Expand region targets and find venues that could continue each ritual |
| Analysis compare | Shared vs unique tags between origin tastes and each candidate |

Carry does **not** use Qloo as an isolated API demo. Rankings, venue evidence, compare, chat, and PDF export all depend on these multi-step calls. Continuity is Carry’s own metric (affinity + shared tags + ritual venue coverage), not a Qloo product field.

## Redacted request → result

**Inputs (example):** residence “Park Slope”; tastes include coffee shop entities; optional preference tag “indie”; targets “Portland, OR”; priority Balanced.

**Qloo steps (redacted):**

1. Resolve taste place entities → profile tags (e.g. specialty coffee, live music).
2. Resolve preference tag “indie” via `/v2/tags` only if a clear name match returns (otherwise skip).
3. Fetch places in the candidate area with taste entity signals.
4. Compare origin entities vs destination venues → shared / different tags.
5. Score Continuity and attach venue evidence tags.

**Product result (illustrative):** destination ranked with Continuity ~70–85; Familiar chips from compare (+ resolved preference tags); Places nearby with affinity and shared/distinct tags. Entity IDs omitted from demos and recordings.

## Known limitations

- Qloo results describe **aggregate** cultural affinities. They are not evidence of a person’s identity, preferences as a protected class, or future behavior.
- Continuity is a **taste signal** — not rent, commute, safety, listing availability, or lease / housing eligibility advice.
- Freeform preference tags only affect ranking when Qloo resolves them to a clear tag; uncertain matches are not forced into later requests.
- Optional OpenAI polish rewrites summaries from Qloo-backed fields; without it, template copy still surfaces the same evidence.
- Photon / free-text addresses are locations only until linked to Qloo place entities.

## Setup

See [README.md](../README.md): copy `.env.example`, set `QLOO_API_KEY`, `npm install`, `npm test`, `npm run dev`. Demo mode works without Clerk keys.

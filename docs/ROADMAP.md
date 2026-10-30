# Roadmap

## Done (this pass)

- Clerk auth (with demo-user fallback)  
- Multi-step move wizard  
- Ranked destinations + match/mismatch + venues  
- Side-by-side compare  
- Styled PDF export  
- Architecture / flow / data / API docs  

## Next

1. **Postgres + Drizzle** — replace Redis move store for durable multi-instance data.  
2. **MapLibre** — plot geohash candidates and venue pins on results.  
3. **Commute / rent overlays** — optional third-party signals beside cultural score (clearly labeled).  
4. **Employer / HR seats** — org accounts, shared move projects, SSO.  
5. **MCP server** — expose `create_move`, `run_move`, `get_ranking` for agent hosts.  
6. **Retire `/api/briefs`** after judges no longer need the legacy form.  

## Non-goals (near term)

- Guaranteeing listing availability or lease advice  
- Storing Qloo payloads in public repos  
- Replacing Qloo with LLM-only recommendations  

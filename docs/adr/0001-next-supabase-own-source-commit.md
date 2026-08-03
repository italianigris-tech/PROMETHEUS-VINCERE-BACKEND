---
status: accepted
---

# Keep source upload authority in Next.js and Supabase

The existing Next.js boundary remains the only authority allowed to authenticate project ownership, operate R2 multipart uploads, verify the completed object, and commit `source_assets` plus `projects.source_asset_id`. MAUL begins from the committed source asset through a Supabase durable analysis job; Cloudflare R2 events are reconciliation evidence, never commands that choose a project's source. This avoids two competing project identities and lets replacement be fenced by the canonical source pointer.

## Consequences

- Browser clients use same-origin Next.js upload routes and never receive R2 or Supabase privileged credentials.
- MAUL requires a server-only Supabase service-role key to claim and update analysis jobs.
- Every worker progress/completion write rechecks `projects.source_asset_id`; superseded sources fail closed.
- R2 completion ambiguity is resolved by HEAD plus bound object metadata and byte equality.

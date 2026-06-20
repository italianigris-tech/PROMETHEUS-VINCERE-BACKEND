# BUILD UPDATE CONVENTION

- Every agent must update `PROMETHEUS_BUILD.md` before starting work and after finishing.
- Every agent must record ticket status transitions in `.agents/tickets/TICKET_REGISTRY.json` when they claim or release a ticket.
- Status changes require a git commit with message `[BUILD] T{ticket#}: {status} - {brief note}`.
- If an agent discovers a blocker, they must update the `Current Blockers` section in `PROMETHEUS_BUILD.md`, set the ticket status to `BLOCKED`, and stop.
- No agent may change status to `MERGED` without passing the ticket's Gate.
- No agent may start a ticket whose dependencies are not already `MERGED`.
- Any ticket touching a human-gate file must stop at `READY_FOR_REVIEW` and wait for human approval.

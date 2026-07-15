# MaxEnt IRL Training Gate

`evaluateMaxEntIrlTrainingGate` in `backend/src/golden-corpus/training-gate.ts` is the hard technical gate for MaxEnt IRL training.

Training must remain blocked unless:

- the Golden 100 dashboard reports the threshold met and status `ready`
- feature validation is satisfied

Human override is allowed only when the override records:

- reason
- owner
- date
- expected risk

The gate explicitly references the tracker chain for learned reward work:

- #55: Golden 100 threshold dashboard
- #56: MaxEnt IRL training gate
- #82: MaxEnt IRL baseline training
- #84: hybrid reward under Judgment floor

This prevents smoke-test or research weights from being mistaken for production-ready learned reward authority.

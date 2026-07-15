# Pairwise Preference Reward Model

`backend/src/reward-model/pairwise-preference.ts` contains the first deterministic pairwise reward slice for Studio review exports.

It consumes `joseph-study-review-export-v1` artifacts with pairwise winner/loser preferences, failure tags, and frame proof IDs. The training report intentionally separates preference labels from absolute demonstrations:

- `preferenceLabelKind`: `pairwise_winner_loser`
- `pairwisePreferenceCount`: number of Studio pairwise labels
- `absoluteDemonstrationCount`: `0`
- `absoluteDemonstrationsUsed`: `false`

The first model is a small failure-tag linear baseline. Failure tags attached to losing candidates receive negative weights, then held-out Studio preferences can be evaluated against those weights.

This keeps pairwise preference learning separate from MaxEnt IRL over absolute demonstrations.

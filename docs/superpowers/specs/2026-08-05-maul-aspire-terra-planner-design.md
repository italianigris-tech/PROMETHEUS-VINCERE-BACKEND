# MAUL Aspire Terra Planner Design

## Goal

Make MAUL's routed 9:16 short-form planner capable of producing the visual-hook treatment demonstrated by `standard EDIT TO ASPIRE 1.mp4`: a single principal speaker, dark controlled scene, expressive speech timing, bold sans hierarchy, contrasting display accent, selective amber emphasis, and restrained readable motion.

## Scope

This slice targets `single_speaker_talking_head` and `single_speaker_podcast` shorts. It does not authorize the model to invent copy, source facts, timestamps, geometry, masks, or release approval. Existing source evidence, deterministic placement, renderer font proof, Perceptual Truth, and human review remain authoritative.

## Architecture

The existing `EditorialDirector` remains the canonical MAUL director. It receives a new bounded `CreativeTreatmentPlanner` dependency. The planner sends a source-grounded structured request to the configured OpenAI-compatible Terra endpoint and returns a validated treatment proposal or an explicit deterministic fallback.

The proposal is persisted inside the existing `art_direction_plan` lineage with an inference receipt. It controls executable treatment inputs: composition direction preference, display/grotesk hierarchy, accent treatment, text density, emphasis behavior, motion restraint, and candidate diversity. It does not emit pixel coordinates. Existing scene evidence and placement compilers translate the intent into renderable geometry.

The initial provider uses `gpt-5.6-terra`, `reasoning_effort=high` as the implementation of the requested medium-high thinking level, low temperature for stable outputs, JSON response mode, bounded output size, request/response hashes, and deterministic fallback on missing credentials, network errors, invalid JSON, schema failure, rate limiting, or provider rejection.

## Reference treatment contract

The prompt explicitly encodes the observed reference traits without copying its identity or media:

- 9:16 principal-speaker portrait;
- dark warm/cool environment with protected face and gesture readability;
- bold neutral grotesk for spoken words;
- italic/editorial display accent for selective semantic emphasis;
- ivory/white primary text and restrained amber accent;
- centered or subject-safe lockups rather than a generic bottom caption band;
- phrase-level timing and emphasis, not every-word novelty motion;
- deliberate hold time and visible hierarchy;
- visual variation across beats while preserving one treatment grammar.

## Failure behavior

Missing or invalid provider output cannot produce `ART_DIRECTED`. The provider receipt records `skipped_missing_credentials`, `failed_request`, `failed_invalid_response`, or `invoked`. The current safe fallback remains available and disclosed.

## Verification

Tests will cover request body authority, JSON/schema validation, fallback reasons, receipt fields, service injection, art-direction lineage, and render-visible treatment attributes. A live smoke call will use the local ignored credential and send only a synthetic short transcript, never the supplied video or API key in logs.

# Prometheus Environment Setup

Prometheus boots with backend cognition as the authority layer. Provider keys enable richer adapters, but failures must be visible degradation states rather than silent success.

## Required Core

```env
OPENAI_API_KEY=
GROQ_API_KEY=
ASSEMBLYAI_API_KEY=
```

## Vector And Asset Providers

```env
ZILLIZ_API_KEY=
ZILLIZ_ENDPOINT=
ZILLIZ_COLLECTION=
MILVUS_ADDRESS=
MILVUS_TOKEN=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
```

## Model Routing

```env
PRIMARY_GENERATION_MODEL=
CRITIC_MODEL=gpt-5.5
TEMPORAL_MODEL=
OCULAR_MODEL=
EMBEDDING_MODEL=
GROQ_MODEL=
```

## Degradation Rules

- Missing `OPENAI_API_KEY`: critic and OpenAI generation adapters are unavailable and must emit a visible `CognitiveFailureReport`.
- Missing `GROQ_API_KEY`: Groq synthesis adapters are unavailable and must not be replaced by frontend inference.
- Missing Zilliz/Milvus config: `TypographyOrchestrator` uses `LocalPremiumFontRegistry` with visible degradation metadata.
- Missing R2 config: asset registry must report unresolved cloud assets rather than creating fake URLs.

## Startup Expectations

1. Install backend dependencies.
2. Fill provider keys.
3. Start backend services.
4. Start the Remotion preview shell.
5. Confirm frontend diagnostics show real stage health, not implicit success.

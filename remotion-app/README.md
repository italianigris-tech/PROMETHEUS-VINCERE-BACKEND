# Remotion Dean Graziosi Revamp

This app renders cinematic animated captions and motion showcases over a talking-head source video.

The ingest pathway is now locked into one chain:

1. transcribe with AssemblyAI
2. probe frame/orientation metadata
3. resolve `reel` vs `long-form`
4. choose the typography/caption profile for that presentation mode
5. build caption chunks
6. build motion-asset intelligence and showcase cues
7. copy the source video into the Remotion preview/public path
8. write inspectable JSON outputs for transcript, captions, metadata, motion map, and ingest manifest

## Setup

```bash
npm install
```

`.env` is already configured with your provided keys.

Style profile selection:

- `CAPTION_STYLE_PROFILE=slcp` (default)
- `CAPTION_STYLE_PROFILE=hormozi_word_lock_v1`
- `CAPTION_STYLE_PROFILE=svg_typography_v1`
- `CAPTION_STYLE_PROFILE=longform_svg_typography_v1`

## Ingest A New Video

```bash
npm run video:ingest -- --video "C:\path\to\your-video.mp4"
```

Optional flags:

- `--presentation reel|long-form`
- `--caption-profile slcp|hormozi_word_lock_v1|svg_typography_v1|longform_svg_typography_v1`
- `--motion-tier auto|minimal|editorial|premium|hero`
- `--job-id <id>`
- `--description "<description>"`
- `--refresh-showcase-assets`

The ingest command writes:

- `src/data/transcript.words.json`
- `src/data/captions.dean-graziosi.json`
- `src/data/video.metadata.json`
- `src/data/motion-map.reel.json`
- `src/data/ingest.reel.json`
- `public/input-video.mp4`

For landscape / long-form sources, the same command automatically resolves `long-form` and writes:

- `src/data/transcript.longform.words.json`
- `src/data/captions.longform.json`
- `src/data/video.longform.metadata.json`
- `src/data/motion-map.longform.json`
- `src/data/ingest.longform.json`
- `public/input-video-landscape.mp4`

To force long-form explicitly:

```bash
npm run video:ingest:longform -- --video "C:\path\to\your-landscape-video.mp4"
```

## Cut Longform Videos Into Work Chunks

```bash
npm run video:chunk -- --video "C:\path\to\your-longform-video.mp4" --out-dir "C:\path\to\output-folder" --chunk-seconds 300 --drop-remainder
```

This writes exact 5-minute working chunks plus a JSON manifest with stable file ordering.

To refresh the showcase asset cache from the seed catalog:

```bash
npm run showcase:sync
```

To sync the curated background-song library into the music-bed catalog:

```bash
npm run music:sync -- --input-dir "C:\path\to\song-folder"
```

You can also persist the folder in `.env`:

- `MUSIC_LIBRARY_PATH=C:\path\to\song-folder`

To batch-remove backgrounds from a local import folder without manually hand-cutting every image:

```bash
REMOVE_BG_API_KEYS=key1,key2 npm run showcase:remove-bg -- --input-dir "C:\path\to\folder"
```

This stages the raw files into `public/showcase-source/imports/<batch>` and writes transparent PNGs into `public/showcase-assets/imports/<batch>` plus a JSON manifest with suggested labels.

To upload the locally cached showcase assets into Supabase Storage:

```bash
npm run showcase:upload:supabase
```

This command expects:

- `SUPABASE_URL`
- `SUPABASE_STORAGE_BUCKET`
- preferably `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `SUPABASE_STORAGE_PREFIX`
- `--bucket <bucket-name>`
- `--prefix <folder-prefix>`
- `--create-bucket false`
- `--public false`

It writes an inspectable upload manifest to:

- `src/data/showcase-assets.supabase.json`

## Preview on Localhost

```bash
npm run dev
```

The browser preview opens on `http://localhost:3010`.

To preview the same sample composition in the browser without encoding an MP4 first:

```bash
npm run preview:web
```

The browser preview opens on `http://localhost:3101`.

## Studio Dev Fixture

Remotion Studio is a composition development tool, so it does not offer a product-style video upload flow.

For a local long-form fixture in Studio:

- place a test file at `public/dev-fixtures/test-video.mp4`
- start Studio
- open the `MaleHeadVideoLongFormDevFixture` composition

That composition uses the browser-safe public URL `/dev-fixtures/test-video.mp4`.

The browser sidebar now includes a `Motion Asset Brain` panel that shows:

- selected showcase moments
- flagged semantic moments that need better asset coverage
- suppressed moments that were held back for readability/density reasons

## Backend Link

The Remotion preview can call the local backend directly while both apps are running on your machine.

Set the API base URL if you want to override the default backend origin:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

The frontend panel uses:

- `POST /api/generate-viral-clips`
- `GET /api/jobs/:jobId`
- `GET /api/jobs/:jobId/result`

The backend also accepts the same request payload on `POST /api/jobs` for the broader orchestration flow.

## Local House Fonts

Licensed house fonts stay local-only under `public/fonts/house/<family>/<file>`.

1. Place each licensed binary at the path referenced in `src/lib/cinematic-typography/house-font-registry.ts`, or update the registry path and format to match your local file.
2. Set `enabled: true` only for entries whose files actually exist locally.
3. Run `npm run fonts:check` to verify the expected paths and catch any enabled entry that still points at a missing file.
4. Restart Remotion Studio or the Vite preview shell.
5. Confirm the typography diagnostics report `loadedHouseFontCount > 0`.

Do not commit commercial font binaries.

## Canonical Asset Embedding

The canonical asset retrieval path uses:

- one unified asset document per asset
- local `BAAI/bge-small-en-v1.5` embeddings by default for development and working indexing runs
- Zilliz / Milvus for vector storage and retrieval

Required environment for a real vector indexing run:

- `ASSET_MILVUS_ENABLED=true`
- `MILVUS_ADDRESS=<your-zilliz-host:19530>`
- `MILVUS_TOKEN=<your-zilliz-token>`
- `MILVUS_DATABASE=default` or your chosen database
- `MILVUS_COLLECTION_ASSETS=unified_motion_graphics_assets`
- `ASSET_EMBEDDING_PROVIDER=local-hf`
- `ASSET_EMBEDDING_TEXT_MODE=compact`
- `ASSET_EMBEDDING_BATCH_SIZE=8`
- `LOCAL_EMBEDDING_PYTHON_BIN=python`
- `LOCAL_EMBEDDING_MODEL_NAME=BAAI/bge-small-en-v1.5`
- `LOCAL_EMBEDDING_DIMENSIONS=384`
- `LOCAL_EMBEDDING_USE_FP16=false`

Experimental opt-in only, not connected to the default working path:

- `ASSET_EMBEDDING_PROVIDER=bge-m3-local`
- `BGE_M3_LOCAL_PYTHON_BIN=python`
- `BGE_M3_LOCAL_MODEL_NAME=BAAI/bge-m3`
- `BGE_M3_LOCAL_USE_FP16=false`

Warm the local Hugging Face cache before your first indexing run:

```bash
python scripts/prefetch-bge-m3.py
```

Useful commands:

```bash
npm run assets:scan
npm run assets:index
npm run assets:index:full
```

What each command does:

- `assets:scan` regenerates the unified asset documents and runtime catalog without embeddings.
- `assets:index` incrementally embeds changed assets and upserts them into Milvus when enabled.
- `assets:index:full` forces a full re-embedding and Milvus reindex pass.

Generated artifacts:

- `src/data/unified-asset-documents.generated.json`
- `src/data/unified-motion-assets.generated.json`
- `src/data/unified-asset-index-state.generated.json`

## Render Final MP4

```bash
npm run render
```

Output:

- `out/FEMALE-COACH-dean-graziosi.mp4`

To regenerate captions and render in one command:

```bash
npm run render:final
```

## Tests

```bash
npm test
```

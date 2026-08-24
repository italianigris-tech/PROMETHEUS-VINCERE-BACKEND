# Real Song Library — mini landscape runs

The soundtrack baker (`bake_soundtrack.py`) mixes **actual literal songs**, not
sound effects. The songs live in the Cloudflare R2 bucket `prometheus-music`
under `music-originals/<category>/<track>.mp3` (150 real tracks: classical,
cinematic trailer, hip-hop/trap, lo-fi, motivational, pop, tech).

## Seed → Song bridge

The song-selection layer picks abstract *seed* tracks (fingerprints only). The
baker resolves each seed to a real song that matches its semantic fingerprint:

| Seed track | Vibe | Real song | R2 object |
| :--- | :--- | :--- | :--- |
| `seed_cinematic_braam_04` (Deep Cinema Braam) | epic / dramatic | **Epic Cinematic Dramatic Adventure Trailer** | `music-originals/cinematic-trailer-epic/epic-cinematic-dramatic-adventure-trailer.mp3` |
| `seed_soft_desk_piano_01` (Quiet Desk Piano) | calm / intimate piano | **Passacaglia — Handel/Halvorsen (relaxing piano)** | `music-originals/classical/passacaglia-handel-halvorsen-relaxing-piano-music.mp3` |
| `seed_executive_board_02` (Executive Board Bed) | premium / authority | **Vivaldi — Four Seasons Summer III Presto** | `music-originals/classical-orchestral-prestige/vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3` |
| `seed_documentary_emotive_07` (Documentary Emotive) | emotive / moving | **Triumph** | `music-originals/motivational-uplift/triumph.mp3` |
| `seed_luxe_ambient_pad_08` (Luxe Ambient Pad) | ambient / luxurious | **The Way (Instrumental)** | `music-originals/lo-fi-chill-soft-focus/the-way-instrumental.mp3` |
| `seed_cinematic_braam_04` (payoff insert, alt) | epic accent | **Epic Inspiration** | `music-originals/cinematic-trailer-epic/epic-inspiration.mp3` |

## Refresh

```bash
python3 docs/mini_landscape_runs/fetch_songs.py
```

Credentials resolve from `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` /
`R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME`, falling back to the Modal secret
`prometheus-shared-env` (the deployment home of the R2 keys).

## Treatments applied to the songs (not SFX)

All audio treatments run on the real song windows: per-section trim + fades
(blend realization), -16 dB song gain, `amix` music bus, 2.0s program fades
(AUD-03), -6 dB voice ducking via sidechain (AUD-04), emotional insert as an
alternate song accent (AUD-06), and -14 LUFS / -1.5 dBTP loudness (AUD-01).

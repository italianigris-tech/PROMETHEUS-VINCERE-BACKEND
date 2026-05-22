House Font Drop Zone

This folder is the runtime home for licensed Prometheus house fonts.

Expected registry structure today:

- `public/fonts/house/jugendreisen/Jugendreisen-Regular.otf`
- `public/fonts/house/louize/Louize-Regular.otf`
- `public/fonts/house/louize/Louize-Italic.otf`
- `public/fonts/house/ivar-script/IvarScript-Regular.otf`
- `public/fonts/house/sokoli/Sokoli-Regular.otf`

Current behavior:

- The codebase already knows about these font families.
- They are scaffolded but disabled in `src/lib/cinematic-typography/house-font-registry.ts`.
- Dropping the files here is not enough by itself. After the files are present, flip the matching `enabled` flags to `true`.
- No commercial font binaries should be committed.
- Font binaries under this folder are gitignored. Keep only the scaffolding, `.gitkeep`, and this README in version control.
- When house fonts are unavailable, the project keeps captions visible with the deliberate fallback runtime stack instead of faking a premium font load.

Recommended activation order:

1. `Jugendreisen`
2. `Louize`
3. `Ivar Script`
4. `Sokoli`

After enabling any font:

1. Run `npm run typography:graph`
2. Run `npm run typography:audit`
3. Verify the lane moved from `doctrine-only` to runtime-backed in `docs/generated/typography-font-graph-report.md`

Safe local-only activation steps:

1. Place your licensed binaries under `remotion-app/public/fonts/house/<family>/<file>.woff2` or the exact registry path you plan to use.
2. If you use `.woff2` instead of the current `.otf` scaffold, update `src/lib/cinematic-typography/house-font-registry.ts` so the `path` and `format` match the local file.
3. Set `enabled: true` only for entries whose files actually exist locally.
4. Run `npm run fonts:check` from `remotion-app` to verify expected paths and enabled status.
5. Restart Remotion Studio or the Vite preview shell.
6. Confirm the Studio typography diagnostics show `fontRuntimeLoaded: true` and a non-zero `loadedHouseFontCount`.

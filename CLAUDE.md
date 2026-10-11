# F13LD.noise — instructions for Claude

## Commits and pull requests
- Do not add session links (e.g. `Claude-Session: https://claude.ai/...`) to commit messages, pull request descriptions or any file in this repo.
- `Co-Authored-By: Claude …` trailers are fine.
- Ask Matt before pushing to `main`.

## Code
- One file: `index.html`. Bump the header label (`.fh-version`) and `meta.version` in `buildExportJSON` on every release.
- The F13LD-SHADE / F13LD-VIEW blocks stay byte-identical with the other F13LD tools.
- The noise math exists twice here — `DeterministicNoise` (CPU, export / homogenization) and `noiseGLSL` (the GPU bake) — and downstream in F13LD.mesh (`worker/m10-noise.js`) and F13LD.lab / F13LD.sweep (`F13LD-GEOM-NOISE`). Any change to the field is a new noise revision (`surface.noise_rev`, see `docs/NOISE_REV2.md`) made in all of them in one release; older revisions keep building exactly as before.

## Checks
- GPU bake ↔ CPU: serve the folder holding the F13LD repos (`python -m http.server 8777`), then `node tests/gpu-parity.js` (needs playwright).
- Cross-tool geometry: in F13LD.sweep, `node tests/parity/parity.js --family noise` and `node tests/parity/noise-legacy.js` (repos as siblings). The parity harness slices this file by function markers (`tests/parity/lib/tools.js` there) — keep `var DeterministicNoise = (function() {`, `// ── Raymarcher`, `function seedToOffset(s){`, `function homoPrepass(params){` and `function buildExportJSON(){` or update the harness.

# Noise revision 2 (F13LD.noise v0.12.0, 2026-10-11)

One release across F13LD.noise v0.12.0, F13LD.mesh v0.9.9, F13LD.lab v0.26.2,
F13LD.sweep (shared `F13LD-GEOM-NOISE` block), F13LD.vault v0.8.1 and
F13LD.ingest v0.11.0 (`f13ld-vault-push.js` 1.1.0).

## Why

The noise math lived in four copies: the tool's CPU library (`DeterministicNoise`), the
tool's GLSL shader, F13LD.mesh's worker, and the Lab/Sweep shared block. Mesh, Lab and
Sweep were copies of the CPU library, so they agreed with each other — but not with the
3D preview:

- **Simplex lattice.** The CPU picked gradients with `floor(j*0.142857142857)`, a hair under
  1/7 in 64-bit floats, so ~12 % of lattice corners got an out-of-range gradient (raw range
  ≈ ±4.5 instead of ±1). That range set the normalization, so the center / half-width band
  meant something different from what it should (default simplex sheet: 86 % solid).
- **Simplex fold test.** 7 of the 49 gradients sit exactly on `h = 0`, where `h <= 0` flips with
  float rounding. 64-bit JS and 32-bit GPUs disagree on all 7 — the GPU was never exact either.
- **Worley hash.** Dave Hoskins' float `hash33` drifts by ~0.002 in 32-bit floats at large
  coordinates (seeded fields), so GPU and CPU cell seeds differed slightly.
- **Curl.** The shader differentiated each potential along its own axis — not a curl, and not
  the field Mesh/Lab built.
- **Domain warp.** The shader displaced with 2 octaves, Mesh/Lab with all of them.
- **Smoothing and perforation** existed only in the preview (never exported). Removed.

Measured at default settings, 9–23 % of voxels differed between the preview and the export
for every simplex-based type.

## The revision

`surface.noise_rev`:

| | Revision 1 (absent) | Revision 2 |
|---|---|---|
| Written by | F13LD.noise ≤ v0.11.0 | F13LD.noise v0.12.0+ |
| Gradient index | `floor(j*0.142857142857)` | exact integer `p mod 49`, `÷ 7` |
| Gradient fold | `h <= 0` (float) | `|4x−13| + |4y−13| ≥ 14` (integer) |
| Worley cell seed | float `hash33` | PCG3D integer hash (top 24 bits) |
| Warp displacement | all octaves | `min(octaves, 2)` octaves |
| Mesh / Lab / Sweep | build exactly as before | build the fixed field |
| F13LD.vault | refused (Ingest rule + database policy) | accepted |

A revision newer than a tool knows is refused, not guessed.

## The preview

The 3D view no longer evaluates noise per ray step. The normalized field is baked on the
GPU into a 3D texture (RG8, 16-bit packed), a few slices per frame; one generic shader
marches it. The bake shader is the only per-type program (compiled asynchronously, cached).
Quality = bake resolution: 96³ / 144³ / 192³.

## Checks

| What | Command | Result (2026-10-11) |
|---|---|---|
| GPU bake ↔ CPU library | `node tests/gpu-parity.js` (here; serve the parent folder on :8777) | 19 cases: Worley types within 3e-5 (bake storage), simplex types within float32 rounding (p99.9 ≤ 2.3e-3), sheet band ≤ 0.022 % |
| Legacy recipes unchanged; rev 2 agrees across tools | `node tests/parity/noise-legacy.js` (F13LD.sweep) | 19 v0.11.0 recipes: identical voxels in Sweep, Lab, Mesh; rev 2: Sweep ≡ Lab, Mesh ≤ 0.09 % |
| Tool export → Sweep / Lab / Mesh | `node tests/parity/parity.js --family noise` (F13LD.sweep) | PASS — 19 recipes + 18 designs |
| Vault rule | `node tests/noise-rev.js` (F13LD.ingest) | PASS |

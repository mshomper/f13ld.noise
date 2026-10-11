# Noise Scaffold Explorer

**Part of the [F13LD](https://f13ld.app) tool suite by [Not a Robot Engineering](https://notarobot-eng.com)**

🔗 **[Launch → F13LD.noise](https://mshomper.github.io/f13ld.noise)**

<img width="1226" height="968" alt="f13ld noise git image" src="https://github.com/user-attachments/assets/dcfdf569-7319-408e-bd18-15f930586381" />

A browser-based implicit field explorer for generating stochastic scaffold geometry from mathematical noise fields. Ten noise types share one design pipeline: a GPU-baked, raymarched 3D preview with an X/Y/Z clip plane, MIL-HS mechanical homogenization, and recipe handoff to F13LD.mesh (watertight 3MF), F13LD.lab (FFT homogenization) and F13LD.queue.

All geometry is fully implicit — no meshes, no STL intermediates at the design stage. Structure is defined as a scalar field evaluated on demand at any point in space.

---

## Overview

Periodic lattices (TPMS, BCC, FCC) offer predictable but rigid geometry. Real biological structures — trabecular bone, open-cell cartilage, vascular networks — are stochastic: they achieve mechanical efficiency through statistical rather than crystallographic order. This tool lets you explore that design space.

The noise types occupy distinct positions in the stochastic geometry landscape:

| Noise type | Mechanism | Natural topology | Beam character | Directional control |
|---|---|---|---|---|
| Simplex | Gradient-hash lattice | Sheet / half-solid | Low | None |
| Cellular (F2−F1) | Voronoi distance field | Cell wall network | None | Via metric |
| FBM | Octave-layered simplex | Sheet / half-solid | Low–moderate | None |
| Ridged FBM | `1 − |simplex|` per octave | Sharp ridges / spicules | Moderate | None |
| Billow | `|simplex|` per octave | Rounded lobes | Low | None |
| Domain Warped | FBM-displaced FBM | Flowing organic | Low | None |
| Curl | Divergence-free ∇×Ψ | Tube networks | High | Via potential scale |
| Veined | `sin(x·f + turb·fbm)` | Laminar sheets / striations | Low | Banding along X |
| Foam (F2) | 2nd-nearest Voronoi distance | Rounded closed cells | None | Via metric |
| Strut network (F3−F1) | Voronoi edges | Round struts (open-cell foam, trabecular rods) | High | Via metric |

---

## Usage

Open `index.html` in a browser with WebGL2 (Chrome, Edge, Firefox, Safari 15+). One file, no build step, no dependencies.

**Recommended workflow:**

1. Select a noise type and set axis scaling for any desired anisotropy
2. Shape it in the 3D view — center, half-width, topology and the clip plane update instantly; field settings re-bake in a fraction of a second
3. Use the **X / Y / Z** clip pills to look inside the structure
4. Run **homogenization** for a quick stiffness estimate
5. Hand the recipe on: **⬡ Mesh** for a watertight, printable 3MF, **▦ Lab** for the FFT solver, **⊕ Queue** to save it, or **Export JSON**

---

## Noise Types

### Simplex

```
φ(x) = snoise(x · S)
```

Standard 3D simplex noise (Gustavson 2012). Smooth, continuous gradient field with no preferred direction. The foundational noise type — use it as a baseline before exploring the fractal variants. At mid volume fraction produces interconnected open-pore sheets; at low volume fraction the minority phase forms loosely connected blobs.

**No additional parameters.**

---

### Cellular (F2−F1)

```
φ(x) = F₂(x) − F₁(x)    [Worley distance field]
```

The difference between the second and first nearest Voronoi cell distances. Produces a field that is zero along cell boundaries and positive everywhere else — the natural analog of foam cell walls or honeycomb networks.

**Additional parameter:**
- **Distance metric** — Euclidean (smooth rounded cells), Manhattan (square-edged cells), Chebyshev (cubic cells). Controls the shape of the Voronoi geometry without changing the topology.

---

### FBM (Fractal Brownian Motion)

```
φ(x) = (1/Z) · Σᵢ aᵢ · snoise(x · f · lacunarityⁱ)
```

Octave-layered simplex: each octave adds detail at a higher spatial frequency, weighted by `gainⁱ`. Produces multi-scale texture with consistent statistical character across scales.

**Additional parameters:**
- **Octaves** — number of stacked noise layers (1–8). Live uniform — no recompile on change.
- **Lacunarity** — frequency ratio between successive octaves. 2.0 = classic doubling.
- **Gain** — amplitude falloff per octave. 0.5 = each octave contributes half the previous amplitude.

---

### Ridged FBM

```
φ(x) = (1/Z) · Σᵢ aᵢ · (1 − |snoise(x · f · lacunarityⁱ)|)
```

Replaces each octave's raw noise with `1 − |noise|`, inverting the minima into sharp ridges. Produces prominent connected ridge networks — a close match to trabecular spicules and coral branching geometry.

Parameters identical to FBM.

---

### Billow

```
φ(x) = (1/Z) · Σᵢ aᵢ · |snoise(x · f · lacunarityⁱ)|
```

Replaces each octave with `|noise|`, folding the negative half of the distribution upward. Produces rounded, cloud-like lobes — the natural analog of open-cell foam and adipose tissue.

Parameters identical to FBM.

---

### Domain Warped

```
q(x) = fbm(x)
φ(x) = fbm(x + strength · q(x))
```

Applies FBM displacement to the input coordinates before evaluating the final FBM. The displacement uses the first 2 octaves (min(octaves, 2)); the final field uses the full octave count. Produces flowing, non-repeating geometry with no straight features.

**Additional parameter:**
- **Warp strength** — magnitude of the displacement field. 0 = no warp. 1–2 = organic flow. 3+ = extreme folding.

---

### Curl

```
∇×Ψ(x)    where Ψ is a simplex vector potential
cx = (∂Ψz/∂y − ∂Ψy/∂z)
```

Takes the curl of a simplex-derived vector potential via forward-difference finite differences (9 snoise calls per evaluation). Produces a field whose magnitude forms connected tube networks — the closest noise analog to vascular trees and Haversian canals.

**Additional parameters:**
- **Curl step** — finite-difference step size. Smaller = more accurate; larger = softer tube geometry.
- **Potential scale** — spatial frequency of the underlying vector potential.

> **Performance note:** Curl needs 9 snoise calls per field sample, so its bake takes longest; once baked it orbits as fast as any other type.

---

## Axis Scaling

Independent per-axis frequency scaling applied before the noise evaluation:

```
φ(x) = noiseField(x · diag(scaleX, scaleY, scaleZ) · freq)
```

Stretches or compresses the noise field independently along each world axis, introducing geometric anisotropy without changing the noise type or global frequency.

| Scale < 1.0 | Scale = 1.0 | Scale > 1.0 |
|---|---|---|
| Features compressed along axis | Isotropic (default) | Features elongated along axis |
| Denser pores, thicker walls | — | Coarser pores, thinner walls |

Range: 0.25–4.0. The preview's step bound is measured from the field itself, so it follows the axis scaling automatically. Homogenization reads the anisotropic field and reports directional moduli that reflect the scaling — providing a direct design handle on stiffness anisotropy.

---

## Scaffold Geometry

**Topology** controls how the scalar field is converted to solid/void geometry:

| Mode | SDF expression | Character |
|---|---|---|
| Sheet | `\|φ − center\| < half-width` | Two surfaces bounding a hollow channel |
| Solid | `\|φ − center\| > half-width` (inverted) | Filled slab with open voids |

- **Center** — shifts the isosurface threshold. Primary volume fraction control.
- **Half-width** — slab thickness. Low values produce thin-wall open-pore scaffolds.

---

## Homogenization (MIL-HS)

Estimates effective elastic properties from the voxelized scalar field using the Mean Intercept Length method coupled to the Hashin-Shtrikman upper bound.

**Outputs:**
- **Volume fraction ρ** — solid phase fraction
- **Ex, Ey, Ez** — directional Young's moduli (GPa)
- **Gxy** — shear modulus (GPa)
- **νeff** — effective Poisson's ratio
- **Zener A** — anisotropy ratio. A = 1 is perfectly isotropic
- **Stiffness ellipsoid** — rotating WebGL visualization of the directional stiffness surface

**Grid resolution** — 32³, 48³, or 64³.

**E_s (GPa)** — solid material Young's modulus (Ti6Al4V ≈ 114 GPa, PEEK ≈ 3.6 GPa, 316L ≈ 193 GPa).

> MIL-HS assumes statistical homogeneity. Results improve at higher spatial frequency and higher grid resolution. Noise fields are not periodic — results are statistical approximations.

---

## Mesh Export

Meshing lives in [F13LD.mesh](https://mshomper.github.io/f13ld.mesh): the **⬡ Mesh** button opens the current recipe there, where it becomes a watertight 3MF (Draft / Standard / Fine, any part size, shape clipping, multibody assemblies). F13LD.mesh builds from the same noise math as the preview.

---

## Export JSON

The exported JSON carries the complete parameter set, the normalization range (`norm_min` / `norm_max`) and, if homogenization has been run, the mechanical results. F13LD.mesh, F13LD.lab, F13LD.sweep and F13LD.vault read it.

```json
{
  "meta": {
    "version": "0.12.0",
    "tool": "noise-scaffold-explorer",
    "timestamp": "...",
    "preset": "simplex"
  },
  "surface": {
    "type": "noise",
    "noise_type": "simplex",
    "noise_rev": 2,
    "frequency": 0.3,
    "scale_x": 1.0,
    "scale_y": 1.0,
    "scale_z": 1.0,
    "center": 0.0,
    "half_width": 0.15,
    "norm_min": -1.11,
    "norm_max": 1.17,
    "topology": "sheet"
  },
  "geometry": {
    "cell_scale": 3.333,
    "mode": "shell",
    "wall_thickness": 0.15
  },
  "homogenization": {
    "volume_fraction": 18.4,
    "Ex_GPa": 12.3,
    "method": "MIL-HS",
    "note": "statistical_homogeneity_assumed"
  }
}
```

### Noise revisions (`surface.noise_rev`)

| Revision | Written by | What it is |
|---|---|---|
| 1 (field absent) | F13LD.noise ≤ v0.11.0 | Legacy. The CPU simplex picked lattice gradients with a truncated 1/7 and a float fold test, so its field (and the exported part) differed from the 3D preview. Mesh, Lab and Sweep keep building it exactly as before; F13LD.vault no longer accepts it. |
| 2 | F13LD.noise v0.12.0+ | Fixed. Integer lattice (permutation, gradient index, fold test) and a PCG3D integer cell hash for the Worley types, so the GPU preview and every downstream tool compute the same field. Domain warp displaces with min(octaves, 2) octaves. |

Details and the parity checks: [`docs/NOISE_REV2.md`](docs/NOISE_REV2.md).

---

## Part of the F13LD Suite

| Tool | Field type | Topology | Directional control |
|---|---|---|---|
| [F13LD.tpms](https://mshomper.github.io/f13ld.tpms) | Periodic trigonometric | Sheet / strut | Crystallographic symmetry |
| **F13LD.noise** | Isotropic stochastic | Sheet / solid | Per-axis frequency scaling |
| **F13LD.grain**| Anisotropic stochastic | Sheet / half-solid | VMF + orthotropic |

---

## Technical Notes

**Fully implicit principle** — all geometry is defined as a scalar field evaluated pointwise. No mesh generation or STL intermediates exist during design. Meshing happens once, as a fabrication step, in F13LD.mesh.

**3D preview (v0.12.0)** — the normalized field is baked on the GPU into a 3D texture (96³ / 144³ / 192³ for Low / Med / High, 16-bit values in an RG8 texture), a few slices per frame, then a single generic shader marches the texture. Center, half-width, topology, flip and the clip plane are uniforms — they never re-bake. Only the bake shader depends on the noise type; it compiles asynchronously and is cached. The march catches sign changes and bisects to the surface, so thin walls never slip between steps. The view drops to reduced resolution while you orbit or drag a slider. The GLSL noise is checked against the CPU library by `tests/gpu-parity.js`.

**Normalization** — a 32³ scan over the preview cube sets the range that maps the raw noise to roughly [-1, 1]. The preview, the homogenization and the export (`norm_min` / `norm_max`) all use it, and F13LD.lab / F13LD.sweep recompute it the same way.

**Browser compatibility** — WebGL2 required for the 3D view. Homogenization and export work without it.

---

## License

MIT — see LICENSE file.

*Not a Robot Engineering · notarobot-eng.com*

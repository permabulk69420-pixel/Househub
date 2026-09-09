# Replacement PBR textures

Add textures in a named subfolder, then add its material slot to `manifest.json`.
All paths are relative to this folder. Nothing is downloaded from a CDN at runtime.

Example (replace `materials: {}` with this populated object):

```json
{
  "version": 1,
  "materials": {
    "oak": {
      "baseColor": "oak/basecolor.webp",
      "normal": "oak/normal.webp",
      "roughness": "oak/roughness.webp",
      "ao": "oak/ao.webp",
      "tileSizeMeters": [2.4, 2.4],
      "normalScale": 0.6
    }
  }
}
```

Slots: `oak`, `walnut`, `travertine`, `plaster`, `linen`, `rug`, `leather`,
`darkStone`, `ceramic`, `brass`, `blackMetal`, `whitePaint`, `darkFabric`, `mirror`.
Decorative slots also include `screen`, `black`, `paper`, `bookRust`, `bookOlive`,
`leaf`, `soil`, `warmLight`, `dimLight`, and `glass`.

Each slot starts as a shared Three.js PBR material. Bedroom and bathroom batches
clone the loaded material to attach a reflection probe for their own room. Texture UVs measure metres, so
`tileSizeMeters` controls physical texture scale across differently sized pieces. Local projections follow the furniture rotation;
curved back panels and cloth use parametric UVs.
Use OpenGL/+Y tangent-space normal maps. Base color is sRGB; roughness, normal,
metalness, and AO are linear. Separate roughness and metalness images are supported.
AO uses UV0 for tileable material micro-occlusion. Geometry also retains UV1 for
future *separately unwrapped* lightmaps; it is not a unique scene-wide lightmap atlas.

Start with 1K images, using 2K where visibly useful. A missing or invalid map keeps
the built-in material and logs an actionable console warning. The complete apartment
already includes locally generated tileable base-color/roughness/bump textures.

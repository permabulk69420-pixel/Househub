# Househub

A furnished luxury apartment in Three.js, built for exploration on standalone
Meta Quest 3. This first pass focuses on the environment: an open living room,
kitchen and dining area, bedroom, bathroom, and connecting gallery. The apartment
is approximately 18 × 14 metres, with 3.25 m ceilings. Outside is a simple sky.

## Open it

GitHub Pages: **https://permabulk69420-pixel.github.io/Househub/**

Open the page in Meta Quest Browser and choose **Enter VR**.

| Device | Controls |
| --- | --- |
| Quest | Left thumbstick: walk; right thumbstick: turn |
| Quest | Hold either trigger to aim a teleport; release to move to a valid landing |
| Desktop | Drag to look; WASD or arrow keys to walk |
| Desktop | Explore locks the mouse; Escape releases it; Shift walks faster |
| Phone | Drag the room to look; use the left pad to walk |

The controls menu offers smooth or 30° snap turning, two walking speeds, and a
return to the entrance. Smooth turning is the default. Virtual movement collides
with walls and furniture. Teleporting validates the landing and rejects paths
through walls. Physical room-scale movement remains headset-tracked.

## Materials and future texture work

The scene already has generated oak, walnut, travertine, plaster, fabric, rug,
leather, and dark stone maps, plus metal and ceramic PBR materials. These are
generated locally from deterministic functions; there are no runtime CDN requests.

Add replacement maps in **`public/assets/materials/`** and update its
**`manifest.json`**. See that folder's README for an example and the complete slot
list. Base color, normal, roughness, metalness, and AO channels are supported.
UV0 measures metres, and the manifest specifies each texture's physical tile size.
Every mesh has normals and UV attributes, including rounded furniture and stonework.
UV1 is reserved but is **not** a uniquely unwrapped lightmap atlas.

`src/apartment.js` retains descriptive names and material assignments for each
authored part. At startup, static pieces are batched by room, material, and shadow
settings. Each resulting batch retains its source part names in `userData.parts`.
Edit the named source pieces to change furniture; change a material slot to update
every piece that uses it.

## Lighting and rendering budget

- Roughly 135K triangles and 80 static material batches before visibility culling.
- One 2048² directional shadow map, generated once; two local lights without shadows.
- Static vertex shading and soft contact-shadow decals ground the furniture.
- A reflection probe captures the apartment once. Reflections are approximate;
  the vanity panel is smoked reflective glass, not a live planar mirror.
- No bloom, screen-space AO, real-time reflection passes, physics engine, or imported
  environment assets. Antialiasing, a capped desktop pixel ratio, and XR foveation
  keep the renderer modest. Actual Quest frame rate still needs headset measurement.

Lights and furnishings are static in this pass. If a future feature moves a shadow
caster or changes the sun, set `renderer.shadowMap.needsUpdate = true`; refresh
the reflection probe when appropriate. Realistic baked GI and replacement PBR maps
can be added later without changing the apartment layout.

## VR origin and future hub doors

One world unit equals one metre. +Y is up; the floor is Y=0. The player rig uses a
`local-floor` reference space and the headset's measured height. The desktop eye
height is removed on entering VR, avoiding a doubled eye-height offset. Turning
pivots around the tracked head, including when the player is standing off-center.

Stable empty anchors: `PlayerSpawn`, `HubDoor_Entry`, `HubDoor_Hall`.
The doors are environment pieces; no external repo navigation is enabled yet.
More portal bays or other layouts can be added when those destinations are connected.

## Development and deployment

```sh
npm ci
npm run dev
npm run check
npm run build
```

The Actions workflow builds and publishes `dist/` on pushes to `main`. Keep Pages
configured to deploy from **GitHub Actions**. Relative build URLs support the
repository subpath. Three.js and Vite versions are pinned in the lockfile.

`npm run check` builds the real scene in Node, validates mesh attributes and geometry
budgets, tests blocked and open positions, and flood-fills the navigation area to
verify that the rooms, gallery, and shower can all be reached from the spawn.

Optional inspection URLs: `?stats=1`, or `?view=living`, `?view=kitchen`,
`?view=bedroom`, `?view=bathroom`. Add `&clean=1` for an unobstructed view.

The offline images in `docs/previews/` show the authored geometry and material
textures with approximate lighting. They are not browser or headset captures:
the development browser in this session did not provide a WebGL context.
The production build and navigation checks were verified; headset appearance,
controller input, frame rate, and actual shader output still need a Quest test.

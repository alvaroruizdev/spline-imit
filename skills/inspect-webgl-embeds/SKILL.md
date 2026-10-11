---
name: "inspect-webgl-embeds"
description: "Spline scene, my.spline.design embed, WebGL canvas page: inventory and screenshot a scene you cannot open in a browser."
---

# Inspect WebGL / Spline embeds

Use when the target is a scene living inside a WebGL canvas page (Spline `my.spline.design/...`, or a similar embed) that you cannot open in an interactive browser but must describe or replicate.

## Steps

1. Fetch the embed HTML with `curl`, not `web_fetch`: `curl -sL --compressed -A "<desktop UA>" "<url>" -o /tmp/embed.html`. Done when the file is HTML and tens of kB.
2. Extract the inline scene. Spline embeds carry the whole scene as a numeric byte array in `app.start([...])`. In Python: `re.search(r'app\.start\((\[.*?\])\)', html, re.S)` on the file text, then `ast.literal_eval` that group and wrap in `bytes()`. Done when the byte length exceeds ~10 kB.
3. Inventory the contents by strings: `re.findall(rb'[\x20-\x7e]{4,}', data)`, deduplicated in order. This alone yields object names, material types, texture names, light types, postprocessing effects, and animation/state property names — enough to describe the scene without decoding the binary.
4. Extract embedded textures: scan for JPEG runs (`\xff\xd8\xff` through `\xff\xd9`) and the PNG signature; write each run larger than ~2 kB to a file and confirm with `identify`. Copy useful ones beside the recreation project.
5. Render a frame: `timeout 120 google-chrome-stable --headless=new --no-sandbox --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader --hide-scrollbars --window-size=1600,1000 --force-device-scale-factor=2 --virtual-time-budget=25000 --screenshot=/tmp/shot.png "<url>"`. Confirm the PNG exists. Re-run with a different `--virtual-time-budget` and compare the content bounding boxes to prove the scene is animating.
6. Isolate the subject: `magick /tmp/shot.png -fuzz 3% -trim info:` for the content bbox, then `magick /tmp/shot.png -fuzz 3% -trim +repage -resize 800x out.png`. Done when the crop holds the object and little background.
7. Look at it: copy the crop into the workspace before calling `view_image` (`/tmp` paths are rejected as outside allowed directories). Pass a targeted prompt asking for shape count, material, lighting, and background.
8. Report the result with the render caveat (next section) so a flat capture is not mistaken for the intended design.

## Pitfalls and caveats

- Headless SwiftShader frequently fails to load the scene's HDRI / environment map, so transmission, iridescence, and reflections render flatter and whiter than in the real browser. State this rather than presenting the flat capture as the look.
- Chrome headless prints GCM/registration errors on stderr; ignore them and judge success by the written PNG.
- The page body background and the scene's own `backgroundColor` can differ; read the scene value from the decoded bytes and report that one.
- If a `web_fetch` tool exists but the foreground run reports it missing, keep going with `curl` instead of stopping.

## Decoding more of the stream (only if step 3 is not enough)

The byte array is a custom MessagePack-like stream: `0xd4 0x72 <id>` opens a numbered table entry, and the value that follows uses the usual msgpack tags (`0x9x` array, `0xax` string, `0xcb` float64, `0xc2`/`0xc3` booleans) with extra extension opcodes (`0xc7`-`0xc9`, `0xd4`-`0xd8`). String extraction from step 3 answers most questions; reach for full decoding only for exact numeric values.

## Recreating in three.js

When the task is to rebuild the scene in three.js (glass/iridescent materials are the usual ask):

1. Generate UVs before using `bumpMap` or `iridescenceThicknessMap` on meshes that lack them. Exported GLBs often carry only POSITION and NORMAL, and a texture sampled with missing UVs changes nothing silently. In the GLTF load callback, when `geometry.getAttribute('uv')` is absent, compute spherical UVs from POSITION — `u = 0.5 + atan2(z, x) / (2π)`, `v = 0.5 - asin(y / r) / π` — then `setAttribute('uv', ...)`.
2. Do not rely on three.js `iridescence` alone for a Spline iridescent-glass look; it is far too subtle on smooth geometry because Spline fakes the effect with fresnel layers and a matcap. Add a fresnel colour band through `material.onBeforeCompile`: declare `uniform float uIridBoost;` by replacing `#include <common>`, and replace `#include <opaque_fragment>` to tint `outgoingLight` by view angle from a cosine or HSV palette before that include. Store `material.userData.shader = shader` in the callback so the uniform can change at runtime.
3. Tint by `mix`, not `+=`. A white surface under a bright environment saturates to white (HDR > 1), so an added colour survives only in the thinnest silhouette rim. Write `outgoingLight = mix(outgoingLight, colour, amount)` and keep the environment and lights dim enough that the surface stays in range; the band then broadens and bleeds inward.
4. Light glass with a real HDRI (three.js's `venice_sunset_1k.hdr` via `RGBELoader` + `pmrem.fromEquirectangular`) under ACES tone mapping; ACESFilmicToneMapping washes bright pastel LDR canvas env maps to white, and LDR gradients read as colourless on glass.
5. Build a custom studio environment of emissive discs for circular, intense highlights — one large `CircleGeometry` softbox plus a few small, very bright glints — fed through `pmrem.fromScene(scene, 0.0)`. Round sources reflect as round highlights while rectangular panels reflect as streaks.
6. Keep `transmission` moderate (about 0.3–0.5) when the reference reads as a high-key white solid: near 1.0 the reflection that carries the colour is suppressed. Expose every material and light value as a URL query override and hide the lil-gui panel behind a flag, then iterate `headless screenshot -> magick -trim -> view_image`; headless SwiftShader output matches a real-GPU browser closely enough to tune against.

7. Prefer three.js core helpers for light gizmos over custom marker meshes: `new THREE.SpotLightHelper(light, color)` (also `PointLightHelper`, `DirectionalLightHelper`) is exported from the core module in r160, so never import it from `three/addons/helpers/` (that path 404s). Add each helper to the scene root, not to a group that rotates, or its matrix applies twice; call `helper.update()` every frame while the lights orbit and after any property change, and `dispose()` it when rebuilding the lights. The spotlight cone reflects the aperture (`width = distance * tan(angle)`), so an angle control shows live in the gizmo.

8. Ship a clean deliverable by reading the page's own source and stripping the dev-only code: `await (await fetch(location.pathname, {cache:'no-store'})).text()`. Regex-remove the lil-gui import and its import-map entry, the GUI block, and any debug viewer, and flip a module const (e.g. `const USE_HELPERS = false;`) that gates helper creation. Wrap each removable region in markers (`<!-- VIEWER-START -->`/`<!-- VIEWER-END -->`, `/* === GUI-JS-START === */`/`/* === GUI-JS-END === */`) so one non-greedy regex deletes it, then download through a temporary `<a download>` and a `Blob` URL. Verify by serving the exported file from the project directory: it keeps the relative `./vendor/...` imports and is not self-contained.

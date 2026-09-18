# yvrTracker — Work Order

**Scope:** bug fixes, UI fixes, optimization, aircraft model coverage.
**Out of scope:** the readsb / local-SDR migration. Do not touch the data source, `app/api/adsb/route.js`
transport, or the `EventSource` wiring except where an item below names them explicitly.

**Ground rules for whoever implements this:**
- Surgical changes only. Every changed line must trace to a numbered item below.
- Do not refactor adjacent code, reformat, or "improve" comments that are not part of an item.
- Match existing style: no TypeScript, no semicolon cleanup, inline style objects stay inline.
- Work items are independent. Land them one at a time and verify each before starting the next.

Invariant worth internalizing before touching anything: **`FlightManager.jsx` normalizes every field to
SI at ingest.** `flight.altitude` is metres. `flight.velocity` is m/s. Scene units are 100 m per unit
(`x = Δlon · 73 · 10`, `y = alt_m / 100`). Any code displaying feet or knots must convert at the display
layer. Several places currently do not.

---

## P0 — Correctness bugs

### 1. Tower target-lock monitor shows SI values with imperial labels

**Files:** `app/components/tower/TowerMonitors.jsx:98,101`, plus a new `app/components/core/units.js`

```jsx
<Text ...>{Math.round(closest.altitude)} ft</Text>    // altitude is METRES
<Text ...>{Math.round(closest.velocity)} kts</Text>   // velocity is M/S
```

Altitude reads 3.28x low, ground speed 1.94x low.

The same conversion math is already duplicated inline at two other sites:

- `app/components/ui/TelemetryHUD.jsx:70,79`
- `app/components/aircraft/LiveAircraft.jsx:252,253`

Item 9 would add a fourth. Fix the bug and remove the duplication in one change.

**Change:**

1. Create `app/components/core/units.js`. Keep it minimal, two functions, no formatting options, no
   speculative unit systems:

```js
// Display conversions. FlightManager normalizes all telemetry to SI at ingest:
// altitude in metres, velocity in m/s. Convert only at the display layer.

export function formatAltitude(metres, useMetric) {
  return useMetric
    ? { value: Math.round(metres), unit: 'm' }
    : { value: Math.round(metres * 3.28084), unit: 'ft' }
}

export function formatSpeed(metresPerSecond, useMetric) {
  return useMetric
    ? { value: Math.round(metresPerSecond * 3.6), unit: 'km/h' }
    : { value: Math.round(metresPerSecond * 1.94384), unit: 'kts' }
}
```

   Returning `{ value, unit }` rather than a joined string matters: `TelemetryHUD` styles the number and
   the unit differently (`TelemetryHUD.jsx:71,80` wraps the unit in its own `<span>`), so a pre-joined
   string would force that markup to change.

2. `TowerMonitors.jsx:98,101` — use the helpers. This is the bug fix. The tower monitor has no
   `useMetric` prop and the rest of that panel is imperial, so pass `false` explicitly rather than
   threading new state through `ATCTowerInterior`.

3. `TelemetryHUD.jsx:70,79` and `LiveAircraft.jsx:252,253` — replace the inline ternaries with the
   helpers. Preserve the existing casing: `TelemetryHUD` renders the unit uppercase (`FT`, `KTS`),
   `LiveAircraft` renders it lowercase. Uppercase at the call site, do not add a casing option to the
   helper.

This deliberately touches three files rather than one. That is a knowing deviation from the surgical rule,
taken because creating a shared helper while leaving two copies of the same math in place would be worse
than either alternative. Nothing else in those files changes.

**Verify:** pick a live aircraft. Its altitude and ground speed must read identically in all three places:
the `TARGET LOCK` panel in TOWER view, the `TelemetryHUD`, and the hover label on the aircraft itself
(with IMPERIAL selected). Toggle to METRIC and confirm the HUD and the hover label both switch while the
tower panel stays imperial.

---

### 2. `TelemetryHUD` labels the ICAO hex as a registration

**File:** `app/components/ui/TelemetryHUD.jsx:38`

`REG: {aircraft.id.toUpperCase()}` prints the 24-bit ICAO address (e.g. `C081A3`), not the tail number.
The upstream feed carries the registration in `ac.r`, which `FlightManager` currently discards.

**Change:**
- `app/components/core/FlightManager.jsx` — add `registration: ac.r || null` to the returned track object.
- `TelemetryHUD.jsx:38` — render `REG: {aircraft.registration || '—'}` and add a second line
  `ICAO: {aircraft.id.toUpperCase()}`.

**Verify:** a Canadian airliner shows `REG: C-FGEI` style, not a hex string.

---

### 3. An empty feed never clears the aircraft list

**File:** `app/components/core/FlightManager.jsx:17`

```js
if (data.ac && data.ac.length > 0) { ... setFlights(activeTracks) }
```

If the upstream returns zero aircraft, the previous array is retained and ghost aircraft stay on screen
indefinitely, frozen mid-extrapolation.

**Change:** guard on `Array.isArray(data.ac)` only, and let an empty array flow through to `setFlights([])`.

**Verify:** temporarily point the API route at a URL returning `{"ac":[]}`. Scene must empty out and the
Ops panel must read `INBOUND (0) / OUTBOUND (0)`.

---

### 3b. Selected aircraft telemetry is frozen at the moment of click

**Found while reviewing item 3. This is a P0 and should be done before item 4.**

**File:** `app/components/AirportScene.jsx:51,83,92,103,116,122,128`

`selectedAircraft` stores the **flight object**, captured once at click time:

```js
const [selectedAircraft, setSelectedAircraft] = useState(null)
...
onSelect={setSelectedAircraft}   // LiveAircraft calls onClick(flight)
```

Every feed update, `FlightManager` builds an entirely new array of new objects and pushes it up via
`onFlightsUpdate`. Nothing ever re-points `selectedAircraft` at the fresh object for that hex. Nothing in
`AirportScene` re-syncs it (confirmed: the identifier appears at lines 51, 80, 82, 88, 92, 109, 117, 121,
128 and is never reassigned from `flights`).

Consequences:

- **`TelemetryHUD` altitude, ground speed and status never change while an aircraft is selected.** Click a
  plane to watch its telemetry and the numbers are dead. The aircraft keeps moving in the 3D scene because
  `LiveAircraft` receives its own fresh `flight` prop, so the freeze is easy to miss.
- A selected aircraft that drops out of the feed leaves the HUD showing stale data indefinitely. Item 3
  makes this trivially reachable: an empty feed now clears the scene but the HUD stays open on a ghost.

**Change:** store the id, derive the object.

```js
const [selectedId, setSelectedId] = useState(null)
const selectAircraft = useCallback((f) => setSelectedId(f ? f.id : null), [])
const selectedAircraft = useMemo(
  () => (selectedId ? flights.find(f => f.id === selectedId) || null : null),
  [flights, selectedId]
)
```

Pass `selectAircraft` everywhere `setSelectedAircraft` is passed today (lines 103, 116, 122) and use it
for the `null` calls (lines 83, 128). **No child component changes.** `ControlPanel` already calls
`setSelectedAircraft(null)`, `LiveAircraft` and `FlightSearchMonitor` already call `onSelect(flight)`.
Both signatures are satisfied by `selectAircraft`.

This also fixes the dangling selection for free: when the aircraft leaves the feed, `find` returns
`undefined`, `selectedAircraft` goes `null`, the HUD closes, `CameraController` releases the camera lock,
and the tower interior reappears in TOWER view.

**Two traps, both caused by `selectedAircraft` now changing identity on every feed update:**

1. `AirportScene.jsx:90-92` resets `chaseViewIndex` to 0 on `[selectedAircraft]`. Left alone, this fires
   every ~2 s and kicks you out of chase cam continuously. **Change the dep to `[selectedId]`.**
2. `AirportScene.jsx:77-88` has `[selectedAircraft, cameraMode]` deps, so the keydown listener would be
   torn down and re-registered every update. Harmless but wasteful. **Change to `[selectedId, cameraMode]`**
   and read `selectedId` inside the handler instead of `selectedAircraft`.

`LiveAircraft` is fine: it is `memo`'d and receives `isSelected` as a boolean, so memoization still holds.

**Verify:**
- Select an aircraft in flight. Its altitude and ground speed in the HUD must change within one feed
  interval (~2 s). Before this fix they never change at all.
- Enter chase cam with `C`, then wait 10 seconds without touching anything. You must stay in chase cam.
- Select an aircraft, then point the API route at a URL returning `{"ac":[]}`. The HUD must close on its
  own and the camera must return to free orbit.

---

### 4. Field of view permanently changes after entering tower view once

**Files:** `app/components/AirportScene.jsx:107`, `app/components/camera/CameraController.jsx:11,28-33`

The camera is created with `fov={85}`. `CameraController` holds a hardcoded `defaultFov = useRef(75)` and
writes it back whenever `cameraMode !== 'TOWER'`. Entering and leaving TOWER view silently drops the
global view from 85 to 75, and it never comes back.

**REVISED after a first attempt failed review. Do not use the lazy-capture approach.**

Capturing `camera.fov` into the ref from a mount effect does **not** work, and lands on exactly the wrong
value. Traced through the installed packages:

1. `@react-three/fiber` creates its own default camera before any child mounts:
   `new THREE.PerspectiveCamera(75, 0, 0.1, 1000)`
   (`node_modules/@react-three/fiber/dist/events-b389eeca.esm.js:15660`).
2. drei's `<PerspectiveCamera makeDefault>` swaps that out in a **`useLayoutEffect`**
   (`node_modules/@react-three/drei/core/PerspectiveCamera.js:52-64`).
3. `CameraController` reads `const { camera } = useThree()` **during render**, before that swap. Its
   passive `useEffect` closes over the pre-swap camera, so it captures fov **75**, not 85.
4. The store update re-renders `CameraController` with the correct camera and the `[camera]` effect
   re-runs, but a `current === null` guard blocks the second capture.

Net result: `defaultFov.current === 75`, which is the original bug reproduced exactly. The coincidence
that r3f's default fov is also 75 makes this pass a casual glance.

**Change:** hoist the value to a single shared constant instead of trying to read it back off the camera.

- `app/components/core/constants.js` — add `export const DEFAULT_FOV = 85`.
- `AirportScene.jsx:107` — `<PerspectiveCamera makeDefault ... fov={DEFAULT_FOV} />`.
- `CameraController.jsx` — delete the `defaultFov` ref and the capture effect entirely. Import
  `DEFAULT_FOV` and use it directly in the restore effect and as the clamp ceiling in the wheel handler
  at line 19 (`Math.min(camera.fov, DEFAULT_FOV)`), which currently hardcodes 75 as well and would
  otherwise clamp tower zoom-out 10 degrees short of the global fov.

This removes the ordering hazard rather than working around it, and makes the two places that already
disagreed read from one definition.

**Verify:** in the browser console, `__r3f` aside, simply log `camera.fov` from the restore effect. In
GLOBAL view it must read 85. Switch to TOWER, wheel-zoom in and back out (the clamp must stop at 85, not
75), switch back to GLOBAL. Value must be 85 again. Repeat the cycle three times; it must not drift.

---

### 5. Day/night never flips at runtime, and is read during render

**Files:** `app/components/environment/EnvironmentLighting.jsx:20-22`, `app/components/aircraft/LiveAircraft.jsx:217`

`EnvironmentLighting` writes `window.isNightTime`. `LiveAircraft` reads it *during render* with no
subscription, so:
- aircraft strobes and nav lights do not change when the clock crosses the day/night boundary,
- the read is an SSR/hydration hazard (`typeof window !== 'undefined' ? ... : false`).

**Change:** replace the global with a React context. Minimum viable version:
- `app/components/core/TimeOfDayContext.jsx` — a context exporting `isNight` (boolean).
- `EnvironmentLighting` already computes `isDay`; lift that state into the provider and have
  `EnvironmentLighting` consume it rather than own it. Provider mounts in `AirportScene` **outside**
  `<Canvas>` so both the DOM UI and the scene can read it.
- `LiveAircraft:217` — `const isNight = useContext(TimeOfDayContext)`, drop the `window` read.
- Delete the `window.isNightTime` write. It has no other consumers (grep to confirm).

**Verify:** temporarily force the hour to 02:00 in the provider. Nav lights (red/green wingtips) and
strobes must appear without a page reload.

---

### 5b. `EnvironmentLighting` uses `useEffect` without importing it

**Found in review of item 5. This crashes the scene on load.**

**File:** `app/components/environment/EnvironmentLighting.jsx:3,16`

```js
import { useMemo, useContext } from 'react'   // line 3 — useEffect is not here
...
useEffect(() => {                             // line 16
  scene.background = bgColor;
  scene.fog = new THREE.Fog(bgColor, 60, 2000);
}, [scene, bgColor])
```

`useState` and `useEffect` were dropped from the import when the day/night state moved to the context,
but the `scene.background` effect still uses `useEffect`. It is an unresolved binding, so the component
throws `ReferenceError: useEffect is not defined` on first render and takes the whole scene to the
`ErrorBoundary`.

**`npm run build` does not catch this.** `app/page.js:7` imports `AirportScene` with `{ ssr: false }`, so
the module is never executed during static generation. The build reports success and the app is dead in
the browser. Do not treat a green build as evidence that a render-path change works.

**Change:** add `useEffect` back to the import on line 3.

**Verify:** load the page. The scene must render. This is also the strongest argument yet for item 16:
`no-undef` catches this class of error in under a second, and it has now escaped a build twice.

---

### 6. Four different YVR reference origins, and hardcoded degree-to-km factors

**Files:** `app/components/core/constants.js:1-2`, `app/components/core/useWeather.js:8`,
`app/components/tower/TowerMonitors.jsx:33-34,83`, `app/api/adsb/route.js:17`

Two distinct origins are in use: `49.1947 / -123.1839` and `49.1939 / -123.1840`. The radar blips in
`RadarMonitor` and the "closest aircraft" sort in `TargetLockMonitor` are computed against a different
origin than the 3D scene, so the radar and the scene disagree by ~90 m.

Separately, `getPosition` hardcodes `73` km per degree longitude and `111` km per degree latitude. The
correct values at 49.1947°N are `111.32 · cos(49.1947°) = 72.83` and `111.32`. That is a 0.23% and 0.29%
error, roughly 150 m of position error at 50 km range, growing linearly with distance.

**Change:**
- `constants.js` — keep `YVR_LAT` / `YVR_LON` as the single source, and derive the factors:

```js
const KM_PER_DEG_LAT = 111.32
const KM_PER_DEG_LON = 111.32 * Math.cos(YVR_LAT * Math.PI / 180)
```

**Derive it, do not hardcode the result.** A first attempt wrote `KM_PER_DEG_LON = 72.83`. The derived
value at this latitude is **72.7466**, so the literal carries a 0.115% error, about 57 m at 50 km range.
That is better than the original `73` (0.35%, ~175 m) but it is still a magic number that silently goes
wrong if `YVR_LAT` is ever edited. The whole point of the item is to stop hardcoding the factor.

  Use them in `getPosition`. Export both so other modules stop redefining them.
- `useWeather.js`, `TowerMonitors.jsx`, `route.js` — import `YVR_LAT` / `YVR_LON` from `constants.js`.
  `route.js` is server-side; importing a plain const module is fine.

**Verify:** a known fixed point (the ATC tower at 49.1958 / -123.1732) must land within 5 m of its
hand-computed scene position. Radar blips must line up with aircraft when you compare a target's bearing
in TOWER view against its blip angle.

---

### 6b. `TargetLockMonitor` ranks aircraft in raw degree space

**Found while reviewing item 6.**

**File:** `app/components/tower/TowerMonitors.jsx:83-84`

```js
const distA = Math.hypot(a.latitude - YVR_LAT, a.longitude - YVR_LON)
```

Item 6 correctly replaced the duplicated origin here, but the distance itself is still computed by mixing
degrees of latitude and degrees of longitude as if they were the same unit. At 49.1947 N a degree of
longitude spans 72.75 km against 111.32 km for a degree of latitude, so longitude is over-weighted by 53%.
The "PRIMARY TARGET" is frequently not the closest aircraft.

**Change:** scale each axis before the hypot. Both constants are already imported into this file by
item 6:

```js
const distA = Math.hypot(
  (a.latitude - YVR_LAT) * KM_PER_DEG_LAT,
  (a.longitude - YVR_LON) * KM_PER_DEG_LON
)
```

**Verify:** with traffic on both sides of the field, the callsign in `TARGET LOCK` must match the aircraft
that is visually nearest the tower. Construct the check with two aircraft at roughly equal degree offsets,
one north and one east; the northern one is ~1.5x further in km and must not win.

---

### 7. Literal markdown renders as raw characters in the disclaimer

**File:** `app/components/ui/DisclaimerPopup.jsx:51-52`

`**entertainment and visualization purposes only**` and the backticked `` `opendata.adsb.fi` `` are inside
JSX text nodes. They render as literal asterisks and backticks.

**Change:** use `<strong>` and `<code>` elements. Style `<code>` inline to match the panel
(`background: 'rgba(0,255,204,0.1)'`, `padding: '1px 4px'`, `borderRadius: '3px'`).

**Verify:** no `*` or `` ` `` visible in the rendered popup.

---

## P1 — UI

### 8. Persist the disclaimer dismissal

**File:** `app/components/ui/DisclaimerPopup.jsx:8`

`useState(true)` means the modal blocks the scene on every single reload.

**Change:** read `localStorage.getItem('yvr_disclaimer_ack')` in a `useEffect` after mount (not in the
state initializer, to avoid a hydration mismatch), and write `'1'` on dismiss. Default to showing the
modal if the read throws or returns null.

**Verify:** dismiss, reload, modal does not reappear. Clear the key, reload, it does.

---

### 9. Always-on active roster sidebar

**New file:** `app/components/ui/RosterSidebar.jsx`
**Wire in:** `app/components/AirportScene.jsx`

The only flight lists today are inside the Ops panel (`ControlPanel.jsx:131`, which is toggled off by
default) and the in-scene `FlightSearchMonitor`, which is only reachable in TOWER view. There is no
persistent roster.

**Requirements:**
- Absolutely positioned, right edge, below the `TelemetryHUD`'s corner so the two do not collide. The HUD
  sits at `bottom: 24, right: 24`; anchor the roster at `top: 24, right: 24` and cap its height at
  `calc(100vh - 340px)` with `overflowY: 'auto'`.
- Hidden when `showOpsPanel` is true (that panel occupies the same corner).
- Renders `flights` sorted by great-circle distance from the field, ascending. Cap at 40 rows; do not
  render an unbounded list.
- Each row: callsign, then altitude and ground speed in the unit selected by `useMetric`. Import
  `formatAltitude` / `formatSpeed` from `app/components/core/units.js` (created in item 1). Do not write
  new conversion math here.
- `onClick` calls `setSelectedAircraft(flight)`. The existing `CameraController` already handles the
  camera lock; do not add camera code here.
- The selected row gets `color: '#00ffcc'` and `background: 'rgba(0,255,204,0.1)'`.
- Styling matches the existing panels: `rgba(5, 15, 25, 0.75)`, `1px solid rgba(0,255,204,0.3)`,
  `borderRadius: 12px`, `backdropFilter: blur(12px)`, monospace.

**Note on the camera lock:** it is already implemented correctly and imperatively in
`CameraController.jsx:76-108` via `controls.target.lerp()` inside `useFrame`. Do **not** try to drive it
by passing coordinates to the `target` prop of drei's `<OrbitControls>`; that prop is an initial value
only and will not track a moving object.

**Verify:** roster visible on load in both GLOBAL and TOWER mode. Clicking a row selects the aircraft, the
camera eases onto it, and the HUD opens. Toggling IMPERIAL/METRIC changes roster units. Toggling AIRPORT
OPS hides the roster.

---

### 10. Chase-view keybind is undiscoverable

**File:** `app/components/AirportScene.jsx:80`

`C` cycles chase cameras but only once an aircraft is selected, and the hint for it lives inside the
`TelemetryHUD` panel that is *replaced* by the chase-mode hint once you are already in chase mode
(`TelemetryHUD.jsx:23-28`). You cannot discover the key from the default state.

**Change:** in the non-chase branch of `TelemetryHUD` (the `<>` at line 30), add a single muted footer
line below the altitude/speed grid: `PRESS C FOR CHASE CAM · X TO DESELECT`, at `fontSize: '10px'`,
`color: '#666'`, `marginTop: '12px'`, `textAlign: 'center'`. Match the existing casing conventions.

**Verify:** select any aircraft in GLOBAL view, the hint is visible before pressing anything.

---

## P2 — Optimization

Do these in order. Item 11 is the largest single win in the project.

### 11. Strip and compress the model assets

**Directory:** `public/models/` (124 MB, 41 files, all committed to git)

Two compounding problems:

1. `GLTFAircraft.jsx:12-18` traverses every loaded scene and **replaces every material** with
   `new THREE.MeshBasicMaterial({ wireframe: true })`. Every texture, every PBR parameter, every UV set in
   those 124 MB is loaded, decoded, uploaded to the GPU, and then thrown away. Only geometry is ever used.
2. Nothing is Draco or meshopt compressed.

**Change (asset pipeline, not application code):**
- Run every file in `public/models/` through `gltf-transform`:
  `gltf-transform optimize in.glb out.glb --texture-compress false` then explicitly
  `gltf-transform prune`, `dedup`, `weld`, `draco`. Drop all textures, all materials, all animations, all
  morph targets. Keep positions and indices. Normals are not needed for `MeshBasicMaterial` wireframe
  either, but keep them if dropping them complicates the pipeline.
- Add `DRACOLoader` wiring, self-hosted so the app has no CDN dependency.

  Copy the decoder from the installed three package. Verified present at
  `node_modules/three/examples/jsm/libs/draco/gltf/`. Copy **only** the decoder files into `public/draco/`:
  `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`. Skip `draco_encoder.js`; the browser
  never encodes.

  drei's signature is `useGLTF(path, useDraco, useMeshopt, extendLoader)`. Passing `true` uses the gstatic
  CDN. Passing a **string** sets the decoder path (`@react-three/drei/core/Gltf.js:18`). So:

```js
useGLTF(modelPath, '/draco/')
```

  **Gotcha:** `useGLTF.preload` takes the same arguments. The preload calls at `GLTFAircraft.jsx:40-44`
  must pass `'/draco/'` too, or the preloaded entries are configured with a different decoder than the
  live loads.
- `public/models/millennium_falcon.gltf` is 30 MB and is reachable from live traffic: `LiveAircraft.jsx:156`
  matches any callsign containing `FALCON`, which real operators use. Either decimate it hard or gate it
  behind an exact-match easter egg (`flight.callsign === 'FALCON1'`). It should not be a 30 MB download
  triggered by a scheduled flight.

**Three notes for the implementation:**

1. **The CLI cannot strip materials.** `gltf-transform prune` removes only *unreferenced* materials, and
   every primitive still references one, so nothing is dropped. Unassign first, then prune. This is why
   the pass has to be programmatic (`@gltf-transform/core` + `@gltf-transform/functions`) rather than a
   shell loop over `npx @gltf-transform/cli optimize`:

```js
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives())
    prim.setMaterial(null)
await doc.transform(prune(), dedup(), weld(), draco())
```

   `prune()` then collects the now-orphaned materials, textures and the UV/tangent/color attributes that
   only they referenced. Verify `prune`'s attribute options against the installed version rather than
   assuming; the API has moved around.

2. **`draco()` needs `draco3dgltf` installed** as a dev dependency, and `weld()` must run before it.

3. **Do not run `simplify()`.** Everything renders as wireframe (`GLTFAircraft.jsx:15`), so every triangle
   is visible. Mesh decimation that would be invisible on a shaded model changes the silhouette directly
   here. If the high-poly models read as solid cyan blobs at distance, that is a deliberate art decision
   to make separately, not something to fold into a compression pass.

**Target:** 124 MB down to under 10 MB. Confirm visual parity; wireframes should be pixel-identical since
materials were being discarded anyway.

**Verify:** `du -sh public/models` before and after. Load the scene, confirm every aircraft type still
renders. Check the network panel: no single model over 1 MB except the Falcon.

---

### 11b. The Millennium Falcon asset is glTF 1.0 and crashes the app when triggered

**Found in review of item 11.** `public/models/millennium_falcon.gltf` was the one file the optimize
script could not process. It failed with `images is not iterable` and the error was swallowed by the
script's `try/catch`.

The reason: it is a **glTF 1.0** file, not 2.0.

```
asset: {"generator":"OBJ2GLTF","profile":{"api":"WebGL","version":"1.0"},"version":1}
top-level keys: ... programs, shaders, techniques      <- removed in glTF 2.0
meshes / buffers / images are objects keyed by id      <- arrays in glTF 2.0
```

Consequences:

- `@gltf-transform/*` is glTF 2.0 only, so it cannot be compressed. It is still 30 MB, which is **73% of
  everything left in `public/models/`**.
- More seriously, three's `GLTFLoader` rejects it outright:
  `THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.`
  (`node_modules/three/examples/jsm/loaders/GLTFLoader.js:473`). Support for 1.0 was dropped around r112.
- `useGLTF` throws for Suspense, and a thrown **error** is not caught by `<Suspense fallback={null}>`. Any
  callsign containing `FALCON` (`LiveAircraft.jsx:170` uses `.includes`) takes the whole scene to the red
  `ErrorBoundary` screen.

So the easter egg has never worked on this version of three, and it is a live crash path.

**Change:** delete `public/models/millennium_falcon.gltf` and the `FALCON` branch at `LiveAircraft.jsx:170`.
That is 30 MB and one crash path gone. Converting glTF 1.0 to 2.0 is not worth the effort for an easter
egg; if you want it back later, re-export the source model to glTF 2.0 and run it through
`tools/optimize_models.mjs` like everything else.

**Verify:** `du -sh public/models` drops to roughly 11 MB. Grep the app for `FALCON` and `.gltf` and get
no hits.

---

### 12b. The rewritten trail renders nothing

**Found in review of item 12. The trail is currently invisible, so item 12's own acceptance test cannot
pass.**

**File:** `app/components/aircraft/LiveAircraft.jsx` (the `<bufferAttribute>` elements)

```jsx
<bufferAttribute attach="attributes-position" array={trailPositions.current} itemSize={3} />
```

There is no `count`. r3f constructs the object with `new THREE.BufferAttribute()` and then assigns props,
and `THREE.BufferAttribute` only computes `count` **in its constructor**, from `array.length / itemSize`.
Assigning `.array` and `.itemSize` afterwards does not recompute it. Verified against the installed three:

```
after bare ctor       count = 0
after setting props   count = 0     <- what r3f produces here
with ctor args        count = 20    <- correct
```

`WebGLRenderer` then draws `min(drawRange.count, position.count - drawRange.start)` = **0 vertices**,
regardless of `setDrawRange`.

**Change:** pass the array through the constructor so `count` is derived:

```jsx
<bufferAttribute attach="attributes-position" args={[trailPositions.current, 3]} />
<bufferAttribute attach="attributes-color"    args={[trailColorsArr.current, 3]} />
```

`trailPositions.current` is a stable ref, so r3f's shallow `args` compare will not reconstruct it on
re-render. Alternatively add `count={TRAIL_POINTS}` alongside the existing props, which is the pattern
already used at `TowerMonitors.jsx:136` and is why that waveform works.

**Verify:** turn SHOW TRAILS on. Trails must appear within a few seconds. This is the test item 12 was
supposed to pass.

---

### 12c. Two smaller items from the same rewrite

**File:** `app/components/aircraft/LiveAircraft.jsx`

1. **`linewidth` on `lineBasicMaterial` does nothing.** The old drei `<Line>` wrapped `Line2`/
   `LineMaterial`, which implements real line width in a shader. A native `THREE.Line` with
   `LineBasicMaterial` ignores `linewidth` on every desktop WebGL platform; it always renders 1px. So
   `linewidth={isSelected ? 3 : 2}` is dead, and the selected aircraft's trail no longer stands out by
   thickness. Opacity still differentiates it (0.8 vs 0.4). Either accept the thinner look and delete the
   dead prop, or keep drei's `<Line>` **only for the selected aircraft** and the cheap native line for
   the rest. Do not go back to drei's `<Line>` for all of them; that reintroduces item 12.

2. **A `Vector3` is still cloned every frame, for every aircraft, even with trails off.**
   `currentPos = planeRef.current.position.clone()` (and the two other `clone()` calls in the else
   branches) run **before** the `if (!showRoutes) return` guard. At 60 fps with 80 aircraft that is ~4800
   allocations per second, which is the cost item 12 exists to remove.

   `currentPos` is redundant: all three branches have already written the correct value into
   `planeRef.current.position`. Delete the variable and read `planeRef.current.position` directly inside
   the trail block, which is below the guard.

**Verify:** record a 10 s Chrome performance capture with trails **off** and 60+ aircraft tracked. The
allocation sawtooth in the memory track should be materially flatter than before this change.

---

### 12. Trail rendering allocates on a timer instead of writing into a buffer

**File:** `app/components/aircraft/LiveAircraft.jsx:32-33,52-67,125-145,261-263`

Current design, per aircraft:
- a `setInterval(1500ms)` that calls `setState` with a freshly spread 80-element array,
- `validHistory` and `trailColors` `useMemo`s that rebuild two more arrays on every one of those updates,
- a drei `<Line>` whose `points` prop identity changes each time, forcing a new `BufferGeometry`.

At 80 tracked aircraft that is roughly 53 React re-renders per second, each allocating four arrays and a
geometry. It also runs when `showRoutes` is false (`validHistory` and `trailColors` are computed
unconditionally; only the `<Line>` is gated at line 261).

There is also a redundancy: `bufferRef` (10 entries, drives interpolation) and `history` (80 entries,
drives the trail) are two histories of the same positions.

**Change:**
- Delete the `history` state and the 1500 ms interval entirely.
- Preallocate `const trailPositions = useRef(new Float32Array(TRAIL_POINTS * 3))` and a
  `trailColorsArr` of the same length. `TRAIL_POINTS = 20`.
- In the existing `useFrame`, after the position is computed, append the current position to the ring
  buffer at most every N frames (gate on elapsed time, ~200 ms) and set `needsUpdate` on the attributes.
  No React state.
- Replace drei's `<Line>` with a raw `<line>` + `<bufferGeometry>` + `<lineBasicMaterial vertexColors />`
  holding the preallocated attributes, and set `geometry.setDrawRange(0, filledCount)`. drei's `Line`
  wraps `Line2`/`LineMaterial` and rebuilds on every `points` change, which is exactly the cost being
  removed.
- Early-return from the trail update when `showRoutes` is false.

**Keep the altitude gradient.** The blue-to-red HSL mapping at line 142 encodes real information; do not
replace it with flat cyan. But import `SCALE` from `constants.js` instead of the hardcoded
`(p[1] / 10) * 1000` inverse at line 138, which silently breaks if `SCALE` ever changes.

**Verify:** with `showRoutes` on and 60+ aircraft tracked, the React DevTools profiler must show no
`LiveAircraft` re-render caused by trail updates. Trails must look identical. Frame time should drop
measurably; record before/after with the Chrome performance panel over a 10 s capture.

---

### 13. Playback delay and buffer length are oversized

**File:** `app/components/aircraft/LiveAircraft.jsx:46,73`

`renderTime = performance.now() - 6000` renders every aircraft 6 seconds in the past. The upstream poll in
`app/api/adsb/route.js:8` is 2000 ms, so the buffer only needs enough delay to cover one missed update:
~2.5 s is sufficient. Six seconds of lag is visible when you compare a landing aircraft against the
runway threshold.

The 10-entry `bufferRef` cap at line 46 holds 20 s of history at a 2 s cadence, far more than the 6 s
lookback consumes.

**Change:** extract both as named constants at module scope, `PLAYBACK_DELAY_MS = 2500` and
`BUFFER_SIZE = 6`. Do not scatter magic numbers.

**Verify:** aircraft on final approach should touch down visually within ~2.5 s of the data showing them
on the ground, not ~6 s. No stutter or snapping under normal feed conditions.

---

### 14. Runway paint is ~290 individual meshes

**File:** `app/components/environment/RunwayMarkings.jsx`

Measured against `public/yvr_aeroways.json`: 3 runways pass the length filter and emit 203 meshes for
threshold bars, touchdown zone blocks, and centerline dashes, plus roughly 90 more boxes for the
seven-segment runway designators. Every one is a separate `<mesh>` with its own `planeGeometry` and its
own `meshBasicMaterial` instance. All of them are static and coplanar.

**Change:** merge per runway. Build one `BufferGeometry` per runway end using `mergeGeometries`, inside
the existing `useMemo` at line 17 so it runs once.

Import path, verified against the installed `three@0.184.0`:

```js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
```

`three/addons/*` is a documented alias for `three/examples/jsm/*` in three's exports map, and
`transpilePackages` in `next.config.mjs` already covers `three`. Two notes: the function is
`mergeGeometries`, not the pre-r152 `mergeBufferGeometries`, which no longer exists in this version. And
do **not** import from `three-stdlib`; it is present in `node_modules` only as a transitive dependency of
drei and is not declared in `package.json`. Share a
single `meshBasicMaterial` across all of them (the markings only differ in opacity: 0.7 / 0.6 / 0.5 — pick
one value, or split into three shared materials, not 290).

**Verify:** `renderer.info.render.calls` in the console before and after, in GLOBAL view looking at the
field. Expect a drop of ~280 draw calls. Markings must look unchanged.

---

### 15. Aircraft materials are allocated per mesh and never disposed

**File:** `app/components/aircraft/GLTFAircraft.jsx:12-18`

The material swap runs in a `useEffect` against the **shared cached scene** returned by `useGLTF`, guarded
by `child.userData.hasEdges`. Two consequences:
- because it is `useEffect` and `<Clone>` happens during render, the first instance of each type paints one
  frame with the original PBR materials before the swap lands,
- one `MeshBasicMaterial` is allocated per mesh per model and never disposed.

**Change:** move the swap to `useLayoutEffect` and hoist a single shared module-scope material:

```js
const WIREFRAME_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#00ffcc', wireframe: true, transparent: true, opacity: 0.5
})
```

Assign that same instance to every mesh. There is no per-instance variation today, so a shared material is
correct and removes the leak.

**Verify:** no visible one-frame material flash when a new aircraft type appears. `renderer.info.memory`
material count should stay flat as aircraft come and go.

---

### 16. Remove the dead production dependency

**File:** `package.json`

`jsdom@29.1.1` is a dependency but is imported nowhere under `app/` (confirmed by grep). It is used only by
root-level scratch scripts.

**Change:** `npm uninstall jsdom`. Also drop `"lint": "next lint"`, which no longer does anything in
Next 16, and add a flat ESLint config (`eslint.config.mjs`) with `eslint-config-next` plus
`eslint-plugin-react-hooks`. The hooks rules will flag several real issues in the files above.

**REVISED after review: the first config does not catch the bug this item exists for.**

A config containing only `react-hooks` rules leaves `no-undef` **off**. Verified empirically with a probe
file containing an unimported `useEffect` and a bare `totallyUndefinedThing`: `npx eslint` reported
nothing. That is exactly the class of error from item 5b, which already escaped a green build.

`no-undef` lives in `@eslint/js`'s recommended set, and enabling it requires declaring browser and node
globals or every `window`, `localStorage`, `console` and `setInterval` in the codebase reports as
undefined. Install `@eslint/js` and `globals`, then:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import babelParser from '@babel/eslint-parser'

export default [
  { ignores: ['.next/', 'node_modules/', 'tools/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      parser: babelParser,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ['@babel/preset-react'] },
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
```

`eslint-config-next` and `@eslint/eslintrc` were installed but never referenced by the config. Either wire
`eslint-config-next` in or uninstall both.

**Acceptance test for this item, not just "eslint runs":** create a scratch file that uses a hook it does
not import, run `npx eslint` on it, and confirm a `no-undef` **error**. Delete the file. If that does not
error, this item is not done.

**Scope control:** `eslint-plugin-react-hooks` will flag pre-existing issues in files this work order
does not touch. Do not fix those. Land the config, record the baseline count, and fix only violations in
files being changed by another numbered item. A rule that is noisy across the whole tree and not worth
fixing now should be downgraded to `warn` rather than silenced per-line.

**Verify:** `npm run build` still succeeds. `npx eslint app/` runs and reports. Record the violation count
so later items can be checked against it.

---

## P3 — Aircraft model coverage

### 17. An unmatched ICAO type ignores category and falls straight to the 777

This is the actual cause of what you are seeing, and it is a logic bug, not missing assets.

**Files:** `app/components/core/FlightManager.jsx:54-66`, `app/components/aircraft/LiveAircraft.jsx:153-209`

`FlightManager` sets `inferredType = ac.t`, and **only** falls back to the ADS-B emitter category
(`A1`-`A7`) when `ac.t` is absent entirely. So when the feed *does* supply a type that the `modelPath`
chain happens not to match, the category-derived fallbacks at `LiveAircraft.jsx:202-206` are unreachable
and the aircraft gets `/b777_final.glb`.

Concrete result: an Air Canada A220-300 broadcasts `t: "A223"` with `category: "A3"`. `A223` matches no
branch, `flight.type` is `"A223"` not `"LARGE JET"`, so it renders as a 777.

**Change:** restructure `modelPath` into three explicit tiers, in order:

1. exact/prefix ICAO type match (the existing chain, unchanged),
2. **category fallback** using `flight.category` directly, not the human-readable string:
   `A1 → pa28`, `A2 → q400`, `A3 → b738`, `A4 → b763`, `A5 → b773`, `A6 → citation`, `A7 → heli`,
3. `/b777_final.glb` as the final default.

Keep the existing `LIGHT AIRCRAFT` / `HEAVY JET` string branches; they still fire when `ac.t` is missing.

**Verify:** add a temporary `console.warn` in tier 3 logging `flight.type` and `flight.category`. Run for
10 minutes of live traffic. Tier 3 should fire for essentially nothing. Collect the warnings; they are
your real gap list.

---

### 18. Close the known type gaps by aliasing, before downloading anything

Several common YVR types match nothing today. Most need **zero new assets**, just an alias to a model
already in `public/models/`. Do this before sourcing new geometry.

| Missing ICAO | Aircraft | Map to (already present) |
|---|---|---|
| `A19N` | A319neo | `a319.glb` |
| `A20N` | A320neo | `a320.glb` |
| `A21N` | A321neo | `a321.glb` |
| `A221` | A220-100 | `cs100.glb` |
| `A223` | A220-300 | `cs300.glb` |
| `B37M` | 737 MAX 7 | `b736.glb` |
| `E290` / `E295` | E190-E2 / E195-E2 | `e190.glb` |
| `B350` | King Air 350 | `atr42.glb` |
| `CL30` / `CL35` / `CL60` / `GLEX` / `GL7T` | Bombardier bizjets | `citation.glb` |
| `PC12` | Pilatus PC-12 | `pa28.glb` |
| `S76` / `B06` / `AS50` / `EC30` | helicopters | `heli.glb` |

All of the above were confirmed by replaying the current `modelPath` chain against each code: every one
returns `/b777_final.glb` today. Verified as **already handled**, do not touch: `BE20`, `H125`, `C208`,
`B38M`, `B39M`, `A339`, `A35K`, `E75L`, `DH8A`, `B78X`, `C172`, `GLF6`, `CRJ9`.

Note on `B37M`: it looks like it should be caught by the `t.startsWith('B73')` branch at line 173, but
`B37M` starts with `B37`, not `B73`. It is not caught. The 737 MAX 8 (`B38M`) and MAX 9 (`B39M`) are
caught, which is why this one is easy to miss.

Note on helicopters: `S76` / `B06` / `AS50` / `EC30` are only a problem when the feed omits
`category: "A7"`. With the category present, the check at `LiveAircraft.jsx:157` already routes them to
`heli.glb`. Item 17's category tier makes this robust either way; the aliases are belt-and-braces.

Note the `A220` entries specifically: the existing `BCS1` / `BCS3` branches at `LiveAircraft.jsx:191-192`
use the **retired** ICAO designators. Real feeds emit `A221` / `A223`. Keep both.

Also check the ordering hazard at line 194: `t.startsWith('C20')` routes `C208` (Cessna Caravan, a common
turboprop) to `pa28.glb`, a light piston single. Move `C208` to `q400.glb` or leave it, but decide
deliberately rather than by accident of prefix ordering.

**Regression found in review of the first attempt.** `C208` was correctly moved to the `q400.glb` branch,
but `t.startsWith('C20')` was *deleted* from the `pa28.glb` branch at the same time. That prefix also
covered `C205` / `C206` / `C207`, which now fall through to the `t.startsWith('C2')` branch and render as
a Cessna Citation business jet. The 206 and 207 are common light singles in BC.

Fix: restore `t.startsWith('C20')` to the `pa28.glb` branch. The `C208` line sits earlier, so the Caravan
still wins and the rest go back to the light single.

Separately, and pre-existing rather than a regression: `C210` (Cessna 210, another light single) has always
routed to `citation.glb`, because it matches neither `C1` nor `C20`. Fix it or leave it, but it is not
caused by this item.

**Verify:** the tier-3 warning from item 17 stops firing for any of the types above.

### 19. Only then, source new models

If item 17 and 18 leave real gaps, the shortlist worth adding as actual geometry is whatever the tier-3
log surfaces, ranked by frequency. Do not bulk-download 40 more models. Every model added:
- must go through the item 11 pipeline (strip materials, Draco) before it is committed,
- must be under 1 MB after compression,
- must be added to the `useGLTF.preload` list in `GLTFAircraft.jsx:40-44` **only** if it is in the top few
  by traffic share. Preloading everything defeats lazy loading.

---

### 14b. The runway designators changed colour

**Found in review of item 14.** The merge is correct, but one shared material was used where the original
had two distinct looks.

Original (`RunwayMarkings.jsx`, pre-merge):

```
threshold bars / TDZ / centrelines   #ffffff, transparent, opacity 0.7 / 0.6 / 0.5
runway designator text               #00ffcc, OPAQUE   (SevenSegmentChar default colour)
```

Now everything shares `#ffffff` at opacity 0.6, so `08L` / `26R` went from solid cyan to translucent
white. Consolidating the three white opacities was the intent of item 14; changing the text colour was not.

**Change:** use two shared materials instead of one, and split each end's merge into a markings geometry
and a text geometry. That is 4 meshes per runway rather than 2, so 12 total instead of 6. Against the ~290
you started from, the difference is irrelevant, and the scene keeps its look.

**Verify:** the runway numbers read cyan and opaque again, matching the taxiway and coastline accents.

---

## Repo hygiene (do last, one commit)

Not behavioral, but it is making the tree hard to read.

- ~50 one-off scratch scripts tracked at the root: `fetch_*.py`, `fetch_*.js`, `trace_*.py`, `merge_*.py`,
  `filter_*.py`, `generate_*.py`, `test_*.js`, `test_*.py`, `handcraft_coastlines.py`, `recover.py`,
  `offset_test.js`, `check_glb.js`, `grab_logs.js`, `search_tower.js`, `get_old_scene.js`,
  `get_real_atc.py`, `verify_coords.py`, `inspect_lines.py`, `raise_lowlands.py`, `bake_airport.mjs`.
  Move to `tools/` and keep, or delete. They are asset-generation history, not application code.
- `out1.json` is 0 bytes. `out2.json` is scratch output. Delete both.
- `stitched_map.png` (3.4 MB), `land_mask.png`, `water_mask.png` are inputs to the coastline tracing
  scripts, not runtime assets. Move to `tools/` or drop.
- `tiles_cache/` (82 entries) is a download cache. Delete and add to `.gitignore`.
- `public/airplane.glb`, `public/airplane.gltf`, `public/airplane_v2.glb` are superseded by
  `public/models/`. `public/b77w.glb` is 14 bytes. All four are unreferenced. Delete.
- `.DS_Store` files were committed in `app/` and `app/components/` before `.gitignore` existed.
  `git rm --cached` them.
- No README. Add one: what the project is, how to run it, where the data comes from, and the scene-unit
  invariant from the top of this document.

---

## Suggested order

1. Items 1, 2, 3, 3b, 4, 7 — small, isolated, immediately visible. One commit each. Item 3b must land
   after item 3, since item 3 is what makes the dangling-selection half of it reachable.
2. Item 17 and 18 — fixes the 777 problem, touches two files, no new assets.
3. Item 11 — the asset pipeline. Largest win, and it is independent of all application code.
4. Items 12, 13, 15 — the aircraft render path. Do 12 and 13 together, they touch the same file.
5. Items 5, 6 — these touch multiple files and are worth doing while the codebase is otherwise quiet.
6. Items 8, 9, 10 — UI.
7. Items 14, 16, hygiene.

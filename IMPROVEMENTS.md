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

### 12d. Trails vanish at some angles, are 30x too short, and render 1px

**Reported from live testing: trails disappear at certain angles and zooms, and the altitude profile reads
as sharp dips rather than a smooth arc. Three separate causes.**

**File:** `app/components/aircraft/LiveAircraft.jsx`

**Cause 1 — stale bounding sphere, so the line gets frustum-culled.** Nothing calls
`computeBoundingSphere()` and `frustumCulled` is never set (confirmed: zero occurrences of either in the
file). `Frustum.intersectsObject` computes the bounding sphere **only when it is `null`**, then caches it
forever (`three/src/math/Frustum.js`). Setting `attributes.position.needsUpdate = true` does not
invalidate it. So the sphere is computed once, from a `Float32Array` that is still almost all zeros, and
ends up as a tiny sphere near the world origin. As the aircraft flies away, the real trail leaves that
sphere and the line is culled whenever the camera frustum misses the origin. That is the
disappears-at-certain-angles symptom exactly.

**Cause 2 — the trail is 4 seconds long instead of 2 minutes.**

```
old:  80 points x 1500 ms  = 120 s of history
new:  20 points x  200 ms  =   4 s of history
```

30x shorter. Worse, 200 ms sampling resolves the piecewise-linear interpolation *between* feed samples, so
every slope change at a feed boundary shows up as a visible kink. The old 1500 ms interval was close to
the feed interval, so it captured roughly one point per data point and read as a smooth track. Those are
the "sharp dips".

A related pre-existing contributor: in the extrapolation branch, only x and z advance. `y` is held flat
until the next feed sample lands, then steps. That stair-steps altitude independently of sampling rate.

**Cause 3 — 1px lines.** Covered in item 12c. `LineBasicMaterial` ignores `linewidth`; native GL lines
rasterize inconsistently and thin out or drop out at grazing angles. drei's `<Line>` wrapped
`Line2`/`LineMaterial`, which draws screen-space-width quads and is always solid. This is the part that
reads as "the old one looked better".

**Two ways forward. The perf win from item 12 came from removing the React re-renders, not from switching
to native lines, so the old look and the new cost are not in conflict.**

*Option C (cheap, do this first to confirm the diagnosis):* keep native lines, three changes.
- add `frustumCulled={false}` to the `<line>`,
- `TRAIL_POINTS = 80`,
- raise the sample interval from `200` to `1500` ms.

That fixes causes 1 and 2 and leaves the 1px width. Ten minutes of work, and it isolates whether the
width is the remaining complaint.

*Option B (if the width still reads wrong):* render with drei's `<Line>` again but drive it
**imperatively**. Pass a static initial `points` prop, take a ref to the underlying `Line2`, and call
`ref.current.geometry.setPositions(...)` / `.setColors(...)` from the existing `useFrame` when a point is
added. No `points` prop churn, so no React re-render and no per-update geometry rebuild — the item 12 win
is kept. Use drei's `<Line>` rather than raw `Line2` because `LineMaterial` needs its `resolution`
uniform kept in sync with canvas size, and drei does that for you. Sample at ~1500 ms, since
`setPositions` does reallocate the instanced attributes on each call.

**Verify:** fly the camera to a far corner of the scene with SHOW TRAILS on. Every visible aircraft keeps
its trail at every angle and zoom. A climbing aircraft's trail reads as a smooth arc over roughly two
minutes of track, not a 4-second stub with visible corners.

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

## New feature

### 20. Named camera views with a UI selector, plus cockpit and tail cams

**This is a feature, not a fix.** Scope agreed: add **cockpit** and **tail** to the existing set, place
them from the aircraft's real bounding box, give every view a labelled button, and allow free look in
cockpit only.

**Files:** `app/components/camera/CameraController.jsx`, `app/components/aircraft/GLTFAircraft.jsx`,
`app/components/aircraft/LiveAircraft.jsx`, `app/components/ui/TelemetryHUD.jsx`,
`app/components/AirportScene.jsx`, plus a new `app/components/camera/views.js`.

#### 20.1 Replace the magic indices with a view table

`chaseViewIndex` is currently a bare number checked with `if (chaseViewIndex === 1) ... === 2 ...` at
`CameraController.jsx:90-93`. With seven views that does not hold up, and the UI needs labels anyway.

Create `app/components/camera/views.js` exporting one ordered array. Offsets stay in scene units
(1 unit = 100 m) and are applied with `offset.applyQuaternion(aircraftRef.quaternion)` exactly as today:

| index | id | label | placement | look direction |
|---|---|---|---|---|
| 0 | `FOLLOW` | FOLLOW | orbit, `controls.target` locked to aircraft | user controlled |
| 1 | `CHASE` | CHASE | `(0, 0.4, 1.2)` | at aircraft |
| 2 | `WING_L` | WING L | `(-1.0, 0.2, 0)` | at aircraft |
| 3 | `WING_R` | WING R | `(1.0, 0.2, 0)` | at aircraft |
| 4 | `LEAD` | LEAD | `(0, 0.1, -1.2)` | at aircraft |
| 5 | `COCKPIT` | COCKPIT | size-aware, see 20.3 | **forward along aircraft** |
| 6 | `TAIL` | TAIL | size-aware, see 20.3 | **forward along aircraft** |

Index 0 stays `FOLLOW` so the existing `setChaseViewIndex(0)` reset on selection keeps working unchanged.
The `C` key cycles `(prev + 1) % views.length` instead of the hardcoded `% 5` at `AirportScene.jsx:90`.

#### 20.2 Expose the aircraft bounding box

`GLTFAircraft.jsx:24-31` already computes a `Box3` and stores it in local state as `metrics`. Nothing
upstream can see it.

- `GLTFAircraft` takes a new `onMetrics` callback and calls it once from the existing `useLayoutEffect`,
  alongside `setMetrics`. Do not add a second `Box3` pass.
- `LiveAircraft` passes
  `onMetrics={(m) => { if (planeRef.current) planeRef.current.userData.metrics = m }}`.
  `window.aircraftRefs[flight.id]` **is** `planeRef.current`, so `CameraController` reads it straight off
  `aircraftRef.userData.metrics` with no context and no prop drilling.
- **Multiply by the render scale.** `metrics` are in the model's own units; `LiveAircraft:239` renders
  with `scale={0.01}`. Store already-scaled values so `CameraController` never has to know the scale:

```js
onMetrics={(m) => {
  if (!planeRef.current) return
  const s = 0.01                       // must match the scale prop below
  planeRef.current.userData.metrics = {
    noseZ: m.minZ * s,                 // forward end, most negative Z
    tailZ: m.maxZ * s,
    lengthZ: (m.maxZ - m.minZ) * s,
    heightY: (m.maxY - m.minY) * s,
  }
}}
```

#### 20.3 Cockpit and tail placement

Forward is **-Z** in both model and world space: `planeRef.current.rotation.y = -heading`, and the
extrapolation at `LiveAircraft.jsx:95-97` advances by `sin(heading)` in x and `-cos(heading)` in z. The
existing `AircraftLights` agrees, putting the tail near `maxZ`.

- **COCKPIT:** `offset.set(0, heightY * 0.55, noseZ - lengthZ * 0.02)`. Placing it a fraction *ahead* of
  the nose rather than exactly at it keeps the camera outside the fuselage, so the aircraft's own
  wireframe does not fill the view. This is deliberately chosen over plumbing `isSelected` into
  `GLTFAircraft` to hide the mesh — same visual result, no new plumbing.
- **TAIL:** `offset.set(0, heightY * 1.1, tailZ)`. Mounted above the fin looking forward over the
  fuselage, like an airliner tail camera. Note this is the "camera on the tail looking forward" reading,
  not "camera behind looking at the tail" — `CHASE` already covers the latter.

**Both look forward, not at the aircraft.** Every fixed view today ends with
`lookAt(camera.position, planePos, camera.up)` (`CameraController.jsx:100-103`). That is wrong for these
two. Give each view entry a `lookAt` field of `'aircraft'` or `'forward'`; for `'forward'`, aim at
`planePos + forwardVector`, where `forwardVector` is `(0, 0, -1)` run through `aircraftRef.quaternion`.

**Verification risk worth checking early:** this assumes all 40 GLBs were authored nose-toward--Z. They
came from different sources and that is not guaranteed. Spot-check at least `b738`, `q400`, `pa28` and
`heli` before tuning any offsets — a model authored backwards gives a cockpit view that looks out of the
tail.

#### 20.4 Free look in cockpit only

Everything except `COCKPIT` keeps `controls.enabled = false` and stays a fixed cinematic shot.

For `COCKPIT`, do **not** try to reuse `OrbitControls`. Orbiting moves the camera, which this code then
re-pins every frame, so the two fight. Add a small pointer-drag handler on `gl.domElement` that
accumulates `yawOffset` / `pitchOffset` in refs and composes them onto the aircraft-relative orientation:

- pointerdown / pointermove / pointerup, active only while the view is `COCKPIT`,
- clamp pitch to roughly `+/- 70` degrees,
- reset both offsets to 0 whenever the view or the selected aircraft changes,
- register and tear down in a `useEffect` keyed on the view id, next to the existing wheel handler at
  `CameraController.jsx:14-26`.

Roughly 25 lines. It is the only genuinely new mechanism in this item.

#### 20.5 The HUD

`TelemetryHUD.jsx:24-28` currently **replaces** the entire telemetry panel with a "CINEMATIC CHASE MODE"
placeholder whenever `chaseViewIndex > 0`. That removes altitude and ground speed at exactly the moment
you are flying with the aircraft.

- Delete that branch. Telemetry is always visible.
- Add a row of view buttons above the altitude/speed grid, labelled from the view table, styled like the
  existing segmented controls at `ControlPanel.jsx:46-59` (active `#00ffcc` on `#000`, inactive `#888`).
  Seven buttons will not fit in one row at 360 px, so wrap to two rows or shorten the labels.
- Keep the `PRESS C FOR CHASE CAM · X TO DESELECT` footer from item 10.
- `AirportScene` passes `chaseViewIndex` and `setChaseViewIndex` down; it already owns both.

**Verify:**
- Every view is reachable by button and by cycling `C`, and the two stay in sync.
- COCKPIT on a 777 and on a PA28 both sit just ahead of the nose looking forward. This is the test that
  proves 20.2 worked; a fixed offset fails one of the two.
- TAIL looks forward over the fuselage, with the aircraft visible below the camera.
- Dragging in COCKPIT swings the view and does not move the camera off the nose. Switching view or
  aircraft resets the look direction to straight ahead.
- Telemetry stays visible and live in every view.

---

## Review of the showcase / roster / camera batch

### 21. `AircraftShowcase` permanently replaces live aircraft materials

**P0. Visiting the showcase turns live aircraft chrome-white until a page reload.**

**File:** `app/components/aircraft/AircraftShowcase.jsx:30-40`

`ModelViewer` traverses the scene returned by `useGLTF` and assigns a brand new
`MeshStandardMaterial` to every mesh, in the render body, with no guard and no restore:

```js
scene.traverse(child => {
  if (child.isMesh) {
    child.material = new THREE.MeshStandardMaterial({ color: '#eef7ff', ... })
  }
})
```

`useGLTF` caches by path **globally**. That is the same object `GLTFAircraft` mutates, and its guard is:

```js
if (child.isMesh && !child.userData.hasEdges) {     // GLTFAircraft.jsx:18
  child.material = WIREFRAME_MATERIAL
  child.userData.hasEdges = true
}
```

The showcase never touches `hasEdges`, so once it is set the wireframe assignment is skipped forever.

It compounds: `AirportScene.jsx:122-143` renders the showcase **instead of** the main scene, so leaving
the showcase remounts `FlightManager` and every `LiveAircraft`. Each `GLTFAircraft` re-runs the traverse,
hits the stale `hasEdges`, and keeps the chrome material. drei's `<Clone>` copies `material` by reference
(`drei/core/Clone.js:19`, only deep-cloned when `deep` is set, which it is not), so the clones pick it up
too.

**All 14 showcase models are also live-scene models** (`a320 a333 a343 a359 a380 b738 b744 b763 b773
b789 q400 crj900 e190 citation`). Page through the showcase and the corresponding traffic comes back
chrome.

**Change:** do not mutate the cached scene. Clone once and mutate the clone, with one shared material:

```js
const SHOWCASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#eef7ff', roughness: 0.3, metalness: 0.8, envMapIntensity: 1.5,
})

const showcaseScene = useMemo(() => {
  const s = scene.clone(true)
  let maxDim = 0
  const box = new THREE.Box3().setFromObject(s)
  const size = new THREE.Vector3(); box.getSize(size)
  maxDim = Math.max(size.x, size.y, size.z)
  s.traverse(c => { if (c.isMesh) c.material = SHOWCASE_MATERIAL })
  return { scene: s, scale: 5 / maxDim }
}, [scene])
```

`Object3D.clone()` creates new `Mesh` instances sharing geometry, so assigning `material` on the clone
does not reach the cache. Render `<primitive object={showcaseScene.scene} />`.

This also fixes two smaller things in the same block: a `MeshStandardMaterial` was allocated **per mesh
per render** and never disposed (the item 15 bug, reintroduced), and `new THREE.Box3().setFromObject(scene)`
at line 24 ran a full scene traversal on every render.

**Verify:** note the callsign of a live A320 or 738. Enter the showcase, page to that type, exit. Every
aircraft of that type must still be cyan wireframe. Today they are chrome.

---

### 22. `<Environment preset="city" />` pulls an HDRI from a CDN

**File:** `app/components/aircraft/AircraftShowcase.jsx:62`

drei's `Environment` with a `preset` fetches the HDRI from `raw.githack.com/pmndrs/drei-assets`. That is
an external network dependency, which contradicts the deliberate decision in item 11 to self-host the
Draco decoder, and it will simply fail offline.

**Change:** drop it. The two spotlights at lines 60-61 already light the model, and `envMapIntensity` on a
material with no env map does nothing. If the reflections are wanted, self-host one `.hdr` in `public/`
and pass `files=`.

**Verify:** open the showcase with devtools Network throttled to offline. It must render.

---

### 23. Free look is active in every fixed view, not just cockpit

**Files:** `app/components/camera/CameraController.jsx` (pointer handler and the `yaw`/`pitch` application)

Agreed scope for item 20.4 was cockpit-only. The pointer handler gates on `chaseViewIndex > 0`, and the
`yaw` / `pitch` offsets are applied in **both** the `'forward'` and `'aircraft'` branches, so CHASE,
WING L, WING R and LEAD are draggable too.

The HUD disagrees with the code: `TelemetryHUD.jsx:107` shows `DRAG TO LOOK AROUND` only when the view is
`COCKPIT`. So four views respond to a drag that nothing tells the user about.

**Change:** pick one and make both agree. Gate on
`CAMERA_VIEWS[chaseViewIndex]?.id === 'COCKPIT'` in the handler and around the euler offsets, or keep it
everywhere and show the hint for every fixed view. Cockpit-only was the agreed scope.

---

### 24. Cockpit and tail are only half size-aware

**File:** `app/components/camera/CameraController.jsx:136-146`

```js
offset.set(0, 0.05, metrics.minZ - 0.02)               // COCKPIT
offset.set(0, metrics.maxY + 0.1, metrics.maxZ + 0.1)  // TAIL
```

The Z terms use the bounding box, which is the point of item 20.2. The rest are fixed: cockpit sits a
flat `0.05` units (**5 m**) above the aircraft origin regardless of type, and tail pads by `0.1` units
(**10 m**) above and behind the fin. On a 777 those read fine. On a PA28 the cockpit floats about 10 m
above a 2.5 m aeroplane, and the tail cam is 10 m back, which is a chase shot.

That is exactly the acceptance test for 20.2 and it currently fails: *cockpit on a 777 and on a PA28 must
both sit just ahead of the nose.*

**Change:** make the remaining terms proportional, e.g.
`offset.set(0, (metrics.maxY - metrics.minY) * 0.55, metrics.minZ - lengthZ * 0.02)` for cockpit and a
`lengthZ * 0.05` pad for tail, where `lengthZ = metrics.maxZ - metrics.minZ`.

**Also:** when `metrics` is undefined (model still loading), `offset` stays `(0,0,0)` and the camera sits
inside the aircraft at its origin. Fall back to the CHASE offset until metrics arrive.

---

### 24b. The cockpit and tail Y offsets are in the wrong coordinate space

**Found reviewing the item 24 fix. The Z terms are right; Y is computed in model space and used in
aircraft space.**

**File:** `app/components/camera/CameraController.jsx:141,144`

```js
offset.set(0, metrics.minY + height * 0.45, metrics.minZ - length * 0.05)   // COCKPIT
offset.set(0, metrics.maxY + height * 0.5,  metrics.maxZ + length * 0.2)    // TAIL
```

`offset` is relative to `planeRef`. But `GLTFAircraft` does not render the model at its raw box position
(`GLTFAircraft.jsx:44-46`):

```jsx
<group scale={scale} position={[0, -0.05, 0]}>
  <group position={[0, -metrics.minY, 0]}>     // raw minY, inside the scaled group
```

So a model point at local `Y` lands at `(Y - minY_raw) * scale - 0.05` in `planeRef` space. The model's
**bottom is always at -0.05**, never at `metrics.minY`. The `-minY` shift and the `-0.05` drop are both
unaccounted for, so the camera is displaced by exactly `metrics.minY + 0.05`.

Z is fine because the inner group only shifts Y, so `metrics.minZ` is genuinely the nose in `planeRef`
space.

Measured against the actual GLBs (positions read with `@gltf-transform`, `scale = 0.01`):

```
        minY      height    cockpit y now   should be   error
b773   -0.2107    0.4210      -0.0213        0.1394     -16.1 m
pa28   -0.0527    0.1368       0.0089        0.0116      -0.3 m
a320   -0.0106    0.1191       0.0430        0.0036      +3.9 m
q400   -0.0179    0.1007       0.0274       -0.0047      +3.2 m
```

The sign and magnitude vary per model because each GLB was authored with a different origin. On the 777
the cockpit sits 16 m below where it should, which is under the fuselage. That is the same
per-model-variation problem item 20.2 existed to remove, just moved from Z to Y.

**Why it happened:** `AircraftLights` legitimately uses `metrics.minY + height * f`, because it renders
*inside* the `-minY` group, in model space. Copying that idiom into `CameraController`, which works in
`planeRef` space, is the bug.

**Change:** drop `metrics.minY` / `metrics.maxY` from the Y terms and measure from the known rendered
bottom instead:

```js
offset.set(0, -0.05 + height * 0.45, metrics.minZ - length * 0.05)   // COCKPIT
offset.set(0, -0.05 + height * 1.5,  metrics.maxZ + length * 0.2)    // TAIL
```

The `-0.05` is the `position` prop passed to `GLTFAircraft` at `LiveAircraft.jsx:241`. Import it from a
shared constant rather than duplicating the literal in two files.

**Verify:** COCKPIT on a b773 and on a pa28 must both sit just above the nose looking forward. This is the
item 20.2 acceptance test and it currently fails on the 777.

---

### 24c. Dead `Environment` import

**File:** `app/components/aircraft/AircraftShowcase.jsx:5`

The `<Environment preset="city" />` element was removed for item 22, but `Environment` is still imported
from `@react-three/drei`. `npx eslint app/` reports it:

```
5:40  warning  'Environment' is defined but never used  no-unused-vars
```

Drop it from the import list. One line.

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

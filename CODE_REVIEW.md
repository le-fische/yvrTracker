# yvrTracker — Codebase Analysis

**Reviewed:** 2026-07-27
**Scope:** `app/` (1,869 LOC across 23 files), `app/api/adsb/route.js`, `public/` (132 MB), repo root
**Stack:** Next.js 16.2.7 (App Router) · React 19.2.7 · three 0.184.0 · @react-three/fiber 9.6.1 · drei 10.7.7

---

## 0. Snapshot

The application core is sound: the SSE fan-out design is the right call for a shared upstream feed, the
client-side playback buffer with a fixed render delay is a legitimate netcode pattern, and the component
decomposition (`core` / `aircraft` / `environment` / `tower` / `ui` / `camera`) is clean.

The problems fall into four buckets, roughly in order of impact:

| # | Area | Severity | Summary |
|---|------|----------|---------|
| 1 | Unit correctness | **High** | Displayed altitude/speed are wrong by 3.28× / 1.94×; three different YVR origins; `\|\|` fallbacks swallow legitimate zero values |
| 2 | Asset weight | **High** | 132 MB of models in `public/`, one 30 MB asset reachable from live traffic; no LOD, no compression |
| 3 | Scene/render cost | **Medium** | ~500 individual meshes for runway paint; per-aircraft `setInterval` + `useFrame` + DOM overlay |
| 4 | Repo hygiene | **Medium** | No git, no `.gitignore`, no lint config, no README; ~50 scratch scripts and 1.3 MB of tile cache in the project root |

---

## 1. Correctness — unit and coordinate bugs

### 1.1 `TargetLockMonitor` displays metric values with imperial labels

`FlightManager.jsx` normalises everything to SI at ingest:

```js
let parsedAltitude = Math.max(0, parseFloat(altFeet) * 0.3048)   // → metres
let parsedVelocity = parseFloat(speedKnots) * 0.514444           // → m/s
```

`TowerMonitors.jsx` then renders those SI values with imperial units:

```js
<Text ...>{Math.round(closest.altitude)} ft</Text>    // metres labelled "ft"  → 3.28× low
<Text ...>{Math.round(closest.velocity)} kts</Text>   // m/s labelled "kts"    → 1.94× low
```

A 777 at FL350 / 480 kt shows as `10668 ft` / `247 kts`. `TelemetryHUD.jsx` and `LiveAircraft.jsx` both
convert correctly — only the tower monitor is wrong.

**Fix** — apply the same conversion the HUD uses:

```js
// app/components/tower/TowerMonitors.jsx — inside TargetLockMonitor
<Text position={[-0.004, -0.001, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">
  {Math.round(closest.altitude * 3.28084)} ft
</Text>
...
<Text position={[0.001, -0.001, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">
  {Math.round(closest.velocity * 1.94384)} kts
</Text>
```

Better still: move the conversions into a single `app/components/core/units.js` module
(`metresToFeet`, `mpsToKnots`, `mpsToKmh`) and import it everywhere, so the ratios exist once.

### 1.2 Three different YVR reference coordinates

| Location | Latitude | Longitude |
|---|---|---|
| `core/constants.js` | 49.1947 | −123.1839 |
| `core/useWeather.js` | 49.1939 | −123.1840 |
| `tower/TowerMonitors.jsx` (`RadarMonitor`, hardcoded) | 49.1939 | −123.1840 |
| `tower/TowerMonitors.jsx` (`TargetLockMonitor`, inline literals) | 49.1939 | −123.1840 |
| `api/adsb/route.js` (URL) | 49.1947 | −123.1839 |

The 0.0008° latitude delta is ~89 m — enough to visibly bias the tower radar blips against the 3D scene.
Export a single `YVR = { lat, lon }` from `constants.js` and import it in all five places, including
building the ADS-B URL from it.

### 1.3 Longitude scale factor is a hardcoded approximation

```js
// core/constants.js
const x = (lon - YVR_LON) * 73 * SCALE
const z = -(lat - YVR_LAT) * 111 * SCALE
```

The correct values at 49.1947° N are **72.7466** km/° longitude (`111.32 · cos φ`) and **111.132** km/°
latitude. The 73 figure carries a 0.35 % error — ~175 m at the 50 NM feed radius, and it grows linearly
outward. Derive it instead of hardcoding:

```js
// app/components/core/constants.js
export const YVR_LAT = 49.1947
export const YVR_LON = -123.1839

/** World units per kilometre. 1 unit = 100 m. */
export const SCALE = 10

/** Kilometres per degree, WGS-84 local approximation at the YVR reference latitude. */
const KM_PER_DEG_LAT = 111.132
const KM_PER_DEG_LON = 111.320 * Math.cos((YVR_LAT * Math.PI) / 180) // 72.7466

/**
 * Equirectangular projection of a WGS-84 coordinate into scene space.
 * Accurate to well under a metre across the ~90 km feed radius.
 * @param {number} lat  degrees north
 * @param {number} lon  degrees east
 * @param {number} altitude  metres above mean sea level
 * @returns {[number, number, number]} [x, y, z] in world units (1 unit = 100 m)
 */
export function getPosition(lat, lon, altitude) {
  const x = (lon - YVR_LON) * KM_PER_DEG_LON * SCALE
  const z = -(lat - YVR_LAT) * KM_PER_DEG_LAT * SCALE
  const y = (altitude / 1000) * SCALE
  return [x, y, z]
}
```

### 1.4 `||` fallbacks discard legitimate zero values

```js
// core/FlightManager.jsx
let parsedHeading = parseFloat(ac.track || ac.true_heading || ac.mag_heading || 0)
const vSpeed = ac.baro_rate || ac.geom_rate || 0
```

An aircraft tracking **000°** (due north) has `ac.track === 0`, which is falsy, so its heading silently
falls through to `true_heading` — or to `0` after every field misses. Likewise a `baro_rate` of exactly 0
(level flight) falls through to `geom_rate`, which may disagree. Use `??`:

```js
const parsedHeading = Number(ac.track ?? ac.true_heading ?? ac.mag_heading ?? 0) || 0
const vSpeed = Number(ac.baro_rate ?? ac.geom_rate ?? 0) || 0
```

### 1.5 Empty feed never clears the aircraft list

```js
// core/FlightManager.jsx
if (data.ac && data.ac.length > 0) {
  // ... setFlights(activeTracks)
}
```

When the upstream returns zero aircraft (overnight, or an upstream outage), the guard short-circuits and
the last-known aircraft remain on screen indefinitely, extrapolating forward on their last velocity vector.
Handle the empty case explicitly:

```js
const tracks = Array.isArray(data.ac) ? data.ac.map(/* ... */).filter(/* ... */) : []
setFlights(tracks)
onFlightsUpdate?.(tracks)
```

### 1.6 Tower interior floats ~30 m above the tower model

| Element | World Y (units) | Metres |
|---|---|---|
| `ATCTower` cab mesh | 0.40 | 40 m |
| `ATCTower` roof | 0.47 | 47 m |
| `ATCTower` antenna tip | ~0.625 | 62.5 m |
| `ATCTowerInterior` group | **0.70** | **70 m** |
| `CameraController` TOWER position | **0.70** | **70 m** |

The interior — and therefore the tower camera — sits above the antenna tip of its own exterior model.
Either raise the cab to `y = 0.70` or lower the interior to `y = 0.40`. Whichever you pick, define it once:

```js
// app/components/core/constants.js
/** Tower cab centre, world units. Shared by the exterior model, interior, and camera. */
export const TOWER_POSITION = [4.06, 0.4, -0.25]
```

and import it in `ATCTower.jsx`, `ATCTowerInterior.jsx`, and `CameraController.jsx` (which currently
repeats the literal `4.06, 0.7, -0.25` **twice** and `4.06, 0, -0.25` **three** times).

### 1.7 Runway designator pairing is wrong in `AirportScene`

```js
if (activeTraffic.heading > 210 && activeTraffic.heading < 330) return '26L / 26R (West)';
```

YVR's parallel runways are **08L/26R** and **08R/26L** — the reciprocal of 08L is 26R, not 26L. The west
configuration is therefore `26L / 26R` only by coincidence of labelling both; the pairing shown for the
east config (`08L / 08R`) is right, but presenting them as separate sets obscures that these are two
physical strips. `RunwayMarkings.jsx` gets the reciprocals right; `AirportScene.jsx` should reuse that
logic rather than re-deriving it from raw headings.

### 1.8 Unknown aircraft types render as a Boeing 777

Live feed sampling returns entries with `t` absent or set to non-aircraft codes (`SERV` for ground service
vehicles). `LiveAircraft.jsx` falls through every branch to:

```js
return '/b777_final.glb'
```

so a baggage tug renders as a widebody. Add an explicit small/default model, and skip rendering entries
whose `category` indicates a surface vehicle (`C1`–`C3` in the ADS-B category set).

### 1.9 Runway marking geometry vs. ICAO Annex 14

Minor, but since the rest of the scene is dimensionally accurate:

| Marking | Current | ICAO Annex 14 |
|---|---|---|
| Centreline stripe | 30 m stripe / 70 m gap (`j += 2` at 0.5 units) | 30 m stripe / 20 m gap |
| Centreline width | 1.5 m (`0.015` units) | 0.90 m |
| Threshold bars | 2.0 m × 30 m | 1.80 m × 30 m |
| TDZ first pair | 150 m from threshold | 300 m from threshold |
| Designator numerals | ~12 m tall | 20 m tall |

Change `j += 2` → `j += 1` with a 0.2-unit stripe for correct 30/20 spacing, and start `tdzDistances` at
3.0.

---

## 2. Asset weight — the largest single win

```
public/                132 MB
└── models/            124 MB
    ├── millennium_falcon.gltf   30 MB   ← reachable from live traffic
    ├── a343.glb                7.4 MB
    ├── a380.glb                6.2 MB
    ├── a359.glb                4.9 MB
    └── ... 40 more
```

### 2.1 A 30 MB easter egg triggers on real callsigns

```js
if (flight.callsign && flight.callsign.includes('FALCON')) return '/models/millennium_falcon.gltf'
```

`includes('FALCON')` matches any callsign containing that substring — and Dassault Falcon operators use
exactly that. A single such aircraft entering the 50 NM radius forces a 30 MB uncompressed glTF download
mid-session. Gate it on an exact match (`callsign.trim() === 'FALCON'`) at minimum; better, drop the asset
or replace it with a decimated version.

### 2.2 Nothing is Draco/meshopt compressed

None of the 44 models are compressed. `gltf-transform` typically achieves 80–95 % reduction on this class
of asset:

```bash
npm i -D @gltf-transform/cli
npx gltf-transform optimize public/models/a380.glb public/models/a380.glb \
  --compress draco --texture-compress webp --simplify
```

Then enable the decoder in `GLTFAircraft.jsx`:

```js
const { scene } = useGLTF(modelPath, '/draco/')   // place decoder files in public/draco/
```

Expect **124 MB → 10–20 MB**. This is the highest-leverage change in the repo.

### 2.3 Materials are overwritten anyway — geometry is all you need

`GLTFAircraft.jsx` discards every imported material:

```js
child.material = new THREE.MeshBasicMaterial({ color: '#00ffcc', wireframe: true, transparent: true, opacity: 0.5 })
```

Every embedded texture, PBR map, and material definition in all 124 MB is downloaded, parsed, uploaded —
and immediately thrown away. Strip textures and materials at build time:

```bash
npx gltf-transform prune public/models/a380.glb public/models/a380.glb --keep-extras false
```

Combined with 2.2 this should land the whole model set under 10 MB.

### 2.4 Material leak in `GLTFAircraft`

```js
useEffect(() => {
  scene.traverse((child) => {
    if (child.isMesh && !child.userData.hasEdges) {
      child.material = new THREE.MeshBasicMaterial({ ... })   // original never disposed
      child.userData.hasEdges = true
    }
  })
  // ...
}, [scene])
```

Two problems:

1. The **cached** `useGLTF` scene is mutated in place. `useGLTF` returns a module-level cached object; every
   `<Clone>` of that model inherits the mutation. It happens to work because all aircraft want the same
   wireframe look, but it is a side effect on shared state and will break the moment you want per-aircraft
   material variation (selected/hovered highlighting, for example).
2. The replaced materials and their GPU textures are never `.dispose()`d.

**Fix** — build one shared material and assign it to the clone, not the cache:

```js
// app/components/aircraft/GLTFAircraft.jsx
import { useMemo, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import AircraftLights from './AircraftLights'

/** Single wireframe material shared by every aircraft instance — one GPU program, zero leaks. */
const WIREFRAME_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#00ffcc',
  wireframe: true,
  transparent: true,
  opacity: 0.5,
})

export default function GLTFAircraft({ scale, position, modelPath, isNight }) {
  const { scene } = useGLTF(modelPath)

  // Clone per instance so we never mutate the shared useGLTF cache.
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((child) => {
      if (child.isMesh) child.material = WIREFRAME_MATERIAL
    })
    return clone
  }, [scene])

  // Bounding box drives both the ground offset and the navigation-light placement.
  const metrics = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model)
    if (box.isEmpty()) return null
    return {
      minX: box.min.x, maxX: box.max.x,
      minY: box.min.y, maxY: box.max.y,
      minZ: box.min.z, maxZ: box.max.z,
    }
  }, [model])

  return (
    <group scale={scale} position={position}>
      <group position={[0, metrics ? -metrics.minY : 0, 0]}>
        <primitive object={model} />
        <AircraftLights metrics={metrics} isNight={isNight} />
      </group>
    </group>
  )
}

useGLTF.preload('/b777_final.glb')
```

This also removes the `useState`/`useEffect` round-trip that currently causes every aircraft to render once
at the wrong vertical offset before `metrics` resolves.

### 2.5 Dead assets shipped to production

Present in `public/` but referenced nowhere in `app/`:

```
airplane.glb  airplane.gltf  airplane_v2.glb  b77w.glb
boundary_coastlines.json (378 KB)  regional_coastlines.json (624 KB)
combined_coastlines.json  yvr_coastlines.json  vancouver.json
```

Also: `yvr_aeroways.json` is 154 KB, of which the **283 taxiway polylines (~100 KB) are never read** —
`RealYVRAirport.jsx` uses only `aprons` and `runways`; taxiways come from the baked
`airport_ground.glb`. Split the file or strip the unused key.

---

## 3. Render cost

### 3.1 Runway paint is ~500 separate draw calls

`RunwayMarkings.jsx` emits one `<mesh>` per marking element, each with its own `planeGeometry` and
`meshBasicMaterial`. Per runway end: 10 threshold bars + 12 TDZ blocks + ~31 centreline dashes. Across
6 runway entries × 2 ends that is roughly **500 meshes / 1,000 objects**, all static, all identical
geometry.

Use a single `<instancedMesh>` per marking class (bars, TDZ, centreline), or merge into one
`BufferGeometry` with `BufferGeometryUtils.mergeGeometries`. Same for the 7-segment runway designators,
which allocate a `boxGeometry` per lit segment. Expect a 500 → 3 draw-call reduction.

### 3.2 Per-aircraft timers, frame callbacks, and DOM overlays

Each `LiveAircraft` currently owns:

- a `useFrame` callback (interpolation),
- a nested `AircraftLights` `useFrame` callback (strobe/beacon),
- a `setInterval(…, 1500)` that calls `setHistory` → full React re-render of the subtree,
- a drei `<Html>` label, which is a real DOM node whose transform is recomputed every frame.

At the 12 aircraft observed in the current feed this is fine; at a busy-afternoon 60–80 it is 160 frame
callbacks, 80 timers, and 80 DOM overlays fighting the compositor. Three fixes, in order of value:

1. **Replace `<Html>` labels with in-canvas `<Text>`** (`@react-three/drei`), inside a `<Billboard>`. Keeps
   labels on the GPU. Optionally render labels only for aircraft within N units of the camera.
2. **Move the trail out of React state.** `history` is a `useState` array of `THREE.Vector3` mutated every
   1.5 s. Hold it in a `useRef` and write directly into a `BufferAttribute`; re-render nothing.
3. **Hoist the strobe timing.** All aircraft strobe on the same clock, so the visibility flags can be
   computed once per frame in a parent and passed down, rather than recomputed in N `useFrame` callbacks.

### 3.3 Trail work runs even when trails are hidden

`validHistory` and `trailColors` are computed unconditionally — `trailColors` allocates a fresh
`THREE.Color` per point (up to 80) per aircraft on every history update — but are only consumed when
`showRoutes` is true. Gate the interval and both memos on `showRoutes`.

### 3.4 `window.*` used as a render-loop message bus

```js
window.aircraftRefs[flight.id] = planeRef.current   // LiveAircraft
window.isNightTime = !day                           // EnvironmentLighting
window.lastResetTrigger, window.isResetting         // CameraController
```

Beyond the general fragility, `window.isNightTime` is a **live bug**: `LiveAircraft` reads it during
render:

```js
<GLTFAircraft ... isNight={typeof window !== 'undefined' ? window.isNightTime : false} />
```

React has no way to know that value changed, so at the day→night boundary the navigation lights do not
switch on until something else happens to re-render that aircraft. Move day/night into React state
(context or a small store) so the transition propagates.

Similarly, `window.aircraftRefs` and `window.isResetting` should be a React context holding a `Map` and a
ref. A ~40-line Zustand store would cleanly replace all four globals plus the duplicated `flights` state
(currently held in both `FlightManager` and `AirportScene`).

---

## 4. API route (`app/api/adsb/route.js`)

### 4.1 The module-level cache does not survive horizontal scaling

`cachedData` / `lastFetchTime` / `isFetching` are per-process. On Vercel, or behind more than one Node
worker, each instance keeps its own cache and independently polls the upstream — the throttle multiplies by
instance count. If deploying serverless, move the cache to Redis/Upstash or use Next's
`unstable_cache`/`revalidate` on a plain JSON route.

### 4.2 `controller.enqueue` after client disconnect throws unhandled

```js
const sendData = async () => {
  await fetchAdsbData();
  if (cachedData) {
    controller.enqueue(...)   // throws if the stream is already closed
  }
}
```

The `abort` listener clears the interval, but an in-flight `sendData` awaiting `fetchAdsbData` can resume
after close and enqueue into a closed controller — an unhandled rejection per disconnect. Wrap in
`try/catch` and check `request.signal.aborted` before enqueueing.

### 4.3 No `User-Agent`, no backoff, no connection cap

- opendata.adsb.fi asks clients to identify themselves; the route sends the default Node UA.
- On a non-`ok` response `lastFetchTime` is not updated, so the throttle never engages and the route
  retries the failing upstream every 2 s indefinitely. Add exponential backoff.
- Every client connection creates an unbounded, unauthenticated, timer-holding SSE stream. A trivial script
  opening thousands of connections exhausts the process. Cap concurrent streams, or rate-limit by IP.
- Add `'X-Accel-Buffering': 'no'` so nginx/proxies don't buffer the stream.
- `cachedData.serverTime` is set but never read client-side — either use it to correct the 6 s playback
  offset for clock skew, or drop it.

**Suggested rewrite of the route** (drop-in replacement):

```js
// app/api/adsb/route.js
import { YVR_LAT, YVR_LON } from '../../components/core/constants'

export const dynamic = 'force-dynamic'

const FETCH_INTERVAL_MS = 2000       // upstream poll floor
const MAX_BACKOFF_MS = 60_000        // cap on consecutive-failure backoff
const MAX_STREAMS = 200              // concurrent SSE connection ceiling
const UPSTREAM = `https://opendata.adsb.fi/api/v3/lat/${YVR_LAT}/lon/${YVR_LON}/dist/50`
const USER_AGENT = 'yvrTracker/0.1 (https://github.com/<you>/yvrTracker)'

// Process-local cache. If this ever runs on more than one instance, promote to Redis.
let cachedData = null
let lastFetchTime = 0
let inFlight = null
let consecutiveFailures = 0
let activeStreams = 0

/** Current poll interval, widened by exponential backoff after upstream failures. */
function currentInterval() {
  if (consecutiveFailures === 0) return FETCH_INTERVAL_MS
  return Math.min(FETCH_INTERVAL_MS * 2 ** consecutiveFailures, MAX_BACKOFF_MS)
}

/** Fetch upstream at most once per interval; concurrent callers share one in-flight promise. */
async function fetchAdsbData() {
  if (inFlight) return inFlight
  if (Date.now() - lastFetchTime < currentInterval()) return

  inFlight = (async () => {
    try {
      const res = await fetch(UPSTREAM, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`upstream ${res.status}`)
      const json = await res.json()
      json.serverTime = Date.now()
      cachedData = json
      consecutiveFailures = 0
    } catch (err) {
      consecutiveFailures += 1
      console.error('[adsb] fetch failed:', err.message, `(backoff ${currentInterval()}ms)`)
    } finally {
      lastFetchTime = Date.now()   // always advance, so failures also respect the throttle
      inFlight = null
    }
  })()

  return inFlight
}

export async function GET(request) {
  if (activeStreams >= MAX_STREAMS) {
    return new Response('Too many concurrent streams', { status: 503 })
  }

  const encoder = new TextEncoder()
  let intervalId = null
  activeStreams += 1

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (request.signal.aborted) return
        await fetchAdsbData()
        if (request.signal.aborted || !cachedData) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(cachedData)}\n\n`))
        } catch {
          // Stream closed between the abort check and the enqueue — nothing to do.
        }
      }

      await send()
      intervalId = setInterval(send, FETCH_INTERVAL_MS)

      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId)
        activeStreams -= 1
        try { controller.close() } catch { /* already closed */ }
      })
    },
    cancel() {
      if (intervalId) clearInterval(intervalId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

### 4.4 Weather is fetched from the browser, uncached, once, unaborted

`useWeather.js` calls open-meteo directly from the client with no `AbortController` (setState-after-unmount
on fast navigation) and never refreshes. Proxy it through `/api/weather` with `revalidate: 600`, mirroring
the ADS-B pattern, and add a refresh interval — a tracker that shows 6-hour-old wind while inferring active
runways from it is misleading.

---

## 5. Repo hygiene, build, tooling

### 5.1 Not a git repository

`git status` fails — there is no VCS history at all for a 1,900-LOC application. This is the single riskiest
thing in the project. Initialise it before anything else.

### 5.2 Project root holds ~50 one-off scratch scripts

```
fetch_dem.py fetch_dem2.py fetch_dem_regional.py fetch_buildings.py fetch_buildings.js
fetch_buildings_new.py fetch_coastlines.py fetch_coastlines_clean.py fetch_local_coastlines.py
fetch_chunked_coastlines.py merge_coastlines.py merge_clean_coastlines.py super_clean_coastlines.py
generate_perfect_coastlines.py handcraft_coastlines.py trace_coastlines.py trace_from_map.py
test.js test_noline.js test_noplanes.js test_terrain.js test_runways.js test_altitude.js
test_scale.mjs test_boundaries.py test_coastlines.py test_overpass.py ...
```

plus `stitched_map.png` (3.5 MB), `land_mask.png`, `water_mask.png`, `tiles_cache/` (84 PNGs, 1.3 MB),
`out1.json` (empty), `out2.json`, and three `.DS_Store` files.

Move the ones you still need into `scripts/` (or `tools/geodata/`) with a short README explaining the
pipeline that produced `public/*.json` and `airport_ground.glb`; delete the rest. That derivation is
currently undocumented and unreproducible.

### 5.3 Missing `.gitignore`

`node_modules/` (562 MB) and `.next/` (669 MB) are sitting in the project directory with nothing excluding
them:

```gitignore
# .gitignore
node_modules/
.next/
out/
build/
.DS_Store
*.log
.env*.local

# Geodata scratch artifacts
tiles_cache/
stitched_map.png
land_mask.png
water_mask.png
out*.json
```

### 5.4 `jsdom` is a production dependency used only by a scratch script

`jsdom@29.1.1` is in `dependencies` and is imported by exactly one file — `test_scale.mjs`, a root-level
scratch script. It ships in every production install. Move it to `devDependencies`, or remove it with the
script.

### 5.5 No lint config, no README, no `jsconfig.json`

- `package.json` declares `"lint": "next lint"` but no ESLint config exists, so the script is a no-op.
  Add `eslint-config-next` plus `@react-three/eslint-plugin` (it catches R3F-specific mistakes such as
  mutating props in `useFrame` and creating objects inside the render loop — both present in this codebase).
- No README: nothing documents the data pipeline, the `1 unit = 100 m` scale convention, or the keyboard
  shortcuts (`C` cycles chase cameras, `X` deselects) — which are only discoverable by reading
  `AirportScene.jsx`.
- Add `jsconfig.json` with `"paths": { "@/*": ["./*"] }` to replace `'../core/constants'`-style relative
  imports.

### 5.6 `transpilePackages` is likely unnecessary

```js
transpilePackages: ['@react-three/fiber', '@react-three/drei', 'three'],
```

three 0.184 and R3F 9.x ship proper ESM. This forces Next to re-transpile ~2 MB of dependency source on
every build. Try removing it; if the build passes, it is pure build-time savings. While there, add
`poweredByHeader: false` and a basic CSP.

### 5.7 No TypeScript

Given how much of this codebase is unit conversion and coordinate transformation — and that §1.1 is exactly
the class of bug a type system catches — TypeScript would pay for itself here. A minimal version:
branded types for `Metres`, `Feet`, `Knots`, `MetresPerSecond`, `WorldUnits`, and a typed `Flight`
interface. That alone makes §1.1 and §1.3 unrepresentable.

---

## 6. Smaller items

- **`ErrorBoundary`** calls `setState` in `componentDidCatch` after `getDerivedStateFromError` already set
  `hasError` — a redundant second render. Merge into one.
- **`@keyframes pulse` / `spin`** are defined in `AirportScene.jsx` via `<style jsx global>` but consumed by
  `ControlPanel.jsx` and `Loader.jsx`. Move them to `global.css`; the coupling is invisible today.
- **`ControlPanel.jsx` "SHOW TRAILS" toggle** is a `<div onClick>` with no `role`, `tabIndex`, or key
  handler — unreachable by keyboard. Use a `<button>` with `aria-pressed`.
- **Inline styles**: ~400 lines of the UI are inline style objects reallocated on every render. Extracting a
  token file (`--accent: #00ffcc`, `--panel-bg: rgba(5,15,25,.75)`, etc.) plus CSS modules would cut the UI
  files roughly in half and make the accent colour — currently hardcoded ~60 times — themeable.
- **`FlightManager`'s WebGL context-loss listener** is registered on `window`, but the event fires on the
  `<canvas>` element. Move it into a component with `useThree()` access and attach to `gl.domElement`.
  As written it never fires.
- **`ac.dst`** (distance in NM) is already in the ADS-B payload; `FlightManager` recomputes it with the flat
  approximation. Use the upstream value.
- **`MapTerrain`** loads a texture with no error handler and never disposes it on unmount.
- **`Coastlines`** renders 32 separate drei `<Line>` components (32 draw calls) for 2,354 points that could
  be one `LineSegments`.

---

## 7. Suggested sequence

**Week 1 — stop the bleeding**

1. `git init`, add `.gitignore`, commit. *(§5.1, §5.3)*
2. Fix the unit bugs: `TargetLockMonitor` labels, `??` fallbacks, empty-feed guard. *(§1.1, §1.4, §1.5)*
3. Consolidate constants: single `YVR` origin, `TOWER_POSITION`, derived longitude factor. *(§1.2, §1.3, §1.6)*
4. Gate the `millennium_falcon` easter egg on an exact match. *(§2.1)*

**Week 2 — payload**

5. Run `gltf-transform prune` + `optimize` across `public/models/`; add the Draco decoder. Target 124 MB → <15 MB. *(§2.2, §2.3)*
6. Delete unused assets; strip taxiways from `yvr_aeroways.json`. *(§2.5)*
7. Fix the `GLTFAircraft` material leak / cache mutation. *(§2.4)*

**Week 3 — runtime**

8. Replace `window.*` globals with a small store; fixes the day/night light bug. *(§3.4)*
9. Instance the runway markings. *(§3.1)*
10. Swap `<Html>` labels for in-canvas `<Text>`; move trails to refs. *(§3.2, §3.3)*
11. Harden the SSE route: backoff, abort guards, connection cap, User-Agent. *(§4)*

**Week 4 — foundations**

12. ESLint + `@react-three/eslint-plugin`; write the README documenting the scale convention and geodata pipeline. *(§5.5)*
13. Move scratch scripts into `scripts/`. *(§5.2)*
14. Optional: incremental TypeScript migration, starting with `core/`. *(§5.7)*

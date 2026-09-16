import urllib.request
import json
import math
import time
import os

import cv2
import numpy as np

# === Step 1: Download OSM tiles ===
zoom = 12

def lat_lon_to_tile(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y

def tile_to_lat_lon(x, y, z):
    """Top-left corner of tile"""
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat = math.degrees(lat_rad)
    return lat, lon

# Bounding box for Lower Mainland
x_min, y_min = lat_lon_to_tile(49.40, -123.35, zoom)  # NW corner
x_max, y_max = lat_lon_to_tile(48.90, -122.70, zoom)  # SE corner

print(f"Tile range: x={x_min}-{x_max}, y={y_min}-{y_max}")
print(f"Total tiles: {(x_max-x_min+1) * (y_max-y_min+1)}")

tile_dir = "tiles_cache"
os.makedirs(tile_dir, exist_ok=True)

for ty in range(y_min, y_max + 1):
    for tx in range(x_min, x_max + 1):
        path = f"{tile_dir}/{zoom}_{tx}_{ty}.png"
        if os.path.exists(path):
            continue
        url = f"https://tile.openstreetmap.org/{zoom}/{tx}/{ty}.png"
        print(f"  Downloading tile {tx},{ty}...", end=" ", flush=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'YVR-Tracker/1.0 (student project)'})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                with open(path, 'wb') as f:
                    f.write(resp.read())
            print("OK")
        except Exception as e:
            print(f"FAIL: {e}")
        time.sleep(0.5)

# === Step 2: Stitch tiles ===
print("\nStitching tiles...")
cols = x_max - x_min + 1
rows = y_max - y_min + 1
stitched = np.zeros((rows * 256, cols * 256, 3), dtype=np.uint8)

for ty in range(y_min, y_max + 1):
    for tx in range(x_min, x_max + 1):
        path = f"{tile_dir}/{zoom}_{tx}_{ty}.png"
        if os.path.exists(path):
            tile = cv2.imread(path)
            if tile is not None:
                r = ty - y_min
                c = tx - x_min
                stitched[r*256:(r+1)*256, c*256:(c+1)*256] = tile

cv2.imwrite("stitched_map.png", stitched)
print(f"Stitched map: {stitched.shape[1]}x{stitched.shape[0]} pixels")

# === Step 3: Threshold water ===
# OSM standard tiles use blue for water (~#aad3df in RGB)
# Convert to HSV and threshold for blue/cyan hues
hsv = cv2.cvtColor(stitched, cv2.COLOR_BGR2HSV)

# Water in OSM tiles: low saturation blue-ish. Let's use color range
# Water RGB is approximately (170-190, 211-220, 223-240) -> BGR (223-240, 211-220, 170-190)
# In HSV: H~95-110, S~30-80, V~180-245
lower_water = np.array([85, 15, 170])
upper_water = np.array([115, 100, 255])
water_mask = cv2.inRange(hsv, lower_water, upper_water)

# Clean up with morphology
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel, iterations=1)

# Land mask is inverse of water
land_mask = cv2.bitwise_not(water_mask)

cv2.imwrite("water_mask.png", water_mask)
cv2.imwrite("land_mask.png", land_mask)
print(f"Water pixels: {(water_mask > 0).sum()}, Land pixels: {(land_mask > 0).sum()}")

# === Step 4: Find contours ===
contours, _ = cv2.findContours(water_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print(f"Raw contours found: {len(contours)}")

# Filter: keep only significant contours (> 100 points)
big_contours = [c for c in contours if len(c) > 50]
print(f"Significant contours (>50 pts): {len(big_contours)}")

# === Step 5: Convert pixel coords to lat/lon ===
# Top-left of stitched image = tile (x_min, y_min) top-left corner
nw_lat, nw_lon = tile_to_lat_lon(x_min, y_min, zoom)
se_lat, se_lon = tile_to_lat_lon(x_max + 1, y_max + 1, zoom)

img_h, img_w = stitched.shape[:2]

def pixel_to_latlon(px, py):
    # Linear interpolation in Mercator projection
    frac_x = px / img_w
    frac_y = py / img_h
    lon = nw_lon + frac_x * (se_lon - nw_lon)
    # Latitude needs Mercator projection math
    n = 2 ** zoom
    tile_y_float = y_min + frac_y * (y_max + 1 - y_min)
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * tile_y_float / n)))
    lat = math.degrees(lat_rad)
    return lat, lon

ways = []
for contour in big_contours:
    # Simplify contour to reduce point count while keeping shape
    epsilon = 1.5  # pixel tolerance for simplification
    simplified = cv2.approxPolyDP(contour, epsilon, True)
    
    way = []
    for point in simplified:
        px, py = point[0]
        lat, lon = pixel_to_latlon(px, py)
        way.append([lat, lon])
    
    if len(way) >= 3:
        way.append(way[0])  # close the loop
        ways.append(way)

total_points = sum(len(w) for w in ways)
print(f"\nFinal coastline segments: {len(ways)}")
print(f"Total coordinate points: {total_points}")

with open('public/coastlines.json', 'w') as f:
    json.dump({'ways': ways}, f)

print("Saved to public/coastlines.json")

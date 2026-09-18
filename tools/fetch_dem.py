import urllib.request
from PIL import Image
import math
import os

Z = 12
X_START = 645
Y_START = 1403
COLS = 3
ROWS = 3
TILE_SIZE = 256

out_img = Image.new('L', (COLS * TILE_SIZE, ROWS * TILE_SIZE))

for cx in range(COLS):
    for cy in range(ROWS):
        x = X_START + cx
        y = Y_START + cy
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        print(f"Fetching {url}")
        with urllib.request.urlopen(req) as response:
            tile = Image.open(response).convert('RGB')
            out_tile = Image.new('L', (TILE_SIZE, TILE_SIZE))
            pixels = tile.load()
            out_pixels = out_tile.load()
            for py in range(TILE_SIZE):
                for px in range(TILE_SIZE):
                    r, g, b = pixels[px, py]
                    elev = (r * 256 + g + b / 256.0) - 32768
                    if elev < 0: elev = 0
                    gray = min(255, int(elev / 1500.0 * 255))
                    out_pixels[px, py] = gray
            out_img.paste(out_tile, (cx * TILE_SIZE, cy * TILE_SIZE))

out_img.save('public/vancouver_dem.png')
print("Saved public/vancouver_dem.png")

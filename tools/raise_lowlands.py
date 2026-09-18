import cv2
import numpy as np

img = cv2.imread('public/vancouver_dem.png', cv2.IMREAD_GRAYSCALE)
h, w = img.shape
print(f"DEM size: {w}x{h}")
print(f"Pixel value range: {img.min()} - {img.max()}")
print(f"Pixels at 0: {(img == 0).sum()} / {h*w}")

# Step 1: Create ocean mask using flood fill from all edges
# Any pixel connected to the border that is near 0 is ocean
ocean_mask = np.zeros((h + 2, w + 2), np.uint8)  # flood fill needs +2 size

# Work on a copy for flood fill
fill_img = img.copy()

# Flood fill from every border pixel that is 0
# Top and bottom rows
for x in range(w):
    if fill_img[0, x] <= 2:
        cv2.floodFill(fill_img, ocean_mask, (x, 0), 255, loDiff=2, upDiff=2)
    if fill_img[h-1, x] <= 2:
        cv2.floodFill(fill_img, ocean_mask, (x, h-1), 255, loDiff=2, upDiff=2)

# Left and right columns
for y in range(h):
    if fill_img[y, 0] <= 2:
        cv2.floodFill(fill_img, ocean_mask, (0, y), 255, loDiff=2, upDiff=2)
    if fill_img[y, w-1] <= 2:
        cv2.floodFill(fill_img, ocean_mask, (w-1, y), 255, loDiff=2, upDiff=2)

# Trim the +2 border from mask
ocean = ocean_mask[1:h+1, 1:w+1]

land_at_zero = ((img <= 2) & (ocean == 0)).sum()
ocean_pixels = (ocean > 0).sum()
print(f"Ocean pixels identified: {ocean_pixels}")
print(f"Land pixels at/near 0 (will be raised): {land_at_zero}")

# Step 2: Raise all non-ocean pixels to minimum value of 5
# pixel value 5 ≈ 5/255 * 30 displacement units ≈ 0.59 units ≈ 59m visual height
# This is enough to make the wireframe triangles clearly pop above the flat ocean
result = img.copy()
land_mask = (ocean == 0)
result[land_mask] = np.maximum(result[land_mask], 5)

cv2.imwrite('public/vancouver_dem.png', result)
print("Done — saved raised DEM to public/vancouver_dem.png")
print(f"Pixels changed: {(result != img).sum()}")

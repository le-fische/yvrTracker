# Verify coordinate system
YVR_LAT = 49.1947
YVR_LON = -123.1839
SCALE = 10

def getPosition(lat, lon):
    x = (lon - YVR_LON) * 73 * SCALE
    z = -(lat - YVR_LAT) * 111 * SCALE
    return (round(x, 2), round(z, 2))

# Test known landmarks
tests = {
    "YVR Center": (49.1947, -123.1839),
    "Point Grey / UBC": (49.2640, -123.2460),
    "Stanley Park tip": (49.3035, -123.1390),
    "Lions Gate Bridge N": (49.3155, -123.1380),
    "Deep Cove": (49.3290, -123.0240),
    "Horseshoe Bay": (49.3730, -123.2750),
    "Tsawwassen ferry": (49.0060, -123.1320),
    "White Rock pier": (49.0195, -122.8030),
    "Richmond center": (49.1630, -123.1370),
    "Surrey center": (49.1900, -122.8490),
    "Burnaby Metrotown": (49.2260, -123.0020),
    "New West": (49.2070, -122.9110),
    "Port Moody": (49.2840, -122.8460),
    "Boundary Bay S tip": (49.0000, -123.0000),
    "Point Roberts SW": (48.9830, -123.0590),
    "Steveston": (49.1265, -123.1870),
    "Lulu Island S tip": (49.1100, -123.1500),
}

for name, (lat, lon) in tests.items():
    x, z = getPosition(lat, lon)
    print(f"{name:30s} lat={lat:.4f} lon={lon:.4f} -> x={x:8.1f}, z={z:8.1f}")

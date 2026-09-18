import json

YVR_LAT = 49.1947
YVR_LON = -123.1839
SCALE = 10

def gp(lat, lon):
    """Convert geographic lat/lon to our 3D world [x, z] coordinates."""
    x = (lon - YVR_LON) * 73 * SCALE
    z = -(lat - YVR_LAT) * 111 * SCALE
    return [round(x, 2), round(z, 2)]

ways = []

# ============================================================
# 1. SEA ISLAND (YVR Airport Island) - clockwise from NW corner
# ============================================================
sea_island = [
    gp(49.2090, -123.2250),  # NW tip
    gp(49.2100, -123.2150),  # N shore west
    gp(49.2080, -123.2000),  # N shore 
    gp(49.2060, -123.1900),  # N shore mid
    gp(49.2050, -123.1800),  
    gp(49.2055, -123.1700),  # N shore near bridge
    gp(49.2050, -123.1600),  # NE corner (Arthur Laing bridge area)
    gp(49.2000, -123.1580),  # E shore north
    gp(49.1960, -123.1570),  # E shore mid
    gp(49.1920, -123.1570),  # E shore
    gp(49.1880, -123.1580),  # SE corner
    gp(49.1860, -123.1600),  # S shore east
    gp(49.1840, -123.1650),  # S shore 
    gp(49.1820, -123.1750),  # S shore mid
    gp(49.1810, -123.1850),  # S shore 
    gp(49.1815, -123.1950),  # S shore west
    gp(49.1830, -123.2050),  # SW area
    gp(49.1860, -123.2150),  # W shore south
    gp(49.1900, -123.2200),  # W shore mid
    gp(49.1950, -123.2230),  # W shore
    gp(49.2000, -123.2240),  # W shore north
    gp(49.2050, -123.2250),  # W shore NW
    gp(49.2090, -123.2250),  # close loop
]
ways.append(sea_island)

# ============================================================
# 2. LULU ISLAND (Richmond) - clockwise from NW
# ============================================================
lulu_island = [
    gp(49.2020, -123.1550),  # NW (near Moray Channel)
    gp(49.1980, -123.1500),  # N shore
    gp(49.1960, -123.1400),  
    gp(49.1950, -123.1300),  # N shore (near Oak St Bridge)
    gp(49.1940, -123.1200),  
    gp(49.1930, -123.1100),  # N shore (Knight St Bridge)
    gp(49.1920, -123.1000),  
    gp(49.1900, -123.0900),  # NE area
    gp(49.1880, -123.0800),  
    gp(49.1860, -123.0700),  # E end (Mitchell Island area)
    gp(49.1800, -123.0650),  # E tip
    gp(49.1750, -123.0700),  # SE corner
    gp(49.1700, -123.0750),  
    gp(49.1650, -123.0800),  # Fraser River south arm
    gp(49.1550, -123.0850),  
    gp(49.1450, -123.0900),  # S shore east
    gp(49.1400, -123.1000),  
    gp(49.1350, -123.1100),  # S shore (Steveston area approach)
    gp(49.1300, -123.1200),  
    gp(49.1260, -123.1350),  # Steveston
    gp(49.1250, -123.1500),  # S shore west (Garry Point)
    gp(49.1240, -123.1650),  
    gp(49.1250, -123.1800),  # SW corner
    gp(49.1280, -123.1900),  
    gp(49.1350, -123.2000),  # W shore
    gp(49.1450, -123.2050),  
    gp(49.1550, -123.2080),  # W shore mid
    gp(49.1650, -123.2050),  
    gp(49.1750, -123.1950),  # W shore upper
    gp(49.1810, -123.1850),  
    gp(49.1840, -123.1750),  # NW (south of Sea Island)
    gp(49.1870, -123.1650),  
    gp(49.1900, -123.1580),  # NW corner back near Sea Island
    gp(49.1950, -123.1560),  
    gp(49.2020, -123.1550),  # close loop
]
ways.append(lulu_island)

# ============================================================
# 3. VANCOUVER SOUTH SHORE (False Creek to Fraser River mouth) 
#    This is the south coast of the main Vancouver peninsula
# ============================================================
vancouver_south = [
    gp(49.2710, -123.2640),  # Point Grey / UBC west tip
    gp(49.2690, -123.2500),  
    gp(49.2660, -123.2350),  # Jericho Beach
    gp(49.2650, -123.2200),  # Kitsilano Beach
    gp(49.2680, -123.2050),  
    gp(49.2700, -123.1950),  # Vanier Park
    gp(49.2710, -123.1850),  # False Creek entrance
    gp(49.2700, -123.1750),  # Granville Island area
    gp(49.2680, -123.1650),  
    gp(49.2660, -123.1550),  # Cambie Bridge area
    gp(49.2640, -123.1450),  # Science World
    gp(49.2620, -123.1350),  
    gp(49.2580, -123.1200),  # Main/Clark area
    gp(49.2540, -123.1050),  # Renfrew
    gp(49.2500, -123.0900),  # Boundary Rd
    gp(49.2450, -123.0750),  # Burnaby south 
    gp(49.2400, -123.0600),  
    gp(49.2350, -123.0450),  # Burnaby Lake area
    gp(49.2300, -123.0300),  
    gp(49.2250, -123.0150),  # New Westminster
    gp(49.2200, -123.0000),  
    gp(49.2100, -122.9800),  # Fraser River bend
    gp(49.2050, -122.9600),  # New West / Surrey border
]
ways.append(vancouver_south)

# ============================================================
# 4. BURRARD INLET SOUTH SHORE (Stanley Park to Deep Cove area)
#    Northern waterfront of Vancouver/Burnaby
# ============================================================
burrard_inlet_south = [
    gp(49.2950, -123.2600),  # Point Grey north tip
    gp(49.2900, -123.2450),  # Spanish Banks
    gp(49.2850, -123.2300),  
    gp(49.2830, -123.2150),  # Locarno Beach
    gp(49.2850, -123.2000),  # Jericho
    gp(49.2880, -123.1900),  
    gp(49.2920, -123.1800),  # English Bay
    gp(49.2970, -123.1650),  # Coal Harbour
    gp(49.3010, -123.1500),  # Stanley Park south
    gp(49.3035, -123.1390),  # Stanley Park tip (Prospect Point)
    gp(49.3010, -123.1300),  # Stanley Park east
    gp(49.2960, -123.1250),  # Coal Harbour east
    gp(49.2920, -123.1200),  # Waterfront station
    gp(49.2870, -123.1100),  # CRAB Park
    gp(49.2840, -123.1000),  # port area
    gp(49.2820, -123.0900),  # Hastings port
    gp(49.2830, -123.0800),  
    gp(49.2850, -123.0650),  # Second Narrows area south
    gp(49.2870, -123.0500),  
    gp(49.2880, -123.0350),  # Burnaby N shore
    gp(49.2900, -123.0200),  # Barnet Highway
    gp(49.2850, -123.0050),  # Port Moody inlet start
    gp(49.2830, -122.9900),  
    gp(49.2840, -122.9700),  # Port Moody
    gp(49.2870, -122.9550),  # Rocky Point 
    gp(49.2900, -122.9400),  # Port Moody east
]
ways.append(burrard_inlet_south)

# ============================================================
# 5. NORTH SHORE (Lions Gate to Deep Cove) 
#    South coast of North/West Vancouver
# ============================================================
north_shore = [
    gp(49.3730, -123.2750),  # Horseshoe Bay
    gp(49.3600, -123.2600),  
    gp(49.3500, -123.2450),  # West Van waterfront
    gp(49.3400, -123.2300),  
    gp(49.3350, -123.2150),  # Dundarave
    gp(49.3280, -123.2000),  # Ambleside
    gp(49.3250, -123.1850),  
    gp(49.3200, -123.1700),  
    gp(49.3180, -123.1550),  # Park Royal
    gp(49.3155, -123.1380),  # Lions Gate Bridge north end
    gp(49.3140, -123.1250),  
    gp(49.3120, -123.1100),  # N Van waterfront
    gp(49.3100, -123.0950),  # Lonsdale Quay
    gp(49.3080, -123.0800),  
    gp(49.3050, -123.0650),  # Second Narrows north
    gp(49.3020, -123.0500),  
    gp(49.3000, -123.0350),  # Deep Cove direction
    gp(49.3050, -123.0200),  
    gp(49.3100, -123.0050),  
    gp(49.3200, -122.9900),  # Indian Arm entrance
    gp(49.3290, -122.9750),  # Deep Cove
]
ways.append(north_shore)

# ============================================================
# 6. DELTA / TSAWWASSEN PENINSULA + POINT ROBERTS outline
# ============================================================
delta_south = [
    gp(49.1240, -123.1650),  # Steveston (connects to Lulu Island S)
    gp(49.1200, -123.1500),  
    gp(49.1150, -123.1350),  
    gp(49.1100, -123.1200),  # Ladner
    gp(49.1000, -123.1100),  
    gp(49.0900, -123.1050),  # Burns Bog area
    gp(49.0800, -123.1000),  
    gp(49.0700, -123.0950),  # Delta farmland
    gp(49.0550, -123.0900),  
    gp(49.0400, -123.0950),  # Roberts Bank
    gp(49.0250, -123.1050),  # Tsawwassen
    gp(49.0150, -123.1150),  
    gp(49.0060, -123.1320),  # Tsawwassen ferry terminal
    gp(49.0020, -123.1300),  # Tsawwassen beach south
    gp(48.9980, -123.1200),  # Boundary Bay west
    gp(48.9960, -123.1000),  
    gp(48.9950, -123.0800),  # Point Roberts border
    gp(48.9950, -123.0600),  
    gp(48.9840, -123.0590),  # Point Roberts tip SW
    gp(48.9750, -123.0500),  
    gp(48.9700, -123.0300),  # Point Roberts S 
    gp(48.9730, -123.0100),  
    gp(48.9800, -122.9900),  # Point Roberts SE
    gp(48.9950, -122.9850),  # Border again
    gp(49.0010, -122.9800),  
    gp(49.0010, -122.9600),  # Boundary Bay east shore
    gp(49.0050, -122.9400),  
    gp(49.0100, -122.9200),  # Boundary Bay NE
    gp(49.0200, -122.9000),  # White Rock approach
    gp(49.0195, -122.8700),  # Crescent Beach
    gp(49.0195, -122.8400),  # White Rock
    gp(49.0195, -122.8030),  # White Rock pier
]
ways.append(delta_south)

# ============================================================
# 7. FRASER RIVER SOUTH ARM (connecting Delta to Surrey/New West)
# ============================================================
fraser_south_arm = [
    gp(49.1240, -123.1650),  # Start at Steveston
    gp(49.1300, -123.1450),  
    gp(49.1350, -123.1250),  # Ladner direction
    gp(49.1400, -123.1050),  
    gp(49.1450, -123.0850),  # Deas Island area
    gp(49.1500, -123.0650),  
    gp(49.1550, -123.0450),  # Alex Fraser Bridge area
    gp(49.1600, -123.0250),  
    gp(49.1650, -123.0050),  # Annacis Island
    gp(49.1700, -122.9850),  
    gp(49.1750, -122.9650),  # Scott Road area
    gp(49.1800, -122.9450),  
    gp(49.1850, -122.9250),  # Pattullo Bridge area
    gp(49.1900, -122.9100),  # New Westminster south  
    gp(49.2000, -122.9000),  # New Westminster
    gp(49.2050, -122.9150),  # Connect up
]
ways.append(fraser_south_arm)

# ============================================================
# 8. SURREY WEST COAST (Mud Bay to White Rock)
# ============================================================
surrey_coast = [
    gp(49.0900, -122.8800),  # Mud Bay north
    gp(49.0800, -122.8750),  
    gp(49.0700, -122.8700),  # Mud Bay
    gp(49.0600, -122.8650),  
    gp(49.0500, -122.8600),  
    gp(49.0400, -122.8500),  # Crescent Beach approach
    gp(49.0300, -122.8400),  
    gp(49.0195, -122.8400),  # connect to White Rock line
]
ways.append(surrey_coast)

print(f"Total hand-traced coastline segments: {len(ways)}")
print(f"Total coordinate points: {sum(len(w) for w in ways)}")

with open('public/combined_coastlines.json', 'w') as f:
    json.dump({'ways': ways}, f)

print("Saved to public/combined_coastlines.json")

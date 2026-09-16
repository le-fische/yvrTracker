import urllib.request
import json

query = """
[out:json];
(
  relation["name"="Sea Island"];
  relation["name"="Lulu Island"];
);
out geom;
"""

req = urllib.request.Request(
    'https://overpass-api.de/api/interpreter',
    data=query.encode('utf-8'),
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        print("Fetched", len(data.get('elements', [])), "elements.")
except Exception as e:
    print(e)

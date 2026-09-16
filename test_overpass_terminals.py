import urllib.request
import json

query = """
[out:json];
(
  way["aeroway"="terminal"](49.180,-123.200,49.205,-123.155);
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
        print("Fetched", len(data.get('elements', [])), "terminals.")
except Exception as e:
    print(e)

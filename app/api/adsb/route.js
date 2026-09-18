export const dynamic = 'force-dynamic';
import { YVR_LAT, YVR_LON } from '../../components/core/constants.js';

// Global cache to prevent multiple streams from hammering the external API
let cachedData = null;
let lastFetchTime = 0;
let isFetching = false;

const FETCH_INTERVAL = 2000; // fetch at most every 2 seconds

async function fetchAdsbData() {
  if (isFetching) return;
  const now = Date.now();
  if (now - lastFetchTime < FETCH_INTERVAL) return;

  isFetching = true;
  try {
    const res = await fetch(`https://opendata.adsb.fi/api/v3/lat/${YVR_LAT}/lon/${YVR_LON}/dist/50`);
    if (res.ok) {
      cachedData = await res.json();
      // add a server timestamp so clients know exactly when this data was fetched
      cachedData.serverTime = Date.now();
      lastFetchTime = Date.now();
    } else {
      console.error('ADSB API error:', res.status);
    }
  } catch (e) {
    console.error('Failed to fetch ADSB data:', e);
  } finally {
    isFetching = false;
  }
}

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendData = async () => {
        await fetchAdsbData();
        if (cachedData) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(cachedData)}\n\n`));
        }
      };

      // Send initial data immediately
      await sendData();

      // Poll periodically and push down stream
      const intervalId = setInterval(sendData, FETCH_INTERVAL);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

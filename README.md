# YVR Tracker

A 3D visualization tool for live air traffic around Vancouver International Airport (YVR). It plots aircraft in real time on a 3D map with accurate altitude, heading, and velocity.

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Data Sources
- **ADS-B Flight Data**: Live feeds provided by [opendata.adsb.fi](https://opendata.adsb.fi/).
- **Weather Data**: Real-time conditions from [Open-Meteo](https://open-meteo.com/).

*Disclaimer: This application is for entertainment and visualization purposes only. Do not use for real-world navigation or aviation safety.*

## Architecture & Conventions

### Scene Units and Normalization
- `FlightManager.jsx` normalizes every field to SI units (meters, meters per second) at ingest.
- Any code displaying feet or knots must convert at the display layer (using `units.js`).
- **Scene units are 100 m per unit.**

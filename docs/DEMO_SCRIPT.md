# 3-Minute Live Tracking Demo Script

A concise, step-by-step presentation script designed for stakeholders, evaluators, and team members demonstrating real-time vehicle GPS tracking, server-side geofencing, and citizen-collector synchronization on the WasteWise platform.

---

## Preparation (Before the Presentation)

1. Ensure PostgreSQL is running and the database schema is up to date (`npx prisma migrate dev`).
2. Verify environment files:
   - `backend/.env`: `PORT=4000`, `DEV_SKIP=false`, `DEV_SKIP_ARRIVAL_RADIUS=false`
   - `admin-dashboard/.env`: `VITE_DEMO_MODE=true`
   - `mobile-app/.env`: `EXPO_PUBLIC_DEMO_MODE=true`
3. Have 3 browser/app windows arranged on screen:
   - **Left:** Citizen App (mobile viewport or physical device on Track Pickup Screen)
   - **Right:** Admin Dashboard on Live Fleet Map (`http://localhost:5173/fleet`)
   - **Bottom:** Terminal for running the demo commands

---

## 3-Minute Presentation Walkthrough

### 0:00 - 0:30 | Step 1: Initialize Demo Data & Explain Context

**Action:** Run demo seed in terminal:
```bash
cd backend
npm run demo:seed
```

**What to Say:**
> *"Today we're demonstrating the real-time tracking and dispatch pipeline of WasteWise. Recyclable pickups require real-time visibility so citizens know exactly when a collector is arriving at their doorstep.*
>
> *I've just run our demo seed command. This creates a demo citizen, a demo collector, an electric collection vehicle (DEMO-TRUCK-01), and an assigned pickup request in Sangli, Maharashtra. Notice that all records exercise the real relational database constraints."*

---

### 0:30 - 1:15 | Step 2: Open Citizen & Admin Interfaces

**Action:**
1. Open Admin Dashboard (`http://localhost:5173/fleet`), log in with `admin@wastewise.local` / `Admin@123`, and select `DEMO-TRUCK-01` in the fleet list.
2. In the Citizen App, log in with `demo_citizen@example.com` / `DemoCitizen@123` and navigate to the assigned pickup's **Track Pickup** screen.

**What to Say:**
> *"On the left, we have the citizen's mobile tracking screen. On the right, we have the administrative live fleet dashboard.*
>
> *Notice the green 300-meter dotted circle around the citizen's home address on Station Road. This is our server-enforced arrival zone. A driver cannot claim they have arrived while still kilometers away—the server mathematically verifies distance using the Haversine formula and rejects any spoofed or stale GPS updates."*

---

### 1:15 - 2:15 | Step 3: Launch Live Route Simulation

**Action:** Run the driver simulator in terminal:
```bash
cd backend
npm run demo:drive -- --speed=2 --auto-arrive
```

**What to Say:**
> *"Now I'm launching the driver simulator. The script logs in as the collector through the real REST login endpoint, obtains a signed JWT, connects over Socket.IO, and calls the real PATCH status endpoint to start the trip.*
>
> *It queries OpenStreetMap's OSRM engine for the exact road route between the sorting hub and the citizen's home—a 2.91-kilometer road path. The truck is now streaming GPS telemetry every 3 seconds along that exact road network.*
>
> *Watch both screens: the citizen app updates the incoming truck marker smoothly with turning angles and dynamic ETAs. The admin dashboard reflects the vehicle's position, speed, and real-time socket events in the collapsible event panel."*

---

### 2:15 - 3:00 | Step 4: Arrival Verification & Green Points Award

**Action:** Observe the terminal and screens as the vehicle enters the 300 m arrival zone.

**What to Say:**
> *"As the truck reaches the 250-meter mark, it enters the 300-meter arrival zone. The simulator invokes our real arrived status endpoint.*
>
> *The server checks the vehicle's coordinates against the pickup destination: distance is within 300 meters and the GPS timestamp is less than 60 seconds fresh. The check passes.*
>
> *The mobile app transitions to 'Driver Has Arrived'. Following collection and scale verification, the driver submits a verified weight of 5 kilograms, awarding 25 Green Points to the citizen. The citizen screen instantly updates with the completion celebration and earned rewards."*

---

## Plan B: Fallbacks for Connectivity or Network Issues

| Issue | Quick Diagnostic | Recovery Action (Plan B) |
| :--- | :--- | :--- |
| **OSRM Timeout / Rate-Limited** | Terminal shows warning: `OSRM HTTP error` or connection timeout. | **Automatic:** The script automatically falls back to `backend/scripts/demo-route.json`, a pre-computed road route for the Sangli demo path. No manual intervention required. |
| **Wi-Fi / LAN IP Changed** | Mobile app displays "Unable to connect to backend" or offline overlay. | Run demo entirely in local browser: open mobile app via Web (`cd mobile-app && npx expo start --web`) at `http://localhost:8081` alongside the admin dashboard on `localhost`. |
| **Port 4000 In Use** | Terminal logs `EADDRINUSE: address already in use :::4000`. | Stop any running node processes: `Get-Process node \| Stop-Process -Force` (PowerShell) and re-run `node src/app.js`. |
| **Reset Everything to Pristine State** | Need to restart demo from scratch during presentation. | Run `npm run demo:seed` in `backend/`. It cleanly purges all prior demo artifacts and provisions a fresh pickup in 2 seconds. |

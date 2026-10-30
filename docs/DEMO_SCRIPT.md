# Smart Waste Pickup, Live Fleet Tracking & Rewards Platform – Demo Runbook

A comprehensive, step-by-step presentation runbook designed for stakeholders, evaluators, and team members demonstrating real-time vehicle GPS tracking, multi-vehicle live fleet dispatch, server-side geofencing, citizen-collector synchronization, gamification (Green Points, milestone badges, reward redemptions), and operational analytics on the WasteWise platform.

---

## 1. Quick Reference & System Credentials

### Port Allocation
- **Backend API & WebSockets:** `http://localhost:4000` (Socket.IO enabled)
- **Admin Dashboard:** `http://localhost:5173`
- **Mobile Application:** `http://localhost:8081` (Expo web preview or physical Expo Go client)

### Verified Demo Credentials

| Role | Email | Password | Persona & Key Demonstration Feature |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@wastewise.local` | `Admin@123` | Complete fleet visibility, pickup queue dispatch, vehicle management, and operational analytics. |
| **Primary Citizen** | `demo_citizen@example.com` | `DemoCitizen@123` | Active pickup tracking, live ETA, turn-by-turn road animation, arrival alerts. |
| **Gold Veteran Citizen** | `demo_citizen_priya@example.com` | `DemoCitizen@123` | 350 Green Points earned, Bronze, Silver & Gold Badges, 2 redeemed rewards. |
| **Silver Citizen** | `demo_citizen_rohan@example.com` | `DemoCitizen@123` | 175 Green Points earned, Bronze & Silver Badges, 1 redeemed Tote Bag. |
| **New Citizen** | `demo_citizen_amit@example.com` | `DemoCitizen@123` | Clean onboarding state, zero pickup history, ready for new booking. |
| **Primary Driver (01)** | `demo_collector@example.com` | `DemoCollector@123` | Driver of `DEMO-TRUCK-01` (Electric Mini Van), active trip on Station Road. |
| **Secondary Driver (02)**| `demo_collector_suresh@example.com` | `DemoCollector@123` | Driver of `DEMO-TRUCK-02` (Tata Ace Recycler EV), active trip on Shivaji Nagar. |
| **Arrived Driver (03)**  | `demo_collector_vikas@example.com` | `DemoCollector@123` | Driver of `DEMO-TRUCK-03` (Mahindra Bolero Maxi EV), arrived at Brahman Puri. |

---

## 2. Waste Categories & Lifecycle Coverage

The demo environment provisions **26 realistic pickups** across all 6 supported waste categories and all 7 state machine statuses:

### Supported Waste Categories
1. **Paper & Cardboard** (`PAPER_CARDBOARD`)
2. **Plastic** (`PLASTIC`)
3. **Metal** (`METAL`)
4. **Glass** (`GLASS`)
5. **E-Waste** (`E_WASTE`)
6. **Mixed Recyclables** (`MIXED_RECYCLABLES`)

### Lifecycle States Represented
- **`on_the_way` (In-Transit):** 2 active vehicles streaming live GPS (`DEMO-TRUCK-01` and `DEMO-TRUCK-02`).
- **`arrived`:** 1 vehicle waiting for weighing scale measurement (`DEMO-TRUCK-03`).
- **`assigned`:** 2 pickups queued on `DEMO-TRUCK-04` and `DEMO-TRUCK-05`.
- **`requested`:** 4 unassigned citizen requests (E-Waste, Glass, Plastic, Paper) ready for dispatch in `/pickups`.
- **`completed`:** 13 historical pickups with actual weights and immutable `PointsLedger` entries.
- **`cancelled` & `rejected`:** 4 records with detailed reason audits (e.g., wet food contamination, hazardous chemicals).

---

## 3. Preparation & Execution Commands

### Reset & Seed the Environment
Run at any time in `backend/`:
```bash
# Seed all 14 citizens, 6 collectors, 6 vehicles, 26 pickups, badges, and rewards idempotently
npm run demo:seed

# Optional: To clean only demo-created records without touching real NGO data
npm run demo:cleanup
```

### Start Services (if not already running)
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Admin Dashboard
cd admin-dashboard && npm run dev

# Terminal 3: Mobile App (optional web preview)
cd mobile-app && npx expo start --web
```

---

## 4. Live Simulation Modes

### Mode A: Multi-Vehicle Concurrent Fleet Simulation (Recommended for Fleet Map)
Simulates multiple electric collection trucks driving their assigned routes simultaneously through the streets of Sangli/Miraj:
```bash
cd backend
npm run demo:drive:multi -- --speed=2
```
*Tip:* To automatically verify arrival and completion at the end of both routes:
```bash
npm run demo:drive:multi -- --speed=2 --auto-arrive
```

### Mode B: Single-Vehicle Focused Tracking (Citizen & Driver Walkthrough)
Simulates `DEMO-TRUCK-01` navigating to `demo_citizen@example.com`'s doorstep on Station Road:
```bash
cd backend
npm run demo:drive -- --speed=2 --auto-arrive
```

---

## 5. Walkthrough Guide for Evaluators & Stakeholders

### Segment 1: Operational Analytics & Dashboard Summary
1. Open Admin Dashboard at `http://localhost:5173/` and log in with `admin@wastewise.local` / `Admin@123`.
2. Navigate to **Impact Dashboard** (`/`) and **Analytics** (`/analytics`).
3. Point out:
   - **Total waste diverted** across all 6 categories (Plastic, Paper, Metal, Glass, E-Waste).
   - **Monthly collection trend** charts populated with historical completed pickups.
   - **Green Points distributed** and reward redemption statistics.

### Segment 2: Pickup Queue & Smart Dispatch
1. Navigate to **Pickups Queue** (`/pickups`).
2. Show the pending `requested` pickups (E-Waste from Wanless Hospital Road, Glass from Vishrambag).
3. Demonstrate assigning a vehicle or reviewing assigned collectors.
4. Show the rejected pickups with audit reasons for quality control.

### Segment 3: Live Fleet Tracking & Multi-Driver Synchronization
1. Navigate to **Live Fleet Map** (`/fleet`).
2. Start the multi-driver simulator: `npm run demo:drive:multi -- --speed=2` in your terminal.
3. Observe on the map:
   - Multiple vehicle markers moving along real OpenStreetMap road routes.
   - Vehicles updating their speeds, turning angles (headings), and GPS timestamps.
   - The real-time telemetry feed in the collapsible event panel.
   - Server-enforced rate limiting (1 update per 3s per vehicle).

### Segment 4: Citizen Mobile Experience & Gamification
1. In another browser tab or mobile simulator, open the Citizen App and log in as `demo_citizen_priya@example.com` / `DemoCitizen@123`.
2. Navigate to **Rewards & Badges**:
   - Highlight her **Gold Milestone Badge** (300+ Green Points).
   - Show her points ledger transactions from verified recyclable pickups.
   - Show her active redemption vouchers with unique codes (`WW-RED-78210-ECO`).
3. Next, log in as `demo_citizen@example.com` and open the **Track Pickup** screen:
   - Observe the incoming truck marker navigating along Station Road.
   - Point out the 300m arrival boundary circle.
   - When the truck enters the 300m zone, observe the server-side arrival verification and reward celebration upon completion.

---

## 6. Edge Case & Protection Recipes

### Geofence Enforcement (Premature Arrival Rejection)
Demonstrates that drivers cannot spoof arrival when outside the 300m boundary:
```bash
cd backend
node scripts/simulateDriver.js --speed=20 --stop-at-meters=450 --auto-arrive
```
**Server Response (HTTP 400 Bad Request):**
```json
{
  "error": "Cannot mark arrived: Vehicle is ~443m away from the pickup location (allowed radius: 300m). Move closer to the destination."
}
```

### Stale GPS Protection
Demonstrates that GPS timestamps older than 60 seconds are rejected by the server:
```bash
cd backend
node test_demo_driver_rejection.js
```
All 3 real-server assertions pass cleanly.

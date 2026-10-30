# Smart Waste Pickup, Live Fleet Tracking & Rewards Platform

A comprehensive, full-stack smart waste collection and green rewards platform developed for **Pruthvi Zero Waste Foundation (NGO)** to streamline recyclable waste collection through on-demand citizen booking, live vehicle GPS tracking, an administrative dispatch and fleet monitoring dashboard, a dedicated collector/driver mobile interface, an automated Green Points reward ledger, full collector onboarding with driving license verification, and downloadable PDF/CSV/Excel analytics reporting.

---

## Overview

The **Smart Waste Pickup, Live Fleet Tracking & Rewards Platform** replaces traditional phone-based recyclable waste pickup requests with a complete digital workflow.

The system consists of:

* A **React Native mobile application** (Expo SDK 52) with distinct flows for citizens and collectors.
* An **interactive mobile map engine** leveraging Leaflet 1.9.4 inside a sandboxed `react-native-webview` powered by **OpenStreetMap standard raster tiles**, rendering turn-by-turn road routes, smooth SVG vehicle marker interpolation, compass heading rotation, and dynamic ETAs without proprietary Google Maps SDKs or API keys.
* An **admin dashboard** (React 19 / Vite 8 + Tailwind CSS v4 + Leaflet) for dispatching vehicles, reviewing collector applications, monitoring live fleet telemetry, and tracking collection analytics.
* A **Node.js 18+ & Express.js 4 REST & Socket.IO 4.8 API** for backend business logic, room-isolated real-time telemetry streaming, and server-enforced 300-meter arrival geofencing.
* A **PostgreSQL database** managed via Prisma ORM 5.20 for type-safe relational data persistence and transactions.
* A **Collector Onboarding Workflow** featuring driving license registration, license photo proof verification, admin review with vehicle assignment, mandatory rejection reasoning, and automated role activation.
* A **Multi-Format Reporting & Analytics Engine** generating high-fidelity branded **PDFs** (PDFKit), streaming **CSV** datasets, and styled **Excel** workbooks (ExcelJS) for citizens and administrators with timeframe and category filters.
* **JWT-based authentication** with strict role-based access control (`citizen`, `collector`, `admin`).
* **OSRM integration** for turn-by-turn road geometry routing and real-time ETAs with committed offline fallback route support.

Citizens can request recyclable waste pickups, track incoming collection vehicles live on a map, earn Green Points, unlock badges, redeem available rewards, and download annual recycling impact audits. Collectors apply for onboarding, manage their daily pickup route on mobile, broadcast GPS telemetry with automatic stationary heartbeats, verify arrival at the doorstep, and record verified waste weights. Administrators dispatch vehicles, review driver applications, monitor live fleet movements across the city, manage users and rewards, and inspect multi-format operational analytics.

---

## Problem Statement

Recyclable waste collection can become inefficient when pickup requests are handled through phone calls or manual processes. Such systems make it difficult to coordinate drivers, schedule pickups reliably, verify when a collection vehicle actually arrives, maintain accurate records of collected waste, and encourage citizens to participate consistently in recycling activities.

The platform provides a centralized digital solution where citizens can book pickups with exact GPS coordinates and monitor incoming collection vehicles in real time. Administrators gain full visibility over their fleet operations, while collectors follow a guided workflow on mobile to execute assigned jobs.

The platform incorporates an immutable **Green Points ledger and gamification system** (badges and redeemable catalog rewards) to encourage citizens to participate regularly in responsible waste segregation and recycling.

---

## Objectives

* Replace phone-based waste pickup requests with an on-demand digital booking system capturing exact GPS coordinates and reverse geocoding.
* Provide citizens with real-time map tracking, turn-by-turn road routes, dynamic ETAs, and amber "Last Known Location" stale-GPS detection for assigned collection vehicles.
* Provide collectors with a dedicated mobile workflow to apply for onboarding, verify driving licenses, manage assigned jobs, stream telemetry, verify arrivals within a 300-meter radius, and submit verified scale waste weights.
* Provide administrators with a live interactive fleet map, collector application approvals, conflict-guarded vehicle dispatching tools, and operational analytics.
* Provide multi-format downloadable audit reports (PDF, CSV, Excel) for citizen recycling contributions and NGO administrative accounting.
* Implement strict security: server-enforced arrival checks, room-isolated WebSocket broadcasts, explicit production CORS origin allowlisting, and role-based authorization.
* Track citizen participation through an immutable Green Points ledger.
* Encourage recycling through achievement badges and redeemable catalog rewards.
* Maintain clean audit records and data retention policies for high-frequency GPS telemetry.

---

## Key Features

### Citizen Mobile Application (Expo / React Native)
* User registration and login with secure JWT session storage.
* Citizen profile and green impact tracking with verified waste metrics.
* On-demand recyclable waste pickup requests with device GPS location capture and reverse geocoding.
* **Real-time vehicle map tracking (`TrackPickupScreen`):**
  * Interactive OpenStreetMap standard tiles rendered via sandboxed Leaflet WebView.
  * Destination pin, assigned vehicle marker with smooth animation easing, and turn-by-turn road route geometry.
  * Dynamic bottom sheet with live ETA in minutes/seconds, remaining distance, and collector contact details.
  * Status stepper (`assigned` -> `on_the_way` -> `arrived` -> `completed`).
* **Telemetry Health & GPS Freshness Indicator:**
  * Displays live connection badge with drift-calibrated update age (e.g., "updated 3s ago").
  * When GPS telemetry is interrupted for >= 30 seconds during transit, the UI dynamically switches to an amber **"GPS Stale / Last Known Location"** warning and pauses live ETA counting.
  * Stale warnings are automatically suppressed once the vehicle arrives at the doorstep.
* Green Points tracking, immutable wallet history, tier progression badges, and rewards catalog redemption.
* **Downloadable Citizen Impact Reports:** Download verified recycling summaries in branded PDF or CSV formats.

### Admin Dashboard (React 19 / Vite 8 + Tailwind CSS v4 + Leaflet)
* Admin authentication and role-based access control with automatic socket teardown upon expiration.
* **Interactive Live Fleet Map (`/fleet`):** Real-time monitoring of all active fleet vehicles, current speeds, headings, and active pickup counts on OpenStreetMap.
* **Fleet Vehicle Management (`/vehicles`):** Registration, capacity, driver assignment, and soft deactivation.
* **Conflict Guarding (`HTTP 409`):** Strictly blocks deactivating a vehicle or reassigning its driver while active pickup assignments are in transit.
* **Vehicle Dispatch Modal:** Assign active fleet vehicles to requested pickups with real-time driver availability.
* **Collector Application Review (`/collector-applications`):** Inspect applicant details, driving license numbers, experience, and uploaded license photos; approve with dedicated vehicle assignment or reject with mandatory justification.
* **Operational Analytics & Multi-Format Reports (`/reports`):**
  * Interactive metrics for total waste tonnage, monthly collection volume, trend lines, and waste category breakdown (Plastic, Paper, Metal, Glass, E-Waste, Mixed).
  * Export operational records to **PDF** (PDFKit), **CSV** datasets, or **Excel** workbooks (ExcelJS) with customizable timeframes (`7d`, `30d`, `90d`, `all`) and material stream filtering.
* Address Coordinates Correction: Auto-geocode or manually set coordinates on pickups with missing location data.
* User, collector staff, badge tier, and reward catalog management.

### Collector Onboarding & Driver Lifecycle
* **Join as a Collector Registration:** Prospective drivers register via mobile or web with name, phone, email, experience years, commercial driving license number, vehicle preference, and license photo proof.
* **Application Review Queue:** Administrators review incoming applications in the Admin Dashboard.
* **Enforced Login Restrictions:** Unapproved applicants attempting to log in are blocked with `HTTP 403 Forbidden` ("Your collector application is currently under review by administrators").
* **Rejection with Reason:** If rejected, the applicant's login attempts return the exact admin justification (e.g., "Your collector application was rejected: Commercial driving license photo unclear"). Drivers can update and resubmit.
* **Approval & Vehicle Binding:** When approved, the administrator binds the driver to an available active fleet vehicle. The account role automatically promotes to `collector`.
* **Automatic Role-Based Navigation:** Upon login, verified collectors are routed directly to `DriverNavigator`.
* **Trip Lifecycle Execution:**
  * `on_the_way`: Activates live GPS streaming and marks trip start.
  * `arrived`: Validates doorstep proximity; server cryptographically enforces `<=` 300 m arrival radius and `<=` 60 s fresh GPS telemetry.
  * `completed`: Prompts for scale-measured waste weight (kg) and commits Green Points to the citizen's ledger.
* Automated 10-second stationary location heartbeat to keep telemetry alive during traffic stops.
* Built-in multi-vehicle route simulator (`scripts/simulateDriver.js --multi --loop`) for comprehensive testing.

### Downloadable Reports & Analytics Engine
* **Multi-Format Export Support:**
  * **Branded PDF Reports:** Generated server-side using **PDFKit** with Pruthvi Zero Waste Foundation branding, summary statistics, tabular audit logs, and verification sign-offs.
  * **Streaming CSV Datasets:** Standard RFC 4180 comma-separated records for data analysis and external auditing.
  * **Styled Excel Workbooks:** Rich `.xlsx` spreadsheets generated via **ExcelJS** featuring header formatting, auto-sized columns, and categorized summary tabs.
* **Timeframe & Category Filtering:** Supports `7d`, `30d`, `90d`, and `all` time windows, plus individual recyclable category filtering (`PLASTIC`, `PAPER_CARDBOARD`, `METAL`, `GLASS`, `E_WASTE`, `MIXED_RECYCLABLES`).
* **Strict Tenant Isolation:** Citizens can strictly download only their own verified recycling records; administrative reports require verified `admin` role authorization.

### Green Points & Gamification
* **Immutable Transaction Ledger (`points_ledger`):** Records points earned per completed pickup (calculated deterministically based on verified scale weight or quantity band) and points spent on catalog redemptions.
* **Badges:** Milestone achievement tiers (Bronze, Silver, Gold) automatically unlocked as lifetime points accumulate.
* **Rewards Catalog:** Tangible rewards redeemable by citizens using accumulated points.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Mobile Application** | React Native (Expo) | Expo ~57.0.31 / RN 0.86.3 | Cross-platform mobile app for citizens and collectors |
| **Mobile Maps** | react-native-webview + Leaflet | WebView 13.16.1 / Leaflet 1.9.4 | Sandboxed interactive Leaflet map with OpenStreetMap standard raster tiles, SVG easing, and heading rotation |
| **Mobile Gestures & Animation** | Reanimated & Worklets | reanimated 4.5.1 / worklets 0.10.1 | High-performance mobile UI transitions and bottom sheet mechanics |
| **Mobile Bottom Sheet** | @gorhom/bottom-sheet | ^5.2.14 | Three-tier snap bottom sheet for ETA and trip details |
| **Admin Dashboard** | React + Vite | React 19.2.8 / Vite 8.2.1 | Single-page administrative web management portal |
| **Dashboard Styling** | Tailwind CSS | ^4.3.3 | Modern CSS design system and utility styling |
| **Web Fleet Maps** | Leaflet + react-leaflet | Leaflet 1.9.4 / react-leaflet 5.0.0 | Interactive OpenStreetMap fleet dispatching and live telemetry |
| **Backend Runtime** | Node.js | >= 18.0.0 (Tested on v22.20) | Central API server runtime |
| **API Framework** | Express.js | ^4.21.1 | REST routing, middleware, and request validation |
| **Real-Time Telemetry** | Socket.IO | ^4.8.4 | Bi-directional room-isolated WebSocket telemetry streaming |
| **Database** | PostgreSQL | 15+ / 16+ | Relational data persistence with strict foreign key constraints |
| **ORM** | Prisma ORM | ^5.20.0 | Database schema migrations, queries, and atomic transactions |
| **Document Generation** | PDFKit & ExcelJS | pdfkit ^0.20.2 / exceljs ^4.4.0 | Server-side branded PDF reports and formatted Excel `.xlsx` spreadsheets |
| **Routing Engine** | OSRM | Public API / Fallback | Turn-by-turn road geometry and dynamic ETA calculation |
| **Authentication** | JSON Web Tokens (JWT) | jsonwebtoken ^9.0.2 / bcryptjs ^2.4.3 | Role-based authentication across REST and WebSocket handshakes |
| **Schema Validation** | Zod | ^3.23.8 | Strict runtime request body and parameter validation |

---

## System Architecture

```text
                                  ┌────────────────────────────────────────────────────────┐
                                  │                      CITIZEN APP                       │
                                  │              (React Native / Expo Go)                  │
                                  │   - Book pickup with GPS coordinates / reverse geocode │
                                  │   - OpenStreetMap Leaflet WebView with live ETA & route│
                                  │   - Green Points wallet, badges & reward catalog       │
                                  │   - Download citizen impact reports (PDF / CSV)        │
                                  └───────────────▲────────────────────────▲───────────────┘
                                                  │ REST API               │ WebSocket
                                                  │                        │ (Room: pickup:<id>)
                                                  ▼                        ▼
┌─────────────────────────────────┐       ┌────────────────────────────────────────────────┐       ┌───────────────────────────────────┐
│        COLLECTOR / DRIVER       │       │             NODE.JS + EXPRESS API              │       │          ADMIN DASHBOARD          │
│    (Driver Stack in Mobile App) │       │             SOCKET.IO WEBSOCKET                │       │     (React Vite + Tailwind CSS)   │
│ - Apply for onboarding & license├──────►│                                                │◄──────┤ - Review & approve driver apps    │
│ - View assigned pickup jobs     │REST / │ - Enforces role-based security & JWT           │REST / │ - Dispatch vehicle to pickups     │
│ - Start trip (on_the_way)       │Socket │ - Server-side arrival radius check (<=300m)    │Socket │ - Live Fleet Map (OpenStreetMap)  │
│ - Broadcast GPS + 10s heartbeat │       │ - Reassignment & deactivation 409 conflict     │       │ - Multi-format reports (PDF/Excel)│
│ - Mark arrived & weigh waste    │       │ - Multi-format report export (PDF/CSV/Excel)   │       │ - Operational analytics & rewards │
└─────────────────────────────────┘       └───▲──────────────────────▲─────────────────▲───┘       └───────────────────────────────────┘
                                              │                      │                 │
                                              │ SQL / Prisma ORM     │ HTTP Request    │ Socket Broadcast (Room: fleet:live)
                                              ▼                      ▼                 ▼
                                  ┌──────────────────────┐ ┌───────────────────┐ ┌───────────────────┐
                                  │  POSTGRESQL DATABASE │ │ OSRM ROUTING API  │ │ ADMIN SOCKET ROOM │
                                  │                      │ │                   │ │                   │
                                  │ - users, vehicles    │ │ - Turn-by-turn    │ │ - Real-time fleet │
                                  │ - pickups, locations │ │   road geometry   │ │   vehicle markers │
                                  │ - pickup_assignments │ │ - Live ETA in     │ │ - Status changes  │
                                  │ - collector_apps     │ │   seconds         │ │   across NGO      │
                                  │ - points_ledger      │ │ - Route fallback  │ │                   │
                                  └──────────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## User Roles & RBAC

### Citizen
* Create an account and log in securely.
* Request recyclable waste pickups with device GPS coordinates and reverse geocoding.
* Track assigned vehicles live on a full-screen OpenStreetMap view with dynamic ETAs and route polylines.
* Observe amber "Last Known Location" alerts if driver GPS is paused or stale.
* Earn Green Points upon verified collection and unlock achievement badges.
* Access available rewards and redeem them using earned points.
* Download personal recycling impact audit reports in PDF or CSV format.
* Cancel pickup requests prior to driver departure (`requested` or `assigned` status only).

### Collector (Driver)
* Submit an onboarding application with commercial driving license details and photo proof.
* Check application review status; receive detailed rejection explanations if rejected.
* Automatically routed to `DriverNavigator` upon login after approval.
* View assigned fleet vehicle information and active collection jobs.
* Start trips (`on_the_way`), triggering live GPS telemetry broadcasting.
* Transmit real-time location and stationary heartbeats over Socket.IO.
* Mark `arrived` once within the server-verified 300-meter arrival radius.
* Enter scale-measured waste weight (kg) and transition jobs to `completed`.

### Administrator
* Access the admin dashboard with protected credentials.
* Review incoming collector onboarding applications; approve with dedicated fleet vehicle binding or reject with mandatory justification.
* Monitor all active fleet vehicles on the interactive Live Fleet Map (`/fleet`).
* Manage fleet vehicles (`/vehicles`), assign dedicated drivers, and track capacities.
* Assign active vehicles and collectors to pending citizen pickup requests.
* Auto-geocode or manually set coordinates on pickups with missing location data.
* Inspect operational analytics: waste totals, monthly tonnage, collector performance, and category distributions.
* Export operational reports to PDF, CSV, or formatted Excel spreadsheets with custom timeframes and category filters.
* Manage user accounts, collector staff, achievement badges, and reward items.

---

## Database Design

The relational PostgreSQL database is managed via Prisma ORM and contains **11 models**:

| Table | Description | Key Fields |
| :--- | :--- | :--- |
| `users` | Accounts across citizen, collector, and admin roles | `id`, `name`, `email`, `phone`, `role` (`citizen`, `collector`, `admin`), `passwordHash`, `createdAt` |
| `vehicles` | NGO fleet vehicles for waste collection operations | `id`, `registrationNo`, `type`, `capacity`, `driverId`, `isActive`, `currentLat`, `currentLng`, `currentSpeed`, `currentHeading`, `lastLocationAt` |
| `pickups` | Citizen waste pickup requests | `id`, `userId`, `wasteType`, `quantityBand`, `wasteQuantity`, `address`, `latitude`, `longitude`, `slotPeriod`, `requestedDate`, `status`, `rejectionReason` |
| `pickup_assignments` | Junction connecting vehicles to pickups | `id`, `pickupId`, `vehicleId`, `assignedById`, `assignedAt`, `startedAt`, `arrivedAt`, `completedAt`, `isActive` |
| `vehicle_locations` | Historical GPS telemetry log for audit and playback | `id`, `vehicleId`, `lat`, `lng`, `speed`, `heading`, `recordedAt` |
| `collector_applications`| Onboarding applications for prospective drivers | `id`, `applicantName`, `email`, `phone`, `licenseNumber`, `experienceYears`, `vehicleType`, `licensePhotoUrl`, `status`, `rejectionReason`, `reviewedById`, `assignedVehicleId` |
| `points_ledger` | Immutable transaction ledger for Green Points | `id`, `userId`, `pickupId`, `pointsEarned`, `pointsSpent`, `activityType`, `createdAt` |
| `badges` | Gamification achievement tiers | `id`, `name`, `minPoints`, `description`, `iconUrl` |
| `user_badges` | Many-to-many junction for user unlocked badges | `id`, `userId`, `badgeId`, `earnedAt` |
| `rewards` | Catalog of redeemable rewards | `id`, `name`, `pointsRequired`, `stock`, `description` |
| `user_rewards` | Many-to-many junction for user reward redemptions | `id`, `userId`, `rewardId`, `redeemedAt` |

---

## Live Map & Real-Time Tracking Architecture

### Mobile Leaflet WebView Architecture
The mobile application renders maps using Leaflet 1.9.4 inside a sandboxed `react-native-webview` with **OpenStreetMap standard raster tiles** (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).

* **Zero Native Map SDK Dependency:** Eliminates native Google Play Services / Google Maps SDK dependencies, API key requirements, and Android build incompatibilities.
* **Tile Reliability & Fallback:** Rejects untrusted or deprecated tile URLs in code. If primary OpenStreetMap tiles experience network failure, the WebView gracefully switches to secondary mirrors or displays an offline retry overlay.
* **Marker Easing & Rotation:** Vehicle markers animate along road segments using requestAnimationFrame Quad easing with CSS heading rotation (`rotate(${heading}deg)`).
* **Attribution Compliance:** Renders standard `© OpenStreetMap contributors` attributions.

### Telemetry Pipeline & GPS Freshness

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Collector (Phone / Simulator)
    participant Socket as Socket.IO Server
    participant DB as PostgreSQL / Prisma
    actor Citizen as Citizen App (Leaflet WebView)
    actor Admin as Admin Fleet Map (Web)

    Driver->>Socket: Socket.IO Connect (auth.token JWT)
    Socket->>DB: Verify user is collector & vehicle has active assignment
    Driver->>Socket: emit("driver:location", { lat, lng, speed, heading })
    Socket->>Socket: Rate-limit (1 update / 3s per vehicle) & schema validation
    Socket->>DB: Update vehicle (currentLat, currentLng, speed, heading, lastLocationAt)
    Note over Socket,DB: Location history throttled to 15s in vehicle_locations
    Socket->>Citizen: room(pickup:id).emit("vehicle:location", data)
    Socket->>Admin: room(fleet:live).emit("fleet:vehicle_location", data)
    Citizen->>Citizen: Update vehicleLocation state (2s UI throttling)
    Citizen->>Citizen: Leaflet WebView animates vehicle marker to new coordinates
```

* **Stale GPS Detection:** If no telemetry update is received for 30 seconds while a pickup is `on_the_way`, the mobile interface highlights an amber **"Last Known Location"** banner, pauses the live ETA countdown, and displays the exact time elapsed since the last update.
* **Doorstep Geofencing:** When the driver taps "Mark Arrived", the server validates that the vehicle's last recorded location is `<=` 300 meters from the pickup destination and that the telemetry timestamp is `<=` 60 seconds fresh.

---

## REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header.

### Authentication
* `POST /api/auth/register` — Citizen registration with name, email/phone, password.
* `POST /api/auth/login` — Unified login for citizens, collectors, and admins. Enforces collector onboarding approval status checks.

### Collector Onboarding & Applications
* `POST /api/collector-applications/apply` — Public/applicant registration for prospective waste collectors. Accepts applicant details, driving license number, experience years, vehicle preference, and license photo proof.
* `GET /api/collector-applications/status?email=<email>` — Check current onboarding review status (`pending`, `approved`, `rejected` with explanation).
* `GET /api/admin/collector-applications` — Admin endpoint to list all applications with optional `?status=pending|approved|rejected` and search filters.
* `PATCH /api/admin/collector-applications/:id/status` — Admin approves application (with vehicle binding) or rejects with mandatory justification. Promotes user role to `collector`.

### Pickups & Tracking
* `POST /api/pickups` — Create pickup request with `address`, `latitude`, `longitude`, `wasteType`, `quantityBand`, `slotPeriod`, `requestedDate`.
* `GET /api/pickups` — List user's pickups (citizens see own; admins see all with filtering).
* `GET /api/pickups/my-impact` — Citizen lifetime waste kg, points balance, and contribution history.
* `GET /api/pickups/:id` — Detailed pickup information including assigned vehicle and driver details.
* `GET /api/pickups/:id/tracking` — Full tracking payload (vehicle coordinates, OSRM road geometry polyline, dynamic ETA, server time, GPS freshness age).
* `PATCH /api/pickups/:id/assign` — Admin assigns vehicle and collector to pickup.
* `PATCH /api/pickups/:id/status` — Admin / citizen status update (`cancelled`, `rejected` with mandatory reason).
* `PATCH /api/pickups/:id/coordinates` — Admin or citizen owner updates destination coordinates.

### Collector / Driver Endpoints
* `GET /api/driver/pickups` — List active assigned pickups and recent job history for the authenticated collector.
* `PATCH /api/driver/pickups/:id/status` — Driver lifecycle transitions (`on_the_way`, `arrived`, `completed`). Enforces server-side arrival radius check (<=300m) and rejects stale (>60s) GPS telemetry.

### Downloadable Reports & Analytics
* `GET /api/reports/citizen` — JSON summary of citizen recycling impact, verified kilograms collected, points earned, and monthly history.
* `GET /api/reports/citizen/download?format=pdf|csv` — Citizen downloadable audit report in branded PDF or CSV dataset format.
* `GET /api/reports/admin?timeframe=7d|30d|90d|all&category=ALL|<type>` — JSON operational analytics for NGO administration.
* `GET /api/reports/admin/download?format=pdf|csv|xlsx&timeframe=30d` — Admin multi-format operational report in branded PDF, CSV dataset, or styled Excel (.xlsx) workbook.

### Admin Fleet Management
* `GET /api/admin/vehicles/live` — Returns all active vehicles with latest GPS coordinates and active pickups for live fleet map.
* `GET /api/admin/vehicles` — List all fleet vehicles with driver details and assignment status.
* `POST /api/admin/vehicles` — Register new vehicle (validates driver has role `collector` and no other vehicle).
* `PATCH /api/admin/vehicles/:id` — Update vehicle or driver (returns `409 Conflict` if vehicle has active assignments).
* `DELETE /api/admin/vehicles/:id` — Deactivate vehicle (returns `409 Conflict` if vehicle has active assignments).

### Points, Badges, Rewards & Meta
* `GET /api/points/balance` — Current user Green Points balance.
* `GET /api/points/ledger` — Transaction history of earned and redeemed points.
* `GET /api/badges` — All badge achievement tiers.
* `GET /api/badges/my-badges` — Badges unlocked by authenticated user.
* `GET /api/rewards` — Available reward catalog items.
* `POST /api/rewards/:id/redeem` — Citizen redeems reward using Green Points.
* `GET /api/rewards/my-rewards` — Rewards redeemed by user.
* `GET /api/meta` — Platform configuration enums (waste types, quantity bands, slot periods).
* `POST /api/uploads` — Authenticated photo upload for pickups and driving license proofs.

---

## WebSocket Events Reference (Socket.IO)

All Socket.IO connections require a valid JWT passed in `auth.token`.

| Event Name | Direction | Room | Payload | Description |
| :--- | :--- | :--- | :--- | :--- |
| `join:pickup` | Client -> Server | — | `{ pickupId: string }` | Subscribes citizen, assigned driver, or admin to a pickup room. |
| `leave:pickup` | Client -> Server | — | `{ pickupId: string }` | Unsubscribes client from a pickup room. |
| `join:fleet` | Client -> Server | — | — | Subscribes administrator to live fleet monitoring. |
| `driver:location` | Driver -> Server | — | `{ lat, lng, speed, heading }` | Collector transmits real-time GPS telemetry (rate-limited to 1 update / 3s). |
| `vehicle:location` | Server -> Client | `pickup:<id>` | `{ vehicleId, registrationNo, lat, lng, speed, heading, recordedAt, serverTime }` | Broadcast to citizen tracking screen. |
| `fleet:vehicle_location` | Server -> Client | `fleet:live` | `{ vehicleId, registrationNo, driverName, lat, lng, speed, heading, recordedAt }` | Broadcast to admin live fleet map. |
| `pickup:status` | Server -> Client | `pickup:<id>` | `{ pickupId, status, timestamp, ...extra }` | Lifecycle transition broadcast (`on_the_way`, `arrived`, `completed`). |

---

## Installation & Setup

### Prerequisites
* **Node.js:** v18.0.0 or higher (Tested on Node v22.20)
* **npm:** v9.0.0 or higher
* **PostgreSQL:** v15 or higher running locally or in Docker
* **Expo Go App:** Installed on your physical Android or iOS device (for mobile testing)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Ash-718/smart-waste-pickup-rewards.git
cd smart-waste-pickup-rewards
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` using the template below:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/wastewise?schema=public"
JWT_SECRET="your-long-secure-random-secret-key-at-least-32-chars"
JWT_EXPIRES_IN="7d"
PORT=4000

# Comma-separated list of allowed client origins.
# In production, CORS_ORIGIN MUST be set to explicit allowed domains.
CORS_ORIGIN="http://localhost:5173,http://localhost:3000"

# OSRM Routing Engine (public demo server or self-hosted)
OSRM_BASE_URL="https://router.project-osrm.org"

# Live tracking arrival verification radius (meters)
ARRIVAL_RADIUS_METERS=300

# Server-only development bypass flags (NEVER set to true in production)
DEV_SKIP="false"
DEV_SKIP_ARRIVAL_RADIUS="false"

# Location history retention period (days)
LOCATION_RETENTION_DAYS=7

# Allowed HTTPS hosts for pickup photo URLs
PHOTO_ALLOWED_HOSTS="res.cloudinary.com"
```

Initialize database tables and seed test accounts:

```bash
# Generate Prisma Client
npm run prisma:generate

# Execute database migrations
npm run prisma:migrate

# Provision demo accounts, vehicles, and active pickups
npm run demo:seed
```

Start the backend API and WebSocket server:

```bash
# Development (with nodemon auto-restart)
npm run dev

# Or standard execution
npm start
```

The API will listen at `http://localhost:4000` (Health check: `http://localhost:4000/api/health`).

---

### 3. Mobile Application Setup (Expo)

Open a second terminal:

```bash
cd mobile-app
npm install
```

Create `mobile-app/.env` using the template below:

```env
# LAN IPv4 address of your computer (required for physical devices on same Wi-Fi)
# Example: If your computer Wi-Fi IP is 192.168.1.50 or 10.76.106.27
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:4000/api
EXPO_PUBLIC_SOCKET_BASE_URL=http://YOUR_LOCAL_IP:4000

# Enables driver simulation and demo controls in development
EXPO_PUBLIC_DEMO_MODE=true

# Contact email sent in HTTP User-Agent for OpenStreetMap Nominatim geocoding
EXPO_PUBLIC_CONTACT_EMAIL=admin@wastewise.org

# OpenStreetMap standard raster tile server
EXPO_PUBLIC_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Start the Expo development server:

```bash
npx expo start -c
```

* **Physical Device (Recommended):** Ensure your phone is connected to the same Wi-Fi network as your computer. Scan the QR code using the **Expo Go** app on Android or the Camera app on iOS.
* **Web Preview:** Press `w` in the terminal to open the web bundler preview in your browser.

---

### 4. Admin Dashboard Setup (Vite)

Open a third terminal:

```bash
cd admin-dashboard
npm install
```

Create `admin-dashboard/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_SOCKET_BASE_URL=http://localhost:4000
VITE_CONTACT_EMAIL=admin@wastewise.org
VITE_DEMO_MODE=true
```

Start the Vite development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Live Fleet Simulation & Testing Guide

For testing real-time vehicle movement without physical trucks on the road, the repository includes a multi-vehicle simulator.

### Run Multi-Vehicle Fleet Simulator

In a separate terminal, run:

```bash
cd backend
npm run demo:drive:multi -- --loop
# Or run directly: node scripts/simulateDriver.js --multi --loop
```

This concurrently simulates **all 6 fleet vehicles** (`DEMO-TRUCK-01` through `DEMO-TRUCK-05` and `MH-02-WW-1001`) with:
* Real turn-by-turn road route waypoints fetched from OSRM near Miraj/Sangli.
* Coordinated telemetry emissions every 3 seconds.
* Continuous route reversal upon waypoint arrival (`--loop`).
* Automatic vehicle column updates in PostgreSQL and room-isolated Socket.IO broadcasts.

To preview fleet telemetry freshness in a table, run:

```bash
cd backend
node scripts/printDiagnosticTable.js
```

---

## Automated Test Verification Suite

The repository includes a comprehensive, automated test suite:

```bash
cd backend

# 1. Driver Onboarding & Collector Application Verification
node test_collector_onboarding.js

# 2. Downloadable Reports & Analytics Multi-Format Tests (PDF, CSV, Excel)
node test_reporting_and_analytics.js

# 3. End-to-End QA Pipeline Verification
node qa_verification_test.js

# 4. Comprehensive Security, WebSocket & Live Tracking Tests
node test_tracking_and_sockets.js

# 5. Doorstep 300m Arrival Geofence & Stale-GPS Rejection Tests
node test_demo_driver_rejection.js

# 6. Photo URL Security & Traversal Rejection Unit Tests
npm test
```

### Mobile Application Quality Checks

```bash
cd mobile-app

# Run Expo Doctor dependency and health audit (21/21 checks)
npx expo-doctor

# Check package compatibility
npx expo install --check

# Validate Android release bundle export
npx expo export -p android

# Validate Web release bundle export
npx expo export -p web
```

### Admin Dashboard Quality Checks

```bash
cd admin-dashboard

# Build production Vite bundle
npm run build
```

---

## Project Status

**Status:** Completed Implementation & Verified MVP

The platform is fully implemented, end-to-end verified, and tested across all layers.

### Implemented & Verified Functionality
* **Citizen Mobile Application:** Pickup requests, reverse geocoding, live Leaflet map tracking, dynamic ETA, Green Points wallet, badges, and rewards redemption.
* **Physical Device Live Tracking:** Verified on a physical Android smartphone (**Vivo V40** via Expo Go) with real-time GPS telemetry updates, smooth SVG marker animations, and OpenStreetMap tiles.
* **Collector Onboarding Workflow:** End-to-end application lifecycle with driving license verification, admin review queue, approval with vehicle binding, rejection reasoning, and DriverNavigator routing.
* **Multi-Format Analytics & Reports:** Server-side branded PDF (PDFKit), CSV streaming, and styled Excel (ExcelJS) generation with date and category filters.
* **Live Fleet Management:** Real-time OpenStreetMap admin fleet monitor (`/fleet`), vehicle dispatch modals, conflict locks (`HTTP 409`), and operational metric dashboards.
* **Automated Test Coverage:** 100% pass rate across backend onboarding, reporting, tracking, security, and QA verification suites.

### Known Limitations & Future Enhancements
* **Native Background Location Service:** In Expo Go, continuous background GPS streaming pauses if the screen is locked; standalone production builds will leverage `expo-task-manager` and native background location tasks.
* **Push Notifications Integration:** System notifications currently stream over active WebSockets; APNs and FCM integration via Expo Push Service is scheduled for a future iteration.
* **Self-Hosted OSRM Deployment:** Routing currently utilizes the public OSRM server with committed fallback route geometry; production deployment plans include containerized OSRM with regional OpenStreetMap `.osm.pbf` extracts.

---

## Troubleshooting Guide

### 1. Mobile App Cannot Connect to Backend (Network Error)
* **Cause:** Mobile device or emulator attempting to connect to `localhost`.
* **Solution:** Replace `localhost` in `mobile-app/.env` with your computer's actual Wi-Fi IPv4 address (e.g., `http://10.76.106.27:4000/api`). Ensure your mobile phone and development machine are on the same Wi-Fi network.

### 2. CORS Errors in Admin Dashboard
* **Cause:** Express server rejecting browser requests from `http://localhost:5173`.
* **Solution:** Ensure `CORS_ORIGIN` in `backend/.env` includes `http://localhost:5173`. In development, leaving `CORS_ORIGIN` empty permits all origins.

### 3. OpenStreetMap Tiles Rendering
* **Architecture:** The mobile app renders OpenStreetMap standard tiles inside a sandboxed `react-native-webview`. No proprietary Google Maps SDKs or API keys are required.
* **Troubleshooting:** Ensure your testing device has an active internet connection to download Leaflet from cdnjs and raster tiles from `tile.openstreetmap.org`. If an offline overlay appears, tap **Retry** once connectivity is restored.

---

## Security

The application incorporates multi-layered defense-in-depth:
* JWT-based authentication across all REST endpoints and WebSocket handshakes.
* Role-based authorization (`citizen`, `collector`, `admin`).
* Server-side arrival geofencing (`<= 300m`) and fresh GPS timestamp checks (`<= 60s`) with zero client-controlled bypasses.
* Vehicle deactivation and driver reassignment conflict locking (`HTTP 409`).
* Strict input validation with Zod schemas.
* Unguessable cryptographically random filenames for local uploads with nosniff MIME protection.
* Production CORS allowlisting rejecting untrusted browser origins.
* Sensitive credentials and `.env` files excluded from version control.

---

## Contributors

**Ashmit Sarode**  
GitHub: [Ash-718](https://github.com/Ash-718)

**Mohit Godbole**  
GitHub: [mohit-1303](https://github.com/mohit-1303)

**Amit Pawar**  
GitHub: [in-ops](https://github.com/in-ops)

---

## License

This project was developed for **Pruthvi Zero Waste Foundation (NGO)**. All rights reserved.

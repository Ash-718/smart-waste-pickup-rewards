# Smart Waste Pickup, Live Fleet Tracking & Rewards Platform

A comprehensive, full-stack smart waste collection and green rewards platform developed for **Pruthvi Zero Waste Foundation (NGO)** to streamline recyclable waste collection through on-demand citizen booking, live vehicle GPS tracking, an administrative dispatch and fleet monitoring dashboard, a dedicated collector/driver mobile interface, and an automated Green Points reward ledger.

---

## Overview

The **Smart Waste Pickup, Live Fleet Tracking & Rewards Platform** replaces traditional phone-based recyclable waste pickup requests with a complete digital workflow.

The system consists of:

* A **React Native mobile application** (Expo) with distinct flows for citizens and collectors
* An **admin dashboard** (React / Vite + Leaflet) for dispatching vehicles, monitoring live fleet telemetry, and tracking collection analytics
* A **Node.js + Express REST & Socket.IO API** for backend business logic, real-time telemetry streaming, and server-side geofencing
* A **PostgreSQL database** managed via Prisma ORM for persistent data storage
* **JWT-based authentication** with strict role-based access control (`citizen`, `collector`, `admin`)
* **OSRM integration** for turn-by-turn road geometry routing and real-time ETAs

Citizens can request recyclable waste pickups, track incoming collection vehicles live on a map, earn Green Points, unlock badges, and redeem available rewards. Collectors manage their daily pickup route, broadcast GPS telemetry with automatic stationary heartbeats, verify arrival at the doorstep, and record verified waste weights. Administrators dispatch vehicles, monitor live fleet movements across the city, manage users and rewards, and inspect waste analytics.

---

## Problem Statement

Recyclable waste collection can become inefficient when pickup requests are handled through phone calls or manual processes. Such systems make it difficult to coordinate drivers, schedule pickups reliably, verify when a collection vehicle actually arrives, maintain accurate records of collected waste, and encourage citizens to participate consistently in recycling activities.

The platform provides a centralized digital solution where citizens can book pickups with exact GPS coordinates and monitor incoming collection vehicles in real time. Administrators gain full visibility over their fleet operations, while collectors follow a guided workflow on mobile to execute assigned jobs.

The platform incorporates an immutable **Green Points ledger and gamification system** (badges and redeemable catalog rewards) to encourage citizens to participate regularly in responsible waste segregation and recycling.

---

## Objectives

* Replace phone-based waste pickup requests with an on-demand digital booking system capturing exact GPS coordinates.
* Provide citizens with real-time map tracking, turn-by-turn road routes, and dynamic ETAs for assigned collection vehicles.
* Provide collectors with a dedicated mobile workflow to manage assigned jobs, stream telemetry, verify arrivals within a 300-meter radius, and submit verified waste weights.
* Provide administrators with a live interactive fleet map, vehicle dispatching tools, conflict-guarded fleet management, and operational analytics.
* Implement strict security: server-enforced arrival checks, room-isolated WebSocket broadcasts, and role-based authorization.
* Track citizen participation through an immutable Green Points ledger.
* Encourage recycling through achievement badges and redeemable rewards.
* Maintain clean audit records and data retention policies for high-frequency GPS telemetry.
* Maintain structured records of users, pickups, points, badges, and rewards.
* Provide a scalable backend architecture for future enhancements.

---

## Key Features

### Citizen Mobile Application (Expo / React Native)
* User registration and login
* JWT-based authentication
* Citizen profile and green impact tracking
* On-demand recyclable waste pickup requests with device GPS location capture and automatic reverse geocoding
* Real-time vehicle map tracking (`TrackPickupScreen`) with assigned vehicle marker, destination pin, and road route polyline
* Dynamic bottom sheet with live ETA in minutes/seconds, distance, collector contact, and status stepper (`assigned` -> `on_the_way` -> `arrived` -> `completed`)
* Telemetry health indicator (displays "GPS signal weak" when no update is received for 30 seconds during transit; automatically suppressed once arrived)
* Green Points tracking and wallet history
* Badge system and tier progression
* Rewards catalogue and reward redemption tracking

### Admin Dashboard (React Vite + Leaflet)
* Admin authentication and role-based access control
* Automatic socket teardown and clean redirect upon JWT expiration
* Interactive Live Fleet Map (`/fleet`) showing all active vehicles, current speeds, headings, and active pickup counts on OpenStreetMap
* Fleet Vehicle Management (`/vehicles`): registration, capacity, driver assignment, and soft deactivation
* Conflict Guarding (HTTP 409): blocks deactivating a vehicle or changing its driver while active pickup assignments are in transit
* Vehicle Dispatch Modal: assign active fleet vehicles to requested pickups with real-time driver availability
* Address Coordinates Correction: allows admins to auto-geocode or manually set coordinates on pickups with missing location data
* Operational Analytics: interactive metrics for total waste tonnage, monthly collection volume, trend lines, and waste category breakdown
* User, collector staff, badge, and reward catalog management
* Monitoring of platform activities

### Collector / Driver Mobile Interface (`DriverNavigator`)
* Automatic role-based routing upon login for users with role `collector`
* Vehicle binding: displays assigned fleet vehicle registration and capacity
* Active job list with citizen contact information, waste category, and collection address
* Trip lifecycle execution:
  * `on_the_way`: activates GPS streaming and marks trip start
  * `arrived`: validates proximity to destination; server enforces <=300m arrival radius check and <=60s fresh GPS telemetry
  * `completed`: prompts for scale-measured waste weight (kg) and commits Green Points
* Automated 10-second stationary location heartbeat to keep telemetry alive during traffic stops
* Route simulator tools in development mode (`EXPO_PUBLIC_DEMO_MODE=true`) for evaluating route traversal

### Green Points System
The platform maintains a dedicated **Green Points ledger** (`points_ledger`) to track points earned by citizens through waste-related activities.

Instead of storing only a single mutable total value, the ledger provides an immutable audit trail of point transactions, activity history, and redemptions. Points are calculated deterministically based on waste quantity band or verified scale weight.

### Badges & Rewards
Citizens participate in the platform's gamification system through:
* **Badges**: Tiered achievement milestones (Bronze, Silver, Gold) automatically unlocked as lifetime points accumulate
* **Green Points**: Earned through completed recyclable waste pickups
* **Rewards**: Catalog items redeemable using available Green Points

Many-to-many relationships are used where users can unlock multiple badges and redeem multiple rewards.

---

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Mobile Application | React Native (Expo) | Cross-platform mobile app for citizens and collectors |
| Mobile Maps | react-native-webview + Leaflet | Cross-platform interactive Leaflet map with Carto Voyager tiles, smooth SVG marker easing, and turn-by-turn polylines |
| Admin Dashboard | React (Vite) + Tailwind CSS | Single-page administrative web dashboard |
| Web Fleet Maps | Leaflet + react-leaflet | Interactive OpenStreetMap fleet monitoring |
| Backend Runtime | Node.js | Central API server runtime |
| API Framework | Express.js | REST routing, middleware, and request validation |
| Real-Time Communication | Socket.IO | Bi-directional room-isolated WebSocket telemetry |
| Database | PostgreSQL | Relational database storage |
| ORM | Prisma | Schema migrations, type-safe queries, and transactions |
| Routing Engine | OSRM (Open Source Routing Machine) | Turn-by-turn road geometry and ETA calculation |
| Authentication | JSON Web Tokens (JWT) | Role-based authentication across REST and WebSockets |
| Schema Validation | Zod | Runtime request body and parameter validation |
| API Style | REST & WebSockets | Client-server communication |
| Version Control | Git & GitHub | Source code management |

---

## System Architecture

```text
                                  ┌────────────────────────────────────────────────────────┐
                                  │                      CITIZEN APP                       │
                                  │              (React Native / Expo Go)                  │
                                  │   - Book pickup with GPS coordinates / reverse geocode │
                                  │   - Real-time map tracking with live ETA & polyline    │
                                  │   - Green Points wallet, badges & reward catalog       │
                                  └───────────────▲────────────────────────▲───────────────┘
                                                  │ REST API               │ WebSocket
                                                  │                        │ (Room: pickup:<id>)
                                                  ▼                        ▼
┌─────────────────────────────────┐       ┌────────────────────────────────────────────────┐       ┌───────────────────────────────────┐
│        COLLECTOR / DRIVER       │       │             NODE.JS + EXPRESS API              │       │          ADMIN DASHBOARD          │
│    (Driver Stack in Mobile App) │       │             SOCKET.IO WEBSOCKET                │       │     (React Vite + Tailwind CSS)   │
│ - View assigned pickup jobs     ├──────►│                                                │◄──────┤ - Dispatch vehicle to pickups     │
│ - Start trip (on_the_way)       │REST / │ - Enforces role-based security & JWT           │REST / │ - Live Fleet Map (Leaflet)        │
│ - Broadcast GPS + 10s heartbeat │Socket │ - Server-side arrival radius check (<=300m)    │Socket │ - Real-time vehicle telemetry card│
│ - Mark arrived & weigh waste    │       │ - Reassignment & deactivation 409 conflict     │       │ - Pickup management & analytics   │
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
                                  │ - points_ledger      │ │   seconds         │ │   across NGO      │
                                  └──────────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## User Roles

### Citizen
Citizens can:
* Create an account and log in securely
* Request recyclable waste pickups with device GPS coordinates and reverse geocoding
* Track assigned vehicles live on a full-screen map with dynamic ETAs and route polylines
* Earn Green Points upon pickup completion
* View their points transaction history in their impact wallet
* Unlock achievement badges and view badge progress
* Access available rewards and redeem them using earned points
* Cancel pickup requests prior to driver departure (`requested` or `assigned` status only)

### Collector (Driver)
Collectors can:
* Log into the mobile app and be routed directly to `DriverNavigator`
* View assigned fleet vehicle information and active collection jobs
* Start trips (`on_the_way`), triggering live GPS telemetry broadcasting
* Transmit real-time location and stationary heartbeats over Socket.IO
* Mark `arrived` once within the server-verified 300-meter arrival radius
* Enter scale-measured waste weight (kg) and transition jobs to `completed`

### Administrator
Administrators can:
* Access the admin dashboard with protected credentials
* Monitor all active fleet vehicles on the interactive Live Fleet Map (`/fleet`)
* Manage fleet vehicles (`/vehicles`), assign dedicated collector drivers, and track capacities
* Assign active vehicles and collectors to pending citizen pickup requests
* Auto-geocode or manually set coordinates on pickups with missing location data
* Inspect operational analytics: waste totals, monthly tonnage, and category distributions
* Manage user accounts, collector staff, achievement badges, and reward items
* Perform administrative operations through protected APIs

---

## Database Design

The system uses a relational PostgreSQL database managed via Prisma ORM.

The core schema consists of **10 models** covering users, fleet vehicles, pickup assignments, GPS telemetry, gamification, and reward ownership.

| Table | Description | Key Fields |
| --- | --- | --- |
| `users` | Accounts across citizen, collector, and admin roles | `id`, `name`, `email`, `phone`, `role` (`citizen`, `collector`, `admin`), `passwordHash`, `createdAt` |
| `vehicles` | NGO fleet vehicles for waste collection operations | `id`, `registrationNo`, `type`, `capacity`, `driverId`, `isActive`, `currentLat`, `currentLng`, `currentSpeed`, `currentHeading`, `lastLocationAt` |
| `pickups` | Citizen waste pickup requests | `id`, `userId`, `wasteType`, `quantityBand`, `wasteQuantity`, `address`, `latitude`, `longitude`, `slotPeriod`, `requestedDate`, `status`, `rejectionReason` |
| `pickup_assignments` | Junction connecting vehicles to pickups | `id`, `pickupId`, `vehicleId`, `assignedById`, `assignedAt`, `startedAt`, `arrivedAt`, `completedAt`, `isActive` |
| `vehicle_locations` | Historical GPS telemetry log for audit and playback | `id`, `vehicleId`, `lat`, `lng`, `speed`, `heading`, `recordedAt` |
| `points_ledger` | Immutable transaction ledger for Green Points | `id`, `userId`, `pickupId`, `pointsEarned`, `pointsSpent`, `activityType`, `createdAt` |
| `badges` | Gamification achievement tiers | `id`, `name`, `minPoints`, `description`, `iconUrl` |
| `user_badges` | Many-to-many junction for user unlocked badges | `id`, `userId`, `badgeId`, `earnedAt` |
| `rewards` | Catalog of redeemable rewards | `id`, `name`, `pointsRequired`, `stock`, `description` |
| `user_rewards` | Many-to-many junction for user reward redemptions | `id`, `userId`, `rewardId`, `redeemedAt` |

### Simplified Relationship Structure

```text
User (Role: Citizen) ────────► Pickups ◄──────── Pickup Assignments ◄──────── Vehicle
        │                         │                     ▲                         ▲
        ▼                         ▼                     │                         │
  Points Ledger ◄─────────────────┘                     │                  User (Collector)
        │                                         User (Admin)
        ├──────────────► User Badges ────► Badges
        │
        └──────────────► User Rewards ───► Rewards
```

---

## Authentication & Authorization

The backend uses **JWT-based authentication** across both REST APIs and WebSocket handshakes.

The authentication flow is:

```text
User Login (REST /api/auth/login)
    │
    ▼
Credentials Verification (bcryptjs)
    │
    ▼
Signed JWT Generated (Contains user ID and role)
    │
    ├── REST Requests: Included in Authorization: Bearer <token>
    │       │
    │       ▼
    │   requireAuth & requireRole Middleware
    │       │
    │       ├── Citizen
    │       ├── Collector
    │       └── Admin
    │
    └── Socket.IO Handshake: Included in socket.handshake.auth.token
            │
            ▼
        JWT Handshake Middleware -> socket.user verified
```

Protected API endpoints verify the user's authentication token and role permissions before allowing access to authorized operations.

---

## Project Structure

```text
NEW_MINI_PROJECT_APP/
│
├── admin-dashboard/                 # React (Vite) Admin Web App
│   ├── src/
│   │   ├── api/                     # REST API client modules (admin.js, pickups.js, etc.)
│   │   ├── components/              # LiveFleetMap, AssignVehicleModal, ProtectedRoute, etc.
│   │   ├── pages/                   # LiveFleetPage, VehiclesPage, PickupQueuePage, etc.
│   │   └── lib/apiClient.js         # API client and socket initialization helpers
│   ├── .env.example
│   └── package.json
│
├── backend/                         # Node.js + Express API & Socket.IO Server
│   ├── scripts/
│   │   ├── cleanOldLocations.js     # 7-day location history retention pruner
│   │   └── simulateDriver.js        # Route simulator for demo telemetry
│   ├── src/
│   │   ├── config/                  # Business constants & tuning parameters
│   │   ├── controllers/             # Request handlers (driver, tracking, vehicle, etc.)
│   │   ├── db/                      # Prisma client, schema.prisma, migrations, seed.js
│   │   ├── middleware/              # JWT auth and centralized error handlers
│   │   ├── routes/                  # Express route definitions
│   │   ├── services/                # Business logic (routing, status transitions, points)
│   │   └── socket/                  # Socket.IO server, auth middleware, and rooms
│   ├── test_tracking_and_sockets.js # Comprehensive security, socket & flow test suite
│   ├── test_complete_flow.js        # Legacy end-to-end analytics & rewards test suite
│   ├── .env.example
│   └── package.json
│
├── mobile-app/                      # React Native (Expo) Mobile App
│   ├── src/
│   │   ├── api/                     # REST hooks and client calls
│   │   ├── components/              # TrackingBottomSheet, StatusStepper, VehicleMarker
│   │   ├── hooks/                   # useDriverTracking, useLiveTracking
│   │   ├── navigation/              # AppNavigator (Citizen) & DriverNavigator (Collector)
│   │   └── screens/                 # TrackPickupScreen, DriverJobScreen, BookPickupScreen
│   ├── .env.example
│   └── package.json
│
├── .gitignore                       # Git ignore rules for node_modules, .env, dumps
└── README.md
```

---

## Backend Responsibilities

The backend provides the central API and real-time coordination layer for the application.

Major responsibilities include:

* User authentication and JWT token generation/validation
* Role-based authorization (`citizen`, `collector`, `admin`)
* User and collector staff management
* Pickup lifecycle management and status state machine
* Server-side arrival verification (strictly enforced <=300m radius check, no client bypasses)
* Reassignment and vehicle deactivation conflict locking (`HTTP 409`)
* Green Points calculation and immutable transaction ledger management
* Achievement badge tier unlocking and reward catalog management
* High-frequency GPS telemetry ingestion, rate-limiting (3s), and historical persistence (15s)
* Bi-directional Socket.IO room management (`pickup:<id>`, `fleet:live`)
* OSRM turn-by-turn road geometry routing and ETA calculation
* Database migrations and operations via Prisma ORM
* Centralized API error handling and validation

---

## Pickup Workflow

```text
Citizen
   │
   ▼
Book Pickup (Captures GPS coordinates & reverse geocodes address)
   │
   ▼
Pickup Stored in Database (Status: requested)
   │
   ▼
Admin Dispatches Fleet Vehicle & Driver (Status: assigned)
   │
   ▼
Collector Starts Trip via Driver Stack (Status: on_the_way)
   │
   ├── Live GPS Telemetry Broadcast (Every movement + 10s stationary heartbeat)
   │       │
   │       ├── Citizen sees moving vehicle marker, road polyline & dynamic ETA
   │       └── Admin sees live vehicle location on OpenStreetMap Fleet Map
   │
   ▼
Collector Arrives at Doorstep (Status: arrived)
   │ (Server cryptographically validates distance <= 300m and GPS age <= 60s)
   │
   ▼
Collector Weighs Waste & Completes Job (Status: completed)
   │
   ▼
Green Points Ledger Credited & Citizen Badges Automatically Unlocked
```

---

## Green Points Workflow

```text
Citizen performs eligible activity
              │
              ▼
      Points are calculated
              │
              ▼
       Ledger transaction (points_ledger)
              │
              ▼
      User's points balance updated
              │
              ▼
       Badges unlocked / Rewards redeemed
```

The ledger-based approach allows point transactions to be represented separately rather than relying only on a manually updated total.

---

## API

The backend exposes REST APIs and real-time Socket.IO events for communication between the mobile application, admin dashboard, and server.

All protected endpoints require appropriate authentication and authorization.

### REST Endpoints Reference

#### Authentication
* `POST /api/auth/register` — Citizen registration with name, email/phone, password.
* `POST /api/auth/login` — Unified login for citizens, collectors, and admins.

#### Pickups & Tracking
* `POST /api/pickups` — Create pickup request with `address`, `latitude`, `longitude`, `wasteType`, `quantityBand`, `slotPeriod`, `requestedDate`.
* `GET /api/pickups` — List user's pickups (citizens see own; admins see all with filtering).
* `GET /api/pickups/my-impact` — Citizen lifetime waste kg, points balance, and contribution history.
* `GET /api/pickups/:id` — Detailed pickup information including assigned vehicle and driver details.
* `GET /api/pickups/:id/tracking` — Full tracking payload (vehicle coordinates, OSRM road geometry polyline, dynamic ETA in seconds, driver card).
* `PATCH /api/pickups/:id/assign` — Admin assigns vehicle and collector to pickup.
* `PATCH /api/pickups/:id/status` — Admin / citizen status update (`cancelled`, `rejected` with mandatory reason).
* `PATCH /api/pickups/:id/coordinates` — Admin or citizen owner (while `requested`) updates destination latitude and longitude.

#### Collector / Driver Endpoints
* `GET /api/driver/pickups` — List active assigned pickups for authenticated collector.
* `PATCH /api/driver/pickups/:id/status` — Driver lifecycle transitions (`on_the_way`, `arrived`, `completed`). Enforces server-side arrival radius check (<=300m) and rejects stale (>60s) GPS telemetry.

#### Admin Fleet Management
* `GET /api/admin/vehicles/live` — Returns all active vehicles with latest GPS coordinates and active pickups for live fleet map.
* `GET /api/admin/vehicles` — List all fleet vehicles with driver details and assignment status.
* `POST /api/admin/vehicles` — Register new vehicle (validates driver has role `collector` and no other vehicle).
* `PATCH /api/admin/vehicles/:id` — Update vehicle or driver (returns `409 Conflict` if vehicle has active assignments).
* `DELETE /api/admin/vehicles/:id` — Deactivate vehicle (returns `409 Conflict` if vehicle has active assignments).
* `POST /api/admin/pickups/:id/assign` — Assign active vehicle and collector to pickup.
* `PATCH /api/admin/pickups/:id/coordinates` — Admin endpoint to set or correct destination coordinates.

#### Operational Analytics
* `GET /api/admin/dashboard/summary` — High-level summary counters.
* `GET /api/admin/analytics/overview` — Aggregated waste tonnage, active collectors, and completed pickups.
* `GET /api/admin/analytics/monthly` — Monthly waste collection metrics.
* `GET /api/admin/analytics/trends` — Multi-month historical collection trend lines.
* `GET /api/admin/analytics/waste-category` — Waste distribution by material category.

#### Points, Badges, Rewards & Meta
* `GET /api/points/balance` — Current user Green Points balance.
* `GET /api/points/ledger` — Transaction history of earned and redeemed points.
* `GET /api/badges` — All badge achievement tiers.
* `GET /api/badges/my-badges` — Badges unlocked by authenticated user.
* `POST /api/badges` — Admin creates new badge tier.
* `GET /api/rewards` — Available reward items.
* `POST /api/rewards` — Admin creates new reward item.
* `POST /api/rewards/:id/redeem` — Citizen redeems reward using Green Points.
* `GET /api/rewards/my-rewards` — Rewards redeemed by user.
* `GET /api/meta` — Platform configuration enums (waste types, quantity bands, slot periods).
* `POST /api/uploads` — Upload photo proof for pickups.

#### Photo Uploads & Static Storage
* `POST /api/uploads` — Authenticated photo upload for pickups (requires `requireAuth`). Accepts JPEG, PNG, and WebP images up to 5MB. When Cloudinary credentials are not configured (`CLOUDINARY_*` empty), the server automatically falls back to local disk storage in `backend/uploads/`.
* `GET /uploads/<filename>` — Static route serving locally stored pickup images with security header `X-Content-Type-Options: nosniff`.
  * **Public Serving & Random Filenames:** Files in `/uploads` are served publicly by the web server. To prevent guessing or enumeration, files are saved with unguessable, cryptographically random filenames generated at runtime (e.g., `pickup_<timestamp>_<hex>.<ext>`). Directory indexing is disabled.
  * **Validation & Host Allowlist:** When creating pickups, `photoUrl` accepts either local relative paths (`/uploads/<random filename>.<ext>`) or HTTPS URLs hosted on trusted domains configured in `PHOTO_ALLOWED_HOSTS` (defaults to `res.cloudinary.com`). Encoded traversal sequences (`%2e%2e`, `%2f`, `%5c`, `..`) and untrusted protocols (`http:`, `javascript:`, `data:`) are strictly rejected.

### Real-Time WebSocket Events (Socket.IO)

All Socket.IO connections require a valid JWT passed in `auth.token`.

| Event Name | Direction | Room | Payload | Description |
| --- | --- | --- | --- | --- |
| `join:pickup` | Client -> Server | — | `{ pickupId: string }` | Subscribes citizen, assigned driver, or admin to a pickup room. |
| `leave:pickup` | Client -> Server | — | `{ pickupId: string }` | Unsubscribes client from a pickup room. |
| `join:fleet` | Admin -> Server | — | — | Subscribes admin dashboard to real-time live fleet updates. |
| `driver:location` | Driver -> Server | — | `{ lat, lng, speed, heading }` | Collector broadcasts GPS coordinates. Validated and throttled. |
| `vehicle:location` | Server -> Client | `pickup:<id>` | `{ pickupId, vehicleId, registrationNo, driverId, driverName, lat, lng, speed, heading, recordedAt }` | Broadcast to citizen tracking room for live vehicle marker movement and dynamic ETA calculation. |
| `fleet:vehicle_location` | Server -> Admin | `fleet:live` | `{ vehicleId, registrationNo, driverId, driverName, lat, lng, speed, heading, recordedAt }` | Dedicated real-time broadcast to admin dashboard live fleet map. |
| `pickup:status` | Server -> Client | `pickup:<id>` | `{ pickupId, status, timestamp, ...extra }` | Emitted when pickup transitions (`on_the_way`, `arrived`, `completed`, `cancelled`, `rejected`). |
| `fleet:pickup_status` | Server -> Admin | `fleet:live` | `{ pickupId, status, timestamp, ...extra }` | Broadcast to admin fleet map for job state synchronization. |
| `join:error` | Server -> Client | — | `{ error: string }` | Emitted when a client attempts to join an unauthorized room. |
| `join:success` | Server -> Client | — | `{ room, pickupId, status }` | Acknowledges successful room subscription. |

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/Ash-718/smart-waste-pickup-rewards.git
cd smart-waste-pickup-rewards
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Configure your `.env` file based on `backend/.env.example`.

Run database migrations and seed development fixtures:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

> **Note:** The seed script (`npm run seed`) is for development and testing purposes only.

Start the backend server:

```bash
npm start
```

The API and Socket.IO server will listen on `http://localhost:4000`.

> **Process Lifecycle Note:** `npm start` executes `node src/app.js` directly. If a fatal unhandled error occurs, the server logs the error and exits with code 1 without auto-restarting.
> * For **local development**, use `npm run dev` which uses `nodemon` to automatically restart on file changes and recoverable errors.
> * For **production environments**, run the backend under a process manager (such as [PM2](https://pm2.keymetrics.io/), systemd, or a Docker container with `restart: unless-stopped`) to ensure automatic process restarts after fatal failures.

### 3. Mobile Application Setup

Open a second terminal:

```bash
cd mobile-app
npm install
npx expo start
```

Start the React Native application using Expo. Scan the QR code with the Expo Go app on your physical mobile device, or press `a` for Android Emulator / `i` for iOS Simulator.

> **Important Note for Standalone Builds (`app.json`):**
> When generating standalone native production builds (via EAS Build, APK, or iOS Archive) rather than running in Expo Go:
> * **Location Permissions:** Explicit permission strings must be configured in `mobile-app/app.json` under the `expo-location` plugin (`locationWhenInUsePermission` with `isIosBackgroundLocationEnabled: false` since the application operates foreground-only) so that native iOS (`NSLocationWhenInUseUsageDescription`) and Android manifest entries are properly compiled.
> * **Map Engine:** The mobile application renders maps via Leaflet inside `react-native-webview` with Carto Voyager tiles. No proprietary native map SDKs or Google Maps API keys are required for Android or iOS builds.

### 4. Admin Dashboard Setup

Open a third terminal:

```bash
cd admin-dashboard
npm install
npm run dev
```

The admin dashboard will be available at `http://localhost:5173`.

---

## Environment Variables

Sensitive configuration should be stored in environment variables rather than committed to GitHub.

> **Important:** Do not commit actual passwords, JWT secrets, API keys, or other sensitive credentials to the repository.

### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/wastewise?schema=public"
JWT_SECRET="your-long-secure-random-secret"
JWT_EXPIRES_IN="7d"
PORT=4000

# Comma-separated list of allowed client origins.
# In production, CORS_ORIGIN MUST be set to explicit allowed domains (e.g. "https://admin.wastewise.app,https://wastewise.app").
# Do NOT leave it blank or wildcard in production.
CORS_ORIGIN="http://localhost:5173,http://localhost:3000"

# OSRM Routing Engine (public demo or self-hosted)
OSRM_BASE_URL="https://router.project-osrm.org"

# Live tracking arrival verification radius (meters)
ARRIVAL_RADIUS_METERS=300

# Server-only development bypass flags (NEVER client-controlled)
DEV_SKIP="false"
DEV_SKIP_ARRIVAL_RADIUS="false"

# Location history retention period (days)
LOCATION_RETENTION_DAYS=7

# Allowed HTTPS hosts for pickup photo URLs (comma-separated, default: res.cloudinary.com)
PHOTO_ALLOWED_HOSTS="res.cloudinary.com"
```

### Mobile App (`mobile-app/.env`)

```env
# LAN IP of your host machine (required for physical iOS / Android devices)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:4000/api
EXPO_PUBLIC_SOCKET_BASE_URL=http://192.168.1.100:4000

# Enables driver simulation and demo controls in development (set to false for production)
EXPO_PUBLIC_DEMO_MODE=false

# Contact email sent in HTTP User-Agent for OpenStreetMap Nominatim geocoding
EXPO_PUBLIC_CONTACT_EMAIL=your-email@example.com

# Carto Voyager raster tile server (default for mobile Leaflet map)
EXPO_PUBLIC_TILE_URL=https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
```

> [!NOTE]
> **Tile Server Usage Note:** The mobile application defaults to Carto Voyager raster tiles (`https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`) with OpenStreetMap and CARTO attributions. For commercial, enterprise, or high-volume production deployments, configure `EXPO_PUBLIC_TILE_URL` to point to a commercial provider with a dedicated API key (e.g., CARTO Enterprise, Mapbox, Stadia Maps) or a self-hosted tile server in compliance with CARTO and OpenStreetMap tile usage policies.


### Admin Dashboard (`admin-dashboard/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_SOCKET_BASE_URL=http://localhost:4000
VITE_CONTACT_EMAIL=your-email@example.com
```

---

## Live Demo Guide (With Route Simulator)

Follow this step-by-step workflow to demo the entire collection lifecycle:

1. **Start Services:**
   * Backend: `cd backend && npm start` (`http://localhost:4000`)
   * Admin Dashboard: `cd admin-dashboard && npm run dev` (`http://localhost:5173`)
   * Mobile App: `cd mobile-app && npx expo start`
2. **Citizen Books Pickup:**
   * Log into Mobile App as a citizen.
   * Navigate to **Book Pickup**.
   * Tap **"Use Current GPS Location"** to record exact coordinates and autofill the reverse-geocoded address. (If typed manually, the app auto-geocodes on submit).
   * Submit the booking request.
3. **Admin Dispatches Vehicle:**
   * Open Admin Dashboard at `http://localhost:5173` and log in as Admin.
   * Go to **Pickup Queue**, find the newly requested pickup, and click **Assign Vehicle**.
   * Select an active fleet vehicle with an assigned collector.
4. **Driver Starts Trip & Simulates Telemetry:**
   * In Mobile App, log out and log in as Collector.
   * The app opens `DriverNavigator`. Select the assigned job and tap **"Start Trip"** (`on_the_way`).
   * Live GPS telemetry activates. If running in demo mode (`EXPO_PUBLIC_DEMO_MODE=true`), click **"Start Route Simulation"** to simulate driving along the road network.
5. **Real-Time Citizen Tracking & Admin Fleet Map:**
   * In a separate mobile simulator or browser window, open the citizen's **Track Pickup** screen: observe the vehicle marker moving along the road polyline with dynamic ETA updates.
   * On Admin Dashboard, open **Live Fleet Map** (`/fleet`): observe the vehicle marker updating across the map.
6. **Arrival & Completion Verification:**
   * When within 300 meters, the collector taps **"Mark Arrived"**. (The server cryptographically verifies coordinates are <=300m and GPS telemetry is <=60s fresh).
   * The collector enters scale-measured waste weight (kg) and clicks **"Complete Pickup"**.
   * Green Points are immediately credited to the citizen and badges unlock automatically.

---

## Maintenance & Data Retention

### Telemetry Retention Cleanup
High-frequency GPS telemetry generates substantial row volume in `vehicle_locations`. The repository provides an automated retention cleanup script:

```bash
# Run dry-run to preview records to purge older than 7 days
node scripts/cleanOldLocations.js --dry-run

# Execute cleanup with custom retention days
node scripts/cleanOldLocations.js --days=7
```

### Driver Location Privacy
Driver GPS telemetry is broadcast and recorded **only during an active in-transit trip** (`on_the_way` or `arrived`). No location data is streamed or logged when a driver is off-duty, unassigned, or between trips.

---

## Automated Test Commands

The repository provides several specialized test suites and verification scripts located in `backend/`:

```bash
# 1. Run Unit Tests for Photo URL Validation & Traversal Security
cd backend
npm test
# (Runs node test_photo_url_validation.js)

# 2. Run Comprehensive Security, WebSocket & End-to-End Tracking Test Suite
cd backend
node test_tracking_and_sockets.js

# 3. Run Admin Analytics, Rewards & Points Flow Tests
cd backend
node test_complete_flow.js

# 4. Run End-to-End QA Verification Suite
cd backend
node qa_verification_test.js

# 5. Audit Test-Created Database Records (Dry-Run Preview)
cd backend
node cleanup_test_data.js --dry-run
```

### Test Suite Descriptions

* **`npm test` (`test_photo_url_validation.js`):**
  * Validates relative paths: allows only `/uploads/<random-filename>.<ext>` (`.jpg`, `.jpeg`, `.png`, `.webp`).
  * Validates HTTPS URLs: verifies hostname against allowlist configured in `PHOTO_ALLOWED_HOSTS` (defaults to `res.cloudinary.com`).
  * Enforces traversal rejection: rejects encoded traversal sequences (`%2e%2e`, `%2f`, `%5c`, `..`) and path navigation attempts.
  * Rejects non-allowlisted domains, insecure plain HTTP (`http://`), and dangerous schemes (`javascript:`, `data:`, `ftp:`).

* **`node test_tracking_and_sockets.js`:**
  * Unauthorized citizen blocked from tracking endpoint (`HTTP 403 Forbidden`).
  * Owner citizen receives complete tracking payload with OSRM navigation (`HTTP 200 OK`).
  * In-transit vehicle reassignment blocked with `HTTP 409 Conflict`.
  * In-transit pickup cancellation blocked with `HTTP 400 Bad Request`.
  * **SECURITY:** Driver calling status endpoint with `skipArrivalRadiusCheck: true` from outside the radius is strictly rejected with `HTTP 400`.
  * Arrival check with missing vehicle coordinates or stale (>60s) telemetry rejected with `HTTP 400`.
  * Arrival check with missing pickup destination coordinates rejected with `HTTP 400`.
  * Assigning non-collector user to vehicle rejected with `HTTP 400`.
  * Reassigning busy collector to second vehicle rejected with `HTTP 400`.
  * Deactivating vehicle or changing driver with active assignments blocked with `HTTP 409 Conflict`.
  * Socket.IO JWT authentication failure handling during handshake.
  * Multi-room Socket.IO broadcasts and room isolation verification.
  * Full 8-step lifecycle execution with automated test user teardown.

* **`node test_complete_flow.js`:**
  * Complete lifecycle test from citizen registration, pickup creation, vehicle dispatch, in-transit telemetry, arrival, and completion.
  * Verifies scale-measured waste weight calculation, Green Points ledger crediting, and reward catalog redemption.
  * Includes automated teardown removing all generated test entities.

* **`node qa_verification_test.js`:**
  * End-to-end regression verification covering citizen authentication, booking, admin dispatch queues, driver workflow, tracking payloads, impact metrics, and clean test teardown.

* **`node cleanup_test_data.js --dry-run`:**
  * Non-destructive audit utility that identifies all test-created accounts (`testcitizen_%`), test vehicles (`TST-*`, `FLW-*`), and ephemeral test badges/rewards.
  * Cross-references all 10 protected NGO accounts to ensure zero accidental modifications.
  * Actual deletion requires `--execute` and explicit typed confirmation (`DELETE TEST DATA`), and is strictly forbidden when `NODE_ENV=production`.

---

## Current System Limitations & Honest Assessment

* **Foreground-Only GPS Tracking:** On iOS and Android Expo Go environments, location streaming operates while the mobile app is in the foreground. If the driver minimizes the application or locks their screen, OS battery-optimization policies suspend background timers until the app returns to focus.
* **Public OSRM Demo Server:** Default routing uses `https://router.project-osrm.org`. While functional for demonstrations and local testing, this public endpoint is rate-limited and subject to public internet latency. Production deployments should run a self-hosted OSRM Docker container with regional `.osm.pbf` road networks.
* **Client-Simulated Demo Driver:** A built-in polyline step interpolator is provided for testing and evaluation without requiring physical vehicles on the road.
* **No Native Push Notifications Yet:** Real-time updates currently rely on active Socket.IO connections. When the citizen app is closed, status updates are not delivered via APNs/FCM; notifications are scheduled for a future iteration.

---

## Troubleshooting Guide

### 1. Mobile App Cannot Connect to Backend (Network Error)
* **Cause:** Mobile device or emulator attempting to connect to `localhost`.
* **Solution:** Replace `localhost` in `mobile-app/.env` with your computer's actual local Wi-Fi IPv4 address (e.g., `http://192.168.1.50:4000/api`). Ensure your mobile phone and development machine are connected to the same Wi-Fi network.

### 2. CORS Errors in Admin Dashboard
* **Cause:** Express server rejecting browser requests from `http://localhost:5173`.
* **Solution:** Ensure `CORS_ORIGIN` in `backend/.env` includes `http://localhost:5173` (e.g., `CORS_ORIGIN="http://localhost:5173,http://localhost:3000"`). In production, set explicit allowed origins.

### 3. Leaflet Map Markers Not Displaying in Admin Dashboard
* **Cause:** Vite bundling can break Leaflet's default PNG marker asset URLs.
* **Solution:** The project includes an explicit Leaflet icon fix in `admin-dashboard/src/components/LiveFleetMap.jsx` using `L.Icon.Default.mergeOptions` pointing to bundled SVG markers.

### 4. Mobile Map Rendering in Expo Go
* **Architecture:** The mobile application renders maps using Leaflet 1.9.4 inside a sandboxed `react-native-webview` with Carto Voyager raster tiles. This eliminates all dependencies on native Google Maps SDKs or Google Maps API keys on Android Expo Go.
* **Troubleshooting:**
  * **Offline Overlay:** If the map displays the offline overlay with a "Retry" button, verify the device has an active internet connection to download Leaflet from cdnjs and raster tiles from CARTO. Tap **Retry** to reload the map component.
  * **Tile Server Reachability:** Verify `EXPO_PUBLIC_TILE_URL` in `mobile-app/.env` points to a reachable HTTPS tile server. When testing on physical devices, ensure the device is on a Wi-Fi network that allows outbound HTTPS connections to CARTO basemaps.

---

## Remaining TODOs & Known Risks

1. **Background GPS Location Service:** Implement `expo-task-manager` and `expo-location` background execution tasks (requires native prebuild / Expo Development Client) so driver locations stream continuously when the screen is locked.
2. **Push Notifications Integration:** Connect Expo Push Service (APNs / FCM) for pickup assignment, driver arrival alerts, and reward redemption confirmations.
3. **Self-Hosted OSRM Deployment:** Containerize OSRM with Docker and download regional OpenStreetMap data (`.osm.pbf`) to eliminate external third-party rate limits.

---

## Security

The application includes:
* JWT-based authentication across REST and WebSocket handshakes
* Role-based authorization (`citizen`, `collector`, `admin`)
* Server-side arrival radius check (<=300m) with zero client-controlled bypasses
* Reassignment and vehicle deactivation conflict locking (`HTTP 409`)
* Protected API endpoints with centralized error handling
* Environment-based configuration with sensitive secrets excluded from version control

---

## Future Enhancements

Potential future improvements include:

* Push notifications
* Pickup route optimization
* Exportable reports (CSV/PDF audits)
* Advanced reward mechanisms
* Automated notifications
* Cloud deployment
* Docker-based deployment
* Automated testing and CI/CD
* Integration with smart bins and IoT devices

---

## Project Status

**Status:** In Development

The platform is being developed as a full-stack solution consisting of a citizen mobile application, collector driver interface, administrative dashboard, REST & Socket.IO backend, and PostgreSQL database.

---

## Contributors

**Ashmit Sarode**

GitHub: [Ash-718](https://github.com/Ash-718)

**Mohit Godbole**

Github: [mohit-1303](https://github.com/mohit-1303)

**Amit Pawar**

GitHub: [in-ops](https://github.com/in-ops)

---

## License

This project is currently intended as a project/internship implementation for **Pruthvi Zero Waste Foundation (NGO)**. All rights reserved.

A specific open-source license can be added if the project is intended for public reuse.

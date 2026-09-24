# Smart Waste Pickup & Rewards Platform

A full-stack smart waste pickup and rewards platform developed for **Pruthvi Zero Waste Foundation (NGO)** to streamline recyclable waste collection through on-demand pickup booking, digital reward tracking, and an admin management dashboard.

## Overview

The **Smart Waste Pickup & Rewards Platform** replaces traditional phone-based recyclable waste pickup requests with a digital platform.

The system consists of:

* A **React Native mobile application** for citizens
* An **admin dashboard** for managing pickups, users, rewards, and badges
* A **Node.js + Express REST API** for backend services
* A **PostgreSQL database** for persistent data storage
* **JWT-based authentication** with role-based access for citizens and administrators

Citizens can request recyclable waste pickups, earn Green Points, unlock badges, and redeem available rewards. Administrators can manage users, pickup requests, rewards, and the overall platform through the dashboard.

---

## Problem Statement

Recyclable waste collection can become inefficient when pickup requests are handled through phone calls or manual processes. Such systems make it difficult to track requests, manage users, maintain pickup records, and encourage citizens to participate consistently in recycling activities.

The proposed platform provides a centralized digital solution where citizens can request waste pickups on demand while administrators can manage and monitor the collection process through a dedicated dashboard.

The platform also introduces a **Green Points and rewards system** to encourage users to participate regularly in responsible waste disposal and recycling.

---

## Objectives

* Replace phone-based waste pickup requests with an on-demand digital booking system.
* Provide citizens with a convenient mobile application for requesting recyclable waste pickups.
* Provide administrators with a centralized dashboard for managing pickup operations.
* Implement secure authentication and role-based authorization.
* Track citizen participation through a Green Points ledger.
* Encourage recycling through badges and redeemable rewards.
* Maintain structured records of users, pickups, points, badges, and rewards.
* Provide a scalable backend architecture for future enhancements.

---

## Key Features

### Citizen Mobile Application

* User registration and login
* JWT-based authentication
* Citizen profile management
* On-demand recyclable waste pickup requests
* Pickup request tracking
* Green Points tracking
* Badge system
* Rewards catalogue
* Reward ownership/redemption tracking

### Admin Dashboard

* Admin authentication
* Role-based access control
* User management
* Pickup request management
* Pickup status management
* Green Points management
* Badge management
* Reward catalogue management
* Monitoring of platform activities

### Green Points System

The platform maintains a dedicated **Green Points ledger** to track points earned by citizens through waste-related activities.

Instead of storing only a single total value, the ledger provides a structured way to maintain point transactions and activity history.

### Badges & Rewards

Citizens can participate in the platform's gamification system through:

* Badges
* Green Points
* Rewards

Many-to-many relationships are used where users can own multiple badges and rewards.

---

## Technology Stack

| Layer              | Technology            |
| ------------------ | --------------------- |
| Mobile Application | React Native          |
| Backend            | Node.js               |
| API Framework      | Express.js            |
| Database           | PostgreSQL            |
| Authentication     | JSON Web Tokens (JWT) |
| API Style          | REST                  |
| Version Control    | Git & GitHub          |

---

## System Architecture

```text
                    ┌────────────────────────┐
                    │      Citizen App       │
                    │      React Native      │
                    └───────────┬────────────┘
                                │
                                │ REST API
                                ▼
                    ┌────────────────────────┐
                    │      Express.js API    │
                    │       Node.js          │
                    └───────────┬────────────┘
                                │
                ┌───────────────┼────────────────┐
                │               │                │
                ▼               ▼                ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Authentication│ │ Pickup       │ │ Rewards &    │
        │ & Authorization│ │ Management   │ │ Points       │
        └──────────────┘ └──────────────┘ └──────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │      PostgreSQL        │
                    │        Database        │
                    └────────────────────────┘
                                ▲
                                │
                    ┌───────────┴────────────┐
                    │     Admin Dashboard    │
                    │       Web Interface    │
                    └────────────────────────┘
```

---

## User Roles

### Citizen

Citizens can:

* Create an account
* Log in securely
* Request recyclable waste pickups
* Track pickup requests
* Earn Green Points
* View their points history
* Earn and view badges
* Access available rewards

### Administrator

Administrators can:

* Access the admin dashboard
* Manage users
* Manage pickup requests
* Manage rewards
* Manage badges
* Monitor platform activity
* Perform administrative operations through protected APIs

---

## Database Design

The system uses a relational PostgreSQL database.

The core schema consists of **7 tables** covering areas such as:

* Users
* Pickup requests
* Green Points ledger
* Badges
* Rewards
* Badge ownership
* Reward ownership

Join tables are used to represent many-to-many relationships between users and badges/rewards.

### Simplified Relationship Structure

```text
Users
 │
 ├──────────────► Pickups
 │
 ├──────────────► Points Ledger
 │
 ├──────────────► User Badges
 │                     │
 │                     ▼
 │                   Badges
 │
 └──────────────► User Rewards
                       │
                       ▼
                     Rewards
```

---

## Authentication & Authorization

The backend uses **JWT-based authentication**.

The authentication flow is:

```text
User Login
    │
    ▼
Credentials Verification
    │
    ▼
JWT Token Generated
    │
    ▼
Client Stores Token
    │
    ▼
Token Sent With Protected Requests
    │
    ▼
Authentication Middleware
    │
    ▼
Role Verification
    │
    ├── Citizen
    │
    └── Admin
```

Protected API endpoints verify the user's authentication token before allowing access to authorized operations.

---

## Project Structure

```text
NEW_MINI_PROJECT_APP/
│
├── admin-dashboard/
│   └── Admin web dashboard
│
├── backend/
│   └── Node.js + Express REST API
│
├── mobile-app/
│   └── React Native citizen application
│
├── .gitignore
│
└── README.md
```

---

## Backend Responsibilities

The backend provides the central API layer for the application.

Major responsibilities include:

* User authentication
* JWT token generation and validation
* Role-based authorization
* User management
* Pickup management
* Green Points management
* Badge management
* Reward management
* Database operations
* API error handling

---

## Pickup Workflow

```text
Citizen
   │
   ▼
Open Mobile App
   │
   ▼
Create Pickup Request
   │
   ▼
Request Sent to REST API
   │
   ▼
Backend Validates Request
   │
   ▼
Pickup Stored in PostgreSQL
   │
   ▼
Admin Views Request
   │
   ▼
Admin Manages Pickup
   │
   ▼
Pickup Status Updated
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
       Ledger transaction
              │
              ▼
      User's points balance
              │
              ▼
       Badges / Rewards
```

The ledger-based approach allows point transactions to be represented separately rather than relying only on a manually updated total.

---

## API

The backend exposes REST APIs for communication between the mobile application, admin dashboard, and server.

Major API areas include:

* Authentication
* Users
* Pickups
* Green Points
* Badges
* Rewards
* Administrative operations

All protected endpoints require appropriate authentication and authorization.

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

Configure the required environment variables for the backend and PostgreSQL database.

Then start the backend:

```bash
npm run dev
```

### 3. Mobile Application Setup

Open another terminal:

```bash
cd mobile-app
npm install
```

Start the React Native application using the project's configured React Native workflow.

### 4. Admin Dashboard Setup

Open another terminal:

```bash
cd admin-dashboard
npm install
```

Start the admin dashboard using the project's configured development command.

---

## Environment Variables

Sensitive configuration should be stored in environment variables rather than committed to GitHub.

Example:

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
PORT=your_port
```

> Do not commit actual passwords, JWT secrets, API keys, or other sensitive credentials to the repository.

---

## Security

The application includes:

* JWT-based authentication
* Role-based authorization
* Protected API endpoints
* Environment-based configuration for sensitive values
* Centralized backend error handling

---

## Future Enhancements

Potential future improvements include:

* Real-time pickup tracking
* Push notifications
* Location/GPS-based pickup tracking
* Pickup route optimization
* Analytics dashboard
* Waste collection statistics
* Advanced reward mechanisms
* Automated notifications
* Cloud deployment
* Docker-based deployment
* Automated testing and CI/CD
* Integration with smart bins and IoT devices

---

## Project Status

**Status:** In Development

The platform is being developed as a full-stack solution consisting of a citizen mobile application, administrative dashboard, REST backend, and PostgreSQL database.

---

## Contributors

**Ashmit Sarode**

GitHub: [Ash-718](https://github.com/Ash-718)

---

## License

This project is currently intended as a project/internship implementation.

A specific open-source license can be added if the project is intended for public reuse.

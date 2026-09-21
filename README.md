# ⚡ GridPulse — P2P Renewable Energy Trading Platform

A decentralized peer-to-peer renewable energy trading platform and virtual microgrid simulator. Watch virtual households with solar panels and batteries trade energy in real-time through a continuous double auction marketplace.

## 🏗️ Architecture

```
gridpulse/
├── apps/
│   ├── web/          # Next.js 14 frontend (React, Tailwind, React Flow, Recharts)
│   └── server/       # Express + Socket.io backend (Prisma, PostgreSQL)
├── packages/
│   └── shared/       # Shared types, constants, and interfaces
├── docker-compose.yml
└── turbo.json
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, React Flow, Recharts, Framer Motion |
| **Backend** | Express.js, Socket.io, Prisma ORM |
| **Database** | PostgreSQL |
| **Monorepo** | Turborepo, pnpm workspaces |
| **Real-time** | WebSocket (Socket.io) |

### Core Systems

- **Simulation Engine** — Orchestrates ticks at configurable speed, driving the entire system
- **Data Fusion Engine** — Merges 3 data layers (mathematical simulation, CSV datasets, live weather APIs) for realistic meter readings
- **Matching Engine** — Continuous Double Auction (CDA) with price-time priority
- **Double-Entry Ledger** — ACID-compliant financial settlement for all trades
- **Auto Trader** — AI agent that automatically places buy/sell orders based on each node's energy surplus/deficit

### Data Modes

| Mode | Description |
|---|---|
| **DEMO** | Pure mathematical simulation using Gaussian solar/consumption models |
| **REPLAY** | Replays real-world CSV dataset profiles with simulated weather events |
| **LIVE** | Hybrid: dataset baselines modified by live weather data from Open-Meteo API |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
# Clone and install
git clone https://github.com/Abhi378-2005/GridPulse.git
cd GridPulse

# One-command setup: install deps, start DB, run migrations, seed data
pnpm setup
```

### Development

```bash
# Start both frontend and backend in dev mode
pnpm dev
```

- **Frontend**: http://localhost:3005
- **Backend**: http://localhost:3001
- **Prisma Studio**: `pnpm db:studio`

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gridpulse
SERVER_PORT=3001
CORS_ORIGIN=*                    # Restrict in production
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

## 📊 Dashboard Features

- **Live Grid Topology** — Interactive node graph showing energy flow and active trades
- **Energy Flow Charts** — Real-time area chart of community generation vs consumption
- **Order Book** — Bid/ask depth visualization with spread indicator
- **Live Trade Ticker** — Animated feed of executed P2P trades
- **Impact Metrics** — CO₂ avoided, money saved, energy traded, trade count
- **Weather Events** — Trigger heatwaves, storms, cloud cover to see market reactions
- **Theme Toggle** — Light/dark mode with full system preference support

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/simulation/state` | Current simulation state |
| POST | `/api/simulation/start` | Start simulation |
| POST | `/api/simulation/pause` | Pause simulation |
| POST | `/api/simulation/speed` | Set speed (1x–1440x) |
| POST | `/api/simulation/mode` | Set data mode |
| GET | `/api/analytics/nodes` | All grid nodes |
| GET | `/api/analytics/trades` | Trade history (paginated) |
| GET | `/api/analytics/balances` | All wallet balances |
| GET | `/api/analytics/readings/:nodeId` | Meter readings for a node |

## 📡 Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `simulation:tick` | Server → Client | Tick payload with node states |
| `trade:executed` | Server → Client | New trade notification |
| `orderbook:update` | Server → Client | Order book snapshot |
| `metrics:update` | Server → Client | Aggregate metrics |
| `weather:event` | Server → Client | Weather event triggered |
| `simulation:control` | Client → Server | Control commands |

## 🏠 Grid Nodes

8 virtual households with varying configurations:

| Node | Solar (kW) | Battery (kWh) | Base Load (kW) |
|---|---|---|---|
| 🏠 Alpha | 6.0 | 12.0 | 1.5 |
| 🏡 Beta | 4.5 | 8.0 | 2.0 |
| 🏘️ Gamma | 8.0 | 15.0 | 1.2 |
| 🏗️ Delta | 3.0 | 6.0 | 2.5 |
| 🏢 Epsilon | 5.5 | 10.0 | 3.0 |
| 🏛️ Zeta | 7.0 | 14.0 | 1.8 |
| 🏠 Eta | 4.0 | 7.0 | 1.0 |
| 🏡 Theta | 5.0 | 10.0 | 2.2 |

## 📝 License

MIT

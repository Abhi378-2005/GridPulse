import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import { SimulationEngine } from './engine/SimulationEngine';
import { setupSocketHandlers } from './socket/handlers';
import { createSimulationRouter } from './routes/simulation';
import { createAnalyticsRouter } from './routes/analytics';
import { prisma } from './config/database';

dotenv.config({ path: '../../.env' });
dotenv.config(); // Also check local .env

const PORT = process.env.SERVER_PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

async function main() {
  console.log('\n⚡ ═══════════════════════════════════════');
  console.log('   GridPulse Server Starting...');
  console.log('   ═══════════════════════════════════════\n');

  // Express app
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  // HTTP server
  const httpServer = createServer(app);

  // Socket.io
  const io = new SocketServer(httpServer, {
    cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  // Initialize simulation engine
  const simEngine = new SimulationEngine();
  await simEngine.initialize(io);

  // REST routes
  app.use('/api/simulation', createSimulationRouter(simEngine));
  app.use('/api/analytics', createAnalyticsRouter());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      simulation: simEngine.getState(),
    });
  });

  // Socket.io handlers
  setupSocketHandlers(io, simEngine);

  // Start HTTP server
  httpServer.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready on ws://localhost:${PORT}`);
    console.log('');

    // Auto-start simulation
    simEngine.start();
    console.log('▶️  Simulation auto-started in DEMO mode');
    console.log('   Visit the frontend dashboard to see it live!\n');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    simEngine.pause();
    io.close();
    httpServer.close();
    await prisma.$disconnect();
    console.log('👋 Goodbye!');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});


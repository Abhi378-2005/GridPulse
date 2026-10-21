import { Router } from 'express';
import { SimulationEngine } from '../engine/SimulationEngine';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { recordAudit } from '../middleware/audit';
import { WEATHER_EVENTS } from '@gridpulse/shared';

export function createSimulationRouter(simEngine: SimulationEngine): Router {
  const router = Router();

  // GET /api/simulation/state
  router.get('/state', (req, res) => {
    res.json(simEngine.getState());
  });

  // POST /api/simulation/start
  router.post('/start', authenticateToken, requireAdmin, (req, res) => {
    simEngine.start();
    recordAudit(req.user!, 'sim.resume');
    res.json({ message: 'Simulation started', state: simEngine.getState() });
  });

  // POST /api/simulation/pause
  router.post('/pause', authenticateToken, requireAdmin, (req, res) => {
    simEngine.pause();
    recordAudit(req.user!, 'sim.pause');
    res.json({ message: 'Simulation paused', state: simEngine.getState() });
  });

  // POST /api/simulation/speed
  router.post('/speed', authenticateToken, requireAdmin, (req, res) => {
    const { speed } = req.body;
    if (typeof speed !== 'number') {
      return res.status(400).json({ error: 'Speed must be a number' });
    }
    simEngine.setSpeed(speed);
    const applied = simEngine.getState().speed; // The engine clamps to its allowed range
    recordAudit(req.user!, 'sim.setSpeed', '', { speed: applied });
    res.json({ message: `Speed set to ${applied}x`, state: simEngine.getState() });
  });

  // POST /api/simulation/mode
  router.post('/mode', authenticateToken, requireAdmin, (req, res) => {
    const { mode } = req.body;
    if (!['LIVE', 'REPLAY', 'DEMO'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be LIVE, REPLAY, or DEMO' });
    }
    simEngine.setMode(mode);
    recordAudit(req.user!, 'sim.setMode', '', { mode });
    res.json({ message: `Mode set to ${mode}`, state: simEngine.getState() });
  });

  // POST /api/simulation/trigger-event
  router.post('/trigger-event', authenticateToken, requireAdmin, (req, res) => {
    const eventType = req.body?.eventType || 'HEATWAVE';
    if (!(eventType in WEATHER_EVENTS)) {
      return res.status(400).json({ error: `eventType must be one of: ${Object.keys(WEATHER_EVENTS).join(', ')}` });
    }
    simEngine.triggerEvent(eventType);
    recordAudit(req.user!, 'sim.triggerEvent', eventType);
    res.json({ message: `Event triggered: ${eventType}` });
  });

  // GET /api/simulation/metrics
  router.get('/metrics', (req, res) => {
    res.json(simEngine.getMetrics());
  });

  // GET /api/simulation/trades
  router.get('/trades', (req, res) => {
    res.json(simEngine.getRecentTrades());
  });

  return router;
}

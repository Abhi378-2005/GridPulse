import { Router } from 'express';
import { SimulationEngine } from '../engine/SimulationEngine';

export function createSimulationRouter(simEngine: SimulationEngine): Router {
  const router = Router();

  // GET /api/simulation/state
  router.get('/state', (req, res) => {
    res.json(simEngine.getState());
  });

  // POST /api/simulation/start
  router.post('/start', (req, res) => {
    simEngine.start();
    res.json({ message: 'Simulation started', state: simEngine.getState() });
  });

  // POST /api/simulation/pause
  router.post('/pause', (req, res) => {
    simEngine.pause();
    res.json({ message: 'Simulation paused', state: simEngine.getState() });
  });

  // POST /api/simulation/speed
  router.post('/speed', (req, res) => {
    const { speed } = req.body;
    if (typeof speed !== 'number') {
      return res.status(400).json({ error: 'Speed must be a number' });
    }
    simEngine.setSpeed(speed);
    res.json({ message: `Speed set to ${speed}x`, state: simEngine.getState() });
  });

  // POST /api/simulation/mode
  router.post('/mode', (req, res) => {
    const { mode } = req.body;
    if (!['LIVE', 'REPLAY', 'DEMO'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be LIVE, REPLAY, or DEMO' });
    }
    simEngine.setMode(mode);
    res.json({ message: `Mode set to ${mode}`, state: simEngine.getState() });
  });

  // POST /api/simulation/trigger-event
  router.post('/trigger-event', (req, res) => {
    const { eventType } = req.body;
    simEngine.triggerEvent(eventType || 'HEATWAVE');
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

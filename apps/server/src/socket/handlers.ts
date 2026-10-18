import { Server as SocketServer, Socket } from 'socket.io';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { SimControlAction, NodeConfigUpdate, AddNodeRequest } from '@gridpulse/shared';
import { verifyToken, canAccessNode, type AuthUser } from '../middleware/auth';

/** Simple per-client rate limiter for socket events. */
class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();
  private maxActions: number;
  private windowMs: number;

  constructor(maxActions: number = 10, windowMs: number = 5000) {
    this.maxActions = maxActions;
    this.windowMs = windowMs;
  }

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const history = this.timestamps.get(clientId) || [];
    const recent = history.filter(ts => now - ts < this.windowMs);
    if (recent.length >= this.maxActions) {
      return false;
    }
    recent.push(now);
    this.timestamps.set(clientId, recent);
    return true;
  }

  removeClient(clientId: string): void {
    this.timestamps.delete(clientId);
  }
}

/**
 * Socket.io event handlers for real-time client communication.
 */
export function setupSocketHandlers(io: SocketServer, simEngine: SimulationEngine): void {
  const controlLimiter = new RateLimiter(10, 5000); // 10 actions per 5s
  const configLimiter = new RateLimiter(20, 5000);  // 20 slider updates per 5s (sliders fire frequently)

  // Anyone may watch the dashboard. A JWT (sent as `auth.token`) identifies the user for controls.
  io.use((socket, next) => {
    socket.data.user = verifyToken(socket.handshake.auth?.token) as AuthUser | null;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    const user: AuthUser | null = socket.data.user;

    const requireAdminSocket = (): boolean => {
      if (user?.role === 'admin') return true;
      socket.emit('error', { message: 'Admin login required for this action' });
      return false;
    };
    const requireNodeSocket = (nodeId: string): boolean => {
      if (canAccessNode(user ?? undefined, nodeId)) return true;
      socket.emit('error', { message: 'Log in as this house’s owner (or an admin) to change it' });
      return false;
    };

    // Send current state immediately on connect
    socket.emit('simulation:tick', {
      state: simEngine.getState(),
      nodes: [],
    });
    socket.emit('metrics:update', simEngine.getMetrics());

    // Handle simulation control commands (rate-limited)
    socket.on('simulation:control', (action: SimControlAction) => {
      if (!requireAdminSocket()) return;
      if (!controlLimiter.isAllowed(socket.id)) {
        console.warn(`⚠️  Rate limited: ${socket.id}`);
        socket.emit('error', { message: 'Too many control actions, please slow down' });
        return;
      }

      try {
        switch (action.type) {
          case 'setSpeed':
            simEngine.setSpeed(action.speed);
            break;
          case 'pause':
            simEngine.pause();
            break;
          case 'resume':
            simEngine.start();
            break;
          case 'setMode':
            simEngine.setMode(action.mode);
            break;
          case 'triggerEvent':
            simEngine.triggerEvent(action.eventType);
            break;
        }

        // Broadcast updated state to all clients
        io.emit('simulation:state', simEngine.getState());
      } catch (error) {
        console.error('Control action error:', error);
        socket.emit('error', { message: 'Failed to process control action' });
      }
    });

    // Handle node config updates (interactive sliders)
    socket.on('node:updateConfig', (update: NodeConfigUpdate) => {
      if (!requireNodeSocket(update.nodeId)) return;
      if (!configLimiter.isAllowed(socket.id)) {
        return; // Silently drop slider updates that are too fast
      }
      try {
        simEngine.updateNodeConfig(update);
      } catch (error) {
        console.error('Node config update error:', error);
        socket.emit('error', { message: 'Failed to update node config' });
      }
    });

    // Handle node name updates
    socket.on('node:updateName', async (update: { nodeId: string; name: string }) => {
      if (!requireNodeSocket(update.nodeId)) return;
      if (!controlLimiter.isAllowed(socket.id)) {
        socket.emit('error', { message: 'Too many requests, please slow down' });
        return;
      }
      try {
        await simEngine.updateNodeName(update.nodeId, update.name);
      } catch (error) {
        console.error('Node name update error:', error);
        socket.emit('error', { message: 'Failed to update node name' });
      }
    });

    // Handle adding new nodes
    socket.on('node:add', async (request: AddNodeRequest) => {
      if (!requireAdminSocket()) return;
      if (!controlLimiter.isAllowed(socket.id)) {
        socket.emit('error', { message: 'Too many requests, please slow down' });
        return;
      }
      try {
        const result = await simEngine.addNode(request);
        if (!result) {
          socket.emit('error', { message: `Failed to add node "${request.name}". Name may already exist.` });
        }
      } catch (error) {
        console.error('Add node error:', error);
        socket.emit('error', { message: 'Failed to add node' });
      }
    });

    // Handle location changes for LIVE mode
    socket.on('location:set', (location: { latitude: number; longitude: number; label: string }) => {
      if (!requireAdminSocket()) return;
      if (!controlLimiter.isAllowed(socket.id)) return;
      try {
        simEngine.setLocation(location.latitude, location.longitude, location.label);
      } catch (error) {
        console.error('Set location error:', error);
      }
    });

    socket.on('disconnect', () => {
      controlLimiter.removeClient(socket.id);
      configLimiter.removeClient(socket.id);
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}



import { Server as SocketServer, Socket } from 'socket.io';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { SimControlAction } from '@gridpulse/shared';

/**
 * Socket.io event handlers for real-time client communication.
 */
export function setupSocketHandlers(io: SocketServer, simEngine: SimulationEngine): void {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send current state immediately on connect
    socket.emit('simulation:tick', {
      state: simEngine.getState(),
      nodes: [],
    });
    socket.emit('metrics:update', simEngine.getMetrics());

    // Handle simulation control commands
    socket.on('simulation:control', (action: SimControlAction) => {
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

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

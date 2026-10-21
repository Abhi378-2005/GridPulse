'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import type {
  SimulationTickPayload,
  TradeData,
  OrderBookSnapshot,
  AggregateMetrics,
  LiveWeatherData,
  WeatherEventData,
  SimControlAction,
  GridNodeState,
  SimulationState,
  NodeConfigUpdate,
  AddNodeRequest,
} from '@gridpulse/shared';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [nodes, setNodes] = useState<GridNodeState[]>([]);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null);
  const [weatherEvents, setWeatherEvents] = useState<WeatherEventData[]>([]);
  const [serverError, setServerError] = useState<{ message: string; at: number } | null>(null);
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onSimTick(payload: SimulationTickPayload) {
      setSimState(payload.state);
      if (payload.nodes.length > 0) {
        setNodes(payload.nodes);
      }
      if (payload.weather) {
        setLiveWeather(payload.weather);
      }
    }

    function onTradeExecuted(trade: TradeData) {
      setTrades(prev => [trade, ...prev].slice(0, 50));
    }

    function onOrderBookUpdate(book: OrderBookSnapshot) {
      setOrderBook(book);
    }

    function onMetricsUpdate(m: AggregateMetrics) {
      setMetrics(m);
    }

    function onWeatherEvent(event: WeatherEventData) {
      setWeatherEvents(prev => [event, ...prev].slice(0, 10));
    }

    function onWeatherLive(data: LiveWeatherData) {
      setLiveWeather(data);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('simulation:tick', onSimTick);
    socket.on('simulation:state', setSimState); // Pause/resume/speed/mode changes (a paused simulation sends no ticks)
    socket.on('trade:executed', onTradeExecuted);
    socket.on('orderbook:update', onOrderBookUpdate);
    socket.on('metrics:update', onMetricsUpdate);
    socket.on('weather:event', onWeatherEvent);
    socket.on('weather:live', onWeatherLive);
    socket.on('node:nameUpdated', (update: { nodeId: string; name: string }) => {
      setNodes(prev => prev.map(n => n.id === update.nodeId ? { ...n, name: update.name } : n));
    });

    function onServerError(err: { message: string }) {
      setServerError({ message: err.message, at: Date.now() });
    }
    socket.on('error', onServerError);

    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('simulation:tick', onSimTick);
      socket.off('simulation:state', setSimState);
      socket.off('trade:executed', onTradeExecuted);
      socket.off('orderbook:update', onOrderBookUpdate);
      socket.off('metrics:update', onMetricsUpdate);
      socket.off('weather:event', onWeatherEvent);
      socket.off('weather:live', onWeatherLive);
      socket.off('node:nameUpdated');
      socket.off('error', onServerError);
    };
  }, []);

  const sendControl = useCallback((action: SimControlAction) => {
    socketRef.current.emit('simulation:control', action);
  }, []);

  const sendNodeConfig = useCallback((update: NodeConfigUpdate) => {
    socketRef.current.emit('node:updateConfig', update);
  }, []);

  const sendNodeNameUpdate = useCallback((nodeId: string, name: string) => {
    socketRef.current.emit('node:updateName', { nodeId, name });
  }, []);

  const sendAddNode = useCallback((request: AddNodeRequest) => {
    socketRef.current.emit('node:add', request);
  }, []);

  const sendLocation = useCallback((latitude: number, longitude: number, label: string) => {
    socketRef.current.emit('location:set', { latitude, longitude, label });
  }, []);

  return {
    isConnected,
    simState,
    nodes,
    trades,
    orderBook,
    metrics,
    liveWeather,
    weatherEvents,
    serverError,
    sendControl,
    sendNodeConfig,
    sendNodeNameUpdate,
    sendAddNode,
    sendLocation,
  };
}


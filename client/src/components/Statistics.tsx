import { Component, createSignal, createEffect, onMount } from 'solid-js';
import { state } from '../store';
import Neutralino from '@neutralinojs/lib';

interface StatisticsProps {
  uptime: string;
  lines: string;
  trades: string;
  players: string;
}

interface MonitorStatusEvent {
  status: 'active' | 'inactive' | 'error';
  error: string | null;
}

interface StatBoxProps {
  label: string;
  value: string | number;
}

const StatBox: Component<StatBoxProps> = (props) => (
  <div class="bg-gray-50 rounded-lg p-3 text-center">
    <div class="text-sm text-gray-600 mb-1">{props.label}</div>
    <div class="text-lg font-medium text-gray-900">{props.value}</div>
  </div>
);

export const Statistics: Component<StatisticsProps> = (props) => {
  const [isLoading, setIsLoading] = createSignal(false);
  const [isMonitoring, setIsMonitoring] = createSignal(false);
  const [monitorError, setMonitorError] = createSignal<string | null>(null);

  // Check monitor state periodically
  createEffect(() => {
    const checkMonitorState = () => {
      if (!state.monitor) return;
      const isActive = state.monitor.watchInterval !== null;
      if (isActive !== isMonitoring()) {
        setIsMonitoring(isActive);
      }
    };

    // Check immediately and then every second
    checkMonitorState();
    const interval = setInterval(checkMonitorState, 1000);
    return () => clearInterval(interval);
  });

  onMount(() => {
    Neutralino.events.on('monitor-status', ({ detail }: { detail: MonitorStatusEvent }) => {
      setIsMonitoring(detail.status === 'active');
      setMonitorError(detail.error);
      
      if (detail.error) {
        (window as any).consoleAddMessage?.({
          text: `Monitor error: ${detail.error}`,
          type: 'error'
        });
      }
    });
  });

  const startMonitor = async () => {
    if (!state.monitor) return;
    setIsLoading(true);
    setMonitorError(null);
    try {
      await state.monitor.start();
      setIsMonitoring(true);
      (window as any).consoleAddMessage?.({
        text: 'Monitor started',
        type: 'success'
      });
    } catch (error: any) {
      setMonitorError(error.message);
      (window as any).consoleAddMessage?.({
        text: `Error starting monitor: ${error.message}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopMonitor = async () => {
    if (!state.monitor) return;
    setIsLoading(true);
    try {
      state.monitor.stop();
      setIsMonitoring(false);
      (window as any).consoleAddMessage?.({
        text: 'Monitor stopped',
        type: 'info'
      });
    } catch (error) {
      (window as any).consoleAddMessage?.({
        text: `Error stopping monitor: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="bg-white rounded-xl shadow-sm p-5 mb-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-xl font-semibold">Monitor Statistics</h2>
          <div class={`text-sm font-medium rounded-full px-2 py-0.5 ${
            isMonitoring() 
              ? 'bg-green-100 text-green-800'
              : monitorError()
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            {isMonitoring() ? 'Active' : monitorError() ? 'Error' : 'Inactive'}
          </div>
        </div>
        <div class="flex gap-2">
          {!isMonitoring() && (
            <button
              onClick={startMonitor}
              disabled={isLoading()}
              class="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Monitor
            </button>
          )}
          {isMonitoring() && (
            <button
              onClick={stopMonitor}
              disabled={isLoading()}
              class="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop Monitor
            </button>
          )}
        </div>
      </div>
      {monitorError() && (
        <div class="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {monitorError()}
        </div>
      )}
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox label="Uptime" value={props.uptime} />
          <StatBox label="Lines Processed" value={props.lines} />
          <StatBox label="Trade Messages" value={props.trades} />
          <StatBox label="Unique Players" value={props.players} />
        </div>
      </div>
    </div>
  );
}; 
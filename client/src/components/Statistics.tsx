import { Component } from 'solid-js';

interface StatisticsProps {
  uptime: string;
  lines: number;
  trades: number;
  players: number;
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
  return (
    <div class="bg-white rounded-xl shadow-sm p-5 mb-5">
      <h2 class="text-xl font-semibold mb-4">Monitor Statistics</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Uptime" value={props.uptime} />
        <StatBox label="Lines Processed" value={props.lines} />
        <StatBox label="Trade Messages" value={props.trades} />
        <StatBox label="Unique Players" value={props.players} />
      </div>
    </div>
  );
}; 
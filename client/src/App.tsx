import { Component, onMount } from 'solid-js';
import { state } from './store';
import { AuthStatus } from './components/AuthStatus';
import { Statistics } from './components/Statistics';
import { Configuration } from './components/Configuration';
import { Console } from './components/Console';
import './styles/style.css';

const App: Component = () => {
  return (
    <div class="bg-gray-50">
      <div class="container mx-auto max-w-3xl p-5 mb-[200px]">
        <AuthStatus />
        <Statistics 
          uptime={state.stats.uptime}
          lines={state.stats.linesProcessed}
          trades={state.stats.tradeMessages}
          players={state.stats.uniquePlayers}
        />
        <Configuration />
      </div>
      <Console />
    </div>
  );
};

export default App; 
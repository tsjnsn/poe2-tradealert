import { Component, onMount } from 'solid-js';
import { state } from './store';
import { AuthStatus } from './components/AuthStatus';
import { Statistics } from './components/Statistics';
import { Configuration } from './components/Configuration';
import { Console, isExpanded } from './components/Console';
import './styles/style.css';

const App: Component = () => {
  return (
    <div>
      <div class="container mx-auto max-w-3xl p-5" style={{ "padding-bottom": isExpanded() ? "340px" : "40px" }}>
        <AuthStatus />
        <Statistics 
          uptime={state.stats.uptime}
          lines={state.stats.linesProcessed.toString()}
          trades={state.stats.tradeMessages.toString()}
          players={state.stats.uniquePlayers.toString()}
        />
        <Configuration />
      </div>
      <Console />
    </div>
  );
};

export default App; 
import { render } from 'solid-js/web';
import { appInitializer } from './services/AppInitializer';
import App from './App';
import './styles/style.css';

// Initialize the application
appInitializer.initialize().then(() => {
  const root = document.getElementById('root');
  if (root) {
    render(() => <App />, root);
  }
}).catch(error => {
  console.error('Failed to initialize application:', error);
});

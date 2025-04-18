import { Component, createSignal, createEffect, onMount } from 'solid-js';
import { state } from '../store';
import Neutralino from '@neutralinojs/lib';

export const AuthStatus: Component = () => {
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const authenticate = async () => {
    if (!state.configManager || !state.auth) return;
    setIsLoading(true);

    const botServerUrl = state.configManager.get('discord.botServerUrl');
    const authUrl = `${botServerUrl}/auth?redirect_uri=${window.location.origin}/auth.html&NL_TOKEN=${window.NL_TOKEN}`;

    try {
      const response = await fetch(authUrl);
      if (!response.ok) {
        throw new Error(`Failed to get auth URL: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      
      if (!data.url) {
        throw new Error('No auth URL in response');
      }
      
      try {
        await Neutralino.os.open(data.url);
      } catch (error) {
        throw new Error(`Failed to open authentication window: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = `Error starting authentication: ${error instanceof Error ? error.message : 'Unknown error'} | Request: ${authUrl}`;
      Neutralino.debug.log(errorMessage, 'ERROR');
      window.consoleAddMessage?.({
        text: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateRefresh = async () => {
    if (!state.configManager || !state.auth) return;
    setIsLoading(true);

    const botServerUrl = state.configManager.get('discord.botServerUrl');
    const refreshUrl = `${botServerUrl}/auth/refresh`;

    try {
      const authData = await state.auth.getAuthData();
      if (!authData?.tokens?.refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: authData.tokens.refresh_token })
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh authentication: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.tokens) {
        await state.auth.saveAuthData(data);
        setIsAuthenticated(true);
        Neutralino.debug.log('Authentication refreshed successfully', 'INFO');
        Neutralino.events.broadcast('discord-tokens-refreshed');
      } else {
        throw new Error('Failed to refresh authentication');
      }
    } catch (error) {
      const errorMessage = `Error refreshing authentication: ${error instanceof Error ? error.message : 'Unknown error'} | Request: ${refreshUrl} | Response: ${JSON.stringify(error.response)}`;
      await state.auth.saveAuthData(null);
      setIsAuthenticated(false);
      Neutralino.debug.log(errorMessage, 'ERROR');
      window.consoleAddMessage?.({
        text: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    if (!state.configManager || !state.auth) return;
    setIsLoading(true);

    const botServerUrl = state.configManager.get('discord.botServerUrl');
    const checkUrl = `${botServerUrl}/auth/check`;

    try {
      const response = await fetch(checkUrl);
      if (!response.ok) {
        throw new Error(`Failed to check authentication: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      
      if (data.authenticated) {
        const userResponse = await fetch(`${botServerUrl}/auth/user`);
        if (!userResponse.ok) {
          throw new Error(`Failed to get user data: ${userResponse.status} ${userResponse.statusText}`);
        }
        const userData = await userResponse.json();
        setIsAuthenticated(true);
        Neutralino.debug.log(`Connected as ${userData.global_name || 'Unknown User'}`, 'INFO');
      } else {
        await authenticate();
      }
    } catch (error) {
      const errorMessage = `Error checking authentication: ${error instanceof Error ? error.message : 'Unknown error'} | Request: ${checkUrl}`;
      Neutralino.debug.log(errorMessage, 'ERROR');
      window.consoleAddMessage?.({
        text: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!state.auth) return;
    setIsLoading(true);
    
    try {
      await state.auth.saveAuthData(null);
      setIsAuthenticated(false);
      Neutralino.debug.log('Logged out successfully', 'INFO');
    } catch (error) {
      const errorMessage = `Error during logout: ${error instanceof Error ? error.message : 'Unknown error'}`;
      Neutralino.debug.log(errorMessage, 'ERROR');
      window.consoleAddMessage?.({
        text: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check auth status when auth service is available
  createEffect(async () => {
    if (state.auth) {
      const authData = await state.auth.getAuthData();
      setIsAuthenticated(!!authData);
    }
  });

  // Set up event handlers
  onMount(() => {
    // Handle auth refresh events
    Neutralino.events.on('auth-refresh', async () => {
      await authenticateRefresh();
    });

    // Handle auth callback events
    Neutralino.events.on('auth-callback', async ({ detail }) => {
      if (detail.tokens) {
        await state.auth?.saveAuthData(detail);
        setIsAuthenticated(true);
        Neutralino.debug.log(`Connected as ${detail.user?.global_name || 'Unknown User'}`, 'INFO');
      }
    });
  });

  return (
    <div class={`flex items-center justify-between p-3 mb-4 rounded-lg ${
      isAuthenticated() ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
    }`}>
      <span>
        {isAuthenticated() ? '🟢 Connected to Discord' : '🔴 Not connected to Discord'}
      </span>
      <div class="flex gap-2">
        {!isAuthenticated() && (
          <button
            onClick={authenticate}
            disabled={isLoading()}
            class="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading() ? 'Connecting...' : 'Connect'}
          </button>
        )}
        {isAuthenticated() && (
          <button
            onClick={logout}
            disabled={isLoading()}
            class="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
}; 

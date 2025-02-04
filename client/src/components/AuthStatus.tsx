import { Component, createSignal, createEffect, onMount } from 'solid-js';
import { state } from '../store';
import Neutralino from '@neutralinojs/lib';

export const AuthStatus: Component = () => {
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const authenticate = async () => {
    if (!state.configManager || !state.auth) return;
    setIsLoading(true);

    try {
      const botServerUrl = state.configManager.get('discord.botServerUrl');
      const response = await fetch(`${botServerUrl}/auth?redirect_uri=${window.location.origin}/auth.html&NL_TOKEN=${window.NL_TOKEN}`);
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
      (window as any).consoleAddMessage?.({
        text: 'Error starting authentication: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateRefresh = async () => {
    if (!state.configManager || !state.auth) return;
    setIsLoading(true);

    try {
      const botServerUrl = state.configManager.get('discord.botServerUrl');
      const authData = await state.auth.getAuthData();
      if (!authData?.tokens?.refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${botServerUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: authData.tokens.refresh_token })
      });

      const data = await response.json();
      if (data.tokens) {
        await state.auth.saveAuthData(data);
        setIsAuthenticated(true);
        (window as any).consoleAddMessage?.({
          text: 'Authentication refreshed successfully',
          type: 'success'
        });
        Neutralino.events.broadcast('discord-tokens-refreshed');
      } else {
        throw new Error('Failed to refresh authentication');
      }
    } catch (error) {
      await state.auth.saveAuthData(null);
      setIsAuthenticated(false);
      (window as any).consoleAddMessage?.({
        text: 'Error refreshing authentication: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    if (!state.configManager || !state.auth) return;
    setIsLoading(true);

    try {
      const botServerUrl = state.configManager.get('discord.botServerUrl');
      const response = await fetch(`${botServerUrl}/auth/check`);
      const data = await response.json();
      
      if (data.authenticated) {
        const userResponse = await fetch(`${botServerUrl}/auth/user`);
        const userData = await userResponse.json();
        setIsAuthenticated(true);
        (window as any).consoleAddMessage?.({
          text: `Connected as ${userData.global_name || 'Unknown User'}`,
          type: 'success'
        });
      } else {
        await authenticate();
      }
    } catch (error) {
      (window as any).consoleAddMessage?.({
        text: 'Error checking authentication: ' + (error instanceof Error ? error.message : 'Unknown error'),
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
      (window as any).consoleAddMessage?.({
        text: 'Logged out successfully',
        type: 'success'
      });
    } catch (error) {
      (window as any).consoleAddMessage?.({
        text: 'Error during logout: ' + (error instanceof Error ? error.message : 'Unknown error'),
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
        (window as any).consoleAddMessage?.({
          text: `Connected as ${detail.user?.global_name || 'Unknown User'}`,
          type: 'success'
        });
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
            class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isLoading() ? 'Logging out...' : 'Logout'}
          </button>
        )}
      </div>
    </div>
  );
}; 
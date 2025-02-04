import { Component, createEffect, createSignal, onMount, For } from 'solid-js';
import { state } from '../store';
import Neutralino from '@neutralinojs/lib';

interface ConfigField {
  key: string;
  value: string | number | boolean;
  type: string;
  label: string;
  description?: string;
}

function flattenConfig(obj: Record<string, any>, prefix = ''): ConfigField[] {
  return Object.entries(obj).reduce<ConfigField[]>((acc, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [...acc, ...flattenConfig(value, fullKey)];
    }
    return [...acc, {
      key: fullKey,
      value,
      type: typeof value,
      label: fullKey.split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      description: getConfigDescription(fullKey)
    }];
  }, []);
}

function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'discord.botServerUrl': 'URL of the Discord bot server',
    'poe2.logPath': 'Path to the Path of Exile 2 client log file'
  };
  return descriptions[key] || '';
}

function validateConfigValue(key: string, value: string | number | boolean): string | null {
  if (key === 'discord.botServerUrl') {
    try {
      new URL(value as string);
    } catch {
      return 'Invalid URL format';
    }
  }
  if (key === 'poe2.logPath' && typeof value === 'string' && !value.trim()) {
    return 'Log path cannot be empty';
  }
  return null;
}

export const Configuration: Component = () => {
  const [configFields, setConfigFields] = createSignal<ConfigField[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const resetConfig = async () => {
    if (!state.configManager) return;
    setIsLoading(true);
    try {
      state.configManager.reset();
      await Neutralino.events.broadcast('configChanged', state.configManager.getAll());
      loadConfig();
      (window as any).consoleAddMessage?.({
        text: 'Configuration reset to defaults',
        type: 'success'
      });
    } catch (error) {
      (window as any).consoleAddMessage?.({
        text: `Error resetting config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = () => {
    if (!state.configManager) return;
    const config = state.configManager.getAll();
    setConfigFields(flattenConfig(config));
    setValidationErrors({});
  };

  const handleConfigChange = async (key: string, value: string | number | boolean) => {
    if (!state.configManager) return;
    
    const error = validateConfigValue(key, value);
    if (error) {
      setValidationErrors(prev => ({ ...prev, [key]: error }));
      return;
    }
    
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    
    setIsLoading(true);
    try {
      state.configManager.set(key, value);
      await Neutralino.events.broadcast('configChanged', state.configManager.getAll());
      (window as any).consoleAddMessage?.({
        text: `Updated ${key} = ${value}`,
        type: 'success'
      });
    } catch (error) {
      (window as any).consoleAddMessage?.({
        text: `Error updating config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
      loadConfig(); // Reload config on error to ensure UI is in sync
    } finally {
      setIsLoading(false);
    }
  };

  const handleExternalConfigChange = ({ detail: config }: { detail: Record<string, any> }) => {
    setConfigFields(flattenConfig(config));
    setValidationErrors({});
  };

  onMount(() => {
    Neutralino.events.on('configChanged', handleExternalConfigChange);
  });

  createEffect(() => {
    if (state.configManager) {
      loadConfig();
    }
  });

  return (
    <div class="bg-white rounded-xl shadow-sm p-5 relative">
      {isLoading() && (
        <div class="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Configuration</h2>
        <button
          onClick={resetConfig}
          disabled={isLoading()}
          class="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset to Defaults
        </button>
      </div>
      <div class="space-y-4">
        <For each={configFields()}>
          {(field) => (
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              {field.description && (
                <p class="text-xs text-gray-500 mb-1">{field.description}</p>
              )}
              {field.type === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={field.value as boolean}
                  onChange={(e) => handleConfigChange(field.key, e.currentTarget.checked)}
                  disabled={isLoading()}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
              ) : (
                <div class="space-y-1">
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={field.value as string | number}
                    onChange={(e) => handleConfigChange(field.key, field.type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}
                    disabled={isLoading()}
                    class={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 ${
                      validationErrors()[field.key] 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                        : 'border-gray-300'
                    }`}
                  />
                  {validationErrors()[field.key] && (
                    <p class="text-sm text-red-600">{validationErrors()[field.key]}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}; 
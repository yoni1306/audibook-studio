import { IPlugin, PluginConfig } from '../../interfaces';

export abstract class BasePlugin implements IPlugin {
  abstract readonly name: string;
  
  protected _config: PluginConfig;

  constructor(config?: Partial<PluginConfig>) {
    this._config = {
      enabled: true,
      ...this.getDefaultConfig(),
      ...config
    };
  }

  get config(): PluginConfig {
    return this._config;
  }

  isEnabled(): boolean {
    return this._config.enabled;
  }

  configure(config: Partial<PluginConfig>): void {
    this._config = { ...this._config, ...config };
  }

  protected abstract getDefaultConfig(): Partial<PluginConfig>;
}

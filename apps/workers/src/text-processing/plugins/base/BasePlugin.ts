export abstract class BasePlugin {
  protected config: Record<string, any>;

  constructor(config: Record<string, any> = {}) {
    this.config = { ...this.getDefaultConfig(), ...config };
  }

  protected abstract getDefaultConfig(): Record<string, any>;

  public updateConfig(newConfig: Record<string, any>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): Record<string, any> {
    return { ...this.config };
  }
}

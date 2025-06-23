import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface ParagraphLimits {
  minCharacters: number;
  maxCharacters: number;
  minWords: number;
  maxWords: number;
}

@Injectable()
export class ParagraphLimitsConfig {
  private static readonly CONFIG_PATH = path.join(__dirname, 'paragraph-limits.json');
  private limits: ParagraphLimits;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configData = fs.readFileSync(ParagraphLimitsConfig.CONFIG_PATH, 'utf8');
      const config = JSON.parse(configData);
      this.limits = config.paragraphLimits;
    } catch (error) {
      // Fallback to default values if config file is not found or invalid
      console.warn('Could not load paragraph limits config, using defaults:', error instanceof Error ? error.message : String(error));
      this.limits = {
        minCharacters: 1700,
        maxCharacters: 8000,
        minWords: 300,
        maxWords: 1800,
      };
    }
  }

  getLimits(): ParagraphLimits {
    return { ...this.limits };
  }

  getMinCharacters(): number {
    return this.limits.minCharacters;
  }

  getMaxCharacters(): number {
    return this.limits.maxCharacters;
  }

  getMinWords(): number {
    return this.limits.minWords;
  }

  getMaxWords(): number {
    return this.limits.maxWords;
  }

  // Method to reload config if needed
  reloadConfig(): void {
    this.loadConfig();
  }
}

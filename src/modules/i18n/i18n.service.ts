import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { i18nConfig } from '../../config/i18n.config';

@Injectable()
export class I18nService {
  private translations: { [key: string]: any } = {};
  private readonly logger = new Logger(I18nService.name);

  constructor(private readonly configService: ConfigService) {}

  async initialize() {
    await this.loadTranslations();
  }

  private async loadTranslations() {
    const config = i18nConfig(this.configService);
    const { path: translationsPath, languages } = config;

    for (const lang of languages) {
      const filePath = path.join(translationsPath, `${lang}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        this.translations[lang] = JSON.parse(data);
        this.logger.log(`Loaded translations for ${lang} from ${filePath}`);
      } catch (error) {
        this.logger.error(`Failed to load translation for ${lang}: ${error.message}`);
        throw new Error(`Translation file for ${lang} could not be loaded`);
      }
    }
  }

  getTranslation(key: string, language: string, params: { [key: string]: string | undefined } = {}): string {
    const lang = language in this.translations ? language : 'uz';
    const keys = key.split('.');
    let result = this.translations[lang];

    for (const k of keys) {
      result = result?.[k];
      if (!result) {
        this.logger.warn(`Translation key ${key} not found for language ${lang}`);
        return key;
      }
    }

    let translation = typeof result === 'string' ? result : key;
    for (const [param, value] of Object.entries(params)) {
      const placeholder = `{${param}}`;
      translation = translation.replace(placeholder, value ?? this.translations[lang]?.profile?.not_set ?? 'Not set');
    }

    return translation;
  }
}
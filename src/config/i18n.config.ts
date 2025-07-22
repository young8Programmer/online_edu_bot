import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const i18nConfig = (configService: ConfigService) => ({
  path: path.join(__dirname, '../../assets/i18n'),
  languages: ['uz', 'ru', 'en'],
});
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { I18nService } from './i18n.service';

@Module({
  imports: [ConfigModule],
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule implements OnModuleInit {
  constructor(private readonly i18nService: I18nService) {}

  async onModuleInit() {
    await this.i18nService.initialize();
  }
}
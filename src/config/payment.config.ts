import { ConfigService } from '@nestjs/config';

export const paymentConfig = (configService: ConfigService) => ({
  providerToken: configService.get('PAYMENT_PROVIDER_TOKEN', ''),
});
import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SendNotificationHandler } from './handlers/send-reminder.handler';
import { BroadcastHandler } from './handlers/broadcast.handler';
import { UserModule } from '../user/user.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => AuthModule),
    I18nModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, SendNotificationHandler, BroadcastHandler],
  exports: [NotificationService],
})
export class NotificationModule {}
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payment } from './payment.entity';
import { InitiatePaymentHandler } from './handlers/initiate-payment.handler';
import { VerifyPaymentHandler } from './handlers/verify-payment.handler';
import { PaymentHistoryHandler } from './handlers/payment-history.handler';
import { CourseModule } from '../course/course.module';
import { UserModule } from '../user/user.module';
import { I18nModule } from '../i18n/i18n.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    forwardRef(() => CourseModule),
    forwardRef(() => UserModule),
    I18nModule,
    forwardRef(() => TelegramModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, InitiatePaymentHandler, VerifyPaymentHandler, PaymentHistoryHandler],
  exports: [PaymentService, InitiatePaymentHandler, VerifyPaymentHandler],
})
export class PaymentModule {}
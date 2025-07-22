import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { StartHandler } from './handlers/start.handler';
import { HelpHandler } from './handlers/help.handler';
import { AdminHandler } from './handlers/admin.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { I18nModule } from '../i18n/i18n.module';
import { RegisterHandler } from '../user/handlers/register.handler';
import { LanguageHandler } from '../user/handlers/language.handler';
import { ProfileHandler } from '../user/handlers/profile.handler';
import { NotificationModule } from '../notification/notification.module';
import { CourseModule } from '../course/course.module';
import { LessonModule } from '../lesson/lesson.module';
import { QuizModule } from '../quiz/quiz.module';
import { ListCoursesHandler } from '../course/handlers/list-course.handler';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => UserModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => CourseModule),
    forwardRef(() => LessonModule),
    forwardRef(() => QuizModule),
    forwardRef(() => PaymentModule),
    AuthModule,
    I18nModule,
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    StartHandler,
    HelpHandler,
    AdminHandler,
    CallbackHandler,
    RegisterHandler,
    LanguageHandler,
    ProfileHandler,
    ListCoursesHandler
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
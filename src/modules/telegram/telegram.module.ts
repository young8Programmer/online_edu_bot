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
import { StartQuizHandler } from '../quiz/handlers/start-quiz.handler';
import { SubmitQuizHandler } from '../quiz/handlers/submit-quiz.handler';
import { CourseInfoHandler } from '../course/handlers/course-info.handler';
import { ListLessonsHandler } from '../lesson/handlers/list-lesson.handler';
import { ViewLessonHandler } from '../lesson/handlers/view-lesson.handler';
import { InitiatePaymentHandler } from '../payment/handlers/initiate-payment.handler';
import { ViewCertificatesHandler } from '../certificate/handlers/view-certificate.handler';
import { CertificateModule } from '../certificate/certificate.module';
import { ProgressModule } from '../progress/progress.module';
import { CompleteLessonHandler } from '../lesson/handlers/complete-lesson.handler';
import { GeneralQuizHandler } from '../quiz/handlers/general-quiz.handler';
import { StartCourseHandler } from '../course/handlers/start-course.handler';

// 🟩 Bu yerda Map ni provider qilamiz
const ForcedUserPanelMapProvider = {
  provide: 'FORCED_USER_PANEL_MAP',
  useValue: new Map<number, boolean>(),
};

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => UserModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => CourseModule),
    forwardRef(() => LessonModule),
    forwardRef(() => QuizModule),
    forwardRef(() => PaymentModule),
    forwardRef(() => CertificateModule),
    forwardRef(() => ProgressModule),
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
    ListCoursesHandler,
    StartQuizHandler,
    SubmitQuizHandler,
    CourseInfoHandler,
    ListLessonsHandler,
    ViewLessonHandler,
    InitiatePaymentHandler,
    ViewCertificatesHandler,
    CompleteLessonHandler,
    GeneralQuizHandler,
    StartQuizHandler,
    StartCourseHandler,
    ForcedUserPanelMapProvider, // 🟢 Provider qo‘shildi
  ],
  exports: [TelegramService],
})
export class TelegramModule {}

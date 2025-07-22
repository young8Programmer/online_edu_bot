import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { Quiz } from './quiz.entity';
import { QuizResult } from './quiz-result.entity';
import { StartQuizHandler } from './handlers/start-quiz.handler';
import { SubmitQuizHandler } from './handlers/submit-quiz.handler';
import { ViewResultsHandler } from './handlers/view-result.handler';
import { CourseModule } from '../course/course.module';
import { UserModule } from '../user/user.module';
import { TelegramModule } from '../telegram/telegram.module';
import { I18nModule } from '../i18n/i18n.module'; 
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, QuizResult]),
    CourseModule,
    UserModule,
    forwardRef(() => TelegramModule),
     forwardRef(() => CertificateModule),
    I18nModule, 
  ],
  controllers: [QuizController],
  providers: [
    QuizService,
    StartQuizHandler,
    SubmitQuizHandler,
    ViewResultsHandler,
  ],
  exports: [QuizService, StartQuizHandler, SubmitQuizHandler],
})
export class QuizModule {}
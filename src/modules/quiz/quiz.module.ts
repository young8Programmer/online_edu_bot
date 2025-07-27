import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { Quiz } from './quiz.entity';
import { StartQuizHandler } from './handlers/start-quiz.handler';
import { SubmitQuizHandler } from './handlers/submit-quiz.handler';
import { ViewResultsHandler } from './handlers/view-result.handler';
import { CourseModule } from '../course/course.module';
import { LessonModule } from '../lesson/lesson.module';
import { UserModule } from '../user/user.module';
import { ProgressModule } from '../progress/progress.module';
import { CertificateModule } from '../certificate/certificate.module';
import { I18nModule } from '../i18n/i18n.module';
import { QuizResult } from './quiz-result.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { GeneralQuizHandler } from './handlers/general-quiz.handler';
import { Question } from './question.entity';
import { MixedQuizHandler } from './handlers/mixed-quiz.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, QuizResult, Question]),
    forwardRef(() => CourseModule),
    forwardRef(() => LessonModule),
    forwardRef(() => UserModule),
    forwardRef(() => ProgressModule),
    forwardRef(() => CertificateModule),
    forwardRef(() => TelegramModule),
    I18nModule,
  ],
  controllers: [QuizController],
  providers: [QuizService, StartQuizHandler, SubmitQuizHandler, ViewResultsHandler, GeneralQuizHandler, MixedQuizHandler],
  exports: [QuizService],
})
export class QuizModule {}
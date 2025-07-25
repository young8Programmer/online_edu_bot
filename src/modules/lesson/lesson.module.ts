import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { Lesson } from './lesson.entity';
import { ListLessonsHandler } from './handlers/list-lesson.handler';
import { ViewLessonHandler } from './handlers/view-lesson.handler';
import { CompleteLessonHandler } from './handlers/complete-lesson.handler';
import { CourseModule } from '../course/course.module';
import { UserModule } from '../user/user.module';
import { ProgressModule } from '../progress/progress.module';
import { I18nModule } from '../i18n/i18n.module';
import { TelegramModule } from '../telegram/telegram.module';
import { QuizModule } from '../quiz/quiz.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson]),
    UserModule,
    forwardRef(() => ProgressModule),
    I18nModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => QuizModule),
    forwardRef(() => CourseModule),
  ],
  controllers: [LessonController],
  providers: [LessonService, ListLessonsHandler, ViewLessonHandler, CompleteLessonHandler],
  exports: [LessonService],
})
export class LessonModule {}
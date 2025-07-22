import { forwardRef, Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson]),
    CourseModule,
    I18nModule,
    UserModule,
    forwardRef(() => ProgressModule)
  ],
  controllers: [LessonController],
  providers: [LessonService, ListLessonsHandler, ViewLessonHandler, CompleteLessonHandler],
  exports: [LessonService],
})
export class LessonModule {}

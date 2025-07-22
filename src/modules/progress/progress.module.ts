import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { Progress } from './progress.entity';
import { ViewProgressHandler } from './handlers/view-progress.handler';
import { UpdateProgressHandler } from './handlers/update-progress.handler';
import { CourseModule } from '../course/course.module';
import { LessonModule } from '../lesson/lesson.module';
import { UserModule } from '../user/user.module';
import { TelegramModule } from '../telegram/telegram.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Progress]),
    forwardRef(() => CourseModule),
    forwardRef(() => LessonModule),
    forwardRef(() => UserModule),
    forwardRef(() => TelegramModule),
    I18nModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService, ViewProgressHandler, UpdateProgressHandler],
  exports: [ProgressService],
})
export class ProgressModule {}
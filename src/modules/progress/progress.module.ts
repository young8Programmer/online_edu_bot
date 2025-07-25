import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { Progress } from './progress.entity';
import { ViewProgressHandler } from './handlers/view-progress.handler';
import { UserModule } from '../user/user.module';
import { LessonModule } from '../lesson/lesson.module';
import { CourseModule } from '../course/course.module';
import { I18nModule } from '../i18n/i18n.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UpdateProgressHandler } from './handlers/update-progress.handler';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Progress]),
    forwardRef(() => UserModule),
    forwardRef(() => LessonModule),
    forwardRef(() => CourseModule),
    I18nModule,
    forwardRef(() => TelegramModule),
     forwardRef(() => AuthModule)
  ],
  controllers: [ProgressController],
  providers: [ProgressService, ViewProgressHandler, UpdateProgressHandler],
  exports: [ProgressService],
})
export class ProgressModule {}
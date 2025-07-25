import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { Course } from './course.entity';
import { ListCoursesHandler } from './handlers/list-course.handler';
import { CourseInfoHandler } from './handlers/course-info.handler';
import { StartCourseHandler } from './handlers/start-course.handler';
import { UserModule } from '../user/user.module';
import { I18nModule } from '../i18n/i18n.module';
import { PaymentModule } from '../payment/payment.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';
import { LessonModule } from '../lesson/lesson.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course]),
    forwardRef(() => UserModule),
    forwardRef(() => PaymentModule),
    I18nModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => AuthModule),
    forwardRef(() => LessonModule),
  ],
  controllers: [CourseController],
  providers: [CourseService, ListCoursesHandler, CourseInfoHandler, StartCourseHandler],
  exports: [CourseService, StartCourseHandler],
})
export class CourseModule {}
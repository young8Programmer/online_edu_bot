import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { Certificate } from './certificate.entity';
import { GenerateCertificateHandler } from './handlers/generate-certificate.handler';
import { ViewCertificatesHandler } from './handlers/view-certificate.handler';
import { CourseModule } from '../course/course.module';
import { UserModule } from '../user/user.module';
import { ProgressModule } from '../progress/progress.module';
import { I18nModule } from '../i18n/i18n.module';
import { TelegramModule } from '../telegram/telegram.module';
import { QuizModule } from '../quiz/quiz.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Certificate]),
    forwardRef(() => CourseModule),
    forwardRef(() => UserModule),
    forwardRef(() => ProgressModule),
    forwardRef(() => QuizModule),
    forwardRef(() => TelegramModule),
    I18nModule,
  ],
  controllers: [CertificateController],
  providers: [CertificateService, GenerateCertificateHandler, ViewCertificatesHandler],
  exports: [CertificateService],
})
export class CertificateModule {}
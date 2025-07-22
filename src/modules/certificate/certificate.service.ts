import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './certificate.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';
import { ProgressService } from '../progress/progress.service';
import { QuizService } from '../quiz/quiz.service';
import { I18nService } from '../i18n/i18n.service';
import * as PDFKit from 'pdfkit';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly progressService: ProgressService,
    private readonly quizService: QuizService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
  ) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
    });
  }

  private s3: AWS.S3;

  async generateCertificate(telegramId: string, courseId: number, language: string = 'uz'): Promise<Certificate> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);

    if (!user) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.user_not_found', language));
    }
    if (!course) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.course_not_found', language));
    }

    const { completed, total } = await this.progressService.getProgress(telegramId, courseId);
    if (completed < total) {
      throw new BadRequestException(this.i18nService.getTranslation('errors.course_not_completed', language));
    }

    const quizResults = await this.quizService.getResults(telegramId, courseId);
    const totalQuizzes = quizResults.length;
    const correctAnswers = quizResults.filter((result) => result.isCorrect).length;
    const percentage = totalQuizzes > 0 ? (correctAnswers / totalQuizzes) * 100 : 0;

    if (percentage < 60) {
      throw new BadRequestException(
        this.i18nService.getTranslation('errors.certificate_generation_failed', language, {
          reason: `You scored ${percentage.toFixed(2)}% on quizzes. A minimum of 60% is required for a certificate.`,
        }),
      );
    }

    const existingCertificate = await this.certificateRepository.findOne({
      where: { user: { id: user.id }, course: { id: courseId } },
      relations: ['user', 'course'],
    });

    if (existingCertificate) {
      return existingCertificate;
    }

    const pdfBuffer = await this.createPDF(user.fullName, course.title[language], language);
    const pdfUrl = await this.uploadToS3(pdfBuffer, `${user.telegramId}_${courseId}_${uuidv4()}.pdf`);

    const certificate = this.certificateRepository.create({
      user,
      course,
      pdfUrl,
      issuedAt: new Date(),
    });

    return this.certificateRepository.save(certificate);
  }

  async getCertificates(telegramId: string, language: string = 'uz'): Promise<Certificate[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.user_not_found', language));
    }
    return this.certificateRepository.find({
      where: { user: { id: user.id } },
      relations: ['course'],
    });
  }

  private async createPDF(fullName: string, courseTitle: string, language: string): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFKit();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(25).text(this.i18nService.getTranslation('certificates.title', language), 100, 80, { align: 'center' });
      doc.fontSize(18).text(this.i18nService.getTranslation('certificates.user', language, { fullName }), 100, 150, { align: 'center' });
      doc.fontSize(16).text(this.i18nService.getTranslation('certificates.course_completed', language), 100, 200, { align: 'center' });
      doc.fontSize(20).text(courseTitle, 100, 250, { align: 'center' });
      doc.fontSize(14).text(this.i18nService.getTranslation('certificates.issued', language, { date: new Date().toLocaleDateString(language) }), 100, 300, { align: 'center' });

      doc.end();
    });
  }

  private async uploadToS3(buffer: Buffer, fileName: string): Promise<string> {
    const params = {
      Bucket: this.configService.get('AWS_S3_BUCKET'),
      Key: `certificates/${fileName}`,
      Body: buffer,
      ContentType: 'application/pdf',
    };

    const { Location } = await this.s3.upload(params).promise();
    return Location;
  }
}
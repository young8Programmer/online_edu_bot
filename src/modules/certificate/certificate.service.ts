import { Injectable, forwardRef, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './certificate.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';
import { ProgressService } from '../progress/progress.service';
import { QuizService } from '../quiz/quiz.service';
import { I18nService } from '../i18n/i18n.service';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Buffer } from 'buffer';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly progressService: ProgressService,
    @Inject(forwardRef(() => QuizService))
    private readonly quizService: QuizService,
    private readonly i18nService: I18nService,
  ) {}

  async getCertificates(telegramId: string): Promise<Certificate[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) throw new NotFoundException();
    return this.certificateRepository.find({ where: { user: { id: user.id } }, relations: ['course'] });
  }

  async getCertificateById(id: number): Promise<Certificate> {
    const certificate = await this.certificateRepository.findOne({ where: { id }, relations: ['course'] });
    if (!certificate) throw new NotFoundException();
    return certificate;
  }

  async generateCertificate(telegramId: string, courseId: number, language: string): Promise<Buffer> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);
    if (!user || !course) throw new NotFoundException();

    const progress = await this.progressService.getProgress(telegramId, courseId);
    const quizzes = await this.quizService.findByCourseId(courseId);
    if (progress.completed !== progress.total) throw new NotFoundException();

    const qrCode = await QRCode.toDataURL(`https://example.com/verify/${telegramId}/${courseId}`);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      doc.fontSize(25).text(this.i18nService.getTranslation('certificates.title', language), 100, 80, { align: 'center' });
      doc.fontSize(18).text(this.i18nService.getTranslation('certificates.user', language, { fullName: user.fullName }), 100, 150, { align: 'center' });
      doc.fontSize(16).text(this.i18nService.getTranslation('certificates.course_completed', language), 100, 200, { align: 'center' });
      doc.fontSize(20).text(course.title[language], 100, 250, { align: 'center' });
      doc.fontSize(14).text(this.i18nService.getTranslation('certificates.issued', language, { date: new Date().toLocaleDateString('uz-UZ') }), 100, 300, { align: 'center' });
      doc.image(qrCode, 450, 300, { width: 100 });

      doc.end();
    });
  }

  async createCertificate(telegramId: string, courseId: number): Promise<Certificate> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);
    if (!user || !course) throw new NotFoundException();

    const existing = await this.certificateRepository.findOne({ where: { user: { id: user.id }, course: { id: courseId } } });
    if (existing) return existing;

    const pdfBuffer = await this.generateCertificate(telegramId, courseId, user.language);
    const certificate = this.certificateRepository.create({
      user,
      course,
      issuedAt: new Date(),
      pdfBuffer,
      qrCode: `https://example.com/verify/${telegramId}/${courseId}`,
    });

    return this.certificateRepository.save(certificate);
  }

  
}
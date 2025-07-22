import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './certificate.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';
import { I18nService } from '../i18n/i18n.service';
import * as PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly i18nService: I18nService,
  ) {}

  async getCertificates(telegramId: string): Promise<Certificate[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.user_not_found', 'uz'));
    }

    return this.certificateRepository.find({
      where: { user: { id: user.id } },
      relations: ['course'],
    });
  }

  async generateCertificate(telegramId: string, courseId: number, language: string): Promise<Buffer> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);
    if (!user || !course) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.not_found', language));
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        const finalBuffer = Buffer.concat(buffers);
        if (!finalBuffer || finalBuffer.length === 0) {
          reject(new Error('Generated PDF buffer is empty'));
        } else {
          resolve(finalBuffer);
        }
      });
      doc.on('error', (err) => reject(err));

      doc.fontSize(25).text(this.i18nService.getTranslation('certificates.title', language), 100, 80, { align: 'center' });
      doc.fontSize(18).text(
        this.i18nService.getTranslation('certificates.user', language, { fullName: user.fullName }),
        100,
        150,
        { align: 'center' }
      );
      doc.fontSize(16).text(
        this.i18nService.getTranslation('certificates.course_completed', language),
        100,
        200,
        { align: 'center' }
      );
      doc.fontSize(20).text(course.title[language], 100, 250, { align: 'center' });
      doc.fontSize(14).text(
        this.i18nService.getTranslation('certificates.issued', language, {
          date: new Date().toLocaleDateString('uz-UZ'),
        }),
        100,
        300,
        { align: 'center' }
      );

      doc.end();
    });
  }

  async createCertificate(telegramId: string, courseId: number): Promise<Certificate> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);
    if (!user || !course) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.not_found', 'uz'));
    }

    const pdfBuffer = await this.generateCertificate(telegramId, courseId, user.language);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Failed to generate PDF buffer');
    }

    const certificate = this.certificateRepository.create({
      user,
      course,
      issuedAt: new Date(),
      pdfBuffer,
    });

    return this.certificateRepository.save(certificate);
  }
}
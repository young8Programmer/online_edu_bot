import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Progress } from './progress.entity';
import { UserService } from '../user/user.service';
import { LessonService } from '../lesson/lesson.service';
import { I18nService } from '../i18n/i18n.service';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Progress)
    private readonly progressRepository: Repository<Progress>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => LessonService))
    private readonly lessonService: LessonService,
    private readonly i18nService: I18nService,
  ) {}

  async updateProgress(telegramId: string, lessonId: number, language: string = 'uz'): Promise<Progress> {
    const user = await this.userService.findByTelegramId(telegramId);
    const lesson = await this.lessonService.findById(lessonId);

    if (!user) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.user_not_found', language));
    }
    if (!lesson) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.lesson_not_found', language));
    }

    const existingProgress = await this.progressRepository.findOne({
      where: {
        user: { id: user.id },
        lesson: { id: lesson.id },
      },
      relations: ['user', 'lesson'],
    });

    if (existingProgress) {
      // Agar progress mavjud bo'lsa va yangilanish kerak bo'lsa
      existingProgress.completedAt = new Date();
      return this.progressRepository.save(existingProgress);
    }

    const progress = this.progressRepository.create({
      user,
      lesson,
      completedAt: new Date(),
    });

    return this.progressRepository.save(progress);
  }

  async getProgress(telegramId: string, courseId: number, language: string = 'uz'): Promise<{ completed: number; total: number }> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException(this.i18nService.getTranslation('errors.user_not_found', language));
    }

    const lessons = await this.lessonService.findByCourseId(courseId);
    if (!lessons.length) {
      return { completed: 0, total: 0 };
    }

    const completedLessons = await this.progressRepository
      .createQueryBuilder('progress')
      .leftJoin('progress.lesson', 'lesson')
      .where('progress.user.id = :userId', { userId: user.id })
      .andWhere('lesson.course.id = :courseId', { courseId })
      .getMany();

    return {
      completed: completedLessons.length,
      total: lessons.length,
    };
  }
}
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Progress } from './progress.entity';
import { UserService } from '../user/user.service';
import { LessonService } from '../lesson/lesson.service';
import { CourseService } from '../course/course.service';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Progress)
    private readonly progressRepository: Repository<Progress>,
    private readonly userService: UserService,
   @Inject(forwardRef(() => LessonService)) // ← forwardRef orqali circular importni hal qilamiz
  private readonly lessonService: LessonService,
    private readonly courseService: CourseService,
  ) {}

  async getProgress(telegramId: string, courseId: number): Promise<{ completed: number; total: number }> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);
    if (!user || !course) throw new NotFoundException('User or course not found');

    const lessons = await this.lessonService.findByCourseId(courseId);
    const completedLessons = await this.progressRepository.find({
      where: { user: { id: user.id }, lesson: { course: { id: courseId } } },
    });

    return {
      completed: completedLessons.length,
      total: lessons.length,
    };
  }

  async updateProgress(telegramId: string, lessonId: number): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    const lesson = await this.lessonService.findById(lessonId);
    if (!user || !lesson) throw new NotFoundException('User or lesson not found');

    const existingProgress = await this.progressRepository.findOne({
      where: { user: { id: user.id }, lesson: { id: lesson.id } },
    });

    if (!existingProgress) {
      const progress = this.progressRepository.create({
        user,
        lesson,
        completedAt: new Date(),
      });
      await this.progressRepository.save(progress);
    }
  }

  async updateProgressAfterQuiz(telegramId: string, lessonId: number): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    const lesson = await this.lessonService.findById(lessonId);
    if (!user || !lesson) throw new NotFoundException('User or lesson not found');

    const progress = await this.progressRepository.findOne({
      where: { user: { id: user.id }, lesson: { id: lesson.id } },
    });

    if (!progress) {
      const newProgress = this.progressRepository.create({
        user,
        lesson,
        completedAt: new Date(),
      });
      await this.progressRepository.save(newProgress);
    }
  }

  async checkCourseCompletion(telegramId: string, courseId: number): Promise<{ completed: number; total: number }> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);
    if (!user || !course) throw new NotFoundException('User or course not found');

    const lessons = await this.lessonService.findByCourseId(courseId);
    const completedLessons = await this.progressRepository.find({
      where: { user: { id: user.id }, lesson: { course: { id: courseId } } },
    });

    return { completed: completedLessons.length, total: lessons.length };
  }
}
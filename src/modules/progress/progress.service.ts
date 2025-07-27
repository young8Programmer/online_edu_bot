import { Injectable, forwardRef, Inject, NotFoundException } from '@nestjs/common';
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
    @Inject(forwardRef(() => LessonService))
    private readonly lessonService: LessonService,
    private readonly courseService: CourseService,
  ) {}

  async getCompletedLessonIds(telegramId: string, courseId: number): Promise<number[]> {
  const user = await this.userService.findByTelegramId(telegramId);
  if (!user) throw new NotFoundException('User not found');

  const progress = await this.progressRepository.find({
    where: { user: { id: user.id }, lesson: { course: { id: courseId } } },
    relations: ['lesson'],
  });

  return progress.map(p => p.lesson.id);
}

async getLatestLessonId(telegramId: string, courseId: number): Promise<number | null> {
  const user = await this.userService.findByTelegramId(telegramId);
  if (!user) throw new NotFoundException('User not found');

  const latest = await this.progressRepository.findOne({
    where: { user: { id: user.id }, lesson: { course: { id: courseId } } },
    relations: ['lesson'],
    order: { lesson: { id: 'DESC' } },
  });

  return latest?.lesson.id || null;
}


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

  async getNextLesson(telegramId: string, currentLessonId: number): Promise<any | null> {
    const currentLesson = await this.lessonService.findById(currentLessonId);
    if (!currentLesson) return null;

    const lessons = await this.lessonService.findByCourseId(currentLesson.course.id);
    const sortedLessons = lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = sortedLessons.findIndex((lesson) => lesson.id === currentLessonId);

    if (currentIndex === -1 || currentIndex + 1 >= sortedLessons.length) return null;

    const nextLesson = sortedLessons[currentIndex + 1];
    const canAccess = await this.lessonService.canAccessLesson(telegramId, nextLesson.id);
    if (!canAccess) {
      await this.lessonService.unlockLesson(telegramId, nextLesson.id);
    }
    return nextLesson;
  }
}
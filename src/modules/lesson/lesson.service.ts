import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { CourseService } from '../course/course.service';
import { ProgressService } from '../progress/progress.service';
import { UserService } from '../user/user.service';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly courseService: CourseService,
    private readonly progressService: ProgressService,
    private readonly userService: UserService,
  ) {}

  async findAll(): Promise<Lesson[]> {
    return this.lessonRepository.find({
      relations: ['course'],
      order: { order: 'ASC' },
    });
  }

  async findByCourseId(courseId: number): Promise<Lesson[]> {
    return this.lessonRepository.find({
      where: { course: { id: courseId } },
      order: { order: 'ASC' },
    });
  }

  async findById(id: number): Promise<Lesson | null> {
    return this.lessonRepository.findOne({
      where: { id },
      relations: ['course'],
    });
  }

  async canAccessLesson(telegramId: string, lessonId: number): Promise<boolean> {
    const lesson = await this.findById(lessonId);
    if (!lesson) return false;

    const lessons = await this.findByCourseId(lesson.course.id);
    const lessonIndex = lessons.findIndex((l) => l.id === lessonId);
    if (lessonIndex === 0) return this.courseService.canAccessCourse(telegramId, lesson.course.id);

    const progress = await this.progressService.getProgress(telegramId, lesson.course.id);
    return progress.completed >= lessonIndex;
  }

  async getAccessibleLessons(telegramId: string, courseId: number): Promise<number[]> {
    const lessons = await this.findByCourseId(courseId);
    const progress = await this.progressService.getProgress(telegramId, courseId);
    return lessons
      .filter((_, index) => index === 0 || progress.completed > index)
      .map((lesson) => lesson.id);
  }

  async createLesson(data: {
    courseId: number;
    title: { uz: string; ru: string; en: string };
    contentType: string;
    contentUrl: string;
    order: number;
  }): Promise<Lesson> {
    const course = await this.courseService.findById(data.courseId);
    if (!course) throw new NotFoundException('Course not found');
    const lesson = this.lessonRepository.create({ course, ...data });
    return this.lessonRepository.save(lesson);
  }

  async createLessons(data: Array<{
    courseId: number;
    title: { uz: string; ru: string; en: string };
    contentType: string;
    contentUrl: string;
    order: number;
  }>): Promise<Lesson[]> {
    const lessons = await Promise.all(
      data.map(async (item) => {
        const course = await this.courseService.findById(item.courseId);
        if (!course) throw new NotFoundException('Course not found');
        return this.lessonRepository.create({ course, ...item });
      }),
    );
    return this.lessonRepository.save(lessons);
  }

  async updateLesson(id: number, data: {
    title?: { uz: string; ru: string; en: string };
    contentType?: string;
    contentUrl?: string;
    order?: number;
  }): Promise<void> {
    const lesson = await this.findById(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.lessonRepository.update(id, data);
  }

  async deleteLesson(id: number): Promise<void> {
    const lesson = await this.findById(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.lessonRepository.delete(id);
  }

  async unlockLesson(telegramId: string, lessonId: number): Promise<void> {
    const lesson = await this.findById(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.progressService.updateProgress(telegramId, lessonId);
  }

  async findNextLesson(currentLessonId: number, courseId: number): Promise<Lesson | null> {
    const lessons = await this.lessonRepository.find({
      where: { course: { id: courseId } },
      order: { order: 'ASC' },
    });

    const currentIndex = lessons.findIndex(lesson => lesson.id === currentLessonId);
    if (currentIndex === -1 || currentIndex + 1 >= lessons.length) {
      return null;
    }

    return lessons[currentIndex + 1];
  }
}
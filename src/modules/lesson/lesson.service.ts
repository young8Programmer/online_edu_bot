import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { CourseService } from '../course/course.service';
import { UserService } from '../user/user.service';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly courseService: CourseService,
    private readonly userService: UserService,
  ) {}

  async findByCourseId(courseId: number): Promise<Lesson[]> {
    return this.lessonRepository.find({ where: { course: { id: courseId } }, order: { order: 'ASC' } });
  }

  async findById(id: number): Promise<Lesson | null> {
    return this.lessonRepository.findOne({ where: { id }, relations: ['course'] });
  }

  async createLesson(data: {
    courseId: number;
    title: { uz: string; ru: string; en: string };
    contentType: string;
    contentUrl: string;
    order: number;
  }): Promise<Lesson> {
    const course = await this.courseService.findById(data.courseId);
    if (!course) {
      throw new Error('Kurs topilmadi');
    }
    const lesson = this.lessonRepository.create({
      course,
      title: data.title,
      contentType: data.contentType,
      contentUrl: data.contentUrl,
      order: data.order,
    });
    return this.lessonRepository.save(lesson);
  }

  async updateLesson(id: number, data: {
    title: { uz: string; ru: string; en: string };
    contentType: string;
    contentUrl: string;
    order: number;
  }): Promise<void> {
    const lesson = await this.findById(id);
    if (!lesson) {
      throw new Error('Dars topilmadi');
    }
    await this.lessonRepository.update(id, data);
  }

  async deleteLesson(id: number): Promise<void> {
    const lesson = await this.findById(id);
    if (!lesson) {
      throw new Error('Dars topilmadi');
    }
    await this.lessonRepository.delete(id);
  }

  async canAccessLesson(telegramId: string, lessonId: number): Promise<boolean> {
    const lesson = await this.findById(lessonId);
    if (!lesson) return false;
    return this.courseService.canAccessCourse(telegramId, lesson.course.id);
  }

  async canAccessCourse(telegramId: string, courseId: number): Promise<boolean> {
    return this.courseService.canAccessCourse(telegramId, courseId);
  }
}
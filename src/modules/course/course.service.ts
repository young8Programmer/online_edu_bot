import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './course.entity';
import { UserService } from '../user/user.service';

interface CourseInput {
  title_uz: string;
  title_ru: string;
  title_en: string;
  desc_uz: string;
  desc_ru: string;
  desc_en: string;
  price: number;
}

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly userService: UserService,
  ) {}

  async findAll(): Promise<Course[]> {
    return this.courseRepository.find();
  }

  async findById(id: number): Promise<Course | null> {
    return this.courseRepository.findOne({ where: { id } });
  }

  async createCourse(data: {
    title: { uz: string; ru: string; en: string };
    description: { uz: string; ru: string; en: string };
    isPaid: boolean;
    price?: number;
  }): Promise<Course> {
    const course = this.courseRepository.create(data);
    return this.courseRepository.save(course);
  }

  async createCourses(coursesData: CourseInput[]): Promise<Course[]> {
    const courses: Course[] = [];
    for (const data of coursesData) {
      const course = this.courseRepository.create({
        title: { uz: data.title_uz, ru: data.title_ru, en: data.title_en },
        description: { uz: data.desc_uz, ru: data.desc_ru, en: data.desc_en },
        isPaid: data.price > 0,
        price: data.price > 0 ? data.price : undefined,
      });
      courses.push(await this.courseRepository.save(course));
    }
    return courses;
  }

  async deleteCourse(id: number): Promise<void> {
    await this.courseRepository.delete(id);
  }

  async canAccessCourse(telegramId: string, courseId: number): Promise<boolean> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.findById(courseId);
    if (!user || !course) return false;
    if (!course.isPaid) return true;
    return false;
  }
}
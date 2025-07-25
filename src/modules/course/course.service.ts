import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './course.entity';
import { UserService } from '../user/user.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly userService: UserService,
    private readonly paymentService: PaymentService,
  ) {}

  async findAll(): Promise<Course[]> {
    return this.courseRepository.find({ relations: ['lessons', 'quizzes'] });
  }

  async findById(id: number): Promise<Course | null> {
    return this.courseRepository.findOne({ where: { id }, relations: ['lessons', 'quizzes'] });
  }

  async findUserCourses(telegramId: string): Promise<Course[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.courseRepository
      .createQueryBuilder('course')
      .innerJoin('course.users', 'user')
      .where('user.id = :userId', { userId: user.id })
      .getMany();
  }

  async canAccessCourse(telegramId: string, courseId: number): Promise<boolean> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.findById(courseId);
    if (!user || !course) {
      return false;
    }
    if (!course.isPaid) {
      return true;
    }
    return this.paymentService.canAccessCourse(telegramId, courseId);
  }

  async createCourse(data: {
    title: { uz: string; ru: string; en: string };
    description: { uz: string; ru: string; en: string };
    isPaid: boolean;
    price?: number;
    category?: string;
  }): Promise<Course> {
    const course = this.courseRepository.create(data);
    return this.courseRepository.save(course);
  }

  async createCourses(data: Array<{
    title: { uz: string; ru: string; en: string };
    description: { uz: string; ru: string; en: string };
    isPaid: boolean;
    price?: number;
    category?: string;
  }>): Promise<Course[]> {
    const courses = data.map((item) => this.courseRepository.create(item));
    return this.courseRepository.save(courses);
  }

  async updateCourse(
    id: number,
    data: {
      title?: { uz: string; ru: string; en: string };
      description?: { uz: string; ru: string; en: string };
      isPaid?: boolean;
      price?: number;
      category?: string;
    },
  ): Promise<void> {
    const course = await this.findById(id);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    await this.courseRepository.update(id, data);
  }

  async deleteCourse(id: number): Promise<void> {
    const course = await this.findById(id);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    await this.courseRepository.delete(id);
  }

  async enrollUser(telegramId: string, courseId: number): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.findById(courseId);
    if (!user || !course) {
      throw new NotFoundException('User or course not found');
    }

    // ✅ Check if user is already enrolled
    const isEnrolled = await this.courseRepository
      .createQueryBuilder('course')
      .innerJoin('course.users', 'user')
      .where('course.id = :courseId', { courseId })
      .andWhere('user.id = :userId', { userId: user.id })
      .getOne();

    if (isEnrolled) {
      return; // Allaqachon ro'yxatdan o'tgan
    }

    await this.courseRepository
      .createQueryBuilder()
      .relation(Course, 'users')
      .of(course)
      .add(user);
  }
}

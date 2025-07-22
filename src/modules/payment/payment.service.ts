import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
  ) {}

  async initiatePayment(telegramId: string, courseId: number, paymentMethod: string): Promise<Payment> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);

    if (!user || !course) {
      throw new Error('Foydalanuvchi yoki kurs topilmadi');
    }

    if (!course.isPaid) {
      throw new Error('Bu kurs bepul');
    }

    const payment = this.paymentRepository.create({
      user,
      course,
      amount: course.price,
      status: 'pending',
      transactionId: `TXN_${Date.now()}_${telegramId}`,
      paymentMethod,
    });

    return this.paymentRepository.save(payment);
  }

  async verifyPayment(transactionId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId },
      relations: ['user', 'course'],
    });

    if (!payment) {
      throw new Error('To‘lov topilmadi');
    }

    // Payme/Click API tekshiruvi bu yerda bo‘ladi (hoazircha mock)
    payment.status = 'completed';
    return this.paymentRepository.save(payment);
  }

  async getPaymentHistory(telegramId: string): Promise<Payment[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new Error('Foydalanuvchi topilmadi');
    }
    return this.paymentRepository.find({
      where: { user: { id: user.id } },
      relations: ['course'],
    });
  }

  async canAccessCourse(telegramId: string, courseId: number): Promise<boolean> {
    const user = await this.userService.findByTelegramId(telegramId);
    const course = await this.courseService.findById(courseId);

    if (!user || !course) return false;

    if (!course.isPaid) return true;

    const payment = await this.paymentRepository.findOne({
      where: { user: { id: user.id }, course: { id: courseId }, status: 'completed' },
    });

    return !!payment;
  }
}
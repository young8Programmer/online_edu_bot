import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './payment.entity';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':telegramId')
  async getPaymentHistory(@Param('telegramId') telegramId: string): Promise<Payment[]> {
    return this.paymentService.getPaymentHistory(telegramId);
  }

  @Post('verify/:transactionId')
  async verifyPayment(@Param('transactionId') transactionId: string): Promise<Payment> {
    return this.paymentService.verifyPayment(transactionId);
  }

  @Post()
  async initiate(@Body() data: { telegramId: string; courseId: number; paymentMethod: string }): Promise<Payment> {
    return this.paymentService.initiatePayment(data.telegramId, data.courseId, data.paymentMethod);
  }
}
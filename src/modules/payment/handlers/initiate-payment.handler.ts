import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class InitiatePaymentHandler {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const courseId = parseInt(query.data.split('_')[2], 10);
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    const course = await this.courseService.findById(courseId);
    if (!course) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
      return;
    }

    if (!course.isPaid) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.free_course', language));
      return;
    }

    const payment = await this.paymentService.initiatePayment(user.telegramId, courseId, 'telegram');
    const paymentUrl = `https://payme.uz/pay?transactionId=${payment.transactionId}`; // Payme/Click API linki bu yerda sozlanadi

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('payment.initiate', language, {
        course: course.title[language],
        amount: payment.amount.toString(),
        paymentUrl,
      }),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: this.i18nService.getTranslation('payment.verify', language), callback_data: `verify_payment_${payment.transactionId}` }],
            [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }],
          ],
        },
      },
    );
    await bot.answerCallbackQuery(query.id);
  }
}
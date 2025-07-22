import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class VerifyPaymentHandler {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const transactionId = query.data.split('_')[2];
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    try {
      const payment = await this.paymentService.verifyPayment(transactionId);
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('payment.verified', language, {
          course: payment.course.title[language],
        }),
        {
          reply_markup: {
            inline_keyboard: [[{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }]],
          },
        },
      );
    } catch (error) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_payment', language));
    }

    await bot.answerCallbackQuery(query.id);
  }
}
import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class PaymentHistoryHandler {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const user = await this.userService.findByTelegramId(msg.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    const payments = await this.paymentService.getPaymentHistory(user.telegramId);
    if (!payments.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.no_payments', language));
      return;
    }

    const message = payments
      .map((payment, index) => {
        return this.i18nService.getTranslation('payment.history_item', language, {
          index: (index + 1).toString(),
          course: payment.course.title[language],
          amount: payment.amount.toString(),
          status: payment.status,
          date: payment.createdAt.toLocaleDateString(),
        });
      })
      .join('\n\n');

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('payment.history', language) + '\n\n' + message,
      {
        reply_markup: {
          inline_keyboard: [[{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'menu' }]],
        },
      },
    );
  }
}
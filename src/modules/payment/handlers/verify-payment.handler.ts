import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from 'src/modules/telegram/telegram.service';

@Injectable()
export class VerifyPaymentHandler {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly i18nService: I18nService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = BigInt(query.from.id).toString();
    const data = query.data;

    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('pay_')) {
      const parts = data.split('_');
      if (parts.length < 3) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_callback', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const method = parts[1];
      const courseIdStr = parts.slice(2).join('_');
      const courseId = parseInt(courseIdStr, 10);

      if (isNaN(courseId)) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_course_id', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }

      try {
        const course = await this.courseService.findById(courseId);
        if (!course) {
          await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const payment = await this.paymentService.initiatePayment(telegramId, courseId, method);

        await bot.sendMessage(
          chatId,
          this.i18nService.getTranslation('payment.initiated', language, {
            link: payment.paymentLink,
          }),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: this.i18nService.getTranslation('payment.verify', language),
                    callback_data: `verify_payment_${payment.transactionId}`,
                  },
                ],
              ],
            },
          },
        );
      } catch (err) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.internal_error', language));
      }
    } else if (data.startsWith('buy_')) {
      const parts = data.split('_');
      const courseId = parseInt(parts[1], 10);

      if (isNaN(courseId)) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_course_id', language));
        return;
      }

      await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.select_method', language), {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Click',
                callback_data: `pay_click_${courseId}`,
              },
              {
                text: 'Payme',
                callback_data: `pay_payme_${courseId}`,
              },
            ],
          ],
        },
      });
    } else if (data.startsWith('verify_payment_')) {
      const parts = data.split('_');
      const transactionId = parts.slice(2).join('_');

      try {
        await this.paymentService.verifyPayment(transactionId);
        await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.confirmed', language));
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('welcome.message', language),
          language,
          telegramId,
        );
      } catch (error) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.payment_not_found', language));
      }
    } else if (data === 'payment_history') {
      const payments = await this.paymentService.getPaymentHistory(telegramId);

      const message =
        payments.length > 0
          ? this.i18nService.getTranslation('payment.history', language) +
            '\n\n' +
            payments
              .map(
                (payment, index) =>
                  `${index + 1}. *${this.escapeMarkdown(payment.course.title[language])}*\n` +
                  `💰 *${this.i18nService.getTranslation('payment.amount', language)}*: ${payment.amount} UZS\n` +
                  `📅 *${this.i18nService.getTranslation('payment.date', language)}*: ${payment.createdAt.toLocaleDateString()}\n` +
                  `🔖 *${this.i18nService.getTranslation('payment.status', language)}*: ${payment.status}`,
              )
              .join('\n\n')
          : this.i18nService.getTranslation('errors.no_payment_history', language);

      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
    }

    await bot.answerCallbackQuery(query.id);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}
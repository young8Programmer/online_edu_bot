import { Injectable } from '@nestjs/common';
import { CourseService } from '../course.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import { PaymentService } from '../../payment/payment.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class CourseInfoHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly paymentService: PaymentService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('course_info_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const canAccess = await this.courseService.canAccessCourse(user.telegramId, courseId);
      const message = this.i18nService.getTranslation('courses.info', language, {
        title: course.title[language],
        description: course.description[language],
        price: course.isPaid ? `${course.price} UZS` : this.i18nService.getTranslation('courses.free', language),
      });

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            canAccess
              ? [{ text: this.i18nService.getTranslation('courses.start', language), callback_data: `start_course_${courseId}` }]
              : course.isPaid
              ? [{ text: this.i18nService.getTranslation('payment.buy', language), callback_data: `select_payment_${courseId}` }]
              : [{ text: this.i18nService.getTranslation('courses.start', language), callback_data: `start_course_${courseId}` }],
            [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }],
          ],
        },
      };

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
    } else if (data.startsWith('select_payment_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Click', callback_data: `payment_type_${courseId}_click` },
              { text: 'Payme', callback_data: `payment_type_${courseId}_payme` },
            ],
            [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: `course_info_${courseId}` }],
          ],
        },
      };

      await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.select_type', language), { ...keyboard });
    } else if (data.startsWith('payment_type_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      const paymentType = data.split('_')[3];
      const course = await this.courseService.findById(courseId);
      if (!course) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const paymentLink = await this.paymentService.generatePaymentLink(user.telegramId, courseId, paymentType);
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: this.i18nService.getTranslation('payment.confirm', language), callback_data: `confirm_payment_${courseId}_${paymentType}` }],
            [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: `select_payment_${courseId}` }],
          ],
        },
      };

      await bot.sendMessage(chatId, `${this.i18nService.getTranslation('payment.link', language)}: ${paymentLink}`, { ...keyboard });
    } else if (data.startsWith('confirm_payment_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      const paymentType = data.split('_')[3];
      const course = await this.courseService.findById(courseId);
      if (!course) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const paymentConfirmed = await this.paymentService.confirmPayment(user.telegramId, courseId, paymentType);
      if (paymentConfirmed) {
        await this.courseService.enrollUser(user.telegramId, courseId);
        await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.success', language), {
          reply_markup: {
            inline_keyboard: [
              [{ text: this.i18nService.getTranslation('courses.start', language), callback_data: `start_course_${courseId}` }],
            ],
          },
        });
      } else {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('payment.failed', language));
      }
    }

    await bot.answerCallbackQuery(query.id);
  }
}
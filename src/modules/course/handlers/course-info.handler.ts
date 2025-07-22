import { Injectable } from '@nestjs/common';
import { CourseService } from '../course.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class CourseInfoHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const courseId = parseInt(query.data.split('_')[2], 10);
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

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
      access: canAccess ? this.i18nService.getTranslation('courses.access_granted', language) : this.i18nService.getTranslation('courses.access_denied', language),
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          canAccess
            ? [{ text: this.i18nService.getTranslation('courses.start', language), callback_data: `start_course_${courseId}` }]
            : [{ text: this.i18nService.getTranslation('payment.verify', language), callback_data: `buy_course_${courseId}` }],
          [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }],
        ],
      },
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    await bot.answerCallbackQuery(query.id);
  }
}
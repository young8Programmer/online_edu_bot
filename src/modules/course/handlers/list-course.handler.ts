import { Injectable } from '@nestjs/common';
import { CourseService } from '../course.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ListCoursesHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    const courses = await this.courseService.findAll();
    if (!courses.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('courses.no_courses', language));
      return;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: courses.map((course) => [
          { text: course.title[language], callback_data: `course_info_${course.id}` },
        ]),
      },
    };

    await bot.sendMessage(chatId, this.i18nService.getTranslation('courses.list', language), keyboard);
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const data = query.data;

    if (data.startsWith('course_info_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      if (isNaN(courseId)) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_input', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }
      const course = await this.courseService.findById(courseId);
      if (!course) {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
        await bot.answerCallbackQuery(query.id);
        return;
      }
      const canAccess = await this.courseService.canAccessCourse(telegramId, courseId);
      const message = this.i18nService.getTranslation('courses.info', language, {
        title: course.title[language],
        description: course.description[language],
        price: course.isPaid ? `${course.price} UZS` : this.i18nService.getTranslation('courses.free', language),
        access: canAccess ? this.i18nService.getTranslation('courses.access_granted', language) : this.i18nService.getTranslation('courses.access_denied', language),
      });

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
    await bot.answerCallbackQuery(query.id);
  }
}
import { Injectable } from '@nestjs/common';
import { CourseService } from '../course.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class StartCourseHandler {
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
    if (!canAccess) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_access_denied', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('success.course_started', language, { title: course.title[language] }),
      {
        reply_markup: {
          inline_keyboard: [[{ text: this.i18nService.getTranslation('lessons.list', language), callback_data: `list_lessons_${courseId}` }]],
        },
      },
    );
    await bot.answerCallbackQuery(query.id);
  }
}
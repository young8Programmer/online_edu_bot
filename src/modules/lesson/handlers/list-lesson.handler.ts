import { Injectable } from '@nestjs/common';
import { LessonService } from '../lesson.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ListLessonsHandler {
  constructor(
    private readonly lessonService: LessonService,
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
      return;
    }

    const canAccess = await this.lessonService.canAccessCourse(user.telegramId, courseId);
    if (!canAccess) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_access_denied', language));
      return;
    }

    const lessons = await this.lessonService.findByCourseId(courseId);
    if (!lessons.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('lessons.no_lessons', language));
      return;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: lessons.map((lesson) => [
          { text: lesson.title[language], callback_data: `view_lesson_${lesson.id}` },
        ]),
      },
    };

    await bot.sendMessage(chatId, this.i18nService.getTranslation('lessons.list', language), keyboard);
    await bot.answerCallbackQuery(query.id);
  }
}
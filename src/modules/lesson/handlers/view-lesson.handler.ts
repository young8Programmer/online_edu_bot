import { Injectable } from '@nestjs/common';
import { LessonService } from '../lesson.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ViewLessonHandler {
  constructor(
    private readonly lessonService: LessonService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const lessonId = parseInt(query.data.split('_')[2], 10);

    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    const lesson = await this.lessonService.findById(lessonId);
    if (!lesson || !lesson.course) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.lesson_not_found', language));
      return;
    }

    const canAccess = await this.lessonService.canAccessLesson(user.telegramId, lessonId);
    if (!canAccess) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.access_denied', language));
      return;
    }

    const message = this.i18nService.getTranslation('lessons.info', language, {
      title: lesson.title[language],
      contentType: lesson.contentType,
      contentUrl: lesson.contentUrl,
    });

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{
            text: this.i18nService.getTranslation('lessons.complete', language),
            callback_data: `complete_lesson_${lessonId}`
          }],
          [{
            text: this.i18nService.getTranslation('quizzes.start', language),
            callback_data: `start_quiz_lesson_${lessonId}_${lesson.course.id}` // ✅ endi to'g'ri ishlaydi
          }],
          [{
            text: this.i18nService.getTranslation('lessons.back', language),
            callback_data: `list_lessons_${lesson.course.id}`
          }],
        ],
      }
    });

    await bot.answerCallbackQuery(query.id);
  }
}

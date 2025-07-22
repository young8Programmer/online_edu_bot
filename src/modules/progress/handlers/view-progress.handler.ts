import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { LessonService } from '../../lesson/lesson.service';
import { ProgressService } from '../../progress/progress.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ViewProgressHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly lessonService: LessonService,
    private readonly progressService: ProgressService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const courses = await this.courseService.findAll();
    if (!courses.length) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('courses.no_courses', language), language, telegramId);
      return;
    }

    const progressMessages: string[] = [];
    for (const course of courses) {
      const progress = await this.progressService.getProgress(telegramId, course.id, language);
      const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

      progressMessages.push(
        this.i18nService.getTranslation('progress.info', language, {
          course: course.title[language],
          completed: progress.completed.toString(),
          total: progress.total.toString(),
          percentage: percentage.toString(),
        }),
      );
    }

    const message = progressMessages.length > 0
      ? progressMessages.join('\n\n')
      : this.i18nService.getTranslation('progress.no_progress', language);

    await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
  }
}
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { ProgressService } from '../progress.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class ViewProgressHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly progressService: ProgressService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly i18nService: I18nService,
    private readonly authService: AuthService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = BigInt(msg.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    if (msg.text === '/admin') {
      const isAdmin = await this.authService.isAdmin(telegramId);
      if (isAdmin) {
        const message = this.i18nService.getTranslation('admin.panel', language);
        await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
      } else {
        await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.access_denied', language));
      }
      return;
    }

    const courses = await this.courseService.findAll();
    const progressMessages: string[] = [];
    for (const course of courses) {
      const canAccess = await this.courseService.canAccessCourse(telegramId, course.id);
      if (canAccess) {
        const progress = await this.progressService.getProgress(telegramId, course.id);
        const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
        progressMessages.push(
          this.i18nService.getTranslation('progress.info', language, {
            title: this.escapeMarkdown(course.title[language]),
            completed: progress.completed.toString(),
            total: progress.total.toString(),
            percentage: percentage.toString(),
          }),
        );
      }
    }

    const message = progressMessages.length > 0
      ? progressMessages.join('\n\n')
      : this.i18nService.getTranslation('progress.no_progress', language);
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}
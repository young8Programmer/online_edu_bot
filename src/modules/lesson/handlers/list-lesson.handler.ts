import { Injectable, forwardRef, Inject } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { LessonService } from '../../lesson/lesson.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import { CourseService } from '../../course/course.service';

@Injectable()
export class ListLessonsHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly lessonService: LessonService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly courseService: CourseService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const telegramId = query.from.id.toString();
    let language: string = 'uz';

    try {
      const user = await this.userService.findByTelegramId(telegramId);
      language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

      if (!user) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('errors.user_not_found', language),
          language,
          telegramId,
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === 'view_lessons') {
        const courses = await this.courseService.findAll();
        if (!courses.length) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.i18nService.getTranslation('courses.no_courses', language) || 'Hozirda kurslar mavjud emas.',
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }
        const message = this.i18nService.getTranslation('lessons.select_course', language) || 'Darslarni ko‘rish uchun kursni tanlang:';
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: courses.map((course) => [
              { text: this.escapeMarkdown(course.title[language] || 'No title'), callback_data: `list_lessons_${course.id}` },
            ]),
          },
        });
      } else if (data.startsWith('list_lessons_')) {
        const courseId = parseInt(data.split('_')[2], 10);
        const course = await this.courseService.findById(courseId);
        if (!course) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.i18nService.getTranslation('errors.course_not_found', language) || 'Kurs topilmadi.',
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }
        const lessons = await this.lessonService.findByCourseId(courseId);
        const progress = await this.lessonService.getAccessibleLessons(telegramId, courseId);
        const message = lessons.length > 0
          ? this.i18nService.getTranslation('lessons.list', language) + '\n\n' +
            lessons.map((lesson, index) => {
              const title = lesson.title[language] || 'No title';
              const isAccessible = progress.includes(lesson.id);
              return `${index + 1}. *${this.escapeMarkdown(title)}*${isAccessible ? '' : ' 🔒'}\n` +
                     `📝 *${this.i18nService.getTranslation('lessons.type', language)}*: ${this.escapeMarkdown(lesson.contentType || 'N/A')}\n` +
                     `🔗 *${this.i18nService.getTranslation('lessons.url', language)}*: ${this.escapeMarkdown(lesson.contentUrl || 'N/A')}\n` +
                     `🔢 *${this.i18nService.getTranslation('lessons.order', language)}*: ${lesson.order || 'N/A'}`;
            }).join('\n\n')
          : this.i18nService.getTranslation('lessons.no_lessons', language) || 'Bu kurs uchun darslar topilmadi.';
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: lessons.length > 0 ? lessons.map((lesson) => [
              { text: this.escapeMarkdown(lesson.title[language] || 'No title'), callback_data: `view_lesson_${lesson.id}` },
            ]) : [],
          },
        });
      }
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.server_error', language) || 'Server xatosi yuz berdi.',
        language,
        telegramId,
      );
      await bot.answerCallbackQuery(query.id, {
        text: this.i18nService.getTranslation('errors.server_error', language) || 'Server xatosi yuz berdi.',
      });
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}
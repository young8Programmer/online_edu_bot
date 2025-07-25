// ListCoursesHandler
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';

@Injectable()
export class ListCoursesHandler {
  private readonly logger = new Logger(ListCoursesHandler.name);

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id.toString();
    const telegramId = msg.from.id.toString();
    let language: string = 'uz';

    try {
      this.logger.log(`Handling list_courses for telegramId: ${telegramId}, chatId: ${chatId}`);
      const user = await this.userService.findByTelegramId(telegramId);
      this.logger.log(`User fetched: ${JSON.stringify(user)}`);
      language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

      if (!user) {
        this.logger.warn(`User not found for telegramId: ${telegramId}`);
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('errors.user_not_found', language),
          language,
          telegramId,
        );
        return;
      }

      const courses = await this.courseService.findAll();
      this.logger.log(`Courses fetched: ${JSON.stringify(courses)}`);

      if (!courses.length) {
        this.logger.log(`No courses found`);
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('courses.no_courses', language) || 'Hozirda kurslar mavjud emas.',
          language,
          telegramId,
        );
        return;
      }

      const accessibleCourses = await Promise.all(
        courses.map(async (course) => {
          const canAccess = await this.courseService.canAccessCourse(telegramId, course.id);
          this.logger.log(`Can access course ${course.id}: ${canAccess}`);
          return { ...course, canAccess };
        }),
      ).then((courses) => courses.filter((course) => course.canAccess));
      this.logger.log(`Accessible courses: ${JSON.stringify(accessibleCourses)}`);

      if (!accessibleCourses.length) {
        this.logger.log(`No accessible courses for telegramId: ${telegramId}`);
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('courses.no_accessible_courses', language) || 'Sizda kirish imkoni bo‘lgan kurslar yo‘q.',
          language,
          telegramId,
        );
        return;
      }

      const message = this.i18nService.getTranslation('courses.list', language) + '\n\n' +
        accessibleCourses.map((course, index) =>
          `${index + 1}. *${this.escapeMarkdown(course.title[language] || 'No title')}*\n` +
          `📝 ${this.escapeMarkdown(course.description[language] || 'No description')}\n` +
          `💰 ${course.isPaid ? `${course.price} UZS` : this.i18nService.getTranslation('courses.free', language)}`
        ).join('\n\n');
      this.logger.log(`Message prepared: ${message}`);

      const keyboard = {
        reply_markup: {
          inline_keyboard: accessibleCourses.map((course) => [
            {
              text: this.escapeMarkdown(course.title[language] || 'No title'),
              callback_data: `course_info_${course.id}`,
            },
          ]),
        },
      };
      this.logger.log(`Keyboard prepared: ${JSON.stringify(keyboard)}`);

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
      this.logger.log(`Message sent to chatId: ${chatId}`);
    } catch (error) {
      this.logger.error(`Error handling courses for telegramId: ${telegramId}, error: ${error.message}, stack: ${error.stack}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.server_error', language) || 'Server xatosi yuz berdi.',
        language,
        telegramId,
      );
    }
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message?.chat.id.toString() || query.from.id.toString();
    const telegramId = query.from.id.toString();
    let language: string = 'uz';

    try {
      this.logger.log(`Answering callback query: ${query.id}`);
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      this.logger.warn(`Failed to answer callback query: ${query.id}, error: ${error.message}`);
    }

    try {
      this.logger.log(`Handling callback for query.data: ${query.data}, telegramId: ${telegramId}`);
      const user = await this.userService.findByTelegramId(telegramId);
      language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

      if (!user) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('errors.user_not_found', language),
          language,
          telegramId,
        );
        return;
      }

      const data = query.data;
      if (data === 'my_courses' || data === 'list_courses') {
        const courses = await this.courseService.findAll();
        const accessibleCourses = await Promise.all(
          courses.map(async (course) => ({
            ...course,
            canAccess: await this.courseService.canAccessCourse(telegramId, course.id),
          })),
        ).then((courses) => courses.filter((course) => course.canAccess));

        if (!accessibleCourses.length) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.i18nService.getTranslation('courses.no_accessible_courses', language) || 'Sizda kirish imkoni bo‘lgan kurslar yo‘q.',
            language,
            telegramId,
          );
          return;
        }

        const message = this.i18nService.getTranslation('courses.my_courses', language) + '\n\n' +
          accessibleCourses.map((course, index) =>
            `${index + 1}. *${this.escapeMarkdown(course.title[language] || 'No title')}*\n` +
            `📝 ${this.escapeMarkdown(course.description[language] || 'No description')}\n` +
            `💰 ${course.isPaid ? `${course.price} UZS` : this.i18nService.getTranslation('courses.free', language)}`
          ).join('\n\n');

        const keyboard = {
          reply_markup: {
            inline_keyboard: accessibleCourses.map((course) => [
              {
                text: this.escapeMarkdown(course.title[language] || 'No title'),
                callback_data: `course_info_${course.id}`,
              },
            ]),
          },
        };

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
      }
    } catch (error) {
      this.logger.error(`Error handling callback for telegramId: ${telegramId}, data: ${query.data}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.server_error', language) || 'Server xatosi yuz berdi.',
        language,
        telegramId,
      );
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}
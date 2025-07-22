import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import { StartQuizHandler } from '../../quiz/handlers/start-quiz.handler';
import { SubmitQuizHandler } from '../../quiz/handlers/submit-quiz.handler';
import { AdminHandler } from './admin.handler';
import { ListCoursesHandler } from '../../course/handlers/list-course.handler';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class CallbackHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    @Inject(forwardRef(() => StartQuizHandler))
    private readonly startQuizHandler: StartQuizHandler,
    @Inject(forwardRef(() => SubmitQuizHandler))
    private readonly submitQuizHandler: SubmitQuizHandler,
    @Inject(forwardRef(() => AdminHandler))
    private readonly adminHandler: AdminHandler,
    @Inject(forwardRef(() => ListCoursesHandler))
    private readonly listCoursesHandler: ListCoursesHandler,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message?.chat.id;
    const telegramId = query.from.id.toString();
    const data = query.data;
    const defaultLanguage = 'uz';

    console.log(`CallbackHandler: query.data=${data}, chatId=${chatId}, telegramId=${telegramId}`);

    if (!chatId || !data) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
        defaultLanguage,
        telegramId,
      );
      try {
        await bot.answerCallbackQuery(query.id);
      } catch (error) {
        console.error(`CallbackHandler: answerCallbackQuery error: ${error.message}`);
      }
      return;
    }

    try {
      if (data.startsWith('lang_')) {
        const language = data.split('_')[1] as 'uz' | 'ru' | 'en';
        if (!['uz', 'ru', 'en'].includes(language)) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
            defaultLanguage,
            telegramId,
          );
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`CallbackHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }

        let user = await this.userService.findByTelegramId(telegramId);
        if (!user) {
          user = await this.userService.createUser({
            telegramId,
            fullName: query.from.first_name + (query.from.last_name ? ' ' + query.from.last_name : ''),
            language,
          });
        } else {
          await this.userService.updateLanguage(telegramId, language);
        }

        const message = this.i18nService.getTranslation('success.language_updated', language);
        if (!user.phoneNumber) {
          await this.telegramService.sendMessage(chatId, this.i18nService.getTranslation('register.phone_request', language), {
            reply_markup: {
              keyboard: [[{ text: this.i18nService.getTranslation('register.share_phone', language), request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
        } else {
          await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
        }
      } else if (data.startsWith('start_quiz_')) {
        console.log(`CallbackHandler: Redirecting to StartQuizHandler with data=${data}`);
        await this.startQuizHandler.handleCallback(query, bot);
      } else if (data.startsWith('submit_quiz_')) {
        console.log(`CallbackHandler: Redirecting to SubmitQuizHandler with data=${data}`);
        await this.submitQuizHandler.handleCallback(query, bot);
      } else if (data === 'list_courses') {
        console.log(`CallbackHandler: Redirecting to ListCoursesHandler with data=${data}`);
        await this.listCoursesHandler.handleCallback(query, bot);
      } else if (data.startsWith('restart_quiz_course_')) {
        console.log(`CallbackHandler: Redirecting to StartQuizHandler with data=${data}`);
        await this.startQuizHandler.handleCallback(query, bot);
      } else if (
        data.startsWith('create_lesson_course_') ||
        data.startsWith('view_lessons_course_') ||
        data.startsWith('delete_lesson_course_') ||
        data.startsWith('delete_lesson_') ||
        data.startsWith('create_quiz_course_') ||
        data.startsWith('view_quizzes_course_') ||
        data.startsWith('delete_quiz_course_') ||
        data.startsWith('delete_quiz_') ||
        data.startsWith('delete_course_')
      ) {
        console.log(`CallbackHandler: Redirecting to AdminHandler with data=${data}`);
        await this.adminHandler.handleCallback(query, bot);
      } else if (data.startsWith('course_info_')) {
        console.log(`CallbackHandler: Redirecting to ListCoursesHandler with data=${data}`);
        await this.listCoursesHandler.handleCallback(query, bot);
      } else {
        console.log(`CallbackHandler: Invalid callback data=${data}`);
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
          defaultLanguage,
          telegramId,
        );
      }
    } catch (error) {
      console.error(`CallbackHandler error: ${error.message}, stack: ${error.stack}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
        defaultLanguage,
        telegramId,
      );
    }

    try {
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error(`CallbackHandler: answerCallbackQuery error: ${error.message}`);
    }
  }
}
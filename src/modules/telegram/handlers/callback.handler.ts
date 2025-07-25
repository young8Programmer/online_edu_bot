import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import { StartQuizHandler } from '../../quiz/handlers/start-quiz.handler';
import { GeneralQuizHandler } from '../../quiz/handlers/general-quiz.handler';
import { AdminHandler } from './admin.handler';
import { ListCoursesHandler } from '../../course/handlers/list-course.handler';
import { CourseInfoHandler } from '../../course/handlers/course-info.handler';
import { StartCourseHandler } from '../../course/handlers/start-course.handler';
import { VerifyPaymentHandler } from '../../payment/handlers/verify-payment.handler';
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
    @Inject(forwardRef(() => GeneralQuizHandler))
    private readonly generalQuizHandler: GeneralQuizHandler,
    @Inject(forwardRef(() => AdminHandler))
    private readonly adminHandler: AdminHandler,
    @Inject(forwardRef(() => ListCoursesHandler))
    private readonly listCoursesHandler: ListCoursesHandler,
    @Inject(forwardRef(() => CourseInfoHandler))
    private readonly courseInfoHandler: CourseInfoHandler,
    @Inject(forwardRef(() => StartCourseHandler))
    private readonly startCourseHandler: StartCourseHandler,
    @Inject(forwardRef(() => VerifyPaymentHandler))
    private readonly verifyPaymentHandler: VerifyPaymentHandler,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message?.chat.id;
    const telegramId = query.from.id.toString();
    const data = query.data;
    const defaultLanguage = 'uz';

    if (!chatId || !data) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
        defaultLanguage,
        telegramId,
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('lang_')) {
      const language = data.split('_')[1] as 'uz' | 'ru' | 'en';
      if (!['uz', 'ru', 'en'].includes(language)) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
          defaultLanguage,
          telegramId,
        );
        await bot.answerCallbackQuery(query.id);
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
    } else if (data.startsWith('course_info_')) {
      await this.courseInfoHandler.handle(query, bot);
    } else if (data.startsWith('select_payment_') || data.startsWith('payment_type_') || data.startsWith('confirm_payment_')) {
      await this.verifyPaymentHandler.handle(query, bot);
    } else if (data.startsWith('start_course_')) {
      await this.startCourseHandler.handle(query, bot);
    } else if (
      data.startsWith('list_quizzes_') ||
      data.startsWith('start_quiz_') ||
      data.startsWith('submit_quiz_') ||
      data.startsWith('next_question_') ||
      data.startsWith('restart_quiz_course_')
    ) {
      await this.startQuizHandler.handleCallback(query, bot);
    } else if (
      data === 'general_quizzes' ||
      data.startsWith('start_general_quiz_') ||
      data.startsWith('submit_general_') ||
      data.startsWith('next_general_question_')
    ) {
      await this.generalQuizHandler.handleCallback(query, bot);
    } else if (data === 'list_courses' || data.startsWith('list_lessons_')) {
      await this.listCoursesHandler.handleCallback(query, bot);
    } else if (
      data.startsWith('create_lesson_course_') ||
      data.startsWith('view_lessons_course_') ||
      data.startsWith('delete_lesson_course_') ||
      data.startsWith('delete_lesson_') ||
      data.startsWith('create_quiz_course_') ||
      data.startsWith('view_quizzes_course_') ||
      data.startsWith('delete_quiz_course_') ||
      data.startsWith('delete_quiz_') ||
      data.startsWith('delete_course_') ||
      data === 'admin_view_courses' ||
      data === 'admin_view_lessons'
    ) {
      await this.adminHandler.handleCallback(query, bot);
    } else {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.invalid_input', defaultLanguage),
        defaultLanguage,
        telegramId,
      );
    }

    await bot.answerCallbackQuery(query.id);
  }
}
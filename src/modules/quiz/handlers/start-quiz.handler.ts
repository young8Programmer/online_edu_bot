import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class StartQuizHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly quizService: QuizService,
    private readonly certificateService: CertificateService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.user_not_found', language), language, telegramId);
      return;
    }

    const courses = await this.courseService.findAll();
    if (!courses.length) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('courses.no_courses', language), language, telegramId);
      return;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: courses.map((course) => [
          { text: course.title[language], callback_data: `start_quiz_course_${course.id}` },
        ]),
      },
    };
    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('quizzes.list', language),
      keyboard,
    );
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.user_not_found', language), language, telegramId);
      try {
        await bot.answerCallbackQuery(query.id);
      } catch (error) {
        console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
      }
      return;
    }

    const data = query.data;
    console.log(`StartQuizHandler: Handling callback data=${data}`);

    try {
      if (data.startsWith('start_quiz_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        console.log(`StartQuizHandler: Parsed courseId=${courseId}`);

        if (isNaN(courseId)) {
          await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.invalid_input', language), language, telegramId);
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }

        const canAccess = await this.quizService.canAccessQuiz(telegramId, courseId);
        console.log(`StartQuizHandler: canAccess=${canAccess} for courseId=${courseId}, telegramId=${telegramId}`);
        if (!canAccess) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.i18nService.getTranslation('errors.course_access_denied', language),
            language,
            telegramId,
          );
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }

        const quizzes = await this.quizService.findByCourseId(courseId);
        if (!quizzes.length) {
          await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('quizzes.no_quizzes', language), language, telegramId);
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }

        const results = await this.quizService.getResults(telegramId, courseId);
        const completedQuizIds = results.map((result) => result.quiz.id);
        const availableQuiz = quizzes.find((quiz) => !completedQuizIds.includes(quiz.id));

        if (!availableQuiz) {
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: this.i18nService.getTranslation('quizzes.restart', language), callback_data: `restart_quiz_course_${courseId}` }],
                [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }],
              ],
            },
          };
          await bot.sendMessage(
            chatId,
            this.i18nService.getTranslation('quizzes.all_completed', language),
            keyboard,
          );
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }

        await this.showQuiz(bot, chatId, availableQuiz, language);
      } else if (data.startsWith('restart_quiz_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        console.log(`StartQuizHandler: Parsed courseId=${courseId} for restart`);

        if (isNaN(courseId)) {
          await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.invalid_input', language), language, telegramId);
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }

        try {
          await this.quizService.resetQuizResults(telegramId, courseId);
          const quizzes = await this.quizService.findByCourseId(courseId);
          const firstQuiz = quizzes[0];
          if (!firstQuiz) {
            await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('quizzes.no_quizzes', language), language, telegramId);
            try {
              await bot.answerCallbackQuery(query.id);
            } catch (error) {
              console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
            }
            return;
          }

          await this.showQuiz(bot, chatId, firstQuiz, language);
        } catch (error) {
          console.error(`StartQuizHandler: resetQuizResults error: ${error.message}, stack: ${error.stack}`);
          const errorMessage = this.i18nService.getTranslation('errors.reset_quiz_failed', language, { error: error.message.replace(/[^\w\s]/gi, '') });
          await this.telegramService.sendMessageWithMenu(chatId, errorMessage, language, telegramId);
          try {
            await bot.answerCallbackQuery(query.id);
          } catch (error) {
            console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
          }
          return;
        }
      }
    } catch (error) {
      console.error(`StartQuizHandler error: ${error.message}, stack: ${error.stack}`);
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.invalid_input', language), language, telegramId);
    }

    try {
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error(`StartQuizHandler: answerCallbackQuery error: ${error.message}`);
    }
  }

  private async showQuiz(bot: TelegramBot, chatId: number, quiz: any, language: string) {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          ...quiz.options[language].map((option: string, index: number) => [
            { text: option, callback_data: `submit_quiz_${quiz.id}_${index}` },
          ]),
          [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }],
        ],
      },
    };
    await bot.sendMessage(
      chatId,
      `${quiz.question[language]}\n\n${quiz.options[language].map((option: string, index: number) => `${index + 1}. ${option}`).join('\n')}`,
      { ...keyboard, parse_mode: 'Markdown' },
    );
  }
}
import { Injectable } from '@nestjs/common';
import { QuizService } from '../quiz.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ViewResultsHandler {
  constructor(
    private readonly quizService: QuizService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const user = await this.userService.findByTelegramId(msg.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    const courses = await this.courseService.findAll();
    if (!courses.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('courses.no_courses', language));
      return;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: courses.map((course) => [
          { text: course.title[language], callback_data: `view_results_${course.id}` },
        ]),
      },
    };

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('quizzes.results_list', language),
      keyboard,
    );
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const courseId = parseInt(query.data.split('_')[2], 10);
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const results = await this.quizService.getResults(user.telegramId, courseId);
    if (!results.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('quizzes.no_results', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const message = results
      .map((result, index) => {
        const quiz = result.quiz;
        const status = result.isCorrect
          ? this.i18nService.getTranslation('success.correct_answer', language)
          : this.i18nService.getTranslation('errors.incorrect_answer', language, {
              correctAnswer: quiz.options[language][quiz.correctAnswer],
            });
        return this.i18nService.getTranslation('quizzes.result_item', language, {
          index: (index + 1).toString(),
          question: quiz.question[language],
          status,
        });
      })
      .join('\n\n');

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('quizzes.results', language) + '\n\n' + message,
      {
        reply_markup: {
          inline_keyboard: [[{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }]],
        },
      },
    );
    await bot.answerCallbackQuery(query.id);
  }
}
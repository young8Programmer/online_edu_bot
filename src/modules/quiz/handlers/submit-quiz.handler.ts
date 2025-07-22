import { Injectable } from '@nestjs/common';
import { QuizService } from '../quiz.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class SubmitQuizHandler {
  constructor(
    private readonly quizService: QuizService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const [_, quizId, selectedAnswer] = query.data.split('_').map((v, i) => (i > 0 ? parseInt(v, 10) : v));
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      return;
    }

    const quiz = await this.quizService.findById(quizId);
    if (!quiz) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.quiz_not_found', language));
      return;
    }

    const result = await this.quizService.submitQuiz(user.telegramId, quizId, selectedAnswer);
    const message = result.isCorrect
      ? this.i18nService.getTranslation('success.correct_answer', language)
      : this.i18nService.getTranslation('errors.incorrect_answer', language, {
          correctAnswer: quiz.options[language][result.correctAnswer],
        });

    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }]],
      },
    });
    await bot.answerCallbackQuery(query.id);
  }
}
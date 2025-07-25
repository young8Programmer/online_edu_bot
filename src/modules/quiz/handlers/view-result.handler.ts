// ViewResultsHandler
import { Injectable } from '@nestjs/common';
import { QuizService } from '../quiz.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ViewResultsHandler {
  constructor(
    private readonly quizService: QuizService,
    private readonly userService: UserService,
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

    const results = await this.quizService.getResults(user.telegramId, 0);
    if (!results.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('quizzes.no_results', language));
      return;
    }

    const formattedResults = await Promise.all(results.map(async (result) => {
      const quiz = result.quiz;
      const userResults = await this.quizService.getResults(user.telegramId, quiz.course.id);
      const score = userResults.filter(r => r.isCorrect && r.quiz.id === quiz.id).length;
      const total = quiz.questions.length;
      return this.i18nService.getTranslation('quizzes.result', language, {
        title: quiz.course?.title?.[language] || 'General Quiz',
        score: score.toString(),
        total: total.toString(),
        percentage: Math.round((score / total) * 100).toString(),
      });
    }));

    await bot.sendMessage(chatId, formattedResults.join('\n\n') || this.i18nService.getTranslation('quizzes.no_results', language), {
      reply_markup: {
        inline_keyboard: [[{ text: this.i18nService.getTranslation('menu.back', language), callback_data: 'list_courses' }]],
      },
    });
  }
}
import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { QuizService } from '../../quiz/quiz.service';

@Injectable()
export class GeneralQuizHandler {
  private readonly logger = new Logger(GeneralQuizHandler.name);
  private quizState: Map<string, { quizId: number; currentQuestion: number; answers: number[]; messageId?: number }> = new Map();

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly quizService: QuizService,
  ) {}

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    if (!query.message || !query.message.chat) {
      this.logger.error(`No message object in callback query for telegramId: ${query.from.id}, data: ${query.data}`);
      try {
        await bot.answerCallbackQuery(query.id, { text: 'Error: No message context available' });
      } catch (error) {
        this.logger.warn(`Failed to answer callback query: ${error.message}`);
      }
      return;
    }

    if (!query.data) {
      this.logger.error(`No data in callback query for telegramId: ${query.from.id}`);
      try {
        await bot.answerCallbackQuery(query.id, { text: 'Error: Invalid callback data' });
      } catch (error) {
        this.logger.warn(`Failed to answer callback query: ${error.message}`);
      }
      return;
    }

    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    const messageId = query.message.message_id;
    this.logger.log(`Handling general quizzes for telegramId: ${telegramId}, data: ${query.data}`);

    try {
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

      if (!user) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.user_not_found', language)),
          language,
          telegramId,
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const data = query.data;

      if (data === 'general_quizzes') {
        const quizzes = await this.quizService.findGeneralQuizzes();
        if (!quizzes.length) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_quizzes', language)),
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const keyboard = {
          reply_markup: {
            inline_keyboard: quizzes
              .map((quiz) => [
                {
                  text: this.escapeMarkdown(quiz.questions[0]?.question[language] || 'No question'),
                  callback_data: `start_general_quiz_${quiz.id}`,
                },
              ])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)), callback_data: 'list_courses' }]]),
          },
        };
        await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language)), {
          parse_mode: 'MarkdownV2',
          ...keyboard,
        });
      } else if (data.startsWith('start_general_quiz_')) {
        const quizId = parseInt(data.split('_')[3], 10);
        const quiz = await this.quizService.findById(quizId);
        if (!quiz) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }

        this.quizState.set(telegramId, { quizId, currentQuestion: 0, answers: [], messageId });
        await this.showQuizQuestion(bot, chatId, quiz, 0, language, telegramId);
      } else if (data.startsWith('submit_general_quiz_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[3], 10);
        const questionIndex = parseInt(parts[4], 10);
        const selectedAnswer = parseInt(parts[5], 10);
        await this.submitQuestion(telegramId, quizId, questionIndex, selectedAnswer, bot, chatId, language);
      } else if (data.startsWith('next_general_question_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[3], 10);
        const questionIndex = parseInt(parts[4], 10);
        await this.handleNextQuestion(telegramId, quizId, questionIndex, bot, chatId, language);
      }

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      this.logger.error(`Error handling general quiz for telegramId: ${telegramId}, data: ${query.data}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
      try {
        await bot.answerCallbackQuery(query.id);
      } catch (callbackError) {
        this.logger.warn(`Failed to answer callback query: ${callbackError.message}`);
      }
    }
  }

  async submitQuestion(telegramId: string, quizId: number, questionIndex: number, selectedAnswer: number, bot: TelegramBot, chatId: number, language: string) {
    try {
      const state = this.quizState.get(telegramId);
      if (!state || state.quizId !== quizId || state.currentQuestion !== questionIndex) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_quiz_state', language)),
          language,
          telegramId,
        );
        return;
      }

      state.answers[questionIndex] = selectedAnswer;
      this.quizState.set(telegramId, state);

      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
          language,
          telegramId,
        );
        return;
      }

      const question = quiz.questions[questionIndex];
      const isCorrect = selectedAnswer === question.correct;

      const keyboard = {
        reply_markup: {
          inline_keyboard: question.options[language].map((option: string, index: number) => {
            let text = this.escapeMarkdown(option);
            if (index === selectedAnswer) {
              text = `${text} ${isCorrect ? '✅' : '❌'}`;
            } else if (index === question.correct) {
              text = `${text} ✅`;
            }
            return [{ text, callback_data: `disabled_${quiz.id}_${questionIndex}_${index}` }];
          }).concat([
            questionIndex + 1 < quiz.questions.length
              ? [{ text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.next', language)), callback_data: `next_general_question_${quiz.id}_${questionIndex + 1}` }]
              : [],
          ]),
        },
      };

      if (state.messageId) {
        try {
          await bot.deleteMessage(chatId, state.messageId);
        } catch (error) {
          this.logger.warn(`Failed to delete message ${state.messageId} for chatId ${chatId}: ${error.message}`);
        }
      }

      const messageText = !isCorrect
        ? this.escapeMarkdown(
            this.i18nService.getTranslation('quizzes.explanation', language, {
              question: question.question[language],
              correct: question.options[language][question.correct],
            }),
          )
        : this.escapeMarkdown(this.i18nService.getTranslation('quizzes.correct', language));

      const message = await bot.sendMessage(chatId, messageText, { parse_mode: 'MarkdownV2', ...keyboard });
      state.messageId = message.message_id;
      state.currentQuestion = questionIndex + 1;
      this.quizState.set(telegramId, state);

      const user = await this.userService.findByTelegramId(telegramId);
      if (user) {
        const result = this.quizService.quizResultRepository.create({
          user,
          quiz,
          selectedAnswer,
          isCorrect,
        });
        await this.quizService.quizResultRepository.save(result);
      }

      if (questionIndex + 1 >= quiz.questions.length) {
        const result = await this.quizService.submitQuiz(telegramId, quizId, state.answers);
        const percentage = Math.round((result.score / result.total) * 100);

        const resultMessage = this.escapeMarkdown(
          this.i18nService.getTranslation('quizzes.result', language, {
            score: result.score.toString(),
            total: result.total.toString(),
            percentage: percentage.toString(),
          }) + (result.explanations.length ? '\n\n' + result.explanations.map(e => this.escapeMarkdown(e)).join('\n\n') : ''),
        );

        const quizzes = await this.quizService.findGeneralQuizzes();
        const currentQuizIndex = quizzes.findIndex(q => q.id === quizId);
        const nextQuiz = currentQuizIndex + 1 < quizzes.length ? quizzes[currentQuizIndex + 1] : null;

        this.logger.log(`Current Quiz ID: ${quizId}, Next Quiz: ${nextQuiz ? nextQuiz.id : 'null'}`);

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              ...(nextQuiz
                ? [[
                    {
                      text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.next_quiz', language)),
                      callback_data: `start_general_quiz_${nextQuiz.id}`,
                    },
                  ]]
                : []),
              [
                {
                  text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.restart', language)),
                  callback_data: `start_general_quiz_${quiz.id}`,
                },
              ],
              [
                {
                  text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
                  callback_data: 'general_quizzes',
                },
              ],
            ],
          },
        };

        const sentMessage = await bot.sendMessage(chatId, resultMessage, { parse_mode: 'MarkdownV2', ...keyboard });
        state.messageId = sentMessage.message_id;
        this.quizState.set(telegramId, state);
        this.quizState.delete(telegramId);

        if (nextQuiz) {
          await this.startNextQuiz(telegramId, nextQuiz.id, bot, chatId, language);
        }
      }
    } catch (error) {
      this.logger.error(`Error submitting general quiz question for telegramId: ${telegramId}, quizId: ${quizId}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
    }
  }

  async startNextQuiz(telegramId: string, quizId: number, bot: TelegramBot, chatId: number, language: string) {
    try {
      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
          language,
          telegramId,
        );
        return;
      }

      this.quizState.set(telegramId, { quizId, currentQuestion: 0, answers: [], messageId: undefined });
      await this.showQuizQuestion(bot, chatId, quiz, 0, language, telegramId);
    } catch (error) {
      this.logger.error(`Error starting next quiz for telegramId: ${telegramId}, quizId: ${quizId}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
    }
  }

  async handleNextQuestion(telegramId: string, quizId: number, questionIndex: number, bot: TelegramBot, chatId: number, language: string) {
    try {
      const state = this.quizState.get(telegramId);
      if (!state || state.quizId !== quizId || state.currentQuestion !== questionIndex) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_quiz_state', language)),
          language,
          telegramId,
        );
        return;
      }

      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
          language,
          telegramId,
        );
        return;
      }

      state.currentQuestion = questionIndex;
      this.quizState.set(telegramId, state);

      if (state.messageId) {
        try {
          await bot.deleteMessage(chatId, state.messageId);
        } catch (error) {
          this.logger.warn(`Failed to delete message ${state.messageId} for chatId ${chatId}: ${error.message}`);
        }
      }

      await this.showQuizQuestion(bot, chatId, quiz, questionIndex, language, telegramId);
    } catch (error) {
      this.logger.error(`Error handling next general question for telegramId: ${telegramId}, quizId: ${quizId}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
    }
  }

  private async showQuizQuestion(bot: TelegramBot, chatId: number, quiz: any, questionIndex: number, language: string, telegramId: string) {
    try {
      if (!quiz.questions?.length || questionIndex >= quiz.questions.length) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
          language,
          telegramId,
        );
        return;
      }

      const question = quiz.questions[questionIndex];
      const questionText = `${this.escapeMarkdown(question.question[language] || 'No question')}\n\n${question.options[language]
        .map((option: string, index: number) => `${index + 1}\\. ${this.escapeMarkdown(option)}`)
        .join('\n')}`;
      const keyboard = {
        reply_markup: {
          inline_keyboard: question.options[language]
            .map((option: string, index: number) => [
              { text: this.escapeMarkdown(option), callback_data: `submit_general_quiz_${quiz.id}_${questionIndex}_${index}` },
            ])
            .concat([
              [{ text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)), callback_data: 'general_quizzes' }],
            ]),
        },
      };
      const message = await bot.sendMessage(chatId, questionText, { parse_mode: 'MarkdownV2', ...keyboard });
      const state = this.quizState.get(telegramId);
      if (state) {
        state.messageId = message.message_id;
        this.quizState.set(telegramId, state);
      }
    } catch (error) {
      this.logger.error(`Error showing general quiz question for telegramId: ${telegramId}, quizId: ${quiz.id}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
    }
  }
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+-=\|\{\}\s.!?])/g, '\\$1');
  }
}
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { QuizService } from '../../quiz/quiz.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class MixedQuizHandler {
  private readonly logger = new Logger(MixedQuizHandler.name);
  private quizCreationState: Map<
    string,
    {
      step: string;
      data: {
        questions: Array<{
          question: { uz: string; ru: string; en: string };
          options: Array<{ uz: string; ru: string; en: string }>;
          correct: number;
        }>;
        currentQuestion: {
          question: { uz?: string; ru?: string; en?: string };
          options: Array<{ uz?: string; ru?: string; en?: string }>;
          correct?: number;
        };
        currentOptionIndex: number;
        currentLanguage: string;
      };
    }
  > = new Map();

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly quizService: QuizService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = BigInt(msg.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const action = msg.text;

    try {
      if (action === this.i18nService.getTranslation('quizzes.mixed_quizzes', language)) {
        const message = this.i18nService.getTranslation('quizzes.mixed_quizzes', language);
        await this.sendManageMixedQuizzesMenu(chatId, message, language);
      } else if (action === this.i18nService.getTranslation('admin.create_mixed_quiz', language)) {
        this.quizCreationState.set(telegramId, {
          step: 'question_uz',
          data: { questions: [], currentQuestion: { question: {}, options: [], correct: 0 }, currentOptionIndex: 0, currentLanguage: 'uz' },
        });
        await bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_mixed_quiz_prompt_uz', language)),
          {
            reply_markup: { force_reply: true },
            parse_mode: 'MarkdownV2',
          },
        );
      } else if (action === this.i18nService.getTranslation('admin.view_mixed_quizzes', language)) {
        await this.viewMixedQuizzes(chatId, bot, language);
      } else if (action === this.i18nService.getTranslation('admin.delete_mixed_quiz', language)) {
        await this.deleteMixedQuizMenu(chatId, bot, language);
      } else if (this.quizCreationState.has(telegramId)) {
        await this.handleQuizCreation(telegramId, msg, bot, language);
      }
    } catch (error) {
      this.logger.error(`Error handling mixed quiz for telegramId: ${telegramId}, error: ${error.message}`);
      await this.telegramService.sendMessage(
        chatId,
        this.i18nService.getTranslation('errors.server_error', language),
        { parse_mode: 'MarkdownV2' },
      );
    }
  }

  async handleCallbackQuery(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = BigInt(query.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const data = query.data;

    try {
      if (data === 'mixed_quizzes') {
        const message = this.i18nService.getTranslation('quizzes.mixed_quizzes', language);
        await this.sendManageMixedQuizzesMenu(chatId, message, language);
      } else if (data.startsWith('mixed_quiz_')) {
        const quizId = parseInt(data.replace('mixed_quiz_', ''), 10);
        await this.showQuizOptions(chatId, quizId, bot, language);
      } else if (data.startsWith('view_mixed_quiz_')) {
        const quizId = parseInt(data.replace('view_mixed_quiz_', ''), 10);
        await this.viewMixedQuiz(chatId, quizId, bot, language);
      } else if (data.startsWith('delete_mixed_quiz_')) {
        const quizId = parseInt(data.replace('delete_mixed_quiz_', ''), 10);
        await this.deleteMixedQuiz(chatId, quizId, bot, language);
      } else if (data === 'create_mixed_quiz' || data === 'add_question' || data === 'finish_quiz') {
        await this.handleQuizCreationCallback(query, bot);
      }
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      this.logger.error(`Error handling callback for telegramId: ${telegramId}, data: ${data}, error: ${error.message}`);
      await this.telegramService.sendMessage(
        chatId,
        this.i18nService.getTranslation('errors.server_error', language),
        { parse_mode: 'MarkdownV2' },
      );
    }
  }

  async sendManageMixedQuizzesMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('admin.create_mixed_quiz', language) },
            { text: this.i18nService.getTranslation('admin.view_mixed_quizzes', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.delete_mixed_quiz', language) },
            { text: this.i18nService.getTranslation('admin.back', language) },
          ],
        ],
        resize_keyboard: true,
        persistent: true,
      },
    });
  }

  async viewMixedQuizzes(chatId: number, bot: TelegramBot, language: string) {
    const quizzes = await this.quizService.findMixedQuizzes();
    if (!quizzes.length) {
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.no_quizzes_found', language)),
        { parse_mode: 'MarkdownV2' },
      );
      return;
    }

    const keyboard = quizzes.map((quiz) => [
      { text: `Test ${quiz.id}`, callback_data: `mixed_quiz_${quiz.id}` },
    ]);

    await this.telegramService.sendMessage(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('quizzes.select_quiz', language)),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard },
      },
    );
  }

  async deleteMixedQuizMenu(chatId: number, bot: TelegramBot, language: string) {
    const quizzes = await this.quizService.findMixedQuizzes();
    if (!quizzes.length) {
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.no_quizzes_found', language)),
        { parse_mode: 'MarkdownV2' },
      );
      return;
    }

    const keyboard = quizzes.map((quiz) => [
      { text: `Test ${quiz.id}`, callback_data: `delete_mixed_quiz_${quiz.id}` },
    ]);

    await this.telegramService.sendMessage(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('quizzes.select_quiz_to_delete', language)),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard },
      },
    );
  }

  async showQuizOptions(chatId: number, quizId: number, bot: TelegramBot, language: string) {
    const quiz = await this.quizService.findById(quizId);
    if (!quiz) {
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
        { parse_mode: 'MarkdownV2' },
      );
      return;
    }

    const keyboard = [
      [
        { text: this.i18nService.getTranslation('admin.view_mixed_quizzes', language), callback_data: `view_mixed_quiz_${quizId}` },
        { text: this.i18nService.getTranslation('admin.delete_mixed_quiz', language), callback_data: `delete_mixed_quiz_${quizId}` },
      ],
      [{ text: this.i18nService.getTranslation('admin.back', language), callback_data: 'mixed_quizzes' }],
    ];

    await this.telegramService.sendMessage(chatId, `Test ${quizId}`, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async viewMixedQuiz(chatId: number, quizId: number, bot: TelegramBot, language: string) {
    const quiz = await this.quizService.findById(quizId);
    if (!quiz) {
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
        { parse_mode: 'MarkdownV2' },
      );
      return;
    }

    const message = quiz.questions
      .map((q, index) => {
        return `${index + 1}\\. *${this.escapeMarkdown(q.question[language])}*\n` +
               `📝 *${this.i18nService.getTranslation('quizzes.options', language)}*: ${q.options
                 .map((o) => this.escapeMarkdown(o[language]))
                 .join(', ')}\n` +
               `✅ *${this.i18nService.getTranslation('quizzes.correct', language)}*: ${this.escapeMarkdown(q.options[q.correct][language])}`;
      })
      .join('\n\n');

    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[{ text: this.i18nService.getTranslation('admin.back', language), callback_data: `mixed_quiz_${quizId}` }]],
      },
    });
  }

  async deleteMixedQuiz(chatId: number, quizId: number, bot: TelegramBot, language: string) {
    await this.quizService.deleteMixedQuiz(quizId);
    await this.telegramService.sendMessage(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('success.quiz_deleted', language, { question: `Test ${quizId}` })),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [[{ text: this.i18nService.getTranslation('admin.back', language), callback_data: 'mixed_quizzes' }]],
        },
      },
    );
  }

  async handleQuizCreation(telegramId: string, msg: TelegramBot.Message, bot: TelegramBot, language: string) {
    const chatId = msg.chat.id;
    const state = this.quizCreationState.get(telegramId);

    if (!state) {
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_quiz_state', language)),
        { parse_mode: 'MarkdownV2' },
      );
      return;
    }

    const { step, data } = state;

    if (step === 'question_uz') {
      data.currentQuestion.question.uz = msg.text || '';
      state.step = 'question_ru';
      state.data.currentLanguage = 'ru';
      this.quizCreationState.set(telegramId, state);
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('admin.create_mixed_quiz_prompt_ru', language)),
        { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
      );
    } else if (step === 'question_ru') {
      data.currentQuestion.question.ru = msg.text || '';
      state.step = 'question_en';
      state.data.currentLanguage = 'en';
      this.quizCreationState.set(telegramId, state);
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('admin.create_mixed_quiz_prompt_en', language)),
        { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
      );
    } else if (step === 'question_en') {
      data.currentQuestion.question.en = msg.text || '';
      state.step = 'option_uz';
      state.data.currentOptionIndex = 0;
      state.data.currentLanguage = 'uz';
      this.quizCreationState.set(telegramId, state);
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('quizzes.enter_option_uz', language, { number: (data.currentOptionIndex + 1).toString() })),
        { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
      );
    } else if (step === 'option_uz' && data.currentOptionIndex < 4) {
      if (!data.currentQuestion.options[data.currentOptionIndex]) {
        data.currentQuestion.options[data.currentOptionIndex] = { uz: '', ru: '', en: '' };
      }
      data.currentQuestion.options[data.currentOptionIndex].uz = msg.text || '';
      state.step = 'option_ru';
      state.data.currentLanguage = 'ru';
      this.quizCreationState.set(telegramId, state);
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('quizzes.enter_option_ru', language, { number: (data.currentOptionIndex + 1).toString() })),
        { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
      );
    } else if (step === 'option_ru' && data.currentOptionIndex < 4) {
      data.currentQuestion.options[data.currentOptionIndex].ru = msg.text || '';
      state.step = 'option_en';
      state.data.currentLanguage = 'en';
      this.quizCreationState.set(telegramId, state);
      await this.telegramService.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('quizzes.enter_option_en', language, { number: (data.currentOptionIndex + 1).toString() })),
        { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
      );
    } else if (step === 'option_en' && data.currentOptionIndex < 4) {
      data.currentQuestion.options[data.currentOptionIndex].en = msg.text || '';
      data.currentOptionIndex += 1;

      if (data.currentOptionIndex < 4) {
        state.step = 'option_uz';
        state.data.currentLanguage = 'uz';
        this.quizCreationState.set(telegramId, state);
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('quizzes.enter_option_uz', language, { number: (data.currentOptionIndex + 1).toString() })),
          { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
        );
      } else {
        state.step = 'correct';
        this.quizCreationState.set(telegramId, state);
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('quizzes.enter_correct_option', language)),
          { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
        );
      }
    } else if (step === 'correct') {
      const correct = parseInt(msg.text, 10) - 1;
      if (isNaN(correct) || correct < 0 || correct >= data.currentQuestion.options.length) {
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_correct_option', language)),
          { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
        );
        return;
      }

      // Validate currentQuestion before pushing
      if (
        data.currentQuestion.question.uz &&
        data.currentQuestion.question.ru &&
        data.currentQuestion.question.en &&
        data.currentQuestion.options.length === 4 &&
        data.currentQuestion.options.every((opt) => opt.uz && opt.ru && opt.en)
      ) {
        data.questions.push({
          question: {
            uz: data.currentQuestion.question.uz,
            ru: data.currentQuestion.question.ru,
            en: data.currentQuestion.question.en,
          },
          options: data.currentQuestion.options.map((opt) => ({
            uz: opt.uz!,
            ru: opt.ru!,
            en: opt.en!,
          })),
          correct,
        });
        state.step = 'add_more';
        this.quizCreationState.set(telegramId, state);

        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('quizzes.add_more_questions', language)),
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: this.i18nService.getTranslation('quizzes.add_question', language), callback_data: 'add_question' },
                  { text: this.i18nService.getTranslation('quizzes.finish', language), callback_data: 'finish_quiz' },
                ],
              ],
            },
          },
        );
      } else {
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_quiz_data', language)),
          { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
        );
      }
    }
  }

  async handleQuizCreationCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = BigInt(query.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const data = query.data;

    try {
      const state = this.quizCreationState.get(telegramId);
      if (!state) {
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_quiz_state', language)),
          { parse_mode: 'MarkdownV2' },
        );
        return;
      }

      if (data === 'create_mixed_quiz') {
        this.quizCreationState.set(telegramId, {
          step: 'question_uz',
          data: { questions: [], currentQuestion: { question: {}, options: [], correct: 0 }, currentOptionIndex: 0, currentLanguage: 'uz' },
        });
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_mixed_quiz_prompt_uz', language)),
          { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
        );
      } else if (data === 'add_question') {
        state.step = 'question_uz';
        state.data.currentQuestion = { question: {}, options: [], correct: 0 };
        state.data.currentOptionIndex = 0;
        state.data.currentLanguage = 'uz';
        this.quizCreationState.set(telegramId, state);
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_mixed_quiz_prompt_uz', language)),
          { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
        );
      } else if (data === 'finish_quiz') {
        if (!state.data.questions.length) {
          await this.telegramService.sendMessage(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('errors.no_questions_added', language)),
            { parse_mode: 'MarkdownV2' },
          );
          return;
        }
        const quiz = await this.quizService.createQuiz({
          questions: state.data.questions,
        });
        this.quizCreationState.delete(telegramId);
        await this.telegramService.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('success.quiz_created', language, { question: `Test ${quiz.id}` })),
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [[{ text: this.i18nService.getTranslation('admin.back', language), callback_data: 'mixed_quizzes' }]],
            },
          },
        );
      }
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      this.logger.error(`Error handling quiz creation callback for telegramId: ${telegramId}, error: ${error.message}`);
      await this.telegramService.sendMessage(
        chatId,
        this.i18nService.getTranslation('errors.server_error', language),
        { parse_mode: 'MarkdownV2' },
      );
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+-=\|\{\}\s.!?])/g, '\\$1');
  }
}
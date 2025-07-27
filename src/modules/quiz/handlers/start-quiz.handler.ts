import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import { ProgressService } from '../../progress/progress.service';
import { LessonService } from '../../lesson/lesson.service';
import { Quiz } from '../quiz.entity';

@Injectable()
export class StartQuizHandler {
  private readonly logger = new Logger(StartQuizHandler.name);
  private quizState: Map<string, { quizId: number; courseId: number; lessonId?: number; currentQuestion: number; answers: number[]; messageId?: number }> = new Map();

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly quizService: QuizService,
    private readonly certificateService: CertificateService,
    private readonly progressService: ProgressService,
    private readonly lessonService: LessonService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    this.logger.log(`Handling quizzes for telegramId: ${telegramId}`);

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
        return;
      }

      if (msg.text === '/general_quizzes' || msg.text === this.i18nService.getTranslation('menu.general_quizzes', language)) {
        const quizzes = await this.quizService.findGeneralQuizzes();
        if (!quizzes.length) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_quizzes', language)),
            language,
            telegramId,
          );
          return;
        }

        const keyboard = {
          reply_markup: {
            inline_keyboard: quizzes
              .map((quiz) => [
                {
                  text: this.escapeMarkdown(quiz.questions[0]?.question[language] || quiz.id.toString()),
                  callback_data: `start_general_quiz_${quiz.id}`,
                },
              ])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'menu' }]]),
          },
        };
        await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language)), {
          parse_mode: 'MarkdownV2',
          ...keyboard,
        });
      } else {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_command', language)),
          language,
          telegramId,
        );
      }
    } catch (error) {
      this.logger.error(`Error handling quizzes for telegramId: ${telegramId}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
    }
  }

async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id.toString();
  const messageId = query.message.message_id;
  const data = query.data;
  this.logger.log(`Handling callback for telegramId: ${telegramId}, data: ${data}`);

  try {
    const user = await this.userService.findByTelegramId(telegramId);
    const language =
      user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.user_not_found', language)),
        language,
        telegramId,
      );
      return await bot.answerCallbackQuery(query.id);
    }

    // ==== LIST LESSONS ====
    if (data.startsWith('list_lessons_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      if (isNaN(courseId)) throw new Error(`Invalid courseId: ${data.split('_')[2]}`);

      const course = await this.courseService.findById(courseId);
      if (!course) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language)),
          language,
          telegramId,
        );
        return await bot.answerCallbackQuery(query.id);
      }

      const canAccess = await this.courseService.canAccessCourse(telegramId, courseId);
      if (!canAccess) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.access_denied', language)),
          language,
          telegramId,
        );
        return await bot.answerCallbackQuery(query.id);
      }

      const lessons = await this.lessonService.findByCourseId(courseId);
      const completedLessonIds = await this.progressService.getCompletedLessonIds(telegramId, courseId);
      const latestLessonId = await this.progressService.getLatestLessonId(telegramId, courseId) || lessons[0]?.id;

      const keyboard = {
        reply_markup: {
          inline_keyboard: lessons.map((lesson) => {
            const isCompleted = completedLessonIds.includes(lesson.id);
            const isLatest = lesson.id === latestLessonId;
            const status = isCompleted ? '✅' : isLatest ? '📍' : '';
            return [{
              text: this.escapeMarkdown(`${lesson.title[language]} ${status}`),
              callback_data: `start_quiz_lesson_${lesson.id}_${courseId}`,
            }];
          }).concat([[
            {
              text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
              callback_data: 'list_courses',
            },
          ]]),
        },
      };

      const message = this.escapeMarkdown(
        this.i18nService.getTranslation('lessons.list', language, {
          course: course.title[language],
        }),
      );

      await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        ...keyboard,
      });
      return await bot.answerCallbackQuery(query.id);
    }

    // ==== LIST QUIZZES ====
    if (data.startsWith('list_quizzes_')) {
      const parts = data.split('_');
      const courseId = parseInt(parts[2], 10);
      const lessonId = parts[3] ? parseInt(parts[3], 10) : undefined;

      if (isNaN(courseId)) throw new Error(`Invalid courseId: ${parts[2]}`);

      const course = await this.courseService.findById(courseId);
      if (!course) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language)),
          language,
          telegramId,
        );
        return await bot.answerCallbackQuery(query.id);
      }

      const canAccess = lessonId
        ? await this.quizService.canAccessQuiz(telegramId, courseId, lessonId)
        : await this.courseService.canAccessCourse(telegramId, courseId);

      if (!canAccess) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.access_denied', language)),
          language,
          telegramId,
        );
        return await bot.answerCallbackQuery(query.id);
      }

      const quizzes = lessonId
        ? await this.quizService.findAllByLessonId(lessonId)
        : await this.quizService.findByCourseId(courseId);
      const validQuizzes = quizzes.filter((quiz) => quiz && quiz.questions?.length);

      if (!validQuizzes.length) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_quizzes', language)),
          language,
          telegramId,
        );
        return await bot.answerCallbackQuery(query.id);
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: validQuizzes.map((quiz) => [{
            text: this.escapeMarkdown(quiz.questions[0]?.question[language] || 'No question'),
            callback_data: `start_quiz_${quiz.id}_${courseId}${lessonId ? `_${lessonId}` : ''}`,
          }]).concat([[
            {
              text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
              callback_data: lessonId ? `list_lessons_${courseId}` : 'list_courses',
            },
          ]]),
        },
      };

      await bot.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language)),
        { parse_mode: 'MarkdownV2', ...keyboard },
      );
      return await bot.answerCallbackQuery(query.id);
    }

if (data.startsWith('start_quiz_lesson_')) {
  const parts = data.split('_');
  this.logger.debug(`Received callback_data: ${data}`);
  this.logger.debug(`Split parts: ${JSON.stringify(parts)}`);

  let lessonId: number;
  let courseId: number;

  if (parts.length === 4) {
    // Eski format: start_quiz_lesson_7
    lessonId = parseInt(parts[3], 10);
    const lesson = await this.lessonService.findById(lessonId);
    if (!lesson || !lesson.course) {
      await bot.sendMessage(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.lesson_not_found', language)),
        { parse_mode: 'MarkdownV2' }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    courseId = lesson.course.id;
  } else if (parts.length === 5) {
    // Yangi format: start_quiz_lesson_7_2
    lessonId = parseInt(parts[3], 10);
    courseId = parseInt(parts[4], 10);
  } else {
    this.logger.error(`[StartQuizHandler] Invalid callback data format or IDs. Data: ${data}`);
    await bot.sendMessage(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language)),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
                callback_data: `list_courses`,
              },
            ],
          ],
        },
      }
    );
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (isNaN(lessonId) || isNaN(courseId)) {
    this.logger.error(`[StartQuizHandler] Invalid lessonId or courseId. Data: ${data}`);
    await bot.sendMessage(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language)),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
                callback_data: `list_courses`,
              },
            ],
          ],
        },
      }
    );
    await bot.answerCallbackQuery(query.id);
    return;
  }

  try {
    const quiz = await this.quizService.findByLessonId(lessonId);
    if (!quiz || !quiz.questions?.length) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
        language,
        telegramId
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const canAccess = await this.quizService.canAccessQuiz(telegramId, courseId, lessonId);
    if (!canAccess) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.access_denied', language)),
        language,
        telegramId
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    this.quizState.set(telegramId, {
      quizId: quiz.id,
      courseId,
      lessonId,
      currentQuestion: 0,
      answers: [],
      messageId,
    });

    await this.showQuizQuestion(bot, chatId, quiz, 0, language, telegramId);
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    this.logger.error(`[StartQuizHandler] Error handling quiz start: ${error.message}`);
    await bot.sendMessage(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('errors.unexpected', language)),
      { parse_mode: 'MarkdownV2' }
    );
    await bot.answerCallbackQuery(query.id);
  }
}

      if (data.startsWith('submit_quiz_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[2], 10);
        const questionIndex = parseInt(parts[3], 10);
        const selectedAnswer = parseInt(parts[4], 10);

        if (isNaN(quizId) || isNaN(questionIndex) || isNaN(selectedAnswer)) {
          throw new Error(`Invalid quizId: ${parts[2]}, questionIndex: ${parts[3]}, or selectedAnswer: ${parts[4]}`);
        }

        await this.submitQuestion(telegramId, quizId, questionIndex, selectedAnswer, bot, chatId, language);
      }

      if (data.startsWith('next_question_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[2], 10);
        const questionIndex = parseInt(parts[3], 10);

        if (isNaN(quizId) || isNaN(questionIndex)) {
          throw new Error(`Invalid quizId: ${parts[2]} or questionIndex: ${parts[3]}`);
        }

        await this.handleNextQuestion(telegramId, quizId, questionIndex, bot, chatId, language);
      }

      if (data.startsWith('start_general_quiz_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[3], 10);

        if (isNaN(quizId)) {
          throw new Error(`Invalid quizId: ${parts[3]}`);
        }

        const quiz = await this.quizService.findById(quizId);
        if (!quiz || !quiz.questions?.length) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const canAccess = await this.courseService.canAccessCourse(telegramId, quiz.course.id);
        if (!canAccess) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('errors.access_denied', language)),
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }

        this.quizState.set(telegramId, { quizId, courseId: quiz.course.id, currentQuestion: 0, answers: [], messageId });
        await this.showQuizQuestion(bot, chatId, quiz, 0, language, telegramId);
      }

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      this.logger.error(`Error handling callback for telegramId: ${telegramId}, data: ${query.data}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
      await bot.answerCallbackQuery(query.id);
    }
  }

   public getQuizState(telegramId: string) {
    return this.quizState.get(telegramId);
  }

  async submitQuestion(
  telegramId: string,
  quizId: number,
  questionIndex: number,
  selectedAnswer: number,
  bot: TelegramBot,
  chatId: number,
  language: string,
) {
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
  if (!quiz || !quiz.questions?.length) {
    await this.telegramService.sendMessageWithMenu(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
      language,
      telegramId,
    );
    return;
  }

  const question = quiz.questions[questionIndex];
  if (!question || !question.options || question.correct === undefined) {
    await this.telegramService.sendMessageWithMenu(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_data_invalid', language)),
      language,
      telegramId,
    );
    return;
  }

  const localizedOptions: string[] = Array.isArray(question.options[language])
    ? question.options[language]
    : question.options.map((opt: any) => {
        if (typeof opt === 'object' && opt[language]) return opt[language];
        if (typeof opt === 'string') return opt;
        return '❓';
      });

  const isCorrect = selectedAnswer === question.correct;

  const keyboard = {
    reply_markup: {
      inline_keyboard: localizedOptions.map((option, index) => {
        let text = this.escapeMarkdown(option);
        if (index === selectedAnswer) {
          text += isCorrect ? ' ✅' : ' ❌';
        } else if (index === question.correct) {
          text += ' ✅';
        }
        return [{ text, callback_data: 'disabled' }];
      }),
    },
  };

  if (state.messageId) {
    await bot.deleteMessage(chatId, state.messageId).catch(() => {});
  }

  const messageText = !isCorrect
    ? this.escapeMarkdown(this.i18nService.getTranslation('quizzes.explanation', language, {
        question: this.escapeMarkdown(question.question[language]),
        correct: this.escapeMarkdown(localizedOptions[question.correct]),
      }))
    : this.escapeMarkdown(this.i18nService.getTranslation('quizzes.correct', language));

  const sentMessage = await bot.sendMessage(chatId, messageText, {
    parse_mode: 'MarkdownV2',
    ...keyboard,
  });

  state.messageId = sentMessage.message_id;
  state.currentQuestion = questionIndex + 1;
  this.quizState.set(telegramId, state);

  const user = await this.userService.findByTelegramId(telegramId);
  if (user) {
    const result = this.quizService.quizResultRepository.create({
      user: { id: user.id },
      quiz: { id: quiz.id },
      selectedAnswer,
      isCorrect,
    });
    await this.quizService.quizResultRepository.save(result);
  }

  // NEXT QUESTION or FINISH
  if (questionIndex + 1 < quiz.questions.length) {
    await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('quizzes.next_question', language)), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          {
            text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.next', language)),
            callback_data: `next_question_${quiz.id}_${questionIndex + 1}`,
          },
        ]],
      },
    });
    return;
  }

  // QUIZ FINISHED
  const result = await this.quizService.submitQuiz(telegramId, quizId, state.answers);
  const percentage = Math.round((result.score / result.total) * 100);

  let resultText = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.result', language, {
    score: result.score.toString(),
    total: result.total.toString(),
    percentage: percentage.toString(),
  }));

  if (result.explanations.length) {
    resultText += '\n\n' + result.explanations.map(e => this.escapeMarkdown(e)).join('\n\n');
  }
await bot.sendMessage(chatId, resultText, {
  parse_mode: 'MarkdownV2',
  reply_markup: { inline_keyboard: [[]] },
});

this.quizState.delete(telegramId);

// Darsni tekshiramiz
if (!quiz.lesson) return;

const currentLesson = await this.lessonService.findById(quiz.lesson.id);
if (!currentLesson) return;

if (percentage >= 60) {
  const nextLesson = await this.lessonService.findNextLesson(quiz.lesson.id, quiz.course.id);
  
  if (nextLesson) {
    // Keyingi dars mavjud bo‘lsa, uni yuboramiz
    const nextLessonInfo = this.escapeMarkdown(this.i18nService.getTranslation('lessons.info', language, {
      title: nextLesson.title[language],
      content: nextLesson.contentUrl || 'Mazmun mavjud emas',
    }));

    await bot.sendMessage(chatId, nextLessonInfo, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{
            text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.start', language)),
            callback_data: `start_quiz_lesson_${nextLesson.id}_${quiz.course.id}`,
          }],
          [{
            text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
            callback_data: `list_lessons_${quiz.course.id}`,
          }],
        ],
      },
    });
  } else {
    // Bu oxirgi dars, sertifikat yaratamiz
    try {
      const certificate = await this.certificateService.generateCertificate(telegramId, quiz.course.id, language);
      await bot.sendDocument(chatId, certificate, {
        caption: this.i18nService.getTranslation('certificates.ready', language),
      });
    } catch (error) {
      this.logger.error('Certificate generation failed:', error);
      await bot.sendMessage(chatId, this.i18nService.getTranslation('certificates.failed', language));
    }
  }
} else {
  // Agar 60% dan past bo‘lsa, o‘sha darsni yana ko‘rsatamiz
  const lessonInfo = this.escapeMarkdown(this.i18nService.getTranslation('lessons.info', language, {
    title: currentLesson.title[language],
    content: currentLesson.contentUrl || 'Mazmun mavjud emas',
  }));

  await bot.sendMessage(chatId, lessonInfo, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [{
          text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.retry', language)),
          callback_data: `start_quiz_lesson_${quiz.lesson.id}_${quiz.course.id}`,
        }],
        [{
          text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
          callback_data: `list_lessons_${quiz.course.id}`,
        }],
      ],
    },
  });

    await bot.sendMessage(chatId, lessonInfo, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{
            text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.start', language)),
            callback_data: `start_quiz_lesson_${currentLesson.id}_${quiz.course.id}`,
          }],
          [{
            text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
            callback_data: `list_lessons_${quiz.course.id}`,
          }],
        ],
      },
    });
  }
}

  async handleNextQuestion(telegramId: string, quizId: number, questionIndex: number, bot: TelegramBot, chatId: number, language: string) {
    try {
      const state = this.quizState.get(telegramId);
      if (!state || state.quizId !== quizId) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_quiz_state', language)),
          language,
          telegramId,
        );
        return;
      }

      const quiz = await this.quizService.findById(quizId);
      if (!quiz || !quiz.questions?.length) {
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
      this.logger.error(`Error handling next question for telegramId: ${telegramId}, quizId: ${quizId}, error: ${error.message}`);
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', language)),
        language,
        telegramId,
      );
    }
  }

  private async showQuizQuestion(
  bot: TelegramBot,
  chatId: number,
  quiz: any,
  questionIndex: number,
  language: string,
  telegramId: string,
) {
  try {
    if (!quiz || !quiz.questions?.length || questionIndex >= quiz.questions.length) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
        language,
        telegramId,
      );
      return;
    }

    const question = quiz.questions[questionIndex];

    if (
      !question ||
      !question.question ||
      !question.options ||
      !Array.isArray(question.options) ||
      !question.question[language] ||
      !question.options.every((opt) => typeof opt[language] === 'string' && opt[language].trim() !== '')
    ) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_data_invalid', language)),
        language,
        telegramId,
      );
      return;
    }

    const options = question.options.map((opt) => opt[language]);

    const questionText = `${this.escapeMarkdown(question.question[language])}\n\n${options
      .map((option: string, index: number) => `${index + 1}\\. ${this.escapeMarkdown(option)}`)
      .join('\n')}`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: options.map((option: string, index: number) => [
          {
            text: option, // ❗️escape kerak emas bu yerda
            callback_data: `submit_quiz_${quiz.id}_${questionIndex}_${index}`,
          },
        ]).concat([
          [
            {
              text: this.i18nService.getTranslation('courses.back', language),
              callback_data: quiz.lesson ? `list_lessons_${quiz.course?.id}` : 'list_courses',
            },
          ],
        ]),
      },
    };

    const message = await bot.sendMessage(chatId, questionText, {
      parse_mode: 'MarkdownV2',
      ...keyboard,
    });

    const state = this.quizState.get(telegramId);
    if (state) {
      state.messageId = message.message_id;
      this.quizState.set(telegramId, state);
    }
  } catch (error) {
    this.logger.error(
      `Error showing quiz question for telegramId: ${telegramId}, quizId: ${quiz?.id}, error: ${error.message}`,
    );
    await this.telegramService.sendMessageWithMenu(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', language)),
      language,
      telegramId,
    );
  }
}

private escapeMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}


}
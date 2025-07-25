import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import { ProgressService } from '../../progress/progress.service';
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

      const courses = await this.courseService.findAll();
      if (!courses.length) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language)),
          language,
          telegramId,
        );
        return;
      }

      const accessibleCourses = await Promise.all(
        courses.map(async (course) => ({
          ...course,
          canAccess: await this.courseService.canAccessCourse(telegramId, course.id),
        })),
      ).then((courses) => courses.filter((course) => course.canAccess));

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...accessibleCourses.map((course) => [
              { text: this.escapeMarkdown(course.title[language] || 'No title'), callback_data: `course_info_${course.id}` },
            ]),
            [{ text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.general', language)), callback_data: 'general_quizzes' }],
          ],
        },
      };
      await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('quizzes.select_course', language)), {
        parse_mode: 'MarkdownV2',
        ...keyboard,
      });
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
    this.logger.log(`Handling callback for telegramId: ${telegramId}, data: ${query.data}`);

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

      if (data.startsWith('list_quizzes_')) {
        const parts = data.split('_');
        const courseId = parseInt(parts[2], 10);
        const lessonId = parts[3] ? parseInt(parts[3], 10) : undefined;
        const course = await this.courseService.findById(courseId);
        if (!course) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language)),
            language,
            telegramId,
          );
          await bot.answerCallbackQuery(query.id);
          return;
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
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const quizzes = lessonId
          ? [await this.quizService.findByLessonId(lessonId)]
          : await this.quizService.findByCourseId(courseId);
        const validQuizzes = quizzes.filter((quiz) => quiz && quiz.questions.length);

        if (!validQuizzes.length) {
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
    inline_keyboard: validQuizzes
      .filter((quiz): quiz is Quiz => quiz !== null)
      .map((quiz) => [
        {
          text: this.escapeMarkdown(quiz.questions[0]?.question[language] || 'No question'),
          callback_data: `start_quiz_${quiz.id}_${courseId}${lessonId ? `_${lessonId}` : ''}`,
        },
      ])
      .concat([
        [
          {
            text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
            callback_data: lessonId ? `list_lessons_${courseId}` : 'list_courses',
          },
        ],
      ]),
  },
};

        await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language)), {
          parse_mode: 'MarkdownV2',
          ...keyboard,
        });
      } else if (data.startsWith('start_quiz_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[2], 10);
        const courseId = parseInt(parts[3], 10);
        const lessonId = parts[4] ? parseInt(parts[4], 10) : undefined;
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

        const canAccess = lessonId
          ? await this.quizService.canAccessQuiz(telegramId, courseId, lessonId)
          : await this.quizService.canAccessQuiz(telegramId, courseId);
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

        this.quizState.set(telegramId, { quizId, courseId, lessonId, currentQuestion: 0, answers: [], messageId });
        await this.showQuizQuestion(bot, chatId, quiz, 0, language, telegramId);
      } else if (data.startsWith('submit_quiz_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[2], 10);
        const questionIndex = parseInt(parts[3], 10);
        const selectedAnswer = parseInt(parts[4], 10);
        await this.submitQuestion(telegramId, quizId, questionIndex, selectedAnswer, bot, chatId, language);
      } else if (data.startsWith('next_question_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[2], 10);
        const questionIndex = parseInt(parts[3], 10);
        await this.handleNextQuestion(telegramId, quizId, questionIndex, bot, chatId, language);
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
            [{ text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)), callback_data: quiz.lesson ? `list_lessons_${quiz.course.id}` : 'list_courses' }],
            questionIndex + 1 < quiz.questions.length
              ? [{ text: this.i18nService.getTranslation('quizzes.next', language), callback_data: `next_question_${quiz.id}_${questionIndex + 1}` }]
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

      if (!isCorrect) {
        const explanation = this.escapeMarkdown(
          this.i18nService.getTranslation('quizzes.explanation', language, {
            question: question.question[language],
            correct: question.options[language][question.correct],
          }),
        );
        const message = await bot.sendMessage(chatId, explanation, { parse_mode: 'MarkdownV2', ...keyboard });
        state.messageId = message.message_id;
        this.quizState.set(telegramId, state);
      } else {
        const message = await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('quizzes.correct', language)), {
          parse_mode: 'MarkdownV2',
          ...keyboard,
        });
        state.messageId = message.message_id;
        this.quizState.set(telegramId, state);
      }

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
        const message = this.escapeMarkdown(
          this.i18nService.getTranslation('quizzes.result', language, {
            score: result.score.toString(),
            total: result.total.toString(),
            percentage: Math.round((result.score / result.total) * 100).toString(),
          }) + (result.explanations.length ? '\n\n' + result.explanations.join('\n\n') : ''),
        );

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.restart', language)),
                  callback_data: quiz.lesson ? `start_quiz_lesson_${quiz.lesson.id}` : `start_quiz_${quiz.id}_${quiz.course.id}`,
                },
              ],
              [{ text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)), callback_data: quiz.lesson ? `list_lessons_${quiz.course.id}` : 'list_courses' }],
            ],
          },
        };

        const resultMessage = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
        state.messageId = resultMessage.message_id;
        this.quizState.set(telegramId, state);

        if (quiz.lesson && result.score / result.total >= 0.6) {
          await this.progressService.updateProgressAfterQuiz(telegramId, quiz.lesson.id);
          const progress = await this.progressService.checkCourseCompletion(telegramId, quiz.course.id);
          if (progress.completed === progress.total) {
            const certificate = await this.certificateService.createCertificate(telegramId, quiz.course.id);
            await bot.sendDocument(chatId, certificate.pdfBuffer, {
              filename: `certificate_${quiz.course.id}_${telegramId}.pdf`,
              content_type: 'application/pdf',
              caption: this.escapeMarkdown(
                this.i18nService.getTranslation('certificates.certificate_caption', language, { title: quiz.course.title[language] }),
              ),
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [[{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }]],
              },
            });
          } else {
            await bot.sendMessage(
              chatId,
              this.escapeMarkdown(this.i18nService.getTranslation('quizzes.next_lesson_unlocked', language)),
              {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: this.i18nService.getTranslation('lessons.list', language), callback_data: `list_lessons_${quiz.course.id}` }],
                  ],
                },
              },
            );
          }
        }

        this.quizState.delete(telegramId);
      }
    } catch (error) {
      this.logger.error(`Error submitting question for telegramId: ${telegramId}, quizId: ${quizId}, error: ${error.message}`);
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
      this.logger.error(`Error handling next question for telegramId: ${telegramId}, quizId: ${quizId}, error: ${error.message}`);
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
              { text: this.escapeMarkdown(option), callback_data: `submit_quiz_${quiz.id}_${questionIndex}_${index}` },
            ])
            .concat([
              [{ text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)), callback_data: quiz.lesson ? `list_lessons_${quiz.course.id}` : 'list_courses' }],
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
      this.logger.error(`Error showing quiz question for telegramId: ${telegramId}, quizId: ${quiz.id}, error: ${error.message}`);
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
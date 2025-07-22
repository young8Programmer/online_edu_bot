import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CertificateService } from '../certificate.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ViewCertificatesHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly certificateService: CertificateService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const certificates = await this.certificateService.getCertificates(telegramId, language);
    if (!certificates.length) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('certificates.no_certificates', language), language, telegramId);
      return;
    }

    const message = certificates
      .map((cert, index) =>
        this.i18nService.getTranslation('certificates.info', language, {
          index: (index + 1).toString(),
          course: cert.course.title[language],
          date: cert.issuedAt.toLocaleDateString(language),
        }),
      )
      .join('\n\n');

    await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
  }
}
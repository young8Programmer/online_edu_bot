import { Controller, Get, Param } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { Certificate } from './certificate.entity';

@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get(':telegramId')
  async getCertificates(@Param('telegramId') telegramId: string): Promise<Certificate[]> {
    return this.certificateService.getCertificates(telegramId);
  }
}
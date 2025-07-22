import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin')
  async createAdmin(@Body() body: { telegramId: string; password: string }) {
    return this.authService.createAdmin(body.telegramId, body.password);
  }
}
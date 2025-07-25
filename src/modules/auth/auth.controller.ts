import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Admin } from './auth.entity'; // Admin entity sini import qiling

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin')
  async createAdmin(@Body() body: { telegramId: string; password: string }): Promise<Admin> {
    return this.authService.createAdmin(body.telegramId, body.password);
  }

  @Get('admin/:telegramId')
  async findAdminByTelegramId(@Param('telegramId') telegramId: string): Promise<Admin | null> {
    return this.authService.findByTelegramId(telegramId); // Bu Admin tipini qaytarishi kerak
  }
}

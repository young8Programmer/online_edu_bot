import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({ where: { telegramId } });
      this.logger.log(`User ${telegramId} found: ${user ? JSON.stringify(user) : 'No'}`);
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by telegramId: ${telegramId}, ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const users = await this.userRepository.find();
      this.logger.log(`Found ${users.length} users`);
      return users;
    } catch (error) {
      this.logger.error(`Error finding all users: ${error.message}`);
      throw error;
    }
  }

  async createUser(data: { 
    telegramId: string; 
    fullName: string; 
    phoneNumber?: string; 
    language?: 'uz' | 'ru' | 'en'; 
    email?: string;
    state?: 'awaiting_phone' | 'awaiting_email' | 'registered';
  }): Promise<User> {
    try {
      const user = this.userRepository.create({ ...data, language: data.language || 'uz', state: data.state || 'awaiting_phone' });
      const savedUser = await this.userRepository.save(user);
      this.logger.log(`User created with telegramId: ${savedUser.telegramId}, phone: ${savedUser.phoneNumber}, email: ${savedUser.email}, state: ${savedUser.state}`);
      return savedUser;
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }

  async updateUser(telegramId: string, data: { 
    phoneNumber?: string; 
    email?: string; 
    language?: 'uz' | 'ru' | 'en';
    state?: 'awaiting_phone' | 'awaiting_email' | 'registered';
  }): Promise<void> {
    try {
      const result = await this.userRepository.update({ telegramId }, data);
      if (result.affected === 0) {
        this.logger.warn(`No user found with telegramId: ${telegramId} for update`);
      }
      this.logger.log(`User updated with telegramId: ${telegramId}, data: ${JSON.stringify(data)}`);
      const updatedUser = await this.userRepository.findOne({ where: { telegramId } });
      this.logger.log(`Updated user: ${JSON.stringify(updatedUser)}`);
    } catch (error) {
      this.logger.error(`Error updating user for telegramId: ${telegramId}, ${error.message}`);
      throw error;
    }
  }

  async updateLanguage(telegramId: string, language: 'uz' | 'ru' | 'en'): Promise<void> {
    try {
      const result = await this.userRepository.update({ telegramId }, { language });
      if (result.affected === 0) {
        this.logger.warn(`No user found with telegramId: ${telegramId} for language update`);
      }
      this.logger.log(`Language updated to ${language} for telegramId: ${telegramId}`);
    } catch (error) {
      this.logger.error(`Error updating language for telegramId: ${telegramId}, ${error.message}`);
      throw error;
    }
  }
}
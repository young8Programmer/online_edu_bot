import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Quiz } from './quiz.entity';

@Entity()
export class QuizResult {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @ManyToOne(() => Quiz, (quiz) => quiz.id)
  quiz: Quiz;

  @Column()
  selectedAnswer: number;

  @Column()
  isCorrect: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
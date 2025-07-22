import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Quiz } from './quiz.entity';

@Entity()
export class QuizResult {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.quizResults, {
    onDelete: 'CASCADE',
  })
  user: User;

  @ManyToOne(() => Quiz, (quiz) => quiz.quizResults, {
    onDelete: 'CASCADE',
  })
  quiz: Quiz;

  @Column()
  selectedAnswer: number;

  @Column()
  isCorrect: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

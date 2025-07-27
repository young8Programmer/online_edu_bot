import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Quiz } from './quiz.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', nullable: true })
  quiz_id: number;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ type: 'jsonb' })
  question: { uz: string; ru: string; en: string };

  @Column({ type: 'jsonb' })
  options: { uz: string[]; ru: string[]; en: string[] };

  @Column({ type: 'integer' })
  correct: number;
}
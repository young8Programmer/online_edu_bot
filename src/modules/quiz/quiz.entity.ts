import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Course } from '../course/course.entity';
import { Lesson } from '../lesson/lesson.entity';
import { QuizResult } from './quiz-result.entity';

@Entity()
export class Quiz {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Course, (course) => course.quizzes, { onDelete: 'CASCADE' })
  course: Course;

  @ManyToOne(() => Lesson, (lesson) => lesson.id, { nullable: true, onDelete: 'CASCADE' })
  lesson: Lesson;

  @Column('jsonb')
  questions: Array<{
    question: { uz: string; ru: string; en: string };
    options: Array<{ uz: string; ru: string; en: string }>;
    correct: number;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => QuizResult, (quizResult) => quizResult.quiz)
  quizResults: QuizResult[];
}
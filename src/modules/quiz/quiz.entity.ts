
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany } from 'typeorm';
import { Course } from '../course/course.entity';
import { QuizResult } from './quiz-result.entity';
@Entity()
export class Quiz {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Course, (course) => course.quizzes)
  course: Course;

  @Column('jsonb')
  question: { uz: string; ru: string; en: string };

  @Column('jsonb')
  options: { uz: string[]; ru: string[]; en: string[] };

  @Column()
  correctAnswer: number;

  @OneToMany(() => QuizResult, (quizResult) => quizResult.quiz, {
    cascade: ['insert', 'update'], 
    onDelete: 'CASCADE',
  })
  quizResults: QuizResult[];
}

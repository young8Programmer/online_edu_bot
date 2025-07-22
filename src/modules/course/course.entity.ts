import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('jsonb')
  title: { uz: string; ru: string; en: string };

  @Column('jsonb')
  description: { uz: string; ru: string; en: string };

  @Column({ default: false })
  isPaid: boolean;

  @Column({ type: 'decimal', nullable: true })
  price: number;

  @CreateDateColumn()
  createdAt: Date;
}
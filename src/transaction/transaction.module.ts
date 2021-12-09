import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionRepository } from './transaction.repository';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { AccountsRepository } from '../accounts/accounts.repository';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionRepository]),
    // * 목록 조회에서 계좌의 소유주를 검증하기 위해 사용합니다.
    TypeOrmModule.forFeature([AccountsRepository]),
    ConfigModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}

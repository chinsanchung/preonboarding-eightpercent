import {
  BadRequestException,
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Transaction } from './entities/transaction.entity';
import { ListServiceOptions } from './transaction.interface';
import { AccountsRepository } from '../accounts/accounts.repository';
import { User } from '../users/entities/user.entity';
import { Connection } from 'typeorm';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionRepository } from './transaction.repository';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(TransactionRepository)
    private readonly transactionRepository: TransactionRepository,
    // * 목록 조회에서 계좌의 소유주를 검증하기 위해 사용합니다.
    @InjectRepository(AccountsRepository)
    private readonly accountRepository: AccountsRepository,
    @InjectConnection()
    private connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  async getAllTransactions(query: ListServiceOptions): Promise<Transaction[]> {
    // * 계좌의 소유주인지 여부를 확인합니다.
    const account = await this.accountRepository.findOne({
      where: { acc_num: query.acc_num },
      join: {
        alias: 'account',
        leftJoinAndSelect: { user: 'account.user' },
      },
    });
    if (!account) {
      throw new BadRequestException(
        '거래 내역에 등록한 계좌가 존재하지 않습니다.',
      );
    }
    if (account.user.user_id !== query.user.user_id) {
      throw new NotAcceptableException(
        '오직 계좌의 소유주만 해당 계좌의 거래 내역을 조회하실 수 있습니다.',
      );
    }
    const result = this.transactionRepository.getAllTransactions({
      ...query,
      nodeEnv: this.configService.get('NODE_ENV'),
    });
    return result;
  }
  async deposit(
    user: User,
    createTransactionDto: CreateTransactionDto,
  ): Promise<{ message: string }> {
    // queryRunner 커넥션
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();

    // customRepo 연결
    const transactionRepository = queryRunner.manager.getCustomRepository(
      TransactionRepository,
    );
    const accountsRepository =
      queryRunner.manager.getCustomRepository(AccountsRepository);

    // 트랜잭션 시작
    await queryRunner.startTransaction();
    try {
      // 해당 유저의 계좌번호로 계좌정보 가져오기
      const account = await accountsRepository.findOneByAccountNumber(
        createTransactionDto.acc_num,
        user,
      );

      // 해당계좌의 거래내역이 생성
      await transactionRepository.save(
        transactionRepository.create({
          ...createTransactionDto,
          balance: account.money + createTransactionDto.amount,
          trans_type: 'in',
          account,
        }),
      );

      // 해당계좌의 잔액 증가
      await accountsRepository.updateAccount(
        account.id,
        { money: account.money + createTransactionDto.amount },
        user,
      );

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(e.message);
    } finally {
      await queryRunner.release();
    }
    return { message: 'ok' };
  }

  async withdraw(
    user: User,
    createTransactionDto: CreateTransactionDto,
  ): Promise<{ message: string }> {
    // queryRunner 커넥션
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();

    // customRepo 연결
    const transactionRepository = queryRunner.manager.getCustomRepository(
      TransactionRepository,
    );
    const accountsRepository =
      queryRunner.manager.getCustomRepository(AccountsRepository);

    // 트랜잭션 시작
    await queryRunner.startTransaction();
    try {
      // 해당 유저의 계좌번호로 계좌정보 가져오기
      const account = await accountsRepository.findOneByAccountNumber(
        createTransactionDto.acc_num,
        user,
      );

      //계좌의 잔액과 출금액을 비교해서 계좌의 잔액이 더 커야함
      await transactionRepository.compareMoneyAndAmount(
        account.money,
        createTransactionDto.amount,
      );

      // 해당계좌의 거래내역이 생성
      await transactionRepository.save(
        transactionRepository.create({
          ...createTransactionDto,
          balance: account.money - createTransactionDto.amount,
          trans_type: 'out',
          account,
        }),
      );

      // 해당계좌의 잔액 감소
      await accountsRepository.updateAccount(
        account.id,
        { money: account.money - createTransactionDto.amount },
        user,
      );

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(e.message);
    } finally {
      await queryRunner.release();
    }
    return { message: 'ok' };
  }

  async getOneTransaction(id: number): Promise<Transaction> {
    const result = await this.transactionRepository.findOne(id);
    if (!result) {
      throw new NotFoundException('해당 거래내역을 찾을 수 없습니다.');
    }
    return result;
  }
}

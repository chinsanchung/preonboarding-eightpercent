import { BadRequestException } from '@nestjs/common';
import { add, format, set, subHours, subMonths } from 'date-fns';
import { EntityRepository, Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { ListWithPageAndUserOptions } from './transaction.interface';

@EntityRepository(Transaction)
export class TransactionRepository extends Repository<Transaction> {
  private getDatePeriod(
    startDate: string | undefined,
    endDate: string | undefined,
  ): [string, string] {
    // * 처음과 마지막을 쿼리로 전달하지 않을 경우, 3개월 전부터 오늘까지를 기준으로 정합니다.
    let startDateString = '';
    let endDateString = '';
    const UTCZeroToday = subHours(
      set(new Date(), {
        hours: 0,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      }),
      9,
    );
    if (startDate) {
      startDateString = `${startDate} 00:00:00`;
    } else {
      startDateString = format(
        subMonths(UTCZeroToday, 3),
        'yyyy-MM-dd HH:mm:ss',
      );
    }
    if (endDate) {
      endDateString = `${endDate} 23:59:59`;
    } else {
      const endDate = add(UTCZeroToday, {
        hours: 23,
        minutes: 59,
        seconds: 59,
      });
      endDateString = format(endDate, 'yyyy-MM-dd HH:mm:ss');
    }
    return [startDateString, endDateString];
  }
  async getAllTransactions({
    limit,
    offset,
    trans_type,
    startDate,
    endDate,
    acc_num,
  }: ListWithPageAndUserOptions): Promise<Transaction[]> {
    // * 거래일시에 대한 필터링을 수행합니다. 처음과 끝 날짜를 계산하여 문자열 형식으로 반환합니다.
    const [startDateString, endDateString] = this.getDatePeriod(
      startDate,
      endDate,
    );
    // * 입금, 출금 필터링. 1. 입금, 2. 출금, 3. 입출금 으로 구분합니다.
    let transTypeQuery: any = [
      'transaction.trans_type = :trans_type',
      { trans_type },
    ];
    if (!trans_type) {
      transTypeQuery = [
        'transaction.trans_type IN (:...trans_type)',
        { trans_type: ['in', 'out'] },
      ];
    }
    const transaction = await this.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.account', 'account')
      .where('account.acc_num = :acc_num', { acc_num })
      .andWhere('transaction.createdAt >= :startDate', {
        startDate: startDateString,
      })
      .andWhere('transaction.createdAt <= :endDate', {
        endDate: endDateString,
      })
      .andWhere(transTypeQuery[0], transTypeQuery[1])
      .limit(limit) // * Pagination 기능
      .offset(offset) // * Pagination 기능
      .select([
        'transaction.id',
        'transaction.createdAt',
        'transaction.amount',
        'transaction.balance',
        'transaction.trans_type',
        'transaction.comments',
      ])
      .getMany();
    // * select 로 특정 컬럼만 응답에 포함합니다. [거래일시, 거래금액, 잔액, 거래종류, 적요]
    return transaction;
  }
  //계좌의 잔액과 출금액을 비교해서 계좌의 잔액이 더 커야함
  compareMoneyAndAmount(money: number, amount: number) {
    if (money < amount) {
      throw new BadRequestException('계좌의 잔액이 부족합니다.');
    }
  }
}

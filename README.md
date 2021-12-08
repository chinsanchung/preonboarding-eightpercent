# 프리온보딩 백엔드 과정 4번째 과제: 8퍼센트

[8퍼센트](https://8percent.kr/)에서 제공해주신 API 설계 과제입니다. 헤로쿠를 이용해 배포했으며, 주소는 [https://eight-percent-subject.herokuapp.com](https://eight-percent-subject.herokuapp.com)입니다.

## 과제에 대한 안내

1. 필수 요구 사항

- 거래내역 조회 API
  - 계좌의 소유주만 요청 할 수 있어야 합니다.
  - 거래일시에 대한 필터링이 가능해야 합니다.
  - 출금, 입금만 선택해서 필터링을 할 수 있어야 합니다.
  - Pagination이 필요 합니다.
  - 다음 사항이 응답에 포함되어야 합니다.
    - 거래일시
    - 거래금액
    - 잔액
    - 거래종류 (출금/입금)
    - 적요
- 입금 API
  - 계좌의 소유주만 요청 할 수 있어야 합니다.
- 출금 API
  - 계좌의 소유주만 요청 할 수 있어야 합니다.
  - 계좌의 잔액내에서만 출금 할 수 있어야 합니다. 잔액을 넘어선 출금 요청에 대해서는 적절한 에러처리가 되어야 합니다.

2. 개발 요구사항

- 계좌의 잔액을 별도로 관리해야 하며, 계좌의 잔액과 거래내역의 잔액의 무결성을 보장해야 합니다.
- DB를 설계 할때 각 칼럼의 타입과 제약을 고려해야 합니다.
- 테스트의 편의성을 위해 mysql, postgresql 대신 sqllite를 사용해 주세요.

3. 가산점

- Unit test의 구현
- Functional Test 의 구현 (입금, 조회, 출금에 대한 시나리오 테스트)
- 거래내역이 1억건을 넘어갈 때에 대한 고려
  - 이를 고려하여 어떤 설계를 추가하셨는지를 README에 남겨 주세요.

## 데이터베이스 ERD

![데이터베이스 ERD](https://user-images.githubusercontent.com/57168321/141470315-48e1e5e7-0bc6-4e9e-ac77-54efc3bc2f7f.PNG)

## 개발 환경

- 언어: TypeScript
- 데이터베이스: SQLite3
- 사용 도구: NestJs, typeorm, passport, passport-jwt, bcrypt, class-validator, class-transformer, date-fns

## API 문서

포스트맨으로 작성한 [API 문서](https://documenter.getpostman.com/view/15323948/UVC8CRnQ)에서 상세한 내용을 확인하실 수 있습니다.

## Functional test

회원가입, 로그인, 계좌 생성, 입금, 출금, 그리고 거래 내역을 조회하는 과정을 [Functional test](https://github.com/wanted-wecode-subjects/eight-percent-subject/wiki/functional-test)에 작성했습니다.

## 실행 방법

1. `git clone` 으로 프로젝트를 가져온 후, `npm install` 으로 필요한 패키지를 설치합니다.
2. 루트 디렉토리에 .env 파일을 생성하고, 임의의 문자열 값을 가진 `JWT_SECRET`을 작성합니다.
3. 개발 환경일 때는`npm run start:dev`으로, 배포 환경일 때는 `npm run build`으로 빌드한 후 `npm run start:prod`을 입력하시면 로컬에서 테스트하실 수 있습니다.
4. POST `localhost:3000/users`에서 `user_id`, `password`를 입력해 유저를 생성합니다.
5. POST `localhost:3000/users/signin`에 `user_id`, `password`을 입력하신 후 결과값으로 accessToken을 발급받습니다.
6. 계좌 생성, 입금, 출금 등 권한이 필요한 API의 주소를 입력한 후, Headers 의 Authorization에 accessToken을 붙여넣어 권한을 얻은 후 API를 호출합니다.

## 수행한 작업

### 거래내역 목록 조회

조회 기능을 위해선 로그인이 필요하며 pagination 으로 한 번에 5개씩 출력합니다.

URI 쿼리를 다음과 같이 입력하셔야 합니다.

- acc_num: 계좌번호를 입력합니다. 필수로 입력하는 값입니다.
- startDate: 거래일시의 시작을 입력합니다. `YYYY-MM-DD` 형식으로 작성합니다. 만약 이 값을 입력하지 않는다면 "오늘을 기준으로 3개월 전"으로 설정합니다.
- endDate: 거래일시의 끝을 입력합니다. 시작일과 동일하게 `YYYY-MM-DD` 형식으로 작성합니다. 생략할 경우 기본값인 "오늘 날짜의 23시 59분 59초"로 설정합니다.
- page: 페이지 번호를 입력합니다. 1페이지부터 시작합니다.
- trans_type: 거래의 종류입니다. "in"은 입금, "out"은 출금입니다. 이 값을 생략할 경우 입금과 출력 모두를 출력합니다.

우선 [transaction.service.ts](https://github.com/chinsanchung/preonboarding-eightpercent/blob/master/src/transaction/transaction.service.ts)에서는 계좌의 소유주인지 여부를 확인하고, 일치하면 다음 과정으로 넘어갑니다.

```typescript
// transaction.service.ts
async function getAllTransactions(
  query: ListWithPageAndUserOptions,
): Promise<Transaction[]> {
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
  const result = this.transactionRepository.getAllTransactions(query);
  return result;
}
```

다음은 [transaction.repository.ts](https://github.com/chinsanchung/preonboarding-eightpercent/blob/master/src/transaction/transaction.repository.ts)에서 데이터베이스에 접근해 목록을 추출합니다. 레포지토리를 따로 만든 이유는 복잡한 데이터베이스 쿼리로 인해 코드가 길어질 경우 따로 파일을 만들어서 관리하기로 팀원과 협의해서입니다.

```typescript
function getDatePeriod(
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
    startDateString = format(subMonths(UTCZeroToday, 3), 'yyyy-MM-dd HH:mm:ss');
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
```

날짜 쿼리 startDate, endDate 를 입력하지 않았을 경우, 3개월 이전 ~ 오늘까지의 거래 내역을 조회합니다. 3개월 이전을 계산하기 위해 [date-fns](https://date-fns.org/)으로 시간을 계산했습니다.

- 1. SQLite3 은 UTC+0 시간대를 기준으로 잡고 있습니다. 그에 맞춰 `UTCZeroToday` 변수의 값을 UTC+0 시간대로 변환한 오늘 날짜로 하고, 0시 0분 0초로 설정합니다.
- 2. `UTCZeroToday`을 이용해 3개월 전의 날짜를 구하고 `format` 함수로 'yyyy-MM-dd HH:mm:ss' 형식의 문자열로 변환합니다.
- 3. 마찬가지로, `UTCZeroToday`에 23시 59분 59초를 더해 오늘의 마지막 시간으로 설정한 후, 문자열로 변환합니다.

거래 내역의 기간을 계산한 후, 입금과 출금 필터링을 추가하여 `createQueryBuilder` 메소드를 이용해 거래 내역의 목록을 조회합니다.

```typescript
async function getAllTransactions({
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
```

### 특정 거래내역 조회

거래내역의 id 를 URI 파라미터로 받아 특정 거래내역을 조회합니다. 거래내역의 작성자인지 여부를 확인하기 위해 로그인이 필요합니다.

`findOne` 메소드를 이용해 데이터를 추출하며, 거래를 수행한 계좌의 정보를 같이 출력하기 위해 [엔티티](https://github.com/chinsanchung/preonboarding-eightpercent/blob/master/src/transaction/entities/transaction.entity.ts)에서 계좌 컬럼의 eager 를 true 로 지정했습니다. 그러면 거래내역을 `find` 또는 `findOne`으로 조회할 때 계좌에 대한 정보도 같이 보여줄 수 있습니다.

```typescript
export class Transaction {
  @ManyToOne((_type) => Account, (account) => account.transactions, {
    eager: true,
    onDelete: 'CASCADE',
  })
  account: Account;
}
```

## 리팩토링

### 시간 계산을 수행하는 방식 변경

[transaction.repository.ts](https://github.com/chinsanchung/preonboarding-eightpercent/blob/master/src/transaction/transaction.repository.ts)의 `getDatePeriod`을 리팩토링한 것으로, 거래 내역의 목록을 조회할 때 시간을 계산하는 방식을 [moment-timezone](https://www.npmjs.com/package/moment-timezone) 대신 [date-fns](https://www.npmjs.com/package/date-fns)으로 수정했습니다.

- 이유 1: momentjs 는 날짜를 계산하려면 인스턴스를 만들어야하는데, 즉 불필요한 함수까지 전부 가져와 애플리케이션을 빌드했을 때 용량이 커집니다. 반면 date-fns 는 필요한 함수만을 따로 가져와 사용할 수 있어 빌드했을 떄의 용량을 줄일 수 있습니다.
- 이유 2: momentjs 에서 인스턴스를 생성하여 계산하는 과정에서 date-fns 보다 많은 시간을 소요합니다.
- 위의 글은 [momentjs vs date-fns](https://medium.com/@k2u4yt/momentjs-vs-date-fns-6bddc7bfa21e)을 참고했습니다.

## 폴더 구조

```
|   .eslintrc.js
|   .gitignore
|   .prettierrc
|   nest-cli.json
|   package-lock.json
|   package.json
|   Procfile
|   README.md
|   tsconfig.build.json
|   tsconfig.json
|
+---src
|   |   app.controller.spec.ts
|   |   app.controller.ts
|   |   app.module.ts
|   |   app.service.ts
|   |   main.ts
|   |
|   +---accounts
|   |   |   accounts.controller.spec.ts
|   |   |   accounts.controller.ts
|   |   |   accounts.module.ts
|   |   |   accounts.repository.spec.ts
|   |   |   accounts.repository.ts
|   |   |   accounts.service.spec.ts
|   |   |   accounts.service.ts
|   |   |
|   |   +---dto
|   |   |       create-account.dto.ts
|   |   |       update-account.dto.ts
|   |   |
|   |   \---entities
|   |           account.entity.ts
|   |
|   +---auth
|   |   |   auth.module.ts
|   |   |   auth.service.spec.ts
|   |   |   auth.service.ts
|   |   |   get-user.decorator.ts
|   |   |
|   |   +---auth-guard
|   |   |       jwt-auth.guard.ts
|   |   |
|   |   \---strategies
|   |           jwt.strategy.ts
|   |
|   +---core
|   |   \---entities
|   |           core.entity.ts
|   |
|   +---transaction
|   |   |   transaction.controller.spec.ts
|   |   |   transaction.controller.ts
|   |   |   transaction.module.ts
|   |   |   transaction.repository.ts
|   |   |   transaction.service.ts
|   |   |
|   |   +---dto
|   |   |       create-transaction.dto.ts
|   |   |
|   |   \---entities
|   |           transaction.entity.ts
|   |
|   \---users
|       |   users.controller.spec.ts
|       |   users.controller.ts
|       |   users.module.ts
|       |   users.service.spec.ts
|       |   users.service.ts
|       |
|       +---dto
|       |       create-user.dto.ts
|       |       signin.dto.ts
|       |
|       \---entities
|               user.entity.ts
|-  .eslintrc.js
|-  .gitignore
|-  .prettierrc
|-  nest-cli.json
|-  package-lock.json
|-  package.json
|-  Procfile
|-  README.md
|-  tsconfig.build.json
|-  tsconfig.json
```

import { User } from '../users/entities/user.entity';

export interface ListQueryOptions {
  acc_num: string;
  page: string;
  trans_type?: 'in' | 'out';
  startDate?: string;
  endDate?: string;
}

export interface ListServiceOptions extends ListQueryOptions {
  user?: User;
  limit: number;
  offset: number;
}

export interface ListRepositoryOptions extends ListServiceOptions {
  nodeEnv: 'production' | undefined;
}

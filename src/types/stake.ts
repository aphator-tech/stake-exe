export type Currency = 'inr' | 'btc' | 'eth' | 'ltc' | 'doge' | 'bch' | 'xrp' | 'trx' | 'eos' | 'usdt' | 'usdc' | 'ape' | 'busd' | 'cro' | 'dai' | 'link' | 'sand' | 'shib' | 'uni' | 'matic';

export interface StakeUser {
  id: string;
  name: string;
  balances: Array<{
    available: {
      amount: number;
      currency: Currency;
    };
  }>;
}

export interface CrashBet {
  id: string;
  amount: number;
  currency: Currency;
  payout: number;
  multiplier: number;
  status: 'won' | 'lost' | 'pending';
  createdAt: string;
}

export interface CrashGame {
  id: string;
  hash: string;
  multiplier: number;
  status: 'running' | 'ended' | 'starting';
}

export interface StakeResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

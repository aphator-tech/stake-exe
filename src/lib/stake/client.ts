import { GraphQLClient, gql } from 'graphql-request';
import { Currency } from '@/types/stake';

export class StakeClient {
  private client: GraphQLClient;
  // We now use the internal Next.js proxy to bypass CORS and Cloudflare
  private endpoint = '/api/proxy';

  constructor(private apiToken: string) {
    this.client = new GraphQLClient(this.endpoint, {
      headers: {
        'x-access-token': this.apiToken,
      },
    });
  }

  async getUser() {
    const query = gql`
      query GetUser {
        user {
          id
          name
          balances {
            available {
              amount
              currency
            }
          }
        }
      }
    `;
    const response: any = await this.client.request(query);
    return response.user;
  }

  async getBalance(currency: Currency) {
    const user = await this.getUser();
    const balance = user.balances.find((b: any) => b.available.currency === currency);
    return balance?.available.amount || 0;
  }

  async placeCrashBet(amount: number, targetMultiplier: number, currency: Currency) {
    const mutation = gql`
      mutation CreateCrashBet($amount: Float!, $targetMultiplier: Float!, $currency: CurrencyEnum!) {
        createCrashBet(amount: $amount, targetMultiplier: $targetMultiplier, currency: $currency) {
          id
          status
          amount
          multiplier
          payout
          createdAt
        }
      }
    `;
    const variables = {
      amount,
      targetMultiplier,
      currency,
    };
    const response: any = await this.client.request(mutation, variables);
    return response.createCrashBet;
  }

  async getCrashHistory(limit: number = 20) {
    const query = gql`
      query GetCrashHistory($limit: Int!) {
        crashHistory(limit: $limit) {
          id
          multiplier
          hash
        }
      }
    `;
    const response: any = await this.client.request(query, { limit });
    return response.crashHistory;
  }

  async getActiveCrashGame() {
    const query = gql`
      query GetActiveCrashGame {
        activeCrashGame {
          id
          status
          multiplier
          startTime
        }
      }
    `;
    const response: any = await this.client.request(query);
    return response.activeCrashGame;
  }
}

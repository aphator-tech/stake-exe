import { Currency } from '@/types/stake';

export interface StrategyConfig {
  initialBet: number;
  currency: Currency;
  maxBet: number;
  profitTarget: number;
  baseMultiplier: number;
}

export interface BotState {
  currentBet: number;
  consecutiveLosses: number;
  totalProfit: number;
  isRunning: boolean;
  history: number[];
}

export class StrategyEngine {
  private config: StrategyConfig;
  private state: BotState;

  constructor(config: StrategyConfig) {
    this.config = config;
    this.state = {
      currentBet: config.initialBet,
      consecutiveLosses: 0,
      totalProfit: 0,
      isRunning: false,
      history: [],
    };
  }

  /**
   * Smart Brain Logic:
   * Analyzes history and balance to maximize long-term survival and steady growth.
   */
  calculateNextBet(balance: number, lastResult?: { won: boolean; multiplier: number }): { amount: number; targetMultiplier: number } {
    // Determine dynamic base bet based on 0.1% of balance if not specified
    const dynamicBase = Math.max(this.config.initialBet, Math.floor(balance * 0.001));

    if (!lastResult) {
      this.state.currentBet = dynamicBase;
      return { amount: this.state.currentBet, targetMultiplier: this.config.baseMultiplier };
    }

    if (lastResult.won) {
      this.state.consecutiveLosses = 0;
      // Reset to dynamic base after win
      this.state.currentBet = dynamicBase;
    } else {
      this.state.consecutiveLosses++;

      // Smart Martingale: Only increase if we haven't hit maxBet
      // We use a 2.1x multiplier to cover the 2x target and small fees/slippage
      const nextBet = this.state.currentBet * 2.1;

      if (nextBet > this.config.maxBet || nextBet > balance) {
        // Reset to base if we hit limits to prevent total bust
        this.state.currentBet = dynamicBase;
        this.state.consecutiveLosses = 0;
      } else {
        this.state.currentBet = nextBet;
      }
    }

    // Adaptive Multiplier based on history
    let targetMultiplier = this.config.baseMultiplier;

    // Analyze recent 10 games
    const recent = this.state.history.slice(-10);
    const lowCrashes = recent.filter(m => m < 2).length;

    if (lowCrashes > 7) {
      // If last 7/10 games crashed below 2x, "Red Mode" - be more conservative
      targetMultiplier = 1.5;
    } else if (lowCrashes < 3 && recent.length === 10) {
      // If history is "Hot" (many high crashes), aim slightly higher
      targetMultiplier = 2.5;
    }

    return {
      amount: Math.max(1, Math.floor(this.state.currentBet)),
      targetMultiplier: targetMultiplier,
    };
  }

  addHistory(multiplier: number) {
    this.state.history.push(multiplier);
    if (this.state.history.length > 100) {
      this.state.history.shift();
    }
  }

  updateProfit(payout: number, amount: number) {
    this.state.totalProfit += (payout - amount);
  }

  getState() {
    return this.state;
  }
}

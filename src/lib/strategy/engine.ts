import { Currency } from '@/types/stake';

export interface StrategyConfig {
  initialBet: number;
  currency: Currency;
  maxBet: number;
  profitTarget: number;
  baseMultiplier: number;
  isAutonomous: boolean;
}

export interface BotState {
  currentBet: number;
  consecutiveLosses: number;
  totalProfit: number;
  isRunning: boolean;
  history: number[];
  mode: 'Conservative' | 'Aggressive' | 'Recovery' | 'Wait';
  confidence: number;
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
      mode: 'Conservative',
      confidence: 50,
    };
  }

  /**
   * ADVANCED AUTONOMOUS BRAIN
   * Self-decisive logic that targets consistent profits.
   */
  calculateNextBet(balance: number, lastResult?: { won: boolean; amount: number; payout: number }): {
    amount: number;
    targetMultiplier: number;
    shouldSkip: boolean;
  } {
    // 1. Process Results
    if (lastResult) {
      this.state.totalProfit += (lastResult.payout - lastResult.amount);
      if (lastResult.won) {
        this.state.consecutiveLosses = 0;
        this.state.mode = 'Conservative';
      } else {
        this.state.consecutiveLosses++;
        this.state.mode = 'Recovery';
      }
    }

    // 2. Market Analysis (History)
    const recent = this.state.history.slice(-20);
    const lowCrashes = recent.filter(m => m < 1.3).length;
    const highCrashes = recent.filter(m => m > 3.0).length;

    // Dynamic Confidence
    this.state.confidence = 100 - (lowCrashes * 10) + (highCrashes * 5);
    this.state.confidence = Math.max(0, Math.min(100, this.state.confidence));

    // Protection Logic
    const isToxic = recent.slice(-3).every(m => m < 1.5) && recent.length >= 3;
    const shouldSkip = isToxic || this.state.confidence < 15;

    // 3. Autonomous Bet Calculation
    let baseBet = this.config.initialBet;
    if (this.config.isAutonomous) {
      // Self-decide base bet: 0.1% of balance is the "Smart Base"
      baseBet = Math.max(1, Math.floor(balance * 0.001));
    }

    if (this.state.consecutiveLosses > 0) {
      // Martingale Progression: 2.1x to cover the 2x target + profit
      this.state.currentBet = this.state.currentBet * 2.1;

      // Safety Ceiling: Never wager more than 5% of balance in one go
      const maxSafety = balance * 0.05;
      if (this.state.currentBet > maxSafety) {
        this.state.currentBet = baseBet;
        this.state.consecutiveLosses = 0;
        this.state.mode = 'Wait';
      }
    } else {
      this.state.currentBet = baseBet;
    }

    // 4. Autonomous Multiplier Targeting
    let targetMultiplier = this.config.baseMultiplier;
    if (this.config.isAutonomous) {
      // If we are on a recovery streak, stay safe at 2.0x
      if (this.state.mode === 'Recovery') {
        targetMultiplier = 2.0;
      } else {
        // Target based on confidence:
        // High confidence -> lower multiplier for "sure wins"
        // Low confidence -> slightly higher to compensate for skips
        if (this.state.confidence > 80) targetMultiplier = 1.5;
        else if (this.state.confidence > 50) targetMultiplier = 2.0;
        else targetMultiplier = 2.5;
      }
    }

    // Manual Max Bet Override
    if (this.state.currentBet > this.config.maxBet) {
       this.state.currentBet = baseBet;
       this.state.consecutiveLosses = 0;
    }

    return {
      amount: Math.max(1, Math.floor(this.state.currentBet)),
      targetMultiplier: targetMultiplier,
      shouldSkip: shouldSkip || this.state.mode === 'Wait'
    };
  }

  addHistory(multiplier: number) {
    if (this.state.history.length > 0 && this.state.history[this.state.history.length - 1] === multiplier) return;
    this.state.history.push(multiplier);
    if (this.state.history.length > 100) this.state.history.shift();
  }

  getState() {
    return this.state;
  }
}

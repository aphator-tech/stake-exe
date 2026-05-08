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
   * FULL AUTONOMOUS BRAIN
   * Decides bet size, multiplier, and whether to play at all based on balance and history.
   */
  calculateNextBet(balance: number, lastResult?: { won: boolean; amount: number; payout: number }): {
    amount: number;
    targetMultiplier: number;
    shouldSkip: boolean;
  } {
    // 1. Update Internal State based on result
    if (lastResult) {
      this.state.totalProfit += (lastResult.payout - lastResult.amount);
      if (lastResult.won) {
        this.state.consecutiveLosses = 0;
        this.state.mode = 'Conservative';
      } else {
        this.state.consecutiveLosses++;
        if (this.state.consecutiveLosses > 3) this.state.mode = 'Recovery';
      }
    }

    // 2. ANALYZE HISTORY (The Brain)
    const recent = this.state.history.slice(-20);
    const avgCrash = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    const lowCrashes = recent.filter(m => m < 1.5).length;

    // Confidence calculation (0-100)
    // High low-crashes count = lower confidence
    this.state.confidence = Math.max(0, 100 - (lowCrashes * 10));

    // Decision: Should we skip?
    // If the last 3 games were below 1.2x, history is "toxic", wait for a recovery.
    const toxicStreak = recent.slice(-3).every(m => m < 1.2) && recent.length >= 3;
    const shouldSkip = toxicStreak || this.state.confidence < 20;

    // 3. DECIDE BET SIZE
    let betAmount = this.config.initialBet;
    if (this.config.isAutonomous) {
      // Auto-scale: Base bet is 0.05% of balance for high safety
      betAmount = Math.max(1, Math.floor(balance * 0.0005));
    }

    if (this.state.mode === 'Recovery') {
      // Smart recovery: Use 2.1x but cap it at 1% of balance to avoid bust
      const recoveryBet = this.state.currentBet * 2.1;
      const safetyCap = balance * 0.01;
      betAmount = Math.min(recoveryBet, safetyCap);
    }

    this.state.currentBet = betAmount;

    // 4. DECIDE TARGET MULTIPLIER
    let targetMultiplier = this.config.baseMultiplier;
    if (this.config.isAutonomous) {
      if (avgCrash > 3) {
        // "Hot" table, aim for a safer 1.8x to lock in wins
        targetMultiplier = 1.8;
      } else if (lowCrashes > 5) {
        // "Cold" table, target 2.5x with small bets to catch a bounce
        targetMultiplier = 2.5;
        this.state.currentBet = Math.max(1, Math.floor(betAmount * 0.5));
      } else {
        targetMultiplier = 2.0;
      }
    }

    // Final Overrides
    if (this.state.currentBet > this.config.maxBet) {
       this.state.currentBet = this.config.initialBet;
       this.state.mode = 'Conservative';
    }

    return {
      amount: Math.max(1, Math.floor(this.state.currentBet)),
      targetMultiplier: targetMultiplier,
      shouldSkip: shouldSkip
    };
  }

  addHistory(multiplier: number) {
    // Avoid duplicates if polling caught the same game
    if (this.state.history.length > 0 && this.state.history[this.state.history.length - 1] === multiplier) {
      return;
    }
    this.state.history.push(multiplier);
    if (this.state.history.length > 100) {
      this.state.history.shift();
    }
  }

  getState() {
    return this.state;
  }
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StakeClient } from '@/lib/stake/client';
import { StrategyEngine } from '@/lib/strategy/engine';
import { Currency } from '@/types/stake';
import { Play, Square, Settings, TrendingUp, AlertCircle, History } from 'lucide-react';

export default function BotDashboard() {
  const [apiToken, setApiToken] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({
    balance: 0,
    profit: 0,
    wins: 0,
    losses: 0,
  });
  const [config, setConfig] = useState({
    initialBet: 10,
    maxBet: 1000,
    baseMultiplier: 2.0,
    currency: 'inr' as Currency,
  });

  const clientRef = useRef<StakeClient | null>(null);
  const engineRef = useRef<StrategyEngine | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastGameId = useRef<string | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev.slice(0, 49)]);
  };

  const updateBalance = async () => {
    if (clientRef.current) {
      try {
        const balance = await clientRef.current.getBalance(config.currency);
        setStats(prev => ({ ...prev, balance }));
        return balance;
      } catch (e) {
        addLog('Error fetching balance');
      }
    }
    return 0;
  };

  const startBot = async () => {
    if (!apiToken) {
      alert('Please enter your Stake API Token');
      return;
    }

    clientRef.current = new StakeClient(apiToken);
    engineRef.current = new StrategyEngine({
      initialBet: config.initialBet,
      maxBet: config.maxBet,
      baseMultiplier: config.baseMultiplier,
      currency: config.currency,
      profitTarget: 9999999,
    });

    setIsRunning(true);
    addLog('Bot started...');

    // Initial balance check
    await updateBalance();
  };

  const stopBot = () => {
    setIsRunning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    addLog('Bot stopped.');
  };

  useEffect(() => {
    if (isRunning) {
      runLoop();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning]);

  const runLoop = async () => {
    if (!isRunning) return;

    try {
      const balance = await updateBalance();

      // 1. Get history and update engine
      const history = await clientRef.current!.getCrashHistory(10);
      history.forEach((game: any) => engineRef.current!.addHistory(game.multiplier));

      // 2. Check current game status
      const game = await clientRef.current!.getActiveCrashGame();

      if (game && game.status === 'starting' && game.id !== lastGameId.current) {
         lastGameId.current = game.id;

         // Calculate next bet based on previous results (if any)
         const nextBet = engineRef.current!.calculateNextBet(balance);

         addLog(`Placing bet: ${nextBet.amount} ${config.currency} @ ${nextBet.targetMultiplier}x`);

         const bet = await clientRef.current!.placeCrashBet(nextBet.amount, nextBet.targetMultiplier, config.currency);
         addLog(`Bet placed! ID: ${bet.id}`);

         // Wait for result (in next loops)
      } else if (game && game.status === 'ended') {
          // If we had a bet in the previous game, we should update engine with result
          // This would ideally come from the bet object or history
          const lastGameResult = history[0]; // Assuming history is sorted newest first
          if (lastGameResult && lastGameResult.id === lastGameId.current) {
              const won = lastGameResult.multiplier >= engineRef.current!.getState().currentBet; // This is a simplification
              // In reality, we'd check if our bet won
          }
      }

    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }

    timerRef.current = setTimeout(runLoop, 2000); // Polling every 2 seconds for better responsiveness
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="text-emerald-500" />
              StakeCrash AI Bot
            </h1>
            <p className="text-slate-400 text-sm">Professional Grade Automation</p>
          </div>
          <div className="flex gap-3">
            {!isRunning ? (
              <button
                onClick={startBot}
                className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition"
              >
                <Play size={18} /> Start Bot
              </button>
            ) : (
              <button
                onClick={stopBot}
                className="bg-rose-600 hover:bg-rose-500 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition"
              >
                <Square size={18} /> Stop Bot
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History size={18} className="text-blue-500" /> Statistics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-xs uppercase">Balance</p>
                <p className="text-xl font-mono">{stats.balance.toFixed(2)} {config.currency.toUpperCase()}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-xs uppercase">Profit</p>
                <p className={`text-xl font-mono ${stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stats.profit.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings size={18} className="text-purple-500" /> Configuration
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">API TOKEN</label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Enter session token..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">BASE BET</label>
                  <input
                    type="number"
                    value={config.initialBet}
                    onChange={(e) => setConfig({...config, initialBet: Number(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">TARGET X</label>
                  <input
                    type="number"
                    value={config.baseMultiplier}
                    onChange={(e) => setConfig({...config, baseMultiplier: Number(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" /> Risk Control
            </h2>
            <div>
              <label className="text-xs text-slate-400 block mb-1">MAX BET LIMIT</label>
              <input
                type="number"
                value={config.maxBet}
                onChange={(e) => setConfig({...config, maxBet: Number(e.target.value)})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-xs text-amber-200">
              Bot uses <b>Smart Martingale</b>. It will multiply bet by 2.1x on loss and reset to base on win.
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
            <h2 className="font-semibold">Activity Logs</h2>
            <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">Live</span>
          </div>
          <div className="h-64 overflow-y-auto p-4 font-mono text-sm space-y-1 bg-slate-950">
            {logs.length === 0 && <p className="text-slate-600 italic">No activity yet...</p>}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-slate-500">[{log.split(': ')[0]}]</span>
                <span>{log.split(': ').slice(1).join(': ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StakeClient } from '@/lib/stake/client';
import { StrategyEngine } from '@/lib/strategy/engine';
import { Currency } from '@/types/stake';
import { Play, Square, Settings, TrendingUp, AlertCircle, History, Brain, ShieldCheck } from 'lucide-react';

export default function BotDashboard() {
  const [apiToken, setApiToken] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isAutonomous, setIsAutonomous] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [botStatus, setBotStatus] = useState<any>(null);
  const [stats, setStats] = useState({
    balance: 0,
    profit: 0,
    wins: 0,
    losses: 0,
  });
  const [config, setConfig] = useState({
    initialBet: 10,
    maxBet: 5000,
    baseMultiplier: 2.0,
    currency: 'inr' as Currency,
  });

  const clientRef = useRef<StakeClient | null>(null);
  const engineRef = useRef<StrategyEngine | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastGameId = useRef<string | null>(null);
  const lastProcessedGameId = useRef<string | null>(null);
  const activeBetId = useRef<string | null>(null);
  const lastBetDetails = useRef<any>(null);

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
      ...config,
      isAutonomous,
      profitTarget: 9999999,
    });

    setIsRunning(true);
    addLog('AI Bot initialized in ' + (isAutonomous ? 'Autonomous' : 'Manual') + ' mode');
    await updateBalance();
  };

  const stopBot = () => {
    setIsRunning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    addLog('Bot deactivated.');
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
      // 1. Check current game status first for maximum responsiveness
      const game = await clientRef.current!.getActiveCrashGame();

      if (game) {
        setBotStatus(engineRef.current!.getState());

        // Process Game Result if transition from game-to-game occurred
        if (game.status === 'ended' && game.id !== lastProcessedGameId.current) {
          lastProcessedGameId.current = game.id;

          // Refresh history to see what the crash was
          const history = await clientRef.current!.getCrashHistory(1);
          const lastGame = history[0];

          if (lastGame) {
            engineRef.current!.addHistory(lastGame.multiplier);

            // If we had a bet, process it
            if (lastBetDetails.current) {
              const won = lastGame.multiplier >= lastBetDetails.current.targetMultiplier;
              const payout = won ? lastBetDetails.current.amount * lastBetDetails.current.targetMultiplier : 0;

              engineRef.current!.calculateNextBet(stats.balance, {
                won,
                amount: lastBetDetails.current.amount,
                payout
              });

              setStats(prev => ({
                ...prev,
                profit: prev.profit + (payout - lastBetDetails.current.amount),
                wins: prev.wins + (won ? 1 : 0),
                losses: prev.losses + (won ? 0 : 1)
              }));

              addLog(`Result: ${won ? 'WIN (+' + (payout - lastBetDetails.current.amount).toFixed(2) + ')' : 'LOSS (-' + lastBetDetails.current.amount + ')'} | Crash: ${lastGame.multiplier}x`);
              lastBetDetails.current = null;
            } else {
              // Just update brain with history even if we didn't bet
              engineRef.current!.calculateNextBet(stats.balance);
            }
          }
        }

        // Place New Bet
        if (game.status === 'starting' && game.id !== lastGameId.current) {
           lastGameId.current = game.id;
           await updateBalance();

           const decision = engineRef.current!.calculateNextBet(stats.balance);

           if (decision.shouldSkip) {
             addLog(`Brain: Sitting out (Confidence: ${engineRef.current!.getState().confidence}%)`);
           } else {
             addLog(`Neural Strategy: Bet ${decision.amount} ${config.currency.toUpperCase()} @ ${decision.targetMultiplier}x`);
             try {
               await clientRef.current!.placeCrashBet(decision.amount, decision.targetMultiplier, config.currency);
               lastBetDetails.current = decision;
             } catch (e: any) {
               addLog(`Bet Failed: ${e.message}`);
             }
           }
        }
      }

    } catch (e: any) {
      addLog(`System Error: ${e.message}`);
    }

    timerRef.current = setTimeout(runLoop, 1500); // Tighter loop (1.5s)
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-2xl gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3 rounded-2xl">
              <Brain className="text-emerald-500" size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">Stake AI Crash Bot</h1>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  {isRunning ? 'Core Active' : 'Core Offline'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mr-2">
                <button
                  onClick={() => setIsAutonomous(true)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition ${isAutonomous ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}
                >
                  AUTONOMOUS
                </button>
                <button
                  onClick={() => setIsAutonomous(false)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition ${!isAutonomous ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}
                >
                  MANUAL
                </button>
             </div>

            {!isRunning ? (
              <button onClick={startBot} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/20 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1">
                <Play size={16} fill="currentColor" /> ACTIVATE BOT
              </button>
            ) : (
              <button onClick={stopBot} className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-500 px-8 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-rose-900/20 border-b-4 border-rose-800 active:border-b-0 active:translate-y-1">
                <Square size={16} fill="currentColor" /> TERMINATE
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* AI BRAIN STATUS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Brain size={80} />
               </div>
               <h2 className="text-slate-400 text-[10px] font-black uppercase mb-6 flex items-center gap-2 tracking-tighter">
                 <Brain size={12} className="text-emerald-500" /> Neural Analytics
               </h2>
               <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-2">
                      <span className="text-slate-500 uppercase">Analysis Confidence</span>
                      <span className="font-mono text-emerald-400">{botStatus?.confidence || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                       <div
                        className={`h-full transition-all duration-1000 ${botStatus?.confidence > 60 ? 'bg-emerald-500' : botStatus?.confidence > 30 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${botStatus?.confidence || 0}%` }}
                       ></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                     <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center group hover:border-emerald-500/30 transition">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Logic Mode</span>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{botStatus?.mode || 'Wait'}</span>
                     </div>
                     <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center group hover:border-emerald-500/30 transition">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Safe Play</span>
                        <div className={`p-1 rounded-full ${botStatus?.confidence > 50 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-600'}`}>
                          <ShieldCheck size={14} />
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
               <h2 className="text-slate-400 text-[10px] font-black uppercase mb-6 flex items-center gap-2 tracking-tighter">
                  <TrendingUp size={12} className="text-blue-500" /> Financials
               </h2>
               <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 group hover:border-blue-500/30 transition">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Total Balance</p>
                    <p className="text-xl font-mono font-black text-slate-100">{stats.balance.toLocaleString()} <span className="text-[10px] text-slate-500">{config.currency.toUpperCase()}</span></p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 group hover:border-emerald-500/30 transition">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Net Profit</p>
                    <p className={`text-xl font-mono font-black ${stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                       <p className="text-[8px] text-slate-500 font-bold uppercase">Wins</p>
                       <p className="text-xs font-black text-emerald-500">{stats.wins}</p>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                       <p className="text-[8px] text-slate-500 font-bold uppercase">Losses</p>
                       <p className="text-xs font-black text-rose-500">{stats.losses}</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          {/* CONFIG & ACTIVITY */}
          <div className="lg:col-span-3 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <h2 className="text-slate-400 text-[10px] font-black uppercase mb-6 flex items-center gap-2 tracking-tighter">
                    <Settings size={12} className="text-purple-500" /> Neural Control
                  </h2>
                  <div className="space-y-5">
                    <div className="relative group">
                      <label className="text-[9px] text-slate-500 font-black uppercase absolute left-3 -top-2 bg-[#0f172a] px-2 z-10">Access Token</label>
                      <input
                        type="password"
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        placeholder="Paste Stake token..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-xs focus:outline-none focus:border-emerald-500 transition shadow-inner"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="text-[9px] text-slate-500 font-black uppercase absolute left-3 -top-2 bg-[#0f172a] px-2 z-10">Base Stake</label>
                        <input
                          type="number"
                          value={config.initialBet}
                          disabled={isAutonomous}
                          onChange={(e) => setConfig({...config, initialBet: Number(e.target.value)})}
                          className={`w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-xs font-mono ${isAutonomous ? 'opacity-30 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="relative">
                        <label className="text-[9px] text-slate-500 font-black uppercase absolute left-3 -top-2 bg-[#0f172a] px-2 z-10">Exit Point</label>
                        <input
                          type="number"
                          step="0.1"
                          value={config.baseMultiplier}
                          disabled={isAutonomous}
                          onChange={(e) => setConfig({...config, baseMultiplier: Number(e.target.value)})}
                          className={`w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-xs font-mono ${isAutonomous ? 'opacity-30 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <h2 className="text-slate-400 text-[10px] font-black uppercase mb-6 flex items-center gap-2 tracking-tighter">
                    <AlertCircle size={12} className="text-rose-500" /> Fail-Safe Protocol
                  </h2>
                  <div className="space-y-5">
                    <div className="relative">
                      <label className="text-[9px] text-slate-500 font-black uppercase absolute left-3 -top-2 bg-[#0f172a] px-2 z-10">Ceiling Wager</label>
                      <input
                        type="number"
                        value={config.maxBet}
                        onChange={(e) => setConfig({...config, maxBet: Number(e.target.value)})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-xs font-mono"
                      />
                    </div>
                    <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                       <p className="text-[9px] text-rose-500 font-black uppercase mb-1 flex items-center gap-1">
                         <AlertCircle size={10} /> Dynamic Throttling
                       </p>
                       <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                         AI will enforce immediate cooling periods if the crash engine detects consecutive high-loss patterns in the global game pool.
                       </p>
                    </div>
                  </div>
                </div>
             </div>

             {/* ACTIVITY LOG */}
             <div className="bg-[#0f172a] rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                   <h2 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                     <History size={12} className="text-emerald-500" /> Command Interface
                   </h2>
                   <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Live Feed</span>
                   </div>
                </div>
                <div className="h-80 overflow-y-auto p-6 font-mono text-[10px] space-y-3 bg-slate-950/80 backdrop-blur-sm scrollbar-thin scrollbar-thumb-slate-800">
                  {logs.length === 0 && <p className="text-slate-700 italic tracking-tight uppercase font-black text-center py-20 opacity-20 text-lg">System Dormant</p>}
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 border-l border-slate-800/50 pl-4 py-0.5 group">
                      <span className="text-slate-600 shrink-0 font-bold">{log.split(': ')[0]}</span>
                      <span className={`
                        ${log.includes('WIN') ? 'text-emerald-400 font-black' :
                          log.includes('LOSS') ? 'text-rose-400 font-black' :
                          log.includes('Strategy') || log.includes('AI Decision') ? 'text-blue-400 font-bold' :
                          log.includes('Error') ? 'text-rose-500' : 'text-slate-400'}
                      `}>
                        {log.split(': ').slice(1).join(': ')}
                      </span>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

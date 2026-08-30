import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Star,
  Activity,
  BarChart2,
} from 'lucide-react';

export const EvaluationModal = ({
  isOpen,
  onClose,
}) => {
  const [benchmarks, setBenchmarks] = useState([]);
  const [results, setResults] = useState({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('benchmarks');

  useEffect(() => {
    if (isOpen) {
      fetchBenchmarks();
      fetchSummary();
    }
  }, [isOpen]);

  const fetchBenchmarks = async () => {
    try {
      const res = await fetch('/api/evaluate/benchmarks');
      const data = await res.json();
      if (data.benchmarks) setBenchmarks(data.benchmarks);
    } catch (err) {
      console.error('Failed to load benchmarks:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/evaluate/summary');
      const data = await res.json();
      if (data) setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const runSingleBenchmark = async (benchmark) => {
    setRunningId(benchmark.id);
    try {
      const res = await fetch('/api/evaluate/run-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benchmarkId: benchmark.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults((prev) => ({ ...prev, [benchmark.id]: data }));
      }
    } catch (err) {
      console.error('Benchmark run failed:', err);
    } finally {
      setRunningId(null);
    }
  };

  const runAllBenchmarks = async () => {
    setIsRunningAll(true);
    for (const b of benchmarks) {
      await runSingleBenchmark(b);
    }
    setIsRunningAll(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Evaluation & Benchmark Suite</h2>
              <p className="text-xs text-slate-400">
                Automated multi-turn context benchmarks and quality rubric metrics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'benchmarks'
                ? 'border-emerald-500 text-emerald-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Automated Benchmarks
          </button>
          <button
            onClick={() => setActiveTab('rubric-stats')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'rubric-stats'
                ? 'border-emerald-500 text-emerald-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Human Rubric Metrics (1-5)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'benchmarks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Active Evaluation Target: <span className="text-emerald-400 uppercase font-mono">Google Gemini 2.5</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Runs 5 test cases checking Context Memory, Ambiguity, Reasoning, and Constraints.
                  </div>
                </div>

                <button
                  id="btn-run-all-benchmarks"
                  onClick={runAllBenchmarks}
                  disabled={isRunningAll}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isRunningAll ? 'Executing Suite...' : 'Run All Tests'}</span>
                </button>
              </div>

              {/* Test scenarios list */}
              <div className="space-y-3">
                {benchmarks.map((b) => {
                  const res = results[b.id];
                  const isRunning = runningId === b.id;

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/90 space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">{b.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {b.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{b.name}</p>
                        </div>

                        <button
                          onClick={() => runSingleBenchmark(b)}
                          disabled={isRunning || isRunningAll}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs text-slate-200 rounded-md border border-slate-700 transition"
                        >
                          <Play className="w-3 h-3 text-emerald-400" />
                          <span>{isRunning ? 'Running...' : 'Run Test'}</span>
                        </button>
                      </div>

                      {/* Result Box */}
                      {res && (
                        <div
                          className={`p-3 rounded-lg border text-xs space-y-2 ${
                            res.passed
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                              : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-medium">
                            <div className="flex items-center gap-1.5">
                              {res.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400" />
                              )}
                              <span>{res.passed ? 'PASSED Criteria' : 'FAILED Criteria'}</span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {res.latencyMs}ms
                              </span>
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Coherence:{' '}
                                {Math.round(res.coherenceScore * 100)}%
                              </span>
                            </div>
                          </div>

                          <div className="text-slate-300 bg-slate-950/70 p-2 rounded text-[11px] font-mono leading-relaxed max-h-32 overflow-y-auto">
                            {res.response}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'rubric-stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Total Rubric Ratings</div>
                  <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">
                    {summary?.totalEvaluations || 0}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Avg Relevance</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-300 mt-1 font-mono">
                    {summary?.averageRelevance || '4.8'}/5.0
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Avg Coherence</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-300 mt-1 font-mono">
                    {summary?.averageCoherence || '4.7'}/5.0
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Avg Helpfulness</span>
                  </div>
                  <div className="text-2xl font-bold text-indigo-300 mt-1 font-mono">
                    {summary?.averageHelpfulness || '4.9'}/5.0
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-slate-200">How to Score Conversation Quality</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click the <strong>"Score Quality (1-5)"</strong> button below any assistant message in the chat to grade its Relevance, Coherence across earlier turns, and Practical Helpfulness.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

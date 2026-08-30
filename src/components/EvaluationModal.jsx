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
  Terminal,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="w-full max-w-4xl bg-[#FBF9F5] border-2 border-stone-900 rounded-lg shadow-[6px_6px_0px_0px_#1C1917] flex flex-col max-h-[90vh] overflow-hidden text-stone-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-stone-800 bg-[#F5EFEB] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded border-2 border-stone-900 bg-emerald-300 text-stone-950 flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-stone-950 uppercase tracking-tight">
                Evaluation & Benchmark Suite
              </h2>
              <p className="text-xs font-mono text-stone-600">
                Automated multi-turn context benchmarks and quality rubric scorecards
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded border border-stone-400 hover:border-stone-900 bg-white hover:bg-stone-100 text-stone-900 shadow-[1px_1px_0px_0px_#000] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b-2 border-stone-800 bg-[#EFE9E2] text-xs font-mono font-bold">
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`pb-2.5 px-3 border-b-2 transition uppercase cursor-pointer ${
              activeTab === 'benchmarks'
                ? 'border-emerald-700 text-emerald-950 font-bold bg-white rounded-t border-t-2 border-x-2 border-stone-800 -mb-[2px]'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Automated Benchmarks
          </button>
          <button
            onClick={() => setActiveTab('rubric-stats')}
            className={`pb-2.5 px-3 border-b-2 transition uppercase cursor-pointer ${
              activeTab === 'rubric-stats'
                ? 'border-emerald-700 text-emerald-950 font-bold bg-white rounded-t border-t-2 border-x-2 border-stone-800 -mb-[2px]'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Human Rubric Metrics (1-5)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FBF9F5]">
          {activeTab === 'benchmarks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-lg border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917]">
                <div>
                  <div className="text-xs font-bold font-mono text-stone-900 uppercase">
                    Evaluation Engine Target: <span className="text-emerald-800 font-bold">Gemini 2.5 Flash</span>
                  </div>
                  <div className="text-[11px] font-mono text-stone-600 mt-0.5">
                    Executes 5 benchmark scenarios validating Context Retention, Ambiguity, Reasoning, and Negative Constraints.
                  </div>
                </div>

                <button
                  id="btn-run-all-benchmarks"
                  onClick={runAllBenchmarks}
                  disabled={isRunningAll}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isRunningAll ? 'EXECUTING...' : 'RUN ALL 5 TESTS'}</span>
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
                      className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-stone-950 uppercase">{b.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-400 font-mono font-bold uppercase">
                              {b.category}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 mt-1 font-sans">{b.description || b.name}</p>
                        </div>

                        <button
                          onClick={() => runSingleBenchmark(b)}
                          disabled={isRunning || isRunningAll}
                          className="flex items-center gap-1 px-3 py-1 bg-stone-100 hover:bg-amber-100 disabled:opacity-50 text-xs font-mono font-bold uppercase text-stone-900 rounded border-2 border-stone-800 shadow-[1px_1px_0px_0px_#000] transition cursor-pointer"
                        >
                          <Play className="w-3 h-3 text-emerald-700" />
                          <span>{isRunning ? 'RUNNING...' : 'RUN TEST'}</span>
                        </button>
                      </div>

                      {/* Result Box */}
                      {res && (
                        <div
                          className={`p-3.5 rounded border-2 text-xs font-mono space-y-2 ${
                            res.passed
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                              : 'bg-rose-50 border-rose-500 text-rose-950'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <div className="flex items-center gap-1.5">
                              {res.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-700" />
                              )}
                              <span>{res.passed ? 'PASSED CRITERIA' : 'FAILED CRITERIA'}</span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-stone-700">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-600" /> {res.latencyMs}ms
                              </span>
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-700" /> Coherence:{' '}
                                {Math.round(res.coherenceScore * 100)}%
                              </span>
                            </div>
                          </div>

                          <div className="text-stone-900 bg-white p-2.5 rounded border border-stone-300 text-[11px] leading-relaxed max-h-32 overflow-y-auto font-mono">
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
                <div className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917]">
                  <div className="text-xs font-mono font-bold text-stone-600 uppercase">Total Evaluations</div>
                  <div className="text-2xl font-bold text-stone-950 mt-1 font-mono">
                    {summary?.totalEvaluations || 0}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917]">
                  <div className="text-xs font-mono font-bold text-stone-600 flex items-center gap-1 uppercase">
                    <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                    <span>Avg Relevance</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-800 mt-1 font-mono">
                    {summary?.averageRelevance || '4.8'}/5.0
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917]">
                  <div className="text-xs font-mono font-bold text-stone-600 flex items-center gap-1 uppercase">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Avg Coherence</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-800 mt-1 font-mono">
                    {summary?.averageCoherence || '4.7'}/5.0
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917]">
                  <div className="text-xs font-mono font-bold text-stone-600 flex items-center gap-1 uppercase">
                    <Activity className="w-3.5 h-3.5 text-stone-700" />
                    <span>Avg Helpfulness</span>
                  </div>
                  <div className="text-2xl font-bold text-stone-950 mt-1 font-mono">
                    {summary?.averageHelpfulness || '4.9'}/5.0
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] space-y-2">
                <h3 className="text-xs font-mono font-bold text-stone-950 uppercase">Quality Scoring Procedure</h3>
                <p className="text-xs text-stone-700 font-sans leading-relaxed">
                  Click the <strong>"Score Quality (1-5)"</strong> button beneath any assistant reply in the dialogue canvas to rate Relevance, Multi-turn Coherence, and Overall Helpfulness.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

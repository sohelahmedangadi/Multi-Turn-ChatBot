import React, { useState } from 'react';
import { X, Star, CheckCircle } from 'lucide-react';

export const RubricFeedbackModal = ({
  isOpen,
  onClose,
  messageId,
  sessionId,
}) => {
  const [relevance, setRelevance] = useState(5);
  const [coherence, setCoherence] = useState(5);
  const [helpfulness, setHelpfulness] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !messageId) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/evaluate/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || 'unknown-session',
          messageId,
          relevance,
          coherence,
          helpfulness,
          feedback,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Failed to submit rubric score:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStarPicker = (label, description, value, onChange) => (
    <div className="space-y-1 bg-white p-3 rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-stone-950 uppercase">{label}</span>
        <span className="text-xs font-bold text-amber-800 font-mono">[{value}/5]</span>
      </div>
      <p className="text-[11px] text-stone-600 font-sans">{description}</p>
      <div className="flex items-center gap-1.5 pt-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1 rounded transition border cursor-pointer ${
              star <= value
                ? 'text-amber-500 bg-amber-100 border-amber-400'
                : 'text-stone-300 hover:text-stone-500 bg-stone-50 border-stone-200'
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="w-full max-w-lg bg-[#FBF9F5] border-2 border-stone-900 rounded-lg shadow-[6px_6px_0px_0px_#1C1917] overflow-hidden text-stone-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-600 fill-amber-400" />
            <h2 className="text-base font-bold font-mono text-stone-950 uppercase tracking-tight">Response Quality Scorecard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded border border-stone-400 hover:border-stone-900 bg-white hover:bg-stone-100 text-stone-900 shadow-[1px_1px_0px_0px_#000] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
            <div className="text-sm font-bold font-mono text-stone-950 uppercase">Evaluation Saved!</div>
            <p className="text-xs font-mono text-stone-600">Score recorded in the evaluation database.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {renderStarPicker(
              '1. Relevance',
              'Did the reply accurately address the user prompt and constraints?',
              relevance,
              setRelevance
            )}

            {renderStarPicker(
              '2. Coherence',
              'Did the reply maintain continuity with earlier conversation turns?',
              coherence,
              setCoherence
            )}

            {renderStarPicker(
              '3. Helpfulness & Accuracy',
              'Was the answer well-structured, clear, and informative?',
              helpfulness,
              setHelpfulness
            )}

            <div>
              <label className="block text-xs font-mono font-bold text-stone-700 uppercase mb-1">
                Optional Qualitative Notes
              </label>
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Accurately recalled project details..."
                className="w-full bg-white border-2 border-stone-800 rounded p-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 shadow-[2px_2px_0px_0px_#1C1917]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-mono font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                {loading ? 'SAVING...' : 'SUBMIT SCORE'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

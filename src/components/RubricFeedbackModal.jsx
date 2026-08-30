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
    <div className="space-y-1 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <span className="text-xs font-bold text-amber-400 font-mono">{value}/5</span>
      </div>
      <p className="text-[11px] text-slate-400">{description}</p>
      <div className="flex items-center gap-2 pt-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1.5 rounded-md transition ${
              star <= value
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-slate-600 hover:text-slate-400 bg-slate-900'
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-current" />
            <h2 className="text-sm font-semibold text-slate-100">Response Evaluation Rubric</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-sm font-semibold text-slate-200">Evaluation Saved!</div>
            <p className="text-xs text-slate-400">Score added to the evaluation metrics database.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {renderStarPicker(
              '1. Relevance',
              'Did the response directly address the user prompt and requested constraints?',
              relevance,
              setRelevance
            )}

            {renderStarPicker(
              '2. Coherence',
              'Did the response maintain continuity and avoid contradicting earlier turns?',
              coherence,
              setCoherence
            )}

            {renderStarPicker(
              '3. Helpfulness & Accuracy',
              'Was the answer clear, structured, and informative?',
              helpfulness,
              setHelpfulness
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Optional Qualitative Feedback
              </label>
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Remembered all user constraints and provided good code..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs transition shadow-sm"
              >
                {loading ? 'Saving...' : 'Submit 1-5 Score'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

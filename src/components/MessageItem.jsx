import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Bot,
  Copy,
  Check,
  Zap,
  HelpCircle,
  Clock,
  ShieldCheck,
  Star,
  Brain,
} from 'lucide-react';

function formatMarkdownContent(text) {
  if (!text) return '';
  // 1. Remove <think>...</think> reasoning blocks if present
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();

  // 2. Normalize and separate squished markdown table rows into proper newlines
  cleaned = cleaned.replace(/\|\s*\|\s*([^\n|])/g, '|\n| $1');
  cleaned = cleaned.replace(/\|\s*\|/g, '|\n|');

  return cleaned || text;
}

/**
 * Fenced Code Block Component with ChatGPT-Style Header & Copy Button
 */
const CodeBlock = ({ className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'code';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopyCode = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = codeString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code to clipboard:', err);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
        <span className="font-mono text-[11px] lowercase text-slate-400 font-medium">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition text-[11px]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-3.5 overflow-x-auto font-mono text-xs text-slate-200 leading-relaxed bg-slate-950/60">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
};

export const MessageItem = ({ message, onOpenRubric }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = message.content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message to clipboard:', err);
    }
  };

  const metadata = message.metadata;

  return (
    <div
      id={`message-bubble-${message.id}`}
      className={`group flex gap-3.5 py-4 px-4 rounded-xl transition-colors ${
        isUser
          ? 'bg-slate-800/40 border border-slate-700/30'
          : 'bg-slate-900/90 border border-slate-800'
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shadow-sm">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${
              metadata?.provider === 'heuristic'
                ? 'bg-amber-600/80 border border-amber-500/50'
                : metadata?.provider === 'groq'
                ? 'bg-orange-600 border border-orange-500/50 shadow-orange-950/40'
                : 'bg-indigo-600 border border-indigo-500/40'
            }`}
          >
            {metadata?.provider === 'heuristic' ? (
              <HelpCircle className="w-4 h-4" />
            ) : metadata?.provider === 'groq' ? (
              <Zap className="w-4 h-4 text-amber-100" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      {/* Message Content & Metadata */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header line */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-200">
              {isUser
                ? 'You'
                : metadata?.provider === 'heuristic'
                ? 'Ambiguity Guard'
                : metadata?.provider === 'groq'
                ? 'AI Assistant'
                : 'AI Assistant'}
            </span>

            {/* Provider and model badge */}
            {isAssistant && metadata?.provider && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wider uppercase ${
                  metadata.provider === 'heuristic'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : metadata.provider === 'groq'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-xs'
                    : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {metadata.provider === 'groq' && <Zap className="w-2.5 h-2.5 text-amber-300" />}
                <span>{metadata.provider === 'groq' ? `Groq · ${metadata.model || 'LLaMA'}` : metadata.model || metadata.provider}</span>
              </span>
            )}

            {/* Long-Term Memory Retrieval Badge */}
            {isAssistant && metadata?.retrievedMemoriesCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-200 border border-purple-500/40 font-medium">
                <Brain className="w-3 h-3 text-purple-300" />
                <span>Memory Retrieved ({metadata.retrievedMemoriesCount})</span>
              </span>
            )}

            {/* Ambiguity Flag */}
            {metadata?.ambiguityFlag && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-200 border border-amber-500/40 font-medium">
                <HelpCircle className="w-3 h-3 text-amber-300" />
                <span>Clarification Heuristic Triggered</span>
              </span>
            )}
          </div>

          {/* Time & actions */}
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[10px] font-mono">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            <button
              id={`btn-copy-${message.id}`}
              onClick={handleCopy}
              title="Copy message"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition opacity-0 group-hover:opacity-100"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="text-sm text-slate-100 leading-relaxed break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown-content">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    if (inline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 font-mono text-xs text-indigo-300"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <CodeBlock className={className} {...props}>
                        {children}
                      </CodeBlock>
                    );
                  },
                }}
              >
                {formatMarkdownContent(message.content)}
              </Markdown>
            </div>
          )}
        </div>

        {/* Assistant Metrics Bar (Latency, Coherence, Tokens, Rubric Score) */}
        {isAssistant && (
          <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 border-t border-slate-800/80 mt-2">
            {metadata?.latencyMs !== undefined && (
              <div className="flex items-center gap-1 font-mono text-slate-300">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{metadata.latencyMs}ms</span>
              </div>
            )}

            {metadata?.tokensEstimated !== undefined && (
              <div className="flex items-center gap-1 font-mono text-slate-300">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>~{metadata.tokensEstimated} tokens</span>
              </div>
            )}

            {metadata?.coherenceScore !== undefined && (
              <div className="flex items-center gap-1 text-slate-300">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Coherence: {Math.round(metadata.coherenceScore * 100)}%</span>
              </div>
            )}

            {/* Rubric Evaluation Button */}
            <button
              id={`btn-rate-message-${message.id}`}
              onClick={() => onOpenRubric(message.id)}
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 transition"
            >
              <Star className="w-3 h-3 text-amber-400" />
              <span>Score Quality (1-5)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

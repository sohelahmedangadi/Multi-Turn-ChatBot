import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Bot,
  Zap,
  HelpCircle,
  Clock,
  ShieldCheck,
  Star,
  Brain,
} from 'lucide-react';
import { CopyButton, stripMarkdown } from './CopyButton';

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

export const MessageItem = ({ message, onOpenRubric }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const metadata = message.metadata;

  // For message bubble copy: plain text stripped of markdown
  const plainTextToCopy = isUser ? message.content : stripMarkdown(message.content);

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

          {/* Time & Bubble Copy Action */}
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[10px] font-mono">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Full Message Copy Button */}
            <CopyButton
              text={plainTextToCopy}
              title="Copy entire message (plain text)"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
              iconClassName="w-3.5 h-3.5"
            />
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
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');

                    // Block code renderer
                    if (!inline && (match || codeString.includes('\n'))) {
                      const language = match ? match[1] : '';

                      return (
                        <div className="relative group/code my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950/90 shadow-sm">
                          {/* Code header with Language Tag & Copy Button */}
                          <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                            <span className="text-slate-400 font-medium">{language || 'code'}</span>
                            <CopyButton
                              text={codeString}
                              showLabel={true}
                              label="Copy"
                              copiedLabel="Copied!"
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[10px] opacity-70 group-hover/code:opacity-100 transition-all"
                              iconClassName="w-3 h-3"
                            />
                          </div>

                          {/* Code Content */}
                          <pre className="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed m-0">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    }

                    // Inline code renderer
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded bg-slate-800/80 text-amber-300 font-mono text-xs border border-slate-700/40"
                        {...props}
                      >
                        {children}
                      </code>
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

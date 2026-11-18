import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Terminal } from 'lucide-react';
import { CopyButton } from './CopyButton';
import {
  strictMarkdownSanitizeSchema,
  isSafeUrl,
  sanitizeText,
  sanitizeFilename,
  safeLinkComponent,
} from '../utils/markdownSanitizer.js';

export {
  strictMarkdownSanitizeSchema,
  isSafeUrl,
  sanitizeText,
  sanitizeFilename,
};

/**
 * Sanitized Markdown Component.
 * - Renders markdown using react-markdown + rehype-sanitize with strict schema.
 * - Raw HTML is completely disabled (no rehype-raw).
 * - Links allow strictly http, https, and mailto protocols.
 * - All valid links include rel="noopener noreferrer" and target="_blank".
 * - Blocks javascript:, data:, and vbscript: URLs, rendering a non-clickable safe placeholder.
 */
export const SanitizedMarkdown = ({ content, className = '' }) => {
  return (
    <div className={`markdown-content ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, strictMarkdownSanitizeSchema]]}
        components={{
          a: safeLinkComponent,
          code({ node, inline, className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const codeString = String(children).replace(/\n$/, '');

            // Block Code Renderer
            if (!inline && (match || codeString.includes('\n'))) {
              const language = match ? match[1] : '';

              return (
                <div className="relative group/code my-3.5 rounded-lg overflow-hidden border-2 border-stone-900 bg-stone-950 shadow-[3px_3px_0px_0px_#1C1917]">
                  {/* Code Header Bar with Language Label & Copy Stamp Button */}
                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-stone-900 border-b-2 border-stone-800 text-[11px] font-mono text-stone-300">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-amber-300 uppercase tracking-wider">{language || 'CODE'}</span>
                    </div>
                    <CopyButton
                      text={codeString}
                      showLabel={true}
                      label="COPY"
                      copiedLabel="COPIED!"
                      className="px-2.5 py-0.5 rounded border border-stone-700 hover:border-amber-400 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-200 text-[10px] font-mono uppercase transition-all shadow-[1px_1px_0px_0px_#000]"
                      iconClassName="w-3 h-3"
                    />
                  </div>

                  {/* Code Content */}
                  <pre className="p-3.5 overflow-x-auto text-xs font-mono text-stone-100 leading-relaxed m-0 bg-stone-950">
                    <code className={codeClassName} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            // Inline Code Renderer
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-bold border border-amber-300"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

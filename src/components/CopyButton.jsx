import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Strips markdown syntax to return clean plain text
 */
export function stripMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';
  return markdown
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '');
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .trim();
}

/**
 * Reusable CopyButton component with Clipboard API & execCommand fallback
 */
export const CopyButton = ({
  text,
  className = '',
  iconClassName = 'w-3.5 h-3.5',
  label = '',
  copiedLabel = 'Copied!',
  showLabel = false,
  title = 'Copy to clipboard',
  copiedTimeout = 1500,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (!text) return;

    let success = false;

    // 1. Primary: Clipboard API (supported on HTTPS / localhost)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('[CopyButton] Clipboard API failed, attempting execCommand fallback:', err);
      }
    }

    // 2. Fallback: Hidden textarea + document.execCommand('copy')
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (fallbackErr) {
        console.error('[CopyButton] Copy fallback failed:', fallbackErr);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), copiedTimeout);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? copiedLabel : title}
      aria-label={copied ? copiedLabel : title}
      className={`inline-flex items-center gap-1.5 transition-all duration-150 focus:outline-none cursor-pointer select-none ${className}`}
    >
      {copied ? (
        <>
          <Check className={`${iconClassName} text-emerald-400`} />
          {showLabel && <span className="text-emerald-400 font-medium">{copiedLabel}</span>}
        </>
      ) : (
        <>
          <Copy className={`${iconClassName}`} />
          {showLabel && label && <span>{label}</span>}
        </>
      )}
    </button>
  );
};

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Strict schema for rehype-sanitize.
 * Disables raw HTML tags like <script>, <iframe>, <style>, <embed>, <object>, <img>.
 * Disables all event handlers (onerror, onload, onclick, onmouseover, etc.).
 * Strictly limits href protocols to http, https, and mailto.
 */
export const strictMarkdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'p',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'strong',
    'em',
    'del',
    'hr',
    'a',
    'br',
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title', 'target', 'rel'],
    code: ['className'],
    th: ['align'],
    td: ['align'],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
  },
};

/**
 * Validates that an href is strictly http, https, or mailto.
 * Explicitly blocks javascript:, data:, vbscript:, and all obfuscated/encoded variants.
 * Handles mixed case, whitespace/tabs/newlines, entity encoding, URI percent-encoding, and control characters.
 */
export function isSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;

  let url = rawUrl.trim();
  if (!url) return false;

  // 1. Strip ASCII/Unicode control characters, null bytes, and zero-width spaces
  url = url.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');

  // 2. Decode HTML entities repeatedly to uncover obfuscated protocols (e.g. &#106;avascript or &colon;)
  let decoded = url;
  for (let i = 0; i < 3; i++) {
    try {
      decoded = decoded
        .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&colon;?/gi, ':')
        .replace(/&tab;?/gi, '')
        .replace(/&newline;?/gi, '');
    } catch {
      break;
    }
  }

  // 3. Repeatedly decode URI components to expose percent-encoded schemes (e.g. %6a%61%76%61%73%63%72%69%70%74%3a)
  for (let i = 0; i < 3; i++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      break;
    }
  }

  // 4. Strip internal whitespace that browsers ignore before/within scheme (e.g. "j a v a s c r i p t :")
  const cleanProtocolTest = decoded.replace(/[\s\t\r\n]/g, '').toLowerCase();

  // 5. Explicitly reject dangerous schemes
  if (
    cleanProtocolTest.startsWith('javascript:') ||
    cleanProtocolTest.startsWith('data:') ||
    cleanProtocolTest.startsWith('vbscript:') ||
    cleanProtocolTest.startsWith('file:') ||
    cleanProtocolTest.startsWith('blob:')
  ) {
    return false;
  }

  // 6. Whitelist strictly http:, https:, and mailto:
  const isHttp = /^https?:\/\//i.test(decoded.trim());
  const isMailto = /^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(decoded.trim());

  return isHttp || isMailto;
}

/**
 * Strips HTML brackets, quotes, null bytes, and control characters from text strings.
 */
export function sanitizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[<>'"\0]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

/**
 * Sanitizes filename strings before rendering.
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'attachment';
  return filename
    .replace(/[<>:"/\\|?*\0]/g, '_')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .substring(0, 150) || 'attachment';
}

/**
 * Safe link component factory
 */
export const safeLinkComponent = ({ node, href, children, ...props }) => {
  if (!isSafeUrl(href)) {
    return React.createElement(
      'span',
      {
        className: 'text-stone-500 font-mono text-xs line-through cursor-not-allowed bg-stone-100 px-1 py-0.5 rounded border border-stone-200',
        title: 'Blocked unsafe link',
      },
      children
    );
  }
  return React.createElement(
    'a',
    {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'text-amber-800 hover:text-amber-950 underline underline-offset-2 font-medium transition-colors',
      ...props,
    },
    children
  );
};

/**
 * Renders sanitized markdown using React.createElement
 */
export function createSanitizedMarkdownElement(content) {
  return React.createElement(
    Markdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypeSanitize, strictMarkdownSanitizeSchema]],
      components: {
        a: safeLinkComponent,
      },
    },
    content
  );
}

/**
 * Helper to render sanitized markdown directly to an HTML string for verification and testing
 */
export function renderMarkdownToHtmlString(content) {
  return ReactDOMServer.renderToString(createSanitizedMarkdownElement(content));
}

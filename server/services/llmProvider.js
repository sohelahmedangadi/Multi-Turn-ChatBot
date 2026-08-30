import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

// Global cached client instances with lazy init
let geminiClient = null;
let cachedGeminiKey = null;
let groqClient = null;
let cachedGroqKey = null;

export function getActiveProviderName() {
  return 'gemini';
}

export function getGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  if (!geminiClient || cachedGeminiKey !== apiKey) {
    cachedGeminiKey = apiKey;
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export function getGroqClient() {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in environment.');
  }
  if (!groqClient || cachedGroqKey !== apiKey) {
    cachedGroqKey = apiKey;
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Supported Gemini models in primary order
 */
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-pro-preview',
];

/**
 * Active fallback models on Groq
 */
const GROQ_FALLBACK_MODELS = [
  'qwen/qwen3.8-27b',
  'groq/compound',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound-mini',
  'qwen/qwen3.6-27b',
  'allam-2-7b',
];

/**
 * Circuit Breaker State for Gemini
 */
let geminiCircuitOpenUntil = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000; // 60s cooldown on 429 quota exhaustion
const PER_CALL_TIMEOUT_MS = 8000; // 8s max per individual model call

/**
 * Hard per-call timeout helper
 */
function withTimeout(promise, timeoutMs = PER_CALL_TIMEOUT_MS, errorLabel = 'LLM API Call') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${errorLabel} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
    }),
  ]);
}

export function isGeminiCircuitOpen() {
  return Date.now() < geminiCircuitOpenUntil;
}

export function tripGeminiCircuitBreaker() {
  geminiCircuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  console.warn(`[Gemini Circuit Breaker] 429 quota error encountered. Opening circuit breaker for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`);
}

/**
 * Universal Non-Streaming Response Generator
 * Attempts Gemini first, automatically fails over to Groq with fallback tagging if quota/rate limited.
 */
export async function generateResponse(
  history,
  message,
  systemPrompt = 'You are a helpful, precise multi-turn conversational AI assistant.',
  options = {}
) {
  const startTime = Date.now();

  // 1. Try Gemini (if circuit is closed)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    if (isGeminiCircuitOpen()) {
      const remainingSec = Math.ceil((geminiCircuitOpenUntil - Date.now()) / 1000);
      console.warn(`[Gemini Circuit Breaker] Circuit is OPEN (cooling down for ${remainingSec}s). Fast-routing directly to Groq fallback.`);
    } else {
      try {
        const ai = getGeminiClient();
        const candidateModels = options?.model
          ? [options.model, ...GEMINI_MODELS.filter((m) => m !== options.model)]
          : GEMINI_MODELS;

        const contents = [
          ...history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ];

        for (const model of candidateModels) {
          try {
            const response = await withTimeout(
              ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction: systemPrompt,
                  temperature: 0.7,
                },
              }),
              PER_CALL_TIMEOUT_MS,
              `Gemini (${model})`
            );

            const text = response.text || '';
            const latencyMs = Date.now() - startTime;
            const tokensEstimated = Math.ceil((text.length + message.length) / 4);

            return {
              text,
              provider: 'gemini',
              model,
              latencyMs,
              tokensEstimated,
              isFallback: false,
            };
          } catch (err) {
            const errMsg = err?.message || String(err);
            const isQuota =
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('GenerateRequestsPerDay') ||
              errMsg.includes('429') ||
              errMsg.includes('quota');

            if (isQuota) {
              tripGeminiCircuitBreaker();
              break; // Fail over immediately to Groq without trying other Gemini models
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[Gemini] Generation failed, initiating Groq fallback:', geminiErr?.message || geminiErr);
      }
    }
  }

  // 2. Automatic Failover to Groq
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    try {
      const groq = getGroqClient();
      const safeSystemPrompt =
        typeof systemPrompt === 'string' && systemPrompt.trim()
          ? systemPrompt.trim()
          : 'You are a helpful, precise multi-turn conversational AI assistant.';

      const messages = [
        { role: 'system', content: safeSystemPrompt },
        ...(Array.isArray(history) ? history : [])
          .filter((m) => m && m.content && typeof m.content === 'string' && m.content.trim())
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.trim(),
          })),
        { role: 'user', content: String(message || '').trim() || 'Hello' },
      ];

      for (const model of GROQ_FALLBACK_MODELS) {
        try {
          const completion = await withTimeout(
            groq.chat.completions.create({
              model,
              messages,
              temperature: 0.7,
              max_tokens: 1024,
            }),
            PER_CALL_TIMEOUT_MS,
            `Groq (${model})`
          );

          const text = completion.choices[0]?.message?.content || '';
          const latencyMs = Date.now() - startTime;
          const tokensEstimated =
            completion.usage?.total_tokens || Math.ceil((text.length + message.length) / 4);

          return {
            text,
            provider: 'groq',
            model,
            latencyMs,
            tokensEstimated,
            isFallback: true,
          };
        } catch (groqModelErr) {
          console.warn(`[Groq Fallback] Model ${model} failed (${groqModelErr?.message}), trying next candidate...`);
        }
      }
    } catch (groqErr) {
      console.error('[Groq Fallback] Error executing fallback:', groqErr?.message || groqErr);
    }
  }

  throw new Error('LLM Generation Error: Both Gemini and fallback services are currently unavailable. Please check your API keys in .env.');
}

/**
 * Universal Streaming Response Generator
 * Streams from Gemini, and automatically falls back to Groq if Gemini is quota limited.
 */
export async function generateStreamResponse(
  history,
  message,
  systemPrompt = 'You are a helpful, precise multi-turn conversational AI assistant.',
  onChunk,
  options = {}
) {
  const startTime = Date.now();

  // 1. Try Gemini Streaming (if circuit is closed)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    if (isGeminiCircuitOpen()) {
      const remainingSec = Math.ceil((geminiCircuitOpenUntil - Date.now()) / 1000);
      console.warn(`[Gemini Stream Circuit Breaker] Circuit is OPEN (cooling down for ${remainingSec}s). Fast-routing directly to Groq stream fallback.`);
    } else {
      try {
        const ai = getGeminiClient();
        const candidateModels = options?.model
          ? [options.model, ...GEMINI_MODELS.filter((m) => m !== options.model)]
          : GEMINI_MODELS;

        const contents = [
          ...history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ];

        for (const model of candidateModels) {
          try {
            const responseStream = await withTimeout(
              ai.models.generateContentStream({
                model,
                contents,
                config: {
                  systemInstruction: systemPrompt,
                  temperature: 0.7,
                },
              }),
              PER_CALL_TIMEOUT_MS,
              `Gemini Stream (${model})`
            );

            let fullText = '';
            for await (const chunk of responseStream) {
              const chunkText = chunk.text || '';
              if (chunkText) {
                fullText += chunkText;
                onChunk(chunkText);
              }
            }

            const latencyMs = Date.now() - startTime;
            const tokensEstimated = Math.ceil((fullText.length + message.length) / 4);

            return {
              text: fullText,
              provider: 'gemini',
              model,
              latencyMs,
              tokensEstimated,
              isFallback: false,
            };
          } catch (err) {
            const errMsg = err?.message || String(err);
            const isQuota =
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('GenerateRequestsPerDay') ||
              errMsg.includes('429') ||
              errMsg.includes('quota');

            if (isQuota) {
              tripGeminiCircuitBreaker();
              break; // Fail over immediately to Groq stream
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[Gemini Stream] Stream failed, initiating Groq fallback:', geminiErr?.message || geminiErr);
      }
    }
  }

  // 2. Automatic Stream Failover to Groq
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    try {
      const groq = getGroqClient();
      const safeSystemPrompt =
        typeof systemPrompt === 'string' && systemPrompt.trim()
          ? systemPrompt.trim()
          : 'You are a helpful, precise multi-turn conversational AI assistant.';

      const messages = [
        { role: 'system', content: safeSystemPrompt },
        ...(Array.isArray(history) ? history : [])
          .filter((m) => m && m.content && typeof m.content === 'string' && m.content.trim())
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.trim(),
          })),
        { role: 'user', content: String(message || '').trim() || 'Hello' },
      ];

      for (const model of GROQ_FALLBACK_MODELS) {
        try {
          const stream = await withTimeout(
            groq.chat.completions.create({
              model,
              messages,
              temperature: 0.7,
              max_tokens: 1024,
              stream: true,
            }),
            PER_CALL_TIMEOUT_MS,
            `Groq Stream (${model})`
          );

          let fullText = '';
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(delta);
            }
          }

          const latencyMs = Date.now() - startTime;
          const tokensEstimated = Math.ceil((fullText.length + message.length) / 4);

          return {
            text: fullText,
            provider: 'groq',
            model,
            latencyMs,
            tokensEstimated,
            isFallback: true,
          };
        } catch (groqModelErr) {
          console.warn(`[Groq Stream Fallback] Model ${model} failed (${groqModelErr?.message}), trying next candidate...`);
        }
      }
    } catch (groqStreamErr) {
      console.error('[Groq Stream Fallback] Error in fallback stream:', groqStreamErr?.message || groqStreamErr);
    }
  }

  throw new Error('LLM Streaming Error: Both Gemini and fallback services are currently unavailable. Please check your API keys in .env.');
}

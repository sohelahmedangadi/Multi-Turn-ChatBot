#!/usr/bin/env node
/**
 * scripts/check-models.js
 * 
 * Verifies live model availability against configured GEMINI_API_KEY and GROQ_API_KEY.
 * Audits EVERY configured model ID in CosmoAI:
 * 1. The full Gemini fallback chain (gemini-2.5-flash, gemini-flash-latest, gemini-3.7-flash, gemini-2.5-flash-lite, gemini-3.1-pro-preview)
 * 2. Configured embedding model (gemini-embedding-001)
 * 3. The full Groq fallback chain (qwen/qwen3.8-27b, openai/gpt-oss-120b, openai/gpt-oss-20b, allam-2-7b)
 * 4. Legacy / Deprecation audit targets (compound, groq/compound, groq/compound-mini, qwen3.6-27b, text-embedding-004)
 * 
 * Fails with a clear table of missing IDs if any configured active/fallback model is missing.
 * Saves formatted audit report to docs/model-audit-<date>.txt.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

// Catalog of all models referenced across the CosmoAI codebase and documentation
export const CODEBASE_REFERENCED_MODELS = [
  // 1. Gemini Primary & Full Fallback Chain
  {
    provider: 'gemini',
    id: 'gemini-2.5-flash',
    role: 'Primary Chat Model (Default)',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js, ARCHITECTURE.md, README.md',
  },
  {
    provider: 'gemini',
    id: 'gemini-flash-latest',
    role: 'Gemini Fallback #1',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'gemini',
    id: 'gemini-3.7-flash',
    role: 'Gemini Fallback #2',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'gemini',
    id: 'gemini-2.5-flash-lite',
    role: 'Gemini Fallback #3',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'gemini',
    id: 'gemini-3.1-pro-preview',
    role: 'Gemini Fallback #4',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'gemini',
    id: 'gemini-embedding-001',
    role: 'Configured Embedding Model',
    isConfigured: true,
    source: 'server/config/models.js, server/services/chromaService.js',
  },
  {
    provider: 'gemini',
    id: 'gemini-embedding-2',
    role: 'Next-Gen Embedding Alternative',
    isConfigured: false,
    source: 'server/config/models.js',
  },
  {
    provider: 'gemini',
    id: 'text-embedding-004',
    role: 'Legacy Embedding Model (Deprecated)',
    isConfigured: false,
    isDeprecatedTarget: true,
    source: 'server/services/chromaService.js (Legacy)',
  },

  // 2. Groq Primary & Full Fallback Chain
  {
    provider: 'groq',
    id: 'qwen/qwen3.8-27b',
    role: 'Groq Primary / Fact Extraction',
    isConfigured: true,
    source: 'server/config/models.js, server/services/langchainMemory.js, server/services/llmProvider.js, ARCHITECTURE.md',
  },
  {
    provider: 'groq',
    id: 'openai/gpt-oss-120b',
    role: 'Groq Fallback #1',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'groq',
    id: 'openai/gpt-oss-20b',
    role: 'Groq Fallback #2',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'groq',
    id: 'allam-2-7b',
    role: 'Groq Fallback #3',
    isConfigured: true,
    source: 'server/config/models.js, server/services/llmProvider.js',
  },
  {
    provider: 'groq',
    id: 'qwen3.8-27b',
    role: 'Groq Model Alias in README',
    isConfigured: false,
    source: 'README.md',
  },

  // 3. Known Deprecated / Legacy IDs (Verified Absent)
  {
    provider: 'groq',
    id: 'compound',
    role: 'Groq Deprecated Target in README',
    isConfigured: false,
    isDeprecatedTarget: true,
    source: 'README.md (Legacy citation)',
  },
  {
    provider: 'groq',
    id: 'groq/compound',
    role: 'Legacy Groq Fallback ID',
    isConfigured: false,
    isDeprecatedTarget: true,
    source: 'server/services/llmProvider.js (Legacy)',
  },
  {
    provider: 'groq',
    id: 'groq/compound-mini',
    role: 'Legacy Groq Fallback ID',
    isConfigured: false,
    isDeprecatedTarget: true,
    source: 'server/services/llmProvider.js (Legacy)',
  },
  {
    provider: 'groq',
    id: 'qwen/qwen3.6-27b',
    role: 'Legacy Groq Fallback ID',
    isConfigured: false,
    isDeprecatedTarget: true,
    source: 'server/services/llmProvider.js (Legacy)',
  },
];

export async function checkModels({
  verbose = true,
  strict = false,
  saveToFile = true,
  outDir = path.join(rootDir, 'docs'),
  geminiApiKey: propGeminiKey,
  groqApiKey: propGroqKey,
} = {}) {
  let geminiApiKey = (propGeminiKey || process.env.GEMINI_API_KEY || '').trim();
  let groqApiKey = (propGroqKey || process.env.GROQ_API_KEY || '').trim();

  // If environment was cleared by test runner (e.g. process.env.NODE_ENV === 'test'), read directly from .env file
  if (!geminiApiKey || !groqApiKey) {
    try {
      if (fs.existsSync(envPath)) {
        const parsed = dotenv.parse(fs.readFileSync(envPath));
        if (!geminiApiKey && parsed.GEMINI_API_KEY) geminiApiKey = parsed.GEMINI_API_KEY.trim();
        if (!groqApiKey && parsed.GROQ_API_KEY) groqApiKey = parsed.GROQ_API_KEY.trim();
      }
    } catch {
      // non-blocking
    }
  }

  const isStrict =
    strict ||
    process.env.STRICT_MODEL_AUDIT === 'true' ||
    process.env.MODEL_AUDIT_STRICT === 'true' ||
    process.argv.includes('--strict');

  if (verbose) {
    console.log('======================================================================');
    console.log('🔍 CosmoAI LLM Model Compatibility & Live Catalog Audit');
    console.log(`🔒 Mode: ${isStrict ? 'STRICT (Fails if any configured fallback model is missing)' : 'Standard'}`);
    console.log('======================================================================\n');
  }

  // 1. Query Gemini Live Models
  const availableGeminiModels = [];
  let geminiError = null;
  if (!geminiApiKey) {
    geminiError = 'GEMINI_API_KEY not configured in environment.';
    if (verbose) console.warn('⚠️  Gemini: Key missing, skipping live API fetch.');
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const pager = await ai.models.list();
      for await (const m of pager) {
        const cleanId = (m.name || '').replace(/^models\//, '');
        availableGeminiModels.push({
          id: cleanId,
          rawName: m.name,
          displayName: m.displayName || cleanId,
          description: m.description || '',
          supportedActions: m.supportedActions || [],
        });
      }
      if (verbose) {
        console.log(`✅ Gemini API connected: Found ${availableGeminiModels.length} available models.`);
      }
    } catch (err) {
      geminiError = err.message;
      if (verbose) console.error(`❌ Gemini API Error: ${err.message}`);
    }
  }

  // 2. Query Groq Live Models
  const availableGroqModels = [];
  let groqError = null;
  if (!groqApiKey) {
    groqError = 'GROQ_API_KEY not configured in environment.';
    if (verbose) console.warn('⚠️  Groq: Key missing, skipping live API fetch.');
  } else {
    try {
      const groq = new Groq({ apiKey: groqApiKey });
      const list = await groq.models.list();
      for (const m of list.data || []) {
        availableGroqModels.push({
          id: m.id,
          ownedBy: m.owned_by || '',
          active: m.active !== false,
          contextWindow: m.context_window || 0,
        });
      }
      if (verbose) {
        console.log(`✅ Groq API connected: Found ${availableGroqModels.length} available models.`);
      }
    } catch (err) {
      groqError = err.message;
      if (verbose) console.error(`❌ Groq API Error: ${err.message}`);
    }
  }

  // 3. Cross-reference Codebase & Configuration Targets
  const geminiIdSet = new Set(availableGeminiModels.map((m) => m.id.toLowerCase()));
  const groqIdSet = new Set(availableGroqModels.map((m) => m.id.toLowerCase()));

  const auditResults = CODEBASE_REFERENCED_MODELS.map((item) => {
    let exists = false;
    let note = '';

    if (item.provider === 'gemini') {
      if (geminiError) {
        note = `Unknown (Gemini API error: ${geminiError})`;
      } else {
        const idLower = item.id.toLowerCase();
        exists = geminiIdSet.has(idLower) || geminiIdSet.has(`models/${idLower}`);
        if (exists) {
          note = 'Active on Google GenAI API';
        } else {
          note = item.isDeprecatedTarget ? 'Confirmed absent (legacy/deprecated ID)' : 'NOT FOUND in Google GenAI catalog';
        }
      }
    } else if (item.provider === 'groq') {
      if (groqError) {
        note = `Unknown (Groq API error: ${groqError})`;
      } else {
        const idLower = item.id.toLowerCase();
        // Exact match or suffix match
        exists = groqIdSet.has(idLower) || Array.from(groqIdSet).some((g) => g.endsWith('/' + idLower) || g === idLower);
        if (exists) {
          note = 'Active on Groq Cloud API';
        } else {
          note = item.isDeprecatedTarget ? 'Confirmed absent (legacy/deprecated ID)' : 'NOT FOUND in Groq Cloud catalog';
        }
      }
    }

    return {
      provider: item.provider.toUpperCase(),
      id: item.id,
      role: item.role,
      isConfigured: Boolean(item.isConfigured),
      isDeprecatedTarget: Boolean(item.isDeprecatedTarget),
      source: item.source,
      exists,
      note,
    };
  });

  // Identify any MISSING configured models (models expected to be active in production/fallback)
  const missingConfigured = auditResults.filter((r) => r.isConfigured && !r.exists);
  const success = missingConfigured.length === 0 && !geminiError && !groqError;

  // Build formatted text audit report
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timestampStr = now.toISOString();

  let reportText = '';
  reportText += '======================================================================\n';
  reportText += 'COSMOAI LIVE LLM MODEL CATALOG AUDIT REPORT\n';
  reportText += '======================================================================\n';
  reportText += `Generated at: ${timestampStr} (${dateStr})\n`;
  reportText += `Audit mode:   ${isStrict ? 'STRICT' : 'STANDARD'}\n`;
  reportText += `Gemini API:   ${geminiError ? `ERROR (${geminiError})` : `CONNECTED (${availableGeminiModels.length} models discovered)`}\n`;
  reportText += `Groq API:     ${groqError ? `ERROR (${groqError})` : `CONNECTED (${availableGroqModels.length} models discovered)`}\n`;
  reportText += '----------------------------------------------------------------------\n\n';

  reportText += '### 1. CONFIGURED ACTIVE & FALLBACK CHAIN VERIFICATION\n\n';
  reportText += '| Provider | Model ID | Role | Status | Live Catalog Status |\n';
  reportText += '|:---------|:---------|:-----|:------:|:--------------------|\n';
  for (const r of auditResults.filter((m) => m.isConfigured)) {
    const statusIcon = r.exists ? '✅ ACTIVE' : '❌ MISSING';
    reportText += `| ${r.provider} | \`${r.id}\` | ${r.role} | ${statusIcon} | ${r.note} |\n`;
  }
  reportText += '\n';

  reportText += '### 2. DEPRECATED & SUNSET MODEL GUARDS (VERIFIED ABSENT)\n\n';
  reportText += '| Provider | Model ID | Original Role | Expected | Actual Result |\n';
  reportText += '|:---------|:---------|:--------------|:--------:|:--------------|\n';
  for (const r of auditResults.filter((m) => m.isDeprecatedTarget)) {
    const statusIcon = !r.exists ? '✅ ABSENT (Pass)' : '⚠️ UNEXPECTED MATCH';
    reportText += `| ${r.provider} | \`${r.id}\` | ${r.role} | ABSENT | ${statusIcon} (${r.note}) |\n`;
  }
  reportText += '\n';

  if (missingConfigured.length > 0) {
    reportText += '### 3. ❌ MISSING CONFIGURED MODEL IDS (CRITICAL ACTION REQUIRED)\n\n';
    reportText += '| Provider | Missing Model ID | Configured Role | Recommended Action |\n';
    reportText += '|:---------|:-----------------|:----------------|:-------------------|\n';
    for (const m of missingConfigured) {
      reportText += `| ${m.provider} | \`${m.id}\` | ${m.role} | Model ID appears retired; update server/config/models.js |\n`;
    }
    reportText += '\n';
  } else {
    reportText += '### 3. CONFIGURED MODELS STATUS\n\n';
    reportText += '✅ All configured Gemini primary/fallback models and Groq primary/fallback models are 100% active and verified in the provider live catalogs.\n\n';
  }

  reportText += '### 4. LIVE DISCOVERED CATALOG SUMMARY\n\n';
  reportText += `Total Gemini models available on API: ${availableGeminiModels.length}\n`;
  reportText += `Total Groq models available on API:   ${availableGroqModels.length}\n`;
  reportText += `Total Codebase models audited:        ${auditResults.length}\n`;
  reportText += `Configured Active Models:             ${auditResults.filter((m) => m.isConfigured).length}\n`;
  reportText += `Configured Missing Count:             ${missingConfigured.length}\n\n`;
  reportText += '======================================================================\n';
  reportText += `AUDIT RESULT: ${missingConfigured.length === 0 ? 'PASSED (0 missing configured models)' : 'FAILED (missing configured models)'}\n`;
  reportText += '======================================================================\n';

  // Save report to docs/
  let savedFilePaths = [];
  if (saveToFile) {
    try {
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const dateFile = path.join(outDir, `model-audit-${dateStr}.txt`);
      const latestFile = path.join(outDir, 'model-audit-latest.txt');
      fs.writeFileSync(dateFile, reportText, 'utf-8');
      fs.writeFileSync(latestFile, reportText, 'utf-8');
      savedFilePaths = [dateFile, latestFile];
      if (verbose) {
        console.log(`📄 Saved audit output to: ${dateFile}`);
        console.log(`📄 Updated latest audit:  ${latestFile}\n`);
      }
    } catch (saveErr) {
      console.warn('⚠️ Could not save model audit report file:', saveErr.message);
    }
  }

  // Console output
  if (verbose) {
    console.log('----------------------------------------------------------------------');
    console.log('📊 Configured Model Audit Results:');
    console.log('----------------------------------------------------------------------');
    console.log(
      'Status'.padEnd(12) +
      'Provider'.padEnd(10) +
      'Model ID'.padEnd(28) +
      'Role / Notes'
    );
    console.log('-'.repeat(80));

    for (const r of auditResults) {
      const statusIcon = r.exists ? '✅ EXISTS  ' : '❌ MISSING ';
      console.log(
        statusIcon.padEnd(12) +
        r.provider.padEnd(10) +
        r.id.padEnd(28) +
        `${r.role} (${r.note})`
      );
    }

    if (missingConfigured.length > 0) {
      console.log('\n❌ ==================================================================');
      console.log('❌ FATAL: MISSING CONFIGURED MODEL IDS IN LIVE PROVIDER CATALOG:');
      console.log('❌ ==================================================================');
      console.log(
        'Provider'.padEnd(10) +
        'Model ID'.padEnd(30) +
        'Configured Role'
      );
      console.log('-'.repeat(80));
      for (const m of missingConfigured) {
        console.log(
          m.provider.padEnd(10) +
          m.id.padEnd(30) +
          m.role
        );
      }
      console.log('==================================================================\n');
    } else {
      console.log('\n✅ ALL CONFIGURED MODEL IDS (PRIMARY + FULL FALLBACK CHAINS) ARE LIVE AND ACTIVE.\n');
    }
  }

  return {
    success: missingConfigured.length === 0,
    gemini: {
      availableCount: availableGeminiModels.length,
      models: availableGeminiModels,
      error: geminiError,
    },
    groq: {
      availableCount: availableGroqModels.length,
      models: availableGroqModels,
      error: groqError,
    },
    auditResults,
    missingConfigured,
    savedFilePaths,
    dateStr,
  };
}

// Direct CLI invocation
if (process.argv[1] === __filename) {
  const isStrict =
    process.argv.includes('--strict') ||
    process.env.STRICT_MODEL_AUDIT === 'true' ||
    process.env.MODEL_AUDIT_STRICT === 'true';

  checkModels({ verbose: true, strict: isStrict })
    .then((summary) => {
      if (summary.missingConfigured.length > 0) {
        console.error(`❌ Audit check failed: ${summary.missingConfigured.length} configured models missing.`);
        process.exit(1);
      }
      console.log(`✅ All ${summary.auditResults.filter((m) => m.isConfigured).length} configured active models verified.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal execution error in check-models:', err);
      process.exit(1);
    });
}

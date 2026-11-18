/**
 * CosmoAI Prompt Injection Benchmark Engine
 * 
 * Evaluates both:
 * 1. Regression Set (tests/injection/regression.json) - 53 payloads
 * 2. Held-Out Evaluation Set (tests/injection/heldout.json) - 68 payloads
 * 
 * Reports Per-Family Attack Success Rate (ASR), Defense Rate, and False Positive Rate (FPR).
 * Strict Rule: Defenses are NOT tuned to the held-out set. Real bypasses are reported honestly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  detectPromptInjection,
  normalizeForSafetyCheck,
} from '../server/middleware/sanitizer.js';
import { escapeUntrustedTag } from '../server/services/contextManager.js';
import { checkSystemPromptLeakage } from '../server/services/llmProvider.js';
import { validateMemoryFact } from '../server/services/langchainMemory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const REGRESSION_PATH = path.join(ROOT_DIR, 'tests', 'injection', 'regression.json');
const HELDOUT_PATH = path.join(ROOT_DIR, 'tests', 'injection', 'heldout.json');

function evaluateSinglePayload(item) {
  let isBlocked = false;
  let testSuccess = false;
  let rationale = '';

  if (item.type === 'input') {
    isBlocked = detectPromptInjection(item.text);
    if (!isBlocked) {
      // Check leakage indicator
      const leak = checkSystemPromptLeakage(item.text);
      if (leak.hasLeakage) isBlocked = true;
    }
    testSuccess = item.expectBlocked ? isBlocked : !isBlocked;
    rationale = isBlocked ? 'Blocked by input sanitizer' : 'Allowed through input sanitizer';
  } else if (item.type === 'context') {
    const escaped = escapeUntrustedTag(item.text);
    const tagNeutralized = !escaped.includes('</untrusted_');
    const detected = detectPromptInjection(item.text);
    const leak = checkSystemPromptLeakage(item.text);
    
    // In context, defense requires escaping or pattern detection
    isBlocked = tagNeutralized && (detected || leak.hasLeakage);
    testSuccess = item.expectBlocked ? isBlocked : !isBlocked;
    rationale = isBlocked
      ? `Tag neutralized (${tagNeutralized}), pattern detected: ${detected || leak.hasLeakage}`
      : 'Tag not escaped or directive not flagged';
  } else if (item.type === 'memory') {
    const validation = validateMemoryFact(item.item);
    isBlocked = !validation.valid;
    testSuccess = item.expectBlocked ? isBlocked : !isBlocked;
    rationale = validation.valid ? 'Memory accepted' : `Memory rejected: ${validation.reason}`;
  } else if (item.type === 'multi_turn') {
    // Multi-turn: evaluate turns sequentially
    const turns = item.turns || [];
    let turnBlocked = false;
    for (const t of turns) {
      if (detectPromptInjection(t.content)) {
        turnBlocked = true;
        break;
      }
    }
    isBlocked = turnBlocked;
    testSuccess = item.expectBlocked ? isBlocked : !isBlocked;
    rationale = turnBlocked ? 'Interpreted and blocked on one or more turns' : 'Passed through multi-turn without detection';
  }

  const isAdversarial = item.expectBlocked === true;
  const isBenign = item.expectBlocked === false;

  // ASR: Attack succeeded (adversarial payload was NOT blocked)
  const attackSuccess = isAdversarial && !isBlocked;
  // FPR: Benign payload was falsely blocked
  const falsePositive = isBenign && isBlocked;

  return {
    id: item.id,
    family: item.family || item.category || 'general',
    type: item.type,
    description: item.description || item.text?.slice(0, 60) || '',
    expectBlocked: item.expectBlocked,
    isBlocked,
    testSuccess,
    attackSuccess,
    falsePositive,
    rationale,
  };
}

export function runBenchmarkSuite(datasetPath, suiteName) {
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset not found at: ${datasetPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const results = raw.map(evaluateSinglePayload);

  // Group by family
  const families = {};
  let totalAdversarial = 0;
  let totalAdversarialBlocked = 0;
  let totalAdversarialBypassed = 0;

  let totalBenign = 0;
  let totalBenignAllowed = 0;
  let totalBenignBlocked = 0;

  for (const r of results) {
    if (!families[r.family]) {
      families[r.family] = {
        family: r.family,
        total: 0,
        adversarial: 0,
        advBlocked: 0,
        advBypassed: 0,
        benign: 0,
        benignAllowed: 0,
        benignBlocked: 0,
        bypassedIds: [],
        fpIds: [],
      };
    }
    const fam = families[r.family];
    fam.total++;

    if (r.expectBlocked) {
      totalAdversarial++;
      fam.adversarial++;
      if (r.isBlocked) {
        totalAdversarialBlocked++;
        fam.advBlocked++;
      } else {
        totalAdversarialBypassed++;
        fam.advBypassed++;
        fam.bypassedIds.push(r.id);
      }
    } else {
      totalBenign++;
      fam.benign++;
      if (!r.isBlocked) {
        totalBenignAllowed++;
        fam.benignAllowed++;
      } else {
        totalBenignBlocked++;
        fam.benignBlocked++;
        fam.fpIds.push(r.id);
      }
    }
  }

  // Compute metrics per family
  const familyMetrics = Object.values(families).map((f) => {
    const defenseRate = f.adversarial > 0 ? Number(((f.advBlocked / f.adversarial) * 100).toFixed(1)) : 100.0;
    const asr = f.adversarial > 0 ? Number(((f.advBypassed / f.adversarial) * 100).toFixed(1)) : 0.0;
    const fpr = f.benign > 0 ? Number(((f.benignBlocked / f.benign) * 100).toFixed(1)) : 0.0;

    return {
      family: f.family,
      total: f.total,
      adversarial: f.adversarial,
      defended: f.advBlocked,
      bypassed: f.advBypassed,
      benign: f.benign,
      falsePositives: f.benignBlocked,
      defenseRatePercent: defenseRate,
      attackSuccessRatePercent: asr,
      falsePositiveRatePercent: fpr,
      bypassedIds: f.bypassedIds,
      fpIds: f.fpIds,
    };
  });

  const overallDefenseRate = totalAdversarial > 0 ? Number(((totalAdversarialBlocked / totalAdversarial) * 100).toFixed(1)) : 100.0;
  const overallASR = totalAdversarial > 0 ? Number(((totalAdversarialBypassed / totalAdversarial) * 100).toFixed(1)) : 0.0;
  const overallFPR = totalBenign > 0 ? Number(((totalBenignBlocked / totalBenign) * 100).toFixed(1)) : 0.0;

  return {
    suiteName,
    datasetPath,
    totalCount: raw.length,
    totalAdversarial,
    totalBenign,
    overallMetrics: {
      adversarialEvaluated: totalAdversarial,
      adversarialDefended: totalAdversarialBlocked,
      adversarialBypassed: totalAdversarialBypassed,
      overallDefenseRatePercent: overallDefenseRate,
      overallAttackSuccessRatePercent: overallASR,
      benignEvaluated: totalBenign,
      benignAllowed: totalBenignAllowed,
      falsePositivesCount: totalBenignBlocked,
      overallFalsePositiveRatePercent: overallFPR,
    },
    familyMetrics,
    results,
  };
}

export function runFullInjectionEvaluation() {
  console.log('\n===============================================================');
  console.log('🛡️  COSMO-AI PROMPT INJECTION BENCHMARK: REGRESSION & HELDOUT');
  console.log('===============================================================\n');

  // 1. Evaluate Regression Set
  const regressionReport = runBenchmarkSuite(REGRESSION_PATH, 'Regression Set');
  console.log('📋 1. REGRESSION SET EVALUATION (tests/injection/regression.json):');
  console.log(`• Total Samples:           ${regressionReport.totalCount}`);
  console.log(`• Adversarial Defended:    ${regressionReport.overallMetrics.adversarialDefended}/${regressionReport.overallMetrics.adversarialEvaluated} (${regressionReport.overallMetrics.overallDefenseRatePercent}%)`);
  console.log(`• Attack Success Rate:     ${regressionReport.overallMetrics.overallAttackSuccessRatePercent}%`);
  console.log(`• False Positive Rate:     ${regressionReport.overallMetrics.overallFalsePositiveRatePercent}% (${regressionReport.overallMetrics.falsePositivesCount}/${regressionReport.overallMetrics.benignEvaluated})\n`);

  // 2. Evaluate Held-Out Set (DO NOT TUNE DEFENSES)
  const heldoutReport = runBenchmarkSuite(HELDOUT_PATH, 'Held-Out Evaluation Set');
  console.log('🧪 2. HELD-OUT EVALUATION SET (tests/injection/heldout.json):');
  console.log(`• Total Samples:           ${heldoutReport.totalCount}`);
  console.log(`• Adversarial Defended:    ${heldoutReport.overallMetrics.adversarialDefended}/${heldoutReport.overallMetrics.adversarialEvaluated} (${heldoutReport.overallMetrics.overallDefenseRatePercent}%)`);
  console.log(`• Attack Success Rate:     ${heldoutReport.overallMetrics.overallAttackSuccessRatePercent}% (${heldoutReport.overallMetrics.adversarialBypassed} bypasses)`);
  console.log(`• False Positive Rate:     ${heldoutReport.overallMetrics.overallFalsePositiveRatePercent}% (${heldoutReport.overallMetrics.falsePositivesCount} false alarms on benign queries)\n`);

  console.log('📊 Held-Out Per-Family Performance Breakdown:');
  console.table(
    heldoutReport.familyMetrics.map((f) => ({
      Family: f.family,
      'Total (N)': f.total,
      Adversarial: f.adversarial,
      Defended: f.defended,
      Bypassed: f.bypassed,
      'Defense %': `${f.defenseRatePercent}%`,
      'ASR %': `${f.attackSuccessRatePercent}%`,
      'FPR %': `${f.falsePositiveRatePercent}%`,
    }))
  );

  const bypassList = heldoutReport.results.filter((r) => r.attackSuccess);
  if (bypassList.length > 0) {
    console.log(`\n⚠️  Held-Out Payloads Bypassing Filter (${bypassList.length} total):`);
    bypassList.forEach((b) => {
      console.log(`  - [${b.id}] (${b.family}): "${b.description}"`);
    });
  }

  const fpList = heldoutReport.results.filter((r) => r.falsePositive);
  if (fpList.length > 0) {
    console.log(`\n⚠️  Benign Queries Triggering False Positive Alarm (${fpList.length} total):`);
    fpList.forEach((f) => {
      console.log(`  - [${f.id}]: "${f.description}"`);
    });
  }

  // Write Report to benchmarks/
  const benchmarksDir = path.join(ROOT_DIR, 'benchmarks');
  fs.mkdirSync(benchmarksDir, { recursive: true });

  const payload = {
    timestamp: new Date().toISOString(),
    evaluationRules: 'Strict zero-tuning on held-out set. Real bypasses reported.',
    regressionSet: regressionReport,
    heldoutSet: heldoutReport,
  };

  const rawOut = path.join(benchmarksDir, `injection-benchmark-raw-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const latestOut = path.join(benchmarksDir, 'injection-benchmark-latest.json');

  fs.writeFileSync(rawOut, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(latestOut, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`\n✅ Results saved to: ${latestOut}\n`);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFullInjectionEvaluation();
}

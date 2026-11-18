/**
 * CosmoAI Inter-Annotator Agreement Engine
 * 
 * Computes statistical agreement between cross-provider LLM-as-a-Judge ratings
 * and independent human ratings:
 * 1. Spearman Rank Correlation Coefficient (rho)
 * 2. Cohen's Kappa (kappa) & Quadratic Weighted Kappa (kappa_w)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to compute fractional ranks with tie handling
function computeRanks(arr) {
  const sorted = arr
    .map((val, idx) => ({ val: Number(val), idx }))
    .sort((a, b) => a.val - b.val);

  const ranks = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].val === sorted[i].val) {
      j++;
    }
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].idx] = avgRank;
    }
    i = j;
  }
  return ranks;
}

// Pearson correlation on ranks yields exact Spearman rho (handling ties)
export function computeSpearmanRho(xArr, yArr) {
  if (xArr.length !== yArr.length || xArr.length === 0) return 0;
  const n = xArr.length;
  const rankX = computeRanks(xArr);
  const rankY = computeRanks(yArr);

  const meanX = rankX.reduce((a, b) => a + b, 0) / n;
  const meanY = rankY.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = rankX[i] - meanX;
    const diffY = rankY[i] - meanY;
    num += diffX * diffY;
    denX += diffX * diffX;
    denY += diffY * diffY;
  }

  if (denX === 0 || denY === 0) return 1.0;
  return Number((num / (Math.sqrt(denX) * Math.sqrt(denY))).toFixed(4));
}

// Discretized Cohen's Kappa & Quadratic Weighted Kappa
export function computeCohenKappa(humanScores, judgeScores, numBins = 5) {
  if (humanScores.length !== judgeScores.length || humanScores.length === 0) {
    return { kappa: 0, weightedKappa: 0, observedAgreement: 0 };
  }

  const n = humanScores.length;
  // Discretize to 1..numBins integers
  const toBin = (v) => Math.min(numBins, Math.max(1, Math.round(Number(v))));
  const hBins = humanScores.map(toBin);
  const jBins = judgeScores.map(toBin);

  // Initialize confusion matrix
  const matrix = Array.from({ length: numBins }, () => Array(numBins).fill(0));
  for (let i = 0; i < n; i++) {
    const r = hBins[i] - 1;
    const c = jBins[i] - 1;
    matrix[r][c]++;
  }

  // Row and Column marginals
  const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = Array(numBins).fill(0);
  for (let c = 0; c < numBins; c++) {
    for (let r = 0; r < numBins; r++) {
      colSums[c] += matrix[r][c];
    }
  }

  // 1. Unweighted Cohen's Kappa
  let observedMatches = 0;
  for (let i = 0; i < numBins; i++) {
    observedMatches += matrix[i][i];
  }
  const po = observedMatches / n;

  let pe = 0;
  for (let i = 0; i < numBins; i++) {
    pe += (rowSums[i] * colSums[i]) / (n * n);
  }

  const kappa = pe === 1 ? 1.0 : (po - pe) / (1 - pe);

  // 2. Quadratic Weighted Kappa (ordinal penalty)
  let weightedObserved = 0;
  let weightedExpected = 0;

  for (let i = 0; i < numBins; i++) {
    for (let j = 0; j < numBins; j++) {
      const weight = 1 - Math.pow(i - j, 2) / Math.pow(numBins - 1, 2);
      weightedObserved += weight * (matrix[i][j] / n);
      weightedExpected += weight * ((rowSums[i] * colSums[j]) / (n * n));
    }
  }

  const weightedKappa = weightedExpected === 1 ? 1.0 : (weightedObserved - weightedExpected) / (1 - weightedExpected);

  return {
    observedAgreement: Number(po.toFixed(4)),
    kappa: Number(kappa.toFixed(4)),
    weightedKappa: Number(weightedKappa.toFixed(4)),
    confusionMatrix: matrix,
  };
}

export function interpretKappa(val) {
  if (val >= 0.81) return 'Almost Perfect Agreement (Landis & Koch)';
  if (val >= 0.61) return 'Substantial Agreement (Landis & Koch)';
  if (val >= 0.41) return 'Moderate Agreement (Landis & Koch)';
  if (val >= 0.21) return 'Fair Agreement (Landis & Koch)';
  if (val >= 0.00) return 'Slight Agreement (Landis & Koch)';
  return 'Poor Agreement (Landis & Koch)';
}

export function parseCsv(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx];
    });
    return obj;
  });
}

export function computeAgreementReport(csvPath, jsonPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Evaluation JSON file not found at: ${jsonPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const humanRows = parseCsv(csvContent);
  const evalData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const evaluations = evalData.evaluations || [];
  const evalMap = new Map();
  evaluations.forEach((ev) => evalMap.set(ev.id, ev));

  const paired = [];
  humanRows.forEach((row) => {
    const id = row.sample_id;
    const ev = evalMap.get(id);
    if (ev) {
      paired.push({
        id,
        category: row.category,
        human: {
          context: Number(row.human_context_coherence || 0),
          ground: Number(row.human_groundedness || 0),
          intent: Number(row.human_intent_relevance || 0),
          sec: Number(row.human_directive_security || 0),
          help: Number(row.human_user_helpfulness || 0),
          composite: Number(row.human_composite_score || 0),
        },
        judge: {
          context: ev.cosmoScores?.contextContinuity || 0,
          ground: ev.cosmoScores?.groundedness || 0,
          intent: ev.cosmoScores?.intentRelevance || 0,
          sec: ev.cosmoScores?.directiveIsolation || 0,
          help: ev.cosmoScores?.userHelpfulness || 0,
          composite: ev.cosmoScores?.compositeScore || 0,
        },
      });
    }
  });

  if (paired.length === 0) {
    throw new Error('No matching paired samples found between CSV and evaluation JSON.');
  }

  const humanComposites = paired.map((p) => p.human.composite);
  const judgeComposites = paired.map((p) => p.judge.composite);

  const spearmanComposite = computeSpearmanRho(humanComposites, judgeComposites);
  const kappaComposite = computeCohenKappa(humanComposites, judgeComposites, 5);

  const dimensionAgreements = {
    contextContinuity: {
      spearmanRho: computeSpearmanRho(paired.map((p) => p.human.context), paired.map((p) => p.judge.context)),
      kappa: computeCohenKappa(paired.map((p) => p.human.context), paired.map((p) => p.judge.context), 5).kappa,
    },
    groundedness: {
      spearmanRho: computeSpearmanRho(paired.map((p) => p.human.ground), paired.map((p) => p.judge.ground)),
      kappa: computeCohenKappa(paired.map((p) => p.human.ground), paired.map((p) => p.judge.ground), 5).kappa,
    },
    intentRelevance: {
      spearmanRho: computeSpearmanRho(paired.map((p) => p.human.intent), paired.map((p) => p.judge.intent)),
      kappa: computeCohenKappa(paired.map((p) => p.human.intent), paired.map((p) => p.judge.intent), 5).kappa,
    },
    directiveIsolation: {
      spearmanRho: computeSpearmanRho(paired.map((p) => p.human.sec), paired.map((p) => p.judge.sec)),
      kappa: computeCohenKappa(paired.map((p) => p.human.sec), paired.map((p) => p.judge.sec), 5).kappa,
    },
    userHelpfulness: {
      spearmanRho: computeSpearmanRho(paired.map((p) => p.human.help), paired.map((p) => p.judge.help)),
      kappa: computeCohenKappa(paired.map((p) => p.human.help), paired.map((p) => p.judge.help), 5).kappa,
    },
  };

  const report = {
    pairedSampleCount: paired.length,
    judgeModel: evalData.metadata?.judgeModel || 'Groq Qwen 3.8 27B',
    generatorModel: evalData.metadata?.generatorModel || 'Gemini 2.5 Flash',
    promptVersion: evalData.metadata?.promptVersion || 'v2.0-cross-provider-orthogonal-rubric',
    compositeMetrics: {
      spearmanRho: spearmanComposite,
      cohenKappa: kappaComposite.kappa,
      quadraticWeightedKappa: kappaComposite.weightedKappa,
      observedAgreement: kappaComposite.observedAgreement,
      interpretation: interpretKappa(kappaComposite.weightedKappa || kappaComposite.kappa),
    },
    dimensionAgreements,
  };

  return report;
}

// CLI Execution Support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const defaultCsv = path.join(ROOT_DIR, 'benchmarks', 'human_eval_samples.csv');
  const defaultJson = path.join(ROOT_DIR, 'benchmarks', 'rubric-eval-latest.json');

  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCsv;
  const jsonPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultJson;

  console.log('\n===============================================================');
  console.log('🤝 INTER-ANNOTATOR AGREEMENT REPORT: HUMAN VS. LLM-JUDGE');
  console.log('===============================================================\n');

  try {
    const report = computeAgreementReport(csvPath, jsonPath);
    console.log(`Evaluated ${report.pairedSampleCount} Paired Samples:`);
    console.log(`  • Generator Model: ${report.generatorModel}`);
    console.log(`  • Judge Model:     ${report.judgeModel} (Cross-Provider)`);
    console.log(`  • Prompt Version:  ${report.promptVersion}\n`);

    console.log('📊 Composite Score Agreement:');
    console.log(`  • Spearman Rank Correlation (rho):  ${report.compositeMetrics.spearmanRho}`);
    console.log(`  • Cohen's Kappa (unweighted):       ${report.compositeMetrics.cohenKappa}`);
    console.log(`  • Quadratic Weighted Kappa (kw):    ${report.compositeMetrics.quadraticWeightedKappa}`);
    console.log(`  • Observed Agreement Ratio:         ${(report.compositeMetrics.observedAgreement * 100).toFixed(1)}%`);
    console.log(`  • Agreement Standard:               ${report.compositeMetrics.interpretation}\n`);

    console.log('📐 Per-Dimension Agreement Breakdown:');
    console.table(
      Object.entries(report.dimensionAgreements).map(([dim, metrics]) => ({
        Dimension: dim,
        'Spearman Rho': metrics.spearmanRho,
        "Cohen's Kappa": metrics.kappa,
      }))
    );
  } catch (err) {
    console.error('Agreement calculation error:', err.message);
  }
}

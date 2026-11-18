#!/usr/bin/env node
/**
 * scripts/gen-env-table.js
 * 
 * Automatically generates the environment variables reference table from
 * server/config/envConfig.js and injects it into CAPSTONE_REPORT_README.md
 * and README.md. Guarantees zero documentation drift across the project.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateEnvMarkdownTable } from '../server/config/envConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function updateEnvTables() {
  const tableMd = generateEnvMarkdownTable();
  const capstonePath = path.join(rootDir, 'CAPSTONE_REPORT_README.md');
  const readmePath = path.join(rootDir, 'README.md');

  let updatedCount = 0;

  // 1. Update CAPSTONE_REPORT_README.md
  if (fs.existsSync(capstonePath)) {
    let content = fs.readFileSync(capstonePath, 'utf8');

    // Pattern matching between '### 1. Environment Secrets Reference (`.env`)' and '### 2. Multi-Stage Dockerfile'
    const capstoneHeader = '### 1. Environment Secrets Reference (`.env`)';
    const capstoneNext = '### 2. Multi-Stage Dockerfile Specification';

    if (content.includes(capstoneHeader) && content.includes(capstoneNext)) {
      const partsBefore = content.split(capstoneHeader)[0];
      const remainder = content.split(capstoneHeader)[1];
      const partsAfter = remainder.split(capstoneNext)[1];

      const newSection = `${capstoneHeader}\n\n${tableMd}\n\n`;
      content = partsBefore + newSection + capstoneNext + partsAfter;
      fs.writeFileSync(capstonePath, content, 'utf8');
      console.log('✅ Synchronized environment table in CAPSTONE_REPORT_README.md');
      updatedCount++;
    } else {
      console.warn('⚠️ Could not locate section markers in CAPSTONE_REPORT_README.md');
    }
  }

  // 2. Update README.md
  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf8');
    const markerStart = '<!-- ENV_TABLE_START -->';
    const markerEnd = '<!-- ENV_TABLE_END -->';

    if (content.includes(markerStart) && content.includes(markerEnd)) {
      const before = content.split(markerStart)[0];
      const after = content.split(markerEnd)[1];
      content = `${before}${markerStart}\n\n${tableMd}\n\n${markerEnd}${after}`;
      fs.writeFileSync(readmePath, content, 'utf8');
      console.log('✅ Synchronized environment table in README.md (markers)');
      updatedCount++;
    } else {
      // Find insertion point right before '### Running Chroma DB'
      const targetAnchor = '### Running Chroma DB (Optional Vector Database)';
      if (content.includes(targetAnchor)) {
        const parts = content.split(targetAnchor);
        const insertion = `#### Environment Variables Reference Table\n\n${markerStart}\n\n${tableMd}\n\n${markerEnd}\n\n`;
        content = parts[0] + insertion + targetAnchor + parts[1];
        fs.writeFileSync(readmePath, content, 'utf8');
        console.log('✅ Injected environment table with markers into README.md');
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateEnvTables();
}

#!/usr/bin/env node
/**
 * Kaggle Dataset Download Script
 * Downloads the "Household Load and Solar Generation" dataset.
 * 
 * Prerequisites:
 *   1. Install Kaggle CLI: pip install kaggle
 *   2. Set up API token: https://www.kaggle.com/docs/api
 *      - Go to kaggle.com → Your Profile → Account → Create New Token
 *      - Place kaggle.json in ~/.kaggle/ (Linux/Mac) or %USERPROFILE%\.kaggle\ (Windows)
 *   3. Run: node scripts/download-dataset.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DATASET = 'srinuti/residential-power-usage-3years-data-timeseries';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'profiles');

console.log('📥 GridPulse Dataset Downloader\n');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

try {
  console.log('1. Checking Kaggle CLI...');
  execSync('kaggle --version', { stdio: 'pipe' });
  console.log('   ✓ Kaggle CLI found\n');

  console.log(`2. Downloading dataset: ${DATASET}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  execSync(
    `kaggle datasets download -d ${DATASET} -p "${OUTPUT_DIR}" --unzip`,
    { stdio: 'inherit' }
  );

  console.log('\n3. ✅ Dataset downloaded successfully!');
  console.log('   CSV files are in: ' + OUTPUT_DIR);
  console.log('\n   Note: The DatasetLoader will automatically detect and parse');
  console.log('   these files on server startup. If columns don\'t match,');
  console.log('   the system will fall back to synthetic profiles.\n');

} catch (error) {
  console.error('\n❌ Download failed. Common fixes:\n');
  console.error('   1. Install Kaggle CLI:');
  console.error('      pip install kaggle\n');
  console.error('   2. Set up API credentials:');
  console.error('      - Visit: https://www.kaggle.com/settings');
  console.error('      - Click "Create New Token" under API section');
  console.error('      - Save kaggle.json to:');
  console.error('        Windows: %USERPROFILE%\\.kaggle\\kaggle.json');
  console.error('        Mac/Linux: ~/.kaggle/kaggle.json\n');
  console.error('   3. Or manually download from:');
  console.error(`      https://www.kaggle.com/datasets/${DATASET}\n`);
  console.error('   ℹ️  GridPulse will work fine without this dataset.');
  console.error('   The DatasetLoader generates synthetic profiles as a fallback.\n');
}

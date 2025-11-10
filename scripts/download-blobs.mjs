#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { list } from '@vercel/blob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showUsage(exitCode = 0) {
  const script = path.relative(process.cwd(), __filename);
  console.log(`Usage: node ${script} --prefix <blob-prefix> --output <local-directory> [--overwrite]\n\n` +
    `Required environment variables:\n` +
    `  BLOB_READ_WRITE_TOKEN  Read/Write token issued from Vercel Blob dashboard.\n\n` +
    `Examples:\n` +
    `  node ${script} --prefix attendance/ --output backups/attendance\n` +
    `  node ${script} --prefix consents/ --output backups/consents --overwrite\n`);
  process.exit(exitCode);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { overwrite: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      showUsage(0);
    } else if (arg === '--prefix') {
      options.prefix = args[++i];
    } else if (arg === '--output') {
      options.output = args[++i];
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      showUsage(1);
    }
  }
  if (!options.prefix || !options.output) {
    console.error('Error: --prefix and --output are required.');
    showUsage(1);
  }
  return options;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function downloadBlob(blob, destDir, overwrite) {
  const destPath = path.join(destDir, blob.pathname.replace(/^[\/]+/, ''));
  await ensureDir(path.dirname(destPath));
  try {
    if (!overwrite) {
      await fs.access(destPath);
      console.log(`Skip (exists): ${destPath}`);
      return;
    }
  } catch (_) {}

  const downloadUrl = blob.downloadUrl || blob.url;
  if (!downloadUrl) {
    throw new Error(`Blob ${blob.pathname} does not provide a download URL.`);
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${blob.pathname}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(arrayBuffer));
  const sizeKB = (blob.size || arrayBuffer.byteLength) / 1024;
  console.log(`Downloaded: ${blob.pathname} -> ${destPath} (${sizeKB.toFixed(1)} KB)`);
}

async function downloadBlobs(prefix, outputDir, token, overwrite = false) {
  console.log(`Preparing to download blobs with prefix "${prefix}" to "${outputDir}"`);
  await ensureDir(outputDir);

  let cursor;
  const downloaded = [];
  do {
    const res = await list({ prefix, token, cursor });
    for (const blob of res.blobs) {
      await downloadBlob(blob, outputDir, overwrite);
      downloaded.push(blob.pathname);
    }
    cursor = res.cursor;
  } while (cursor);

  console.log(`\nCompleted. Downloaded ${downloaded.length} file(s).`);
}

async function main() {
  const opts = parseArgs();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is not set.');
    process.exit(1);
  }

  const outputDir = path.resolve(process.cwd(), opts.output);
  await downloadBlobs(opts.prefix, outputDir, token, opts.overwrite);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

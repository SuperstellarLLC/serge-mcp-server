import { writeFile } from 'fs/promises';
import path from 'path';
import type { Session } from '../types.js';
import { getReportsDir } from '../capture/session.js';
import { buildHtml } from './template.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

export async function generateReport(session: Session): Promise<string> {
  const html = await buildHtml(session);
  const reportPath = path.join(getReportsDir(), `${session.session_id}.html`);
  await writeFile(reportPath, html, 'utf-8');
  log(`Report generated: ${reportPath}`);
  return reportPath;
}

export async function getLatestReportPath(): Promise<string | null> {
  const { readdir } = await import('fs/promises');
  const reportsDir = getReportsDir();

  try {
    const files = await readdir(reportsDir);
    const htmlFiles = files.filter(f => f.endsWith('.html')).sort().reverse();
    const latest = htmlFiles[0];
    if (!latest) return null;
    return path.join(reportsDir, latest);
  } catch {
    return null;
  }
}

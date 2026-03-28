import type { Session } from '../types.js';
import { readFile } from 'fs/promises';

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c] ?? c);
}

async function screenshotToBase64(filepath: string): Promise<string> {
  try {
    const buffer = await readFile(filepath);
    return buffer.toString('base64');
  } catch {
    return '';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function outcomeBadge(outcome?: string): string {
  switch (outcome) {
    case 'success': return '<span class="badge badge-success">&#x2705; Success</span>';
    case 'failure': return '<span class="badge badge-failure">&#x274C; Failed</span>';
    case 'partial': return '<span class="badge badge-partial">&#x26A0;&#xFE0F; Partial</span>';
    default: return '<span class="badge">Unknown</span>';
  }
}

function actionIcon(action: string): string {
  switch (action) {
    case 'navigate': return '&#x1F310;';
    case 'click': return '&#x1F5B1;';
    case 'type': return '&#x2328;';
    case 'scroll': return '&#x2195;';
    case 'read_page': return '&#x1F4D6;';
    case 'screenshot': return '&#x1F4F7;';
    default: return '&#x2022;';
  }
}

export function generateFindings(session: Session): string[] {
  const findings: string[] = [];

  // Failed actions
  const failures = session.actions.filter(a => !a.result.success);
  if (failures.length > 0) {
    findings.push(`${failures.length} action(s) failed during the session.`);
  }

  // Slow page loads
  const slowNavigations = session.actions.filter(
    a => a.action === 'navigate' && a.result.duration_ms > 3000
  );
  if (slowNavigations.length > 0) {
    findings.push(`${slowNavigations.length} page load(s) took longer than 3 seconds.`);
  }

  // Element not found
  const notFound = session.actions.filter(
    a => (a.action === 'click' || a.action === 'type') && a.result.element_found === false
  );
  if (notFound.length > 0) {
    findings.push(`${notFound.length} element(s) could not be found by ARIA role/name.`);
  }

  // Bot detection (check network for Cloudflare/Akamai challenge pages)
  const botDetection = session.network.filter(
    n => n.status === 403 || n.url.includes('challenge') || n.url.includes('captcha')
  );
  if (botDetection.length > 0) {
    findings.push(`Possible bot detection encountered (${botDetection.length} blocked/challenge requests).`);
  }

  // Large page weight
  const totalSize = session.network.reduce((sum, n) => sum + n.size_bytes, 0);
  if (totalSize > 10_000_000) {
    findings.push(`Total page weight: ${(totalSize / 1_000_000).toFixed(1)} MB — heavy for agent browsing.`);
  }

  if (findings.length === 0) {
    findings.push('No significant issues detected during this session.');
  }

  return findings;
}

function dashboardUrl(session: Session): string {
  const params = new URLSearchParams({
    domain: session.domain,
    outcome: session.outcome ?? '',
    steps: String(session.total_steps),
    duration: String(session.total_duration_ms),
    session_id: session.session_id,
  });
  return `https://serge.ai/dashboard/import?${params.toString()}`;
}

export async function buildHtml(session: Session): Promise<string> {
  // Build screenshot data map
  const screenshotData = new Map<number, string>();
  for (const action of session.actions) {
    if (action.screenshot_path) {
      const b64 = await screenshotToBase64(action.screenshot_path);
      if (b64) screenshotData.set(action.index, b64);
    }
  }

  const findings = generateFindings(session);
  const totalNetworkSize = session.network.reduce((sum, n) => sum + n.size_bytes, 0);
  const slowestResources = [...session.network]
    .sort((a, b) => b.response_time_ms - a.response_time_ms)
    .slice(0, 5);

  const stepsHtml = session.actions.map(action => {
    const b64 = screenshotData.get(action.index);
    const screenshotHtml = b64
      ? `<div class="screenshot-thumb" onclick="openLightbox(this)">
           <img src="data:image/png;base64,${b64}" alt="Step ${action.index}" />
         </div>`
      : '';

    const statusClass = action.result.success ? 'step-success' : 'step-failure';
    const statusIcon = action.result.success ? '&#x2705;' : '&#x274C;';
    const paramsStr = Object.entries(action.params)
      .map(([k, v]) => `<span class="param-key">${esc(k)}:</span> ${esc(String(v))}`)
      .join(', ');

    return `
      <div class="step ${statusClass}">
        <div class="step-header">
          <span class="step-number">${action.index + 1}</span>
          <span class="step-icon">${actionIcon(action.action)}</span>
          <span class="step-action">${action.action}</span>
          <span class="step-status">${statusIcon}</span>
          <span class="step-duration">${formatDuration(action.result.duration_ms)}</span>
        </div>
        <div class="step-details">
          <div class="step-params">${paramsStr}</div>
          ${action.result.error ? `<div class="step-error">${esc(action.result.error)}</div>` : ''}
          ${action.result.url_after ? `<div class="step-url">Navigated to: ${esc(action.result.url_after)}</div>` : ''}
          <div class="step-page-url">${esc(action.page_url)}</div>
        </div>
        ${screenshotHtml}
      </div>`;
  }).join('\n');

  const findingsHtml = findings.map(f => `<li>${f}</li>`).join('\n');

  const networkRows = slowestResources.map(n => `
    <tr>
      <td>${n.method}</td>
      <td class="url-cell" title="${esc(n.url)}">${esc(n.url.length > 80 ? n.url.substring(0, 80) + '...' : n.url)}</td>
      <td>${n.status}</td>
      <td>${formatDuration(n.response_time_ms)}</td>
      <td>${(n.size_bytes / 1024).toFixed(1)} KB</td>
    </tr>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Serge Report — ${esc(session.domain)} — ${esc(session.task)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f7; color: #333; }
  code, .mono { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }

  .header {
    background: #1a1a2e;
    color: white;
    padding: 40px 32px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .header h1 span { color: #00D4AA; }
  .header .subtitle { color: #aaa; font-size: 14px; margin-bottom: 16px; }
  .header .task {
    font-size: 18px;
    color: #e0e0e0;
    margin-bottom: 8px;
  }
  .header .meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    font-size: 14px;
    color: #888;
  }

  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .badge-success { background: #00D4AA22; color: #00D4AA; }
  .badge-failure { background: #ff4d4f22; color: #ff4d4f; }
  .badge-partial { background: #faad1422; color: #faad14; }

  .container { max-width: 960px; margin: 0 auto; padding: 32px 16px; }

  .section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .section h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    cursor: pointer;
    user-select: none;
  }
  .section h2::before {
    content: '\\25BC ';
    font-size: 12px;
    color: #999;
  }
  .section.collapsed h2::before {
    content: '\\25B6 ';
  }
  .section.collapsed .section-body { display: none; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }
  .stat {
    text-align: center;
    padding: 16px;
    background: #f9f9fb;
    border-radius: 8px;
  }
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
  }
  .stat-label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }

  .step {
    border-left: 3px solid #00D4AA;
    margin-bottom: 16px;
    padding: 16px;
    padding-left: 20px;
    background: #fafafa;
    border-radius: 0 8px 8px 0;
    transition: background 0.2s;
  }
  .step:hover { background: #f0f0f5; }
  .step-failure { border-left-color: #ff4d4f; }
  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .step-number {
    background: #1a1a2e;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .step-icon { font-size: 18px; }
  .step-action {
    font-weight: 600;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .step-status { margin-left: auto; }
  .step-duration {
    font-family: 'SF Mono', monospace;
    font-size: 13px;
    color: #888;
  }
  .step-details { font-size: 13px; color: #666; margin-left: 40px; }
  .step-params { margin-bottom: 4px; }
  .param-key { color: #00D4AA; font-weight: 600; }
  .step-error { color: #ff4d4f; margin-top: 4px; }
  .step-url { color: #888; font-size: 12px; margin-top: 2px; font-family: monospace; }
  .step-page-url { color: #aaa; font-size: 11px; margin-top: 2px; font-family: monospace; }

  .screenshot-thumb {
    margin-top: 12px;
    margin-left: 40px;
    cursor: pointer;
  }
  .screenshot-thumb img {
    max-width: 320px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    transition: transform 0.2s;
  }
  .screenshot-thumb img:hover { transform: scale(1.02); }

  .lightbox {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85);
    z-index: 1000;
    cursor: pointer;
    justify-content: center;
    align-items: center;
  }
  .lightbox.active { display: flex; }
  .lightbox img {
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 8px;
  }

  .findings-list { list-style: none; }
  .findings-list li {
    padding: 8px 12px;
    border-left: 3px solid #faad14;
    margin-bottom: 8px;
    background: #fffbe6;
    border-radius: 0 4px 4px 0;
    font-size: 14px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th, td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
  }
  th {
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .url-cell {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: 12px;
  }

  .dashboard-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1a1a2e;
    border: 1px solid #00D4AA33;
    border-radius: 8px;
    padding: 12px 20px;
    margin-bottom: 24px;
  }
  .dashboard-cta span { color: #aaa; font-size: 14px; }
  .dashboard-btn {
    color: #00D4AA;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 16px;
    border: 1px solid #00D4AA;
    border-radius: 6px;
    transition: background 0.2s;
  }
  .dashboard-btn:hover { background: #00D4AA22; }

  .dashboard-cta-footer {
    background: #1a1a2e;
    border-radius: 12px;
    padding: 32px;
    margin: 32px 0;
    text-align: center;
  }
  .dashboard-cta-footer h3 {
    color: white;
    font-size: 18px;
    margin-bottom: 8px;
  }
  .dashboard-cta-footer p {
    color: #aaa;
    font-size: 14px;
    margin-bottom: 16px;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
  .dashboard-btn-lg {
    display: inline-block;
    background: #00D4AA;
    color: #1a1a2e;
    text-decoration: none;
    font-size: 16px;
    font-weight: 700;
    padding: 12px 28px;
    border-radius: 8px;
    transition: opacity 0.2s;
  }
  .dashboard-btn-lg:hover { opacity: 0.9; }

  .footer {
    text-align: center;
    padding: 32px;
    color: #aaa;
    font-size: 13px;
  }
  .footer a { color: #00D4AA; text-decoration: none; }
</style>
</head>
<body>

<div class="header">
  <h1><span>Serge</span> Report</h1>
  <div class="task">${esc(session.task)}</div>
  <div class="meta">
    <span>${esc(session.domain)}</span>
    <span>${new Date(session.started_at).toLocaleString()}</span>
    <span>${outcomeBadge(session.outcome)}</span>
  </div>
</div>

<div class="container">

  <div class="section">
    <h2>Summary</h2>
    <div class="section-body">
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">${session.total_steps}</div>
          <div class="stat-label">Total Steps</div>
        </div>
        <div class="stat">
          <div class="stat-value">${formatDuration(session.total_duration_ms)}</div>
          <div class="stat-label">Total Time</div>
        </div>
        <div class="stat">
          <div class="stat-value">${session.actions.filter(a => !a.result.success).length}</div>
          <div class="stat-label">Failures</div>
        </div>
        <div class="stat">
          <div class="stat-value">${session.network.length}</div>
          <div class="stat-label">Network Requests</div>
        </div>
      </div>
      ${session.notes ? `<p style="margin-top: 16px; color: #666; font-size: 14px;">${esc(session.notes)}</p>` : ''}
    </div>
  </div>

  <div class="dashboard-cta">
    <span>Track this over time</span>
    <a href="${dashboardUrl(session)}" target="_blank" rel="noopener noreferrer" class="dashboard-btn">Save to Dashboard &rarr;</a>
  </div>

  <div class="section">
    <h2>Step-by-Step Timeline</h2>
    <div class="section-body">
      ${stepsHtml}
    </div>
  </div>

  <div class="section">
    <h2>Findings</h2>
    <div class="section-body">
      <ul class="findings-list">
        ${findingsHtml}
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Network Summary</h2>
    <div class="section-body">
      <div class="stats-grid" style="margin-bottom: 16px;">
        <div class="stat">
          <div class="stat-value">${session.network.length}</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="stat">
          <div class="stat-value">${(totalNetworkSize / 1_000_000).toFixed(1)} MB</div>
          <div class="stat-label">Total Weight</div>
        </div>
        <div class="stat">
          <div class="stat-value">${session.network.filter(n => n.status >= 400).length}</div>
          <div class="stat-label">Errors</div>
        </div>
      </div>
      ${slowestResources.length > 0 ? `
      <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #888;">Slowest Resources</h3>
      <table>
        <thead><tr><th>Method</th><th>URL</th><th>Status</th><th>Time</th><th>Size</th></tr></thead>
        <tbody>${networkRows}</tbody>
      </table>` : ''}
    </div>
  </div>

</div>

<div class="container">
  <div class="dashboard-cta-footer">
    <h3>Track your agent readiness over time</h3>
    <p>Save this report to your Serge dashboard to compare runs, monitor improvements, and share findings with your team.</p>
    <a href="${dashboardUrl(session)}" target="_blank" rel="noopener noreferrer" class="dashboard-btn-lg">Save to Serge Dashboard &rarr;</a>
  </div>
</div>

<div class="footer">
  Generated by <a href="https://serge.ai" target="_blank" rel="noopener noreferrer">Serge</a>
</div>

<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <img id="lightbox-img" src="" alt="Screenshot" />
</div>

<script>
  // Collapsible sections
  document.querySelectorAll('.section h2').forEach(h2 => {
    h2.addEventListener('click', () => {
      h2.parentElement.classList.toggle('collapsed');
    });
  });

  // Lightbox
  function openLightbox(el) {
    const img = el.querySelector('img');
    document.getElementById('lightbox-img').src = img.src;
    document.getElementById('lightbox').classList.add('active');
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
</script>

</body>
</html>`;
}

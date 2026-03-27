#!/usr/bin/env node

import { startServer } from './server.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

async function runReport() {
  const { getLatestReportPath } = await import('./report/generator.js');
  const reportPath = await getLatestReportPath();

  if (!reportPath) {
    console.log('No reports found. Run a session in Claude Desktop first.');
    process.exit(1);
  }

  console.log(`Opening report: ${reportPath}`);
  const open = (await import('open')).default;
  await open(reportPath);
}

async function runHistory() {
  const { listSessions } = await import('./capture/session.js');
  const chalk = (await import('chalk')).default;
  const sessions = await listSessions();

  if (sessions.length === 0) {
    console.log('No sessions found. Use Serge tools in Claude Desktop to create a session.');
    process.exit(0);
  }

  console.log('');
  console.log(chalk.bold('  Serge Sessions'));
  console.log(chalk.gray('  ─'.repeat(40)));
  console.log('');

  for (const session of sessions) {
    const date = new Date(session.started_at).toLocaleDateString();
    const time = new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const duration = session.total_duration_ms > 0
      ? `${(session.total_duration_ms / 1000).toFixed(1)}s`
      : 'in progress';

    let outcomeIcon: string;
    switch (session.outcome) {
      case 'success': outcomeIcon = chalk.green('✓'); break;
      case 'failure': outcomeIcon = chalk.red('✗'); break;
      case 'partial': outcomeIcon = chalk.yellow('~'); break;
      default: outcomeIcon = chalk.gray('?');
    }

    console.log(`  ${outcomeIcon} ${chalk.white(date)} ${chalk.gray(time)}  ${chalk.cyan(session.domain.padEnd(20))}  ${session.task}`);
    console.log(`    ${chalk.gray(`${session.total_steps} steps · ${duration} · ${session.session_id}`)}`);
    console.log('');
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'report':
      await runReport();
      break;
    case 'history':
      await runHistory();
      break;
    default:
      // MCP server mode (default when no args, or launched by Claude Desktop)
      await startServer();
      break;
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

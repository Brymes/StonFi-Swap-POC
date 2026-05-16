import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  DEFAULTS,
  ensureDir,
  extractWalletAddress,
  formatCommand,
  loadOptionalJson,
  mergePreset,
  parseArgs,
  parseModeList,
  projectRootFromHere,
  resolveDeadline,
  toMainnetAddress,
  valueOrDefault,
  writeJson,
  writeText,
} from './common.mjs';

const PROJECT_ROOT = projectRootFromHere(import.meta.url);

function parseJsonOutput(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON output for ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function runLogged({ runDir, counter, label, command, args, allowFailure = false }) {
  const formatted = formatCommand(command, args);
  process.stdout.write(`\n$ ${formatted}\n`);

  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    env: process.env,
    encoding: 'utf8',
  });

  const logPath = path.join(
    runDir,
    `${String(counter).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.log`,
  );

  const logBody = [
    `command: ${formatted}`,
    `cwd: ${PROJECT_ROOT}`,
    `exitCode: ${result.status ?? 'null'}`,
    '',
    'stdout:',
    result.stdout ?? '',
    '',
    'stderr:',
    result.stderr ?? '',
  ].join('\n');

  writeText(logPath, `${logBody}\n`);

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`Command failed: ${formatted}\nSee ${logPath}`);
  }

  return {
    ...result,
    logPath,
    command: formatted,
  };
}

function writeDisabledEmulationLog({ runDir, counter, mode, contractAddress }) {
  const label = `mode-${mode}-emulation-disabled`;
  const logPath = path.join(
    runDir,
    `${String(counter).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.log`,
  );

  const message = [
    `mode: ${mode}`,
    `contractAddress: ${contractAddress}`,
    'status: disabled',
    '',
    'reason:',
    'Local emulation is disabled for existing mainnet contracts.',
    'The existing contract address lives on TON mainnet, but the local emulator does not import that remote account state.',
    'Use the local gates and route resolver before broadcasting the live mainnet smoke command.',
  ].join('\n');

  writeText(logPath, `${message}\n`);

  process.stdout.write(
    `\n# Skipping mode ${mode} emulation: existing mainnet contract is not available in local emulator.\n`,
  );

  return logPath;
}

function buildPresetArgs(preset) {
  return [
    preset.sourceWalletAddress,
    preset.routerWalletAddress,
    preset.tokenWallet1Address,
    preset.firstHopReceiverAddress,
    preset.secondRouterWalletAddress,
    preset.receiverAddress,
    preset.referrerAddress,
    preset.refundAddress,
    preset.excessesAddress,
    preset.fwdGas,
    preset.refundFwdGas,
  ];
}

function buildExecutionArgs(execution, routeMode) {
  return [
    String(routeMode),
    execution.queryId,
    execution.amount,
    execution.forwardTonAmount,
    execution.minOut,
    execution.txDeadline,
  ];
}

function mainnetScriptName(baseName, useTonconnect) {
  return `${baseName}-mainnet${useTonconnect ? '-tonconnect' : ''}`;
}

function buildModePlan({ mode, resolvedRoute, overrides }) {
  const perMode = overrides.modes?.[String(mode)] ?? {};
  const basePreset = resolvedRoute.preset;

  const preset = mergePreset(basePreset, {
    firstHopReceiverAddress:
      perMode.firstHopReceiverAddress ??
      (mode === 0 || mode === 3 ? basePreset.receiverAddress : basePreset.firstHopReceiverAddress),
    secondRouterWalletAddress:
      perMode.secondRouterWalletAddress ?? basePreset.secondRouterWalletAddress,
    tokenWallet1Address: perMode.tokenWallet1Address ?? basePreset.tokenWallet1Address,
    receiverAddress: perMode.receiverAddress ?? basePreset.receiverAddress,
    referrerAddress: perMode.referrerAddress ?? basePreset.referrerAddress,
    refundAddress: perMode.refundAddress ?? basePreset.refundAddress,
    excessesAddress: perMode.excessesAddress ?? basePreset.excessesAddress,
    sourceWalletAddress: perMode.sourceWalletAddress ?? basePreset.sourceWalletAddress,
    routerWalletAddress: perMode.routerWalletAddress ?? basePreset.routerWalletAddress,
    fwdGas: perMode.fwdGas ?? basePreset.fwdGas,
    refundFwdGas: perMode.refundFwdGas ?? basePreset.refundFwdGas,
  });

  const execution = {
    queryId: String(perMode.queryId ?? BigInt(resolvedRoute.execution.queryId) + BigInt(mode)),
    amount: String(perMode.amount ?? resolvedRoute.execution.amount),
    forwardTonAmount: String(perMode.forwardTonAmount ?? resolvedRoute.execution.forwardTonAmount),
    minOut: String(perMode.minOut ?? resolvedRoute.execution.minOut),
    txDeadline: String(perMode.txDeadline ?? resolvedRoute.execution.txDeadline),
  };

  let liveReady = Boolean(resolvedRoute.modes?.[String(mode)]?.liveReady);
  let liveReason =
    resolvedRoute.modes?.[String(mode)]?.reason ?? 'No live route status provided by resolver.';

  if (mode === 1 || mode === 2) {
    if (perMode.liveReady === true) {
      liveReady = true;
      liveReason = perMode.liveReason ?? 'Live route provided via overrides file.';
    } else {
      liveReady = false;
      liveReason = 'Mainnet cross-swap modes require an explicit per-mode override.';
    }
  }

  if (mode === 3 && perMode.liveReady === false) {
    liveReady = false;
    liveReason = perMode.liveReason ?? 'Live refund route disabled in overrides file.';
  }

  return { mode, preset, execution, liveReady, liveReason };
}

function renderSummary({
  walletName,
  ownerAddress,
  contractAddress,
  runDir,
  modeResults,
  resolvedRoute,
  useTonconnect,
}) {
  const lines = [
    '# Mainnet Validation Summary',
    '',
    `- Run directory: \`${runDir}\``,
    `- Wallet name: \`${walletName}\``,
    `- TonConnect: \`${useTonconnect ? 'enabled' : 'disabled'}\``,
    `- Owner address: \`${ownerAddress}\``,
    `- Contract address: \`${contractAddress}\``,
    `- Source wallet: \`${resolvedRoute.preset.sourceWalletAddress}\``,
    `- Router address: \`${resolvedRoute.preset.routerWalletAddress}\``,
    `- Token wallet 1: \`${resolvedRoute.preset.tokenWallet1Address}\``,
    '',
    '## Modes',
    '',
  ];

  for (const modeResult of modeResults) {
    lines.push(
      `- Mode ${modeResult.mode}: emulation=${modeResult.emulationStatus}, live=${modeResult.liveStatus}${modeResult.liveReason ? ` (${modeResult.liveReason})` : ''}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.TONCENTER_MAINNET_API_KEY) {
    throw new Error(
      'TONCENTER_MAINNET_API_KEY is required. Run this harness with node --env-file=.env or export the key first.',
    );
  }

  const routeModes = parseModeList(args['route-modes'] ?? DEFAULTS.routeModes);
  const skipLive = args['skip-live'] === 'true';
  const useTonconnect = args.tonconnect !== 'false';

  if (!skipLive && args['confirm-mainnet'] !== 'true') {
    throw new Error(
      'Mainnet broadcast is disabled until you pass --confirm-mainnet true. Use --skip-live true for read-only route/log validation.',
    );
  }

  const runDir = path.join(
    PROJECT_ROOT,
    'build',
    'mainnet',
    new Date().toISOString().replaceAll(':', '-'),
  );

  ensureDir(runDir);

  const routeOverrides = loadOptionalJson(args['route-overrides']);
  const walletName = args['wallet-name'] ?? DEFAULTS.walletName;
  const logState = { counter: 1 };

  const walletListRes = runLogged({
    runDir,
    counter: logState.counter++,
    label: 'wallet-list',
    command: 'acton',
    args: ['wallet', 'list', '--json'],
  });

  const walletList = parseJsonOutput(walletListRes.stdout, 'wallet list');
  const wallets = Array.isArray(walletList.wallets) ? walletList.wallets : [];
  const walletRecord =
    wallets.find((entry) => entry?.name === walletName) ??
    wallets.find((entry) => entry?.alias === walletName);

  if (!walletRecord) {
    throw new Error(
      `Wallet '${walletName}' was not found. Create or import it with Acton, then fund its mainnet address.`,
    );
  }

  const ownerAddress = args['owner-address']
    ? toMainnetAddress(args['owner-address'])
    : toMainnetAddress(extractWalletAddress(walletRecord));
  const receiverAddress = args['receiver-address']
    ? toMainnetAddress(args['receiver-address'])
    : ownerAddress;
  const referrerAddress = args['referrer-address']
    ? toMainnetAddress(args['referrer-address'])
    : ownerAddress;
  const refundAddress = args['refund-address'] ? toMainnetAddress(args['refund-address']) : ownerAddress;
  const excessesAddress = args['excesses-address']
    ? toMainnetAddress(args['excesses-address'])
    : ownerAddress;
  const txDeadline = resolveDeadline(args);

  for (const [command, commandArgs] of [
    ['acton', ['build']],
    ['acton', ['test']],
    ['npm', ['run', 'typecheck']],
    ['npm', ['run', 'build']],
  ]) {
    runLogged({
      runDir,
      counter: logState.counter++,
      label: `${command}-${commandArgs.join('-')}`,
      command,
      args: commandArgs,
    });
  }

  let contractAddress = args['contract-address'] ? toMainnetAddress(args['contract-address']) : null;

  if (!contractAddress) {
    if (skipLive) {
      throw new Error('Pass --contract-address when using --skip-live true; deployment is a live mainnet action.');
    }

    const deployRes = runLogged({
      runDir,
      counter: logState.counter++,
      label: 'deploy-mainnet',
      command: 'acton',
      args: ['run', mainnetScriptName('stonfi-swap', useTonconnect)],
    });

    const match = deployRes.stdout.match(/Deployed StonFiSwap to (\S+)/);

    if (!match) {
      throw new Error(`Could not parse deployed contract address from ${deployRes.logPath}`);
    }

    contractAddress = toMainnetAddress(match[1]);
  }

  runLogged({
    runDir,
    counter: logState.counter++,
    label: 'rpc-contract-info',
    command: 'acton',
    args: ['rpc', 'info', contractAddress, '--net', 'mainnet'],
  });

  const resolveRouteArgs = [
    '--env-file=.env',
    'scripts/mainnet/resolve-mode0-route.mjs',
    '--contract-address',
    contractAddress,
    '--owner-address',
    ownerAddress,
    '--receiver-address',
    receiverAddress,
    '--referrer-address',
    referrerAddress,
    '--refund-address',
    refundAddress,
    '--excesses-address',
    excessesAddress,
    '--fwd-gas',
    valueOrDefault(args['fwd-gas'], DEFAULTS.fwdGas),
    '--refund-fwd-gas',
    valueOrDefault(args['refund-fwd-gas'], DEFAULTS.refundFwdGas),
    '--amount',
    valueOrDefault(args.amount, DEFAULTS.amount),
    '--forward-ton-amount',
    valueOrDefault(args['forward-ton-amount'], DEFAULTS.forwardTonAmount),
    '--query-id',
    valueOrDefault(args['query-id'], DEFAULTS.queryId),
    '--tx-deadline',
    txDeadline,
    '--offer-jetton-address',
    valueOrDefault(args['offer-jetton-address'], DEFAULTS.offerJettonAddress),
    '--ask-asset-address',
    valueOrDefault(args['ask-asset-address'], DEFAULTS.askAssetAddress),
    '--slippage-tolerance',
    valueOrDefault(args['slippage-tolerance'], DEFAULTS.slippageTolerance),
    '--referral-fee-bps',
    valueOrDefault(args['referral-fee-bps'], DEFAULTS.referralFeeBps),
  ];

  if (args['min-out'] !== undefined && args['min-out'] !== '') {
    resolveRouteArgs.push('--min-out', args['min-out']);
  }
  if (args['pool-address'] !== undefined && args['pool-address'] !== '') {
    resolveRouteArgs.push('--pool-address', args['pool-address']);
  }

  const resolveRouteRes = runLogged({
    runDir,
    counter: logState.counter++,
    label: 'resolve-mode0-route',
    command: 'node',
    args: resolveRouteArgs,
  });

  const resolvedRoute = parseJsonOutput(resolveRouteRes.stdout, 'resolve mode 0 route');

  writeJson(path.join(runDir, 'manifest.json'), {
    ownerAddress,
    contractAddress,
    resolvedRoute,
    routeOverrides,
  });

  runLogged({
    runDir,
    counter: logState.counter++,
    label: 'check-jetton-wallet',
    command: 'node',
    args: [
      '--env-file=.env',
      'scripts/mainnet/check-jetton-wallet.mjs',
      '--wallet-address',
      resolvedRoute.preset.sourceWalletAddress,
      '--owner-address',
      contractAddress,
      '--jetton-master-address',
      resolvedRoute.assets.offerJettonAddress,
      '--require-balance',
      'true',
    ],
  });

  runLogged({
    runDir,
    counter: logState.counter++,
    label: 'rpc-source-wallet-info',
    command: 'acton',
    args: ['rpc', 'info', resolvedRoute.preset.sourceWalletAddress, '--net', 'mainnet'],
  });

  if (!skipLive) {
    runLogged({
      runDir,
      counter: logState.counter++,
      label: 'setup-existing-mainnet',
      command: 'acton',
      args: [
        'run',
        mainnetScriptName('stonfi-swap-setup-existing', useTonconnect),
        contractAddress,
        ...buildPresetArgs(resolvedRoute.preset),
      ],
    });
  }

  const modeResults = [];

  for (const mode of routeModes) {
    const modePlan = buildModePlan({ mode, resolvedRoute, overrides: routeOverrides });

    writeDisabledEmulationLog({
      runDir,
      counter: logState.counter++,
      mode,
      contractAddress,
    });

    let liveStatus = 'skipped';

    if (!skipLive && modePlan.liveReady) {
      runLogged({
        runDir,
        counter: logState.counter++,
        label: `mode-${mode}-live`,
        command: 'acton',
        args: [
          'run',
          mainnetScriptName('stonfi-swap-smoke-existing', useTonconnect),
          contractAddress,
          ...buildPresetArgs(modePlan.preset),
          ...buildExecutionArgs(modePlan.execution, mode),
        ],
      });

      liveStatus = 'attempted';
    }

    modeResults.push({
      mode,
      emulationStatus: 'disabled',
      liveStatus,
      liveReason: modePlan.liveReady ? modePlan.liveReason : `Skipped: ${modePlan.liveReason}`,
    });
  }

  writeText(
    path.join(runDir, 'summary.md'),
    renderSummary({
      walletName,
      ownerAddress,
      contractAddress,
      runDir,
      modeResults,
      resolvedRoute,
      useTonconnect,
    }),
  );

  process.stdout.write(`\nValidation logs saved to ${runDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

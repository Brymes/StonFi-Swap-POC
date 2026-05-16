import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Address } from '@ton/core';

export const DEFAULTS = {
  walletName: 'deployer',
  routerAddress: 'kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v',
  proxyTonAddress: 'kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px',
  offerJettonAddress: 'kQDLvsZol3juZyOAVG8tWsJntOxeEZWEaWCbbSjYakQpuYN5',
  askJettonAddress: 'kQB_TOJSB7q3-Jm1O8s0jKFtqLElZDPjATs5uJGsujcjznq3',
  fwdGas: '30000000',
  refundFwdGas: '10000000',
  amount: '1000000',
  forwardTonAmount: '30000000',
  minOut: '1',
  queryId: '42',
  deadlineSeconds: 3600,
  routeModes: '0,1,2,3',
};

export function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    if (withoutPrefix.length === 0) {
      continue;
    }

    const eqIndex = withoutPrefix.indexOf('=');
    if (eqIndex >= 0) {
      const key = withoutPrefix.slice(0, eqIndex);
      const value = withoutPrefix.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[withoutPrefix] = next;
      i += 1;
      continue;
    }

    args[withoutPrefix] = 'true';
  }

  return args;
}

export function requireArg(args, name) {
  const value = args[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required argument --${name}`);
  }
  return value;
}

export function normalizeAddress(value, fieldName = 'address') {
  try {
    return Address.parse(value);
  } catch (error) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
}

export function toTestnetAddress(value) {
  const address = value instanceof Address ? value : normalizeAddress(value);
  return address.toString({ testOnly: true });
}

export function maybeAddress(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    return toTestnetAddress(value);
  } catch {
    return null;
  }
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadOptionalJson(filePath) {
  if (!filePath) {
    return {};
  }
  return readJsonFile(filePath);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeText(filePath, value) {
  fs.writeFileSync(filePath, value, 'utf8');
}

export function timestampForDir(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
}

export function shellQuote(value) {
  if (value === '') {
    return "''";
  }

  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function formatCommand(command, args = []) {
  return [command, ...args].map((item) => shellQuote(String(item))).join(' ');
}

export function bigintString(value) {
  return typeof value === 'bigint' ? value.toString() : String(value);
}

export function parseModeList(value) {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 3);
}

export function extractWalletAddress(wallet) {
  const preferredKeys = [
    'address',
    'walletAddress',
    'wallet_address',
    'accountAddress',
    'account_address',
  ];

  for (const key of preferredKeys) {
    const parsed = maybeAddress(wallet?.[key]);
    if (parsed) {
      return parsed;
    }
  }

  for (const value of Object.values(wallet ?? {})) {
    const parsed = maybeAddress(value);
    if (parsed) {
      return parsed;
    }
  }

  throw new Error('Unable to find a wallet address in acton wallet list --json output');
}

export function resolveDeadline(args) {
  if (args['tx-deadline']) {
    return String(args['tx-deadline']);
  }

  const now = Math.floor(Date.now() / 1000);
  return String(now + DEFAULTS.deadlineSeconds);
}

export function resolveAddressArg(args, key, fallback) {
  if (args[key]) {
    return toTestnetAddress(args[key]);
  }
  return toTestnetAddress(fallback);
}

export function mergePreset(basePreset, overrides = {}) {
  return {
    ...basePreset,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null),
    ),
  };
}

export function projectRootFromHere(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), '..', '..');
}

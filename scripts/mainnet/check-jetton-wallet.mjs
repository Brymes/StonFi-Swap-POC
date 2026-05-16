import { TonClient } from '@ton/ton';

import {
  normalizeAddress,
  parseArgs,
  requireArg,
  toMainnetAddress,
} from './common.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const walletAddress = normalizeAddress(requireArg(args, 'wallet-address'), 'wallet-address');
  const expectedOwnerAddress = args['owner-address']
    ? normalizeAddress(args['owner-address'], 'owner-address')
    : null;
  const expectedJettonMasterAddress = args['jetton-master-address']
    ? normalizeAddress(args['jetton-master-address'], 'jetton-master-address')
    : null;
  const requireBalance = args['require-balance'] === 'true';

  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_MAINNET_API_KEY,
  });

  const accountState = await client.getContractState(walletAddress);
  if (accountState.state !== 'active') {
    const output = {
      walletAddress: toMainnetAddress(walletAddress),
      accountState: accountState.state,
      tonBalance: accountState.balance.toString(),
      lastTransaction: accountState.lastTransaction,
      ownerAddress: expectedOwnerAddress ? toMainnetAddress(expectedOwnerAddress) : null,
      jettonMasterAddress: expectedJettonMasterAddress
        ? toMainnetAddress(expectedJettonMasterAddress)
        : null,
      hasBalance: false,
    };

    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    throw new Error(
      `Jetton wallet ${output.walletAddress} is ${accountState.state}. Send the source jetton to the owner contract address first, then rerun this check after the wallet is active.`,
    );
  }

  let result;
  try {
    result = await client.runMethod(walletAddress, 'get_wallet_data');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('exit_code: -13')) {
      throw new Error(
        `Jetton wallet ${toMainnetAddress(walletAddress)} is active but get_wallet_data failed with exit_code -13. This usually means the address is not a standard jetton wallet for the requested master/owner, or TonCenter cannot execute the getter yet. Re-resolve the route and confirm USDT was sent to ${expectedOwnerAddress ? toMainnetAddress(expectedOwnerAddress) : 'the contract owner address'}.`,
      );
    }
    throw error;
  }
  const balance = result.stack.readBigNumber();
  const owner = result.stack.readAddress();
  const jetton = result.stack.readAddress();

  const output = {
    walletAddress: toMainnetAddress(walletAddress),
    balance: balance.toString(),
    ownerAddress: toMainnetAddress(owner),
    jettonMasterAddress: toMainnetAddress(jetton),
    matchesExpectedOwner:
      expectedOwnerAddress === null ||
      toMainnetAddress(owner) === toMainnetAddress(expectedOwnerAddress),
    matchesExpectedJettonMaster:
      expectedJettonMasterAddress === null ||
      toMainnetAddress(jetton) === toMainnetAddress(expectedJettonMasterAddress),
    hasBalance: balance > 0n,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!output.matchesExpectedOwner) {
    throw new Error(
      `Jetton wallet owner ${output.ownerAddress} does not match expected ${toMainnetAddress(expectedOwnerAddress)}`,
    );
  }
  if (!output.matchesExpectedJettonMaster) {
    throw new Error(
      `Jetton master ${output.jettonMasterAddress} does not match expected ${toMainnetAddress(expectedJettonMasterAddress)}`,
    );
  }
  if (requireBalance && !output.hasBalance) {
    throw new Error(`Jetton wallet ${output.walletAddress} has zero balance`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

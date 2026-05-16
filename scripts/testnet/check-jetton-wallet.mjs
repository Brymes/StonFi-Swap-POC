import { TonClient } from '@ton/ton';

import {
  normalizeAddress,
  parseArgs,
  requireArg,
  toTestnetAddress,
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
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_TESTNET_API_KEY,
  });

  const result = await client.runMethod(walletAddress, 'get_wallet_data');
  const balance = result.stack.readBigNumber();
  const owner = result.stack.readAddress();
  const jetton = result.stack.readAddress();

  const output = {
    walletAddress: toTestnetAddress(walletAddress),
    balance: balance.toString(),
    ownerAddress: toTestnetAddress(owner),
    jettonMasterAddress: toTestnetAddress(jetton),
    matchesExpectedOwner:
      expectedOwnerAddress === null ||
      toTestnetAddress(owner) === toTestnetAddress(expectedOwnerAddress),
    matchesExpectedJettonMaster:
      expectedJettonMasterAddress === null ||
      toTestnetAddress(jetton) === toTestnetAddress(expectedJettonMasterAddress),
    hasBalance: balance > 0n,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!output.matchesExpectedOwner) {
    throw new Error(
      `Jetton wallet owner ${output.ownerAddress} does not match expected ${toTestnetAddress(expectedOwnerAddress)}`,
    );
  }
  if (!output.matchesExpectedJettonMaster) {
    throw new Error(
      `Jetton master ${output.jettonMasterAddress} does not match expected ${toTestnetAddress(expectedJettonMasterAddress)}`,
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

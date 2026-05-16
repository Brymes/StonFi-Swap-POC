import { beginCell } from '@ton/core';
import { TonClient } from '@ton/ton';
import { DEX } from '@ston-fi/sdk';

import {
  DEFAULTS,
  normalizeAddress,
  parseArgs,
  requireArg,
  resolveAddressArg,
  resolveDeadline,
  toTestnetAddress,
} from './common.mjs';

function decodeJettonTransfer(cell) {
  const slice = cell.beginParse();
  const op = slice.loadUint(32);
  const queryId = slice.loadUintBig(64);
  const amount = slice.loadCoins();
  const destination = slice.loadAddress();
  const responseDestination = slice.loadAddress();
  const customPayload = slice.loadMaybeRef();
  const forwardTonAmount = slice.loadCoins();
  const forwardPayloadKind = slice.loadBit() ? 'ref' : 'inline';
  const forwardPayload = forwardPayloadKind === 'ref' ? slice.loadRef() : slice.asCell();

  return {
    op,
    queryId,
    amount,
    destination: toTestnetAddress(destination),
    responseDestination: toTestnetAddress(responseDestination),
    customPayloadPresent: customPayload !== null,
    forwardTonAmount,
    forwardPayloadKind,
    forwardPayload,
    forwardPayloadBits: forwardPayload.beginParse().remainingBits,
    forwardPayloadRefs: forwardPayload.beginParse().remainingRefs,
  };
}

function decodeStonFiV2SwapPayload(cell) {
  const slice = cell.beginParse();
  const op = slice.loadUint(32);
  const tokenWallet1 = slice.loadAddress();
  const refundAddress = slice.loadAddress();
  const excessesAddress = slice.loadAddress();
  const txDeadline = slice.loadUintBig(64);
  const routeBody = slice.loadRef();

  return {
    op,
    tokenWallet1: toTestnetAddress(tokenWallet1),
    refundAddress: toTestnetAddress(refundAddress),
    excessesAddress: toTestnetAddress(excessesAddress),
    txDeadline,
    routeBodyBits: routeBody.beginParse().remainingBits,
    routeBodyRefs: routeBody.beginParse().remainingRefs,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contractAddress = normalizeAddress(requireArg(args, 'contract-address'), 'contract-address');
  const ownerAddress = normalizeAddress(
    args['owner-address'] ?? contractAddress.toString({ testOnly: true }),
    'owner-address',
  );
  const receiverAddress = resolveAddressArg(args, 'receiver-address', ownerAddress);
  const referrerAddress = resolveAddressArg(args, 'referrer-address', ownerAddress);
  const refundAddress = resolveAddressArg(args, 'refund-address', ownerAddress);
  const excessesAddress = resolveAddressArg(args, 'excesses-address', ownerAddress);
  const routerAddress = normalizeAddress(
    args['router-address'] ?? DEFAULTS.routerAddress,
    'router-address',
  );
  const offerJettonAddress = normalizeAddress(
    args['offer-jetton-address'] ?? DEFAULTS.offerJettonAddress,
    'offer-jetton-address',
  );
  const askJettonAddress = normalizeAddress(
    args['ask-jetton-address'] ?? DEFAULTS.askJettonAddress,
    'ask-jetton-address',
  );
  const amount = BigInt(args.amount ?? DEFAULTS.amount);
  const forwardTonAmount = BigInt(args['forward-ton-amount'] ?? DEFAULTS.forwardTonAmount);
  const minOut = BigInt(args['min-out'] ?? DEFAULTS.minOut);
  const queryId = BigInt(args['query-id'] ?? DEFAULTS.queryId);
  const fwdGas = BigInt(args['fwd-gas'] ?? DEFAULTS.fwdGas);
  const refundFwdGas = BigInt(args['refund-fwd-gas'] ?? DEFAULTS.refundFwdGas);
  const txDeadline = BigInt(resolveDeadline(args));

  const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_TESTNET_API_KEY,
  });

  const ownerCell = beginCell().storeAddress(contractAddress).endCell();
  const walletResult = await client.runMethod(offerJettonAddress, 'get_wallet_address', [
    { type: 'slice', cell: ownerCell },
  ]);
  const sourceWalletAddress = walletResult.stack.readAddress();

  const router = client.open(DEX.v2_1.Router.CPI.create(routerAddress.toString({ testOnly: true })));
  const txParams = await router.getSwapJettonToJettonTxParams({
    userWalletAddress: contractAddress.toString({ testOnly: true }),
    offerJettonAddress: offerJettonAddress.toString({ testOnly: true }),
    askJettonAddress: askJettonAddress.toString({ testOnly: true }),
    offerAmount: amount,
    minAskAmount: minOut,
    referralAddress: referrerAddress,
    referralValue: 25,
    queryId,
  });

  if (!txParams.body) {
    throw new Error('STON.fi SDK did not return a tx body for the mode 0 route');
  }

  const resolvedSourceWallet = toTestnetAddress(sourceWalletAddress);
  const sdkToAddress = toTestnetAddress(txParams.to);
  if (resolvedSourceWallet !== sdkToAddress) {
    throw new Error(
      `SDK tx.to (${sdkToAddress}) does not match derived source wallet (${resolvedSourceWallet})`,
    );
  }

  const transfer = decodeJettonTransfer(txParams.body);
  const swapPayload = decodeStonFiV2SwapPayload(transfer.forwardPayload);
  const routerWalletAddress = transfer.destination;
  const tokenWallet1Address = args['token-wallet-1-address'] ?? swapPayload.tokenWallet1;
  const firstHopReceiverAddress = args['first-hop-receiver-address'] ?? receiverAddress;
  const secondRouterWalletAddress = args['second-router-wallet-address'] ?? routerWalletAddress;

  const result = {
    network: 'testnet',
    contractAddress: toTestnetAddress(contractAddress),
    ownerAddress: toTestnetAddress(ownerAddress),
    assets: {
      routerAddress: toTestnetAddress(routerAddress),
      proxyTonAddress: DEFAULTS.proxyTonAddress,
      offerJettonAddress: toTestnetAddress(offerJettonAddress),
      askJettonAddress: toTestnetAddress(askJettonAddress),
    },
    preset: {
      sourceWalletAddress: resolvedSourceWallet,
      routerWalletAddress,
      tokenWallet1Address: toTestnetAddress(tokenWallet1Address),
      firstHopReceiverAddress: toTestnetAddress(firstHopReceiverAddress),
      secondRouterWalletAddress: toTestnetAddress(secondRouterWalletAddress),
      receiverAddress: toTestnetAddress(receiverAddress),
      referrerAddress: toTestnetAddress(referrerAddress),
      refundAddress: toTestnetAddress(refundAddress),
      excessesAddress: toTestnetAddress(excessesAddress),
      fwdGas: fwdGas.toString(),
      refundFwdGas: refundFwdGas.toString(),
    },
    execution: {
      routeMode: 0,
      queryId: queryId.toString(),
      amount: amount.toString(),
      forwardTonAmount: forwardTonAmount.toString(),
      minOut: minOut.toString(),
      txDeadline: txDeadline.toString(),
    },
    sdk: {
      txTo: sdkToAddress,
      txValue: txParams.value.toString(),
      transfer: {
        op: `0x${transfer.op.toString(16)}`,
        queryId: transfer.queryId.toString(),
        amount: transfer.amount.toString(),
        destination: transfer.destination,
        responseDestination: transfer.responseDestination,
        customPayloadPresent: transfer.customPayloadPresent,
        forwardTonAmount: transfer.forwardTonAmount.toString(),
        forwardPayloadKind: transfer.forwardPayloadKind,
        forwardPayloadBits: transfer.forwardPayloadBits,
        forwardPayloadRefs: transfer.forwardPayloadRefs,
      },
      swapPayload: {
        op: `0x${swapPayload.op.toString(16)}`,
        tokenWallet1: swapPayload.tokenWallet1,
        refundAddress: swapPayload.refundAddress,
        excessesAddress: swapPayload.excessesAddress,
        txDeadline: swapPayload.txDeadline.toString(),
        routeBodyBits: swapPayload.routeBodyBits,
        routeBodyRefs: swapPayload.routeBodyRefs,
      },
    },
    modes: {
      '0': {
        liveReady: true,
        reason: 'Derived from STON.fi SDK testnet jetton-to-jetton transaction parameters.',
      },
      '1': {
        liveReady: false,
        reason: 'No cross-swap intermediate route was discovered automatically.',
      },
      '2': {
        liveReady: false,
        reason: 'No multi-router route was discovered automatically.',
      },
      '3': {
        liveReady: true,
        reason: 'Refund route reuses the same mode 0 source and router wallet path.',
      },
    },
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

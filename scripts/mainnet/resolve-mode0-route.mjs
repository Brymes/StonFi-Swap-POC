import { beginCell } from '@ton/core';
import { TonClient } from '@ton/ton';
import { StonApiClient } from '@ston-fi/api';
import { dexFactory } from '@ston-fi/sdk';

import {
  DEFAULTS,
  formatAssetAddress,
  isTonAsset,
  normalizeAddress,
  parseArgs,
  requireArg,
  resolveAddressArg,
  resolveDeadline,
  toMainnetAddress,
  valueOrDefault,
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
    destination: toMainnetAddress(destination),
    responseDestination: toMainnetAddress(responseDestination),
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
    tokenWallet1: toMainnetAddress(tokenWallet1),
    refundAddress: toMainnetAddress(refundAddress),
    excessesAddress: toMainnetAddress(excessesAddress),
    txDeadline,
    routeBodyBits: routeBody.beginParse().remainingBits,
    routeBodyRefs: routeBody.beginParse().remainingRefs,
  };
}

async function getJettonWalletAddress(client, jettonAddress, ownerAddress) {
  const ownerCell = beginCell().storeAddress(ownerAddress).endCell();
  const walletResult = await client.runMethod(jettonAddress, 'get_wallet_address', [
    { type: 'slice', cell: ownerCell },
  ]);
  return walletResult.stack.readAddress();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contractAddress = normalizeAddress(requireArg(args, 'contract-address'), 'contract-address');
  const ownerAddress = normalizeAddress(
    args['owner-address'] ?? contractAddress.toString({ testOnly: false }),
    'owner-address',
  );
  const receiverAddress = resolveAddressArg(args, 'receiver-address', ownerAddress);
  const referrerAddress = resolveAddressArg(args, 'referrer-address', ownerAddress);
  const refundAddress = resolveAddressArg(args, 'refund-address', ownerAddress);
  const excessesAddress = resolveAddressArg(args, 'excesses-address', ownerAddress);
  const offerJettonAddress = normalizeAddress(
    valueOrDefault(
      valueOrDefault(args['offer-jetton-address'], args['offer-address']),
      DEFAULTS.offerJettonAddress,
    ),
    'offer-jetton-address',
  );
  const askAssetAddress = formatAssetAddress(
    valueOrDefault(
      valueOrDefault(args['ask-asset-address'], args['ask-jetton-address']),
      DEFAULTS.askAssetAddress,
    ),
  );
  const amount = BigInt(valueOrDefault(args.amount, DEFAULTS.amount));
  const forwardTonAmount = BigInt(
    valueOrDefault(args['forward-ton-amount'], DEFAULTS.forwardTonAmount),
  );
  const queryId = BigInt(valueOrDefault(args['query-id'], DEFAULTS.queryId));
  const fwdGas = BigInt(valueOrDefault(args['fwd-gas'], DEFAULTS.fwdGas));
  const refundFwdGas = BigInt(valueOrDefault(args['refund-fwd-gas'], DEFAULTS.refundFwdGas));
  const txDeadline = BigInt(resolveDeadline(args));
  const slippageTolerance = String(
    valueOrDefault(args['slippage-tolerance'], DEFAULTS.slippageTolerance),
  );
  const referralFeeBps = String(valueOrDefault(args['referral-fee-bps'], DEFAULTS.referralFeeBps));

  if (isTonAsset(offerJettonAddress.toString({ testOnly: false }))) {
    throw new Error('StonFiSwap can only initiate mode 0 from a source jetton wallet; TON offers are unsupported.');
  }

  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_MAINNET_API_KEY,
  });
  const apiClient = new StonApiClient();

  const simulation = await apiClient.simulateSwap({
    offerAddress: toMainnetAddress(offerJettonAddress),
    askAddress: askAssetAddress,
    offerUnits: amount.toString(),
    slippageTolerance,
    referralAddress: toMainnetAddress(referrerAddress),
    referralFeeBps,
    dexV2: true,
    dexVersion: [2],
    ...(args['pool-address'] ? { poolAddress: toMainnetAddress(args['pool-address']) } : {}),
  });

  const minOut = BigInt(valueOrDefault(args['min-out'], simulation.minAskUnits));
  const sourceWalletAddress = await getJettonWalletAddress(
    client,
    offerJettonAddress,
    contractAddress,
  );
  const dexContracts = dexFactory(simulation.router);
  const router = client.open(dexContracts.Router.create(simulation.router.address));

  const txParamsBase = {
    userWalletAddress: toMainnetAddress(contractAddress),
    offerJettonAddress: toMainnetAddress(offerJettonAddress),
    offerAmount: BigInt(simulation.offerUnits),
    minAskAmount: minOut,
    receiverAddress,
    refundAddress,
    excessesAddress,
    transferExcessAddress: excessesAddress,
    referralAddress: referrerAddress,
    referralValue: BigInt(referralFeeBps),
    dexCustomPayloadForwardGasAmount: fwdGas,
    refundForwardGasAmount: refundFwdGas,
    forwardGasAmount: forwardTonAmount,
    queryId,
    deadline: txDeadline,
  };

  const txParams = isTonAsset(askAssetAddress)
    ? await router.getSwapJettonToTonTxParams({
      ...txParamsBase,
      proxyTon: dexContracts.pTON.create(simulation.router.ptonMasterAddress),
    })
    : await router.getSwapJettonToJettonTxParams({
      ...txParamsBase,
      askJettonAddress: formatAssetAddress(simulation.askAddress),
    });

  if (!txParams.body) {
    throw new Error('STON.fi SDK did not return a tx body for the mode 0 route');
  }

  const resolvedSourceWallet = toMainnetAddress(sourceWalletAddress);
  const sdkToAddress = toMainnetAddress(txParams.to);
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
  const secondRouterWalletAddress = args['second-router-wallet-address'] ?? tokenWallet1Address;

  const result = {
    network: 'mainnet',
    contractAddress: toMainnetAddress(contractAddress),
    ownerAddress: toMainnetAddress(ownerAddress),
    assets: {
      offerJettonAddress: toMainnetAddress(offerJettonAddress),
      askAssetAddress,
      routerAddress: toMainnetAddress(simulation.router.address),
      proxyTonAddress: simulation.router.ptonMasterAddress
        ? toMainnetAddress(simulation.router.ptonMasterAddress)
        : null,
      poolAddress: simulation.poolAddress,
    },
    preset: {
      sourceWalletAddress: resolvedSourceWallet,
      routerWalletAddress,
      tokenWallet1Address: toMainnetAddress(tokenWallet1Address),
      firstHopReceiverAddress: toMainnetAddress(firstHopReceiverAddress),
      secondRouterWalletAddress: toMainnetAddress(secondRouterWalletAddress),
      receiverAddress: toMainnetAddress(receiverAddress),
      referrerAddress: toMainnetAddress(referrerAddress),
      refundAddress: toMainnetAddress(refundAddress),
      excessesAddress: toMainnetAddress(excessesAddress),
      fwdGas: fwdGas.toString(),
      refundFwdGas: refundFwdGas.toString(),
    },
    execution: {
      routeMode: 0,
      queryId: queryId.toString(),
      amount: simulation.offerUnits,
      forwardTonAmount: forwardTonAmount.toString(),
      minOut: minOut.toString(),
      txDeadline: txDeadline.toString(),
    },
    simulation: {
      askUnits: simulation.askUnits,
      minAskUnits: simulation.minAskUnits,
      recommendedMinAskUnits: simulation.recommendedMinAskUnits,
      priceImpact: simulation.priceImpact,
      swapRate: simulation.swapRate,
      slippageTolerance: simulation.slippageTolerance,
      gasParams: simulation.gasParams,
      router: simulation.router,
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
        reason: 'Derived from STON.fi mainnet API simulation and SDK transaction parameters.',
      },
      '1': {
        liveReady: false,
        reason: 'No same-router cross-swap route is discovered automatically on mainnet.',
      },
      '2': {
        liveReady: false,
        reason: 'No multi-router route is discovered automatically on mainnet.',
      },
      '3': {
        liveReady: true,
        reason: 'Refund route reuses the same mode 0 source and router path.',
      },
    },
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

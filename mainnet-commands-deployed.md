# Commands to run with already deployed contract 

You are swapping through the deployed StonFiSwap contract, so the USDT must be deposited into the contract first. Your wallet holding USDT is only the
  funding wallet; the contract cannot spend USDT that remains in your wallet.

  Send 1.69 USDT to this contract address, not to SOURCE_WALLET:

  EQCJHC7wy5LNGpXP830aDw-HtgDS7zl1y-HRz95AWojMleA9

  Fresh-shell runbook:

  Required variables you provide manually: STONFI_CONTRACT, OWNER_ADDRESS, USDT_MASTER, ASK_ASSET, SWAP_AMOUNT.

  Variables derived by route resolver: SOURCE_WALLET, ROUTER_ADDRESS, TOKEN_WALLET_1, FIRST_HOP_RECEIVER, SECOND_ROUTER_WALLET, MIN_OUT, TX_DEADLINE.

  cd /Users/brymes/Repositories/Orgs/redacted/first_counter

export STONFI_CONTRACT="EQCJHC7wy5LNGpXP830aDw-HtgDS7zl1y-HRz95AWojMleA9"
export OWNER_ADDRESS="EQAtt4j-kf0F5rRWNcrDEVRQ_9S-6-FA48MnE5289OmdOhY_"
export USDT_MASTER="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
export ASK_ASSET="ton"
export SWAP_AMOUNT="1690000"
export FORWARD_TON_AMOUNT=240000000
export FWD_GAS=30000000
export REFUND_FWD_GAS=10000000
export QUERY_ID=$(date +%s)


  Check prerequisites:

  node --env-file=.env -e 'if (!process.env.TONCENTER_MAINNET_API_KEY) throw new Error("Missing TONCENTER_MAINNET_API_KEY"); console.log("mainnet key ok")'

  acton rpc info "$STONFI_CONTRACT" --net mainnet

  Resolve a fresh route:

  mkdir -p build/mainnet

  export ROUTE_FILE="build/mainnet/manual-1.69-route-$QUERY_ID.json"

  node --env-file=.env scripts/mainnet/resolve-mode0-route.mjs \
    --contract-address "$STONFI_CONTRACT" \
    --owner-address "$OWNER_ADDRESS" \
    --receiver-address "$OWNER_ADDRESS" \
    --referrer-address "$OWNER_ADDRESS" \
    --refund-address "$OWNER_ADDRESS" \
    --excesses-address "$OWNER_ADDRESS" \
    --offer-jetton-address "$USDT_MASTER" \
    --ask-asset-address "$ASK_ASSET" \
    --amount "$SWAP_AMOUNT" \
    --forward-ton-amount "$FORWARD_TON_AMOUNT" \
    --fwd-gas "$FWD_GAS" \
    --refund-fwd-gas "$REFUND_FWD_GAS" \
    --query-id "$QUERY_ID" | tee "$ROUTE_FILE"

  Export the route values:

  eval "$(node -e '
  const fs = require("fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const p = r.preset;
  const e = r.execution;
  console.log(`export SOURCE_WALLET=${p.sourceWalletAddress}`);
  console.log(`export ROUTER_ADDRESS=${p.routerWalletAddress}`);
  console.log(`export TOKEN_WALLET_1=${p.tokenWallet1Address}`);
  console.log(`export FIRST_HOP_RECEIVER=${p.firstHopReceiverAddress}`);
  console.log(`export SECOND_ROUTER_WALLET=${p.secondRouterWalletAddress}`);
  console.log(`export MIN_OUT=${e.minOut}`);
  console.log(`export TX_DEADLINE=${e.txDeadline}`);
  ' "$ROUTE_FILE")"

  Now send 1.69 USDT from your wallet app to:

  echo "$STONFI_CONTRACT"

  After the wallet transfer confirms, verify the contract-owned USDT wallet:

  npm run mainnet:check-jetton-wallet -- \
    --wallet-address "$SOURCE_WALLET" \
    --owner-address "$STONFI_CONTRACT" \
    --jetton-master-address "$USDT_MASTER" \
    --require-balance true

  The output must show:

  "balance": "1690000"

  or higher.

  Store the route preset:

  acton run stonfi-swap-setup-existing-mainnet-tonconnect \
    "$STONFI_CONTRACT" \
    "$SOURCE_WALLET" \
    "$ROUTER_ADDRESS" \
    "$TOKEN_WALLET_1" \
    "$FIRST_HOP_RECEIVER" \
    "$SECOND_ROUTER_WALLET" \
    "$OWNER_ADDRESS" \
    "$OWNER_ADDRESS" \
    "$OWNER_ADDRESS" \
    "$OWNER_ADDRESS" \
    "$FWD_GAS" \
    "$REFUND_FWD_GAS"

  Run the actual 1.69 USDT swap:

  acton run stonfi-swap-smoke-existing-mainnet-tonconnect \
    "$STONFI_CONTRACT" \
    "$SOURCE_WALLET" \
    "$ROUTER_ADDRESS" \
    "$TOKEN_WALLET_1" \
    "$FIRST_HOP_RECEIVER" \
    "$SECOND_ROUTER_WALLET" \
    "$OWNER_ADDRESS" \
    "$OWNER_ADDRESS" \
    "$OWNER_ADDRESS" \
    "$OWNER_ADDRESS" \
    "$FWD_GAS" \
    "$REFUND_FWD_GAS" \
    0 \
    "$QUERY_ID" \
    "$SWAP_AMOUNT" \
    "$FORWARD_TON_AMOUNT" \
    "$MIN_OUT" \
    "$TX_DEADLINE"



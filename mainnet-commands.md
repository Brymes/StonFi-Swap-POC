# Mainnet Commands for `StonFiSwap`

This runbook is for real TON mainnet. Every command with `--net mainnet` can spend real TON and real tokens.

The first supported live path is route mode `0`: USDT jetton to another asset through STON.fi. The default example uses USDT to TON because STON.fi mainnet liquidity is available through the API-driven flow.

## 0. Mainnet Defaults

```bash
export WALLET_NAME=deployer
export USDT_MASTER=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
export ASK_ASSET=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c
export SWAP_AMOUNT=100000
export FORWARD_TON_AMOUNT=240000000
export FWD_GAS=30000000
export REFUND_FWD_GAS=10000000
export QUERY_ID=42
```

`ASK_ASSET` is the canonical STON.fi API address for native TON. The resolver also accepts `ton` as a shorthand, but it sends the canonical address to the API.

`SWAP_AMOUNT=100000` means `0.1 USDT` because USDT has 6 decimals.

Check that the defaults are present in your current terminal before step 5:

```bash
printf 'USDT_MASTER=%s\nASK_ASSET=%s\nSWAP_AMOUNT=%s\nFORWARD_TON_AMOUNT=%s\nFWD_GAS=%s\nREFUND_FWD_GAS=%s\nQUERY_ID=%s\n' \
  "$USDT_MASTER" \
  "$ASK_ASSET" \
  "$SWAP_AMOUNT" \
  "$FORWARD_TON_AMOUNT" \
  "$FWD_GAS" \
  "$REFUND_FWD_GAS" \
  "$QUERY_ID"
```

If any line is blank, run the export block above again in the same terminal.

## 1. Configure Mainnet RPC

Use a mainnet TON Center key, not the testnet key.

```bash
printf '\nTONCENTER_MAINNET_API_KEY=your_mainnet_key_here\n' >> .env
```

You can get a mainnet key from `https://toncenter.com/`.

## 2. Prepare a Mainnet Wallet

You do not have to create a brand-new wallet, but a dedicated mainnet wallet is safer.

```bash
acton wallet list --json
```

If you reuse the same mnemonic that you used on testnet, make sure the Acton wallet record has a mainnet address. Acton wallet configs may expose this as `address-mainnet`.

Fund the mainnet wallet with enough TON for deploy, setup, and smoke transactions. Keep extra TON available for STON.fi routing gas.

## 3. Run Local Gates

```bash
acton build
acton test
npm run typecheck
npm run build
```

## 4. Deploy `StonFiSwap` on Mainnet

TonConnect is the safer default for mainnet because you approve each transaction in your wallet UI.

```bash
acton run stonfi-swap-mainnet-tonconnect
```

If you intentionally want to use the local Acton wallet instead:

```bash
acton run stonfi-swap-mainnet
```

Set the deployed contract address from the command output:

```bash
export STONFI_CONTRACT=EQ_REPLACE_WITH_DEPLOYED_CONTRACT
export OWNER_ADDRESS=EQ_REPLACE_WITH_OWNER_MAINNET_ADDRESS
```

## 5. Resolve the STON.fi Mainnet Route

This command is read-only. It calls STON.fi mainnet API simulation, builds the matching SDK transaction, and prints the route preset that the contract needs.

```bash
npm run mainnet:resolve-mode0 -- \
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
  --query-id "$QUERY_ID"
```

From the JSON output, set these values:

```bash
export SOURCE_WALLET=EQ_REPLACE_WITH_PRESET_SOURCE_WALLET
export ROUTER_ADDRESS=EQ_REPLACE_WITH_PRESET_ROUTER_WALLET
export TOKEN_WALLET_1=EQ_REPLACE_WITH_PRESET_TOKEN_WALLET_1
export FIRST_HOP_RECEIVER="$OWNER_ADDRESS"
export SECOND_ROUTER_WALLET="$TOKEN_WALLET_1"
export MIN_OUT=REPLACE_WITH_EXECUTION_MIN_OUT
export TX_DEADLINE=REPLACE_WITH_EXECUTION_TX_DEADLINE
```

## 6. Fund the Contract-Owned USDT Wallet

Send a small amount of real USDT to the deployed contract address. The resolved source wallet is the USDT jetton wallet owned by the contract.

For the default example, send at least `0.1 USDT` to:

```bash
echo "$STONFI_CONTRACT"
```

Then verify the contract-owned USDT wallet:

```bash
npm run mainnet:check-jetton-wallet -- \
  --wallet-address "$SOURCE_WALLET" \
  --owner-address "$STONFI_CONTRACT" \
  --jetton-master-address "$USDT_MASTER" \
  --require-balance true
```

## 7. Store the Route Preset

```bash
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
```

## 8. Run the Live Mainnet Smoke Swap

This broadcasts a real swap using route mode `0`.

```bash
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
```

## 9. Full Harness Option

After the contract is deployed and funded with USDT, this command runs the gates, resolves the route, checks the source wallet, stores the preset, and broadcasts mode `0`.

```bash
npm run mainnet:validate -- \
  --contract-address "$STONFI_CONTRACT" \
  --owner-address "$OWNER_ADDRESS" \
  --receiver-address "$OWNER_ADDRESS" \
  --route-modes 0 \
  --offer-jetton-address "$USDT_MASTER" \
  --ask-asset-address "$ASK_ASSET" \
  --amount "$SWAP_AMOUNT" \
  --forward-ton-amount "$FORWARD_TON_AMOUNT" \
  --confirm-mainnet true
```

For read-only route and log validation, use:

```bash
npm run mainnet:validate -- \
  --contract-address "$STONFI_CONTRACT" \
  --owner-address "$OWNER_ADDRESS" \
  --receiver-address "$OWNER_ADDRESS" \
  --route-modes 0 \
  --offer-jetton-address "$USDT_MASTER" \
  --ask-asset-address "$ASK_ASSET" \
  --amount "$SWAP_AMOUNT" \
  --forward-ton-amount "$FORWARD_TON_AMOUNT" \
  --skip-live true
```

## 10. Optional Verification

```bash
acton verify StonFiSwap --address "$STONFI_CONTRACT" --net mainnet
```

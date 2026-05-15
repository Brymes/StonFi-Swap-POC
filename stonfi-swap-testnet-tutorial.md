# Testing `StonFiSwap` On TON Testnet

This tutorial shows how to test the `StonFiSwap` POC on TON testnet from this repo.

The contract under test is [`contracts/src/StonFiSwap.tolk`](./contracts/s
rc/StonFiSwap.tolk). It does not search STON.fi routes on chain. It receives a route plan from a script, validates it, and emits the jetton transfer message that carries the STON.fi swap payload.

## What You Are Testing

The testnet flow proves three things:

- the contract deploys with your testnet wallet as owner
- the owner can store a route preset
- the owner can make the contract emit one STON.fi swap message for a selected route mode

It does not prove that STON.fi testnet liquidity exists. STON.fi's public API is mainnet-oriented, so testnet swaps usually require hardcoded router, pTON, jetton, pool, and wallet addresses. STON.fi's SDK docs call this out and show the testnet CPI router and example testnet jettons in the v2 swap guide: <https://docs.ston.fi/developer-section/dex/sdk/v2/swap>.

## Important Ownership Rule

`StonFiSwap` sends a `JettonTransfer` to `sourceWalletAddress`.

That `sourceWalletAddress` must be the jetton wallet owned by the deployed `StonFiSwap` contract, not your personal wallet's jetton wallet. Jetton wallets normally reject transfer requests from anyone other than their owner.

The live flow is therefore:

1. Deploy or derive the `StonFiSwap` address.
2. Compute or look up the source jetton wallet for `StonFiSwap.address`.
3. Send enough source jettons to that contract-owned jetton wallet.
4. Execute the smoke script with that contract-owned wallet as `sourceWalletAddress`.

If you pass your personal jetton wallet as `sourceWalletAddress`, the contract can still build the message, but the jetton wallet should reject it on chain because `StonFiSwap` is not the owner.

## Files Used

| File | Purpose |
| --- | --- |
| [`contracts/src/StonFiSwap.tolk`](./contracts/src/StonFiSwap.tolk) | Owner-gated contract that emits STON.fi jetton transfer payloads |
| [`contracts/src/stonfi_swap_types.tolk`](./contracts/src/stonfi_swap_types.tolk) | Route preset, swap plan, STON.fi payload, and jetton transfer schemas |
| [`contracts/scripts/stonfi_swap.tolk`](./contracts/scripts/stonfi_swap.tolk) | Deploy-only script |
| [`contracts/scripts/stonfi_swap_setup.tolk`](./contracts/scripts/stonfi_swap_setup.tolk) | Deploy and store a route preset |
| [`contracts/scripts/stonfi_swap_smoke.tolk`](./contracts/scripts/stonfi_swap_smoke.tolk) | Deploy, store a route preset, and execute one route mode |
| [`Acton.toml`](./Acton.toml) | Script aliases, including testnet and TON Connect aliases |

## Prerequisites

Install the project dependencies and make sure Acton is available:

```bash
cd first_counter
npm install
acton --version
```

Prepare testnet access:

- a TON testnet wallet with testnet TON for gas
- `TONCENTER_TESTNET_API_KEY` in your shell or `.env`
- either TON Connect approval, or a configured `deployer` wallet in `wallets.toml` or `global.wallets.toml`
- real testnet route data: source jetton wallet, router wallet, receiver, refund, excesses, referrer, and gas values
- source jettons held by the `StonFiSwap` contract-owned source jetton wallet

For the easiest first broadcast, use the `*-tonconnect` aliases so Acton asks your wallet to approve the transaction.

## Step 1: Run Local Checks First

Do this before spending testnet gas:

```bash
acton build
acton test
npm run typecheck
npm run build
```

The local tests assert the message tree and payload serialization. They are the fastest way to catch contract or wrapper regressions.

## Step 2: Gather Testnet Route Values

The setup and smoke scripts need these ten route preset arguments:

| Argument | Meaning |
| --- | --- |
| `sourceWalletAddress` | Source jetton wallet owned by the deployed `StonFiSwap` contract |
| `routerWalletAddress` | STON.fi router-side wallet for the source token |
| `firstHopReceiverAddress` | Intermediate receiver wallet for cross-swap modes |
| `secondRouterWalletAddress` | Router wallet used by the second router in multi-router mode |
| `receiverAddress` | Final wallet that should receive the output token |
| `referrerAddress` | Referral address used by referral modes |
| `refundAddress` | Address that should receive refunds |
| `excessesAddress` | Address that should receive excess TON |
| `fwdGas` | Forward gas in nanotons, for example `30000000` for `0.03 TON` |
| `refundFwdGas` | Refund forward gas in nanotons, for example `10000000` for `0.01 TON` |

Use STON.fi SDK or direct get-method calls to compute the jetton wallets. On testnet, expect to hardcode contracts and verify liquidity manually.

A common STON.fi testnet starting point from the v2 SDK docs is:

| Contract | Testnet address |
| --- | --- |
| CPI Router v2.1.0 | `kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v` |
| pTON v2.1.0 | `kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px` |
| TesREED jetton | `kQDLvsZol3juZyOAVG8tWsJntOxeEZWEaWCbbSjYakQpuYN5` |
| TestBlue jetton | `kQB_TOJSB7q3-Jm1O8s0jKFtqLElZDPjATs5uJGsujcjznq3` |

Those are minter or router-style addresses, not necessarily every wallet address you pass to this contract. You still need the specific jetton wallet addresses for the deployed `StonFiSwap` contract and STON.fi router path.

## Step 3: Discover The Contract Address

Use TON Connect:

```bash
acton run stonfi-swap-testnet-tonconnect
```

Or use a configured local deployer wallet:

```bash
acton run stonfi-swap-testnet
```

The script prints:

- the transaction trace
- the deployed `StonFiSwap` address
- the owner address

Keep the deployed contract address. You need it to derive the contract-owned source jetton wallet and to fund that wallet with source jettons.

The address is deterministic for the same contract code and initial storage:

```text
id = 0
owner = deployer.address
routePreset = null
```

The setup and smoke scripts use the same initial storage shape. If you run them with the same owner wallet, they target the same `StonFiSwap` address you discovered here.

## Step 4: Fund The Contract-Owned Source Jetton Wallet

Before executing a live swap, send testnet source jettons to the jetton wallet owned by `StonFiSwap.address`.

For a jetton-to-jetton swap, the source wallet is usually:

```text
sourceWalletAddress = get_wallet_address(source_jetton_minter, StonFiSwap.address)
```

Verify the wallet balance before moving on. The smoke script does not mint or fund jettons for you.

## Step 5: Store A Route Preset

The setup script targets the same deterministic contract address and stores the route preset:

```bash
acton run stonfi-swap-setup-testnet-tonconnect \
  <sourceWalletAddress> \
  <routerWalletAddress> \
  <firstHopReceiverAddress> \
  <secondRouterWalletAddress> \
  <receiverAddress> \
  <referrerAddress> \
  <refundAddress> \
  <excessesAddress> \
  <fwdGas> \
  <refundFwdGas>
```

Example shape:

```bash
acton run stonfi-swap-setup-testnet-tonconnect \
  kQ_SOURCE_WALLET_OWNED_BY_STONFI_SWAP \
  kQ_ROUTER_WALLET_FOR_SOURCE_TOKEN \
  kQ_FIRST_HOP_RECEIVER_WALLET \
  kQ_SECOND_ROUTER_WALLET \
  kQ_FINAL_RECEIVER_WALLET \
  kQ_REFERRER_ADDRESS \
  kQ_REFUND_ADDRESS \
  kQ_EXCESSES_ADDRESS \
  30000000 \
  10000000
```

The script prints the stored preset after reading it back from the contract. Confirm every printed address before running a smoke swap.

## Step 6: Run A Testnet Smoke Swap

The smoke script targets the same deterministic contract address, stores the same route preset shape, and then executes one route mode.

```bash
acton run stonfi-swap-smoke-testnet-tonconnect \
  <sourceWalletAddress> \
  <routerWalletAddress> \
  <firstHopReceiverAddress> \
  <secondRouterWalletAddress> \
  <receiverAddress> \
  <referrerAddress> \
  <refundAddress> \
  <excessesAddress> \
  <fwdGas> \
  <refundFwdGas> \
  <routeMode> \
  <queryId> \
  <amount> \
  <forwardTonAmount> \
  <minOut> \
  <txDeadline>
```

Route modes:

| `routeMode` | Flow |
| --- | --- |
| `0` | Simple swap with referral |
| `1` | Cross-swap on the same router |
| `2` | Cross-swap across different routers |
| `3` | Refund-style swap |

For the first live test, use a very small amount and permissive `minOut`:

```bash
acton run stonfi-swap-smoke-testnet-tonconnect \
  kQ_SOURCE_WALLET_OWNED_BY_STONFI_SWAP \
  kQ_ROUTER_WALLET_FOR_SOURCE_TOKEN \
  kQ_FIRST_HOP_RECEIVER_WALLET \
  kQ_SECOND_ROUTER_WALLET \
  kQ_FINAL_RECEIVER_WALLET \
  kQ_REFERRER_ADDRESS \
  kQ_REFUND_ADDRESS \
  kQ_EXCESSES_ADDRESS \
  30000000 \
  10000000 \
  0 \
  42 \
  1000000 \
  30000000 \
  1 \
  1893456000
```

`1893456000` is `2030-01-01T00:00:00Z`. Replace it with a nearer deadline once the path works.

## Step 7: Inspect The Result

Check the trace printed by Acton and inspect the transaction in a TON testnet explorer.

Expected high-level message path:

```text
deployer wallet
  -> StonFiSwap
    -> source jetton wallet owned by StonFiSwap
      -> STON.fi router wallet
```

For route mode `0`, the emitted jetton transfer should contain:

- `destination = routerWalletAddress`
- `responseDestination = excessesAddress`
- `amount = amount`
- `forwardTonAmount = forwardTonAmount`
- `forwardPayload = StonFiSwapPayload`
- `refFee = 25`
- `refAddress = referrerAddress`

If the transaction reaches `StonFiSwap` but fails at the source jetton wallet, re-check source wallet ownership and balance.

## Common Failures

| Symptom | Likely cause |
| --- | --- |
| `scripts.wallet("deployer")` fails | Use a `*-tonconnect` alias or configure `wallets.toml` |
| RPC calls fail | `TONCENTER_TESTNET_API_KEY` is missing or invalid |
| `InvalidRoutePreset` | `fwdGas` or `refundFwdGas` is zero |
| `InvalidForwardTonAmount` | `forwardTonAmount` is zero |
| `InvalidReferralFee` | Referral fee is invalid for the chosen route mode |
| Jetton wallet rejects the transfer | `sourceWalletAddress` is not owned by `StonFiSwap.address` |
| Router rejects or refunds | Wrong route wallets, expired deadline, too-high `minOut`, missing liquidity, or insufficient forward gas |

## Safer Iteration Loop

Use this order while debugging:

```bash
acton build
acton test
acton run stonfi-swap-smoke-emulation <10 preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>
acton run stonfi-swap-smoke-testnet-tonconnect <10 preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>
```

Start with route mode `0`. Add route modes `1`, `2`, and `3` only after the simple route works with real testnet wallet ownership and liquidity.

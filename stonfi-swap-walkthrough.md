# STON.fi Swap POC Walkthrough

This article is for a Solana engineer coming into TON for the first time.

The goal is to explain how the repo is laid out, how the STON.fi swap POC works, and how to read the tests and scripts without already knowing TON-specific jargon.

## TL;DR

- `Counter.tolk` is the original sample contract and stays in the repo as a baseline.
- `StonFiSwap.tolk` is the POC contract that builds STON.fi jetton swap payloads.
- `stonfi_swap_types.tolk` holds the storage types, route preset types, payload builders, and validation helpers.
- `stonfi_swap_setup.tolk` writes a route preset into the contract.
- `stonfi_swap_smoke.tolk` deploys, configures, and executes one of the swap routes.
- `contracts/tests/stonfi_swap.test.tolk` checks the payloads and message flow locally.

The important mental shift is this:

- In Solana you usually think in terms of program instructions and account data.
- In TON you think in terms of contracts receiving internal messages, reading and writing a data cell, and forwarding more messages.

## Current Implementation Note

This walkthrough describes the code currently in this repo.

Two details are worth calling out because they are easy to confuse with an earlier, smaller POC:

- The contract now stores `id`, `owner`, and an optional `routePreset`; it still does not store per-trade route plans or token balances.
- The contract now includes a typed multi-router cross-swap message path; it still does not discover multi-router paths or pool liquidity on chain.

So when this article says the contract avoids persistent route storage, it means each swap's `SwapPlan` is transient and arrives in the execute message body. The optional `routePreset` is just owner-managed testnet config.

## Quick TON Mental Model

| Solana concept | TON concept |
| --- | --- |
| Program | Contract |
| Instruction data | Internal message body |
| Account data | Contract storage cell |
| CPI | Outgoing internal message |
| PDA / deterministic address | Deterministic address from code + storage (`fromStorage`) |
| Transaction logs | Execution trace and out actions |

Three TON terms show up everywhere in this POC:

- A `cell` is the basic serialized data container.
- A `slice` is a readable view into a cell.
- A `ref` is a pointer to another cell, which lets you split large data into smaller pieces.

Jettons are TON's token standard. A STON.fi swap in this repo is mostly a typed jetton transfer that carries a swap payload in `forwardPayload`.

## Repo Map

| File | Role |
| --- | --- |
| `contracts/src/Counter.tolk` | Baseline sample contract from the original template |
| `contracts/src/stonfi_swap_types.tolk` | Shared storage, route preset, swap plan, and payload types |
| `contracts/src/StonFiSwap.tolk` | Swap executor contract |
| `contracts/tests/counter.test.tolk` | Baseline counter tests |
| `contracts/tests/stonfi_swap.test.tolk` | STON.fi POC tests |
| `contracts/scripts/stonfi_swap.tolk` | Base deploy script |
| `contracts/scripts/stonfi_swap_setup.tolk` | Deploy + route preset setup script |
| `contracts/scripts/stonfi_swap_smoke.tolk` | Deploy + setup + swap smoke script |
| `contracts/wrappers/StonFiSwap.gen.tolk` | Generated Tolk wrapper for scripts and tests |
| `wrappers-ts/StonFiSwap.gen.ts` | TypeScript wrapper for the frontend/tooling side |
| `Acton.toml` | Contract definitions and script aliases |
| `handover.md` | Short operational summary |
| `stonfi-swap-walkthrough.md` | This walkthrough |
| `stonfi-swap-testnet-tutorial.md` | Step-by-step testnet testing guide |

## Baseline: `Counter.tolk`

The repo still contains the original counter contract. It is useful because it shows the same Acton/Tolk structure without the STON.fi payload complexity.

### `contracts/src/types.tolk`

This file defines the counter ABI and storage:

- `Errors` contains `NotOwner`, `CounterUnderflow`, and `InvalidMessage`.
- `Storage` contains `id`, `owner`, and `counter`.
- `Storage.load()` reads the current data cell into a typed struct.
- `Storage.save(self)` serializes the struct back into the contract data cell.
- `IncreaseCounter`, `DecreaseCounter`, and `ResetCounter` are typed incoming message bodies.

From a Solana perspective, `Storage` is the closest equivalent to account data, and the three message structs are closest to instruction data variants.

### `contracts/src/Counter.tolk`

`Counter` declares:

- `storage: Storage`
- `incomingMessages: AllowedMessage`

`AllowedMessage` is a union of the three message structs. `onInternalMessage(in)` lazily decodes the incoming body, matches the variant, checks ownership, then mutates storage.

The handlers are intentionally direct:

- `IncreaseCounter` adds `increaseBy`.
- `DecreaseCounter` checks for underflow, then subtracts `decreaseBy`.
- `ResetCounter` sets `counter` to zero.
- Unknown non-empty bodies throw `InvalidMessage`.
- Empty bodies are accepted as value-only messages.

The getters are read-only inspection methods:

- `currentCounter()` returns the stored counter.
- `owner()` returns the owner address.

### `contracts/tests/counter.test.tolk`

The counter tests show the basic Acton testing pattern:

- `setupTest()` creates two treasury accounts, deploys the contract, and returns the fixture.
- Positive tests send typed wrapper messages like `sendIncreaseCounter`.
- Negative tests assert failed transactions and exact exit codes.
- The unknown-message test checks both malformed non-empty bodies and accepted empty bodies.

The STON.fi tests use the same structure, but inspect outgoing message payloads instead of only checking storage changes.

## How The POC Is Structured

The POC is intentionally split into two layers:

1. A small persistent config layer stored on chain.
2. A per-message route plan layer carried in the execute message body.

That means the contract does not derive live STON.fi router or pool state on chain. It also does not keep a per-trade balance ledger or route database.

What it does store is a small owner-managed route preset that is useful for testnet setup and inspection.

The route preset is not a router-state cache. It does not prove that a pool exists, that a pool has liquidity, or that the route is profitable. Those checks belong off chain before the owner sends an execute message.

## `stonfi_swap_types.tolk`

This file is the schema and helper layer. If you understand this file, the contract becomes much easier to read.

### `Errors`

`Errors` collects the custom exit codes.

- `NotOwner` is used when a non-owner tries to change config or execute a swap.
- `InvalidSwapConfig` is used for malformed swap plans or invalid route shapes.
- `InvalidReferralFee` is used when the referral fee is out of range or inconsistent with the route type.
- `InvalidForwardTonAmount` is used when the forward TON amount is zero or missing.
- `InvalidRoutePreset` is used when the stored route preset is missing or invalid.
- `InvalidMessage` is used when an unknown non-empty internal message arrives.

### Route preset types

The route preset is split into three smaller cells:

- `RoutePresetRoutes`
- `RoutePresetTargets`
- `RoutePresetFees`

Those are wrapped by `RoutePreset`, which stores each part by reference.

This split is deliberate. It keeps the storage cell small and makes the generated wrappers more manageable.

#### `RoutePreset.loadRoutes(self)`

- Loads the routes cell and decodes it as `RoutePresetRoutes`.
- This gives you:
  - `sourceWalletAddress`
  - `routerWalletAddress`
  - `firstHopReceiverAddress`

#### `RoutePreset.loadTargets(self)`

- Loads the targets cell and decodes it as `RoutePresetTargets`.
- This gives you:
  - `secondRouterWalletAddress`
  - `receiverAddress`
  - `referrerAddress`

#### `RoutePreset.loadFees(self)`

- Loads the fees cell and decodes it as `RoutePresetFees`.
- This gives you:
  - `refundAddress`
  - `excessesAddress`
  - `fwdGas`
  - `refundFwdGas`

#### `RoutePreset.validate(self)`

- Checks that `fwdGas` and `refundFwdGas` are both positive.
- The contract does not try to validate live pool data here.
- The point is only to reject obviously bad setup data before it gets stored.

#### `unwrapRoutePreset(value)`

- Converts `RoutePreset?` into `RoutePreset`.
- If the value is missing, it throws `InvalidRoutePreset`.
- This is used in scripts and tests where the route preset must exist before a swap is built.

### `Storage`

`Storage` is the persistent contract state.

- `id` is the standard template identifier.
- `owner` is the address allowed to change config and trigger swap execution.
- `routePreset` is the optional stored route config.

#### `Storage.load()`

- Reads the contract data cell and decodes it into `Storage`.
- This is the TON equivalent of loading program state from the account data cell.

#### `Storage.save(self)`

- Serializes the struct back into the contract data cell.
- This is the only persistent state write path in the contract.

### `SwapRouteBody`

`SwapRouteBody` is the typed body that STON.fi expects inside the payload.

Fields:

- `minOut`
- `receiver`
- `fwdGas`
- `customPayload`
- `refundFwdGas`
- `refundPayload`
- `refFee`
- `refAddress`

#### `SwapRouteBody.withCustomPayload(self, customPayload)`

- Returns a copy of the body with a different `customPayload`.
- This is how the contract turns a plain swap plan into:
  - a same-router cross-swap, or
  - a multi-router chained swap.

### `SwapPlan`

`SwapPlan` is the per-trade swap data carried in the execute message body.

Fields:

- `tokenWallet1`
- `refundAddress`
- `excessesAddress`
- `txDeadline`
- `routeBody`

#### `SwapPlan.validateForSwap(self)`

- Loads the route body.
- Rejects any plan with a non-null custom payload.
- Rejects invalid referral fee values greater than 100.

#### `SwapPlan.validateForSimpleSwapWithReferral(self)`

- Runs the base swap validation.
- Requires a positive referral fee.

#### `SwapPlan.validateForRefundSwap(self)`

- Runs the base swap validation.
- Requires a zero referral fee.

#### `SwapPlan.validateForCrossSwapFirstLeg(self)`

- Runs the base swap validation.
- Requires a positive forward gas amount for the first hop.

### STON.fi payload structs

`StonFiSwapPayload` and `StonFiCrossSwapPayload` are the serializable payloads the contract forwards into the jetton transfer.

- `StonFiSwapPayload` is the standard STON.fi swap payload.
- `StonFiCrossSwapPayload` is the nested payload used for same-router cross-swap chaining.

#### `buildStonFiSwapPayload(plan, customPayload = null)`

- Loads the `SwapRouteBody` from the plan.
- Replaces `customPayload` when needed.
- Returns the fully typed swap payload.

#### `buildStonFiCrossSwapPayload(plan)`

- Builds the cross-swap payload from a `SwapPlan`.
- This is used when the next hop stays on the same router.

#### `buildStonFiMultiRouterSwapPayload(firstPlan, secondPlan)`

- Builds a normal swap payload for the first hop.
- Nests another normal swap payload inside its `customPayload`.
- This is the multi-router version of the route chain.

Important distinction:

- Same-router cross-swap uses `StonFiCrossSwapPayload` as the nested body.
- Multi-router cross-swap uses another `StonFiSwapPayload` as the nested body.

That is the key difference between the two route types.

### `JettonTransfer`

`JettonTransfer` models the jetton wallet transfer that carries the swap payload.

The contract uses `forwardPayload` to attach the STON.fi payload that the router will consume.

### Execute message structs

These are the typed incoming messages that the contract accepts:

- `ExecuteSimpleSwapWithReferral`
- `ExecuteCrossSwapSameRouter`
- `ExecuteCrossSwapDifferentRouters`
- `ExecuteRefundSwap`
- `UpdateRoutePreset`

The execute messages are not route discovery messages. They are just typed swap requests.

## `StonFiSwap.tolk`

This is the main contract.

### Contract declaration

```tolk
contract StonFiSwap {
    storage: Storage
    incomingMessages: AllowedMessage
}
```

That means:

- the contract stores `Storage`
- it accepts only the message types listed in `AllowedMessage`

### `AllowedMessage`

The allowed incoming messages are:

- `UpdateRoutePreset`
- `ExecuteSimpleSwapWithReferral`
- `ExecuteCrossSwapSameRouter`
- `ExecuteCrossSwapDifferentRouters`
- `ExecuteRefundSwap`

### `onInternalMessage(in)`

This is the main entrypoint for internal messages.

What it does:

1. Lazily decodes the body into `AllowedMessage`.
2. Matches the message type.
3. Dispatches to the relevant handler.
4. Accepts an empty body as a no-op.
5. Rejects any unknown non-empty body with `InvalidMessage`.

The empty-body behavior matters because TON contracts often receive value-only messages and should not fail on them unless there is actual malformed payload data.

### `handleUpdateRoutePreset(senderAddress, msg)`

This is the owner-only config update path.

Steps:

1. Load storage.
2. Check that `senderAddress` matches the owner.
3. Validate the preset.
4. Save the new preset into storage.

This is the only persistent config write in the contract.

### `handleSimpleSwapWithReferral(senderAddress, msg)`

This is the simplest swap path.

Steps:

1. Check owner.
2. Check `amount > 0`.
3. Check `forwardTonAmount > 0`.
4. Load the swap plan.
5. Validate that the plan is a normal swap with a positive referral fee.
6. Build a jetton transfer to the source wallet.
7. Put a standard STON.fi swap payload into `forwardPayload`.
8. Send the message with carry-all remaining value mode.

The important output here is not a token balance change in the contract. The contract just creates the correct outgoing message tree.

### `handleCrossSwapSameRouter(senderAddress, msg)`

This is the two-hop swap where both hops stay on the same STON.fi router.

Steps:

1. Check owner.
2. Check positive amount and forward TON.
3. Load both swap plans.
4. Validate the first leg as a cross-swap first leg.
5. Validate the second leg as a normal swap.
6. Build a `StonFiCrossSwapPayload` for the second hop.
7. Insert that payload into the first hop swap body.
8. Send the outgoing jetton transfer to the source wallet.

This matches the STON.fi "cross-swap on the same router" example.

### `handleCrossSwapDifferentRouters(senderAddress, msg)`

This is the multi-router chained version.

Steps:

1. Check owner.
2. Check positive amount and forward TON.
3. Load both swap plans.
4. Validate the first leg.
5. Validate the second leg as a normal swap.
6. Build a nested normal swap payload for the second router.
7. Insert that into the first hop swap body.
8. Send the outgoing jetton transfer to the source wallet.

The contract does not discover the second router on chain. The second router wallet is already part of the route preset or input plan.

### `handleRefundSwap(senderAddress, msg)`

This is the route used when the user wants a refund-friendly path.

Steps:

1. Check owner.
2. Check positive amount and forward TON.
3. Load the swap plan.
4. Validate the refund route shape.
5. Build a standard swap payload with zero referral fee.
6. Send the jetton transfer.

TON multi-contract transactions are not atomic across multiple contracts, so refund behavior on chain is limited. The POC keeps the refund path explicit and simple.

### `buildJettonTransfer(...)`

This helper builds the outer jetton transfer message.

It sets:

- `destination` to the router wallet
- `responseDestination` to the excesses/refund response address
- `forwardPayload` to the STON.fi swap payload

The swap payload is carried in `forwardPayload.right(...)`, which is how the router receives it.

### `sendJettonTransfer(...)`

This helper sends the constructed transfer to the source wallet.

It creates an internal message with:

- `bounce: true`
- `value: ton("0")`
- `dest: sourceWalletAddress`
- body: the transfer

Then it uses `SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE`.

That makes the message behave like a forwarding hop rather than a stateful balance write.

### `onBouncedMessage(_in)`

This is intentionally empty.

The contract does not try to recover from bounces on chain. For a POC, that keeps the flow easy to reason about.

### Getters

- `routePreset()` returns the stored optional route preset.
- `owner()` returns the owner address.

These getters are used by the setup and smoke scripts and by the tests.

## Scripts

The scripts are the operational layer. They show how the contract is intended to be used in practice.

### `contracts/scripts/stonfi_swap.tolk`

This is the base deploy script.

- It resolves the `deployer` wallet.
- It creates the contract from storage with `routePreset: null`.
- It deploys the contract.
- It prints the deployed address.

Use this when you just want the base contract on chain.

### `contracts/scripts/stonfi_swap_setup.tolk`

This script does two things:

1. Deploys the contract.
2. Writes a route preset into storage.

It expects these args:

- source wallet
- router wallet
- first hop receiver
- second router wallet
- final receiver
- referrer
- refund address
- excesses address
- forward gas
- refund forward gas

The gas arguments are `coins`, so you pass them as integer nanotons.

Example in emulation:

```bash
acton run stonfi-swap-setup-emulation \
  0:0000000000000000000000000000000000000000000000000000000000000000 \
  0:0000000000000000000000000000000000000000000000000000000000000001 \
  0:0000000000000000000000000000000000000000000000000000000000000002 \
  0:0000000000000000000000000000000000000000000000000000000000000003 \
  0:0000000000000000000000000000000000000000000000000000000000000004 \
  0:0000000000000000000000000000000000000000000000000000000000000005 \
  0:0000000000000000000000000000000000000000000000000000000000000006 \
  0:0000000000000000000000000000000000000000000000000000000000000007 \
  30000000 10000000
```

### `contracts/scripts/stonfi_swap_smoke.tolk`

This is the smoke-test runner.

It does the same setup as the previous script and then runs one of the swap flows.

It expects the same 10 route preset args, followed by:

- `routeMode`
- `queryId`
- `amount`
- `forwardTonAmount`
- `minOut`
- `txDeadline`

`routeMode` values:

- `0` simple swap with referral
- `1` same-router cross-swap
- `2` multi-router cross-swap
- `3` refund swap

Example in emulation:

```bash
acton run stonfi-swap-smoke-emulation \
  0:0000000000000000000000000000000000000000000000000000000000000000 \
  0:0000000000000000000000000000000000000000000000000000000000000001 \
  0:0000000000000000000000000000000000000000000000000000000000000002 \
  0:0000000000000000000000000000000000000000000000000000000000000003 \
  0:0000000000000000000000000000000000000000000000000000000000000004 \
  0:0000000000000000000000000000000000000000000000000000000000000005 \
  0:0000000000000000000000000000000000000000000000000000000000000006 \
  0:0000000000000000000000000000000000000000000000000000000000000007 \
  30000000 10000000 \
  0 42 1000000000 30000000 950000000 1234567890
```

For testnet, the same scripts have TON Connect aliases in `Acton.toml`:

- `stonfi-swap-testnet-tonconnect`
- `stonfi-swap-setup-testnet-tonconnect`
- `stonfi-swap-smoke-testnet-tonconnect`

Those aliases avoid the need for a local `wallets.toml`.
You should still provide `TONCENTER_TESTNET_API_KEY` in `.env` or your shell so the testnet RPC calls can resolve.

### Why there are separate setup and smoke scripts

- The setup script is for configuring the contract.
- The smoke script is for proving that the configured route can produce a valid swap message tree.
- The smoke script still uses route data that comes from the route preset shape, but the contract itself never discovers live pool state.

## Generated Wrappers

Two wrapper layers are checked in:

- `contracts/wrappers/StonFiSwap.gen.tolk`
- `wrappers-ts/StonFiSwap.gen.ts`

Treat them as generated artifacts, not hand-authored source.

Why they matter:

- The Tolk wrapper lets scripts and tests call the contract with typed methods.
- The TypeScript wrapper keeps any frontend or tooling code aligned with the ABI shape.

If the ABI or storage layout changes, regenerate the wrappers instead of editing around the ABI by hand.

## Tests

The STON.fi test file is `contracts/tests/stonfi_swap.test.tolk`.

### Test fixtures and helpers

- `setupTest()` deploys a fresh `StonFiSwap` instance with `routePreset: null`.
- `makeReferralPlan(...)` builds a simple swap plan with a referral fee.
- `makeInvalidReferralPlan(...)` builds a bad referral plan for negative testing.
- `makeRoutePreset(...)` builds a preset cell tree for setup tests.
- `makeCrossFirstPlan(...)` builds the first hop of a cross-swap.
- `makeCrossSecondPlan(...)` builds the second hop of a cross-swap.
- `makeRefundPlan(...)` builds a refund-oriented plan.
- `loadSingleSendAction(...)` unwraps the single outgoing send action from the trace.
- `loadForwardPayload(...)` decodes the forwarded payload cell from the jetton transfer.

### What each test checks

- `deploy exposes initial owner`
  - verifies the owner getter
  - verifies the route preset starts as `null`

- `owner can update route preset`
  - sends `UpdateRoutePreset`
  - verifies the stored routes, targets, and fee cells

- `simple swap with referral emits stonfi payload`
  - verifies the outer jetton transfer
  - verifies the STON.fi payload fields
  - verifies the referral address and referral fee

- `cross swap on same router emits nested cross payload`
  - verifies that the first hop contains a nested `StonFiCrossSwapPayload`
  - verifies the second hop payload fields

- `cross swap using multiple routers emits nested normal payload`
  - verifies that the nested payload is another normal swap payload
  - this is the multi-router chain

- `refund swap emits refund-friendly payload`
  - verifies the zero referral fee path
  - verifies the refund addresses

- `simple swap rejects invalid referral fee`
  - proves the contract refuses invalid referral settings

- `non-owner cannot change swap config`
  - owner gating on swap execution

- `non-owner cannot update route preset`
  - owner gating on config changes

- `unknown message`
  - non-empty unknown body is rejected
  - empty body is accepted as a no-op

The tests do not try to execute a live STON.fi swap on mainnet or testnet. Instead they assert the message tree and payload serialization locally, which is the right level for a POC.

## What This POC Does Not Do

- It does not derive live STON.fi router or pool state on chain.
- It does not store per-trade route plans or balances persistently.
- It does not include a frontend swap UI.
- It does not do route search or multi-router path discovery.
- It does not broadcast a live testnet swap from this workspace unless you provide a usable wallet path and the exact route data.

That is intentional. The contract is a typed message builder and executor, not a routing engine.

## Runbook

### Local checks

```bash
acton build
acton test
npm run typecheck
npm run build
```

### Local emulation flow

1. Deploy and configure the contract:

```bash
acton run stonfi-swap-setup-emulation <10 preset args>
```

2. Run the smoke path:

```bash
acton run stonfi-swap-smoke-emulation <10 preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>
```

### Testnet flow

You have two ways to broadcast:

- use a local `wallets.toml` or `global.wallets.toml`
- use the TON Connect aliases in `Acton.toml`

Example TON Connect aliases:

```bash
acton run stonfi-swap-setup-testnet-tonconnect <args>
acton run stonfi-swap-smoke-testnet-tonconnect <args>
```

The plain `stonfi-swap-testnet` alias still exists for the base deploy path. It resolves `scripts.wallet("deployer")`, so it will stop if no `deployer` wallet is configured in `wallets.toml` or `global.wallets.toml`.

A real testnet swap still needs:

- a funded testnet wallet or TON Connect approval
- usable testnet RPC credentials such as `TONCENTER_TESTNET_API_KEY`
- exact testnet jetton wallet, router wallet, receiver, referrer, refund, and excesses addresses
- route values that correspond to real STON.fi testnet liquidity

For a step-by-step version of this flow, including command shapes and the source jetton wallet ownership caveat, see [stonfi-swap-testnet-tutorial.md](./stonfi-swap-testnet-tutorial.md).

If those are missing, the failure is operational setup, not proof that the contract logic failed.

## Glossary

| Term | Meaning |
| --- | --- |
| Cell | TON serialization container |
| Slice | Read view into a cell |
| Ref | Cell reference |
| Internal message | Message sent between contracts |
| Bounce | Failure path that can return value or signal an error |
| Jetton | TON token standard |
| Forward payload | Additional body passed along in a jetton transfer |
| State init | Code + data used to derive a contract address |
| Get method | Read-only method used for inspection |

If you are used to Solana, the easiest way to think about this POC is:

- the scripts build the swap plan
- the contract validates the plan
- the contract emits the exact outgoing message tree the STON.fi router expects
- the tests assert the tree without needing live liquidity

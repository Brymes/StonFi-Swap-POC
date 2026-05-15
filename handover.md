# STON.fi Swap POC Handover

## Contracts

- `Counter` remains the original template contract in `contracts/src/Counter.tolk`.
- `StonFiSwap` is the new POC contract in `contracts/src/StonFiSwap.tolk`.
- `stonfi_swap_types.tolk` contains the shared storage, route preset, swap plan, and payload helpers used by the contract, tests, and scripts.

## What Was Implemented

- Added an owner-gated swap executor that builds STON.fi jetton transfer payloads instead of trying to perform routing on chain.
- Added a small persistent route preset record for setup and inspection.
- Added typed support for:
  - simple swap with referral
  - same-router cross-swap
  - multi-router cross-swap
  - refund swap
- Added deployment, setup, and smoke scripts for local emulation and testnet preparation.
- Added generated Tolk and TypeScript wrappers for the new ABI surface.
- Added tests that exercise the payload builders, route preset updates, owner gating, and unknown-message handling.
- Added a walkthrough article at [stonfi-swap-walkthrough.md](./stonfi-swap-walkthrough.md).
- Added a testnet tutorial at [stonfi-swap-testnet-tutorial.md](./stonfi-swap-testnet-tutorial.md).

## Route Modes

- Simple swap with referral uses the standard STON.fi swap payload and fills the referral fields.
- Cross-swap on the same router nests a `StonFiCrossSwapPayload` inside the first hop swap payload.
- Cross-swap using multiple routers nests a normal `StonFiSwapPayload` inside the first hop swap payload.
- Refund swap uses the normal swap path with a zero referral fee and refund-oriented addresses.

## Validation Added

- Owner-only access on route preset updates and swap execution.
- Rejection of zero jetton amounts.
- Rejection of zero forward TON amounts.
- Rejection of invalid referral fee values.
- Rejection of malformed route plans.
- Rejection of unknown non-empty internal messages.

## Tests Added

- Deploy test for the new contract owner getter and initial route preset state.
- Route preset update test that confirms storage round-tripping.
- Simple swap with referral payload test.
- Same-router cross-swap payload test.
- Multi-router cross-swap payload test.
- Refund swap payload test.
- Invalid referral fee negative test.
- Non-owner swap rejection test.
- Non-owner route preset update rejection test.
- Unknown-message test for empty and non-empty bodies.

## Scripts Added

- `contracts/scripts/stonfi_swap.tolk` deploys the contract.
- `contracts/scripts/stonfi_swap_setup.tolk` deploys the contract and stores a route preset.
- `contracts/scripts/stonfi_swap_smoke.tolk` deploys, stores a route preset, and runs one of the swap modes.
- `stonfi-swap-testnet-tonconnect`, `stonfi-swap-setup-testnet-tonconnect`, and `stonfi-swap-smoke-testnet-tonconnect` are the testnet aliases that use TON Connect instead of a local wallet file.

## What Was Not Done

- The contract does not derive live STON.fi router or pool state on chain.
- The contract does not store per-trade route plans or balances persistently.
- The contract does not include a frontend swap UI.
- A live testnet swap transaction was not broadcast from this workspace because that still depends on a funded wallet, usable testnet credentials or TON Connect approval, and the exact jetton route you want to use.
- The non-TON Connect `acton run stonfi-swap-testnet` alias still requires `wallets.deployer` in `wallets.toml` or `global.wallets.toml`.

## Runbook

- `acton build`
- `acton test`
- `npm run typecheck`
- `npm run build`
- `acton run stonfi-swap-setup-emulation <preset args>`
- `acton run stonfi-swap-smoke-emulation <preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>`
- `acton run stonfi-swap-setup-testnet-tonconnect <preset args>`
- `acton run stonfi-swap-smoke-testnet-tonconnect <preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>`
- See [stonfi-swap-testnet-tutorial.md](./stonfi-swap-testnet-tutorial.md) for the full live testnet checklist and command shapes.

## Notes

- The route preset is stored on chain for configuration, but the actual swap plan is still carried in the execute message body.
- The smoke script now does the deploy-and-configure work itself, so the emulation path is self-contained.
- `acton run` aliases that need TON Connect have dedicated `*-tonconnect` entries in `Acton.toml`.

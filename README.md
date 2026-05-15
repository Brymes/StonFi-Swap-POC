# STON.fi Swap POC

This repository is a TON smart contract POC centered on a separate `StonFiSwap` contract for STON.fi swap message construction and testnet preparation.

Start here:

- [STON.fi swap walkthrough](./stonfi-swap-walkthrough.md)
- [Operational handover](./handover.md)

## Layout

- `contracts/src/Counter.tolk` is the original sample contract and still serves as a simple baseline.
- `contracts/src/stonfi_swap_types.tolk` holds the shared storage, route preset, swap plan, and payload helpers.
- `contracts/src/StonFiSwap.tolk` is the swap executor contract.
- `contracts/tests/stonfi_swap.test.tolk` covers route preset handling, payload serialization, and negative cases.
- `contracts/scripts/stonfi_swap.tolk` deploys the base contract.
- `contracts/scripts/stonfi_swap_setup.tolk` deploys and stores the route preset.
- `contracts/scripts/stonfi_swap_smoke.tolk` deploys, stores the route preset, and executes one swap route.
- `contracts/wrappers/StonFiSwap.gen.tolk` is the generated Tolk wrapper.
- `wrappers-ts/StonFiSwap.gen.ts` is the generated TypeScript wrapper used by the app and typecheck.
- `app/` contains the existing Vite frontend scaffold.

## Commands

```bash
acton build
acton test
npm run typecheck
npm run build
```

Local emulation:

```bash
acton run stonfi-swap-setup-emulation <preset args>
acton run stonfi-swap-smoke-emulation <preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>
```

Testnet broadcast:

```bash
acton run stonfi-swap-testnet-tonconnect
acton run stonfi-swap-setup-testnet-tonconnect <preset args>
acton run stonfi-swap-smoke-testnet-tonconnect <preset args> <routeMode> <queryId> <amount> <forwardTonAmount> <minOut> <txDeadline>
```

If you prefer a local wallet file instead of TON Connect, provide `wallets.toml` or `global.wallets.toml` with a `deployer` wallet entry and use the non-TON Connect aliases.

For testnet broadcasts, set `TONCENTER_TESTNET_API_KEY` in `.env` or in your shell if it is not already available.

## Notes

- The contract does not derive live STON.fi router or pool state on chain.
- The contract does not keep per-trade route plans or balances persistently.
- The swap payloads are built and validated locally, then forwarded as typed internal messages.
- The POC is intentionally small so it stays easy to inspect and adapt for a real route later.

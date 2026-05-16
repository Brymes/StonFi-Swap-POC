# Commands to Run on testnet the way i ran it check dump.txt for how i ran it 

```bash

acton wallet new --name deployer --version v5r1 --local
acton wallet list --balance
acton wallet airdrop deployer --net testnet
acton run stonfi-swap-testnet
acton wallet new --name deployer --version v5r1 --local
acton wallet list --balance
acton wallet airdrop deployer --net testnet
acton run stonfi-swap-testnet
npm run testnet:resolve-mode0 -- --contract-address kQBU_pkto2pLcYoN-2jnyzLneEhiwv4BaxRukTRp_JhZ74wi --owner-address kQCjVyUToBO9vnk1kEWBXQUR2RR5xomuy1N9GGkS0GH1xY1h --receiver-address kQCjVyUToBO9vnk1kEWBXQUR2RR5xomuy1N9GGkS0GH1xY1h
npm run testnet:buy-tesreed -- 1
npm list @ston-fi/sdk @ton/ton @ton/crypto
npm run testnet:buy-tesreed -- 1
touch scripts/testnet-mint-tesreed.ts
acton wallet airdrop deployer --net testnet         
npm run testnet:mint-tesreed
acton wallet airdrop deployer --net testnet         
npm run testnet:mint-tesreed
npm run testnet:check-jetton-wallet -- --wallet-address kQCgfR8JX5TBjLomO6C3yTPXqlKl7L6HY6lJuD_ZeK8Cf0BJ --owner-address kQBU_pkto2pLcYoN-2jnyzLneEhiwv4BaxRukTRp_JhZ74wi --jetton-master-address kQDLvsZol3juZyOAVG8tWsJntOxeEZWEaWCbbSjYakQpuYN5 --require-balance true
npm run testnet:validate -- --contract-address kQBU_pkto2pLcYoN-2jnyzLneEhiwv4BaxRukTRp_JhZ74wi --receiver-address kQCjVyUToBO9vnk1kEWBXQUR2RR5xomuy1N9GGkS0GH1xY1h --route-modes 0
```

## Commands explained 

  1. Put your Toncenter testnet key in .env

  Edit .env so it contains:

  TONCENTER_TESTNET_API_KEY=your_key_here

  2. Create or import a testnet wallet for Acton

  If you already have a testnet mnemonic:

  acton wallet import --name deployer --version v5r1 --local "<your 24 words>"

  If you do not:

  acton wallet new --name deployer --version v5r1 --local

  Then check and fund it:

  acton wallet list --balance
  acton wallet airdrop deployer --net testnet
  acton wallet list --balance

  You need some testnet TON before anything else works.

  3. Deploy the contract

  acton run stonfi-swap-testnet

  This should print something like:

  Deployed StonFiSwap to <contract address>
  Owner is <owner address>

  Save both addresses.

  4. Resolve the contract-owned source jetton wallet and mode-0 route

  Use your deployed contract address and owner address:

  npm run testnet:resolve-mode0 -- \
    --contract-address <STONFI_SWAP_ADDRESS> \
    --owner-address <OWNER_ADDRESS> \
    --receiver-address <OWNER_ADDRESS>

  This prints JSON. Save these fields:

  - preset.sourceWalletAddress
  - preset.routerWalletAddress

  5. Fund the contract-owned source wallet with TesREED

  This is the one manual step outside the repo.

  You need to get a small amount of TesREED on testnet into your personal wallet first, then transfer some of it to:

  preset.sourceWalletAddress

  Without that, the contract cannot perform the swap.

  6. Verify that funding and ownership are correct

  npm run testnet:check-jetton-wallet -- \
    --wallet-address <SOURCE_WALLET_ADDRESS> \
    --owner-address <STONFI_SWAP_ADDRESS> \
    --jetton-master-address kQDLvsZol3juZyOAVG8tWsJntOxeEZWEaWCbbSjYakQpuYN5 \
    --require-balance true

  This must show:

  - owner = your deployed StonFiSwap
  - jetton master = TesREED
  - balance > 0

  7. Run the full logged validation for mode 0

  npm run testnet:validate -- \
    --contract-address <STONFI_SWAP_ADDRESS> \
    --receiver-address <OWNER_ADDRESS> \
    --route-modes 0

  This will:

  - re-check local build/test/typecheck/build
  - verify the route
  - verify the funded source wallet
  - store the preset on the deployed contract
  - run emulation
  - run the live testnet mode-0 smoke
  - save logs under build/testnet/<timestamp>/

  What I need from you next

  Run these in order:

  1. acton wallet list --balance
  2. acton run stonfi-swap-testnet
  3. npm run testnet:resolve-mode0 -- ...

  Then paste the outputs from steps 2 and 3. After that I’ll tell you exactly what to fund and the next command to run.

 
› Summarize recent commits
 
  gpt-5.4 high · ~/Repositories/Orgs/Perelyn/first_counter
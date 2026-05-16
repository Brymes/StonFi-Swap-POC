import "dotenv/config";
import {
    TonClient,
    WalletContractV5R1,
    internal,
    toNano,
    SendMode,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { DEX, pTON } from "@ston-fi/sdk";

const TONCENTER_TESTNET_API_KEY = process.env.TONCENTER_TESTNET_API_KEY;
const MNEMONIC = process.env.TESTNET_WALLET_MNEMONIC;

if (!TONCENTER_TESTNET_API_KEY) {
    throw new Error("Missing TONCENTER_TESTNET_API_KEY in .env");
}

if (!MNEMONIC) {
    throw new Error("Missing TESTNET_WALLET_MNEMONIC in .env");
}

const TESTNET_CPI_ROUTER =
    "kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v";

const TESTNET_PTON =
    "kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px";

const TESREED_MASTER =
    "kQDLvsZol3juZyOAVG8tWsJntOxeEZWEaWCbbSjYakQpuYN5";

async function main() {
    const offerTon = process.argv[2] ?? "0.2";

    const client = new TonClient({
        endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
        apiKey: TONCENTER_TESTNET_API_KEY,
    });

    const keyPair = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));

    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        walletId: {
            networkGlobalId: -3, // testnet
            context: {
                walletVersion: "v5r1",
                workchain: 0,
                subwalletNumber: 0,
            },
        },
    });
    const openedWallet = client.open(wallet);

    console.log("Sender wallet:");
    console.log(wallet.address.toString({ testOnly: true }));
    const EXPECTED_DEPLOYER =
        "kQCjVyUToBO9vnk1kEWBXQUR2RR5xomuy1N9GGkS0GH1xY1h";

    const actualWallet = wallet.address.toString({ testOnly: true });

    if (actualWallet !== EXPECTED_DEPLOYER) {
        throw new Error(
            `Wrong wallet derived from TESTNET_WALLET_MNEMONIC.\nExpected: ${EXPECTED_DEPLOYER}\nActual:   ${actualWallet}`
        );
    }

    const router = client.open(
        DEX.v2_1.Router.create(TESTNET_CPI_ROUTER)
    );
    
    const proxyTon = pTON.v2_1.create(TESTNET_PTON);

    const userWalletAddress = wallet.address.toString({ testOnly: true });

    const txParams = await router.getSwapTonToJettonTxParams({
        userWalletAddress,
        proxyTon,
        offerAmount: toNano(offerTon),
        askJettonAddress: TESREED_MASTER,
        minAskAmount: "1",
        queryId: 12345,
    });

    console.log("Sending TON -> TesREED swap:");
    console.log("to:", txParams.to.toString({ testOnly: true }));
    console.log("value:", txParams.value.toString());

    console.log("query sent from:", userWalletAddress);
    console.log("referralAddress:", userWalletAddress);
    console.log("referralValue:", 10);

    await openedWallet.sendTransfer({
        seqno: await openedWallet.getSeqno(),
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [
            internal({
                to: txParams.to,
                value: txParams.value,
                body: txParams.body ?? undefined,
            }),
        ],
    });

    console.log("Submitted TON -> TesREED swap.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
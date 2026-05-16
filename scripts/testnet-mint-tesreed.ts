import "dotenv/config";
import {
    TonClient,
    WalletContractV5R1,
    internal,
    toNano,
    SendMode,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TONCENTER_TESTNET_API_KEY = process.env.TONCENTER_TESTNET_API_KEY;
const MNEMONIC = process.env.TESTNET_WALLET_MNEMONIC;

if (!TONCENTER_TESTNET_API_KEY) {
    throw new Error("Missing TONCENTER_TESTNET_API_KEY in .env");
}

if (!MNEMONIC) {
    throw new Error("Missing TESTNET_WALLET_MNEMONIC in .env");
}

const TESREED_MASTER =
    "kQDLvsZol3juZyOAVG8tWsJntOxeEZWEaWCbbSjYakQpuYN5";

const EXPECTED_DEPLOYER =
    "kQCjVyUToBO9vnk1kEWBXQUR2RR5xomuy1N9GGkS0GH1xY1h";

async function main() {
    const client = new TonClient({
        endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
        apiKey: TONCENTER_TESTNET_API_KEY,
    });

    const keyPair = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));

    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        walletId: {
            networkGlobalId: -3,
            context: {
                walletVersion: "v5r1",
                workchain: 0,
                subwalletNumber: 0,
            },
        },
    });

    const openedWallet = client.open(wallet);
    const actualWallet = wallet.address.toString({ testOnly: true });

    console.log("Sender wallet:", actualWallet);

    if (actualWallet !== EXPECTED_DEPLOYER) {
        throw new Error(
            `Wrong wallet derived.\nExpected: ${EXPECTED_DEPLOYER}\nActual:   ${actualWallet}`
        );
    }

    await openedWallet.sendTransfer({
        seqno: await openedWallet.getSeqno(),
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [
            internal({
                to: TESREED_MASTER,
                value: toNano("0.08"),
                // Important: no body.
                // Empty message triggers faucet mint.
            }),
        ],
    });

    console.log("Submitted empty mint message to TesREED minter.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
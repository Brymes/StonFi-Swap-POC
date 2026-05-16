import "@acton/io"
import "@acton/emulation/network"
import "@acton/emulation/scripts"

import "@contracts/stonfi_swap_types"
import "@wrappers/StonFiSwap.gen"

fun main(
    contractAddress: address,
    sourceWalletAddress: address,
    routerWalletAddress: address,
    firstHopReceiverAddress: address,
    secondRouterWalletAddress: address,
    receiverAddress: address,
    referrerAddress: address,
    refundAddress: address,
    excessesAddress: address,
    fwdGas: coins,
    refundFwdGas: coins,
    routeMode: uint8,
    queryId: uint64,
    amount: coins,
    forwardTonAmount: coins,
    minOut: coins,
    txDeadline: uint64,
) {
    val deployer = scripts.wallet("deployer");

    val contract = StonFiSwap.fromAddress(contractAddress);
    val routePreset = RoutePreset {
        routes: RoutePresetRoutes {
            sourceWalletAddress,
            routerWalletAddress,
            firstHopReceiverAddress,
        }.toCell(),
        targets: RoutePresetTargets {
            secondRouterWalletAddress,
            receiverAddress,
            referrerAddress,
        }.toCell(),
        fees: RoutePresetFees { refundAddress, excessesAddress, fwdGas, refundFwdGas }.toCell(),
    };

    val presetRes = contract.sendUpdateRoutePreset(
        deployer.address,
        routePreset,
        { value: ton("0.05") },
    );
    println(presetRes.waitForTrace());

    val loadedRoutePreset = unwrapRoutePreset(contract.routePreset());
    val routes = loadedRoutePreset.loadRoutes();
    val targets = loadedRoutePreset.loadTargets();
    val fees = loadedRoutePreset.loadFees();

    if (routeMode == 0) {
        val plan = makeSimpleSwapPlan(routes, targets, fees, minOut, txDeadline);
        val txs = contract.sendExecuteSimpleSwapWithReferral(
            deployer.address,
            queryId,
            routes.sourceWalletAddress,
            routes.routerWalletAddress,
            amount,
            forwardTonAmount,
            plan,
            { value: ton("0.2") },
        );
        println(txs.waitForTrace());
    } else if (routeMode == 1) {
        val firstPlan = makeFirstHopSwapPlan(routes, targets, fees, minOut, txDeadline);
        val secondPlan = makeSecondHopSwapPlan(
            targets,
            fees,
            minOut,
            txDeadline,
            routes.routerWalletAddress,
            0,
        );
        val txs = contract.sendExecuteCrossSwapSameRouter(
            deployer.address,
            queryId,
            routes.sourceWalletAddress,
            routes.routerWalletAddress,
            amount,
            forwardTonAmount,
            firstPlan,
            secondPlan,
            { value: ton("0.2") },
        );
        println(txs.waitForTrace());
    } else if (routeMode == 2) {
        val firstPlan = makeFirstHopSwapPlan(routes, targets, fees, minOut, txDeadline);
        val secondPlan = makeSecondHopSwapPlan(
            targets,
            fees,
            minOut,
            txDeadline,
            targets.secondRouterWalletAddress,
            0,
        );
        val txs = contract.sendExecuteCrossSwapDifferentRouters(
            deployer.address,
            queryId,
            routes.sourceWalletAddress,
            routes.routerWalletAddress,
            amount,
            forwardTonAmount,
            firstPlan,
            secondPlan,
            { value: ton("0.2") },
        );
        println(txs.waitForTrace());
    } else if (routeMode == 3) {
        val plan = makeRefundSwapPlan(routes, targets, fees, minOut, txDeadline);
        val txs = contract.sendExecuteRefundSwap(
            deployer.address,
            queryId,
            routes.sourceWalletAddress,
            routes.routerWalletAddress,
            amount,
            forwardTonAmount,
            plan,
            { value: ton("0.2") },
        );
        println(txs.waitForTrace());
    } else {
        throw Errors.InvalidSwapConfig;
    }
}

fun makeSimpleSwapPlan(
    routes: RoutePresetRoutes,
    targets: RoutePresetTargets,
    fees: RoutePresetFees,
    minOut: coins,
    txDeadline: uint64,
): SwapPlan {
    return SwapPlan {
        tokenWallet1: routes.routerWalletAddress,
        refundAddress: fees.refundAddress,
        excessesAddress: fees.excessesAddress,
        txDeadline,
        routeBody: SwapRouteBody {
            minOut,
            receiver: targets.receiverAddress,
            fwdGas: fees.fwdGas,
            customPayload: null,
            refundFwdGas: fees.refundFwdGas,
            refundPayload: null,
            refFee: 25,
            refAddress: targets.referrerAddress,
        }.toCell(),
    };
}

fun makeFirstHopSwapPlan(
    routes: RoutePresetRoutes,
    targets: RoutePresetTargets,
    fees: RoutePresetFees,
    minOut: coins,
    txDeadline: uint64,
): SwapPlan {
    return SwapPlan {
        tokenWallet1: routes.routerWalletAddress,
        refundAddress: fees.refundAddress,
        excessesAddress: fees.excessesAddress,
        txDeadline,
        routeBody: SwapRouteBody {
            minOut,
            receiver: routes.firstHopReceiverAddress,
            fwdGas: fees.fwdGas,
            customPayload: null,
            refundFwdGas: fees.refundFwdGas,
            refundPayload: null,
            refFee: 20,
            refAddress: targets.referrerAddress,
        }.toCell(),
    };
}

fun makeSecondHopSwapPlan(
    targets: RoutePresetTargets,
    fees: RoutePresetFees,
    minOut: coins,
    txDeadline: uint64,
    tokenWallet1: address,
    refFee: uint16,
): SwapPlan {
    return SwapPlan {
        tokenWallet1,
        refundAddress: fees.refundAddress,
        excessesAddress: fees.excessesAddress,
        txDeadline,
        routeBody: SwapRouteBody {
            minOut,
            receiver: targets.receiverAddress,
            fwdGas: fees.fwdGas,
            customPayload: null,
            refundFwdGas: fees.refundFwdGas,
            refundPayload: null,
            refFee,
            refAddress: targets.referrerAddress,
        }.toCell(),
    };
}

fun makeRefundSwapPlan(
    routes: RoutePresetRoutes,
    targets: RoutePresetTargets,
    fees: RoutePresetFees,
    minOut: coins,
    txDeadline: uint64,
): SwapPlan {
    return SwapPlan {
        tokenWallet1: routes.routerWalletAddress,
        refundAddress: fees.refundAddress,
        excessesAddress: fees.excessesAddress,
        txDeadline,
        routeBody: SwapRouteBody {
            minOut,
            receiver: targets.receiverAddress,
            fwdGas: fees.fwdGas,
            customPayload: null,
            refundFwdGas: fees.refundFwdGas,
            refundPayload: null,
            refFee: 0,
            refAddress: targets.referrerAddress,
        }.toCell(),
    };
}

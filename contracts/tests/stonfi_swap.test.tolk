import "@acton/emulation/network"
import "@acton/emulation/testing"
import "@acton/testing/expect"
import "@acton/types/out_actions"

import "@contracts/stonfi_swap_types"
import "@wrappers/StonFiSwap.gen"

get fun `test deploy exposes initial owner`() {
    val (contract, deployer, _, _) = setupTest();

    expect(contract.owner()).toEqual(deployer.address);
    expect(contract.routePreset()).toBeNull();
}

get fun `test owner can update route preset`() {
    val (contract, deployer, referrer, _) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val firstHopReceiver = randomAddress("first_hop_receiver_wallet");
    val secondRouterWallet = randomAddress("second_router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val preset = makeRoutePreset(
        sourceWallet,
        routerWallet,
        firstHopReceiver,
        secondRouterWallet,
        receiver,
        referrer.address,
        deployer.address,
        deployer.address,
    );

    val txs = contract.sendUpdateRoutePreset(deployer.address, preset, { value: ton("0.1") });
    expect(txs).toHaveSuccessfulTx({
        from: deployer.address,
        to: contract.address,
    });

    val loadedPreset = unwrapRoutePreset(contract.routePreset());
    val loadedRoutes = loadedPreset.loadRoutes();
    val loadedTargets = loadedPreset.loadTargets();
    val loadedFees = loadedPreset.loadFees();
    expect(loadedRoutes.sourceWalletAddress).toEqual(sourceWallet);
    expect(loadedRoutes.routerWalletAddress).toEqual(routerWallet);
    expect(loadedRoutes.firstHopReceiverAddress).toEqual(firstHopReceiver);
    expect(loadedTargets.secondRouterWalletAddress).toEqual(secondRouterWallet);
    expect(loadedTargets.receiverAddress).toEqual(receiver);
    expect(loadedTargets.referrerAddress).toEqual(referrer.address);
    expect(loadedFees.refundAddress).toEqual(deployer.address);
    expect(loadedFees.excessesAddress).toEqual(deployer.address);
    expect(loadedFees.fwdGas).toEqual(ton("0.03"));
    expect(loadedFees.refundFwdGas).toEqual(ton("0.01"));
}

get fun `test simple swap with referral emits stonfi payload`() {
    val (contract, deployer, referrer, _) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val plan = makeReferralPlan(deployer.address, referrer.address, receiver, routerWallet);

    val txs = contract.sendExecuteSimpleSwapWithReferral(
        deployer.address,
        7,
        sourceWallet,
        routerWallet,
        ton("1"),
        ton("0.02"),
        plan,
        { value: ton("0.2") },
    );
    expect(txs).toHaveSuccessfulTx<ExecuteSimpleSwapWithReferral>({
        from: deployer.address,
        to: contract.address,
    });

    val action = loadSingleSendAction(txs);
    expect(action.mode).toEqual(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);

    val message = action.loadMessage<JettonTransfer>();
    expect(message.info.dest).toEqual(sourceWallet);

    val transfer = action.loadBody<JettonTransfer>();
    expect(transfer.destination).toEqual(routerWallet);
    expect(transfer.responseDestination).toEqual(deployer.address);
    expect(transfer.amount).toEqual(ton("1"));
    expect(transfer.forwardTonAmount).toEqual(ton("0.02"));

    val payload = loadForwardPayload(transfer.forwardPayload) as Cell<StonFiSwapPayload>;
    val payloadData = payload.load();
    expect(payloadData.tokenWallet1).toEqual(routerWallet);
    expect(payloadData.refundAddress).toEqual(deployer.address);
    expect(payloadData.excessesAddress).toEqual(deployer.address);
    expect(payloadData.txDeadline).toEqual(plan.txDeadline);

    val route = payloadData.routeBody.load();
    expect(route.minOut).toEqual(ton("0.95"));
    expect(route.receiver).toEqual(receiver);
    expect(route.fwdGas).toEqual(ton("0.03"));
    expect(route.customPayload).toBeNull();
    expect(route.refundFwdGas).toEqual(ton("0.01"));
    expect(route.refundPayload).toBeNull();
    expect(route.refFee).toEqual(25);
    expect(route.refAddress).toEqual(referrer.address);
}

get fun `test cross swap on same router emits nested cross payload`() {
    val (contract, deployer, referrer, _) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val midWallet = randomAddress("mid_wallet");
    val receiver = randomAddress("receiver_wallet");
    val firstPlan = makeCrossFirstPlan(deployer.address, referrer.address, midWallet, routerWallet);
    val secondPlan = makeCrossSecondPlan(
        deployer.address,
        referrer.address,
        receiver,
        routerWallet,
    );

    val txs = contract.sendExecuteCrossSwapSameRouter(
        deployer.address,
        8,
        sourceWallet,
        routerWallet,
        ton("1"),
        ton("0.03"),
        firstPlan,
        secondPlan,
        { value: ton("0.2") },
    );
    expect(txs).toHaveSuccessfulTx<ExecuteCrossSwapSameRouter>({
        from: deployer.address,
        to: contract.address,
    });

    val action = loadSingleSendAction(txs);
    val transfer = action.loadBody<JettonTransfer>();
    val payload = loadForwardPayload(transfer.forwardPayload) as Cell<StonFiSwapPayload>;
    val firstPayload = payload.load();
    val firstRoute = firstPayload.routeBody.load();

    expect(firstRoute.receiver).toEqual(midWallet);
    expect(firstRoute.customPayload).toBeNotNull();
    expect(firstRoute.refFee).toEqual(20);
    expect(firstRoute.refAddress).toEqual(referrer.address);

    val crossPayload = unwrapCell(firstRoute.customPayload) as Cell<StonFiCrossSwapPayload>;
    val cross = crossPayload.load();
    expect(cross.tokenWallet1).toEqual(routerWallet);
    expect(cross.refundAddress).toEqual(deployer.address);
    expect(cross.excessesAddress).toEqual(deployer.address);
    expect(cross.txDeadline).toEqual(secondPlan.txDeadline);

    val secondRoute = cross.routeBody.load();
    expect(secondRoute.receiver).toEqual(receiver);
    expect(secondRoute.customPayload).toBeNull();
    expect(secondRoute.refFee).toEqual(0);
    expect(secondRoute.refAddress).toEqual(referrer.address);
}

get fun `test cross swap using multiple routers emits nested normal payload`() {
    val (contract, deployer, referrer, _) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val midWallet = randomAddress("mid_wallet");
    val nextRouterWallet = randomAddress("next_router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val firstPlan = makeCrossFirstPlan(deployer.address, referrer.address, midWallet, routerWallet);
    val secondPlan = makeCrossSecondPlan(
        deployer.address,
        referrer.address,
        receiver,
        nextRouterWallet,
    );

    val txs = contract.sendExecuteCrossSwapDifferentRouters(
        deployer.address,
        13,
        sourceWallet,
        routerWallet,
        ton("1"),
        ton("0.03"),
        firstPlan,
        secondPlan,
        { value: ton("0.2") },
    );
    expect(txs).toHaveSuccessfulTx<ExecuteCrossSwapDifferentRouters>({
        from: deployer.address,
        to: contract.address,
    });

    val action = loadSingleSendAction(txs);
    val transfer = action.loadBody<JettonTransfer>();
    val payload = loadForwardPayload(transfer.forwardPayload) as Cell<StonFiSwapPayload>;
    val firstPayload = payload.load();
    val firstRoute = firstPayload.routeBody.load();

    expect(firstRoute.receiver).toEqual(midWallet);
    expect(firstRoute.customPayload).toBeNotNull();
    expect(firstRoute.refFee).toEqual(20);
    expect(firstRoute.refAddress).toEqual(referrer.address);

    val nestedPayload = unwrapCell(firstRoute.customPayload) as Cell<StonFiSwapPayload>;
    val secondPayload = nestedPayload.load();
    val secondRoute = secondPayload.routeBody.load();
    expect(secondPayload.tokenWallet1).toEqual(nextRouterWallet);
    expect(secondPayload.refundAddress).toEqual(deployer.address);
    expect(secondPayload.excessesAddress).toEqual(deployer.address);
    expect(secondPayload.txDeadline).toEqual(secondPlan.txDeadline);
    expect(secondRoute.receiver).toEqual(receiver);
    expect(secondRoute.customPayload).toBeNull();
    expect(secondRoute.refFee).toEqual(0);
    expect(secondRoute.refAddress).toEqual(referrer.address);
}

get fun `test refund swap emits refund-friendly payload`() {
    val (contract, deployer, _, _) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val plan = makeRefundPlan(deployer.address, receiver, routerWallet);

    val txs = contract.sendExecuteRefundSwap(
        deployer.address,
        9,
        sourceWallet,
        routerWallet,
        ton("1"),
        ton("0.015"),
        plan,
        { value: ton("0.2") },
    );
    expect(txs).toHaveSuccessfulTx<ExecuteRefundSwap>({
        from: deployer.address,
        to: contract.address,
    });

    val action = loadSingleSendAction(txs);
    val transfer = action.loadBody<JettonTransfer>();
    val payload = loadForwardPayload(transfer.forwardPayload) as Cell<StonFiSwapPayload>;
    val payloadData = payload.load();
    expect(payloadData.refundAddress).toEqual(deployer.address);
    expect(payloadData.excessesAddress).toEqual(deployer.address);

    val route = payloadData.routeBody.load();
    expect(route.receiver).toEqual(receiver);
    expect(route.customPayload).toBeNull();
    expect(route.refundPayload).toBeNull();
    expect(route.refFee).toEqual(0);
}

get fun `test simple swap rejects invalid referral fee`() {
    val (contract, deployer, _, _) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val plan = makeInvalidReferralPlan(deployer.address, receiver, routerWallet);

    val txs = contract.sendExecuteSimpleSwapWithReferral(
        deployer.address,
        10,
        sourceWallet,
        routerWallet,
        ton("1"),
        ton("0.02"),
        plan,
        { value: ton("0.2") },
    );
    expect(txs).toHaveFailedTx({
        from: deployer.address,
        to: contract.address,
        exitCode: Errors.InvalidReferralFee,
    });
}

get fun `test non-owner cannot change swap config`() {
    val (contract, _, referrer, notDeployer) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val plan = makeReferralPlan(notDeployer.address, referrer.address, receiver, routerWallet);

    val txs = contract.sendExecuteSimpleSwapWithReferral(
        notDeployer.address,
        11,
        sourceWallet,
        routerWallet,
        ton("1"),
        ton("0.02"),
        plan,
        { value: ton("0.2") },
    );
    expect(txs).toHaveFailedTx({
        from: notDeployer.address,
        to: contract.address,
        exitCode: Errors.NotOwner,
    });
}

get fun `test non-owner cannot update route preset`() {
    val (contract, _, referrer, notDeployer) = setupTest();
    val sourceWallet = randomAddress("source_wallet");
    val routerWallet = randomAddress("router_wallet");
    val firstHopReceiver = randomAddress("first_hop_receiver_wallet");
    val secondRouterWallet = randomAddress("second_router_wallet");
    val receiver = randomAddress("receiver_wallet");
    val preset = makeRoutePreset(
        sourceWallet,
        routerWallet,
        firstHopReceiver,
        secondRouterWallet,
        receiver,
        referrer.address,
        notDeployer.address,
        notDeployer.address,
    );

    val txs = contract.sendUpdateRoutePreset(notDeployer.address, preset, { value: ton("0.1") });
    expect(txs).toHaveFailedTx({
        from: notDeployer.address,
        to: contract.address,
        exitCode: Errors.NotOwner,
    });
}

get fun `test unknown message`() {
    val (contract, deployer, _, _) = setupTest();

    val res = contract.sendAny(deployer.address, beginCell().storeInt(0x999, 32).endCell());
    expect(res).toHaveFailedTx({
        from: deployer.address,
        to: contract.address,
        exitCode: Errors.InvalidMessage,
    });

    val res2 = contract.sendAny(deployer.address, createEmptyCell());
    expect(res2).toHaveSuccessfulTx({
        from: deployer.address,
        to: contract.address,
    });
}

fun setupTest(): (StonFiSwap, Treasury, Treasury, Treasury) {
    val deployer = testing.treasury("deployer");
    val notDeployer = testing.treasury("notDeployer");
    val referrer = testing.treasury("referrer");

    val contract = StonFiSwap.fromStorage({ id: 0, owner: deployer.address, routePreset: null });
    val res = contract.deploy(deployer.address, { value: ton("1") });
    expect(res).toHaveSuccessfulDeploy({
        to: contract.address,
    });

    return (contract, deployer, referrer, notDeployer);
}

fun makeReferralPlan(
    owner: address,
    referrer: address,
    receiver: address,
    tokenWallet1: address,
): SwapPlan {
    return SwapPlan {
        tokenWallet1,
        refundAddress: owner,
        excessesAddress: owner,
        txDeadline: 1234567890,
        routeBody: SwapRouteBody {
            minOut: ton("0.95"),
            receiver,
            fwdGas: ton("0.03"),
            customPayload: null,
            refundFwdGas: ton("0.01"),
            refundPayload: null,
            refFee: 25,
            refAddress: referrer,
        }.toCell(),
    };
}

fun makeInvalidReferralPlan(owner: address, receiver: address, tokenWallet1: address): SwapPlan {
    return SwapPlan {
        tokenWallet1,
        refundAddress: owner,
        excessesAddress: owner,
        txDeadline: 1234567890,
        routeBody: SwapRouteBody {
            minOut: ton("0.95"),
            receiver,
            fwdGas: ton("0.03"),
            customPayload: null,
            refundFwdGas: ton("0.01"),
            refundPayload: null,
            refFee: 101,
            refAddress: owner,
        }.toCell(),
    };
}

fun makeRoutePreset(
    sourceWalletAddress: address,
    routerWalletAddress: address,
    firstHopReceiverAddress: address,
    secondRouterWalletAddress: address,
    receiverAddress: address,
    referrerAddress: address,
    refundAddress: address,
    excessesAddress: address,
): RoutePreset {
    return RoutePreset {
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
        fees: RoutePresetFees {
            refundAddress,
            excessesAddress,
            fwdGas: ton("0.03"),
            refundFwdGas: ton("0.01"),
        }.toCell(),
    };
}

fun makeCrossFirstPlan(
    owner: address,
    referrer: address,
    receiver: address,
    tokenWallet1: address,
): SwapPlan {
    return SwapPlan {
        tokenWallet1,
        refundAddress: owner,
        excessesAddress: owner,
        txDeadline: 2234567890,
        routeBody: SwapRouteBody {
            minOut: ton("0.75"),
            receiver,
            fwdGas: ton("0.04"),
            customPayload: null,
            refundFwdGas: ton("0.015"),
            refundPayload: null,
            refFee: 20,
            refAddress: referrer,
        }.toCell(),
    };
}

fun makeCrossSecondPlan(
    owner: address,
    referrer: address,
    receiver: address,
    tokenWallet1: address,
): SwapPlan {
    return SwapPlan {
        tokenWallet1,
        refundAddress: owner,
        excessesAddress: owner,
        txDeadline: 2234567999,
        routeBody: SwapRouteBody {
            minOut: ton("0.55"),
            receiver,
            fwdGas: ton("0.01"),
            customPayload: null,
            refundFwdGas: ton("0.01"),
            refundPayload: null,
            refFee: 0,
            refAddress: referrer,
        }.toCell(),
    };
}

fun makeRefundPlan(owner: address, receiver: address, tokenWallet1: address): SwapPlan {
    return SwapPlan {
        tokenWallet1,
        refundAddress: owner,
        excessesAddress: owner,
        txDeadline: 3234567890,
        routeBody: SwapRouteBody {
            minOut: ton("0.9"),
            receiver,
            fwdGas: ton("0.02"),
            customPayload: null,
            refundFwdGas: ton("0.02"),
            refundPayload: null,
            refFee: 0,
            refAddress: owner,
        }.toCell(),
    };
}

fun loadSingleSendAction(txs: SendResultList): TlbOutActionSendMessage {
    val actions = txs.at(0).allOutActions();
    expect(actions.size()).toEqual(1);

    val action = actions.at(0);
    assert (action is TlbOutActionSendMessage) throw Errors.InvalidSwapConfig;

    return action;
}

fun loadForwardPayload(
    forwardPayload: StonFiTlbEither<RemainingBitsAndRefs, Cell<RemainingBitsAndRefs>>,
): cell {
    assert (
        forwardPayload is StonFiTlbEitherRight<Cell<RemainingBitsAndRefs>>
    ) throw Errors.InvalidSwapConfig;
    return forwardPayload.value as cell;
}

fun unwrapCell(value: cell?): cell {
    if (value == null) {
        throw Errors.InvalidSwapConfig;
    }

    return value;
}

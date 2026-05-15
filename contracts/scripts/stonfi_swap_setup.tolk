import "@acton/io"
import "@acton/emulation/network"
import "@acton/emulation/scripts"

import "@contracts/stonfi_swap_types"
import "@wrappers/StonFiSwap.gen"

fun main(
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
) {
    val deployer = scripts.wallet("deployer");

    val contract = StonFiSwap.fromStorage({ id: 0, owner: deployer.address, routePreset: null });
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

    val deployRes = contract.deploy(deployer.address, { value: ton("0.05") });
    println(deployRes.waitForTrace());

    val res = contract.sendUpdateRoutePreset(deployer.address, routePreset, { value: ton("0.05") });
    println(res.waitForTrace());

    val loadedRoutePreset = unwrapRoutePreset(contract.routePreset());
    val loadedRoutes = loadedRoutePreset.loadRoutes();
    val loadedTargets = loadedRoutePreset.loadTargets();
    val loadedFees = loadedRoutePreset.loadFees();
    println("Updated route preset for {}", contract.address);
    println("Source wallet {}", loadedRoutes.sourceWalletAddress);
    println("Router wallet {}", loadedRoutes.routerWalletAddress);
    println("First hop receiver {}", loadedRoutes.firstHopReceiverAddress);
    println("Second router wallet {}", loadedTargets.secondRouterWalletAddress);
    println("Final receiver {}", loadedTargets.receiverAddress);
    println("Forward gas {}", loadedFees.fwdGas);
    println("Refund forward gas {}", loadedFees.refundFwdGas);
}

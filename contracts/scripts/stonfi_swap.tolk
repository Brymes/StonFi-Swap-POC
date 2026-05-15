import "@acton/io"
import "@acton/emulation/network"
import "@acton/emulation/scripts"
import "@contracts/stonfi_swap_types"
import "@wrappers/StonFiSwap.gen"

fun main() {
    val deployer = scripts.wallet("deployer");

    val contract = StonFiSwap.fromStorage({ id: 0, owner: deployer.address, routePreset: null });
    val res = contract.deploy(deployer.address, { value: ton("0.05") });
    println(res.waitForTrace());

    println("Deployed StonFiSwap to {}", contract.address);
    println("Owner is {}", contract.owner());
}

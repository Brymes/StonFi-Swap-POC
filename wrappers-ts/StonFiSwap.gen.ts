// AUTO-GENERATED, do not edit
// It's a TypeScript wrapper for a StonFiSwap contract in Tolk.
/* eslint-disable */

import * as c from '@ton/core';
import { beginCell, ContractProvider, Sender, SendMode } from '@ton/core';

// ————————————————————————————————————————————
//   predefined types and functions
//

type RemainingBitsAndRefs = c.Slice

type StoreCallback<T> = (obj: T, b: c.Builder) => void
type LoadCallback<T> = (s: c.Slice) => T

export type CellRef<T> = {
    ref: T
}

function makeCellFrom<T>(self: T, storeFn_T: StoreCallback<T>): c.Cell {
    let b = beginCell();
    storeFn_T(self, b);
    return b.endCell();
}

function loadAndCheckPrefix32(s: c.Slice, expected: number, structName: string): void {
    let prefix = s.loadUint(32);
    if (prefix !== expected) {
        throw new Error(`Incorrect prefix for '${structName}': expected 0x${expected.toString(16).padStart(8, '0')}, got 0x${prefix.toString(16).padStart(8, '0')}`);
    }
}

function formatPrefix(prefixNum: number, prefixLen: number): string {
    return prefixLen % 4 ? `0b${prefixNum.toString(2).padStart(prefixLen, '0')}` : `0x${prefixNum.toString(16).padStart(prefixLen / 4, '0')}`;
}

function loadAndCheckPrefix(s: c.Slice, expected: number, prefixLen: number, structName: string): void {
    let prefix = s.loadUint(prefixLen);
    if (prefix !== expected) {
        throw new Error(`Incorrect prefix for '${structName}': expected ${formatPrefix(expected, prefixLen)}, got ${formatPrefix(prefix, prefixLen)}`);
    }
}

function lookupPrefix(s: c.Slice, expected: number, prefixLen: number): boolean {
    return s.remainingBits >= prefixLen && s.preloadUint(prefixLen) === expected;
}

function throwNonePrefixMatch(fieldPath: string): never {
    throw new Error(`Incorrect prefix for '${fieldPath}': none of variants matched`);
}

function storeCellRef<T>(cell: CellRef<T>, b: c.Builder, storeFn_T: StoreCallback<T>): void {
    let b_ref = c.beginCell();
    storeFn_T(cell.ref, b_ref);
    b.storeRef(b_ref.endCell());
}

function loadCellRef<T>(s: c.Slice, loadFn_T: LoadCallback<T>): CellRef<T> {
    let s_ref = s.loadRef().beginParse();
    return { ref: loadFn_T(s_ref) };
}

function storeTolkRemaining(v: RemainingBitsAndRefs, b: c.Builder): void {
    b.storeSlice(v);
}

function loadTolkRemaining(s: c.Slice): RemainingBitsAndRefs {
    let rest = s.clone();
    s.loadBits(s.remainingBits);
    while (s.remainingRefs) {
        s.loadRef();
    }
    return rest;
}

function storeTolkNullable<T>(v: T | null, b: c.Builder, storeFn_T: StoreCallback<T>): void {
    if (v === null) {
        b.storeUint(0, 1);
    } else {
        b.storeUint(1, 1);
        storeFn_T(v, b);
    }
}

// ————————————————————————————————————————————
//   parse get methods result from a TVM stack
//

class StackReader {
    constructor(private tuple: c.TupleItem[]) {
    }

    static fromGetMethod(expectedN: number, getMethodResult: { stack: c.TupleReader }): StackReader {
        let tuple = [] as c.TupleItem[];
        while (getMethodResult.stack.remaining) {
            tuple.push(getMethodResult.stack.pop());
        }
        if (tuple.length !== expectedN) {
            throw new Error(`expected ${expectedN} stack width, got ${tuple.length}`);
        }
        return new StackReader(tuple);
    }

    private popExpecting<ItemT>(itemType: string): ItemT {
        const item = this.tuple.shift();
        if (item?.type === itemType) {
            return item as ItemT;
        }
        throw new Error(`not '${itemType}' on a stack`);
    }

    private popCellLike(): c.Cell {
        const item = this.tuple.shift();
        if (item && (item.type === 'cell' || item.type === 'slice' || item.type === 'builder')) {
            return item.cell;
        }
        throw new Error(`not cell/slice on a stack`);
    }

    readBigInt(): bigint {
        return this.popExpecting<c.TupleItemInt>('int').value;
    }

    readBoolean(): boolean {
        return this.popExpecting<c.TupleItemInt>('int').value !== 0n;
    }

    readCell(): c.Cell {
        return this.popCellLike();
    }

    readSlice(): c.Slice {
        return this.popCellLike().beginParse();
    }

    readNullable<T>(readFn_T: (r: StackReader) => T): T | null {
        if (this.tuple[0].type === 'null') {
            this.tuple.shift();
            return null;
        }
        return readFn_T(this);
    }

    readWideNullable<T>(stackW: number, readFn_T: (r: StackReader) => T): T | null {
        const slotTypeId = this.tuple[stackW - 1];
        if (slotTypeId?.type !== 'int') {
            throw new Error(`not 'int' on a stack`);
        }
        if (slotTypeId.value === 0n) {
            this.tuple = this.tuple.slice(stackW);
            return null;
        }
        const valueT = readFn_T(this);
        this.tuple.shift();
        return valueT;
    }

    readCellRef<T>(loadFn_T: LoadCallback<T>): CellRef<T> {
        return { ref: loadFn_T(this.readCell().beginParse()) };
    }
}

// ————————————————————————————————————————————
//   auto-generated serializers to/from cells
//

type coins = bigint

type uint16 = bigint
type uint32 = bigint
type uint64 = bigint

/**
 > type StonFiTlbEither<X, Y> = StonFiTlbEitherLeft<X> | StonFiTlbEitherRight<Y>
 */
export type StonFiTlbEither<X, Y> =
    | StonFiTlbEitherLeft<X>
    | StonFiTlbEitherRight<Y>

/**
 > struct (0b0) StonFiTlbEitherLeft<X> {
 >     value: X
 > }
 */
export interface StonFiTlbEitherLeft<X> {
    readonly $: 'StonFiTlbEitherLeft'
    value: X
}

export const StonFiTlbEitherLeft = {
    PREFIX: 0b0,

    create<X>(args: {
        value: X
    }): StonFiTlbEitherLeft<X> {
        return {
            $: 'StonFiTlbEitherLeft',
            ...args
        }
    },
}

/**
 > struct (0b1) StonFiTlbEitherRight<X> {
 >     value: X
 > }
 */
export interface StonFiTlbEitherRight<X> {
    readonly $: 'StonFiTlbEitherRight'
    value: X
}

export const StonFiTlbEitherRight = {
    PREFIX: 0b1,

    create<X>(args: {
        value: X
    }): StonFiTlbEitherRight<X> {
        return {
            $: 'StonFiTlbEitherRight',
            ...args
        }
    },
}

/**
 > struct RoutePresetRoutes {
 >     sourceWalletAddress: address
 >     routerWalletAddress: address
 >     firstHopReceiverAddress: address
 > }
 */
export interface RoutePresetRoutes {
    readonly $: 'RoutePresetRoutes'
    sourceWalletAddress: c.Address
    routerWalletAddress: c.Address
    firstHopReceiverAddress: c.Address
}

export const RoutePresetRoutes = {
    create(args: {
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        firstHopReceiverAddress: c.Address
    }): RoutePresetRoutes {
        return {
            $: 'RoutePresetRoutes',
            ...args
        }
    },
    fromSlice(s: c.Slice): RoutePresetRoutes {
        return {
            $: 'RoutePresetRoutes',
            sourceWalletAddress: s.loadAddress(),
            routerWalletAddress: s.loadAddress(),
            firstHopReceiverAddress: s.loadAddress(),
        }
    },
    store(self: RoutePresetRoutes, b: c.Builder): void {
        b.storeAddress(self.sourceWalletAddress);
        b.storeAddress(self.routerWalletAddress);
        b.storeAddress(self.firstHopReceiverAddress);
    },
    toCell(self: RoutePresetRoutes): c.Cell {
        return makeCellFrom<RoutePresetRoutes>(self, RoutePresetRoutes.store);
    }
}

/**
 > struct RoutePresetTargets {
 >     secondRouterWalletAddress: address
 >     receiverAddress: address
 >     referrerAddress: address
 > }
 */
export interface RoutePresetTargets {
    readonly $: 'RoutePresetTargets'
    secondRouterWalletAddress: c.Address
    receiverAddress: c.Address
    referrerAddress: c.Address
}

export const RoutePresetTargets = {
    create(args: {
        secondRouterWalletAddress: c.Address
        receiverAddress: c.Address
        referrerAddress: c.Address
    }): RoutePresetTargets {
        return {
            $: 'RoutePresetTargets',
            ...args
        }
    },
    fromSlice(s: c.Slice): RoutePresetTargets {
        return {
            $: 'RoutePresetTargets',
            secondRouterWalletAddress: s.loadAddress(),
            receiverAddress: s.loadAddress(),
            referrerAddress: s.loadAddress(),
        }
    },
    store(self: RoutePresetTargets, b: c.Builder): void {
        b.storeAddress(self.secondRouterWalletAddress);
        b.storeAddress(self.receiverAddress);
        b.storeAddress(self.referrerAddress);
    },
    toCell(self: RoutePresetTargets): c.Cell {
        return makeCellFrom<RoutePresetTargets>(self, RoutePresetTargets.store);
    }
}

/**
 > struct RoutePresetFees {
 >     refundAddress: address
 >     excessesAddress: address
 >     fwdGas: coins
 >     refundFwdGas: coins
 > }
 */
export interface RoutePresetFees {
    readonly $: 'RoutePresetFees'
    refundAddress: c.Address
    excessesAddress: c.Address
    fwdGas: coins
    refundFwdGas: coins
}

export const RoutePresetFees = {
    create(args: {
        refundAddress: c.Address
        excessesAddress: c.Address
        fwdGas: coins
        refundFwdGas: coins
    }): RoutePresetFees {
        return {
            $: 'RoutePresetFees',
            ...args
        }
    },
    fromSlice(s: c.Slice): RoutePresetFees {
        return {
            $: 'RoutePresetFees',
            refundAddress: s.loadAddress(),
            excessesAddress: s.loadAddress(),
            fwdGas: s.loadCoins(),
            refundFwdGas: s.loadCoins(),
        }
    },
    store(self: RoutePresetFees, b: c.Builder): void {
        b.storeAddress(self.refundAddress);
        b.storeAddress(self.excessesAddress);
        b.storeCoins(self.fwdGas);
        b.storeCoins(self.refundFwdGas);
    },
    toCell(self: RoutePresetFees): c.Cell {
        return makeCellFrom<RoutePresetFees>(self, RoutePresetFees.store);
    }
}

/**
 > struct RoutePreset {
 >     routes: Cell<RoutePresetRoutes>
 >     targets: Cell<RoutePresetTargets>
 >     fees: Cell<RoutePresetFees>
 > }
 */
export interface RoutePreset {
    readonly $: 'RoutePreset'
    routes: CellRef<RoutePresetRoutes>
    targets: CellRef<RoutePresetTargets>
    fees: CellRef<RoutePresetFees>
}

export const RoutePreset = {
    create(args: {
        routes: CellRef<RoutePresetRoutes>
        targets: CellRef<RoutePresetTargets>
        fees: CellRef<RoutePresetFees>
    }): RoutePreset {
        return {
            $: 'RoutePreset',
            ...args
        }
    },
    fromSlice(s: c.Slice): RoutePreset {
        return {
            $: 'RoutePreset',
            routes: loadCellRef<RoutePresetRoutes>(s, RoutePresetRoutes.fromSlice),
            targets: loadCellRef<RoutePresetTargets>(s, RoutePresetTargets.fromSlice),
            fees: loadCellRef<RoutePresetFees>(s, RoutePresetFees.fromSlice),
        }
    },
    store(self: RoutePreset, b: c.Builder): void {
        storeCellRef<RoutePresetRoutes>(self.routes, b, RoutePresetRoutes.store);
        storeCellRef<RoutePresetTargets>(self.targets, b, RoutePresetTargets.store);
        storeCellRef<RoutePresetFees>(self.fees, b, RoutePresetFees.store);
    },
    toCell(self: RoutePreset): c.Cell {
        return makeCellFrom<RoutePreset>(self, RoutePreset.store);
    }
}

/**
 > struct Storage {
 >     id: uint32
 >     owner: address
 >     routePreset: RoutePreset?
 > }
 */
export interface Storage {
    readonly $: 'Storage'
    id: uint32
    owner: c.Address
    routePreset: RoutePreset | null
}

export const Storage = {
    create(args: {
        id: uint32
        owner: c.Address
        routePreset: RoutePreset | null
    }): Storage {
        return {
            $: 'Storage',
            ...args
        }
    },
    fromSlice(s: c.Slice): Storage {
        return {
            $: 'Storage',
            id: s.loadUintBig(32),
            owner: s.loadAddress(),
            routePreset: s.loadBoolean() ? RoutePreset.fromSlice(s) : null,
        }
    },
    store(self: Storage, b: c.Builder): void {
        b.storeUint(self.id, 32);
        b.storeAddress(self.owner);
        storeTolkNullable<RoutePreset>(self.routePreset, b, RoutePreset.store);
    },
    toCell(self: Storage): c.Cell {
        return makeCellFrom<Storage>(self, Storage.store);
    }
}

/**
 > struct SwapRouteBody {
 >     minOut: coins
 >     receiver: address
 >     fwdGas: coins
 >     customPayload: cell?
 >     refundFwdGas: coins
 >     refundPayload: cell?
 >     refFee: uint16
 >     refAddress: address
 > }
 */
export interface SwapRouteBody {
    readonly $: 'SwapRouteBody'
    minOut: coins
    receiver: c.Address
    fwdGas: coins
    customPayload: c.Cell | null
    refundFwdGas: coins
    refundPayload: c.Cell | null
    refFee: uint16
    refAddress: c.Address
}

export const SwapRouteBody = {
    create(args: {
        minOut: coins
        receiver: c.Address
        fwdGas: coins
        customPayload: c.Cell | null
        refundFwdGas: coins
        refundPayload: c.Cell | null
        refFee: uint16
        refAddress: c.Address
    }): SwapRouteBody {
        return {
            $: 'SwapRouteBody',
            ...args
        }
    },
    fromSlice(s: c.Slice): SwapRouteBody {
        return {
            $: 'SwapRouteBody',
            minOut: s.loadCoins(),
            receiver: s.loadAddress(),
            fwdGas: s.loadCoins(),
            customPayload: s.loadBoolean() ? s.loadRef() : null,
            refundFwdGas: s.loadCoins(),
            refundPayload: s.loadBoolean() ? s.loadRef() : null,
            refFee: s.loadUintBig(16),
            refAddress: s.loadAddress(),
        }
    },
    store(self: SwapRouteBody, b: c.Builder): void {
        b.storeCoins(self.minOut);
        b.storeAddress(self.receiver);
        b.storeCoins(self.fwdGas);
        storeTolkNullable<c.Cell>(self.customPayload, b,
            (v,b) => b.storeRef(v)
        );
        b.storeCoins(self.refundFwdGas);
        storeTolkNullable<c.Cell>(self.refundPayload, b,
            (v,b) => b.storeRef(v)
        );
        b.storeUint(self.refFee, 16);
        b.storeAddress(self.refAddress);
    },
    toCell(self: SwapRouteBody): c.Cell {
        return makeCellFrom<SwapRouteBody>(self, SwapRouteBody.store);
    }
}

/**
 > struct SwapPlan {
 >     tokenWallet1: address
 >     refundAddress: address
 >     excessesAddress: address
 >     txDeadline: uint64
 >     routeBody: Cell<SwapRouteBody>
 > }
 */
export interface SwapPlan {
    readonly $: 'SwapPlan'
    tokenWallet1: c.Address
    refundAddress: c.Address
    excessesAddress: c.Address
    txDeadline: uint64
    routeBody: CellRef<SwapRouteBody>
}

export const SwapPlan = {
    create(args: {
        tokenWallet1: c.Address
        refundAddress: c.Address
        excessesAddress: c.Address
        txDeadline: uint64
        routeBody: CellRef<SwapRouteBody>
    }): SwapPlan {
        return {
            $: 'SwapPlan',
            ...args
        }
    },
    fromSlice(s: c.Slice): SwapPlan {
        return {
            $: 'SwapPlan',
            tokenWallet1: s.loadAddress(),
            refundAddress: s.loadAddress(),
            excessesAddress: s.loadAddress(),
            txDeadline: s.loadUintBig(64),
            routeBody: loadCellRef<SwapRouteBody>(s, SwapRouteBody.fromSlice),
        }
    },
    store(self: SwapPlan, b: c.Builder): void {
        b.storeAddress(self.tokenWallet1);
        b.storeAddress(self.refundAddress);
        b.storeAddress(self.excessesAddress);
        b.storeUint(self.txDeadline, 64);
        storeCellRef<SwapRouteBody>(self.routeBody, b, SwapRouteBody.store);
    },
    toCell(self: SwapPlan): c.Cell {
        return makeCellFrom<SwapPlan>(self, SwapPlan.store);
    }
}

/**
 > struct (0x0f8a7ea5) JettonTransfer {
 >     queryId: uint64
 >     amount: coins
 >     destination: address
 >     responseDestination: address
 >     customPayload: cell?
 >     forwardTonAmount: coins
 >     forwardPayload: StonFiTlbEither<RemainingBitsAndRefs, Cell<RemainingBitsAndRefs>>
 > }
 */
export interface JettonTransfer {
    readonly $: 'JettonTransfer'
    queryId: uint64
    amount: coins
    destination: c.Address
    responseDestination: c.Address
    customPayload: c.Cell | null
    forwardTonAmount: coins
    forwardPayload: StonFiTlbEither<RemainingBitsAndRefs, CellRef<RemainingBitsAndRefs>>
}

export const JettonTransfer = {
    PREFIX: 0x0f8a7ea5,

    create(args: {
        queryId: uint64
        amount: coins
        destination: c.Address
        responseDestination: c.Address
        customPayload: c.Cell | null
        forwardTonAmount: coins
        forwardPayload: StonFiTlbEither<RemainingBitsAndRefs, CellRef<RemainingBitsAndRefs>>
    }): JettonTransfer {
        return {
            $: 'JettonTransfer',
            ...args
        }
    },
    fromSlice(s: c.Slice): JettonTransfer {
        loadAndCheckPrefix32(s, 0x0f8a7ea5, 'JettonTransfer');
        return {
            $: 'JettonTransfer',
            queryId: s.loadUintBig(64),
            amount: s.loadCoins(),
            destination: s.loadAddress(),
            responseDestination: s.loadAddress(),
            customPayload: s.loadBoolean() ? s.loadRef() : null,
            forwardTonAmount: s.loadCoins(),
            forwardPayload: lookupPrefix(s, 0b0, 1) ? (() => {
                loadAndCheckPrefix(s, 0b0, 1, 'StonFiTlbEitherLeft');
                return {
                    $: 'StonFiTlbEitherLeft',
                    value: loadTolkRemaining(s),
                }
            })() :
                lookupPrefix(s, 0b1, 1) ? (() => {
                    loadAndCheckPrefix(s, 0b1, 1, 'StonFiTlbEitherRight');
                    return {
                        $: 'StonFiTlbEitherRight',
                        value: loadCellRef<RemainingBitsAndRefs>(s, loadTolkRemaining),
                    }
                })() :
                throwNonePrefixMatch('StonFiTlbEither'),
        }
    },
    store(self: JettonTransfer, b: c.Builder): void {
        b.storeUint(0x0f8a7ea5, 32);
        b.storeUint(self.queryId, 64);
        b.storeCoins(self.amount);
        b.storeAddress(self.destination);
        b.storeAddress(self.responseDestination);
        storeTolkNullable<c.Cell>(self.customPayload, b,
            (v,b) => b.storeRef(v)
        );
        b.storeCoins(self.forwardTonAmount);
        switch (self.forwardPayload.$) {
            case 'StonFiTlbEitherLeft':
                b.storeUint(0b0, 1);
                storeTolkRemaining(self.forwardPayload.value, b);
                break;
            case 'StonFiTlbEitherRight':
                b.storeUint(0b1, 1);
                storeCellRef<RemainingBitsAndRefs>(self.forwardPayload.value, b, storeTolkRemaining);
                break;
        }
    },
    toCell(self: JettonTransfer): c.Cell {
        return makeCellFrom<JettonTransfer>(self, JettonTransfer.store);
    }
}

/**
 > struct (0x5f5a0001) ExecuteSimpleSwapWithReferral {
 >     queryId: uint64
 >     sourceWalletAddress: address
 >     routerWalletAddress: address
 >     amount: coins
 >     forwardTonAmount: coins
 >     swapPlan: Cell<SwapPlan>
 > }
 */
export interface ExecuteSimpleSwapWithReferral {
    readonly $: 'ExecuteSimpleSwapWithReferral'
    queryId: uint64
    sourceWalletAddress: c.Address
    routerWalletAddress: c.Address
    amount: coins
    forwardTonAmount: coins
    swapPlan: CellRef<SwapPlan>
}

export const ExecuteSimpleSwapWithReferral = {
    PREFIX: 0x5f5a0001,

    create(args: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        swapPlan: CellRef<SwapPlan>
    }): ExecuteSimpleSwapWithReferral {
        return {
            $: 'ExecuteSimpleSwapWithReferral',
            ...args
        }
    },
    fromSlice(s: c.Slice): ExecuteSimpleSwapWithReferral {
        loadAndCheckPrefix32(s, 0x5f5a0001, 'ExecuteSimpleSwapWithReferral');
        return {
            $: 'ExecuteSimpleSwapWithReferral',
            queryId: s.loadUintBig(64),
            sourceWalletAddress: s.loadAddress(),
            routerWalletAddress: s.loadAddress(),
            amount: s.loadCoins(),
            forwardTonAmount: s.loadCoins(),
            swapPlan: loadCellRef<SwapPlan>(s, SwapPlan.fromSlice),
        }
    },
    store(self: ExecuteSimpleSwapWithReferral, b: c.Builder): void {
        b.storeUint(0x5f5a0001, 32);
        b.storeUint(self.queryId, 64);
        b.storeAddress(self.sourceWalletAddress);
        b.storeAddress(self.routerWalletAddress);
        b.storeCoins(self.amount);
        b.storeCoins(self.forwardTonAmount);
        storeCellRef<SwapPlan>(self.swapPlan, b, SwapPlan.store);
    },
    toCell(self: ExecuteSimpleSwapWithReferral): c.Cell {
        return makeCellFrom<ExecuteSimpleSwapWithReferral>(self, ExecuteSimpleSwapWithReferral.store);
    }
}

/**
 > struct (0x5f5a0002) ExecuteCrossSwapSameRouter {
 >     queryId: uint64
 >     sourceWalletAddress: address
 >     routerWalletAddress: address
 >     amount: coins
 >     forwardTonAmount: coins
 >     firstPlan: Cell<SwapPlan>
 >     secondPlan: Cell<SwapPlan>
 > }
 */
export interface ExecuteCrossSwapSameRouter {
    readonly $: 'ExecuteCrossSwapSameRouter'
    queryId: uint64
    sourceWalletAddress: c.Address
    routerWalletAddress: c.Address
    amount: coins
    forwardTonAmount: coins
    firstPlan: CellRef<SwapPlan>
    secondPlan: CellRef<SwapPlan>
}

export const ExecuteCrossSwapSameRouter = {
    PREFIX: 0x5f5a0002,

    create(args: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        firstPlan: CellRef<SwapPlan>
        secondPlan: CellRef<SwapPlan>
    }): ExecuteCrossSwapSameRouter {
        return {
            $: 'ExecuteCrossSwapSameRouter',
            ...args
        }
    },
    fromSlice(s: c.Slice): ExecuteCrossSwapSameRouter {
        loadAndCheckPrefix32(s, 0x5f5a0002, 'ExecuteCrossSwapSameRouter');
        return {
            $: 'ExecuteCrossSwapSameRouter',
            queryId: s.loadUintBig(64),
            sourceWalletAddress: s.loadAddress(),
            routerWalletAddress: s.loadAddress(),
            amount: s.loadCoins(),
            forwardTonAmount: s.loadCoins(),
            firstPlan: loadCellRef<SwapPlan>(s, SwapPlan.fromSlice),
            secondPlan: loadCellRef<SwapPlan>(s, SwapPlan.fromSlice),
        }
    },
    store(self: ExecuteCrossSwapSameRouter, b: c.Builder): void {
        b.storeUint(0x5f5a0002, 32);
        b.storeUint(self.queryId, 64);
        b.storeAddress(self.sourceWalletAddress);
        b.storeAddress(self.routerWalletAddress);
        b.storeCoins(self.amount);
        b.storeCoins(self.forwardTonAmount);
        storeCellRef<SwapPlan>(self.firstPlan, b, SwapPlan.store);
        storeCellRef<SwapPlan>(self.secondPlan, b, SwapPlan.store);
    },
    toCell(self: ExecuteCrossSwapSameRouter): c.Cell {
        return makeCellFrom<ExecuteCrossSwapSameRouter>(self, ExecuteCrossSwapSameRouter.store);
    }
}

/**
 > struct (0x5f5a0003) ExecuteRefundSwap {
 >     queryId: uint64
 >     sourceWalletAddress: address
 >     routerWalletAddress: address
 >     amount: coins
 >     forwardTonAmount: coins
 >     swapPlan: Cell<SwapPlan>
 > }
 */
export interface ExecuteRefundSwap {
    readonly $: 'ExecuteRefundSwap'
    queryId: uint64
    sourceWalletAddress: c.Address
    routerWalletAddress: c.Address
    amount: coins
    forwardTonAmount: coins
    swapPlan: CellRef<SwapPlan>
}

export const ExecuteRefundSwap = {
    PREFIX: 0x5f5a0003,

    create(args: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        swapPlan: CellRef<SwapPlan>
    }): ExecuteRefundSwap {
        return {
            $: 'ExecuteRefundSwap',
            ...args
        }
    },
    fromSlice(s: c.Slice): ExecuteRefundSwap {
        loadAndCheckPrefix32(s, 0x5f5a0003, 'ExecuteRefundSwap');
        return {
            $: 'ExecuteRefundSwap',
            queryId: s.loadUintBig(64),
            sourceWalletAddress: s.loadAddress(),
            routerWalletAddress: s.loadAddress(),
            amount: s.loadCoins(),
            forwardTonAmount: s.loadCoins(),
            swapPlan: loadCellRef<SwapPlan>(s, SwapPlan.fromSlice),
        }
    },
    store(self: ExecuteRefundSwap, b: c.Builder): void {
        b.storeUint(0x5f5a0003, 32);
        b.storeUint(self.queryId, 64);
        b.storeAddress(self.sourceWalletAddress);
        b.storeAddress(self.routerWalletAddress);
        b.storeCoins(self.amount);
        b.storeCoins(self.forwardTonAmount);
        storeCellRef<SwapPlan>(self.swapPlan, b, SwapPlan.store);
    },
    toCell(self: ExecuteRefundSwap): c.Cell {
        return makeCellFrom<ExecuteRefundSwap>(self, ExecuteRefundSwap.store);
    }
}

/**
 > struct (0x5f5a0004) UpdateRoutePreset {
 >     routePreset: RoutePreset
 > }
 */
export interface UpdateRoutePreset {
    readonly $: 'UpdateRoutePreset'
    routePreset: RoutePreset
}

export const UpdateRoutePreset = {
    PREFIX: 0x5f5a0004,

    create(args: {
        routePreset: RoutePreset
    }): UpdateRoutePreset {
        return {
            $: 'UpdateRoutePreset',
            ...args
        }
    },
    fromSlice(s: c.Slice): UpdateRoutePreset {
        loadAndCheckPrefix32(s, 0x5f5a0004, 'UpdateRoutePreset');
        return {
            $: 'UpdateRoutePreset',
            routePreset: RoutePreset.fromSlice(s),
        }
    },
    store(self: UpdateRoutePreset, b: c.Builder): void {
        b.storeUint(0x5f5a0004, 32);
        RoutePreset.store(self.routePreset, b);
    },
    toCell(self: UpdateRoutePreset): c.Cell {
        return makeCellFrom<UpdateRoutePreset>(self, UpdateRoutePreset.store);
    }
}

/**
 > struct (0x5f5a0005) ExecuteCrossSwapDifferentRouters {
 >     queryId: uint64
 >     sourceWalletAddress: address
 >     routerWalletAddress: address
 >     amount: coins
 >     forwardTonAmount: coins
 >     firstPlan: Cell<SwapPlan>
 >     secondPlan: Cell<SwapPlan>
 > }
 */
export interface ExecuteCrossSwapDifferentRouters {
    readonly $: 'ExecuteCrossSwapDifferentRouters'
    queryId: uint64
    sourceWalletAddress: c.Address
    routerWalletAddress: c.Address
    amount: coins
    forwardTonAmount: coins
    firstPlan: CellRef<SwapPlan>
    secondPlan: CellRef<SwapPlan>
}

export const ExecuteCrossSwapDifferentRouters = {
    PREFIX: 0x5f5a0005,

    create(args: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        firstPlan: CellRef<SwapPlan>
        secondPlan: CellRef<SwapPlan>
    }): ExecuteCrossSwapDifferentRouters {
        return {
            $: 'ExecuteCrossSwapDifferentRouters',
            ...args
        }
    },
    fromSlice(s: c.Slice): ExecuteCrossSwapDifferentRouters {
        loadAndCheckPrefix32(s, 0x5f5a0005, 'ExecuteCrossSwapDifferentRouters');
        return {
            $: 'ExecuteCrossSwapDifferentRouters',
            queryId: s.loadUintBig(64),
            sourceWalletAddress: s.loadAddress(),
            routerWalletAddress: s.loadAddress(),
            amount: s.loadCoins(),
            forwardTonAmount: s.loadCoins(),
            firstPlan: loadCellRef<SwapPlan>(s, SwapPlan.fromSlice),
            secondPlan: loadCellRef<SwapPlan>(s, SwapPlan.fromSlice),
        }
    },
    store(self: ExecuteCrossSwapDifferentRouters, b: c.Builder): void {
        b.storeUint(0x5f5a0005, 32);
        b.storeUint(self.queryId, 64);
        b.storeAddress(self.sourceWalletAddress);
        b.storeAddress(self.routerWalletAddress);
        b.storeCoins(self.amount);
        b.storeCoins(self.forwardTonAmount);
        storeCellRef<SwapPlan>(self.firstPlan, b, SwapPlan.store);
        storeCellRef<SwapPlan>(self.secondPlan, b, SwapPlan.store);
    },
    toCell(self: ExecuteCrossSwapDifferentRouters): c.Cell {
        return makeCellFrom<ExecuteCrossSwapDifferentRouters>(self, ExecuteCrossSwapDifferentRouters.store);
    }
}

// ————————————————————————————————————————————
//    class StonFiSwap
//

interface ExtraSendOptions {
    bounce?: boolean                    // default: false
    sendMode?: SendMode                 // default: SendMode.PAY_GAS_SEPARATELY
    extraCurrencies?: c.ExtraCurrency   // default: empty dict
}

interface DeployedAddrOptions {
    workchain?: number                  // default: 0 (basechain)
    toShard?: { fixedPrefixLength: number; closeTo: c.Address }
    overrideContractCode?: c.Cell
}

function calculateDeployedAddress(code: c.Cell, data: c.Cell, options: DeployedAddrOptions): c.Address {
    const stateInitCell = beginCell().store(c.storeStateInit({
        code,
        data,
        splitDepth: options.toShard?.fixedPrefixLength,
        special: null,
        libraries: null,
    })).endCell();

    let addrHash = stateInitCell.hash();
    if (options.toShard) {
        const shardDepth = options.toShard.fixedPrefixLength;
        addrHash = beginCell()
            .storeBits(new c.BitString(options.toShard.closeTo.hash, 0, shardDepth))
            .storeBits(new c.BitString(stateInitCell.hash(), shardDepth, 256 - shardDepth))
            .endCell()
            .beginParse().loadBuffer(32);
    }

    return new c.Address(options.workchain ?? 0, addrHash);
}

export class StonFiSwap implements c.Contract {
    static CodeCell = c.Cell.fromBase64('te6ccgECEQEABZMAART/APSkE/S88sgLAQIBYgIDBPDQ+JGRMOAg1ywi+tAAJI5FMdTU10z4ku1E0NMf+kjXCwAwUgPHBfLgZCLQ+kgx+kgx+gD6ANGBEAQCwgAS8vSBEAQBwgDy9MjLH/pSz4MTzMzMye1U4NcsIvrQAAzjAtcsIvrQABTjAtcsIvrQACzjAtcsIvrQABwEBQYHAgFIDxAB/DHTP/pI+kj6APoA10z4ku1E0NMfMfpIMMcF8uBkgRABI8IA8vSBEAMiwgDy9ND6SPpI+kjTP9TRIND6ADH6SDH6ADH0BPoAMfQEMdMP+kgx0YEQAQJuEvL0gRACAcFl8vSBEAIh0PoAMfpIMfoAMfQEMfoAMfQEMdMP+kgx0QgB/jHTP/pI+kj6APoA1NdM+JLtRNDTHzH6SDDHBfLgZIEQASTCAPL0gRADI8IA8vQB0PpI+kj6SNM/1NEF0PpI+kj6SNM/1NEp0PoAMfpIMfoAMfQE+gAx9AQx0w/6SDHRgRABAm4S8vSBEAIBwWXy9IEQAyrQ+gAx+kgx+gD0BDEJAf4x0z/6SPpI+gD6ANTXTPiS7UTQ0x8x+kgwxwXy4GSBEAEkwgDy9IEQAyPCAPL0AdD6SPpI+kjTP9TRBdD6SPpI+kjTP9TRKdD6ADH6SDH6ADH0BPoAMfQEMdMP+kgx0YEQAQJuEvL0gRACAcFl8vSBEAMq0PoAMfpIMfoA9AQxCwEU4wIwhA8BxwDy9A0A+MIA8vRtAdD6APpI+gD0BDH6APQE0w/6SNHIUAf6AhX6UlAD+gIV9ABQBPoCE/QAEssP+lLJIm3Iz5GZk3iqF/pSFfpSFPpSyz8SzMnIz5A+KfqWGMs/UAT6AhT6UhL6UhL0AAH6As+DEszJyM+FiBL6UnHPC27MyYBA+wAB/voAMfQEMdMPMfpIMdHCAPL0IND6ADH6SDH6ADH0BPoAMfQEMdMP+kgx0YEQAQJuEvL0gRACAcFl8vTIz5GnPGluFfpSE/pS+lLLP8zJBdD6APpI+gD0BDH6APQE0w/6SNHIUAf6AhX6UlAD+gIZ9ABQCPoCF/QAFssPFfpSySEKAIptyM+RmZN4qhb6UhT6UhP6UhTLP8zJyM+QPin6lhjLP1AE+gIU+lIT+lL0AAH6As+DEszJyM+FiBL6UnHPC27MyYBA+wAB/voAMfQEMdMPMfpIMdHCAPL0IND6ADH6SDH6ADH0BPoAMfQEMdMP+kgx0YEQAQJuEvL0gRACAcFl8vRtAdD6APpI+gD0BDH6APQE0w/6SNHIUAf6AhX6UlAD+gIV9ABQBPoCE/QAEssP+lLJyM+RmZN4qhX6UhP6UvpSyz/MyQUMAOzQ+gD6SPoA9AQx+gD0BNMP+kjRyFAH+gIV+lJQA/oCGfQAUAj6Ahf0ABbLDxX6UskhbcjPkZmTeKoW+lIU+lIT+lIUyz/MycjPkD4p+pYYyz9QBPoCFPpSE/pS9AAB+gLPgxLMycjPhYgS+lJxzwtuzMmAQPsAAfwx0z/6SPpI+gD6ANdM+JLtRNDTHzH6SDDHBfLgZIEQASPCAPL0gRADIsIA8vTQ+kj6SPpI0z/U0SDQ+gAx+kgx+gAx9AT6ADH0BDHTD/pIMdGBEAECbhLy9IEQAgHBZfL0gRACIdD6ADH6SDH6ADH0BDH6ADH0BDHTD/pIMdEOAPTy8m0B0PoA+kj6APQEMfoA9ATTD/pI0chQB/oCFfpSUAP6AhX0AFAE+gIT9AASyw/6UskibcjPkZmTeKoX+lIV+lIU+lLLPxLMycjPkD4p+pYYyz9QBPoCFPpSEvpSEvQAAfoCz4MSzMnIz4WIEvpScc8LbszJgED7AAA7uo3u1E0NMfMfpIMdMAAZfU1NdMgQCBlTBtbW1w4oABe4Ud7UTQ0x8x+kgwg=');

    static Errors = {
        'Errors.NotOwner': 100,
        'Errors.InvalidSwapConfig': 4097,
        'Errors.InvalidReferralFee': 4098,
        'Errors.InvalidForwardTonAmount': 4099,
        'Errors.InvalidRoutePreset': 4100,
        'Errors.InvalidMessage': 65535,
    }

    readonly address: c.Address
    readonly init: { code: c.Cell, data: c.Cell } | undefined

    protected constructor(address: c.Address, init?: { code: c.Cell, data: c.Cell }) {
        this.address = address;
        this.init = init;
    }

    static fromAddress(address: c.Address) {
        return new StonFiSwap(address);
    }

    static fromStorage(emptyStorage: {
        id: uint32
        owner: c.Address
        routePreset: RoutePreset | null
    }, deployedOptions?: DeployedAddrOptions) {
        const initialState = {
            code: deployedOptions?.overrideContractCode ?? StonFiSwap.CodeCell,
            data: Storage.toCell(Storage.create(emptyStorage)),
        };
        const address = calculateDeployedAddress(initialState.code, initialState.data, deployedOptions ?? {});
        return new StonFiSwap(address, initialState);
    }

    static createCellOfUpdateRoutePreset(body: {
        routePreset: RoutePreset
    }) {
        return UpdateRoutePreset.toCell(UpdateRoutePreset.create(body));
    }

    static createCellOfExecuteSimpleSwapWithReferral(body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        swapPlan: CellRef<SwapPlan>
    }) {
        return ExecuteSimpleSwapWithReferral.toCell(ExecuteSimpleSwapWithReferral.create(body));
    }

    static createCellOfExecuteCrossSwapSameRouter(body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        firstPlan: CellRef<SwapPlan>
        secondPlan: CellRef<SwapPlan>
    }) {
        return ExecuteCrossSwapSameRouter.toCell(ExecuteCrossSwapSameRouter.create(body));
    }

    static createCellOfExecuteCrossSwapDifferentRouters(body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        firstPlan: CellRef<SwapPlan>
        secondPlan: CellRef<SwapPlan>
    }) {
        return ExecuteCrossSwapDifferentRouters.toCell(ExecuteCrossSwapDifferentRouters.create(body));
    }

    static createCellOfExecuteRefundSwap(body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        swapPlan: CellRef<SwapPlan>
    }) {
        return ExecuteRefundSwap.toCell(ExecuteRefundSwap.create(body));
    }

    async sendDeploy(provider: ContractProvider, via: Sender, msgValue: coins, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: c.Cell.EMPTY,
            ...extraOptions
        });
    }

    async sendUpdateRoutePreset(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        routePreset: RoutePreset
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: UpdateRoutePreset.toCell(UpdateRoutePreset.create(body)),
            ...extraOptions
        });
    }

    async sendExecuteSimpleSwapWithReferral(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        swapPlan: CellRef<SwapPlan>
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ExecuteSimpleSwapWithReferral.toCell(ExecuteSimpleSwapWithReferral.create(body)),
            ...extraOptions
        });
    }

    async sendExecuteCrossSwapSameRouter(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        firstPlan: CellRef<SwapPlan>
        secondPlan: CellRef<SwapPlan>
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ExecuteCrossSwapSameRouter.toCell(ExecuteCrossSwapSameRouter.create(body)),
            ...extraOptions
        });
    }

    async sendExecuteCrossSwapDifferentRouters(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        firstPlan: CellRef<SwapPlan>
        secondPlan: CellRef<SwapPlan>
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ExecuteCrossSwapDifferentRouters.toCell(ExecuteCrossSwapDifferentRouters.create(body)),
            ...extraOptions
        });
    }

    async sendExecuteRefundSwap(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        sourceWalletAddress: c.Address
        routerWalletAddress: c.Address
        amount: coins
        forwardTonAmount: coins
        swapPlan: CellRef<SwapPlan>
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ExecuteRefundSwap.toCell(ExecuteRefundSwap.create(body)),
            ...extraOptions
        });
    }

    async getRoutePreset(provider: ContractProvider): Promise<RoutePreset | null> {
        const r = StackReader.fromGetMethod(4, await provider.get('routePreset', []));
        return r.readWideNullable<RoutePreset>(4,
            (r) => ({
                $: 'RoutePreset',
                routes: r.readCellRef<RoutePresetRoutes>(RoutePresetRoutes.fromSlice),
                targets: r.readCellRef<RoutePresetTargets>(RoutePresetTargets.fromSlice),
                fees: r.readCellRef<RoutePresetFees>(RoutePresetFees.fromSlice),
            })
        );
    }

    async getOwner(provider: ContractProvider): Promise<c.Address> {
        const r = StackReader.fromGetMethod(1, await provider.get('owner', []));
        return r.readSlice().loadAddress();
    }
}

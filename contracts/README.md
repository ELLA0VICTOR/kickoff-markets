# Kickoff Markets Contracts

The contracts are split for cleaner Remix deployment:

- `KickoffTestUSDC.sol`: testnet-only ERC20 collateral with a faucet.
- `KickoffMarkets.sol`: AMM odds, escrow-backed World Cup rooms, optimistic settlement, claims.
- `MatchClockHook.sol`: linked phase-to-fee engine.
- `MatchOracleAgent.sol`: sports API/operator settlement adapter.

Deploy order for X Layer testnet:

1. Deploy `KickoffTestUSDC.sol`.
2. Copy the token address.
3. Deploy `KickoffMarkets.sol` with the token address as constructor input.
4. Recommended: deploy `MatchClockHook.sol` with the `KickoffMarkets` address as `initialOperator`.
5. Call `setMatchClockHook(hookAddress)` on `KickoffMarkets`.
6. Recommended: deploy `MatchOracleAgent.sol` and call `setOracleAgent(agentAddress)`.
7. Put the token and market addresses in `.env`.

Use Remix optimizer with `viaIR: true` for `KickoffMarkets.sol`.

```txt
VITE_X_LAYER_NETWORK=testnet
VITE_COLLATERAL_TOKEN_ADDRESS=0xYourKickoffTestUSDC
VITE_KICKOFF_MARKETS_ADDRESS=0xYourKickoffMarkets
VITE_MATCH_CLOCK_HOOK_ADDRESS=0xYourMatchClockHook
VITE_MATCH_ORACLE_AGENT_ADDRESS=0xYourMatchOracleAgent
```

Frontend calls:

- `createRoom(string,string,string)`
- `placeTrade(bytes32,uint8,uint256)`
- `addLiquidity(bytes32,uint8,uint256)`
- `updatePhase(bytes32,uint8,string,string,uint16)`
- `proposeSettlement(bytes32,uint8,string,string)`
- `disputeSettlement(bytes32,string)`
- `finalizeSettlement(bytes32)`
- `resolveDispute(bytes32,uint8,string,string)`
- `claim(bytes32)`
- `getRoomMeta(bytes32)`
- `getRoomState(bytes32)`
- `getRoomTotals(bytes32)`

Collateral flow:

1. User claims or receives ERC20 collateral.
2. User approves `KickoffMarkets`.
3. Contract pulls collateral into escrow for trades and liquidity.
4. Oracle agent proposes a result when provider data is available.
5. Creator fallback proposes a result when provider data is unavailable.
6. Positioned users may dispute during the dispute window.
7. Undisputed proposals finalize; disputed rooms are resolved by creator/oracle.
8. Users claim payout from escrow.

Market flow:

1. LPs seed equal outcome reserves.
2. Traders buy outcome shares from the reserve curve.
3. Fees route into the room fee pool.
4. Final winning shares redeem collateral; LPs receive pro-rata winning reserve plus fees.

`MatchClockHook.sol` is the phase-to-fee policy surface. When linked, `KickoffMarkets.updatePhase` calls the hook and uses the returned fee.

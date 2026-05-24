# Kickoff Markets Contracts

The contracts are split for cleaner Remix deployment:

- `KickoffTestUSDC.sol`: testnet-only ERC20 collateral with a faucet.
- `KickoffMarkets.sol`: escrow-backed World Cup market rooms.

Deploy order for X Layer testnet:

1. Deploy `KickoffTestUSDC.sol`.
2. Copy the token address.
3. Deploy `KickoffMarkets.sol` with the token address as constructor input.
4. Put both addresses in `.env`.

```txt
VITE_X_LAYER_NETWORK=testnet
VITE_COLLATERAL_TOKEN_ADDRESS=0xYourKickoffTestUSDC
VITE_KICKOFF_MARKETS_ADDRESS=0xYourKickoffMarkets
```

Frontend calls:

- `createRoom(string,string,string)`
- `placeTrade(bytes32,uint8,uint256)`
- `addLiquidity(bytes32,uint8,uint256)`
- `updatePhase(bytes32,uint8,string,string,uint16)`
- `settle(bytes32,uint8,string,string)`
- `claim(bytes32)`
- `getRoomMeta(bytes32)`
- `getRoomState(bytes32)`
- `getRoomTotals(bytes32)`

Collateral flow:

1. User claims or receives ERC20 collateral.
2. User approves `KickoffMarkets`.
3. Contract pulls collateral into escrow for trades and liquidity.
4. Room creator settles or cancels the market.
5. Users claim payout from escrow.

`MatchClockHook.sol` is the phase-to-fee policy surface. It records match clock state and maps phases to fees so the market can expose verifiable fee changes around kickoff, live play, halftime, and settlement.

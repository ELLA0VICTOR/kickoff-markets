# Kickoff Markets Contracts

`KickoffMarkets.sol` is the receipt and room registry the frontend can call with `VITE_KICKOFF_MARKETS_ADDRESS`.

`MatchClockHook.sol` is the hackathon hook surface for match-phase fee state. It keeps the phase-to-fee policy isolated so it can be wired into a full Uniswap v4 hook implementation around the X Layer PoolManager.

Current frontend calls:

- `createRoom(string,string,string)`
- `placeTrade(bytes32,uint8,uint256)`
- `addLiquidity(bytes32,uint8,uint256)`
- `claim(bytes32)`

Deploy `KickoffMarkets.sol` first, then put the deployed address in `.env`:

```txt
VITE_X_LAYER_NETWORK=testnet
VITE_KICKOFF_MARKETS_ADDRESS=0x...
```

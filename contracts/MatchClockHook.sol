// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MatchClockHook {
    enum Phase {
        PreMatch,
        Live,
        Halftime,
        Settlement
    }

    struct ClockState {
        Phase phase;
        string clock;
        string score;
        uint16 feeBps;
        uint256 updatedAt;
    }

    mapping(bytes32 => ClockState) public clockStates;
    address public operator;

    event OperatorUpdated(address indexed operator);
    event ClockStateUpdated(bytes32 indexed roomId, Phase phase, string clock, string score, uint16 feeBps);

    modifier onlyOperator() {
        require(msg.sender == operator, "NOT_OPERATOR");
        _;
    }

    constructor(address initialOperator) {
        operator = initialOperator;
        emit OperatorUpdated(initialOperator);
    }

    function setOperator(address nextOperator) external onlyOperator {
        operator = nextOperator;
        emit OperatorUpdated(nextOperator);
    }

    function updateClock(
        bytes32 roomId,
        Phase phase,
        string calldata clock,
        string calldata score
    ) external onlyOperator returns (uint16 feeBps) {
        feeBps = feeForPhase(phase);
        clockStates[roomId] = ClockState({
            phase: phase,
            clock: clock,
            score: score,
            feeBps: feeBps,
            updatedAt: block.timestamp
        });

        emit ClockStateUpdated(roomId, phase, clock, score, feeBps);
    }

    function feeForPhase(Phase phase) public pure returns (uint16) {
        if (phase == Phase.PreMatch) return 18;
        if (phase == Phase.Live) return 46;
        if (phase == Phase.Halftime) return 34;
        return 12;
    }
}

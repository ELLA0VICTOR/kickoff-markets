// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MatchOracleAgent {
    address public owner;
    address public operator;
    address public kickoffMarkets;

    bytes4 private constant PROPOSE_SELECTOR = bytes4(keccak256("proposeSettlement(bytes32,uint8,string,string)"));
    bytes4 private constant RESOLVE_SELECTOR = bytes4(keccak256("resolveDispute(bytes32,uint8,string,string)"));
    bytes4 private constant UPDATE_PHASE_SELECTOR = bytes4(keccak256("updatePhase(bytes32,uint8,string,string,uint16)"));

    event ClockSubmitted(bytes32 indexed roomId, uint8 phase, string clock, string score, uint16 feeBps);
    event OperatorUpdated(address indexed operator);
    event ResultSubmitted(bytes32 indexed roomId, uint8 outcome, string score, string clock);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "NOT_OPERATOR");
        _;
    }

    constructor(address kickoffMarkets_, address operator_) {
        require(kickoffMarkets_ != address(0), "ZERO_MARKETS");
        require(operator_ != address(0), "ZERO_OPERATOR");
        owner = msg.sender;
        operator = operator_;
        kickoffMarkets = kickoffMarkets_;
        emit OperatorUpdated(operator_);
    }

    function setOperator(address nextOperator) external onlyOwner {
        require(nextOperator != address(0), "ZERO_OPERATOR");
        operator = nextOperator;
        emit OperatorUpdated(nextOperator);
    }

    function submitResult(
        bytes32 roomId,
        uint8 outcome,
        string calldata score,
        string calldata clock
    ) external onlyOperator {
        (bool success, bytes memory data) = kickoffMarkets.call(
            abi.encodeWithSelector(PROPOSE_SELECTOR, roomId, outcome, score, clock)
        );
        require(success, _revertReason(data));
        emit ResultSubmitted(roomId, outcome, score, clock);
    }

    function resolveResult(
        bytes32 roomId,
        uint8 outcome,
        string calldata score,
        string calldata clock
    ) external onlyOperator {
        (bool success, bytes memory data) = kickoffMarkets.call(
            abi.encodeWithSelector(RESOLVE_SELECTOR, roomId, outcome, score, clock)
        );
        require(success, _revertReason(data));
        emit ResultSubmitted(roomId, outcome, score, clock);
    }

    function submitClock(
        bytes32 roomId,
        uint8 phase,
        string calldata clock,
        string calldata score,
        uint16 suggestedFeeBps
    ) external onlyOperator {
        (bool success, bytes memory data) = kickoffMarkets.call(
            abi.encodeWithSelector(UPDATE_PHASE_SELECTOR, roomId, phase, clock, score, suggestedFeeBps)
        );
        require(success, _revertReason(data));
        emit ClockSubmitted(roomId, phase, clock, score, suggestedFeeBps);
    }

    function _revertReason(bytes memory data) private pure returns (string memory) {
        if (data.length < 68) return "ORACLE_CALL_FAILED";

        assembly {
            data := add(data, 0x04)
        }

        return abi.decode(data, (string));
    }
}

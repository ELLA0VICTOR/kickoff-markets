// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract KickoffMarkets {
    enum Phase {
        PreMatch,
        Live,
        Halftime,
        Settlement
    }

    enum Settlement {
        Open,
        ProposedCancel,
        ProposedSideA,
        ProposedSideB,
        Disputed,
        Cancelled,
        SideA,
        SideB
    }

    struct Room {
        string teamA;
        string teamB;
        string kickoff;
        string score;
        string clock;
        address creator;
        address proposer;
        uint16 baseFeeBps;
        uint16 hookFeeBps;
        Phase phase;
        Settlement settlement;
        Settlement proposedOutcome;
        bool exists;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalLpShares;
        uint256 feePool;
        uint256 createdAt;
        uint256 proposedAt;
        uint256 disputeDeadline;
        uint256 settledAt;
    }

    struct Position {
        uint256 sideAShares;
        uint256 sideBShares;
        uint256 lpShares;
        uint256 collateralSpent;
        uint256 liquidityProvided;
        uint256 feePaid;
        bool claimed;
        uint256 claimedAmount;
    }

    address public immutable collateralToken;
    address public owner;
    address public oracleAgent;
    address public matchClockHook;
    uint16 public constant MAX_HOOK_FEE_BPS = 1_000;
    uint256 public disputePeriod = 3 minutes;

    bytes4 private constant TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 private constant TRANSFER_FROM_SELECTOR = 0x23b872dd;
    bytes4 private constant UPDATE_CLOCK_SELECTOR = bytes4(keccak256("updateClock(bytes32,uint8,string,string)"));

    mapping(bytes32 => Room) public rooms;
    mapping(bytes32 => mapping(address => Position)) public positions;
    bytes32[] private roomIds;

    event Claimed(bytes32 indexed roomId, address indexed trader, uint256 payout);
    event DisputePeriodUpdated(uint256 disputePeriod);
    event HookLinked(address indexed hook);
    event LiquidityAdded(bytes32 indexed roomId, address indexed provider, uint256 amount, uint256 lpShares);
    event OracleAgentUpdated(address indexed oracleAgent);
    event PhaseUpdated(bytes32 indexed roomId, Phase phase, string clock, string score, uint16 hookFeeBps);
    event RoomCreated(bytes32 indexed roomId, string teamA, string teamB, string kickoff, address indexed creator);
    event RoomSettled(bytes32 indexed roomId, Settlement outcome, string score, string clock);
    event SettlementDisputed(bytes32 indexed roomId, address indexed disputer, string reason);
    event SettlementProposed(
        bytes32 indexed roomId,
        address indexed proposer,
        Settlement outcome,
        uint256 disputeDeadline,
        string score,
        string clock
    );
    event TradePlaced(
        bytes32 indexed roomId,
        address indexed trader,
        uint8 side,
        uint256 grossAmount,
        uint256 sharesOut,
        uint256 feeAmount,
        uint16 feeBps
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyRoomCreator(bytes32 roomId) {
        require(rooms[roomId].creator == msg.sender, "NOT_ROOM_CREATOR");
        _;
    }

    modifier onlyResolver(bytes32 roomId) {
        require(
            msg.sender == rooms[roomId].creator || msg.sender == oracleAgent || msg.sender == owner,
            "NOT_RESOLVER"
        );
        _;
    }

    constructor(address collateralToken_) {
        require(collateralToken_ != address(0), "ZERO_COLLATERAL");
        collateralToken = collateralToken_;
        owner = msg.sender;
    }

    function setOracleAgent(address nextOracleAgent) external onlyOwner {
        oracleAgent = nextOracleAgent;
        emit OracleAgentUpdated(nextOracleAgent);
    }

    function setMatchClockHook(address nextHook) external onlyOwner {
        matchClockHook = nextHook;
        emit HookLinked(nextHook);
    }

    function setDisputePeriod(uint256 nextDisputePeriod) external onlyOwner {
        require(nextDisputePeriod >= 30 seconds, "DISPUTE_TOO_SHORT");
        require(nextDisputePeriod <= 7 days, "DISPUTE_TOO_LONG");
        disputePeriod = nextDisputePeriod;
        emit DisputePeriodUpdated(nextDisputePeriod);
    }

    function createRoom(
        string calldata teamA,
        string calldata teamB,
        string calldata kickoff
    ) external returns (bytes32 roomId) {
        require(bytes(teamA).length > 0, "TEAM_A_EMPTY");
        require(bytes(teamB).length > 0, "TEAM_B_EMPTY");

        roomId = keccak256(abi.encode(block.chainid, address(this), msg.sender, teamA, teamB, kickoff, roomIds.length));
        require(!rooms[roomId].exists, "ROOM_EXISTS");

        Room storage room = rooms[roomId];
        room.teamA = teamA;
        room.teamB = teamB;
        room.kickoff = kickoff;
        room.score = "0 - 0";
        room.clock = "T-60m";
        room.creator = msg.sender;
        room.baseFeeBps = 18;
        room.hookFeeBps = 18;
        room.phase = Phase.PreMatch;
        room.settlement = Settlement.Open;
        room.exists = true;
        room.createdAt = block.timestamp;
        roomIds.push(roomId);

        emit RoomCreated(roomId, teamA, teamB, kickoff, msg.sender);
    }

    function addLiquidity(bytes32 roomId, uint8 side, uint256 collateralAmount) external {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_NOT_OPEN");
        require(side < 2, "BAD_SIDE");
        require(collateralAmount > 0, "ZERO_AMOUNT");

        _pullCollateral(msg.sender, collateralAmount);

        Position storage position = positions[roomId][msg.sender];
        position.lpShares += collateralAmount;
        position.liquidityProvided += collateralAmount;
        room.totalLpShares += collateralAmount;
        room.reserveA += collateralAmount;
        room.reserveB += collateralAmount;

        emit LiquidityAdded(roomId, msg.sender, collateralAmount, collateralAmount);
    }

    function placeTrade(bytes32 roomId, uint8 side, uint256 collateralAmount) external {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_NOT_OPEN");
        require(room.phase != Phase.Settlement, "SETTLEMENT_PHASE");
        require(side < 2, "BAD_SIDE");
        require(collateralAmount > 0, "ZERO_AMOUNT");
        require(room.reserveA > 0 && room.reserveB > 0, "NO_LIQUIDITY");

        _pullCollateral(msg.sender, collateralAmount);

        uint256 feeAmount = (collateralAmount * room.hookFeeBps) / 10_000;
        uint256 netAmount = collateralAmount - feeAmount;
        require(netAmount > 0, "NET_ZERO");

        uint256 sharesOut = _buyOutcome(room, side, netAmount);
        Position storage position = positions[roomId][msg.sender];

        if (side == 0) {
            position.sideAShares += sharesOut;
        } else {
            position.sideBShares += sharesOut;
        }

        position.collateralSpent += netAmount;
        position.feePaid += feeAmount;
        room.feePool += feeAmount;

        emit TradePlaced(roomId, msg.sender, side, collateralAmount, sharesOut, feeAmount, room.hookFeeBps);
    }

    function updatePhase(
        bytes32 roomId,
        Phase phase,
        string calldata clock,
        string calldata score,
        uint16 suggestedFeeBps
    ) external onlyRoomCreator(roomId) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_NOT_OPEN");

        uint16 nextFeeBps = _nextFeeBps(roomId, phase, clock, score, suggestedFeeBps);
        require(nextFeeBps <= MAX_HOOK_FEE_BPS, "FEE_TOO_HIGH");

        room.phase = phase;
        room.clock = clock;
        room.score = score;
        room.hookFeeBps = nextFeeBps;

        emit PhaseUpdated(roomId, phase, clock, score, nextFeeBps);
    }

    function proposeSettlement(
        bytes32 roomId,
        uint8 outcome,
        string calldata score,
        string calldata clock
    ) external onlyResolver(roomId) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_NOT_OPEN");

        Settlement proposed = _proposedSettlement(outcome);
        room.settlement = proposed;
        room.proposedOutcome = _finalSettlement(outcome);
        room.proposer = msg.sender;
        room.score = score;
        room.clock = clock;
        room.phase = Phase.Settlement;
        room.hookFeeBps = 12;
        room.proposedAt = block.timestamp;
        room.disputeDeadline = block.timestamp + disputePeriod;

        emit SettlementProposed(roomId, msg.sender, proposed, room.disputeDeadline, score, clock);
        emit PhaseUpdated(roomId, Phase.Settlement, clock, score, 12);
    }

    function disputeSettlement(bytes32 roomId, string calldata reason) external {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(_isProposed(room.settlement), "NO_PROPOSAL");
        require(block.timestamp < room.disputeDeadline, "DISPUTE_CLOSED");
        require(_hasPosition(roomId, msg.sender), "NO_POSITION");

        room.settlement = Settlement.Disputed;
        emit SettlementDisputed(roomId, msg.sender, reason);
    }

    function finalizeSettlement(bytes32 roomId) external {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(_isProposed(room.settlement), "NO_PROPOSAL");
        require(block.timestamp >= room.disputeDeadline, "DISPUTE_OPEN");

        _finalize(roomId, room.proposedOutcome, room.score, room.clock);
    }

    function resolveDispute(
        bytes32 roomId,
        uint8 outcome,
        string calldata score,
        string calldata clock
    ) external onlyResolver(roomId) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Disputed, "NOT_DISPUTED");

        _finalize(roomId, _finalSettlement(outcome), score, clock);
    }

    function claim(bytes32 roomId) external returns (uint256 payout) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(_isFinal(room.settlement), "ROOM_NOT_FINAL");

        Position storage position = positions[roomId][msg.sender];
        require(!position.claimed, "ALREADY_CLAIMED");

        payout = _quoteClaim(room, position);
        position.claimed = true;
        position.claimedAmount = payout;

        if (payout > 0) {
            _safeTransfer(msg.sender, payout);
        }

        emit Claimed(roomId, msg.sender, payout);
    }

    function quoteClaim(bytes32 roomId, address trader) external view returns (uint256) {
        Room storage room = rooms[roomId];
        if (!room.exists || !_isFinal(room.settlement)) return 0;
        return _quoteClaim(room, positions[roomId][trader]);
    }

    function getRoomMeta(bytes32 roomId)
        external
        view
        returns (
            string memory teamA,
            string memory teamB,
            string memory kickoff,
            address creator,
            uint256 createdAt
        )
    {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        return (room.teamA, room.teamB, room.kickoff, room.creator, room.createdAt);
    }

    function getRoomState(bytes32 roomId)
        external
        view
        returns (
            string memory score,
            string memory clock,
            uint8 phase,
            uint8 settlement,
            uint16 baseFeeBps,
            uint16 hookFeeBps,
            uint256 settledAt,
            uint8 proposedOutcome,
            uint256 disputeDeadline,
            address proposer
        )
    {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");

        return (
            room.score,
            room.clock,
            uint8(room.phase),
            uint8(room.settlement),
            room.baseFeeBps,
            room.hookFeeBps,
            room.settledAt,
            uint8(room.proposedOutcome),
            room.disputeDeadline,
            room.proposer
        );
    }

    function getRoomTotals(bytes32 roomId)
        external
        view
        returns (
            uint256 reserveA,
            uint256 reserveB,
            uint256 totalLpShares,
            uint256 feePool,
            uint256 totalCollateral
        )
    {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        return (room.reserveA, room.reserveB, room.totalLpShares, room.feePool, room.reserveA + room.reserveB + room.feePool);
    }

    function getPosition(bytes32 roomId, address trader)
        external
        view
        returns (
            uint256 sideAShares,
            uint256 sideBShares,
            uint256 lpShares,
            uint256 liquidityProvided,
            uint256 feePaid,
            bool claimed,
            uint256 claimedAmount
        )
    {
        Position storage position = positions[roomId][trader];
        return (
            position.sideAShares,
            position.sideBShares,
            position.lpShares,
            position.liquidityProvided,
            position.feePaid,
            position.claimed,
            position.claimedAmount
        );
    }

    function roomCount() external view returns (uint256) {
        return roomIds.length;
    }

    function roomIdAt(uint256 index) external view returns (bytes32) {
        require(index < roomIds.length, "INDEX_OUT_OF_BOUNDS");
        return roomIds[index];
    }

    function _buyOutcome(Room storage room, uint8 side, uint256 netAmount) internal returns (uint256 sharesOut) {
        uint256 invariant = room.reserveA * room.reserveB;

        if (side == 0) {
            uint256 sideANextReserveB = room.reserveB + netAmount;
            uint256 sideANextReserveA = invariant / sideANextReserveB;
            uint256 ammSharesOut = room.reserveA - sideANextReserveA;
            room.reserveA = sideANextReserveA;
            room.reserveB = sideANextReserveB;
            return netAmount + ammSharesOut;
        }

        uint256 sideBNextReserveA = room.reserveA + netAmount;
        uint256 sideBNextReserveB = invariant / sideBNextReserveA;
        uint256 sideBSharesOut = room.reserveB - sideBNextReserveB;
        room.reserveA = sideBNextReserveA;
        room.reserveB = sideBNextReserveB;
        return netAmount + sideBSharesOut;
    }

    function _nextFeeBps(
        bytes32 roomId,
        Phase phase,
        string calldata clock,
        string calldata score,
        uint16 suggestedFeeBps
    ) internal returns (uint16) {
        if (matchClockHook == address(0)) {
            return suggestedFeeBps;
        }

        (bool success, bytes memory data) = matchClockHook.call(
            abi.encodeWithSelector(UPDATE_CLOCK_SELECTOR, roomId, uint8(phase), clock, score)
        );
        require(success, "HOOK_FAILED");
        return abi.decode(data, (uint16));
    }

    function _pullCollateral(address from, uint256 amount) internal {
        _safeTransferFrom(from, address(this), amount);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool success, bytes memory data) = collateralToken.call(abi.encodeWithSelector(TRANSFER_SELECTOR, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = collateralToken.call(abi.encodeWithSelector(TRANSFER_FROM_SELECTOR, from, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }

    function _proposedSettlement(uint8 outcome) internal pure returns (Settlement) {
        if (outcome == 1) return Settlement.ProposedCancel;
        if (outcome == 2) return Settlement.ProposedSideA;
        if (outcome == 3) return Settlement.ProposedSideB;
        revert("BAD_OUTCOME");
    }

    function _finalSettlement(uint8 outcome) internal pure returns (Settlement) {
        if (outcome == 1) return Settlement.Cancelled;
        if (outcome == 2) return Settlement.SideA;
        if (outcome == 3) return Settlement.SideB;
        revert("BAD_OUTCOME");
    }

    function _isProposed(Settlement settlement) internal pure returns (bool) {
        return settlement == Settlement.ProposedCancel || settlement == Settlement.ProposedSideA || settlement == Settlement.ProposedSideB;
    }

    function _isFinal(Settlement settlement) internal pure returns (bool) {
        return settlement == Settlement.Cancelled || settlement == Settlement.SideA || settlement == Settlement.SideB;
    }

    function _hasPosition(bytes32 roomId, address trader) internal view returns (bool) {
        Position storage position = positions[roomId][trader];
        return position.sideAShares + position.sideBShares + position.lpShares > 0;
    }

    function _finalize(
        bytes32 roomId,
        Settlement outcome,
        string memory score,
        string memory clock
    ) internal {
        Room storage room = rooms[roomId];
        require(outcome == Settlement.Cancelled || outcome == Settlement.SideA || outcome == Settlement.SideB, "BAD_FINAL");

        room.settlement = outcome;
        room.phase = Phase.Settlement;
        room.score = score;
        room.clock = clock;
        room.hookFeeBps = 12;
        room.settledAt = block.timestamp;

        emit RoomSettled(roomId, outcome, score, clock);
        emit PhaseUpdated(roomId, Phase.Settlement, clock, score, 12);
    }

    function _quoteClaim(Room storage room, Position storage position) internal view returns (uint256 payout) {
        if (position.claimed) return 0;

        if (room.settlement == Settlement.Cancelled) {
            return position.collateralSpent + position.feePaid + position.liquidityProvided;
        }

        if (room.settlement == Settlement.SideA) {
            payout += position.sideAShares;
            payout += _lpPayout(room.reserveA, room.feePool, room.totalLpShares, position.lpShares);
        } else if (room.settlement == Settlement.SideB) {
            payout += position.sideBShares;
            payout += _lpPayout(room.reserveB, room.feePool, room.totalLpShares, position.lpShares);
        }
    }

    function _lpPayout(
        uint256 winningReserve,
        uint256 feePool,
        uint256 totalLpShares,
        uint256 userLpShares
    ) internal pure returns (uint256) {
        if (userLpShares == 0 || totalLpShares == 0) return 0;
        return (userLpShares * (winningReserve + feePool)) / totalLpShares;
    }
}

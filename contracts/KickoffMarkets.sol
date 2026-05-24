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
        uint16 baseFeeBps;
        uint16 hookFeeBps;
        Phase phase;
        Settlement settlement;
        bool exists;
        uint256 sideAStake;
        uint256 sideBStake;
        uint256 lpAStake;
        uint256 lpBStake;
        uint256 feePool;
        uint256 createdAt;
        uint256 settledAt;
    }

    struct Position {
        uint256 sideAStake;
        uint256 sideBStake;
        uint256 lpAStake;
        uint256 lpBStake;
        uint256 feePaid;
        bool claimed;
        uint256 claimedAmount;
    }

    address public immutable collateralToken;
    address public owner;
    uint16 public constant MAX_HOOK_FEE_BPS = 1_000;
    bytes4 private constant TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 private constant TRANSFER_FROM_SELECTOR = 0x23b872dd;

    mapping(bytes32 => Room) public rooms;
    mapping(bytes32 => mapping(address => Position)) public positions;
    bytes32[] private roomIds;

    event Claimed(bytes32 indexed roomId, address indexed trader, uint256 payout);
    event LiquidityAdded(bytes32 indexed roomId, address indexed provider, uint8 side, uint256 amount);
    event PhaseUpdated(bytes32 indexed roomId, Phase phase, string clock, string score, uint16 hookFeeBps);
    event RoomCreated(bytes32 indexed roomId, string teamA, string teamB, string kickoff, address indexed creator);
    event RoomSettled(bytes32 indexed roomId, Settlement outcome, string score, string clock);
    event TradePlaced(
        bytes32 indexed roomId,
        address indexed trader,
        uint8 side,
        uint256 grossAmount,
        uint256 netStake,
        uint256 feeAmount,
        uint16 feeBps
    );

    modifier onlyRoomCreator(bytes32 roomId) {
        require(rooms[roomId].creator == msg.sender, "NOT_ROOM_CREATOR");
        _;
    }

    constructor(address collateralToken_) {
        require(collateralToken_ != address(0), "ZERO_COLLATERAL");
        collateralToken = collateralToken_;
        owner = msg.sender;
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

    function placeTrade(bytes32 roomId, uint8 side, uint256 collateralAmount) external {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_SETTLED");
        require(room.phase != Phase.Settlement, "SETTLEMENT_PHASE");
        require(side < 2, "BAD_SIDE");
        require(collateralAmount > 0, "ZERO_AMOUNT");

        _pullCollateral(msg.sender, collateralAmount);

        uint256 feeAmount = (collateralAmount * room.hookFeeBps) / 10_000;
        uint256 netStake = collateralAmount - feeAmount;
        Position storage position = positions[roomId][msg.sender];

        if (side == 0) {
            position.sideAStake += netStake;
            room.sideAStake += netStake;
        } else {
            position.sideBStake += netStake;
            room.sideBStake += netStake;
        }

        position.feePaid += feeAmount;
        room.feePool += feeAmount;

        emit TradePlaced(roomId, msg.sender, side, collateralAmount, netStake, feeAmount, room.hookFeeBps);
    }

    function addLiquidity(bytes32 roomId, uint8 side, uint256 collateralAmount) external {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_SETTLED");
        require(side < 2, "BAD_SIDE");
        require(collateralAmount > 0, "ZERO_AMOUNT");

        _pullCollateral(msg.sender, collateralAmount);

        Position storage position = positions[roomId][msg.sender];
        if (side == 0) {
            position.lpAStake += collateralAmount;
            room.lpAStake += collateralAmount;
        } else {
            position.lpBStake += collateralAmount;
            room.lpBStake += collateralAmount;
        }

        emit LiquidityAdded(roomId, msg.sender, side, collateralAmount);
    }

    function updatePhase(
        bytes32 roomId,
        Phase phase,
        string calldata clock,
        string calldata score,
        uint16 hookFeeBps
    ) external onlyRoomCreator(roomId) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ROOM_SETTLED");
        require(hookFeeBps <= MAX_HOOK_FEE_BPS, "FEE_TOO_HIGH");

        room.phase = phase;
        room.clock = clock;
        room.score = score;
        room.hookFeeBps = hookFeeBps;

        emit PhaseUpdated(roomId, phase, clock, score, hookFeeBps);
    }

    function settle(
        bytes32 roomId,
        Settlement outcome,
        string calldata score,
        string calldata clock
    ) external onlyRoomCreator(roomId) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement == Settlement.Open, "ALREADY_SETTLED");
        require(outcome != Settlement.Open, "BAD_OUTCOME");

        room.settlement = outcome;
        room.phase = Phase.Settlement;
        room.score = score;
        room.clock = clock;
        room.hookFeeBps = 12;
        room.settledAt = block.timestamp;

        emit RoomSettled(roomId, outcome, score, clock);
        emit PhaseUpdated(roomId, Phase.Settlement, clock, score, 12);
    }

    function claim(bytes32 roomId) external returns (uint256 payout) {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(room.settlement != Settlement.Open, "ROOM_OPEN");

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
        if (!room.exists || room.settlement == Settlement.Open) return 0;
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

        return (
            room.teamA,
            room.teamB,
            room.kickoff,
            room.creator,
            room.createdAt
        );
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
            uint256 settledAt
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
            room.settledAt
        );
    }

    function getRoomTotals(bytes32 roomId)
        external
        view
        returns (
            uint256 sideAStake,
            uint256 sideBStake,
            uint256 lpAStake,
            uint256 lpBStake,
            uint256 feePool
        )
    {
        Room storage room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");

        return (
            room.sideAStake,
            room.sideBStake,
            room.lpAStake,
            room.lpBStake,
            room.feePool
        );
    }

    function getPosition(bytes32 roomId, address trader)
        external
        view
        returns (
            uint256 sideAStake,
            uint256 sideBStake,
            uint256 lpAStake,
            uint256 lpBStake,
            uint256 feePaid,
            bool claimed,
            uint256 claimedAmount
        )
    {
        Position storage position = positions[roomId][trader];
        return (
            position.sideAStake,
            position.sideBStake,
            position.lpAStake,
            position.lpBStake,
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

    function _quoteClaim(Room storage room, Position storage position) internal view returns (uint256 payout) {
        if (position.claimed) return 0;

        if (room.settlement == Settlement.Cancelled) {
            return _cancelledPayout(position);
        }

        payout = _tradePayout(room, position);
        payout += _liquidityPayout(room, position);
    }

    function _cancelledPayout(Position storage position) internal view returns (uint256) {
        return position.sideAStake + position.sideBStake + position.lpAStake + position.lpBStake + position.feePaid;
    }

    function _winnerStake(Room storage room, Position storage position) internal view returns (uint256 roomWinner, uint256 userWinner) {
        if (room.settlement == Settlement.SideA) return (room.sideAStake, position.sideAStake);
        if (room.settlement == Settlement.SideB) return (room.sideBStake, position.sideBStake);
        return (0, 0);
    }

    function _tradePayout(Room storage room, Position storage position) internal view returns (uint256) {
        (uint256 roomWinner, uint256 userWinner) = _winnerStake(room, position);
        uint256 totalTradingPot = room.sideAStake + room.sideBStake;

        if (totalTradingPot > 0) {
            if (roomWinner > 0 && userWinner > 0) {
                return (userWinner * totalTradingPot) / roomWinner;
            } else if (roomWinner == 0) {
                return position.sideAStake + position.sideBStake;
            }
        }

        return 0;
    }

    function _liquidityPayout(Room storage room, Position storage position) internal view returns (uint256 payout) {
        uint256 lpStake = position.lpAStake + position.lpBStake;
        uint256 totalLpStake = room.lpAStake + room.lpBStake;

        if (lpStake > 0) {
            payout += lpStake;
            if (totalLpStake > 0) {
                payout += (lpStake * room.feePool) / totalLpStake;
            }
        } else if (totalLpStake == 0 && room.feePool > 0) {
            (uint256 roomWinner, uint256 userWinner) = _winnerStake(room, position);
            if (roomWinner > 0 && userWinner > 0) {
                payout += (userWinner * room.feePool) / roomWinner;
            }
        }
    }
}

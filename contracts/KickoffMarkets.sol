// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract KickoffMarkets {
    enum Phase {
        PreMatch,
        Live,
        Halftime,
        Settlement
    }

    struct Room {
        string teamA;
        string teamB;
        string kickoff;
        string score;
        string clock;
        address creator;
        address pool;
        address hook;
        uint16 baseFeeBps;
        uint16 hookFeeBps;
        Phase phase;
        bool exists;
    }

    struct Position {
        uint256 sideAUsdc;
        uint256 sideBUsdc;
        uint256 liquidityUsdc;
        bool claimed;
    }

    mapping(bytes32 => Room) public rooms;
    mapping(bytes32 => mapping(address => Position)) public positions;
    bytes32[] public roomIds;

    event RoomCreated(bytes32 indexed roomId, string teamA, string teamB, string kickoff, address indexed creator);
    event PoolLinked(bytes32 indexed roomId, address indexed pool, address indexed hook);
    event TradePlaced(bytes32 indexed roomId, address indexed trader, uint8 side, uint256 usdcAmount, uint16 feeBps);
    event LiquidityAdded(bytes32 indexed roomId, address indexed provider, uint8 side, uint256 usdcAmount);
    event PhaseUpdated(bytes32 indexed roomId, Phase phase, string clock, string score, uint16 hookFeeBps);
    event Claimed(bytes32 indexed roomId, address indexed trader);

    modifier onlyRoomCreator(bytes32 roomId) {
        require(rooms[roomId].creator == msg.sender, "NOT_ROOM_CREATOR");
        _;
    }

    function createRoom(
        string calldata teamA,
        string calldata teamB,
        string calldata kickoff
    ) external returns (bytes32 roomId) {
        roomId = keccak256(abi.encode(block.chainid, msg.sender, teamA, teamB, kickoff, block.timestamp));
        require(!rooms[roomId].exists, "ROOM_EXISTS");

        rooms[roomId] = Room({
            teamA: teamA,
            teamB: teamB,
            kickoff: kickoff,
            score: "0 - 0",
            clock: "T-60m",
            creator: msg.sender,
            pool: address(0),
            hook: address(0),
            baseFeeBps: 18,
            hookFeeBps: 18,
            phase: Phase.PreMatch,
            exists: true
        });
        roomIds.push(roomId);

        emit RoomCreated(roomId, teamA, teamB, kickoff, msg.sender);
    }

    function linkPool(bytes32 roomId, address pool, address hook) external onlyRoomCreator(roomId) {
        require(rooms[roomId].exists, "ROOM_NOT_FOUND");
        rooms[roomId].pool = pool;
        rooms[roomId].hook = hook;
        emit PoolLinked(roomId, pool, hook);
    }

    function placeTrade(bytes32 roomId, uint8 side, uint256 usdcAmount) external {
        Room memory room = rooms[roomId];
        require(room.exists, "ROOM_NOT_FOUND");
        require(side < 2, "BAD_SIDE");
        require(usdcAmount > 0, "ZERO_AMOUNT");

        Position storage position = positions[roomId][msg.sender];
        if (side == 0) {
            position.sideAUsdc += usdcAmount;
        } else {
            position.sideBUsdc += usdcAmount;
        }

        emit TradePlaced(roomId, msg.sender, side, usdcAmount, room.hookFeeBps);
    }

    function addLiquidity(bytes32 roomId, uint8 side, uint256 usdcAmount) external {
        require(rooms[roomId].exists, "ROOM_NOT_FOUND");
        require(side < 2, "BAD_SIDE");
        require(usdcAmount > 0, "ZERO_AMOUNT");

        positions[roomId][msg.sender].liquidityUsdc += usdcAmount;
        emit LiquidityAdded(roomId, msg.sender, side, usdcAmount);
    }

    function updatePhase(
        bytes32 roomId,
        Phase phase,
        string calldata clock,
        string calldata score,
        uint16 hookFeeBps
    ) external onlyRoomCreator(roomId) {
        require(rooms[roomId].exists, "ROOM_NOT_FOUND");
        require(hookFeeBps <= 1000, "FEE_TOO_HIGH");

        rooms[roomId].phase = phase;
        rooms[roomId].clock = clock;
        rooms[roomId].score = score;
        rooms[roomId].hookFeeBps = hookFeeBps;

        emit PhaseUpdated(roomId, phase, clock, score, hookFeeBps);
    }

    function claim(bytes32 roomId) external {
        require(rooms[roomId].exists, "ROOM_NOT_FOUND");
        Position storage position = positions[roomId][msg.sender];
        require(!position.claimed, "ALREADY_CLAIMED");
        position.claimed = true;
        emit Claimed(roomId, msg.sender);
    }

    function roomCount() external view returns (uint256) {
        return roomIds.length;
    }
}

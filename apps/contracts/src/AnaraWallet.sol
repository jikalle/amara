// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  AnaraWallet
 * @notice Safe{Core}-based smart wallet with an autonomous agent module.
 *         The owner holds the master key. The agent module can execute
 *         approved actions (swaps, yields, rebalances) autonomously up
 *         to configured limits — without requiring the owner to sign
 *         every individual transaction.
 *
 * Architecture:
 *  - AnaraWallet:    ERC-4337 compatible smart account (Safe core)
 *  - AgentModule:    Trusted module that can call executeFromModule()
 *  - GuardRails:     Per-strategy limits, daily caps, chain allow-lists
 *
 * @dev    This is a simplified scaffold. Production version integrates
 *         Safe{Core} Protocol v1.4 + Permissionless.js ERC-4337 support.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract AnaraWallet {

    // ── Events ──────────────────────────────────────────────────────
    event AgentExecuted(
        address indexed agent,
        address indexed target,
        uint256 value,
        bytes   data,
        bytes32 indexed actionId
    );
    event GuardRailUpdated(string key, uint256 value);
    event AgentRegistered(address agent, bool active);
    event DailyLimitReset(uint256 timestamp);

    // ── State ────────────────────────────────────────────────────────
    address public owner;
    mapping(address => bool) public authorizedAgents;

    // Guard rails
    uint256 public dailySpendLimit;   // USD equivalent (6 decimals, USDC scale)
    uint256 public maxTradeSize;      // per-trade cap
    uint256 public spentToday;        // resets every 24h
    uint256 public lastResetDay;      // unix day number

    // Chain allow-list (chainId => allowed)
    mapping(uint256 => bool) public allowedChains;

    // Strategy toggles (strategyId hash => active)
    mapping(bytes32 => bool) public strategyActive;

    // Nonce for replay protection
    uint256 public nonce;

    // ── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "AnaraWallet: not owner");
        _;
    }

    modifier onlyAgent() {
        require(authorizedAgents[msg.sender], "AnaraWallet: not authorized agent");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────
    constructor(
        address _owner,
        uint256 _dailySpendLimit,
        uint256 _maxTradeSize
    ) {
        owner             = _owner;
        dailySpendLimit   = _dailySpendLimit;
        maxTradeSize      = _maxTradeSize;
        lastResetDay      = block.timestamp / 1 days;

        // Base is allowed by default
        allowedChains[8453] = true;
        allowedChains[1]    = true;

        // All strategies active by default
        strategyActive[keccak256("arb")]       = true;
        strategyActive[keccak256("yield")]     = true;
        strategyActive[keccak256("rebalance")] = true;
        strategyActive[keccak256("brickt")]    = true;
    }

    // ── Owner functions ─────────────────────────────────────────────

    function registerAgent(address agent, bool active) external onlyOwner {
        authorizedAgents[agent] = active;
        emit AgentRegistered(agent, active);
    }

    function setDailySpendLimit(uint256 limit) external onlyOwner {
        dailySpendLimit = limit;
        emit GuardRailUpdated("dailySpendLimit", limit);
    }

    function setMaxTradeSize(uint256 limit) external onlyOwner {
        maxTradeSize = limit;
        emit GuardRailUpdated("maxTradeSize", limit);
    }

    function setChainAllowed(uint256 chainId, bool allowed) external onlyOwner {
        allowedChains[chainId] = allowed;
    }

    function toggleStrategy(string calldata strategyId, bool active) external onlyOwner {
        strategyActive[keccak256(bytes(strategyId))] = active;
    }

    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "AnaraWallet: execution failed");
        return result;
    }

    // ── Agent functions ─────────────────────────────────────────────

    /**
     * @notice Agent executes an approved action within guard rails.
     * @param target     Contract to call (DEX router, bridge, etc.)
     * @param value      ETH value to send
     * @param data       Encoded calldata
     * @param usdAmount  Estimated USD value of this action (6 dec)
     * @param strategyId Which strategy is triggering this ("arb", "yield", etc.)
     * @param actionId   Unique action ID for event tracking
     */
    function executeFromAgent(
        address  target,
        uint256  value,
        bytes calldata data,
        uint256  usdAmount,
        string calldata strategyId,
        bytes32  actionId
    ) external onlyAgent returns (bytes memory) {
        _resetDailyIfNeeded();

        // Guard rail checks
        require(strategyActive[keccak256(bytes(strategyId))], "AnaraWallet: strategy paused");
        require(usdAmount <= maxTradeSize, "AnaraWallet: exceeds max trade size");
        require(spentToday + usdAmount <= dailySpendLimit, "AnaraWallet: daily limit exceeded");

        spentToday += usdAmount;

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "AnaraWallet: agent execution failed");

        emit AgentExecuted(msg.sender, target, value, data, actionId);
        return result;
    }

    /**
     * @notice Emergency pause — disables all agent activity.
     */
    function emergencyPause() external onlyOwner {
        strategyActive[keccak256("arb")]       = false;
        strategyActive[keccak256("yield")]     = false;
        strategyActive[keccak256("rebalance")] = false;
        strategyActive[keccak256("brickt")]    = false;
    }

    // ── Token helpers ────────────────────────────────────────────────

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    function withdrawETH(address payable to, uint256 amount) external onlyOwner {
        to.transfer(amount);
    }

    // ── Internal ─────────────────────────────────────────────────────

    function _resetDailyIfNeeded() internal {
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            spentToday   = 0;
            lastResetDay = today;
            emit DailyLimitReset(block.timestamp);
        }
    }

    // ── View helpers ─────────────────────────────────────────────────

    function remainingDailyBudget() external view returns (uint256) {
        return dailySpendLimit > spentToday ? dailySpendLimit - spentToday : 0;
    }

    function isStrategyActive(string calldata strategyId) external view returns (bool) {
        return strategyActive[keccak256(bytes(strategyId))];
    }

    receive() external payable {}
}

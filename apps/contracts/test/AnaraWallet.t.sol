// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AnaraWallet.sol";

contract AnaraWalletTest is Test {
    AnaraWallet wallet;
    address owner    = address(0x1);
    address agent    = address(0x2);
    address attacker = address(0x3);

    uint256 DAILY_LIMIT  = 5_000e6; // $5,000 USDC scale
    uint256 MAX_TRADE    = 2_000e6; // $2,000

    function setUp() public {
        vm.prank(owner);
        wallet = new AnaraWallet(owner, DAILY_LIMIT, MAX_TRADE);
        vm.prank(owner);
        wallet.registerAgent(agent, true);
    }

    function test_ownerCanRegisterAgent() public {
        assertEq(wallet.authorizedAgents(agent), true);
    }

    function test_unauthorizedAgentReverts() public {
        vm.prank(attacker);
        vm.expectRevert("AnaraWallet: not authorized agent");
        wallet.executeFromAgent(address(0), 0, "", 100e6, "arb", bytes32(0));
    }

    function test_exceedMaxTradeSizeReverts() public {
        vm.prank(agent);
        vm.expectRevert("AnaraWallet: exceeds max trade size");
        wallet.executeFromAgent(address(0), 0, "", MAX_TRADE + 1, "arb", bytes32(0));
    }

    function test_exceedDailyLimitReverts() public {
        // Spend close to limit
        vm.startPrank(agent);
        wallet.executeFromAgent(address(this), 0, abi.encodeWithSignature("noop()"), 2_000e6, "arb", bytes32(uint256(1)));
        wallet.executeFromAgent(address(this), 0, abi.encodeWithSignature("noop()"), 2_000e6, "arb", bytes32(uint256(2)));
        // This should fail — only $1,000 remaining
        vm.expectRevert("AnaraWallet: daily limit exceeded");
        wallet.executeFromAgent(address(this), 0, abi.encodeWithSignature("noop()"), 2_000e6, "arb", bytes32(uint256(3)));
        vm.stopPrank();
    }

    function test_pausedStrategyReverts() public {
        vm.prank(owner);
        wallet.toggleStrategy("arb", false);
        vm.prank(agent);
        vm.expectRevert("AnaraWallet: strategy paused");
        wallet.executeFromAgent(address(0), 0, "", 100e6, "arb", bytes32(0));
    }

    function test_emergencyPauseDisablesAll() public {
        vm.prank(owner);
        wallet.emergencyPause();
        assertFalse(wallet.isStrategyActive("arb"));
        assertFalse(wallet.isStrategyActive("yield"));
        assertFalse(wallet.isStrategyActive("rebalance"));
        assertFalse(wallet.isStrategyActive("brickt"));
    }

    function test_dailyResetAfter24h() public {
        vm.prank(agent);
        wallet.executeFromAgent(address(this), 0, abi.encodeWithSignature("noop()"), 4_000e6, "arb", bytes32(uint256(1)));
        assertEq(wallet.spentToday(), 4_000e6);

        // Fast-forward 1 day
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(agent);
        wallet.executeFromAgent(address(this), 0, abi.encodeWithSignature("noop()"), 1_000e6, "arb", bytes32(uint256(2)));
        assertEq(wallet.spentToday(), 1_000e6);
    }

    function test_remainingDailyBudget() public view {
        assertEq(wallet.remainingDailyBudget(), DAILY_LIMIT);
    }

    // Helper — accept calls from wallet during tests
    function noop() external {}
    receive() external payable {}
}

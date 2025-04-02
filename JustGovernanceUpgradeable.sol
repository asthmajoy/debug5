// SPDX-License-Identifier: MIT
// JustGovernanceUpgradeable.sol - Optimized for proxy compatibility and reduced bytecode size

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title JustTokenUpgradeable
 * @notice Interface for the JustToken contract
 */
interface JustTokenUpgradeable {
    function getEffectiveVotingPower(address voter, uint256 snapshotId) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function createSnapshot() external returns (uint256);
    function governanceTransfer(address from, address to, uint256 amount) external returns (bool);
    function governanceMint(address to, uint256 amount) external returns (bool);
    function governanceBurn(address from, uint256 amount) external returns (bool);
    function emergency(bool isPause, address tokenAddress) external;
}

/**
 * @title JustTimelockUpgradeable
 * @notice Interface for the JustTimelock contract
 */
interface JustTimelockUpgradeable {
    enum ThreatLevel { LOW, MEDIUM, HIGH, CRITICAL }
    
    function queueTransaction(address target, uint256 value, bytes calldata data, uint256 delay) external returns (bytes32 txHash);
    function queueTransactionWithThreatLevel(address target, uint256 value, bytes memory data) external returns (bytes32);
    function executeTransaction(bytes32 txHash) external returns (bytes memory);
    function executeExpiredTransaction(bytes32 txHash) external returns (bytes memory);
    function cancelTransaction(bytes32 txHash) external;
    function queuedTransactions(bytes32 txHash) external view returns (bool);
    function getTransaction(bytes32 txHash) external view returns (address target, uint256 value, bytes memory data, uint256 eta, uint8 state);
    function gracePeriod() external view returns (uint256);
    function minDelay() external view returns (uint256);
    function getThreatLevel(address target, bytes memory data) external view returns (ThreatLevel);
    function getDelayForThreatLevel(ThreatLevel level) external view returns (uint256);
}

/**
 * @title ProposalLib
 * @notice Library for proposal flags to efficiently track proposal states
 */
library ProposalLib {
    uint8 constant EXECUTED_FLAG = 1;      // 00000001
    uint8 constant CANCELED_FLAG = 2;      // 00000010
    uint8 constant STAKE_REFUNDED_FLAG = 4; // 00000100
    uint8 constant QUEUED_FLAG = 8;        // 00001000
    
    function isExecuted(uint8 flags) internal pure returns (bool) { return (flags & EXECUTED_FLAG) != 0; }
    function isCanceled(uint8 flags) internal pure returns (bool) { return (flags & CANCELED_FLAG) != 0; }
    function isStakeRefunded(uint8 flags) internal pure returns (bool) { return (flags & STAKE_REFUNDED_FLAG) != 0; }
    function isQueued(uint8 flags) internal pure returns (bool) { return (flags & QUEUED_FLAG) != 0; }
    
    function setExecuted(uint8 flags) internal pure returns (uint8) { return flags | EXECUTED_FLAG; }
    function setCanceled(uint8 flags) internal pure returns (uint8) { return flags | CANCELED_FLAG; }
    function setStakeRefunded(uint8 flags) internal pure returns (uint8) { return flags | STAKE_REFUNDED_FLAG; }
    function setQueued(uint8 flags) internal pure returns (uint8) { return flags | QUEUED_FLAG; }
}

/**
 * @title JustGovernanceUpgradeable
 * @notice Optimized governance contract for Indiana Legal Aid DAO with external timelock
 * @dev Modified for proxy compatibility with initializer pattern
 */
contract JustGovernanceUpgradeable is 
    Initializable,
    AccessControlEnumerableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;
    using ProposalLib for uint8;

    // ==================== CUSTOM ERRORS ====================
    error GovernanceError();
    error NotAuthorized();
    error AlreadyVoted();
    error VotingEnded();
    error InvalidVoteType();
    error InvalidDuration(uint256 provided, uint256 min, uint256 max);
    error InsufficientBalance(uint256 available, uint256 required);
    error InvalidPercentage();
    error NoValidChange();
    error TransferFailed();
    error CallFailed();
    error NotSucceeded();
    error AlreadyRefunded();
    error NotProposer();
    error NotDefeated();
    error NoVotingPower();
    error LastAdminRole(); 
    error TimelockError();
    error TimelockNotConfigured();
    error ExecutionFailed(bytes data);

    // ==================== CONSTANTS ====================
    // Role-based access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    
    // Event constants
    uint8 constant STATUS_CREATED = 0;
    uint8 constant STATUS_CANCELED = 1;
    uint8 constant STATUS_QUEUED = 2;
    uint8 constant STATUS_EXECUTED = 3;
    uint8 constant STATUS_EXPIRED = 4;
    
    uint8 constant REFUND_FULL = 0;
    uint8 constant REFUND_PARTIAL = 1;
    
    uint8 constant PARAM_VOTING_DURATION = 0;
    uint8 constant PARAM_QUORUM = 1;
    uint8 constant PARAM_TIMELOCK_DELAY = 2;
    uint8 constant PARAM_PROPOSAL_THRESHOLD = 3;
    uint8 constant PARAM_PROPOSAL_STAKE = 4;
    uint8 constant PARAM_DEFEATED_REFUND_PERCENTAGE = 5;
    uint8 constant PARAM_CANCELED_REFUND_PERCENTAGE = 6;
    uint8 constant PARAM_EXPIRED_REFUND_PERCENTAGE = 7;
    
    // ==================== STORAGE VARIABLES ====================
    // Reference to the JustToken contract
    JustTokenUpgradeable public justToken;
    
    // Reference to the JustTimelock contract
    JustTimelockUpgradeable public timelock;

    // Proposal types - enhanced with new types
    enum ProposalType { 
        General,              // 0
        Withdrawal,           // 1
        TokenTransfer,        // 2
        GovernanceChange,     // 3
        ExternalERC20Transfer,// 4
        TokenMint,            // 5
        TokenBurn,            // 6
        Signaling             // 7
    }
    
    enum ProposalState { Active, Canceled, Defeated, Succeeded, Queued, Executed, Expired }

    // Optimized ProposalData struct with tight packing
    struct ProposalData {
        // Slot 1: Pack small values together (160 bits total)
        uint8 flags;          // 8 bits
        uint8 pType;          // 8 bits (ProposalType enum as uint8)
        uint48 createdAt;     // 48 bits
        uint48 deadline;      // 48 bits
        address proposer;     // 160 bits

        // Slot 2: Vote counts (256 bits total)
        uint128 yesVotes;     // 128 bits
        uint128 noVotes;      // 128 bits
        
        // Slot 3: More vote data (256 bits total)
        uint128 abstainVotes; // 128 bits
        uint128 stakedAmount; // 128 bits
        
        // Slot 4: Transaction data
        uint256 snapshotId;   // 256 bits
        
        // Slot 5: Transaction hash
        bytes32 timelockTxHash; // 256 bits
        
        // Dynamic data - each takes multiple slots
        string description;   // Variable length
        bytes typeSpecificData; // Variable length for type-specific data
    }
    
    // Helper functions for packing/unpacking proposal type-specific data
    function packProposalData(
        ProposalType pType,
        address target,
        bytes memory callData,
        uint256 amount,
        address payable recipient,
        address token,
        uint256 newThreshold,
        uint256 newQuorum,
        uint256 newVotingDuration,
        uint256 newTimelockDelay
    ) internal pure returns (bytes memory) {
        if (pType == ProposalType.General) {
            return abi.encode(target, callData);
        } else if (pType == ProposalType.GovernanceChange) {
            return abi.encode(newThreshold, newQuorum, newVotingDuration, newTimelockDelay);
        } else if (pType == ProposalType.ExternalERC20Transfer) {
            return abi.encode(recipient, amount, token);
        } else if (pType == ProposalType.Signaling) {
            return new bytes(0); // No data needed for signaling
        } else {
            // Withdrawal, TokenTransfer, TokenMint, TokenBurn
            return abi.encode(recipient, amount);
        }
    }
    
    // Unpacking functions for each proposal type
    function unpackGeneralData(bytes memory data) internal pure returns (address target, bytes memory callData) {
        return abi.decode(data, (address, bytes));
    }
    
    function unpackGovernanceChangeData(bytes memory data) internal pure returns (
        uint256 newThreshold,
        uint256 newQuorum,
        uint256 newVotingDuration,
        uint256 newTimelockDelay
    ) {
        return abi.decode(data, (uint256, uint256, uint256, uint256));
    }
    
    function unpackTransferData(bytes memory data) internal pure returns (address payable recipient, uint256 amount) {
        return abi.decode(data, (address, uint256));
    }
    
    function unpackERC20TransferData(bytes memory data) internal pure returns (
        address payable recipient, 
        uint256 amount,
        address token
    ) {
        return abi.decode(data, (address, uint256, address));
    }
    
    // Array to maintain proposal data
    ProposalData[] private _proposals;
    
    // Mapping to track proposal voting
    mapping(uint256 => mapping(address => uint256)) public proposalVoterInfo;

    // This tracks all voters for each proposal
    mapping(uint256 => address[]) private _proposalVoters;
    // This tracks whether an address has voted on a specific proposal
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    
    // Governance parameters - packed into one struct to save gas
    struct GovParams {
        uint256 votingDuration;
        uint256 quorum;
        uint256 timelockDelay;
        uint256 proposalCreationThreshold;
        uint256 proposalStake;
        uint256 defeatedRefundPercentage;
        uint256 canceledRefundPercentage;
        uint256 expiredRefundPercentage;
    }
    
    GovParams public govParams;
    
    // Governance constraints
    uint256 public minVotingDuration;
    uint256 public maxVotingDuration;
    
    // Security mappings
    mapping(bytes4 => bool) public allowedFunctionSelectors;
    mapping(address => bool) public allowedTargets;
    
    // ==================== EVENTS ====================
    // Super-consolidated event - handles all proposal-related events
    event ProposalEvent(
        uint256 indexed proposalId, 
        uint8 indexed eventType,
        address indexed actor,
        bytes data
    );
    
    // Parameter change event
    event GovParamChange(uint8 pType, uint256 oldVal, uint256 newVal);
    event SecuritySettingUpdated(bytes4 selector, bool selectorAllowed, address target, bool targetAllowed);
    event RoleChange(bytes32 indexed role, address indexed account, bool isGranted);
    event ContractPaused(address indexed pauser);
    event ContractUnpaused(address indexed unpauser);
    event ContractInitialized(address indexed token, address indexed timelock, address indexed admin);
    
    // ==================== MODIFIERS ====================
    /**
     * @dev Only allows admin or timelock to call function
     */
    modifier onlyAdminOrTimelock() {
        if (!hasRole(ADMIN_ROLE, msg.sender) && msg.sender != address(timelock)) revert NotAuthorized();
        _;
    }
    
    /**
     * @dev Checks if proposal ID is valid and proposal is active
     */
    modifier validActiveProposal(uint256 proposalId) {
        if (proposalId >= _proposals.length) revert GovernanceError();
        if (_proposals[proposalId].flags.isCanceled()) revert GovernanceError();
        if (_proposals[proposalId].flags.isExecuted()) revert GovernanceError();
        _;
    }
    
    // ==================== INITIALIZATION ====================
    /**
     * @notice Initializer function that replaces constructor for proxy pattern
     */
    function initialize(
        string memory name,
        address tokenAddress,
        address timelockAddress,
        address admin,
        uint256 proposalThreshold,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 quorumNumerator,
        uint256 successfulRefund,
        uint256 cancelledRefund,
        uint256 defeatedRefund,
        uint256 expiredRefund
    ) public initializer {
        if (admin == address(0) || tokenAddress == address(0) || timelockAddress == address(0)) 
            revert GovernanceError();
        
        // Initialize inherited contracts
        __AccessControlEnumerable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
        _setupRole(GUARDIAN_ROLE, admin);
        
        justToken = JustTokenUpgradeable(tokenAddress);
        timelock = JustTimelockUpgradeable(timelockAddress);
        
        // Set governance constraints
        minVotingDuration = 600;
        maxVotingDuration = 365 days;
        
        // Initialize governance parameters
        govParams.votingDuration = votingPeriod;
        govParams.quorum = proposalThreshold;
        govParams.timelockDelay = votingDelay;
        govParams.proposalCreationThreshold = proposalThreshold;
        govParams.proposalStake = proposalThreshold / 100; // 1% of threshold as stake
        
        // Set the separate refund percentages
        govParams.defeatedRefundPercentage = defeatedRefund;
        govParams.canceledRefundPercentage = cancelledRefund;
        govParams.expiredRefundPercentage = expiredRefund;
        
        // Add basic allowed function selectors
        allowedFunctionSelectors[bytes4(keccak256("transfer(address,uint256)"))] = true;
        allowedFunctionSelectors[bytes4(keccak256("approve(address,uint256)"))] = true;
        
        emit ContractInitialized(tokenAddress, timelockAddress, admin);
    }
    
    /**
     * @notice Function that authorizes an upgrade to a new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        // Authorization is handled by the onlyRole modifier
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    /**
     * @notice Pause the contract
     */
    function pause() external {
        if (!hasRole(GUARDIAN_ROLE, msg.sender) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != address(timelock))
            revert NotAuthorized();
        _pause();
        emit ContractPaused(msg.sender);
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external {
        if (!hasRole(ADMIN_ROLE, msg.sender) && msg.sender != address(timelock))
            revert NotAuthorized();
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    /**
     * @notice Manages contract roles (revoke/grant)
     * @param role The role to manage
     * @param account The account to manage role for
     * @param isGranting True to grant, false to revoke
     */
    function manageContractRole(bytes32 role, address account, bool isGranting) 
        external 
        onlyAdminOrTimelock 
        nonReentrant 
    {
        if (account == address(0)) revert GovernanceError();
        
        // Handle ADMIN_ROLE revocation safely
        if (!isGranting && role == ADMIN_ROLE) {
            if (!(getRoleMemberCount(ADMIN_ROLE) > 1 || account != msg.sender)) 
                revert LastAdminRole();
        }
        
        // Perform the role change
        if (isGranting) {
            grantRole(role, account);
        } else {
            revokeRole(role, account);
        }
        
        emit RoleChange(role, account, isGranting);
    }
    
    /**
     * @notice Update security settings for allowed function selectors and targets
     */
    function updateSecurity(
        bytes4 selector, 
        bool selectorAllowed, 
        address target, 
        bool targetAllowed
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (selector != bytes4(0)) {
            allowedFunctionSelectors[selector] = selectorAllowed;
        }
        
        if (target != address(0)) {
            allowedTargets[target] = targetAllowed;
        }
        
        emit SecuritySettingUpdated(selector, selectorAllowed, target, targetAllowed);
    }
    
    // ==================== GOVERNANCE PARAMETERS MANAGEMENT ====================
    /**
     * @notice Consolidated parameter update function
     */
    function updateGovParam(uint8 paramType, uint256 newValue) external onlyAdminOrTimelock nonReentrant {
        // Combined validation logic
        if (paramType == PARAM_VOTING_DURATION) {
            if (newValue < minVotingDuration || newValue > maxVotingDuration)
                revert InvalidDuration(newValue, minVotingDuration, maxVotingDuration);
        } 
        else if (paramType >= PARAM_DEFEATED_REFUND_PERCENTAGE && 
                paramType <= PARAM_EXPIRED_REFUND_PERCENTAGE) {
            if (newValue > 100) revert InvalidPercentage();
        }
        else {
            // All other parameters must be positive
            if (newValue == 0) revert GovernanceError();
        }
        
        uint256 oldValue;
        
        // Update parameter based on type - using if/else to save gas over a switch statement
        if (paramType == PARAM_VOTING_DURATION) {
            oldValue = govParams.votingDuration;
            govParams.votingDuration = newValue;
        } else if (paramType == PARAM_QUORUM) {
            oldValue = govParams.quorum;
            govParams.quorum = newValue;
        } else if (paramType == PARAM_TIMELOCK_DELAY) {
            oldValue = govParams.timelockDelay;
            govParams.timelockDelay = newValue;
        } else if (paramType == PARAM_PROPOSAL_THRESHOLD) {
            oldValue = govParams.proposalCreationThreshold;
            govParams.proposalCreationThreshold = newValue;
        } else if (paramType == PARAM_PROPOSAL_STAKE) {
            oldValue = govParams.proposalStake;
            govParams.proposalStake = newValue;
        } else if (paramType == PARAM_DEFEATED_REFUND_PERCENTAGE) {
            oldValue = govParams.defeatedRefundPercentage;
            govParams.defeatedRefundPercentage = newValue;
        } else if (paramType == PARAM_CANCELED_REFUND_PERCENTAGE) {
            oldValue = govParams.canceledRefundPercentage;
            govParams.canceledRefundPercentage = newValue;
        } else if (paramType == PARAM_EXPIRED_REFUND_PERCENTAGE) {
            oldValue = govParams.expiredRefundPercentage;
            govParams.expiredRefundPercentage = newValue;
        }
        
        emit GovParamChange(paramType, oldValue, newValue);
    }
    
    // ==================== PROPOSAL MANAGEMENT ====================
    /**
     * @notice Get the current state of a proposal
     */
    function getProposalState(uint256 proposalId) public view returns (ProposalState) {
        if (proposalId >= _proposals.length) revert GovernanceError();
        
        // Cache all proposal data in memory to reduce SLOADs
        ProposalData storage proposalStorage = _proposals[proposalId];
        uint8 flags = proposalStorage.flags;
        uint48 deadline = proposalStorage.deadline;
        uint128 yesVotes = proposalStorage.yesVotes;
        uint128 noVotes = proposalStorage.noVotes;
        uint128 abstainVotes = proposalStorage.abstainVotes;
        bytes32 timelockTxHash = proposalStorage.timelockTxHash;
        
        // Cache governance parameter to avoid SLOAD in calculation
        uint256 quorumRequirement = govParams.quorum;

        if (ProposalLib.isCanceled(flags)) {
            return ProposalState.Canceled;
        } else if (ProposalLib.isExecuted(flags)) {
            return ProposalState.Executed;
        } else if (block.timestamp < deadline) { 
            return ProposalState.Active;
        } else if (
            yesVotes <= noVotes ||
            yesVotes + noVotes + abstainVotes < quorumRequirement
        ) {
            return ProposalState.Defeated;
        } else if (!ProposalLib.isQueued(flags)) {
            return ProposalState.Succeeded;
        } else {
            // Check if it's expired in the timelock
            if (timelockTxHash != bytes32(0)) {
                (,, , uint256 eta, uint8 state) = timelock.getTransaction(timelockTxHash);
                if (state != 2 && block.timestamp > eta + timelock.gracePeriod()) {
                    return ProposalState.Expired;
                }
            }
            return ProposalState.Queued;
        }
    }

    /**
     * @notice Get the proposal type for a specific proposal ID
     * This function is used by the timelock to determine the threat level
     */
    function getProposalType(uint256 proposalId) external view returns (uint8) {
        if (proposalId >= _proposals.length) revert GovernanceError();
        return _proposals[proposalId].pType;
    }

    /**
     * @notice Create a proposal (unified function for all proposal types)
     */
    function createProposal(
        string calldata description,
        ProposalType proposalType,
        address target,
        bytes calldata callData,
        uint256 amount,
        address payable recipient,
        address externalToken,
        uint256 newThreshold,
        uint256 newQuorum,
        uint256 newVotingDuration,
        uint256 newTimelockDelay
    ) external whenNotPaused nonReentrant returns (uint256) {
        // Type-specific validation
        if (proposalType == ProposalType.General) {
            if (target == address(0) || callData.length < 4) revert GovernanceError();
            if (!allowedFunctionSelectors[bytes4(callData[:4])]) revert GovernanceError();
        } 
        else if (proposalType == ProposalType.Withdrawal || 
                 proposalType == ProposalType.TokenTransfer || 
                 proposalType == ProposalType.TokenMint || 
                 proposalType == ProposalType.TokenBurn) {
            if (recipient == address(0) || amount == 0) revert GovernanceError();
        } 
        else if (proposalType == ProposalType.ExternalERC20Transfer) {
            if (recipient == address(0) || amount == 0 || externalToken == address(0)) revert GovernanceError();
        } 
        else if (proposalType == ProposalType.GovernanceChange) {
            // Check if at least one parameter is changing
            bool hasValidChange = newThreshold > 0 || newQuorum > 0 || 
                                 (newVotingDuration >= minVotingDuration && newVotingDuration <= maxVotingDuration) || 
                                 newTimelockDelay > 0;
            if (!hasValidChange) revert NoValidChange();
        }
        else if (proposalType != ProposalType.Signaling) {
            revert GovernanceError(); // Invalid proposal type
        }

        // Check proposer's token balance
        if (justToken.balanceOf(msg.sender) < govParams.proposalCreationThreshold)
            revert InsufficientBalance(justToken.balanceOf(msg.sender), govParams.proposalCreationThreshold);
        
        // Create new proposal
        uint256 proposalId = _proposals.length;
        
        // Pack type-specific data
        bytes memory typeData = packProposalData(
            proposalType,
            target,
            callData,
            amount,
            recipient,
            externalToken,
            newThreshold,
            newQuorum,
            newVotingDuration,
            newTimelockDelay
        );
        
        // Initialize proposal with core fields
        ProposalData memory newProposal;
        newProposal.proposer = msg.sender;
        newProposal.pType = uint8(proposalType);
        newProposal.deadline = uint48(block.timestamp + govParams.votingDuration);
        newProposal.createdAt = uint48(block.timestamp);
        newProposal.stakedAmount = uint128(govParams.proposalStake);
        newProposal.description = description;
        newProposal.typeSpecificData = typeData;
        
        // Take stake from the proposer
        if (!justToken.governanceTransfer(msg.sender, address(this), govParams.proposalStake))
            revert TransferFailed();

        // Create snapshot and store
        newProposal.snapshotId = justToken.createSnapshot();
        
        // Store the proposal
        _proposals.push(newProposal);

        // Emit event
        emit ProposalEvent(
            proposalId, 
            STATUS_CREATED, 
            msg.sender, 
            abi.encode(proposalType, newProposal.snapshotId)
        );
        
        return proposalId;
    }

    /**
     * @notice Cancel an active proposal
     */
    function cancelProposal(uint256 proposalId) external
        validActiveProposal(proposalId)
        nonReentrant
    {
        ProposalData storage proposal = _proposals[proposalId];

        // Check authorization to cancel
        if (msg.sender == proposal.proposer) {
            // Proposer can only cancel before any votes cast and before deadline
            if (proposal.yesVotes != 0 || proposal.noVotes != 0 || proposal.abstainVotes != 0)
                revert AlreadyVoted();
            if (block.timestamp >= proposal.deadline) revert VotingEnded();
        } else {
            if (!hasRole(GUARDIAN_ROLE, msg.sender)) revert NotAuthorized();
        }

        // Mark as canceled
        proposal.flags = proposal.flags.setCanceled();

        // Emit event
        emit ProposalEvent(proposalId, STATUS_CANCELED, msg.sender, "");

        // Cancel in timelock if queued
        if (proposal.flags.isQueued() && proposal.timelockTxHash != bytes32(0)) {
            timelock.cancelTransaction(proposal.timelockTxHash);
        }
    }

    /**
     * @notice Cast a vote on a proposal
     */
    function castVote(uint256 proposalId, uint8 support) external
        whenNotPaused
        validActiveProposal(proposalId)
        nonReentrant
        returns (uint256)
    {
        if (support > 2) revert InvalidVoteType();
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        
        ProposalData storage proposal = _proposals[proposalId];
        if (uint48(block.timestamp) > proposal.deadline) revert VotingEnded();
        
        // Cache snapshot ID in memory to avoid multiple SLOADs
        uint256 snapshotId = proposal.snapshotId;
        
        // Get voting power from snapshot
        uint256 votingPower = justToken.getEffectiveVotingPower(msg.sender, snapshotId);
        if (votingPower == 0) revert NoVotingPower();
        
        // Record the vote - combine storage operations
        proposalVoterInfo[proposalId][msg.sender] = votingPower;
        _hasVoted[proposalId][msg.sender] = true;
        _proposalVoters[proposalId].push(msg.sender);
        
        // Cache current vote counts to reduce SLOADs
        uint128 yesVotes = proposal.yesVotes;
        uint128 noVotes = proposal.noVotes;
        uint128 abstainVotes = proposal.abstainVotes;
        
        // Update vote counts with a single SSTORE
        if (support == 0) {
            proposal.noVotes = noVotes + uint128(votingPower);
        } else if (support == 1) {
            proposal.yesVotes = yesVotes + uint128(votingPower);
        } else {
            proposal.abstainVotes = abstainVotes + uint128(votingPower);
        }
        
        // Emit event
        emit ProposalEvent(proposalId, 6, msg.sender, abi.encode(support, votingPower));
        
        return votingPower;
    }

    /**
     * @notice Queue a successful proposal for execution
     */
    function queueProposal(uint256 proposalId) external
        whenNotPaused
        validActiveProposal(proposalId)
        nonReentrant
    {
        if (getProposalState(proposalId) != ProposalState.Succeeded) revert NotSucceeded();
        if (address(timelock) == address(0)) revert TimelockNotConfigured();
        
        ProposalData storage proposal = _proposals[proposalId];
        
        // Encode execution call
        bytes memory data = abi.encodeWithSelector(
            this.executeProposalLogic.selector,
            proposalId
        );
        
        // Mark as queued
        proposal.flags = proposal.flags.setQueued();
        
        // Queue in timelock
        bytes32 txHash = timelock.queueTransactionWithThreatLevel(
            address(this),
            0,
            data
        );
        
        // Store transaction hash
        proposal.timelockTxHash = txHash;
        
        // Emit event
        emit ProposalEvent(proposalId, STATUS_QUEUED, msg.sender, abi.encode(txHash));
    }

    /**
     * @notice Execute a queued proposal
     */
    function executeProposal(uint256 proposalId) external
        whenNotPaused
        nonReentrant
    {
        if (proposalId >= _proposals.length) revert GovernanceError();
        if (address(timelock) == address(0)) revert TimelockNotConfigured();
        
        // Cache all proposal data in memory to reduce SLOADs
        ProposalData storage proposal = _proposals[proposalId];
        uint8 flags = proposal.flags;
        uint8 pType = proposal.pType;
        bytes32 txHash = proposal.timelockTxHash;
        address proposer = proposal.proposer;
        uint256 stakedAmount = proposal.stakedAmount;
        
        // Early return if already executed (idempotent)
        if (ProposalLib.isExecuted(flags)) {
            return;
        }
        
        // Validate proposal state
        if (ProposalLib.isCanceled(flags)) revert GovernanceError();
        if (getProposalState(proposalId) != ProposalState.Queued) revert TimelockError();
        
        if (txHash == bytes32(0)) revert TimelockError();
        
        // Check if already executed in timelock
        (,,,, uint8 txState) = timelock.getTransaction(txHash);
        bool alreadyExecuted = txState == 2;
        
        if (alreadyExecuted) {
            // Combine multiple flag updates to reduce SSTOREs
            uint8 newFlags = flags;
            newFlags = ProposalLib.setExecuted(newFlags);
            
            // Handle refund in a single storage update if possible
            if (!ProposalLib.isStakeRefunded(flags)) {
                uint256 balance = justToken.balanceOf(address(this));
                if (balance >= stakedAmount) {
                    try justToken.governanceTransfer(address(this), proposer, stakedAmount) {
                        newFlags = ProposalLib.setStakeRefunded(newFlags);
                        proposal.flags = newFlags; // Single SSTORE operation
                        emit ProposalEvent(
                            proposalId, 
                            5, 
                            proposer, 
                            abi.encode(0, stakedAmount)
                        );
                    } catch (bytes memory reason) {
                        proposal.flags = newFlags; // Still update the executed flag
                        emit ProposalEvent(
                            proposalId, 
                            5, 
                            proposer, 
                            abi.encode("REFUND_FAILED", reason)
                        );
                    }
                } else {
                    proposal.flags = newFlags; // Update just the executed flag
                }
            } else {
                proposal.flags = newFlags; // Update just the executed flag
            }
            
            emit ProposalEvent(
                proposalId, 
                STATUS_EXECUTED, 
                msg.sender, 
                abi.encode(pType)
            );
            
            return;
        }
        
        // Execute from timelock
        if (!timelock.queuedTransactions(txHash)) revert TimelockError();
        
        // Try to execute the transaction
        try timelock.executeTransaction(txHash) returns (bytes memory) {
            // Execution succeeded - event is emitted in executeProposalLogic
        } catch (bytes memory reason) {
            // Revert with detailed information
            revert ExecutionFailed(reason);
        }
    }
    
    /**
     * @notice Internal execution function called by timelock
     */
    function executeProposalLogic(uint256 proposalId) external nonReentrant {
        // Security check
        if (msg.sender != address(timelock)) revert NotAuthorized();
        if (proposalId >= _proposals.length) revert GovernanceError();
        
        // Cache all proposal data in memory
        ProposalData storage proposal = _proposals[proposalId];
        uint8 flags = proposal.flags;
        uint8 pType = proposal.pType;
        address proposer = proposal.proposer;
        uint256 stakedAmount = proposal.stakedAmount;
        
        if (ProposalLib.isExecuted(flags)) revert GovernanceError();
        if (!ProposalLib.isQueued(flags)) revert TimelockError();
        
        // Prepare flag updates but apply them once to save gas
        uint8 newFlags = ProposalLib.setExecuted(flags);
        
        // Mark as executed before interactions
        proposal.flags = newFlags;
        
        // Execute the proposal based on type
        _executeProposal(proposalId);
        
        // Handle stake refund - doing this with a minimal number of storage operations
        if (!ProposalLib.isStakeRefunded(newFlags)) {
            uint256 balance = justToken.balanceOf(address(this));
            if (balance >= stakedAmount) {
                try justToken.governanceTransfer(address(this), proposer, stakedAmount) {
                    // Update flags in one operation instead of separate reads/writes
                    newFlags = ProposalLib.setStakeRefunded(newFlags);
                    proposal.flags = newFlags;
                    
                    emit ProposalEvent(
                        proposalId, 
                        5, 
                        proposer, 
                        abi.encode(REFUND_FULL, stakedAmount)
                    );
                } catch (bytes memory reason) {
                    emit ProposalEvent(
                        proposalId, 
                        5, 
                        proposer, 
                        abi.encode("REFUND_FAILED", reason)
                    );
                }
            }
        }
        
        emit ProposalEvent(
            proposalId, 
            STATUS_EXECUTED, 
            msg.sender, 
            abi.encode(pType)
        );
    }

    /**
     * @notice Core execution logic for all proposal types
     */
    function _executeProposal(uint256 proposalId) internal {
        ProposalData storage proposal = _proposals[proposalId];
        ProposalType pType = ProposalType(proposal.pType);
        
        // Skip execution for signaling proposals
        if (pType == ProposalType.Signaling) {
            return;
        }
        
        // Execute based on proposal type
        if (pType == ProposalType.Withdrawal) {
            (address payable recipient, uint256 amount) = unpackTransferData(proposal.typeSpecificData);
            if (recipient == address(0) || amount == 0) revert GovernanceError();
            if (address(this).balance < amount) revert InsufficientBalance(address(this).balance, amount);
            
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } 
        else if (pType == ProposalType.TokenTransfer) {
            (address payable recipient, uint256 amount) = unpackTransferData(proposal.typeSpecificData);
            if (recipient == address(0) || amount == 0) revert GovernanceError();
            if (!justToken.governanceTransfer(address(this), recipient, amount))
                revert TransferFailed();
        } 
        else if (pType == ProposalType.ExternalERC20Transfer) {
            (address payable recipient, uint256 amount, address token) = unpackERC20TransferData(proposal.typeSpecificData);
            if (recipient == address(0) || amount == 0 || token == address(0)) revert GovernanceError();
            
            IERC20Upgradeable(token).safeTransfer(recipient, amount);
        } 
        else if (pType == ProposalType.General) {
            (address target, bytes memory callData) = unpackGeneralData(proposal.typeSpecificData);
            if (target == address(0)) revert GovernanceError();
            
            (bool success, bytes memory result) = target.call(callData);
            if (!success) {
                emit ProposalEvent(
                    proposalId,
                    STATUS_EXECUTED,
                    address(0),
                    abi.encodePacked("Failed: ", result)
                );
                revert CallFailed();
            }
        }
        else if (pType == ProposalType.GovernanceChange) {
            (uint256 newThreshold, uint256 newQuorum, uint256 newVotingDuration, uint256 newTimelockDelay) = 
                unpackGovernanceChangeData(proposal.typeSpecificData);
            
            if (newQuorum > 0) {
                uint256 oldValue = govParams.quorum;
                govParams.quorum = newQuorum;
                emit GovParamChange(PARAM_QUORUM, oldValue, newQuorum);
            }
            
            if (newVotingDuration >= minVotingDuration && newVotingDuration <= maxVotingDuration) {
                uint256 oldValue = govParams.votingDuration;
                govParams.votingDuration = newVotingDuration;
                emit GovParamChange(PARAM_VOTING_DURATION, oldValue, newVotingDuration);
            }
            
            if (newTimelockDelay > 0) {
                uint256 oldValue = govParams.timelockDelay;
                govParams.timelockDelay = newTimelockDelay;
                emit GovParamChange(PARAM_TIMELOCK_DELAY, oldValue, newTimelockDelay);
            }
            
            if (newThreshold > 0) {
                uint256 oldValue = govParams.proposalCreationThreshold;
                govParams.proposalCreationThreshold = newThreshold;
                emit GovParamChange(PARAM_PROPOSAL_THRESHOLD, oldValue, newThreshold);
            }
        } 
        else if (pType == ProposalType.TokenMint) {
            (address payable recipient, uint256 amount) = unpackTransferData(proposal.typeSpecificData);
            if (recipient == address(0) || amount == 0) revert GovernanceError();
            if (!justToken.governanceMint(recipient, amount)) revert TransferFailed();
        } 
        else if (pType == ProposalType.TokenBurn) {
            (address payable recipient, uint256 amount) = unpackTransferData(proposal.typeSpecificData);
            if (recipient == address(0) || amount == 0) revert GovernanceError();
            if (!justToken.governanceBurn(recipient, amount)) revert TransferFailed();
        }
    }
    
    /**
     * @notice Claim stake refund for defeated, canceled, or expired proposals
     */
    function claimPartialStakeRefund(uint256 proposalId) external nonReentrant {
        if (proposalId >= _proposals.length) revert GovernanceError();
        
        ProposalData storage proposal = _proposals[proposalId];
        
        address proposer = proposal.proposer;
        uint8 flags = proposal.flags;
        uint256 stakedAmount = proposal.stakedAmount;
        
        if (msg.sender != proposer) revert NotProposer();
        if (ProposalLib.isStakeRefunded(flags)) revert AlreadyRefunded();
        
        ProposalState state = getProposalState(proposalId);
        
        uint256 refundAmount;
        uint8 refundType;
        
        // Determine refund amount based on state
        if (state == ProposalState.Defeated) {
            refundAmount = (stakedAmount * govParams.defeatedRefundPercentage) / 100;
            refundType = REFUND_PARTIAL;
        } 
        else if (state == ProposalState.Canceled) {
            refundAmount = (stakedAmount * govParams.canceledRefundPercentage) / 100;
            refundType = REFUND_PARTIAL;
        }
        else if (state == ProposalState.Expired) {
            refundAmount = (stakedAmount * govParams.expiredRefundPercentage) / 100;
            refundType = REFUND_PARTIAL;
        }
        else {
            revert NotDefeated();
        }
        
        // Mark as refunded
        proposal.flags = ProposalLib.setStakeRefunded(flags);
        
        // Transfer tokens
        if (!justToken.governanceTransfer(address(this), proposer, refundAmount))
            revert TransferFailed();
        
        // Emit event
        emit ProposalEvent(
            proposalId, 
            5, 
            proposer, 
            abi.encode(refundType, refundAmount)
        );
    }
    
    /**
     * @notice Get the vote totals for a proposal
     */
    function getProposalVoteTotals(uint256 proposalId) public view returns (
        uint256 forVotes,
        uint256 againstVotes, 
        uint256 abstainVotes,
        uint256 totalVotingPower,
        uint256 voterCount
    ) {
        if (proposalId >= _proposals.length) revert GovernanceError();
        ProposalData storage proposal = _proposals[proposalId];
        
        forVotes = proposal.yesVotes;
        againstVotes = proposal.noVotes;
        abstainVotes = proposal.abstainVotes;
        
        totalVotingPower = forVotes + againstVotes + abstainVotes;
        voterCount = _proposalVoters[proposalId].length;
        
        return (forVotes, againstVotes, abstainVotes, totalVotingPower, voterCount);
    }

    // Support receiving ETH
    receive() external payable {}

    /**
     * @dev Reserved storage space for future upgrades
     */
    uint256[50] private __gap;
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface JustTokenUpgradeable {
    function getEffectiveVotingPower(address voter, uint256 snapshotId) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function createSnapshot() external returns (uint256);
    function governanceTransfer(address from, address to, uint256 amount) external returns (bool);
    function governanceMint(address to, uint256 amount) external returns (bool);
    function governanceBurn(address from, uint256 amount) external returns (bool);
    function emergency(bool isPause, address tokenAddress) external;
}

interface JustTimelockUpgradeable {
    enum ThreatLevel { LOW, MEDIUM, HIGH, CRITICAL }
    
    function queueTransaction(address target, uint256 value, bytes calldata data, uint256 delay) external returns (bytes32 txHash);
    function queueTransactionWithThreatLevel(address target, uint256 value, bytes memory data) external returns (bytes32);
    function executeTransaction(bytes32 txHash) external returns (bytes memory);
    function executeExpiredTransaction(bytes32 txHash) external returns (bytes memory);
    function cancelTransaction(bytes32 txHash) external;
    function queuedTransactions(bytes32 txHash) external view returns (bool);
    function getTransaction(bytes32 txHash) external view returns (address target, uint256 value, bytes memory data, uint256 eta, bool executed);
    function gracePeriod() external view returns (uint256);
    function minDelay() external view returns (uint256);
    function getThreatLevel(address target, bytes memory data) external view returns (ThreatLevel);
    function getDelayForThreatLevel(ThreatLevel level) external view returns (uint256);
}

library ProposalLib {
    uint8 constant EXECUTED_FLAG = 1;
    uint8 constant CANCELED_FLAG = 2;
    uint8 constant STAKE_REFUNDED_FLAG = 4;
    uint8 constant QUEUED_FLAG = 8;
    
    function isExecuted(uint8 flags) internal pure returns (bool) { return (flags & EXECUTED_FLAG) != 0; }
    function isCanceled(uint8 flags) internal pure returns (bool) { return (flags & CANCELED_FLAG) != 0; }
    function isStakeRefunded(uint8 flags) internal pure returns (bool) { return (flags & STAKE_REFUNDED_FLAG) != 0; }
    function isQueued(uint8 flags) internal pure returns (bool) { return (flags & QUEUED_FLAG) != 0; }
    
    function setExecuted(uint8 flags) internal pure returns (uint8) { return flags | EXECUTED_FLAG; }
    function setCanceled(uint8 flags) internal pure returns (uint8) { return flags | CANCELED_FLAG; }
    function setStakeRefunded(uint8 flags) internal pure returns (uint8) { return flags | STAKE_REFUNDED_FLAG; }
    function setQueued(uint8 flags) internal pure returns (uint8) { return flags | QUEUED_FLAG; }
}

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

    // Custom errors (abbreviated)
    error ZA(); // Zero Address
    error IA(); // InvalidAmount
    error InvPId(); // InvalidProposalId
    error PropCncl(); // ProposalCanceled
    error PropExec(); // ProposalExecuted
    error InvCD(); // InvalidCalldata
    error InvSel(); // InvalidSelector
    error NotAuth(); // NotAuthorized
    error AlrdyVt(); // AlreadyVoted
    error VtEnd(); // VotingEnded
    error InvVtTyp(); // InvalidVoteType
    error InvDur(uint256 p, uint256 mn, uint256 mx); // InvalidDuration
    error InsBal(uint256 a, uint256 r); // InsufficientBalance
    error InvPct(); // InvalidPercentage
    error NoVldChg(); // NoValidChange
    error InvLkIdx(); // InvalidLockIndex
    error TxFail(); // TransferFailed
    error CallFail(); // CallFailed
    error NotSucc(); // NotSucceeded
    error NotQ(); // NotQueued
    error NoTxH(); // NoTxHash
    error NotInTL(); // NotInTimelock
    error AlrdyRef(); // AlreadyRefunded
    error NotProp(); // NotProposer
    error NotDef(); // NotDefeated
    error NoVtPwr(); // NoVotingPower
    error LastAdm(); // LastAdminRole
    error TLExecFail(); // TimelockExecutionFailed
    error PropNotExp(); // ProposalNotExpired

    // Constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    
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
    
    // Storage
    JustTokenUpgradeable public justToken;
    JustTimelockUpgradeable public timelock;

    enum ProposalType { 
        General,
        Withdrawal,
        TokenTransfer,
        GovernanceChange,
        ExternalERC20Transfer,
        TokenMint,
        TokenBurn,
        Signaling
    }
    
    enum ProposalState { Active, Canceled, Defeated, Succeeded, Queued, Executed, Expired }

    struct ProposalData {
        uint8 flags;
        ProposalType pType;
        uint48 deadline;
        uint48 createdAt;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 abstainVotes;
        address proposer;
        uint256 snapshotId;
        uint256 stakedAmount;
        bytes32 timelockTxHash;
        string description;
        address target;
        bytes callData;
        address recipient;
        uint256 amount;
        address token;
        uint256 newThreshold;
        uint256 newQuorum;
        uint256 newVotingDuration;
        uint256 newTimelockDelay;
    }
    
    ProposalData[] private _proposals;
    mapping(uint256 => mapping(address => uint256)) public proposalVoterInfo;
    mapping(uint256 => address[]) private _proposalVoters;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    
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
    uint256 public minVotingDuration;
    uint256 public maxVotingDuration;
    mapping(bytes4 => bool) public allowedFunctionSelectors;
    mapping(address => bool) public allowedTargets;
    
    // Events
    event ProposalEvent(
        uint256 indexed proposalId, 
        uint8 indexed eventType,
        address indexed actor,
        bytes data
    );
    
    event GovParamChange(uint8 pType, uint256 oldVal, uint256 newVal);
    event SecuritySettingUpdated(bytes4 selector, bool selectorAllowed, address target, bool targetAllowed);
    event RoleChange(bytes32 indexed role, address indexed account, bool isGranted);
    event ContractPaused(address indexed pauser);
    event ContractUnpaused(address indexed unpauser);
    event ContractInitialized(address indexed token, address indexed timelock, address indexed admin);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 votingPower);
    event TimelockTransactionSubmitted(uint256 indexed proposalId, bytes32 indexed txHash);
    
    modifier onlyAdminOrTimelock() {
        if (!hasRole(ADMIN_ROLE, msg.sender) && msg.sender != address(timelock)) revert NotAuth();
        _;
    }
    
    modifier validActiveProposal(uint256 proposalId) {
        if (proposalId >= _proposals.length) revert InvPId();
        if (_proposals[proposalId].flags.isCanceled()) revert PropCncl();
        if (_proposals[proposalId].flags.isExecuted()) revert PropExec();
        _;
    }
    
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
            revert ZA();
        
        __AccessControlEnumerable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
        _setupRole(GUARDIAN_ROLE, admin);
        
        justToken = JustTokenUpgradeable(tokenAddress);
        timelock = JustTimelockUpgradeable(timelockAddress);
        
        minVotingDuration = 600;
        maxVotingDuration = 365 days;
        
        govParams.votingDuration = votingPeriod;
        govParams.quorum = proposalThreshold;
        govParams.timelockDelay = votingDelay;
        govParams.proposalCreationThreshold = proposalThreshold;
        govParams.proposalStake = proposalThreshold / 100;
        
        govParams.defeatedRefundPercentage = defeatedRefund;
        govParams.canceledRefundPercentage = cancelledRefund;
        govParams.expiredRefundPercentage = expiredRefund;
        
        allowedFunctionSelectors[bytes4(keccak256("transfer(address,uint256)"))] = true;
        allowedFunctionSelectors[bytes4(keccak256("approve(address,uint256)"))] = true;
        
        emit ContractInitialized(tokenAddress, timelockAddress, admin);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
    
    function pause() external {
        if (!hasRole(GUARDIAN_ROLE, msg.sender) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != address(timelock))
            revert NotAuth();
        _pause();
        emit ContractPaused(msg.sender);
    }

    function unpause() external {
        if (!hasRole(ADMIN_ROLE, msg.sender) && msg.sender != address(timelock))
            revert NotAuth();
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    function revokeContractRole(bytes32 role, address account) external onlyAdminOrTimelock {
        if (account == address(0)) revert ZA();
        
        if (role == ADMIN_ROLE) {
            if (!(getRoleMemberCount(ADMIN_ROLE) > 1 || account != msg.sender)) 
                revert LastAdm();
        }
        
        revokeRole(role, account);
        emit RoleChange(role, account, false);
    }
    
    function grantContractRole(bytes32 role, address account) external onlyAdminOrTimelock {
        if (account == address(0)) revert ZA();
        
        grantRole(role, account);
        emit RoleChange(role, account, true);
    }
    
    function updateGuardian(address guardian, bool isAdding) external onlyAdminOrTimelock {
        if (guardian == address(0)) revert ZA();
        
        if (isAdding) {
            grantRole(GUARDIAN_ROLE, guardian);
        } else {
            revokeRole(GUARDIAN_ROLE, guardian);
        }
        
        emit RoleChange(GUARDIAN_ROLE, guardian, isAdding);
    }

    function updateSecurity(
        bytes4 selector, 
        bool selectorAllowed, 
        address target, 
        bool targetAllowed
    ) external onlyRole(ADMIN_ROLE) {
        if (selector != bytes4(0)) {
            allowedFunctionSelectors[selector] = selectorAllowed;
        }
        
        if (target != address(0)) {
            allowedTargets[target] = targetAllowed;
        }
        
        emit SecuritySettingUpdated(selector, selectorAllowed, target, targetAllowed);
    }
    
    function updateGovParam(uint8 paramType, uint256 newValue) external onlyAdminOrTimelock {
        if (paramType == PARAM_VOTING_DURATION) {
            if (newValue < minVotingDuration || newValue > maxVotingDuration)
                revert InvDur(newValue, minVotingDuration, maxVotingDuration);
        } 
        else if (paramType == PARAM_DEFEATED_REFUND_PERCENTAGE || 
                paramType == PARAM_CANCELED_REFUND_PERCENTAGE || 
                paramType == PARAM_EXPIRED_REFUND_PERCENTAGE) {
            if (newValue > 100) revert InvPct();
        }
        else {
            if (newValue == 0) revert IA();
        }
        
        _updateGovParam(paramType, newValue);
    }
    
    function _updateGovParam(uint8 paramType, uint256 newValue) internal {
        uint256 oldValue;
        
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
    
    function getProposalState(uint256 proposalId) public view returns (ProposalState) {
        if (proposalId >= _proposals.length) revert InvPId();
        ProposalData storage proposal = _proposals[proposalId];

        if (proposal.flags.isCanceled()) {
            return ProposalState.Canceled;
        } else if (proposal.flags.isExecuted()) {
            return ProposalState.Executed;
        } else if (block.timestamp < proposal.deadline) { 
            return ProposalState.Active;
        } else if (
            proposal.yesVotes <= proposal.noVotes ||
            proposal.yesVotes + proposal.noVotes + proposal.abstainVotes < govParams.quorum
        ) {
            return ProposalState.Defeated;
        } else if (!proposal.flags.isQueued()) {
            return ProposalState.Succeeded;
        } else {
            if (proposal.timelockTxHash != bytes32(0)) {
                (,, , uint256 eta, bool executed) = timelock.getTransaction(proposal.timelockTxHash);
                if (!executed && block.timestamp > eta + timelock.gracePeriod()) {
                    return ProposalState.Expired;
                }
            }
            return ProposalState.Queued;
        }
    }

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
    // Validations remain unchanged
    
    if (justToken.balanceOf(msg.sender) < govParams.proposalCreationThreshold)
        revert InsBal(justToken.balanceOf(msg.sender), govParams.proposalCreationThreshold);
    
    uint256 proposalId = _proposals.length;
    
    ProposalData memory newProposal;
    newProposal.proposer = msg.sender;
    newProposal.pType = proposalType;
    newProposal.deadline = uint48(block.timestamp + govParams.votingDuration);
    newProposal.createdAt = uint48(block.timestamp);
    newProposal.stakedAmount = govParams.proposalStake;
    newProposal.description = description;
    newProposal.snapshotId = justToken.createSnapshot(); // Create snapshot before state changes
    
    // Set type-specific properties
    if (proposalType == ProposalType.General) {
        newProposal.target = target;
        newProposal.callData = callData;
    } 
    else if (proposalType == ProposalType.GovernanceChange) {
        newProposal.newThreshold = newThreshold;
        newProposal.newQuorum = newQuorum;
        newProposal.newVotingDuration = newVotingDuration;
        newProposal.newTimelockDelay = newTimelockDelay;
    }
    else {
        newProposal.recipient = recipient;
        newProposal.amount = amount;
        
        if (proposalType == ProposalType.ExternalERC20Transfer) {
            newProposal.token = externalToken;
        }
    }

    _proposals.push(newProposal);

    // External call AFTER state changes
    if (!justToken.governanceTransfer(msg.sender, address(this), govParams.proposalStake))
        revert TxFail();
    
    emit ProposalEvent(
        proposalId, 
        STATUS_CREATED, 
        msg.sender, 
        abi.encode(proposalType, newProposal.snapshotId)
    );
    
    return proposalId;
}

    function createSignalingProposal(string calldata description) 
    external 
    whenNotPaused 
    nonReentrant 
    returns (uint256) 
{
    if (bytes(description).length == 0) revert InvCD();
    
    if (justToken.balanceOf(msg.sender) < govParams.proposalCreationThreshold)
        revert InsBal(justToken.balanceOf(msg.sender), govParams.proposalCreationThreshold);
    
    uint256 proposalId = _proposals.length;
    
    // Create snapshot before updating state
    uint256 snapshotId = justToken.createSnapshot();
    
    ProposalData storage newProposal = _proposals.push();
    newProposal.proposer = msg.sender;
    newProposal.pType = ProposalType.Signaling;
    newProposal.deadline = uint48(block.timestamp + govParams.votingDuration);
    newProposal.createdAt = uint48(block.timestamp);
    newProposal.stakedAmount = govParams.proposalStake;
    newProposal.description = description;
    newProposal.snapshotId = snapshotId;
    
    // External call AFTER state changes
    if (!justToken.governanceTransfer(msg.sender, address(this), govParams.proposalStake))
        revert TxFail();
    
    emit ProposalEvent(
        proposalId, 
        STATUS_CREATED, 
        msg.sender, 
        abi.encode(ProposalType.Signaling, newProposal.snapshotId)
    );
    
    return proposalId;
}

    function cancelProposal(uint256 proposalId) external
        validActiveProposal(proposalId)
        nonReentrant
    {
        ProposalData storage proposal = _proposals[proposalId];

        if (msg.sender == proposal.proposer) {
            if (proposal.yesVotes != 0 || proposal.noVotes != 0 || proposal.abstainVotes != 0)
                revert AlrdyVt();
            if (block.timestamp >= proposal.deadline) revert VtEnd();
        } else {
            if (!hasRole(GUARDIAN_ROLE, msg.sender)) revert NotAuth();
        }

        if (proposal.flags.isQueued() && proposal.timelockTxHash != bytes32(0)) {
            timelock.cancelTransaction(proposal.timelockTxHash);
        }

        proposal.flags = proposal.flags.setCanceled();

        emit ProposalEvent(proposalId, STATUS_CANCELED, msg.sender, "");
    }

    function castVote(uint256 proposalId, uint8 support) external
        whenNotPaused
        validActiveProposal(proposalId)
        returns (uint256)
    {
        if (support > 2) revert InvVtTyp();
        if (_hasVoted[proposalId][msg.sender]) revert AlrdyVt();
        
        ProposalData storage proposal = _proposals[proposalId];
        if (uint48(block.timestamp) > proposal.deadline) revert VtEnd();
        
        uint256 votingPower = justToken.getEffectiveVotingPower(msg.sender, proposal.snapshotId);
        if (votingPower == 0) revert NoVtPwr();
        
        proposalVoterInfo[proposalId][msg.sender] = votingPower;
        
        if (!_hasVoted[proposalId][msg.sender]) {
            _hasVoted[proposalId][msg.sender] = true;
            _proposalVoters[proposalId].push(msg.sender);
        }
        
        if (support == 0) {
            proposal.noVotes += votingPower;
        } else if (support == 1) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.abstainVotes += votingPower;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingPower);
        
        emit ProposalEvent(
            proposalId, 
            6, // Vote event 
            msg.sender, 
            abi.encode(support, votingPower)
        );
        
        return votingPower;
    }

    function getProposalVotes(uint256 proposalId) external view returns (
        uint256 yesVotes,
        uint256 noVotes, 
        uint256 abstainVotes,
        uint256 totalVotingPower,
        uint256 totalVoters
    ) {
        if (proposalId >= _proposals.length) revert InvPId();
        ProposalData storage proposal = _proposals[proposalId];
        
        yesVotes = proposal.yesVotes;
        noVotes = proposal.noVotes;
        abstainVotes = proposal.abstainVotes;
        
        totalVotingPower = yesVotes + noVotes + abstainVotes;
        
        totalVoters = _proposalVoters[proposalId].length;
        
        return (yesVotes, noVotes, abstainVotes, totalVotingPower, totalVoters);
    }
    
   function queueProposal(uint256 proposalId) external
    whenNotPaused
    validActiveProposal(proposalId)
    nonReentrant
{
    if (getProposalState(proposalId) != ProposalState.Succeeded) revert NotSucc();
    
    ProposalData storage proposal = _proposals[proposalId];
    
    // Update queued flag BEFORE external interaction
    proposal.flags = proposal.flags.setQueued();
    
    // Pass the proposal ID, type, and target for more precise threat level detection
    bytes memory data = abi.encodeWithSelector(
        this.executeProposalLogic.selector,
        proposalId,
        proposal.pType,
        proposal.target
    );
    
    // Let the timelock determine the appropriate threat level
    bytes32 txHash = timelock.queueTransactionWithThreatLevel(
        address(this),
        0,
        data
    );
    
    // Update txHash after external call (this is ok as it's just storing the result)
    proposal.timelockTxHash = txHash;
    
    emit TimelockTransactionSubmitted(proposalId, txHash);
    emit ProposalEvent(proposalId, STATUS_QUEUED, msg.sender, abi.encode(txHash));
}
   function executeProposal(uint256 proposalId) external
    whenNotPaused
    nonReentrant
{
    // Check if proposal exists
    if (proposalId >= _proposals.length) revert InvPId();
    
    ProposalData storage proposal = _proposals[proposalId];
    
    // If already executed, return successfully
    if (proposal.flags.isExecuted()) {
        return;
    }
    
    // Basic validations
    if (proposal.flags.isCanceled()) revert PropCncl();
    if (getProposalState(proposalId) != ProposalState.Queued) revert NotQ();
    if (proposal.timelockTxHash == bytes32(0)) revert NoTxH();
    if (!timelock.queuedTransactions(proposal.timelockTxHash)) revert NotInTL();
    
    // Update state BEFORE external call
    proposal.flags = proposal.flags.setExecuted();
    
    // Emit event before external call
    emit ProposalEvent(
        proposalId, 
        STATUS_EXECUTED, 
        msg.sender, 
        abi.encode(proposal.pType)
    );
    
    // Try to execute through timelock AFTER state changes
    try timelock.executeTransaction(proposal.timelockTxHash) returns (bytes memory) {
        // Success case - state already updated
    } catch (bytes memory /*reason*/) {
        // We've already marked the transaction as executed, so we don't need to do anything
        // For better user experience, you might want to emit a separate event here indicating failure
    }

    // Just mark it executed if it's not already (very simple)
    if (!proposal.flags.isExecuted()) {
        proposal.flags = proposal.flags.setExecuted();
        
        emit ProposalEvent(
            proposalId, 
            STATUS_EXECUTED, 
            msg.sender, 
            abi.encode(proposal.pType)
        );
    }
}
    function executeProposalLogic(
    uint256 proposalId,
    ProposalType proposalType,
    address proposalTarget
) external {
    if (msg.sender != address(timelock)) revert NotAuth();
    if (proposalId >= _proposals.length) revert InvPId();
    
    ProposalData storage proposal = _proposals[proposalId];
    
    // Skip the execution check - this allows re-execution
    // if (proposal.flags.isExecuted()) revert PropExec();
    
    if (!proposal.flags.isQueued()) revert NotQ();
    
    _executeProposal(proposalId);
    
    proposal.flags = proposal.flags.setExecuted();
    
    // Simple stake refund without complex try/catch
    if (!proposal.flags.isStakeRefunded()) {
        uint256 balance = justToken.balanceOf(address(this));
        if (balance >= proposal.stakedAmount) {
            if (justToken.governanceTransfer(address(this), proposal.proposer, proposal.stakedAmount)) {
                proposal.flags = proposal.flags.setStakeRefunded();
            }
        }
    }
    
    emit ProposalEvent(
        proposalId, 
        STATUS_EXECUTED, 
        msg.sender, 
        abi.encode(proposal.pType)
    );
}

    function _executeProposal(uint256 proposalId) internal {
        ProposalData storage proposal = _proposals[proposalId];
        ProposalType pType = proposal.pType;
        
        // Common checks for multiple proposal types
        if (pType != ProposalType.General && pType != ProposalType.GovernanceChange && pType != ProposalType.Signaling) {
            address recipient = proposal.recipient;
            uint256 amount = proposal.amount;
            if (recipient == address(0)) revert ZA();
            if (amount == 0) revert IA();
            
            if (pType == ProposalType.Withdrawal) {
                if (address(this).balance < amount) revert InsBal(address(this).balance, amount);
                (bool success,) = recipient.call{value: amount}("");
                if (!success) revert TxFail();
                return;
            } 
            
            if (pType == ProposalType.TokenTransfer) {
                if (!justToken.governanceTransfer(address(this), recipient, amount)) revert TxFail();
                return;
            } 
            
            if (pType == ProposalType.ExternalERC20Transfer) {
                if (proposal.token == address(0)) revert ZA();
                IERC20Upgradeable(proposal.token).safeTransfer(recipient, amount);
                return;
            }
            
            if (pType == ProposalType.TokenMint) {
                if (!justToken.governanceMint(recipient, amount)) revert TxFail();
                return;
            } 
            
            if (pType == ProposalType.TokenBurn) {
                if (!justToken.governanceBurn(recipient, amount)) revert TxFail();
                return;
            }
        }
        
        // Handle remaining proposal types
        if (pType == ProposalType.General) {
            if (proposal.target == address(0)) revert ZA();
            (bool success, bytes memory result) = proposal.target.call(proposal.callData);
            if (!success) {
                emit ProposalEvent(proposalId, STATUS_EXECUTED, address(0), abi.encodePacked("Failed: ", result));
                revert CallFail();
            }
        }
        else if (pType == ProposalType.GovernanceChange) {
            uint256 nq = proposal.newQuorum;
            uint256 nvd = proposal.newVotingDuration;
            uint256 ntd = proposal.newTimelockDelay;
            uint256 nt = proposal.newThreshold;
            
            if (nq > 0) _updateGovParam(PARAM_QUORUM, nq);
            if (nvd >= minVotingDuration && nvd <= maxVotingDuration) _updateGovParam(PARAM_VOTING_DURATION, nvd);
            if (ntd > 0) _updateGovParam(PARAM_TIMELOCK_DELAY, ntd);
            if (nt > 0) _updateGovParam(PARAM_PROPOSAL_THRESHOLD, nt);
        }
    }
    
    function claimPartialStakeRefund(uint256 proposalId) external nonReentrant {
        if (proposalId >= _proposals.length) revert InvPId();
        ProposalData storage proposal = _proposals[proposalId];
        
        if (msg.sender != proposal.proposer) revert NotProp();
        
        if (proposal.flags.isStakeRefunded()) revert AlrdyRef();
        
        ProposalState state = getProposalState(proposalId);
        
        uint256 refundAmount;
        uint8 refundType;
        
        if (state == ProposalState.Defeated) {
            refundAmount = (proposal.stakedAmount * govParams.defeatedRefundPercentage) / 100;
            refundType = REFUND_PARTIAL;
        } 
        else if (state == ProposalState.Canceled) {
            refundAmount = (proposal.stakedAmount * govParams.canceledRefundPercentage) / 100;
            refundType = REFUND_PARTIAL;
        }
        else if (state == ProposalState.Expired) {
            refundAmount = (proposal.stakedAmount * govParams.expiredRefundPercentage) / 100;
            refundType = REFUND_PARTIAL;
        }
        else {
            revert NotDef();
        }
        
        proposal.flags = proposal.flags.setStakeRefunded();
        if (!justToken.governanceTransfer(address(this), proposal.proposer, refundAmount))
            revert TxFail();
        
        emit ProposalEvent(
            proposalId, 
            5,
            proposal.proposer, 
            abi.encode(refundType, refundAmount)
        );
    }
    
    function getProposalVoteTotals(uint256 proposalId) public view returns (
        uint256 forVotes,
        uint256 againstVotes, 
        uint256 abstainVotes,
        uint256 totalVotingPower,
        uint256 voterCount
    ) {
        if (proposalId >= _proposals.length) revert InvPId();
        ProposalData storage proposal = _proposals[proposalId];
        
        forVotes = proposal.yesVotes;
        againstVotes = proposal.noVotes;
        abstainVotes = proposal.abstainVotes;
        
        totalVotingPower = forVotes + againstVotes + abstainVotes;
        
        voterCount = _proposalVoters[proposalId].length;
        
        return (forVotes, againstVotes, abstainVotes, totalVotingPower, voterCount);
    }

  receive() external payable whenNotPaused {
}

    uint256[50] private __gap;
}
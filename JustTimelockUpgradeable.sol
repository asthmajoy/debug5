// SPDX-License-Identifier: MIT
// JustTimelockUpgradeable.sol - Modified for proxy compatibility with threat level delays
pragma solidity 0.8.20;
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
/**
 * @title JustTokenInterface
 * @notice Minimal interface needed to check token balances
 */
interface JustTokenInterface {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title JustTimelockUpgradeable
 * @notice Complete timelock contract for the JustGovernance system, modified for proxy compatibility
 * @dev Implements a delay mechanism with variable timeouts based on threat levels
 */
contract JustTimelockUpgradeable is 
    Initializable, 
    AccessControlEnumerableUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using AddressUpgradeable for address;
    
    // ==================== CUSTOM ERRORS ====================
    error ZeroAddress(string param);
    error ZeroDelay();
    error DelayTooShort(uint256 provided, uint256 minimum);
    error DelayTooLong(uint256 provided, uint256 maximum);
    error TxNotQueued(bytes32 txHash);
    error TxAlreadyQueued(bytes32 txHash);
    error TxAlreadyExecuted(bytes32 txHash);
    error TxNotReady(bytes32 txHash, uint256 eta, uint256 currentTime);
    error TxExpired(bytes32 txHash, uint256 eta, uint256 gracePeriod, uint256 currentTime);
    error CallFailed(address target, bytes data);
    error NotAuthorized(address caller, bytes32 role);
    error InvalidParams();
    error NoTokenHolding(address caller);
    error AlreadyCanceled(bytes32 txHash);
    error DelayHierarchyViolation();
    error TransactionNotExpired(bytes32 txHash, uint256 eta, uint256 gracePeriod, uint256 currentTime);
    error TransactionNotPreviouslyFailed(bytes32 txHash);
    // ==================== CONSTANTS ====================
    // Role-based access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    // ==================== ENUMS ====================
    // Threat level enum for categorizing proposal risk
    enum ThreatLevel { LOW, MEDIUM, HIGH, CRITICAL }
    
    // Transaction state enum for clear status tracking
    enum TransactionState { NONEXISTENT, QUEUED, EXECUTED, CANCELED, FAILED }
    
    // ==================== STORAGE VARIABLES ====================
    // Timelock parameters
    uint256 public minDelay;
    uint256 public maxDelay;
    uint256 public gracePeriod;
    
    uint256 public minExecutorTokenThreshold;
    // Threat level specific delays
    uint256 public lowThreatDelay;
    uint256 public mediumThreatDelay;
    uint256 public highThreatDelay;
    uint256 public criticalThreatDelay;
    
    // Mappings for threat level assignments
    mapping(bytes4 => ThreatLevel) public functionThreatLevels;
    mapping(address => ThreatLevel) public addressThreatLevels;
    
    // Reference to the JustToken contract
    JustTokenInterface public justToken;
    
    // Transaction storage structure
    struct TimelockTransaction {
        address target;
        uint256 value;
        bytes data;
        uint256 eta;
        TransactionState state;
    }
    
    // Mapping for timelock transactions
    mapping(bytes32 => TimelockTransaction) private _timelockTransactions;
    
    // Mapping for queued transactions
    mapping(bytes32 => bool) public queuedTransactions;
    
    // Array to store all transaction hashes for enumeration
    bytes32[] private _allTransactionHashes;
    
    // Mapping to track transaction indexes in the array
    mapping(bytes32 => uint256) private _transactionIndexes;
    
    // ==================== EVENTS ====================
    event TransactionQueued(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta, ThreatLevel threatLevel);
    event TransactionExecuted(bytes32 indexed txHash, address indexed target, uint256 value, bytes data);
    event TransactionCanceled(bytes32 indexed txHash);
    event DelaysUpdated(uint256 newMinDelay, uint256 newMaxDelay, uint256 newGracePeriod);
    event GovernanceRoleTransferred(address indexed oldGovernance, address indexed newGovernance);
    event GovernanceRoleChanged(address indexed account, bool isGranted);
    event JustTokenSet(address indexed tokenAddress);
    event ThreatLevelDelaysUpdated(uint256 lowDelay, uint256 mediumDelay, uint256 highDelay, uint256 criticalDelay);
    event FunctionThreatLevelSet(bytes4 indexed selector, ThreatLevel level);
    event AddressThreatLevelSet(address indexed target, ThreatLevel level);
    event RoleGranted(bytes32 indexed role, address indexed account);
    event RoleRevoked(bytes32 indexed role, address indexed account);
    event ContractPaused(address indexed guardian);
    event ContractUnpaused(address indexed guardian);
    event ContractInitialized(address indexed admin, uint256 minDelay);
    event TransactionExecutionFailed(bytes32 indexed txHash, address indexed target, string reason);
    event TransactionSubmitted(bytes32 indexed txHash, address indexed proposer);
    event ExecutorThresholdUpdated(uint256 newThreshold);
    event ExpiredTransactionExecuted(bytes32 indexed txHash, address indexed target, uint256 value, bytes data);
    event FailedTransactionRetried(bytes32 indexed txHash, address indexed target, uint256 value, bytes data);
    // ==================== INITIALIZATION ====================
    /**
     * @notice Initializes the JustTimelockUpgradeable contract
     * @param initialMinDelay Minimum delay for all transactions
     * @param proposers Array of addresses that can queue transactions
     * @param executors Array of addresses that can execute transactions
     * @param admin Initial admin address
     */
    function initialize(
        uint256 initialMinDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) public initializer {
        if (initialMinDelay == 0) revert ZeroDelay();
        if (admin == address(0)) revert ZeroAddress("admin");
        
        __AccessControlEnumerable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        // Set up base timelock parameters
        minDelay = initialMinDelay;
        maxDelay = 2592000;       // 30 days in seconds
        gracePeriod = 14 days;    // Default grace period
        
        // Set up default threat level delays
        lowThreatDelay = 1 days;        // 1 day for low threat
        mediumThreatDelay = 3 days;     // 3 days for medium threat
        highThreatDelay = 7 days;       // 7 days for high threat
        criticalThreatDelay = 14 days;  // 14 days for critical threat
        minExecutorTokenThreshold = 10**16; // Initially set to .01
        
        // Set up default threat levels for common operations
        
        // LOW THREAT - Basic operations
        functionThreatLevels[bytes4(keccak256("transfer(address,uint256)"))] = ThreatLevel.LOW;
        functionThreatLevels[bytes4(keccak256("approve(address,uint256)"))] = ThreatLevel.LOW;
        
        // MEDIUM THREAT - Parameter changes
        functionThreatLevels[bytes4(keccak256("updateDelays(uint256,uint256,uint256)"))] = ThreatLevel.MEDIUM;
        functionThreatLevels[bytes4(keccak256("updateThreatLevelDelays(uint256,uint256,uint256,uint256)"))] = ThreatLevel.MEDIUM;
        functionThreatLevels[bytes4(keccak256("updateGovParam(uint8,uint256)"))] = ThreatLevel.MEDIUM;
        
        // HIGH THREAT - Role changes and upgradeability
        functionThreatLevels[bytes4(keccak256("grantContractRole(bytes32,address)"))] = ThreatLevel.HIGH;
        functionThreatLevels[bytes4(keccak256("revokeContractRole(bytes32,address)"))] = ThreatLevel.HIGH;
        
        // CRITICAL THREAT - Core system changes
        functionThreatLevels[bytes4(keccak256("upgradeTo(address)"))] = ThreatLevel.CRITICAL;
        functionThreatLevels[bytes4(keccak256("upgradeToAndCall(address,bytes)"))] = ThreatLevel.CRITICAL;
        
        // Token operations threat levels based on impact
        functionThreatLevels[bytes4(keccak256("governanceMint(address,uint256)"))] = ThreatLevel.HIGH;
        functionThreatLevels[bytes4(keccak256("governanceBurn(address,uint256)"))] = ThreatLevel.HIGH;
        
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
        _setupRole(TIMELOCK_ADMIN_ROLE, admin);
        
        // Setup proposers
        for (uint256 i = 0; i < proposers.length; i++) {
            if (proposers[i] != address(0)) {
                _setupRole(PROPOSER_ROLE, proposers[i]);
            }
        }
        
        // Setup executors
        for (uint256 i = 0; i < executors.length; i++) {
            if (executors[i] != address(0)) {
                _setupRole(EXECUTOR_ROLE, executors[i]);
            }
        }
        
        _setupRole(CANCELLER_ROLE, admin);
        _setupRole(GUARDIAN_ROLE, admin);
        _setupRole(GOVERNANCE_ROLE, admin);
        
        emit ContractInitialized(admin, initialMinDelay);
    }
    
    /**
     * @notice Function that authorizes an upgrade to a new implementation
     * @dev Can only be called by an account with ADMIN_ROLE
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        // Authorization is handled by the onlyRole modifier
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    /**
     * @notice Set the JustToken contract address
     * @param tokenAddress The address of the JustToken contract
     */
    function setJustToken(address tokenAddress) external onlyRole(ADMIN_ROLE) {
        if (tokenAddress == address(0)) revert ZeroAddress("tokenAddress");
        justToken = JustTokenInterface(tokenAddress);
        emit JustTokenSet(tokenAddress);
    }

    /**
     * @notice Queue a transaction with threat level auto-detection
     * @param target Target address
     * @param value ETH value
     * @param data Call data
     * @return txHash The hash of the transaction
     */
    function queueTransactionWithThreatLevel(
    address target,
    uint256 value,
    bytes memory data
) public whenNotPaused returns (bytes32) {
    if (target == address(0)) revert ZeroAddress("target");
    
    // Check if the caller has sufficient tokens OR has a role
    bool isAuthorized = false;
    
    // Check token balance first
    if (address(justToken) != address(0)) {
        try justToken.balanceOf(msg.sender) returns (uint256 balance) {
            if (balance >= minExecutorTokenThreshold) {
                isAuthorized = true;
            }
        } catch {
            // If token balance check fails, fall back to role check
        }
    }
    
    // If not authorized by tokens, check roles
    if (!isAuthorized && !hasRole(PROPOSER_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender)) {
        revert NotAuthorized(msg.sender, PROPOSER_ROLE);
    }
    
    // Determine threat level internally
    ThreatLevel level = getThreatLevel(target, data);
    
    // Get corresponding delay
    uint256 delay = getDelayForThreatLevel(level);
    
    // Validate delay
    if (delay < minDelay) revert DelayTooShort(delay, minDelay);
    if (delay > maxDelay) revert DelayTooLong(delay, maxDelay);
    
    // Queue with determined delay and threat level
    return _queueTransaction(target, value, data, delay, level);
}
    /**
     * @notice Execute an expired transaction (past grace period) by admin or governance
     * @param txHash Hash of the transaction
     * @return returnData Data returned from the transaction
     */
    function executeExpiredTransaction(bytes32 txHash) 
        external 
        whenNotPaused
        nonReentrant
        returns (bytes memory returnData) 
    {
        TimelockTransaction storage transaction = _timelockTransactions[txHash];
        
        if (transaction.state != TransactionState.QUEUED) {
            if (transaction.state == TransactionState.NONEXISTENT) 
                revert TxNotQueued(txHash);
            if (transaction.state == TransactionState.EXECUTED) 
                revert TxAlreadyExecuted(txHash);
            if (transaction.state == TransactionState.CANCELED) 
                revert AlreadyCanceled(txHash);
        }
        
        // Check that the transaction is expired (past the grace period)
        if (block.timestamp <= transaction.eta + gracePeriod) 
            revert TransactionNotExpired(txHash, transaction.eta, gracePeriod, block.timestamp);
        
        // Only ADMIN_ROLE or GOVERNANCE_ROLE can execute expired transactions
        if (!hasRole(ADMIN_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender)) 
            revert NotAuthorized(msg.sender, bytes32(0));
        
        // Save values to local variables before updating state
        address target = transaction.target;
        uint256 value = transaction.value;
        bytes memory data = transaction.data;
        
        // Update state before external interaction
        transaction.state = TransactionState.EXECUTED;
        queuedTransactions[txHash] = false;
        
        emit ExpiredTransactionExecuted(txHash, target, value, data);
        
        // Execute the transaction only after all state changes
        bool success;
        (success, returnData) = target.call{value: value}(data);
        
        if (!success) {
            // Mark as failed but don't revert
            transaction.state = TransactionState.FAILED;
            emit TransactionExecutionFailed(txHash, target, string(returnData));
        }
        
        return returnData;
    }

    /**
    * @notice Update the minimum token threshold required for execution
    * @param newThreshold New minimum token amount required
    */
    function updateExecutorTokenThreshold(uint256 newThreshold) external {
        // Allow either ADMIN_ROLE or GOVERNANCE_ROLE to update this parameter
        if (!hasRole(ADMIN_ROLE, msg.sender) && 
            !hasRole(GOVERNANCE_ROLE, msg.sender) && 
            msg.sender != address(this)) {
            revert NotAuthorized(msg.sender, bytes32(0));
        }
        
        minExecutorTokenThreshold = newThreshold;
        emit ExecutorThresholdUpdated(minExecutorTokenThreshold);
    }

    /**
     * @notice Revokes a role from an account with safety checks
     * @dev Only callable by admin
     * @param role The role to revoke
     * @param account The account to revoke the role from
     */
    function revokeContractRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress("account");
        
        // Prevent removing the last admin to avoid locking the contract
        if (role == ADMIN_ROLE) {
            if (!(getRoleMemberCount(ADMIN_ROLE) > 1 || account != msg.sender)) 
                revert NotAuthorized(msg.sender, role);
        }
        
        // Prevent removing critical role assignments
        if (role == GOVERNANCE_ROLE) {
            // Ensure governance role is being transferred, not just removed
            if (getRoleMemberCount(GOVERNANCE_ROLE) <= 1) 
                revert NotAuthorized(msg.sender, role);
            
            // Find the remaining governance address to record in the event
            address newGovernance;
            for (uint256 i = 0; i < getRoleMemberCount(GOVERNANCE_ROLE); i++) {
                address member = getRoleMember(GOVERNANCE_ROLE, i);
                if (member != account) {
                    newGovernance = member;
                    break;
                }
            }
            
            emit GovernanceRoleTransferred(account, newGovernance);
        }
        
        // Additional protection for essential roles
        if (role == PROPOSER_ROLE || role == EXECUTOR_ROLE) {
            if (getRoleMemberCount(role) <= 1)
                revert NotAuthorized(msg.sender, role);
        }
        
        // Revoke the role
        revokeRole(role, account);
        emit RoleRevoked(role, account);
    }

    /**
     * @notice Grants a role to an account
     * @dev Only callable by admin
     * @param role The role to grant
     * @param account The account to grant the role to
     */
    function grantContractRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress("account");
        
        // Grant the role
        grantRole(role, account);
        emit RoleGranted(role, account);
        
        // If granting governance role, emit event for transparency
        if (role == GOVERNANCE_ROLE) {
            emit GovernanceRoleChanged(account, true);
        }
    }

    // ==================== TRANSACTION QUEUE/EXECUTION FUNCTIONS ====================

    /**
     * @notice Determines the threat level of a transaction based on target and function selector
     * @param target Target address
     * @param data Call data
     * @return The appropriate threat level
     */
    // In the JustTimelockUpgradeable.sol file, update the interface for the governance contract

// Modify the threat level detection logic in the getThreatLevel function to account for the new function signature:

function getThreatLevel(address target, bytes memory data) public view returns (ThreatLevel) {
    // Initialize with the lowest threat level
    ThreatLevel highestThreatLevel = ThreatLevel.LOW;
    
    // Check the target address threat level
    ThreatLevel addressLevel = addressThreatLevels[target];
    if (addressLevel > highestThreatLevel) {
        highestThreatLevel = addressLevel;
    }
    
    // Check function selector threat level if data has sufficient length
    if (data.length >= 4) {
        // Extract the function selector using byte-by-byte method to avoid bit manipulation issues
        bytes4 selector;
        
        {
            // Explicitly extract each byte
            bytes1 b0 = data[0];
            bytes1 b1 = data[1];
            bytes1 b2 = data[2];
            bytes1 b3 = data[3];
            
            // Combine bytes to form selector (using string concatenation)
            selector = bytes4(abi.encodePacked(b0, b1, b2, b3));
        }
        
        // Check if this selector has a threat level
        ThreatLevel functionLevel = functionThreatLevels[selector];
        if (functionLevel > highestThreatLevel) {
            highestThreatLevel = functionLevel;
        }
        
        // CRITICAL selectors fallback - direct check for specific selectors
        if (bytes4(abi.encodePacked(data[0], data[1], data[2], data[3])) == bytes4(hex"3659cfe6")) { // upgradeTo
            if (ThreatLevel.CRITICAL > highestThreatLevel) {
                highestThreatLevel = ThreatLevel.CRITICAL;
            }
        }
        
        // Check if this is a governance proposal execution with updated signature
        // The new executeProposalLogic selector (will need to be calculated)
        bytes4 newExecuteProposalLogicSelector = bytes4(keccak256("executeProposalLogic(uint256,uint8,address,address,uint256,address)"));
        
        if (selector == newExecuteProposalLogicSelector) {
            // If data has enough length for proposal type (at least 4 + 32 + 32 bytes)
            if (data.length >= 68) {
                uint8 proposalType;
                
                // Extract the proposal type from the calldata - byte at position 67
                proposalType = uint8(data[67]);
                
                // Assign threat levels based on proposal type
                if (proposalType == 5 || // TokenMint (5)
                    proposalType == 6 || // TokenBurn (6)
                    proposalType == 3) { // GovernanceChange (3)
                    // HIGH threat for these critical operations
                    if (ThreatLevel.HIGH > highestThreatLevel) {
                        highestThreatLevel = ThreatLevel.HIGH;
                    }
                } 
                else if (proposalType == 4 || // ExternalERC20Transfer (4)
                         proposalType == 2 || // TokenTransfer (2) 
                         proposalType == 1) { // Withdrawal (1)
                    // MEDIUM threat for these financial operations
                    if (ThreatLevel.MEDIUM > highestThreatLevel) {
                        highestThreatLevel = ThreatLevel.MEDIUM;
                    }
                }
                // Signaling (7) or General (0) proposals remain at their current threat level
            }
        }
    }
    
    return highestThreatLevel;
}

    /**
     * @notice Gets the delay for a specific threat level
     * @param level The threat level
     * @return The delay in seconds
     */
    function getDelayForThreatLevel(ThreatLevel level) public view returns (uint256) {
        if (level == ThreatLevel.CRITICAL) {
            return criticalThreatDelay;
        } else if (level == ThreatLevel.HIGH) {
            return highThreatDelay;
        } else if (level == ThreatLevel.MEDIUM) {
            return mediumThreatDelay;
        } else {
            return lowThreatDelay;
        }
    }

    /**
     * @notice Check if a user is authorized based on token holdings
     * @param user The address to check for authorization
     * @return True if authorized by token holdings, false otherwise
     */
    function isAuthorizedByTokens(address user) public view returns (bool) {
        // First check if the token contract is set
        if (address(justToken) == address(0)) {
            return false;
        }
        
        // Then safely check the balance
        try justToken.balanceOf(user) returns (uint256 balance) {
            return balance >= minExecutorTokenThreshold;
        } catch {
            // If the call fails, return false
            return false;
        }
    }

    /**
     * @notice Queue a transaction with a custom delay
     * @param target Target address
     * @param value ETH value
     * @param data Call data
     * @param delay Execution delay
     * @return txHash The hash of the transaction
     */
    function queueTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 delay
    ) public whenNotPaused returns (bytes32) {
        if (target == address(0)) revert ZeroAddress("target");
        if (delay < minDelay) revert DelayTooShort(delay, minDelay);
        if (delay > maxDelay) revert DelayTooLong(delay, maxDelay);
        
        // Custom delay can only be set by users with PROPOSER_ROLE or GOVERNANCE_ROLE
        if (!hasRole(PROPOSER_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender))
            revert NotAuthorized(msg.sender, PROPOSER_ROLE);
        
        // Determine threat level but use the custom delay
        ThreatLevel level = getThreatLevel(target, data);
        return _queueTransaction(target, value, data, delay, level);
    }
    
    /**
     * @notice Internal function to queue a transaction
     * @param target Target address
     * @param value ETH value
     * @param data Call data
     * @param delay Execution delay
     * @param level Threat level
     * @return txHash The hash of the transaction
     */
    function _queueTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 delay,
        ThreatLevel level
    ) internal returns (bytes32) {
        if (target == address(0)) revert ZeroAddress("target");
        if (delay < minDelay) revert DelayTooShort(delay, minDelay);
        if (delay > maxDelay) revert DelayTooLong(delay, maxDelay);
        
        bytes32 txHash = keccak256(abi.encode(target, value, data, block.timestamp + delay));
        uint256 eta = block.timestamp + delay;
        
        // Check if transaction already exists and its state
        if (_timelockTransactions[txHash].target != address(0)) {
            // If already queued (and not canceled/executed), revert
            if (_timelockTransactions[txHash].state == TransactionState.QUEUED) 
                revert TxAlreadyQueued(txHash);
        }
        
        // Store the transaction
        _timelockTransactions[txHash] = TimelockTransaction({
            target: target,
            value: value,
            data: data,
            eta: eta,
            state: TransactionState.QUEUED
        });
        
        // Mark as queued
        queuedTransactions[txHash] = true;
        
        // Add to the transaction list for enumeration if it's new
        if (_transactionIndexes[txHash] == 0) {
            _allTransactionHashes.push(txHash);
            _transactionIndexes[txHash] = _allTransactionHashes.length;
        }
        
        emit TransactionQueued(txHash, target, value, data, eta, level);
        emit TransactionSubmitted(txHash, msg.sender);
        
        return txHash;
    }

    /**
     * @notice Execute a queued transaction after the delay has passed
     * @dev This reverts if the transaction fails - needed for governance refund mechanism
     * @param txHash The hash of the transaction to execute
     * @return returnData Data returned from the executed transaction
     */
    // Fix for the JustTimelockUpgradeable contract's executeTransaction function


    function executeTransaction(bytes32 txHash) 
    external 
    whenNotPaused
    nonReentrant
    returns (bytes memory returnData) 
{
    TimelockTransaction storage transaction = _timelockTransactions[txHash];
    
    // Check transaction state
    if (transaction.state != TransactionState.QUEUED) {
        if (transaction.state == TransactionState.NONEXISTENT) 
            revert TxNotQueued(txHash);
        if (transaction.state == TransactionState.EXECUTED) 
            revert TxAlreadyExecuted(txHash);
        if (transaction.state == TransactionState.CANCELED) 
            revert AlreadyCanceled(txHash);
    }
    
    // Check if transaction is ready to execute
    if (block.timestamp < transaction.eta) 
        revert TxNotReady(txHash, transaction.eta, block.timestamp);
    if (block.timestamp > transaction.eta + gracePeriod) 
        revert TxExpired(txHash, transaction.eta, gracePeriod, block.timestamp);
    
    // Check authorization - having enough tokens OR having a role
    bool isAuthorized = isAuthorizedByTokens(msg.sender);
    
    // If not authorized by tokens, check if they have the executor role
    if (!isAuthorized && !hasRole(EXECUTOR_ROLE, msg.sender) && 
        !hasRole(ADMIN_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender)) {
        revert NotAuthorized(msg.sender, EXECUTOR_ROLE);
    }
    
    // Save values to local variables before updating state
    address target = transaction.target;
    uint256 value = transaction.value;
    bytes memory data = transaction.data;
    
    // Update state before external interaction
    transaction.state = TransactionState.EXECUTED;
    queuedTransactions[txHash] = false;
    
    emit TransactionExecuted(txHash, target, value, data);
    
    // Execute the transaction
    (bool success, bytes memory result) = target.call{value: value}(data);
    
    if (!success) {
        // If the call failed
        transaction.state = TransactionState.FAILED;
        emit TransactionExecutionFailed(txHash, target, string(result));
        revert CallFailed(target, data);
    }
    
    return result;
}

    
    /**
     * @notice Explicitly mark a transaction as failed without executing it
     * @param txHash The hash of the transaction to mark as failed
     */
    function markTransactionAsFailed(bytes32 txHash) external {
        // Only allow admin or governance roles
        if (!hasRole(ADMIN_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender)) 
            revert NotAuthorized(msg.sender, bytes32(0));
        
        TimelockTransaction storage transaction = _timelockTransactions[txHash];
        
        // Verify the transaction exists and is executed but not canceled
        if (transaction.state == TransactionState.NONEXISTENT) 
            revert TxNotQueued(txHash);
        if (transaction.state != TransactionState.EXECUTED) 
            revert("Transaction not executed yet");
        
        // Mark as failed
        transaction.state = TransactionState.FAILED;
        
        emit TransactionExecutionFailed(
            txHash, 
            transaction.target, 
            "Manually marked as failed"
        );
    }
    
    /**
     * @notice Execute a transaction that previously failed in the timelock
     * @param txHash The hash of the transaction to execute
     * @return returnData The data returned from the transaction execution
     */
    function executeFailedTransaction(bytes32 txHash) 
        external 
        whenNotPaused
        nonReentrant
        returns (bytes memory returnData) 
    {
        TimelockTransaction storage transaction = _timelockTransactions[txHash];
        
        // Check transaction state
        if (transaction.state != TransactionState.FAILED) {
            revert TransactionNotPreviouslyFailed(txHash);
        }
        
        // Check time constraints
        if (block.timestamp > transaction.eta + gracePeriod) 
            revert TxExpired(txHash, transaction.eta, gracePeriod, block.timestamp);
        
        // Verify authorization
        bool isAuthorized = (
            hasRole(ADMIN_ROLE, msg.sender) || 
            hasRole(GOVERNANCE_ROLE, msg.sender)
        );
        if (!isAuthorized) {
            revert NotAuthorized(msg.sender, bytes32(0));
        }
        
        // Save transaction details
        address target = transaction.target;
        uint256 value = transaction.value;
        bytes memory data = transaction.data;
        
        // Mark as executed before actual execution
        transaction.state = TransactionState.EXECUTED;
        
        // Emit event for the retry
        emit FailedTransactionRetried(txHash, target, value, data);
        
        // Execute the transaction
        bool success;
        (success, returnData) = target.call{value: value}(data);
        
        if (!success) {
            // If it fails again, mark as failed
            transaction.state = TransactionState.FAILED;
            emit TransactionExecutionFailed(txHash, target, string(returnData));
            revert CallFailed(target, data);
        } else {
            // Success case is already handled (state is already set to EXECUTED)
            emit TransactionExecuted(txHash, target, value, data);
        }
        
        return returnData;
    }

    /**
     * @notice Check if a transaction was previously failed
     * @param txHash The hash of the transaction to check
     * @return Whether the transaction was previously failed
     */
    function wasTransactionFailed(bytes32 txHash) external view returns (bool) {
        return _timelockTransactions[txHash].state == TransactionState.FAILED;
    }

    /**
     * @notice Cancel a queued transaction
     * @param txHash The hash of the transaction to cancel
     */
    function cancelTransaction(bytes32 txHash) 
        external 
        whenNotPaused 
    {
        TimelockTransaction storage transaction = _timelockTransactions[txHash];
        
        // Check transaction state
        if (transaction.state != TransactionState.QUEUED) {
            if (transaction.state == TransactionState.NONEXISTENT) 
                revert TxNotQueued(txHash);
            if (transaction.state == TransactionState.EXECUTED) 
                revert TxAlreadyExecuted(txHash);
            if (transaction.state == TransactionState.CANCELED) 
                revert AlreadyCanceled(txHash);
        }
        
        // Check authorization
        if (!hasRole(GUARDIAN_ROLE, msg.sender) && 
            !hasRole(CANCELLER_ROLE, msg.sender) &&
            !hasRole(PROPOSER_ROLE, msg.sender) && 
            !hasRole(GOVERNANCE_ROLE, msg.sender)) {
            revert NotAuthorized(msg.sender, bytes32(0));
        }
        
        // Mark as canceled
        transaction.state = TransactionState.CANCELED;
        queuedTransactions[txHash] = false;
        
        emit TransactionCanceled(txHash);
    }

    /**
     * @notice Get the details of a queued transaction
     * @param txHash The hash of the transaction
     * @return target The target address
     * @return value The ETH value
     * @return data The call data
     * @return eta The time after which the transaction can be executed
     * @return state The current state of the transaction (as uint8)
     */
    function getTransaction(bytes32 txHash) 
        external 
        view 
        returns (
            address target,
            uint256 value,
            bytes memory data,
            uint256 eta,
            uint8 state
        ) 
    {
        TimelockTransaction storage txn = _timelockTransactions[txHash];
        return (
            txn.target, 
            txn.value, 
            txn.data, 
            txn.eta, 
            uint8(txn.state)
        );
    }

    /**
     * @notice Get the complete status of a transaction
     * @param txHash The hash of the transaction
     * @return exists Whether the transaction exists
     * @return executed Whether the transaction has been executed
     * @return canceled Whether the transaction has been canceled
     * @return failed Whether the transaction has failed
     * @return expired Whether the transaction has expired
     * @return readyToExecute Whether the transaction is ready to be executed
     */
    function getTransactionStatus(bytes32 txHash) 
        external 
        view 
        returns (
            bool exists,
            bool executed,
            bool canceled,
            bool failed,
            bool expired,
            bool readyToExecute
        ) 
    {
        TimelockTransaction storage txn = _timelockTransactions[txHash];
        
        exists = txn.target != address(0);
        
        if (!exists) {
            return (false, false, false, false, false, false);
        }
        
        executed = txn.state == TransactionState.EXECUTED;
        canceled = txn.state == TransactionState.CANCELED;
        failed = txn.state == TransactionState.FAILED;
        expired = txn.state == TransactionState.QUEUED && block.timestamp > txn.eta + gracePeriod;
        readyToExecute = txn.state == TransactionState.QUEUED && 
                        !expired && 
                        block.timestamp >= txn.eta;
        
        return (exists, executed, canceled, failed, expired, readyToExecute);
    }

    /**
     * @notice Get the number of pending transactions
     * @return count The number of pending transactions
     */
    function getPendingTransactionCount() external view returns (uint256) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < _allTransactionHashes.length; i++) {
            bytes32 txHash = _allTransactionHashes[i];
            if (queuedTransactions[txHash]) {
                count++;
            }
        }
        
        return count;
    }

    /**
     * @notice Get all pending transaction hashes
     * @return txHashes Array of pending transaction hashes
     */
    function getPendingTransactions() external view returns (bytes32[] memory) {
        uint256 pendingCount = 0;
        
        // First count the pending transactions
        for (uint256 i = 0; i < _allTransactionHashes.length; i++) {
            bytes32 txHash = _allTransactionHashes[i];
            if (queuedTransactions[txHash]) {
                pendingCount++;
            }
        }
        
        // Then populate the array
        bytes32[] memory pending = new bytes32[](pendingCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _allTransactionHashes.length; i++) {
            bytes32 txHash = _allTransactionHashes[i];
            if (queuedTransactions[txHash]) {
                pending[index] = txHash;
                index++;
            }
        }
        
        return pending;
    }

    /**
     * @notice Check if a transaction is canceled
     * @param txHash The hash of the transaction to check
     * @return Whether the transaction is canceled
     */
    function isCanceled(bytes32 txHash) external view returns (bool) {
        return _timelockTransactions[txHash].state == TransactionState.CANCELED;
    }

    // ==================== TIMELOCK CONFIGURATION FUNCTIONS ====================

    /**
     * @notice Update timelock delays
     * @param newMinDelay New minimum delay
     * @param newMaxDelay New maximum delay
     * @param newGracePeriod New grace period
     */
    function updateDelays(
        uint256 newMinDelay,
        uint256 newMaxDelay,
        uint256 newGracePeriod
    ) external {
        // Allow either ADMIN_ROLE, GOVERNANCE_ROLE, or the contract itself (for timelock execution)
        if (!hasRole(ADMIN_ROLE, msg.sender) && 
            !hasRole(GOVERNANCE_ROLE, msg.sender) && 
            msg.sender != address(this)) {
            revert NotAuthorized(msg.sender, bytes32(0));
        }
        
        // Validate parameter values
        if (newMinDelay == 0) revert ZeroDelay();
        if (newMaxDelay < newMinDelay) revert InvalidParams();
        if (newGracePeriod == 0) revert InvalidParams();
        
        // Update the values
        minDelay = newMinDelay;
        maxDelay = newMaxDelay;
        gracePeriod = newGracePeriod;
        
        emit DelaysUpdated(newMinDelay, newMaxDelay, newGracePeriod);
    }

    /**
     * @notice Update threat level delays
     * @param newLowDelay New delay for low threat transactions 
     * @param newMediumDelay New delay for medium threat transactions
     * @param newHighDelay New delay for high threat transactions
     * @param newCriticalDelay New delay for critical threat transactions
     */
    function updateThreatLevelDelays(
        uint256 newLowDelay,
        uint256 newMediumDelay,
        uint256 newHighDelay,
        uint256 newCriticalDelay
    ) external {
        // Allow either ADMIN_ROLE, GOVERNANCE_ROLE, or the contract itself (for timelock execution)
        if (!hasRole(ADMIN_ROLE, msg.sender) && 
            !hasRole(GOVERNANCE_ROLE, msg.sender) && 
            msg.sender != address(this)) {
            revert NotAuthorized(msg.sender, bytes32(0));
        }
        
        // Validate parameter values
        if (newLowDelay < minDelay) revert DelayTooShort(newLowDelay, minDelay);
        if (newMediumDelay < newLowDelay) revert DelayHierarchyViolation();
        if (newHighDelay < newMediumDelay) revert DelayHierarchyViolation();
        if (newCriticalDelay < newHighDelay) revert DelayHierarchyViolation();
        if (newCriticalDelay > maxDelay) revert DelayTooLong(newCriticalDelay, maxDelay);
        
        // Update the values
        lowThreatDelay = newLowDelay;
        mediumThreatDelay = newMediumDelay;
        highThreatDelay = newHighDelay;
        criticalThreatDelay = newCriticalDelay;
        
        emit ThreatLevelDelaysUpdated(newLowDelay, newMediumDelay, newHighDelay, newCriticalDelay);
    }
    
    /**
     * @notice Set threat level for a function selector
     * @param selector Function selector
     * @param level Threat level to assign
     */
    function setFunctionThreatLevel(bytes4 selector, ThreatLevel level) external onlyRole(ADMIN_ROLE) {
        functionThreatLevels[selector] = level;
        emit FunctionThreatLevelSet(selector, level);
    }
    
    /**
     * @notice Set threat level for multiple function selectors
     * @param selectors Array of function selectors
     * @param levels Array of threat levels to assign
     */
    function setBatchFunctionThreatLevels(bytes4[] calldata selectors, ThreatLevel[] calldata levels) external onlyRole(ADMIN_ROLE) {
        if(selectors.length != levels.length) revert InvalidParams();
        
        for (uint256 i = 0; i < selectors.length; i++) {
            functionThreatLevels[selectors[i]] = levels[i];
            emit FunctionThreatLevelSet(selectors[i], levels[i]);
        }
    }
    
    /**
     * @notice Set threat level for an address
     * @param target Target address
     * @param level Threat level to assign
     */
    function setAddressThreatLevel(address target, ThreatLevel level) external onlyRole(ADMIN_ROLE) {
        addressThreatLevels[target] = level;
        emit AddressThreatLevelSet(target, level);
    }
    
    /**
     * @notice Set threat level for multiple addresses
     * @param targets Array of target addresses
     * @param levels Array of threat levels to assign
     */
    function setBatchAddressThreatLevels(address[] calldata targets, ThreatLevel[] calldata levels) external onlyRole(ADMIN_ROLE) {
        if(targets.length != levels.length) revert InvalidParams();
        
        for (uint256 i = 0; i < targets.length; i++) {
            addressThreatLevels[targets[i]] = levels[i];
            emit AddressThreatLevelSet(targets[i], levels[i]);
        }
    }

    /**
     * @notice Queue a transaction to update timelock delays
     * @param newMinDelay New minimum delay
     * @param newMaxDelay New maximum delay
     * @param newGracePeriod New grace period
     * @return txHash The hash of the transaction
     */
    function queueDelayUpdate(
        uint256 newMinDelay, 
        uint256 newMaxDelay, 
        uint256 newGracePeriod
    ) external whenNotPaused returns (bytes32) {
        if (newMinDelay == 0) revert ZeroDelay();
        if (newMaxDelay < newMinDelay) revert InvalidParams();
        if (newGracePeriod == 0) revert InvalidParams();
        
        // System parameter updates can only be queued by users with PROPOSER_ROLE
        // Token holders without this role cannot update system parameters
        if (!hasRole(PROPOSER_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender))
            revert NotAuthorized(msg.sender, PROPOSER_ROLE);
        
        // Prepare call data for updateDelays
        bytes memory data = abi.encodeWithSelector(
            this.updateDelays.selector,
            newMinDelay,
            newMaxDelay,
            newGracePeriod
        );
        
        // Queue the transaction with an appropriate delay based on threat level
        ThreatLevel level = getThreatLevel(address(this), data);
        uint256 delay = getDelayForThreatLevel(level);
        return _queueTransaction(address(this), 0, data, delay, level);
    }
    
    /**
     * @notice Queue a transaction to update threat level delays
     * @param newLowDelay New delay for low threat transactions
     * @param newMediumDelay New delay for medium threat transactions
     * @param newHighDelay New delay for high threat transactions
     * @param newCriticalDelay New delay for critical threat transactions
     * @return txHash The hash of the transaction
     */
    function queueThreatLevelDelaysUpdate(
        uint256 newLowDelay,
        uint256 newMediumDelay,
        uint256 newHighDelay,
        uint256 newCriticalDelay
    ) external whenNotPaused returns (bytes32) {
        if (newLowDelay < minDelay) revert DelayTooShort(newLowDelay, minDelay);
        if (newMediumDelay < newLowDelay) revert DelayHierarchyViolation();
        if (newHighDelay < newMediumDelay) revert DelayHierarchyViolation();
        if (newCriticalDelay < newHighDelay) revert DelayHierarchyViolation();
        if (newCriticalDelay > maxDelay) revert DelayTooLong(newCriticalDelay, maxDelay);
        
        // System parameter updates can only be queued by users with PROPOSER_ROLE
        // Token holders without this role cannot update system parameters
        if (!hasRole(PROPOSER_ROLE, msg.sender) && !hasRole(GOVERNANCE_ROLE, msg.sender))
            revert NotAuthorized(msg.sender, PROPOSER_ROLE);
        
        // Prepare call data
        bytes memory data = abi.encodeWithSelector(
            this.updateThreatLevelDelays.selector,
            newLowDelay,
            newMediumDelay,
            newHighDelay,
            newCriticalDelay
        );
        
        // Queue the transaction with an appropriate delay based on threat level
        ThreatLevel level = getThreatLevel(address(this), data);
        uint256 delay = getDelayForThreatLevel(level);
        return _queueTransaction(address(this), 0, data, delay, level);
    }

    /**
     * @notice Pause or unpause the timelock
     * @param isPaused Whether to pause or unpause
     */
    function setPaused(bool isPaused) external onlyRole(GUARDIAN_ROLE) {
        if (isPaused) {
            _pause();
            emit ContractPaused(msg.sender);
        } else {
            _unpause();
            emit ContractUnpaused(msg.sender);
        }
    }
    
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
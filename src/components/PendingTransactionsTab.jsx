import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertTriangle, RefreshCw, Clock, Info, Shield, Calendar } from 'lucide-react';
import { ethers } from 'ethers';
import { formatRelativeTime, formatAddress } from '../utils/formatters';
import Loader from './Loader';

// Define role constants
const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
const GUARDIAN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GUARDIAN_ROLE"));
const PROPOSER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROPOSER_ROLE"));
const CANCELLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CANCELLER_ROLE"));
const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));

// Proposal states (matching JustGovernance contract)
const PROPOSAL_STATES = {
  ACTIVE: 0,
  CANCELED: 1,
  DEFEATED: 2,
  SUCCEEDED: 3,
  QUEUED: 4,
  EXECUTED: 5,
  EXPIRED: 6
};

// Transaction states (matching JustTimelock contract)
const TX_STATES = {
  NONEXISTENT: 0,
  QUEUED: 1,
  EXECUTED: 2,
  CANCELED: 3,
  FAILED: 4
};

const PendingTransactionsTab = ({ contracts, account }) => {
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [gracePeriod, setGracePeriod] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);
  const [userRoles, setUserRoles] = useState({
    isAdmin: false,
    isGuardian: false,
    isProposer: false,
    isCanceller: false,
    isGovernance: false
  });

  // Check user roles
  useEffect(() => {
    const checkUserRoles = async () => {
      if (!contracts.governance || !contracts.timelock || !account) return;
      
      try {
        // Get roles from governance contract
        const isAdmin = await contracts.governance.hasRole(ADMIN_ROLE, account);
        const isGuardian = await contracts.governance.hasRole(GUARDIAN_ROLE, account);
        
        // Get roles from timelock contract
        const isProposer = await contracts.timelock.hasRole(PROPOSER_ROLE, account);
        const isCanceller = await contracts.timelock.hasRole(CANCELLER_ROLE, account);
        const isGovernance = await contracts.timelock.hasRole(GOVERNANCE_ROLE, account);
        
        setUserRoles({
          isAdmin,
          isGuardian,
          isProposer,
          isCanceller,
          isGovernance
        });
        
        console.log("User roles:", { isAdmin, isGuardian, isProposer, isCanceller, isGovernance });
      } catch (error) {
        console.error("Error checking user roles:", error);
      }
    };
    
    checkUserRoles();
  }, [contracts.governance, contracts.timelock, account]);

  // Load transactions
  useEffect(() => {
    loadAllTransactions();
    
    // Set up a refresh interval
    const refreshInterval = setInterval(() => {
      loadAllTransactions();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [contracts.timelock, contracts.governance]);

  // Get proposal state name
  const getProposalStateName = (state) => {
    const names = {
      [PROPOSAL_STATES.ACTIVE]: "Active",
      [PROPOSAL_STATES.CANCELED]: "Canceled",
      [PROPOSAL_STATES.DEFEATED]: "Defeated",
      [PROPOSAL_STATES.SUCCEEDED]: "Succeeded",
      [PROPOSAL_STATES.QUEUED]: "Queued",
      [PROPOSAL_STATES.EXECUTED]: "Executed",
      [PROPOSAL_STATES.EXPIRED]: "Expired"
    };
    return names[state] || "Unknown";
  };

  // Get transaction state name
  const getTxStateName = (state) => {
    const names = {
      [TX_STATES.NONEXISTENT]: "Nonexistent",
      [TX_STATES.QUEUED]: "Queued",
      [TX_STATES.EXECUTED]: "Executed",
      [TX_STATES.CANCELED]: "Canceled",
      [TX_STATES.FAILED]: "Failed"
    };
    return names[state] || "Queued"; // Default to "Queued" for unknown states
  };

  // Main function to load all transactions
  const loadAllTransactions = async () => {
    if (!contracts.timelock || !contracts.governance) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    console.log("Loading all pending transactions...");
    
    try {
      // Get grace period from timelock
      let gracePeriodValue = 0;
      try {
        const gracePeriodBN = await contracts.timelock.gracePeriod();
        gracePeriodValue = gracePeriodBN.toNumber();
        setGracePeriod(gracePeriodValue);
      } catch (error) {
        console.error("Error getting grace period:", error);
      }
      
      // Get proposals in interesting states
      const results = await loadProposalsAndTimelockTxs(gracePeriodValue);
      setPendingTransactions(results);
    } catch (error) {
      console.error("Error loading transaction data:", error);
      setErrorMessage("Failed to load transaction data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Load proposals and their associated timelock transactions
  const loadProposalsAndTimelockTxs = async (gracePeriodValue) => {
    const transactions = [];
    
    try {
      // Estimate max proposal ID - start from 20 and decrease if needed
      let maxProposalId = 20;
      
      try {
        if (typeof contracts.governance.proposalCount === 'function') {
          const count = await contracts.governance.proposalCount();
          maxProposalId = count.toNumber();
        }
      } catch (e) {
        console.log("Could not get proposal count, using default:", e);
      }

      // Process each proposal
      for (let id = maxProposalId; id >= 0; id--) {
        try {
          // Get proposal state - this should be available in any governance contract
          const stateResult = await contracts.governance.getProposalState(id);
          const stateNum = Number(stateResult.toString());
          
          console.log(`Proposal #${id} state: ${stateNum} (${getProposalStateName(stateNum)})`);
          
          // Skip proposals that are not in interesting states
          if (stateNum === PROPOSAL_STATES.CANCELED || 
              stateNum === PROPOSAL_STATES.DEFEATED || 
              stateNum === PROPOSAL_STATES.EXECUTED) {
            continue;
          }
          
          // Get basic proposal details
          let proposalData = {
            id: id,
            displayId: `proposal-${id}`,
            proposalId: id,
            type: getProposalStateName(stateNum).toLowerCase(),
            actualState: stateNum,
            idType: 'proposal',
            description: `Proposal #${id}`
          };
          
          // Add more details to the proposal data
          await enhanceProposalData(proposalData);
          
          // For queued proposals, also check timelock
          if (stateNum === PROPOSAL_STATES.QUEUED) {
            const timelockTxHash = await getTimelockHash(id);
            
            if (timelockTxHash) {
              await addTimelockData(transactions, id, timelockTxHash, proposalData, gracePeriodValue);
            } else {
              // If we couldn't get timelock hash, still add the proposal
              transactions.push(proposalData);
            }
          } else {
            // For non-queued proposals, add them directly
            transactions.push(proposalData);
          }
        } catch (error) {
          // If proposal doesn't exist, skip it
          console.warn(`Error checking proposal #${id}:`, error);
        }
      }
      
      return transactions;
    } catch (error) {
      console.error("Error loading proposals:", error);
      return [];
    }
  };
  
  // Function to enhance proposal data with additional on-chain information
  const enhanceProposalData = async (proposalData) => {
    const id = proposalData.id;
    
    // Try to get vote information
    try {
      // Try using getProposalVotes function
      let voteResult;
      try {
        voteResult = await contracts.governance.getProposalVotes(id);
      } catch (e) {
        // Fallback to getProposalVoteTotals if available
        if (typeof contracts.governance.getProposalVoteTotals === 'function') {
          voteResult = await contracts.governance.getProposalVoteTotals(id);
        }
      }
      
      if (voteResult) {
        // Handle different return formats
        if (Array.isArray(voteResult)) {
          // Format: [yesVotes, noVotes, abstainVotes, ...]
          proposalData.yesVotes = Number(voteResult[0].toString());
          proposalData.noVotes = Number(voteResult[1].toString());
          proposalData.abstainVotes = Number(voteResult[2].toString());
        } else if (voteResult.yesVotes !== undefined) {
          // Format: {yesVotes, noVotes, abstainVotes, ...}
          proposalData.yesVotes = Number(voteResult.yesVotes.toString());
          proposalData.noVotes = Number(voteResult.noVotes.toString());
          proposalData.abstainVotes = Number(voteResult.abstainVotes.toString());
        } else if (voteResult.forVotes !== undefined) {
          // Format: {forVotes, againstVotes, abstainVotes, ...}
          proposalData.yesVotes = Number(voteResult.forVotes.toString());
          proposalData.noVotes = Number(voteResult.againstVotes.toString());
          proposalData.abstainVotes = Number(voteResult.abstainVotes.toString());
        }
        
        // Check if any votes were cast
        proposalData.hasVotes = (proposalData.yesVotes > 0 || 
                               proposalData.noVotes > 0 || 
                               proposalData.abstainVotes > 0);
      }
    } catch (e) {
      console.warn(`Could not get votes for proposal #${id}:`, e);
      proposalData.hasVotes = false;
    }
    
    // Try to get proposal description and proposer
    try {
      // First try to get from ProposalEvent
      try {
        const filter = contracts.governance.filters.ProposalEvent(id, 0); // 0 = created
        const events = await contracts.governance.queryFilter(filter);
        
        if (events.length > 0 && events[0].args) {
          // Get proposer address
          if (events[0].args.actor) {
            proposalData.proposer = events[0].args.actor;
          }
          
          // Try to get creation timestamp
          if (events[0].blockNumber) {
            const block = await contracts.governance.provider.getBlock(events[0].blockNumber);
            if (block) {
              proposalData.createdAt = new Date(block.timestamp * 1000);
            }
          }
          
          // Try to get description from event data
          if (events[0].args.data) {
            try {
              const data = events[0].args.data;
              if (typeof data === 'string' && data.length > 2 && !data.startsWith('\u0000')) {
                // Try to decode string data
                try {
                  const decoded = ethers.utils.defaultAbiCoder.decode(['string'], data);
                  if (decoded && decoded[0]) {
                    proposalData.description = decoded[0];
                  }
                } catch (e) {
                  // If not decodable as string, try other formats
                  try {
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                      ['uint8', 'uint256'], data
                    );
                    // This could be [proposalType, snapshotId]
                    const proposalType = Number(decoded[0]);
                    proposalData.proposalType = proposalType;
                  } catch (e2) {
                    console.log("Could not decode event data");
                  }
                }
              }
            } catch (e) {
              console.warn("Error decoding event data:", e);
            }
          }
        }
      } catch (e) {
        console.warn(`Could not get events for proposal #${id}:`, e);
      }
      
      // Try to get more details if available
      try {
        // Look for various detail-getting functions
        if (typeof contracts.governance.getProposalDetails === 'function') {
          const details = await contracts.governance.getProposalDetails(id);
          
          if (details) {
            // Extract details - handle different contract structures
            if (details.description) {
              proposalData.description = details.description;
            }
            
            if (details.proposer) {
              proposalData.proposer = details.proposer;
            }
            
            if (details.deadline) {
              proposalData.deadline = new Date(Number(details.deadline.toString()) * 1000);
            }
            
            if (details.createdAt) {
              proposalData.createdAt = new Date(Number(details.createdAt.toString()) * 1000);
            }
          }
        }
      } catch (e) {
        console.warn(`Could not get proposal details for #${id}:`, e);
      }
      
      // If we still don't have a deadline, try to calculate it
      if (!proposalData.deadline) {
        try {
          if (typeof contracts.governance.govParams === 'function') {
            const params = await contracts.governance.govParams();
            if (params.votingDuration) {
              const votingDuration = Number(params.votingDuration.toString());
              
              if (proposalData.createdAt) {
                const creationTime = proposalData.createdAt.getTime() / 1000;
                proposalData.deadline = new Date((creationTime + votingDuration) * 1000);
              }
            }
          }
        } catch (e) {
          console.warn("Could not calculate deadline:", e);
        }
      }
      
      // Set defaults if still needed
      if (!proposalData.createdAt) {
        proposalData.createdAt = new Date();
      }
      
      if (!proposalData.deadline) {
        proposalData.deadline = new Date(Date.now() + 86400000); // Default: 1 day
      }
      
      // Format description with proposer if needed
      if (proposalData.proposer && 
          proposalData.description === `Proposal #${id}`) {
        proposalData.description = `Proposal #${id} by ${formatAddress(proposalData.proposer)}`;
      }
    } catch (e) {
      console.warn(`Could not enhance proposal #${id} data:`, e);
    }
    
    return proposalData;
  };
  
  // Function to get timelock transaction hash for a proposal
  const getTimelockHash = async (proposalId) => {
    // Try multiple ways to get timelock hash
    try {
      // Method 1: Try proposal.timelockTxHash
      try {
        const details = await contracts.governance.getProposalDetails(proposalId);
        if (details && details.timelockTxHash && 
            details.timelockTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          return details.timelockTxHash;
        }
      } catch (e) {
        console.log("Could not get timelock hash from details");
      }
      
      // Method 2: Try getProposalTimelockHash function
      try {
        if (typeof contracts.governance.getProposalTimelockHash === 'function') {
          const txHash = await contracts.governance.getProposalTimelockHash(proposalId);
          if (txHash && txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            return txHash;
          }
        }
      } catch (e) {
        console.log("Could not get timelock hash from getter");
      }
      
      // Method 3: Try TimelockTransactionSubmitted event
      try {
        const filter = contracts.governance.filters.TimelockTransactionSubmitted(proposalId);
        const events = await contracts.governance.queryFilter(filter);
        
        if (events.length > 0 && events[0].args.txHash) {
          return events[0].args.txHash;
        }
      } catch (e) {
        console.log("Could not get timelock hash from event");
      }
      
      // Method 4: Try ProposalEvent for queue (type 2)
      try {
        const filter = contracts.governance.filters.ProposalEvent(proposalId, 2);
        const events = await contracts.governance.queryFilter(filter);
        
        if (events.length > 0 && events[0].args.data) {
          try {
            const decoded = ethers.utils.defaultAbiCoder.decode(['bytes32'], events[0].args.data);
            if (decoded[0] && decoded[0] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              return decoded[0];
            }
          } catch (e) {
            console.log("Could not decode event data");
          }
        }
      } catch (e) {
        console.log("Could not get timelock hash from queue event");
      }
    } catch (e) {
      console.warn(`Could not get timelock hash for proposal #${proposalId}:`, e);
    }
    
    return null;
  };
  
  // Function to fetch timelock data and add it to transactions array
  const addTimelockData = async (transactions, proposalId, txHash, proposalData, gracePeriodValue) => {
    try {
      // First check if it's in the queue
      const isQueued = await contracts.timelock.queuedTransactions(txHash);
      
      if (isQueued) {
        // Get transaction details
        try {
          const tx = await contracts.timelock.getTransaction(txHash);
          
          // Parse data
          const target = tx[0];
          const value = tx[1];
          const data = tx[2];
          const etaTime = Number(tx[3].toString());
          
          // Get state (with fallback)
          let txState = TX_STATES.QUEUED; // Default
          try {
            const rawState = tx[4];
            if (rawState !== undefined) {
              txState = Number(rawState.toString());
              
              // Validate range
              if (txState < 0 || txState > 4) {
                txState = TX_STATES.QUEUED; // Reset to default if out of range
              }
            }
          } catch (e) {
            console.warn("Could not parse tx state:", e);
          }
          
          // Check if expired
          const currentTime = Math.floor(Date.now() / 1000);
          const isExpired = currentTime > etaTime + gracePeriodValue;
          
          // Create timelock transaction object
          const timelockTx = {
            id: txHash,
            displayId: `timelock-${proposalId}`,
            proposalId,
            description: proposalData.description,
            proposer: proposalData.proposer,
            target,
            value: value.toString(),
            data,
            eta: new Date(etaTime * 1000),
            txState,
            txStateText: getTxStateName(txState),
            type: 'queued',
            idType: 'timelock',
            canExecute: txState === TX_STATES.QUEUED && currentTime >= etaTime,
            isExpired,
            createdAt: proposalData.createdAt
          };
          
          transactions.push(timelockTx);
        } catch (e) {
          console.warn(`Error getting timelock transaction details for ${txHash}:`, e);
          // Fall back to adding just the proposal
          transactions.push(proposalData);
        }
      } else {
        // Not in queue - check if executed/canceled
        let txState = null;
        
        // Try different methods to determine state
        try {
          if (typeof contracts.timelock.getTransactionStatus === 'function') {
            const status = await contracts.timelock.getTransactionStatus(txHash);
            if (status.executed) txState = TX_STATES.EXECUTED;
            else if (status.canceled) txState = TX_STATES.CANCELED;
          } else if (typeof contracts.timelock.isCanceled === 'function') {
            const isCanceled = await contracts.timelock.isCanceled(txHash);
            if (isCanceled) txState = TX_STATES.CANCELED;
          }
        } catch (e) {
          console.warn("Could not determine complete transaction state:", e);
        }
        
        // If we determined a final state, add as completed transaction
        if (txState === TX_STATES.EXECUTED || txState === TX_STATES.CANCELED) {
          const completedTx = {
            id: txHash,
            displayId: `timelock-${proposalId}-complete`,
            proposalId,
            description: proposalData.description,
            proposer: proposalData.proposer,
            idType: 'timelock',
            txState,
            txStateText: getTxStateName(txState),
            type: txState === TX_STATES.EXECUTED ? 'executed' : 'canceled',
            createdAt: proposalData.createdAt
          };
          
          transactions.push(completedTx);
        } else {
          // If we couldn't determine status, fall back to the proposal
          transactions.push(proposalData);
        }
      }
    } catch (e) {
      console.warn(`Error processing timelock tx ${txHash} for proposal #${proposalId}:`, e);
      // Fall back to adding just the proposal
      transactions.push(proposalData);
    }
  };

  // Get status text for UI with optional remaining time
  const getStatusText = (transaction) => {
    if (transaction.idType === 'timelock') {
      if (transaction.txState === TX_STATES.EXECUTED) return 'Executed';
      if (transaction.txState === TX_STATES.CANCELED) return 'Canceled';
      if (transaction.txState === TX_STATES.FAILED) return 'Failed';
      if (transaction.isExpired) return 'Expired';
      
      // If it has an eta, show if it's ready
      if (transaction.eta) {
        const now = new Date();
        if (now >= transaction.eta) {
          return 'Ready';
        } else {
          return 'Pending';
        }
      }
      
      return 'Ready';
    } else {
      if (transaction.actualState === PROPOSAL_STATES.ACTIVE) {
        return 'Active';
      } else if (transaction.actualState === PROPOSAL_STATES.SUCCEEDED) {
        return 'Succeeded';
      } else if (transaction.actualState === PROPOSAL_STATES.QUEUED) {
        // For queued proposals, check the deadline
        if (transaction.deadline) {
          const now = new Date();
          if (now >= transaction.deadline) {
            return 'Ready';
          }
        }
        return 'Queued';
      } else if (transaction.actualState === PROPOSAL_STATES.EXPIRED) {
        return 'Expired';
      } else {
        return 'Pending';
      }
    }
  };

  // Get status badge style
  const getStatusBadgeStyle = (transaction) => {
    if (transaction.idType === 'timelock') {
      if (transaction.txState === TX_STATES.EXECUTED) return 'bg-green-100 text-green-800';
      if (transaction.txState === TX_STATES.CANCELED) return 'bg-gray-100 text-gray-800';
      if (transaction.txState === TX_STATES.FAILED) return 'bg-red-100 text-red-800';
      if (transaction.isExpired) return 'bg-red-100 text-red-800';
      return 'bg-green-100 text-green-800'; // Ready
    } else {
      if (transaction.actualState === PROPOSAL_STATES.ACTIVE) return 'bg-blue-100 text-blue-800';
      if (transaction.actualState === PROPOSAL_STATES.SUCCEEDED) return 'bg-green-100 text-green-800';
      if (transaction.actualState === PROPOSAL_STATES.EXPIRED) return 'bg-red-100 text-red-800';
      return 'bg-yellow-100 text-yellow-800'; // Default for other states
    }
  };

  // Check if user can cancel a transaction
  const canUserCancel = (tx) => {
    if (tx.idType === 'timelock') {
      // For timelock: need guardian, canceller, proposer, or governance role
      return userRoles.isGuardian || userRoles.isCanceller || 
             userRoles.isProposer || userRoles.isGovernance;
    } else {
      // For proposals:
      // - Guardians can cancel any proposal
      if (userRoles.isGuardian) return true;
      
      // - Proposers can cancel their own proposals if no votes cast
      if (tx.proposer && tx.proposer.toLowerCase() === account.toLowerCase()) {
        if (tx.hasVotes) return false;
        return true;
      }
      
      return false;
    }
  };

  // Analyze why a cancellation might fail
  const analyzeProposalCancellation = async (transaction) => {
    setDebugInfo(null);
    
    const proposalId = transaction.proposalId;
    try {
      console.log(`=== ANALYZING ${transaction.idType === 'timelock' ? 'TIMELOCK TRANSACTION' : 'PROPOSAL'} CANCELLATION ===`);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();
      
      console.log(`Current user address: ${userAddress}`);
      
      let report = [];
      
      // Handle timelock transactions
      if (transaction.idType === 'timelock') {
        const timelock = contracts.timelock;
        const txHash = transaction.id;
        
        report.push(`Analyzing timelock transaction ${txHash.slice(0, 10)}... for proposal #${proposalId}`);
        
        // 1. Verify the transaction is still in the queue
        const isQueued = await timelock.queuedTransactions(txHash);
        if (!isQueued) {
          report.push(`❌ CRITICAL ERROR: Transaction is not queued in the timelock`);
          setDebugInfo(report);
          return "FAILURE REASON: Transaction is not in the timelock queue";
        }
        
        report.push(`✅ Transaction is confirmed to be in the timelock queue`);
        
        // 2. Check user roles
        const isGuardian = await timelock.hasRole(GUARDIAN_ROLE, userAddress);
        const isCanceller = await timelock.hasRole(CANCELLER_ROLE, userAddress);
        const isProposer = await timelock.hasRole(PROPOSER_ROLE, userAddress);
        const isGovernance = await timelock.hasRole(GOVERNANCE_ROLE, userAddress);
        
        report.push(`User roles for timelock cancellation:`);
        report.push(`- GUARDIAN_ROLE: ${isGuardian}`);
        report.push(`- CANCELLER_ROLE: ${isCanceller}`);
        report.push(`- PROPOSER_ROLE: ${isProposer}`);
        report.push(`- GOVERNANCE_ROLE: ${isGovernance}`);
        
        if (!isGuardian && !isCanceller && !isProposer && !isGovernance) {
          report.push(`❌ CRITICAL ERROR: You need one of these roles to cancel timelock transactions`);
          setDebugInfo(report);
          return "FAILURE REASON: Not authorized to cancel timelock transactions";
        }
        
        // 3. Try the cancellation in simulation mode
        try {
          report.push("Simulating timelock cancellation...");
          await timelock.callStatic.cancelTransaction(txHash, { from: userAddress });
          report.push("✅ Simulation successful - transaction should be cancellable");
          setDebugInfo(report);
          return "SUCCESS: Transaction should be cancellable";
        } catch (e) {
          // Extract error message
          let reason = "Unknown error";
          if (e.data) {
            try {
              reason = e.data;
              if (reason.startsWith('0x08c379a0')) {
                // String error
                const encoded = `0x${reason.substring(10)}`;
                const decoded = ethers.utils.defaultAbiCoder.decode(['string'], encoded);
                reason = decoded[0];
              }
            } catch (e) {}
          }
          
          if (!reason && e.message) {
            const matches = e.message.match(/reason="([^"]+)"/);
            if (matches && matches.length > 1) {
              reason = matches[1];
            } else if (e.message.includes('execution reverted')) {
              reason = e.message;
            }
          }
          
          report.push(`❌ CRITICAL ERROR: ${reason}`);
          setDebugInfo(report);
          return `FAILURE REASON: ${reason}`;
        }
      } else {
        // Handle proposal cancellation
        const governance = contracts.governance;
        
        // 1. Check proposal state
        const stateNum = await governance.getProposalState(proposalId);
        const stateName = getProposalStateName(stateNum);
        
        report.push(`Proposal #${proposalId} state: ${stateName}`);
        
        if (stateName === "Executed") {
          report.push("❌ CRITICAL ERROR: Proposal is already executed");
          setDebugInfo(report);
          return "FAILURE REASON: Proposal is already executed";
        }
        
        if (stateName === "Canceled") {
          report.push("❌ CRITICAL ERROR: Proposal is already canceled");
          setDebugInfo(report);
          return "FAILURE REASON: Proposal is already canceled";
        }
        
        // 2. Check user roles
        const isGuardian = await governance.hasRole(GUARDIAN_ROLE, userAddress);
        report.push(`User has GUARDIAN_ROLE: ${isGuardian}`);
        
        if (!isGuardian) {
          // 3. Check if user is proposer
          let isProposer = false;
          if (transaction.proposer) {
            isProposer = transaction.proposer.toLowerCase() === userAddress.toLowerCase();
            report.push(`User is the proposer: ${isProposer}`);
          }
          
          if (!isProposer) {
            report.push("❌ CRITICAL ERROR: Not the proposer or a guardian");
            setDebugInfo(report);
            return "FAILURE REASON: Not authorized to cancel this proposal";
          }
          
          // 4. Check if votes have been cast
          let hasVotes = false;
          try {
            const votesInfo = await governance.getProposalVotes(proposalId);
            let yesVotes, noVotes, abstainVotes;
            
            if (Array.isArray(votesInfo)) {
              [yesVotes, noVotes, abstainVotes] = votesInfo;
            } else if (votesInfo.yesVotes !== undefined) {
              yesVotes = votesInfo.yesVotes;
              noVotes = votesInfo.noVotes;
              abstainVotes = votesInfo.abstainVotes;
            } else if (votesInfo.forVotes !== undefined) {
              yesVotes = votesInfo.forVotes;
              noVotes = votesInfo.againstVotes;
              abstainVotes = votesInfo.abstainVotes;
            }
            
            hasVotes = (Number(yesVotes) > 0 || Number(noVotes) > 0 || Number(abstainVotes) > 0);
            report.push(`Proposal has votes: ${hasVotes}`);
            
            if (hasVotes) {
              report.push("❌ CRITICAL ERROR: Votes have been cast - only guardians can cancel now");
              setDebugInfo(report);
              return "FAILURE REASON: Votes have been cast";
            }
          } catch (e) {
            console.warn("Error checking votes:", e);
          }
          
          // 5. Check deadline
          try {
            let deadline = null;
            if (transaction.deadline) {
              deadline = transaction.deadline;
            } else {
              try {
                if (typeof governance.getProposalDeadline === 'function') {
                  const deadlineBN = await governance.getProposalDeadline(proposalId);
                  deadline = new Date(Number(deadlineBN.toString()) * 1000);
                }
              } catch (e) {}
            }
            
            if (deadline) {
              const currentTime = new Date();
              report.push(`Deadline: ${deadline.toISOString()}`);
              report.push(`Current time: ${currentTime.toISOString()}`);
              
              if (currentTime >= deadline) {
                report.push("❌ CRITICAL ERROR: Voting deadline has passed - only guardians can cancel now");
                setDebugInfo(report);
                return "FAILURE REASON: Voting deadline has passed";
              }
            }
          } catch (e) {
            console.warn("Error checking deadline:", e);
          }
        }
        
        // 6. Try the cancellation in simulation mode
        try {
          report.push("Simulating proposal cancellation...");
          await governance.callStatic.cancelProposal(proposalId, { from: userAddress });
          report.push("✅ Simulation successful - proposal should be cancellable");
          setDebugInfo(report);
          return "SUCCESS: Proposal should be cancellable";
        } catch (e) {
          // Extract error message
          let reason = "Unknown error";
          if (e.data) {
            try {
              reason = e.data;
              if (reason.startsWith('0x08c379a0')) {
                // String error
                const encoded = `0x${reason.substring(10)}`;
                const decoded = ethers.utils.defaultAbiCoder.decode(['string'], encoded);
                reason = decoded[0];
              } else if (reason.startsWith('0x')) {
                // Custom error selectors
                if (reason.startsWith('0x82b42900')) reason = "ProposalExecuted";
                else if (reason.startsWith('0xf21f537d')) reason = "ProposalCanceled";
                else if (reason.startsWith('0xa9802b90')) reason = "NotAuthorized";
                else if (reason.startsWith('0x8bec1a4c')) reason = "AlreadyVoted";
                else if (reason.startsWith('0x56399a56')) reason = "VotingEnded";
              }
            } catch (e) {}
          }
          
          if (!reason && e.message) {
            const matches = e.message.match(/reason="([^"]+)"/);
            if (matches && matches.length > 1) {
              reason = matches[1];
            } else if (e.message.includes('execution reverted')) {
              reason = e.message;
            }
          }
          
          report.push(`❌ CRITICAL ERROR: ${reason}`);
          setDebugInfo(report);
          return `FAILURE REASON: ${reason}`;
        }
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setDebugInfo([`Error during analysis: ${error.message}`]);
      return "Error during analysis: " + error.message;
    }
  };

  // Cancel a transaction
  const cancelTransaction = async (transaction) => {
    if (!window.confirm('Are you sure you want to cancel this transaction? This action cannot be undone.')) {
      return;
    }
    
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      if (transaction.idType === 'timelock') {
        // Cancel timelock transaction
        const timelock = contracts.timelock.connect(signer);
        const txHash = transaction.id;
        
        // Verify it's still in the queue
        const isQueued = await timelock.queuedTransactions(txHash);
        if (!isQueued) {
          throw new Error("Transaction is not in the timelock queue");
        }
        
        // Get gas settings
        const gasPrice = (await provider.getGasPrice()).mul(120).div(100);
        const gasEstimate = await timelock.estimateGas.cancelTransaction(txHash)
          .catch(() => ethers.BigNumber.from("1000000"));
        const gasLimit = gasEstimate.mul(200).div(100);
        
        // Submit transaction
        const tx = await timelock.cancelTransaction(txHash, { gasLimit, gasPrice });
        await tx.wait();
      } else {
        // Cancel governance proposal
        const governance = contracts.governance.connect(signer);
        const proposalId = transaction.proposalId;
        
        // Get gas settings
        const gasPrice = (await provider.getGasPrice()).mul(120).div(100);
        const gasEstimate = await governance.estimateGas.cancelProposal(proposalId)
          .catch(() => ethers.BigNumber.from("1000000"));
        const gasLimit = gasEstimate.mul(200).div(100);
        
        // Submit transaction
        const tx = await governance.cancelProposal(proposalId, { gasLimit, gasPrice });
        await tx.wait();
      }
      
      // Remove from local state
      setPendingTransactions(pendingTransactions.filter(t => t.id !== transaction.id));
      setSuccessMessage("Transaction cancelled successfully");
      
      // Reload after short delay
      setTimeout(() => loadAllTransactions(), 2000);
      
      // Clear success message
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      setErrorMessage(error.message || 'Failed to cancel transaction');
    } finally {
      setTxLoading(false);
    }
  };

  // Execute a transaction
  const executeTransaction = async (transaction) => {
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      if (transaction.idType === 'timelock') {
        // Execute timelock transaction
        const timelock = contracts.timelock.connect(signer);
        const txHash = transaction.id;
        
        // Verify it's still in the queue
        const isQueued = await timelock.queuedTransactions(txHash);
        if (!isQueued) {
          throw new Error("Transaction is not in the timelock queue");
        }
        
        // Get gas settings
        const gasPrice = (await provider.getGasPrice()).mul(120).div(100);
        const gasEstimate = await timelock.estimateGas.executeTransaction(txHash)
          .catch(() => ethers.BigNumber.from("1000000"));
        const gasLimit = gasEstimate.mul(200).div(100);
        
        // Submit transaction
        const tx = await timelock.executeTransaction(txHash, { gasLimit, gasPrice });
        await tx.wait();
      } else {
        // Execute governance proposal
        const governance = contracts.governance.connect(signer);
        const proposalId = transaction.proposalId;
        
        // Get gas settings
        const gasPrice = (await provider.getGasPrice()).mul(120).div(100);
        const gasEstimate = await governance.estimateGas.executeProposal(proposalId)
          .catch(() => ethers.BigNumber.from("1000000"));
        const gasLimit = gasEstimate.mul(200).div(100);
        
        // Submit transaction
        const tx = await governance.executeProposal(proposalId, { gasLimit, gasPrice });
        await tx.wait();
      }
      
      // Remove from local state
      setPendingTransactions(pendingTransactions.filter(t => t.id !== transaction.id));
      setSuccessMessage("Transaction executed successfully");
      
      // Reload after short delay
      setTimeout(() => loadAllTransactions(), 2000);
      
      // Clear success message
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error("Error executing transaction:", error);
      setErrorMessage(error.message || 'Failed to execute transaction');
    } finally {
      setTxLoading(false);
    }
  };

  // Execute expired transaction
  const executeExpiredTransaction = async (transaction) => {
    if (transaction.idType !== 'timelock') {
      setErrorMessage('Only timelock transactions can be executed as expired');
      return;
    }
    
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const timelock = contracts.timelock.connect(signer);
      const txHash = transaction.id;
      
      // Verify admin role
      const userAddress = await signer.getAddress();
      const isAdmin = await timelock.hasRole(ADMIN_ROLE, userAddress);
      const isGovernance = await timelock.hasRole(GOVERNANCE_ROLE, userAddress);
      
      if (!isAdmin && !isGovernance) {
        throw new Error("Only admin or governance role can execute expired transactions");
      }
      
      // Get gas settings
      const gasPrice = (await provider.getGasPrice()).mul(120).div(100);
      const gasEstimate = await timelock.estimateGas.executeExpiredTransaction(txHash)
        .catch(() => ethers.BigNumber.from("1000000"));
      const gasLimit = gasEstimate.mul(200).div(100);
      
      // Submit transaction
      const tx = await timelock.executeExpiredTransaction(txHash, { gasLimit, gasPrice });
      await tx.wait();
      
      // Remove from local state
      setPendingTransactions(pendingTransactions.filter(t => t.id !== transaction.id));
      setSuccessMessage("Expired transaction executed successfully");
      
      // Reload after short delay
      setTimeout(() => loadAllTransactions(), 2000);
      
      // Clear success message
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error("Error executing expired transaction:", error);
      setErrorMessage(error.message || 'Failed to execute expired transaction');
    } finally {
      setTxLoading(false);
    }
  };

  // Queue a proposal
  const queueProposal = async (proposalId) => {
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const governance = contracts.governance.connect(signer);
      
      // Verify state
      const stateNum = await governance.getProposalState(proposalId);
      if (stateNum !== PROPOSAL_STATES.SUCCEEDED) {
        throw new Error(`Proposal #${proposalId} is not in SUCCEEDED state`);
      }
      
      // Get gas settings
      const gasPrice = (await provider.getGasPrice()).mul(120).div(100);
      const gasEstimate = await governance.estimateGas.queueProposal(proposalId)
        .catch(() => ethers.BigNumber.from("3000000"));
      const gasLimit = gasEstimate.mul(200).div(100);
      
      // Submit transaction
      const tx = await governance.queueProposal(proposalId, { gasLimit, gasPrice });
      await tx.wait();
      
      setSuccessMessage(`Proposal #${proposalId} queued successfully`);
      
      // Reload transactions
      loadAllTransactions();
      
      // Clear success message
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error("Error queueing proposal:", error);
      setErrorMessage(error.message || 'Failed to queue proposal');
    } finally {
      setTxLoading(false);
    }
  };

  // Format date with precise remaining time for deadlines
  const formatDate = (date, isDeadline = false) => {
    if (!date) return 'N/A';
    
    const now = new Date();
    const targetDate = new Date(date);
    
    // For deadlines, show precise remaining time if it's in the future
    if (isDeadline && targetDate > now) {
      const diffMs = targetDate - now;
      
      // Convert to seconds, minutes, hours, days
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      // Format remaining time based on magnitude
      if (diffDays > 0) {
        return `${diffDays}d ${diffHours % 24}h remaining`;
      } else if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m remaining`;
      } else if (diffMins > 0) {
        return `${diffMins}m ${diffSecs % 60}s remaining`;
      } else {
        return `${diffSecs}s remaining`;
      }
    }
    
    // For past times or non-deadlines, use regular relative time
    return formatRelativeTime(date);
  };

  // Render UI
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Pending Transactions</h2>
        <p className="text-gray-500">Manage active proposals and pending timelock transactions</p>
      </div>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertTriangle className="w-5 h-5 mr-2 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {debugInfo && (
        <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded mb-4">
          <div className="flex items-start mb-2">
            <Info className="w-5 h-5 mr-2 mt-0.5" />
            <h3 className="font-medium">Cancellation Analysis</h3>
          </div>
          <div className="pl-7">
            {debugInfo.map((line, index) => (
              <div key={index} className={`text-sm ${line.includes('CRITICAL ERROR') ? 'text-red-600 font-semibold' : ''}`}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <ArrowRight className="w-5 h-5 text-indigo-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Pending Transactions</h3>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded">
              <Shield className="w-3 h-3 text-indigo-500" /> 
              {userRoles.isAdmin && <span className="text-indigo-700">Admin</span>}
              {userRoles.isGuardian && <span className="text-red-700">Guardian</span>}
              {!userRoles.isAdmin && !userRoles.isGuardian && <span className="text-gray-500">No special role</span>}
            </div>
            
            <button
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
              onClick={loadAllTransactions}
              disabled={loading || txLoading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="py-8">
            <Loader size="large" text="Loading pending transactions..." />
          </div>
        ) : pendingTransactions.length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No pending transactions found</p>
            <p className="text-sm text-gray-400 mt-1">Active, succeeded, and queued proposals will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proposal</th>
                  <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                  <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingTransactions.map((tx, idx) => (
                  <tr key={tx.displayId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{tx.description}</span>
                        {tx.proposer && !tx.description?.includes(formatAddress(tx.proposer)) && (
                          <span className="text-xs text-gray-500">by {formatAddress(tx.proposer)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.idType === 'timelock' ? (
                        <div className="flex items-center">
                          <span title={tx.target}>
                            {tx.target ? formatAddress(tx.target) : 'Timelock'}
                          </span>
                          <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                            Timelock
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="capitalize">{tx.type}</span>
                          <span className="ml-2 text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                            Proposal
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        {tx.idType === 'timelock' && tx.eta ? 
                          // For timelock, show remaining time until ETA
                          formatDate(tx.eta, true) : 
                          // For proposals, show deadline with remaining time
                          tx.deadline ? formatDate(tx.deadline, true) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeStyle(tx)}`}>
                        {getStatusText(tx)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {/* Skip actions for executed/canceled transactions */}
                        {(tx.idType === 'timelock' && 
                          (tx.txState === TX_STATES.EXECUTED || tx.txState === TX_STATES.CANCELED)) ? (
                          <span className="px-3 py-1 text-gray-400 text-xs">No actions available</span>
                        ) : (
                          <>
                            {/* Action buttons for timelock transactions */}
                            {tx.idType === 'timelock' && tx.txState !== TX_STATES.FAILED ? (
                              <>
                                {tx.isExpired && (userRoles.isAdmin || userRoles.isGovernance) ? (
                                  <button
                                    className="px-3 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium hover:bg-orange-200 transition-colors"
                                    onClick={() => executeExpiredTransaction(tx)}
                                    disabled={txLoading}
                                  >
                                    Execute Expired
                                  </button>
                                ) : (
                                  <button
                                    className="px-3 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium hover:bg-green-200 transition-colors"
                                    onClick={() => executeTransaction(tx)}
                                    disabled={txLoading}
                                  >
                                    Execute
                                  </button>
                                )}
                              </>
                            ) : null}
                            
                            {/* Queue button for succeeded proposals */}
                            {tx.idType === 'proposal' && tx.actualState === PROPOSAL_STATES.SUCCEEDED && (
                              <button
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium hover:bg-blue-200 transition-colors"
                                onClick={() => queueProposal(tx.proposalId)}
                                disabled={txLoading}
                              >
                                Queue
                              </button>
                            )}
                            
                            {/* Execute button for queued proposals */}
                            {tx.idType === 'proposal' && tx.actualState === PROPOSAL_STATES.QUEUED && (
                              <button
                                className="px-3 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium hover:bg-green-200 transition-colors"
                                onClick={() => executeTransaction(tx)}
                                disabled={txLoading}
                              >
                                Execute
                              </button>
                            )}
                            
                            {/* Cancel button */}
                            {canUserCancel(tx) ? (
                              <div className="inline-flex">
                                <button
                                  className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium hover:bg-red-200 transition-colors"
                                  onClick={async () => {
                                    const result = await analyzeProposalCancellation(tx);
                                    if (result && result.startsWith("SUCCESS")) {
                                      cancelTransaction(tx);
                                    }
                                  }}
                                  disabled={txLoading}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="ml-1 px-1 py-1 bg-gray-100 text-gray-500 rounded-md text-xs hover:bg-gray-200"
                                  onClick={() => analyzeProposalCancellation(tx)}
                                  title="Check why cancellation might fail"
                                  disabled={txLoading}
                                >
                                  <Info className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="px-3 py-1 bg-gray-100 text-gray-400 rounded-md text-xs font-medium cursor-not-allowed"
                                disabled={true}
                                title={
                                  tx.idType === 'timelock' ?
                                  "You need appropriate role to cancel" :
                                  "Only the proposer or a guardian can cancel"
                                }
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingTransactionsTab;
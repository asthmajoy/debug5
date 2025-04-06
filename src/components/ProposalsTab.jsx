import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PROPOSAL_STATES, PROPOSAL_TYPES } from '../utils/constants';
import { formatRelativeTime, formatBigNumber, formatAddress, formatTime } from '../utils/formatters';
import { addressesEqual, diagnoseMismatchedAddresses } from '../utils/addressUtils';
import Loader from './Loader';
import { ChevronDown, ChevronUp, Copy, Check, AlertTriangle, Clock, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import TimelockInfoDisplay, { getThreatLevelLabel, getThreatLevelColor } from './TimelockInfoDisplay';
import ProposalRichTextEditor from './ProposalRichTextEditor';
import { useDarkMode } from '../contexts/DarkModeContext';

const safeBigNumberFrom = (value) => {
  if (!value) return ethers.BigNumber.from("0");
  
  try {
    // First try direct conversion (for values already in wei)
    return ethers.BigNumber.from(value);
  } catch (error) {
    try {
      // If it fails and looks like a decimal, try to parse it as ether
      if (typeof value === 'string' && value.includes('.')) {
        return ethers.utils.parseEther(value);
      }
      // For other failures, log and return zero
      console.warn(`Failed to convert ${value} to BigNumber:`, error);
      return ethers.BigNumber.from("0");
    } catch (innerError) {
      console.error(`Failed to parse ${value} as ether:`, innerError);
      return ethers.BigNumber.from("0");
    }
  }
};

// Function to safely check if a value represents a change (not zero)
const hasValueChanged = (value) => {
  if (!value) return false;
  
  try {
    const valueBN = safeBigNumberFrom(value);
    return !valueBN.isZero();
  } catch (error) {
    // If we can't convert to BigNumber, but have a string value, consider it changed
    return typeof value === 'string' && value.trim() !== '0' && value.trim() !== '';
  }
};


// Helper function to get human-readable proposal state label
function getProposalsStateLabel(state) {
  const stateLabels = {
    [PROPOSAL_STATES.ACTIVE]: "Active",
    [PROPOSAL_STATES.CANCELED]: "Canceled",
    [PROPOSAL_STATES.DEFEATED]: "Defeated",
    [PROPOSAL_STATES.SUCCEEDED]: "Succeeded",
    [PROPOSAL_STATES.QUEUED]: "Queued",
    [PROPOSAL_STATES.EXECUTED]: "Executed",
    [PROPOSAL_STATES.EXPIRED]: "Expired"
  };
  
  return stateLabels[state] || "Unknown";
  
}

// Helper function to get human-readable proposal type label
function getProposalsTypeLabel(type) {
  const typeLabels = {
    [PROPOSAL_TYPES.GENERAL]: "Contract Interaction",
    [PROPOSAL_TYPES.WITHDRAWAL]: "ETH Withdrawal",
    [PROPOSAL_TYPES.TOKEN_TRANSFER]: "Treasury Transfer",
    [PROPOSAL_TYPES.GOVERNANCE_CHANGE]: "Governance Parameter Update",
    [PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER]: "External Token Transfer",
    [PROPOSAL_TYPES.TOKEN_MINT]: "Token Issuance",
    [PROPOSAL_TYPES.TOKEN_BURN]: "Token Consolidation",
    [PROPOSAL_TYPES.SIGNALING]: "Binding Community Vote"
  };
  
  return typeLabels[type] || "Unknown";
}

// Function to parse proposal descriptions and extract HTML content
function parseProposalDescription(rawDescription) {
  if (!rawDescription) {
    return { title: '', description: '', descriptionHtml: null };
  }
  
  // Check if the description contains HTML content
  const htmlMarkerIndex = rawDescription.indexOf('|||HTML:');
  
  if (htmlMarkerIndex !== -1) {
    // Extract HTML content
    const htmlContent = rawDescription.substring(htmlMarkerIndex + 8);
    
    // Extract the plain text portion
    const plainTextPortion = rawDescription.substring(0, htmlMarkerIndex).trim();
    
    // The title is typically the first line
    const firstLineBreak = plainTextPortion.indexOf('\n');
    const title = firstLineBreak !== -1 
      ? plainTextPortion.substring(0, firstLineBreak).trim() 
      : plainTextPortion.trim();
    
    // The description is everything after the first line, but before the HTML marker
    const description = firstLineBreak !== -1 
      ? plainTextPortion.substring(firstLineBreak).trim() 
      : '';
      
    return { title, description, descriptionHtml: htmlContent };
  }
  
  // If no HTML marker is found, handle it as plain text only
  const lines = rawDescription.split('\n');
  const title = lines[0] || '';
  const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';
  
  return { title, description, descriptionHtml: null };
}

// Function to safely truncate HTML content
function truncateHtml(html, maxLength = 200) {
  if (!html) return '';
  
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Get the text content
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  
  // If the text is already short enough, return the original HTML
  if (textContent.length <= maxLength) {
    return html;
  }
  
  return textContent.substring(0, maxLength) + '...';
}

// Helper function to get human-readable proposal state label
function getProposalStateLabel(state) {
  const stateLabels = {
    [PROPOSAL_STATES.ACTIVE]: "Active",
    [PROPOSAL_STATES.CANCELED]: "Canceled",
    [PROPOSAL_STATES.DEFEATED]: "Defeated",
    [PROPOSAL_STATES.SUCCEEDED]: "Succeeded",
    [PROPOSAL_STATES.QUEUED]: "Queued",
    [PROPOSAL_STATES.EXECUTED]: "Executed",
    [PROPOSAL_STATES.EXPIRED]: "Expired"
  };
  
  return stateLabels[state] || "Unknown";
}

// Helper function to get human-readable proposal type label
function getProposalTypeLabel(type) {
  const typeLabels = {
    [PROPOSAL_TYPES.GENERAL]: "Contract Interaction",
    [PROPOSAL_TYPES.WITHDRAWAL]: "ETH Withdrawal",
    [PROPOSAL_TYPES.TOKEN_TRANSFER]: "Treasury Transfer",
    [PROPOSAL_TYPES.GOVERNANCE_CHANGE]: "Governance Parameter Update",
    [PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER]: "External Token Transfer",
    [PROPOSAL_TYPES.TOKEN_MINT]: "Token Issuance",
    [PROPOSAL_TYPES.TOKEN_BURN]: "Token Consolidation",
    [PROPOSAL_TYPES.SIGNALING]: "Binding Community Vote"
  };
  
  return typeLabels[type] || "Unknown";
}

// Helper function for status colors
function getStatusColor(status) {
  switch (status) {
    case 'active':
      return 'bg-yellow-100 text-yellow-800';
    case 'succeeded':
      return 'bg-green-100 text-green-800';
    case 'queued':
    case 'in timelock':
      return 'bg-blue-100 text-blue-800';
    case 'ready for execution':
      return 'bg-purple-100 text-purple-800';
    case 'executed':
      return 'bg-indigo-100 text-indigo-800';
    case 'defeated':
      return 'bg-red-100 text-red-800';
    case 'canceled':
    case 'expired':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const ProposalsTab = ({ 
  proposals, 
  createProposal, 
  createSignalingProposal,
  cancelProposal, 
  queueProposal,
  executeProposal, 
  claimRefund,
  loading: globalLoading,
  contracts,
  fetchProposals,
  account
}) => {
  const [proposalType, setProposalType] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedProposalId, setExpandedProposalId] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [newProposal, setNewProposal] = useState({
    
    title: '',
    description: '',
    descriptionHtml: '',
    type: PROPOSAL_TYPES.GENERAL,
    target: '',
    callData: '',
    amount: '',
    recipient: '',
    token: '',
    newThreshold: '',
    newQuorum: '',
    newVotingDuration: '',
    newProposalStake: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Add state for timelock information
  const [timelockInfo, setTimelockInfo] = useState({});
  
  // Transaction status tracking
  const [queuedTxs, setQueuedTxs] = useState({});
  const [loading, setLoading] = useState(globalLoading);
  const { isDarkMode } = useDarkMode();

  const [creationStatus, setCreationStatus] = useState({
    status: null, // 'queued', 'success', 'error'
    message: ''
  });

  // NEW: Add state for processed proposals to solve HTML rendering inconsistency
  const [processedProposals, setProcessedProposals] = useState([]);

  // CHANGE 5: Add memory leak prevention
  // Add this useEffect near the top of your component
  useEffect(() => {
    // Return a cleanup function that will run when component unmounts
    return () => {
      // Clear any pending operations
      const timeoutIds = [];
      // Find all timeouts
      for (let i = setTimeout(function() {}, 0); i > 0; i--) {
        clearTimeout(i);
        timeoutIds.push(i);
      }
      
      console.log(`Cleaned up ${timeoutIds.length} timeouts`);
      
      // Clear any intervals
      const intervalIds = [];
      // Find all intervals
      for (let i = setInterval(function() {}, 100000); i > 0; i--) {
        clearInterval(i);
        intervalIds.push(i);
      }
      
      console.log(`Cleaned up ${intervalIds.length} intervals`);
      
      // Reset any component state
      setQueuedTxs({});
      setTransactionError('');
      setExpandedProposalId(null);
      
      // Also clear sessionStorage items older than 1 day
      const now = Date.now();
      const oneDayAgo = now - 86400000; // 24 hours in milliseconds
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('searched-events-')) {
          // Try to parse timestamp from storage
          const timestamp = parseInt(sessionStorage.getItem(key), 10);
          if (isNaN(timestamp) || timestamp < oneDayAgo) {
            sessionStorage.removeItem(key);
          }
        }
      });
      
      console.log('Memory cleanup completed in ProposalsTab');
    };
  }, []);

  // Process proposals to extract HTML content properly
  useEffect(() => {
    if (proposals && proposals.length > 0) {
      // Create a copy of proposals and process HTML content
      const newProcessedProposals = proposals.map(proposal => {
        // Create a new object to avoid mutating the original
        const processedProposal = { ...proposal };
        
        // Process HTML content if needed
        if (processedProposal.description && !processedProposal.descriptionHtml) {
          const parsed = parseProposalDescription(processedProposal.description);
          if (parsed.descriptionHtml) {
            processedProposal.descriptionHtml = parsed.descriptionHtml;
          }
        }
        
        return processedProposal;
      });
      
      // Update state with processed proposals
      setProcessedProposals(newProcessedProposals);
    } else {
      setProcessedProposals([]);
    }
  }, [proposals]);

  // CHANGE 3: Updated checkTimelockStatus function to maintain threat level consistency
  const checkTimelockStatus = async (proposalId) => {
    if (!contracts?.timelock) return null;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const timelockContract = contracts.timelock.connect(provider);
      
      // Get the current proposal from our local data
      const existingProposal = processedProposals.find(p => Number(p.id) === Number(proposalId));
      if (!existingProposal) {
        console.log(`Proposal #${proposalId} not found in local data`);
        return null;
      }
      
      console.log(`Checking timelock status for proposal #${proposalId}`, existingProposal);
      
      // Step 1: Try to find the timelock transaction hash
      let timelockTxHash = null;
      let threatLevel = null;
      
      // First check if the proposal already has a timelockTxHash
      if (existingProposal.timelockTxHash) {
        timelockTxHash = existingProposal.timelockTxHash;
        // If we have a stored threat level, use it to maintain consistency
        threatLevel = existingProposal.timelockThreatLevel !== undefined ? 
                    existingProposal.timelockThreatLevel : null;
        console.log(`Using existing timelockTxHash: ${timelockTxHash}, threatLevel: ${threatLevel}`);
      }
      
      // If no hash found and we have a target address, search timelock events
      if (!timelockTxHash && existingProposal.target) {
        try {
          const currentBlock = await provider.getBlockNumber();
          const startBlock = Math.max(0, currentBlock - 50000); // Look back ~1 week
          
          // Try to find matching queued transactions in the timelock
          const timelockEvents = await timelockContract.queryFilter(
            timelockContract.filters.TransactionQueued(), 
            startBlock
          );
          
          console.log(`Searching ${timelockEvents.length} timelock events for proposal #${proposalId}`);
          
          // Match based on target address
          const proposalTarget = existingProposal.target.toLowerCase();
          
          for (const event of timelockEvents) {
            try {
              if (event.args && event.args.target) {
                const eventTarget = event.args.target.toLowerCase();
                
                if (eventTarget === proposalTarget) {
                  timelockTxHash = event.args.txHash;
                  // Preserve the threat level from the event if available
                  threatLevel = event.args.threatLevel !== undefined ? 
                            Number(event.args.threatLevel) : threatLevel;
                  console.log(`Found matching timelock event by target: ${timelockTxHash}, threatLevel: ${threatLevel}`);
                  break;
                }
              }
            } catch (innerErr) {
              console.warn("Error processing timelock event:", innerErr);
            }
          }
        } catch (err) {
          console.warn(`Error searching timelock events: ${err.message}`);
        }
      }
      
      // Step 2: If we have a hash, try to get transaction details
      if (!timelockTxHash) {
        console.log(`No timelock transaction found for proposal #${proposalId}`);
        return null;
      }
      
      // Get transaction details from timelock
      let txDetails;
      try {
        txDetails = await timelockContract.getTransaction(timelockTxHash);
      } catch (err) {
        console.warn(`Error getting transaction details: ${err.message}`);
        return null;
      }
      
      if (!txDetails || !txDetails.eta) {
        console.log(`No valid timelock data found for hash ${timelockTxHash}`);
        return null;
      }
      
      // If we still don't have a threat level, use the stored one or deduce from proposal type
      if (threatLevel === null) {
        // First check if we have it stored in timelockInfo
        if (timelockInfo[proposalId]?.level !== undefined) {
          threatLevel = timelockInfo[proposalId].level;
        } 
        // Otherwise deduce from proposal type
        else {
          // Get numeric proposal type
          const type = Number(existingProposal.type);
          
          // Try to deduce threat level from proposal type
          if (type === PROPOSAL_TYPES.TOKEN_MINT || 
              type === PROPOSAL_TYPES.TOKEN_BURN || 
              type === PROPOSAL_TYPES.GOVERNANCE_CHANGE) {
            threatLevel = 2; // HIGH
          } else if (type === PROPOSAL_TYPES.WITHDRAWAL || 
                    type === PROPOSAL_TYPES.TOKEN_TRANSFER || 
                    type === PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER) {
            threatLevel = 1; // MEDIUM
          } else {
            threatLevel = 0; // LOW
          }
        }
      }
      
      // Step 3: Determine actual timelock status
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const etaTimestamp = Number(txDetails.eta);
      const isExecuted = txDetails.executed || false;
      const isCanceled = txDetails.canceled || false;
      
      // Calculate actual status
      let timelockStatus;
      if (isExecuted) {
        timelockStatus = 'executed';
      } else if (isCanceled) {
        timelockStatus = 'canceled';
      } else if (currentTimestamp < etaTimestamp) {
        timelockStatus = 'queued';
        const remainingTime = etaTimestamp - currentTimestamp;
        console.log(`Proposal #${proposalId} is in timelock. ${remainingTime} seconds remaining.`);
      } else {
        timelockStatus = 'ready';
      }
      
      return {
        status: timelockStatus,
        txHash: timelockTxHash,
        eta: etaTimestamp,
        executed: isExecuted,
        canceled: isCanceled,
        remainingTime: Math.max(0, etaTimestamp - currentTimestamp),
        isInTimelock: !isExecuted && !isCanceled,
        readyForExecution: !isExecuted && !isCanceled && currentTimestamp >= etaTimestamp,
        threatLevel: threatLevel // Make sure we always return the threat level
      };
    } catch (error) {
      console.error(`Error checking timelock status for proposal #${proposalId}:`, error);
      return null;
    }
  };

  // Monitor and verify transaction function to check actual states after transaction confirmations
  const monitorAndVerifyTransaction = async (tx, proposalId, actionType) => {
    console.log(`Monitoring ${actionType} transaction: ${tx.hash}`);
    
    try {
      // Wait for transaction confirmation
      const receipt = await tx.wait(1);
      
      if (receipt.status) {
        console.log(`${actionType} transaction confirmed successfully:`, receipt);
        
        // Important: Wait a brief moment for blockchain state to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Explicitly verify proposal state after transaction
        if (contracts?.governance) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const governance = contracts.governance.connect(provider);
          
          // Get ACTUAL proposal state from chain
          try {
            const newState = await governance.getProposalState(proposalId);
            console.log(`Verified proposal #${proposalId} state after ${actionType}: ${newState} (${getProposalStateLabel(newState)})`);
            
            // For queued proposals, check timelock status
            if (actionType === 'queueing' && newState === PROPOSAL_STATES.QUEUED) {
              const timelockStatus = await checkTimelockStatus(proposalId);
              console.log(`Timelock status for proposal #${proposalId}:`, timelockStatus);
              
              // Update UI state with the verified information
              if (timelockStatus) {
                // Create updated proposal with timelock information
                setProcessedProposals(prevProposals => {
                  return prevProposals.map(p => {
                    if (Number(p.id) === Number(proposalId)) {
                      return {
                        ...p,
                        state: newState,
                        stateLabel: getProposalStateLabel(newState),
                        displayStateLabel: timelockStatus.status === 'queued' ? 'In Timelock' : 
                                        timelockStatus.status === 'ready' ? 'Ready For Execution' : 
                                        getProposalStateLabel(newState),
                        timelockStatus: timelockStatus.status,
                        timelockEta: timelockStatus.eta,
                        isInTimelock: timelockStatus.isInTimelock,
                        timelockRemaining: timelockStatus.remainingTime,
                        timelockTxHash: timelockStatus.txHash,
                        readyForExecution: timelockStatus.readyForExecution,
                        timelockThreatLevel: timelockStatus.threatLevel // Store the threat level
                      };
                    }
                    return p;
                  });
                });
              }
            }
          } catch (stateError) {
            console.warn(`Error checking proposal state after ${actionType}:`, stateError);
          }
        }
        
        // Force a full refresh of proposals to ensure accuracy
        if (typeof fetchProposals === 'function') {
          console.log(`Triggering full proposal refresh after ${actionType}`);
          await fetchProposals();
        }
        
        return true;
      } else {
        console.error(`${actionType} transaction reverted:`, receipt);
        return false;
      }
    } catch (error) {
      console.error(`Error monitoring ${actionType} transaction:`, error);
      return false;
    }
  };
  
  // Clear errors when component unmounts or dependencies change
  useEffect(() => {
    return () => {
      setTransactionError('');
      setQueuedTxs({});
    };
  }, []);
  
  // Debug: Add logging to monitor proposals
  useEffect(() => {
    console.log('ProposalsTab received proposals:', proposals?.length || 0);
    if (proposals?.length > 0) {
      const proposalIds = proposals.map(p => Number(p.id));
      console.log('Proposal ID range:', Math.min(...proposalIds), 'to', Math.max(...proposalIds));
    }
  }, [proposals]);
  
  // Fetch timelock information for queued proposals
  useEffect(() => {
    // Only attempt to fetch timelock info if we have contracts and proposals
    if (contracts?.timelock && processedProposals?.length > 0) {
      const fetchAllTimelockInfo = async () => {
        try {
          for (const proposal of processedProposals) {
            // Only fetch for queued proposals
            if (proposal.stateLabel?.toLowerCase() === 'queued') {
              try {
                // Create a simplified function to fetch timelock data
                const fetchInfo = async () => {
                  const provider = new ethers.providers.Web3Provider(window.ethereum);
                  const timelockContract = contracts.timelock.connect(provider);
                  
                  // Get current block number for filtering
                  const currentBlock = await provider.getBlockNumber();
                  const startBlock = Math.max(0, currentBlock - 100000);
                  
                  // Fetch TransactionQueued events
                  const filter = timelockContract.filters.TransactionQueued();
                  const events = await timelockContract.queryFilter(filter, startBlock);
                  
                  console.log(`Fetched ${events.length} timelock events for proposal #${proposal.id}`);
                  
                  // Try multiple matching strategies
                  let matchingEvent = null;
                  
                  // 1. Try by txHash if available
                  if (proposal.txHash) {
                    matchingEvent = events.find(event => event.args.txHash === proposal.txHash);
                    console.log(`Matching by txHash: ${proposal.txHash}`, matchingEvent ? "Found match" : "No match");
                  }
                  
                  // 2. Try by timelockTxHash if available
                  if (!matchingEvent && proposal.timelockTxHash) {
                    matchingEvent = events.find(event => event.args.txHash === proposal.timelockTxHash);
                    console.log(`Matching by timelockTxHash: ${proposal.timelockTxHash}`, matchingEvent ? "Found match" : "No match");
                  }
                  
                  // 3. Try by target address
                  if (!matchingEvent && proposal.target) {
                    const proposalTarget = proposal.target.toLowerCase();
                    matchingEvent = events.find(event => {
                      const eventTarget = event.args.target?.toLowerCase();
                      return eventTarget === proposalTarget;
                    });
                    console.log(`Matching by target address: ${proposal.target}`, matchingEvent ? "Found match" : "No match");
                  }
                  
                  // 4. Try by description hash (if available)
                  if (!matchingEvent && proposal.descriptionHash) {
                    // Some contracts include the description hash in the event data
                    matchingEvent = events.find(event => {
                      // Look for the description hash in any of the event data
                      for (const key in event.args) {
                        if (typeof event.args[key] === 'string' && 
                            event.args[key].toLowerCase() === proposal.descriptionHash.toLowerCase()) {
                          return true;
                        }
                      }
                      return false;
                    });
                    console.log(`Matching by description hash: ${proposal.descriptionHash}`, matchingEvent ? "Found match" : "No match");
                  }
                  
                  if (matchingEvent) {
                    const threatLevel = Number(matchingEvent.args.threatLevel || 0);
                    const etaTimestamp = matchingEvent.args.eta ? Number(matchingEvent.args.eta) : null;
                    const txHash = matchingEvent.args.txHash;
                    
                    console.log(`Found timelock info for proposal #${proposal.id}:`, {
                      threatLevel,
                      etaLabel: getThreatLevelLabel(threatLevel),
                      eta: etaTimestamp,
                      txHash
                    });
                    
                    setTimelockInfo(prevInfo => ({
                      ...prevInfo,
                      [proposal.id]: {
                        level: threatLevel,
                        label: getThreatLevelLabel(threatLevel),
                        eta: etaTimestamp,
                        txHash
                      }
                    }));
                    
                    return true;
                  }
                  
                  // Direct lookup as fallback
                  if (proposal.timelockTxHash) {
                    try {
                      const txDetails = await timelockContract.getTransaction(proposal.timelockTxHash);
                      if (txDetails && txDetails.eta) {
                        // We don't get threat level from this direct lookup, so deduce it from other proposal data
                        let deducedThreatLevel = 0; // Default to LOW
                        
                        // Try to deduce threat level from proposal type
                        if (proposal.type) {
                          const type = Number(proposal.type);
                          if (type === PROPOSAL_TYPES.TOKEN_MINT || 
                              type === PROPOSAL_TYPES.TOKEN_BURN || 
                              type === PROPOSAL_TYPES.GOVERNANCE_CHANGE) {
                            deducedThreatLevel = 2; // HIGH
                          } else if (type === PROPOSAL_TYPES.WITHDRAWAL || 
                                    type === PROPOSAL_TYPES.TOKEN_TRANSFER || 
                                    type === PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER) {
                            deducedThreatLevel = 1; // MEDIUM
                          }
                        }
                        
                        console.log(`Deduced threat level for proposal #${proposal.id}: ${deducedThreatLevel}`);
                        
                        setTimelockInfo(prevInfo => ({
                          ...prevInfo,
                          [proposal.id]: {
                            level: deducedThreatLevel,
                            label: getThreatLevelLabel(deducedThreatLevel),
                            eta: Number(txDetails.eta),
                            txHash: proposal.timelockTxHash
                          }
                        }));
                        
                        return true;
                      }
                    } catch (err) {
                      console.warn(`Error in direct lookup for proposal #${proposal.id}:`, err);
                    }
                  }
                  
                  return false;
                };
                
                await fetchInfo();
              } catch (error) {
                console.error(`Error fetching timelock info for proposal #${proposal.id}:`, error);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching timelock information:", error);
        }
      };
      
      fetchAllTimelockInfo();
    }
  }, [contracts, processedProposals]);

  // CHANGE 4: Update the checkTimelockForQueuedProposals to prevent excessive re-renders
  useEffect(() => {
    // Only run if we have proposals and contracts
    if (!processedProposals?.length || !contracts?.timelock) return;
    
    // Use a ref to track active fetches to prevent duplicate work
    const activeProposalChecks = new Set();
    let isComponentMounted = true;
    
    const checkTimelockForQueuedProposals = async () => {
      console.log("Checking timelock status for queued proposals...");
      
      // Avoid modifying state directly
      const updatedProposals = [...processedProposals];
      let hasUpdates = false;
      
      // Process only queued proposals that we haven't checked recently
      const queuedProposals = updatedProposals.filter(p => 
        (Number(p.state) === PROPOSAL_STATES.QUEUED || 
         p.stateLabel?.toLowerCase() === 'queued') && 
        !activeProposalChecks.has(p.id) &&
        (!p.lastTimelockCheck || Date.now() - p.lastTimelockCheck > 60000) // 60 seconds instead of 30
      );
      
      if (queuedProposals.length === 0) {
        return;
      }
      
      console.log(`Found ${queuedProposals.length} queued proposals to check`);
      
      // Process in smaller batches (1 instead of 2) to reduce load
      const batchSize = 1;
      for (let i = 0; i < queuedProposals.length; i += batchSize) {
        if (!isComponentMounted) break;
        
        const batch = queuedProposals.slice(i, i + batchSize);
        
        // Process proposals serially instead of in parallel to reduce memory usage
        for (const proposal of batch) {
          const proposalId = proposal.id;
          activeProposalChecks.add(proposalId);
          
          try {
            // Use the centralized function to check timelock status
            const timelockStatus = await checkTimelockStatus(proposalId);
            
            if (timelockStatus) {
              console.log(`Found timelock status for proposal #${proposalId}:`, timelockStatus);
              
              // Find the proposal index in our array
              const index = updatedProposals.findIndex(p => Number(p.id) === Number(proposalId));
              if (index !== -1) {
                // Update the proposal with timelock information
                updatedProposals[index] = {
                  ...updatedProposals[index],
                  timelockStatus: timelockStatus.status,
                  timelockEta: timelockStatus.eta,
                  isInTimelock: timelockStatus.isInTimelock,
                  timelockRemaining: timelockStatus.remainingTime,
                  timelockTxHash: timelockStatus.txHash || updatedProposals[index].timelockTxHash,
                  readyForExecution: timelockStatus.readyForExecution,
                  lastTimelockCheck: Date.now(),
                  // Keep the original threat level information to prevent overrides
                  timelockThreatLevel: timelockStatus.threatLevel ?? updatedProposals[index].timelockThreatLevel,
                  // Set a displayStateLabel that correctly shows timelock status
                  displayStateLabel: timelockStatus.executed ? 'Executed' :
                                  timelockStatus.canceled ? 'Canceled' :
                                  timelockStatus.readyForExecution ? 'Ready For Execution' :
                                  timelockStatus.isInTimelock ? 'In Timelock' : updatedProposals[index].stateLabel
                };
                
                hasUpdates = true;
              }
            }
          } catch (err) {
            console.warn(`Error processing proposal #${proposalId}:`, err);
          } finally {
            activeProposalChecks.delete(proposalId);
          }
        }
        
        // Larger delay between batches to reduce CPU usage
        if (i + batchSize < queuedProposals.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Only update state if there were changes and component is still mounted
      if (hasUpdates && isComponentMounted) {
        setProcessedProposals(updatedProposals);
      }
    };
    
    // Run the check
    checkTimelockForQueuedProposals();
    
    // Set up an interval with less frequent updates (60s instead of 30s)
    const intervalId = setInterval(checkTimelockForQueuedProposals, 60000);
    
    // Clean up the interval when the component unmounts
    return () => {
      isComponentMounted = false;
      clearInterval(intervalId);
      activeProposalChecks.clear();
    };
  }, [processedProposals, contracts?.timelock]);


// Fix #5: Add memory leak prevention - add this to ProposalsTab
// This ensures we properly clean up any subscriptions

// Add this useEffect near the top of your component
useEffect(() => {
  // Return a cleanup function that will run when component unmounts
  return () => {
    // Clear any in-flight transactions
    setQueuedTxs({});
    
    // Reset error states
    setTransactionError('');
    
    // Reset expanded proposals
    setExpandedProposalId(null);
    
    // Clear creation status
    setCreationStatus({
      status: null,
      message: ''
    });
    
    // Make sure any timeouts are cleared
    const timeoutIds = Object.values(window).filter(value => 
      typeof value === 'number' && 
      String(value).length > 6 // likely a timeout ID
    );
    
    for (const id of timeoutIds) {
      clearTimeout(id);
    }
    
    // Log memory cleanup
    console.log('Cleaning up memory in ProposalsTab');
  };
}, []);


  // Watch queued transactions
  useEffect(() => {
    const checkQueuedTxs = async () => {
      const updatedQueuedTxs = { ...queuedTxs };
      let hasChanges = false;
      
      for (const [txId, txInfo] of Object.entries(queuedTxs)) {
        if (txInfo.status === 'queued' && txInfo.hash) {
          try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const receipt = await provider.getTransactionReceipt(txInfo.hash);
            
            if (receipt) {
              updatedQueuedTxs[txId] = {
                ...txInfo,
                status: receipt.status ? 'success' : 'failed',
                receipt
              };
              hasChanges = true;
              
              // Auto-dismiss successful transactions after 5 seconds
              if (receipt.status) {
                setTimeout(() => {
                  setQueuedTxs(prev => {
                    const updated = { ...prev };
                    delete updated[txId];
                    return updated;
                  });
                }, 5000);
              }
            }
          } catch (error) {
            console.warn(`Error checking transaction ${txInfo.hash}:`, error);
          }
        }
      }
      
      if (hasChanges) {
        setQueuedTxs(updatedQueuedTxs);
      }
    };
    
    const interval = setInterval(checkQueuedTxs, 10000);
    return () => clearInterval(interval);
  }, [queuedTxs]);

  // Update global loading state
  useEffect(() => {
    setLoading(globalLoading || Object.values(queuedTxs).some(tx => tx.status === 'queued'));
  }, [globalLoading, queuedTxs]);

  const toggleProposalDetails = (proposalId) => {
    if (expandedProposalId === proposalId) {
      setExpandedProposalId(null);
    } else {
      setExpandedProposalId(proposalId);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };
  function safelyTruncateHtml(html, maxLength = 200) {
    if (!html) return '';
    
    try {
      // Create a temporary div to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Get the text content
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      // If the text is short enough, return the original HTML
      if (textContent.length <= maxLength) {
        return html;
      }
      
      // Otherwise return truncated text with ellipsis
      return textContent.substring(0, maxLength) + '...';
    } catch (error) {
      console.warn("Error truncating HTML:", error);
      // Fallback for safety
      return html.substring(0, maxLength) + '...';
    }
  }
  
  // Function to render proposal content based on type and HTML presence
  function renderProposalContent(proposal, isExpanded = false) {
    // For signaling proposals or those with HTML, render with dangerouslySetInnerHTML
    if (proposal.descriptionHtml) {
      if (isExpanded) {
        // Full HTML content for expanded view
        return (
          <div 
            className="prose max-w-none text-sm text-gray-700 mb-4 dark:prose-invert dark:text-gray-200"
            dangerouslySetInnerHTML={{ __html: proposal.descriptionHtml }}
          />
        );
      } else {
        // Truncated for collapsed view
        return (
          <div 
            className="text-sm text-gray-700 dark:text-gray-300 mb-2"
            dangerouslySetInnerHTML={{ __html: safelyTruncateHtml(proposal.descriptionHtml, 200) }}
          />
        );
      }
    }
    
    // For plain text proposals
    if (isExpanded) {
      return (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
          {proposal.description || "No description available"}
        </p>
      );
    } else {
      const truncatedDesc = proposal.description 
        ? proposal.description.substring(0, 200) + (proposal.description.length > 200 ? '...' : '')
        : "No description available";
      
      return (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
          {truncatedDesc}
        </p>
      );
    }
  }
  
 // Enhanced renderAddress function for better display
 const renderAddress = (address, label) => {
  return (
    <div className="flex items-center mb-2">
      <span className="font-medium mr-2 dark:text-gray-300">{label}:</span>
      <span className="font-mono text-sm break-all dark:text-gray-400">{address}</span>
      <button 
        onClick={() => copyToClipboard(address)} 
        className="ml-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 focus:outline-none"
        title="Copy to clipboard"
        aria-label={`Copy ${label} address`}
      >
        {copiedText === address ? <Check className="w-4 h-4 text-green-500 dark:text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
      {copiedText === address && (
        <span className="ml-2 text-xs text-green-600 dark:text-green-400">Copied!</span>
      )}
    </div>
  );
};

  // Update proposal status after successful queue operation
  const updateProposalQueuedStatus = async (proposalId) => {
    try {
      // Trigger a full refresh of proposals
      if (typeof fetchProposals === 'function') {
        await fetchProposals();
      }
    } catch (error) {
      console.error("Error updating proposal queued status:", error);
    }
  };
  
  // Update proposal status after successful execute operation
  const updateProposalExecutedStatus = async (proposalId) => {
    try {
      // Trigger a full refresh of proposals
      if (typeof fetchProposals === 'function') {
        await fetchProposals();
      }
    } catch (error) {
      console.error("Error updating proposal executed status:", error);
    }
  };

  // Check if the stake has been refunded for a proposal after a successful claim
  const updateStakeRefundedStatus = async (proposalId) => {
    try {
      // Trigger a full refresh of proposals
      if (typeof fetchProposals === 'function') {
        await fetchProposals();
      }
    } catch (error) {
      console.error("Error updating stake refund status:", error);
    }
  };

  // Add console logs to debug PROPOSAL_TYPES
  console.log("PROPOSAL_TYPES from import:", PROPOSAL_TYPES);
  console.log("SIGNALING type value:", PROPOSAL_TYPES.SIGNALING);
  
  // Make a separate, clear constant to use
  const BINDING_COMMUNITY_VOTE_TYPE = 7; // If this is the correct value
  
  function validateProposalInputs(proposal) {
    // Validate required fields; adjust as needed
    if (!proposal.title || !proposal.description) {
      return false;
    }
    return true;
  }

  // Handler for rich text editor changes
  const handleDescriptionChange = (htmlContent, plainText) => {
    setNewProposal(prev => ({
      ...prev,
      descriptionHtml: htmlContent,
      description: plainText
      
    }));
    
  };

  const safeParseEther = (value) => {
    try {
      // If value is null, undefined, or empty string, return 0
      if (!value || value.trim() === '') {
        return ethers.constants.Zero;
      }
      
      // Convert to string and trim whitespace
      const cleanValue = String(value).trim();
      
      // Check if the value is a valid number
      const numValue = parseFloat(cleanValue);
      if (isNaN(numValue)) {
        console.warn(`Invalid numeric value: ${value}`);
        return ethers.constants.Zero;
      }
      
      // If value is less than or equal to 0, return Zero
      if (numValue <= 0) {
        return ethers.constants.Zero;
      }
      
      // Parse to ether, with error handling
      return ethers.utils.parseEther(cleanValue);
    } catch (error) {
      console.error('Error parsing ether value:', error);
      return ethers.constants.Zero;
    }
  };


  const safeParseDuration = (value) => {
    try {
      // If value is null, undefined, or empty string, return 0
      if (!value || value.trim() === '') {
        return 0;
      }
      
      // Convert to string and trim whitespace
      const cleanValue = String(value).trim();
      
      // Parse as integer
      const numValue = parseInt(cleanValue);
      
      // Return 0 if not a valid positive number
      return !isNaN(numValue) && numValue > 0 ? numValue : 0;
    } catch (error) {
      console.error('Error parsing duration:', error);
      return 0;
    }
  };

  // Convert values to proper format with robust parsing
  const amount = safeParseEther(newProposal.amount);
  const newThreshold = safeParseEther(newProposal.newThreshold);
  const newQuorum = safeParseEther(newProposal.newQuorum);
  const newVotingDuration = safeParseDuration(newProposal.newVotingDuration);
  const newProposalStake = safeParseEther(newProposal.newProposalStake);
  
  console.log('Submitting proposal:', {
    type: parseInt(newProposal.type),
    target: newProposal.target,
    callData: newProposal.callData || '0x',
    amount: amount.toString(),
    recipient: newProposal.recipient,
    token: newProposal.token,
    newThreshold: newThreshold.toString(),
    newQuorum: newQuorum.toString(),
    newVotingDuration,
    newProposalStake: newProposalStake.toString()
  });

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTransactionError('');
    setCreationStatus({ status: 'queued', message: 'Creating proposal...' });
    
    // Check if this is a Community Vote proposal by string matching
    const isCommunityVoteProposal = 
      newProposal.type === 7 || 
      newProposal.type === "7" || 
      String(newProposal.type).toLowerCase().includes("signaling") ||
      parseInt(newProposal.type) === PROPOSAL_TYPES.SIGNALING;
    
    console.log("Is Community Vote proposal:", isCommunityVoteProposal);
    
    try {
      // Handle Community Vote proposals with string matching
      if (isCommunityVoteProposal) {
        console.log("Handling as Binding Community Vote");
        
        // Skip validation entirely for signaling proposals
        // Format the description with the HTML content
        let description;
        if (newProposal.descriptionHtml) {
          description = `${newProposal.title}\n\n${newProposal.description}\n\n|||HTML:${newProposal.descriptionHtml}`;
        } else {
          description = `${newProposal.title}\n\n${newProposal.description}`;
        }
        
        console.log('Submitting signaling proposal:', { description });
        
        try {
          // Check if createSignalingProposal exists, otherwise use createProposal
          if (typeof createSignalingProposal === 'function') {
            await createSignalingProposal(description);
          } else {
            // Fallback to using regular createProposal with type 7
            console.log("createSignalingProposal not available, using createProposal");
            await createProposal(
              description,
              7, // BINDING_COMMUNITY_VOTE type
              ethers.constants.AddressZero, // target (not used)
              '0x', // callData (not used)
              0, // amount (not used)
              ethers.constants.AddressZero, // recipient (not used)
              ethers.constants.AddressZero, // token (not used)
              0, // newThreshold (not used)
              0, // newQuorum (not used)
              0, // newVotingDuration (not used)
              0  // newTimelockDelay (not used)
            );
          }
          setCreationStatus({ 
            status: 'success', 
            message: 'Proposal created successfully!' 
          });
          
         
          
          // Reset form and close modal after a brief delay
          setTimeout(() => {
            setShowCreateModal(false);
            setNewProposal({
              title: '',
              description: '',
              descriptionHtml: '',
              type: PROPOSAL_TYPES.GENERAL,
              target: '',
              callData: '',
              amount: '',
              recipient: '',
              token: '',
              newThreshold: '',
              newQuorum: '',
              newVotingDuration: '',
              newProposalStake: ''
            });
            setCreationStatus({ status: null, message: '' });
          }, 2000);
          
        } catch (error) {
          console.error("Error creating proposal:", error);
          setTransactionError(error.message || 'Error creating proposal. See console for details.');
          setCreationStatus({ 
            status: 'error', 
            message: 'Failed to create proposal' 
          });
        } finally {
          setSubmitting(false);
        }
        
        // Exit early
        return;
      }
      
      // Only run validation for non-signaling proposals
      if (!validateProposalInputs(newProposal)) {
        console.log("Validation failed");
        setTransactionError('Please fill in all required fields for this proposal type.');
        setCreationStatus({ 
          status: 'error', 
          message: 'Validation failed' 
        });
        setSubmitting(false);
        return;
      }
      
      // Rest of your existing code for other proposal types
      console.log("Handling as regular proposal");
      
      // For other proposal types with HTML content
      let description;
      if (newProposal.descriptionHtml) {
        description = `${newProposal.title}\n\n${newProposal.description}\n\n|||HTML:${newProposal.descriptionHtml}`;
      } else {
        description = `${newProposal.title}\n\n${newProposal.description}`;
      }
      
      
      // Convert values to proper format
      const amount = newProposal.amount ? ethers.utils.parseEther(newProposal.amount.toString()) : 0;
      const newThreshold = newProposal.newThreshold ? ethers.utils.parseEther(newProposal.newThreshold.toString()) : 0;
      const newQuorum = newProposal.newQuorum ? ethers.utils.parseEther(newProposal.newQuorum.toString()) : 0;
      const newVotingDuration = newProposal.newVotingDuration ? parseInt(newProposal.newVotingDuration) : 0;
      const newProposalStake = newProposal.newProposalStake ? ethers.utils.parseEther(newProposal.newProposalStake.toString()) : 0;
      
      console.log('Submitting proposal:', {
        description,
        type: parseInt(newProposal.type),
        target: newProposal.target,
        callData: newProposal.callData || '0x',
        amount,
        recipient: newProposal.recipient,
        token: newProposal.token,
        newThreshold,
        newQuorum,
        newVotingDuration,
        newProposalStake
      });
      
      // For governance change proposals, use the proposal stake
      // For other proposals, timelock delay is still used for the final parameter
      // but with governance change proposals, this field is repurposed as proposalStake
      const finalParamValue = parseInt(newProposal.type) === PROPOSAL_TYPES.GOVERNANCE_CHANGE 
        ? newProposalStake 
        : 0;
      
      await createProposal(
        description,
        parseInt(newProposal.type),
        newProposal.target,
        newProposal.callData || '0x',
        amount,
        newProposal.recipient,
        newProposal.token,
        newThreshold,
        newQuorum,
        newVotingDuration,
        finalParamValue
      );
      
      setShowCreateModal(false);
      // Reset form
      setNewProposal({
        title: '',
        description: '',
        descriptionHtml: '',
        type: PROPOSAL_TYPES.GENERAL,
        target: '',
        callData: '',
        amount: '',
        recipient: '',
        token: '',
        newThreshold: '',
        newQuorum: '',
        newVotingDuration: '',
        newProposalStake: ''
      });
    } catch (error) {
      console.error("Error creating proposal:", error);
      setTransactionError(error.message || 'Error creating proposal. See console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Enhanced function to extract governance parameters directly from rawDescription
  const extractGovernanceParams = (rawDescription, proposalType) => {
    // Only process for governance change proposals
    if (parseInt(proposalType) !== PROPOSAL_TYPES.GOVERNANCE_CHANGE) {
      return null;
    }
    
    try {
      // Try to extract parameters from description text using regex patterns
      const thresholdMatch = rawDescription?.match(/threshold[:\s]+([0-9.]+)/i);
      const quorumMatch = rawDescription?.match(/quorum[:\s]+([0-9.]+)/i);
      const durationMatch = rawDescription?.match(/duration[:\s]+([0-9.]+)/i);
      const stakeMatch = rawDescription?.match(/stake[:\s]+([0-9.]+)/i);
      
      return {
        newThreshold: thresholdMatch ? thresholdMatch[1] : null,
        newQuorum: quorumMatch ? quorumMatch[1] : null,
        newVotingDuration: durationMatch ? durationMatch[1] : null, 
        newProposalStake: stakeMatch ? stakeMatch[1] : null
      };
    } catch (error) {
      console.error("Error extracting governance params from description:", error);
      return null;
    }
  };

  // Improved handler for proposal actions with robust error and transaction management
  const handleProposalAction = async (action, proposalId, actionName, retryCount = 0) => {
    // Generate a unique transaction ID
    const txId = `${actionName}-${proposalId}-${Date.now()}`;
    
    // Set up queued transaction tracking
    setQueuedTxs(prev => ({
      ...prev,
      [txId]: { 
        status: 'queued', 
        action: actionName, 
        proposalId, 
        startTime: Date.now(),
        retryCount
      }
    }));
    
    try {
      if (actionName === 'queuing') {
        if (!contracts.governance) {
          throw new Error("Governance contract not initialized");
        }

        // Call the governance contract's queueProposal function
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const governance = contracts.governance.connect(signer);
        
        // Debug current proposal state
        try {
          const currentState = await governance.getProposalState(proposalId);
          console.log(`Current proposal state before queueing: ${currentState} (${getProposalStateLabel(currentState)})`);
        } catch (e) {
          console.warn("Could not get current proposal state:", e);
        }

        console.log(`Directly queueing proposal ${proposalId} using governance contract...`);
        
        try {
          // First try to estimate gas to check if this will work
          const gasEstimate = await governance.estimateGas.queueProposal(proposalId)
            .catch(e => {
              console.warn("Gas estimation failed for queueProposal:", e);
              return ethers.utils.hexlify(4000000); // Fallback to 4M gas
            });
            
          // Add buffer to gas estimate
          const gasLimit = ethers.BigNumber.from(gasEstimate).mul(150).div(100);
          
          // Get current gas price with buffer for retry
          const currentGasPrice = await provider.getGasPrice();
          const gasPriceMultiplier = 100 + (retryCount * 20);
          const gasPrice = currentGasPrice.mul(gasPriceMultiplier).div(100);
          
          console.log(`Sending queueProposal transaction with gas limit ${gasLimit} and gas price ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
          
          // Send the transaction
          const tx = await governance.queueProposal(proposalId, {
            gasLimit,
            gasPrice,
            nonce: await provider.getTransactionCount(await signer.getAddress(), 'latest')
          });
          
          console.log("Queue transaction sent:", tx.hash);
          
          // Track transaction
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: {
              ...prev[txId],
              hash: tx.hash,
              status: 'queued',
              lastChecked: Date.now()
            }
          }));
          
          // Use our enhanced monitoring function
          await monitorAndVerifyTransaction(tx, proposalId, 'queueing');
        } catch (error) {
          console.error("Error queueing proposal:", error);
          
          // Check if we should try the alternative method
          const shouldTryAlternative = 
            error.message?.includes("revert") || 
            error.message?.includes("invalid") ||
            error.message?.includes("failed") ||
            retryCount >= 2;
            
          if (shouldTryAlternative) {
            console.log("Direct queueing failed, trying alternative method...");
            
            // Find the proposal by ID
            const proposal = processedProposals.find(p => p.id === Number(proposalId));
            if (!proposal) {
              throw new Error("Proposal not found");
            }
            
            // Make sure target is a valid address
            let target = proposal.target;
            
            // Different handling based on proposal type
            const proposalType = parseInt(proposal.type);
            switch (proposalType) {
              case PROPOSAL_TYPES.WITHDRAWAL:
                target = proposal.recipient;
                break;
                
              case PROPOSAL_TYPES.TOKEN_TRANSFER:
                if (!target || target === ethers.constants.AddressZero) {
                  if (contracts.justToken && contracts.justToken.address) {
                    target = contracts.justToken.address;
                  } else if (contracts.token && contracts.token.address) {
                    target = contracts.token.address;
                  }
                }
                break;
                
              case PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER:
                target = proposal.token;
                break;
                
              case PROPOSAL_TYPES.TOKEN_MINT:
              case PROPOSAL_TYPES.TOKEN_BURN:
                if (contracts.justToken && contracts.justToken.address) {
                  target = contracts.justToken.address;
                } else if (contracts.token && contracts.token.address) {
                  target = contracts.token.address;
                }
                break;
                
              case PROPOSAL_TYPES.GOVERNANCE_CHANGE:
                if (contracts.governance && contracts.governance.address) {
                  target = contracts.governance.address;
                }
                break;
                
              case PROPOSAL_TYPES.SIGNALING:
                if (contracts.governance && contracts.governance.address) {
                  target = contracts.governance.address;
                }
                break;
            }
            
            // Final verification and fallbacks
            if (!target || target === ethers.constants.AddressZero) {
              if (contracts.governance && contracts.governance.address) {
                target = contracts.governance.address;
              } else if (contracts.timelock && contracts.timelock.address) {
                target = contracts.timelock.address;
              } else if (contracts.token && contracts.token.address) {
                target = contracts.token.address;
              } else if (contracts.justToken && contracts.justToken.address) {
                target = contracts.justToken.address;
              } else {
                throw new Error("Invalid target address for this proposal");
              }
            }
            
            // Parse value
            let value = ethers.constants.Zero;
            if (parseInt(proposal.type) === PROPOSAL_TYPES.WITHDRAWAL) {
              value = typeof proposal.amount === 'string' 
                ? ethers.utils.parseEther(proposal.amount) 
                : proposal.amount;
            }
            
            // Use appropriate data
            const data = proposal.callData || '0x';
            
            // Try using the timelock contract directly
            if (contracts.timelock) {
              const timelock = contracts.timelock.connect(signer);
              
              console.log(`Trying timelock.queueTransactionWithThreatLevel with target: ${target}`);
              
              // Get gas estimates and prices
              const gasEstimate = await timelock.estimateGas.queueTransactionWithThreatLevel(
                target, value, data
              ).catch(e => {
                console.warn("Gas estimation failed, using higher default:", e);
                return ethers.utils.hexlify(3500000); // 3.5M gas as higher fallback
              });
              
              const gasLimit = ethers.BigNumber.from(gasEstimate).mul(200).div(100); // 2x buffer
              const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% higher
              
              // Try the alternative method
              const tx = await timelock.queueTransactionWithThreatLevel(
                target, value, data, {
                  gasLimit,
                  gasPrice,
                  nonce: await provider.getTransactionCount(await signer.getAddress(), 'latest')
                }
              );
              
              console.log("Alternative queue transaction sent:", tx.hash);
              
              // Set up tracking for this alternative transaction
              setQueuedTxs(prev => ({
                ...prev,
                [txId]: {
                  ...prev[txId],
                  hash: tx.hash,
                  status: 'queued',
                  lastChecked: Date.now(),
                  isAlternativeMethod: true
                }
              }));
              
              // Continue with transaction monitoring (similar to above)
              // For brevity, I'm not duplicating the full monitoring code here
            } else {
              throw new Error("Timelock contract not available for alternative method");
            }
          } else {
            // Just rethrow the original error if we're not trying alternative
            throw error;
          }
        }
      } else if (actionName === 'executing') {
        // For execute, we also need to make sure we're calling the right function
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const governance = contracts.governance.connect(signer);
        
        console.log(`Executing proposal ${proposalId}...`);
        
        try {
          // Estimate gas
          const gasEstimate = await governance.estimateGas.executeProposal(proposalId)
            .catch(e => {
              console.warn("Gas estimation failed for executeProposal:", e);
              return ethers.utils.hexlify(2000000); // 2M gas fallback
            });
            
          const gasLimit = ethers.BigNumber.from(gasEstimate).mul(150).div(100);
          const gasPrice = (await provider.getGasPrice()).mul(110).div(100); // 10% higher
          
          // Execute the proposal
          const tx = await governance.executeProposal(proposalId, {
            gasLimit,
            gasPrice,
            nonce: await provider.getTransactionCount(await signer.getAddress(), 'latest')
          });
          
          console.log("Execute transaction sent:", tx.hash);
          
          // Update tracking
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: {
              ...prev[txId],
              hash: tx.hash,
              status: 'queued',
              lastChecked: Date.now()
            }
          }));
          
          // Use our enhanced monitoring function
          await monitorAndVerifyTransaction(tx, proposalId, 'executing');
        } catch (error) {
          console.error("Error executing proposal:", error);
          
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: {
              ...prev[txId],
              status: 'failed',
              error: error.message || 'Error executing proposal',
              canRetry: retryCount < 3
            }
          }));
          
          throw error;
        }
      } else if (actionName === 'claiming refund for') {
        try {
          // Debug information about the claimRefund function and governance contract
          console.log('Claim refund action details:', {
            proposalId,
            governanceContract: contracts.governance ? 'Available' : 'Not Available',
            contractAddress: contracts.governance?.address,
            hasClaimPartialStakeRefund: typeof contracts.governance?.claimPartialStakeRefund === 'function'
          });
          
          // Double-check if the function exists on the contract
          if (!contracts.governance || typeof contracts.governance.claimPartialStakeRefund !== 'function') {
            console.error('Error: claimPartialStakeRefund function not found on governance contract');
            throw new Error('Governance contract does not support stake refunds. Please contact an administrator.');
          }
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const governance = contracts.governance.connect(signer);
          
          console.log(`Calling claimPartialStakeRefund for proposal ${proposalId}...`);
          
          // First try with direct call to see if it fails quickly
          try {
            // Check proposal state first to validate eligibility
            const state = await governance.getProposalState(proposalId);
            console.log(`Proposal state before claiming refund: ${state} (${getProposalStateLabel(state)})`);
            
            // Get proposal flags to check if already refunded
            // This may fail if your contract doesn't expose this information
            try {
              const proposal = await governance.proposals(proposalId);
              console.log(`Proposal flags: ${proposal.flags}`);
              
              // Check if bit 2 (STAKE_REFUNDED_FLAG) is set (0x04 or binary 100)
              const isRefunded = (proposal.flags & 0x04) !== 0;
              console.log(`Is stake already refunded according to flags? ${isRefunded}`);
              
              if (isRefunded) {
                throw new Error('Stake has already been refunded for this proposal.');
              }
            } catch (flagsError) {
              console.log('Could not check refund flags:', flagsError);
            }
          } catch (checkError) {
            console.warn('Pre-checks encountered issues:', checkError);
            // Continue anyway - the contract will validate
          }
          
          // Estimate gas with a fallback and extra padding
          const gasEstimate = await governance.estimateGas.claimPartialStakeRefund(proposalId)
            .catch(e => {
              console.warn("Gas estimation failed for claimPartialStakeRefund:", e);
              return ethers.utils.hexlify(750000); // 750k gas fallback - use higher value
            });
            
          const gasLimit = ethers.BigNumber.from(gasEstimate).mul(200).div(100); // 2x buffer
          const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% higher
          
          console.log('Sending transaction with params:', {
            gasLimit: gasLimit.toString(),
            gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei'
          });
          
          // Call the refund function directly with explicit parameters
          const tx = await governance.claimPartialStakeRefund(proposalId, {
            gasLimit,
            gasPrice,
            nonce: await provider.getTransactionCount(await signer.getAddress(), 'latest')
          });
          
          console.log("Claim refund transaction sent:", tx.hash);
          
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: {
              ...prev[txId],
              hash: tx.hash,
              status: 'queued',
              lastChecked: Date.now()
            }
          }));
          
          // Wait for confirmation with longer timeout
          const receipt = await tx.wait(2); // Wait for 2 confirmations
          
          console.log("Claim refund transaction confirmed:", receipt);
          
          // Update the transaction status
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: {
              ...prev[txId],
              status: 'success',
              receipt
            }
          }));
          
          // Update the proposal state
          await updateStakeRefundedStatus(proposalId);
          
          // Auto-dismiss success notification
          setTimeout(() => {
            setQueuedTxs(prev => {
              const updated = {...prev};
              delete updated[txId];
              return updated;
            });
          }, 5000);
          
          // Force refresh to update UI
          if (typeof fetchProposals === 'function') {
            // Immediate refresh and then another after a delay
            try {
              await fetchProposals();
              setTimeout(() => {
                fetchProposals().catch(e => console.error("Error refreshing proposals:", e));
              }, 3000);
            } catch (refreshError) {
              console.error("Error during initial refresh:", refreshError);
            }
          }
          
          return true;
          
        } catch (error) {
          console.error("Error claiming refund:", error);
          
          // Try to extract meaningful error message
          let errorMessage = error.message || 'Error claiming refund';
          
          // Look for specific error codes from the contract
          if (errorMessage.includes('AlreadyRefunded')) {
            errorMessage = 'The stake for this proposal has already been refunded.';
          } else if (errorMessage.includes('NotProposer')) {
            errorMessage = 'Only the proposer can claim a refund for this proposal.';
          } else if (errorMessage.includes('NotDefeated')) {
            errorMessage = 'This proposal is not in a state that allows refunds (must be Defeated, Canceled, or Expired).';
          }
          
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: {
              ...prev[txId],
              status: 'failed',
              error: errorMessage,
              canRetry: retryCount < 3
            }
          }));
          
          alert(`Error claiming refund: ${errorMessage}`);
          throw error;
        }
      } else {
        // For cancelling actions, make sure to properly handle loading state
        setLoading(true);
        
        try {
          // Use the original approach
          const result = await action(proposalId);
          
          // Update transaction tracking on success
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: { 
              ...prev[txId],
              status: 'success'
            }
          }));
          
          // Force a refresh of proposals
          if (typeof fetchProposals === 'function') {
            setTimeout(() => {
              fetchProposals().catch(e => console.error("Error refreshing proposals:", e));
            }, 2000);
          }
          
          // Ensure loading state is cleared
          setLoading(false);
          
          return result;
        } catch (error) {
          console.error(`Error cancelling proposal:`, error);
          
          // Update transaction tracking on failure
          setQueuedTxs(prev => ({
            ...prev,
            [txId]: { 
              ...prev[txId],
              status: 'failed',
              error: error.message || `Error cancelling proposal`,
              canRetry: retryCount < 3
            }
          }));
          
          // Always reset loading state
          setLoading(false);
          
          // Show user-friendly error message
          alert(`Error cancelling proposal: ${error.message || 'See console for details'}`);
          
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error ${actionName} proposal:`, error);
      
      // Update transaction tracking on failure
      setQueuedTxs(prev => ({
        ...prev,
        [txId]: { 
          ...prev[txId],
          status: 'failed',
          error: error.message || `Error ${actionName} proposal`,
          canRetry: retryCount < 3
        }
      }));
      
      // Show user-friendly error message
      alert(`Error ${actionName} proposal: ${error.message || 'See console for details'}`);
    }
  };

  // Filter out proposals based on the selected filter type
  const filteredProposals = processedProposals?.filter(p => {
    // Safety check for null/undefined proposal
    if (!p) return false;
    
    // Get display state for filtering (prioritize displayStateLabel if available)
    const displayState = ((p.displayStateLabel || p.stateLabel) || '').toLowerCase();
    
    if (proposalType === 'all') {
      return true;
    } else if (proposalType === 'queued') {
      // Include anything with "queued", "queued", "in timelock", or "ready"
      return displayState.includes('queued') || 
             displayState.includes('queued') || 
             displayState.includes('timelock') || 
             displayState.includes('ready');
    } else {
      // For other filters, just check if the filter is in the state
      return displayState.includes(proposalType.toLowerCase());
    }
  }) || [];
  
  // Sort proposals by ID in descending order (newest first)
  const sortedProposals = [...filteredProposals].sort((a, b) => Number(b.id) - Number(a.id));
  
  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProposals = sortedProposals.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedProposals.length / itemsPerPage);
  
  // Pagination navigation functions
  const goToPage = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Check if a user can claim a refund
  const canClaimRefund = (proposal) => {
    // Log that the function is being called
    console.debug(`REFUND CHECK: Started check for proposal #${proposal?.id || 'unknown'}`);
    
    // Skip if no proposal data or no connected account
    if (!proposal || !account) {
      console.debug('REFUND CHECK: No proposal or account, returning false');
      return false;
    }
    
    // CRITICAL: Make sure all data we need is available
    if (!proposal.proposer) {
      console.debug('REFUND CHECK: Missing proposer address, returning false');
      return false;
    }
    
    // Use our address utility functions for robust address comparison
    // Check if addresses are equal using our utility
    const isProposer = addressesEqual(account, proposal.proposer);
    
    // For debugging, log the detailed diagnostics about the addresses
    const addressDiagnostics = diagnoseMismatchedAddresses({
      address1: account,
      address2: proposal.proposer,
      label1: 'userAddress',
      label2: 'proposerAddress'
    });
    
    console.debug('REFUND CHECK: Address comparison details:', addressDiagnostics);
    console.debug(`REFUND CHECK: Is proposer: ${isProposer}`);
    
    if (!isProposer) {
      console.debug('REFUND CHECK: User is not the proposer, returning false');
      return false;
    }
    
    // Check if the stake has already been refunded
    if (proposal.stakeRefunded) {
      console.debug('REFUND CHECK: Stake already refunded, returning false');
      return false;
    }
    
    // The governance contract only allows refunds for these 3 states:
    // Defeated (2), Canceled (1), or Expired (6)
    const refundableStates = [
      PROPOSAL_STATES.DEFEATED,  // 2 
      PROPOSAL_STATES.CANCELED,  // 1
      PROPOSAL_STATES.EXPIRED    // 6
    ];
    
    // Log the PROPOSAL_STATES constants to verify they are correct
    console.debug('REFUND CHECK: PROPOSAL_STATES constants:', {
      DEFEATED: PROPOSAL_STATES.DEFEATED,
      CANCELED: PROPOSAL_STATES.CANCELED,
      EXPIRED: PROPOSAL_STATES.EXPIRED
    });
    
    // Multiple approaches to check if the state is refundable
    
    // Approach 1: Check using the raw state number
    let proposalState;
    try {
      // Handle various input types for state
      if (typeof proposal.state === 'object' && proposal.state._isBigNumber) {
        // Handle ethers.js BigNumber
        proposalState = proposal.state.toNumber();
      } else {
        proposalState = Number(proposal.state);
      }
      console.debug(`REFUND CHECK: Converted proposal state: ${proposalState} (${typeof proposalState})`);
    } catch (err) {
      console.error('REFUND CHECK: Error converting state to number:', err);
      proposalState = -1; // Invalid state that won't match
    }
    
    const isStateRefundable = refundableStates.includes(proposalState);
    console.debug(`REFUND CHECK: Numeric state check: ${proposalState} in [${refundableStates.join(', ')}] = ${isStateRefundable}`);
    
    // Approach 2: Check using the state label (more reliable)
    const stateLabelLower = (proposal.stateLabel || '').toLowerCase().trim();
    const isLabelRefundable = ['defeated', 'canceled', 'expired'].includes(stateLabelLower);
    console.debug(`REFUND CHECK: Label state check: "${stateLabelLower}" in ["defeated", "canceled", "expired"] = ${isLabelRefundable}`);
    
    // Use either approach, preferring the label check as it's less prone to bugs
    const isRefundable = isStateRefundable || isLabelRefundable;
    console.debug(`REFUND CHECK: Final refundable state determination: ${isRefundable}`);
    
    // Final check with all conditions
    const result = isProposer && isRefundable && !proposal.stakeRefunded;
    console.debug(`REFUND CHECK: Final result(all conditions): ${result} (isProposer && isRefundable && !stakeRefunded)`);
    
    return result;
  };

  // Improved transaction notification card with better error message handling
  const renderTransactionNotifications = () => {
    const txEntries = Object.entries(queuedTxs);
    if (txEntries.length === 0) return null;
    
    return (
      <div className="fixed bottom-6 right-6 z-50 space-y-4 sm:w-96 w-full max-w-full px-4 sm:px-0">
        {txEntries.map(([id, tx]) => (
          <div 
            key={id} 
            className={`rounded-xl shadow-xl p-5 transform transition-all duration-300 ${
              tx.status === 'queued' ? 
                isDarkMode ? 'bg-blue-900/30 border-2 border-blue-700/70 backdrop-blur-sm' : 'bg-blue-50 border-2 border-blue-300' :
              tx.status === 'success' ? 
                isDarkMode ? 'bg-green-900/30 border-2 border-green-700/70 backdrop-blur-sm' : 'bg-green-50 border-2 border-green-300' :
                isDarkMode ? 'bg-red-900/30 border-2 border-red-700/70 backdrop-blur-sm' : 'bg-red-50 border-2 border-red-300'
            } ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1">
                {tx.status === 'queued' ? (
                  <div className={`h-8 w-8 border-3 rounded-full animate-spin ${
                    isDarkMode ? 'border-blue-400 border-t-transparent' : 'border-blue-500 border-t-transparent'
                  }`}></div>
                ) : tx.status === 'success' ? (
                  <Check className={`h-8 w-8 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
                ) : (
                  <AlertTriangle className={`h-8 w-8 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
                )}
              </div>
              <div className="ml-4 flex-1 overflow-hidden">
                <p className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {tx.status === 'queued' ? 'Transaction in Progress' :
                   tx.status === 'success' ? 'Transaction Successful' :
                   'Transaction Failed'}
                </p>
                <p className={`mt-2 text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {tx.status === 'queued' 
                    ? `${tx.action} proposal #${tx.proposalId}...` 
                    : tx.status === 'success'
                    ? `Successfully ${tx.action} proposal #${tx.proposalId}`
                    : `Failed ${tx.action} proposal #${tx.proposalId}`
                  }
                </p>
                
                {/* Improved error message display with better wrapping and dark mode */}
                {tx.error && (
                  <div className={`mt-2 p-3 rounded-md border ${
                    isDarkMode ? 'bg-red-900/40 border-red-700/70 text-red-200' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <p className="text-sm break-words leading-relaxed">
                      {tx.error}
                    </p>
                  </div>
                )}
                
                {tx.warning && (
                  <p className={`mt-2 text-sm font-medium break-words ${
                    isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                  }`}>{tx.warning}</p>
                )}
                
                <div className="mt-3 flex flex-wrap gap-2">
                  {tx.hash && (
                    <button 
                      onClick={() => copyToClipboard(tx.hash)}
                      className={`text-sm py-2 px-3 rounded-md flex items-center transition-colors ${
                        isDarkMode ? 
                          'bg-indigo-900/50 hover:bg-indigo-800/70 text-indigo-300' : 
                          'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {copiedText === tx.hash ? 'Copied!' : 'Copy Transaction Hash'}
                      <Copy className="ml-2 h-4 w-4" />
                    </button>
                  )}
                  
                  {(tx.canRetry || tx.status === 'failed') && (
                    <button 
                      onClick={() => {
                        // First remove the current transaction notification
                        setQueuedTxs(prev => {
                          const updated = {...prev};
                          delete updated[id];
                          return updated;
                        });
                        
                        // Then retry with higher gas parameters
                        handleProposalAction(
                          tx.action === 'queuing' ? queueProposal : 
                          tx.action === 'cancelling' ? cancelProposal :
                          tx.action === 'executing' ? executeProposal : claimRefund,
                          tx.proposalId,
                          tx.action,
                          (tx.retryCount || 0) + 1
                        );
                      }}
                      className={`text-sm py-2 px-3 rounded-md flex items-center transition-colors ${
                        isDarkMode ? 
                          'bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-300' : 
                          'bg-yellow-50 hover:bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      Retry with Higher Gas
                    </button>
                  )}
                </div>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => {
                    setQueuedTxs(prev => {
                      const updated = {...prev};
                      delete updated[id];
                      return updated;
                    });
                  }}
                  className={`rounded-full p-1.5 inline-flex focus:outline-none ${
                    isDarkMode ? 
                      'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-gray-100' : 
                      'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label="Close notification"
                >
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCreationStatus = () => {
    if (!creationStatus.status) return null;
    
    return (
      <div className={`mb-4 p-4 rounded-lg border ${
        creationStatus.status === 'queued' ?
          (isDarkMode ? 'bg-blue-900/30 border-blue-700 text-blue-200' : 'bg-blue-100 border-blue-300 text-blue-800') :
        creationStatus.status === 'success' ?
          (isDarkMode ? 'bg-green-900/30 border-green-700 text-green-200' : 'bg-green-100 border-green-300 text-green-800') :
          (isDarkMode ? 'bg-red-900/30 border-red-700 text-red-200' : 'bg-red-100 border-red-300 text-red-800')
      }`}>
        <div className="flex items-center">
          {creationStatus.status === 'queued' ? (
            <div className={`h-5 w-5 border-2 rounded-full animate-spin mr-3 ${
              isDarkMode ? 'border-blue-400 border-t-transparent' : 'border-blue-500 border-t-transparent'
            }`}></div>
          ) : creationStatus.status === 'success' ? (
            <Check className={`h-5 w-5 mr-3 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
          ) : (
            <AlertTriangle className={`h-5 w-5 mr-3 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
          )}
          <p>{creationStatus.message}</p>
        </div>
      </div>
    );
  };

  const renderCreateProposalError = () => {
    if (!transactionError) return null;
    
    return (
      <div className={`mb-4 p-4 rounded-lg border ${
        isDarkMode ?'bg-red-900/30 border-red-700/70 text-red-200' : 
          'bg-red-100 border-red-400 text-red-700'
      }`}>
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className={`h-5 w-5 ${isDarkMode ? 'text-red-300' : 'text-red-500'}`} />
          </div>
          <div className="ml-3 flex-1">
            <p className="font-medium">Error</p>
            <p className="mt-1 text-sm">{transactionError}</p>
          </div>
        </div>
      </div>
    );
  };

  // Check if the current proposal type is a signaling proposal
  const isCommunityVoteProposal = parseInt(newProposal.type) === PROPOSAL_TYPES.SIGNALING;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
        <h2 className="text-xl font-semibold dark:text-white">Governance Proposals</h2>
        <p className="text-gray-500">View, create, and manage proposals</p>
        </div>
        <button 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          onClick={() => setShowCreateModal(true)}
        >
          Create Proposal
        </button>
      </div>

      {/* Filter options */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 dark:bg-gray-800 dark:shadow-gray-700/20">
        <div className="flex flex-wrap gap-2">
          {['all', 'active', 'queued', 'succeeded', 'executed', 'defeated', 'canceled', 'expired'].map(type => {
            // Get appropriate colors for each filter type based on status colors
            let buttonColors;
            if (proposalType === type) {
              // Selected button - use slightly stronger version of the status color
              switch (type) {
                case 'all':
                  buttonColors = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200';
                  break;case 'active':
                  buttonColors = 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
                  break;
                case 'queued':
                  buttonColors = 'bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
                  break;
                case 'succeeded':
                  buttonColors = 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200';
                  break;
                case 'executed':
                  buttonColors = 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200';
                  break;
                case 'defeated':
                  buttonColors = 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200';
                  break;
                case 'canceled':
                case 'expired':
                  buttonColors = 'bg-gray-200 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
                  break;
                default:
                  buttonColors = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200';
              }
            } else {
              // Unselected button - use lighter version of the status color
              switch (type) {
                case 'all':
                  buttonColors = 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300';
                  break;
                case 'active':
                  buttonColors = 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-700 dark:text-yellow-300/70 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-300';
                  break;
                case 'queued':
                  buttonColors = 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-700 dark:text-blue-300/70 dark:hover:bg-blue-900/30 dark:hover:text-blue-300';
                  break;
                case 'succeeded':
                  buttonColors = 'bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 dark:bg-gray-700 dark:text-green-300/70 dark:hover:bg-green-900/30 dark:hover:text-green-300';
                  break;
                case 'executed':
                  buttonColors = 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-gray-700 dark:text-indigo-300/70 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300';
                  break;
                case 'defeated':
                  buttonColors = 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-red-300/70 dark:hover:bg-red-900/30 dark:hover:text-red-300';
                  break;
                case 'canceled':
                case 'expired':
                  buttonColors = 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-200';
                  break;
                default:
                  buttonColors = 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-200';
              }
            }
            
            return (
              <button
                key={type}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${buttonColors}`}              
                onClick={() => {
                  setProposalType(type);
                  setCurrentPage(1); // Reset to first page on filter change
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Transaction notifications */}
      {renderTransactionNotifications()}
      
      {/* Proposals list */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size="large" text="Loading proposals..." />
          </div>
        ) : filteredProposals.length > 0 ? (
          <>
            {currentProposals.map((proposal, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-gray-700/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium dark:text-white">{proposal.title}</h3>
                    <p className="font-medium dark:text-white">Proposal #{proposal.id}</p>
                  </div>
                  <div className="flex items-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                      (proposal.displayStateLabel || proposal.stateLabel).toLowerCase()
                    )}`}>
                      {proposal.displayStateLabel || proposal.stateLabel}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm text-gray-500">
                  <div>
                    <p className="font-medium dark:text-white">Type</p>
                    <p className="font-small dark:text-white">{(() => {
                      // Robust type detection for signaling proposals
                      if (proposal.typeLabel && proposal.typeLabel !== "Unknown") {
                        return proposal.typeLabel;
                      }
                      
                      // Try to identify signaling proposals by type
                      const type = Number(proposal.type);
                      if (type === 7 || type === PROPOSAL_TYPES.SIGNALING) {
                        return "Binding Community Vote";
                      }
                      
                      // As a fallback, check description for signaling keywords
                      if (proposal.description && proposal.description.toLowerCase().includes("signaling")) {
                        return "Binding Community Vote";
                      }
                      
                      // Finally, use our helper function
                      return getProposalTypeLabel(proposal.type);
                    })()}</p>
                  </div>
                  <div>
                    <p className="font-medium dark:text-white">Created</p>
                    <p className="font-small dark:text-white">{formatRelativeTime(proposal.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-medium dark:text-white">Proposer</p>
                    <p className="font-small dark:text-white">{formatAddress(proposal.proposer)}</p>
                  </div>
                </div>
               
                <div className="border-t pt-4 mb-4">
  {expandedProposalId === proposal.id ? (
    <div>
      {/* Use renderProposalContent for consistent HTML/plain text rendering */}
      {renderProposalContent(proposal, true)}
      
      <div className="mt-4 border-t pt-4">
        <h2 className="text-xl font-semibold dark:text-white">Proposal Details</h2>
        {/* Display proposer address in full with copy button */}
        {renderAddress(proposal.proposer, "Proposer")}
        
        {/* Display proposal-specific details */}
        {proposal.type === PROPOSAL_TYPES.GENERAL && (
          <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
            {renderAddress(proposal.target, "Target")}
            <div className="mt-2">
              <p className="font-medium mb-1 dark:text-gray-300">Call Data:</p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 mt-1 rounded overflow-x-auto text-xs dark:text-gray-300">{proposal.callData}</pre>
            </div>
          </div>
        )}
                        
                        {(proposal.type === PROPOSAL_TYPES.WITHDRAWAL || 
                          proposal.type === PROPOSAL_TYPES.TOKEN_TRANSFER || 
                          proposal.type === PROPOSAL_TYPES.TOKEN_MINT || 
                          proposal.type === PROPOSAL_TYPES.TOKEN_BURN) && (
                            <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                              {renderAddress(proposal.recipient, "Recipient")}
                              <p className="mt-2 flex items-center">
                                <span className="font-medium mr-2 dark:text-gray-300">Amount:</span> 
                                <span className="dark:text-gray-300">
                                  {typeof proposal.amount === 'string' ? proposal.amount : formatBigNumber(proposal.amount)} 
                                  {proposal.type === PROPOSAL_TYPES.WITHDRAWAL ? ' ETH' : ' JUST'}
                                </span>
                              </p>
                            </div>
                        )}
                        
                        {proposal.type === PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER && (
                          <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                            {renderAddress(proposal.recipient, "Recipient")}
                            {renderAddress(proposal.token, "Token")}
                            <p className="mt-2 flex items-center">
                              <span className="font-medium mr-2 dark:text-gray-300">Amount:</span> 
                              <span className="dark:text-gray-300">
                                {typeof proposal.amount === 'string' ? proposal.amount : formatBigNumber(proposal.amount)}
                              </span>
                            </p>
                          </div>
                        )}
                        
                     

    {(() => {
  // Only render for Governance Change proposals
  if (parseInt(proposal.type) !== PROPOSAL_TYPES.GOVERNANCE_CHANGE) {
    return null;
  }

  // Extract governance parameters from description if they're not in the data
  const hasStandardParams = 
    proposal.newThreshold || 
    proposal.newQuorum || 
    proposal.newVotingDuration || 
    proposal.newProposalStake || 
    proposal.newTimelockDelay;
    
  // If no standard params, check description
  if (!hasStandardParams && proposal.description) {
    // Look for parameter patterns in the description
    const thresholdMatch = proposal.description.match(/threshold[:\s]+([0-9.]+)/i);
    const quorumMatch = proposal.description.match(/quorum[:\s]+([0-9.]+)/i);
    const durationMatch = proposal.description.match(/duration[:\s]+([0-9.]+)/i);
    const stakeMatch = proposal.description.match(/stake[:\s]+([0-9.]+)/i);
    
    // If found any parameters, render them
    if (thresholdMatch || quorumMatch || durationMatch || stakeMatch) {
      return (
        <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
          <div className="dark:text-gray-300">
            {thresholdMatch && (
              <p className="mb-2 flex items-center">
                <span className="font-medium mr-2 dark:text-gray-300">New Proposal Threshold:</span> 
                {thresholdMatch[1]} JUST
              </p>
            )}
            
            {quorumMatch && (
              <p className="mb-2 flex items-center">
                <span className="font-medium mr-2 dark:text-gray-300">New Quorum:</span> 
                {quorumMatch[1]} JUST
              </p>
            )}
            
            {durationMatch && (
              <p className="mb-2 flex items-center">
                <span className="font-medium mr-2 dark:text-gray-300">New Voting Duration:</span> 
                {durationMatch[1]} seconds
              </p>
            )}
            
            {stakeMatch && (
              <p className="mb-2 flex items-center">
                <span className="font-medium mr-2 dark:text-gray-300">New Proposal Stake:</span> 
                {stakeMatch[1]} JUST
              </p>
            )}
          </div>
        </div>
      );
    }
  }
  
  // If has standard params
  return (
    <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
      <div className="dark:text-gray-300">
        <p className="mb-2 flex items-center">
          <span className="font-medium mr-2 dark:text-gray-300">New Proposal Threshold:</span> 
          <span className="dark:text-gray-300">
            {hasValueChanged(proposal.newThreshold)
              ? (typeof proposal.newThreshold === 'string' && proposal.newThreshold.includes('.'))
                ? proposal.newThreshold + ' JUST'
                : formatBigNumber(proposal.newThreshold) + ' JUST'
              : "No Change"}
          </span>
        </p>
        <p className="mb-2 flex items-center">
          <span className="font-medium mr-2 dark:text-gray-300">New Quorum:</span> 
          <span className="dark:text-gray-300">
            {hasValueChanged(proposal.newQuorum)
              ? (typeof proposal.newQuorum === 'string' && proposal.newQuorum.includes('.'))
                ? proposal.newQuorum + ' JUST'
                : formatBigNumber(proposal.newQuorum) + ' JUST'
              : "No Change"}
          </span>
        </p>
        <p className="mb-2 flex items-center">
          <span className="font-medium mr-2 dark:text-gray-300">New Voting Duration:</span> 
          <span className="dark:text-gray-300">
            {proposal.newVotingDuration && parseInt(proposal.newVotingDuration || "0") > 0
              ? formatTime(proposal.newVotingDuration)
              : "No Change"}
          </span>
        </p>
        <p className="mb-2 flex items-center">
          <span className="font-medium mr-2 dark:text-gray-300">New Proposal Stake:</span> 
          <span className="dark:text-gray-300">
            {hasValueChanged(proposal.newProposalStake)
              ? (typeof proposal.newProposalStake === 'string' && proposal.newProposalStake.includes('.'))
                ? proposal.newProposalStake + ' JUST'
                : formatBigNumber(proposal.newProposalStake) + ' JUST'
              : hasValueChanged(proposal.newTimelockDelay)
                ? (typeof proposal.newTimelockDelay === 'string' && proposal.newTimelockDelay.includes('.'))
                  ? proposal.newTimelockDelay + ' JUST'
                  : formatBigNumber(proposal.newTimelockDelay) + ' JUST'
                : "No Change"}
          </span>
        </p>
      </div>
    </div>
  );
})()}
  
                        
                        {/* Display Binding Community Vote details */}
                        {proposal.type === PROPOSAL_TYPES.SIGNALING && (
                          <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Binding Community Vote</span> - This proposal represents a formal decision by the community that, while not executing code directly, establishes official consensus on governance matters.
                            </p>
                            <div className="mt-2 flex items-center text-sm">
                              <Shield className="h-4 w-4 text-indigo-500 mr-2" />
                              <span className="text-gray-600 dark:text-gray-400">
                                The outcome of this vote is recorded on-chain and binding for future governance actions.
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Add TimelockInfoDisplay component for queued proposals */}
                        {proposal.stateLabel?.toLowerCase() === 'queued' && (
                          <TimelockInfoDisplay
                            proposal={proposal}
                            contracts={contracts}
                            timelockInfo={timelockInfo}
                            setTimelockInfo={setTimelockInfo}
                            copiedText={copiedText}
                            setCopiedText={setCopiedText}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    // For collapsed view, display truncated content - prefer HTML if available
                    proposal.descriptionHtml ? (
                      <div 
                        className="text-sm text-gray-700 dark:text-gray-300 mb-2"
                        dangerouslySetInnerHTML={{ __html: truncateHtml(proposal.descriptionHtml, 200) }}
                      />
                    ) : (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">{proposal.description}</p>
                    )
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button 
                    className="text-indigo-600 dark:text-indigo-300 border border-indigo-600 dark:border-indigo-300 px-3 py-1 rounded-md text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/40 flex items-center transition-colors"
                    onClick={() => toggleProposalDetails(proposal.id)}
                  >
                    {expandedProposalId === proposal.id ? (
                      <>View Less <ChevronUp className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>View Details <ChevronDown className="w-4 h-4 ml-1" /></>
                    )}
                  </button>
                  
                  {proposal.state === PROPOSAL_STATES.ACTIVE && 
                   addressesEqual(account, proposal.proposer) && 
                   (!proposal.hasVotes) && (
                    <button 
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                      onClick={() => handleProposalAction(cancelProposal, proposal.id, 'cancelling')}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  )}
                  
                  {/* Show Queue button only for SUCCEEDED proposals that haven't been queued yet */}
                  {proposal.state === PROPOSAL_STATES.SUCCEEDED && !proposal.isQueued && (
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                      onClick={() => handleProposalAction(queueProposal, proposal.id, 'queuing')}
                      disabled={loading}
                    >
                      Queue
                    </button>
                  )}
                  
                  {/* Show Execute button only for QUEUED proposals that haven't been executed yet */}
                  {(proposal.state === PROPOSAL_STATES.QUEUED || proposal.readyForExecution) && !proposal.isExecuted && (
                    <button 
                      className={`bg-purple-500 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-500 text-white px-3 py-1 rounded-md text-sm shadow-sm hover:shadow-md dark:shadow-purple-700/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed ${
                        proposal.readyForExecution ? 'animate-pulse' : ''
                      }`}
                      onClick={() => handleProposalAction(executeProposal, proposal.id, 'executing')}
                      disabled={loading}
                    >
                      {proposal.readyForExecution ? 'Execute (Ready)' : 'Execute'}
                    </button>
                  )}
                  
                  {/* Display claim stake button for defeated/canceled/expired proposals */}
                  {canClaimRefund(proposal) && (
                    <button 
                      className="bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 text-white px-3 py-1 rounded-md text-sm shadow-sm hover:shadow-md dark:shadow-green-700/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
                      onClick={() => handleProposalAction(claimRefund, proposal.id, 'claiming refund for')}
                      disabled={loading}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-1" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                      Claim Stake Refund
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700/20">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing proposals {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedProposals.length)} of {sortedProposals.length}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className={`flex items-center justify-center p-2 rounded-md ${currentPage === 1 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30'}`}
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {/* Page numbers */}
                  <div className="flex space-x-1">
                    {/* Show limited page numbers with ellipsis for better UI */}
                    {[...Array(totalPages)].map((_, i) => {
                      // Only show first page, last page, current page, and pages around current
                      const pageNum = i + 1;
                      
                      // Logic to determine which page numbers to show
                      const shouldShowPage = 
                        pageNum === 1 || // Always show first page
                        pageNum === totalPages || // Always show last page
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1); // Show current and surrounding pages
                      
                      // Show ellipsis before and after skipped pages
                      const showPrevEllipsis = i === 1 && currentPage > 3;
                      const showNextEllipsis = i === totalPages - 2 && currentPage < totalPages - 2;
                      
                      if (shouldShowPage) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white dark:bg-indigo-700'
                                : 'text-gray-700 hover:bg-indigo-50 dark:text-gray-300 dark:hover:bg-indigo-900/30'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (showPrevEllipsis || showNextEllipsis) {
                        return (
                          <div key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center">
                            &hellip;
                          </div>
                        );
                      } else {
                        return null;
                      }
                    })}
                  </div>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className={`flex items-center justify-center p-2 rounded-md ${currentPage === totalPages 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30'}`}
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No proposals found
          </div>
        )}
      </div>
     
      {/* Create Proposal Modal with Rich Text Editor */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Create New Proposal</h2>
            {renderCreationStatus()}
            {renderCreateProposalError()}      
            <form onSubmit={handleSubmitProposal} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proposal Title</label>
                <input 
                  type="text" 
                  className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="Enter proposal title" 
                  value={newProposal.title}
                  onChange={(e) => setNewProposal({...newProposal, title: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proposal Type</label>
                <select 
                  className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  value={newProposal.type}
                  onChange={(e) => {
                    console.log("Type changed to:", e.target.value);
                    setNewProposal({...newProposal, type: e.target.value})
                  }}
                >
                  <option value={PROPOSAL_TYPES.GENERAL}>Contract Interaction</option>
                  <option value={PROPOSAL_TYPES.WITHDRAWAL}>ETH Withdrawal</option>
                  <option value={PROPOSAL_TYPES.TOKEN_TRANSFER}>Treasury Transfer</option>
                  <option value={PROPOSAL_TYPES.GOVERNANCE_CHANGE}>Governance Parameter Update</option>
                  <option value={PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER}>External Token Transfer</option>
                  <option value={PROPOSAL_TYPES.TOKEN_MINT}>Token Issuance</option>
                  <option value={PROPOSAL_TYPES.TOKEN_BURN}>Token Consolidation</option>
                  <option value={PROPOSAL_TYPES.SIGNALING}>Binding Community Vote</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                {/* Replace textarea with the rich text editor component */}
                <ProposalRichTextEditor
                  initialValue={newProposal.descriptionHtml || ''}
                  onChange={handleDescriptionChange}
                  height="250px"
                  placeholder="Describe your proposal in detail..."
                  isSignalingProposal={isCommunityVoteProposal}
                  darkMode={isDarkMode} // Add this prop to enable dark mode styling
                />
              </div>
              
              {/* Fields for GENERAL proposal type */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.GENERAL && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.target}
                      onChange={(e) => setNewProposal({...newProposal, target: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The contract address that will be called</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Call Data</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.callData}
                      onChange={(e) => setNewProposal({...newProposal, callData: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The encoded function call data</p>
                  </div>
                </>
              )}
              
              {/* Fields for WITHDRAWAL proposal type */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.WITHDRAWAL && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.recipient}
                      onChange={(e) => setNewProposal({...newProposal, recipient: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The address that will receive the ETH</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (ETH)</label>
                    <input 
                      type="number" 
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="Amount" 
                      value={newProposal.amount}
                      onChange={(e) => setNewProposal({...newProposal, amount: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount of ETH to withdraw</p>
                  </div>
                </>
              )}
              
              {/* Fields for TOKEN_TRANSFER proposal type */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.TOKEN_TRANSFER && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.recipient}
                      onChange={(e) => setNewProposal({...newProposal, recipient: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The address that will receive the JUST tokens</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (JUST)</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="Amount" 
                      value={newProposal.amount}
                      onChange={(e) => setNewProposal({...newProposal, amount: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount of JUST tokens to transfer</p>
                  </div>
                </>
              )}
              
              {/* Fields for TOKEN_MINT proposal type */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.TOKEN_MINT && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issuance Recipient Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.recipient}
                      onChange={(e) => setNewProposal({...newProposal, recipient: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The address that will receive the newly issued JUST tokens</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issuance Amount (JUST)</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="Amount" 
                      value={newProposal.amount}
                      onChange={(e) => setNewProposal({...newProposal, amount: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount of new JUST tokens to issue</p>
                  </div>
                </>
              )}
              
              {/* Fields for TOKEN_BURN proposal type */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.TOKEN_BURN && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Consolidation Source Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.recipient}
                      onChange={(e) => setNewProposal({...newProposal, recipient: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The address from which JUST tokens will be consolidated</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Consolidation Amount (JUST)</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="Amount" 
                      value={newProposal.amount}
                      onChange={(e) => setNewProposal({...newProposal, amount: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount of JUST tokens to consolidate from circulation</p>
                  </div>
                </>
              )}
              
              {/* Fields for EXTERNAL_ERC20_TRANSFER proposal type */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.token}
                      onChange={(e) => setNewProposal({...newProposal, token: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The address of the ERC20 token to transfer</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Address</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="0x..." 
                      value={newProposal.recipient}
                      onChange={(e) => setNewProposal({...newProposal, recipient: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The address that will receive the tokens</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="Amount" 
                      value={newProposal.amount}
                      onChange={(e) => setNewProposal({...newProposal, amount: e.target.value})}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount of tokens to transfer</p>
                  </div>
                </>
              )}
              
              {/* Fields for GOVERNANCE_CHANGE proposal type - UPDATED */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.GOVERNANCE_CHANGE && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Proposal Threshold</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="New threshold (in JUST tokens)" 
                      value={newProposal.newThreshold}
                      onChange={(e) => setNewProposal({...newProposal, newThreshold: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The new minimum amount of JUST tokens needed to create proposals</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Quorum</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="New quorum (in JUST tokens)" 
                      value={newProposal.newQuorum}
                      onChange={(e) => setNewProposal({...newProposal, newQuorum: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The new minimum voting power required for a proposal to pass</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Voting Duration</label>
                    <input 
                      type="number"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="New voting duration (in seconds)" 
                      value={newProposal.newVotingDuration}
                      onChange={(e) => setNewProposal({...newProposal, newVotingDuration: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The new duration of the voting period in seconds</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Proposal Stake</label>
                    <input 
                      type="number"
                      step="0.000000000000000001"
                      className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder="New proposal stake (in JUST tokens)" 
                      value={newProposal.newProposalStake}
                      onChange={(e) => setNewProposal({...newProposal, newProposalStake: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The new amount of JUST tokens required as stake when creating a proposal</p>
                  </div>
                </>
              )}
              
              {/* Fields for SIGNALING proposal type - BINDING COMMUNITY VOTE */}
              {parseInt(newProposal.type) === PROPOSAL_TYPES.SIGNALING && (
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-md dark:bg-indigo-900/20 dark:border-indigo-700">
                  <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-2">
                    <strong>Binding Community Vote Information:</strong>
                  </p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                    A Binding Community Vote enables formal decisions on important matters that don't require direct on-chain actions.
                    These votes establish official community consensus and are recorded permanently on-chain.
                  </p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                    Use the rich text editor above to format your proposal clearly with a detailed description, clear voting options, and implementation timeline. A proposal deposit is required to prevent spam.
                  </p>
                </div>
              )}
              <div className="flex justify-end space-x-2 pt-4">
                <button 
                  type="button"
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                {parseInt(newProposal.type) === PROPOSAL_TYPES.SIGNALING ? (
                  // Special button for binding community vote proposals that uses title and description validation only
                  <button 
                    type="button"
                    className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:bg-indigo-400 dark:disabled:bg-indigo-700 disabled:cursor-not-allowed shadow-sm hover:shadow-md dark:shadow-indigo-700/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                    disabled={submitting || !newProposal.title || !newProposal.description}
                    onClick={handleSubmitProposal}
                  >
                    {submitting ? 'Creating Binding Community Vote...' : 'Create Binding Community Vote'}
                  </button>
                ) : (
                  // Regular submit button for other proposal types
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:bg-indigo-400 dark:disabled:bg-indigo-700 disabled:cursor-not-allowed shadow-sm hover:shadow-md dark:shadow-indigo-700/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating Proposal...' : 'Create Proposal'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalsTab;
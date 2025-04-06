// src/services/ProposalLoader.js
import { ethers } from 'ethers';
import { PROPOSAL_STATES, PROPOSAL_TYPES } from '../utils/constants';

/**
 * Loads all proposals directly from blockchain contract using multiple approaches
 * with enhanced timelock support
 * @param {object} contracts - Web3 contract instances
 * @returns {array} Array of proposal objects with full metadata
 */
export async function loadProposalsFromBlockchain(contracts) {
  if (!contracts?.governance) {
    console.error("Governance contract not available");
    return [];
  }
  
  try {
    console.log("Loading proposals directly from blockchain...");
    const governance = contracts.governance;
    const provider = governance.provider;
    
    // Step 1: Find the maximum valid proposal ID
    let maxProposalId = await findMaxProposalId(governance);
    
    if (maxProposalId < 0) {
      console.log("No proposals found on blockchain");
      return [];
    }
    
    console.log(`Found ${maxProposalId + 1} potential proposals on blockchain`);
    
    // Step 2: Load all proposals
    const proposals = [];
    const failedProposalIds = []; // Track IDs that failed to load for retry
    
    // Load in smaller batches to avoid overwhelming the RPC
    const batchSize = 3;
    
    for (let i = 0; i <= maxProposalId; i += batchSize) {
      const batchPromises = [];
      
      for (let j = i; j < Math.min(i + batchSize, maxProposalId + 1); j++) {
        batchPromises.push(loadProposalDetails(j, governance, provider, contracts));
      }
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          proposals.push(result.value);
        } else if (result.status === 'rejected') {
          console.warn(`Failed to load proposal from batch: ${result.reason}`);
          // Don't track specific IDs here since we don't know which one failed
        }
      }
      
      // Short delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Step 3: Now specifically retry loading any timelock proposals that might have been missed
    // by checking the timelock contract events directly
    if (contracts.timelock) {
      const additionalProposals = await loadProposalsFromTimelock(contracts.timelock, governance, provider, proposals);
      
      if (additionalProposals.length > 0) {
        console.log(`Found ${additionalProposals.length} additional proposals from timelock contract`);
        proposals.push(...additionalProposals);
      }
    }
    
    // Step 4: If we had any failed proposals, try to load them one by one with more aggressive retry
    if (failedProposalIds.length > 0) {
      console.log(`Retrying ${failedProposalIds.length} failed proposals...`);
      
      for (const id of failedProposalIds) {
        try {
          const proposal = await loadProposalDetails(id, governance, provider, contracts, true);
          if (proposal) {
            proposals.push(proposal);
          }
        } catch (err) {
          console.error(`Failed to load proposal ${id} even with retry:`, err);
        }
        
        // More substantial delay between retries
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully loaded ${proposals.length} proposals from blockchain`);
    
    // Sort proposals by state and creation time
    return sortProposals(proposals);
    
  } catch (error) {
    console.error("Error loading proposals from blockchain:", error);
    return [];
  }
}

/**
 * Helper function to look for additional proposals by examining timelock events
 */
async function loadProposalsFromTimelock(timelock, governance, provider, existingProposals) {
  try {
    console.log("Searching for additional proposals in timelock...");
    const additionalProposals = [];
    
    // Get all TransactionQueued events from the timelock
    const currentBlock = await provider.getBlockNumber();
    const startBlock = Math.max(0, currentBlock - 100000); // Look back ~2 weeks
    
    const queuedEvents = await timelock.queryFilter(
      timelock.filters.TransactionQueued(),
      startBlock
    );
    
    console.log(`Found ${queuedEvents.length} TransactionQueued events in timelock`);
    
    // Get all existing proposal IDs for comparison
    const existingIds = new Set(existingProposals.map(p => Number(p.id)));
    
    // We'll try to match timelock transactions with governance proposals
    // by examining the targets and timestamps
    for (const event of queuedEvents) {
      try {
        if (!event.args || !event.args.target) continue;
        
        const target = event.args.target;
        const txHash = event.args.txHash;
        const etaTimestamp = event.args.eta ? Number(event.args.eta) : null;
        const threatLevel = event.args.threatLevel ? Number(event.args.threatLevel) : 0;
        
        // Check if this transaction might be from a proposal we're missing
        let matchingProposal = null;
        let proposalId = null;
        
        // First try to get proposal ID directly from event data if available
        if (event.args.data && event.args.data !== '0x') {
          try {
            // Some timelock implementations store proposal ID in the data
            const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], event.args.data);
            proposalId = decoded[0].toNumber();
          } catch (e) {
            // Data is in a different format, continue to other methods
          }
        }
        
        // If we found a potential proposal ID, check if we already have it
        if (proposalId !== null) {
          if (existingIds.has(proposalId)) {
            // Already have this proposal, no need to load it again
            continue;
          }
          
          // Try to load this proposal directly
          try {
            matchingProposal = await loadProposalDetails(proposalId, governance, provider);
            
            // If we successfully loaded it, add the timelock hash and other info
            if (matchingProposal) {
              matchingProposal.timelockTxHash = txHash;
              matchingProposal.timelockEta = etaTimestamp;
              matchingProposal.timelockThreatLevel = threatLevel;
              matchingProposal.isInTimelock = true;
              matchingProposal.displayStateLabel = "In Timelock";
              additionalProposals.push(matchingProposal);
              continue;
            }
          } catch (loadErr) {
            console.warn(`Failed to load proposal ${proposalId} from ID in timelock event:`, loadErr);
            // Continue to other methods
          }
        }
        
        // If we didn't find a match, look through ProposalCreated events with matching targets
        const creationEvents = await governance.queryFilter(governance.filters.ProposalEvent());
        
        for (const creationEvent of creationEvents) {
          try {
            // Extract the proposal information from the event
            if (creationEvent.args && creationEvent.args.eventType === 0) { // Creation event
              const proposalId = creationEvent.args.proposalId.toNumber();
              
              // Skip if we already have this proposal
              if (existingIds.has(proposalId)) continue;
              
              // Try to get the proposal details to check if target matches
              try {
                const proposal = await governance.proposals(proposalId);
                
                // Check if this proposal's target matches our timelock event
                if (proposal.target && proposal.target.toLowerCase() === target.toLowerCase()) {
                  // Found a match! Load the full proposal
                  matchingProposal = await loadProposalDetails(proposalId, governance, provider);
                  
                  if (matchingProposal) {
                    // Add timelock information
                    matchingProposal.timelockTxHash = txHash;
                    matchingProposal.timelockEta = etaTimestamp;
                    matchingProposal.timelockThreatLevel = threatLevel;
                    matchingProposal.isInTimelock = true;
                    matchingProposal.displayStateLabel = "In Timelock";
                    additionalProposals.push(matchingProposal);
                    break;
                  }
                }
              } catch (e) {
                // Couldn't get proposal details, try next event
                continue;
              }
            }
          } catch (eventErr) {
            // Problem processing this event, skip it
            continue;
          }
        }
      } catch (err) {
        console.warn("Error processing timelock event:", err);
      }
    }
    
    return additionalProposals;
  } catch (error) {
    console.error("Error loading proposals from timelock:", error);
    return [];
  }
}

/**
 * Finds the maximum valid proposal ID by querying the contract
 */
async function findMaxProposalId(governance) {
  try {
    console.log("Finding max proposal ID...");
    
    // First try using the count method if available
    try {
      if (typeof governance.getProposalCount === 'function') {
        const count = await governance.getProposalCount();
        const maxId = count.toNumber() - 1;
        if (maxId >= 0) {
          console.log(`Found max proposal ID ${maxId} using getProposalCount`);
          return maxId;
        }
      }
    } catch (err) {
      console.warn("getProposalCount not available or failed:", err);
    }
    
    // Next try using events for efficiency
    try {
      // Get ProposalEvent events
      const filter = governance.filters.ProposalEvent();
      const events = await governance.queryFilter(filter);
      
      let maxId = -1;
      
      // Find the highest proposal ID in events
      for (const event of events) {
        if (event.args && event.args.proposalId) {
          const id = Number(event.args.proposalId.toString());
          if (id > maxId) maxId = id;
        }
      }
      
      if (maxId >= 0) {
        console.log(`Found max proposal ID ${maxId} using events`);
        return maxId;
      }
    } catch (err) {
      console.warn("Error finding max ID with events:", err);
    }
    
    // Fallback to binary search approach
    console.log("Using binary search to find max proposal ID");
    
    let left = 0;
    let right = 100; // Start with a reasonable upper bound
    
    // First, find an upper bound
    let valid = true;
    while (valid) {
      try {
        await governance.getProposalState(right);
        left = right;
        right *= 2;
        
        if (right > 10000) break; // Safety cap
      } catch (err) {
        valid = false;
      }
    }
    
    // Binary search between left and right
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      try {
        await governance.getProposalState(mid);
        left = mid + 1; // This ID exists, check higher
      } catch (err) {
        right = mid - 1; // This ID doesn't exist, check lower
      }
    }
    
    console.log(`Max proposal ID from binary search: ${right}`);
    return right;
    
  } catch (error) {
    console.error("Error finding max proposal ID:", error);
    return -1;
  }
}

/**
 * Loads full details for a specific proposal ID with enhanced timelock support
 */
async function loadProposalDetails(proposalId, governance, provider, contracts = {}, aggressive = false) {
  try {
    console.log(`Loading proposal #${proposalId} details...`);
    
    // First check if the proposal exists
    let state;
    try {
      state = await governance.getProposalState(proposalId);
    } catch (err) {
      console.log(`Proposal #${proposalId} doesn't exist or can't be accessed`);
      return null;
    }
    
    // Convert state to number if it's a BigNumber
    const stateNum = typeof state === 'object' && state.toNumber ? state.toNumber() : Number(state);
    
    // Init proposal object with basic state
    let proposal = {
      id: proposalId,
      state: stateNum,
      stateLabel: getStateLabel(stateNum)
    };
    
    // Get proposal creation and other events
    const events = await getProposalEvents(proposalId, governance);
    
    // Extract data from events
    if (events.creation) {
      const creationEvent = events.creation;
      
      // Get creation timestamp
      const block = await provider.getBlock(creationEvent.blockNumber);
      proposal.createdAt = new Date(block.timestamp * 1000);
      
      // Get proposer
      proposal.proposer = creationEvent.args.actor;
      
      // Try to extract type and snapshot ID from event data
      try {
        const data = creationEvent.args.data;
        if (data && data !== '0x') {
          const decoded = ethers.utils.defaultAbiCoder.decode(['uint8', 'uint256'], data);
          proposal.type = Number(decoded[0]);
          proposal.snapshotId = decoded[1].toString();
        }
      } catch (decodeErr) {
        console.warn(`Couldn't decode creation event data for proposal #${proposalId}:`, decodeErr);
      }
    }
    
    // Get proposal detailed data via transaction lookup
    if (events.creation && events.creation.transactionHash) {
      try {
        const txHash = events.creation.transactionHash;
        const tx = await provider.getTransaction(txHash);
        
        // Try to decode the transaction input data to get proposal params
        try {
          const iface = new ethers.utils.Interface([
            "function createProposal(string description, uint8 proposalType, address target, bytes callData, uint256 amount, address recipient, address externalToken, uint256 newThreshold, uint256 newQuorum, uint256 newVotingDuration, uint256 newTimelockDelay) returns (uint256)",
            "function createSignalingProposal(string description) returns (uint256)"
          ]);
          
          const decoded = iface.parseTransaction({ data: tx.data });
          
          if (decoded && decoded.name === 'createProposal') {
            // Regular proposal
            proposal.description = decoded.args[0];
            proposal.type = Number(decoded.args[1]) || 0;
            proposal.target = decoded.args[2];
            proposal.callData = decoded.args[3];
            proposal.amount = decoded.args[4] ? ethers.utils.formatEther(decoded.args[4]) : "0";
            proposal.recipient = decoded.args[5];
            proposal.token = decoded.args[6];
            proposal.newThreshold = decoded.args[7] ? ethers.utils.formatEther(decoded.args[7]) : "0";
            proposal.newQuorum = decoded.args[8] ? ethers.utils.formatEther(decoded.args[8]) : "0";
            proposal.newVotingDuration = decoded.args[9] ? decoded.args[9].toString() : "0";
            proposal.newTimelockDelay = decoded.args[10] ? decoded.args[10].toString() : "0";
          } 
          else if (decoded && decoded.name === 'createSignalingProposal') {
            // Signaling proposal
            proposal.description = decoded.args[0];
            proposal.type = PROPOSAL_TYPES.SIGNALING;
          }
        } catch (decodeErr) {
          console.warn(`Couldn't decode transaction data for proposal #${proposalId}:`, decodeErr);
        }
      } catch (txErr) {
        console.warn(`Error getting transaction data for proposal #${proposalId}:`, txErr);
      }
    }
    
    // If we couldn't get the description from tx data, try direct access to proposal data
    if (!proposal.description) {
      try {
        // Try different methods to access proposal data
        // Many governance contracts have a proposals mapping
        const proposalData = await governance.proposals(proposalId).catch(() => null) || 
                           await governance._proposals(proposalId).catch(() => null);
                            
        if (proposalData && proposalData.description) {
          proposal.description = proposalData.description;
        }
      } catch (dataErr) {
        console.warn(`Couldn't get proposal data for #${proposalId}:`, dataErr);
      }
    }
    
    // If type is still undefined, try to deduce it
    if (proposal.type === undefined) {
      if (proposal.target && proposal.callData) {
        proposal.type = PROPOSAL_TYPES.GENERAL;
      } else if (proposal.description && 
                (proposal.description.toLowerCase().includes('signaling') || 
                 proposal.description.toLowerCase().includes('community vote'))) {
        proposal.type = PROPOSAL_TYPES.SIGNALING;
      } else {
        proposal.type = PROPOSAL_TYPES.GENERAL; // Default
      }
    }
    
    // Add type label
    proposal.typeLabel = getTypeLabel(proposal.type);
    
    // Get vote totals
    try {
      const [yesVotes, noVotes, abstainVotes, totalVotes, voterCount] = 
        await governance.getProposalVoteTotals(proposalId);
      
      proposal.yesVotes = ethers.utils.formatEther(yesVotes);
      proposal.noVotes = ethers.utils.formatEther(noVotes);
      proposal.abstainVotes = ethers.utils.formatEther(abstainVotes);
      proposal.totalVoters = voterCount.toNumber();
    } catch (voteErr) {
      console.warn(`Error getting vote totals for proposal #${proposalId}:`, voteErr);
      
      // Try fallback with vote events
      try {
        const { yesVotes, noVotes, abstainVotes, voterCount } = 
          await getVoteTotalsFromEvents(proposalId, governance);
        
        proposal.yesVotes = yesVotes;
        proposal.noVotes = noVotes;
        proposal.abstainVotes = abstainVotes;
        proposal.totalVoters = voterCount;
      } catch (eventsErr) {
        console.warn(`Error getting vote totals from events for #${proposalId}:`, eventsErr);
        
        // Set defaults
        proposal.yesVotes = "0";
        proposal.noVotes = "0";
        proposal.abstainVotes = "0";
        proposal.totalVoters = 0;
      }
    }
    
    // Get stake refund status
    if (events.stakeRefund && events.stakeRefund.length > 0) {
      proposal.stakeRefunded = true;
    } else {
      proposal.stakeRefunded = false;
    }
    
    // Enhanced timelock status retrieval
    // First check if this proposal is in QUEUED state
    if (proposal.state === PROPOSAL_STATES.QUEUED) {
      // Get timelock tx hash from events
      if (events.queue) {
        try {
          const queueEvent = events.queue;
          const data = queueEvent.args.data;
          
          if (data && data !== '0x') {
            try {
              const decoded = ethers.utils.defaultAbiCoder.decode(['bytes32'], data);
              proposal.timelockTxHash = decoded[0];
            } catch (e) {
              console.warn(`Couldn't decode queue event data for proposal #${proposalId}:`, e);
            }
          }
        } catch (queueErr) {
          console.warn(`Error getting timelock tx hash for proposal #${proposalId}:`, queueErr);
        }
      }
      
      // If we still don't have a timelock hash, try alternative approaches
      if (!proposal.timelockTxHash && contracts.timelock) {
        try {
          // Try to find the timelock transaction through timelock events
          const timelock = contracts.timelock;
          const currentBlock = await provider.getBlockNumber();
          const startBlock = Math.max(0, currentBlock - 100000); // Look back further
          
          // Get all TransactionQueued events
          const timelockEvents = await timelock.queryFilter(
            timelock.filters.TransactionQueued(),
            startBlock
          );
          
          // Try to match by target address
          if (proposal.target) {
            const proposalTarget = proposal.target.toLowerCase();
            
            for (const event of timelockEvents) {
              try {
                if (event.args && event.args.target) {
                  const eventTarget = event.args.target.toLowerCase();
                  
                  if (eventTarget === proposalTarget) {
                    proposal.timelockTxHash = event.args.txHash;
                    
                    // Also get threat level and ETA
                    if (event.args.threatLevel !== undefined) {
                      proposal.timelockThreatLevel = Number(event.args.threatLevel);
                    }
                    
                    if (event.args.eta) {
                      proposal.timelockEta = Number(event.args.eta);
                      
                      // Calculate if it's ready for execution
                      const currentTimestamp = Math.floor(Date.now() / 1000);
                      proposal.readyForExecution = currentTimestamp >= proposal.timelockEta;
                      
                      // Update the display state label
                      if (proposal.readyForExecution) {
                        proposal.displayStateLabel = "Ready For Execution";
                      } else {
                        proposal.displayStateLabel = "In Timelock";
                      }
                      
                      proposal.isInTimelock = true;
                    }
                    
                    break;
                  }
                }
              } catch (eventErr) {
                console.warn(`Error processing timelock event:`, eventErr);
              }
            }
          }
        } catch (timelockErr) {
          console.warn(`Error searching timelock events for proposal #${proposalId}:`, timelockErr);
        }
      }
    }
    
    // Get deadline (voting end time)
    try {
      if (proposal.createdAt) {
        // Try to get voting duration from governance params
        const govParams = await governance.govParams();
        const votingDuration = govParams.votingDuration.toNumber();
        
        proposal.deadline = new Date(proposal.createdAt.getTime() + (votingDuration * 1000));
      }
    } catch (deadlineErr) {
      console.warn(`Error calculating deadline for proposal #${proposalId}:`, deadlineErr);
    }
    
    // Get display state/labels and parse description
    const { parsedTitle, parsedDescription, hasHtml, htmlContent } = parseDescription(proposal.description);
    
    // Create final processed proposal
    const processedProposal = {
      ...proposal,
      title: parsedTitle || `Proposal #${proposalId}`,
      description: parsedDescription || proposal.description || "",
      descriptionHtml: htmlContent || null,
      hasHtml
    };
    
    console.log(`Successfully loaded proposal #${proposalId}`);
    return processedProposal;
    
  } catch (error) {
    console.error(`Error loading proposal #${proposalId}:`, error);
    return null;
  }
}

/**
 * Gets all relevant events for a proposal
 */
async function getProposalEvents(proposalId, governance) {
  try {
    // Get all events for this proposal
    const filter = governance.filters.ProposalEvent(proposalId);
    const events = await governance.queryFilter(filter);
    
    // Categorize events by type
    const result = {
      creation: null,     // Creation event (type 0)
      cancel: null,       // Cancel event (type 1)
      queue: null,        // Queue event (type 2)
      execute: null,      // Execute event (type 3)
      stakeRefund: [],    // Stake refund events (type 5)
      votes: []           // Vote events (type 6)
    };
    
    for (const event of events) {
      try {
        const eventType = event.args.eventType;
        
        if (eventType === 0) {
          result.creation = event;
        } else if (eventType === 1) {
          result.cancel = event;
        } else if (eventType === 2) {
          result.queue = event;
        } else if (eventType === 3) {
          result.execute = event;
        } else if (eventType === 5) {
          result.stakeRefund.push(event);
        } else if (eventType === 6) {
          result.votes.push(event);
        }
      } catch (err) {
        console.warn(`Error processing event for proposal ${proposalId}:`, err);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error getting events for proposal ${proposalId}:`, error);
    return {
      creation: null,
      cancel: null,
      queue: null,
      execute: null,
      stakeRefund: [],
      votes: []
    };
  }
}

/**
 * Calculates vote totals from vote events as a fallback
 */
async function getVoteTotalsFromEvents(proposalId, governance) {
  try {
    // Get all vote-related events
    const filter = governance.filters.VoteCast(proposalId);
    const events = await governance.queryFilter(filter);
    
    // Initialize counters
    let yesBN = ethers.BigNumber.from(0);
    let noBN = ethers.BigNumber.from(0);
    let abstainBN = ethers.BigNumber.from(0);
    const voters = new Set();
    
    // Process each vote event
    for (const event of events) {
      try {
        const voter = event.args.voter;
        const support = Number(event.args.support);
        const votingPower = event.args.votingPower;
        
        voters.add(voter.toLowerCase());
        
        if (support === 0) { // Against
          noBN = noBN.add(votingPower);
        } else if (support === 1) { // For
          yesBN = yesBN.add(votingPower);
        } else if (support === 2) { // Abstain
          abstainBN = abstainBN.add(votingPower);
        }
      } catch (err) {
        console.warn(`Error processing vote event:`, err);
      }
    }
    
    return {
      yesVotes: ethers.utils.formatEther(yesBN),
      noVotes: ethers.utils.formatEther(noBN),
      abstainVotes: ethers.utils.formatEther(abstainBN),
      voterCount: voters.size
    };
  } catch (error) {
    console.error(`Error calculating votes from events for proposal ${proposalId}:`, error);
    return {
      yesVotes: "0",
      noVotes: "0",
      abstainVotes: "0",
      voterCount: 0
    };
  }
}

/**
 * Parse proposal description to extract HTML content and title
 */
function parseDescription(rawDescription) {
  if (!rawDescription) {
    return { 
      parsedTitle: '', 
      parsedDescription: '', 
      hasHtml: false, 
      htmlContent: null 
    };
  }
  
  // Check for HTML marker
  const htmlMarkerIndex = rawDescription.indexOf('|||HTML:');
  let hasHtml = false;
  let htmlContent = null;
  let parsedTitle = '';
  let parsedDescription = rawDescription;
  
  if (htmlMarkerIndex !== -1) {
    // Extract HTML content
    htmlContent = rawDescription.substring(htmlMarkerIndex + 8);
    hasHtml = true;
    
    // Extract plain text portion before HTML marker
    const plainText = rawDescription.substring(0, htmlMarkerIndex).trim();
    
    // Find the title (first line)
    const firstLineBreak = plainText.indexOf('\n');
    if (firstLineBreak !== -1) {
      parsedTitle = plainText.substring(0, firstLineBreak).trim();
      parsedDescription = plainText;
    } else {
      // If no line break, the entire plain text is the title
      parsedTitle = plainText;
      parsedDescription = plainText;
    }
  } else {
    // No HTML content, treat as plain text
    const lines = rawDescription.split('\n');
    parsedTitle = lines[0] || '';
    parsedDescription = rawDescription;
  }
  
  return { parsedTitle, parsedDescription, hasHtml, htmlContent };
}

/**
 * Sort proposals by state priority and creation time
 */
function sortProposals(proposals) {
  return proposals.sort((a, b) => {
    // Define state priority (Active first, then Succeeded, etc.)
    const statePriority = {
      [PROPOSAL_STATES.ACTIVE]: 1,
      [PROPOSAL_STATES.SUCCEEDED]: 2,
      [PROPOSAL_STATES.QUEUED]: 3,
      [PROPOSAL_STATES.EXECUTED]: 4,
      [PROPOSAL_STATES.DEFEATED]: 5,
      [PROPOSAL_STATES.CANCELED]: 6,
      [PROPOSAL_STATES.EXPIRED]: 7
    };
    
    // Get priority values (default to 999 if unknown)
    const aPriority = statePriority[a.state] || 999;
    const bPriority = statePriority[b.state] || 999;
    
    // First sort by state priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Then sort by creation date (newest first)
    if (a.createdAt && b.createdAt) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    
    // Finally sort by ID (newest first)
    return b.id - a.id;
  });
}

/**
 * Get human-readable state label
 */
function getStateLabel(state) {
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

/**
 * Get human-readable type label
 */
function getTypeLabel(type) {
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
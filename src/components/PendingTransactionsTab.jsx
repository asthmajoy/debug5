import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { ethers } from 'ethers';
import { formatRelativeTime, formatAddress, formatTime } from '../utils/formatters';
import { addressesEqual } from '../utils/addressUtils';
import Loader from './Loader';

const PendingTransactionsTab = ({ contracts, account }) => {
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [gracePeriod, setGracePeriod] = useState(0);
  
  // Define the proposal states
  const PROPOSAL_STATES = {
    ACTIVE: 0,
    CANCELED: 1,
    DEFEATED: 2,
    SUCCEEDED: 3,
    QUEUED: 4,
    EXECUTED: 5,
    EXPIRED: 6
  };

  // Get status badge styling based on transaction type
  const getStatusBadgeStyle = (transaction) => {
    if (transaction.type === 'active') {
      return 'bg-blue-100 text-blue-800';
    } else if (transaction.type === 'succeeded') {
      return 'bg-green-100 text-green-800';
    } else if (transaction.isExpired) {
      return 'bg-red-100 text-red-800';
    } else if (transaction.canExecute) {
      return 'bg-green-100 text-green-800';
    } else {
      return 'bg-yellow-100 text-yellow-800';
    }
  };
  
  // Render status text
  const getStatusText = (transaction) => {
    if (transaction.type === 'active') {
      return 'Active';
    } else if (transaction.type === 'succeeded') {
      return 'Succeeded';
    } else if (transaction.isExpired) {
      return 'Expired';
    } else if (transaction.canExecute) {
      return 'Ready';
    } else {
      return 'Pending';
    }
  };
  
  // Load all relevant transactions
  useEffect(() => {
    loadAllTransactions();
  }, [contracts.timelock, contracts.governance]);
  
  const loadAllTransactions = async () => {
    if (!contracts.timelock || !contracts.governance) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      // Get the grace period from the timelock for expiry calculations
      const gracePeriod = await contracts.timelock.gracePeriod();
      setGracePeriod(gracePeriod.toNumber());
      
      // Load all relevant proposals (Active, Succeeded, and Queued)
      const allPendingTxs = await loadRelevantProposals();
      setPendingTransactions(allPendingTxs);
    } catch (error) {
      console.error("Error loading transaction data:", error);
      setErrorMessage("Failed to load transaction data. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const loadRelevantProposals = async () => {
    const allTransactions = [];
    
    try {
      // Try to get proposal count if available
      let maxProposalId = 100; // Default
      try {
        // Different ways to get the proposal count
        if (typeof contracts.governance.proposalCount === 'function') {
          const count = await contracts.governance.proposalCount();
          maxProposalId = count.toNumber();
        } else {
          // Try to find any proposal with a high ID to determine the count
          for (let testId = 100; testId >= 0; testId -= 10) {
            try {
              await contracts.governance.getProposalState(testId);
              maxProposalId = testId + 10; // Set a higher bound
              break;
            } catch (e) {
              if (testId === 0) {
                maxProposalId = 20; // Just use a reasonable default
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not get proposal count, using default:", err);
      }
      
      console.log(`Searching for pending transactions among ${maxProposalId} proposals...`);
      
      for (let id = maxProposalId; id >= 0; id--) {
        try {
          // Get the proposal state - this should be available in any governance contract
          const proposalState = await contracts.governance.getProposalState(id);
          const stateNum = Number(proposalState.toString());
          
          // Check if it's a state we're interested in (Active, Succeeded, or Queued)
          if (stateNum === PROPOSAL_STATES.ACTIVE || 
              stateNum === PROPOSAL_STATES.SUCCEEDED || 
              stateNum === PROPOSAL_STATES.QUEUED) {
            
            // Try to get vote information which is available in most governance contracts
            let yesVotes = 0, noVotes = 0, abstainVotes = 0, description = `Proposal #${id}`;
            
            try {
              // Get vote information using getProposalVotes
              const [yes, no, abstain] = await contracts.governance.getProposalVotes(id);
              yesVotes = Number(yes.toString());
              noVotes = Number(no.toString());
              abstainVotes = Number(abstain.toString());
            } catch (voteError) {
              console.warn(`Could not get vote data for proposal #${id}:`, voteError);
            }
            
            // Try to get proposal description from events
            try {
              // Query proposal creation event to get the description
              const filter = contracts.governance.filters.ProposalEvent(id, 0); // 0 = created
              const events = await contracts.governance.queryFilter(filter);
              
              if (events.length > 0 && events[0].args.data) {
                // The description might be in the event data
                const decodedData = ethers.utils.defaultAbiCoder.decode(['uint8', 'uint256'], events[0].args.data);
                
                // Try to get the proposal directly if possible
                try {
                  const proposer = events[0].args.actor;
                  
                  // The description might be in a subsequent event or elsewhere
                  // For now, we'll just use the proposal ID
                  description = `Proposal #${id} by ${formatAddress(proposer)}`;
                } catch (e) {
                  // Keep using the default description
                }
              }
            } catch (eventError) {
              console.warn(`Could not get event data for proposal #${id}:`, eventError);
            }
            
            // For queued proposals, also check for timelock transactions
            if (stateNum === PROPOSAL_STATES.QUEUED) {
              // Try different ways to get the timelock hash
              let timelockTxHash = null;
              
              try {
                // First method: get from proposal returns
                const [,,,,,,,,txHash] = await contracts.governance.getProposalDetails(id);
                timelockTxHash = txHash;
              } catch (e) {
                try {
                  // Second method: get from getProposalTimelockHash function
                  timelockTxHash = await contracts.governance.getProposalTimelockHash(id);
                } catch (e2) {
                  try {
                    // Third method: look for an event with the hash
                    const queuedFilter = contracts.governance.filters.TimelockTransactionSubmitted(id);
                    const queuedEvents = await contracts.governance.queryFilter(queuedFilter);
                    
                    if (queuedEvents.length > 0 && queuedEvents[0].args.txHash) {
                      timelockTxHash = queuedEvents[0].args.txHash;
                    }
                  } catch (e3) {
                    console.warn(`Could not find timelock hash for queued proposal #${id}`);
                  }
                }
              }
              
              if (timelockTxHash && timelockTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                // Check if this transaction is still in the timelock
                const isQueued = await contracts.timelock.queuedTransactions(timelockTxHash);
                
                if (isQueued) {
                  // Get transaction details
                  const tx = await contracts.timelock.getTransaction(timelockTxHash);
                  
                  const currentTime = Math.floor(Date.now() / 1000);
                  const etaTime = tx[3].toNumber();
                  
                  allTransactions.push({
                    id: timelockTxHash,
                    target: tx[0], // target address
                    value: tx[1].toString(), // ETH value
                    data: tx[2], // calldata
                    eta: new Date(etaTime * 1000), // scheduled execution time
                    executed: tx[4], // execution status
                    proposalId: id,
                    description: description.length > 100 ? 
                      `${description.substring(0, 100)}...` : description,
                    type: 'queued',
                    canExecute: currentTime >= etaTime,
                    isExpired: currentTime > etaTime + gracePeriod
                  });
                }
              } else {
                // If we couldn't find the timelock transaction, still add the proposal
                // since it's in the QUEUED state
                allTransactions.push({
                  id: `proposal-${id}`,
                  proposalId: id,
                  description: description.length > 100 ? 
                    `${description.substring(0, 100)}...` : description,
                  type: 'queued',
                  createdAt: new Date(),
                  yesVotes,
                  noVotes,
                  abstainVotes,
                  deadline: new Date(Date.now() + 86400000), // Placeholder
                  canExecute: false,
                  isExpired: false
                });
              }
            } else {
              // For active and succeeded proposals, add them directly
              let deadline = new Date(Date.now() + 86400000); // Default 1 day from now
              let createdAt = new Date();
              
              try {
                // Try to get more detailed information if available
                const proposalEvents = await contracts.governance.queryFilter(
                  contracts.governance.filters.ProposalEvent(id)
                );
                
                if (proposalEvents.length > 0) {
                  const createEvent = proposalEvents.find(e => e.args.eventType?.toNumber() === 0);
                  if (createEvent) {
                    createdAt = new Date(createEvent.blockTimestamp * 1000);
                    
                    // Try to find the deadline
                    try {
                      const details = await contracts.governance.getProposalDetails(id);
                      deadline = new Date(details[2] * 1000); // deadline is usually the 3rd element
                    } catch (e) {
                      // Keep default deadline
                    }
                  }
                }
              } catch (e) {
                console.warn(`Could not get detailed event info for proposal #${id}:`, e);
              }
              
              allTransactions.push({
                id: `proposal-${id}`,
                proposalId: id,
                description: description.length > 100 ? 
                  `${description.substring(0, 100)}...` : description,
                type: stateNum === PROPOSAL_STATES.ACTIVE ? 'active' : 'succeeded',
                createdAt,
                deadline,
                yesVotes,
                noVotes,
                abstainVotes
              });
            }
          }
        } catch (error) {
          // Skip if proposal doesn't exist
          console.warn(`Error checking proposal #${id}:`, error);
          if (id === maxProposalId) {
            continue; // Keep trying lower IDs
          } else {
            // If we've found some valid proposals and then hit errors,
            // it might mean we've reached the end of valid proposals
            if (allTransactions.length > 0) {
              break;
            }
          }
        }
      }
      
      console.log(`Found ${allTransactions.length} pending transactions`);
      return allTransactions;
    } catch (error) {
      console.error("Error loading proposals:", error);
      return [];
    }
  };
  
  // Execute a queued transaction
  const executeTransaction = async (txHash) => {
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const timelock = contracts.timelock.connect(signer);
      
      // Get current gas price with slight boost
      const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% boost
      
      // Estimate gas with fallback
      const gasEstimate = await timelock.estimateGas.executeTransaction(txHash)
        .catch(() => ethers.BigNumber.from("1000000")); // 1M gas fallback
      
      // Add 50% buffer to gas estimate
      const gasLimit = gasEstimate.mul(150).div(100);
      
      console.log(`Executing transaction ${txHash} with gas limit ${gasLimit} and gas price ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
      
      const tx = await timelock.executeTransaction(txHash, {
        gasLimit,
        gasPrice
      });
      
      await tx.wait();
      
      // Refresh the pending transactions list
      setPendingTransactions(pendingTransactions.filter(t => t.id !== txHash));
      
      setSuccessMessage("Transaction executed successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error executing transaction:", error);
      setErrorMessage(error.message || 'Failed to execute transaction');
    } finally {
      setTxLoading(false);
    }
  };
  
  // Execute an expired transaction
  const executeExpiredTransaction = async (txHash) => {
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const timelock = contracts.timelock.connect(signer);
      
      // Get current gas price with slight boost
      const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% boost
      
      // Estimate gas with fallback
      const gasEstimate = await timelock.estimateGas.executeExpiredTransaction(txHash)
        .catch(() => ethers.BigNumber.from("1000000")); // 1M gas fallback
      
      // Add 50% buffer to gas estimate
      const gasLimit = gasEstimate.mul(150).div(100);
      
      console.log(`Executing expired transaction ${txHash} with gas limit ${gasLimit}`);
      
      const tx = await timelock.executeExpiredTransaction(txHash, {
        gasLimit,
        gasPrice
      });
      
      await tx.wait();
      
      // Refresh the pending transactions list
      setPendingTransactions(pendingTransactions.filter(t => t.id !== txHash));
      
      setSuccessMessage("Expired transaction executed successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error executing expired transaction:", error);
      setErrorMessage(error.message || 'Failed to execute expired transaction');
    } finally {
      setTxLoading(false);
    }
  };
  
  // Cancel a transaction or proposal
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
      
      // Different handling based on transaction type
      if (transaction.type === 'queued') {
        // Cancel timelock transaction
        const timelock = contracts.timelock.connect(signer);
        
        // Get current gas price with slight boost
        const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% boost
        
        // Estimate gas with fallback
        const gasEstimate = await timelock.estimateGas.cancelTransaction(transaction.id)
          .catch(() => ethers.BigNumber.from("500000")); // 500k gas fallback
        
        // Add 50% buffer to gas estimate
        const gasLimit = gasEstimate.mul(150).div(100);
        
        const tx = await timelock.cancelTransaction(transaction.id, {
          gasLimit,
          gasPrice
        });
        
        await tx.wait();
      } else {
        // Cancel proposal (active or succeeded)
        const governance = contracts.governance.connect(signer);
        
        // Get current gas price with slight boost  
        const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% boost
        
        // Estimate gas with fallback
        const gasEstimate = await governance.estimateGas.cancelProposal(transaction.proposalId)
          .catch(() => ethers.BigNumber.from("500000")); // 500k gas fallback
        
        // Add 50% buffer to gas estimate
        const gasLimit = gasEstimate.mul(150).div(100);
        
        const tx = await governance.cancelProposal(transaction.proposalId, {
          gasLimit,
          gasPrice
        });
        
        await tx.wait();
      }
      
      // Refresh the pending transactions list
      setPendingTransactions(pendingTransactions.filter(t => t.id !== transaction.id));
      
      setSuccessMessage("Transaction cancelled successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      setErrorMessage(error.message || 'Failed to cancel transaction');
    } finally {
      setTxLoading(false);
    }
  };
  
  // Queue a succeeded proposal
  const queueProposal = async (proposalId) => {
    setErrorMessage('');
    setSuccessMessage('');
    setTxLoading(true);
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const governance = contracts.governance.connect(signer);
      
      // Get current gas price with slight boost
      const gasPrice = (await provider.getGasPrice()).mul(120).div(100); // 20% boost
      
      // Estimate gas with generous fallback (queueing can be expensive)
      const gasEstimate = await governance.estimateGas.queueProposal(proposalId)
        .catch(() => ethers.BigNumber.from("3000000")); // 3M gas fallback
      
      // Add 100% buffer to gas estimate
      const gasLimit = gasEstimate.mul(200).div(100);
      
      console.log(`Queueing proposal ${proposalId} with gas limit ${gasLimit}`);
      
      const tx = await governance.queueProposal(proposalId, {
        gasLimit,
        gasPrice
      });
      
      await tx.wait();
      
      setSuccessMessage(`Proposal #${proposalId} queued successfully`);
      
      // Refresh the list after queueing
      await loadAllTransactions();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error queueing proposal:", error);
      setErrorMessage(error.message || 'Failed to queue proposal');
    } finally {
      setTxLoading(false);
    }
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return formatRelativeTime(date);
  };

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
      
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <ArrowRight className="w-5 h-5 text-indigo-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Pending Transactions</h3>
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
                  <tr key={tx.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tx.description || `Proposal #${tx.proposalId}`}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.type === 'queued' ? (
                        <span title={tx.target}>
                          {formatAddress(tx.target)}
                        </span>
                      ) : (
                        <span className="capitalize">{tx.type}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.type === 'queued' ? formatDate(tx.eta) : formatDate(tx.deadline)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeStyle(tx)}`}>
                        {getStatusText(tx)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {tx.type === 'queued' ? (
                          // Actions for queued proposals in timelock
                          <>
                            {tx.isExpired ? (
                              <button
                                className="px-3 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium hover:bg-orange-200 transition-colors"
                                onClick={() => executeExpiredTransaction(tx.id)}
                                disabled={txLoading}
                              >
                                Execute Expired
                              </button>
                            ) : tx.canExecute ? (
                              <button
                                className="px-3 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium hover:bg-green-200 transition-colors"
                                onClick={() => executeTransaction(tx.id)}
                                disabled={txLoading}
                              >
                                Execute
                              </button>
                            ) : (
                              <button
                                className="px-3 py-1 bg-gray-100 text-gray-400 rounded-md text-xs font-medium cursor-not-allowed"
                                disabled={true}
                                title="Not yet ready to execute"
                              >
                                Execute
                              </button>
                            )}
                          </>
                        ) : tx.type === 'succeeded' ? (
                          // Action for succeeded proposals
                          <button
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium hover:bg-blue-200 transition-colors"
                            onClick={() => queueProposal(tx.proposalId)}
                            disabled={txLoading}
                          >
                            Queue
                          </button>
                        ) : null}
                        
                        {/* Cancel button for all transaction types */}
                        <button
                          className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium hover:bg-red-200 transition-colors"
                          onClick={() => cancelTransaction(tx)}
                          disabled={txLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Voting stats section for selected transactions */}
      {pendingTransactions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Voting Stats</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingTransactions
              .filter(tx => tx.type === 'active' || tx.type === 'succeeded')
              .map(tx => (
                <div key={`stats-${tx.id}`} className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">
                    {tx.description || `Proposal #${tx.proposalId}`}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Yes Votes:</span>
                      <span className="font-medium text-green-600">{tx.yesVotes || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">No Votes:</span>
                      <span className="font-medium text-red-600">{tx.noVotes || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Abstain:</span>
                      <span className="font-medium text-blue-600">{tx.abstainVotes || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">
                        {(tx.yesVotes || 0) + (tx.noVotes || 0) + (tx.abstainVotes || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        tx.type === 'succeeded' 
                          ? 'text-green-600' 
                          : tx.type === 'active' 
                            ? 'text-blue-600' 
                            : 'text-gray-600'
                      }`}>
                        {tx.type === 'succeeded' 
                          ? 'Succeeded' 
                          : tx.type === 'active' 
                            ? 'Voting' 
                            : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingTransactionsTab;
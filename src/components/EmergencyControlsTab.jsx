import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Shield, AlertCircle, Lock, X, Check, Wallet, Ban, RefreshCw } from 'lucide-react';
import Loader from './Loader';

const EmergencyControlsTab = ({ contracts, account, hasRole, darkMode }) => {
  const [contractStatus, setContractStatus] = useState({
    governance: {
      paused: false,
      lastPausedBy: '',
      lastPauseTimestamp: null
    },
    token: {
      paused: false,
      lastPausedBy: '',
      lastPauseTimestamp: null
    },
    timelock: {
      paused: false,
      lastPausedBy: '',
      lastPauseTimestamp: null
    }
  });
  
  const [emergencyLog, setEmergencyLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [tokenOperationsExpanded, setTokenOperationsExpanded] = useState(true);
  const [governanceOperationsExpanded, setGovernanceOperationsExpanded] = useState(true);
  const [timelockOperationsExpanded, setTimelockOperationsExpanded] = useState(true);
  
  // Use ref to track mount state
  const isMounted = useRef(true);
  const dataLoaded = useRef(false);
  
  // Debug contracts - only run once when component mounts
  useEffect(() => {
    console.log("Contracts received:", contracts);
    console.log("Contract keys:", Object.keys(contracts || {}));
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [contracts]);
  
  // Get contract references with fallbacks for different naming conventions
  const getContractRefs = useCallback(() => {
    if (!contracts) return { governance: null, token: null, timelock: null };
    
    return {
      governance: contracts.governance || contracts.justGovernance || contracts.JustGovernanceUpgradeable,
      token: contracts.token || contracts.justToken || contracts.JustTokenUpgradeable,
      timelock: contracts.timelock || contracts.justTimelock || contracts.JustTimelockUpgradeable
    };
  }, [contracts]);

  // Helper function to update paused status without triggering re-renders
  const updatePausedStatus = useCallback(async () => {
    if (!isMounted.current) return;
    
    const contractRefs = getContractRefs();
    
    const newStatus = { ...contractStatus };
    let hasChanges = false;
    
    if (contractRefs.governance) {
      try {
        const isPaused = await contractRefs.governance.paused();
        if (newStatus.governance.paused !== isPaused) {
          newStatus.governance.paused = isPaused;
          hasChanges = true;
        }
      } catch (error) {
        console.error("Error checking governance pause status:", error);
      }
    }
    
    if (contractRefs.token) {
      try {
        const isPaused = await contractRefs.token.paused();
        if (newStatus.token.paused !== isPaused) {
          newStatus.token.paused = isPaused;
          hasChanges = true;
        }
      } catch (error) {
        console.error("Error checking token pause status:", error);
      }
    }
    
    if (contractRefs.timelock) {
      try {
        const isPaused = await contractRefs.timelock.paused();
        if (newStatus.timelock.paused !== isPaused) {
          newStatus.timelock.paused = isPaused;
          hasChanges = true;
        }
      } catch (error) {
        console.error("Error checking timelock pause status:", error);
      }
    }
    
    if (hasChanges && isMounted.current) {
      setContractStatus(newStatus);
    }
  }, [getContractRefs, contractStatus]);

  // Load contract statuses - but only once and with proper dependencies
  useEffect(() => {
    if (dataLoaded.current) return;
    
    const loadEmergencyStatus = async () => {
      const contractRefs = getContractRefs();
      
      if (!contractRefs.governance && !contractRefs.token && !contractRefs.timelock) {
        console.warn("No contracts available:", contracts);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Create a copy of the current status
        const newStatus = { ...contractStatus };
        
        // Check governance status
        if (contractRefs.governance) {
          try {
            const isPaused = await contractRefs.governance.paused();
            newStatus.governance.paused = isPaused;
          } catch (error) {
            console.error("Error checking governance pause status:", error);
          }
        }
        
        // Check token status
        if (contractRefs.token) {
          try {
            const isPaused = await contractRefs.token.paused();
            newStatus.token.paused = isPaused;
          } catch (error) {
            console.error("Error checking token pause status:", error);
          }
        }
        
        // Check timelock status
        if (contractRefs.timelock) {
          try {
            const isPaused = await contractRefs.timelock.paused();
            newStatus.timelock.paused = isPaused;
          } catch (error) {
            console.error("Error checking timelock pause status:", error);
          }
        }
        
        if (isMounted.current) {
          setContractStatus(newStatus);
          
          // Get emergency logs for all contracts
          await loadEmergencyLog();
          dataLoaded.current = true;
        }
      } catch (error) {
        console.error("Error loading emergency status:", error);
        if (isMounted.current) {
          setErrorMessage("Failed to load emergency status");
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    const loadEmergencyLog = async () => {
      try {
        const allEvents = [];
        const contractRefs = getContractRefs();
        
        // Get pause/unpause events from all contracts
        const contractNames = ['governance', 'token', 'timelock'];
        
        for (const contractName of contractNames) {
          const contract = contractRefs[contractName];
          if (contract) {
            try {
              // Get Paused events
              const paused = await contract.queryFilter(contract.filters.Paused());
              allEvents.push(...paused.map(e => ({
                type: 'pause',
                contract: contractName,
                by: e.args && e.args.account ? e.args.account : account,
                reason: `${contractName.charAt(0).toUpperCase() + contractName.slice(1)} paused`,
                timestamp: new Date(e.blockTimestamp * 1000),
                txHash: e.transactionHash
              })));
              
              // Get Unpaused events
              const unpaused = await contract.queryFilter(contract.filters.Unpaused());
              allEvents.push(...unpaused.map(e => ({
                type: 'unpause',
                contract: contractName,
                by: e.args && e.args.account ? e.args.account : account,
                reason: `${contractName.charAt(0).toUpperCase() + contractName.slice(1)} unpaused`,
                timestamp: new Date(e.blockTimestamp * 1000),
                txHash: e.transactionHash
              })));
              
              // If we found a most recent pause event, update the last paused by
              const contractPauseEvents = paused.sort((a, b) => 
                b.blockTimestamp - a.blockTimestamp
              );
              
              if (contractPauseEvents.length > 0 && isMounted.current) {
                const lastEvent = contractPauseEvents[0];
                const pausedBy = lastEvent.args && lastEvent.args.account ? 
                  lastEvent.args.account : 'Unknown';
                
                setContractStatus(prev => ({
                  ...prev,
                  [contractName]: {
                    ...prev[contractName],
                    lastPausedBy: pausedBy,
                    lastPauseTimestamp: new Date(lastEvent.blockTimestamp * 1000)
                  }
                }));
              }
            } catch (error) {
              console.error(`Error fetching ${contractName} events:`, error);
            }
          }
        }
        
        // Sort events by timestamp (newest first)
        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        
        if (isMounted.current) {
          setEmergencyLog(allEvents);
        }
      } catch (error) {
        console.error("Error loading emergency logs:", error);
      }
    };
    
    loadEmergencyStatus();
    
    // Periodic updates for status
    const intervalId = setInterval(() => {
      if (isMounted.current && !loading) {
        updatePausedStatus();
      }
    }, 15000); // Update every 15 seconds instead of on every render
    
    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [account, contracts, getContractRefs, updatePausedStatus, loading]); // Remove contractStatus from dependencies

  // Pause a contract
  const pauseContract = async (contractName) => {
    if (!pauseReason.trim() && contractName === selectedContract) {
      setErrorMessage('Please provide a reason for the pause');
      return;
    }
    
    const contractRefs = getContractRefs();
    const contract = contractRefs[contractName];
    
    if (!contract) {
      setErrorMessage(`${contractName} contract not available`);
      return;
    }
    
    setErrorMessage('');
    setSuccessMessage('');
    setTransactionLoading(true);
    
    try {
      // Check if already paused to avoid unnecessary transactions
      const isPaused = await contract.paused();
      if (isPaused) {
        setErrorMessage(`${contractName.charAt(0).toUpperCase() + contractName.slice(1)} is already paused.`);
        setTransactionLoading(false);
        return;
      }
      
      let tx;
      
      // Set extra options with gas limit to avoid estimation errors
      const options = {
        gasLimit: 300000 // Manual gas limit
      };
      
      // Call the appropriate pause function based on contract type
      if (contractName === 'timelock') {
        console.log(`Calling setPaused(true) on ${contractName} contract`);
        tx = await contract.setPaused(true, options);
      } else {
        console.log(`Calling pause() on ${contractName} contract`);
        tx = await contract.pause(options);
      }
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`Transaction confirmed`);
      
      // Update status after successful transaction
      updatePausedStatus();
      
      // Update UI
      setContractStatus(prev => ({
        ...prev,
        [contractName]: {
          ...prev[contractName],
          paused: true,
          lastPausedBy: account,
          lastPauseTimestamp: new Date()
        }
      }));
      
      // Add to log
      setEmergencyLog(prevLog => [
        {
          type: 'pause',
          contract: contractName,
          by: account,
          reason: pauseReason.trim() || `${contractName.charAt(0).toUpperCase() + contractName.slice(1)} emergency pause`,
          timestamp: new Date(),
          txHash: tx.hash
        },
        ...prevLog
      ]);
      
      setSuccessMessage(`${contractName.charAt(0).toUpperCase() + contractName.slice(1)} paused successfully`);
      
      if (contractName === selectedContract) {
        setPauseReason('');
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (isMounted.current) {
          setSuccessMessage('');
        }
      }, 3000);
    } catch (error) {
      console.error(`Error pausing ${contractName}:`, error);
      
      // Handle specific error cases with more informative messages
      if (error.message.includes("execution reverted")) {
        if (error.data) {
          setErrorMessage(`Transaction reverted: you may not have the required role to pause this contract.`);
        } else {
          setErrorMessage(`Transaction reverted: this could be due to missing permissions or the contract is already paused.`);
        }
      } else if (error.message.includes("user rejected")) {
        setErrorMessage(`Transaction was rejected by the user.`);
      } else {
        setErrorMessage(error.message || `Failed to pause ${contractName}`);
      }
    } finally {
      if (isMounted.current) {
        setTransactionLoading(false);
      }
    }
  };
  
  // Unpause a contract
  const unpauseContract = async (contractName) => {
    const contractRefs = getContractRefs();
    const contract = contractRefs[contractName];
    
    if (!contract) {
      setErrorMessage(`${contractName} contract not available`);
      return;
    }
    
    setErrorMessage('');
    setSuccessMessage('');
    setTransactionLoading(true);
    
    try {
      // Check if already unpaused to avoid unnecessary transactions
      const isPaused = await contract.paused();
      if (!isPaused) {
        setErrorMessage(`${contractName.charAt(0).toUpperCase() + contractName.slice(1)} is already active.`);
        setTransactionLoading(false);
        return;
      }
      
      let tx;
      
      // Set extra options with gas limit to avoid estimation errors
      const options = {
        gasLimit: 300000 // Manual gas limit
      };
      
      // Call the appropriate unpause function based on contract type
      if (contractName === 'timelock') {
        console.log(`Calling setPaused(false) on ${contractName} contract`);
        tx = await contract.setPaused(false, options);
      } else {
        console.log(`Calling unpause() on ${contractName} contract`);
        tx = await contract.unpause(options);
      }
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`Transaction confirmed`);
      
      // Update status after successful transaction
      updatePausedStatus();
      
      // Update UI immediately
      setContractStatus(prev => ({
        ...prev,
        [contractName]: {
          ...prev[contractName],
          paused: false
        }
      }));
      
      // Add to log
      setEmergencyLog(prevLog => [
        {
          type: 'unpause',
          contract: contractName,
          by: account,
          reason: `${contractName.charAt(0).toUpperCase() + contractName.slice(1)} unpaused`,
          timestamp: new Date(),
          txHash: tx.hash
        },
        ...prevLog
      ]);
      
      setSuccessMessage(`${contractName.charAt(0).toUpperCase() + contractName.slice(1)} unpaused successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (isMounted.current) {
          setSuccessMessage('');
        }
      }, 3000);
    } catch (error) {
      console.error(`Error unpausing ${contractName}:`, error);
      
      // Handle specific error cases with more informative messages
      if (error.message.includes("execution reverted")) {
        if (error.data) {
          setErrorMessage(`Transaction reverted: you may not have the required role to unpause this contract.`);
        } else {
          setErrorMessage(`Transaction reverted: this could be due to missing permissions or the contract is already active.`);
        }
      } else if (error.message.includes("user rejected")) {
        setErrorMessage(`Transaction was rejected by the user.`);
      } else {
        setErrorMessage(error.message || `Failed to unpause ${contractName}`);
      }
    } finally {
      if (isMounted.current) {
        setTransactionLoading(false);
      }
    }
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleString();
  };
  
  // Format address
  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Card component for consistent styling
  const Card = ({ children, className = "" }) => {
    return (
      <div className={`bg-white p-6 rounded-lg shadow mb-6 dark:bg-gray-800 dark:shadow-gray-700 dark:border dark:border-gray-700 ${className}`}>
        {children}
      </div>
    );
  };

  return (
    <div className="dark:bg-gray-900">
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Emergency Controls</h2>
        <p className="text-gray-500 dark:text-gray-400">Guardian and emergency management functions</p>
      </div>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400">
          {successMessage}
        </div>
      )}
      
      {!hasRole('admin') && !hasRole('guardian') && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400">
          You do not have the required permissions to use emergency controls.
        </div>
      )}
      
      {loading ? (
        <Card>
          <Loader size="large" text="Loading emergency status..." />
        </Card>
      ) : (
        <div className="dark:bg-gray-900">
          {/* Display contract availability information */}
          {(!getContractRefs().governance && !getContractRefs().token && !getContractRefs().timelock) && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400">
              <h3 className="font-bold mb-2 dark:text-yellow-400">Contract Connection Information</h3>
              <p className="dark:text-gray-300">No contracts are currently connected. Contract references received:</p>
              <pre className="bg-yellow-50 p-2 mt-2 text-xs overflow-auto dark:bg-gray-800 dark:text-gray-300">
                {JSON.stringify(contracts, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Governance Operations Panel */}
          {getContractRefs().governance && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 text-indigo-500 mr-2 dark:text-indigo-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Governance Emergency Controls</h3>
                </div>
                <button 
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={() => setGovernanceOperationsExpanded(!governanceOperationsExpanded)}
                >
                  {governanceOperationsExpanded ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              </div>

              {governanceOperationsExpanded && (
                <>
                  <div className="text-sm text-gray-600 mb-4 dark:text-gray-300 dark:bg-gray-800 dark:p-3 dark:rounded-md">
                    <p className="mb-2">
                      <strong className="dark:text-red-400">Warning:</strong> Pausing the governance contract will prevent all proposal submissions, voting, and execution.
                      This should only be used in emergency situations such as:
                    </p>
                    <ul className="list-disc pl-5 mb-3">
                      <li>Governance attack in progress</li>
                      <li>Critical vulnerability detected</li>
                      <li>Protocol upgrade emergency</li>
                      <li>Malicious proposal detection</li>
                    </ul>
                    <p>Ongoing votes may be affected and proposal execution will be blocked while governance is paused.</p>
                  </div>

                  <div className="bg-gray-100 p-4 rounded-lg mb-4 dark:bg-gray-700">
                    <div className="flex items-center mb-2">
                      <h4 className="font-medium dark:text-white">Current Governance Status:</h4>
                      <div className={`ml-3 py-1 px-3 inline-block rounded-full text-sm ${contractStatus.governance.paused ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {contractStatus.governance.paused ? 'PAUSED' : 'ACTIVE'}
                      </div>
                    </div>
                    
                    {contractStatus.governance.paused && contractStatus.governance.lastPausedBy && (
                      <div className="text-sm">
                        <p className="text-gray-600 dark:text-gray-300">Paused By: {formatAddress(contractStatus.governance.lastPausedBy)}</p>
                        {contractStatus.governance.lastPauseTimestamp && (
                          <p className="text-gray-600 dark:text-gray-300">Paused At: {formatDate(contractStatus.governance.lastPauseTimestamp)}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {(hasRole('admin') || hasRole('guardian')) && (
                    <div className="flex justify-between items-center">
                      <div>
                        {contractStatus.governance.paused ? (
                          hasRole('admin') ? (
                            <button
                              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium disabled:bg-green-300 flex items-center dark:bg-green-600 dark:hover:bg-green-700 dark:disabled:bg-green-800/50"
                              onClick={() => unpauseContract('governance')}
                              disabled={transactionLoading}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Unpause Governance
                            </button>
                          ) : (
                            <div className="text-amber-700 bg-amber-50 px-4 py-2 rounded-md border border-amber-200 flex items-center dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Only Admin can unpause
                            </div>
                          )
                        ) : (
                          <button
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium disabled:bg-red-300 flex items-center dark:bg-red-600 dark:hover:bg-red-700 dark:disabled:bg-red-800/50"
                            onClick={() => {
                              setSelectedContract('governance');
                              setPauseReason('');
                            }}
                            disabled={transactionLoading}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Pause Governance
                          </button>
                        )}
                      </div>
                      
                      {!contractStatus.governance.paused && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <p>Pausing requires {hasRole('guardian') ? 'Guardian or Admin' : 'Admin'} role</p>
                          <p>Unpausing requires Admin role</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
          
          {/* Token Operations Panel */}
          {getContractRefs().token && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Wallet className="w-5 h-5 text-indigo-500 mr-2 dark:text-indigo-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Token Emergency Controls</h3>
                </div>
                <button 
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={() => setTokenOperationsExpanded(!tokenOperationsExpanded)}
                >
                  {tokenOperationsExpanded ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              </div>

              {tokenOperationsExpanded && (
                <>
                  <div className="text-sm text-gray-600 mb-4 dark:text-gray-300 dark:bg-gray-800 dark:p-3 dark:rounded-md">
                    <p className="mb-2">
                      <strong className="dark:text-red-400">Warning:</strong> Pausing the token contract will prevent all token transfers, minting, and burning operations.
                      This should only be used in emergency situations such as:
                    </p>
                    <ul className="list-disc pl-5 mb-3">
                      <li>Detected security vulnerabilities</li>
                      <li>Suspicious transaction patterns</li>
                      <li>Governance attacks</li>
                      <li>DAO emergency maintenance</li>
                    </ul>
                    <p>Token holders will be unable to transfer their tokens while the contract is paused.</p>
                  </div>

                  <div className="bg-gray-100 p-4 rounded-lg mb-4 dark:bg-gray-700">
                    <div className="flex items-center mb-2">
                      <h4 className="font-medium dark:text-white">Current Token Status:</h4>
                      <div className={`ml-3 py-1 px-3 inline-block rounded-full text-sm ${contractStatus.token.paused ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {contractStatus.token.paused ? 'PAUSED' : 'ACTIVE'}
                      </div>
                    </div>
                    
                    {contractStatus.token.paused && contractStatus.token.lastPausedBy && (
                      <div className="text-sm">
                        <p className="text-gray-600 dark:text-gray-300">Paused By: {formatAddress(contractStatus.token.lastPausedBy)}</p>
                        {contractStatus.token.lastPauseTimestamp && (
                          <p className="text-gray-600 dark:text-gray-300">Paused At: {formatDate(contractStatus.token.lastPauseTimestamp)}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {(hasRole('admin') || hasRole('guardian')) && (
                    <div className="flex justify-between items-center">
                      <div>
                        {contractStatus.token.paused ? (
                          hasRole('admin') ? (
                            <button
                              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium disabled:bg-green-300 flex items-center dark:bg-green-600 dark:hover:bg-green-700 dark:disabled:bg-green-800/50"
                              onClick={() => unpauseContract('token')}
                              disabled={transactionLoading}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Unpause Token Operations
                            </button>
                          ) : (
                            <div className="text-amber-700 bg-amber-50 px-4 py-2 rounded-md border border-amber-200 flex items-center dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Only Admin can unpause
                            </div>
                          )
                        ) : (
                          <button
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium disabled:bg-red-300 flex items-center dark:bg-red-600 dark:hover:bg-red-700 dark:disabled:bg-red-800/50"
                            onClick={() => {
                              setSelectedContract('token');
                              setPauseReason('');
                            }}
                            disabled={transactionLoading}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Pause Token Operations
                          </button>
                        )}
                      </div>
                      
                      {!contractStatus.token.paused && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <p>Pausing requires {hasRole('guardian') ? 'Guardian or Admin' : 'Admin'} role</p>
                          <p>Unpausing requires Admin role</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
          
          {/* Timelock Operations Panel */}
          {getContractRefs().timelock && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Lock className="w-5 h-5 text-indigo-500 mr-2 dark:text-indigo-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Timelock Emergency Controls</h3>
                </div>
                <button 
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={() => setTimelockOperationsExpanded(!timelockOperationsExpanded)}
                >
                  {timelockOperationsExpanded ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              </div>

              {timelockOperationsExpanded && (
                <>
                  <div className="text-sm text-gray-600 mb-4 dark:text-gray-300 dark:bg-gray-800 dark:p-3 dark:rounded-md">
                    <p className="mb-2">
                      <strong className="dark:text-red-400">Warning:</strong> Pausing the timelock contract will prevent the execution of any queued transactions.
                      This should only be used in emergency situations such as:
                    </p>
                    <ul className="list-disc pl-5 mb-3">
                      <li>Malicious proposal in timelock queue</li>
                      <li>Critical security issue detected</li>
                      <li>Protocol upgrade complication</li>
                      <li>System-wide emergency</li>
                    </ul>
                    <p>Transactions in the timelock queue will be unable to be executed until the timelock is unpaused.</p>
                  </div>

                  <div className="bg-gray-100 p-4 rounded-lg mb-4 dark:bg-gray-700">
                    <div className="flex items-center mb-2">
                      <h4 className="font-medium dark:text-white">Current Timelock Status:</h4>
                      <div className={`ml-3 py-1 px-3 inline-block rounded-full text-sm ${contractStatus.timelock.paused ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {contractStatus.timelock.paused ? 'PAUSED' : 'ACTIVE'}
                      </div>
                    </div>
                    
                    {contractStatus.timelock.paused && contractStatus.timelock.lastPausedBy && (
                      <div className="text-sm">
                        <p className="text-gray-600 dark:text-gray-300">Paused By: {formatAddress(contractStatus.timelock.lastPausedBy)}</p>
                        {contractStatus.timelock.lastPauseTimestamp && (
                          <p className="text-gray-600 dark:text-gray-300">Paused At: {formatDate(contractStatus.timelock.lastPauseTimestamp)}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {(hasRole('admin') || hasRole('guardian')) && (
                    <div className="flex justify-between items-center">
                      <div>
                        {contractStatus.timelock.paused ? (
                          hasRole('admin') ? (
                            <button
                              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium disabled:bg-green-300 flex items-center dark:bg-green-600 dark:hover:bg-green-700 dark:disabled:bg-green-800/50"
                              onClick={() => unpauseContract('timelock')}
                              disabled={transactionLoading}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Unpause Timelock
                            </button>
                          ) : (
                            <div className="text-amber-700 bg-amber-50 px-4 py-2 rounded-md border border-amber-200 flex items-center dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Only Admin can unpause
                            </div>
                          )
                        ) : (
                          <button
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium disabled:bg-red-300 flex items-center dark:bg-red-600 dark:hover:bg-red-700 dark:disabled:bg-red-800/50"
                            onClick={() => {
                              setSelectedContract('timelock');
                              setPauseReason('');
                            }}
                            disabled={transactionLoading}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Pause Timelock
                          </button>
                        )}
                      </div>
                      
                      {!contractStatus.timelock.paused && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <p>Pausing requires {hasRole('guardian') ? 'Guardian or Admin' : 'Admin'} role</p>
                          <p>Unpausing requires Admin role</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
          
          {/* Pause Control Panel */}
          {selectedContract && !contractStatus[selectedContract].paused && (hasRole('admin') || hasRole('guardian')) && (
            <Card>
              <div className="flex items-center mb-4">
                <AlertCircle className="w-5 h-5 text-indigo-500 mr-2 dark:text-indigo-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Pause {selectedContract.charAt(0).toUpperCase() + selectedContract.slice(1)}
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Reason for Pause</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    rows="2"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    placeholder={`Provide a reason for pausing ${selectedContract}`}
                  ></textarea>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-red-300 dark:bg-red-600 dark:hover:bg-red-700 dark:disabled:bg-red-800/50"
                    onClick={() => pauseContract(selectedContract)}
                    disabled={transactionLoading}
                  >
                    {transactionLoading ? 'Pausing...' : 'Confirm Pause'}
                  </button>
                  
                  <button
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={() => setSelectedContract('')}
                    disabled={transactionLoading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}
          
          {/* Emergency Actions Log */}
          <Card>
            <div className="flex items-center mb-4">
              <Lock className="w-5 h-5 text-indigo-500 mr-2 dark:text-indigo-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Emergency Actions Log</h3>
            </div>
            
            {emergencyLog.length === 0 ? (
              <p className="text-center py-4 text-gray-500 dark:text-gray-300">No emergency actions recorded</p>
            ) : (
              <div className="space-y-4">
                {emergencyLog.map((log, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border ${log.type === 'pause' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-gray-700 dark:text-gray-200' : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                    <div className="flex items-center mb-2">
                      {log.type === 'pause' ? (
                        <X className={`w-5 h-5 mr-2 ${log.type === 'pause' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`} />
                      ) : (
                        <Check className={`w-5 h-5 mr-2 ${log.type === 'pause' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`} />
                      )}
                      <span className="font-medium dark:text-white">{log.contract.charAt(0).toUpperCase() + log.contract.slice(1)} {log.type === 'pause' ? 'Paused' : 'Unpaused'}</span>
                      <span className="text-sm text-gray-500 ml-auto dark:text-gray-400">{formatDate(log.timestamp)}</span>
                    </div>
                    <div className="text-sm">
                      <p><span className="text-gray-500 dark:text-gray-400">By:</span> <span className="dark:text-gray-300">{formatAddress(log.by)}</span></p>
                      {log.type === 'pause' && log.reason && (
                        <p className="mt-1"><span className="text-gray-500 dark:text-gray-400">Reason:</span> <span className="dark:text-gray-300">{log.reason}</span></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default EmergencyControlsTab;
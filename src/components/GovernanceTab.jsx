import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Parameter type constants for better code readability
const PARAM_TYPES = {
  VOTING_DURATION: 0,
  QUORUM: 1,
  TIMELOCK_DELAY: 2, 
  PROPOSAL_THRESHOLD: 3,
  PROPOSAL_STAKE: 4,
  DEFEATED_REFUND_PERCENTAGE: 5,
  CANCELED_REFUND_PERCENTAGE: 6,
  EXPIRED_REFUND_PERCENTAGE: 7
};

const GovernanceTab = ({ contracts, account }) => {
  // State for governance parameters
  const [govParams, setGovParams] = useState({
    votingDuration: '',
    quorum: '',
    timelockDelay: '',
    proposalThreshold: '',
    proposalStake: '',
    defeatedRefundPercentage: '',
    canceledRefundPercentage: '',
    expiredRefundPercentage: '',
    minVotingDuration: '',
    maxVotingDuration: ''
  });

  // State for token parameters
  const [tokenParams, setTokenParams] = useState({
    maxTokenSupply: '',
    minLockDuration: '',
    maxLockDuration: ''
  });

  // State for security settings
  const [securitySettings, setSecuritySettings] = useState({
    functionSelector: '',
    isSelectorAllowed: true,
    targetAddress: '',
    isTargetAllowed: true
  });

  // State for timelock address
  const [timelockAddress, setTimelockAddress] = useState('');

  // States for loading and transaction status
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [currentSection, setCurrentSection] = useState('governance');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeUpdates, setActiveUpdates] = useState({});

  // Fetch current parameters when component mounts or when refreshed
  useEffect(() => {
    if (contracts.governance && contracts.justToken) {
      fetchCurrentParameters();
    }
  }, [contracts, account, refreshTrigger]);

  const fetchCurrentParameters = async () => {
    if (!contracts.governance || !contracts.justToken) return;
    
    setLoading(true);
    try {
      // Fetch governance parameters
      const params = await contracts.governance.govParams();
      const minVotingDuration = await contracts.governance.minVotingDuration();
      const maxVotingDuration = await contracts.governance.maxVotingDuration();
      
      setGovParams({
        votingDuration: params.votingDuration.toString(),
        quorum: ethers.utils.formatEther(params.quorum),
        timelockDelay: params.timelockDelay.toString(),
        proposalThreshold: ethers.utils.formatEther(params.proposalCreationThreshold),
        proposalStake: ethers.utils.formatEther(params.proposalStake),
        defeatedRefundPercentage: params.defeatedRefundPercentage.toString(),
        canceledRefundPercentage: params.canceledRefundPercentage.toString(),
        expiredRefundPercentage: params.expiredRefundPercentage.toString(),
        minVotingDuration: minVotingDuration.toString(),
        maxVotingDuration: maxVotingDuration.toString()
      });

      // Fetch token parameters
      const maxSupply = await contracts.justToken.maxTokenSupply();
      const minLock = await contracts.justToken.minLockDuration();
      const maxLock = await contracts.justToken.maxLockDuration();
      
      setTokenParams({
        maxTokenSupply: ethers.utils.formatEther(maxSupply),
        minLockDuration: minLock.toString(),
        maxLockDuration: maxLock.toString()
      });

      // Fetch timelock address
      const timelock = await contracts.justToken.timelock();
      setTimelockAddress(timelock);
    } catch (error) {
      console.error("Error fetching parameters:", error);
      setTxStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler for updating governance parameters
  const handleUpdateGovParam = async (paramType, newValue, paramName) => {
    if (!contracts.governance) return;
    
    setActiveUpdates(prev => ({ ...prev, [paramName]: true }));
    setLoading(true);
    setTxStatus('Submitting transaction...');
    
    try {
      let valueToSubmit;
      
      // Format the value based on parameter type
      if (paramType === PARAM_TYPES.VOTING_DURATION || paramType === PARAM_TYPES.TIMELOCK_DELAY) {
        // Time parameters - use BigNumber
        valueToSubmit = ethers.BigNumber.from(newValue);
      } else if (paramType === PARAM_TYPES.QUORUM || paramType === PARAM_TYPES.PROPOSAL_THRESHOLD || paramType === PARAM_TYPES.PROPOSAL_STAKE) {
        // Token amount parameters - use parseEther for proper formatting
        valueToSubmit = ethers.utils.parseEther(newValue);
      } else {
        // Percentage parameters - ensure within 0-100 range
        if (newValue < 0 || newValue > 100) {
          throw new Error("Percentage must be between 0 and 100");
        }
        valueToSubmit = ethers.BigNumber.from(newValue);
      }
      
      const tx = await contracts.governance.updateGovParam(paramType, valueToSubmit);
      setTxStatus('Transaction submitted. Waiting for confirmation...');
      
      await tx.wait();
      setTxStatus(`${paramName} updated successfully!`);
      
      // Refresh the parameters
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error updating parameter:", error);
      setTxStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear active update after a delay
      setTimeout(() => {
        setActiveUpdates(prev => ({ ...prev, [paramName]: false }));
        setTxStatus('');
      }, 3000);
    }
  };

  // Handler for updating security settings
  const handleUpdateSecurity = async () => {
    if (!contracts.governance) return;
    
    setLoading(true);
    setTxStatus('Updating settings...');
    
    try {
      // Format the function selector
      let selector = securitySettings.functionSelector;
      if (selector && !selector.startsWith('0x')) {
        selector = `0x${selector}`;
      }
      
      // Use empty bytes4 if no selector provided
      if (!selector) {
        selector = '0x00000000';
      }
      
      const tx = await contracts.governance.updateSecurity(
        selector,
        securitySettings.isSelectorAllowed,
        securitySettings.targetAddress || ethers.constants.AddressZero,
        securitySettings.isTargetAllowed
      );
      
      setTxStatus('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Settings updated successfully!');
      
      // Reset the form
      setSecuritySettings({
        functionSelector: '',
        isSelectorAllowed: true,
        targetAddress: '',
        isTargetAllowed: true
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      setTxStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear status after a delay
      setTimeout(() => setTxStatus(''), 3000);
    }
  };

  // Handler for updating max token supply
  const handleUpdateMaxTokenSupply = async () => {
    if (!contracts.justToken) return;
    
    setActiveUpdates(prev => ({ ...prev, maxTokenSupply: true }));
    setLoading(true);
    setTxStatus('Updating max token supply...');
    
    try {
      const valueInWei = ethers.utils.parseEther(tokenParams.maxTokenSupply);
      const tx = await contracts.justToken.setMaxTokenSupply(valueInWei);
      
      setTxStatus('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Max token supply updated successfully!');
      
      // Refresh the parameters
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error updating max token supply:", error);
      setTxStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear active update after a delay
      setTimeout(() => {
        setActiveUpdates(prev => ({ ...prev, maxTokenSupply: false }));
        setTxStatus('');
      }, 3000);
    }
  };

  // Handler for updating timelock address
  const handleUpdateTimelock = async () => {
    if (!contracts.justToken) return;
    
    setActiveUpdates(prev => ({ ...prev, timelock: true }));
    setLoading(true);
    setTxStatus('Updating timelock address...');
    
    try {
      const tx = await contracts.justToken.setTimelock(timelockAddress);
      
      setTxStatus('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Timelock address updated successfully!');
      
      // Refresh the parameters
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error updating timelock address:", error);
      setTxStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear active update after a delay
      setTimeout(() => {
        setActiveUpdates(prev => ({ ...prev, timelock: false }));
        setTxStatus('');
      }, 3000);
    }
  };

  // Helper function to render a parameter input with label and update button
  const renderParamInput = (label, value, onChange, onSubmit, paramName, disabled = false, description = null) => {
    const isUpdating = activeUpdates[paramName];
    
    return (
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex-1 mb-3 md:mb-0 md:mr-4">
            <label className="block text-sm font-semibold text-gray-700">{label}</label>
            {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
          </div>
          <div className="flex flex-1 rounded-md">
            <input
              type="text"
              value={value}
              onChange={onChange}
              disabled={disabled || isUpdating}
              className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || loading || isUpdating}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white 
                ${isUpdating ? 'bg-green-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'} 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200`}
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Update
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render read-only parameter
  const renderReadOnlyParam = (label, value, description = null) => (
    <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      <input
        type="text"
        value={value}
        disabled={true}
        className="mt-2 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm bg-gray-50 focus:outline-none sm:text-sm"
      />
    </div>
  );

  // Section header component
  const SectionHeader = ({ title, description }) => (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with instructions */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-indigo-700 to-purple-800">
          <h2 className="text-xl font-semibold text-white">Governance Parameters</h2>
          <p className="mt-1 max-w-2xl text-sm text-indigo-100">
            Manage and update protocol parameters to adapt the governance system to the community's needs.
          </p>
        </div>
        
        {/* Status message */}
        {txStatus && (
          <div className={`m-4 p-4 rounded-md flex items-center ${txStatus.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {txStatus.includes('Error') ? (
              <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{txStatus}</span>
          </div>
        )}
        
        {/* Section Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex px-4 space-x-8 overflow-x-auto">
            <button
              onClick={() => setCurrentSection('governance')}
              className={`${
                currentSection === 'governance'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Governance Parameters
              </div>
            </button>
            <button
              onClick={() => setCurrentSection('token')}
              className={`${
                currentSection === 'token'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Token Parameters
              </div>
            </button>
            <button
              onClick={() => setCurrentSection('security')}
              className={`${
                currentSection === 'security'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Selectors & Addresses
              </div>
            </button>
          </nav>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          {/* Governance Parameters Section */}
          {currentSection === 'governance' && (
            <div className="space-y-6">
              <SectionHeader 
                title="Voting Parameters" 
                description="Control how voting periods and thresholds function"
              />
              
              {renderParamInput(
                "Voting Duration (seconds)",
                govParams.votingDuration,
                (e) => setGovParams({ ...govParams, votingDuration: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.VOTING_DURATION, govParams.votingDuration, "votingDuration"),
                "votingDuration",
                loading,
                `Must be between ${govParams.minVotingDuration} and ${govParams.maxVotingDuration} seconds`
              )}
              
              {renderParamInput(
                "Quorum (tokens)",
                govParams.quorum,
                (e) => setGovParams({ ...govParams, quorum: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.QUORUM, govParams.quorum, "quorum"),
                "quorum",
                loading,
                "Minimum number of tokens that must participate in a vote for it to be valid"
              )}
              
              <SectionHeader 
                title="Proposal Creation" 
                description="Parameters that control proposal creation"
              />
              
              {renderParamInput(
                "Proposal Threshold (tokens)",
                govParams.proposalThreshold,
                (e) => setGovParams({ ...govParams, proposalThreshold: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.PROPOSAL_THRESHOLD, govParams.proposalThreshold, "proposalThreshold"),
                "proposalThreshold",
                loading,
                "Minimum tokens required to create a proposal"
              )}
              
              {renderParamInput(
                "Proposal Stake (tokens)",
                govParams.proposalStake,
                (e) => setGovParams({ ...govParams, proposalStake: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.PROPOSAL_STAKE, govParams.proposalStake, "proposalStake"),
                "proposalStake",
                loading,
                "Tokens that must be staked to create a proposal"
              )}
              
              <SectionHeader 
                title="Refund Percentages" 
                description="Control how much of the proposal stake gets refunded in different scenarios"
              />
              
              {renderParamInput(
                "Defeated Proposal Refund Percentage (0-100)",
                govParams.defeatedRefundPercentage,
                (e) => setGovParams({ ...govParams, defeatedRefundPercentage: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.DEFEATED_REFUND_PERCENTAGE, govParams.defeatedRefundPercentage, "defeatedRefundPercentage"),
                "defeatedRefundPercentage",
                loading,
                "Percentage of stake refunded for defeated proposals"
              )}
              
              {renderParamInput(
                "Canceled Proposal Refund Percentage (0-100)",
                govParams.canceledRefundPercentage,
                (e) => setGovParams({ ...govParams, canceledRefundPercentage: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.CANCELED_REFUND_PERCENTAGE, govParams.canceledRefundPercentage, "canceledRefundPercentage"),
                "canceledRefundPercentage",
                loading,
                "Percentage of stake refunded for canceled proposals"
              )}
              
              {renderParamInput(
                "Expired Proposal Refund Percentage (0-100)",
                govParams.expiredRefundPercentage,
                (e) => setGovParams({ ...govParams, expiredRefundPercentage: e.target.value }),
                () => handleUpdateGovParam(PARAM_TYPES.EXPIRED_REFUND_PERCENTAGE, govParams.expiredRefundPercentage, "expiredRefundPercentage"),
                "expiredRefundPercentage",
                loading,
                "Percentage of stake refunded for expired proposals"
              )}
            </div>
          )}
          
          {/* Token Parameters Section */}
          {currentSection === 'token' && (
            <div className="space-y-6">
              <SectionHeader 
                title="Token Supply" 
                description="Control the maximum supply of the governance token"
              />
              
              {renderParamInput(
                "Maximum Token Supply",
                tokenParams.maxTokenSupply,
                (e) => setTokenParams({ ...tokenParams, maxTokenSupply: e.target.value }),
                handleUpdateMaxTokenSupply,
                "maxTokenSupply",
                loading,
                "Maximum total supply of tokens that can exist"
              )}
              
              <SectionHeader 
                title="Lock Durations" 
                description="Read-only parameters that can only be changed during contract initialization"
              />
              
              {renderReadOnlyParam(
                "Minimum Lock Duration",
                tokenParams.minLockDuration,
                "This parameter can only be changed during contract initialization."
              )}
              
              {renderReadOnlyParam(
                "Maximum Lock Duration",
                tokenParams.maxLockDuration,
                "This parameter can only be changed during contract initialization."
              )}
              
              <SectionHeader 
                title="Contract Addresses" 
                description="Update connected contract addresses"
              />
              
              {renderParamInput(
                "Timelock Contract Address",
                timelockAddress,
                (e) => setTimelockAddress(e.target.value),
                handleUpdateTimelock,
                "timelock",
                loading,
                "Address of the timelock contract (must be a valid contract address)"
              )}
            </div>
          )}
          
          {/* Security Settings Section */}
          {currentSection === 'security' && (
            <div className="space-y-6">
              <SectionHeader 
                title="Contract Call Permissions" 
                description="Control which functions and contracts can be called through governance"
              />
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Function Selector (bytes4)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">0x</span>
                    </div>
                    <input
                      type="text"
                      value={securitySettings.functionSelector.replace(/^0x/, '')}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, functionSelector: e.target.value.startsWith('0x') ? e.target.value : `0x${e.target.value}` })}
                      disabled={loading}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-12 sm:text-sm border-gray-300 rounded-md"
                      placeholder="a9059cbb (for transfer)"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Function selectors are the first 4 bytes of the keccak256 hash of the function signature.
                    For example, transfer(address,uint256) has selector 0xa9059cbb.
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.isSelectorAllowed}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, isSelectorAllowed: e.target.checked })}
                    disabled={loading}
                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Allow this function selector</label>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Contract Address</label>
                  <input
                    type="text"
                    value={securitySettings.targetAddress}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, targetAddress: e.target.value })}
                    disabled={loading}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    placeholder="0x..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This controls which contract addresses can be called by governance proposals.
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.isTargetAllowed}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, isTargetAllowed: e.target.checked })}
                    disabled={loading}
                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Allow this target address</label>
                </div>
                
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleUpdateSecurity}
                    disabled={loading}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Update Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GovernanceTab;
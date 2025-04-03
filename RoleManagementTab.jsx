import React, { useState, useEffect } from 'react';
import { Shield, PlusCircle, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { ethers } from 'ethers';
import Loader from './Loader';

const EnhancedRoleManagementTab = ({ contracts, account }) => {
  // All available contracts
  const availableContracts = [
    { id: 'governance', name: 'Governance', contract: contracts.governance },
    { id: 'justToken', name: 'Token', contract: contracts.justToken },
    { id: 'timelock', name: 'Timelock', contract: contracts.timelock },
    { id: 'analyticsHelper', name: 'Analytics Helper', contract: contracts.analyticsHelper },
    { id: 'daoHelper', name: 'DAO Helper', contract: contracts.daoHelper }
  ].filter(c => c.contract); // Only include contracts that exist
  
  // Role constants with actual on-chain hash values
  const roleConstants = {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    ADMIN_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE")),
    GUARDIAN_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GUARDIAN_ROLE")),
    GOVERNANCE_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE")),
    MINTER_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")),
    PROPOSER_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROPOSER_ROLE")),
    EXECUTOR_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE")),
    CANCELLER_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CANCELLER_ROLE")),
    TIMELOCK_ADMIN_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TIMELOCK_ADMIN_ROLE")),
    ANALYTICS_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ANALYTICS_ROLE"))
  };

  // Role metadata with descriptions and availability per contract
  const roleMetadata = {
    DEFAULT_ADMIN_ROLE: {
      name: 'Default Admin',
      description: 'Standard OpenZeppelin admin role with complete access control',
      availableIn: ['governance', 'justToken', 'timelock', 'analyticsHelper', 'daoHelper']
    },
    ADMIN_ROLE: {
      name: 'Admin',
      description: 'Full administrative control over the contract',
      availableIn: ['governance', 'justToken', 'timelock', 'analyticsHelper', 'daoHelper']
    },
    GUARDIAN_ROLE: {
      name: 'Guardian',
      description: 'Emergency response capabilities including pause/unpause',
      availableIn: ['governance', 'justToken', 'timelock', 'analyticsHelper', 'daoHelper']
    },
    GOVERNANCE_ROLE: {
      name: 'Governance',
      description: 'Special role for governance operations and token functionality',
      availableIn: ['justToken', 'timelock', 'governance']
    },
    MINTER_ROLE: {
      name: 'Minter',
      description: 'Can mint new tokens or authorize minting operations',
      availableIn: ['justToken', 'timelock']
    },
    PROPOSER_ROLE: {
      name: 'Proposer',
      description: 'Can create proposals in the governance system',
      availableIn: ['timelock', 'justToken', 'governance']
    },
    EXECUTOR_ROLE: {
      name: 'Executor',
      description: 'Can execute passed proposals in the timelock',
      availableIn: ['timelock']
    },
    CANCELLER_ROLE: {
      name: 'Canceller',
      description: 'Can cancel queued transactions in the timelock',
      availableIn: ['timelock']
    },
    TIMELOCK_ADMIN_ROLE: {
      name: 'Timelock Admin',
      description: 'Administrative control over the timelock contract',
      availableIn: ['timelock']
    },
    ANALYTICS_ROLE: {
      name: 'Analytics',
      description: 'Access to analytics and reporting data',
      availableIn: ['analyticsHelper', 'daoHelper']
    }
  };

  // State
  const [selectedContract, setSelectedContract] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [newRoleData, setNewRoleData] = useState({
    address: '',
    role: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState('');

  // Get roles available for the selected contract
  const getAvailableRolesForContract = (contractId) => {
    if (!contractId) return [];
    
    return Object.entries(roleMetadata)
      .filter(([roleKey, meta]) => meta.availableIn.includes(contractId))
      .map(([roleKey, meta]) => ({
        id: roleKey,
        hash: roleConstants[roleKey],
        name: meta.name,
        description: meta.description
      }));
  };

  // Initialize with the first available contract
  useEffect(() => {
    if (availableContracts.length > 0 && !selectedContract) {
      setSelectedContract(availableContracts[0].id);
    }
  }, [availableContracts, selectedContract]);

  // Direct method to check if a user has a specific role
  const checkUserHasRole = async (contract, roleHash, address) => {
    try {
      if (!contract || typeof contract.hasRole !== 'function') {
        console.error("Contract or hasRole function not available", contract);
        return false;
      }
      
      return await contract.hasRole(roleHash, address);
    } catch (error) {
      console.error(`Error checking if user has role:`, error);
      return false;
    }
  };

  // Collect known addresses that may have roles
  const getKnownAddresses = async (contract) => {
    const knownAddresses = new Set([
      account, // Current user
      contract.address, // Contract itself
    ]);

    // Hard-coded addresses that often have roles
    const hardcodedAddresses = [
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat default address
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat account #1
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Hardhat account #2
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Hardhat account #3
    ];
    
    hardcodedAddresses.forEach(addr => knownAddresses.add(addr));

    // Add contract deployer and owner if available
    try {
      if (contract.owner) {
        const owner = await contract.owner();
        if (owner) knownAddresses.add(owner);
      }
    } catch (e) {
      console.log("No owner method found", e);
    }

    // Add existing roles we've found
    roles.forEach(r => {
      if (r.address) knownAddresses.add(r.address);
    });

    return Array.from(knownAddresses);
  };

  // Load roles using direct role checking
  const loadRolesDirectly = async (contract, contractId) => {
    try {
      setLoadingDetails(`Starting direct role check for ${contractId}...`);
      
      if (!contract) {
        console.error(`Contract ${contractId} is null or undefined`);
        return [];
      }
      
      // Get all roles available for this contract
      const availableRoles = getAvailableRolesForContract(contractId);
      setLoadingDetails(`Found ${availableRoles.length} possible roles for ${contractId}`);
      
      if (availableRoles.length === 0) {
        return [];
      }
      
      // Get addresses to check
      const knownAddresses = await getKnownAddresses(contract);
      setLoadingDetails(`Checking ${knownAddresses.length} addresses for roles in ${contractId}...`);
      
      const rolesData = [];
      
      // Check each address for each role
      let checkedCount = 0;
      const totalChecks = knownAddresses.length * availableRoles.length;
      
      for (const address of knownAddresses) {
        for (const role of availableRoles) {
          try {
            checkedCount++;
            if (checkedCount % 5 === 0) {
              setLoadingDetails(`Checked ${checkedCount}/${totalChecks} role assignments for ${contractId}...`);
            }
            
            const hasRole = await checkUserHasRole(contract, role.hash, address);
            
            if (hasRole) {
              rolesData.push({
                address,
                roleId: role.id,
                roleName: role.name,
                roleHash: role.hash,
                contractId,
                contractName: availableContracts.find(c => c.id === contractId)?.name || contractId
              });
              
              setLoadingDetails(`Found role: ${role.name} assigned to ${address.substring(0, 8)}... in ${contractId}`);
            }
          } catch (error) {
            console.error(`Error checking role ${role.id} for address ${address}:`, error);
          }
        }
      }
      
      setLoadingDetails(`Completed direct role check. Found ${rolesData.length} role assignments for ${contractId}`);
      return rolesData;
    } catch (error) {
      console.error("Error in direct role loading approach:", error);
      setLoadingDetails(`Error in direct role check: ${error.message}`);
      throw error;
    }
  };

  // Use standard role member enumeration if available
  const loadRolesUsingEnumeration = async (contract, contractId, availableRoles) => {
    try {
      setLoadingDetails(`Trying standard role enumeration for ${contractId}...`);
      
      // Make sure the contract has the necessary functions
      if (!contract || 
          typeof contract.getRoleMemberCount !== 'function' || 
          typeof contract.getRoleMember !== 'function') {
        console.warn(`Contract ${contractId} doesn't have the expected role enumeration functions`);
        setLoadingDetails(`${contractId}: Missing role enumeration functions`);
        return null;
      }
      
      const rolesData = [];
      
      // For each role, get all members
      for (const role of availableRoles) {
        try {
          setLoadingDetails(`Getting members for ${role.name} role in ${contractId}...`);
          
          const roleCount = await contract.getRoleMemberCount(role.hash);
          console.log(`Role ${role.id} has ${roleCount.toString()} members in ${contractId}`);
          
          if (roleCount.toNumber() > 0) {
            setLoadingDetails(`Found ${roleCount.toString()} members with ${role.name} role in ${contractId}`);
          }
          
          for (let i = 0; i < roleCount; i++) {
            try {
              const memberAddress = await contract.getRoleMember(role.hash, i);
              
              rolesData.push({
                address: memberAddress,
                roleId: role.id,
                roleName: role.name,
                roleHash: role.hash,
                contractId: contractId,
                contractName: availableContracts.find(c => c.id === contractId)?.name || contractId
              });
            } catch (error) {
              console.error(`Error getting member ${i} for role ${role.id}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error getting members for role ${role.id}:`, error);
          setLoadingDetails(`Error with ${role.name} role in ${contractId}: ${error.message}`);
        }
      }
      
      setLoadingDetails(`Found ${rolesData.length} role assignments using enumeration in ${contractId}`);
      return rolesData;
    } catch (error) {
      console.error("Error in role enumeration approach:", error);
      setLoadingDetails(`Error in role enumeration for ${contractId}: ${error.message}`);
      return null;
    }
  };

  // Main function to load roles for the selected contract
  const loadRoles = async () => {
    if (!selectedContract) return;
    
    setLoadingDetails('');
    setLoading(true);
    setErrorMessage('');
    setRoles([]);
    console.log(`[${new Date().toISOString()}] Loading roles for ${selectedContract}...`);
    
    try {
      // Get the contract instance
      const contract = availableContracts.find(c => c.id === selectedContract)?.contract;
      if (!contract) {
        console.error(`Contract ${selectedContract} not found or not loaded`);
        setRoles([]);
        setLoading(false);
        setErrorMessage(`Contract ${selectedContract} not found or not initialized`);
        return;
      }
      
      console.log(`Contract found: ${contract.address}`);
      setLoadingDetails(`Connected to contract at ${contract.address}`);
      
      // Get available roles for this contract
      const availableRoles = getAvailableRolesForContract(selectedContract);
      
      // Try the standard enumeration approach first
      let rolesData = await loadRolesUsingEnumeration(contract, selectedContract, availableRoles);
      
      // If standard approach failed or returned no roles, try the direct check approach
      if (!rolesData || rolesData.length === 0) {
        setLoadingDetails(`No roles found using enumeration for ${selectedContract}, trying direct role check...`);
        rolesData = await loadRolesDirectly(contract, selectedContract);
      }
      
      console.log(`Loaded ${rolesData.length} role assignments for ${selectedContract}`);
      setLoadingDetails(`Found ${rolesData.length} role assignments for ${selectedContract}`);
      setRoles(rolesData);
    } catch (error) {
      console.error("Error loading roles:", error);
      setErrorMessage("Failed to load roles: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load roles when contract selection changes or refresh is triggered
  useEffect(() => {
    if (selectedContract) {
      loadRoles();
    }
  }, [selectedContract, refreshTrigger]);

  // Handle contract selection change
  const handleContractChange = (contractId) => {
    setSelectedContract(contractId);
    setNewRoleData({
      ...newRoleData,
      role: ''
    });
  };

  // Handle granting a new role
  const handleGrantRole = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!newRoleData.address) {
      setErrorMessage('Please enter a valid address');
      return;
    }
    
    if (!newRoleData.role) {
      setErrorMessage('Please select a role');
      return;
    }
    
    // Get role hash
    const roleHash = roleConstants[newRoleData.role];
    if (!roleHash) {
      setErrorMessage('Invalid role selected');
      return;
    }
    
    // Get the contract
    const contract = availableContracts.find(c => c.id === selectedContract)?.contract;
    if (!contract) {
      setErrorMessage('Selected contract not available');
      return;
    }
    
    setTransactionLoading(true);
    try {
      // Check which function to call (grantContractRole or grantRole)
      let tx;
      if (typeof contract.grantContractRole === 'function') {
        console.log(`Using grantContractRole(${roleHash}, ${newRoleData.address})`);
        tx = await contract.grantContractRole(roleHash, newRoleData.address);
      } else if (typeof contract.grantRole === 'function') {
        console.log(`Using grantRole(${roleHash}, ${newRoleData.address})`);
        tx = await contract.grantRole(roleHash, newRoleData.address);
      } else {
        throw new Error('Contract does not support role management');
      }
      
      await tx.wait();
      
      // Show success message
      setSuccessMessage(`Successfully granted ${
        roleMetadata[newRoleData.role]?.name || newRoleData.role
      } role to ${newRoleData.address.slice(0, 8)}...`);
      
      // Close modal and reset form
      setShowAddRoleModal(false);
      setNewRoleData({
        address: '',
        role: ''
      });
      
      // Refresh roles list
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error granting role:", error);
      setErrorMessage(error.message || 'Error granting role. See console for details.');
    } finally {
      setTransactionLoading(false);
    }
  };

  // Handle revoking a role
  const handleRevokeRole = async (roleHash, address) => {
    if (!window.confirm(`Are you sure you want to revoke this role from ${address}?`)) {
      return;
    }
    
    setErrorMessage('');
    setSuccessMessage('');
    
    // Get the contract
    const contract = availableContracts.find(c => c.id === selectedContract)?.contract;
    if (!contract) {
      setErrorMessage('Selected contract not available');
      return;
    }
    
    try {
      // Check which function to call (revokeContractRole or revokeRole)
      let tx;
      if (typeof contract.revokeContractRole === 'function') {
        tx = await contract.revokeContractRole(roleHash, address);
      } else if (typeof contract.revokeRole === 'function') {
        tx = await contract.revokeRole(roleHash, address);
      } else {
        throw new Error('Contract does not support role revocation');
      }
      
      await tx.wait();
      
      // Show success message
      setSuccessMessage(`Successfully revoked role from ${address.slice(0, 8)}...`);
      
      // Refresh roles list
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error revoking role:", error);
      setErrorMessage(error.message || 'Error revoking role. See console for details.');
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold dark:text-white">
            Role Management
          </h2>
          <p className="text-gray-500">
            Assign and manage roles across DAO contracts
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 
              px-3 py-2 rounded-md flex items-center transition-colors"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
          <button 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
            onClick={() => setShowAddRoleModal(true)}
            disabled={!selectedContract}
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            Assign Role
          </button>
        </div>
      </div>
      
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-100 border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200 border px-4 py-3 rounded mb-4">
          <p>{successMessage}</p>
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-100 border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 border px-4 py-3 rounded mb-4 flex items-start">
          <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}
      
      {/* Contract Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Contract
        </label>
        <div className="flex flex-wrap gap-2">
          {availableContracts.map(contract => (
            <button 
              key={contract.id}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedContract === contract.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => handleContractChange(contract.id)}
            >
              {contract.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Debug Info */}
      {loadingDetails && (
        <div className="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200 border px-4 py-2 rounded mb-4 text-sm">
          <p><strong>Status:</strong> {loadingDetails}</p>
        </div>
      )}
      
      {/* Roles List */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Current Role Assignments for {availableContracts.find(c => c.id === selectedContract)?.name || 'Selected Contract'}
        </h3>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size="large" text="Loading roles..." />
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            No roles have been assigned for this contract or they could not be detected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {roles.map((role, idx) => (
                  <tr key={`${role.address}-${role.roleId}-${idx}`} className={idx % 2 === 0 
                    ? "bg-white dark:bg-gray-800" 
                    : "bg-gray-50 dark:bg-gray-700"}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 text-indigo-500 mr-2" />
                        <span className="text-sm font-medium dark:text-gray-200">{role.roleName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {role.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 flex items-center ml-auto"
                        onClick={() => handleRevokeRole(role.roleHash, role.address)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Assign New Role</h2>
            
            {errorMessage && (
              <div className="bg-red-100 border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 border px-4 py-3 rounded mb-4">
                <p>{errorMessage}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contract</label>
                <select 
                  className="w-full rounded-md border bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2"
                  value={selectedContract || ''}
                  onChange={(e) => handleContractChange(e.target.value)}
                >
                  <option value="" disabled>Select a contract</option>
                  {availableContracts.map(contract => (
                    <option key={contract.id} value={contract.id}>{contract.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <input 
                  type="text" 
                  className="w-full rounded-md border bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2" 
                  placeholder="0x..."
                  value={newRoleData.address}
                  onChange={(e) => setNewRoleData({...newRoleData, address: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select 
                  className="w-full rounded-md border bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2"
                  value={newRoleData.role}
                  onChange={(e) => setNewRoleData({...newRoleData, role: e.target.value})}
                >
                  <option value="" disabled>Select a role</option>
                  {getAvailableRolesForContract(selectedContract).map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {newRoleData.role && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getAvailableRolesForContract(selectedContract)
                      .find(r => r.id === newRoleData.role)?.description || ''}
                  </p>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <button 
                  type="button"
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md transition-colors"
                  onClick={() => setShowAddRoleModal(false)}
                  disabled={transactionLoading}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors"
                  onClick={handleGrantRole}
                  disabled={transactionLoading || !newRoleData.role || !newRoleData.address}
                >
                  {transactionLoading ? 'Assigning...' : 'Assign Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRoleManagementTab;
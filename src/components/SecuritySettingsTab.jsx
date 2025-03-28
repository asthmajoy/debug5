import React, { useState, useEffect } from 'react';
import { Clock, Shield, AlertTriangle } from 'lucide-react';
import Loader from './Loader';

const SecuritySettingsTab = ({ contracts }) => {
  const [securitySettings, setSecuritySettings] = useState({
    delegationDepthLimit: 8, // MAX_DELEGATION_DEPTH from JustTokenUpgradeable
    threatLevelDelays: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Load security settings
  useEffect(() => {
    const loadSecuritySettings = async () => {
      if (!contracts.timelock || !contracts.token) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Get delegation depth limit
        const maxDelegationDepth = 8; // This is a constant in the contract
        
        // Get threat level delays from timelock
        const lowDelay = await contracts.timelock.lowThreatDelay();
        const mediumDelay = await contracts.timelock.mediumThreatDelay();
        const highDelay = await contracts.timelock.highThreatDelay();
        const criticalDelay = await contracts.timelock.criticalThreatDelay();
        
        setSecuritySettings({
          delegationDepthLimit: maxDelegationDepth,
          threatLevelDelays: {
            low: lowDelay.toNumber(),
            medium: mediumDelay.toNumber(),
            high: highDelay.toNumber(),
            critical: criticalDelay.toNumber()
          }
        });
      } catch (error) {
        console.error("Error loading security settings:", error);
        setErrorMessage("Failed to load security settings");
      } finally {
        setLoading(false);
      }
    };
    
    loadSecuritySettings();
  }, [contracts.timelock, contracts.token]);
  
  // Handle updating threat level delays
  const updateThreatLevelDelay = async (level, value) => {
    setErrorMessage('');
    setSuccessMessage('');
    setUpdating(true);
    
    try {
      let tx;
      
      // The contract has a single function to update all threat level delays
      if (level === 'all') {
        tx = await contracts.timelock.updateThreatLevelDelays(
          securitySettings.threatLevelDelays.low,
          securitySettings.threatLevelDelays.medium,
          securitySettings.threatLevelDelays.high,
          securitySettings.threatLevelDelays.critical
        );
      } else {
        // Error - individual updates not supported
        throw new Error('Individual threat level updates not supported');
      }
      
      await tx.wait();
      setSuccessMessage("Successfully updated threat level delays");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error(`Error updating threat level delays:`, error);
      setErrorMessage(error.message || 'Failed to update threat level delays');
    } finally {
      setUpdating(false);
    }
  };
  
  // Format time in seconds to readable format
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Security Settings</h2>
        <p className="text-gray-500">Configure security parameters for the DAO</p>
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
      
      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <Loader size="large" text="Loading security settings..." />
        </div>
      ) : (
        <>
          {/* Delegation Security */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex items-center mb-4">
              <Shield className="w-5 h-5 text-indigo-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Delegation Security</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Delegation Depth</label>
                <p className="text-sm text-gray-600">{securitySettings.delegationDepthLimit}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum delegation depth is fixed in the contract to prevent excessive chain depth.
                  This cannot be changed without a contract upgrade.
                </p>
              </div>
            </div>
          </div>
          
          {/* Threat Level Delays */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center mb-4">
              <Clock className="w-5 h-5 text-indigo-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Threat Level Delays</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                The timelock contract uses different execution delays based on the threat level of each transaction.
                Higher risk operations require longer waiting periods.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Threat Delay</label>
                  <input 
                    type="number" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={securitySettings.threatLevelDelays.low}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      threatLevelDelays: {
                        ...securitySettings.threatLevelDelays,
                        low: parseInt(e.target.value)
                      }
                    })}
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Current: {formatTime(securitySettings.threatLevelDelays.low)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medium Threat Delay</label>
                  <input 
                    type="number" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={securitySettings.threatLevelDelays.medium}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      threatLevelDelays: {
                        ...securitySettings.threatLevelDelays,
                        medium: parseInt(e.target.value)
                      }
                    })}
                    min={securitySettings.threatLevelDelays.low}
                  />
                  <p className="text-xs text-gray-500 mt-1">Current: {formatTime(securitySettings.threatLevelDelays.medium)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">High Threat Delay</label>
                  <input 
                    type="number" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={securitySettings.threatLevelDelays.high}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      threatLevelDelays: {
                        ...securitySettings.threatLevelDelays,
                        high: parseInt(e.target.value)
                      }
                    })}
                    min={securitySettings.threatLevelDelays.medium}
                  />
                  <p className="text-xs text-gray-500 mt-1">Current: {formatTime(securitySettings.threatLevelDelays.high)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Critical Threat Delay</label>
                  <input 
                    type="number" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={securitySettings.threatLevelDelays.critical}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      threatLevelDelays: {
                        ...securitySettings.threatLevelDelays,
                        critical: parseInt(e.target.value)
                      }
                    })}
                    min={securitySettings.threatLevelDelays.high}
                  />
                  <p className="text-xs text-gray-500 mt-1">Current: {formatTime(securitySettings.threatLevelDelays.critical)}</p>
                </div>
              </div>
              
              <div className="pt-4">
                <button 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md disabled:bg-indigo-400"
                  onClick={() => updateThreatLevelDelay('all')}
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update All Delays'}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Note: Changes to threat level delays must maintain the hierarchy: Low ≤ Medium ≤ High ≤ Critical.
                  Updates require a timelock transaction to be executed.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SecuritySettingsTab;
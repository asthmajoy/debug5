// src/utils/delegateConcentration.js
export class DelegateConcentrationCalculator {
  constructor(justTokenContract, justDAOHelperContract) {
    this.justToken = justTokenContract;
    this.justDAOHelper = justDAOHelperContract;
  }

  async calculateDelegateConcentration(topCount = 5) {
    try {
      // 1. Collect all addresses with delegation information
      const delegationAnalytics = await this.justDAOHelper.getDelegationAnalytics(0, 10000);
      
      // 2. Process delegation data
      const delegatePowerMap = new Map();
      
      for (let i = 0; i < delegationAnalytics[0].length; i++) {
        const delegator = delegationAnalytics[0][i];
        const delegate = delegationAnalytics[1][i];
        const votingPower = delegationAnalytics[2][i];
        
        // Skip self-delegation
        if (delegator === delegate) continue;
        
        // Aggregate voting power for each delegate
        const currentPower = delegatePowerMap.get(delegate) || '0';
        const newPower = this.safeAdd(currentPower, votingPower.toString());
        delegatePowerMap.set(delegate, newPower);
      }
      
      // 3. Sort delegates by voting power
      const sortedDelegates = Array.from(delegatePowerMap.entries())
        .sort((a, b) => this.compareBigNumbers(b[1], a[1]));
      
      // 4. Get total token supply for percentage calculation
      const totalSupply = await this.justToken.totalSupply();
      
      // 5. Prepare result arrays
      const topDelegates = [];
      const delegatedPower = [];
      const percentage = [];
      
      const resultCount = Math.min(topCount, sortedDelegates.length);
      
      for (let i = 0; i < resultCount; i++) {
        const [delegate, power] = sortedDelegates[i];
        
        topDelegates.push(delegate);
        delegatedPower.push(power);
        
        // Calculate percentage using string-based arithmetic
        const percentageValue = this.calculatePercentage(power, totalSupply);
        percentage.push(percentageValue);
      }
      
      return {
        topDelegates,
        delegatedPower,
        percentage
      };
    } catch (error) {
      console.error('Error in calculateDelegateConcentration:', error);
      return {
        topDelegates: [],
        delegatedPower: [],
        percentage: []
      };
    }
  }

  // Utility methods for large number arithmetic
  safeAdd(a, b) {
    a = (a || '0').replace(/^0+/, '');
    b = (b || '0').replace(/^0+/, '');
    
    const maxLength = Math.max(a.length, b.length);
    a = a.padStart(maxLength, '0');
    b = b.padStart(maxLength, '0');
    
    let result = '';
    let carry = 0;
    
    for (let i = maxLength - 1; i >= 0; i--) {
      const sum = parseInt(a[i], 10) + parseInt(b[i], 10) + carry;
      result = (sum % 10) + result;
      carry = Math.floor(sum / 10);
    }
    
    if (carry > 0) {
      result = carry + result;
    }
    
    return result;
  }

  compareBigNumbers(a, b) {
    a = (a || '0').replace(/^0+/, '');
    b = (b || '0').replace(/^0+/, '');
    
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return parseInt(a[i], 10) - parseInt(b[i], 10);
      }
    }
    
    return 0;
  }

  calculatePercentage(numerator, denominator) {
    numerator = (numerator || '0').replace(/^0+/, '');
    denominator = (denominator || '1').toString().replace(/^0+/, '');
    
    const multiplied = this.multiplyBigNumbers(numerator, '10000');
    const result = this.divideBigNumbers(multiplied, denominator);
    
    return parseInt(result, 10);
  }

  multiplyBigNumbers(a, b) {
    if (a === '0' || b === '0') return '0';
    
    const result = new Array(a.length + b.length).fill(0);
    
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        const product = parseInt(a[i], 10) * parseInt(b[j], 10);
        const sum = product + result[i + j + 1];
        
        result[i + j + 1] = sum % 10;
        result[i + j] += Math.floor(sum / 10);
      }
    }
    
    while (result[0] === 0) {
      result.shift();
    }
    
    return result.join('');
  }

  divideBigNumbers(numerator, denominator) {
    if (numerator === '0') return '0';
    if (denominator === '0') throw new Error('Division by zero');
    
    numerator = numerator.replace(/^0+/, '');
    denominator = denominator.replace(/^0+/, '');
    
    const result = Math.floor(
      parseInt(numerator, 10) / parseInt(denominator, 10)
    );
    
    return result.toString();
  }
}

// Optional utility function for easy usage
export async function getTopDelegateConcentration(
  justTokenContract, 
  justDAOHelperContract, 
  topCount = 5
) {
  try {
    const calculator = new DelegateConcentrationCalculator(
      justTokenContract, 
      justDAOHelperContract
    );
    
    return await calculator.calculateDelegateConcentration(topCount);
  } catch (error) {
    console.error('Error calculating delegate concentration:', error);
    return {
      topDelegates: [],
      delegatedPower: [],
      percentage: []
    };
  }
}
class BlockchainDataCache {
  constructor(maxSize = 100, ttl = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl; // Default TTL in milliseconds (1 minute)
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0
    };
  }

  /**
   * Set a value in the cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number} [customTtl] - Custom TTL in milliseconds
   */
  set(key, value, customTtl) {
    // Check if we need to evict items
    if (this.cache.size >= this.maxSize) {
      this._evictOldest();
    }

    const ttl = customTtl || this.ttl;
    const expires = Date.now() + ttl;
    
    // Save value with metadata
    this.cache.set(key, {
      value,
      expires,
      created: Date.now(),
      lastAccessed: Date.now()
    });
    
    this.stats.size = this.cache.size;
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or null if not found or expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    // Return null if item doesn't exist
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // Check if item has expired
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }
    
    // Update last accessed time
    item.lastAccessed = Date.now();
    this.stats.hits++;
    
    return item.value;
  }

  /**
   * Delete an item from the cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Evict the oldest item from the cache
   * @private
   */
  _evictOldest() {
    // Find oldest accessed item
    let oldestKey = null;
    let oldestAccessed = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestAccessed) {
        oldestAccessed = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
  
  /**
   * Refresh an item's TTL in the cache
   * @param {string} key - Cache key
   * @param {number} [customTtl] - Custom TTL in milliseconds
   */
  refresh(key, customTtl) {
    const item = this.cache.get(key);
    
    if (item) {
      const ttl = customTtl || this.ttl;
      item.expires = Date.now() + ttl;
      item.lastAccessed = Date.now();
    }
  }
}

// Export a singleton instance with reasonable defaults
const blockchainDataCache = new BlockchainDataCache(200, 30000); // 200 items, 30 second TTL
export default blockchainDataCache;
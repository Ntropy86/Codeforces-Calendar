/**
 * Storage utility functions for consistent storage operations
 */
window.storage = {
    /**
     * Get data from Chrome storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Stored data or undefined
     */
    async get(key) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key]);
        });
      });
    },
    
    /**
     * Get multiple values from Chrome storage
     * @param {Array<string>} keys - Storage keys
     * @returns {Promise<Object>} Object with requested values
     */
    async getMultiple(keys) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
          resolve(result);
        });
      });
    },
    
    /**
     * Set data in Chrome storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          console.log(`Storage: Set ${key}`, value);
          resolve();
        });
      });
    },
    
    /**
     * Update data in Chrome storage using a function
     * @param {string} key - Storage key
     * @param {Function} updateFn - Function to transform current value
     * @returns {Promise<any>} Updated value
     */
    async update(key, updateFn) {
      const currentValue = await this.get(key);
      const newValue = updateFn(currentValue);
      await this.set(key, newValue);
      return newValue;
    },
    
    /**
     * Clear specific keys from storage
     * @param {Array<string>} keys - Keys to clear
     * @returns {Promise<void>}
     */
    async clear(keys) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(keys, resolve);
      });
    }
  };
#!/usr/bin/env node

/**
 * Standalone cron script for Render
 * This script connects to MongoDB, runs auto-submit, then exits
 * 
 * Setup on Render:
 * 1. Create new Cron Job
 * 2. Connect repository
 * 3. Build Command: npm install
 * 4. Command: node scripts/auto-submit-cron.js
 * 5. Schedule: 30
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { autoSubmitExpiredExams } = require('../src/services/cronService');

async function run() {
  try {
    console.log('[Render Cron] Starting auto-submit job...');
    console.log('[Render Cron] Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_MG_URL);
    console.log('[Render Cron] Connected to MongoDB');

    // Run auto-submit
    const result = await autoSubmitExpiredExams();
    
    console.log('[Render Cron] Job completed successfully');
    console.log(`[Render Cron] Results: ${JSON.stringify(result)}`);

    // Disconnect and exit
    await mongoose.disconnect();
    console.log('[Render Cron] Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('[Render Cron] Error:', error);
    
    // Ensure we disconnect even on error
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('[Render Cron] Error disconnecting:', disconnectError);
    }
    
    process.exit(1);
  }
}

// Run the script
run();

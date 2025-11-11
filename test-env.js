#!/usr/bin/env node

/**
 * Environment Configuration Test Script
 * Verifies all required environment variables are set and valid
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env file
require('dotenv').config();

console.log('🔍 OctaneShift API - Environment Configuration Test\n');

const tests = [];
let passed = 0;
let failed = 0;

// Helper function to add test result
function test(name, condition, errorMessage) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
    tests.push({ name, status: 'passed' });
  } else {
    console.log(`❌ ${name}`);
    if (errorMessage) {
      console.log(`   └─ ${errorMessage}`);
    }
    failed++;
    tests.push({ name, status: 'failed', error: errorMessage });
  }
}

// Test Server Configuration
console.log('📋 Server Configuration:');
test('PORT is set', !!process.env.PORT, 'Set PORT in .env');
test('NODE_ENV is set', !!process.env.NODE_ENV, 'Set NODE_ENV in .env');
test('FRONTEND_ORIGIN is set', !!process.env.FRONTEND_ORIGIN, 'Set FRONTEND_ORIGIN in .env');
test('APP_BASE_URL is set', !!process.env.APP_BASE_URL, 'Set APP_BASE_URL in .env');
console.log('');

// Test SideShift Configuration
console.log('🔄 SideShift Configuration:');
test('SIDESHIFT_SECRET is set', !!process.env.SIDESHIFT_SECRET, 'Get from https://sideshift.ai/account');
test('SIDESHIFT_SECRET length >= 16', process.env.SIDESHIFT_SECRET?.length >= 16, 'Secret should be at least 16 characters');
test('AFFILIATE_ID is set', !!process.env.AFFILIATE_ID, 'Get from https://sideshift.ai/account');
console.log('');

// Test Telegram Configuration
console.log('📱 Telegram Configuration:');
test('TELEGRAM_BOT_TOKEN is set', !!process.env.TELEGRAM_BOT_TOKEN, 'Get from @BotFather on Telegram');
test('TELEGRAM_BOT_TOKEN format valid', /^\d+:[A-Za-z0-9_-]{35}$/.test(process.env.TELEGRAM_BOT_TOKEN || ''), 'Should be format: 123456:ABC-DEF1234ghIkl');
console.log('');

// Test Security Configuration (NEW - Phase 12-14)
console.log('🔐 Security Configuration (NEW):');
test('JWT_SECRET is set', !!process.env.JWT_SECRET, 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
test('JWT_SECRET length >= 32', process.env.JWT_SECRET?.length >= 32, 'JWT_SECRET must be at least 32 characters');

test('WEBHOOK_SECRET is set (Phase 12)', !!process.env.WEBHOOK_SECRET, 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
test('WEBHOOK_SECRET length >= 32', process.env.WEBHOOK_SECRET?.length >= 32, 'WEBHOOK_SECRET must be at least 32 characters');

test('ADMIN_API_KEY is set (Phase 14)', !!process.env.ADMIN_API_KEY, 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
test('ADMIN_API_KEY length >= 32', process.env.ADMIN_API_KEY?.length >= 32, 'ADMIN_API_KEY must be at least 32 characters');
console.log('');

// Test RPC Configuration
console.log('⛓️  RPC Configuration:');
test('PROVIDER_RPC_URLS_JSON is set', !!process.env.PROVIDER_RPC_URLS_JSON, 'Set JSON object with RPC URLs');
if (process.env.PROVIDER_RPC_URLS_JSON) {
  try {
    const urls = JSON.parse(process.env.PROVIDER_RPC_URLS_JSON);
    test('PROVIDER_RPC_URLS_JSON is valid JSON', true);
    test('Has Base RPC', !!urls.base, 'Add "base" RPC URL');
    test('Has Ethereum RPC', !!urls.eth, 'Add "eth" RPC URL');
    test('Has Arbitrum RPC', !!urls.arb, 'Add "arb" RPC URL');
  } catch (e) {
    test('PROVIDER_RPC_URLS_JSON is valid JSON', false, 'Invalid JSON format');
  }
}
console.log('');

// Test File Structure
console.log('📁 File Structure:');
test('package.json exists', fs.existsSync(path.join(__dirname, 'package.json')));
test('src/ directory exists', fs.existsSync(path.join(__dirname, 'src')));
test('dist/ directory exists', fs.existsSync(path.join(__dirname, 'dist')), 'Run: npm run build');
test('data/ directory exists', fs.existsSync(path.join(__dirname, 'data')), 'Will be created on first run');
console.log('');

// New Feature Files (Phase 12-14)
console.log('🆕 New Feature Files (Phases 12-14):');
test('webhook service exists', fs.existsSync(path.join(__dirname, 'src/services/webhook.ts')));
test('webhook routes exist', fs.existsSync(path.join(__dirname, 'src/routes/webhooks.ts')));
test('background jobs service exists', fs.existsSync(path.join(__dirname, 'src/services/backgroundJobs.ts')));
test('admin middleware exists', fs.existsSync(path.join(__dirname, 'src/middleware/admin.ts')));
test('admin routes exist', fs.existsSync(path.join(__dirname, 'src/routes/admin.ts')));
console.log('');

// Summary
console.log('═'.repeat(60));
console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ All tests passed! Your environment is properly configured.');
  console.log('\n🚀 Ready to start the server:');
  console.log('   npm run build');
  console.log('   npm start');
  console.log('\n📚 Documentation:');
  console.log('   - ENVIRONMENT_SETUP.md - Complete setup guide');
  console.log('   - QUICK_REFERENCE.md - Quick reference for new features');
} else {
  console.log('⚠️  Some tests failed. Please fix the issues above.');
  console.log('\n📖 See ENVIRONMENT_SETUP.md for detailed setup instructions.');
  process.exit(1);
}

console.log('\n🔑 Your Admin API Key:');
console.log(`   ${process.env.ADMIN_API_KEY || 'NOT SET'}`);
console.log('\n💡 Use this key to access admin endpoints:');
console.log('   curl -H "Authorization: Bearer <key>" http://localhost:3000/api/admin/stats');
console.log('');

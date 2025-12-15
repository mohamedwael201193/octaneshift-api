import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface User {
  id: string;
  email?: string;
  tgChatId?: string;
  regionStatus?: "allowed" | "blocked" | "unknown";
}

export interface Watchlist {
  id: string;
  userId: string;
  address: string;
  chain: "eth" | "base" | "arb" | "op" | "pol" | "avax";
  thresholdNative: number;
  createdAt: string;
  lastAlertAt?: string;
}

export interface Alert {
  id: string;
  userId: string;
  watchlistId: string;
  level: "low" | "critical";
  deepLink: string;
  sentAt: string;
  type?: string;
  balance?: string;
  threshold?: string;
  message?: string;
  chain?: string;
  address?: string;
}

export interface ShiftJob {
  id: string;
  createdAt: string;
  updatedAt?: string;
  userId: string;
  watchlistId?: string;
  shiftId: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress: string;
  settleAddress: string;
  settleMemo?: string;
  refundAddress?: string;
  refundMemo?: string;
  status:
    | "waiting"
    | "pending"
    | "processing"
    | "settled"
    | "refunding"
    | "refunded";
  type?: "variable" | "fixed";
  rate?: string;
  depositAmount?: string;
  settleAmount?: string;
  expiresAt: string;
  txHash?: string;
  payoutId?: string;
}

export interface Preset {
  id: string;
  userId: string;
  name: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  shiftType: "fixed" | "variable";
  depositAmount?: string;
  createdAt: string;
}

export interface Gift {
  id: string;
  chain: string;
  settleAmount: string;
  settleAddress: string;
  message?: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: number;
}

export interface LoyaltyStats {
  id: string;
  telegramId?: string;
  lifetimeVolumeUsd: number;
  totalShifts: number;
  totalTopUps: number;
  gasPacksDelivered: number;
  zeroGasRescues: number;
  freeTopupsAvailable: number;
  freeTopupsUsed: number;
  currentTier: string;
  streakDays: number;
  lastActiveDate: string;
  joinedAt: string;
  favoriteChain?: string;
  chainStats: Record<string, { shifts: number; volume: number }>;
}

// ============================================
// WALLET AUTH & REFERRAL TYPES
// ============================================

export interface WalletAuth {
  id: string; // Same as walletAddress (lowercase)
  walletAddress: string;
  nonce: string;
  nonceExpiresAt: number;
  isAuthenticated: boolean;
  lastAuthAt?: string;
  referralCode: string; // Unique referral code for this user
  referredBy?: string; // Referral code of the user who referred them
  createdAt: string;
}

export interface Referral {
  id: string;
  referrerAddress: string; // Wallet that referred
  referredAddress: string; // Wallet that was referred
  referralCode: string; // Code used
  shiftId?: string; // First shift from referred user
  volumeGenerated: number; // Total volume from referred user
  commissionsEarned: number; // 0.5% of volume (like SideShift)
  status: "pending" | "active" | "inactive";
  createdAt: string;
  firstShiftAt?: string;
}

export interface UserActivity {
  id: string;
  walletAddress: string;
  type: "shift" | "topup" | "gift" | "referral";
  action: string;
  details: Record<string, any>;
  chain?: string;
  amount?: string;
  amountUsd?: number;
  txHash?: string;
  createdAt: string;
}

interface StoreData {
  users: User[];
  watchlists: Watchlist[];
  alerts: Alert[];
  shiftJobs: ShiftJob[];
  presets: Preset[];
  gifts: Gift[];
  loyaltyStats: LoyaltyStats[];
  walletAuths: WalletAuth[];
  referrals: Referral[];
  userActivities: UserActivity[];
}

// ============================================
// IN-MEMORY STORE
// ============================================

const store: StoreData = {
  users: [],
  watchlists: [],
  alerts: [],
  shiftJobs: [],
  presets: [],
  gifts: [],
  loyaltyStats: [],
  walletAuths: [],
  referrals: [],
  userActivities: [],
};

const STORE_FILE = path.join(process.cwd(), "data", "store.json");
const SAVE_INTERVAL_MS = 30000; // 30 seconds

let saveInterval: NodeJS.Timeout | null = null;

// ============================================
// PERSISTENCE FUNCTIONS
// ============================================

/**
 * Load store from disk
 */
export async function load(): Promise<void> {
  try {
    const data = await fs.readFile(STORE_FILE, "utf-8");
    const parsed = JSON.parse(data) as StoreData;

    // Restore data
    store.users = parsed.users || [];
    store.watchlists = parsed.watchlists || [];
    store.alerts = parsed.alerts || [];
    store.shiftJobs = parsed.shiftJobs || [];
    store.presets = parsed.presets || [];
    store.gifts = parsed.gifts || [];
    store.loyaltyStats = parsed.loyaltyStats || [];
    store.walletAuths = parsed.walletAuths || [];
    store.referrals = parsed.referrals || [];
    store.userActivities = parsed.userActivities || [];

    logger.info(
      {
        users: store.users.length,
        watchlists: store.watchlists.length,
        alerts: store.alerts.length,
        shiftJobs: store.shiftJobs.length,
        gifts: store.gifts.length,
        loyaltyStats: store.loyaltyStats.length,
        walletAuths: store.walletAuths.length,
        referrals: store.referrals.length,
        userActivities: store.userActivities.length,
      },
      "Store loaded from disk"
    );
  } catch (error: any) {
    if (error.code === "ENOENT") {
      logger.info("Store file not found, starting with empty store");
    } else {
      logger.error({ error }, "Failed to load store from disk");
    }
  }
}

/**
 * Save store to disk
 */
export async function save(): Promise<void> {
  try {
    const data = JSON.stringify(store, null, 2);
    await fs.writeFile(STORE_FILE, data, "utf-8");

    logger.debug(
      {
        users: store.users.length,
        watchlists: store.watchlists.length,
        alerts: store.alerts.length,
        shiftJobs: store.shiftJobs.length,
        gifts: store.gifts.length,
        loyaltyStats: store.loyaltyStats.length,
        walletAuths: store.walletAuths.length,
        referrals: store.referrals.length,
        userActivities: store.userActivities.length,
      },
      "Store saved to disk"
    );
  } catch (error) {
    logger.error({ error }, "Failed to save store to disk");
  }
}

/**
 * Start periodic save interval
 */
export function startPeriodicSave(): void {
  if (saveInterval) {
    logger.warn("Periodic save already started");
    return;
  }

  saveInterval = setInterval(() => {
    save().catch((error) => {
      logger.error({ error }, "Failed to save store during periodic save");
    });
  }, SAVE_INTERVAL_MS);

  logger.info({ intervalMs: SAVE_INTERVAL_MS }, "Periodic save started");
}

/**
 * Stop periodic save interval
 */
export function stopPeriodicSave(): void {
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
    logger.info("Periodic save stopped");
  }
}

// ============================================
// USER CRUD
// ============================================

export function createUser(user: Omit<User, "id">, customId?: string): User {
  const newUser: User = {
    id: customId || generateId(),
    ...user,
  };
  store.users.push(newUser);
  return newUser;
}

export function getUser(id: string): User | undefined {
  return store.users.find((u) => u.id === id);
}

export function getUserByTgChatId(tgChatId: string): User | undefined {
  return store.users.find((u) => u.tgChatId === tgChatId);
}

export function getUserByEmail(email: string): User | undefined {
  return store.users.find((u) => u.email === email);
}

export function getAllUsers(): User[] {
  return [...store.users];
}

export function updateUser(
  id: string,
  updates: Partial<Omit<User, "id">>
): User | undefined {
  const user = store.users.find((u) => u.id === id);
  if (!user) return undefined;

  Object.assign(user, updates);
  return user;
}

export function deleteUser(id: string): boolean {
  const index = store.users.findIndex((u) => u.id === id);
  if (index === -1) return false;

  store.users.splice(index, 1);
  return true;
}

// ============================================
// WATCHLIST CRUD
// ============================================

export function createWatchlist(
  watchlist: Omit<Watchlist, "id" | "createdAt">
): Watchlist {
  const newWatchlist: Watchlist = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...watchlist,
  };
  store.watchlists.push(newWatchlist);
  return newWatchlist;
}

export function getWatchlist(id: string): Watchlist | undefined {
  return store.watchlists.find((w) => w.id === id);
}

export function getWatchlistsByUserId(userId: string): Watchlist[] {
  return store.watchlists.filter((w) => w.userId === userId);
}

export function getAllWatchlists(): Watchlist[] {
  return [...store.watchlists];
}

export function updateWatchlist(
  id: string,
  updates: Partial<Omit<Watchlist, "id" | "createdAt">>
): Watchlist | undefined {
  const watchlist = store.watchlists.find((w) => w.id === id);
  if (!watchlist) return undefined;

  Object.assign(watchlist, updates);
  return watchlist;
}

export function deleteWatchlist(id: string): boolean {
  const index = store.watchlists.findIndex((w) => w.id === id);
  if (index === -1) return false;

  store.watchlists.splice(index, 1);
  return true;
}

// ============================================
// ALERT CRUD
// ============================================

export function createAlert(alert: Omit<Alert, "id" | "sentAt">): Alert {
  const newAlert: Alert = {
    id: generateId(),
    sentAt: new Date().toISOString(),
    ...alert,
  };
  store.alerts.push(newAlert);
  return newAlert;
}

export function getAlert(id: string): Alert | undefined {
  return store.alerts.find((a) => a.id === id);
}

export function getAlertsByUserId(userId: string): Alert[] {
  return store.alerts.filter((a) => a.userId === userId);
}

export function getAlertsByWatchlistId(watchlistId: string): Alert[] {
  return store.alerts.filter((a) => a.watchlistId === watchlistId);
}

export function getAllAlerts(): Alert[] {
  return [...store.alerts];
}

// Aliases for convenience
export const getAlertById = getAlert;
export const getUserAlerts = getAlertsByUserId;

// ============================================
// SHIFT JOB CRUD
// ============================================

export function createShiftJob(
  job: Omit<ShiftJob, "id" | "createdAt">
): ShiftJob {
  const newJob: ShiftJob = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...job,
  };
  store.shiftJobs.push(newJob);
  return newJob;
}

export function getShiftJob(id: string): ShiftJob | undefined {
  return store.shiftJobs.find((j) => j.id === id);
}

export function getShiftJobByShiftId(shiftId: string): ShiftJob | undefined {
  return store.shiftJobs.find((j) => j.shiftId === shiftId);
}

export function getShiftJobsByUserId(userId: string): ShiftJob[] {
  return store.shiftJobs.filter((j) => j.userId === userId);
}

export function getShiftJobsByWatchlistId(watchlistId: string): ShiftJob[] {
  return store.shiftJobs.filter((j) => j.watchlistId === watchlistId);
}

export function getShiftJobsByPayoutId(payoutId: string): ShiftJob[] {
  return store.shiftJobs.filter((j) => j.payoutId === payoutId);
}

export function getAllShiftJobs(): ShiftJob[] {
  return [...store.shiftJobs];
}

export function updateShiftJob(
  id: string,
  updates: Partial<Omit<ShiftJob, "id" | "createdAt">>
): ShiftJob | undefined {
  const job = store.shiftJobs.find((j) => j.id === id);
  if (!job) return undefined;

  Object.assign(job, updates);
  return job;
}

export function deleteShiftJob(id: string): boolean {
  const index = store.shiftJobs.findIndex((j) => j.id === id);
  if (index === -1) return false;

  store.shiftJobs.splice(index, 1);
  return true;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// STATS FUNCTIONS
// ============================================

export function getStats() {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const shiftsToday = store.shiftJobs.filter((j) => {
    const createdAt = new Date(j.createdAt).getTime();
    return createdAt >= oneDayAgo;
  });

  const last24hCountsByStatus = shiftsToday.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    users: store.users.length,
    watchlists: store.watchlists.length,
    alerts: store.alerts.length,
    shiftJobs: store.shiftJobs.length,
    shiftsToday: shiftsToday.length,
    last24hCountsByStatus,
  };
}

// ============================================
// PRESET CRUD
// ============================================

export function createPreset(preset: Omit<Preset, "id" | "createdAt">): Preset {
  const newPreset: Preset = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...preset,
  };
  store.presets.push(newPreset);
  return newPreset;
}

export function getPreset(id: string): Preset | undefined {
  return store.presets.find((p) => p.id === id);
}

export function getPresetsByUserId(userId: string): Preset[] {
  return store.presets.filter((p) => p.userId === userId);
}

export function getAllPresets(): Preset[] {
  return [...store.presets];
}

export function updatePreset(
  id: string,
  updates: Partial<Omit<Preset, "id" | "createdAt" | "userId">>
): Preset | undefined {
  const preset = store.presets.find((p) => p.id === id);
  if (!preset) return undefined;

  Object.assign(preset, updates);
  return preset;
}

export function deletePreset(id: string): boolean {
  const index = store.presets.findIndex((p) => p.id === id);
  if (index === -1) return false;

  store.presets.splice(index, 1);
  return true;
}

// ============================================
// GIFT CRUD
// ============================================

export function createGift(gift: Omit<Gift, "createdAt">): Gift {
  const newGift: Gift = {
    ...gift,
    createdAt: new Date().toISOString(),
  };
  store.gifts.push(newGift);
  return newGift;
}

export function getGift(id: string): Gift | undefined {
  return store.gifts.find((g) => g.id === id);
}

export function getGiftsByUserId(userId: string): Gift[] {
  return store.gifts.filter((g) => g.createdBy === userId);
}

export function getAllGifts(): Gift[] {
  return [...store.gifts];
}

export function deleteGift(id: string): boolean {
  const index = store.gifts.findIndex((g) => g.id === id);
  if (index === -1) return false;

  store.gifts.splice(index, 1);
  return true;
}

export function cleanExpiredGifts(): number {
  const now = Date.now();
  const before = store.gifts.length;
  store.gifts = store.gifts.filter((g) => !g.expiresAt || g.expiresAt > now);
  return before - store.gifts.length;
}

// ============================================
// LOYALTY STATS CRUD
// ============================================

export function getLoyaltyStats(userId: string): LoyaltyStats | undefined {
  return store.loyaltyStats.find((s) => s.id === userId);
}

export function createLoyaltyStats(
  userId: string,
  telegramId?: string
): LoyaltyStats {
  const existingStats = getLoyaltyStats(userId);
  if (existingStats) return existingStats;

  const newStats: LoyaltyStats = {
    id: userId,
    telegramId,
    lifetimeVolumeUsd: 0,
    totalShifts: 0,
    totalTopUps: 0,
    gasPacksDelivered: 0,
    zeroGasRescues: 0,
    freeTopupsAvailable: 0,
    freeTopupsUsed: 0,
    currentTier: "Bronze",
    streakDays: 0,
    lastActiveDate: new Date().toISOString().split("T")[0],
    joinedAt: new Date().toISOString(),
    chainStats: {},
  };
  store.loyaltyStats.push(newStats);
  return newStats;
}

export function updateLoyaltyStats(
  userId: string,
  updates: Partial<Omit<LoyaltyStats, "id" | "joinedAt">>
): LoyaltyStats | undefined {
  const stats = store.loyaltyStats.find((s) => s.id === userId);
  if (!stats) return undefined;

  Object.assign(stats, updates);
  return stats;
}

export function getAllLoyaltyStats(): LoyaltyStats[] {
  return [...store.loyaltyStats];
}

export function getTopLoyaltyUsers(limit: number = 10): LoyaltyStats[] {
  return [...store.loyaltyStats]
    .sort((a, b) => b.lifetimeVolumeUsd - a.lifetimeVolumeUsd)
    .slice(0, limit);
}

// ============================================
// WALLET AUTH CRUD
// ============================================

/**
 * Generate a unique referral code (6 alphanumeric chars)
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Make sure it's unique
  if (store.walletAuths.some((w) => w.referralCode === code)) {
    return generateReferralCode();
  }
  return code;
}

/**
 * Generate a random nonce for wallet signature
 */
function generateNonce(): string {
  return `Sign this message to authenticate with OctaneShift:\n\nNonce: ${Math.random()
    .toString(36)
    .substring(2)}-${Date.now()}`;
}

export function createWalletAuth(walletAddress: string): WalletAuth {
  const addr = walletAddress.toLowerCase();
  const existing = store.walletAuths.find((w) => w.id === addr);
  if (existing) {
    // Refresh nonce for existing user
    existing.nonce = generateNonce();
    existing.nonceExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    return existing;
  }

  const newAuth: WalletAuth = {
    id: addr,
    walletAddress: walletAddress,
    nonce: generateNonce(),
    nonceExpiresAt: Date.now() + 5 * 60 * 1000,
    isAuthenticated: false,
    referralCode: generateReferralCode(),
    createdAt: new Date().toISOString(),
  };
  store.walletAuths.push(newAuth);
  return newAuth;
}

export function getWalletAuth(walletAddress: string): WalletAuth | undefined {
  return store.walletAuths.find((w) => w.id === walletAddress.toLowerCase());
}

export function getWalletAuthByReferralCode(
  code: string
): WalletAuth | undefined {
  return store.walletAuths.find((w) => w.referralCode === code.toUpperCase());
}

export function updateWalletAuth(
  walletAddress: string,
  updates: Partial<Omit<WalletAuth, "id" | "walletAddress" | "createdAt">>
): WalletAuth | undefined {
  const auth = store.walletAuths.find(
    (w) => w.id === walletAddress.toLowerCase()
  );
  if (!auth) return undefined;

  Object.assign(auth, updates);
  return auth;
}

export function getAllWalletAuths(): WalletAuth[] {
  return [...store.walletAuths];
}

// ============================================
// REFERRAL CRUD
// ============================================

export function createReferral(
  referrerAddress: string,
  referredAddress: string,
  referralCode: string
): Referral {
  const newReferral: Referral = {
    id: generateId(),
    referrerAddress: referrerAddress.toLowerCase(),
    referredAddress: referredAddress.toLowerCase(),
    referralCode: referralCode.toUpperCase(),
    volumeGenerated: 0,
    commissionsEarned: 0,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.referrals.push(newReferral);
  return newReferral;
}

export function getReferral(id: string): Referral | undefined {
  return store.referrals.find((r) => r.id === id);
}

export function getReferralsByReferrer(walletAddress: string): Referral[] {
  return store.referrals.filter(
    (r) => r.referrerAddress === walletAddress.toLowerCase()
  );
}

export function getReferralByReferred(
  walletAddress: string
): Referral | undefined {
  return store.referrals.find(
    (r) => r.referredAddress === walletAddress.toLowerCase()
  );
}

export function updateReferral(
  id: string,
  updates: Partial<Omit<Referral, "id" | "createdAt">>
): Referral | undefined {
  const referral = store.referrals.find((r) => r.id === id);
  if (!referral) return undefined;

  Object.assign(referral, updates);
  return referral;
}

export function getAllReferrals(): Referral[] {
  return [...store.referrals];
}

/**
 * Add volume to a referral and calculate commission (0.5% like SideShift)
 */
export function addReferralVolume(
  referredAddress: string,
  volumeUsd: number
): Referral | undefined {
  const referral = getReferralByReferred(referredAddress);
  if (!referral) return undefined;

  referral.volumeGenerated += volumeUsd;
  referral.commissionsEarned = referral.volumeGenerated * 0.005; // 0.5% commission

  if (referral.status === "pending" && volumeUsd > 0) {
    referral.status = "active";
    referral.firstShiftAt = new Date().toISOString();
  }

  return referral;
}

/**
 * Get referral stats for a wallet
 */
export function getReferralStats(walletAddress: string): {
  totalReferrals: number;
  activeReferrals: number;
  totalVolume: number;
  totalCommissions: number;
  referralCode: string;
  referrals: Referral[];
} {
  const addr = walletAddress.toLowerCase();
  const auth = getWalletAuth(addr);
  const referrals = getReferralsByReferrer(addr);

  return {
    totalReferrals: referrals.length,
    activeReferrals: referrals.filter((r) => r.status === "active").length,
    totalVolume: referrals.reduce((sum, r) => sum + r.volumeGenerated, 0),
    totalCommissions: referrals.reduce(
      (sum, r) => sum + r.commissionsEarned,
      0
    ),
    referralCode: auth?.referralCode || "",
    referrals,
  };
}

// ============================================
// USER ACTIVITY CRUD
// ============================================

export function createUserActivity(
  activity: Omit<UserActivity, "id" | "createdAt">
): UserActivity {
  const newActivity: UserActivity = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...activity,
  };
  store.userActivities.push(newActivity);

  // Keep only last 1000 activities per user to avoid memory bloat
  const userActivities = store.userActivities.filter(
    (a) => a.walletAddress === activity.walletAddress
  );
  if (userActivities.length > 1000) {
    // Remove oldest
    const oldest = userActivities[0];
    const index = store.userActivities.findIndex((a) => a.id === oldest.id);
    if (index !== -1) store.userActivities.splice(index, 1);
  }

  return newActivity;
}

export function getUserActivities(
  walletAddress: string,
  options?: {
    type?: "shift" | "topup" | "gift" | "referral";
    limit?: number;
    offset?: number;
  }
): UserActivity[] {
  let activities = store.userActivities.filter(
    (a) => a.walletAddress === walletAddress.toLowerCase()
  );

  if (options?.type) {
    activities = activities.filter((a) => a.type === options.type);
  }

  // Sort by newest first
  activities.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const offset = options?.offset || 0;
  const limit = options?.limit || 50;

  return activities.slice(offset, offset + limit);
}

export function getUserActivityStats(walletAddress: string): {
  totalShifts: number;
  totalTopUps: number;
  totalGifts: number;
  totalVolumeUsd: number;
  lastActive: string | null;
} {
  const addr = walletAddress.toLowerCase();
  const activities = store.userActivities.filter(
    (a) => a.walletAddress === addr
  );

  const shifts = activities.filter((a) => a.type === "shift");
  const topups = activities.filter((a) => a.type === "topup");
  const gifts = activities.filter((a) => a.type === "gift");
  const totalVolume = activities.reduce(
    (sum, a) => sum + (a.amountUsd || 0),
    0
  );

  return {
    totalShifts: shifts.length,
    totalTopUps: topups.length,
    totalGifts: gifts.length,
    totalVolumeUsd: totalVolume,
    lastActive: activities.length > 0 ? activities[0].createdAt : null,
  };
}

export function getAllUserActivities(): UserActivity[] {
  return [...store.userActivities];
}

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
}

export interface ShiftJob {
  id: string;
  createdAt: string;
  userId: string;
  watchlistId?: string;
  shiftId: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress: string;
  settleAddress: string;
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

interface StoreData {
  users: User[];
  watchlists: Watchlist[];
  alerts: Alert[];
  shiftJobs: ShiftJob[];
  presets: Preset[];
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

    logger.info(
      {
        users: store.users.length,
        watchlists: store.watchlists.length,
        alerts: store.alerts.length,
        shiftJobs: store.shiftJobs.length,
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

export function createUser(user: Omit<User, "id">): User {
  const newUser: User = {
    id: generateId(),
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

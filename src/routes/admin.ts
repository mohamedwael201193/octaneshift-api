import express from "express";
import { authenticateAdmin } from "../middleware/admin";
import { rateLimitConfig } from "../middleware/rateLimit";
import * as backgroundJobs from "../services/backgroundJobs";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * GET /api/admin/stats
 * Get system-wide statistics
 */
router.get(
  "/stats",
  authenticateAdmin,
  rateLimitConfig.general,
  async (_req, res) => {
    try {
      const users = store.getAllUsers();
      const watchlists = store.getAllWatchlists();
      const shifts = store.getAllShiftJobs();
      const alerts = store.getAllAlerts();

      // Calculate shift statistics
      const shiftsByStatus = shifts.reduce((acc, shift) => {
        acc[shift.status] = (acc[shift.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const shiftsByType = shifts.reduce((acc, shift) => {
        const type = shift.type || "variable";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate alert statistics
      const alertsByLevel = alerts.reduce((acc, alert) => {
        acc[alert.level] = (acc[alert.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Background jobs status
      const jobsStatus = backgroundJobs.getJobsStatus();

      // Calculate user activity
      const activeUsers = users.filter((user) => {
        const userShifts = shifts.filter((s) => s.userId === user.id);
        return userShifts.length > 0;
      }).length;

      res.json({
        success: true,
        stats: {
          users: {
            total: users.length,
            active: activeUsers,
            withTelegram: users.filter((u) => u.tgChatId).length,
            withEmail: users.filter((u) => u.email).length,
          },
          watchlists: {
            total: watchlists.length,
            byChain: watchlists.reduce((acc, wl) => {
              acc[wl.chain] = (acc[wl.chain] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          },
          shifts: {
            total: shifts.length,
            byStatus: shiftsByStatus,
            byType: shiftsByType,
          },
          alerts: {
            total: alerts.length,
            byLevel: alertsByLevel,
          },
          backgroundJobs: jobsStatus,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error fetching admin stats");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/admin/users
 * List all users with pagination and search
 */
router.get(
  "/users",
  authenticateAdmin,
  rateLimitConfig.general,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const search = (req.query.search as string) || "";

      let users = store.getAllUsers();

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter(
          (user) =>
            user.id.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.tgChatId?.includes(search)
        );
      }

      // Sort by most recent shifts
      const shifts = store.getAllShiftJobs();
      users.sort((a, b) => {
        const aShifts = shifts.filter((s) => s.userId === a.id);
        const bShifts = shifts.filter((s) => s.userId === b.id);
        if (aShifts.length === 0 && bShifts.length === 0) return 0;
        if (aShifts.length === 0) return 1;
        if (bShifts.length === 0) return -1;
        const aLatest = Math.max(
          ...aShifts.map((s) => new Date(s.createdAt).getTime())
        );
        const bLatest = Math.max(
          ...bShifts.map((s) => new Date(s.createdAt).getTime())
        );
        return bLatest - aLatest;
      });

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = users.slice(startIndex, endIndex);

      // Enrich users with shift counts
      const enrichedUsers = paginatedUsers.map((user) => {
        const userShifts = shifts.filter((s) => s.userId === user.id);
        const watchlists = store.getWatchlistsByUserId(user.id);
        const alerts = store.getAlertsByUserId(user.id);

        return {
          ...user,
          stats: {
            shifts: userShifts.length,
            watchlists: watchlists.length,
            alerts: alerts.length,
            lastShift:
              userShifts.length > 0
                ? userShifts[userShifts.length - 1].createdAt
                : null,
          },
        };
      });

      res.json({
        success: true,
        users: enrichedUsers,
        pagination: {
          page,
          limit,
          total: users.length,
          totalPages: Math.ceil(users.length / limit),
          hasMore: endIndex < users.length,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error fetching admin users");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/admin/shifts
 * List all shifts with filters
 */
router.get(
  "/shifts",
  authenticateAdmin,
  rateLimitConfig.general,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const status = req.query.status as string;
      const userId = req.query.userId as string;
      const type = req.query.type as string;

      let shifts = store.getAllShiftJobs();

      // Apply filters
      if (status) {
        shifts = shifts.filter((s) => s.status === status);
      }
      if (userId) {
        shifts = shifts.filter((s) => s.userId === userId);
      }
      if (type) {
        shifts = shifts.filter((s) => s.type === type);
      }

      // Sort by most recent first
      shifts.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedShifts = shifts.slice(startIndex, endIndex);

      res.json({
        success: true,
        shifts: paginatedShifts,
        pagination: {
          page,
          limit,
          total: shifts.length,
          totalPages: Math.ceil(shifts.length / limit),
          hasMore: endIndex < shifts.length,
        },
        filters: {
          status,
          userId,
          type,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error fetching admin shifts");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/admin/alerts
 * List all alerts with filters
 */
router.get(
  "/alerts",
  authenticateAdmin,
  rateLimitConfig.general,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const level = req.query.level as string;
      const userId = req.query.userId as string;

      let alerts = store.getAllAlerts();

      // Apply filters
      if (level) {
        alerts = alerts.filter((a) => a.level === level);
      }
      if (userId) {
        alerts = alerts.filter((a) => a.userId === userId);
      }

      // Sort by most recent first
      alerts.sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      );

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedAlerts = alerts.slice(startIndex, endIndex);

      // Enrich with watchlist info
      const enrichedAlerts = paginatedAlerts.map((alert) => {
        const watchlist = store.getWatchlist(alert.watchlistId);
        return {
          ...alert,
          watchlist: watchlist
            ? {
                address: watchlist.address,
                chain: watchlist.chain,
              }
            : null,
        };
      });

      res.json({
        success: true,
        alerts: enrichedAlerts,
        pagination: {
          page,
          limit,
          total: alerts.length,
          totalPages: Math.ceil(alerts.length / limit),
          hasMore: endIndex < alerts.length,
        },
        filters: {
          level,
          userId,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error fetching admin alerts");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * POST /api/admin/jobs/cleanup
 * Manually trigger cleanup jobs
 */
router.post(
  "/jobs/cleanup",
  authenticateAdmin,
  rateLimitConfig.strict,
  async (_req, res) => {
    try {
      await backgroundJobs.triggerCleanup();

      logger.info("Admin triggered manual cleanup");

      res.json({
        success: true,
        message: "Cleanup jobs triggered successfully",
      });
    } catch (error) {
      logger.error({ error }, "Error triggering cleanup");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

export default router;

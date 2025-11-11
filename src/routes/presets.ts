import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// ============================================
// SCHEMAS FOR REQUEST VALIDATION
// ============================================

const CreatePresetSchema = z.object({
  name: z.string().min(1).max(50),
  depositCoin: z.string().min(1),
  depositNetwork: z.string().min(1),
  settleCoin: z.string().min(1),
  settleNetwork: z.string().min(1),
  shiftType: z.enum(["fixed", "variable"]),
  depositAmount: z.string().optional(),
});

const UpdatePresetSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  depositAmount: z.string().optional(),
});

// ============================================
// PRESET ENDPOINTS
// ============================================

/**
 * POST /api/presets
 * Create a new preset
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Validate request
    const validationResult = CreatePresetSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request",
        details: validationResult.error.errors,
      });
      return;
    }

    const {
      name,
      depositCoin,
      depositNetwork,
      settleCoin,
      settleNetwork,
      shiftType,
      depositAmount,
    } = validationResult.data;

    // Check for duplicate preset name for this user
    const existingPresets = store.getPresetsByUserId(userId);
    if (
      existingPresets.some((p) => p.name.toLowerCase() === name.toLowerCase())
    ) {
      res.status(400).json({
        error: "Duplicate preset name",
        message: "A preset with this name already exists",
      });
      return;
    }

    // Create preset
    const preset = store.createPreset({
      userId,
      name,
      depositCoin,
      depositNetwork,
      settleCoin,
      settleNetwork,
      shiftType,
      depositAmount,
    });

    logger.info(
      {
        userId,
        presetId: preset.id,
        name: preset.name,
      },
      "Preset created"
    );

    res.json({
      success: true,
      preset,
    });
  } catch (error: any) {
    logger.error(
      { error, userId: (req as any).userId },
      "Failed to create preset"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/presets
 * Get user's presets
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const presets = store.getPresetsByUserId(userId);

    // Sort by creation date (most recent first)
    presets.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({
      success: true,
      presets,
      count: presets.length,
    });
  } catch (error: any) {
    logger.error(
      { error, userId: (req as any).userId },
      "Failed to get presets"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/presets/:id
 * Get a specific preset
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;

    const preset = store.getPreset(presetId);
    if (!preset) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }

    // Verify ownership
    if (preset.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    res.json({
      success: true,
      preset,
    });
  } catch (error: any) {
    logger.error({ error, presetId: req.params.id }, "Failed to get preset");
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * PUT /api/presets/:id
 * Update a preset
 */
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;

    // Validate request
    const validationResult = UpdatePresetSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request",
        details: validationResult.error.errors,
      });
      return;
    }

    const preset = store.getPreset(presetId);
    if (!preset) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }

    // Verify ownership
    if (preset.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Check for duplicate name if name is being changed
    if (
      validationResult.data.name &&
      validationResult.data.name !== preset.name
    ) {
      const existingPresets = store.getPresetsByUserId(userId);
      if (
        existingPresets.some(
          (p) =>
            p.id !== presetId &&
            p.name.toLowerCase() === validationResult.data.name!.toLowerCase()
        )
      ) {
        res.status(400).json({
          error: "Duplicate preset name",
          message: "A preset with this name already exists",
        });
        return;
      }
    }

    // Update preset
    const updatedPreset = store.updatePreset(presetId, validationResult.data);

    logger.info(
      {
        userId,
        presetId,
        updates: validationResult.data,
      },
      "Preset updated"
    );

    res.json({
      success: true,
      preset: updatedPreset,
    });
  } catch (error: any) {
    logger.error({ error, presetId: req.params.id }, "Failed to update preset");
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * DELETE /api/presets/:id
 * Delete a preset
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;

    const preset = store.getPreset(presetId);
    if (!preset) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }

    // Verify ownership
    if (preset.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Delete preset
    const deleted = store.deletePreset(presetId);

    if (!deleted) {
      res.status(500).json({ error: "Failed to delete preset" });
      return;
    }

    logger.info(
      {
        userId,
        presetId,
      },
      "Preset deleted"
    );

    res.json({
      success: true,
      message: "Preset deleted",
    });
  } catch (error: any) {
    logger.error({ error, presetId: req.params.id }, "Failed to delete preset");
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/presets/:id/use
 * Use a preset to initiate a top-up (convenience endpoint)
 */
router.post("/:id/use", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;

    const preset = store.getPreset(presetId);
    if (!preset) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }

    // Verify ownership
    if (preset.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Validate watchlistId is provided
    const { watchlistId } = req.body;
    if (!watchlistId) {
      res.status(400).json({
        error: "watchlistId is required",
      });
      return;
    }

    // Verify watchlist exists and belongs to user
    const watchlist = store.getWatchlist(watchlistId);
    if (!watchlist) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }

    if (watchlist.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    logger.info(
      {
        userId,
        presetId,
        watchlistId,
        preset: preset.name,
      },
      "Preset used for top-up"
    );

    // Return preset data for client to use with topup/initiate endpoint
    res.json({
      success: true,
      message: "Use these parameters with /api/topup/initiate",
      preset,
      watchlist,
      topupParams: {
        watchlistId,
        shiftType: preset.shiftType,
        depositCoin: preset.depositCoin,
        depositNetwork: preset.depositNetwork,
        ...(preset.depositAmount && { depositAmount: preset.depositAmount }),
      },
    });
  } catch (error: any) {
    logger.error({ error, presetId: req.params.id }, "Failed to use preset");
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;

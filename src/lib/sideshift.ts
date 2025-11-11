import { request } from "undici";
import { z } from "zod";
import { maskIp } from "../middleware/compliance";
import { logger } from "../utils/logger";

const SIDESHIFT_API_BASE = "https://sideshift.ai/api/v2";

// Zod schemas for SideShift API responses
export const PermissionSchema = z.object({
  createShift: z.boolean(),
  affiliate: z.boolean().optional(),
  requestQuote: z.boolean().optional(),
});

export const NetworkSchema = z.object({
  network: z.string(),
  coin: z.string(),
  name: z.string(),
  fixedOnly: z.boolean().optional(),
  variableOnly: z.boolean().optional(),
  depositOffline: z.boolean().optional(),
  settleOffline: z.boolean().optional(),
  hasMemo: z.boolean().optional(),
});

export const PairRequestSchema = z.object({
  from: z.string(),
  to: z.string(),
  amount: z.string().optional(),
});

export const PairSchema = z.object({
  min: z.string(),
  max: z.string(),
  rate: z.string().optional(),
  depositCoin: z.string(),
  settleCoin: z.string(),
  depositNetwork: z.string(),
  settleNetwork: z.string(),
});

export const CreateVariableShiftRequestSchema = z.object({
  depositCoin: z.string(),
  depositNetwork: z.string(),
  settleCoin: z.string(),
  settleNetwork: z.string(),
  settleAddress: z.string(),
  settleMemo: z.string().optional(),
  refundAddress: z.string().optional(),
  refundMemo: z.string().optional(),
  affiliateId: z.string().optional(),
  commissionRate: z.number().optional(),
  externalId: z.string().optional(),
});

export const FixedQuoteRequestSchema = z.object({
  depositCoin: z.string(),
  depositNetwork: z.string(),
  settleCoin: z.string(),
  settleNetwork: z.string(),
  depositAmount: z.string().optional(),
  settleAmount: z.string().optional(),
  affiliateId: z.string().optional(),
  commissionRate: z.number().optional(),
});

export const FixedQuoteSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  depositCoin: z.string(),
  depositNetwork: z.string(),
  settleCoin: z.string(),
  settleNetwork: z.string(),
  expiresAt: z.string(),
  depositAmount: z.string(),
  settleAmount: z.string(),
  rate: z.string(),
  affiliateId: z.string().optional(),
  commissionRate: z.number().optional(),
});

export const CreateFixedShiftRequestSchema = z.object({
  quoteId: z.string(),
  settleAddress: z.string(),
  settleMemo: z.string().optional(),
  refundAddress: z.string().optional(),
  refundMemo: z.string().optional(),
  affiliateId: z.string().optional(),
  externalId: z.string().optional(),
});

export const ShiftSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  depositCoin: z.string(),
  depositNetwork: z.string(),
  settleCoin: z.string(),
  settleNetwork: z.string(),
  depositAddress: z.string(),
  settleAddress: z.string(),
  depositMin: z.string(),
  depositMax: z.string(),
  expiresAt: z.string(),
  status: z.enum([
    "waiting",
    "pending",
    "processing",
    "settled",
    "refunding",
    "refunded",
  ]),
  type: z.enum(["variable", "fixed"]).optional(),
  rate: z.string().optional(),
  depositMemo: z.string().optional(),
  settleMemo: z.string().optional(),
  depositAmount: z.string().optional(),
  settleAmount: z.string().optional(),
});

export type Permission = z.infer<typeof PermissionSchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type PairRequest = z.infer<typeof PairRequestSchema>;
export type Pair = z.infer<typeof PairSchema>;
export type CreateVariableShiftRequest = z.infer<
  typeof CreateVariableShiftRequestSchema
>;
export type FixedQuoteRequest = z.infer<typeof FixedQuoteRequestSchema>;
export type FixedQuote = z.infer<typeof FixedQuoteSchema>;
export type CreateFixedShiftRequest = z.infer<
  typeof CreateFixedShiftRequestSchema
>;
export type Shift = z.infer<typeof ShiftSchema>;

export class SideShiftError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "SideShiftError";
  }
}

export class SideShiftClient {
  private baseURL: string;
  private secret?: string;
  private affiliateId?: string;
  private commissionRate: number;

  constructor(
    options: {
      secret?: string;
      affiliateId?: string;
      commissionRate?: number;
    } = {}
  ) {
    this.baseURL = SIDESHIFT_API_BASE;
    this.secret = options.secret ?? undefined;
    this.affiliateId = options.affiliateId ?? undefined;
    this.commissionRate = options.commissionRate ?? 0;
  }

  private async makeRequest<T>(
    path: string,
    options: {
      method?: "GET" | "POST";
      body?: any;
      headers?: Record<string, string>;
      userIp?: string;
    } = {}
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const { method = "GET", body, headers = {}, userIp } = options;

    try {
      logger.debug(
        { url, method, userIp: userIp ? maskIp(userIp) : undefined },
        "Making SideShift API request"
      );

      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "OctaneShift/1.0",
        ...headers,
      };

      // Add secret header if available
      if (this.secret) {
        requestHeaders["x-sideshift-secret"] = this.secret;
      }

      // Add user IP header if provided
      if (userIp) {
        requestHeaders["x-user-ip"] = userIp;
      }

      const requestOptions: any = {
        method,
        headers: requestHeaders,
      };

      if (body && method === "POST") {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await request(url, requestOptions);
      const responseBody = await response.body.text();

      if (!response.statusCode || response.statusCode >= 400) {
        logger.error(
          {
            url,
            status: response.statusCode,
            response: responseBody,
            userIp: userIp ? maskIp(userIp) : undefined,
          },
          "SideShift API error response"
        );

        let errorDetails;
        try {
          errorDetails = JSON.parse(responseBody);
        } catch {
          errorDetails = { message: responseBody };
        }

        // Map common HTTP status codes to meaningful error codes
        const errorCode = this.mapErrorCode(
          response.statusCode || 500,
          errorDetails
        );

        throw new SideShiftError(
          response.statusCode || 500,
          errorDetails.message || errorDetails.error || "Unknown error",
          errorCode,
          errorDetails
        );
      }

      const data = JSON.parse(responseBody);
      logger.debug(
        {
          url,
          status: response.statusCode,
          userIp: userIp ? maskIp(userIp) : undefined,
        },
        "SideShift API request successful"
      );

      return data;
    } catch (error) {
      if (error instanceof SideShiftError) {
        throw error;
      }

      logger.error(
        { error, url, userIp: userIp ? maskIp(userIp) : undefined },
        "SideShift API request failed"
      );
      throw new SideShiftError(500, "Network error", "NETWORK_ERROR");
    }
  }

  private mapErrorCode(status: number, _errorDetails: any): string {
    switch (status) {
      case 400:
        return "INVALID_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 422:
        return "VALIDATION_ERROR";
      case 429:
        return "RATE_LIMITED";
      case 500:
        return "INTERNAL_ERROR";
      case 502:
      case 503:
      case 504:
        return "SERVICE_UNAVAILABLE";
      default:
        return "UNKNOWN_ERROR";
    }
  }

  /**
   * Get user permissions
   */
  async getPermissions(userIp?: string): Promise<Permission> {
    const requestOptions: any = {};
    if (userIp) {
      requestOptions.userIp = userIp;
    }
    const data = await this.makeRequest<Permission>(
      "/permissions",
      requestOptions
    );
    return PermissionSchema.parse(data);
  }

  /**
   * Get trading pair information
   */
  async getPair(params: PairRequest): Promise<Pair> {
    const queryParams = new URLSearchParams();
    if (params.amount) {
      queryParams.append("amount", params.amount);
    }
    if (this.affiliateId) {
      queryParams.append("affiliateId", this.affiliateId);
    }
    if (this.commissionRate) {
      queryParams.append("commissionRate", this.commissionRate.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/pair/${params.from}/${params.to}${
      queryString ? `?${queryString}` : ""
    }`;

    const data = await this.makeRequest<Pair>(endpoint);
    return PairSchema.parse(data);
  }

  /**
   * Create a variable shift
   */
  async createVariableShift(
    request: CreateVariableShiftRequest,
    userIp?: string
  ): Promise<Shift> {
    const body = {
      ...request,
      affiliateId: request.affiliateId || this.affiliateId,
      commissionRate:
        request.commissionRate !== undefined
          ? request.commissionRate
          : this.commissionRate,
    };

    // Validate request body
    CreateVariableShiftRequestSchema.parse(body);

    const requestOptions: any = {
      method: "POST",
      body,
    };
    if (userIp) {
      requestOptions.userIp = userIp;
    }
    const data = await this.makeRequest<Shift>(
      "/shifts/variable",
      requestOptions
    );

    return ShiftSchema.parse(data);
  }

  /**
   * Get shift by ID
   */
  async getShift(id: string, userIp?: string): Promise<Shift> {
    const requestOptions: any = {};
    if (userIp) {
      requestOptions.userIp = userIp;
    }
    const data = await this.makeRequest<Shift>(`/shifts/${id}`, requestOptions);
    return ShiftSchema.parse(data);
  }

  /**
   * Request a fixed rate quote
   */
  async requestFixedQuote(
    request: FixedQuoteRequest,
    userIp?: string
  ): Promise<FixedQuote> {
    const body = {
      ...request,
      affiliateId: request.affiliateId || this.affiliateId,
      commissionRate:
        request.commissionRate !== undefined
          ? request.commissionRate
          : this.commissionRate,
    };

    // Validate request body
    FixedQuoteRequestSchema.parse(body);

    const requestOptions: any = {
      method: "POST",
      body,
    };
    if (userIp) {
      requestOptions.userIp = userIp;
    }
    const data = await this.makeRequest<FixedQuote>("/quotes", requestOptions);

    return FixedQuoteSchema.parse(data);
  }

  /**
   * Create a fixed shift from a quote
   */
  async createFixedShift(
    request: CreateFixedShiftRequest,
    userIp?: string
  ): Promise<Shift> {
    const body = {
      ...request,
      affiliateId: request.affiliateId || this.affiliateId,
    };

    // Validate request body
    CreateFixedShiftRequestSchema.parse(body);

    const requestOptions: any = {
      method: "POST",
      body,
    };
    if (userIp) {
      requestOptions.userIp = userIp;
    }
    const data = await this.makeRequest<Shift>("/shifts/fixed", requestOptions);

    return ShiftSchema.parse(data);
  }

  /**
   * Cancel an order (must be called after 5 minutes)
   */
  async cancelOrder(
    orderId: string,
    userIp?: string
  ): Promise<{ message: string }> {
    const requestOptions: any = {
      method: "POST",
      body: { orderId },
    };
    if (userIp) {
      requestOptions.userIp = userIp;
    }

    try {
      await this.makeRequest("/cancel-order", requestOptions);
      return { message: "Order cancelled successfully" };
    } catch (error) {
      if (error instanceof SideShiftError) {
        // Enhance error message for common scenarios
        if (error.status === 400) {
          throw new SideShiftError(
            400,
            "Cannot cancel order yet. Orders can only be cancelled after 5 minutes.",
            "TOO_EARLY",
            error.details
          );
        }
        if (error.status === 404) {
          throw new SideShiftError(
            404,
            "Order not found or already completed.",
            "NOT_FOUND",
            error.details
          );
        }
      }
      throw error;
    }
  }

  /**
   * Set or update refund address for a shift
   */
  async setRefundAddress(
    shiftId: string,
    address: string,
    memo?: string,
    userIp?: string
  ): Promise<Shift> {
    const body: any = { address };
    if (memo) {
      body.memo = memo;
    }

    const requestOptions: any = {
      method: "POST",
      body,
    };
    if (userIp) {
      requestOptions.userIp = userIp;
    }

    const data = await this.makeRequest<Shift>(
      `/shifts/${shiftId}/set-refund-address`,
      requestOptions
    );

    return ShiftSchema.parse(data);
  }
}

// Export a default instance
const sideshift = new SideShiftClient({
  ...(process.env.SIDESHIFT_SECRET && { secret: process.env.SIDESHIFT_SECRET }),
  ...(process.env.AFFILIATE_ID && { affiliateId: process.env.AFFILIATE_ID }),
  ...(process.env.COMMISSION_RATE && {
    commissionRate: parseFloat(process.env.COMMISSION_RATE),
  }),
});

export default sideshift;

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaCode,
  FaCog,
  FaExclamationTriangle,
  FaGlobe,
  FaInfoCircle,
  FaLock,
  FaMapMarkerAlt,
  FaServer,
  FaShieldAlt,
  FaUnlock,
} from "react-icons/fa";

interface SimulatorConfig {
  region: "us" | "eu" | "uk" | "asia" | "restricted";
  vpnDetected: boolean;
  ipType: "residential" | "datacenter" | "tor";
}

interface PermissionResult {
  allowed: boolean;
  statusCode: number;
  reason?: string;
  availableChains: string[];
  restrictions: string[];
}

const regionData: Record<
  string,
  { name: string; flag: string; restricted: string[] }
> = {
  us: { name: "United States", flag: "🇺🇸", restricted: ["XMR"] },
  eu: { name: "European Union", flag: "🇪🇺", restricted: [] },
  uk: { name: "United Kingdom", flag: "🇬🇧", restricted: [] },
  asia: { name: "Singapore", flag: "🇸🇬", restricted: [] },
  restricted: { name: "Restricted Region", flag: "🚫", restricted: ["ALL"] },
};

const allChains = [
  "ETH",
  "BTC",
  "SOL",
  "MATIC",
  "ARB",
  "OP",
  "AVAX",
  "BNB",
  "XRP",
  "XLM",
  "XMR",
  "DOGE",
  "LTC",
];

export default function Simulator() {
  const [config, setConfig] = useState<SimulatorConfig>({
    region: "us",
    vpnDetected: false,
    ipType: "residential",
  });

  const [result, setResult] = useState<PermissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeveloperNotes, setShowDeveloperNotes] = useState(false);

  useEffect(() => {
    simulatePermissionCheck();
  }, [config]);

  const simulatePermissionCheck = () => {
    setLoading(true);

    // Simulate API delay
    setTimeout(() => {
      const region = regionData[config.region];
      let result: PermissionResult;

      // 451 - Unavailable For Legal Reasons
      if (config.region === "restricted") {
        result = {
          allowed: false,
          statusCode: 451,
          reason:
            "Service unavailable in your region due to legal restrictions",
          availableChains: [],
          restrictions: [
            "All services blocked",
            "Legal compliance requirement",
          ],
        };
      }
      // VPN/Tor detection
      else if (config.vpnDetected || config.ipType === "tor") {
        result = {
          allowed: false,
          statusCode: 403,
          reason: "VPN/Proxy detected. Please disable VPN for service access.",
          availableChains: [],
          restrictions: [
            "VPN/Proxy connections not allowed",
            "Use residential IP address",
          ],
        };
      }
      // Datacenter IP - limited access
      else if (config.ipType === "datacenter") {
        result = {
          allowed: true,
          statusCode: 200,
          availableChains: allChains.filter(
            (c) =>
              !["XMR", "XRP", "XLM"].includes(c) &&
              !region.restricted.includes(c)
          ),
          restrictions: [
            "Privacy coins disabled for datacenter IPs",
            "Consider using residential connection for full access",
          ],
        };
      }
      // Normal residential - region based restrictions
      else {
        const restricted = region.restricted;
        const available = restricted.includes("ALL")
          ? []
          : allChains.filter((c) => !restricted.includes(c));

        result = {
          allowed: true,
          statusCode: 200,
          availableChains: available,
          restrictions:
            restricted.length > 0
              ? [`${restricted.join(", ")} not available in ${region.name}`]
              : [],
        };
      }

      setResult(result);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-2 rounded-full text-sm mb-4">
            <FaShieldAlt />
            Developer Tool
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            451 <span className="text-orange-500">Simulator</span>
          </h1>
          <p className="text-gray-400">
            Test how OctaneShift handles geo-restrictions and compliance
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FaCog className="text-orange-500" />
              Simulation Config
            </h2>

            {/* Region Selector */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">
                <FaMapMarkerAlt className="inline mr-2" />
                Simulated Region
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(regionData).map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setConfig((c) => ({ ...c, region: key as any }))
                    }
                    className={`p-3 rounded-lg text-left transition-all ${
                      config.region === key
                        ? "bg-orange-500 text-white"
                        : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-xl mr-2">{data.flag}</span>
                    <span className="text-sm">{data.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* VPN Detection Toggle */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">
                <FaGlobe className="inline mr-2" />
                VPN Detection
              </label>
              <button
                onClick={() =>
                  setConfig((c) => ({ ...c, vpnDetected: !c.vpnDetected }))
                }
                className={`w-full p-3 rounded-lg flex items-center justify-between transition-all ${
                  config.vpnDetected
                    ? "bg-red-500/20 border border-red-500/50 text-red-400"
                    : "bg-gray-700/50 text-gray-300"
                }`}
              >
                <span>
                  {config.vpnDetected ? "VPN Detected" : "No VPN Detected"}
                </span>
                {config.vpnDetected ? <FaLock /> : <FaUnlock />}
              </button>
            </div>

            {/* IP Type Selector */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">
                <FaServer className="inline mr-2" />
                IP Address Type
              </label>
              <div className="space-y-2">
                {(["residential", "datacenter", "tor"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setConfig((c) => ({ ...c, ipType: type }))}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      config.ipType === type
                        ? "bg-orange-500 text-white"
                        : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <span className="capitalize">{type}</span>
                    {type === "residential" && (
                      <span className="text-sm opacity-70 ml-2">
                        - Full access
                      </span>
                    )}
                    {type === "datacenter" && (
                      <span className="text-sm opacity-70 ml-2">
                        - Limited access
                      </span>
                    )}
                    {type === "tor" && (
                      <span className="text-sm opacity-70 ml-2">- Blocked</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Result Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FaCode className="text-orange-500" />
              API Response
            </h2>

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-12"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                    className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full"
                  />
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {/* Status Code Badge */}
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
                      result.statusCode === 200
                        ? "bg-green-500/20 text-green-400"
                        : result.statusCode === 451
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {result.allowed ? (
                      <FaCheckCircle />
                    ) : (
                      <FaExclamationTriangle />
                    )}
                    <span className="font-mono">HTTP {result.statusCode}</span>
                    {result.statusCode === 451 && (
                      <span>- Unavailable For Legal Reasons</span>
                    )}
                  </div>

                  {/* Reason */}
                  {result.reason && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                      <p className="text-red-400">{result.reason}</p>
                    </div>
                  )}

                  {/* Available Chains */}
                  <div className="mb-4">
                    <h3 className="text-gray-400 text-sm mb-2">
                      Available Chains
                    </h3>
                    {result.availableChains.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {result.availableChains.map((chain) => (
                          <span
                            key={chain}
                            className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm"
                          >
                            {chain}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-400">No chains available</p>
                    )}
                  </div>

                  {/* Restrictions */}
                  {result.restrictions.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-gray-400 text-sm mb-2">
                        Restrictions
                      </h3>
                      <ul className="space-y-2">
                        {result.restrictions.map((restriction, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-yellow-400"
                          >
                            <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                            <span>{restriction}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mock API Response */}
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre className="text-green-400">
                      {`{
  "allowed": ${result.allowed},
  "statusCode": ${result.statusCode},
  "chains": [${result.availableChains.map((c) => `"${c}"`).join(", ")}],
  "restrictions": ${JSON.stringify(result.restrictions, null, 2)}
}`}
                    </pre>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Developer Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <button
            onClick={() => setShowDeveloperNotes(!showDeveloperNotes)}
            className="w-full bg-gray-800/50 rounded-xl p-4 flex items-center justify-between text-white hover:bg-gray-800/70 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FaInfoCircle className="text-orange-500" />
              Developer Notes
            </span>
            <motion.span animate={{ rotate: showDeveloperNotes ? 180 : 0 }}>
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showDeveloperNotes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-800/30 rounded-b-xl p-6 border-t border-gray-700"
              >
                <div className="prose prose-invert max-w-none">
                  <h3 className="text-white">
                    How OctaneShift Handles Compliance
                  </h3>
                  <ul className="text-gray-300 space-y-2">
                    <li>
                      <strong className="text-orange-400">
                        x-user-ip Header:
                      </strong>{" "}
                      All shift creation requests include the user's IP via
                      x-user-ip header for geo-restriction compliance.
                    </li>
                    <li>
                      <strong className="text-orange-400">
                        451 Status Code:
                      </strong>{" "}
                      When a region is legally restricted, we return HTTP 451
                      (Unavailable For Legal Reasons) with a clear explanation.
                    </li>
                    <li>
                      <strong className="text-orange-400">
                        VPN Detection:
                      </strong>{" "}
                      Datacenter and known VPN IP ranges are detected to prevent
                      circumvention of geo-restrictions.
                    </li>
                    <li>
                      <strong className="text-orange-400">
                        Chain-Level Restrictions:
                      </strong>{" "}
                      Some assets like XMR may be restricted in certain regions
                      while others remain available.
                    </li>
                    <li>
                      <strong className="text-orange-400">
                        Graceful Degradation:
                      </strong>{" "}
                      When restrictions apply, we show which services ARE
                      available rather than just blocking.
                    </li>
                  </ul>

                  <h3 className="text-white mt-6">Implementation Details</h3>
                  <pre className="bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
                    {`// Example: Creating a shift with IP header
const response = await fetch('/api/shift', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-ip': userIP // Passed to SideShift for compliance
  },
  body: JSON.stringify(shiftData)
});

// SideShift handles 451 responses automatically
if (response.status === 451) {
  // Show user-friendly message
  showError('Service not available in your region');
}`}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* HTTP Status Codes Reference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 bg-gray-800/50 rounded-xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">
            HTTP Status Codes Reference
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="text-green-400 font-mono text-lg mb-1">
                200 OK
              </div>
              <p className="text-gray-400 text-sm">
                Full access granted, all requested services available.
              </p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="text-yellow-400 font-mono text-lg mb-1">
                403 Forbidden
              </div>
              <p className="text-gray-400 text-sm">
                Access denied due to VPN/proxy detection.
              </p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="text-red-400 font-mono text-lg mb-1">
                451 Legal
              </div>
              <p className="text-gray-400 text-sm">
                Unavailable for legal reasons in your region.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

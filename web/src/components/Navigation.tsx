import {
  FaBolt,
  FaChartBar,
  FaCrown,
  FaGasPump,
  FaGift,
  FaLayerGroup,
  FaRocket,
} from "react-icons/fa";
import { Link } from "react-router-dom";

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="text-2xl">🚀</div>
            <span className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              OctaneShift
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/gas"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <FaGasPump className="w-4 h-4" />
              <span>Gas</span>
            </Link>

            <Link
              to="/presets"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <FaBolt className="w-4 h-4" />
              <span>Presets</span>
            </Link>

            <Link
              to="/batch"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <FaLayerGroup className="w-4 h-4" />
              <span>Batch</span>
            </Link>

            <Link
              to="/gift/create"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <FaGift className="w-4 h-4" />
              <span>Gift</span>
            </Link>

            <Link
              to="/loyalty"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <FaCrown className="w-4 h-4" />
              <span>Rewards</span>
            </Link>

            <Link
              to="/status"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <FaChartBar className="w-4 h-4" />
              <span>Status</span>
            </Link>

            <Link
              to="/#swap"
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              <FaRocket className="w-4 h-4" />
              <span>Top Up</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-gray-300 hover:text-white">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

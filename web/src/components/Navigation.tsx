import { useEffect, useState } from "react";
import {
  FaBars,
  FaBolt,
  FaChartBar,
  FaCrown,
  FaExchangeAlt,
  FaGasPump,
  FaGift,
  FaHistory,
  FaLayerGroup,
  FaShareAlt,
  FaTimes,
} from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import WalletButton from "./WalletButton";

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  badge?: string;
}

function NavLink({ to, icon, label, isActive, badge }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
        isActive
          ? "text-white bg-white/10"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <span className="transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-md">
          {badge}
        </span>
      )}
      {isActive && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-green-500 rounded-full" />
      )}
    </Link>
  );
}

export default function Navigation() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Organized nav links - Core features first, then user features
  const navLinks = [
    {
      to: "/",
      icon: <FaExchangeAlt className="w-4 h-4" />,
      label: "Swap",
    },
    {
      to: "/gas",
      icon: <FaGasPump className="w-4 h-4" />,
      label: "Gas",
    },
    {
      to: "/batch",
      icon: <FaLayerGroup className="w-4 h-4" />,
      label: "Batch",
    },
    {
      to: "/presets",
      icon: <FaBolt className="w-4 h-4" />,
      label: "Presets",
    },
    {
      to: "/gift/create",
      icon: <FaGift className="w-4 h-4" />,
      label: "Gift",
    },
    {
      to: "/loyalty",
      icon: <FaCrown className="w-4 h-4" />,
      label: "Rewards",
    },
    {
      to: "/referrals",
      icon: <FaShareAlt className="w-4 h-4" />,
      label: "Referrals",
      badge: "0.5%",
    },
    {
      to: "/history",
      icon: <FaHistory className="w-4 h-4" />,
      label: "History",
    },
    {
      to: "/status",
      icon: <FaChartBar className="w-4 h-4" />,
      label: "Status",
    },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-gray-950/95 backdrop-blur-xl border-b border-white/5"
            : "bg-gray-950/80 backdrop-blur-md"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300">
                🚀
              </div>
              <span className="text-lg font-bold text-white">OctaneShift</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  icon={link.icon}
                  label={link.label}
                  isActive={
                    link.to === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(link.to)
                  }
                  badge={link.badge}
                />
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <WalletButton />

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? (
                  <FaTimes className="w-5 h-5" />
                ) : (
                  <FaBars className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-14 left-0 right-0 bg-gray-950 border-b border-white/5 max-h-[80vh] overflow-y-auto">
            <div className="p-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    (
                      link.to === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(link.to)
                    )
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.icon}
                  <span className="font-medium">{link.label}</span>
                  {link.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded-md">
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

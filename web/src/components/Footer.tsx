import { motion } from 'framer-motion';
import { FaTelegram, FaTwitter, FaGithub } from 'react-icons/fa';

export default function Footer() {
  const socialLinks = [
    { icon: FaTelegram, href: import.meta.env.VITE_TELEGRAM_BOT_URL, label: 'Telegram' },
    { icon: FaTwitter, href: '#', label: 'Twitter' },
    { icon: FaGithub, href: '#', label: 'GitHub' }
  ];

  return (
    <footer className="bg-black border-t border-gray-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-green-400 to-purple-500 text-transparent bg-clip-text">
              OctaneShift
            </h3>
            <p className="text-gray-400 text-sm">
              Instant gas top-ups across all major chains. Powered by cutting-edge swap technology.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {['Home', 'How It Works', 'Supported Chains', 'Track Order'].map((link) => (
                <li key={link}>
                  <motion.a
                    href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                    whileHover={{ x: 5 }}
                    className="text-gray-400 hover:text-green-400 transition-colors text-sm inline-block"
                  >
                    {link}
                  </motion.a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Connect</h4>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 bg-gray-800 hover:bg-gradient-to-br hover:from-green-500 hover:to-purple-500 rounded-lg flex items-center justify-center transition-all"
                  aria-label={social.label}
                >
                  <social.icon className="text-xl text-white" />
                </motion.a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400 text-sm mb-4">
            Powered by{' '}
            <a
              href="https://sideshift.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 transition-colors font-semibold"
            >
              SideShift.ai
            </a>
          </p>
          <p className="text-gray-500 text-xs">
            &copy; {new Date().getFullYear()} OctaneShift. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

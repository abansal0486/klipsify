import { LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-transparent"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
            className="relative w-full max-w-sm bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-white/30 overflow-hidden"
          >

            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-100/40  to-pink-100/40 pointer-events-none" />

            <div className="px-6 pt-10 pb-8 text-center relative z-10">

              {/* Animated Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="mx-auto w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-2xl flex items-center justify-center text-red-500 mb-5 shadow-inner"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <LogOut size={30} />
                </motion.div>
              </motion.div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Confirm Logout
              </h3>

              {/* Subtitle */}
              <p className="text-sm text-gray-500 leading-relaxed max-w-[250px] mx-auto">
                Are you sure you want to log out of your account?
              </p>

              {/* Buttons */}
              <div className="mt-8 flex flex-row gap-3">

                {/* Cancel */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={onClose}
                  className="flex-1 h-11 md:h-12 rounded-2xl border border-gray-200 text-[13px] md:text-sm font-semibold text-gray-600 bg-white/70 hover:bg-gray-100 transition"
                >
                  No, Stay
                </motion.button>

                {/* Confirm */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={onConfirm}
                  className="flex-1 h-11 md:h-12 rounded-2xl  bg-gradient-to-r from-purple-600 to-pink-500 text-white
            hover:from-purple-500 hover:to-pink-400
            shadow-md shadow-purple-200 hover:shadow-purple-300
            transition-ease-in-out duration-200 text-[13px] md:text-sm font-semibold"
                >
                  Yes, Logout
                </motion.button>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
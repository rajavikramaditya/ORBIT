import { motion } from "framer-motion";

/**
 * Scroll-in for a block of content.
 *
 * Tuned so it is never the reason a section looks empty. It triggers slightly
 * BEFORE the block reaches the viewport (a positive bottom margin), starts at
 * 25% opacity rather than 0, and settles in under half a second. The earlier
 * version waited until a block was 80px inside the viewport and then took
 * 0.75s — scroll at any speed and you were looking at blank space.
 */
export const Reveal = ({ children, delay = 0, y = 18, className = "" }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0.25, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "0px 0px 12% 0px" }}
    transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

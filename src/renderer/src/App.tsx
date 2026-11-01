import { motion } from 'framer-motion';

export function App() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0F1115] text-zinc-100">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl font-medium tracking-tight"
      >
        VOXEL 4.0
      </motion.h1>
    </div>
  );
}

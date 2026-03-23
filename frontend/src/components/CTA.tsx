import { Canvas } from '@react-three/fiber';
import { Scales3D } from './Scales3D';
import { useMobile } from '../hooks/useMobile';

export function CTA() {
  const isMobile = useMobile();

  return (
    <section className="relative min-h-screen bg-base flex flex-col items-center justify-center py-24 overflow-hidden">
      {/* 3D background only on desktop */}
      {!isMobile && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <Canvas camera={{ position: [0, 0, 15], fov: 45 }} dpr={1} performance={{ min: 0.5 }}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
            <group position={[0, -2, 0]} scale={0.8}>
              <Scales3D isBalanced={true} />
            </group>
          </Canvas>
        </div>
      )}

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 flex flex-col items-center">
        <h2 className="font-serif text-3xl sm:text-5xl md:text-7xl lg:text-8xl text-white mb-8 sm:mb-12 leading-tight">
          Add <span className="text-amber-500">EQUALIZER</span> to your chats.
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-12 sm:mb-16">
          <a
            href="https://t.me/EqualizerThebot"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-500 text-base font-mono font-bold uppercase tracking-widest px-8 sm:px-12 py-4 sm:py-6 rounded-none hover:bg-amber-400 active:bg-amber-600 transition-colors duration-300 relative overflow-hidden group inline-block text-black"
          >
            <span className="relative z-10">Add to Telegram</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </a>

          <a
            href="https://discord.com/oauth2/authorize?client_id=1483076054984822946"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#5865F2] text-base font-mono font-bold uppercase tracking-widest px-8 sm:px-12 py-4 sm:py-6 rounded-none hover:bg-[#4752C4] active:bg-[#3C45A5] transition-colors duration-300 relative overflow-hidden group inline-block text-white"
          >
            <span className="relative z-10">Add to Discord</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </a>
        </div>

        <p className="font-mono text-xs sm:text-sm md:text-base text-gray-500 tracking-widest uppercase text-center max-w-2xl px-4">
          Live in Telegram and Discord. Coming soon to WhatsApp, X DMs, and anywhere else deals happen.
        </p>

        <div className="mt-6 sm:mt-8 font-mono text-xs text-gray-600 px-4 text-center break-all sm:break-normal">
          Contract: 0x7a5c38be124c78da88D4C9F5ebEf72dC41869010 · Base Sepolia · 2.5% fee
        </div>

        <div
          className="mt-8 font-mono text-center"
          style={{ fontSize: '12px', color: 'rgba(232,228,217,0.4)' }}
        >
          Built for the Synthesis Hackathon 2026
        </div>
      </div>
    </section>
  );
}

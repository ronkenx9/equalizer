import { Canvas } from '@react-three/fiber';
import { Scales3D } from './Scales3D';

export function CTA() {
  return (
    <section className="relative min-h-screen bg-base flex flex-col items-center justify-center py-24 overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
          <group position={[0, -2, 0]} scale={0.8}>
            <Scales3D isBalanced={true} />
          </group>
        </Canvas>
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 flex flex-col items-center">
        <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl text-white mb-12 leading-tight">
          Add <span className="text-amber-500">EQUALIZER</span> to your Telegram.
        </h2>

        <a
          href="https://t.me/equalizer_agent_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-amber-500 text-base font-mono font-bold uppercase tracking-widest px-12 py-6 rounded-none hover:bg-amber-400 transition-colors duration-300 mb-16 relative overflow-hidden group inline-block"
        >
          <span className="relative z-10">Start Enforcing</span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        </a>

        <p className="font-mono text-sm md:text-base text-gray-500 tracking-widest uppercase">
          Also available for Discord · WhatsApp · Any DM · Everywhere deals happen
        </p>

        <div className="mt-8 font-mono text-xs text-gray-600">
          Contract: 0x7a5c38be124c78da88D4C9F5ebEf72dC41869010 · Base Sepolia · 2.5% fee
        </div>
      </div>
    </section>
  );
}

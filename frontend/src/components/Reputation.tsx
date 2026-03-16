import { useRef, useState } from 'react';

interface Profile {
  name: string;
  deals: number;
  volume: string;
  reliability: number;
  type: 'creator' | 'brand';
}

const creators: Profile[] = [
  { name: '0xDesigner', deals: 142, volume: '84.5 ETH', reliability: 99.2, type: 'creator' },
  { name: 'Alice.eth', deals: 89, volume: '32.1 ETH', reliability: 98.5, type: 'creator' },
  { name: 'Bob_Studio', deals: 210, volume: '112.0 ETH', reliability: 99.8, type: 'creator' },
];

const brands: Profile[] = [
  { name: 'MegaCorp', deals: 450, volume: '890.2 ETH', reliability: 99.9, type: 'brand' },
  { name: 'Startup_X', deals: 34, volume: '15.4 ETH', reliability: 95.0, type: 'brand' },
  { name: 'DAO_Treasury', deals: 128, volume: '450.0 ETH', reliability: 98.2, type: 'brand' },
];

function ProfileCard({ profile }: { profile: Profile }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const isCreator = profile.type === 'creator';
  const accentColor = isCreator ? 'text-amber-500' : 'text-blue-500';
  const bgColor = isCreator ? 'bg-amber-500' : 'bg-blue-500';
  const borderColor = isCreator ? 'border-amber-500/30' : 'border-blue-500/30';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`p-6 bg-gray-900/40 border ${borderColor} rounded-lg transition-transform duration-200 ease-out will-change-transform`}
      style={{ transform }}
    >
      <div className="flex justify-between items-start mb-6">
        <h4 className="font-mono text-lg text-white">{profile.name}</h4>
        <span className={`font-mono text-xs uppercase tracking-wider ${accentColor}`}>{profile.type}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 font-mono text-sm">
        <div>
          <div className="text-gray-500 mb-1">Deals</div>
          <div className="text-white">{profile.deals}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Volume</div>
          <div className="text-white">{profile.volume}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between font-mono text-sm mb-2">
          <span className="text-gray-500">Reliability</span>
          <span className="text-white">{profile.reliability}%</span>
        </div>
        <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
          <div className={`h-full ${bgColor}`} style={{ width: `${profile.reliability}%` }} />
        </div>
      </div>
    </div>
  );
}

export function Reputation() {
  return (
    <section id="reputation" className="py-24 bg-base relative z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl text-white mb-4">Reputation</h2>
          <p className="font-sans text-xl text-gray-400">The only metric that matters.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
          {/* Creators */}
          <div className="space-y-6">
            <h3 className="font-mono text-sm tracking-widest text-amber-500 uppercase mb-8 border-b border-amber-500/20 pb-4">Creators</h3>
            {creators.map((p, i) => <ProfileCard key={i} profile={p} />)}
          </div>

          {/* Brands */}
          <div className="space-y-6">
            <h3 className="font-mono text-sm tracking-widest text-blue-500 uppercase mb-8 border-b border-blue-500/20 pb-4">Brands</h3>
            {brands.map((p, i) => <ProfileCard key={i} profile={p} />)}
          </div>
        </div>

        <div className="text-center max-w-2xl mx-auto">
          <p className="font-serif text-2xl md:text-3xl text-white leading-relaxed">
            Your reputation travels with you. <span className="text-green-500">Onchain. Forever.</span> No platform can take it.
          </p>
        </div>
      </div>
    </section>
  );
}

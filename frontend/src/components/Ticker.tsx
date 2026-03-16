"use client";

const deals = [
  { type: "completed", text: "@designer → @startup · 0.15 ETH · Logo Design · RELEASED" },
  { type: "active", text: "@copywriter → @protocol · 0.08 ETH · Whitepaper Draft · 14h remaining" },
  { type: "completed", text: "@dev → @dao · 0.5 ETH · Smart Contract Audit · RELEASED" },
  { type: "dispute", text: "@illustrator → @brand · 0.12 ETH · NFT Collection · DISPUTED" },
  { type: "completed", text: "@marketer → @defi · 0.2 ETH · Twitter Thread Series · RELEASED" },
  { type: "active", text: "@analyst → @fund · 0.3 ETH · Market Report · 6h remaining" },
  { type: "completed", text: "@writer → @magazine · 0.05 ETH · Article · RELEASED" },
  { type: "completed", text: "@editor → @creator · 0.1 ETH · Video Edit · RELEASED" },
];

function DealColor(type: string) {
  switch (type) {
    case "completed": return "text-resolve";
    case "active": return "text-amber";
    case "dispute": return "text-danger";
    default: return "text-text-secondary";
  }
}

export default function Ticker() {
  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-base/90 border-b border-muted/20 overflow-hidden">
      <div className="animate-ticker flex whitespace-nowrap py-1.5">
        {[...deals, ...deals].map((deal, i) => (
          <span key={i} className="flex items-center gap-3 mx-6">
            <span className={`w-1.5 h-1.5 rounded-full ${
              deal.type === "completed" ? "bg-resolve" :
              deal.type === "active" ? "bg-amber" : "bg-danger"
            }`} />
            <span className={`font-mono text-[10px] tracking-wide ${DealColor(deal.type)}`}>
              {deal.text}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

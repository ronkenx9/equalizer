import dynamic from "next/dynamic";

const CustomCursor = dynamic(() => import("@/components/CustomCursor"), { ssr: false });
const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), { ssr: false });
const Navbar = dynamic(() => import("@/components/Navbar"), { ssr: false });
const Ticker = dynamic(() => import("@/components/Ticker"), { ssr: false });
const HeroSection = dynamic(() => import("@/components/HeroSection"), { ssr: false });
const ProblemSection = dynamic(() => import("@/components/ProblemSection"), { ssr: false });
const HowItWorksSection = dynamic(() => import("@/components/HowItWorksSection"), { ssr: false });
const LiveFeedSection = dynamic(() => import("@/components/LiveFeedSection"), { ssr: false });
const BalanceSection = dynamic(() => import("@/components/BalanceSection"), { ssr: false });
const ReputationSection = dynamic(() => import("@/components/ReputationSection"), { ssr: false });
const CTASection = dynamic(() => import("@/components/CTASection"), { ssr: false });

export default function Home() {
  return (
    <>
      <CustomCursor />
      <ScrollProgress />
      <Navbar />
      <Ticker />

      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <LiveFeedSection />
        <BalanceSection />
        <ReputationSection />
        <CTASection />
      </main>
    </>
  );
}

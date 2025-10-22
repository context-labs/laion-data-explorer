import { LINKS } from "~/lib/models";
import { cn } from "~/ui";
import { ExternalLink, TestTube2Icon } from "lucide-react";
import type { ClassNameValue } from "tailwind-merge";

function BannerContent() {
  const LINK_STYLES: ClassNameValue = cn(`
    ml-2 inline-flex items-center font-medium underline

    hover:cursor-pointer
  `);

  return (
    <div className="flex items-center justify-center text-base text-white">
      <p
        className={`
          text-center text-xs

          md:text-base
        `}
      >
        <TestTube2Icon className="mr-2 inline-block text-amber-400" size={18} />
        <span className="font-semibold">Inference Devnet:</span> This is a test
        network running on <span className="font-semibold">Solana Devnet</span>.
        No tokens have any financial value.
        <a
          className={LINK_STYLES}
          href={LINKS.INFERENCE_DEVNET_STAKING_PROTOCOL_DOCUMENTATION}
          rel="noopener noreferrer"
          target="_blank"
        >
          Learn More
          <ExternalLink className="ml-1" size={16} />
        </a>
      </p>
    </div>
  );
}

export function StakingDashboardBanner() {
  return (
    <div
      className={`
        fixed z-50 w-full

        sm:relative
      `}
    >
      <div
        className={`
          w-full bg-gradient-to-r from-cyan-600 via-emerald-500 to-amber-500 p-3
        `}
      >
        <div
          className={`
            mx-auto flex max-w-7xl items-center justify-center px-4

            lg:px-8

            sm:px-6
          `}
        >
          <BannerContent />
        </div>
      </div>
    </div>
  );
}

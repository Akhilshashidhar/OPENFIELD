import { useEffect, useState } from "react";
import { Monitor } from "@/icons/lucide-compat";
import { ToolcraftButton as Button } from "@openreel/ui";
import { ToolcraftText as Text } from "@openreel/ui";
import { OpenFieldLogo } from "./brand/OpenFieldLogo";

export function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
      const isMobileDevice = mobileKeywords.test(userAgent);
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <div className="bg-bg-1 border border-border rounded-2xl p-8 shadow-sm">
            <Monitor className="w-20 h-20 text-fg" strokeWidth={1.5} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-center">
            <OpenFieldLogo size={42} />
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-border" />
            <Text type="supporting" color="secondary" weight="medium" className="text-lg text-fg-2">
              Desktop Only
            </Text>
            <div className="h-px w-8 bg-border" />
          </div>
        </div>

        <div className="space-y-4 bg-bg-1/60 backdrop-blur-sm rounded-xl p-6 border border-border">
          <Text
            type="supporting"
            color="primary"
            display="block"
            className="text-base text-fg leading-relaxed"
          >
            Openfield is a professional video editor that requires a desktop or
            laptop computer.
          </Text>
          <Text
            type="supporting"
            color="secondary"
            display="block"
            className="text-sm text-fg-muted"
          >
            Please visit this page on your desktop or laptop to start creating
            amazing videos.
          </Text>
        </div>

        <div className="pt-2">
          <Button
            as="a"
            label="Learn More"
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent hover:bg-accent-strong text-white font-medium rounded-lg transition-all duration-200 shadow-sm transform hover:scale-[1.02] active:scale-[0.98]"
          />
        </div>
      </div>
    </div>
  );
}

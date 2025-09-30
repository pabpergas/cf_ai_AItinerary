"use client"

import { cn } from "@/lib/utils"

interface AIOrbProps {
  size?: string
  className?: string
  colors?: {
    bg?: string
    c1?: string
    c2?: string
    c3?: string
  }
  animationDuration?: number
}

const AIOrb: React.FC<AIOrbProps> = ({
  size = "192px",
  className,
  colors,
  animationDuration = 20,
}) => {
  const defaultColors = {
    bg: "oklch(12% 0.02 264.695)",
    c1: "oklch(65% 0.25 260)", // Blue
    c2: "oklch(70% 0.22 200)", // Cyan
    c3: "oklch(68% 0.24 240)", // Purple
  }

  const finalColors = { ...defaultColors, ...colors }

  // Extract numeric value from size for calculations
  const sizeValue = parseInt(size.replace("px", ""), 10)

  // Responsive calculations based on size
  const blurAmount =
    sizeValue < 50
      ? Math.max(sizeValue * 0.008, 1)
      : Math.max(sizeValue * 0.015, 4)

  const contrastAmount =
    sizeValue < 50
      ? Math.max(sizeValue * 0.004, 1.2)
      : Math.max(sizeValue * 0.008, 1.5)

  const dotSize =
    sizeValue < 50
      ? Math.max(sizeValue * 0.004, 0.05)
      : Math.max(sizeValue * 0.008, 0.1)

  const shadowSpread =
    sizeValue < 50
      ? Math.max(sizeValue * 0.004, 0.5)
      : Math.max(sizeValue * 0.008, 2)

  const maskRadius =
    sizeValue < 30
      ? "0%"
      : sizeValue < 50
        ? "5%"
        : sizeValue < 100
          ? "15%"
          : "25%"

  const finalContrast =
    sizeValue < 30
      ? 1.1
      : sizeValue < 50
        ? Math.max(contrastAmount * 1.2, 1.3)
        : contrastAmount

  return (
    <div
      className={cn("ai-orb", className)}
      style={
        {
          width: size,
          height: size,
          "--bg": finalColors.bg,
          "--c1": finalColors.c1,
          "--c2": finalColors.c2,
          "--c3": finalColors.c3,
          "--animation-duration": `${animationDuration}s`,
          "--blur-amount": `${blurAmount}px`,
          "--contrast-amount": finalContrast,
          "--dot-size": `${dotSize}px`,
          "--shadow-spread": `${shadowSpread}px`,
          "--mask-radius": maskRadius,
        } as React.CSSProperties
      }
    >
      <style jsx>{`
        @property --angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .ai-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
          transform: scale(1.1);
        }

        .ai-orb::before,
        .ai-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          transform: translateZ(0);
        }

        .ai-orb::before {
          background:
            conic-gradient(
              from calc(var(--angle) * 2) at 25% 70%,
              var(--c3),
              transparent 20% 80%,
              var(--c3)
            ),
            conic-gradient(
              from calc(var(--angle) * 2) at 45% 75%,
              var(--c2),
              transparent 30% 60%,
              var(--c2)
            ),
            conic-gradient(
              from calc(var(--angle) * -3) at 80% 20%,
              var(--c1),
              transparent 40% 60%,
              var(--c1)
            ),
            conic-gradient(
              from calc(var(--angle) * 2) at 15% 5%,
              var(--c2),
              transparent 10% 90%,
              var(--c2)
            ),
            conic-gradient(
              from calc(var(--angle) * 1) at 20% 80%,
              var(--c1),
              transparent 10% 90%,
              var(--c1)
            ),
            conic-gradient(
              from calc(var(--angle) * -2) at 85% 10%,
              var(--c3),
              transparent 20% 80%,
              var(--c3)
            );
          box-shadow: inset var(--bg) 0 0 var(--shadow-spread)
            calc(var(--shadow-spread) * 0.2);
          filter: blur(var(--blur-amount)) contrast(var(--contrast-amount));
          animation: rotate var(--animation-duration) linear infinite;
        }

        .ai-orb::after {
          background-image: radial-gradient(
            circle at center,
            var(--bg) var(--dot-size),
            transparent var(--dot-size)
          );
          background-size: calc(var(--dot-size) * 2) calc(var(--dot-size) * 2);
          backdrop-filter: blur(calc(var(--blur-amount) * 2))
            contrast(calc(var(--contrast-amount) * 2));
          mix-blend-mode: overlay;
        }

        .ai-orb[style*="--mask-radius: 0%"]::after {
          mask-image: none;
        }

        .ai-orb:not([style*="--mask-radius: 0%"])::after {
          mask-image: radial-gradient(
            black var(--mask-radius),
            transparent 75%
          );
        }

        @keyframes rotate {
          to {
            --angle: 360deg;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ai-orb::before {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

export default AIOrb

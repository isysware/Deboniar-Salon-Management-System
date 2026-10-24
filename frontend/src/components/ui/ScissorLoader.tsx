import React from 'react';

interface ScissorLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ScissorLoader: React.FC<ScissorLoaderProps> = ({ size = 'md', className = '' }) => {
  const pixelSize = size === 'sm' ? 44 : size === 'lg' ? 76 : 58;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <style>{`
        @keyframes scissor-blade-top {
          0%, 100% {
            transform: rotate(0deg);
          }
          28% {
            transform: rotate(-22deg);
          }
          62% {
            transform: rotate(0deg);
          }
          78% {
            transform: rotate(-5deg);
          }
          88% {
            transform: rotate(0deg);
          }
        }
        @keyframes scissor-blade-bottom {
          0%, 100% {
            transform: rotate(0deg);
          }
          28% {
            transform: rotate(22deg);
          }
          62% {
            transform: rotate(0deg);
          }
          78% {
            transform: rotate(5deg);
          }
          88% {
            transform: rotate(0deg);
          }
        }
        @keyframes scissor-bob {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.03);
          }
        }
        .scissor-snip-top {
          transform-origin: 12px 12px;
          animation: scissor-blade-top 1.05s cubic-bezier(0.35, 0, 0.25, 1) infinite;
        }
        .scissor-snip-bottom {
          transform-origin: 12px 12px;
          animation: scissor-blade-bottom 1.05s cubic-bezier(0.35, 0, 0.25, 1) infinite;
        }
        .scissor-container {
          animation: scissor-bob 2.1s ease-in-out infinite;
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        {/* Soft salon ambient glow */}
        <div className="absolute w-16 h-16 rounded-full bg-blue-500/15 blur-lg pointer-events-none" />

        <div className="scissor-container relative z-10 flex items-center justify-center">
          <svg
            width={pixelSize}
            height={pixelSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2254E1"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="filter drop-shadow-sm overflow-visible"
          >
            {/* Top Blade & Bottom Handle Ring */}
            <g className="scissor-snip-top">
              {/* Upper cutting blade */}
              <path d="M12 12 L21 4.5" stroke="#2254E1" strokeWidth="2.2" />
              {/* Lower connecting arm */}
              <path d="M12 12 L8.2 15.8" stroke="#1B44B8" strokeWidth="2" />
              {/* Lower finger loop */}
              <circle cx="6" cy="18" r="3.2" stroke="#1B44B8" strokeWidth="1.8" fill="#EEF2FF" />
            </g>

            {/* Bottom Blade & Top Handle Ring */}
            <g className="scissor-snip-bottom">
              {/* Lower cutting blade */}
              <path d="M12 12 L21 19.5" stroke="#2254E1" strokeWidth="2.2" />
              {/* Upper connecting arm */}
              <path d="M12 12 L8.2 8.2" stroke="#1B44B8" strokeWidth="2" />
              {/* Upper finger loop */}
              <circle cx="6" cy="6" r="3.2" stroke="#1B44B8" strokeWidth="1.8" fill="#EEF2FF" />
            </g>

            {/* Pivot screw rivet in center */}
            <circle cx="12" cy="12" r="1.6" fill="#2254E1" stroke="#FFFFFF" strokeWidth="0.8" />
          </svg>
        </div>
      </div>
    </div>
  );
};

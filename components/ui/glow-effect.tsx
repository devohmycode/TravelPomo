'use client';
import { cn } from '@/lib/utils';
import { motion, Transition } from 'motion/react';

export type GlowEffectProps = {
  className?: string;
  style?: React.CSSProperties;
  colors?: string[];
  mode?:
    | 'rotate'
    | 'pulse'
    | 'breathe'
    | 'colorShift'
    | 'flowHorizontal'
    | 'static'
    | 'rainbow'
    | 'neon'
    | 'fire'
    | 'glitch'
    | 'heartbeat';
  blur?:
    | number
    | 'softest'
    | 'soft'
    | 'medium'
    | 'strong'
    | 'stronger'
    | 'strongest'
    | 'none';
  transition?: Transition;
  scale?: number;
  duration?: number;
};

export function GlowEffect({
  className,
  style,
  colors = ['#FF5733', '#33FF57', '#3357FF', '#F1C40F'],
  mode = 'rotate',
  blur = 'medium',
  transition,
  scale = 1,
  duration = 5,
}: GlowEffectProps) {
  const BASE_TRANSITION = {
    repeat: Infinity,
    duration: duration,
    ease: 'linear',
  };

  const animations = {
    rotate: {
      background: [
        `conic-gradient(from 0deg at 50% 50%, ${colors.join(', ')})`,
        `conic-gradient(from 360deg at 50% 50%, ${colors.join(', ')})`,
      ],
      transition: {
        ...(transition ?? BASE_TRANSITION),
      },
    },
    pulse: {
      background: colors.map(
        (color) =>
          `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
      ),
      scale: [1 * scale, 1.1 * scale, 1 * scale],
      opacity: [0.5, 0.8, 0.5],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    breathe: {
      background: [
        ...colors.map(
          (color) =>
            `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
        ),
      ],
      scale: [1 * scale, 1.05 * scale, 1 * scale],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    colorShift: {
      background: colors.map((color, index) => {
        const nextColor = colors[(index + 1) % colors.length];
        return `conic-gradient(from 0deg at 50% 50%, ${color} 0%, ${nextColor} 50%, ${color} 100%)`;
      }),
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    flowHorizontal: {
      background: colors.map((color) => {
        const nextColor = colors[(colors.indexOf(color) + 1) % colors.length];
        return `linear-gradient(to right, ${color}, ${nextColor})`;
      }),
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    static: {
      background: `linear-gradient(to right, ${colors.join(', ')})`,
    },
    rainbow: {
      background: [
        'conic-gradient(from 0deg at 50% 50%, hsl(0,80%,60%), hsl(60,80%,60%), hsl(120,80%,60%), hsl(180,80%,60%), hsl(240,80%,60%), hsl(300,80%,60%), hsl(360,80%,60%))',
        'conic-gradient(from 360deg at 50% 50%, hsl(0,80%,60%), hsl(60,80%,60%), hsl(120,80%,60%), hsl(180,80%,60%), hsl(240,80%,60%), hsl(300,80%,60%), hsl(360,80%,60%))',
      ],
      transition: {
        ...(transition ?? { ...BASE_TRANSITION, duration: 4 }),
      },
    },
    neon: {
      boxShadow: [
        `0 0 2px ${colors[0]}, 0 0 4px ${colors[0]}, inset 0 0 2px ${colors[0]}`,
        `0 0 4px ${colors[1] || colors[0]}, 0 0 8px ${colors[1] || colors[0]}, inset 0 0 4px ${colors[1] || colors[0]}`,
        `0 0 2px ${colors[0]}, 0 0 4px ${colors[0]}, inset 0 0 2px ${colors[0]}`,
      ],
      opacity: [0.8, 1, 0.8],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          duration: 2,
          repeatType: 'mirror',
        }),
      },
    },
    fire: {
      background: [
        'linear-gradient(0deg, #FF4500 0%, #FF6600 50%, #FF8C00 100%)',
        'linear-gradient(0deg, #FF6600 0%, #FF4500 50%, #FF8C00 100%)',
        'linear-gradient(0deg, #FF4500 0%, #FF6600 50%, #FF8C00 100%)',
      ],
      scaleY: [1, 1.15, 1],
      scaleX: [1, 1.02, 1],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          duration: 1.5,
          repeatType: 'mirror',
        }),
      },
    },
    glitch: {
      background: [
        `linear-gradient(to right, ${colors[0]}, ${colors[1] || colors[0]})`,
        `linear-gradient(to right, ${colors[1] || colors[0]}, ${colors[0]})`,
        `linear-gradient(to right, ${colors[0]}, ${colors[1] || colors[0]})`,
      ],
      x: [0, -3, 3, 0, 2, -2, 0],
      opacity: [1, 0.7, 1, 0.8, 1, 0.6, 1],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          duration: 0.3,
          ease: 'linear',
        }),
      },
    },
    heartbeat: {
      background: `radial-gradient(circle at 50% 50%, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`,
      scale: [1 * scale, 1.12 * scale, 1 * scale, 1.06 * scale, 1 * scale],
      opacity: [0.6, 1, 0.6, 0.85, 0.6],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          duration: 1.2,
          times: [0, 0.15, 0.4, 0.55, 1],
        }),
      },
    },
  };

  const getBlurClass = (blur: GlowEffectProps['blur']) => {
    if (typeof blur === 'number') {
      return `blur-[${blur}px]`;
    }

    const presets = {
      softest: 'blur-sm',
      soft: 'blur',
      medium: 'blur-md',
      strong: 'blur-lg',
      stronger: 'blur-xl',
      strongest: 'blur-xl',
      none: 'blur-none',
    };

    return presets[blur as keyof typeof presets];
  };

  return (
    <motion.div
      style={
        {
          ...style,
          '--scale': scale,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        } as React.CSSProperties
      }
      animate={animations[mode]}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        'scale-[var(--scale)] transform-gpu',
        getBlurClass(blur),
        className
      )}
    />
  );
}

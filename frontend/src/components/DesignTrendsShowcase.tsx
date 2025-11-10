/**
 * 2025 Design Trends Showcase
 *
 * This component demonstrates all the modern design trends implemented:
 * 1. Bento Grid Layout
 * 2. Progressive Blur & Glass Morphism
 * 3. Micro-interactions
 * 4. Exaggerated Minimalism
 * 5. 3D Interactive Elements
 * 6. Whimsical Animations
 * 7. Fluid Responsive Design
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BentoGrid, BentoCard } from './layouts/BentoGrid';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalTrigger } from './ui/Modal';

export const DesignTrendsShowcase: React.FC = () => {
  const [showCelebration, setShowCelebration] = useState(false);

  const handleCelebrate = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-12">
      {/* Header with Exaggerated Minimalism */}
      <section className="space-y-4">
        <motion.h1
          className="text-[var(--fluid-font-4xl)] font-black tracking-tight"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          2025 Design Trends
        </motion.h1>
        <motion.p
          className="text-[var(--fluid-font-lg)] text-[var(--color-text-secondary)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Modern, asymmetric, and delightfully interactive
        </motion.p>
      </section>

      {/* Trend 1: Bento Grid Layout */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          1. Bento Grid Layout
        </h2>
        <BentoGrid columns={3} gap="lg">
          {/* Hero Card - Large */}
          <BentoCard colSpan={2} rowSpan={2} glass>
            <div className="h-full flex flex-col justify-between">
              <div>
                <h3 className="text-[var(--fluid-font-xl)] font-bold mb-2">
                  Hero Card
                </h3>
                <p className="text-[var(--color-text-secondary)]">
                  Spans 2 columns × 2 rows with glass morphism effect
                </p>
              </div>
              <div className="text-6xl font-black text-[var(--color-brand-primary)]">
                42
              </div>
            </div>
          </BentoCard>

          {/* Stats Cards */}
          <BentoCard variant="elevated">
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--color-brand-secondary)]">
                1.2K
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Active Users
              </p>
            </div>
          </BentoCard>

          <BentoCard variant="elevated">
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--color-brand-primary)]">
                98%
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Satisfaction
              </p>
            </div>
          </BentoCard>

          {/* Wide Card */}
          <BentoCard colSpan={3} glass>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Full Width Card</h4>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Spans all 3 columns with glass effect
                </p>
              </div>
              <Button variant="primary">Action</Button>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      {/* Trend 2: Progressive Blur & Glass Morphism */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          2. Progressive Blur & Glass Morphism
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="glass p-8 rounded-[var(--radius-lg)]"
            style={{
              background:
                'linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(26, 26, 26, 0.8) 100%)',
              backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)',
            }}
          >
            <h3 className="text-lg font-semibold mb-2">Glass Panel</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Frosted glass effect with progressive transparency
            </p>
          </div>

          <Modal>
            <ModalTrigger asChild>
              <Button variant="primary" className="w-full md:w-auto">
                Open Modal with Progressive Blur
              </Button>
            </ModalTrigger>
            <ModalContent size="md">
              <ModalHeader>
                <ModalTitle>Progressive Blur Modal</ModalTitle>
              </ModalHeader>
              <ModalBody>
                <p className="text-[var(--color-text-secondary)]">
                  Notice the radial gradient blur on the backdrop - it's darker
                  at the edges and lighter in the center, creating depth
                  perception.
                </p>
              </ModalBody>
            </ModalContent>
          </Modal>
        </div>
      </section>

      {/* Trend 3: Micro-interactions */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          3. Micro-interactions
        </h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Hover Me (Lift)</Button>
          <Button variant="secondary">Click Me (Spring)</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="outline">Outline</Button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          All buttons have micro-interactions: hover for lift effect, click for
          spring animation
        </p>
      </section>

      {/* Trend 4: Exaggerated Minimalism */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          4. Exaggerated Minimalism
        </h2>
        <Card className="p-[var(--fluid-space-xl)]">
          <div className="space-y-6">
            <h3 className="text-[var(--fluid-font-3xl)] font-black tracking-tight">
              Clean. Bold. Minimal.
            </h3>
            <p className="text-[var(--fluid-font-base)] text-[var(--color-text-secondary)]">
              Generous spacing, oversized typography, and bold accents
            </p>
            <div className="text-8xl font-black text-[var(--color-brand-primary)] tabular-nums">
              128
              <span className="text-2xl ml-2">BPM</span>
            </div>
          </div>
        </Card>
      </section>

      {/* Trend 5: 3D Interactive Elements */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          5. 3D Interactive Elements
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card enable3D interactive className="h-48">
            <h4 className="font-semibold mb-2">3D Tilt Card</h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Hover to see 3D tilt effect
            </p>
          </Card>
          <Card enable3D interactive variant="elevated" className="h-48">
            <h4 className="font-semibold mb-2">Elevated 3D</h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              With elevation shadows
            </p>
          </Card>
          <Card enable3D interactive variant="outlined" className="h-48">
            <h4 className="font-semibold mb-2">Outlined 3D</h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Strong border variant
            </p>
          </Card>
        </div>
      </section>

      {/* Trend 6: Whimsical Animations */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          6. Whimsical Animations
        </h2>
        <div className="flex flex-wrap gap-4">
          <Button
            variant="primary"
            onClick={handleCelebrate}
            className={showCelebration ? 'animate-tada' : ''}
          >
            Celebrate! 🎉
          </Button>
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Button variant="secondary">Playful Hover</Button>
          </motion.div>
          <div className="inline-block animate-wiggle">
            <Button variant="ghost">Wiggle</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="glass p-4 rounded-lg animate-bounce-in">
            <p className="text-sm">Bounce In</p>
          </div>
          <div className="glass p-4 rounded-lg animate-elastic">
            <p className="text-sm">Elastic</p>
          </div>
          <div className="glass p-4 rounded-lg float-3d">
            <p className="text-sm">Float 3D</p>
          </div>
        </div>
      </section>

      {/* Trend 7: Fluid Responsive Design */}
      <section className="space-y-6">
        <h2 className="text-[var(--fluid-font-2xl)] font-bold">
          7. Fluid Responsive Design
        </h2>
        <Card className="p-[var(--fluid-space-lg)]">
          <h3
            className="font-bold mb-4"
            style={{ fontSize: 'var(--fluid-font-xl)' }}
          >
            Fluid Typography
          </h3>
          <p
            className="text-[var(--color-text-secondary)] mb-4"
            style={{ fontSize: 'var(--fluid-font-base)' }}
          >
            This text scales smoothly with viewport size using CSS clamp(). No
            breakpoints needed - it's truly fluid and responsive.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-4">
            <div className="glass p-4 rounded-lg">
              <p className="text-sm">Auto-fit Grid</p>
            </div>
            <div className="glass p-4 rounded-lg">
              <p className="text-sm">Responsive</p>
            </div>
            <div className="glass p-4 rounded-lg">
              <p className="text-sm">No Breakpoints</p>
            </div>
          </div>
        </Card>
      </section>

      {/* Summary */}
      <section className="space-y-4">
        <Card variant="elevated" className="p-[var(--fluid-space-xl)]">
          <h2 className="text-[var(--fluid-font-2xl)] font-bold mb-4">
            Implementation Summary
          </h2>
          <ul className="space-y-2 text-[var(--color-text-secondary)]">
            <li>✅ Bento Grid with responsive columns and glass morphism</li>
            <li>✅ Progressive blur on modals and overlays</li>
            <li>✅ Framer Motion micro-interactions on all buttons</li>
            <li>✅ 3D hover effects with tilt and perspective</li>
            <li>
              ✅ Whimsical animations (tada, wiggle, elastic, bounce, float)
            </li>
            <li>✅ Fluid typography and spacing using CSS clamp()</li>
            <li>✅ Accessibility: respects prefers-reduced-motion</li>
            <li>✅ Performance: hardware-accelerated transforms</li>
          </ul>
        </Card>
      </section>
    </div>
  );
};

export default DesignTrendsShowcase;

"use client";

// "Walk to the bin" in five steps. On wide screens the phone stays put while the steps scroll
// past, and its screen changes to match the step in the middle of the window. On phones each
// step shows its own screen.
import { m, useInView, useScroll, useTransform, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PhoneFrame, Screen, type AppScreen } from "./Frames";
import { Tilt } from "./Motion";

export type StoryStep = { screen: AppScreen; title: string; body: string; alt: string };

function Step({ step, index, onActive }: { step: StoryStep; index: number; onActive: (i: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  return (
    <li ref={ref} className="flex flex-col gap-6 lg:min-h-[72vh] lg:justify-center">
      <div className="flex gap-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground" aria-hidden="true">
          {index + 1}
        </span>
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-2xl font-bold sm:text-3xl">{step.title}</h3>
          <p className="max-w-[38ch] text-lg leading-relaxed text-muted-foreground">{step.body}</p>
        </div>
      </div>
      <PhoneFrame className="mx-auto w-[min(72vw,280px)] lg:hidden">
        <Screen name={step.screen} alt={step.alt} sizes="72vw" />
      </PhoneFrame>
    </li>
  );
}

export function ScrollStory({ steps }: { steps: StoryStep[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
      <div className="hidden lg:block">
        <div className="sticky top-[12vh] flex h-[76vh] items-center justify-center">
          <Tilt max={6}>
            <PhoneFrame className="w-[min(320px,34vh)]">
              {steps.map((step, i) => (
                <m.div key={step.screen} className="absolute inset-0" initial={false} animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 1.03 }} transition={{ duration: 0.45 }}>
                  <Screen name={step.screen} alt={i === active ? step.alt : ""} sizes="320px" />
                </m.div>
              ))}
            </PhoneFrame>
          </Tilt>
        </div>
      </div>
      <ol className="flex flex-col gap-16 lg:gap-0">
        {steps.map((step, i) => (
          <Step key={step.screen} step={step} index={i} onActive={setActive} />
        ))}
      </ol>
    </div>
  );
}

// A full-width photo that drifts slower than the page as you scroll
export function ParallaxPhoto({ src, alt, width, height, children }: { src: string; alt: string; width: number; height: number; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-8%", "8%"]);
  return (
    <div ref={ref} className="relative overflow-hidden">
      <m.div className="absolute inset-[-10%_0]" style={{ y }}>
        <Image src={src} alt={alt} width={width} height={height} sizes="100vw" className="h-full w-full object-cover" />
      </m.div>
      {children}
    </div>
  );
}

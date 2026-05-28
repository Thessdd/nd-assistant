import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";

type Phase = "inhale" | "hold" | "exhale" | "hold2";

const PHASES: { key: Phase; seconds: number; labelKey: string }[] = [
  { key: "inhale", seconds: 4, labelKey: "calmKit.boxBreathing.phase.inhale" },
  { key: "hold", seconds: 4, labelKey: "calmKit.boxBreathing.phase.hold" },
  { key: "exhale", seconds: 4, labelKey: "calmKit.boxBreathing.phase.exhale" },
  { key: "hold2", seconds: 4, labelKey: "calmKit.boxBreathing.phase.hold" }
];

const GROUNDING_STEPS = [5, 4, 3, 2, 1] as const;

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export default function CalmKit({
  open,
  onClose,
  reduceMotion
}: {
  open: boolean;
  onClose: () => void;
  reduceMotion: boolean;
}) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseLeftMs, setPhaseLeftMs] = useState(PHASES[0].seconds * 1000);
  const [running, setRunning] = useState(false);

  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const current = PHASES[phaseIdx] ?? PHASES[0];
  const phaseTotalMs = current.seconds * 1000;

  const progress = useMemo(() => {
    const done = 1 - phaseLeftMs / phaseTotalMs;
    return clamp01(done);
  }, [phaseLeftMs, phaseTotalMs]);

  useEffect(() => {
    if (!open) return;
    setPhaseIdx(0);
    setPhaseLeftMs(PHASES[0].seconds * 1000);
    setRunning(false);
  }, [open]);

  useEffect(() => {
    if (!open || !running) return;

    lastTickRef.current = performance.now();
    tickRef.current = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;

      setPhaseLeftMs((prev) => {
        const next = prev - dt;
        if (next > 0) return next;

        setPhaseIdx((i) => (i + 1) % PHASES.length);
        const nextPhase = PHASES[(phaseIdx + 1) % PHASES.length] ?? PHASES[0];
        return nextPhase.seconds * 1000;
      });
    }, 120);

    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [open, running, phaseIdx]);

  const circleScale = useMemo(() => {
    // Visual: grow on inhale, shrink on exhale, stable on holds.
    const base = 0.88;
    const amp = 0.22;
    if (current.key === "inhale") return base + amp * progress;
    if (current.key === "exhale") return base + amp * (1 - progress);
    return base + amp * 0.5;
  }, [current.key, progress]);

  const secondsLeft = Math.max(0, Math.ceil(phaseLeftMs / 1000));

  // Grounding (5-4-3-2-1)
  const [groundIdx, setGroundIdx] = useState(0);
  const [groundDone, setGroundDone] = useState<boolean[]>(() => GROUNDING_STEPS.map(() => false));

  useEffect(() => {
    if (!open) return;
    setGroundIdx(0);
    setGroundDone(GROUNDING_STEPS.map(() => false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="nd-modal" role="dialog" aria-modal="true" aria-label={t("calmKit.title")}>
      <button type="button" className="nd-modal__backdrop" onClick={onClose} aria-label={t("calmKit.close")} />
      <div className="nd-modal__panel">
        <div className="nd-modal__header">
          <div className="nd-modal__title">{t("calmKit.title")}</div>
          <div className="nd-muted">{t("calmKit.boxBreathing.title")} · {t("calmKit.grounding.title")}</div>
        </div>

        <div className="nd-modal__body">
          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("calmKit.boxBreathing.title")}</div>
              <div className="nd-setting__help">4–4–4–4</div>
            </div>

            <div className="flex items-center justify-between gap-12">
              <div className="flex items-center gap-12">
                <div
                  className="nd-calm-circle"
                  aria-hidden="true"
                  style={
                    reduceMotion
                      ? undefined
                      : {
                          transform: `scale(${circleScale})`
                        }
                  }
                />
                <div>
                  <div className="text-lg font-semibold">{t(current.labelKey)}</div>
                  <div className="nd-muted">{secondsLeft}s</div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <button type="button" className="nd-btn nd-btn--ghost" onClick={() => setRunning((v) => !v)}>
                  {running ? t("calmKit.pause") : t("calmKit.start")}
                </button>
                <button
                  type="button"
                  className="nd-btn nd-btn--ghost"
                  onClick={() => {
                    setRunning(false);
                    setPhaseIdx(0);
                    setPhaseLeftMs(PHASES[0].seconds * 1000);
                  }}
                >
                  {t("calmKit.reset")}
                </button>
              </div>
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("calmKit.grounding.title")}</div>
              <div className="nd-setting__help">5–4–3–2–1</div>
            </div>

            <div className="grid gap-10">
              <div className="flex flex-wrap gap-8">
                {GROUNDING_STEPS.map((n, idx) => (
                  <button
                    key={n}
                    type="button"
                    className={["nd-pill", idx === groundIdx ? "nd-pill--on" : ""].join(" ")}
                    onClick={() => setGroundIdx(idx)}
                    aria-pressed={idx === groundIdx}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="grid gap-8">
                <div className="nd-muted">
                  {groundIdx === 0 ? t("calmKit.grounding.step.5") : null}
                  {groundIdx === 1 ? t("calmKit.grounding.step.4") : null}
                  {groundIdx === 2 ? t("calmKit.grounding.step.3") : null}
                  {groundIdx === 3 ? t("calmKit.grounding.step.2") : null}
                  {groundIdx === 4 ? t("calmKit.grounding.step.1") : null}
                </div>

                <button
                  type="button"
                  className="nd-btn nd-btn--primary"
                  onClick={() => {
                    setGroundDone((prev) => prev.map((v, i) => (i === groundIdx ? true : v)));
                    setGroundIdx((i) => Math.min(GROUNDING_STEPS.length - 1, i + 1));
                  }}
                  disabled={groundDone[groundIdx]}
                >
                  {t("calmKit.done")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="nd-modal__footer">
          <button type="button" className="nd-btn nd-btn--primary" onClick={onClose}>
            {t("calmKit.close")}
          </button>
        </div>
      </div>
    </div>
  );
}


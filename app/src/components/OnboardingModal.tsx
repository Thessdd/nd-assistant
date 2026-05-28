import { useMemo, useState } from "react";
import { t } from "../i18n";

export type NeurotypeId = "adhd" | "autism" | "dyslexia" | "anxiety" | "unspecified";
export type ResponseLengthId = "very_short" | "normal" | "detailed";

export type Profile = {
  neurotypes?: NeurotypeId[];
  response_length?: ResponseLengthId;
  name?: string;
};

const NEUROTYPES: { id: NeurotypeId; labelKey: string }[] = [
  { id: "adhd", labelKey: "profile.neurotypes.adhd" },
  { id: "autism", labelKey: "profile.neurotypes.autism" },
  { id: "dyslexia", labelKey: "profile.neurotypes.dyslexia" },
  { id: "anxiety", labelKey: "profile.neurotypes.anxiety" },
  { id: "unspecified", labelKey: "profile.neurotypes.unspecified" }
];

const RESPONSE_LENGTHS: { id: ResponseLengthId; labelKey: string }[] = [
  { id: "very_short", labelKey: "profile.responseLength.very_short" },
  { id: "normal", labelKey: "profile.responseLength.normal" },
  { id: "detailed", labelKey: "profile.responseLength.detailed" }
];

export default function OnboardingModal({
  open,
  initial,
  onSave,
  onSkip
}: {
  open: boolean;
  initial: Profile;
  onSave: (profile: Profile) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [responseLength, setResponseLength] = useState<ResponseLengthId | "">(initial.response_length ?? "");
  const [selected, setSelected] = useState<NeurotypeId[]>(initial.neurotypes ?? []);

  const cleaned = useMemo<Profile>(() => {
    const n = name.trim();
    const neuro = selected.length ? selected : undefined;
    const rl = responseLength ? (responseLength as ResponseLengthId) : undefined;
    return { name: n || undefined, neurotypes: neuro, response_length: rl };
  }, [name, responseLength, selected]);

  if (!open) return null;

  return (
    <div className="nd-modal" role="dialog" aria-modal="true" aria-label={t("onboarding.title")}>
      <button type="button" className="nd-modal__backdrop" onClick={onSkip} aria-label={t("onboarding.skip")} />
      <div className="nd-modal__panel">
        <div className="nd-modal__header">
          <div className="nd-modal__title">{t("onboarding.title")}</div>
          <div className="nd-muted">{t("onboarding.subtitle")}</div>
        </div>

        <div className="nd-modal__body">
          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("profile.name.label")}</div>
              <div className="nd-setting__help">{t("profile.name.help")}</div>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="nd-input"
              placeholder={t("profile.name.placeholder")}
              autoComplete="nickname"
            />
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("profile.responseLength.label")}</div>
              <div className="nd-setting__help">{t("profile.responseLength.help")}</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label={t("profile.responseLength.label")}>
              {RESPONSE_LENGTHS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={["nd-pill", responseLength === x.id ? "nd-pill--on" : ""].join(" ")}
                  onClick={() => setResponseLength(x.id)}
                >
                  {t(x.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("profile.neurotypes.label")}</div>
              <div className="nd-setting__help">{t("profile.neurotypes.help")}</div>
            </div>
            <div className="flex flex-wrap gap-8" role="group" aria-label={t("profile.neurotypes.label")}>
              {NEUROTYPES.map((x) => {
                const on = selected.includes(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    className={["nd-pill", on ? "nd-pill--on" : ""].join(" ")}
                    aria-pressed={on}
                    onClick={() =>
                      setSelected((prev) => (prev.includes(x.id) ? prev.filter((y) => y !== x.id) : [...prev, x.id]))
                    }
                  >
                    {t(x.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="nd-modal__footer flex items-center justify-between gap-8">
          <button type="button" className="nd-btn nd-btn--ghost" onClick={onSkip}>
            {t("onboarding.skip")}
          </button>
          <button type="button" className="nd-btn nd-btn--primary" onClick={() => onSave(cleaned)}>
            {t("onboarding.save")}
          </button>
        </div>
      </div>
    </div>
  );
}


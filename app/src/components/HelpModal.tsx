import { HELP_RESOURCES_IT } from "../data/helpResources";
import { t } from "../i18n";

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="nd-modal" role="dialog" aria-modal="true" aria-label={t("help.title")}>
      <button type="button" className="nd-modal__backdrop" onClick={onClose} aria-label={t("help.close")} />
      <div className="nd-modal__panel">
        <div className="nd-modal__header">
          <div className="nd-modal__title">{t("help.title")}</div>
          <div className="nd-muted">{t("help.subtitle")}</div>
        </div>

        <div className="nd-modal__body">
          <div className="nd-muted">{t("help.intro")}</div>

          <div className="grid gap-10">
            {HELP_RESOURCES_IT.map((r) => (
              <div key={`${r.title}-${r.phone}`} className="nd-card p-4">
                <div className="font-semibold">{r.title}</div>
                <div className="nd-muted mt-1">{r.phone}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="nd-modal__footer">
          <button type="button" className="nd-btn nd-btn--primary" onClick={onClose}>
            {t("help.close")}
          </button>
        </div>
      </div>
    </div>
  );
}


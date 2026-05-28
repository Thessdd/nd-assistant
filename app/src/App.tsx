import { useEffect, useMemo, useState } from "react";
import ChatInterface from "./components/ChatInterface";
import TaskList from "./components/TaskList";
import CalmKit from "./components/CalmKit";
import HelpModal from "./components/HelpModal";
import OnboardingModal, { type Profile } from "./components/OnboardingModal";
import { useChat } from "./hooks/useChat";
import { useTasks } from "./hooks/useTasks";
import { t } from "./i18n";

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 backdrop-blur px-4 py-3 shadow-xl text-sm text-slate-100">
        {text}
      </div>
    </div>
  );
}

type ThemeMode = "dark" | "light" | "contrast";
type FontSize = "small" | "normal" | "large";
type Density = "comfortable" | "compact";
type FontFamily = "system" | "accessible";

type NdSettings = {
  theme: ThemeMode;
  reduceMotion: boolean;
  fontSize: FontSize;
  density: Density;
  fontFamily: FontFamily;
  timestamps: boolean;
  sound: boolean;
};

const LS_SETTINGS = "nd_settings";
const LS_PROFILE = "nd_profile";
const LS_ONBOARDING_DISMISSED = "nd_profile_onboarding_dismissed";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function SettingsModal({
  open,
  value,
  onChange,
  onClose,
  onEditProfile,
  onClearProfile
}: {
  open: boolean;
  value: NdSettings;
  onChange: (next: NdSettings) => void;
  onClose: () => void;
  onEditProfile: () => void;
  onClearProfile: () => void;
}) {
  if (!open) return null;

  return (
    <div className="nd-modal" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
      <button type="button" className="nd-modal__backdrop" onClick={onClose} aria-label={t("settings.close")} />
      <div className="nd-modal__panel">
        <div className="nd-modal__header">
          <div className="nd-modal__title">{t("settings.title")}</div>
          <div className="nd-muted">{t("settings.subtitle")}</div>
        </div>

        <div className="nd-modal__body">
          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.theme.label")}</div>
              <div className="nd-setting__help">{t("settings.theme.help")}</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label={t("settings.theme.label")}>
              <button
                type="button"
                className={["nd-pill", value.theme === "dark" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, theme: "dark" })}
              >
                {t("settings.theme.dark")}
              </button>
              <button
                type="button"
                className={["nd-pill", value.theme === "light" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, theme: "light" })}
              >
                {t("settings.theme.light")}
              </button>
              <button
                type="button"
                className={["nd-pill", value.theme === "contrast" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, theme: "contrast" })}
              >
                {t("settings.theme.contrast")}
              </button>
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.reduceMotion.label")}</div>
              <div className="nd-setting__help">{t("settings.reduceMotion.help")}</div>
            </div>
            <button
              type="button"
              className={["nd-toggle", value.reduceMotion ? "nd-toggle--on" : "nd-toggle--off"].join(" ")}
              aria-pressed={value.reduceMotion}
              onClick={() => onChange({ ...value, reduceMotion: !value.reduceMotion })}
            >
              <span className="nd-toggle__knob" aria-hidden="true" />
              <span className="nd-toggle__label">{value.reduceMotion ? t("settings.on") : t("settings.off")}</span>
            </button>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.fontSize.label")}</div>
              <div className="nd-setting__help">{t("settings.fontSize.help")}</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label={t("settings.fontSize.label")}>
              <button
                type="button"
                className={["nd-pill", value.fontSize === "small" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontSize: "small" })}
              >
                {t("settings.fontSize.small")}
              </button>
              <button
                type="button"
                className={["nd-pill", value.fontSize === "normal" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontSize: "normal" })}
              >
                {t("settings.fontSize.normal")}
              </button>
              <button
                type="button"
                className={["nd-pill", value.fontSize === "large" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontSize: "large" })}
              >
                {t("settings.fontSize.large")}
              </button>
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.fontFamily.label")}</div>
              <div className="nd-setting__help">{t("settings.fontFamily.help")}</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label={t("settings.fontFamily.label")}>
              <button
                type="button"
                className={["nd-pill", value.fontFamily === "system" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontFamily: "system" })}
              >
                {t("settings.fontFamily.system")}
              </button>
              <button
                type="button"
                className={["nd-pill", value.fontFamily === "accessible" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontFamily: "accessible" })}
              >
                {t("settings.fontFamily.accessible")}
              </button>
              <div className="nd-pill nd-pill--spacer" aria-hidden="true" />
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.density.label")}</div>
              <div className="nd-setting__help">{t("settings.density.help")}</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label={t("settings.density.label")}>
              <button
                type="button"
                className={["nd-pill", value.density === "comfortable" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, density: "comfortable" })}
              >
                {t("settings.density.comfortable")}
              </button>
              <button
                type="button"
                className={["nd-pill", value.density === "compact" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, density: "compact" })}
              >
                {t("settings.density.compact")}
              </button>
              <div className="nd-pill nd-pill--spacer" aria-hidden="true" />
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.timestamps.label")}</div>
              <div className="nd-setting__help">{t("settings.timestamps.help")}</div>
            </div>
            <button
              type="button"
              className={["nd-toggle", value.timestamps ? "nd-toggle--on" : "nd-toggle--off"].join(" ")}
              aria-pressed={value.timestamps}
              onClick={() => onChange({ ...value, timestamps: !value.timestamps })}
            >
              <span className="nd-toggle__knob" aria-hidden="true" />
              <span className="nd-toggle__label">{value.timestamps ? t("settings.on") : t("settings.off")}</span>
            </button>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.sound.label")}</div>
              <div className="nd-setting__help">{t("settings.sound.help")}</div>
            </div>
            <button
              type="button"
              className={["nd-toggle", value.sound ? "nd-toggle--on" : "nd-toggle--off"].join(" ")}
              aria-pressed={value.sound}
              onClick={() => onChange({ ...value, sound: !value.sound })}
            >
              <span className="nd-toggle__knob" aria-hidden="true" />
              <span className="nd-toggle__label">{value.sound ? t("settings.on") : t("settings.off")}</span>
            </button>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">{t("settings.profile.label")}</div>
              <div className="nd-setting__help">{t("settings.profile.help")}</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label={t("settings.profile.label")}>
              <button type="button" className="nd-pill" onClick={onEditProfile}>
                {t("settings.profile.edit")}
              </button>
              <button type="button" className="nd-pill" onClick={onClearProfile}>
                {t("settings.profile.clear")}
              </button>
              <div className="nd-pill nd-pill--spacer" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="nd-modal__footer">
          <button type="button" className="nd-btn nd-btn--primary" onClick={onClose}>
            {t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { messages, sendMessage, isStreaming, stop, error, clearAll: clearChat, lastExtractedTask, canAddTask, suggestions, setSuggestions } =
    useChat();
  const { tasks, addTask, removeTask, toggleDone, clearAll: clearTasks, openCount } = useTasks();

  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calmOpen, setCalmOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboardingInitial, setOnboardingInitial] = useState<Profile>({});
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    const hasProfile = !!localStorage.getItem(LS_PROFILE);
    const dismissed = localStorage.getItem(LS_ONBOARDING_DISMISSED) === "1";
    return !hasProfile && !dismissed;
  });
  const [view, setView] = useState<"chat" | "tasks">("chat");
  const [dismissedTaskKey, setDismissedTaskKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<NdSettings>(() => {
    const stored = safeJsonParse<Partial<NdSettings>>(localStorage.getItem(LS_SETTINGS));
    return {
      theme: stored?.theme === "light" || stored?.theme === "contrast" ? stored.theme : "dark",
      reduceMotion: typeof stored?.reduceMotion === "boolean" ? stored.reduceMotion : false,
      fontSize: stored?.fontSize === "small" || stored?.fontSize === "large" ? stored.fontSize : "normal",
      density: stored?.density === "compact" ? "compact" : "comfortable",
      fontFamily: stored?.fontFamily === "accessible" ? "accessible" : "system",
      timestamps: typeof stored?.timestamps === "boolean" ? stored.timestamps : true,
      sound: typeof stored?.sound === "boolean" ? stored.sound : false
    };
  });

  const extractedAsTask = useMemo(() => {
    if (!lastExtractedTask?.has_task) return null;
    return {
      title: lastExtractedTask.title,
      due_date: lastExtractedTask.due_date ?? null,
      description: lastExtractedTask.description ?? null
    };
  }, [lastExtractedTask]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.motion = settings.reduceMotion ? "reduced" : "full";
    document.documentElement.dataset.font = settings.fontSize;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.fontFamily = settings.fontFamily;
    document.documentElement.dataset.timestamps = settings.timestamps ? "on" : "off";
  }, [settings]);

  function clearAllData() {
    if (!confirm(t("confirm.clearAllData"))) return;
    clearChat();
    clearTasks();
    localStorage.removeItem("caldav_credentials");
    showToast(t("toast.allDataCleared"));
  }

  function addTaskFromExtraction() {
    if (!extractedAsTask) return;
    addTask({ title: extractedAsTask.title, due_date: extractedAsTask.due_date, description: extractedAsTask.description });
    showToast(t("toast.taskAdded"));
    setDismissedTaskKey(`${extractedAsTask.title}|${extractedAsTask.due_date ?? ""}`);
  }

  const canShowInlineTask =
    canAddTask &&
    !!extractedAsTask &&
    dismissedTaskKey !== `${extractedAsTask.title}|${extractedAsTask.due_date ?? ""}`;

  return (
    <div className="nd-app">
      {toast ? <Toast text={toast} /> : null}

      <div className="nd-shell">
        <header className="nd-header">
          <div className="nd-header__top">
            <div>
              <div className="nd-title">ND Assistant</div>
              <div className="nd-breadcrumbs">
                {t("nav.home")} / {view === "chat" ? t("nav.chat") : t("nav.tasks")}
              </div>
            </div>
            <div className="nd-header__meta">
              <div className="nd-muted">
                {t("header.openTasks")}: <span className="nd-strong">{openCount}</span>
              </div>
            </div>
          </div>

          <div className="nd-segment" role="tablist" aria-label="Primary view">
            <button
              type="button"
              className={["nd-segment__btn", view === "chat" ? "nd-segment__btn--on" : ""].join(" ")}
              onClick={() => setView("chat")}
              role="tab"
              aria-selected={view === "chat"}
            >
              {t("tabs.chat")}
            </button>
            <button
              type="button"
              className={["nd-segment__btn", view === "tasks" ? "nd-segment__btn--on" : ""].join(" ")}
              onClick={() => setView("tasks")}
              role="tab"
              aria-selected={view === "tasks"}
            >
              {t("tabs.tasks")}
            </button>
          </div>
        </header>

        <main className="nd-main">
          {view === "chat" ? (
            <ChatInterface
              messages={messages}
              isStreaming={isStreaming}
              error={error}
              onSend={(t) => void sendMessage(t)}
              onStop={stop}
              extractedTask={lastExtractedTask}
              canAddTask={!!canShowInlineTask}
              onAddToCalendar={addTaskFromExtraction}
              suggestions={suggestions}
              onClearSuggestions={() => setSuggestions([])}
              onSkipTask={() => {
                if (!extractedAsTask) return;
                setDismissedTaskKey(`${extractedAsTask.title}|${extractedAsTask.due_date ?? ""}`);
                showToast(t("toast.skipped"));
              }}
            />
          ) : (
            <TaskList
              tasks={tasks}
              onToggleDone={toggleDone}
              onDelete={removeTask}
              onClearAll={() => {
                if (!confirm(t("confirm.clearTasks"))) return;
                clearTasks();
                showToast(t("toast.tasksCleared"));
              }}
            />
          )}
        </main>

        <footer className="nd-footer">
          <button type="button" className="nd-btn nd-btn--ghost" onClick={() => setCalmOpen(true)}>
            {t("footer.calm")}
          </button>
          <button type="button" className="nd-btn nd-btn--ghost" onClick={() => setSettingsOpen(true)}>
            {t("footer.settings")}
          </button>
          <button type="button" className="nd-btn nd-btn--ghost" onClick={clearAllData}>
            {t("footer.clearData")}
          </button>
          <button
            type="button"
            className="nd-btn nd-btn--ghost"
            onClick={() => setHelpOpen(true)}
          >
            {t("footer.help")}
          </button>
        </footer>
      </div>

      <SettingsModal
        open={settingsOpen}
        value={settings}
        onChange={(next) => setSettings(next)}
        onClose={() => setSettingsOpen(false)}
        onEditProfile={() => {
          const stored = safeJsonParse<Profile>(localStorage.getItem(LS_PROFILE)) ?? {};
          setOnboardingInitial(stored);
          setOnboardingOpen(true);
        }}
        onClearProfile={() => {
          localStorage.removeItem(LS_PROFILE);
          localStorage.setItem(LS_ONBOARDING_DISMISSED, "1");
          showToast(t("toast.profileCleared"));
        }}
      />

      <CalmKit open={calmOpen} onClose={() => setCalmOpen(false)} reduceMotion={settings.reduceMotion} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <OnboardingModal
        open={onboardingOpen}
        initial={onboardingInitial}
        onSkip={() => {
          localStorage.setItem(LS_ONBOARDING_DISMISSED, "1");
          setOnboardingOpen(false);
        }}
        onSave={(profile) => {
          localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
          setOnboardingOpen(false);
        }}
      />
    </div>
  );
}


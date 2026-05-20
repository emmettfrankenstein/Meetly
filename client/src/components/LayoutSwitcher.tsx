import type { MeetingLayoutMode, MeetingLayoutPreset } from "../types/layout";

type LayoutSwitcherProps = {
  mode: MeetingLayoutMode;
  preset: MeetingLayoutPreset;
  onModeChange: (mode: MeetingLayoutMode) => void;
  onPresetChange: (preset: MeetingLayoutPreset) => void;
  onResetLayout?: () => void;
};

const layoutModes: {
  value: MeetingLayoutMode;
  label: string;
  description: string;
}[] = [
  {
    value: "speaker",
    label: "Speaker + Self",
    description: "Active speaker on stage with floating self-view.",
  },
  {
    value: "grid",
    label: "Grid",
    description: "Participants side by side.",
  },
  {
    value: "fullscreen",
    label: "Full screen",
    description: "Immersive speaker view with minimal controls.",
  },
  {
    value: "focus",
    label: "Focus",
    description: "Hide panels and distractions.",
  },
];

const presets: {
  value: MeetingLayoutPreset;
  label: string;
}[] = [
  { value: "compact", label: "Compact" },
  { value: "balanced", label: "Balanced" },
  { value: "presentation", label: "Presentation" },
];

export function LayoutSwitcher({
  mode,
  preset,
  onModeChange,
  onPresetChange,
  onResetLayout,
}: LayoutSwitcherProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-200 shadow-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Layout
        </p>
        <h2 className="mt-1 text-base font-bold text-white">Meeting view</h2>
      </div>

      <div className="mt-4 space-y-2">
        {layoutModes.map((layoutMode) => {
          const isSelected = layoutMode.value === mode;

          return (
            <button
              key={layoutMode.value}
              type="button"
              onClick={() => onModeChange(layoutMode.value)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                isSelected
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-100"
                  : "border-slate-800 bg-slate-950/70 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <p className="font-semibold">{layoutMode.label}</p>
              <p className="mt-1 text-xs text-slate-400">
                {layoutMode.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Preset
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {presets.map((item) => {
            const isSelected = item.value === preset;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onPresetChange(item.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
                    : "border-slate-800 bg-slate-950/70 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {onResetLayout && (
          <button
            type="button"
            onClick={onResetLayout}
            className="mt-4 w-full rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Reset layout
          </button>
        )}
      </div>
    </section>
  );
}

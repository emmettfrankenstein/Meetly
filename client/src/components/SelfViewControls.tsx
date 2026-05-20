import type { SelfViewSettings } from "../types/layout";

type SelfViewControlsProps = {
  selfView: SelfViewSettings;
  backgroundStatus?: "off" | "loading" | "active" | "unsupported" | "error";
  backgroundError?: string | null;
  onUpdate: (settings: Partial<SelfViewSettings>) => void;
  onReset: () => void;
};

export function SelfViewControls({
  selfView,
  backgroundStatus = "off",
  backgroundError,
  onUpdate,
  onReset,
}: SelfViewControlsProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200 shadow-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Self view
        </p>
        <h3 className="mt-1 text-sm font-bold text-white">Floating camera</h3>
        <p className="mt-1 text-xs text-slate-400">
          Customize your floating camera window.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Opacity</span>
            <span>{Math.round(selfView.opacity * 100)}%</span>
          </div>

          <input
            type="range"
            min={0.25}
            max={1}
            step={0.05}
            value={selfView.opacity}
            onChange={(event) =>
              onUpdate({
                opacity: Number(event.target.value),
              })
            }
            className="w-full accent-cyan-400"
          />
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-300">
            Background
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ backgroundEffect: "none" })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                selfView.backgroundEffect === "none"
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-100"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              None
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ backgroundEffect: "blur" })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                selfView.backgroundEffect === "blur"
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-100"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Blur
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ backgroundEffect: "remove" })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                selfView.backgroundEffect === "remove"
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-100"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Remove
            </button>
          </div>

          {selfView.backgroundEffect !== "none" && (
            <p className="mt-2 text-xs text-slate-500">
              Status: {backgroundStatus}
              {backgroundError ? ` · ${backgroundError}` : ""}
            </p>
          )}
        </div>

        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
          <span className="text-xs font-semibold text-slate-300">
            Hide self view
          </span>

          <input
            type="checkbox"
            checked={selfView.isHidden}
            onChange={(event) =>
              onUpdate({
                isHidden: event.target.checked,
              })
            }
            className="h-4 w-4 accent-cyan-400"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
          <span className="text-xs font-semibold text-slate-300">
            Lock position
          </span>

          <input
            type="checkbox"
            checked={selfView.isLocked}
            onChange={(event) =>
              onUpdate({
                isLocked: event.target.checked,
              })
            }
            className="h-4 w-4 accent-cyan-400"
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdate({
                width: 280,
                height: 170,
              })
            }
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Small
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdate({
                width: 360,
                height: 220,
              })
            }
            className="rounded-xl border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
          >
            Medium
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdate({
                width: 480,
                height: 290,
              })
            }
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Large
          </button>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Reset self view
        </button>
      </div>
    </section>
  );
}

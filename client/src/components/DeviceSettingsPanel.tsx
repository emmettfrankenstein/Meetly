type DeviceSettingsPanelProps = {
  devices: MediaDeviceInfo[];
  selectedCameraId: string;
  selectedMicId: string;
  error?: string | null;
  onSelectCamera: (deviceId: string) => void | Promise<void>;
  onSelectMicrophone: (deviceId: string) => void | Promise<void>;
  onRefreshDevices: () => void | Promise<void>;
};

export function DeviceSettingsPanel({
  devices,
  selectedCameraId,
  selectedMicId,
  error,
  onSelectCamera,
  onSelectMicrophone,
  onRefreshDevices,
}: DeviceSettingsPanelProps) {
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const microphones = devices.filter((device) => device.kind === "audioinput");

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/95 p-4 text-sm text-slate-200 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Devices
          </p>
          <h2 className="mt-1 text-base font-bold text-white">
            Camera & microphone
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void onRefreshDevices()}
          className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <p className="mb-2 text-xs font-semibold text-slate-400">
            Microphone
          </p>

          <select
            value={selectedMicId}
            onChange={(event) => void onSelectMicrophone(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
          >
            {microphones.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <p className="mb-2 text-xs font-semibold text-slate-400">Camera</p>

          <select
            value={selectedCameraId}
            onChange={(event) => void onSelectCamera(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
          >
            {cameras.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

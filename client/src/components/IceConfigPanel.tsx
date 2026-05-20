import { getIceServers } from "../services/iceServers";

export function IceConfigPanel() {
  const iceServers = getIceServers();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
      <p className="font-semibold text-white">ICE Servers</p>

      <div className="mt-2 space-y-2 text-xs text-slate-400">
        {iceServers.map((server, index) => (
          <div key={index} className="rounded-xl bg-slate-950 p-2">
            <p>
              URLs:{" "}
              {Array.isArray(server.urls)
                ? server.urls.join(", ")
                : server.urls}
            </p>

            {"username" in server && server.username ? (
              <p>TURN auth: configured</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

import type { InputDevice } from "../../../packages/web/src/audio/useInputDevices.js";

export function InputControls({
  devices,
  deviceId,
  onSelect,
  level,
}: {
  devices: InputDevice[];
  deviceId: string | null;
  onSelect: (id: string | null) => void;
  level: number;
}) {
  const percent = Math.round(level * 100);
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="mr-2">Eingang</span>
        <select
          value={deviceId ?? ""}
          onChange={(event) => onSelect(event.target.value === "" ? null : event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Standardgerät</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))}
        </select>
      </label>
      <div
        role="meter"
        aria-label="Eingangspegel"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full rounded bg-slate-200 dark:bg-slate-800"
      >
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

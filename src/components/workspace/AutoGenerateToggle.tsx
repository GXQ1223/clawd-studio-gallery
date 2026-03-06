import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  enabled: boolean;
  interval: string | null;
  onToggle: (enabled: boolean, interval: string | null) => void;
}

const intervals = [
  { value: "hourly", label: "Hourly" },
  { value: "6h", label: "Every 6h" },
  { value: "daily", label: "Daily" },
];

const AutoGenerateToggle = ({ enabled, interval, onToggle }: Props) => {
  const [localInterval, setLocalInterval] = useState(interval || "daily");

  const handleToggle = (checked: boolean) => {
    onToggle(checked, checked ? localInterval : null);
  };

  const handleIntervalChange = (val: string) => {
    setLocalInterval(val);
    if (enabled) {
      onToggle(true, val);
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        className="scale-75 origin-left"
      />
      <span className="font-mono text-[10px] text-muted-foreground select-none">
        Auto-generate ⟳
      </span>

      {enabled && (
        <Select value={localInterval} onValueChange={handleIntervalChange}>
          <SelectTrigger className="h-[22px] w-[90px] text-[10px] font-mono border-border/50 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intervals.map((i) => (
              <SelectItem key={i.value} value={i.value} className="text-[11px] font-mono">
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default AutoGenerateToggle;

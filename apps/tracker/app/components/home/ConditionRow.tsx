import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Plus } from "lucide-react";
import type { Condition } from "./types";

type ConditionRowProps = {
  condition: Condition;
  onChange: (index: number, updated: Condition) => void;
  onRemove: (index: number) => void;
  index: number;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ConditionRow({ condition, onChange, onRemove, index }: ConditionRowProps) {
  const handleTypeChange = (type: Condition["type"]) => {
    const defaults: Record<Condition["type"], Condition> = {
      elapsed_hours: { type: "elapsed_hours", operator: "gte", value: 1 },
      time_of_day: { type: "time_of_day", operator: "gte", value: "09:00" },
      day_of_week: { type: "day_of_week", operator: "in", value: [1, 2, 3, 4, 5] },
    };
    onChange(index, { ...defaults[type] });
  };

  const handleOperatorChange = (operator: Condition["operator"]) => {
    const newCondition = { ...condition, operator };
    if (operator === "between" && condition.type === "time_of_day" && typeof condition.value === "string") {
      newCondition.value = [condition.value, "18:00"];
    }
    if (operator !== "between" && condition.type === "time_of_day" && Array.isArray(condition.value)) {
      newCondition.value = condition.value[0];
    }
    onChange(index, newCondition);
  };

  const handleValueChange = (val: Condition["value"]) => {
    onChange(index, { ...condition, value: val });
  };

  const renderValueInput = () => {
    const { type, operator } = condition;

    if (type === "elapsed_hours") {
      return (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min="0.25"
            step="0.25"
            value={condition.value as number}
            onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-sm"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>
      );
    }

    if (type === "time_of_day") {
      if (operator === "between") {
        const values = (condition.value as [string, string]) || ["09:00", "17:00"];
        return (
          <div className="flex items-center gap-1.5">
            <Input
              type="time"
              value={values[0]}
              onChange={(e) => handleValueChange([e.target.value, values[1]])}
              className="w-28 h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="time"
              value={values[1]}
              onChange={(e) => handleValueChange([values[0], e.target.value])}
              className="w-28 h-8 text-sm"
            />
          </div>
        );
      }
      return (
        <Input
          type="time"
          value={condition.value as string}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-28 h-8 text-sm"
        />
      );
    }

    if (type === "day_of_week") {
      const selected = (condition.value as number[]) || [];
      return (
        <div className="flex items-center gap-0.5">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const newVal = selected.includes(i)
                  ? selected.filter((d) => d !== i)
                  : [...selected, i].sort();
                handleValueChange(newVal);
              }}
              className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                selected.includes(i)
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-transparent border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  const getOperatorOptions = (): { value: Condition["operator"]; label: string }[] => {
    if (condition.type === "elapsed_hours") return [{ value: "gte", label: "≥" }];
    if (condition.type === "time_of_day")
      return [
        { value: "gte", label: "≥ after" },
        { value: "lte", label: "≤ before" },
        { value: "between", label: "between" },
      ];
    if (condition.type === "day_of_week") return [{ value: "in", label: "is" }];
    return [];
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-900/50 border">
      <select
        value={condition.type}
        onChange={(e) => handleTypeChange(e.target.value as Condition["type"])}
        className="h-8 text-xs bg-transparent border rounded px-1.5 text-zinc-700 dark:text-zinc-300"
      >
        <option value="elapsed_hours">Elapsed time</option>
        <option value="time_of_day">Time of day</option>
        <option value="day_of_week">Day of week</option>
      </select>

      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as Condition["operator"])}
        className="h-8 text-xs bg-transparent border rounded px-1.5 text-zinc-700 dark:text-zinc-300"
      >
        {getOperatorOptions().map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {renderValueInput()}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 ml-auto shrink-0"
        onClick={() => onRemove(index)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

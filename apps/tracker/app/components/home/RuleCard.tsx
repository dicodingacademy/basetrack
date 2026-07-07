import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardFooter } from "../ui/card";
import { ConditionRow } from "./ConditionRow";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { Condition, AutoStopRuleData } from "./types";

type RuleCardProps = {
  rule: AutoStopRuleData;
};

const newDefaultCondition = (): Condition => ({
  type: "elapsed_hours",
  operator: "gte",
  value: 1,
});

export function RuleCard({ rule }: RuleCardProps) {
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("ruleId") === rule.id;

  const [name, setName] = useState(rule.name || "");
  const [enabled, setEnabled] = useState(rule.enabled);
  const [conditions, setConditions] = useState<Condition[]>(rule.conditions);

  useEffect(() => {
    setName(rule.name || "");
    setEnabled(rule.enabled);
    setConditions(rule.conditions);
  }, [rule]);

  const submitRule = (overrides?: Partial<{ name: string; enabled: boolean; conditions: Condition[] }>) => {
    const data = {
      name: overrides?.name ?? name,
      enabled: overrides?.enabled ?? enabled,
      conditions: overrides?.conditions ?? conditions,
    };
    fetcher.submit(
      {
        intent: "SAVE_RULE",
        ruleId: rule.id,
        name: data.name,
        enabled: String(data.enabled),
        conditions: JSON.stringify(data.conditions),
      },
      { method: "post" }
    );
  };

  const handleDelete = () => {
    fetcher.submit(
      {
        intent: "DELETE_RULE",
        ruleId: rule.id,
      },
      { method: "post" }
    );
  };

  const addCondition = () => {
    const updated = [...conditions, newDefaultCondition()];
    setConditions(updated);
    submitRule({ conditions: updated });
  };

  const updateCondition = (index: number, updated: Condition) => {
    const newConditions = conditions.map((c, i) => (i === index ? updated : c));
    setConditions(newConditions);
    submitRule({ conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
    submitRule({ conditions: newConditions });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEnabled(!enabled);
              submitRule({ enabled: !enabled });
            }}
            className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
              enabled ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => submitRule()}
            placeholder="Rule name (optional)"
            className="h-8 text-sm flex-1 border-none bg-transparent px-0 focus-visible:ring-0"
          />
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-zinc-400 hover:text-red-500"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-2">
        {conditions.map((condition, i) => (
          <ConditionRow
            key={i}
            index={i}
            condition={condition}
            onChange={updateCondition}
            onRemove={removeCondition}
          />
        ))}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={addCondition}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Condition
        </Button>
      </CardFooter>
    </Card>
  );
}

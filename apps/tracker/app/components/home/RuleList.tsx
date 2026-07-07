import { useFetcher } from "react-router";
import { Button } from "../ui/button";
import { RuleCard } from "./RuleCard";
import { Plus } from "lucide-react";
import type { AutoStopRuleData } from "./types";

type RuleListProps = {
  rules: AutoStopRuleData[];
};

export function RuleList({ rules }: RuleListProps) {
  const fetcher = useFetcher();

  const handleAddRule = () => {
    fetcher.submit(
      {
        intent: "SAVE_RULE",
        ruleId: "",
        name: "",
        enabled: "true",
        conditions: JSON.stringify([
          { type: "elapsed_hours", operator: "gte", value: 8 },
        ]),
      },
      { method: "post" }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Auto-Stop Rules</h4>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddRule}>
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A timer will auto-stop when <strong>any</strong> rule matches (all conditions within a rule must be met).
      </p>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No rules defined. Add a rule to enable auto-stop.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}

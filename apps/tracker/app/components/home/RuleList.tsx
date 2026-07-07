import { Button } from "../ui/button";
import { RuleCard } from "./RuleCard";
import { Plus } from "lucide-react";
import type { AutoStopRuleData, Condition } from "./types";

let tempIdCounter = 0;
function generateTempId() {
  return `_new_${++tempIdCounter}_${Date.now()}`;
}

const defaultRule = (): AutoStopRuleData => ({
  id: "",
  enabled: true,
  name: "",
  conditions: [{ type: "elapsed_hours" as const, operator: "gte" as const, value: 8 } as Condition],
});

type RuleListProps = {
  rules: AutoStopRuleData[];
  onChange: (rules: AutoStopRuleData[]) => void;
};

export function RuleList({ rules, onChange }: RuleListProps) {
  const handleAddRule = () => {
    onChange([...rules, { ...defaultRule(), id: generateTempId() }]);
  };

  const handleUpdateRule = (index: number, updated: AutoStopRuleData) => {
    const newRules = rules.map((r, i) => (i === index ? updated : r));
    onChange(newRules);
  };

  const handleDeleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
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
          {rules.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onChange={(updated) => handleUpdateRule(i, updated)}
              onDelete={() => handleDeleteRule(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

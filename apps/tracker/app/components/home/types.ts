export type ConditionType = "elapsed_hours" | "time_of_day" | "day_of_week";

export interface Condition {
  type: ConditionType;
  operator: "gte" | "lte" | "between" | "in";
  value: number | string | [string, string] | number[];
}

export interface AutoStopRuleData {
  id: string;
  enabled: boolean;
  name?: string | null;
  conditions: Condition[];
}

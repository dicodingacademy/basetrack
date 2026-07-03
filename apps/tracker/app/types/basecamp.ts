export type BasecampBucket = {
  id: number;
  name: string;
};

export type BasecampAssignment = {
  id: number;
  title?: string;
  content?: string;
  type: string;
  bucket?: BasecampBucket;
};

export type BasecampProject = {
  id: number;
  timesheet_enabled: boolean;
};

export type GroupedTask = {
  id: string;
  title: string;
  type: string;
};

export type GroupedAssignment = {
  projectId: string;
  projectName: string;
  tasks: GroupedTask[];
};

export type ActiveTimerType = {
  id: string;
  userId: string;
  todoId: string;
  todoTitle: string;
  projectId: string;
  projectName: string;
  startedAt: Date;
  lastPingAt: Date;
};

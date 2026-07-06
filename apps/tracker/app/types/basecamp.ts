export type BasecampBucket = {
  id: number;
  name: string;
};

export type BasecampAssignee = {
  id: number;
  name: string;
  avatar_url: string;
};

export type BasecampParent = {
  id: number;
  title: string;
  type: string;
};

export type BasecampAssignment = {
  id: number;
  title?: string;
  content?: string;
  type: string;
  bucket?: BasecampBucket;
  due_on?: string | null;
  assignees?: BasecampAssignee[];
  completed?: boolean;
  status?: string;
  parent?: BasecampParent;
};

export type BasecampProject = {
  id: number;
  name?: string;
  timesheet_enabled: boolean;
};

export type GroupedTask = {
  id: string;
  title: string;
  type: string;
  dueOn?: string | null;
  assignees?: { id: number; name: string; avatarUrl: string }[];
  parent?: { id: number; title: string; type: string };
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
  source: string;
};

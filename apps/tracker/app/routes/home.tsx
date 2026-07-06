import { useState, Suspense } from "react";
import { useNavigation, Form, Await } from "react-router";

import type { Route } from "./+types/home";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { fetchAssignments, fetchProjectDetails, getValidAccessToken } from "../utils/basecamp.server";
import { getValidGoogleToken, fetchCalendarEvents, fetchTaskLists, fetchTasks } from "../utils/google.server";
import { startTimer, stopTimer, getActiveTimer, getPendingApprovals, approveTimeEntry } from "../services/timer.server";
import { updateUserSettings, generateNewApiKey } from "../services/user.server";
import { disconnectGoogle } from "../utils/google.server";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { useTimerWebSocket } from "../hooks/useTimerWebSocket";
import { useTimerTitle } from "../hooks/useTimerTitle";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { TaskCard } from "../components/home/TaskCard";
import { GoogleItemCard } from "../components/home/GoogleItemCard";
import { ActiveTimerCard } from "../components/home/ActiveTimerCard";
import { PendingApprovals } from "../components/home/PendingApprovals";
import { SettingsModal } from "../components/home/SettingsModal";
import { Clock, Briefcase, LayoutDashboard, CheckCircle2, ArrowRight, LogOut, ListTodo, Calendar } from "lucide-react";
import type { BasecampAssignment, BasecampProject, GroupedAssignment, GroupedTask } from "../types/basecamp";
import type { GoogleCalendarEvent, GoogleTask, TimerSource } from "../types/google";

type AppData = {
  groupedAssignments: GroupedAssignment[];
  pendingApprovals: any[];
  timesheetProjects: { id: string; name: string }[];
  calendarEvents: GoogleCalendarEvent[];
  googleTasks: GoogleTask[];
};

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Basetrack - Basecamp Time Tracker" },
    { name: "description", content: "Track time on your Basecamp todos easily." },
  ];
}

async function loadData(user: any): Promise<AppData> {
  let groupedAssignments: GroupedAssignment[] = [];
  let rawProjects: any[] = [];

  try {
    const accessToken = await getValidAccessToken(user.id);
    const rawAssignments = await fetchAssignments(user.basecampId, accessToken);

    let items = [];
    if (Array.isArray(rawAssignments)) {
      items = rawAssignments;
    } else {
      items = [...(rawAssignments.priorities || []), ...(rawAssignments.non_priorities || [])];
    }

    const uniqueBucketIds = Array.from(new Set(items.map((i: BasecampAssignment) => i.bucket?.id?.toString()).filter(Boolean))) as string[];
    rawProjects = await fetchProjectDetails(user.basecampId, uniqueBucketIds, accessToken);

    const timesheetEnabledProjectIds = new Set(
      rawProjects
        .filter((p: BasecampProject) => p.timesheet_enabled)
        .map((p: BasecampProject) => p.id)
    );

    const grouped = items.reduce((acc: Record<string, GroupedAssignment>, curr: BasecampAssignment) => {
      if (!curr.bucket) return acc;
      const bucketId = curr.bucket.id;
      if (!timesheetEnabledProjectIds.has(bucketId)) return acc;

      if (curr.completed === true || curr.status === 'archived' || curr.status === 'trashed') return acc;

      if (!acc[bucketId]) {
        acc[bucketId] = {
          projectId: curr.bucket.id.toString(),
          projectName: curr.bucket.name,
          tasks: [],
        };
      }
      acc[bucketId].tasks.push({
        id: curr.id.toString(),
        title: curr.title || curr.content || "Untitled Task",
        type: curr.type,
        dueOn: curr.due_on || null,
        assignees: curr.assignees?.map(a => ({
          id: a.id,
          name: a.name,
          avatarUrl: a.avatar_url,
        })) || [],
        parent: curr.parent ? {
          id: curr.parent.id,
          title: curr.parent.title,
          type: curr.parent.type,
        } : undefined,
      });
      return acc;
    }, {});

    groupedAssignments = Object.values(grouped);
  } catch (err) {
    console.error("Fetch assignments failed", err);
  }

  const pendingApprovals = await getPendingApprovals(user.id);

  const timesheetProjects: { id: string; name: string }[] = [];
  rawProjects
    .filter((p: BasecampProject & { name?: string }) => p.timesheet_enabled)
    .forEach((p: BasecampProject & { name?: string }) => {
      if (p.name) timesheetProjects.push({ id: p.id.toString(), name: p.name });
    });

  let calendarEvents: GoogleCalendarEvent[] = [];
  let googleTasks: GoogleTask[] = [];

  if (user.googleAccessToken) {
    try {
      const googleToken = await getValidGoogleToken(user.id);
      const events = await fetchCalendarEvents(googleToken, new Date());
      calendarEvents = (events || []).map((e: any) => ({
        id: e.id,
        summary: e.summary || "Untitled Event",
        description: e.description,
        htmlLink: e.htmlLink,
        start: e.start,
        end: e.end,
      }));
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    }

    try {
      const googleToken = await getValidGoogleToken(user.id);
      const taskLists = await fetchTaskLists(googleToken);
      const allTasks: GoogleTask[] = [];
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      for (const list of taskLists) {
        try {
          const tasks = await fetchTasks(googleToken, list.id);
          for (const t of tasks) {
            const mappedTask = {
              id: t.id,
              title: t.title || "Untitled Task",
              notes: t.notes,
              due: t.due,
              taskListId: list.id,
              taskListName: list.title,
            };
            if (t.due) {
              const dueDate = new Date(t.due);
              if (dueDate <= endOfToday) {
                allTasks.push(mappedTask);
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch tasks for list ${list.title}:`, err);
        }
      }
      googleTasks = allTasks;
    } catch (err) {
      console.error("Failed to fetch task lists:", err);
    }
  }

  return { groupedAssignments, pendingApprovals, timesheetProjects, calendarEvents, googleTasks };
}

export async function loader({ request }: Route.LoaderArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const sessionId = session.get("sessionId");

  if (!sessionId) {
    return { user: null, activeTimer: null, googleConnected: false, data: null };
  }

  const user = await getUserFromSessionId(sessionId);

  if (!user) {
    return { user: null, activeTimer: null, googleConnected: false, data: null };
  }

  const activeTimer = await getActiveTimer(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      autoStopThresholdHours: user.autoStopThresholdHours,
      apiKey: user.apiKey,
    },
    googleConnected: !!user.googleAccessToken,
    activeTimer,
    wsUrl: process.env.WS_PUBLIC_URL || "ws://localhost:8081",
    data: loadData(user),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const sessionId = session.get("sessionId");

  if (!sessionId) return new Response("Unauthorized", { status: 401 });

  const user = await getUserFromSessionId(sessionId);
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (intent === "START_TIMER") {
    const todoId = formData.get("todoId") as string;
    const todoTitle = formData.get("todoTitle") as string;
    const projectId = formData.get("projectId") as string;
    const projectName = formData.get("projectName") as string;

    return await startTimer(user.id, { todoId, todoTitle, projectId, projectName });
  }

  if (intent === "START_GOOGLE_TIMER") {
    const source = formData.get("source") as string;
    const itemId = formData.get("itemId") as string;
    const itemTitle = formData.get("itemTitle") as string;
    const projectId = formData.get("projectId") as string;
    const projectName = formData.get("projectName") as string;

    return await startTimer(user.id, { todoId: itemId, todoTitle: itemTitle, projectId, projectName, source });
  }

  if (intent === "STOP_TIMER") {
    return await stopTimer(user.id, user.basecampId);
  }

  if (intent === "APPROVE_TIMER") {
    const entryId = formData.get("entryId") as string;
    const durationHours = parseFloat(formData.get("durationHours") as string);
    if (!entryId || isNaN(durationHours)) {
      return new Response("Invalid data", { status: 400 });
    }

    return await approveTimeEntry(user.id, entryId, user.basecampId, Math.floor(durationHours * 3600));
  }

  if (intent === "UPDATE_SETTINGS") {
    const autoStopThresholdHours = parseInt(formData.get("autoStopThresholdHours") as string, 10);
    if (isNaN(autoStopThresholdHours) || autoStopThresholdHours < 1) {
      return new Response("Invalid value", { status: 400 });
    }

    await updateUserSettings(user.id, autoStopThresholdHours);
    return { success: true };
  }

  if (intent === "GENERATE_API_KEY") {
    await generateNewApiKey(user.id);
    return { success: true };
  }

  if (intent === "DISCONNECT_GOOGLE") {
    await disconnectGoogle(user.id);
    return { success: true };
  }

  return { success: false };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, activeTimer: serverActiveTimer, wsUrl, googleConnected } = loaderData;
  const navigation = useNavigation();

  let activeTimer = serverActiveTimer;

  if (navigation.formData) {
    const intent = navigation.formData.get("intent");
    if ((intent === "START_TIMER" || intent === "START_GOOGLE_TIMER") && user) {
      activeTimer = {
        id: "optimistic",
        userId: user.id,
        todoId: navigation.formData.get("todoId") as string || navigation.formData.get("itemId") as string,
        todoTitle: navigation.formData.get("todoTitle") as string || navigation.formData.get("itemTitle") as string,
        projectId: navigation.formData.get("projectId") as string,
        projectName: navigation.formData.get("projectName") as string,
        startedAt: new Date(),
        lastPingAt: new Date(),
        source: (navigation.formData.get("source") as string) || "BASECAMP",
      };
    } else if (intent === "STOP_TIMER") {
      activeTimer = null;
    }
  }

  const [activeTab, setActiveTab] = useState<"basecamp" | "calendar" | "tasks">("basecamp");

  useTimerWebSocket(user?.apiKey, wsUrl);
  useTimerTitle(activeTimer);

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Card className="max-w-sm w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center rotate-3 shadow-lg shadow-blue-500/30 mb-6">
              <Clock className="w-8 h-8 text-white -rotate-3" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Basetrack</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6">
              Seamlessly track time for your Basecamp tasks without leaving the flow.
            </p>
            <Button render={<a href="/auth/basecamp" />} className="w-full" size="lg">
              Login with Basecamp
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Clock className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Basetrack</span>
                  <span className="truncate text-xs">Time Tracker</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Source</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeTab === "basecamp"}
                    onClick={() => setActiveTab("basecamp")}
                    className="min-w-0"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Basecamp</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeTab === "calendar"}
                    onClick={() => setActiveTab("calendar")}
                    className="min-w-0"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Calendar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeTab === "tasks"}
                    onClick={() => setActiveTab("tasks")}
                    className="min-w-0"
                  >
                    <ListTodo className="w-4 h-4" />
                    <span>Tasks</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Suspense fallback={<ProjectListSkeleton />}>
            <Await resolve={loaderData.data}>
              {(data) => data ? <ProjectList data={data} activeTab={activeTab} /> : null}
            </Await>
          </Suspense>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs rounded-lg">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  <SettingsModal
                    defaultAutoStopHours={user.autoStopThresholdHours ?? 8}
                    apiKey={user.apiKey}
                    googleConnected={googleConnected}
                  />
                  <Form method="post" action="/auth/logout">
                    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-500" title="Logout">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </Form>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            {activeTab === "basecamp" ? (
              <LayoutDashboard className="w-5 h-5 text-blue-500" />
            ) : activeTab === "calendar" ? (
              <Calendar className="w-5 h-5 text-blue-500" />
            ) : (
              <ListTodo className="w-5 h-5 text-blue-500" />
            )}
            <h2 className="text-lg font-semibold tracking-tight capitalize">{activeTab}</h2>
          </div>
        </header>

        <Suspense fallback={<ContentSkeleton />}>
          <Await resolve={loaderData.data}>
            {(data) => data ? (
              <DashboardContent
                data={data}
                activeTab={activeTab}
                activeTimer={activeTimer}
                googleConnected={googleConnected}
              />
            ) : (
              <ContentSkeleton />
            )}
          </Await>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ProjectListSkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {[1, 2, 3].map((i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuButton className="min-w-0">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function ContentSkeleton() {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2 space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64 mt-1" />
              </CardHeader>
              <CardContent className="grid gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-4 rounded-xl border flex gap-4 items-center">
                    <Skeleton className="h-4 w-4 shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="xl:col-span-1">
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="flex flex-col items-center py-8">
                <Skeleton className="h-10 w-10 rounded-full mb-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 mt-1" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectList({ data, activeTab }: { data: AppData; activeTab: string }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    data.groupedAssignments.length > 0 ? data.groupedAssignments[0].projectId : null
  );

  if (activeTab !== "basecamp") return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {data.groupedAssignments.map((project: GroupedAssignment) => {
            const isSelected = project.projectId === selectedProjectId;
            return (
              <SidebarMenuItem key={project.projectId}>
                <SidebarMenuButton
                  isActive={isSelected}
                  onClick={() => setSelectedProjectId(project.projectId)}
                  className="min-w-0"
                >
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span title={project.projectName}>{project.projectName}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{project.tasks.length}</SidebarMenuBadge>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function DashboardContent({ data, activeTab, activeTimer, googleConnected }: {
  data: AppData;
  activeTab: string;
  activeTimer: any;
  googleConnected: boolean;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    data.groupedAssignments.length > 0 ? data.groupedAssignments[0].projectId : null
  );

  const selectedProject = data.groupedAssignments.find(
    (p: GroupedAssignment) => p.projectId === selectedProjectId
  );

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto w-full">
        {activeTab === "basecamp" ? (
          <>
            {data.pendingApprovals && data.pendingApprovals.length > 0 && (
              <PendingApprovals approvals={data.pendingApprovals} />
            )}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className="xl:col-span-2 space-y-6">
                {data.groupedAssignments.length === 0 ? (
                  <Card className="border-dashed shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">You're all caught up!</p>
                      <p className="text-sm text-muted-foreground mt-1">No active assignments found in Basecamp.</p>
                    </CardContent>
                  </Card>
                ) : selectedProject ? (
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Assigned Tasks</CardTitle>
                      <CardDescription>Select a task to start tracking your time.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {selectedProject.tasks.map((task: GroupedTask) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          selectedProject={selectedProject}
                          activeTimer={activeTimer}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
              <div className="xl:col-span-1 sticky top-24">
                <ActiveTimerCard activeTimer={activeTimer} />
              </div>
            </div>
          </>
        ) : activeTab === "calendar" ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-6">
              {!googleConnected ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Google Calendar not connected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Connect your Google account in Settings to see your calendar events here.
                    </p>
                  </CardContent>
                </Card>
              ) : data.calendarEvents.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No events today</p>
                    <p className="text-sm text-muted-foreground mt-1">You have no calendar events scheduled for today.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Today's Events</CardTitle>
                    <CardDescription>Select an event and pick a Basecamp project to start tracking.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {data.calendarEvents.map((event: GoogleCalendarEvent) => (
                      <GoogleItemCard
                        key={event.id}
                        item={event}
                        source="GOOGLE_CALENDAR"
                        projects={data.timesheetProjects}
                        isActive={activeTimer?.todoId === event.id}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="xl:col-span-1 sticky top-24">
              <ActiveTimerCard activeTimer={activeTimer} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-6">
              {!googleConnected ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ListTodo className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Google Tasks not connected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Connect your Google account in Settings to see your tasks here.
                    </p>
                  </CardContent>
                </Card>
              ) : data.googleTasks.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ListTodo className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No pending tasks</p>
                    <p className="text-sm text-muted-foreground mt-1">You have no pending tasks in Google Tasks.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Google Tasks</CardTitle>
                    <CardDescription>Select a task and pick a Basecamp project to start tracking.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {data.googleTasks.map((task: GoogleTask) => (
                      <GoogleItemCard
                        key={task.id}
                        item={task}
                        source="GOOGLE_TASKS"
                        projects={data.timesheetProjects}
                        isActive={activeTimer?.todoId === task.id}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="xl:col-span-1 sticky top-24">
              <ActiveTimerCard activeTimer={activeTimer} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

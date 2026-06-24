import { prisma } from "@/lib/db/prisma";
import { assertDoctorCanWriteMember, logPatientWriteAction } from "@/lib/services/care-teams";

type FollowUpTaskType = "ONE_MONTH" | "THREE_MONTH" | "CUSTOM";
type FollowUpTaskStatus = "PENDING" | "REMINDED" | "COMPLETED" | "CANCELLED" | "LOST_TO_FOLLOWUP";
type ReminderStatus = "RECORDED" | "ACKNOWLEDGED" | "FAILED";
type ReminderChannel = "MANUAL_PHONE" | "MANUAL_WECHAT" | "IN_PERSON" | "OTHER";

function copyDate(value: Date) {
  return new Date(value.getTime());
}

function addDays(value: Date, days: number) {
  const next = copyDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addCalendarMonths(value: Date, months: number) {
  const next = copyDate(value);
  const originalDay = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDay));
  return next;
}

export function buildFollowUpTaskWindow(input: {
  baselineAt: Date;
  taskType: FollowUpTaskType;
  customDueDate?: Date | null;
}) {
  if (input.taskType === "CUSTOM") {
    if (!input.customDueDate) {
      throw new Error("自定义随访任务必须提供 dueDate");
    }

    const dueDate = copyDate(input.customDueDate);
    return {
      dueDate,
      windowStartAt: dueDate,
      windowEndAt: dueDate,
    };
  }

  if (input.taskType === "ONE_MONTH") {
    return {
      dueDate: addCalendarMonths(input.baselineAt, 1),
      windowStartAt: addDays(input.baselineAt, 25),
      windowEndAt: addDays(input.baselineAt, 45),
    };
  }

  return {
    dueDate: addCalendarMonths(input.baselineAt, 3),
    windowStartAt: addDays(input.baselineAt, 75),
    windowEndAt: addDays(input.baselineAt, 105),
  };
}

export function buildDefaultFollowUpTaskPlans(input: {
  baselineAt: Date;
  scaleId: string;
}) {
  return (["ONE_MONTH", "THREE_MONTH"] as const).map((taskType) => ({
    taskType,
    scaleId: input.scaleId,
    ...buildFollowUpTaskWindow({
      baselineAt: input.baselineAt,
      taskType,
    }),
  }));
}

export function resolveReminderTaskStatusAfterLog(input: {
  currentTaskStatus: FollowUpTaskStatus;
  reminderStatus: ReminderStatus;
}): FollowUpTaskStatus {
  if (["COMPLETED", "CANCELLED", "LOST_TO_FOLLOWUP"].includes(input.currentTaskStatus)) {
    return input.currentTaskStatus;
  }

  if (input.reminderStatus === "FAILED") {
    return input.currentTaskStatus;
  }

  return "REMINDED";
}

async function resolveBaseline(input: {
  memberId: string;
  baselineAssessmentHistoryId?: string | null;
  baselineAssessmentSessionId?: string | null;
  scaleId?: string | null;
  baselineAt?: string | Date | null;
}) {
  if (input.baselineAssessmentHistoryId) {
    const assessment = await prisma.assessmentHistory.findFirst({
      where: {
        id: input.baselineAssessmentHistoryId,
        profileId: input.memberId,
      },
      select: {
        id: true,
        scaleId: true,
        createdAt: true,
      },
    });

    if (!assessment) {
      throw new Error("随访基线评估不存在或不属于该患者");
    }

    return {
      assessmentHistoryId: assessment.id,
      assessmentSessionId: null,
      scaleId: assessment.scaleId,
      baselineAt: assessment.createdAt,
    };
  }

  if (input.baselineAssessmentSessionId) {
    const session = await prisma.assessmentSession.findFirst({
      where: {
        id: input.baselineAssessmentSessionId,
        profileId: input.memberId,
      },
      select: {
        id: true,
        scaleId: true,
        completedAt: true,
        createdAt: true,
      },
    });

    if (!session) {
      throw new Error("随访基线会话不存在或不属于该患者");
    }

    return {
      assessmentHistoryId: null,
      assessmentSessionId: session.id,
      scaleId: session.scaleId,
      baselineAt: session.completedAt || session.createdAt,
    };
  }

  if (!input.scaleId) {
    throw new Error("缺少随访任务量表 ID");
  }

  return {
    assessmentHistoryId: null,
    assessmentSessionId: null,
    scaleId: input.scaleId,
    baselineAt: input.baselineAt ? new Date(input.baselineAt) : new Date(),
  };
}

export async function listFollowUpTasks(input: {
  doctorProfileId: string;
  memberId: string;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);

  return prisma.followUpTask.findMany({
    where: {
      memberProfileId: input.memberId,
    },
    include: {
      reminderLogs: {
        orderBy: { recordedAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function createDefaultFollowUpTasks(input: {
  doctorProfileId: string;
  memberId: string;
  baselineAssessmentHistoryId?: string | null;
  baselineAssessmentSessionId?: string | null;
  scaleId?: string | null;
  baselineAt?: string | Date | null;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);
  const baseline = await resolveBaseline(input);
  const plans = buildDefaultFollowUpTaskPlans({
    baselineAt: baseline.baselineAt,
    scaleId: baseline.scaleId,
  });

  const tasks = [];
  for (const plan of plans) {
    const existing = await prisma.followUpTask.findFirst({
      where: {
        memberProfileId: input.memberId,
        baselineAssessmentHistoryId: baseline.assessmentHistoryId,
        baselineAssessmentSessionId: baseline.assessmentSessionId,
        scaleId: baseline.scaleId,
        taskType: plan.taskType,
      },
    });

    if (existing) {
      tasks.push(existing);
      continue;
    }

    const created = await prisma.followUpTask.create({
      data: {
        memberProfileId: input.memberId,
        baselineAssessmentHistoryId: baseline.assessmentHistoryId,
        baselineAssessmentSessionId: baseline.assessmentSessionId,
        scaleId: baseline.scaleId,
        taskType: plan.taskType,
        dueDate: plan.dueDate,
        windowStartAt: plan.windowStartAt,
        windowEndAt: plan.windowEndAt,
        status: "PENDING",
        createdByDoctorProfileId: input.doctorProfileId,
      },
    });
    tasks.push(created);
  }

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: input.memberId,
    action: "FOLLOWUP_TASKS_CREATED",
    metadata: {
      baselineAssessmentHistoryId: baseline.assessmentHistoryId,
      baselineAssessmentSessionId: baseline.assessmentSessionId,
      scaleId: baseline.scaleId,
      taskTypes: tasks.map((task) => task.taskType),
    },
  });

  return tasks;
}

export async function recordManualReminder(input: {
  doctorProfileId: string;
  followUpTaskId: string;
  reminderChannel: ReminderChannel;
  status: ReminderStatus;
  messageSummary?: string | null;
  metadata?: unknown;
}) {
  const task = await prisma.followUpTask.findUnique({
    where: { id: input.followUpTaskId },
    select: {
      id: true,
      memberProfileId: true,
      status: true,
    },
  });

  if (!task) {
    throw new Error("随访任务不存在");
  }

  await assertDoctorCanWriteMember(task.memberProfileId, input.doctorProfileId);

  const reminder = await prisma.reminderLog.create({
    data: {
      followUpTaskId: task.id,
      memberProfileId: task.memberProfileId,
      doctorProfileId: input.doctorProfileId,
      reminderChannel: input.reminderChannel,
      status: input.status,
      messageSummary: input.messageSummary?.trim() || null,
      metadata: input.metadata === undefined ? undefined : JSON.parse(JSON.stringify(input.metadata)),
    },
  });

  const nextStatus = resolveReminderTaskStatusAfterLog({
    currentTaskStatus: task.status,
    reminderStatus: input.status,
  });

  if (nextStatus !== task.status) {
    await prisma.followUpTask.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
      },
    });
  }

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: task.memberProfileId,
    action: "FOLLOWUP_REMINDER_RECORDED",
    metadata: {
      followUpTaskId: task.id,
      reminderChannel: input.reminderChannel,
      reminderStatus: input.status,
      taskStatusAfterReminder: nextStatus,
    },
  });

  return reminder;
}

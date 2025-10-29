import {
  queryEnrollments,
  queryCoursePartition,
  queryCourseProgressItems,
  queryActivityRange
} from './dashboard.repo.js';

export async function svcSummary(userId) {
  const enrolls = await queryEnrollments(userId);

  const active = enrolls.filter((e) => (e.status || 'active') === 'active');
  const completed = enrolls.filter((e) => e.status === 'completed');
  const avg = enrolls.length
    ? Math.round(
        enrolls.reduce((s, e) => s + (e.progressPercent || 0), 0) / enrolls.length
      )
    : 0;

  const activeCourse =
    active.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] ||
    active[0] ||
    null;

  let nextLessons = [];
  if (activeCourse) {
    nextLessons = await computeNextLessons(
      userId,
      activeCourse.SK.replace('COURSE#', ''),
      4
    );
  }

  return {
    kpis: {
      coursesActive: active.length,
      coursesCompleted: completed.length,
      avgProgressPercent: avg,
      totalLessons: active.concat(completed).reduce((s, e) => s + (e.totalLessons || 0), 0)
    },
    activeCourse: activeCourse
      ? {
          id: activeCourse.SK.replace('COURSE#', ''),
          title: activeCourse.title,
          progressPercent: activeCourse.progressPercent || 0,
          tags: activeCourse.tags || []
        }
      : null,
    coursesSummary: enrolls.map((e) => ({
      id: e.SK.replace('COURSE#', ''),
      title: e.title,
      progressPercent: e.progressPercent || 0,
      lessonsTotal: e.totalLessons || 0,
      status: e.status || 'active'
    })),
    nextLessons
  };
}

async function computeNextLessons(userId, courseId, limit = 4) {
  const [tree, progress] = await Promise.all([
    queryCoursePartition(userId, courseId),
    queryCourseProgressItems(userId, courseId)
  ]);

  const completed = new Set(
    progress
      .filter((p) => p.status === 'completed')
      .map((p) => String(p.SK).replace('PROGRESS#LESSON#', ''))
  );

  const lessons = tree
    .filter((it) => String(it.SK).startsWith('LESSON#'))
    .map((it) => {
      const parts = String(it.SK).split('#');
      return {
        lessonId: parts[3],
        moduleId: it.moduleId,
        modulePos: Number(parts[1]),
        order: Number(parts[2]),
        title: it.title,
        durationMinutes: it.durationMinutes || 0,
        completed: completed.has(parts[3])
      };
    })
    .filter((l) => !l.completed)
    .sort((a, b) => a.modulePos - b.modulePos || a.order - b.order)
  .slice(0, limit);

  return lessons;
}

export async function svcWeeklyActivity(userId, days = 7, now = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const fromIso = toISO(from);
  const toIso = toISO(to);

  const items = await queryActivityRange(userId, fromIso, toIso);

  const buckets = new Map();
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    buckets.set(toISO(d), 0);
  }
  for (const it of items) {
    const sk = String(it.SK); 
    const d = sk.slice(4, 12);
    const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    buckets.set(iso, (buckets.get(iso) || 0) + (it.minutes || 0));
  }

  return {
    from: fromIso,
    to: toIso,
    buckets: Array.from(buckets.entries()).map(([date, minutes]) => ({ date, minutes }))
  };
}

export async function svcStreak(userId, maxWindowDays = 30, now = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (maxWindowDays - 1));
  const items = await queryActivityRange(userId, toISO(from), toISO(to));

  const days = new Set(
    items.map((it) => {
      const d = String(it.SK).slice(4, 12);
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    })
  );

  let streak = 0;
  for (let d = new Date(to); d >= from; d.setUTCDate(d.getUTCDate() - 1)) {
    const iso = toISO(d);
    if (days.has(iso)) streak += 1;
    else break;
  }
  return { streakCurrent: streak };
}

function toISO(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

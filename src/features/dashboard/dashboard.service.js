import {
  queryEnrollments,
  queryCoursePartition,
  queryCourseProgressItems,
  queryActivityRange
} from './dashboard.repo.js';

export async function svcSummary(userId) {
  const raw = await queryEnrollments(userId);

  // 1) Normalizamos courseId
  const enrollsBase = (raw || []).map((e) => {
    const courseId = String(e.PK || '').replace('COURSE#', '');
    return { ...e, courseId };
  });

  // 2) Enriquecemos con progreso real desde novalearn-lessons-*
  const enrolls = await Promise.all(
    enrollsBase.map(async (e) => {
      if (!e.courseId) return e;

      const prog = await computeCourseProgressDashboard(userId, e.courseId);

      return {
        ...e,
        progressPercent: prog.progressPercent,
        totalLessons: prog.totalLessons,
        completedLessons: prog.completedLessons,
      };
    })
  );

  // 3) KPIs usando los enrolls enriquecidos
  const active = enrolls.filter(
    (e) => (e.status || 'active') === 'active'
  );
  const completed = enrolls.filter(
    (e) => e.status === 'completed'
  );

  const avg = enrolls.length
    ? Math.round(
        enrolls.reduce(
          (s, e) => s + (e.progressPercent || 0),
          0
        ) / enrolls.length
      )
    : 0;

  const activeCourse =
    active.sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    )[0] ||
    active[0] ||
    null;

  let nextLessons = [];
  if (activeCourse && activeCourse.courseId) {
    nextLessons = await computeNextLessons(
      userId,
      activeCourse.courseId,
      4
    );
  }

  return {
    kpis: {
      coursesActive: active.length,
      coursesCompleted: completed.length,
      avgProgressPercent: avg,
      totalLessons: active
        .concat(completed)
        .reduce(
          (s, e) => s + (e.totalLessons || 0),
          0
        ),
    },
    activeCourse: activeCourse
      ? {
          id: activeCourse.courseId,
          title: activeCourse.title,
          progressPercent: activeCourse.progressPercent || 0,
          tags: activeCourse.tags || [],
        }
      : null,
    coursesSummary: enrolls.map((e) => ({
      id: e.courseId,
      title: e.title,
      progressPercent: e.progressPercent || 0,
      lessonsTotal: e.totalLessons || 0,
      status: e.status || 'active',
    })),
    nextLessons,
  };
}

async function computeNextLessons(
  userId,
  courseId,
  limit = 4
) {
  const [tree, progress] = await Promise.all([
    queryCoursePartition(userId, courseId),
    queryCourseProgressItems(userId, courseId),
  ]);

  const completed = new Set(
    (progress || [])
      .filter((p) => p.status === 'completed')
      .map((p) =>
        String(p.SK).replace(
          'PROGRESS#LESSON#',
          ''
        )
      )
  );

  const lessons = (tree || [])
    .filter((it) =>
      String(it.SK).startsWith('LESSON#')
    )
    .map((it) => {
      const parts = String(it.SK).split('#');
      return {
        lessonId: parts[3],
        moduleId: it.moduleId,
        modulePos: Number(parts[1]),
        order: Number(parts[2]),
        title: it.title,
        durationMinutes:
          it.durationMinutes || 0,
        completed: completed.has(parts[3]),
      };
    })
    .filter((l) => !l.completed)
    .sort(
      (a, b) =>
        a.modulePos - b.modulePos ||
        a.order - b.order
    )
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
    const datePartRaw = sk.split('#')[1] || '';
    const datePart = datePartRaw.slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      console.warn('[WEEKLY][BAD_DATE]', { sk, datePartRaw });
      continue;
    }
    buckets.set(
      datePart,
      (buckets.get(datePart) || 0) + (it.minutes || 0)
    );
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
      const sk = String(it.SK);
      const raw = sk.split('#')[1] || '';
      const iso = raw.slice(0, 10);    
      return iso;
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


async function computeCourseProgressDashboard(userId, courseId) {
  const [tree, progressItems] = await Promise.all([
    queryCoursePartition(userId, courseId),
    queryCourseProgressItems(userId, courseId),
  ]);

  const lessons = (tree || []).filter((it) =>
    String(it.SK || '').startsWith('LESSON#')
  );
  const totalLessons = lessons.length;

  const completedIds = new Set(
    (progressItems || [])
      .filter((p) => (p.status || p['status']) === 'completed')
      .map((p) =>
        String(p.SK).replace('PROGRESS#LESSON#', '')
      )
  );

  const completedLessons = completedIds.size;

  let pct =
    totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 10000) / 100
      : 0;

  pct = Math.max(0, Math.min(100, pct));

  return {
    progressPercent: pct,
    totalLessons,
    completedLessons,
  };
}

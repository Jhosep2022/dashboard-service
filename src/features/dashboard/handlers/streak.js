import { ok, err } from '../../../core/http.js';
import { svcStreak } from '../dashboard.service.js';

export const handler = async (event) => {
  try {
    const ctx = event?.requestContext?.authorizer?.lambda || {};
    if (!ctx.userId) return err(event, 'UNAUTHORIZED', 401);
    const res = await svcStreak(ctx.userId);
    return ok(event, res); // { streakCurrent: 6 }
  } catch (e) {
    return err(event, e.message || 'ERROR', 400);
  }
};

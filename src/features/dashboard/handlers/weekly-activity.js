import { ok, err } from '../../../core/http.js';
import { svcWeeklyActivity } from '../dashboard.service.js';

export const handler = async (event) => {
  try {
    const ctx = event?.requestContext?.authorizer?.lambda || {};
    if (!ctx.userId) return err(event, 'UNAUTHORIZED', 401);
    const days = Math.max(1, Math.min(14, Number(event?.queryStringParameters?.days || 7)));
    const res = await svcWeeklyActivity(ctx.userId, days);
    return ok(event, res);
  } catch (e) {
    return err(event, e.message || 'ERROR', 400);
  }
};

import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../../core/ddb.js';
import { env } from '../../core/env.js';

/** Enrolments del usuario (todas las rutas personales) */
export async function queryEnrollments(userId) {
  const r = await doc.send(new QueryCommand({
    TableName: env.tableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'COURSE#' },
    ScanIndexForward: false
  }));
  return r.Items || [];
}

/** Muestra el curso personal completo (para “próximas lecciones”) */
export async function queryCoursePartition(userId, courseId) {
  const r = await doc.send(new QueryCommand({
    TableName: env.tableName,
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :a AND :z',
    ExpressionAttributeValues: {
      ':pk': `UC#${userId}#${courseId}`,
      ':a': 'COURSE#',
      ':z': 'PROGRESS~'
    },
    ScanIndexForward: true
  }));
  return r.Items || [];
}

/** Progresos de la partición del curso */
export async function queryCourseProgressItems(userId, courseId) {
  const r = await doc.send(new QueryCommand({
    TableName: env.tableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :p)',
    ExpressionAttributeValues: { ':pk': `UC#${userId}#${courseId}`, ':p': 'PROGRESS#LESSON#' },
    ScanIndexForward: true
  }));
  return r.Items || [];
}

/** Actividad en rango (YYYY-MM-DD) */
export async function queryActivityRange(userId, fromISO, toISO) {
  const fromKey = `ACT#${fromISO.replace(/-/g,'')}#0`;
  const toKey   = `ACT#${toISO.replace(/-/g,'')}~`;
  const r = await doc.send(new QueryCommand({
    TableName: env.tableName,
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': fromKey, ':to': toKey },
    ScanIndexForward: true
  }));
  return r.Items || [];
}

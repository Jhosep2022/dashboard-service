import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../../core/ddb.js';
import { env } from '../../core/env.js';

const COURSES_TABLE = env.coursesTableName
const LESSONS_TABLE = env.lessonsTableName
const ACTIVITY_TABLE = LESSONS_TABLE;

/** Enrolments del usuario (todas las rutas personales) */
export async function queryEnrollments(userId) {
  const r = await doc.send(
    new QueryCommand({
      TableName: COURSES_TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'UPDATED#'
      },
      ScanIndexForward: false
    })
  );
  return r.Items || [];
}

/** Muestra el curso personal completo (para “próximas lecciones”) */
export async function queryCoursePartition(userId, courseId) {
  const r = await doc.send(
    new QueryCommand({
      TableName: LESSONS_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `COURSE#${courseId}`,
        ':sk': 'M#'
      },
      ScanIndexForward: true
    })
  );
  return r.Items || [];
}

/** Progresos de la partición del curso */
export async function queryCourseProgressItems(userId, courseId) {
  const r = await doc.send(
    new QueryCommand({
      TableName: LESSONS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :p)',
      ExpressionAttributeValues: {
        ':pk': `COURSE#${courseId}`,
        ':p': 'PROGRESS#LESSON#'
      },
      ScanIndexForward: true
    })
  );
  return r.Items || [];
}

/** Actividad en rango (YYYY-MM-DD) */
export async function queryActivityRange(userId, fromISO, toISO) {
  const fromKey = `ACT#${fromISO}`;
  const toKey   = `ACT#${toISO}~`;

  const r = await doc.send(
    new QueryCommand({
      TableName: ACTIVITY_TABLE,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':pk': `UA#${userId}`,  // coincide con PK usado en setLessonProgress/setLessonNotes
        ':from': fromKey,
        ':to': toKey
      },
      ScanIndexForward: true
    })
  );
  return r.Items || [];
}
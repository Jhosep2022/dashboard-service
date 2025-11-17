export const env = {
  coursesTableName: process.env.COURSES_TABLE_NAME,
  lessonsTableName: process.env.LESSONS_TABLE_NAME,
  modulesTableName: process.env.MODULES_TABLE_NAME,
  examsTable: process.env.EXAMS_TABLE_NAME,
  resourcesTable: process.env.RESOURCES_TABLE_NAME,
  quizzesTable: process.env.QUIZZES_TABLE_NAME,

  allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  stage: process.env.STAGE || 'dev'
};

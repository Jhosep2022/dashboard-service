export const env = {
  tableName: process.env.COURSES_TABLE_NAME,
  allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  stage: process.env.STAGE || 'dev'
};

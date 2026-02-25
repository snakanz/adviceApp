const { body, param, validationResult } = require('express-validator');

// Middleware to check validation results and return 400 on failure
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// === Reusable validation chains ===

const clientCreate = [
  body('name').optional().isString().trim().isLength({ max: 200 }).withMessage('Name must be under 200 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('notes').optional().isString().isLength({ max: 5000 }).withMessage('Notes must be under 5000 characters'),
  validate
];

const clientMerge = [
  body('name').optional().isString().trim().isLength({ max: 200 }),
  body('email').optional().isEmail().normalizeEmail(),
  validate
];

const clientUpdate = [
  body('name').optional().isString().trim().isLength({ max: 200 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('notes').optional().isString().isLength({ max: 5000 }),
  body('stage').optional().isString().isIn(['prospect', 'lead', 'active', 'review', 'completed']),
  body('priority_level').optional().isInt({ min: 1, max: 5 }),
  validate
];

const meetingCreate = [
  body('title').isString().trim().notEmpty().isLength({ max: 500 }).withMessage('Title is required and must be under 500 characters'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').optional().isString(),
  body('duration').optional().isInt({ min: 1, max: 1440 }).withMessage('Duration must be 1-1440 minutes'),
  body('description').optional().isString().isLength({ max: 5000 }),
  validate
];

const askAdviclyMessage = [
  body('content').isString().trim().notEmpty().isLength({ max: 10000 }).withMessage('Message is required and must be under 10000 characters'),
  body('mentionedClients').optional().isArray(),
  body('mentionedClients.*').optional().isUUID().withMessage('Each mentioned client must be a valid UUID'),
  validate
];

const conversationUpdate = [
  body('title').isString().trim().notEmpty().isLength({ max: 200 }).withMessage('Title is required and must be under 200 characters'),
  validate
];

const actionItemCreate = [
  body('title').optional().isString().trim().isLength({ max: 500 }),
  body('actionText').optional().isString().trim().isLength({ max: 2000 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('priority').optional().isString().isIn(['low', 'medium', 'high', 'urgent']),
  body('due_date').optional().isISO8601(),
  validate
];

const actionItemToggle = [
  body('source').optional().isString().isIn(['meeting', 'manual', 'pipeline']),
  validate
];

const actionItemText = [
  body('actionText').isString().trim().notEmpty().isLength({ max: 2000 }).withMessage('Action text is required and must be under 2000 characters'),
  validate
];

const pipelineTask = [
  body('title').isString().trim().notEmpty().isLength({ max: 500 }).withMessage('Title is required'),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('priority').optional().isString().isIn(['low', 'medium', 'high', 'urgent']),
  body('due_date').optional().isISO8601(),
  body('category').optional().isString().isLength({ max: 100 }),
  validate
];

const pipelinePriority = [
  body('priority_level').isInt({ min: 1, max: 5 }).withMessage('Priority must be 1-5'),
  validate
];

const pipelineStage = [
  body('stage').isString().isIn(['prospect', 'lead', 'active', 'review', 'completed']).withMessage('Invalid pipeline stage'),
  validate
];

const notificationSubscribe = [
  body('subscription').isObject().withMessage('Subscription object is required'),
  body('subscription.endpoint').isURL().withMessage('Valid endpoint URL is required'),
  validate
];

const uuidParam = (paramName) => [
  param(paramName).isUUID().withMessage(`${paramName} must be a valid UUID`),
  validate
];

module.exports = {
  validate,
  clientCreate,
  clientMerge,
  clientUpdate,
  meetingCreate,
  askAdviclyMessage,
  conversationUpdate,
  actionItemCreate,
  actionItemToggle,
  actionItemText,
  pipelineTask,
  pipelinePriority,
  pipelineStage,
  notificationSubscribe,
  uuidParam
};

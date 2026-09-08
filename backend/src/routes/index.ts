import ticketRoutes from './ticket.routes.js';
import userRoutes from './user.routes.js';
import emailRoutes from './email.routes.js';

export { ticketRoutes, userRoutes, emailRoutes };
export default {
  tickets: ticketRoutes,
  users: userRoutes,
  email: emailRoutes,
};

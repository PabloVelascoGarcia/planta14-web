import type { Access, PayloadRequest } from 'payload';

// Phase 1 deliberately has no municipal or writer accounts. No legacy cookie is trusted.
export const adminOnly = ({ req }: { req: PayloadRequest }): boolean => req.user?.collection === 'users' && req.user.role === 'admin';
export const ownUserOrAdmin: Access = (args) => adminOnly(args) || (args.req.user ? { id: { equals: args.req.user.id } } : false);

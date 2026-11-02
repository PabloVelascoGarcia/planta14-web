import type { Access, PayloadRequest } from 'payload';

export const adminOnly = ({ req }: { req: PayloadRequest }): boolean => req.user?.collection === 'users' && req.user.role === 'admin';
export const editorialUser = ({ req }: { req: PayloadRequest }): boolean => req.user?.collection === 'users' && ['admin', 'editor'].includes(req.user.role);
export const publishedOnly: Access = (args) => editorialUser(args) || { _status: { equals: 'published' } };
export const ownUserOrAdmin: Access = (args) => adminOnly(args) || (args.req.user ? { id: { equals: args.req.user.id } } : false);

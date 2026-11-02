import type { Access, PayloadRequest, Where } from 'payload';

type Args = { req: PayloadRequest };
const relationID = (value: unknown): number | null => {
  const id = typeof value === 'object' && value ? (value as { id?: unknown }).id : value;
  const number = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
  return typeof number === 'number' && Number.isInteger(number) ? number : null;
};
export { relationID };

export const adminOnly = ({ req }: Args): boolean => req.user?.collection === 'users' && req.user.role === 'admin';
export const editorialUser = ({ req }: Args): boolean => req.user?.collection === 'users' && ['admin', 'editor'].includes(req.user.role);
/** Municipal account linked to exactly one municipal space. */
export const municipalUser = ({ req }: Args): boolean => req.user?.collection === 'users' && req.user.role === 'municipal' && municipalSpaceOf(req) !== null;
export function municipalSpaceOf(req: PayloadRequest): number | null {
  return req.user?.collection === 'users' && req.user.role === 'municipal' ? relationID((req.user as { municipalSpace?: unknown }).municipalSpace) : null;
}
/** Any signed-in account that is not municipal (public data stays public for anonymous visitors). */
export const notMunicipal: Access = ({ req }) => !(req.user?.collection === 'users' && req.user.role === 'municipal');

export const publishedFilter: Where = { _status: { equals: 'published' } };
export const publishedOnly: Access = (args) => editorialUser(args) || publishedFilter;
/** Planta 14 editorial content: municipal accounts have no access at all. */
export const editorialContentRead: Access = (args) => editorialUser(args) || (notMunicipal(args) ? publishedFilter : false);
export const editorialVersions: Access = (args) => editorialUser(args);
export const ownUserOrAdmin: Access = (args) => adminOnly(args) || (args.req.user ? { id: { equals: args.req.user.id } } : false);

/** Municipal content: editors see everything; a municipality sees its own space (drafts included) and published content. */
export const municipalContentRead: Access = (args) => {
  if (editorialUser(args)) return true;
  const space = municipalSpaceOf(args.req);
  return space === null ? publishedFilter : { or: [{ space: { equals: space } }, publishedFilter] };
};
export const municipalContentVersions: Access = (args) => {
  if (editorialUser(args)) return true;
  const space = municipalSpaceOf(args.req);
  return space === null ? false : { 'version.space': { equals: space } };
};
export const municipalContentCreate: Access = (args) => {
  if (editorialUser(args)) return true;
  const space = municipalSpaceOf(args.req);
  if (space === null) return false;
  const requested = relationID((args.data as { space?: unknown } | undefined)?.space);
  return requested === null || requested === space;
};
export const municipalContentUpdate: Access = (args) => {
  if (editorialUser(args)) return true;
  const space = municipalSpaceOf(args.req);
  return space === null ? false : { space: { equals: space } };
};

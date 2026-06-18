export type UserRole = "admin" | "redactor";

export type CmsUser = {
  email: string;
  name: string;
  role: UserRole;
};

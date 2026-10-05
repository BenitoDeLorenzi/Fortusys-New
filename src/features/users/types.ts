export type RoleOption = {
  id: string;
  name: string;
  slug: string;
};

export type UserStatus = "active" | "inactive";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roleId: string | null;
  roleName: string | null;
  createdAt: string;
};

export type UsersResponse = {
  users: UserListItem[];
  roles: RoleOption[];
};

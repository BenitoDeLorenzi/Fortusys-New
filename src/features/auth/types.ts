export type AuthProfile = {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: "active" | "inactive";
  role: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export interface InviteNotification {
  id: string;
  createdAt: Date;
  statusInvite: string;
  role: string;
  sender: {
    id: string;
    name: string;
    userName: string;
  };
  board: {
    id: string;
    title: string;
  };
}

import { Medium } from "@/shared/dtos";

export type YPFMember = {
  id: string; // constituent ID
  profilePhotoUrl?: string;
  fullName: string;
  isActive: boolean;
  joinedAt?: Date;
  title?: string; // name of most significant title
};

export type YPFMemberDetail = {
  id: string; // constituent ID
  firstName: string;
  lastName: string;
  salutation?: string;
  profilePhoto?: Omit<Medium, "uploadedBy">; // excludes uploadedBy
  contactInfo: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  titles: {
    name: string; // eg. president
    scope?: { type: "chapter" | "committee"; name: string; id: string }; // undefined if global
    _level: number;
    startedAt: Date;
    endedAt?: Date;
  }[]; // current titles
  joinedAt: Date;
  isActive: boolean;
};

import { MediumType } from "@/shared/utils";

export type YPFMember = {
  id: string; // constituent ID
  publicId: string;
  profilePhotoUrl?: string;
  fullName: string;
  startedAt?: Date; // active Membership.startedAt
  title?: string; // name of most significant title
};

export type YPFMemberDetail = {
  id: string; // constituents.id
  publicId: string; // Constituents.publicId
  firstName: string;
  lastName: string;
  salutation?: string;
  profilePhoto?: {
    url: string;
    type: MediumType;
    dimensions: {
      width: number;
      height: number;
    };
    size: number;
    uploadedAt: Date;
  };
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
  startedAt?: Date;
  endedAt?: Date;
};

export type MemberRole = {
  id: string;
  title: string;
  alias: string;
  _level: number;
  scope?: { type: "chapter" | "committee"; id: string; name: string };
};

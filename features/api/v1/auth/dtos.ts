import { AuthenticatedUser } from "@/shared/types";
import { YPFConstituentDetail } from "../constituents/dtos";

export type AuthData = YPFConstituentDetail & { auth: AuthenticatedUser };

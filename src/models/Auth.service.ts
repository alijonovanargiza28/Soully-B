import jwt from "jsonwebtoken";
import { AUTH_TIMER } from "../libs/config";
import { MemberStatus, normalizeMemberType } from "../libs/enums/member.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Member } from "../libs/types/member";
import MemberModel from "../schema/Member.module";

class AuthService {
  public async createToken(member: Member): Promise<string> {
    return jwt.sign({ _id: member._id }, process.env.SECRET_TOKEN as string, {
      expiresIn: `${AUTH_TIMER}h`,
    });
  }

  public async checkAuth(token: string): Promise<Member> {
    try {
      const payload = jwt.verify(token, process.env.SECRET_TOKEN as string) as jwt.JwtPayload;
      const member = await MemberModel.findOne({
        _id: payload._id,
        memberStatus: MemberStatus.ACTIVE,
      })
        .lean()
        .exec();
      if (!member) throw new Error("Inactive member");
      member.memberType = normalizeMemberType(member.memberType);
      return member as unknown as Member;
    } catch {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
    }
  }
}
export default AuthService;

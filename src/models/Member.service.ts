import bcrypt from "bcryptjs";
import { shapeIntoMongooseObjectId } from "../libs/config";
import {
  MemberStatus,
  MemberType,
  normalizeMemberType,
  sellerMemberTypes,
} from "../libs/enums/member.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { LoginInput, Member, MemberInput, MemberUpdateInput } from "../libs/types/member";
import { validateCredentials, validateProfile } from "../libs/validation/member";
import MemberModule from "../schema/Member.module";

class MemberService {
  private readonly memberModel;
  constructor() {
    this.memberModel = MemberModule;
  }
  /**SPA */

  public async Signup(input: MemberInput): Promise<Member> {
    validateCredentials(input, true);
    input = {
      memberNick: input.memberNick,
      memberPhone: input.memberPhone,
      memberPassword: input.memberPassword,
      memberAdress: input.memberAdress,
      memberDesc: input.memberDesc,
      memberImage: input.memberImage,
      memberType: MemberType.USER,
    };
    const salt = await bcrypt.genSalt();
    input.memberPassword = await bcrypt.hash(input.memberPassword, salt);
    try {
      const result = await this.memberModel.create(input);
      result.memberPassword = "";
      return result.toJSON();
    } catch (err) {
      console.error("Error, model:signup", err);
      throw new Errors(HttpCode.BAD_REQUEST, Message.USED_NICK_PHONE);
    }
  }

  public async Login(input: LoginInput): Promise<Member> {
    validateCredentials(input);
    const member = await this.memberModel
      .findOne(
        {
          memberNick: input.memberNick,
          memberStatus: { $ne: MemberStatus.DELETE },
        },
        { memberNick: 1, memberPassword: 1, memberStatus: 1 },
      )
      .exec();

    if (!member) throw new Errors(HttpCode.NOT_FOUND, Message.NO_MEMBER_NICK);
    else if (member.memberStatus === MemberStatus.BLOCK) {
      throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);
    }
    const isMatch = await bcrypt.compare(input.memberPassword, member.memberPassword);

    if (!isMatch) {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);
    }
    const result = await this.memberModel.findById(member._id).lean().exec();
    if (result) result.memberType = normalizeMemberType(result.memberType);
    return result;
  }
  public async getMemberDetail(member: Member): Promise<Member> {
    const memberId = shapeIntoMongooseObjectId(member._id);
    const result = await this.memberModel
      .findOne({ _id: memberId, memberStatus: MemberStatus.ACTIVE })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }
  public async updateMember(member: Member, input: MemberUpdateInput): Promise<Member> {
    validateProfile(input as unknown as Record<string, unknown>);
    const memberId = shapeIntoMongooseObjectId(member._id);
    const result = await this.memberModel
      .findOneAndUpdate(
        { _id: memberId },
        {
          $set: Object.fromEntries(
            ["memberNick", "memberPhone", "memberAdress", "memberDesc", "memberImage"]
              .filter((key) => input[key as keyof MemberUpdateInput] !== undefined)
              .map((key) => [key, input[key as keyof MemberUpdateInput]]),
          ),
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!result) throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    return result;
  }
  public async getTopUsers(): Promise<Member[]> {
    const result = await this.memberModel
      .find({ memberStatus: MemberStatus.ACTIVE, memberPoints: { $gte: 1 } })
      .select("memberNick memberImage memberPoints memberType")
      .sort({ memberPoints: -1 })
      .limit(4)
      .exec();

    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return result;
  }
  public async getSeller(): Promise<Member> {
    const result = await this.memberModel
      .findOne({ memberType: { $in: sellerMemberTypes } })
      .lean()
      .exec();

    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    result.memberType = normalizeMemberType(result.memberType);
    return result;
  }
  public async addUserPoint(member: Member, point: number): Promise<Member> {
    const memberId = shapeIntoMongooseObjectId(member._id);

    return await this.memberModel
      .findOneAndUpdate(
        {
          _id: memberId,
          memberType: MemberType.USER,
          memberStatus: MemberStatus.ACTIVE,
        },
        { $inc: { memberPoints: point } },
        { new: true },
      )
      .exec();
  }

  /*SSR*/
  public async processSignup(input: MemberInput): Promise<Member> {
    validateCredentials(input, true);
    const exits = await this.memberModel.findOne({ memberType: { $in: sellerMemberTypes } }).exec();
    if (exits) throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    input = {
      memberNick: input.memberNick,
      memberPhone: input.memberPhone,
      memberPassword: input.memberPassword,
      memberAdress: input.memberAdress,
      memberDesc: input.memberDesc,
      memberImage: input.memberImage,
      memberType: MemberType.USER,
    };
    const salt = await bcrypt.genSalt();
    input.memberPassword = await bcrypt.hash(input.memberPassword, salt);

    try {
      const result = await this.memberModel.create({ ...input, memberType: MemberType.SELLER });
      result.memberPassword = "";
      return result;
    } catch (err) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  public async processLogin(input: LoginInput): Promise<Member> {
    validateCredentials(input);
    const member = await this.memberModel
      .findOne(
        {
          memberNick: input.memberNick,
          memberType: { $in: sellerMemberTypes },
          memberStatus: MemberStatus.ACTIVE,
        },
        { memberNick: 1, memberPassword: 1 },
      )
      .exec();
    if (!member) throw new Errors(HttpCode.NOT_FOUND, Message.NO_MEMBER_NICK);

    const isMatch = await bcrypt.compare(input.memberPassword, member.memberPassword);

    if (!isMatch) {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);
    }
    return await this.memberModel.findById(member._id).exec();
  }

  public async getUsers(): Promise<Member[]> {
    const result = await this.memberModel.find({ memberType: MemberType.USER }).exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return result;
  }
  public async updateChosenUser(input: MemberUpdateInput): Promise<Member> {
    if (!Object.values(MemberStatus).includes(input.memberStatus as MemberStatus))
      throw new Errors(HttpCode.BAD_REQUEST, "Select a valid member status.");
    const id = shapeIntoMongooseObjectId(input._id);

    const result = await this.memberModel
      .findOneAndUpdate(
        { _id: id, memberType: MemberType.USER },
        { $set: { memberStatus: input.memberStatus } },
        { new: true, runValidators: true },
      )
      .exec();

    if (!result) throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    return result;
  }
}

export default MemberService;

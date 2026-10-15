export enum HttpCode {
  OK = 200,
  CREATED = 201,
  NOT_MODIFIED = 304,
  BAD_REQUEST = 400,
  CONFLICT = 409,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}
export enum Message {
  SOMETHING_WENT_WRONG = "Something went wrong!",
  NO_DATA_FOUND = "No data is found!",
  CREATE_FAILED = "Create is failed!",
  UPDATE_FAILED = "Update is failed!",

  USED_NICK_PHONE = "you are inserting already used nick or phone!",
  TOKEN_CREATION_FAILED = "Token creation error",
  NO_MEMBER_NICK = "No member with that member nick!",
  BLOCKED_USER = "you have been blocked, contact! admin",
  WRONG_PASSWORD = "Wrong password insered please try again!",
  NOT_AUTHENTICATED = "You are not authenticated, Please login first",
}
class Errors extends Error {
  public code: HttpCode;
  public message: string;
  static readonly standard = {
    code: HttpCode.INTERNAL_SERVER_ERROR,
    message: Message.SOMETHING_WENT_WRONG,
  };

  toJSON() {
    return { code: this.code, message: this.message };
  }

  constructor(statusCode: HttpCode, statusMessage: string) {
    super(statusMessage);
    this.code = statusCode;
    this.message = statusMessage;
  }
}
export default Errors;

import { NextFunction, Request, Response } from "express";
import { T } from "../libs/types/common";
import MemberService from "../models/Member.service";
import { ExtendedRequest, LoginInput, Member, MemberInput, MemberUpdateInput } from "../libs/types/member";
import AuthService from "../models/Auth.service";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AUTH_TIMER } from "../libs/config";

const memberService = new MemberService();
const authService = new AuthService();

const memberController: T = {};

//REACT Sign UP
memberController.Signup = async (req: Request, res: Response) => {
  try {
    console.log("Signup");

    const input: MemberInput = req.body;

    // Agar rasm yuborilgan bo'lsa, saqlaymiz
    if (req.file) {
      input.memberImage = req.file.path;
    }

    const result: Member = await memberService.Signup(input);

    const token = await authService.createToken(result);

    res.cookie("accessToken", token, {
      maxAge: AUTH_TIMER * 3600 * 1000,
      httpOnly: false,
    });

    res.status(HttpCode.CREATED).json({
      member: result,
      accessToken: token,
    });
  } catch (err) {
    console.log("Error, Signup", err);

    if (err instanceof Errors) {
      res.status(err.code).json(err);
    } else {
      res.status(Errors.standard.code).json(Errors.standard);
    }
  }
};
//LOGIN
memberController.Login = async (req: Request, res: Response) => {
  try {
    console.log("Login");
    const input: LoginInput = req.body,
      result = await memberService.Login(input),
      token = await authService.createToken(result);

    res.cookie("accessToken", token, {
      maxAge: AUTH_TIMER * 3600 * 1000,
      httpOnly: false,
    });

    res.status(HttpCode.OK).json({ member: result, accessToken: token });
  } catch (err) {
    console.log("Error, Login", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

memberController.logout = (req: ExtendedRequest, res: Response) => {
  try {
    console.log("logout");

    res.clearCookie("accessToken");

    return res.redirect("/admin/login");
  } catch (err) {
    console.log("Error, Logout", err);

    if (err instanceof Errors) {
      return res.status(err.code).json(err);
    }

    return res.status(Errors.standard.code).json(Errors.standard);
  }
};

memberController.getMemberDetail = async(req: ExtendedRequest, res: Response) => {
  try {
    console.log("getMemberDetail");
   const result = await memberService.getMemberDetail(req.member)

   res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, getMemberDetail", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};


//3
memberController.getTopUsers = async (req: Request, res: Response) => {
  try {
    console.log("getTopUsers");
    const result = await memberService.getTopUsers()

    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, getTopUsers", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

memberController.verifyAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies["accessToken"];

    if (token) {
      req.member = await authService.checkAuth(token);
    }

    if (!req.member) {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
    }

    next();
  } catch (err) {
    console.log("Error, verifyAuth", err);

    if (err instanceof Errors) {
      return res.status(err.code).json(err);
    }

    return res.status(Errors.standard.code).json(Errors.standard);
  }
};


memberController.retrieveAuth = async (
    req: ExtendedRequest, 
    res: Response,
    next:NextFunction

) => {
  try {
    const token = req.cookies["accessToken"];
    if (token) req.member = await authService.checkAuth(token); 

  next();
  } catch (err) {
    console.log("Error, verifyAuth", err);
   next();
  }
};
//1
memberController.updateMember= async(req:ExtendedRequest, res:Response)=>{
  try {
    console.log("updateMember");
    const input:MemberUpdateInput = req.body
    if (req.file)input.memberImage = req.file.path
    const result = await memberService.updateMember(req.member, input)
    res.status(HttpCode.OK).json(result)
  } catch (err) {
    console.log("Error, updateMember", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
  }

//2
memberController.getRestaurant = async (req: Request, res: Response) => {
  try {
    console.log("getRestaurant");
   const result = await memberService.getRestaurant()
    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, getRestaurant", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};
export default memberController;

import { cookieOptions } from "../libs/deployment";
import { NextFunction, Request, Response } from "express";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AUTH_TIMER } from "../libs/config";
import {
  ExtendedRequest,
  LoginInput,
  Member,
  MemberInput,
  MemberUpdateInput,
} from "../libs/types/member";
import { discardNewMemberUpload, memberImagePath, requireMember } from "../libs/utils/request";
import AuthService from "../models/Auth.service";
import MemberService from "../models/Member.service";

const memberService = new MemberService();
const authService = new AuthService();

const memberController = {
  Signup: async (req: Request, res: Response) => {
    try {
      const input: MemberInput = req.body;

      // Agar rasm yuborilgan bo'lsa, saqlaymiz
      if (req.file) {
        input.memberImage = memberImagePath(req.file);
      }

      const result: Member = await memberService.Signup(input).catch(async (error) => {
        await discardNewMemberUpload(req);
        throw error;
      });

      const token = await authService.createToken(result);

      res.cookie("accessToken", token, {
        maxAge: AUTH_TIMER * 3600 * 1000,
        ...cookieOptions(),
      });

      res.status(HttpCode.CREATED).json({
        member: result,
        accessToken: token,
      });
    } catch (err) {
      if (!(err instanceof Errors)) console.error("Signup request failed", err);

      if (err instanceof Errors) {
        res.status(err.code).json(err);
      } else {
        res.status(Errors.standard.code).json(Errors.standard);
      }
    }
  },
  Login: async (req: Request, res: Response) => {
    try {
      const input: LoginInput = req.body,
        result = await memberService.Login(input),
        token = await authService.createToken(result);

      res.cookie("accessToken", token, {
        maxAge: AUTH_TIMER * 3600 * 1000,
        ...cookieOptions(),
      });

      res.status(HttpCode.OK).json({ member: result, accessToken: token });
    } catch (err) {
      if (!(err instanceof Errors)) console.error("Login request failed", err);
      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  logout: (req: ExtendedRequest, res: Response) => {
    try {
      res.clearCookie("accessToken", cookieOptions());

      return res.status(HttpCode.OK).json({ message: "Logged out" });
    } catch (err) {
      console.error("Error, Logout", err);

      if (err instanceof Errors) {
        return res.status(err.code).json(err);
      }

      return res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  getMemberDetail: async (req: ExtendedRequest, res: Response) => {
    try {
      const result = await memberService.getMemberDetail(requireMember(req));

      res.status(HttpCode.OK).json(result);
    } catch (err) {
      console.error("Error, getMemberDetail", err);
      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  getTopUsers: async (req: Request, res: Response) => {
    try {
      const result = await memberService.getTopUsers();

      res.status(HttpCode.OK).json(result);
    } catch (err) {
      console.error("Error, getTopUsers", err);
      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  verifyAuth: async (req: ExtendedRequest, res: Response, next: NextFunction) => {
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
      if (!(err instanceof Errors)) console.error("Authentication request failed", err);

      if (err instanceof Errors) {
        return res.status(err.code).json(err);
      }

      return res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  retrieveAuth: async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies["accessToken"];
      if (token) req.member = await authService.checkAuth(token);

      next();
    } catch (err) {
      if (!(err instanceof Errors)) console.error("Authentication request failed", err);
      next();
    }
  },
  updateMember: async (req: ExtendedRequest, res: Response) => {
    try {
      const input: MemberUpdateInput = req.body;
      if (req.file) input.memberImage = memberImagePath(req.file);
      const result = await memberService
        .updateMember(requireMember(req), input)
        .catch(async (error) => {
          await discardNewMemberUpload(req);
          throw error;
        });
      res.status(HttpCode.OK).json(result);
    } catch (err) {
      console.error("Error, updateMember", err);

      if (err instanceof Errors) {
        res.status(err.code).json(err);
      } else {
        res.status(500).json({
          message: "Something went wrong",
        });
      }
    }
  },
  getSeller: async (req: Request, res: Response) => {
    try {
      const result = await memberService.getSeller();
      res.status(HttpCode.OK).json(result);
    } catch (err) {
      console.error("Error, getSeller", err);
      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
};

//REACT Sign UP

//LOGIN

//3

//1

//2

export default memberController;

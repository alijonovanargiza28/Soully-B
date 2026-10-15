import { NextFunction, Request, Response } from "express";
import { MemberType } from "../libs/enums/member.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AdminRequest, LoginInput, MemberInput } from "../libs/types/member";
import { discardNewMemberUpload, memberImagePath } from "../libs/utils/request";
import MemberService from "../models/Member.service";

const memberService = new MemberService();

const sellerController = {
  goHome: (req: AdminRequest, res: Response) => {
    try {
      if (!req.session?.member) {
        return res.redirect("/admin/login");
      }

      return res.render("dashboard", {
        member: req.session.member,
        active: "dashboard",
      });
    } catch (err) {
      console.error("Error, goHome", err);
      return res.redirect("/admin/login");
    }
  },
  getSignup: (req: AdminRequest, res: Response) => {
    try {
      return res.render("signup", {
        member: null,
        active: "signup",
      });
    } catch (err) {
      console.error("Error, getSignup", err);
      return res.redirect("/admin");
    }
  },
  getLogin: (req: AdminRequest, res: Response) => {
    try {
      return res.render("login", {
        member: null,
        active: "login",
      });
    } catch (err) {
      console.error("Error, getLogin", err);
      return res.redirect("/admin/login");
    }
  },
  processSignup: async (req: AdminRequest, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        throw new Errors(HttpCode.BAD_REQUEST, Message.SOMETHING_WENT_WRONG);
      }

      const newMember: MemberInput = req.body;

      newMember.memberImage = memberImagePath(file);
      newMember.memberType = MemberType.SELLER;

      const result = await memberService.processSignup(newMember).catch(async (error) => {
        await discardNewMemberUpload(req);
        throw error;
      });

      await new Promise<void>((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
      );
      req.session.member = result;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/admin/login");
        }

        return res.redirect("/admin/product/all");
      });
    } catch (err) {
      console.error("Error, processSignup", err);

      const message = err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;

      return res.status(400).render("signup", { member: null, active: "signup", error: message });
    }
  },
  processLogin: async (req: AdminRequest, res: Response) => {
    try {
      const input: LoginInput = req.body;

      const result = await memberService.processLogin(input);

      await new Promise<void>((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
      );
      req.session.member = result;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/admin/login");
        }

        return res.redirect("/admin/product/all");
      });
    } catch (err) {
      console.error("Error, processLogin", err);

      const message = err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;

      return res.status(400).render("login", { member: null, active: "login", error: message });
    }
  },
  logout: (req: AdminRequest, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("LOGOUT ERROR:", err);
        return res.redirect("/admin/login");
      }

      res.clearCookie("connect.sid");

      return res.redirect("/admin/login");
    });
  },
  getUsers: async (req: AdminRequest, res: Response) => {
    try {
      const result = await memberService.getUsers();

      return res.render("users", {
        users: result,
        member: req.session?.member || null,
        active: "users",
      });
    } catch (err) {
      console.error("Error, getUsers", err);
      return res.redirect("/admin");
    }
  },
  updateChosenUser: async (req: Request, res: Response) => {
    try {
      const result = await memberService.updateChosenUser(req.body);

      return res.status(HttpCode.OK).json({
        data: result,
      });
    } catch (err) {
      console.error("Error, updateChosenUser", err);

      if (err instanceof Errors) {
        return res.status(err.code).json(err);
      }

      return res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  checkAuthSession: (req: AdminRequest, res: Response) =>
    res.json({
      member: { memberNick: req.member?.memberNick, memberType: req.member?.memberType },
    }),
  verifySeller: async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const saved = req.session.member;
      if (!saved) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
      const member = await memberService.getMemberDetail(saved);
      if (member.memberType !== MemberType.SELLER)
        throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHENTICATED);
      req.member = member;
      return next();
    } catch {
      if (req.get("accept")?.includes("application/json"))
        return res.status(401).json({ message: Message.NOT_AUTHENTICATED });
      return res.redirect("/admin/login");
    }
  },
};

export default sellerController;
